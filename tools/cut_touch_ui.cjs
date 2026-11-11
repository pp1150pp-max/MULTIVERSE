// Cuts the ChatGPT touch-control sheets (2 x 2 grids on magenta, see art_templates/touch_ui/PROMPTS.md)
// into public/assets/sprites/ui/touch/*.png (mobile plan, section 9):
//   touch_frames.png: stick_base 256, stick_knob 128 / btn_attack 192, btn_skill 128
//   touch_icons.png:  icon_talk 64, icon_chat 64 / icon_mount 64, icon_dash 64
// Each picture is cropped to its own bounds and fitted, centred, into a square of that size.
//   PNGJS=<path to pngjs> node tools/cut_touch_ui.cjs <touch_frames.png> <touch_icons.png>
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public/assets/sprites/ui/touch');

const SHEETS = [
  [['stick_base', 256], ['stick_knob', 128], ['btn_attack', 192], ['btn_skill', 128]],
  [['icon_talk', 64], ['icon_chat', 64], ['icon_mount', 64], ['icon_dash', 64]],
];

const isKey = (r, g, b) => r > 190 && b > 190 && g < 110 && Math.abs(r - b) < 60;

/** The sheet with the magenta removed and magenta-tinted edge pixels faded. */
function unkey(src) {
  const { width: w, height: h, data } = src;
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
  return { w, h, px };
}

function cutSheet(file, names) {
  const { w, h, px } = unkey(PNG.sync.read(fs.readFileSync(file)));
  const cw = Math.floor(w / 2), chh = Math.floor(h / 2);
  names.forEach(([name, size], n) => {
    const col = n % 2, row = Math.floor(n / 2);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = row * chh; y < (row + 1) * chh; y++) for (let x = col * cw; x < (col + 1) * cw; x++) {
      if (px[(y * w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const s = size / Math.max(bw, bh);
    const dw = Math.max(1, Math.round(bw * s)), dh = Math.max(1, Math.round(bh * s));
    const ox = Math.floor((size - dw) / 2), oy = Math.floor((size - dh) / 2);
    const dst = new PNG({ width: size, height: size });
    for (let dy = 0; dy < dh; dy++) for (let dx = 0; dx < dw; dx++) {
      const sx0 = x0 + Math.floor(dx / s), sx1 = Math.min(x1 + 1, Math.max(x0 + Math.floor((dx + 1) / s), sx0 + 1));
      const sy0 = y0 + Math.floor(dy / s), sy1 = Math.min(y1 + 1, Math.max(y0 + Math.floor((dy + 1) / s), sy0 + 1));
      let a = 0, cr = 0, cg = 0, cb = 0, k = 0;
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
        const p = (y * w + x) * 4, al = px[p + 3];
        a += al; cr += px[p] * al; cg += px[p + 1] * al; cb += px[p + 2] * al; k++;
      }
      const alpha = k ? a / k : 0;
      if (alpha < 24) continue;
      const q = ((oy + dy) * size + ox + dx) * 4;
      dst.data[q] = Math.round(cr / a); dst.data[q + 1] = Math.round(cg / a); dst.data[q + 2] = Math.round(cb / a);
      dst.data[q + 3] = Math.round(alpha);
    }
    fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(dst));
    console.log(`${name}.png ${size}x${size}`);
  });
}

fs.mkdirSync(OUT, { recursive: true });
cutSheet(process.argv[2], SHEETS[0]);
cutSheet(process.argv[3], SHEETS[1]);
