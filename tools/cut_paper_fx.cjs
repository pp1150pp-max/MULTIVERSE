// Papercraft skill effects (art_templates/papercraft_fx/PROMPTS.md). The old sheets in sprites/fx/ are grids of
// 6 frames across (a row per effect) or single pictures.
//   node tools/cut_paper_fx.cjs ref   → art_templates/papercraft_fx/raw/ref/<name>_old.png: the old frames spread
//                                       apart on a flat background ChatGPT redraws, and sheets.json (grid + background)
//   node tools/cut_paper_fx.cjs [name …] → cuts art_templates/papercraft_fx/raw/<name>.png into
//                                       public/assets/sprites/paper/fx/<name>.png: the old sheet's size, each frame
//                                       fitted into the box the old frame filled in its cell (so timing and anchors stay)
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const FX = path.join(ROOT, 'public/assets/sprites/fx');
const DIR = path.join(ROOT, 'art_templates/papercraft_fx');
const RAW = path.join(DIR, 'raw');
const OUT = path.join(ROOT, 'public/assets/sprites/paper/fx');
const LIST = path.join(DIR, 'sheets.json');
const FRAMES = 6;
const GAP = 40;
const BG = { magenta: [255, 0, 255], green: [0, 255, 0], cyan: [0, 255, 255] };
/** Kept as they are: the death crater is a colourless shadow under the body. */
const SKIP = new Set(['death_crater']);

async function rgba(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: data };
}

/** The background farthest from every visible colour of the sheet. */
function pickBg(img) {
  let best = 'magenta', bestD = -1;
  for (const [bg, [r, g, b]] of Object.entries(BG)) {
    let min = Infinity;
    for (let i = 0; i < img.d.length; i += 12) if (img.d[i + 3] > 120) min = Math.min(min, Math.hypot(img.d[i] - r, img.d[i + 1] - g, img.d[i + 2] - b));
    if (min > bestD) { bestD = min; best = bg; }
  }
  return best;
}

/** The grid of an old sheet: 6 frames across when its cells come out square-ish, else one picture. */
function gridOf(w, h) {
  const cw = w / FRAMES;
  const rows = Math.round(h / cw);
  return w >= 600 && rows >= 1 ? { cols: FRAMES, rows } : { cols: 1, rows: 1 };
}

/** The opaque box of each cell of an old sheet (null = empty cell). */
function cellBoxes(img, cols, rows) {
  const cw = img.w / cols, ch = img.h / rows, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const X0 = Math.round(c * cw), Y0 = Math.round(r * ch), X1 = Math.round((c + 1) * cw), Y1 = Math.round((r + 1) * ch);
    let x0 = X1, y0 = Y1, x1 = -1, y1 = -1;
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (img.d[(y * img.w + x) * 4 + 3] > 24) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    out.push(x1 < 0 ? null : { cell: [X0, Y0, X1 - X0, Y1 - Y0], x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}

async function ref() {
  fs.mkdirSync(path.join(RAW, 'ref'), { recursive: true });
  const sheets = [];
  for (const f of fs.readdirSync(FX).filter((x) => x.endsWith('.png')).sort()) {
    const name = f.slice(0, -4);
    if (SKIP.has(name)) continue;
    const img = await rgba(path.join(FX, f));
    const { cols, rows } = gridOf(img.w, img.h);
    const bg = pickBg(img);
    sheets.push({ name, cols, rows, bg, frames: cellBoxes(img, cols, rows).filter(Boolean).length });
    // Spread the cells apart so ChatGPT draws every frame on its own.
    const cw = img.w / cols, ch = img.h / rows;
    const scale = cols === 1 ? Math.max(1, 256 / Math.max(img.w, img.h)) : 1;
    const W = Math.round(cols * cw * scale + (cols + 1) * GAP), H = Math.round(rows * ch * scale + (rows + 1) * GAP);
    const layers = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const piece = await sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } })
        .extract({ left: Math.round(c * cw), top: Math.round(r * ch), width: Math.round(cw), height: Math.round(ch) })
        .resize(Math.round(cw * scale), Math.round(ch * scale), { kernel: 'nearest' }).png().toBuffer();
      layers.push({ input: piece, left: Math.round(GAP + c * (cw * scale + GAP)), top: Math.round(GAP + r * (ch * scale + GAP)) });
    }
    const [R, G, B] = BG[bg];
    await sharp({ create: { width: W, height: H, channels: 4, background: { r: R, g: G, b: B, alpha: 1 } } })
      .composite(layers).flatten({ background: { r: R, g: G, b: B } }).png().toFile(path.join(RAW, 'ref', `${name}_old.png`));
    console.log(`  ref/${name}_old.png ${cols}x${rows} on ${bg}`);
  }
  fs.writeFileSync(LIST, JSON.stringify(sheets, null, 1) + '\n');
}

async function keyed(f, bg) {
  const img = await rgba(f);
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

function bands(has, n, want, gap) {
  const out = [];
  let start = -1, empty = 0;
  for (let i = 0; i < n; i++) {
    if (has(i)) { if (start < 0) start = i; empty = 0; } else if (start >= 0 && ++empty >= gap) { out.push([start, i - empty + 1]); start = -1; }
  }
  if (start >= 0) out.push([start, n]);
  while (out.length > want) {
    let best = 0;
    for (let i = 1; i < out.length - 1; i++) if (out[i + 1][0] - out[i][1] < out[best + 1][0] - out[best][1]) best = i;
    out.splice(best, 2, [out[best][0], out[best + 1][1]]);
  }
  return out;
}

/** Splits [a, b) into n equal parts. */
const even = (a, b, n) => Array.from({ length: n }, (_, i) => [Math.round(a + ((b - a) * i) / n), Math.round(a + ((b - a) * (i + 1)) / n)]);

async function cut(s) {
  const src = path.join(RAW, `${s.name}.png`);
  if (!fs.existsSync(src)) return console.warn(`- ${s.name}.png: not there yet, skipped`);
  const img = await keyed(src, s.bg);
  const old = await rgba(path.join(FX, `${s.name}.png`));
  const boxes = cellBoxes(old, s.cols, s.rows);
  const op = (x, y) => img.d[(y * img.w + x) * 4 + 3] > 40;
  const gap = Math.max(5, Math.round(img.w / 160));
  let rowB = bands((y) => { for (let x = 0; x < img.w; x++) if (op(x, y)) return true; return false; }, img.h, s.rows, gap);
  if (rowB.length !== s.rows) {
    console.warn(`  ! ${s.name}: rows by spacing failed, equal rows`);
    rowB = even(rowB[0]?.[0] ?? 0, rowB[rowB.length - 1]?.[1] ?? img.h, s.rows);
  }
  const raw = sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } });
  const layers = [];
  for (let r = 0; r < s.rows; r++) {
    const [y0, y1] = rowB[r];
    let colB = bands((x) => { for (let y = y0; y < y1; y++) if (op(x, y)) return true; return false; }, img.w, s.cols, gap);
    if (colB.length !== s.cols) {
      console.warn(`  ! ${s.name} row ${r + 1}: frames by spacing failed, equal columns`);
      colB = even(colB[0]?.[0] ?? 0, colB[colB.length - 1]?.[1] ?? img.w, s.cols);
    }
    for (let c = 0; c < s.cols; c++) {
      const box = boxes[r * s.cols + c];
      if (!box) continue;
      const [x0, x1] = colB[c];
      let t = y1, b = y0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (op(x, y)) { if (y < t) t = y; if (y > b) b = y; }
      if (b < t) continue;
      const piece = await raw.clone().extract({ left: x0, top: t, width: x1 - x0, height: b + 1 - t })
        .resize(box.w, box.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' }).png().toBuffer();
      layers.push({ input: piece, left: box.x0, top: box.y0 });
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  await sharp({ create: { width: old.w, height: old.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${s.name}.png`));
  console.log(`  ${s.name}.png ${old.w}x${old.h}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'ref') return ref();
  const sheets = JSON.parse(fs.readFileSync(LIST, 'utf8'));
  for (const s of sheets) if (!args.length || args.includes(s.name)) await cut(s);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
