// Cuts the ChatGPT potion sheet (3 sizes x HP/MP on magenta, see art_templates/ui/PROMPTS.md) into
// public/assets/sprites/icons/potion_{hp,mp}_{s,m,l}.png at 64x64.
// All six share one scale, so the small vial really looks smaller than the large flask.
//   PNGJS=<path to pngjs> node tools/cut_potions.cjs <potion_tiers.png> [contact-sheet.png]
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public/assets/sprites/icons');
const SIZE = 64;
const FIT = 60; // the biggest bottle's longest side

const isKey = (r, g, b) => r > 190 && b > 190 && g < 110 && Math.abs(r - b) < 60;

const src = PNG.sync.read(fs.readFileSync(process.argv[2]));
const { width: w, height: h, data } = src;

// Remove the background, fading magenta-tinted edge pixels.
const key = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) key[i] = isKey(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) ? 1 : 0;
const px = Buffer.from(data);
const R = 3;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = y * w + x, p = i * 4;
  if (key[i]) { px[p + 3] = 0; continue; }
  let edge = false;
  for (let dy = -R; dy <= R && !edge; dy++) for (let dx = -R; dx <= R; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h && key[ny * w + nx]) { edge = true; break; }
  }
  const [r, g, b] = [data[p], data[p + 1], data[p + 2]];
  const spill = Math.min(r, b) - g;
  if (edge && spill > 30) {
    px[p + 3] = Math.round(255 * Math.max(0, 1 - spill / 170));
    px[p] = Math.min(r, g + 25);
    px[p + 2] = Math.min(b, g + 25);
  }
}

// Bounding box of each cell of the 3 x 2 grid.
const cols = 3, rows = 2, cw = Math.floor(w / cols), chh = Math.floor(h / rows);
const boxes = [];
for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = row * chh; y < (row + 1) * chh; y++) for (let x = col * cw; x < (col + 1) * cw; x++) {
    if (px[(y * w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  boxes.push({ x0, y0, x1, y1, name: `potion_${row ? 'mp' : 'hp'}_${'sml'[col]}` });
}
const biggest = Math.max(...boxes.map((b) => Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1)));
const s = FIT / biggest;

const icons = boxes.map(({ x0, y0, x1, y1, name }) => {
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const dw = Math.max(1, Math.round(bw * s)), dh = Math.max(1, Math.round(bh * s));
  // Centred across, standing on the same floor line so the sizes compare side by side.
  const ox = Math.floor((SIZE - dw) / 2), oy = SIZE - 2 - dh;
  const dst = new PNG({ width: SIZE, height: SIZE });
  for (let dy = 0; dy < dh; dy++) for (let dx = 0; dx < dw; dx++) {
    const sx0 = x0 + Math.floor(dx / s), sx1 = Math.min(x1 + 1, Math.max(x0 + Math.floor((dx + 1) / s), sx0 + 1));
    const sy0 = y0 + Math.floor(dy / s), sy1 = Math.min(y1 + 1, Math.max(y0 + Math.floor((dy + 1) / s), sy0 + 1));
    let a = 0, cr = 0, cg = 0, cb = 0, n = 0;
    for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
      const p = (y * w + x) * 4, al = px[p + 3];
      a += al; cr += px[p] * al; cg += px[p + 1] * al; cb += px[p + 2] * al; n++;
    }
    const alpha = n ? a / n : 0;
    if (alpha < 24) continue;
    const q = ((oy + dy) * SIZE + ox + dx) * 4;
    dst.data[q] = Math.round(cr / a); dst.data[q + 1] = Math.round(cg / a); dst.data[q + 2] = Math.round(cb / a);
    dst.data[q + 3] = Math.round(alpha);
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(dst));
  return dst;
});
console.log(`${icons.length} potion icons written to ${path.relative(ROOT, OUT)}`);

// Optional contact sheet at 2x on a dark slot colour, for checking edges by eye.
if (process.argv[3]) {
  const cell = SIZE * 2 + 8;
  const sheet = new PNG({ width: cols * cell, height: rows * cell });
  for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 34; sheet.data[i + 1] = 28; sheet.data[i + 2] = 22; sheet.data[i + 3] = 255; }
  icons.forEach((ic, n) => {
    const bx = (n % cols) * cell + 4, by = Math.floor(n / cols) * cell + 4;
    for (let y = 0; y < SIZE * 2; y++) for (let x = 0; x < SIZE * 2; x++) {
      const p = (Math.floor(y / 2) * SIZE + Math.floor(x / 2)) * 4, q = ((by + y) * sheet.width + bx + x) * 4, al = ic.data[p + 3] / 255;
      for (let c = 0; c < 3; c++) sheet.data[q + c] = Math.round(ic.data[p + c] * al + sheet.data[q + c] * (1 - al));
    }
  });
  fs.writeFileSync(process.argv[3], PNG.sync.write(sheet));
}
