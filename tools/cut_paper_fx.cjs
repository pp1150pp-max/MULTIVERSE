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
  // ChatGPT keeps the reference's even spacing, but tall pieces (lightning, a mushroom cloud) reach into the next row,
  // so gaps between lines don't find the rows. Instead every connected piece goes to the frame of the even grid (over
  // the drawing's extent) its centre falls in, and each frame is the union of its pieces.
  const { w, h, d } = img;
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (label[s0] >= 0 || d[s0 * 4 + 3] <= 40) continue;
    const px = [], st = [s0];
    label[s0] = comps.length;
    let sx = 0, sy = 0;
    while (st.length) {
      const k = st.pop();
      px.push(k);
      const x = k % w, y = (k - x) / w;
      sx += x; sy += y;
      for (const t of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k >= w ? k - w : -1, k < w * (h - 1) ? k + w : -1]) {
        if (t >= 0 && label[t] < 0 && d[t * 4 + 3] > 40) { label[t] = comps.length; st.push(t); }
      }
    }
    comps.push({ px, cx: sx / px.length, cy: sy / px.length });
  }
  const big = Math.max(1, ...comps.map((c) => c.px.length));
  const kept = comps.filter((c) => c.px.length >= Math.max(12, big * 0.002));
  let X0 = w, Y0 = h, X1 = 0, Y1 = 0;
  for (const c of kept) for (const k of c.px) {
    const x = k % w, y = (k - x) / w;
    if (x < X0) X0 = x; if (x > X1) X1 = x; if (y < Y0) Y0 = y; if (y > Y1) Y1 = y;
  }
  // Only rows the old sheet uses (an empty last row isn't drawn).
  const usedRows = Array.from({ length: s.rows }, (_, r) => r).filter((r) => boxes.slice(r * s.cols, r * s.cols + s.cols).some(Boolean));
  const cellOf = (c) => {
    const col = Math.min(s.cols - 1, Math.max(0, Math.floor(((c.cx - X0) / (X1 + 1 - X0)) * s.cols)));
    const ri = Math.min(usedRows.length - 1, Math.max(0, Math.floor(((c.cy - Y0) / (Y1 + 1 - Y0)) * usedRows.length)));
    return usedRows[ri] * s.cols + col;
  };
  const groups = Array.from({ length: s.rows * s.cols }, () => []);
  for (const c of kept) groups[cellOf(c)].push(c);
  const layers = [];
  for (let i = 0; i < groups.length; i++) {
    const box = boxes[i];
    if (!box || !groups[i].length) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const c of groups[i]) for (const k of c.px) {
      const x = k % w, y = (k - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const pw = x1 - x0 + 1, ph = y1 - y0 + 1;
    const buf = Buffer.alloc(pw * ph * 4);
    for (const c of groups[i]) for (const k of c.px) {
      const x = (k % w) - x0, y = Math.floor(k / w) - y0;
      d.copy(buf, (y * pw + x) * 4, k * 4, k * 4 + 4);
    }
    const piece = await sharp(buf, { raw: { width: pw, height: ph, channels: 4 } })
      .resize(box.w, box.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' }).png().toBuffer();
    layers.push({ input: piece, left: box.x0, top: box.y0 });
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
