// Cuts the EXP icon of the Auto summary window (CODEX_ART_AUTO_SUMMARY.md): same file size as coin.png, 2 px margin.
// Usage: node tools/cut_exp_icon.cjs [art_templates folder]   (default: this checkout's art_templates)
const path = require('path');
const sharp = require('sharp');
const { keyBg } = require('./paper_key.cjs');

const ROOT = path.join(__dirname, '..');
const ART = path.resolve(process.argv[2] ?? path.join(ROOT, 'art_templates'));
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

async function main() {
  const { data, info } = await sharp(path.join(ART, 'papercraft_icons/raw/exp.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { w: info.width, h: info.height, d: data };
  keyBg(img, { soft: true, minSpeck: 200 });
  // The picture has a magenta-tinted drop shadow under each chevron. The art is only gold and green (green is at least
  // ~0.65 of red), so anything redder than that is shadow: faded out between 0.65 and 0.45.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]) data[i + 3] = Math.round(data[i + 3] * Math.min(1, Math.max(0, (data[i + 1] / data[i] - 0.45) / 0.2)));
  }
  const keyed = await sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } }).png().toBuffer();
  const art = await sharp(keyed).trim({ threshold: 1 }).png().toBuffer();
  await sharp(art).resize(60, 60, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' })
    .extend({ top: 2, bottom: 2, left: 2, right: 2, background: CLEAR })
    .png().toFile(path.join(ROOT, 'public/assets/sprites/paper/icons/exp.png'));
}
main().catch((e) => { console.error(e); process.exit(1); });
