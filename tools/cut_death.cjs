// Cuts a class's death animation from two raw ChatGPT images into player/<class>/death.png (one row, side view):
//   raw/death.png      one row of side-view frames; the first `rowFrames` figures are used (hit, airborne, crash)
//   raw/death_end.png  the final knocked-out pose seen from above (edited out of the crater scene), used last
// Usage: PNGJS=<path to pngjs> RAW=<raw folder> [DROP_WEAPON=1] node tools/cut_death.cjs <class> <magenta|green> <rowScale> <endScale> [rowFrames]
// DROP_WEAPON=1: the weapon already lies on the ground under the first two frames (mage, gunslinger). It is left out of
// them, so their feet can stand on the feet line; the lying frames keep it and rest on its lowest point instead.
// The game hides anything below the feet line (the ground covers it), so nothing may hang below it.
// rowScale matches the class's other animations (figure about 200px tall standing); endScale matches the final pose
// to the same body size (compare head widths). One scale per image, never per frame.
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const [cls, keyName, rowScaleArg, endScaleArg, rowFramesArg] = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const RAW = process.env.RAW || path.join(ROOT, 'art_templates', cls, 'raw');
const OUT = path.join(ROOT, 'public/assets/sprites/player', cls, 'death.png');
const CELL = 320; // wider than the usual 256: the body lies across the cell
const FEET_Y = CELL - 16;
const rowScale = Number(rowScaleArg);
const endScale = Number(endScaleArg);
const rowFrames = Number(rowFramesArg || 3);

const isKey =
  keyName === 'green'
    ? (d, i) => d[i + 1] - Math.max(d[i], d[i + 2]) > 60
    : (d, i) => Math.min(d[i], d[i + 2]) - d[i + 1] > 55 && Math.abs(d[i] - d[i + 2]) < 100;

function read(name) {
  const p = PNG.sync.read(fs.readFileSync(path.join(RAW, name)));
  const solid = new Uint8Array(p.width * p.height);
  for (let i = 0; i < solid.length; i++) solid[i] = p.data[i * 4 + 3] > 127 && !isKey(p.data, i * 4) ? 1 : 0;
  return { w: p.width, h: p.height, d: p.data, solid };
}

/** Figures in a row = runs of columns with solid pixels, ignoring thin specks. */
function columnGroups(img) {
  const groups = [];
  let start = -1;
  for (let x = 0; x <= img.w; x++) {
    let n = 0;
    if (x < img.w) for (let y = 0; y < img.h; y++) n += img.solid[y * img.w + x];
    if (n > 2 && start < 0) start = x;
    if (n <= 2 && start >= 0) {
      if (x - start > 20) groups.push([start, x - 1]);
      start = -1;
    }
  }
  return groups;
}

function bounds(img, x0, x1) {
  let top = Infinity, bottom = -1, sx = 0, n = 0;
  for (let y = 0; y < img.h; y++)
    for (let x = x0; x <= x1; x++)
      if (img.solid[y * img.w + x]) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        sx += x;
        n++;
      }
  return { top, bottom, cx: sx / n };
}

/**
 * Area-averaged copy of src[x0..x1] at scale k into cell `frame` of dst, the source point (ax, ay) landing on
 * (CELL * frame + CELL / 2, FEET_Y). Pixels end fully opaque or clear, as the game's alphaTest wants.
 */
function blit(dst, src, x0, x1, k, ax, ay, frame) {
  const inv = 1 / k;
  for (let oy = 0; oy < CELL; oy++)
    for (let ox = 0; ox < CELL; ox++) {
      const sx0 = ax + (ox - CELL / 2) * inv;
      const sy0 = ay + (oy - FEET_Y) * inv;
      let r = 0, g = 0, b = 0, n = 0, all = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy0 + inv); yy++)
        for (let xx = Math.floor(sx0); xx < Math.ceil(sx0 + inv); xx++) {
          if (xx < x0 || xx > x1 || yy < 0 || yy >= src.h) continue;
          all++;
          const i = yy * src.w + xx;
          if (!src.solid[i]) continue;
          r += src.d[i * 4];
          g += src.d[i * 4 + 1];
          b += src.d[i * 4 + 2];
          n++;
        }
      if (!n || n * 2 < all) continue;
      const o = (oy * dst.width + frame * CELL + ox) * 4;
      dst.data[o] = r / n;
      dst.data[o + 1] = g / n;
      dst.data[o + 2] = b / n;
      dst.data[o + 3] = 255;
    }
}

/** Keeps only the biggest connected blob of solid pixels in [x0..x1] (drops a separate weapon). */
function keepLargest(img, x0, x1) {
  const seen = new Int32Array(img.w * img.h).fill(-1);
  const sizes = [];
  for (let y = 0; y < img.h; y++)
    for (let x = x0; x <= x1; x++) {
      const start = y * img.w + x;
      if (!img.solid[start] || seen[start] >= 0) continue;
      const id = sizes.length;
      let n = 0;
      const stack = [start];
      seen[start] = id;
      while (stack.length) {
        const i = stack.pop();
        n++;
        const px = i % img.w, py = (i - px) / img.w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = px + dx, ny = py + dy;
          if (nx < x0 || nx > x1 || ny < 0 || ny >= img.h) continue;
          const j = ny * img.w + nx;
          if (img.solid[j] && seen[j] < 0) {
            seen[j] = id;
            stack.push(j);
          }
        }
      }
      sizes.push(n);
    }
  const big = sizes.indexOf(Math.max(...sizes));
  for (let y = 0; y < img.h; y++) for (let x = x0; x <= x1; x++) if (seen[y * img.w + x] !== big) img.solid[y * img.w + x] = 0;
}

const row = read('death.png');
const end = read('death_end.png');
const groups = columnGroups(row).slice(0, rowFrames);
if (groups.length < rowFrames) throw new Error(`found only ${groups.length} figures in death.png`);
const out = new PNG({ width: CELL * (rowFrames + 1), height: CELL });
const drop = process.env.DROP_WEAPON === '1';
if (drop) for (const [a, b] of groups.slice(0, 2)) keepLargest(row, a, b);
// Row frames share one ground line (the first frame's feet), so the airborne frame really floats. With the weapon on
// the ground, a lying frame rests on its own lowest point (the weapon) instead.
const rowGround = drop ? bounds(row, ...groups[0]).bottom : Math.max(...groups.map(([a, b]) => bounds(row, a, b).bottom));
groups.forEach(([a, b], f) => {
  const g = bounds(row, a, b);
  blit(out, row, a, b, rowScale, g.cx, drop && f >= 2 ? g.bottom : rowGround, f);
});
const [ea, eb] = columnGroups(end).reduce(([a, b], [c, d]) => [Math.min(a, c), Math.max(b, d)], [Infinity, -1]);
const e = bounds(end, ea, eb);
blit(out, end, ea, eb, endScale, e.cx, e.bottom, rowFrames);
fs.writeFileSync(OUT, PNG.sync.write(out, { colorType: 6 }));
// The game centres the crater on the lying body, which stands this many pixels above the feet line.
console.log(`${OUT}: ${out.width}x${out.height}, final pose ${((e.bottom - e.top) * endScale).toFixed(0)}px tall`);
