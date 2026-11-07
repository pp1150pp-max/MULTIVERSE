// Cuts the raw ChatGPT sheets in art_templates/hub/raw into the hub town's sprite files.
// Usage: PNGJS=<path to pngjs> HUB_RAW=<raw folder, if not the default> node tools/cut_hub.cjs
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.join(__dirname, '..');
const RAW = process.env.HUB_RAW || path.join(ROOT, 'art_templates/hub/raw');
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

// ---- the ruined city: 12 pieces, kept at up to 256 px so the big ones (fountain, house) stay sharp
const p = key(read('ruins.png'));
const NAMES = [
  // The sheet's wall and arch were replaced by the wall kit below (they didn't line up).
  ['ruin_fountain', null, null, null],
  ['ruin_pillar', 'ruin_house', 'ruin_tower', 'ruin_statue'],
  ['ruin_rubble', 'town_stall', 'town_forge', 'town_vault'],
];
grid(p, 3, 4, 'ruins', 8).forEach((row, r) => row.forEach((box, c) => {
  if (!NAMES[r][c]) return;
  const s = fit(p, box, 256, 256, false);
  const out = blank(s.w, s.h);
  blit(p, box, out, 0, 0, s.w, s.h);
  save(out, `props/${NAMES[r][c]}.png`);
}));

// ---- the town's brick: a little quieter than the picture, like the other ground tiles
tile('ground_brick.png', 'ground/brick.png', 0.8, 0.95);

// ---- the town wall kit: one scale for every piece so they match, and each wall and gate sheared so
// its foot runs at the slope a world axis has on screen in this game's camera (0.716, steeper than
// the picture's 2:1), so copies set end to end line up. Uprights stay upright under a vertical shear.
if (fs.existsSync(path.join(RAW, 'walls.png'))) {
  const GROUND_SLOPE = 0.716;
  const SCALE = 0.62;
  const w = key(read('walls.png'));
  const KIT = [
    // The sheet's diagonal gates and corner tower aren't used: the gates are the front-on corner
    // gatehouses (gates.png) instead.
    [['town_wall_a', -1], ['town_wall_a_broken', -1], [null, 0], [null, 0]],
    [['town_wall_b', 1], ['town_wall_b_broken', 1], [null, 0], ['town_wall_end', 0]],
  ];
  grid(w, 2, 4, 'walls', 8).forEach((row, r) => row.forEach((box, c) => {
    const [name, dir] = KIT[r][c];
    if (!name) return;
    const [x0, y0, x1, y1] = box;
    const bw = x1 - x0;
    // Foot line: the lowest solid pixel of each column across the middle of the piece.
    let shear = 0;
    if (dir) {
      const xs = [];
      const ys = [];
      for (let x = Math.round(x0 + bw * 0.2); x < x0 + bw * 0.8; x++) {
        for (let y = y1 - 1; y >= y0; y--) if (w.d[(y * w.w + x) * 4 + 3]) { xs.push(x); ys.push(y); break; }
      }
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let num = 0;
      let den = 0;
      xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
      const slope = num / den;
      shear = dir * GROUND_SLOPE - slope;
      console.log(`${name}: foot slope ${slope.toFixed(3)} → shear ${shear.toFixed(3)}`);
    }
    // Shear a copy of the box, then shrink it.
    const offs = [];
    for (let x = 0; x < bw; x++) offs.push(Math.round(shear * (x - bw / 2)));
    const lo = Math.min(...offs);
    const hi = Math.max(...offs);
    const sheared = blank(bw, y1 - y0 + hi - lo);
    for (let x = 0; x < bw; x++) {
      for (let y = y0; y < y1; y++) {
        const i = (y * w.w + x0 + x) * 4;
        if (!w.d[i + 3]) continue;
        w.d.copy(sheared.d, ((y - y0 + offs[x] - lo) * bw + x) * 4, i, i + 4);
      }
    }
    const out = blank(Math.round(sheared.w * SCALE), Math.round(sheared.h * SCALE));
    blit(sheared, [0, 0, sheared.w, sheared.h], out, 0, 0, out.w, out.h);
    save(out, `props/${name}.png`);
  }));
}

