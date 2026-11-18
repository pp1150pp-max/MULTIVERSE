// Walking into NPCs and other solid things in town: slide round them, never stop dead or shake.
import { ok, finish } from './check';
import { ZONE_HUB } from '../src/shared/data/zones';
import { NPC_IDS } from '../src/shared/data/npcs';
import { Sim } from '../src/shared/sim/Sim';
import { HUB_BUILDING_IN, HUB_FOUNTAIN_RADIUS } from '../src/shared/sim/terrain';
import { WalkTarget } from '../src/client/walkTo';
import type { Vec2 } from '../src/shared/types';

const hero = () => ({ name: 'T', classId: 'mage' as const, level: 10, exp: 0, gold: 0, equipment: {}, bag: [] });
const DT = 1 / 60;
const sim = new Sim(ZONE_HUB);
const t = sim.terrain;
const p = sim.addPlayer(hero());
const s = ZONE_HUB.start;

/**
 * One frame of walking to a point the way the browser does it (OnlineBackend.walk): `to` is this
 * frame's clicked/held point, or null once the button is up. Returns whether a target is left.
 */
function frame(w: WalkTarget, to: Vec2 | null): boolean {
  w.aim(p, to, t);
  const g = p.moveTarget;
  if (g) {
    const dx = g.x - p.x;
    const dz = g.z - p.z;
    const rem = Math.hypot(dx, dz);
    if (rem < 0.15) p.moveTarget = null;
    else p.walkStep(dx / rem, dz / rem, rem, DT, t);
  }
  w.check(p, DT);
  return !!p.moveTarget;
}

/** Clicks once on (tx, tz) from (x, z). Seconds until the walk ends, or Infinity. */
function clickWalk(x: number, z: number, tx: number, tz: number): number {
  p.x = x;
  p.z = z;
  p.moveTarget = null;
  const w = new WalkTarget();
  for (let f = 0; f < 600; f++) if (!frame(w, f === 0 ? { x: tx, z: tz } : null)) return f * DT;
  return Infinity;
}

/** Holds one direction key from (x, z); seconds until past `goal` along it, or Infinity. */
function keyWalk(x: number, z: number, mx: number, mz: number, past: number): number {
  p.x = x;
  p.z = z;
  for (let f = 0; f < 600; f++) {
    if ((p.x - x) * mx + (p.z - z) * mz > past) return f * DT;
    p.walkStep(mx, mz, Infinity, DT, t);
  }
  return Infinity;
}

// ---- clicking right on an NPC, the forge, the vault or the fountain walks up beside it
const things = [
  ...NPC_IDS.map((id) => ({ name: id, ...t.npcPos[id]!, out: 3.5 })),
  // The buildings behind the blacksmith and the keeper (Terrain.placeTown).
  { name: 'forge', ...t.props.find((q) => q.key === 'bld_forge')!, out: HUB_BUILDING_IN + 2 },
  { name: 'vault', ...t.props.find((q) => q.key === 'bld_vault')!, out: HUB_BUILDING_IN + 2 },
  { name: 'fountain', x: s.x, z: s.z, out: HUB_FOUNTAIN_RADIUS + 1.5 },
];
for (const th of things) {
  let worst = 0;
  let tried = 0;
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    const x = th.x + Math.cos(ang) * th.out;
    const z = th.z + Math.sin(ang) * th.out;
    // Only from inside the town: behind a building against the wall is outside it.
    if (t.isBlocked(x, z, p.radius) || Math.max(Math.abs(x - s.x), Math.abs(z - s.z)) > ZONE_HUB.safe!.half - 1) continue;
    tried++;
    const spot = t.standSpot(th.x, th.z, p.radius, { x, z });
    if (!spot || t.isBlocked(spot.x, spot.z, p.radius - 0.01)) worst = Infinity;
    else worst = Math.max(worst, clickWalk(x, z, th.x, th.z));
  }
  ok(tried > 0 && worst < 3, `${th.name}: a click on it walks up beside it from every side (slowest ${worst.toFixed(2)} s)`);
}

// ---- holding the button down: the point moves with the camera (a fixed step ahead), never dropped
{
  p.x = s.x + 4;
  p.z = s.z + 4;
  p.moveTarget = null;
  const w = new WalkTarget();
  let kept = true;
  const from = { x: p.x, z: p.z };
  for (let f = 0; f < 180; f++) kept = frame(w, { x: p.x - 3, z: p.z + 3 }) && kept;
  ok(kept && Math.hypot(p.x - from.x, p.z - from.z) > 3, 'holding the button keeps walking (no stop every 0.8 s)');
}

// ---- holding a key straight at something round goes round it, not into it
for (const [name, c, r] of [['blacksmith', t.npcPos.blacksmith!, 0.45], ['fountain', s, HUB_FOUNTAIN_RADIUS]] as const) {
  const straight = (2 * (r + 2)) / p.moveSpeed;
  const took = keyWalk(c.x + r + 2, c.z, -1, 0, 2 * (r + 2));
  ok(took < straight * 1.6, `${name}: walked straight at its middle, gets past (${took.toFixed(2)} s, straight line ${straight.toFixed(2)} s)`);
}

// ---- pressed into a corner of two things: stays put, doesn't shake
{
  // Two things in town that leave a gap narrower than a player (the first such pair, e.g. a lamp post and a planter).
  const inTown = t.colliders.filter((c) => Math.max(Math.abs(c.x - s.x), Math.abs(c.z - s.z)) < 15);
  let stall = inTown[0];
  let barrel = inTown[1];
  let best = Infinity;
  for (const a of inTown) for (const b of inTown) {
    const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
    if (a !== b && gap > 0.05 && gap < 2 * p.radius - 0.1 && gap < best) {
      best = gap;
      stall = a;
      barrel = b;
    }
  }
  const mid = { x: (stall.x + barrel.x) / 2, z: (stall.z + barrel.z) / 2 };
  // Walk into the gap from the town side.
  const nx = mid.x - s.x;
  const nz = mid.z - s.z;
  const l = Math.hypot(nx, nz);
  p.x = mid.x - (nx / l) * 2;
  p.z = mid.z - (nz / l) * 2;
  for (let f = 0; f < 120; f++) p.walkStep(nx / l, nz / l, Infinity, DT, t);
  const at = { x: p.x, z: p.z };
  let moved = 0;
  for (let f = 0; f < 60; f++) {
    const bx = p.x;
    const bz = p.z;
    p.walkStep(nx / l, nz / l, Infinity, DT, t);
    moved += Math.hypot(p.x - bx, p.z - bz);
  }
  ok(moved < 0.05 && Math.hypot(p.x - at.x, p.z - at.z) < 0.02, `stall and barrel corner: stays still (moved ${moved.toFixed(3)} in 1 s)`);

  // One click on the far side of that corner: walks in, then gives up instead of pushing forever.
  p.x = mid.x - (nx / l) * 2;
  p.z = mid.z - (nz / l) * 2;
  p.moveTarget = null;
  const w = new WalkTarget();
  const far = { x: mid.x + (nx / l) * 2, z: mid.z + (nz / l) * 2 };
  let f = 0;
  while (f < 600 && frame(w, f === 0 ? far : null)) f++;
  ok(f * DT < 2.5, `a click past the corner gives up once stuck (${(f * DT).toFixed(2)} s)`);
}

finish('walk-around');
