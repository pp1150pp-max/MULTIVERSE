// Cuts the raw ChatGPT pictures for the NPC talk window (art_templates/npc_dialog/raw, prompts in PROMPTS.md)
// into public/assets/sprites/paper/ui/npc_dialog/: the scene behind each NPC, its waist-up portrait and the answer icons.
// Usage: node tools/cut_npc_dialog.cjs
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { keyBg } = require('./paper_key.cjs');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'art_templates/npc_dialog/raw');
const OUT = path.join(ROOT, 'public/assets/sprites/paper/ui/npc_dialog');
const NPCS = ['seeker', 'merchant', 'blacksmith', 'keeper', 'broker', 'crystal'];
/** The icon sheet's 4 x 4 cells, row by row (see PROMPTS.md section 3). */
const ICONS = [
  'enhance', 'reroll', 'restat', 'card',
  'buy', 'sell', 'stash', 'market',
  'parcel', 'crystal', 'quest', 'turnin',
  'talk', 'key', 'story', 'leave',
];

async function readKeyed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { w: info.width, h: info.height, d: data };
  keyBg(img, { soft: true, minSpeck: 200 });
  return img;
}
const toSharp = (img) => sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } });

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of NPCS) {
    await sharp(path.join(RAW, `bg_${id}.png`)).resize(1280, 720, { fit: 'cover', kernel: 'lanczos3' }).png().toFile(path.join(OUT, `bg_${id}.png`));
    const img = await readKeyed(path.join(RAW, `portrait_${id}.png`));
    const trimmed = await toSharp(img).png().toBuffer().then((b) => sharp(b).trim({ threshold: 1 }).png().toBuffer());
    await sharp(trimmed).resize({ height: 640, kernel: 'lanczos3' }).png().toFile(path.join(OUT, `portrait_${id}.png`));
    console.log(id);
  }
  const sheet = await readKeyed(path.join(RAW, 'answer_icons.png'));
  const cw = sheet.w / 4, ch = sheet.h / 4;
  for (let i = 0; i < ICONS.length; i++) {
    const left = Math.round((i % 4) * cw), top = Math.round(Math.floor(i / 4) * ch);
    const cell = await toSharp(sheet).extract({ left, top, width: Math.floor(cw), height: Math.floor(ch) }).png().toBuffer();
    const t = await sharp(cell).trim({ threshold: 1 }).png().toBuffer();
    await sharp(t).resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
      .png().toFile(path.join(OUT, `icon_${ICONS[i]}.png`));
  }
  console.log('icons', ICONS.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
