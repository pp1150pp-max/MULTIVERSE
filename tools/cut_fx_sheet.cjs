// Turns a ChatGPT effect sheet (strict grid of 6 frames per row on magenta) into a game fx sheet:
// the background becomes transparent and the picture is resampled to 256 px cells, keeping the layout,
// because the game cuts frames by equal cells (see SHEET_ROWS in src/client/effects.ts).
//   PNGJS=<path to pngjs> node tools/cut_fx_sheet.cjs <raw.png> <rows> <out.png>
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const [src, rowsArg, out] = process.argv.slice(2);
const ROWS = Number(rowsArg);
const COLS = 6;
const CELL = 256;

/** Solid background: bright and evenly red + blue, so warm sparks and grey smoke are left alone. */
const isKey = (r, g, b) => r > 190 && b > 190 && g < 110 && Math.abs(r - b) < 60;

const img = PNG.sync.read(fs.readFileSync(src));
const { width: w, height: h, data } = img;
const px = Buffer.from(data);
const key = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) key[i] = isKey(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) ? 1 : 0;
// Blended pixels next to the background: fade them by how magenta they are and take the tint out.
const R = 2;
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
  } else if (spill > 15) {
    // Glows and smoke are see-through in the original, so magenta shows through them anywhere,
    // not only at the edge: fade by how magenta the pixel is and pull it back to grey or gold.
    px[p + 3] = Math.round(255 * Math.max(0, 1 - spill / 140));
    px[p] = Math.min(r, g + 12);
    px[p + 2] = Math.min(b, g + 6);
  }
}

// Resample by area (alpha-weighted) to exact 256 px cells.
const W = COLS * CELL, H = ROWS * CELL;
const sx = w / W, sy = h / H;
const dst = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
  const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
  let a = 0, cr = 0, cg = 0, cb = 0, n = 0;
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    const p = (yy * w + xx) * 4, al = px[p + 3];
    a += al; cr += px[p] * al; cg += px[p + 1] * al; cb += px[p + 2] * al; n++;
  }
  const alpha = n ? a / n : 0;
  if (alpha < 24) continue;
  const q = (y * W + x) * 4;
  dst.data[q] = Math.round(cr / a); dst.data[q + 1] = Math.round(cg / a); dst.data[q + 2] = Math.round(cb / a);
  dst.data[q + 3] = Math.round(alpha);
}
fs.writeFileSync(out, PNG.sync.write(dst));
console.log(`${out}: ${W}x${H}, ${ROWS} rows x ${COLS} frames`);
