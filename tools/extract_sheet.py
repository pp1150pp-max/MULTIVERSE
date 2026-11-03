"""
Cut a presentation-style sprite sheet (transparent PNG with labels, numbered badges
and uneven spacing) into a clean game sheet: one row per direction, one column per
frame, every frame the same size with the feet on the same spot.

    python tools/extract_sheet.py <input.png> <output.png> --rows down,left,right,up
        [--cell 256] [--scale 1.15] [--anchor feet|head] [--min-x 0]

--cell   put every frame on a fixed square cell (feet 16 px above the bottom), the game standard
--scale  resize sprites, e.g. when a sheet came back smaller than the template
--anchor horizontal alignment point: "feet" (idle, attacks) or "head" (running, where legs swing)

Prints the frameWidth / frameHeight / feet values to put into sprite.json.
Also writes <output>_preview.png with guide lines so alignment can be checked.
"""
import argparse
import sys

import numpy as np
from PIL import Image, ImageDraw

ALPHA_MIN = 32        # pixels fainter than this count as background
MIN_SPRITE_AREA = 4000
LABEL_COLUMN_X = 280  # labels / title panel on the left of the sheet end around here (by centre x)
PAD = 6


def label_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """4-connected component labelling with an explicit stack (no scipy needed)."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    n = 0
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys, xs):
        if labels[sy, sx]:
            continue
        n += 1
        stack = [(sy, sx)]
        labels[sy, sx] = n
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = n
                    stack.append((ny, nx))
    return labels, n


def erase_badges(rgba: np.ndarray) -> None:
    """Clear the dark-slate frame-number badges, even where a cape tip touches them."""
    r, g, b, a = (rgba[:, :, i].astype(int) for i in range(4))
    slate = ((r < 22) & (g < 36) & (b < 50) & (b > r + 8) & (a > 200)).astype(np.int32)
    integral = np.pad(slate.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    w, h = 30, 20
    density = (integral[h:, w:] - integral[:-h, w:] - integral[h:, :-w] + integral[:-h, :-w]) / (w * h)
    for y, x in zip(*np.nonzero(density > 0.8)):
        rgba[max(0, y - 2):y + h + 2, max(0, x - 2):x + w + 2, 3] = 0


def is_badge(rgba: np.ndarray, box) -> bool:
    """Frame-number badges: small, boxy, mostly dark slate."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if not (12 <= w <= 40 and 10 <= h <= 30):
        return False
    region = rgba[y0:y1, x0:x1, :3].reshape(-1, 3).astype(int)
    return (region.sum(axis=1) < 200).mean() > 0.5


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--rows", required=True, help="direction names top-to-bottom, e.g. down,left,right,up")
    ap.add_argument("--min-x", type=int, default=LABEL_COLUMN_X)
    ap.add_argument("--cell", type=int, default=0)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--anchor", choices=["feet", "head"], default="feet")
    args = ap.parse_args()
    row_names = args.rows.split(",")

    img = Image.open(args.input).convert("RGBA")
    rgba = np.array(img)
    erase_badges(rgba)
    mask = rgba[:, :, 3] > ALPHA_MIN
    labels, n = label_components(mask)

    comps = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(labels == i)
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        comps.append({"id": i, "area": len(xs), "box": box})

    big = [c for c in comps if c["area"] >= MIN_SPRITE_AREA and (c["box"][0] + c["box"][2]) / 2 > args.min_x]
    # Attach detached bits (sword glints, hair strands) to the sprite whose box they touch.
    for c in comps:
        if c in big or c["area"] < 8 or is_badge(rgba, c["box"]):
            continue
        cx0, cy0, cx1, cy1 = c["box"]
        for b in big:
            bx0, by0, bx1, by1 = b["box"]
            if cx1 >= bx0 - 6 and cx0 <= bx1 + 6 and cy1 >= by0 - 6 and cy0 <= by1 + 2:
                b.setdefault("extra", []).append(c["id"])
                break

    big.sort(key=lambda c: (c["box"][1] + c["box"][3]) / 2)
    rows: list[list[dict]] = []
    for c in big:
        cy = (c["box"][1] + c["box"][3]) / 2
        if rows and abs(cy - np.mean([(r["box"][1] + r["box"][3]) / 2 for r in rows[-1]])) < 80:
            rows[-1].append(c)
        else:
            rows.append([c])
    if len(rows) != len(row_names):
        sys.exit(f"found {len(rows)} rows of sprites but --rows lists {len(row_names)}: {[len(r) for r in rows]}")
    counts = {len(r) for r in rows}
    if len(counts) != 1:
        sys.exit(f"rows have different frame counts: {[len(r) for r in rows]}")
    frames = counts.pop()

    sprites = []
    for r in rows:
        r.sort(key=lambda c: c["box"][0])
        out_row = []
        for c in r:
            ids = [c["id"], *c.get("extra", [])]
            m = np.isin(labels, ids)
            ys, xs = np.nonzero(m)
            x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            # Anchor: bottom of the feet, horizontally at the centre of the lowest 25% of the body
            # (the sword sticks out sideways, so the full bounding-box centre would wobble).
            if args.anchor == "head":
                band = ys <= y0 + (y1 - y0) * 0.3
            else:
                band = ys >= y1 - (y1 - y0) * 0.25
            ax = xs[band].mean()
            crop = rgba[y0:y1, x0:x1].copy()
            crop[~m[y0:y1, x0:x1]] = 0
            im = Image.fromarray(crop)
            if args.scale != 1.0:
                im = im.resize((round(im.width * args.scale), round(im.height * args.scale)), Image.LANCZOS)
            out_row.append({"img": np.array(im), "ax": round((ax - x0) * args.scale), "ay": im.height})
        sprites.append(out_row)

    left = max(s["ax"] for r in sprites for s in r)
    right = max(s["img"].shape[1] - s["ax"] for r in sprites for s in r)
    up = max(s["ay"] for r in sprites for s in r)
    if args.cell:
        fw = fh = args.cell
        half = fw // 2
        feet_px = 16
        if up > fh - feet_px:
            print(f"warning: tallest frame is {up}px and gets clipped by the {fh}px cell; try a smaller --scale")
    else:
        half = max(left, right) + PAD
        fw = half * 2
        fh = up + PAD * 2
        feet_px = PAD  # feet sit PAD pixels above the bottom edge

    sheet = Image.new("RGBA", (fw * frames, fh * len(rows)), (0, 0, 0, 0))
    for ri, r in enumerate(sprites):
        # With a fixed cell, slide the whole row (same offset for every frame, so no jitter)
        # until its combined extent is centred — e.g. a long trailing cape in side views.
        shift = 0
        if args.cell:
            lo = min(-s["ax"] for s in r)
            hi = max(s["img"].shape[1] - s["ax"] for s in r)
            shift = -round((lo + hi) / 2)
            if hi - lo > fw:
                print(f"warning: row {row_names[ri]} is {hi - lo}px wide and will be clipped by the {fw}px cell")
        for fi, s in enumerate(r):
            px = fi * fw + half + shift - s["ax"]
            py = ri * fh + (fh - feet_px) - s["ay"]
            sheet.alpha_composite(Image.fromarray(s["img"]), (px, py))
    sheet.save(args.output)

    preview = Image.new("RGBA", sheet.size, (40, 44, 52, 255))
    preview.alpha_composite(sheet)
    d = ImageDraw.Draw(preview)
    for ri in range(len(rows)):
        y = ri * fh + fh - feet_px
        d.line([(0, y), (sheet.width, y)], fill=(255, 80, 80, 255))
    for fi in range(frames):
        x = fi * fw + half
        d.line([(x, 0), (x, sheet.height)], fill=(80, 200, 255, 255))
    preview.save(args.output.rsplit(".", 1)[0] + "_preview.png")

    print(f"rows={row_names} frames={frames}")
    print(f'"frameWidth": {fw}, "frameHeight": {fh}, "feet": {feet_px / fh:.3f}')


if __name__ == "__main__":
    main()
