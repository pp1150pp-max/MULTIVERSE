// Papercraft UI (art_templates/papercraft_ui/UI.md). Two jobs:
//   node tools/cut_paper_ui.cjs ref   → art_templates/papercraft_ui/raw/ref/<sheet>_old.png: the old pieces laid out
//                                       on the sheet's background, the picture ChatGPT redraws in papercraft
//   node tools/cut_paper_ui.cjs [sheet …] → cuts art_templates/papercraft_ui/raw/<sheet>.png into
//                                       public/assets/sprites/paper/ui/, every piece at its old file's exact size
// Whole pictures (portraits, loading screens, the cash-shop banner) are only resized.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const UI = path.join(ROOT, 'public/assets/sprites/ui');
const RAW = path.join(ROOT, 'art_templates/papercraft_ui/raw');
const OUT = path.join(ROOT, 'public/assets/sprites/paper/ui');
const BG = { magenta: [255, 0, 255], green: [0, 255, 0], cyan: [0, 255, 255] };

/** Sheets: rows of piece names (files under sprites/ui/), and the background they're drawn on. */
const SHEETS = {
  hud: { bg: 'magenta', rows: [['skillbar'], ['expbar'], ['bar_frame'], ['orb_cradle', 'corner', 'close']] },
  bars: { bg: 'magenta', rows: [['bar_hp'], ['bar_mp'], ['orb_hp_liquid', 'orb_hp_wave'], ['orb_mp_liquid', 'orb_mp_wave']] },
  icons: {
    bg: 'magenta',
    rows: [['ico_auto', 'ico_autoset', 'ico_bag', 'ico_blank'], ['ico_cashshop', 'ico_daily', 'ico_friends', 'ico_help'],
      ['ico_map', 'ico_menu', 'ico_settings', 'crystal'], ['cash_pack_1', 'cash_pack_2', 'cash_pack_3', 'cash_pack_4']],
  },
  // Purple glows on some of these: drawn on green.
  cash_frames: {
    bg: 'green',
    rows: [['cash_frame', 'cash_dialog'], ['cash_card', 'cash_card_hi', 'cash_well', 'cash_check', 'cash_plus'],
      ['cash_btn', 'cash_btn_main', 'cash_balance', 'cash_price'], ['cash_tab', 'cash_tab_on', 'cash_side', 'cash_side_on', 'cash_divider']],
  },
  // A red, a green and a purple ribbon: drawn on cyan.
  ribbons: { bg: 'cyan', rows: [['cash_ribbon_hot', 'cash_ribbon_new', 'cash_ribbon_sale']] },
  touch: { bg: 'magenta', rows: [['touch/btn_attack', 'touch/stick_base'], ['touch/btn_skill', 'touch/stick_knob'], ['touch/icon_chat', 'touch/icon_dash', 'touch/icon_mount', 'touch/icon_talk']] },
  inventory: { bg: 'magenta', rows: [['inventory']] },
};
/** Whole pictures: raw file → old file. */
const WHOLE = {
  portrait_sword: 'portrait_sword.png', portrait_mage: 'portrait_mage.png', portrait_gunslinger: 'portrait_gunslinger.png',
  cash_banner: 'cash_banner.png',
  loading_sword: 'loading/sword.webp', loading_mage: 'loading/mage.webp', loading_gunslinger: 'loading/gunslinger.webp',
  loading_portal_1: 'loading/portal_1.webp', loading_portal_2: 'loading/portal_2.webp',
};

const file = (name) => path.join(UI, `${name}.png`);
const size = async (f) => { const m = await sharp(f).metadata(); return [m.width, m.height]; };

/** The old pieces on the sheet's background, rows apart, pieces in a row apart. */
async function ref(name, sheet) {
  const GAP = 60;
  const rows = [];
  for (const row of sheet.rows) rows.push(await Promise.all(row.map(async (n) => ({ n, s: await size(file(n)) }))));
  const W = Math.max(...rows.map((r) => r.reduce((t, p) => t + p.s[0], 0) + GAP * (r.length + 1)));
  const H = rows.reduce((t, r) => t + Math.max(...r.map((p) => p.s[1])), 0) + GAP * (rows.length + 1);
  const layers = [];
  let y = GAP;
  for (const r of rows) {
    const rh = Math.max(...r.map((p) => p.s[1]));
    const free = (W - r.reduce((t, p) => t + p.s[0], 0)) / (r.length + 1);
    let x = free;
    for (const p of r) {
      layers.push({ input: file(p.n), left: Math.round(x), top: Math.round(y + (rh - p.s[1]) / 2) });
      x += p.s[0] + free;
    }
    y += rh + GAP;
  }
  const [r, g, b] = BG[sheet.bg];
  fs.mkdirSync(path.join(RAW, 'ref'), { recursive: true });
  await sharp({ create: { width: Math.round(W), height: Math.round(H), channels: 4, background: { r, g, b, alpha: 1 } } })
    .composite(layers).flatten({ background: { r, g, b } }).png().toFile(path.join(RAW, 'ref', `${name}_old.png`));
  console.log(`  ref/${name}_old.png ${Math.round(W)}x${Math.round(H)}`);
}

/** Background out by colour distance, a soft edge in between. */
async function keyed(f, bg) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [kr, kg, kb] = BG[bg];
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.hypot(data[i] - kr, data[i + 1] - kg, data[i + 2] - kb);
    data[i + 3] = d < 90 ? 0 : d > 170 ? 255 : Math.round(((d - 90) / 80) * 255);
    // Pull the background's tint out of the edge (a green or magenta fringe): channels the key is full in may not
    // stand far above the others.
    if (d < 260) {
      const lo = Math.min(...[0, 1, 2].filter((c) => !BG[bg][c]).map((c) => data[i + c]));
      for (const c of [0, 1, 2]) if (BG[bg][c]) data[i + c] = Math.min(data[i + c], lo + 40);
    }
  }
  return { w: info.width, h: info.height, d: data };
}

function bands(has, n, want, gap, label) {
  const out = [];
  let start = -1, empty = 0;
  for (let i = 0; i < n; i++) {
    if (has(i)) { if (start < 0) start = i; empty = 0; } else if (start >= 0 && ++empty >= gap) { out.push([start, i - empty + 1]); start = -1; }
  }
  if (start >= 0) out.push([start, n]);
  while (out.length > want) {
    let best = 0;
    for (let i = 1; i < out.length - 1; i++) if (out[i + 1][0] - out[i][1] < out[best + 1][0] - out[best][1]) best = i;
    out.splice(best, 2, [out[best][0], out[best + 1][1]]);
  }
  if (out.length !== want) throw new Error(`${label}: found ${out.length}, wanted ${want}`);
  return out;
}

async function cut(name, sheet) {
  const src = path.join(RAW, `${name}.png`);
  if (!fs.existsSync(src)) return console.warn(`- ${name}.png: not there yet, skipped`);
  const img = await keyed(src, sheet.bg);
  const op = (x, y) => img.d[(y * img.w + x) * 4 + 3] > 40;
  const gap = Math.max(6, Math.round(img.w / 150));
  const rowB = bands((y) => { for (let x = 0; x < img.w; x++) if (op(x, y)) return true; return false; }, img.h, sheet.rows.length, gap, `${name} rows`);
  const raw = sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } });
  for (let r = 0; r < sheet.rows.length; r++) {
    const [y0, y1] = rowB[r];
    const colB = bands((x) => { for (let y = y0; y < y1; y++) if (op(x, y)) return true; return false; }, img.w, sheet.rows[r].length, gap, `${name} row ${r + 1}`);
    for (let c = 0; c < colB.length; c++) {
      const [x0, x1] = colB[c];
      let t = y1, b = y0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (op(x, y)) { if (y < t) t = y; if (y > b) b = y; }
      const n = sheet.rows[r][c];
      const [W, H] = await size(file(n));
      const out = path.join(OUT, `${n}.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await raw.clone().extract({ left: x0, top: t, width: x1 - x0, height: b + 1 - t }).resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).png().toFile(out);
      console.log(`  ${n}.png ${W}x${H}`);
    }
  }
}

async function whole(name, old) {
  const src = path.join(RAW, `${name}.png`);
  if (!fs.existsSync(src)) return console.warn(`- ${name}.png: not there yet, skipped`);
  const [W, H] = await size(path.join(UI, old));
  const out = path.join(OUT, old);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const s = sharp(src).resize(W, H, { fit: 'cover', kernel: 'lanczos3' });
  await (old.endsWith('.webp') ? s.webp({ quality: 88 }) : s.png()).toFile(out);
  console.log(`  ${old} ${W}x${H}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'ref') {
    for (const [n, s] of Object.entries(SHEETS)) await ref(n, s);
    return;
  }
  const pick = args.length ? args : [...Object.keys(SHEETS), ...Object.keys(WHOLE)];
  for (const n of pick) {
    if (SHEETS[n]) await cut(n, SHEETS[n]);
    else if (WHOLE[n]) await whole(n, WHOLE[n]);
    else console.warn(`- unknown: ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
