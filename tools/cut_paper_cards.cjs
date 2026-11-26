// Cuts the papercraft card pictures (art_templates/papercraft_cards/PROMPTS.md) into the game.
//   node tools/cut_paper_cards.cjs [raw folder]
// raw folder (default art_templates/papercraft_cards/raw, not committed): card_frame_<rarity>.png + card_art_<monster>.png, 1024×1536.
// Out: public/assets/sprites/paper/cards/ — frames 512×768 WebP with the flat magenta windows cut to transparent,
// monster art 512×768 WebP (full picture with its own background). Prints each frame's windows as fractions of the
// frame (the thin frames since 2026-11-25 have one window, the whole middle; nothing reads these numbers now).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = path.resolve(process.argv[2] || path.join(ROOT, 'art_templates/papercraft_cards/raw'));
const OUT = path.join(ROOT, 'public/assets/sprites/paper/cards');
const W = 512;
const H = 768;

/** How magenta a pixel is: 0 = not at all, 1 = the flat #FF00FF of the windows. */
function magenta(r, g, b) {
  const s = Math.min(r, b) - g;
  return Math.max(0, Math.min(1, (s - 70) / 110));
}

async function cutFrame(file, name) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const m = magenta(r, g, b);
    if (m >= 1) solid[i] = 1;
    if (m > 0) {
      data[i * 4 + 3] = Math.round(255 * (1 - m));
      // Take the pink cast off the soft edge.
      data[i * 4] = Math.min(r, g + 40);
      data[i * 4 + 2] = Math.min(b, g + 40);
    }
  }
  // The windows: big solid-magenta areas, as fractions of the frame.
  const seen = new Uint8Array(width * height);
  const wins = [];
  for (let i = 0; i < width * height; i++) {
    if (!solid[i] || seen[i]) continue;
    const st = [i];
    seen[i] = 1;
    let n = 0, x0 = width, y0 = height, x1 = 0, y1 = 0;
    while (st.length) {
      const p = st.pop();
      n++;
      const x = p % width, y = (p - x) / width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - width, p + width]) if (q >= 0 && q < width * height && solid[q] && !seen[q]) { seen[q] = 1; st.push(q); }
    }
    if (n > 2000) wins.push({ n, x: x0 / width, y: y0 / height, w: (x1 + 1 - x0) / width, h: (y1 + 1 - y0) / height });
  }
  await sharp(data, { raw: { width, height, channels: 4 } }).resize(W, H).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, name.replace('card_frame_', 'card_frame_thin_').replace(/\.png$/, '.webp')));
  const r4 = (v) => Math.round(v * 10000) / 10000;
  console.log(name, JSON.stringify(wins.sort((a, b) => a.y - b.y).map((w) => ({ x: r4(w.x), y: r4(w.y), w: r4(w.w), h: r4(w.h) }))));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(RAW).filter((f) => /^card_(frame_(rare|epic|legendary)|art_[a-z_]+)\.png$/.test(f));
  for (const f of files) {
    const file = path.join(RAW, f);
    if (f.startsWith('card_frame_')) await cutFrame(file, f);
    else await sharp(file).resize(W, H, { fit: 'cover' }).webp({ quality: 86 }).toFile(path.join(OUT, f.replace(/\.png$/, '.webp')));
  }
  console.log(`${files.length} files → ${path.relative(ROOT, OUT)}`);
})();
