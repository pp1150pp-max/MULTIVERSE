// Turns the coloured crater (art_templates/ground_fx/raw/death_crater.png, magenta background) into a colourless shade
// decal, so the map's own ground shows through: dark = black with alpha, light = white with alpha.
// Usage: PNGJS=<path to pngjs> node tools/crater_decal.cjs <raw.png> public/assets/sprites/fx/death_crater.png <preview.png> <ground.png ...>
const fs = require('fs');
const { PNG } = require(process.env.PNGJS || 'pngjs');
const [inp, out, prev, ...grounds] = process.argv.slice(2);
const src = PNG.sync.read(fs.readFileSync(inp));
const W = 512;
const sx = src.width / W;
const dec = new PNG({ width: W, height: W });
const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
const isKey = (d, i) => Math.min(d[i], d[i + 2]) - d[i + 1] > 70 && Math.abs(d[i] - d[i + 2]) < 90;
// Median brightness of the crater = "no change" level.
const ls = [];
for (let i = 0; i < src.data.length; i += 16) if (!isKey(src.data, i)) ls.push(lum(src.data, i));
ls.sort((a, b) => a - b);
const mid = ls[Math.floor(ls.length / 2)];
console.log('mid', mid.toFixed(1));
for (let y = 0; y < W; y++)
  for (let x = 0; x < W; x++) {
    // Box-average the source block so the downscale stays clean.
    let L = 0, n = 0, k = 0;
    for (let yy = Math.floor(y * sx); yy < Math.floor((y + 1) * sx); yy++)
      for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
        const i = (yy * src.width + xx) * 4;
        n++;
        if (isKey(src.data, i)) continue;
        k++;
        L += lum(src.data, i);
      }
    const o = (y * W + x) * 4;
    if (!k) continue;
    L /= k;
    const cover = k / n;
    let a, c;
    if (L < mid) { c = 0; a = Math.min(1, ((mid - L) / mid) * 1.7) * 0.8; }
    else { c = 255; a = Math.min(1, (L - mid) / (255 - mid)) * 0.35; }
    dec.data[o] = dec.data[o + 1] = dec.data[o + 2] = c;
    dec.data[o + 3] = Math.round(255 * a * cover);
  }
fs.writeFileSync(out, PNG.sync.write(dec));
// Preview: the decal over each ground texture, side by side.
const pv = new PNG({ width: W * grounds.length, height: W });
grounds.forEach((g, gi) => {
  const t = PNG.sync.read(fs.readFileSync(g));
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const ti = ((y % t.height) * t.width + (x % t.width)) * 4;
      const o = (y * W + x) * 4, p = (y * pv.width + gi * W + x) * 4;
      const a = dec.data[o + 3] / 255;
      for (let c = 0; c < 3; c++) pv.data[p + c] = t.data[ti + c] * (1 - a) + dec.data[o + c] * a;
      pv.data[p + 3] = 255;
    }
});
fs.writeFileSync(prev, PNG.sync.write(pv));
