// Takes the pink cast off the edges of the thin papercraft card frames (owner 2026-11-26: magenta lines left around the
// window and under the corner leaves). The frames were cut from a flat #FF00FF window (tools/cut_paper_cards.cjs), and the
// raw thin frames are no longer at hand, so this works on the game's own files:
//   node tools/clean_card_frames.cjs
// In:  public/assets/sprites/paper/cards/card_frame_thin_<rarity>.webp
// Out: public/assets/sprites/paper/cards/card_frame_clean_<rarity>.webp (a new name so browsers and Cloudflare can't keep
//      showing the old frame; cardFrame() in src/shared/data/cards.ts points at it)
// Every pixel within EDGE px of the see-through middle (or of the cut-out corners) that leans magenta has its red and
// blue brought down to its green (+ a little), so the soft edge and the leaf shadows turn a neutral dark instead of pink.
// The frame's own colours further from the edge (the epic frame is purple) are left as they are.
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'public/assets/sprites/paper/cards');
/** How far (px at 512×768) from a see-through pixel the clean-up reaches. */
const EDGE = 4;
/** How much a pixel may lean magenta (min(R, B) − G) before it is cleaned. */
const LEAN = 8;

async function clean(rarity) {
  const file = path.join(DIR, `card_frame_thin_${rarity}.webp`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  // Distance (in steps) to the nearest mostly see-through pixel, up to EDGE.
  const dist = new Uint8Array(W * H).fill(255);
  let front = [];
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] < 128) {
    dist[i] = 0;
    front.push(i);
  }
  for (let d = 1; d <= EDGE; d++) {
    const next = [];
    for (const p of front) {
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q >= 0 && q < W * H && dist[q] === 255) {
          dist[q] = d;
          next.push(q);
        }
      }
    }
    front = next;
  }
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (dist[i] > EDGE || data[i * 4 + 3] === 0) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    if (Math.min(r, b) - g <= LEAN) continue;
    data[i * 4] = Math.min(r, g + LEAN);
    data[i * 4 + 2] = Math.min(b, g + LEAN);
    n++;
  }
  const out = path.join(DIR, `card_frame_clean_${rarity}.webp`);
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toFile(out);
  console.log(`${rarity}: ${n} pixels cleaned → ${path.basename(out)}`);
}

(async () => {
  for (const r of ['rare', 'epic', 'legendary']) await clean(r);
})();
