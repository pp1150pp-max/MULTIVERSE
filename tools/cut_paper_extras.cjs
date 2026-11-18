// Papercraft auras, title sets and enhancement orbs (art_templates/papercraft_fx/PROMPTS.md parts B–D).
//   node tools/cut_paper_extras.cjs [aura|title|orbs …]
// Reads art_templates/papercraft_fx/raw/ and writes:
//   aura_<x>.png  → sprites/paper/fx/aura_<x>_ring.png + aura_<x>_foot.png. The art is drawn as seen by the camera;
//                   the game lays them flat on the ground, so they are stretched back up by 1/sin(camera pitch) here.
//                   Black background → alpha from brightness.
//   title_<x>.png → sprites/paper/ui/title_<x>_{plate,bubble}{,_t,_b}.png: the frame squeezed to its corners and a
//                   plain middle piece (repeated by CSS border-image), plus the top and bottom middle (crown, tail)
//                   drawn on top. Their measures go to src/client/paperTitles.ts.
//   orbs.png      → sprites/paper/fx/orbs.png: 4×4 cells of 64 px (rows = shapes, columns = detail), white paper.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'art_templates/papercraft_fx/raw');
const FX = path.join(ROOT, 'public/assets/sprites/paper/fx');
const UI = path.join(ROOT, 'public/assets/sprites/paper/ui');
const TITLES_TS = path.join(ROOT, 'src/client/paperTitles.ts');
const BG = { magenta: [255, 0, 255], green: [0, 255, 0] };
/** Camera elevation (world.ts ISO_DIR = (1, 1.45, 1)): a ground circle shows sin(pitch) as tall as wide. */
const UNSQUASH = 1 / Math.sin(Math.atan2(1.45, Math.SQRT2));

async function rgba(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: data };
}
const save = (img, file) => sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } }).png().toFile(file);

/** Copies the box [x0, x1) × [y0, y1). */
function crop(img, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0, d = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.d.copy(d, y * w * 4, ((y + y0) * img.w + x0) * 4, ((y + y0) * img.w + x1) * 4);
  return { w, h, d };
}
/** Side by side, same height. */
function hcat(parts) {
  const w = parts.reduce((s, p) => s + p.w, 0), h = parts[0].h, d = Buffer.alloc(w * h * 4);
  let x = 0;
  for (const p of parts) {
    for (let y = 0; y < h; y++) p.d.copy(d, (y * w + x) * 4, y * p.w * 4, (y + 1) * p.w * 4);
    x += p.w;
  }
  return { w, h, d };
}
async function resize(img, w, h) {
  const { data, info } = await sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: data };
}
const alphaAt = (img, x, y) => img.d[(y * img.w + x) * 4 + 3];

/** Opaque box of the part of `img` inside [x0, x1) × [y0, y1). */
function bbox(img, x0 = 0, y0 = 0, x1 = img.w, y1 = img.h, min = 24) {
  let bx0 = x1, by0 = y1, bx1 = -1, by1 = -1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (alphaAt(img, x, y) > min) {
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  return bx1 < 0 ? null : { x0: bx0, y0: by0, x1: bx1 + 1, y1: by1 + 1 };
}

/** The widest run of empty columns (or rows) inside a box: where two pieces drawn side by side part. */
function widestGap(img, box, alongX) {
  const n = alongX ? box.x1 - box.x0 : box.y1 - box.y0;
  const has = (i) => {
    if (alongX) { for (let y = box.y0; y < box.y1; y++) if (alphaAt(img, box.x0 + i, y) > 24) return true; }
    else for (let x = box.x0; x < box.x1; x++) if (alphaAt(img, x, box.y0 + i) > 24) return true;
    return false;
  };
  let best = [0, 0], start = -1;
  for (let i = 0; i <= n; i++) {
    const empty = i < n && !has(i);
    if (empty && start < 0) start = i;
    if (!empty && start >= 0) { if (i - start > best[1] - best[0]) best = [start, i]; start = -1; }
  }
  return (alongX ? box.x0 : box.y0) + Math.round((best[0] + best[1]) / 2);
}

// ------------------------------------------------------------ auras

/** Black background: alpha = brightness, colour un-darkened, so normal blending shows it on any ground. */
async function glowOnBlack(f) {
  const img = await rgba(f);
  for (let i = 0; i < img.d.length; i += 4) {
    const m = Math.max(img.d[i], img.d[i + 1], img.d[i + 2]);
    const a = m < 14 ? 0 : Math.min(255, Math.round((m - 14) * 1.6));
    if (a > 0) for (const c of [0, 1, 2]) img.d[i + c] = Math.min(255, Math.round((img.d[i + c] * 255) / Math.max(m, 1)));
    img.d[i + 3] = a;
  }
  return img;
}

async function aura(name) {
  const img = await glowOnBlack(path.join(RAW, `${name}.png`));
  const all = bbox(img, 0, 0, img.w, img.h, 40);
  const split = widestGap(img, all, true);
  for (const [part, x0, x1, width] of [['ring', 0, split, 512], ['foot', split, img.w, 96]]) {
    const b = bbox(img, x0, 0, x1, img.h, 8);
    const pad = 6;
    const c = crop(img, Math.max(0, b.x0 - pad), Math.max(0, b.y0 - pad), Math.min(img.w, b.x1 + pad), Math.min(img.h, b.y1 + pad));
    // Footprints: a square-ish box, the long side fitted to `width`.
    const k = width / Math.max(c.w, c.h * UNSQUASH);
    const out = await resize(c, c.w * k, c.h * UNSQUASH * k);
    await save(out, path.join(FX, `${name}_${part}.png`));
    console.log(`${name}_${part}: ${out.w}×${out.h}`);
  }
}

// ------------------------------------------------------------ title sets

async function keyed(f) {
  const img = await rgba(f);
  // The background is whatever the corner shows (magenta, or green for title_shadow).
  const [r, g, b] = [img.d[0], img.d[1], img.d[2]];
  const bg = Math.hypot(r - 0, g - 255, b - 0) < Math.hypot(r - 255, g - 0, b - 255) ? 'green' : 'magenta';
  const key = BG[bg];
  for (let i = 0; i < img.d.length; i += 4) {
    const d = Math.hypot(img.d[i] - key[0], img.d[i + 1] - key[1], img.d[i + 2] - key[2]);
    img.d[i + 3] = d < 90 ? 0 : d > 170 ? 255 : Math.round(((d - 90) / 80) * 255);
    if (d < 170) {
      const lo = Math.min(...[0, 1, 2].filter((c) => !key[c]).map((c) => img.d[i + c]));
      for (const c of [0, 1, 2]) if (key[c]) img.d[i + c] = Math.min(img.d[i + c], lo + 40);
    }
  }
  return img;
}

/** Where the frame's plain edges are, inside a piece cropped to its opaque box. */
function frameEdges(p) {
  const col = Math.round(p.w * 0.27);
  let top = 0, bottom = p.h - 1;
  while (top < p.h && alphaAt(p, col, top) < 128) top++;
  while (bottom > 0 && alphaAt(p, col, bottom) < 128) bottom--;
  const row = Math.round((top + bottom) / 2);
  let left = 0, right = p.w - 1;
  while (left < p.w && alphaAt(p, left, row) < 128) left++;
  while (right > 0 && alphaAt(p, right, row) < 128) right--;
  return { top, bottom: bottom + 1, left, right: right + 1 };
}

/** Image height of the frame body (between its plain top and bottom edges) in the files written. */
const BODY_PX = { plate: 72, bubble: 120 };
/** Columns (share of the body width) kept as corners, the plain piece repeated between them, and the middle drawn on top. */
const CORNER = 0.21, PLAIN = [0.21, 0.33], MIDDLE = [0.35, 0.65];
/** Share of the body height kept as the top and bottom slices. */
const SLICE = 0.42;

async function framePiece(name, kind, raw) {
  const b = bbox(raw);
  let p = crop(raw, b.x0, b.y0, b.x1, b.y1);
  let e = frameEdges(p);
  const k = BODY_PX[kind] / (e.bottom - e.top);
  p = await resize(p, p.w * k, p.h * k);
  e = frameEdges(p);
  const bw = e.right - e.left, bh = e.bottom - e.top;
  const cx = (f) => Math.round(e.left + bw * f);
  const sliceT = e.top + Math.round(bh * SLICE);
  const sliceB = p.h - e.bottom + Math.round(bh * SLICE);
  // Squeezed frame: left corner | plain piece | right corner.
  const leftEnd = cx(CORNER), rightStart = cx(1 - CORNER);
  const plain = crop(p, cx(PLAIN[0]), 0, cx(PLAIN[1]), p.h);
  const frame = hcat([crop(p, 0, 0, leftEnd, p.h), plain, crop(p, rightStart, 0, p.w, p.h)]);
  const top = crop(p, cx(MIDDLE[0]), 0, cx(MIDDLE[1]), sliceT);
  const bot = crop(p, cx(MIDDLE[0]), p.h - sliceB, cx(MIDDLE[1]), p.h);
  const file = `${name}_${kind}`;
  await save(frame, path.join(UI, `${file}.png`));
  await save(top, path.join(UI, `${file}_t.png`));
  await save(bot, path.join(UI, `${file}_b.png`));
  return {
    w: frame.w, h: frame.h,
    slice: [sliceT, frame.w - leftEnd - plain.w, sliceB, leftEnd],
    outset: [e.top, p.w - e.right, p.h - e.bottom, e.left],
    mid: [top.w, top.h, bot.h],
    body: [bw, bh],
  };
}

async function title(name) {
  const img = await keyed(path.join(RAW, `${name}.png`));
  const all = bbox(img);
  const split = widestGap(img, all, false);
  const out = {
    plate: await framePiece(name, 'plate', crop(img, 0, 0, img.w, split)),
    bubble: await framePiece(name, 'bubble', crop(img, 0, split, img.w, img.h)),
  };
  console.log(`${name}: plate ${out.plate.w}×${out.plate.h}, bubble ${out.bubble.w}×${out.bubble.h}`);
  return out;
}

async function writeTitles(done) {
  let old = {};
  if (fs.existsSync(TITLES_TS)) {
    const m = /= (\{[\s\S]*\});/.exec(fs.readFileSync(TITLES_TS, 'utf8'));
    if (m) old = JSON.parse(m[1]);
  }
  const all = { ...old, ...done };
  fs.writeFileSync(TITLES_TS, `// Made by tools/cut_paper_extras.cjs: do not edit.
/** Measures of a paper title frame, in pixels of its files (sprites/paper/ui/<id>_<kind>{,_t,_b}.png). */
export interface PaperFrame {
  w: number;
  h: number;
  /** border-image-slice: top, right, bottom, left. */
  slice: [number, number, number, number];
  /** How far the art sticks out past the frame's plain edges: top, right, bottom, left. */
  outset: [number, number, number, number];
  /** The middle pieces drawn on top: width, top piece height, bottom piece height. */
  mid: [number, number, number];
  /** The frame body between its plain edges: width, height. */
  body: [number, number];
}
export const PAPER_TITLES: Record<string, { plate: PaperFrame; bubble: PaperFrame }> = ${JSON.stringify(all)};
`);
}

// ------------------------------------------------------------ orbs

const ORB_CELL = 64;

async function orbs() {
  const img = await keyed(path.join(RAW, 'orbs.png'));
  const cw = img.w / 4, ch = img.h / 4;
  const cells = [];
  let maxSide = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const b = bbox(img, Math.round(c * cw), Math.round(r * ch), Math.round((c + 1) * cw), Math.round((r + 1) * ch), 60);
    cells.push(b);
    maxSide = Math.max(maxSide, b.x1 - b.x0, b.y1 - b.y0);
  }
  // One scale for every cell, so the orbs keep their sizes against each other (the rays make the 4th column bigger).
  const k = (ORB_CELL - 2) / maxSide;
  const parts = [];
  for (let i = 0; i < 16; i++) {
    const b = cells[i];
    const piece = await resize(crop(img, b.x0, b.y0, b.x1, b.y1), (b.x1 - b.x0) * k, (b.y1 - b.y0) * k);
    parts.push({ input: await sharp(piece.d, { raw: { width: piece.w, height: piece.h, channels: 4 } }).png().toBuffer(),
      left: (i % 4) * ORB_CELL + Math.round((ORB_CELL - piece.w) / 2), top: Math.floor(i / 4) * ORB_CELL + Math.round((ORB_CELL - piece.h) / 2) });
  }
  await sharp({ create: { width: ORB_CELL * 4, height: ORB_CELL * 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts).png().toFile(path.join(FX, 'orbs.png'));
  console.log(`orbs: ${ORB_CELL * 4}×${ORB_CELL * 4}`);
}

async function main() {
  fs.mkdirSync(FX, { recursive: true });
  fs.mkdirSync(UI, { recursive: true });
  const want = process.argv.slice(2);
  const pick = (kind) => !want.length || want.includes(kind);
  const files = fs.readdirSync(RAW);
  if (pick('aura')) for (const f of files.filter((f) => /^aura_\w+\.png$/.test(f))) await aura(f.slice(0, -4));
  if (pick('title')) {
    const done = {};
    for (const f of files.filter((f) => /^title_\w+\.png$/.test(f))) done[f.slice(0, -4)] = await title(f.slice(0, -4));
    await writeTitles(done);
  }
  if (pick('orbs') && files.includes('orbs.png')) await orbs();
}

main().catch((e) => { console.error(e); process.exit(1); });
