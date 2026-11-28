// Smugglers' Cove's monster moves (plan 5.2, owner 2026-11-24). Their numbers live in src/shared/moveTuning.ts
// (/admin, card "ท่ามอนชั้น 2"), read through mv() so a save takes effect at once.
//  - chainball (ship prisoner):    slow on its chain; once hurt enough it throws the iron ball and runs free, fast.
//  - combo     (cutlass pirate):   three cuts in a row, the third a short lunge.
//  - spread    (blunderbuss):      a fan of pellets instead of one shot.
//  - keg       (powder-keg):       killed, it gets up and runs at the nearest player, then blows up after a short warning.
import { mv } from './beachMoves';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';

// ---- chainball

/** Its speed: held back by the chain, much faster once free. */
export function chainballSpeed(m: Monster): number {
  return m.freed ? mv('chainball.free') : mv('chainball.slow');
}

/** Hit: once HP is down to the /admin share it throws the ball at whoever hit it and breaks its chain (once a life). */
export function chainballOnHit(sim: Sim, m: Monster, by: Player): void {
  if (m.def.move !== 'chainball' || m.freed || !m.alive || m.hp <= 0 || m.hp > m.maxHp * mv('chainball.at')) return;
  m.freed = true;
  const angle = Math.atan2(by.z - m.z, by.x - m.x);
  m.face(by.x - m.x, by.z - m.z);
  sim.anim(m.id, 'attack', { duration: 0.3 });
  sim.addEnemyShot(m, {
    x: m.x, z: m.z, angle, speed: 9, range: 10, radius: 0.6, mult: mv('chainball.mult'), color: '#8a8a8a', size: 0.9, art: 'iron_ball',
  });
  sim.text(m.x, m.topY, m.z, 'หลุดโซ่!', 'info', 0.8);
}

// ---- combo

/**
 * A cutlass cut landed or missed (`step` 0, 1, 2): hits whoever is in reach for that cut's share of ATK. The third
 * lunges forward first. Returns true while more cuts follow (Monster winds up the next one).
 */
export function comboCut(sim: Sim, m: Monster, p: Player | null, step: number, reach: number): boolean {
  if (step === 2 && p?.alive) {
    const dx = p.x - m.x;
    const dz = p.z - m.z;
    const d = Math.hypot(dx, dz) || 1;
    const go = Math.max(0, Math.min(mv('combo.lunge'), d - m.radius - p.radius - 0.3));
    m.x += (dx / d) * go;
    m.z += (dz / d) * go;
    sim.terrain.resolve(m);
    sim.fx('burst', m.x, 0.3, m.z, '#d8c8a0', 6, 3);
  }
  const ang = Math.atan2(m.faceZ, m.faceX);
  sim.fx('slash', m.x, m.z, ang, Math.PI * (step === 2 ? 0.4 : 0.7), reach + 0.6, step === 2 ? '#ffd27a' : '#ff8a6a');
  if (p?.alive && Math.hypot(p.x - m.x, p.z - m.z) <= reach + p.radius + 0.5) {
    sim.hitPlayer(m, p, mv(`combo.mult${step + 1}`), step === 2 ? { kb: 4, fromX: m.x, fromZ: m.z } : {});
  }
  return step < 2;
}

// ---- spread

/** Pellets fanned out around `angle`, each its own shot (the def's look, the card's damage and range). */
export function spreadFire(sim: Sim, m: Monster, angle: number): void {
  const shot = m.def.shot!;
  const n = Math.max(1, Math.round(mv('spread.pellets')));
  const fan = (mv('spread.angle') * Math.PI) / 180;
  const range = mv('spread.range') * m.mult.range;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? angle : angle - fan / 2 + (fan * i) / (n - 1);
    sim.addEnemyShot(m, { x: m.x, z: m.z, angle: a, speed: shot.speed, range, radius: shot.radius, mult: mv('spread.mult'), color: shot.color, size: shot.size, art: shot.art });
  }
}

/** The warning lines of a coming fan, one per pellet. */
export function spreadWarn(sim: Sim, m: Monster, angle: number, windup: number): void {
  const shot = m.def.shot!;
  const n = Math.max(1, Math.round(mv('spread.pellets')));
  const fan = (mv('spread.angle') * Math.PI) / 180;
  const range = mv('spread.range') * m.mult.range;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? angle : angle - fan / 2 + (fan * i) / (n - 1);
    sim.fx('lineTelegraph', m.x, m.z, a, range, shot.radius * 2, windup);
  }
}

// ---- keg

/** A fallen powder-keg prisoner getting up for its last run: the runner left after its kill (no rewards, can't be hit). */
export interface KegRun { left: number; fuse: number }

/** Set up a freshly made runner (Sim.kegGetUp makes it where the prisoner fell, summoned: no rewards, can't be hit). */
export function kegStart(sim: Sim, m: Monster, dead: Monster): void {
  m.noHit = true;
  // Sent to the client (snapshot `fr`): it runs with the lit keg (sheet move charge) instead of walking.
  m.freed = true;
  m.keg = { left: mv('keg.run'), fuse: -1 };
  m.hp = 1;
  m.state = 'chase';
  m.face(dead.faceX, dead.faceZ);
  sim.text(m.x, m.topY, m.z, 'ชนวนติดไฟ!', 'crit', 0.9);
}

/** The runner's whole turn: run at the nearest player, then the short fuse (ring on the ground), then the blast. */
export function kegTick(dt: number, sim: Sim, m: Monster): void {
  const k = m.keg!;
  if (k.fuse >= 0) {
    k.fuse -= dt;
    m.moving = false;
    if (k.fuse <= 0) kegBlast(sim, m);
    return;
  }
  k.left -= dt;
  let best: Player | null = null;
  let bd = Infinity;
  for (const p of sim.players) {
    if (!p.alive || sim.inSafe(p)) continue;
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  m.target = best;
  if (!best || bd <= mv('keg.near') + best.radius || k.left <= 0) {
    k.fuse = mv('keg.warn');
    m.moving = false;
    sim.fx('telegraph', m.x, m.z, mv('keg.radius'), k.fuse, '#ff6a3a');
    sim.anim(m.id, 'attack', { duration: k.fuse });
    return;
  }
  const dx = best.x - m.x;
  const dz = best.z - m.z;
  const s = m.def.speed * mv('keg.speed') * m.speedMult() * dt;
  m.x += (dx / bd) * s;
  m.z += (dz / bd) * s;
  sim.terrain.resolve(m);
  m.moving = true;
  m.face(dx, dz);
}

/** Boom: everyone in the ring is hurt and thrown back; the runner is gone. */
function kegBlast(sim: Sim, m: Monster): void {
  const r = mv('keg.radius');
  sim.fx('sprite', 'fx_explosion', m.x, m.z, r * 0.8, 0.5);
  sim.fx('ring', m.x, m.z, r, '#ff8a3a', 0.35);
  sim.fx('burst', m.x, 0.4, m.z, '#ff8a3a', 14, 5);
  sim.sfx('boss_slam', m.x, m.z);
  sim.shake(0.3, m);
  for (const p of sim.players) {
    if (p.alive && Math.hypot(p.x - m.x, p.z - m.z) <= r + p.radius) sim.hitPlayer(m, p, mv('keg.mult'), { kb: 6, fromX: m.x, fromZ: m.z });
  }
  m.alive = false;
  m.hp = 0;
  m.deadT = 1;
}
