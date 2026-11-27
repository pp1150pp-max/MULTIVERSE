// Cuts the owner's ChatGPT sheets for treasure chests and shrines (art_templates/chests_shrines/PROMPTS.md) into game sprites.
// Usage: node tools/cut_chests_shrines.cjs   (reads art_templates/chests_shrines/raw/, writes public/assets/sprites/)
// Each sheet is a grid on flat magenta (#FF00FF): every cell's piece is keyed out (magenta → transparent, the pink fringe pulled
// back to the piece's own colour, soft edge from how magenta a pixel is), cropped to what is left, padded a little and scaled.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'art_templates/chests_shrines/raw');
const OUT = path.join(ROOT, 'public/assets/sprites');

/** How magenta a pixel is (0 = not at all, 1 = the background). */
function magenta(r, g, b) {
  const low = Math.min(r, b) - g; // magenta: red and blue high, green low
  if (Math.abs(r - b) > 90) return 0;
  return Math.max(0, Math.min(1, (low - 40) / 120));
}

/** Keys one cell (RGB buffer, w × h) into RGBA, drops specks, returns the crop box of what is left. */
function keyCell(src, sw, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * sw + (x0 + x)) * 3;
      let r = src[i], g = src[i + 1], b = src[i + 2];
      const m = magenta(r, g, b);
      const a = Math.round((1 - m) * 255);
      if (m > 0 && a > 0) {
        // Take the magenta out of an edge pixel: what is left is the piece's colour.
        const k = m * 0.85;
        r = Math.max(0, Math.min(255, Math.round((r - 255 * k) / (1 - k))));
        b = Math.max(0, Math.min(255, Math.round((b - 255 * k) / (1 - k))));
        g = Math.max(0, Math.min(255, Math.round(g / (1 - k))));
        r = Math.min(r, g + 40);
        b = Math.min(b, g + 40);
      }
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a < 24 ? 0 : a;
    }
  }
  // Keep only the biggest connected piece and anything big near it: specks and stray marks go.
  const seen = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] >= 0 || !out[s * 4 + 3]) continue;
    const id = comps.length;
    const stack = [s];
    seen[s] = id;
    let n = 0;
    while (stack.length) {
      const k = stack.pop();
      n++;
      const x = k % w;
      for (const t of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w]) {
        if (t >= 0 && t < w * h && seen[t] < 0 && out[t * 4 + 3]) { seen[t] = id; stack.push(t); }
      }
    }
    comps.push(n);
  }
  const big = Math.max(0, ...comps);
  for (let k = 0; k < w * h; k++) if (seen[k] >= 0 && comps[seen[k]] < Math.max(60, big * 0.01)) out[k * 4 + 3] = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (out[(y * w + x) * 4 + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) throw new Error(`empty cell at ${x0},${y0}`);
  return { data: out, w, h, box: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}

async function cutSheet(file, cols, rows, names, maxSide, dir) {
  const img = sharp(path.join(RAW, file)).removeAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const cw = Math.floor(info.width / cols);
  const ch = Math.floor(info.height / rows);
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = names[r * cols + c];
      const cell = keyCell(data, info.width, c * cw, r * ch, cw, ch);
      const pad = 4;
      const piece = sharp(cell.data, { raw: { width: cell.w, height: cell.h, channels: 4 } }).extract(cell.box);
      const scale = Math.min(1, maxSide / Math.max(cell.box.width, cell.box.height));
      const out = await piece
        .resize(Math.round(cell.box.width * scale), Math.round(cell.box.height * scale), { kernel: 'lanczos3' })
        .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(path.join(OUT, dir, `${name}.png`));
      console.log(`${dir}/${name}.png ${out.width}x${out.height}`);
    }
  }
}

(async () => {
  await cutSheet('treasure_props.png', 3, 2, ['chest_closed', 'chest_open', 'shrine_atk', 'shrine_speed', 'shrine_exp', 'shrine_random'], 320, 'paper/treasure');
  await cutSheet('shrine_buff_icons.png', 3, 1, ['shrine_buff_atk', 'shrine_buff_speed', 'shrine_buff_exp'], 96, 'icons');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
