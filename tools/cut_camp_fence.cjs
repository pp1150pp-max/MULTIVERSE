// Cuts the camp fence sheets (art_templates/camp_fence/raw/fence_<theme>.png, 2 x 2: a, a_broken / b, end)
// into props/fence_<theme>_*.png and writes where their posts are to src/shared/data/campFence.ts.
// Like the town wall kit (cut_hub.cjs) each fence is sheared so its line runs at the slope a world axis
// has on screen (0.716), so copies set end to end along that axis stand post on post.
// Usage: PNGJS=<path to pngjs> CAMP_FENCE_RAW=<raw folder, if not the default> node tools/cut_camp_fence.cjs
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.join(__dirname, '..');
const RAW = process.env.CAMP_FENCE_RAW || path.join(ROOT, 'art_templates/camp_fence/raw');
const OUT = path.join(ROOT, 'public/assets/sprites/props');
const THEMES = ['forest', 'marsh', 'snow', 'volcano'];
/** Screen slope of a world axis in this game's camera (see cut_hub.cjs). */
const GROUND_SLOPE = 0.716;
/** World units per pixel of a cut picture. */
const U = 1.3 / 96;
/**
 * Each theme is scaled so its straight fence is this long from first post to last: five pieces then make a
 * side of 18, which fits between the camp's props and the trees at the map's edge (Terrain.placeCampFence).
 */
const PIECE_LEN = 3.6;
/** One world unit along an axis is this long across / down the screen (the camera's 45° turn and its tilt). */
const ACROSS = Math.SQRT1_2;
const DOWN = 0.5062;
/** Sprites are anchored this far up from their bottom edge (world.ts: spr.center). */
const ANCHOR_UP = 0.03;

function read(file) {
  const p = PNG.sync.read(fs.readFileSync(file));
  return { w: p.width, h: p.height, d: p.data };
}
const blank = (w, h) => ({ w, h, d: Buffer.alloc(w * h * 4) });
const solid = (img, x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.d[(y * img.w + x) * 4 + 3] > 0;

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

function bands(has, size, gap, want, label) {
  const out = [];
  let start = -1;
  let empty = 0;
  for (let i = 0; i < size; i++) {
    if (has(i)) {
      if (start < 0) start = i;
      empty = 0;
    } else if (start >= 0 && ++empty >= gap) {
      out.push([start, i - empty + 1]);
      start = -1;
    }
  }
  if (start >= 0) out.push([start, size]);
  if (out.length !== want) throw new Error(`${label}: found ${out.length} bands, wanted ${want}: ${JSON.stringify(out)}`);
  return out;
}

function tight(img, [x0, y0, x1, y1]) {
  let a = x1, b = y1, c = x0, e = y0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!solid(img, x, y)) continue;
      a = Math.min(a, x); c = Math.max(c, x + 1); b = Math.min(b, y); e = Math.max(e, y + 1);
    }
  }
  return [a, b, c, e];
}

/** Boxes by row: the sheet split on empty lines (a 2 x 2 grid). */
function grid(img, label) {
  const rows = bands((y) => { for (let x = 0; x < img.w; x++) if (solid(img, x, y)) return true; return false; }, img.h, 8, 2, `${label} rows`);
  return rows.map(([y0, y1]) => bands((x) => { for (let y = y0; y < y1; y++) if (solid(img, x, y)) return true; return false; }, img.w, 8, 2, `${label} cols`)
    .map(([x0, x1]) => tight(img, [x0, y0, x1, y1])));
}

/** Area-averaged copy at an exact size; fully opaque or clear, like the rest of the game's art. */
function blit(src, [x0, y0, x1, y1], dst, dw, dh) {
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
      const o = (y * dst.w + x) * 4;
      dst.d[o] = r / a; dst.d[o + 1] = g / a; dst.d[o + 2] = b / a; dst.d[o + 3] = 255;
    }
  }
}

function save(img, name) {
  const p = new PNG({ width: img.w, height: img.h });
  img.d.copy(p.data);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), PNG.sync.write(p, { colorType: 6 }));
}

/** The top of the post in a band of columns: its highest pixel row, and the middle of what is solid there. */
function postTop(img, box, from, to) {
  const [x0, y0, , y1] = box;
  let top = y1;
  for (let x = from; x < to; x++) for (let y = y0; y < top; y++) if (solid(img, x, y)) { top = y; break; }
  const xs = [];
  for (let x = from; x < to; x++) for (let y = top; y <= top + 4; y++) if (solid(img, x, y)) { xs.push(x); break; }
  return { x: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), y: top };
}
/** The foot of the post standing at column x: the lowest solid pixel in the columns around it. */
function postFoot(img, box, x) {
  let foot = box[1];
  for (let c = x - 3; c <= x + 3; c++) for (let y = box[3] - 1; y > foot; y--) if (solid(img, c, y)) { foot = y; break; }
  return foot;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const data = {};
for (const theme of THEMES) {
  const file = path.join(RAW, `fence_${theme}.png`);
  if (!fs.existsSync(file)) {
    console.log(`fence_${theme}.png: no picture, skipped (that map gets no fence)`);
    continue;
  }
  const img = key(read(file));
  const boxes = grid(img, theme);
  const kit = [[['a', -1], ['a_broken', -1]], [['b', 1], ['end', 0]]];
  // One scale for the theme: its straight fence comes out PIECE_LEN long.
  const a = boxes[0][0];
  const aw = a[2] - a[0];
  const aL = postTop(img, a, a[0], a[0] + Math.round(aw * 0.14));
  const aR = postTop(img, a, a[2] - Math.round(aw * 0.14), a[2]);
  const k = (PIECE_LEN * ACROSS) / ((aR.x - aL.x) * U);
  const out = {};
  kit.forEach((row, ri) => row.forEach(([part, dir], ci) => {
    const [x0, y0, x1, y1] = boxes[ri][ci];
    const bw = x1 - x0;
    let shear = 0;
    let L = null;
    let R = null;
    if (dir) {
      L = postTop(img, boxes[ri][ci], x0, x0 + Math.round(bw * 0.14));
      R = postTop(img, boxes[ri][ci], x1 - Math.round(bw * 0.14), x1);
      shear = dir * GROUND_SLOPE - (R.y - L.y) / (R.x - L.x);
    }
    const offs = [];
    for (let x = 0; x < bw; x++) offs.push(Math.round(shear * (x - bw / 2)));
    const lo = Math.min(...offs);
    const hi = Math.max(...offs);
    const sheared = blank(bw, y1 - y0 + hi - lo);
    for (let x = 0; x < bw; x++) {
      for (let y = y0; y < y1; y++) {
        const i = (y * img.w + x0 + x) * 4;
        if (img.d[i + 3]) img.d.copy(sheared.d, ((y - y0 + offs[x] - lo) * bw + x) * 4, i, i + 4);
      }
    }
    const pic = blank(Math.round(sheared.w * k), Math.round(sheared.h * k));
    blit(sheared, [0, 0, sheared.w, sheared.h], pic, pic.w, pic.h);
    save(pic, `fence_${theme}_${part}.png`);
    const entry = { h: r3(pic.h * U) };
    if (dir) {
      // The left post's foot in the cut picture, and from it the right post's and the anchor's.
      const lx = L.x - x0;
      const footL = { x: lx * k, y: (postFoot(img, boxes[ri][ci], L.x) - y0 + offs[lx] - lo) * k };
      const across = (R.x - L.x) * k * U;
      // Anchor (bottom middle) relative to the left foot, on screen, then on the ground.
      const sx = (pic.w / 2 - footL.x) * U;
      const sy = (pic.h * (1 - ANCHOR_UP) - footL.y) * U;
      const p = sx / ACROSS;
      const q = sy / DOWN;
      entry.len = r3(across / ACROSS);
      entry.ax = r3((p + q) / 2);
      entry.az = r3((q - p) / 2);
      console.log(`fence_${theme}_${part}: ${pic.w}x${pic.h}, shear ${shear.toFixed(3)}, length ${entry.len}`);
    } else console.log(`fence_${theme}_${part}: ${pic.w}x${pic.h}`);
    out[part] = entry;
  }));
  data[theme] = out;
}

const ts = `// Generated by tools/cut_camp_fence.cjs from art_templates/camp_fence/raw: don't edit by hand.
// Each camp fence piece in world units: h = picture height; for the long pieces, len = from its first
// post to its last, and (ax, az) = where its anchor (the picture's bottom middle) stands relative to the
// first post's foot (the left one on screen). Pieces of type a run along -z from that post, b along +x.
import type { ZoneTheme } from './zones';

export interface FenceRun { h: number; len: number; ax: number; az: number }
export interface FenceKit { a: FenceRun; a_broken: FenceRun; b: FenceRun; end: { h: number } }

export const CAMP_FENCE: Partial<Record<ZoneTheme, FenceKit>> = ${JSON.stringify(data, null, 2).replace(/"(\w+)":/g, '$1:')};
`;
fs.writeFileSync(path.join(ROOT, 'src/shared/data/campFence.ts'), ts);
console.log('wrote src/shared/data/campFence.ts');
