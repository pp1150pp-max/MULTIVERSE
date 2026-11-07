// Cuts the raw ChatGPT pictures of the warehouse keeper and the market broker (art_templates/market/raw)
// into the game's files: NPC sheets, their badge and map icons, and the market booth.
// Usage: PNGJS=<path to pngjs> NPC_RAW=<raw folder, if not the default> node tools/cut_npc.cjs
const path = require('path');
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');

const ROOT = path.join(__dirname, '..');
const RAW = process.env.NPC_RAW || path.join(ROOT, 'art_templates/market/raw');
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
  fs.writeFileSync(path.join(OUT, rel), PNG.sync.write(p, { colorType: 6 }));
  console.log(rel, img.w, img.h);
}

/** Magenta becomes transparent, a purple fringe is pulled back, and stray specks are dropped. */
function key(img, minSpeck = 60) {
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

/** Bounding box [x0, y0, x1, y1) of the opaque pixels inside a region. */
function bbox(img, [rx0, ry0, rx1, ry1] = [0, 0, img.w, img.h]) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = ry0; y < ry1; y++)
    for (let x = rx0; x < rx1; x++)
      if (img.d[(y * img.w + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return [x0, y0, x1 + 1, y1 + 1];
}

/** Box-filter a source region down to dw x dh. Cells less than half covered stay transparent, so edges stay crisp. */
function resample(img, [x0, y0, x1, y1], dw, dh) {
  const out = blank(dw, dh);
  const sw = x1 - x0, sh = y1 - y0;
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, a = 0, t = 0;
      const v0 = Math.floor(y0 + (y * sh) / dh), v1 = Math.max(v0 + 1, Math.ceil(y0 + ((y + 1) * sh) / dh));
      const u0 = Math.floor(x0 + (x * sw) / dw), u1 = Math.max(u0 + 1, Math.ceil(x0 + ((x + 1) * sw) / dw));
      for (let v = v0; v < v1; v++)
        for (let u = u0; u < u1; u++) {
          t++;
          const i = (v * img.w + u) * 4;
          if (!img.d[i + 3]) continue;
          r += img.d[i];
          g += img.d[i + 1];
          b += img.d[i + 2];
          a++;
        }
      if (!a || a / t < 0.5) continue;
      const o = (y * dw + x) * 4;
      out.d[o] = r / a;
      out.d[o + 1] = g / a;
      out.d[o + 2] = b / a;
      out.d[o + 3] = 255;
    }
  return out;
}

function paste(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
      const s = (y * src.w + x) * 4;
      if (!src.d[s + 3]) continue;
      src.d.copy(dst.d, (Y * dst.w + X) * 4, s, s + 4);
    }
}

/**
 * NPC sheet like npc/merchant.png: rows front / side (facing left) / back, 3 frames across made by
 * squashing and stretching one picture. Cells are 208 tall with the feet on y = 205, the body ~200 tall.
 */
const CELL_H = 208, FEET = 205, BODY = 200;
const FRAMES = [[1, 1], [1.04, 0.95], [0.97, 1.03]]; // [width, height] factor per frame
function npcSheet(rawName, outName) {
  const img = key(read(rawName));
  const third = img.w / 3;
  const views = [0, 1, 2].map((i) => bbox(img, [Math.round(i * third), 0, Math.round((i + 1) * third), img.h]));
  const s = BODY / Math.max(...views.map((b) => b[3] - b[1]));
  const sizes = views.map((b) => FRAMES.map(([fw, fh]) => [Math.round((b[2] - b[0]) * s * fw), Math.round((b[3] - b[1]) * s * fh)]));
  const cellW = Math.max(...sizes.flat().map(([w]) => w)) + 8;
  const sheet = blank(cellW * 3, CELL_H * 3);
  views.forEach((b, row) =>
    sizes[row].forEach(([w, h], col) => {
      const f = resample(img, b, w, h);
      paste(sheet, f, col * cellW + Math.round((cellW - w) / 2), row * CELL_H + FEET + 1 - h);
    }),
  );
  save(sheet, `npc/${outName}.png`);
}

/** Fit a region inside size x size (keeping its shape) and centre it. `stretch` fills the square exactly. */
function icon(img, b, size, rel, stretch = false) {
  const bw = b[2] - b[0], bh = b[3] - b[1];
  const k = size / Math.max(bw, bh);
  const w = stretch ? size : Math.round(bw * k), h = stretch ? size : Math.round(bh * k);
  const out = blank(size, size);
  paste(out, resample(img, b, w, h), Math.round((size - w) / 2), Math.round((size - h) / 2));
  save(out, rel);
}

npcSheet('keeper.png', 'keeper');
npcSheet('broker.png', 'broker');

// icons.png: 2 x 2 — top row NPC badges, bottom row map markers.
{
  const img = key(read('icons.png'));
  const hw = img.w / 2, hh = img.h / 2;
  const cell = (c, r) => bbox(img, [Math.round(c * hw), Math.round(r * hh), Math.round((c + 1) * hw), Math.round((r + 1) * hh)]);
  icon(img, cell(0, 0), 128, 'icons/npc_stash.png', true);
  icon(img, cell(1, 0), 128, 'icons/npc_market.png', true);
  icon(img, cell(0, 1), 96, 'icons/map_keeper.png');
  icon(img, cell(1, 1), 96, 'icons/map_market.png');
}

// The market booth, at the size of the other town props (longest side 256).
{
  const img = key(read('town_market.png'));
  const b = bbox(img);
  const k = 256 / Math.max(b[2] - b[0], b[3] - b[1]);
  save(resample(img, b, Math.round((b[2] - b[0]) * k), Math.round((b[3] - b[1]) * k)), 'props/town_market.png');
}
