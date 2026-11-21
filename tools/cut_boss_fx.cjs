// Cuts the boss skill effect sheets (art_templates/papercraft_fx/BOSS_FX.md) from
// art_templates/papercraft_fx/raw/boss_<name>.png (6 frames across on magenta, a row per effect) into
// public/assets/sprites/paper/fx/boss_<name>.png: 256-px cells, background transparent (the game cuts frames by equal
// cells, SHEET_ROWS in src/client/effects.ts).
// The witch's lantern swipe came with her lantern and its stick drawn in frames 1-4; the game draws the swipe next to
// her own lantern, so those are erased here (owner 2026-11-21).
//   node tools/cut_boss_fx.cjs [bear witch yeti heart]
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'art_templates/papercraft_fx/raw');
const OUT = path.join(ROOT, 'public/assets/sprites/paper/fx');
const COLS = 6;
const CELL = 256;
const SHEETS = { bear: 3, witch: 3, yeti: 4, heart: 5 };

/** Witch row 0: per frame, the lantern's columns (as a share of the raw sheet's width) and where its body starts (share of the row). */
const LANTERN = [[0.031, 0.073], [0.186, 0.234], [0.338, 0.386], [0.507, 0.555]];
const LANTERN_TOP = 0.6;
const STICK_TOP = 0.4;

const magentaness = (r, g, b) => (Math.abs(r - b) < 90 ? Math.min(r, b) - g : 0);

async function cut(name, rows) {
  const { data: d, info } = await sharp(path.join(RAW, `boss_${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  for (let i = 0; i < d.length; i += 4) {
    const m = magentaness(d[i], d[i + 1], d[i + 2]);
    if (m > 120) d[i + 3] = 0;
    else if (m > 60) {
      // Soft edge: fade out, and take the magenta cast off the colour.
      d[i + 3] = Math.round((255 * (120 - m)) / 60);
      d[i] = Math.min(d[i], d[i + 1] + 120);
      d[i + 2] = Math.min(d[i + 2], d[i + 1] + 60);
    }
  }
  if (name === 'witch') {
    const rowH = h / rows;
    for (const [a, b] of LANTERN) {
      const x0 = Math.round(a * w), x1 = Math.round(b * w);
      for (let y = 0; y < rowH; y++) for (let x = x0; x <= x1 + 40 && x < w; x++) {
        const i = (y * w + x) * 4;
        // The stick: anything not green in the band it crosses (the flame is green; the gold sparkles are higher up).
        const stick = y > STICK_TOP * rowH && y < LANTERN_TOP * rowH + 10 && d[i + 1] < d[i] + 10;
        if ((x <= x1 && y > LANTERN_TOP * rowH) || stick) d[i + 3] = 0;
      }
    }
  }
  const src = sharp(d, { raw: { width: w, height: h, channels: 4 } });
  const buf = await src.png().toBuffer();
  const cw = w / COLS, ch = h / rows;
  const parts = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    const left = Math.round(c * cw), top = Math.round(r * ch);
    const cell = await sharp(buf)
      .extract({ left, top, width: Math.min(w - left, Math.round(cw)), height: Math.min(h - top, Math.round(ch)) })
      .resize(CELL, CELL, { fit: 'fill' })
      .png()
      .toBuffer();
    parts.push({ input: cell, left: c * CELL, top: r * CELL });
  }
  const out = path.join(OUT, `boss_${name}.png`);
  await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`${out}: ${rows} rows`);
}

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHEETS);
  for (const n of names) await cut(n, SHEETS[n]);
})();
