// Cuts the owner's floor-2 set sheets (art_templates/papercraft_icons/FLOOR2_SETS.md: 7 × 2 icons on magenta,
// raw files in art_templates/papercraft_icons/raw/floor2/, not committed) into 96×96 item icons:
//   PNGJS=<path to pngjs> node tools/cut_set_icons.cjs [contact-sheet.png]
// Row 1: sword, staff, pistol, scabbard, orb, ammo case, set badge · row 2: helmet, necklace, armour, gloves, belt,
// boots, ring. Files: item_<set>_<part>[_<class>].png (data/items.ts SET_ROWS) and set_<set>.png for the badge.
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');
const { cut, SIZE } = require('./cut_equip_icons.cjs');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.resolve(ROOT, process.env.RAW_DIR || 'art_templates/papercraft_icons/raw/floor2');
const OUT = path.join(ROOT, 'public/assets/sprites/icons');
const SHEETS = { beach: 'set_beach.png', pirate: 'set_pirate.png', ghost_sailor: 'set_ghost.png', sea_king: 'set_sea_king.png' };
const CELLS = [
  ['weapon_sword', 'weapon_mage', 'weapon_gunslinger', 'scabbard_sword', 'orb_mage', 'pouch_gunslinger', null],
  ['helmet', 'necklace', 'armor', 'gloves', 'belt', 'boots', 'ring'],
];

/** One cell of the sheet as its own picture. */
function crop(src, x0, y0, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) src.data.copy(out.data, y * w * 4, ((y0 + y) * src.width + x0) * 4, ((y0 + y) * src.width + x0 + w) * 4);
  return out;
}

/** Solid magenta background (as in cut_equip_icons.cjs). */
const isKey = (d, i) => d[i] > 190 && d[i + 2] > 190 && d[i + 1] < 110 && Math.abs(d[i] - d[i + 2]) < 60;

/**
 * Where to split between cells: near each even split, the line crossing the fewest item pixels (items may reach
 * past an even split, a long staff for one). `count(pos)` = item pixels on that line.
 */
function splits(n, size, count) {
  const out = [0];
  const step = size / n, win = Math.floor(step * 0.3);
  for (let k = 1; k < n; k++) {
    const mid = Math.round(k * step);
    let best = mid, bestN = Infinity;
    for (let p = mid - win; p <= mid + win; p++) {
      const c = count(p);
      if (c < bestN || (c === bestN && Math.abs(p - mid) < Math.abs(best - mid))) { best = p; bestN = c; }
    }
    out.push(best);
  }
  out.push(size);
  return out;
}

/**
 * Drops small bits of a neighbour that reach over the split into this cell: connected item pixels touching the
 * cell's side and under 15% of the cell's biggest piece become background.
 */
function dropStrays(img) {
  const { width: w, height: h, data } = img;
  const seen = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (seen[s0] >= 0 || isKey(data, s0 * 4)) continue;
    const id = comps.length, stack = [s0], px = [];
    let edge = false;
    seen[s0] = id;
    while (stack.length) {
      const i = stack.pop();
      px.push(i);
      const x = i % w, y = (i - x) / w;
      if (x === 0 || x === w - 1) edge = true;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (seen[j] < 0 && !isKey(data, j * 4)) { seen[j] = id; stack.push(j); }
      }
    }
    comps.push({ px, edge });
  }
  const big = Math.max(0, ...comps.map((c) => c.px.length));
  let dropped = 0;
  for (const c of comps) {
    if (!c.edge || c.px.length >= big * 0.15) continue;
    for (const i of c.px) { data[i * 4] = 255; data[i * 4 + 1] = 0; data[i * 4 + 2] = 255; }
    dropped += c.px.length;
  }
  return dropped;
}

const icons = [];
for (const [set, file] of Object.entries(SHEETS)) {
  const src = PNG.sync.read(fs.readFileSync(path.join(RAW, file)));
  const { width: w, height: h, data } = src;
  const ys = splits(2, h, (y) => { let n = 0; for (let x = 0; x < w; x++) if (!isKey(data, (y * w + x) * 4)) n++; return n; });
  CELLS.forEach((row, r) => {
    const xs = splits(7, w, (x) => { let n = 0; for (let y = ys[r]; y < ys[r + 1]; y++) if (!isKey(data, (y * w + x) * 4)) n++; return n; });
    row.forEach((part, c) => {
    const cell = crop(src, xs[c], ys[r], xs[c + 1] - xs[c], ys[r + 1] - ys[r]);
    const dropped = dropStrays(cell);
    if (dropped) console.log(`${set} ${part ?? 'badge'}: dropped ${dropped} px of a neighbour`);
    const icon = cut(cell);
    const name = part ? `item_${set}_${part}.png` : `set_${set}.png`;
    fs.writeFileSync(path.join(OUT, name), PNG.sync.write(icon));
    icons.push(icon);
    });
  });
}
console.log(`${icons.length} icons written to ${path.relative(ROOT, OUT)}`);

if (process.argv[2]) {
  const cols = 14, cell = SIZE + 8, rows = Math.ceil(icons.length / cols);
  const sheet = new PNG({ width: cols * cell, height: rows * cell });
  for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 34; sheet.data[i + 1] = 28; sheet.data[i + 2] = 22; sheet.data[i + 3] = 255; }
  icons.forEach((ic, n) => {
    const bx = (n % cols) * cell + 4, by = Math.floor(n / cols) * cell + 4;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const p = (y * SIZE + x) * 4, q = ((by + y) * sheet.width + bx + x) * 4, al = ic.data[p + 3] / 255;
      for (let k = 0; k < 3; k++) sheet.data[q + k] = Math.round(ic.data[p + k] * al + sheet.data[q + k] * (1 - al));
    }
  });
  fs.writeFileSync(process.argv[2], PNG.sync.write(sheet));
}
