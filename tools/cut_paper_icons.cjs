// Papercraft icons (art_templates/papercraft_icons/PROMPTS.md).
//   node tools/cut_paper_icons.cjs ref  → groups sprites/icons/ into sheets of 12 (4 x 3), writes each sheet's old
//                                         icons on its background to art_templates/papercraft_icons/raw/ref/<sheet>_old.png
//                                         and the list to art_templates/papercraft_icons/sheets.json
//   node tools/cut_paper_icons.cjs [sheet …] → cuts art_templates/papercraft_icons/raw/<sheet>.png into
//                                         public/assets/sprites/paper/icons/: each icon the old file's size, the art
//                                         fitted into the box the old art filled (so transparent margins stay the same)
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ICONS = path.join(ROOT, 'public/assets/sprites/icons');
const DIR = path.join(ROOT, 'art_templates/papercraft_icons');
const RAW = path.join(DIR, 'raw');
const OUT = path.join(ROOT, 'public/assets/sprites/paper/icons');
const LIST = path.join(DIR, 'sheets.json');
const COLS = 4;
const ROWS = 3;
const CELL = 160;
const GAP = 48;
const BG = { magenta: [255, 0, 255], green: [0, 255, 0], cyan: [0, 255, 255] };
/** Damage-number art stays as it is. */
const SKIP = new Set(['digits', 'crit_burst']);

const GROUPS = [['skill', /^skill_/], ['item', /^item_/], ['misc', /^(stone_|potion_|coin)/], ['map', /^(map_|npc_)/]];

/** The background farthest from every colour in these icons (so keying never eats the art). */
async function pickBg(names) {
  let best = 'magenta', bestD = -1;
  for (const [bg, [r, g, b]] of Object.entries(BG)) {
    let min = Infinity;
    for (const n of names) {
      const { data } = await sharp(path.join(ICONS, `${n}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 16) if (data[i + 3] > 200) min = Math.min(min, Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b));
    }
    if (min > bestD) { bestD = min; best = bg; }
  }
  return best;
}

async function ref() {
  const all = fs.readdirSync(ICONS).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).filter((n) => !SKIP.has(n)).sort();
  const sheets = [];
  for (const [g, re] of GROUPS) {
    const names = all.filter((n) => re.test(n));
    for (let i = 0; i < names.length; i += COLS * ROWS) sheets.push({ name: `${g}_${sheets.filter((s) => s.name.startsWith(g)).length + 1}`, icons: names.slice(i, i + COLS * ROWS) });
  }
  fs.mkdirSync(path.join(RAW, 'ref'), { recursive: true });
  for (const s of sheets) {
    s.bg = await pickBg(s.icons);
    const rows = Math.ceil(s.icons.length / COLS);
    const W = COLS * CELL + (COLS + 1) * GAP;
    const H = rows * CELL + (rows + 1) * GAP;
    const layers = [];
    for (let i = 0; i < s.icons.length; i++) {
      const input = await sharp(path.join(ICONS, `${s.icons[i]}.png`)).resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      layers.push({ input, left: GAP + (i % COLS) * (CELL + GAP), top: GAP + Math.floor(i / COLS) * (CELL + GAP) });
    }
    const [r, g, b] = BG[s.bg];
    await sharp({ create: { width: W, height: H, channels: 4, background: { r, g, b, alpha: 1 } } }).composite(layers).flatten({ background: { r, g, b } })
      .png().toFile(path.join(RAW, 'ref', `${s.name}_old.png`));
    console.log(`  ref/${s.name}_old.png ${s.icons.length} icons on ${s.bg}`);
  }
  fs.writeFileSync(LIST, JSON.stringify(sheets, null, 1) + '\n');
}

async function keyed(f, bg) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const key = BG[bg];
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]);
    data[i + 3] = d < 90 ? 0 : d > 170 ? 255 : Math.round(((d - 90) / 80) * 255);
    if (d < 260) {
      const lo = Math.min(...[0, 1, 2].filter((c) => !key[c]).map((c) => data[i + c]));
      for (const c of [0, 1, 2]) if (key[c]) data[i + c] = Math.min(data[i + c], lo + 40);
    }
  }
  return { w: info.width, h: info.height, d: data };
}

function bands(has, n, want, gap, label) {
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
  if (out.length !== want) throw new Error(`${label}: found ${out.length}, wanted ${want}`);
  return out;
}

/** The box the old icon's art fills inside its file. */
async function artBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 20) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { W: info.width, H: info.height, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function cut(s) {
  const src = path.join(RAW, `${s.name}.png`);
  if (!fs.existsSync(src)) return console.warn(`- ${s.name}.png: not there yet, skipped`);
  const img = await keyed(src, s.bg);
  const op = (x, y) => img.d[(y * img.w + x) * 4 + 3] > 40;
  const gap = Math.max(6, Math.round(img.w / 120));
  const rows = Math.ceil(s.icons.length / COLS);
  const rowB = bands((y) => { for (let x = 0; x < img.w; x++) if (op(x, y)) return true; return false; }, img.h, rows, gap, `${s.name} rows`);
  const raw = sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } });
  fs.mkdirSync(OUT, { recursive: true });
  for (let r = 0; r < rows; r++) {
    const inRow = s.icons.slice(r * COLS, r * COLS + COLS);
    const [y0, y1] = rowB[r];
    const colB = bands((x) => { for (let y = y0; y < y1; y++) if (op(x, y)) return true; return false; }, img.w, inRow.length, gap, `${s.name} row ${r + 1}`);
    for (let c = 0; c < inRow.length; c++) {
      const [x0, x1] = colB[c];
      let t = y1, b = y0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (op(x, y)) { if (y < t) t = y; if (y > b) b = y; }
      const n = inRow[c];
      const box = await artBox(path.join(ICONS, `${n}.png`));
      const piece = await raw.clone().extract({ left: x0, top: t, width: x1 - x0, height: b + 1 - t })
        .resize(box.w, box.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' }).png().toBuffer();
      await sharp({ create: { width: box.W, height: box.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: piece, left: box.x0, top: box.y0 }]).png().toFile(path.join(OUT, `${n}.png`));
    }
    console.log(`  ${s.name} row ${r + 1}: ${inRow.join(' ')}`);
  }
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
