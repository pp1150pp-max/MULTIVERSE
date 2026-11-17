// Cuts the papercraft part sheets (art_templates/papercraft/raw/B*.png) into one PNG per piece for the
// sword rig (src/client/rig/). Usage: node tools/cut_rig_parts.mjs [--list]
// Each sheet: magenta (#FF00FF) becomes transparent, then every separate blob big enough is a piece. Pieces are
// picked by their place on the sheet (row, then left to right) and named by PIECES below. --list prints every
// blob found with its box, to check the names line up after re-generating a sheet.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'art_templates/papercraft/raw');
const OUT = join(ROOT, 'public/assets/sprites/player/sword_rig');
const LIST = process.argv.includes('--list');

/**
 * Piece names in reading order (rows top to bottom, each left to right). null = a blob to skip (the assembled
 * reference figure, or a piece the sheet has that the rig doesn't use).
 */
const LIMBS = ['upper_arm_l', 'upper_arm_r', 'forearm_l', 'forearm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r'];
const SHEETS = [
  { file: 'B1_sword_parts_front.png', dir: 'front', names: ['head', 'torso', 'hips', ...LIMBS, 'sword_katana', null] },
  { file: 'B2_sword_parts_back.png', dir: 'back', names: ['head', 'torso', 'hips', ...LIMBS, 'sword_katana', null] },
  // The cape sheet is drawn bigger than the parts sheets: its collar is scaled to the torso's shoulders.
  { file: 'B3_sword_cape.png', dir: 'front', names: null, cape: true, scale: 0.55 },
  // The swords sheet is drawn bigger: scaled so its katana matches the one on the parts sheet (307 px tall there).
  { file: 'B4_swords.png', dir: 'weapons', names: ['katana', 'great', 'fire'], scale: 307 / 646 },
  { file: 'B5_armor2_front.png', dir: 'front_silver', names: ['torso', 'hips', ...LIMBS] },
  { file: 'B5_armor2_back.png', dir: 'back_silver', names: [null, 'torso', 'hips', ...LIMBS] },
];
const MIN_BLOB = 1500;
const PAD = 2;
/** Pieces are cut at half the sheet size: still sharper than the game shows them (about 230 texels per world unit). */
const SCALE = 0.5;

async function read(file) {
  const { data, info } = await sharp(join(RAW, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: data };
}

/** Magenta out, and the pinkish fringe left by the background pulled back toward the paper colour. */
function key(img) {
  const { d } = img;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const low = Math.min(r, b) - g;
    if (low > 70 && Math.abs(r - b) < 90) d[i + 3] = 0;
    else if (low > 25) {
      d[i] = Math.min(r, g + 30);
      d[i + 2] = Math.min(b, g + 30);
      d[i + 3] = 255;
    } else d[i + 3] = 255;
  }
}

function blobs(img) {
  const { w, h, d } = img;
  const seen = new Uint8Array(w * h);
  const out = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !d[s * 4 + 3]) continue;
    const stack = [s];
    seen[s] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    const px = [];
    while (stack.length) {
      const k = stack.pop();
      px.push(k);
      n++;
      const x = k % w, y = (k - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const t of [k - 1, k + 1, k - w, k + w]) {
        if (t < 0 || t >= w * h || seen[t] || !d[t * 4 + 3]) continue;
        if ((t === k - 1 && x === 0) || (t === k + 1 && x === w - 1)) continue;
        seen[t] = 1;
        stack.push(t);
      }
    }
    if (n >= MIN_BLOB) out.push({ x0, y0, x1, y1, n, px });
    else for (const k of px) d[k * 4 + 3] = 0;
  }
  return out;
}

/** Reading order: blobs whose vertical middles are within a row's height of each other share a row. */
function readingOrder(list) {
  const sorted = [...list].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const rows = [];
  for (const b of sorted) {
    const mid = (b.y0 + b.y1) / 2;
    const row = rows.find((r) => Math.abs(r.mid - mid) < 110);
    if (row) row.items.push(b);
    else rows.push({ mid, items: [b] });
  }
  return rows.flatMap((r) => r.items.sort((a, b) => a.x0 - b.x0));
}

/** The tan paper tab of a joint (the sheets draw one at each end of a limb): not the gold trim, not the face. */
function isTab(d, i) {
  const r = d[i], g = d[i + 1], b = d[i + 2];
  return r > 170 && b > 95 && r - g > 25 && r - g < 85 && g - b > 15 && g - b < 75;
}

/**
 * Pieces whose joint tabs are cut away (owner 2026-11-16: the tabs looked like extra blobs at every joint). The
 * pieces overlap at the joints instead (rig.json). The head keeps its neck, the swords and the cape have no tabs.
 */
const TABBED = /^(torso|hips|upper_arm|forearm|hand|thigh|shin)/;

async function save(img, b, dir, name, scale) {
  const w = b.x1 - b.x0 + 1 + PAD * 2;
  const h = b.y1 - b.y0 + 1 + PAD * 2;
  const out = Buffer.alloc(w * h * 4);
  const tabbed = TABBED.test(name);
  const bh = b.y1 - b.y0 + 1;
  for (const k of b.px) {
    const x = k % img.w, y = (k - x) / img.w;
    const o = ((y - b.y0 + PAD) * w + (x - b.x0 + PAD)) * 4;
    img.d.copy(out, o, k * 4, k * 4 + 4);
    const fy = (y - b.y0) / bh;
    if (tabbed && (fy < 0.34 || fy > 0.66) && isTab(out, o)) out[o + 3] = 0;
  }
  mkdirSync(join(OUT, dir), { recursive: true });
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).resize(sw, sh, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(join(OUT, dir, name + '.png'));
  return { w: sw, h: sh };
}

const sizes = {};
for (const sheet of SHEETS) {
  const img = await read(sheet.file);
  key(img);
  let list = readingOrder(blobs(img));
  if (sheet.cape) {
    // Two columns of 3 strips: the left column is the front view, the right one the back view.
    const midX = img.w / 2;
    const left = list.filter((b) => (b.x0 + b.x1) / 2 < midX).sort((a, b) => a.y0 - b.y0);
    const right = list.filter((b) => (b.x0 + b.x1) / 2 >= midX).sort((a, b) => a.y0 - b.y0);
    list = [...left, ...right];
    sheet.names = ['front/cape_1', 'front/cape_2', 'front/cape_3', 'back/cape_1', 'back/cape_2', 'back/cape_3'];
    sheet.dir = '';
  }
  console.log(`${sheet.file}: ${list.length} pieces (${img.w}x${img.h})`);
  for (const [i, b] of list.entries()) {
    const name = sheet.names[i];
    if (LIST || name === undefined) console.log(`  #${i} ${name ?? '-'} box ${b.x0},${b.y0} ${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1}`);
    if (!name || LIST) continue;
    const path = sheet.dir ? `${sheet.dir}/${name}` : name;
    sizes[path] = await save(img, b, dirname(path) === '.' ? '' : dirname(path), path.split('/').pop(), SCALE * (sheet.scale ?? 1));
  }
  if (list.length !== sheet.names.length) console.warn(`  !! expected ${sheet.names.length} pieces`);
}
if (!LIST) {
  writeFileSync(join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  console.log('wrote', Object.keys(sizes).length, 'pieces');
}
