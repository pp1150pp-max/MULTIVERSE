// Background keying for the floor 2 papercraft sheets (tools/cut_papercraft.cjs floor2_*, tools/cut_floor2_chars.cjs).
// ChatGPT's "flat magenta" or "flat green" comes out a little off (e.g. 234,3,146 on keg_prisoner_walk), so the
// background is measured from the sheet's own border instead of tested against a fixed colour.
const { execSync } = require('child_process');
const path = require('path');

/** The median colour of the outer 4-pixel ring, and whether it is a green or a magenta background. */
function sampleBg(img) {
  const { w, h, d } = img;
  const rs = [], gs = [], bs = [];
  const take = (x, y) => { const i = (y * w + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); };
  for (let x = 0; x < w; x += 2) for (let y = 0; y < 4; y++) { take(x, y); take(x, h - 1 - y); }
  for (let y = 0; y < h; y += 2) for (let x = 0; x < 4; x++) { take(x, y); take(w - 1 - x, y); }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  const bg = [med(rs), med(gs), med(bs)];
  const green = bg[1] > Math.max(bg[0], bg[2]);
  return { bg, green };
}

/** How much a colour leans to the background's hue: magenta = min(R, B) - G, green = G - max(R, B). */
const lean = (green, r, g, b) => (green ? g - Math.max(r, b) : Math.min(r, b) - g);

/**
 * Turns the background transparent.
 *   soft = false: hard edge (props), alpha 0 where the colour leans at least half as far as the background does.
 *   soft = true: alpha is how far a colour sits from the background along that lean (0 lean or less = opaque), and
 *     the background's share is taken back out of the colour, so see-through ghosts stay see-through and lose their
 *     pink. `ghost` keeps every partly see-through pixel; otherwise only the edge stays soft.
 * Then pixels within 2 px of the background lose any tint of it, and specks smaller than `minSpeck` are dropped.
 * Returns the background found.
 */
function keyBg(img, { soft = false, ghost = false, minSpeck = 40 } = {}) {
  const { w, h, d } = img;
  const { bg, green } = sampleBg(img);
  const full = lean(green, ...bg);
  if (full < 120) throw new Error(`background ${bg} is neither magenta nor green`);
  // The see-through art's own lean (a ghost's teal leans well away from magenta): the background's share in a
  // see-through pixel is taken out against that, so a faded ghost comes back teal, not lavender. Opaque pixels
  // (lean 0 or less) are never touched.
  let artLean = 0;
  if (ghost) {
    const ms = [];
    for (let i = 0; i < w * h * 4; i += 64) { const m = lean(green, d[i], d[i + 1], d[i + 2]); if (m < 0) ms.push(m); }
    ms.sort((p, q) => p - q);
    artLean = Math.min(-20, ms[ms.length >> 1] ?? 0);
  }
  for (let i = 0; i < w * h * 4; i += 4) {
    const m = lean(green, d[i], d[i + 1], d[i + 2]);
    if (!soft) {
      d[i + 3] = m > full * 0.5 ? 0 : 255;
      continue;
    }
    let a = m <= 0 ? 1 : 1 - m / full;
    a = ghost ? (a < 0.1 ? 0 : a) : Math.min(1, Math.max(0, (a - 0.3) / 0.4));
    if (a > 0 && a < 1) {
      const ac = ghost ? Math.max(0.05, Math.min(a, (full - m) / (full - artLean))) : a;
      for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] - (1 - ac) * bg[c]) / ac)));
    }
    d[i + 3] = Math.round(a * 255);
  }
  // Edge despill: only near the background, so green leaves or purple cloth inside a piece keep their colour.
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) near[ny * w + nx] = 1;
    }
  }
  for (let k = 0; k < w * h; k++) {
    const i = k * 4;
    if (!d[i + 3] || !(near[k] || (ghost && d[i + 3] < 255))) continue;
    if (green) {
      const cap = Math.max(d[i], d[i + 2]) + 22;
      if (d[i + 1] > cap) d[i + 1] = cap;
    } else {
      const cap = d[i + 1] + 22;
      if (d[i] > cap && d[i + 2] > cap) { d[i] = cap; d[i + 2] = cap; }
    }
  }
  dropSpecks(img, minSpeck);
  return { bg, green };
}

function dropSpecks(img, minSpeck) {
  const { w, h, d } = img;
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
}

/** Files under public/assets/sprites that git already tracks: floor 2 output must never overwrite one. */
function trackedSprites(root) {
  const out = execSync('git ls-files public/assets/sprites', { cwd: root, encoding: 'utf8' });
  return new Set(out.split('\n').filter(Boolean).map((f) => path.resolve(root, f)));
}

module.exports = { sampleBg, keyBg, dropSpecks, trackedSprites };
