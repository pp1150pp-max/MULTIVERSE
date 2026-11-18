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
  map2_marsh: [
    // The 12th cell is a spare (the portal moved to the camp sheet).
    ['props.png', 'props', { cols: 4, rows: 3, names: ['swamp_tree_0', 'swamp_tree_1', 'swamp_tree_2', 'willow', 'reeds_0', 'reeds_1', 'fern', 'mushrooms', 'mossrock_0', 'mossrock_1', 'swamp_stump'] }],
    ['room_props.png', 'props', { cols: 4, rows: 2, names: ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_marsh_${n}`) }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_marsh', place: 'bottom', fit: 'shared' }],
    ['planks.png', 'planks', { out: 'marsh_planks', cols: 3, aspect: 2.9 / 5, inner: [0.17, 0.83] }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_marsh', place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_marsh', place: 'centre', fit: 'shared' }],
    ['ground_marsh.png', 'ground', { out: 'marsh' }],
    ['ground_mud.png', 'ground', { out: 'mud' }],
    ['ground_water.png', 'ground', { out: 'water' }],
    ['ground_room.png', 'ground', { out: 'room_marsh' }],
  ],
  map3_snow: [
    ['props.png', 'props', { cols: 4, rows: 3, names: ['snow_pine_0', 'snow_pine_1', 'snow_pine_2', 'frost_tree', 'snow_shrub_0', 'snow_shrub_1', 'frost_fern', 'snow_stump', 'snow_rock_0', 'snow_rock_1', 'ice_crystal_0', 'ice_crystal_1'] }],
    ['room_props.png', 'props', { cols: 4, rows: 2, names: ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_snow_${n}`) }],
    // Cells 6-8 lie flat on the ground (world.ts DECOR.snow.flat), so they sit in the middle of their cell.
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_snow', place: 'bottom', fit: 'shared', flat: [6, 7, 8] }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_snow', place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_snow', place: 'centre', fit: 'shared' }],
    ['ground_snow.png', 'ground', { out: 'snow' }],
    ['ground_snow_path.png', 'ground', { out: 'snow_path' }],
    ['ground_ice.png', 'ground', { out: 'ice' }],
    ['ground_room.png', 'ground', { out: 'room_snow' }],
  ],
  map4_volcano: [
    ['props.png', 'props', { cols: 4, rows: 3, names: ['burnt_pillar_0', 'burnt_pillar_1', 'burnt_pillar_2', 'charred_tree', 'ash_shrub_0', 'ash_shrub_1', 'ember_fern', 'charred_stump', 'basalt_0', 'basalt_1', 'magma_crystal_0', 'magma_crystal_1'] }],
    ['room_props.png', 'props', { cols: 4, rows: 2, names: ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_volcano_${n}`) }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_volcano', place: 'bottom', fit: 'shared', flat: [6, 7, 8] }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_volcano', place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_volcano', place: 'centre', fit: 'shared' }],
    ['ground_ash_rock.png', 'ground', { out: 'ash_rock' }],
    ['ground_ash_path.png', 'ground', { out: 'ash_path' }],
    ['ground_lava.png', 'ground', { out: 'lava' }],
    ['ground_room.png', 'ground', { out: 'room_volcano' }],
  ],
  hub: [
    ['town.png', 'props', { cols: 5, rows: 2, names: ['ruin_fountain', 'ruin_statue', 'ruin_pillar', 'ruin_house', 'ruin_tower', 'ruin_rubble', 'town_stall', 'town_forge', 'town_vault', 'town_market'] }],
    // Walls are stretched to the old pictures' exact size: terrain.ts lines copies up by those pixel sizes. The 6th cell is a spare.
    ['walls.png', 'props', { cols: 3, rows: 2, exact: true, names: ['town_wall_a', 'town_wall_a_broken', 'town_wall_end', 'town_wall_b', 'town_wall_b_broken'] }],
    ['summoners.png', 'props', { cols: 2, rows: 2, names: ['summoner_forest', 'summoner_marsh', 'summoner_snow', 'summoner_volcano'] }],
    ['ground_brick.png', 'ground', { out: 'brick' }],
    // The rebuilt town (owner 2026-11-18, hub_redesign/HUB_REDESIGN.md): new pictures with no old file, so each gets a
    // fixed height. Sheet B is on green (the tailor's cloth is pink).
    ['town2_buildings_a.png', 'props', { cols: 2, rows: 2, height: 384, names: ['bld_store', 'bld_market', 'bld_forge', 'bld_guild'] }],
    ['town2_buildings_b.png', 'props', { cols: 2, rows: 2, height: 384, bg: 'green', names: ['bld_tailor', 'bld_vault', 'bld_house_a', 'bld_house_b'] }],
    // Round 6 (owner 2026-11-19, HUB.md 7): attached townhouses for the two top walls, and the bottom market.
    ['row_left.png', 'props', { cols: 3, rows: 2, height: 448, names: ['row_l_vault', 'row_l_crystal', 'row_l_house_a', 'row_l_house_b', 'row_l_house_c', 'row_l_shop'] }],
    ['row_right.png', 'props', { cols: 3, rows: 2, height: 448, names: ['row_r_guild', 'row_r_forge', 'row_r_house_a', 'row_r_house_b', 'row_r_house_c', 'row_r_shop'] }],
    ['market.png', 'props', { cols: 4, rows: 2, height: 256, names: ['mk_goods_stall', 'mk_auction_booth', 'mk_veg_stall', 'mk_wagon', 'mk_handcart', 'mk_sacks', 'mk_potion_table', 'mk_tag_table'] }],
    // The three stalls again, seen from behind (they face the fountain, away from the camera): these replace the
    // first three cells of market.png, so this line comes after it.
    ['market_backs.png', 'props', { cols: 3, rows: 1, height: 256, names: ['mk_goods_stall', 'mk_auction_booth', 'mk_veg_stall'] }],
    // Round 6b (owner 2026-11-19): each top wall's whole row of attached townhouses as one picture, sheared so its foot
    // runs at the game's own slope for a world axis (World ISO_DIR), like the walls (HUB.md 7.5).
    ['row_left_long.png', 'strip', { out: 'row_left_long', rise: true, width: 1600 }],
    ['row_right_long.png', 'strip', { out: 'row_right_long', rise: false, width: 1600 }],
    // Low things along the bottom two walls (HUB.md 6): skipped until the sheet is there.
    ['town2_low.png', 'props', { cols: 4, rows: 2, height: 256, names: ['low_stall_a', 'low_stall_b', 'garden_bed', 'hedge_a', 'hedge_b', 'house_back_a', 'house_back_b', 'woodpile'] }],
    ['town2_props.png', 'props', { cols: 4, rows: 3, height: 256, names: ['town_fountain', 'quest_board', 'crystal_stall', 'lamp_post', 'bench_a', 'bench_b', 'planter', 'banner_pole', 'crates', 'barrels', 'flower_box', 'potted_tree'] }],
  ],
};

async function readRaw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: data };
}

/**
 * Magenta becomes transparent and a purple fringe is pulled back (as in cut_zone3.cjs); specks are dropped.
 * `bg: 'green'`: the same for a pure green background, its green fringe pulled back.
 */
function key(img, minSpeck = 40, bg = 'magenta') {
  const { w, h, d } = img;
  for (let i = 0; i < w * h * 4; i += 4) {
    if (bg === 'green') {
      const over = d[i + 1] - Math.max(d[i], d[i + 2]);
      if (over > 70) d[i + 3] = 0;
      else {
        d[i + 3] = 255;
        if (over > 25) d[i + 1] = Math.max(d[i], d[i + 2]) + 22;
      }
      continue;
    }
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
    // `height`: a new picture with no old file, cut to this many pixels tall.
    const [oldW, oldH] = o.height ? [0, o.height] : await sizeOf(`props/${name}.png`);
    const k = oldH / (box[3] - box[1]);
    // `exact`: the old file's width too (pieces placed by their pixel size, like the town walls).
    const w = o.exact ? oldW : Math.max(1, Math.round((box[2] - box[0]) * k));
    await save(crop(img, box).resize(w, oldH, { kernel: 'lanczos3', fit: 'fill' }), `props/${name}.png`);
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
    const place = o.flat?.includes(i) ? 'centre' : o.place;
    const top = Math.round(place === 'bottom' ? cy + ch - ch * pad - h : place === 'top' ? cy + ch * pad : cy + (ch - h) / 2);
    layers.push({ input: await crop(img, b).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer(), left, top });
  }
  const sheet = sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers);
  await save(sheet, `props/${o.out}.png`);
}

/**
 * Boardwalk pieces (world.ts PLANK_SHEET): one row of cells, each stretched over a board `aspect` wide for its length.
 * The sheets come as long strips, so each cell takes a piece of its strip that already has that shape.
 */
async function planks(img, o, label) {
  const [W, H] = await sizeOf(`props/${o.out}.png`);
  const cw = W / o.cols;
  const strips = cells(img, o.cols, 1, label);
  const layers = [];
  for (let i = 0; i < o.cols; i++) {
    // `inner`: keep only this middle part of the strip's width (owner 2026-11-17: the boards alone, no side rails or posts).
    const [sx0, y0, sx1, y1] = strips[i];
    const [a, b] = o.inner ?? [0, 1];
    const x0 = Math.round(sx0 + (sx1 - sx0) * a);
    const x1 = Math.round(sx0 + (sx1 - sx0) * b);
    const len = Math.min(y1 - y0, Math.round((x1 - x0) / o.aspect));
    const top = Math.round(y0 + (y1 - y0 - len) / 2);
    layers.push({ input: await crop(img, [x0, top, x1, top + len]).resize(Math.round(cw), H, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer(), left: Math.round(i * cw), top: 0 });
  }
  await save(sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers), `props/${o.out}.png`);
}

/**
 * A long row seen along a world axis: its bottom edge is fitted with a straight line (the middle 70% of the columns)
 * and the picture is sheared up or down until that line has the slope a world axis has on screen. The camera looks
 * down ISO_DIR (1, 1.45, 1), so a world axis climbs sin(elevation) = 1.45 / √(1 + 1.45² + 1) ... per unit across.
 * `rise`: the row climbs to the right (the top-left wall), else it falls.
 */
async function strip(img, o, label) {
  const [x0, y0, x1, y1] = tight(img, [0, 0, img.w, img.h], label);
  const xs = [];
  const ys = [];
  for (let x = Math.round(x0 + (x1 - x0) * 0.15); x < x0 + (x1 - x0) * 0.85; x++) {
    for (let y = y1 - 1; y >= y0; y--) if (img.d[(y * img.w + x) * 4 + 3]) { xs.push(x); ys.push(y); break; }
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxy / sxx;
  const want = (o.rise ? -1 : 1) * Math.sin(Math.atan2(1.45, Math.SQRT2));
  const k = want - slope;
  console.log(`  ${label}: foot slope ${slope.toFixed(3)} → ${want.toFixed(3)}`);
  const sheared = await crop(img, [x0, y0, x1, y1])
    .affine([[1, 0], [k, 1]], { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const t = await sharp(sheared).trim({ threshold: 1 }).png().toBuffer();
  await save(sharp(t).resize({ width: o.width, kernel: 'lanczos3' }), `props/${o.out}.png`);
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
      const img = key(await readRaw(src), 40, o.bg);
      if (kind === 'props') await props(img, o, file);
      else if (kind === 'planks') await planks(img, o, file);
      else if (kind === 'strip') await strip(img, o, file);
      else await atlas(img, o, file);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
