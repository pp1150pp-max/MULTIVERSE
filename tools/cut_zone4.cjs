// Cuts the raw ChatGPT sheets in art_templates/zone4/raw into the game's sprite files.
// Usage: PNGJS=<path to pngjs> ZONE4_RAW=<raw folder, if not the default> node tools/cut_zone4.cjs
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.join(__dirname, '..');
const RAW = process.env.ZONE4_RAW || path.join(ROOT, 'art_templates/zone4/raw');
const OUT = path.join(ROOT, 'public/assets/sprites');

function read(name) {
  const p = PNG.sync.read(fs.readFileSync(path.join(RAW, name)));
  return { w: p.width, h: p.height, d: p.data };
}
function blank(w, h) {
  return { w, h, d: Buffer.alloc(w * h * 4) };
}
function save(img, rel) {
  const p = new PNG({ width: img.w, height: img.h });
  img.d.copy(p.data);
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel), PNG.sync.write(p, { colorType: 6 }));
  console.log(rel, img.w, img.h);
}

/** Magenta becomes transparent, a purple fringe is pulled back, and stray specks are dropped. */
function key(img, minSpeck = 30) {
  const { w, h, d } = img;
  for (let i = 0; i < w * h * 4; i += 4) {
    const low = Math.min(d[i], d[i + 2]) - d[i + 1];
    if (low > 70 && Math.abs(d[i] - d[i + 2]) < 90) d[i + 3] = 0;
    else {
      d[i + 3] = 255;
      if (low > 25) {
        const g = d[i + 1];
        d[i] = Math.min(d[i], g + 22);
        d[i + 2] = Math.min(d[i + 2], g + 22);
      }
    }
  }
  const seen = new Uint8Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !d[s * 4 + 3]) continue;
    const stack = [s];
    const comp = [];
    seen[s] = 1;
    while (stack.length) {
      const k = stack.pop();
      comp.push(k);
      const x = k % w;
      for (const t of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w]) {
        if (t >= 0 && t < w * h && !seen[t] && d[t * 4 + 3]) {
          seen[t] = 1;
          stack.push(t);
        }
      }
    }
    if (comp.length < minSpeck) for (const k of comp) d[k * 4 + 3] = 0;
  }
  return img;
}

function bandsOf(has, size, gap, want, label) {
  const bands = [];
  let start = -1;
  let empty = 0;
  for (let i = 0; i < size; i++) {
    if (has(i)) {
      if (start < 0) start = i;
      empty = 0;
    } else if (start >= 0 && ++empty >= gap) {
      bands.push([start, i - empty + 1]);
      start = -1;
    }
  }
  if (start >= 0) bands.push([start, size]);
  if (bands.length !== want) throw new Error(`${label}: found ${bands.length} bands, wanted ${want}: ${JSON.stringify(bands)}`);
  return bands;
}

/** Splits a keyed sheet into rows and columns on empty lines. Returns boxes [x0, y0, x1, y1] by row. */
function grid(img, rows, cols, label, gap = 5) {
  const { w, h, d } = img;
  const rowBands = bandsOf((y) => {
    for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) return true;
    return false;
  }, h, gap, rows, `${label} rows`);
  return rowBands.map(([y0, y1]) => bandsOf((x) => {
    for (let y = y0; y < y1; y++) if (d[(y * w + x) * 4 + 3]) return true;
    return false;
  }, w, gap, cols, `${label} cols`).map(([x0, x1]) => tight(img, [x0, y0, x1, y1])));
}

function tight(img, [x0, y0, x1, y1]) {
  const { w, d } = img;
  let a = x1;
  let b = y1;
  let c = x0;
  let e = y0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!d[(y * w + x) * 4 + 3]) continue;
      if (x < a) a = x;
      if (x >= c) c = x + 1;
      if (y < b) b = y;
      if (y >= e) e = y + 1;
    }
  }
  return [a, b, c, e];
}

/** Area-averaged copy of a box, at an exact size, into dst at (dx, dy). Result is fully opaque or clear, like the rest of the game's art. */
function blit(src, [x0, y0, x1, y1], dst, dx, dy, dw, dh) {
  const sw = (x1 - x0) / dw;
  const sh = (y1 - y0) / dh;
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, a = 0, t = 0;
      const u1 = Math.max(x0 + Math.floor(x * sw) + 1, Math.ceil(x0 + (x + 1) * sw));
      const v1 = Math.max(y0 + Math.floor(y * sh) + 1, Math.ceil(y0 + (y + 1) * sh));
      for (let v = y0 + Math.floor(y * sh); v < v1 && v < src.h; v++) {
        for (let u = x0 + Math.floor(x * sw); u < u1 && u < src.w; u++) {
          const i = (v * src.w + u) * 4;
          t++;
          if (!src.d[i + 3]) continue;
          r += src.d[i]; g += src.d[i + 1]; b += src.d[i + 2]; a++;
        }
      }
      if (a * 2 < t || !a) continue;
      const px = dx + x;
      const py = dy + y;
      if (px < 0 || py < 0 || px >= dst.w || py >= dst.h) continue;
      const o = (py * dst.w + px) * 4;
      dst.d[o] = r / a; dst.d[o + 1] = g / a; dst.d[o + 2] = b / a; dst.d[o + 3] = 255;
    }
  }
}

function fit(src, box, maxW, maxH, grow = true) {
  const bw = box[2] - box[0];
  const bh = box[3] - box[1];
  let k = Math.min(maxW / bw, maxH / bh);
  if (!grow) k = Math.min(1, k);
  return { w: Math.max(1, Math.round(bw * k)), h: Math.max(1, Math.round(bh * k)) };
}

/** A monster file: rows are the 5 views, columns are normal, squashed and stretched. */
function monsterSheet(src, boxes, height, rel) {
  const maxH = Math.max(...boxes.map((b) => b[3] - b[1]));
  const k = height / maxH;
  const maxW = Math.max(...boxes.map((b) => b[2] - b[0]));
  const cw = Math.ceil(maxW * k * 1.08) + 2;
  const ch = Math.ceil(height * 1.05) + 1;
  const out = blank(cw * 3, ch * 5);
  boxes.forEach((box, row) => {
    const bw = (box[2] - box[0]) * k;
    const bh = (box[3] - box[1]) * k;
    [[1, 1], [1.06, 0.95], [0.96, 1.05]].forEach(([sx, sy], col) => {
      const w = Math.round(bw * sx);
      const h = Math.round(bh * sy);
      blit(src, box, out, col * cw + Math.floor((cw - w) / 2), (row + 1) * ch - h, w, h);
    });
  });
  save(out, rel);
}

// ---- monsters: only once their sheets are there, the placeholders stand in until then
const has = (name) => fs.existsSync(path.join(RAW, name));
if (has('monsters_a.png')) {
  const a = key(read('monsters_a.png'));
  const ga = grid(a, 3, 5, 'monsters_a', 8);
  monsterSheet(a, ga[0], 110, 'monsters/ember_wisp.png');
  monsterSheet(a, ga[1], 120, 'monsters/salamander.png');
  monsterSheet(a, ga[2], 125, 'monsters/lava_bat.png');
}
if (has('monsters_b.png')) {
  const b = key(read('monsters_b.png'));
  const gb = grid(b, 3, 5, 'monsters_b', 8);
  monsterSheet(b, gb[0], 170, 'monsters/magma_golem.png');
  monsterSheet(b, gb[1], 135, 'monsters/ash_mage.png');
  monsterSheet(b, gb[2], 140, 'monsters/ash_knight.png');
}
if (has('monster_volcano_heart.png')) {
  const h = key(read('monster_volcano_heart.png'));
  monsterSheet(h, grid(h, 1, 5, 'volcano_heart', 5)[0], 240, 'monsters/volcano_heart.png');
}

// ---- props
const p = key(read('props.png'));
const NAMES = [
  ['burnt_pillar_0', 'burnt_pillar_1', 'burnt_pillar_2', 'charred_tree'],
  ['ash_shrub_0', 'ash_shrub_1', 'ember_fern', 'charred_stump'],
  ['basalt_0', 'basalt_1', 'magma_crystal_0', 'magma_crystal_1'],
];
grid(p, 3, 4, 'props', 8).forEach((row, r) => row.forEach((box, c) => {
  const s = fit(p, box, 256, 202, false);
  const out = blank(s.w, s.h);
  blit(p, box, out, 0, 0, s.w, s.h);
  save(out, `props/${NAMES[r][c]}.png`);
}));

// ---- item icons
function icons(file, names) {
  const ic = key(read(file));
  grid(ic, names.length, names[0].length, file, 8).forEach((row, r) => row.forEach((box, c) => {
    const s = fit(ic, box, 92, 92);
    const out = blank(96, 96);
    blit(ic, box, out, Math.floor((96 - s.w) / 2), Math.floor((96 - s.h) / 2), s.w, s.h);
    save(out, `icons/${names[r][c]}.png`);
  }));
}
icons('item_icons.png', [
  ['item_weapon_8_sword', 'item_weapon_8_mage', 'item_weapon_8_gunslinger', 'item_weapon_9_sword'],
  ['item_weapon_9_mage', 'item_weapon_9_gunslinger', 'item_magma_plate_sword', 'item_magma_plate_mage'],
  ['item_magma_plate_gunslinger', 'item_ash_hood', 'item_cinder_boots', 'item_ring_ember'],
]);
icons('item_icons_extra.png', [
  ['item_necklace_4', 'item_gloves_4', 'item_belt_4'],
  ['item_scabbard_4_sword', 'item_orb_4_mage', 'item_pouch_4_gunslinger'],
]);

// ---- the Ash Mage's shot
{
  const bolt = key(read('ember_bolt.png'));
  const box = tight(bolt, [0, 0, bolt.w, bolt.h]);
  const s = fit(bolt, box, 96, 96);
  const out = blank(s.w, s.h);
  blit(bolt, box, out, 0, 0, s.w, s.h);
  save(out, 'fx/ember_bolt.png');
}

// ---- decor atlas: 128 per cell, standing at the bottom centre
const de = key(read('decor_volcano.png'), 8);
const atlas = blank(512, 384);
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 4; c++) {
    const cw = de.w / 4;
    const ch = de.h / 3;
    const box = tight(de, [Math.floor(c * cw), Math.floor(r * ch), Math.floor((c + 1) * cw), Math.floor((r + 1) * ch)]);
    const s = fit(de, box, 124, 124, false);
    blit(de, box, atlas, c * 128 + Math.floor((128 - s.w) / 2), (r + 1) * 128 - 2 - s.h, s.w, s.h);
  }
}
save(atlas, 'props/decor_volcano.png');

// ---- island sheets: same cells, just smaller
for (const [name, w, h] of [['island_cliff_volcano', 1536, 768], ['island_slabs_volcano', 887, 443]]) {
  const src = key(read(`${name}.png`));
  const out = blank(w, h);
  blit(src, [0, 0, src.w, src.h], out, 0, 0, w, h);
  save(out, `props/${name}.png`);
}

// ---- ground tiles: shrink, take some colour out, then blend the edges so they repeat.
function tile(name, rel, saturation, brightness) {
  const src = read(name);
  for (let i = 0; i < src.w * src.h * 4; i += 4) {
    src.d[i + 3] = 255;
    const grey = src.d[i] * 0.3 + src.d[i + 1] * 0.59 + src.d[i + 2] * 0.11;
    for (let c = 0; c < 3; c++) src.d[i + c] = Math.min(255, (grey + (src.d[i + c] - grey) * saturation) * brightness);
  }
  const big = blank(1088, 1088);
  blit(src, [0, 0, src.w, src.h], big, 0, 0, 1088, 1088);
  const out = blank(1024, 1024);
  const BLEND = 64;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const sx = x < BLEND && t > x / BLEND ? x + 1024 : x;
      const sy = y < BLEND && t > y / BLEND ? y + 1024 : y;
      big.d.copy(out.d, (y * 1024 + x) * 4, (sy * 1088 + sx) * 4, (sy * 1088 + sx) * 4 + 4);
    }
  }
  save(out, rel);
}
// Dark rock and a lighter road; lava alone is allowed to stay bright.
tile('ground_ash_rock.png', 'ground/ash_rock.png', 0.75, 1);
tile('ground_ash_path.png', 'ground/ash_path.png', 0.75, 1);
tile('ground_lava.png', 'ground/lava.png', 0.95, 1);
