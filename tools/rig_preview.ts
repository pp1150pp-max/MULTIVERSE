// Draws the sword rig's poses to one PNG without a browser, to check the joints and animations while making them.
// Usage: node --import tsx tools/rig_preview.ts <out.png> [armor] [weapon]
// Rows: front view, back view. Columns: idle, run ×4, attack ×3, attack_2 ×3, attack_3 ×3 (sampled across each).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRig, partCenter, partOf, samplePose, solveView, type RigViewName } from '../src/client/rig/rigMath';
import { rigPartPath, type RigArmor, type RigWeapon } from '../src/client/rig/rigLook';

const DIR = join(import.meta.dirname, '..', 'public/assets/sprites/player/sword_rig');
const out = process.argv[2] ?? 'rig_preview.png';
const armor = (process.argv[3] ?? 'dark') as RigArmor;
const weapon = (process.argv[4] ?? 'katana') as RigWeapon;
const rig = parseRig(JSON.parse(readFileSync(join(DIR, 'rig.json'), 'utf8')));
const sizes: Record<string, { w: number; h: number }> = JSON.parse(readFileSync(join(DIR, 'sizes.json'), 'utf8'));

const CELL_W = 420;
const CELL_H = 640;
const GROUND = 560;
const frames: [string, number][] = [
  ['idle', 0], ['run', 0], ['run', 0.25], ['run', 0.5], ['run', 0.75],
  ['attack', 0.3], ['attack', 0.55], ['attack', 1], ['attack_2', 0.3], ['attack_2', 0.6], ['attack_3', 0.35], ['attack_3', 0.6],
];

const layers: sharp.OverlayOptions[] = [];
for (const [row, view] of (['front', 'back'] as RigViewName[]).entries()) {
  const v = rig.views[view];
  const sizeOf = (part: string) => sizes[rigPartPath(view, part, armor, weapon)];
  for (const [col, [name, u]] of frames.entries()) {
    const { pose, move } = samplePose(rig.anims[name], u);
    const solved = solveView(v, sizeOf, pose, move);
    const byId = new Map(v.bones.map((b) => [b.id, b]));
    for (const id of v.order) {
      const b = byId.get(id)!;
      const part = partOf(b);
      if (!part) continue;
      const size = sizeOf(part);
      const bp = solved.get(id)!;
      const [cx, cy] = partCenter(b, bp, size);
      const img = await sharp(join(DIR, rigPartPath(view, part, armor, weapon) + '.png'))
        .rotate(-bp.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer({ resolveWithObject: true });
      const left = Math.round(col * CELL_W + CELL_W / 2 + cx - img.info.width / 2);
      const top = Math.round(row * CELL_H + GROUND - cy - img.info.height / 2);
      layers.push({ input: img.data, left, top });
    }
  }
}
// Ground lines and a pivot cross at each cell's origin.
const W = CELL_W * frames.length;
const H = CELL_H * 2;
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${[0, 1]
  .map((r) => `<line x1="0" y1="${r * CELL_H + GROUND}" x2="${W}" y2="${r * CELL_H + GROUND}" stroke="#7a6" stroke-width="2"/>`)
  .join('')}${frames.map(([n, u], c) => `<text x="${c * CELL_W + 10}" y="30" font-size="24" fill="#333">${n} ${u}</text>`).join('')}</svg>`;
await sharp({ create: { width: W, height: H, channels: 4, background: '#e9e4d8' } })
  .composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...layers.filter((l) => (l.left ?? 0) > -500)])
  .png()
  .toFile(out);
console.log('wrote', out);
