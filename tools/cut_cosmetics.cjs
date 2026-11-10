// Cuts the raw ChatGPT sheets for cosmetics (art_templates/cosmetics/raw/<id>.png: 5 rows × 3 frames) and the
// classes' riding poses (art_templates/<class>/raw/ride.png and ride_board.png: 5 rows × 2 frames).
// Usage: PNGJS=<path to pngjs> node tools/cut_cosmetics.cjs [main checkout root holding art_templates/*/raw]
//
// - The background (flat magenta or flat green, read from the corner) becomes transparent, its fringe is
//   pulled back, specks and the small motion marks GPT likes to add beside pets are dropped.
// - Each sheet gets ONE scale, so a creature keeps its size in every view and frame. Within a row every frame
//   keeps its height above the row's lowest foot, so hops and wing beats stay in the picture.
// - Cosmetics go to public/assets/sprites/cosmetics/<id>.png, cells sized to the biggest figure.
// - Riding poses go to public/assets/sprites/player/<class>/, 256×256 cells, feet 16px over the cell bottom like
//   every other class animation, and sprite.json gets the `ride` / `ride_board` entries.
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.join(__dirname, '..');
const RAW_ROOT = process.argv[2] || ROOT;

/** Tallest figure in a cosmetic sheet after scaling, in px. */
const COS_H = { wings: 120, mount: 140, pet: 84 };
const COSMETICS = [
  'wings_angel', 'wings_bat', 'wings_phoenix', 'wings_butterfly', 'wings_mech',
  'mount_wolf', 'mount_warhorse', 'mount_raptor', 'mount_hoverboard', 'mount_tortoise',
  'pet_slime', 'pet_cat', 'pet_dragon', 'pet_bot', 'pet_wisp',
];
/** Riding poses: the figure (no glow) as tall as this in the 256 cell; standing is 200 (the class sheets). */
const RIDE_H = { ride: 165, ride_board: 188 };
const CLASSES = ['sword', 'mage', 'gunslinger'];

function read(file) {
  const p = PNG.sync.read(fs.readFileSync(file));
  return { w: p.width, h: p.height, d: p.data };
}
function save(img, file) {
  const p = new PNG({ width: img.w, height: img.h });
  img.d.copy(p.data);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(p, { colorType: 6 }));
  console.log(path.relative(ROOT, file), img.w, img.h);
}

/**
 * Flat background → transparent, specks dropped. Only the figure's outer edge gets its background tint pulled
 * back (the mage's purple robe on magenta must keep its colour inside).
 */
function key(img) {
  const { w, h, d } = img;
  const green = d[1] > 180 && d[0] < 120 && d[2] < 120;
  // How strongly a pixel leans toward the background colour.
  const lean = (i) => (green ? d[i + 1] - Math.max(d[i], d[i + 2]) : Math.min(d[i], d[i + 2]) - d[i + 1]);
  for (let i = 0; i < w * h * 4; i += 4) {
    const bgLike = green ? lean(i) > 70 : lean(i) > 70 && Math.abs(d[i] - d[i + 2]) < 90;
    d[i + 3] = bgLike ? 0 : 255;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3] || lean(i) <= 25) continue;
      const edge = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => nx < 0 || ny < 0 || nx >= w || ny >= h || !d[(ny * w + nx) * 4 + 3]);
      if (!edge) continue;
      if (green) d[i + 1] = Math.min(d[i + 1], Math.max(d[i], d[i + 2]) + 22);
      else {
        d[i] = Math.min(d[i], d[i + 1] + 22);
        d[i + 2] = Math.min(d[i + 2], d[i + 1] + 22);
      }
    }
  }
  for (const comp of components(img, 0, 0, w, h)) if (comp.length < 40) for (const k of comp) d[k * 4 + 3] = 0;
  return img;
}

/** 4-connected groups of opaque pixel indices inside a box. */
function components(img, x0, y0, x1, y1) {
  const { w, d } = img;
  const seen = new Uint8Array(img.w * img.h);
  const out = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const s = y * w + x;
      if (seen[s] || !d[s * 4 + 3]) continue;
      const stack = [s];
      const comp = [];
      seen[s] = 1;
      while (stack.length) {
        const k = stack.pop();
        comp.push(k);
        const kx = k % w;
        const ky = (k - kx) / w;
        for (const [nx, ny] of [[kx - 1, ky], [kx + 1, ky], [kx, ky - 1], [kx, ky + 1]]) {
          if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
          const t = ny * w + nx;
          if (!seen[t] && d[t * 4 + 3]) {
            seen[t] = 1;
            stack.push(t);
          }
        }
      }
      out.push(comp);
    }
  }
  return out;
}

/** Splits sorted values into `n` groups at the n−1 widest gaps; returns each value's group. */
function groups(values, n) {
  const order = values.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const gaps = order.slice(1).map((o, i) => [o[0] - order[i][0], i]).sort((p, q) => q[0] - p[0]).slice(0, n - 1).map((g) => g[1]);
  const cut = new Set(gaps);
  const out = new Array(values.length);
  let g = 0;
  order.forEach(([, i], j) => {
    out[i] = g;
    if (cut.has(j)) g++;
  });
  return out;
}

/**
 * The figure in each cell of a rows × cols grid. GPT's grid is never even (a raised wing reaches into the row
 * above), so the cells come from the pieces themselves: the big pieces are grouped into rows by height and into
 * columns by position, and every smaller piece joins the nearest figure, kept only when it is at least
 * `minShare` of that figure (sparks stay, specks and pets' motion marks go).
 */
function cells(img, rows, cols, minShare, label) {
  const { w } = img;
  const comps = components(img, 0, 0, img.w, img.h).map((px) => {
    let l = Infinity, t = Infinity, r = 0, b = 0;
    for (const k of px) {
      const x = k % w;
      const y = (k - x) / w;
      l = Math.min(l, x); r = Math.max(r, x + 1); t = Math.min(t, y); b = Math.max(b, y + 1);
    }
    return { px, box: [l, t, r, b], cx: (l + r) / 2, cy: (t + b) / 2 };
  });
  const maxLen = Math.max(...comps.map((c) => c.px.length));
  const big = comps.filter((c) => c.px.length >= maxLen * 0.12);
  if (big.length < rows * cols) throw new Error(`${label}: ${big.length} figures found, expected ${rows * cols}`);
  const rowOf = groups(big.map((c) => c.cy), rows);
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => []));
  for (let r = 0; r < rows; r++) {
    const inRow = big.filter((_, i) => rowOf[i] === r);
    const colOf = groups(inRow.map((c) => c.cx), cols);
    inRow.forEach((c, i) => grid[r][colOf[i]].push(c));
  }
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell.length) throw new Error(`${label} r${r} c${c}: empty cell`);
  }));
  // Smaller pieces join the figure whose box is nearest.
  const dist = (c, box) => Math.hypot(Math.max(box[0] - c.cx, 0, c.cx - box[2]), Math.max(box[1] - c.cy, 0, c.cy - box[3]));
  const boxOf = (cell) => cell.reduce((a, c) => [Math.min(a[0], c.box[0]), Math.min(a[1], c.box[1]), Math.max(a[2], c.box[2]), Math.max(a[3], c.box[3])], [Infinity, Infinity, 0, 0]);
  const cellsFlat = grid.flat().map((cell) => ({ cell, box: boxOf(cell), len: cell.reduce((n, c) => n + c.px.length, 0) }));
  for (const c of comps) {
    if (big.includes(c)) continue;
    let best = cellsFlat[0];
    for (const f of cellsFlat) if (dist(c, f.box) < dist(c, best.box)) best = f;
    if (c.px.length >= best.len * minShare && dist(c, best.box) < 40) best.cell.push(c);
  }
  return grid.map((row) => row.map((cell) => {
    const mask = new Set();
    for (const c of cell) for (const k of c.px) mask.add(k);
    return { mask, box: boxOf(cell) };
  }));
}

/** Area-averaged copy of a figure at scale k, its box's top-left landing at (dx, dy). Fully opaque or clear. */
function place(src, fig, k, dst, dx, dy) {
  const [x0, y0, x1, y1] = fig.box;
  const dw = Math.round((x1 - x0) * k);
  const dh = Math.round((y1 - y0) * k);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const u0 = x0 + Math.floor(x / k);
      const v0 = y0 + Math.floor(y / k);
      const u1 = Math.max(u0 + 1, Math.ceil(x0 + (x + 1) / k));
      const v1 = Math.max(v0 + 1, Math.ceil(y0 + (y + 1) / k));
      let r = 0, g = 0, b = 0, a = 0, t = 0;
      for (let v = v0; v < v1 && v < y1; v++) {
        for (let u = u0; u < u1 && u < x1; u++) {
          const i = v * src.w + u;
          t++;
          if (!fig.mask.has(i)) continue;
          r += src.d[i * 4]; g += src.d[i * 4 + 1]; b += src.d[i * 4 + 2]; a++;
        }
      }
      if (!a || a * 2 < t) continue;
      const px = dx + x;
      const py = dy + y;
      if (px < 0 || py < 0 || px >= dst.w || py >= dst.h) continue;
      const o = (py * dst.w + px) * 4;
      dst.d[o] = r / a; dst.d[o + 1] = g / a; dst.d[o + 2] = b / a; dst.d[o + 3] = 255;
    }
  }
}

/**
 * Lays the figures out as a sheet. `cellW/cellH` fixed (riding poses) or null (fit the biggest figure, cosmetics).
 * Horizontally each figure is centred; vertically it keeps its height above its row's lowest foot.
 */
function layout(src, grid, k, cellW, cellH, footPad) {
  const rows = grid.length;
  const cols = grid[0].length;
  const base = grid.map((row) => Math.max(...row.map((f) => f.box[3])));
  let maxW = 0, maxUp = 0;
  grid.forEach((row, r) => row.forEach((f) => {
    maxW = Math.max(maxW, f.box[2] - f.box[0]);
    maxUp = Math.max(maxUp, base[r] - f.box[1]);
  }));
  const W = cellW ?? Math.ceil(maxW * k) + 8;
  const H = cellH ?? Math.ceil(maxUp * k) + footPad + 4;
  const dst = { w: W * cols, h: H * rows, d: Buffer.alloc(W * cols * H * rows * 4) };
  grid.forEach((row, r) => row.forEach((f, c) => {
    const fw = Math.round((f.box[2] - f.box[0]) * k);
    const dx = c * W + Math.round((W - fw) / 2);
    const dy = r * H + H - footPad - Math.round((base[r] - f.box[1]) * k);
    if (dy < r * H) console.warn(`r${r} c${c}: figure taller than its cell, top clipped`);
    place(src, f, k, dst, dx, dy);
  }));
  return dst;
}

// ---- cosmetics
for (const id of COSMETICS) {
  const file = path.join(RAW_ROOT, 'art_templates/cosmetics/raw', `${id}.png`);
  if (!fs.existsSync(file)) {
    console.warn(`missing ${file}`);
    continue;
  }
  const src = key(read(file));
  // Pets: drop the little motion marks (well under a tenth of the body); wings/mounts keep detached bits like sparks.
  const grid = cells(src, 5, 3, id.startsWith('pet_') ? 0.1 : 0.02, id);
  const tallest = Math.max(...grid.flat().map((f) => f.box[3] - f.box[1]));
  const k = COS_H[id.split('_')[0]] / tallest;
  save(layout(src, grid, k, null, null, 2), path.join(ROOT, 'public/assets/sprites/cosmetics', `${id}.png`));
}

// ---- riding poses
for (const cls of CLASSES) {
  const dir = path.join(ROOT, 'public/assets/sprites/player', cls);
  const manifestFile = path.join(dir, 'sprite.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const anim of ['ride', 'ride_board']) {
    const file = path.join(RAW_ROOT, `art_templates/${cls}/raw/${anim}.png`);
    if (!fs.existsSync(file)) {
      console.warn(`missing ${file}`);
      continue;
    }
    const src = key(read(file));
    const grid = cells(src, 5, 2, 0.02, `${cls} ${anim}`);
    // One scale for the sheet, from the front view's first frame.
    const front = grid[0][0];
    const k = RIDE_H[anim] / (front.box[3] - front.box[1]);
    save(layout(src, grid, k, manifest.frameWidth, manifest.frameHeight, 16), path.join(dir, `${anim}.png`));
    manifest.animations[anim] = { file: `${anim}.png`, frames: 2, fps: 4, loop: true };
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
}

// ---- the stylist NPC (art_templates/cosmetics/raw/stylist.png: 3 rows front / side / back × 3 frames), laid out
// like npc/merchant.png (tools/cut_npc.cjs): 208px cells, feet on row 205, body 200px tall.
{
  const file = path.join(RAW_ROOT, 'art_templates/cosmetics/raw/stylist.png');
  if (fs.existsSync(file)) {
    const src = key(read(file));
    const grid = cells(src, 3, 3, 0.02, 'stylist');
    const front = grid[0][0];
    save(layout(src, grid, 200 / (front.box[3] - front.box[1]), null, 208, 2), path.join(ROOT, 'public/assets/sprites/npc/stylist.png'));
  } else console.warn(`missing ${file}`);
}
