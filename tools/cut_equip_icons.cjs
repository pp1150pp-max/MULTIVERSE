// Turns the ChatGPT pictures in art_templates/equip_icons/raw/ (magenta background) into 96×96 game icons.
//   PNGJS=<path to pngjs> node tools/cut_equip_icons.cjs [contact-sheet.png]
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'art_templates/equip_icons/raw');
const OUT = path.join(ROOT, 'public/assets/sprites/icons');
const SIZE = 96;
const FIT = 90; // the item's longest side, leaving a small margin like the other icons

/** Solid background: bright and evenly red + blue, so violet glows on an item are left alone. */
const isKey = (r, g, b) => r > 190 && b > 190 && g < 110 && Math.abs(r - b) < 60;

function cut(src) {
  const { width: w, height: h, data } = src;
  const key = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) key[i] = isKey(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) ? 1 : 0;
  // Blended edge pixels next to the background: fade them out and take the magenta out of their colour.
  const R = 3;
  const out = Buffer.from(data);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const p = i * 4;
    if (key[i]) { out[p + 3] = 0; continue; }
    let edge = false;
    for (let dy = -R; dy <= R && !edge; dy++) for (let dx = -R; dx <= R; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && key[ny * w + nx]) { edge = true; break; }
    }
    const [r, g, b] = [data[p], data[p + 1], data[p + 2]];
    const spill = Math.min(r, b) - g;
    if (edge && spill > 30) {
      out[p + 3] = Math.round(255 * Math.max(0, 1 - spill / 170));
      out[p] = Math.min(r, g + 25);
      out[p + 2] = Math.min(b, g + 25);
    }
    if (out[p + 3] > 40) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  // Shrink by averaging (weighted by alpha, so the removed background doesn't darken the edges).
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const s = FIT / Math.max(cw, ch);
  const dw = Math.max(1, Math.round(cw * s)), dh = Math.max(1, Math.round(ch * s));
  const ox = Math.floor((SIZE - dw) / 2), oy = Math.floor((SIZE - dh) / 2);
  const dst = new PNG({ width: SIZE, height: SIZE });
  for (let dy = 0; dy < dh; dy++) for (let dx = 0; dx < dw; dx++) {
    const sx0 = x0 + Math.floor(dx / s), sx1 = Math.min(x1 + 1, x0 + Math.max(Math.floor((dx + 1) / s), Math.floor(dx / s) + 1));
    const sy0 = y0 + Math.floor(dy / s), sy1 = Math.min(y1 + 1, y0 + Math.max(Math.floor((dy + 1) / s), Math.floor(dy / s) + 1));
    let a = 0, cr = 0, cg = 0, cb = 0, n = 0;
    for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
      const p = (y * w + x) * 4, al = out[p + 3];
      a += al; cr += out[p] * al; cg += out[p + 1] * al; cb += out[p + 2] * al; n++;
    }
    const q = ((oy + dy) * SIZE + ox + dx) * 4;
    const alpha = n ? a / n : 0;
    if (alpha < 24) continue;
    dst.data[q] = Math.round(cr / a); dst.data[q + 1] = Math.round(cg / a); dst.data[q + 2] = Math.round(cb / a);
    dst.data[q + 3] = Math.round(alpha);
  }
  return dst;
}

const files = fs.readdirSync(RAW).filter((f) => f.endsWith('.png')).sort();
const icons = files.map((f) => {
  const icon = cut(PNG.sync.read(fs.readFileSync(path.join(RAW, f))));
  fs.writeFileSync(path.join(OUT, f), PNG.sync.write(icon));
  return icon;
});
console.log(`${icons.length} icons written to ${path.relative(ROOT, OUT)}`);

// Optional contact sheet on a dark slot colour, for checking the edges by eye.
if (process.argv[2]) {
  const cols = 6, cell = SIZE * 2 + 8, rows = Math.ceil(icons.length / cols);
  const sheet = new PNG({ width: cols * cell, height: rows * cell });
  for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 34; sheet.data[i + 1] = 28; sheet.data[i + 2] = 22; sheet.data[i + 3] = 255; }
  icons.forEach((ic, n) => {
    const bx = (n % cols) * cell + 4, by = Math.floor(n / cols) * cell + 4;
    for (let y = 0; y < SIZE * 2; y++) for (let x = 0; x < SIZE * 2; x++) {
      const p = (Math.floor(y / 2) * SIZE + Math.floor(x / 2)) * 4, q = ((by + y) * sheet.width + bx + x) * 4, al = ic.data[p + 3] / 255;
      for (let c = 0; c < 3; c++) sheet.data[q + c] = Math.round(ic.data[p + c] * al + sheet.data[q + c] * (1 - al));
    }
  });
  fs.writeFileSync(process.argv[2], PNG.sync.write(sheet));
}
