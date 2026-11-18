// Cuts the papercraft monsters (art_templates/papercraft_chars/raw/monsters/<id>_walk.png and <id>_attack.png, each a
// 5 x 4 grid: rows front, front diagonal, side, back diagonal, back; see art_templates/papercraft_chars/MONSTERS.md)
// into public/assets/sprites/paper/monsters/<id>.png: the same 5 rows, columns 0-3 walking and 4-7 attacking, plus
// meta.json with each sheet's size against the old one (SpriteActor scales the sprite by it).
// The owner's raw files come with the background already removed, soft-edged, with faint specks around them.
// Usage: node tools/cut_paper_monsters.cjs [id ...]
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'art_templates/papercraft_chars/raw/monsters');
const OLD = path.join(ROOT, 'public/assets/sprites/monsters');
const OUT = path.join(ROOT, 'public/assets/sprites/paper/monsters');
const IDS = ['green_slime', 'wild_rabbit', 'forest_fox', 'wild_boar', 'forest_wolf', 'forest_bear',
  'bog_toad', 'marsh_leech', 'swamp_serpent', 'mire_ghoul', 'will_o_wisp', 'bog_witch',
  'frost_penguin', 'tusk_seal', 'snow_owl', 'snow_sprite', 'snow_brawler', 'polar_bear', 'yeti_minion', 'yeti',
  'ember_wisp', 'salamander', 'lava_bat', 'magma_golem', 'ash_mage', 'ash_knight', 'volcano_heart'];
const ROWS = 5;
const COLS = 4;

async function read(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const d = data;
  if (/_walk|_attack/.test(file) && !hasAlpha(d)) keyMagenta(d);
  // Faint specks and halos out, the soft edge kept a little.
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : d[i] > 200 ? 255 : Math.round(((d[i] - 110) / 90) * 255);
  return { w, h, d };
}
const hasAlpha = (d) => { for (let i = 3; i < d.length; i += 400) if (d[i] < 250) return true; return false; };
function keyMagenta(d) {
  for (let i = 0; i < d.length; i += 4) {
    const low = Math.min(d[i], d[i + 2]) - d[i + 1];
    d[i + 3] = low > 70 && Math.abs(d[i] - d[i + 2]) < 90 ? 0 : 255;
  }
}

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
      const x = k % w;
      const y = (k - x) / w;
      sx += x;
      sy += y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = ny * w + nx;
        if (label[t] < 0 && d[t * 4 + 3]) {
          label[t] = out.length;
          stack.push(t);
        }
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
 * The 20 figures as [row][col]: rows are the 5 equal bands of the picture (by each piece's centre); in each, the 4
 * biggest pieces left to right, each taking the smaller pieces nearest to it. Specks are dropped.
 */
function grid(img, label) {
  const all = pieces(img).sort((a, b) => b.px.length - a.px.length);
  const minKeep = (all[0]?.px.length ?? 0) * 0.004;
  // The 20 figures are the 20 biggest pieces; the rows are where their centres jump down the most (ChatGPT's rows
  // aren't evenly spaced).
  const figs = all.slice(0, ROWS * COLS);
  if (figs.length < ROWS * COLS || figs[figs.length - 1].px.length < figs[0].px.length * 0.08) throw new Error(`${label}: fewer than ${ROWS * COLS} figures`);
  const byY = [...figs].sort((a, b) => a.cy - b.cy);
  const cuts = byY.slice(1).map((p, i) => ({ i: i + 1, gap: p.cy - byY[i].cy })).sort((a, b) => b.gap - a.gap).slice(0, ROWS - 1).map((c) => c.i).sort((a, b) => a - b);
  const rowsOf = [0, ...cuts, byY.length].slice(0, ROWS + 1);
  const groups = new Map(figs.map((p) => [p, [...p.px]]));
  // Every other piece (a spark, a dropped part) goes to the nearest figure.
  for (const p of all.slice(ROWS * COLS)) {
    if (p.px.length < minKeep) continue;
    let best = figs[0];
    for (const f of figs) if (Math.hypot(f.cx - p.cx, f.cy - p.cy) < Math.hypot(best.cx - p.cx, best.cy - p.cy)) best = f;
    groups.get(best).push(...p.px);
  }
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const row = byY.slice(rowsOf[r], rowsOf[r + 1]).sort((a, b) => a.cx - b.cx);
    if (row.length !== COLS) throw new Error(`${label}: row ${r + 1} has ${row.length} figures`);
    rows.push(row.map((p) => box(img, groups.get(p))));
  }
  return rows;
}

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

async function cut(id) {
  const walkFile = path.join(RAW, `${id}_walk.png`);
  const atkFile = path.join(RAW, `${id}_attack.png`);
  if (!fs.existsSync(walkFile) || !fs.existsSync(atkFile)) return console.warn(`- ${id}: not there yet, skipped`);
  const walk = await read(walkFile);
  const atk = await read(atkFile);
  const gw = grid(walk, `${id}_walk`);
  const ga = grid(atk, `${id}_attack`);
  // The old sheet's cell: its tallest view filled it to 1/1.05 (tools/cut_zone3.cjs monsterSheet).
  const old = await sharp(path.join(OLD, `${id}.png`)).metadata();
  const oldCh = old.height / ROWS;
  const target = (oldCh - 1) / 1.05;
  const H = (f) => f.y1 - f.y0;
  const kw = target / Math.max(...gw.flat().map(H));
  // The attack picture may be drawn bigger or smaller: match its last frame (back to normal) to the first walk frame.
  const ka = kw * median(gw.map((row, r) => H(row[0]) / H(ga[r][COLS - 1])));
  const scaled = [...gw.flat().map((f) => [f, kw]), ...ga.flat().map((f) => [f, ka])];
  const cw = Math.ceil(Math.max(...scaled.map(([f, k]) => (f.x1 - f.x0) * k)) * 1.08) + 2;
  const ch = Math.ceil(Math.max(...scaled.map(([f, k]) => H(f) * k)) * 1.05) + 1;
  const layers = [];
  for (const [g, k, col0, img] of [[gw, kw, 0, walk], [ga, ka, COLS, atk]]) {
    for (let r = 0; r < ROWS; r++) {
      const ground = Math.max(...g[r].map((f) => f.y1));
      for (let c = 0; c < COLS; c++) {
        const f = g[r][c];
        const a = alone(img, f);
        const w = Math.max(1, Math.round(a.w * k)), h = Math.max(1, Math.round(a.h * k));
        const png = await sharp(a.buf, { raw: { width: a.w, height: a.h, channels: 4 } }).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
        const cellX = (col0 + c) * cw, cellY = r * ch;
        let left = Math.round(cellX + cw / 2 - (f.cx - f.x0) * k);
        let top = Math.round(cellY + ch - (ground - f.y0) * k);
        // Keep inside the cell (a leap may lift a frame; a lunge may reach wide).
        left = Math.min(Math.max(left, cellX), cellX + cw - w);
        top = Math.max(top, cellY);
        layers.push({ input: png, left, top });
      }
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  await sharp({ create: { width: cw * COLS * 2, height: ch * ROWS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${id}.png`));
  const scale = Math.round((ch / oldCh) * 1000) / 1000;
  console.log(`  ${id}.png ${cw * COLS * 2}x${ch * ROWS} (cell ${cw}x${ch}, x${scale} of the old cell)`);
  return scale;
}

async function main() {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : IDS;
  const metaFile = path.join(OUT, 'meta.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  for (const id of ids) {
    const s = await cut(id);
    if (s !== undefined) meta[id] = { scale: s };
  }
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
