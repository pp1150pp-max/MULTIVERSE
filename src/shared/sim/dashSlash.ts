// The sword's class passive ฟันทะลวง (Dash Slash, owner 2026-11-28, docs/systems/skills.md "พาสซีฟประจำอาชีพ"): the plain
// dash slashes every monster it passes, once each per dash. The server decides it all from the positions it moves the
// player through itself (a dash is a server move: the browser's positions are not taken meanwhile), so the hits follow
// the path after the terrain stopped it: never through a wall, and nobody behind one.
import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import { currentBalance } from '../balance';

/** Steps of the "is a wall between the path and the monster" check (metres). */
const LOS_STEP = 0.1;

/** Distance from (px, pz) to the segment a→b, and the closest point on it. */
function nearest(ax: number, az: number, bx: number, bz: number, px: number, pz: number): { d: number; x: number; z: number } {
  const vx = bx - ax;
  const vz = bz - az;
  const l2 = vx * vx + vz * vz;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
  const x = ax + vx * t;
  const z = az + vz * t;
  return { d: Math.hypot(px - x, pz - z), x, z };
}

/** Nothing solid stands between (x, z) on the path and monster `m` (its own body left out). */
function clearTo(sim: Sim, x: number, z: number, m: Monster): boolean {
  const dx = m.x - x;
  const dz = m.z - z;
  const len = Math.hypot(dx, dz) - m.radius;
  if (len <= 0) return true;
  const steps = Math.ceil(len / LOS_STEP);
  const k = len / Math.hypot(dx, dz);
  for (let i = 1; i < steps; i++) {
    const f = (i / steps) * k;
    if (sim.terrain.isBlocked(x + dx * f, z + dz * f, 0)) return false;
  }
  return true;
}

/**
 * One tick of a slashing dash: player `p` moved from (fromX, fromZ) to where it stands now. Every live monster within
 * half the width (plus its own radius) of that stretch, not hit yet this dash and not behind a wall, takes the slash:
 * × ATK, crits as any hit, slows (bosses too), no element and no /admin extra effects (the dash has neither). Hit
 * spots go into `spots` (x, z pairs) for the slash marks.
 */
export function slashStep(sim: Sim, p: Player, fromX: number, fromZ: number, done: Set<Monster>, spots: number[]): void {
  const c = currentBalance().skills.classPassive.slash;
  const half = c.width / 2;
  for (const m of sim.monsters) {
    if (!m.alive || m.untargetable || done.has(m)) continue;
    const n = nearest(fromX, fromZ, p.x, p.z, m.x, m.z);
    if (n.d > half + m.radius || !clearTo(sim, n.x, n.z, m)) continue;
    done.add(m);
    const hp = m.hp;
    sim.hitMonster(p, m, c.dmg, { slow: c.slow > 0 && c.slowT > 0 ? c.slow : undefined, slowT: c.slowT, src: 'cp_slash', noExtra: true, noElem: true, fromX: p.x, fromZ: p.z });
    if (m.hp < hp) {
      if (!spots.length) sim.sfx('dashslash', m.x, m.z);
      spots.push(Math.round(m.x * 100) / 100, Math.round(m.z * 100) / 100);
    }
  }
}
