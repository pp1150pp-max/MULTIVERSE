// Cuts the element icon sheet (art_templates/ui/raw/element_icons.png, made from art_templates/ui/ELEMENT_ICONS.md:
// 5 round papercraft badges in a row on magenta #FF00FF) into public/assets/sprites/ui/element_<name>.png, 64×64 each.
// Usage: node tools/cut_element_icons.cjs   (uses sharp, already installed for the WebP build step)
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = process.env.ELEMENT_RAW || path.join(ROOT, 'art_templates/ui/raw/element_icons.png');
const OUT = path.join(ROOT, 'public/assets/sprites/ui');
const NAMES = ['water', 'fire', 'poison', 'lightning', 'wind'];
const SIZE = 64;

/** Magenta becomes transparent (soft edge), its pink fringe is pulled back. */
function key(d, w, h) {
  for (let i = 0; i < w * h * 4; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    const low = Math.min(r, b) - g;
    if (low > 90 && Math.abs(r - b) < 90) d[i + 3] = 0;
    else if (low > 40 && Math.abs(r - b) < 70) {
      // Edge pixels half way between the badge rim and the background: partly see-through, colour pulled to the rim.
      d[i + 3] = Math.round(255 * (1 - (low - 40) / 50));
      d[i] = Math.min(r, g + 30);
      d[i + 2] = Math.min(b, g + 30);
    } else d[i + 3] = 255;
  }
}

(async () => {
  const { data, info } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const d = Buffer.from(data);
  key(d, w, h);
  fs.mkdirSync(OUT, { recursive: true });
  const cell = w / NAMES.length;
  for (let n = 0; n < NAMES.length; n++) {
    // The badge's box inside its column.
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = Math.floor(n * cell); x < Math.floor((n + 1) * cell); x++) {
        if (d[(y * w + x) * 4 + 3] < 200) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const side = Math.max(x1 - x0, y1 - y0) + 1;
    const cx = Math.round((x0 + x1) / 2);
    const cy = Math.round((y0 + y1) / 2);
    const left = Math.max(0, cx - Math.ceil(side / 2));
    const top = Math.max(0, cy - Math.ceil(side / 2));
    const file = path.join(OUT, `element_${NAMES[n]}.png`);
    await sharp(d, { raw: { width: w, height: h, channels: 4 } })
      .extract({ left, top, width: Math.min(side, w - left), height: Math.min(side, h - top) })
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toFile(file);
    console.log(path.relative(ROOT, file), side, 'px →', SIZE);
  }
})();
