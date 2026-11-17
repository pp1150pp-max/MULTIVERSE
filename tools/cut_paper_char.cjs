// Cuts a papercraft character's raw ChatGPT rows (art_templates/papercraft_chars/raw/<char>/<anim>_<dir>.png, one
// direction per image, 8 frames in a row; see art_templates/papercraft_chars/SWORD.md, MAGE.md) into the game's animation
// sheets: public/assets/sprites/paper/player/<char>/<anim>.png (a row per direction, a column per frame) and a
// sprite.json. Usage: node tools/cut_paper_char.cjs sword|mage [--measure]
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const DIRS = ['down', 'down_side', 'side', 'up_side', 'up'];
const FRAMES = 8;
/** Every pose's cell: wider and taller than the 256 the old art used, so a swung sword isn't cut off. */
const CELL_W = 384;
const CELL_H = 320;
/** The standing body is this tall, feet this far above the cell's bottom (the old art's 200 px and 16 px). */
const BODY_PX = 200;
const FEET_PX = 16;
/**
 * Each class's poses and background. Speeds are twice the old 4-frame fps, so a cycle takes as long as before (ride
 * sways slower); attacks are played over the attack's own duration anyway.
 */
const BASE_ANIMS = {
  idle: { fps: 10, loop: true },
  run: { fps: 20, loop: true },
  death: { fps: 14, dirs: ['side'] },
  ride: { fps: 8, loop: true },
  ride_board: { fps: 8, loop: true },
};
const CHARS = {
  sword: { bg: 'magenta', anims: { ...BASE_ANIMS, attack: { fps: 24 }, attack_2: { fps: 24 }, attack_3: { fps: 24 } } },
  // A purple witch: drawn on green.
  mage: { bg: 'green', anims: { ...BASE_ANIMS, attack: { fps: 24 }, run_attack: { fps: 20, loop: true } } },
  gunslinger: { bg: 'magenta', anims: { ...BASE_ANIMS, attack: { fps: 24 }, run_attack: { fps: 20, loop: true } } },
};
let ANIMS = CHARS.sword.anims;
let BG = 'magenta';

async function readKeyed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const d = data;
  if (BG === 'green') {
    // Green out, a green fringe pulled back.
    for (let i = 0; i < w * h * 4; i += 4) {
      const over = d[i + 1] - Math.max(d[i], d[i + 2]);
      if (over > 70) d[i + 3] = 0;
      else {
        d[i + 3] = 255;
        if (over > 20) d[i + 1] = Math.max(d[i], d[i + 2]) + 18;
      }
    }
    return { w, h, d };
  }
  // Magenta out, a purple fringe pulled back (as in tools/cut_zone3.cjs).
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
  return { w, h, d };
}

/** Connected pieces of opaque pixels: [{ px: index list, x0, y0, x1, y1, cx }]. */
function pieces(img) {
  const { w, h, d } = img;
  const label = new Int32Array(w * h).fill(-1);
  const out = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] >= 0 || !d[s * 4 + 3]) continue;
    const id = out.length;
    const px = [];
    const stack = [s];
    label[s] = id;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, sx = 0;
    while (stack.length) {
      const k = stack.pop();
      px.push(k);
      const x = k % w;
      const y = (k - x) / w;
      sx += x;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = ny * w + nx;
        if (label[t] < 0 && d[t * 4 + 3]) {
          label[t] = id;
          stack.push(t);
        }
      }
    }
    out.push({ px, x0, y0, x1: x1 + 1, y1: y1 + 1, cx: sx / px.length });
  }
  return out;
}

/**
 * The 8 figures in a row, left to right: the 8 biggest pieces, each with the smaller pieces nearest to it (a sword
 * that fell out of a hand). Specks are dropped. If two figures touch (fewer than 8 big pieces), equal columns instead.
 */
function figures(img, label) {
  const all = pieces(img).sort((a, b) => b.px.length - a.px.length);
  const big = all.slice(0, FRAMES);
  const ok = big.length === FRAMES && big[FRAMES - 1].px.length > big[0].px.length * 0.12;
  if (!ok) {
    console.warn(`  ! ${label}: figures touch, cutting into equal columns`);
    return Array.from({ length: FRAMES }, (_, i) => {
      const a = (i * img.w) / FRAMES;
      const b = ((i + 1) * img.w) / FRAMES;
      const px = all.flatMap((p) => p.px.filter((k) => { const x = k % img.w; return x >= a && x < b; }));
      return withBox(img, px);
    });
  }
  big.sort((a, b) => a.cx - b.cx);
  const groups = big.map((p) => [...p.px]);
  const minKeep = big[FRAMES - 1].px.length * 0.01;
  for (const p of all.slice(FRAMES)) {
    if (p.px.length < minKeep) continue;
    let best = 0;
    for (let i = 1; i < FRAMES; i++) if (Math.abs(big[i].cx - p.cx) < Math.abs(big[best].cx - p.cx)) best = i;
    // A loose speck well away from the figure (a stray glow) is dropped; a dropped weapon is big enough to keep.
    const b = big[best];
    const gap = Math.max(b.x0 - p.x1, p.x0 - b.x1, b.y0 - p.y1, p.y0 - b.y1, 0);
    if (gap > img.w / 60 && p.px.length < b.px.length * 0.02) continue;
    groups[best].push(...p.px);
  }
  return groups.map((px, i) => ({ ...withBox(img, px), cx: big[i].cx }));
}

function withBox(img, px) {
  let x0 = img.w, y0 = img.h, x1 = 0, y1 = 0, sx = 0;
  for (const k of px) {
    const x = k % img.w;
    const y = (k - x) / img.w;
    sx += x;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { px, x0, y0, x1: x1 + 1, y1: y1 + 1, cx: sx / Math.max(1, px.length) };
}

/**
 * A figure's body area without its thin parts: the pixels whose whole square of side 2R+1 around them belongs to the
 * figure (a staff, a blade or a scarf end narrower than that drops out). R grows with the picture's size.
 */
/** The figure's height without thin parts sticking up (a raised staff or sword): its foot to the top of its core. */
function coreHeight(img, f) {
  return f.y1 - f.y0 - coreArea(img, f, true);
}

function coreArea(img, f, topOnly = false) {
  const w = f.x1 - f.x0;
  const h = f.y1 - f.y0;
  const R = Math.max(3, Math.round(img.w / 180));
  const S = new Int32Array((w + 1) * (h + 1));
  const mine = new Uint8Array(w * h);
  for (const k of f.px) mine[(Math.floor(k / img.w) - f.y0) * w + (k % img.w) - f.x0] = 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    S[(y + 1) * (w + 1) + x + 1] = mine[y * w + x] + S[y * (w + 1) + x + 1] + S[(y + 1) * (w + 1) + x] - S[y * (w + 1) + x];
  }
  const full = (2 * R + 1) ** 2;
  let n = 0;
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
    const a = S[(y - R) * (w + 1) + x - R], b = S[(y - R) * (w + 1) + x + R + 1];
    const c = S[(y + R + 1) * (w + 1) + x - R], d = S[(y + R + 1) * (w + 1) + x + R + 1];
    if (d - b - c + a === full) {
      if (topOnly) return Math.max(0, y - R);
      n++;
    }
  }
  return topOnly ? 0 : n;
}

/** One figure alone on a transparent crop (so a neighbour's sword tip isn't carried along). */
function alone(img, f) {
  const w = f.x1 - f.x0;
  const h = f.y1 - f.y0;
  const buf = Buffer.alloc(w * h * 4);
  for (const k of f.px) {
    const x = (k % img.w) - f.x0;
    const y = Math.floor(k / img.w) - f.y0;
    img.d.copy(buf, (y * w + x) * 4, k * 4, k * 4 + 4);
  }
  return { buf, w, h };
}

async function main() {
  const char = process.argv[2];
  const measure = process.argv.includes('--measure');
  if (!CHARS[char]) throw new Error(`usage: node tools/cut_paper_char.cjs <${Object.keys(CHARS).join('|')}> [--measure]`);
  ({ anims: ANIMS, bg: BG } = CHARS[char]);
  const RAW = path.join(ROOT, 'art_templates/papercraft_chars/raw', char);
  const OUT = path.join(ROOT, 'public/assets/sprites/paper/player', char);
  const load = async (anim, dir) => {
    const file = path.join(RAW, anim === 'death' ? 'death.png' : `${anim}_${dir}.png`);
    if (!fs.existsSync(file)) return null;
    const img = await readKeyed(file);
    return { img, figs: figures(img, path.basename(file)) };
  };

  // The scale. ChatGPT draws the character a little bigger or smaller in each picture (a run-and-cast row came out
  // ~20% smaller than idle). Each direction's idle is scaled so its median frame is BODY_PX tall. A standing pose
  // (run, attacks) is matched to its direction's idle by body height without thin parts sticking up (owner 2026-11-18:
  // a raised staff made the cast look smaller than idle). Seated and lying poses (ride, death) can't be measured that
  // way and keep their direction's idle scale.
  const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  const medianH = (figs) => median(figs.map((f) => f.y1 - f.y0));
  const medianCore = (img, figs) => median(figs.map((f) => coreHeight(img, f)));
  const STANDING = new Set(['run', 'attack', 'attack_2', 'attack_3', 'run_attack']);
  const idleK = {};
  const idleCore = {};
  for (const dir of DIRS) {
    const r = await load('idle', dir);
    if (!r) throw new Error(`missing idle_${dir}.png`);
    idleK[dir] = BODY_PX / medianH(r.figs);
    idleCore[dir] = medianCore(r.img, r.figs);
  }
  const loaded = {};
  for (const [anim, def] of Object.entries(ANIMS)) {
    for (const dir of def.dirs ?? DIRS) loaded[`${anim}_${dir}`] = await load(anim, dir);
  }

  const manifest = {
    frameWidth: 256, frameHeight: 256, height: 2.4, feet: 0.0625, sideFaces: 'left', directions: DIRS, animations: {},
  };
  fs.mkdirSync(OUT, { recursive: true });
  for (const [anim, def] of Object.entries(ANIMS)) {
    const dirs = def.dirs ?? DIRS;
    const layers = [];
    let missing = false;
    for (let row = 0; row < dirs.length; row++) {
      const dir = dirs[row];
      const r = loaded[`${anim}_${dir}`];
      if (!r) {
        missing = true;
        break;
      }
      // Same body height as this direction's idle (the death row is side-on: the side idle's scale).
      const own = STANDING.has(anim) ? medianCore(r.img, r.figs) : idleCore[dir];
      const k = idleK[dir] * (idleCore[dir] / own);
      if (measure) console.log(`${anim}_${dir}: body ${own}px (idle ${idleCore[dir]}), x${(k / idleK[dir]).toFixed(3)} of idle`);
      // The row's ground: the lowest foot of all its frames, so hops and falls keep their height above it.
      const ground = Math.max(...r.figs.map((f) => f.y1));
      for (let i = 0; i < FRAMES; i++) {
        const f = r.figs[i];
        const a = alone(r.img, f);
        const w = Math.max(1, Math.round(a.w * k));
        const h = Math.max(1, Math.round(a.h * k));
        const png = await sharp(a.buf, { raw: { width: a.w, height: a.h, channels: 4 } }).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
        // Body centre (the figure's mass, which a thin sword hardly moves) on the cell's centre line.
        let left = Math.round(i * CELL_W + CELL_W / 2 - (f.cx - f.x0) * k);
        let top = Math.round(row * CELL_H + CELL_H - FEET_PX - (ground - f.y0) * k);
        const clip = (left < i * CELL_W || left + w > (i + 1) * CELL_W || top < row * CELL_H);
        if (clip) console.warn(`  ! ${anim}_${dir} frame ${i + 1} is cut off at its cell's edge`);
        // Crop whatever spills out of the cell instead of failing.
        const cx0 = Math.max(left, i * CELL_W);
        const cy0 = Math.max(top, row * CELL_H);
        const cx1 = Math.min(left + w, (i + 1) * CELL_W);
        const cy1 = Math.min(top + h, (row + 1) * CELL_H);
        const piece = await sharp(png).extract({ left: cx0 - left, top: cy0 - top, width: cx1 - cx0, height: cy1 - cy0 }).png().toBuffer();
        left = cx0;
        top = cy0;
        layers.push({ input: piece, left, top });
      }
    }
    if (missing) {
      console.warn(`- ${anim}: not all directions there yet, skipped`);
      continue;
    }
    if (measure) continue;
    await sharp({ create: { width: CELL_W * FRAMES, height: CELL_H * dirs.length, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(layers).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${anim}.png`));
    console.log(`  ${anim}.png ${CELL_W * FRAMES}x${CELL_H * dirs.length}`);
    manifest.animations[anim] = {
      file: `${anim}.png`, frames: FRAMES, fps: def.fps, ...(def.loop ? { loop: true } : {}), ...(def.dirs ? { directions: def.dirs } : {}),
      frameWidth: CELL_W, frameHeight: CELL_H, feet: FEET_PX / CELL_H,
    };
  }
  if (!measure) {
    fs.writeFileSync(path.join(OUT, 'sprite.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log('  sprite.json');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
