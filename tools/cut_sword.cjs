// Cuts the raw ChatGPT sheets in art_templates/sword/raw into the sword class animation files.
// Usage: PNGJS=<path to pngjs> SWORD_RAW=<raw folder, if not the default> node tools/cut_sword.cjs
// Every sheet gets ONE scale (never per frame) so the knight keeps the same size across animations,
// matched to the gunslinger: figure 200px tall, feet on the line 16px above the cell bottom.
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.join(__dirname, '..');
const RAW = process.env.SWORD_RAW || path.join(ROOT, 'art_templates/sword/raw');
const OUT = path.join(ROOT, 'public/assets/sprites/player/sword');

const CELL = 256;
const ROWS = 5; // down, down_side, side, up_side, up
const FEET_Y = CELL - 16; // first transparent row under the boots
const BODY_H = 200; // same as the gunslinger
const CENTER_X = 128;

function read(name) {
  const p = PNG.sync.read(fs.readFileSync(path.join(RAW, name)));
  return { w: p.width, h: p.height, d: p.data };
}
function blank(w, h) {
  return { w, h, d: Buffer.alloc(w * h * 4) };
}
function save(img, file) {
  const p = new PNG({ width: img.w, height: img.h });
  img.d.copy(p.data);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(p, { colorType: 6 }));
  console.log(file, img.w, img.h);
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
  for (const comp of components(img, 0, 0, w, h, (k) => d[k * 4 + 3])) {
    if (comp.length < minSpeck) for (const k of comp) d[k * 4 + 3] = 0;
  }
  return img;
}

/** 4-connected groups of pixel indices inside a box that pass `on`. */
function components(img, x0, y0, x1, y1, on) {
  const { w } = img;
  const seen = new Uint8Array(img.w * img.h);
  const out = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const s = y * w + x;
      if (seen[s] || !on(s)) continue;
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
          if (!seen[t] && on(t)) {
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

/**
 * Equal split into cells, keeping only the figure in each one. Each cell reaches a little into its
 * neighbours because a raised katana can poke past the split line; bits of a neighbour touch the edge
 * and are dropped.
 */
function cells(img, rows, cols, label) {
  const { w, h, d } = img;
  const out = [];
  const padX = Math.round(w / cols * 0.1);
  const padY = Math.round(h / rows * 0.15);
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const x0 = Math.max(0, Math.round((c * w) / cols) - padX);
      const x1 = Math.min(w, Math.round(((c + 1) * w) / cols) + padX);
      const y0 = Math.max(0, Math.round((r * h) / rows) - padY);
      const y1 = Math.min(h, Math.round(((r + 1) * h) / rows) + Math.round(padY / 3));
      const comps = components(img, x0, y0, x1, y1, (k) => d[k * 4 + 3]).sort((a, b) => b.length - a.length);
      const keep = [];
      comps.forEach((comp, i) => {
        const edge = comp.some((k) => {
          const x = k % w;
          const y = (k - x) / w;
          return x === x0 || x === x1 - 1 || y === y0 || y === y1 - 1;
        });
        if (i === 0) {
          if (edge) console.warn(`${label} r${r} c${c}: figure touches its cell edge`);
          keep.push(comp);
        } else if (!edge && comp.length >= 20) keep.push(comp);
      });
      const mask = new Uint8Array(w * h);
      for (const comp of keep) for (const k of comp) mask[k] = 1;
      row.push(measure(img, mask, [x0, y0, x1, y1]));
    }
    out.push(row);
  }
  return out;
}

/** Glowing katana and gold glow: left out when measuring the body so a raised blade doesn't count. */
function glow(d, i) {
  return d[i] > 190 && d[i + 2] < 130 && d[i] - d[i + 2] > 90;
}

function measure(img, mask, box) {
  const { w, d } = img;
  const [x0, y0, x1, y1] = box;
  let l = x1, t = y1, r = x0, b = y0; // all pixels
  let bt = y1, bb = y0; // body (no glow)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = y * w + x;
      if (!mask[k]) continue;
      if (x < l) l = x;
      if (x >= r) r = x + 1;
      if (y < t) t = y;
      if (y >= b) b = y + 1;
      if (!glow(d, k * 4)) {
        if (y < bt) bt = y;
        if (y >= bb) bb = y + 1;
      }
    }
  }
  // Horizontal anchors: centre of the head band and of the leg band, body pixels only.
  const band = (from, to) => {
    let sx = 0, n = 0;
    for (let y = Math.max(y0, from); y < Math.min(y1, to); y++) {
      for (let x = x0; x < x1; x++) {
        const k = y * w + x;
        if (mask[k] && !glow(d, k * 4)) { sx += x; n++; }
      }
    }
    return n ? sx / n : (l + r) / 2;
  };
  const bh = bb - bt;
  // Width of the hair at the top of the head: the same whatever the pose, so crouching sheets scale by it.
  let hl = x1, hr = x0;
  for (let y = bt; y < bt + bh * 0.15; y++) {
    for (let x = x0; x < x1; x++) {
      const k = y * w + x;
      if (mask[k] && !glow(d, k * 4)) { if (x < hl) hl = x; if (x >= hr) hr = x + 1; }
    }
  }
  return {
    hairW: hr - hl,
    mask, box: [l, t, r, b], bodyTop: bt, feet: bb, bodyH: bh,
    headX: band(bt, bt + bh * 0.4), legX: band(bb - bh * 0.22, bb),
  };
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/** Area-averaged, masked copy of the figure at scale k with its anchor at (ax, ay) in dst. Fully opaque or clear. */
function place(src, fig, k, dst, ax, ay, anchorX, sy = 1, sx = 1) {
  const [x0, y0, x1, y1] = fig.box;
  const kx = k * sx;
  const ky = k * sy;
  const dw = Math.round((x1 - x0) * kx);
  const dh = Math.round((y1 - y0) * ky);
  const dx = Math.round(ax - (anchorX - x0) * kx);
  const dy = Math.round(ay - (fig.feet - y0) * ky);
  let clipped = 0;
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, a = 0, t = 0;
      const u0 = x0 + Math.floor(x / kx);
      const v0 = y0 + Math.floor(y / ky);
      const u1 = Math.max(u0 + 1, Math.ceil(x0 + (x + 1) / kx));
      const v1 = Math.max(v0 + 1, Math.ceil(y0 + (y + 1) / ky));
      for (let v = v0; v < v1 && v < y1; v++) {
        for (let u = u0; u < u1 && u < x1; u++) {
          const i = v * src.w + u;
          t++;
          if (!fig.mask[i]) continue;
          r += src.d[i * 4]; g += src.d[i * 4 + 1]; b += src.d[i * 4 + 2]; a++;
        }
      }
      if (!a || a * 2 < t) continue;
      const px = dx + x;
      const py = dy + y;
      if (px < dst.x0 || py < dst.y0 || px >= dst.x0 + CELL || py >= dst.y0 + CELL) { clipped++; continue; }
      const o = (py * dst.img.w + px) * 4;
      const d = dst.img.d;
      d[o] = r / a; d[o + 1] = g / a; d[o + 2] = b / a; d[o + 3] = 255;
    }
  }
  return clipped;
}

/** Small see-through islands inside the figure (keyed magenta specks on the cape) get the colour around them. */
function fillHoles(img, x0, y0, maxSize = 40) {
  const { w, d } = img;
  const holes = components(img, x0, y0, x0 + CELL, y0 + CELL, (k) => !d[k * 4 + 3]);
  let filled = 0;
  for (const comp of holes) {
    if (comp.length > maxSize) continue;
    const edge = comp.some((k) => {
      const x = k % w;
      const y = (k - x) / w;
      return x === x0 || x === x0 + CELL - 1 || y === y0 || y === y0 + CELL - 1;
    });
    if (edge) continue;
    let left = new Set(comp);
    while (left.size) {
      const next = new Set();
      const done = [];
      for (const k of left) {
        let r = 0, g = 0, b = 0, n = 0;
        for (const t of [k - 1, k + 1, k - w, k + w]) {
          if (d[t * 4 + 3] && !left.has(t)) { r += d[t * 4]; g += d[t * 4 + 1]; b += d[t * 4 + 2]; n++; }
        }
        if (n) done.push([k, r / n, g / n, b / n]);
        else next.add(k);
      }
      if (!done.length) break;
      for (const [k, r, g, b] of done) {
        d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = 255;
      }
      left = next;
    }
    filled++;
  }
  return filled;
}

/**
 * One animation file. `figs` is [row][frame]; `calib(row)` picks the frames of a row whose body
 * height sets that row's scale (katana low). One scale per row, never per frame: ChatGPT sometimes
 * draws one view a little bigger, and a single scale per file would make him grow when he turns.
 * `anchor` is 'head' (idle, run) or 'legs' (planted attacks).
 */
function sheet(file, figs, { calib, scaleOf = null, anchor, keepHop = false, frames = null }) {
  const cols = frames ? frames.length : figs[0].length;
  const out = blank(CELL * cols, CELL * ROWS);
  let clipped = 0, holes = 0;
  const scales = [];
  figs.forEach((row, r) => {
    const k = scaleOf ? scaleOf(row, r) : BODY_H / median(calib(row).map((f) => f.bodyH));
    scales.push(k.toFixed(3));
    const base = Math.max(...row.map((f) => f.feet));
    for (let c = 0; c < cols; c++) {
      const f = frames ? row[frames[c].from] : row[c];
      const [sx, sy] = frames ? frames[c].scale : [1, 1];
      // A small hop stays, capped so the raised katana still fits in the cell.
      const lift = keepHop && base - f.feet > 8 ? Math.min(10, (base - f.feet) * k) : 0;
      const ax = anchor === 'legs' ? f.legX : f.headX;
      const dst = { img: out, x0: c * CELL, y0: r * CELL };
      const n = place(f.img, f, k, dst, c * CELL + CENTER_X, r * CELL + FEET_Y - lift, ax, sy, sx);
      if (n) console.warn(`${file} r${r} c${c}: ${n} px past the cell edge were cut`);
      clipped += n;
      holes += fillHoles(out, c * CELL, r * CELL);
    }
  });
  console.log(`  scales ${scales.join(' ')}, ${clipped} px clipped, ${holes} holes filled`);
  save(out, file);
}

function load(name, rows, cols) {
  const img = key(read(name));
  const figs = cells(img, rows, cols, name);
  for (const row of figs) for (const f of row) f.img = img;
  return figs;
}

// ---- idle: the 5-view design, squashed and stretched a little so he breathes
const design = load('design.png', 1, 5)[0].map((f) => [f]);
sheet('idle.png', design, {
  calib: (row) => row,
  anchor: 'head',
  frames: [
    { from: 0, scale: [1, 1] },
    { from: 0, scale: [1.006, 0.988] },
    { from: 0, scale: [1.012, 0.976] },
    { from: 0, scale: [1.006, 0.988] },
  ],
});

// ---- run: row 4 (up_side) comes from its own fixed sheet
const run = load('run.png', 5, 4);
run[3] = load('run_row4.png', 1, 4)[0];
sheet('run.png', run, { calib: (row) => row, anchor: 'head' });

// ---- attacks: scale from frame 4 (back in the ready stance), anchored on the planted legs
for (const name of ['attack', 'attack_2', 'attack_3']) {
  const figs = load(`${name}.png`, 5, 4);
  sheet(`${name}.png`, figs, { calib: (row) => [row[3]], anchor: 'legs', keepHop: name === 'attack_3' });
}

// ---- parry (skill_e): a crouched guard, so it is scaled to match the idle hair width instead of height
const hairOut = median(design.map(([f]) => f.hairW * (BODY_H / f.bodyH)));
const parry = load('skill_parry.png', 5, 2);
// One scale for the whole sheet: the back view's hair reads narrower and would blow that row up.
const kParry = median(parry.map((row) => hairOut / median(row.map((f) => f.hairW))));
sheet('skill_e.png', parry, { scaleOf: () => kParry, anchor: 'legs' });

// ---- Parry skill icon: the whole square, area-averaged down to the 128px of the other skill icons
{
  const src = read('skill_parry_icon.png');
  const size = 128;
  const out = blank(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u0 = Math.floor((x * src.w) / size), u1 = Math.floor(((x + 1) * src.w) / size);
      const v0 = Math.floor((y * src.h) / size), v1 = Math.floor(((y + 1) * src.h) / size);
      let r = 0, g = 0, b = 0, n = 0;
      for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) {
        const i = (v * src.w + u) * 4;
        r += src.d[i]; g += src.d[i + 1]; b += src.d[i + 2]; n++;
      }
      const o = (y * size + x) * 4;
      out.d[o] = r / n; out.d[o + 1] = g / n; out.d[o + 2] = b / n; out.d[o + 3] = 255;
    }
  }
  const p = new PNG({ width: size, height: size });
  out.d.copy(p.data);
  const file = path.join(ROOT, 'public/assets/sprites/icons/skill_parry.png');
  fs.writeFileSync(file, PNG.sync.write(p, { colorType: 6 }));
  console.log('icons/skill_parry.png', size, size);
}
