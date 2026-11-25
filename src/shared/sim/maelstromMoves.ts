// The Kraken Maelstrom's monster moves (plan 5.4, owner 2026-11-24). Their numbers live in src/shared/moveTuning.ts (/admin, card
// "ท่ามอนชั้น 2"), read through mv() so a save takes effect at once.
//  - dive     (shark knight):     sinks into the ground, only its fin showing (can't be hit), slides under its target and bursts up
//                                 after a warning circle.
//  - bubble   (seahorse soldier): its bubble shot traps whoever it hits: they can't move, attack or dash for a moment (a stun).
//  - wave     (ghost pirate king): slashes a wave of power that runs along a straight line, warned of first.
//  - tentacle (kraken tentacle, and the kraken's arms in its room): never moves; slams a long line at whoever comes within reach.
import { mv } from './beachMoves';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';

/** A monster's own move in progress (dive under, its burst, a wave's or a slam's wind-up). */
export interface SeaMove {
  cd: number;
  t: number;
  kind: 'under' | 'burst' | 'wave' | 'slam' | null;
  /** The line's direction (wave, slam). */
  angle: number;
  /** Where a dive bursts up. */
  x: number;
  z: number;
}

/** How close to a line a player must stand to be hit, past half its width. */
const segDist = (px: number, pz: number, x: number, z: number, angle: number, len: number): number => {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  const t = Math.max(0, Math.min(len, (px - x) * dx + (pz - z) * dz));
  return Math.hypot(px - (x + dx * t), pz - (z + dz * t));
};

/** Everyone standing on the line from (x, z) along `angle`, `len` long and `width` wide (safe areas left out). */
export function playersOnLine(sim: Sim, x: number, z: number, angle: number, len: number, width: number): Player[] {
  return sim.players.filter((p) => p.alive && !sim.inSafe(p) && segDist(p.x, p.z, x, z, angle, len) <= width / 2 + p.radius);
}

const state = (m: Monster): SeaMove => (m.sea ??= { cd: 1.5 + Math.random() * 2, t: 0, kind: null, angle: 0, x: 0, z: 0 });

// ---- bubble

/** A seahorse's bubble landed on a player: held in it (Sim.hitPlayer's stun, so Sword Anchor still keeps them free). */
export function bubbleStun(): number {
  return mv('bubble.sec');
}

/** The bubble around a trapped player. */
export function bubbleTrapped(sim: Sim, p: Player): void {
  if (!p.alive || p.stunT <= 0) return;
  sim.fx('sprite', 'fx_bubble_trap', p.x, p.z, 1.1, p.stunT, p.id);
  sim.text(p.x, p.topY + 0.4, p.z, 'ติดฟองน้ำ!', 'info', 0.9, p.id);
}

// ---- dive / wave

/**
 * A shark knight's dive or a ghost pirate king's wave, once Monster has done the stun and target checks. True = it acted this tick
 * (the usual chase and melee are skipped); false = Monster goes on as usual.
 */
export function seaAct(dt: number, sim: Sim, m: Monster): boolean {
  const g = state(m);
  g.cd -= dt * m.skillSpeed;
  const p = m.target;
  if (g.kind && (!p?.alive || m.state === 'return' || sim.inSafe(p))) {
    surface(sim, m);
    g.kind = null;
    return false;
  }
  if (g.kind === 'under' && p) {
    // Only its fin shows, sliding to its target; when time is up (or it is underneath) it marks where it will burst.
    g.t -= dt;
    const dx = p.x - m.x;
    const dz = p.z - m.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const s = Math.min(d, m.def.speed * mv('dive.speed') * dt);
    m.x += (dx / d) * s;
    m.z += (dz / d) * s;
    sim.terrain.resolve(m);
    m.moving = true;
    m.face(dx, dz);
    if (g.t <= 0 || d < 0.4) {
      g.kind = 'burst';
      g.t = mv('dive.warn') * m.skillMult();
      g.x = p.x;
      g.z = p.z;
      sim.fx('telegraph', g.x, g.z, mv('dive.radius'), g.t, '#6ab8e8');
    }
    return true;
  }
  if (g.kind === 'burst') {
    g.t -= dt;
    if (g.t > 0) return true;
    g.kind = null;
    m.x = g.x;
    m.z = g.z;
    sim.terrain.resolve(m);
    surface(sim, m);
    const r = mv('dive.radius');
    sim.fx('sprite', 'fx_slam_splash', m.x, m.z, r + 0.4, 0.5);
    sim.anim(m.id, 'attack', { duration: 0.35 });
    for (const q of sim.players) {
      if (q.alive && !sim.inSafe(q) && Math.hypot(q.x - m.x, q.z - m.z) <= r + q.radius) sim.hitPlayer(m, q, mv('dive.mult'), { kb: 4, fromX: m.x, fromZ: m.z });
    }
    m.resetAttack(0.8);
    return true;
  }
  if (g.kind === 'wave') {
    g.t -= dt;
    if (g.t > 0) return true;
    g.kind = null;
    const len = mv('wave.len');
    sim.fx('sprite', 'fx_sword_wave', m.x + Math.cos(g.angle) * len * 0.5, m.z + Math.sin(g.angle) * len * 0.5, 1.6, 0.45);
    sim.fx('slash', m.x, m.z, g.angle, 0.5, len, '#7fe0d0');
    for (const q of playersOnLine(sim, m.x, m.z, g.angle, len, mv('wave.width'))) {
      sim.hitPlayer(m, q, mv('wave.mult'), { kb: 3, fromX: m.x, fromZ: m.z });
    }
    m.resetAttack(0.8);
    return true;
  }
  if (!p || m.state !== 'chase' || m.windupT > 0 || g.cd > 0) return false;
  const d = Math.hypot(p.x - m.x, p.z - m.z);
  if (m.def.move === 'dive' && d > m.def.attackRange + 0.6 + p.radius) {
    // Only when it isn't already in reach: it closes the gap under the ground.
    g.cd = mv('dive.cd');
    g.kind = 'under';
    g.t = mv('dive.sec');
    m.fade = true;
    m.noHit = true;
    sim.fx('sprite', 'fx_shark_fin', m.x, m.z, 0.9, g.t + 0.2, m.id);
    sim.anim(m.id, 'dive', { duration: 0.4, fallback: 'attack' });
    return true;
  }
  if (m.def.move === 'wave' && d <= mv('wave.len')) {
    g.cd = mv('wave.cd');
    g.kind = 'wave';
    g.t = mv('wave.warn') * m.skillMult();
    g.angle = Math.atan2(p.z - m.z, p.x - m.x);
    m.face(p.x - m.x, p.z - m.z);
    sim.fx('lineTelegraph', m.x, m.z, g.angle, mv('wave.len'), mv('wave.width'), g.t);
    sim.anim(m.id, 'attack', { duration: g.t });
    return true;
  }
  return false;
}

function surface(sim: Sim, m: Monster): void {
  if (!m.fade) return;
  m.fade = false;
  m.noHit = false;
  sim.fx('sprite', 'fx_slam_splash', m.x, m.z, 1.2, 0.4);
}

// ---- tentacle

/** The line numbers of a slam: a field tentacle's, or the kraken's own arms in its room (their /admin card). */
function slamNums(m: Monster): { cd: number; len: number; warn: number; mult: number } {
  return m.summoned && m.def.id === 'kraken_arm'
    ? { cd: mv('kraken.armCd'), len: mv('kraken.armLen'), warn: mv('kraken.armWarn'), mult: mv('kraken.armMult') }
    : { cd: mv('tentacle.cd'), len: mv('tentacle.len'), warn: mv('tentacle.warn'), mult: mv('tentacle.mult') };
}

/** Not hit and nobody in reach this long, a hurt field tentacle heals back up (it can't walk home like other monsters). */
const TENTACLE_RESET = 6;

/**
 * A tentacle's whole turn (it never moves, Monster.step leaves everything to this): picks the nearest player in reach, marks a long
 * line at them and slams it. Stunned, it waits; left alone while hurt, it heals.
 */
export function tentacleTick(dt: number, sim: Sim, m: Monster): void {
  const g = state(m);
  g.cd -= dt * m.skillSpeed;
  if (m.stunT > 0 || sim.time < m.pinnedUntil) {
    if (g.kind === 'slam') g.kind = null;
    return;
  }
  const n = slamNums(m);
  if (g.kind === 'slam') {
    g.t -= dt;
    if (g.t > 0) return;
    g.kind = null;
    sim.fx('sprite', 'fx_slam_splash', m.x + Math.cos(g.angle) * n.len * 0.75, m.z + Math.sin(g.angle) * n.len * 0.75, 1.3, 0.45);
    sim.shake(0.15, m);
    for (const q of playersOnLine(sim, m.x, m.z, g.angle, n.len, mv('tentacle.width'))) {
      sim.hitPlayer(m, q, n.mult, { kb: 3, fromX: m.x, fromZ: m.z });
    }
    return;
  }
  // Its target: whoever hit it last while still in reach, else the nearest player in reach.
  const reach = n.len + 0.5;
  const inReach = (q: Player) => q.alive && !sim.inSafe(q) && Math.hypot(q.x - m.x, q.z - m.z) <= reach + q.radius;
  let p = m.target && inReach(m.target) ? m.target : null;
  if (!p) {
    let best = Infinity;
    for (const q of sim.players) {
      const d = Math.hypot(q.x - m.x, q.z - m.z);
      if (inReach(q) && d < best) {
        best = d;
        p = q;
      }
    }
  }
  if (p) {
    m.target = p;
    m.state = 'chase';
    m.idleT = 0;
    m.face(p.x - m.x, p.z - m.z);
  } else {
    m.target = null;
    m.state = 'idle';
    m.idleT += dt;
    // The kraken's own arms never heal: its brain takes them away when the room empties.
    if (!m.summoned && m.idleT > TENTACLE_RESET && m.hp < m.maxHp) {
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt);
      if (m.hp >= m.maxHp) m.resetFight();
    }
    return;
  }
  if (g.cd > 0) return;
  g.cd = n.cd;
  g.kind = 'slam';
  g.t = n.warn * m.skillMult();
  g.angle = Math.atan2(p.z - m.z, p.x - m.x);
  sim.fx('lineTelegraph', m.x, m.z, g.angle, n.len, mv('tentacle.width'), g.t);
  sim.anim(m.id, 'attack', { duration: g.t });
}
