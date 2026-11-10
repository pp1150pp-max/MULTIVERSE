// Cuts the boss-room pictures (art_templates/boss_rooms/raw/, magenta background, see PROMPTS.md there) into game files:
//   key_icons.png        2×2 → icons/stone_key_*.png (96×96, like the other stones)
//   summoners.png        2×2 → props/summoner_*.png (256 px tall)
//   room_props_<t>.png   4×2 → props/room_<t>_<name>.png (256 px tall)
//   ground_room_<t>.png  → ground/room_<t>.png (1024×1024)
// Usage: PNGJS=<path to pngjs> node tools/cut_boss_rooms.cjs [RAW folder]
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.resolve(process.argv[2] || path.join(ROOT, 'art_templates/boss_rooms/raw'));
const SPRITES = path.join(ROOT, 'public/assets/sprites');

/** Solid background: bright and evenly red + blue (violet glows on an item are left alone). */
const isKey = (r, g, b) => r > 170 && b > 170 && g < 120 && Math.abs(r - b) < 70;

/** One grid cell with the background made clear, cropped to what is drawn in it (a 1 px margin). */
function cell(src, cols, rows, c, r) {
  const cw = Math.floor(src.width / cols), ch = Math.floor(src.height / rows);
  const x0 = c * cw, y0 = r * ch;
  let minX = cw, minY = ch, maxX = -1, maxY = -1;
  const buf = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = ((y0 + y) * src.width + x0 + x) * 4, o = (y * cw + x) * 4;
    const [R, G, B] = [src.data[i], src.data[i + 1], src.data[i + 2]];
    if (isKey(R, G, B)) continue;
    // Soft magenta fringe at the edge: keep it, but less of it.
    const fringe = R > 140 && B > 140 && G < 110 && Math.abs(R - B) < 90;
    buf[o] = R; buf[o + 1] = G; buf[o + 2] = B; buf[o + 3] = fringe ? 90 : 255;
    if (fringe) { buf[o] = Math.min(R, G + 40); buf[o + 2] = Math.min(B, G + 40); }
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  // Drop specks: a cell must have a real picture.
  if (maxX < 0) throw new Error(`empty cell ${c},${r}`);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const out = { width: w, height: h, data: Buffer.alloc(w * h * 4) };
  for (let y = 0; y < h; y++) buf.copy(out.data, y * w * 4, ((minY + y) * cw + minX) * 4, ((minY + y) * cw + minX + w) * 4);
  return out;
}

/** Box-filtered downscale (alpha weighted), so pixel art stays clean. */
function scale(img, s) {
  const W = Math.max(1, Math.round(img.width * s)), H = Math.max(1, Math.round(img.height * s));
  const dst = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx0 = Math.floor(x / s), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) / s));
    const sy0 = Math.floor(y / s), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) / s));
    let a = 0, cr = 0, cg = 0, cb = 0, n = 0;
    for (let yy = sy0; yy < Math.min(sy1, img.height); yy++) for (let xx = sx0; xx < Math.min(sx1, img.width); xx++) {
      const p = (yy * img.width + xx) * 4, al = img.data[p + 3];
      a += al; cr += img.data[p] * al; cg += img.data[p + 1] * al; cb += img.data[p + 2] * al; n++;
    }
    const q = (y * W + x) * 4, alpha = n ? a / n : 0;
    if (alpha < 24) continue;
    dst.data[q] = Math.round(cr / a); dst.data[q + 1] = Math.round(cg / a); dst.data[q + 2] = Math.round(cb / a); dst.data[q + 3] = Math.round(alpha);
  }
  return dst;
}

/** Centred on a square canvas `size` across, the picture's longest side `fit`. */
function icon(img, size, fit) {
  const s = scale(img, fit / Math.max(img.width, img.height));
  const dst = new PNG({ width: size, height: size });
  const ox = Math.floor((size - s.width) / 2), oy = Math.floor((size - s.height) / 2);
  for (let y = 0; y < s.height; y++) s.data.copy(dst.data, ((oy + y) * size + ox) * 4, y * s.width * 4, (y + 1) * s.width * 4);
  return dst;
}

const read = (f) => PNG.sync.read(fs.readFileSync(path.join(RAW, f)));
const write = (rel, png) => {
  fs.writeFileSync(path.join(SPRITES, rel), PNG.sync.write(png));
  console.log(`${rel} ${png.width}×${png.height}`);
};
const has = (f) => fs.existsSync(path.join(RAW, f));

if (has('key_icons.png')) {
  const src = read('key_icons.png');
  ['key_bear', 'key_witch', 'key_yeti', 'key_heart'].forEach((k, i) => write(`icons/stone_${k}.png`, icon(cell(src, 2, 2, i % 2, i >> 1), 96, 90)));
}
if (has('summoners.png')) {
  const src = read('summoners.png');
  ['forest', 'marsh', 'snow', 'volcano'].forEach((t, i) => {
    const c = cell(src, 2, 2, i % 2, i >> 1);
    write(`props/summoner_${t}.png`, scale(c, 256 / c.height));
  });
}
const PROPS = ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'];
for (const t of ['forest', 'marsh', 'snow', 'volcano']) {
  if (!has(`room_props_${t}.png`)) continue;
  const src = read(`room_props_${t}.png`);
  PROPS.forEach((name, i) => {
    const c = cell(src, 4, 2, i % 4, i >> 2);
    write(`props/room_${t}_${name}.png`, scale(c, Math.min(1, 256 / c.height)));
  });
}
// Arena floors: 1024×1024 like the other ground tiles (ground/room_<theme>.png).
for (const t of ['forest', 'marsh', 'snow', 'volcano']) {
  if (!has(`ground_room_${t}.png`)) continue;
  const src = read(`ground_room_${t}.png`);
  const img = { width: src.width, height: src.height, data: Buffer.from(src.data) };
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  write(`ground/room_${t}.png`, scale(img, 1024 / src.width));
}
