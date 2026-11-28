// Cuts the small pictures of the 2026-11-28 Codex batch (drill stone icon, debuff badges, menu buttons, skill sky,
// site icon). The batch's harbour NPC portraits and scenes go through tools/cut_npc_dialog.cjs.
// Usage: node tools/cut_codex17.cjs [art_templates folder]   (default: this checkout's art_templates)
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { keyBg } = require('./paper_key.cjs');

const ROOT = path.join(__dirname, '..');
const ART = path.resolve(process.argv[2] ?? path.join(ROOT, 'art_templates'));
const SPRITES = path.join(ROOT, 'public/assets/sprites');
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
/** Left to right on the sheet. */
const DEBUFFS = ['stun', 'slow', 'armor', 'weak', 'dot', 'mark'];
/** Row by row on the 4 x 3 sheet; the last cell is empty. */
const MENU = ['skills', 'party', 'trade', 'cosmetics', 'audio', 'graphics', 'news', 'album', 'mail', 'report', 'fullscreen'];

async function readKeyed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { w: info.width, h: info.height, d: data };
  keyBg(img, { soft: true, minSpeck: 200 });
  return img;
}

/** The art of a keyed picture (or of one box of it) without its transparent margin. */
async function piece(img, box) {
  let s = sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } });
  if (box) s = s.extract(box);
  return sharp(await s.png().toBuffer()).trim({ threshold: 1 }).png().toBuffer();
}

/** `art` fitted into a size x size box, centred on a canvas x canvas picture. */
async function square(art, canvas, size, out) {
  const fit = await sharp(art).resize(size, size, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' }).png().toBuffer();
  const pad = Math.floor((canvas - size) / 2);
  await sharp(fit).extend({ top: pad, left: pad, bottom: canvas - size - pad, right: canvas - size - pad, background: CLEAR }).png().toFile(out);
}

/** A sheet of cols x rows equal cells. Throws if a picture reaches a cell's edge (the grid would cut it). */
async function sheet(file, cols, rows, names, size, outFile) {
  const img = await readKeyed(file);
  const cw = Math.floor(img.w / cols), ch = Math.floor(img.h / rows);
  for (let i = 0; i < names.length; i++) {
    const left = (i % cols) * cw, top = Math.floor(i / cols) * ch;
    for (let y = top; y < top + ch; y++) {
      for (let x = left; x < left + cw; x++) {
        const edge = x === left || y === top || x === left + cw - 1 || y === top + ch - 1;
        if (edge && img.d[(y * img.w + x) * 4 + 3] > 40) throw new Error(`${path.basename(file)}: ${names[i]} touches its cell edge at ${x},${y}`);
      }
    }
    await square(await piece(img, { left, top, width: cw, height: ch }), size, size, outFile(names[i]));
  }
  console.log(path.basename(file), names.join(' '));
}

async function main() {
  await square(await piece(await readKeyed(path.join(ART, 'papercraft_icons/raw/stone_drill.png'))), 96, 88,
    path.join(SPRITES, 'paper/icons/stone_drill.png'));
  console.log('stone_drill');
  await sheet(path.join(ART, 'ui/raw/debuff_icons.png'), 6, 1, DEBUFFS, 64, (n) => path.join(SPRITES, `ui/debuff_${n}.png`));
  await sheet(path.join(ART, 'papercraft_ui/raw/menu_icons.png'), 4, 3, MENU, 96, (n) => path.join(SPRITES, `paper/ui/ico_${n}.png`));
  await sharp(path.join(ART, 'skills/raw/skill_sky.png')).removeAlpha().resize(1024, 1024, { fit: 'cover', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 }).toFile(path.join(SPRITES, 'ui/skill_sky.png'));
  console.log('skill_sky');
  const icon = path.join(ART, 'papercraft_ui/raw/favicon.png');
  for (const [name, size] of [['favicon', 64], ['apple-touch-icon', 180]]) {
    const out = path.join(ROOT, 'public', `${name}.png`);
    fs.writeFileSync(out, await sharp(icon).removeAlpha().resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer());
    console.log(name);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
