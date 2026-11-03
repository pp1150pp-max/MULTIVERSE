"""
Build drawing templates for a character's animation set, plus a finished example
(the idle sheet re-packed onto the standard grid).

    python tools/make_art_templates.py

Outputs into art_templates/sword/ :
  <anim>_template.png  grid with guides + faint size-reference ghost (draw on top, then hide the guides)
  idle.png             finished example, exactly what the game expects
Also re-packs public/assets/sprites/player/sword/idle.png onto the standard grid.
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

CELL = 256
FEET_Y = CELL - 16          # feet line, 16 px above the bottom edge
HEAD_Y = FEET_Y - 200       # typical standing height ~200 px
DIRS = ["down", "left", "right", "up"]

# name: (frames, fps, loop, description)
ANIMS = {
    "idle":     (4, 6,  True,  "Standing still, breathing"),
    "run":      (8, 12, True,  "Running (main movement)"),
    "dash":     (5, 16, False, "Quick dodge burst"),
    "attack":   (6, 14, False, "Basic attack - combo 1"),
    "attack_2": (6, 14, False, "Basic attack - combo 2"),
    "attack_3": (6, 14, False, "Basic attack - combo 3 (finisher)"),
    "skill_q":  (8, 14, False, "Q - Whirlwind"),
    "skill_e":  (6, 16, False, "E - Charge"),
    "skill_r":  (8, 12, False, "R - Earthquake"),
    "hit":      (3, 12, False, "Taking damage"),
    "death":    (8, 10, False, "Dying (last frame = lying down)"),
    "revive":   (8, 10, False, "Getting back up"),
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "art_templates", "sword")
GAME_DIR = os.path.join(ROOT, "public", "assets", "sprites", "player", "sword")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf", size)


def load_current_idle() -> list[Image.Image] | None:
    """Return the current idle frames (row-major, 4 dirs x 4 frames) or None."""
    path = os.path.join(GAME_DIR, "idle.png")
    manifest_path = os.path.join(GAME_DIR, "sprite.json")
    if not os.path.exists(path) or not os.path.exists(manifest_path):
        return None
    m = json.load(open(manifest_path, encoding="utf-8"))
    fw, fh = m["frameWidth"], m["frameHeight"]
    feet_px = round(m["feet"] * fh)
    sheet = Image.open(path).convert("RGBA")
    frames = []
    for r in range(len(DIRS)):
        for f in range(m["animations"]["idle"]["frames"]):
            frame = sheet.crop((f * fw, r * fh, (f + 1) * fw, (r + 1) * fh))
            # Re-seat on a standard cell: centred, feet on FEET_Y.
            cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            cell.alpha_composite(frame, ((CELL - fw) // 2, FEET_Y - (fh - feet_px)))
            frames.append(cell)
    return frames


def ghost(cell: Image.Image) -> Image.Image:
    g = cell.copy()
    alpha = g.getchannel("A").point(lambda a: a * 0.18)
    g.putalpha(alpha)
    return g


def template(name: str, frames: int, desc: str, idle: list[Image.Image] | None) -> Image.Image:
    img = Image.new("RGBA", (CELL * frames, CELL * len(DIRS)), (236, 238, 242, 255))
    d = ImageDraw.Draw(img)
    small = font(13)
    for r, direction in enumerate(DIRS):
        for f in range(frames):
            x0, y0 = f * CELL, r * CELL
            if (r + f) % 2:
                d.rectangle([x0, y0, x0 + CELL - 1, y0 + CELL - 1], fill=(226, 229, 235, 255))
            if idle:
                img.alpha_composite(ghost(idle[r * 4]), (x0, y0))
            d.rectangle([x0, y0, x0 + CELL - 1, y0 + CELL - 1], outline=(150, 156, 170, 255))
            for yy in range(y0, y0 + CELL, 8):  # centre line, dashed
                d.line([(x0 + CELL // 2, yy), (x0 + CELL // 2, yy + 4)], fill=(70, 150, 255, 255))
            d.line([(x0 + 4, y0 + FEET_Y), (x0 + CELL - 5, y0 + FEET_Y)], fill=(235, 60, 60, 255), width=2)
            for xx in range(x0 + 4, x0 + CELL - 5, 8):  # typical head height, dashed
                d.line([(xx, y0 + HEAD_Y), (xx + 4, y0 + HEAD_Y)], fill=(160, 160, 160, 255))
            d.text((x0 + 6, y0 + 5), f"{direction}  {f + 1}/{frames}", font=small, fill=(60, 66, 80, 255))
            d.text((x0 + CELL - 52, y0 + FEET_Y - 16), "feet", font=small, fill=(235, 60, 60, 255))
    return img


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    idle = load_current_idle()
    for name, (frames, fps, loop, desc) in ANIMS.items():
        template(name, frames, desc, idle).save(os.path.join(OUT, f"{name}_template.png"))

    if idle:
        sheet = Image.new("RGBA", (CELL * 4, CELL * len(DIRS)), (0, 0, 0, 0))
        for i, cell in enumerate(idle):
            sheet.alpha_composite(cell, ((i % 4) * CELL, (i // 4) * CELL))
        sheet.save(os.path.join(OUT, "idle.png"))
        sheet.save(os.path.join(GAME_DIR, "idle.png"))
        manifest = {
            "frameWidth": CELL,
            "frameHeight": CELL,
            "height": 2.5,
            "feet": round((CELL - FEET_Y) / CELL, 4),
            "sideFaces": "right",
            "directions": DIRS,
            "animations": {"idle": {"file": "idle.png", "frames": 4, "fps": 6, "loop": True}},
        }
        json.dump(manifest, open(os.path.join(GAME_DIR, "sprite.json"), "w", encoding="utf-8"), indent=2)

    print("templates:", len(ANIMS), "| idle example:", "yes" if idle else "no (no current idle found)")


if __name__ == "__main__":
    main()
