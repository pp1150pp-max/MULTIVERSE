// Cuts the papercraft map sheets in art_templates/papercraft_maps/raw/<map>/ into the game's paper sprite files,
// public/assets/sprites/paper/{props,ground}/, with the same names and sizes as the old art they stand in for
// (see art_templates/papercraft_maps/PROMPTS.md). Usage: node tools/cut_papercraft.cjs map1_forest
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OLD = path.join(ROOT, 'public/assets/sprites');
const OUT = path.join(ROOT, 'public/assets/sprites/paper');

/** Every map's sheets: [raw file, kind, options]. */
const MAPS = {
  map1_forest: [
    ['props.png', 'props', { cols: 4, rows: 3, names: ['tree_0', 'tree_1', 'tree_2', 'stump_tall', 'bush_0', 'bush_1', 'bush_2', 'stump', 'rock_0', 'rock_1', 'rock_2', 'pebble_0'], extra: [['pebble_1', 9]] }],
    ['camp.png', 'props', { cols: 4, rows: 3, names: ['tent', 'campfire', 'sign', 'portal', 'runestone', 'well', 'barrel', 'chest', 'cart', 'banner_red', 'flag', 'watchtower'] }],
    ['room_props.png', 'props', { cols: 4, rows: 2, names: ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_forest_${n}`) }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_forest', cell: [128, 128], place: 'bottom', fit: 'shared' }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_forest', cell: [384, 384], place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_forest', place: 'centre', fit: 'shared' }],
    ['island_debris.png', 'atlas', { cols: 4, rows: 3, out: 'island_debris', place: 'centre', fit: 'rows' }],
    ['island_cracks.png', 'atlas', { cols: 4, rows: 2, out: 'island_cracks', place: 'centre', fit: 'each' }],
    ['ground_grass.png', 'ground', { out: 'grass' }],
    ['ground_dirt.png', 'ground', { out: 'dirt' }],
    ['ground_pave.png', 'ground', { out: 'pave' }],
    ['ground_room.png', 'ground', { out: 'room_forest' }],
  ],
};

async function readRaw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: data };
}

/** Magenta becomes transparent and a purple fringe is pulled back (as in cut_zone3.cjs); specks are dropped. */
function key(img, minSpeck = 40) {
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

/** The tight box of everything opaque inside [x0, y0, x1, y1). */
function tight(img, [x0, y0, x1, y1], label) {
  let a = x1, b = y1, c = x0 - 1, e = y0 - 1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!img.d[(y * img.w + x) * 4 + 3]) continue;
    if (x < a) a = x;
    if (x > c) c = x;
    if (y < b) b = y;
    if (y > e) e = y;
  }
  if (c < a) throw new Error(`${label}: empty cell`);
  return [a, b, c + 1, e + 1];
}

/**
 * Runs of lines that have something in them, split where at least `gap` empty lines come between. When there are
 * more runs than wanted (a small part floating off a piece), the closest neighbours are joined until it fits.
 */
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
  while (bands.length > want) {
    let best = 0;
    for (let i = 1; i < bands.length - 1; i++) if (bands[i + 1][0] - bands[i][1] < bands[best + 1][0] - bands[best][1]) best = i;
    bands.splice(best, 2, [bands[best][0], bands[best + 1][1]]);
  }
  if (bands.length !== want) throw new Error(`${label}: found ${bands.length} bands, wanted ${want}: ${JSON.stringify(bands)}`);
  return bands;
}

/** Splits a keyed sheet into rows, then each row into columns, on empty lines. Boxes in reading order. */
function cells(img, cols, rows, label, gap = 6) {
  const { w, h, d } = img;
  const opaque = (x, y) => d[(y * w + x) * 4 + 3] !== 0;
  const out = [];
  const rowBands = bandsOf((y) => { for (let x = 0; x < w; x++) if (opaque(x, y)) return true; return false; }, h, gap, rows, `${label} rows`);
  for (const [y0, y1] of rowBands) {
    const colBands = bandsOf((x) => { for (let y = y0; y < y1; y++) if (opaque(x, y)) return true; return false; }, w, gap, cols, `${label} cols`);
    for (const [x0, x1] of colBands) out.push(tight(img, [x0, y0, x1, y1], `${label} cell ${out.length}`));
  }
  return out;
}

const crop = (img, [x0, y0, x1, y1]) =>
  sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });

async function sizeOf(rel) {
  const m = await sharp(path.join(OLD, rel)).metadata();
  return [m.width, m.height];
}

async function save(pipeline, rel) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await pipeline.png({ compressionLevel: 9 }).toFile(file);
  const m = await sharp(file).metadata();
  console.log(`  ${rel} ${m.width}x${m.height}`);
}

/** One file per cell, as tall as the old file of that name (the game sizes props by height). */
async function props(img, o, label) {
  const boxes = cells(img, o.cols, o.rows, label);
  const one = async (name, box) => {
    const [, oldH] = await sizeOf(`props/${name}.png`);
    const k = oldH / (box[3] - box[1]);
    const w = Math.max(1, Math.round((box[2] - box[0]) * k));
    await save(crop(img, box).resize(w, oldH, { kernel: 'lanczos3' }), `props/${name}.png`);
  };
  for (let i = 0; i < o.names.length; i++) await one(o.names[i], boxes[i]);
  for (const [name, i] of o.extra ?? []) await one(name, boxes[i]);
}

/**
 * A grid sheet the game reads by cell, the same size as the old one. `fit`: 'shared' = one scale for every
 * piece (keeps their sizes relative), 'rows' = one per row, 'each' = every piece fills its cell.
 * `place`: where a piece sits in its cell ('bottom' = standing on the cell's floor, 'top' = hanging from its top).
 */
async function atlas(img, o, label) {
  const [W, H] = await sizeOf(`props/${o.out}.png`);
  const cw = W / o.cols;
  const ch = H / o.rows;
  const pad = 0.04;
  const boxes = cells(img, o.cols, o.rows, label);
  const fitOf = (b) => Math.min((cw * (1 - 2 * pad)) / (b[2] - b[0]), (ch * (1 - 2 * pad)) / (b[3] - b[1]));
  const scale = boxes.map((b, i) => {
    if (o.fit === 'each') return fitOf(b);
    const group = o.fit === 'rows' ? boxes.filter((_, j) => Math.floor(j / o.cols) === Math.floor(i / o.cols)) : boxes;
    return Math.min(...group.map(fitOf));
  });
  const layers = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const w = Math.max(1, Math.round((b[2] - b[0]) * scale[i]));
    const h = Math.max(1, Math.round((b[3] - b[1]) * scale[i]));
    const cx = (i % o.cols) * cw;
    const cy = Math.floor(i / o.cols) * ch;
    const left = Math.round(cx + (cw - w) / 2);
    const top = Math.round(o.place === 'bottom' ? cy + ch - ch * pad - h : o.place === 'top' ? cy + ch * pad : cy + (ch - h) / 2);
    layers.push({ input: await crop(img, b).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer(), left, top });
  }
  const sheet = sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers);
  await save(sheet, `props/${o.out}.png`);
}

/** A repeating ground tile: shrunk to 1024 square, its edges blended into the opposite ones so it repeats without a seam. */
async function ground(file, o) {
  const N = 1024;
  const { data } = await sharp(file).removeAlpha().resize(N, N, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const B = 96; // Blend band in pixels: each edge fades into the wrapped-around copy of the far side.
  const at = (x, y, c) => data[(((y + N) % N) * N + ((x + N) % N)) * 3 + c];
  const out = Buffer.alloc(N * N * 3);
  // Shift by half a tile so the old edges sit in the middle, then blend that cross with a smooth weight.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = Math.abs(x - N / 2);
    const dy = Math.abs(y - N / 2);
    const wx = dx < B ? 1 - dx / B : 0; // Near the vertical seam: fade to the picture not shifted across.
    const wy = dy < B ? 1 - dy / B : 0;
    for (let c = 0; c < 3; c++) {
      const shifted = at(x + N / 2, y + N / 2, c);
      const across = at(x, y + N / 2, c); // Same row band, no x shift: hides the vertical seam.
      const down = at(x + N / 2, y, c); // Same column band, no y shift: hides the horizontal seam.
      let v = shifted;
      v = v * (1 - wx) + across * wx;
      v = v * (1 - wy) + down * wy;
      out[(y * N + x) * 3 + c] = Math.round(v);
    }
  }
  await save(sharp(out, { raw: { width: N, height: N, channels: 3 } }), `ground/${o.out}.png`);
}

async function main() {
  const map = process.argv[2];
  const specs = MAPS[map];
  if (!specs) throw new Error(`usage: node tools/cut_papercraft.cjs <${Object.keys(MAPS).join('|')}>`);
  const RAW = path.join(ROOT, 'art_templates/papercraft_maps/raw', map);
  for (const [file, kind, o] of specs) {
    const src = path.join(RAW, file);
    if (!fs.existsSync(src)) {
      console.warn(`- ${file}: not there yet, skipped`);
      continue;
    }
    console.log(file);
    if (kind === 'ground') await ground(src, o);
    else {
      const img = key(await readRaw(src));
      if (kind === 'props') await props(img, o, file);
      else await atlas(img, o, file);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
