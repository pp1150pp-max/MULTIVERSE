// Cuts floor 2's papercraft characters and icons (art_templates/papercraft_maps/FLOOR2_*.md, papercraft_icons/FLOOR2_SETS.md)
// into public/assets/sprites/paper/. Floor 2 has no old pictures to size against, so sizes are fixed here.
//   monsters  raw/floor2_m*/monsters/<id>_<move>.png (5 rows × 4 frames each) → monsters/<id>.png: the 5 rows, the moves
//             side by side 4 columns each (the first move, walking or idling, in 0-3, then the rest in order), and
//             meta.json { moves } so the game knows which columns are which
//   keys      raw/floor2_m*/key_*.png → icons/stone_key_<boss>.png 96×96
//   sets      papercraft_icons/raw/floor2/set_*.png (7 × 2) → icons/item_set_<set>_<piece>.png 96×96, emblem icons/set_<set>.png
// Every background is measured from the sheet's border (tools/paper_key.cjs). Ghosts keep their see-through parts.
// (The harbour town's NPCs and portraits are cut by its own PR, feature/harbor-town.)
// Usage: node tools/cut_floor2_chars.cjs [monsters|keys|sets ...] [--only id,id]
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { keyBg, trackedSprites } = require('./paper_key.cjs');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'art_templates/papercraft_maps/raw');
const ICON_RAW = path.join(ROOT, 'art_templates/papercraft_icons/raw/floor2');
const OUT = path.join(ROOT, 'public/assets/sprites/paper');
const tracked = trackedSprites(ROOT);

/**
 * Every floor 2 monster: its map folder, its moves (raw file suffixes, the first is the walk or idle loop), the tallest
 * walking figure's height in px, and `ghost` for the see-through ones (all of map 3, the ghost pirate king).
 * `ref`: how a move is sized against the first one. Default 'all' = its frames' median height matches the first
 * move's; 'first' = only its first frame (moves that shrink away: hiding, vanishing, diving).
 */
const NORMAL = 200;
const BOSS = 320;
const MONSTERS = {
  hermit_crab: { map: 'floor2_m1', moves: ['walk', 'attack'] },
  thief_gull: { map: 'floor2_m1', moves: ['walk', 'attack'] },
  shock_eel: { map: 'floor2_m1', moves: ['walk', 'attack'] },
  spike_turtle: { map: 'floor2_m1', moves: ['walk', 'attack'] },
  giant_crab: { map: 'floor2_m1', boss: true, moves: ['walk', 'claw', 'cannon', 'shell'], ref: { shell: 'first' } },
  prisoner: { map: 'floor2_m2', moves: ['walk', 'throw', 'run'] },
  cutlass_pirate: { map: 'floor2_m2', moves: ['walk', 'combo'] },
  shotgunner: { map: 'floor2_m2', moves: ['walk', 'attack'] },
  keg_prisoner: { map: 'floor2_m2', moves: ['walk', 'throw', 'charge'] },
  peg_captain: { map: 'floor2_m2', boss: true, moves: ['walk', 'anchor', 'shout'] },
  parrot: { map: 'floor2_m2', moves: ['fly', 'perch'] },
  ghost_monkey: { map: 'floor2_m3', ghost: true, moves: ['walk', 'throw'] },
  ghost_sailor: { map: 'floor2_m3', ghost: true, moves: ['walk', 'attack', 'fade'], ref: { fade: 'first' } },
  ghost_siren: { map: 'floor2_m3', ghost: true, moves: ['walk', 'sing'] },
  barnacle_crew: { map: 'floor2_m3', ghost: true, moves: ['walk', 'attack'] },
  barnacle_small: { map: 'floor2_m3', ghost: true, moves: ['walk', 'attack'] },
  ghost_captain: { map: 'floor2_m3', ghost: true, boss: true, moves: ['walk', 'slash', 'bell', 'vanish'], ref: { vanish: 'first' }, equal: ['vanish'] },
  shark_knight: { map: 'floor2_m4', moves: ['walk', 'attack', 'dive'], ref: { dive: 'first' } },
  seahorse_soldier: { map: 'floor2_m4', moves: ['walk', 'shoot'] },
  ghost_pirate_king: { map: 'floor2_m4', ghost: true, moves: ['walk', 'slash'] },
  kraken_tentacle: { map: 'floor2_m4', moves: ['idle', 'slam'] },
  // The map's tentacles rising out of the whirlpool (FLOOR2_M4_REVISION.md, owner 2026-11-26); the room's arms keep kraken_tentacle.
  kraken_tentacle_sea: { map: 'floor2_m4', moves: ['idle', 'slam'] },
  kraken: { map: 'floor2_m4', boss: true, moves: ['idle', 'arm_slam', 'arm_cut', 'ink', 'dive'], ref: { dive: 'first' } },
};
const KEYS = { crab: 'floor2_m1/key_crab_claw.png', captain: 'floor2_m2/key_treasure_compass.png', ghost: 'floor2_m3/key_ghost_bell.png', kraken: 'floor2_m4/key_kraken_eye.png' };
/** Raw sheet → set id in src/shared/data/sets.ts. Cells in the order of FLOOR2_SETS.md. */
const SETS = { set_beach: 'beach', set_pirate: 'pirate', set_ghost: 'ghost_sailor', set_sea_king: 'sea_king' };
const SET_CELLS = ['weapon_sword', 'weapon_mage', 'weapon_gunslinger', 'scabbard_sword', 'orb_mage', 'pouch_gunslinger', null,
  'helmet', 'necklace', 'armor', 'gloves', 'belt', 'boots', 'ring'];
const ICON = 96;
const ICON_ART = 88;

async function read(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: data };
}

async function save(pipeline, rel) {
  const file = path.join(OUT, rel);
  if (tracked.has(path.resolve(file))) throw new Error(`${rel} is already in git (a floor 1 file): refusing to overwrite`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await pipeline.png({ compressionLevel: 9 }).toFile(file);
  const m = await sharp(file).metadata();
  console.log(`  ${rel} ${m.width}x${m.height}`);
}

/** Connected pieces (8-way), each with its pixels and centre. */
function pieces(img) {
  const { w, h, d } = img;
  const label = new Int32Array(w * h).fill(-1);
  const out = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] >= 0 || !d[s * 4 + 3]) continue;
    const px = [];
    const stack = [s];
    label[s] = out.length;
    let sx = 0, sy = 0;
    while (stack.length) {
      const k = stack.pop();
      px.push(k);
      const x = k % w, y = (k - x) / w;
      sx += x;
      sy += y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = ny * w + nx;
        if (label[t] < 0 && d[t * 4 + 3]) { label[t] = out.length; stack.push(t); }
      }
    }
    out.push({ px, cx: sx / px.length, cy: sy / px.length });
  }
  return out;
}

function box(img, px) {
  let x0 = img.w, y0 = img.h, x1 = 0, y1 = 0, sx = 0;
  for (const k of px) {
    const x = k % img.w, y = (k - x) / img.w;
    sx += x;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { px, x0, y0, x1: x1 + 1, y1: y1 + 1, cx: sx / px.length };
}

/**
 * The rows × cols figures as [row][col] (as tools/cut_paper_monsters.cjs): the biggest pieces are the figures, rows
 * cut where their centres jump down the most; every smaller piece (a wisp, a dropped part) joins the nearest figure.
 */
function grid(img, rows, cols, label) {
  const all = pieces(img).sort((a, b) => b.px.length - a.px.length);
  const minKeep = (all[0]?.px.length ?? 0) * 0.002;
  const figs = all.slice(0, rows * cols);
  if (figs.length < rows * cols) throw new Error(`${label}: only ${figs.length} pieces, wanted ${rows * cols}`);
  const small = figs[figs.length - 1].px.length / figs[0].px.length;
  if (small < 0.05) console.warn(`  ! ${label}: smallest figure is ${(small * 100).toFixed(1)}% of the biggest, check it`);
  const byY = [...figs].sort((a, b) => a.cy - b.cy);
  const cuts = byY.slice(1).map((p, i) => ({ i: i + 1, gap: p.cy - byY[i].cy })).sort((a, b) => b.gap - a.gap).slice(0, rows - 1).map((c) => c.i).sort((a, b) => a - b);
  const bounds = [0, ...cuts, byY.length];
  const groups = new Map(figs.map((p) => [p, [...p.px]]));
  for (const p of all.slice(rows * cols)) {
    if (p.px.length < minKeep) continue;
    let best = figs[0];
    for (const f of figs) if (Math.hypot(f.cx - p.cx, f.cy - p.cy) < Math.hypot(best.cx - p.cx, best.cy - p.cy)) best = f;
    groups.get(best).push(...p.px);
  }
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = byY.slice(bounds[r], bounds[r + 1]).sort((a, b) => a.cx - b.cx);
    if (row.length !== cols) throw new Error(`${label}: row ${r + 1} has ${row.length} figures, wanted ${cols}`);
    out.push(row.map((p) => box(img, groups.get(p))));
  }
  return out;
}

/**
 * Every piece to the equal-sized cell its centre falls in, for a sheet whose figures overlap the next row (long
 * swords) and break into wisps (a ghost vanishing), so neither empty lines nor biggest pieces find the cells.
 * Only for moves listed in a monster's `equal`, after looking at the sheet.
 */
function equalGrid(img, rows, cols) {
  const cw = img.w / cols, ch = img.h / rows;
  const px = Array.from({ length: rows * cols }, () => []);
  for (const p of pieces(img)) {
    if (p.px.length < 30) continue;
    px[Math.min(rows - 1, Math.floor(p.cy / ch)) * cols + Math.min(cols - 1, Math.floor(p.cx / cw))].push(...p.px);
  }
  return Array.from({ length: rows }, (_, r) => px.slice(r * cols, r * cols + cols).map((c, i) => {
    if (!c.length) throw new Error(`cell ${r},${i} is empty`);
    return box(img, c);
  }));
}

/** One figure's own pixels on a transparent box (a neighbour's stray bits left out). */
function alone(img, f) {
  const w = f.x1 - f.x0, h = f.y1 - f.y0;
  const buf = Buffer.alloc(w * h * 4);
  for (const k of f.px) {
    const x = (k % img.w) - f.x0, y = Math.floor(k / img.w) - f.y0;
    img.d.copy(buf, (y * w + x) * 4, k * 4, k * 4 + 4);
  }
  return { buf, w, h };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const H = (f) => f.y1 - f.y0;

/**
 * Lays [row][col] figure grids side by side, each with its own scale, feet on each row's ground line (the lowest
 * foot of that grid's row), centred in equal cells. Returns the sheet and its cell size.
 */
async function sheet(grids, rows, cols) {
  const all = grids.flatMap(({ g, k }) => g.flat().map((f) => [f, k]));
  const cw = Math.ceil(Math.max(...all.map(([f, k]) => (f.x1 - f.x0) * k)) * 1.08) + 2;
  const ch = Math.ceil(Math.max(...all.map(([f, k]) => H(f) * k)) * 1.05) + 1;
  const layers = [];
  for (let gi = 0; gi < grids.length; gi++) {
    const { g, k, img } = grids[gi];
    for (let r = 0; r < rows; r++) {
      const ground = Math.max(...g[r].map((f) => f.y1));
      for (let c = 0; c < cols; c++) {
        const f = g[r][c];
        const a = alone(img, f);
        const w = Math.max(1, Math.round(a.w * k)), h = Math.max(1, Math.round(a.h * k));
        const png = await sharp(a.buf, { raw: { width: a.w, height: a.h, channels: 4 } }).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
        const cellX = (gi * cols + c) * cw, cellY = r * ch;
        let left = Math.round(cellX + cw / 2 - (f.cx - f.x0) * k);
        let top = Math.round(cellY + ch - (ground - f.y0) * k);
        left = Math.min(Math.max(left, cellX), cellX + cw - w);
        top = Math.max(top, cellY);
        layers.push({ input: png, left, top });
      }
    }
  }
  const pipeline = sharp({ create: { width: cw * cols * grids.length, height: ch * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers);
  return { pipeline, cw, ch };
}

async function monster(id, meta) {
  const m = MONSTERS[id];
  const grids = [];
  for (const move of m.moves) {
    const file = path.join(RAW, m.map, 'monsters', `${id}_${move}.png`);
    if (!fs.existsSync(file)) throw new Error(`${id}: ${file} is missing`);
    const img = await read(file);
    const { bg, green } = keyBg(img, { soft: true, ghost: !!m.ghost });
    let g;
    if (m.equal?.includes(move)) {
      g = equalGrid(img, 5, 4);
      console.log(`  ${id}_${move}: equal cells`);
    } else try {
      g = grid(img, 5, 4, `${id}_${move}`);
    } catch (e) {
      // A fading ghost breaks into many small wisps: fall back to empty lines between the cells.
      const cells = lineGrid(img, 5, 4, `${id}_${move}`, true);
      console.log(`  ${id}_${move}: ${e.message}; split on empty lines instead`);
      g = [0, 1, 2, 3, 4].map((r) => cells.slice(r * 4, r * 4 + 4));
    }
    grids.push({ move, g, img, bgInfo: `${green ? 'green' : 'magenta'} ${bg.join(',')}` });
  }
  const base = grids[0];
  base.k = (m.boss ? BOSS : NORMAL) / Math.max(...base.g.flat().map(H));
  for (const x of grids.slice(1)) {
    const ref = m.ref?.[x.move] ?? 'all';
    // Matched by the figure's area (√ of its pixel count), not its height: spread wings, a dragged anchor or a raised
    // arm change the height of a figure drawn at the same size.
    const S = (f) => Math.sqrt(f.px.length);
    const ratios = base.g.map((row, r) => {
      const want = median(row.map(S));
      return ref === 'first' ? S(row[0]) / S(x.g[r][0]) : want / median(x.g[r].map(S));
    });
    x.k = base.k * median(ratios);
  }
  const { pipeline, cw, ch } = await sheet(grids, 5, 4);
  console.log(`${id}: ${grids.map((x) => `${x.move} (${x.bgInfo}, x${x.k.toFixed(3)})`).join(', ')}, cell ${cw}x${ch}`);
  await save(pipeline, `monsters/${id}.png`);
  meta[id] = { moves: m.moves };
}

/** One icon: the piece fitted into ICON_ART px, centred on a transparent ICON square. */
async function icon(img, f, rel) {
  const a = alone(img, f);
  const k = ICON_ART / Math.max(a.w, a.h);
  const w = Math.max(1, Math.round(a.w * k)), h = Math.max(1, Math.round(a.h * k));
  const art = await sharp(a.buf, { raw: { width: a.w, height: a.h, channels: 4 } }).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
  await save(sharp({ create: { width: ICON, height: ICON, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, left: Math.round((ICON - w) / 2), top: Math.round((ICON - h) / 2) }]), rel);
}

async function keyIcon(boss) {
  const img = await read(path.join(RAW, KEYS[boss]));
  keyBg(img, { soft: true });
  const all = pieces(img).sort((a, b) => b.px.length - a.px.length);
  // The key and any sparkles around it.
  const keep = all.filter((p) => p.px.length >= all[0].px.length * 0.002).flatMap((p) => p.px);
  await icon(img, box(img, keep), `icons/stone_key_${boss}.png`);
}

/**
 * Runs of lines with something in them, split by at least `gap` empty lines; when there are too many (a pair of
 * gloves is two pieces), the closest neighbours are joined (as tools/cut_papercraft.cjs bandsOf).
 */
function bandsOf(has, size, want, label, gap = 6, strict = false) {
  const bands = [];
  let start = -1, empty = 0;
  for (let i = 0; i < size; i++) {
    if (has(i)) { if (start < 0) start = i; empty = 0; }
    else if (start >= 0 && ++empty >= gap) { bands.push([start, i - empty + 1]); start = -1; }
  }
  if (start >= 0) bands.push([start, size]);
  while (!strict && bands.length > want) {
    let best = 0;
    for (let i = 1; i < bands.length - 1; i++) if (bands[i + 1][0] - bands[i][1] < bands[best + 1][0] - bands[best][1]) best = i;
    bands.splice(best, 2, [bands[best][0], bands[best + 1][1]]);
  }
  if (bands.length !== want) throw new Error(`${label}: found ${bands.length} bands, wanted ${want}`);
  return bands;
}

/** Icon sheets: rows, then columns, on empty lines; each cell's pixels as one figure. */
function lineGrid(img, rows, cols, label, strict = false) {
  const { w, d } = img;
  const on = (x, y) => d[(y * w + x) * 4 + 3] !== 0;
  const out = [];
  let all = null;
  for (const [y0, y1] of bandsOf((y) => { for (let x = 0; x < w; x++) if (on(x, y)) return true; return false; }, img.h, rows, `${label} rows`, 6, strict)) {
    let colBands;
    try {
      colBands = bandsOf((x) => { for (let y = y0; y < y1; y++) if (on(x, y)) return true; return false; }, w, cols, `${label} cols`, 6, strict);
    } catch (e) {
      if (strict) throw e;
      colBands = null;
    }
    if (colBands) {
      for (const [x0, x1] of colBands) {
        const px = [];
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (on(x, y)) px.push(y * w + x);
        out.push(box(img, px));
      }
      continue;
    }
    // Two neighbours too close for an empty column between them: each piece goes to the equal-width column its
    // centre falls in (ChatGPT spaces these sheets evenly).
    all ??= pieces(img);
    const cellPx = Array.from({ length: cols }, () => []);
    for (const p of all) if (p.cy >= y0 && p.cy < y1) cellPx[Math.min(cols - 1, Math.floor(p.cx / (w / cols)))].push(...p.px);
    console.log(`  ${label}: a row split into equal columns`);
    for (const px of cellPx) {
      if (!px.length) throw new Error(`${label}: an empty cell`);
      out.push(box(img, px));
    }
  }
  return out;
}

async function setSheet(file) {
  const set = SETS[file];
  const img = await read(path.join(ICON_RAW, `${file}.png`));
  keyBg(img, { soft: true });
  const g = lineGrid(img, 2, 7, file);
  for (let i = 0; i < g.length; i++) {
    await icon(img, g[i], SET_CELLS[i] ? `icons/item_set_${set}_${SET_CELLS[i]}.png` : `icons/set_${set}.png`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? new Set(args.splice(oi, 2)[1].split(',')) : null;
  const want = args.length ? args : ['monsters', 'keys', 'sets'];
  const pick = (ids) => (only ? ids.filter((i) => only.has(i)) : ids);
  // A bad sheet is reported and skipped, so one run lists every problem.
  const failed = [];
  const each = async (ids, fn) => {
    for (const id of ids) {
      try { await fn(id); } catch (e) { failed.push(`${id}: ${e.message}`); }
    }
  };
  if (want.includes('monsters')) {
    const metaFile = path.join(OUT, 'monsters/meta.json');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    await each(pick(Object.keys(MONSTERS)), (id) => monster(id, meta));
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
  }
  if (want.includes('keys')) await each(pick(Object.keys(KEYS)), keyIcon);
  if (want.includes('sets')) await each(pick(Object.keys(SETS)), setSheet);
  if (failed.length) {
    console.error(`\nNot cut:\n${failed.map((f) => `  ${f}`).join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
