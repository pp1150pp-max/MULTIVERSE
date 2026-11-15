// Cuts the raw cash shop pictures (art_templates/cashshop/raw, made from art_templates/cashshop/PROMPTS.md)
// into the game's files: the window and dialog frames, the UI parts, item cards, corner ribbons, the crystal
// icon, the package piles, the featured banner, the menu button, the NPC sheet and its head badge.
// Magenta (#FF00FF) backgrounds (the NPC sheet: green #00FF00) become transparent.
// Usage: node tools/cut_cashshop.cjs   (uses sharp, already installed for the WebP build step)
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = process.env.CASH_RAW || path.join(ROOT, 'art_templates/cashshop/raw');
const OUT = path.join(ROOT, 'public/assets/sprites');

async function read(name) {
  const { data, info } = await sharp(path.join(RAW, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: Buffer.from(data) };
}
const blank = (w, h) => ({ w, h, d: Buffer.alloc(w * h * 4) });
async function save(img, rel) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
  console.log(rel, img.w, img.h);
}

/** The background colour becomes transparent, its fringe is pulled back, and stray specks are dropped. */
function key(img, bg = 'magenta', minSpeck = 60) {
  const { w, h, d } = img;
  for (let i = 0; i < w * h * 4; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    if (bg === 'magenta') {
      const low = Math.min(r, b) - g;
      if (low > 70 && Math.abs(r - b) < 90) d[i + 3] = 0;
      else {
        d[i + 3] = 255;
        if (low > 25 && Math.abs(r - b) < 60) {
          d[i] = Math.min(r, g + 22);
          d[i + 2] = Math.min(b, g + 22);
        }
      }
    } else {
      const over = g - Math.max(r, b);
      if (over > 70) d[i + 3] = 0;
      else {
        d[i + 3] = 255;
        if (over > 20) d[i + 1] = Math.max(r, b) + 10;
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

/** Box-filter a region down to dw x dh. Cells less than half covered stay transparent, so edges stay crisp. */
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

/** A region scaled by k (keeping its shape). */
const scaled = (img, b, k) => resample(img, b, Math.max(1, Math.round((b[2] - b[0]) * k)), Math.max(1, Math.round((b[3] - b[1]) * k)));

/** Fit a region inside size x size (keeping its shape) and centre it. */
function fit(img, b, size) {
  const k = size / Math.max(b[2] - b[0], b[3] - b[1]);
  const part = scaled(img, b, k);
  const out = blank(size, size);
  paste(out, part, Math.round((size - part.w) / 2), Math.round((size - part.h) / 2));
  return out;
}

/** The bounding boxes of a cols x rows grid of parts. */
function cells(img, cols, rows) {
  const cw = img.w / cols, ch = img.h / rows;
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.push(bbox(img, [Math.round(c * cw), Math.round(r * ch), Math.round((c + 1) * cw), Math.round((r + 1) * ch)]));
  return out;
}

/** NPC sheet like npc/merchant.png from the first (idle) picture of each row: front / side (left) / back, 3 frames by squashing. */
const CELL_H = 208, FEET = 205, BODY = 200;
const FRAMES = [[1, 1], [1.04, 0.95], [0.97, 1.03]];
function npcSheet(img) {
  const third = img.h / 3;
  const views = [0, 1, 2].map((r) => bbox(img, [0, Math.round(r * third), Math.round(img.w / 3), Math.round((r + 1) * third)]));
  const s = BODY / Math.max(...views.map((b) => b[3] - b[1]));
  const sizes = views.map((b) => FRAMES.map(([fw, fh]) => [Math.round((b[2] - b[0]) * s * fw), Math.round((b[3] - b[1]) * s * fh)]));
  const cellW = Math.max(...sizes.flat().map(([w]) => w)) + 8;
  const sheet = blank(cellW * 3, CELL_H * 3);
  views.forEach((b, row) =>
    sizes[row].forEach(([w, h], col) => paste(sheet, resample(img, b, w, h), col * cellW + Math.round((cellW - w) / 2), row * CELL_H + FEET + 1 - h)));
  return sheet;
}

(async () => {
  // Window and dialog frames: whole, at half size (CSS border-image slices them).
  for (const [raw, out] of [['shop_frame.png', 'ui/cash_frame.png'], ['dialog_frame.png', 'ui/cash_dialog.png']]) {
    const img = key(await read(raw));
    await save(scaled(img, bbox(img), 0.5), out);
  }
  // UI parts, 4 x 3, at half size.
  {
    const img = key(await read('shop_kit.png'));
    const names = ['tab', 'tab_on', 'side', 'side_on', 'plus', 'balance', 'btn_main', 'btn', 'price', 'well', 'divider', 'check'];
    const boxes = cells(img, 4, 3);
    for (const [i, n] of names.entries()) await save(scaled(img, boxes[i], 0.5), `ui/cash_${n}.png`);
  }
  // Item cards: normal and special, 240 wide.
  {
    const img = key(await read('shop_cards.png'));
    const [a, b] = cells(img, 2, 1);
    await save(scaled(img, a, 240 / (a[2] - a[0])), 'ui/cash_card.png');
    await save(scaled(img, b, 240 / (b[2] - b[0])), 'ui/cash_card_hi.png');
  }
  // Corner ribbons, 96 wide.
  {
    const img = key(await read('shop_ribbons.png'));
    const boxes = cells(img, 3, 1);
    for (const [i, n] of ['new', 'hot', 'sale'].entries()) await save(scaled(img, boxes[i], 96 / (boxes[i][2] - boxes[i][0])), `ui/cash_ribbon_${n}.png`);
  }
  // The crystal icon and the package piles.
  {
    const img = key(await read('crystal.png'));
    await save(fit(img, bbox(img), 96), 'ui/crystal.png');
    const packs = key(await read('crystal_packs.png'));
    const boxes = cells(packs, 4, 1);
    for (const [i, b] of boxes.entries()) await save(fit(packs, b, 128), `ui/cash_pack_${i + 1}.png`);
  }
  // The featured banner (no background to key), at half size.
  {
    const img = await read('banner_featured.png');
    for (let i = 3; i < img.d.length; i += 4) img.d[i] = 255;
    await save(resample(img, [0, 0, img.w, img.h], Math.round(img.w / 2), Math.round(img.h / 2)), 'ui/cash_banner.png');
  }
  // The round menu button (96 x 96 like the other ico_*.png) and the NPC head badge (128 like npc_shop.png).
  {
    const img = key(await read('ico_cashshop.png'));
    await save(fit(img, bbox(img), 96), 'ui/ico_cashshop.png');
    const badge = key(await read('npc_cash.png'));
    await save(fit(badge, bbox(badge), 128), 'icons/npc_cash.png');
  }
  // The NPC sheet.
  await save(npcSheet(key(await read('crystal_merchant.png'), 'green', 120)), 'npc/crystal_merchant.png');
})();
