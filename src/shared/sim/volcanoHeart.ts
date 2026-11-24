// The Volcano Heart: a boss that never moves and fights only with ground attacks, each warned of
// first. The server decides everything; `Sim.hazards` goes out in snapshots as plain data, so every
// player (late arrivals too) draws the same attack at the same moment.
import { BASE_MOVE_SPEED } from '../formulas';
import { arenaRadius, clearingRadius } from '../data/zones';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';
import type { WitchHazard } from './bogWitch';
import type { CrabHazard } from './cannonCrab';
import type { CurseHazard } from './graveMoves';
import type { FogHazard } from './ghostCaptain';
import { currentBalance } from '../balance';

export interface HazardBase {
  id: number;
  /** Where it is centred. */
  x: number;
  z: number;
  /** When the warning appears, and when it starts to hurt. */
  start: number;
  hit: number;
}
export interface MeteorHazard extends HazardBase { k: 'meteor'; r: number }
/** A wave rolling out from the boss, with gaps to stand in. */
export interface RingHazard extends HazardBase { k: 'ring'; speed: number; width: number; maxR: number; gaps: number[]; gapArc: number }
/** Beams turning around the boss from `hit` until `end`. */
export interface BeamsHazard extends HazardBase { k: 'beams'; a0: number; spin: number; n: number; len: number; width: number; end: number }
/** Burns the whole clearing except a few small circles. */
export interface BlastHazard extends HazardBase { k: 'blast'; r: number; safe: { x: number; z: number }[]; safeR: number }
/** Every boss ground attack: the Volcano Heart's, the Bog Witch's (bogWitch.ts) and the Giant Cannon Crab's (cannonCrab.ts). */
export type Hazard = MeteorHazard | RingHazard | BeamsHazard | BlastHazard | WitchHazard | CrabHazard | CurseHazard | FogHazard;

/** Attack sizes and damage (times the boss's ATK). */
export const METEOR = { radius: 2, count: 5, every: 0.6, mult: 1.4 };
export const RING = { count: 3, speed: 5, width: 1.2, gaps: 3, gapArc: (50 * Math.PI) / 180, mult: 1 };
export const BEAMS = { count: 4, width: 1.2, duration: 6, hitEvery: 1, mult: 1.2 };
export const BLAST = { spots: 6, spotAt: 9, safeR: 2, mult: 35 };
/** Every attack also takes this share of the player's max HP, whatever their defense. */
export const HEART_HP_SHARE = 0.1;
/**
 * A long fight makes it worse: GROW.after seconds after its first hit, attacks get GROW.step bigger
 * (meteors, ring and beam width) and GROW.step stronger, and again every GROW.every seconds, with no cap.
 * Everything still stays inside the arena: only players in it are hit.
 */
export const GROW = { after: 30, every: 10, step: 0.05 };

export interface HeartPhase {
  meteorWarn: number;
  ringWarn: number;
  ringEvery: number;
  beamWarn: number;
  /** Beam turn speed, radians per second. */
  beamSpin: number;
  blastWarn: number;
  /** Pause between sets. */
  rest: number;
}
const deg = (d: number) => (d * Math.PI) / 180;
export const HEART_PHASES: HeartPhase[] = [
  { meteorWarn: 1.2, ringWarn: 1, ringEvery: 1.3, beamWarn: 1.5, beamSpin: deg(30), blastWarn: 3, rest: 3 },
  { meteorWarn: 1, ringWarn: 0.9, ringEvery: 1.15, beamWarn: 1.3, beamSpin: deg(40), blastWarn: 2.8, rest: 2.2 },
  { meteorWarn: 0.9, ringWarn: 0.8, ringEvery: 1, beamWarn: 1.1, beamSpin: deg(50), blastWarn: 2.5, rest: 1.5 },
];
/** HP share below which each later phase starts. */
export const PHASE_AT = [0.5, 0.3];

type AttackKind = 'meteor' | 'ring' | 'beams' | 'blast';
/**
 * What it does, in order, round and round. The blast always plays alone and rings never meet beams,
 * so there is always somewhere to stand.
 */
export const HEART_SETS: AttackKind[][][] = [
  [['meteor'], ['ring'], ['beams'], ['blast']],
  [['meteor', 'ring'], ['beams'], ['meteor', 'beams'], ['blast']],
  [['meteor', 'ring'], ['beams'], ['meteor', 'beams'], ['blast']],
];

/** Seconds a hurt boss waits with nobody in its clearing before it recovers. */
const RESET_AFTER = 10;
/** Seconds between someone stepping in and the first attack. */
const FIRST_ATTACK = 2;
const MAX_METEOR_TARGETS = 6;

export const ringRadiusAt = (h: RingHazard, t: number): number => Math.max(0, h.speed * (t - h.hit));
export const beamAngleAt = (h: BeamsHazard, i: number, t: number): number =>
  h.a0 + (i * Math.PI * 2) / h.n + h.spin * Math.max(0, Math.min(t, h.end) - h.hit);

/** Is this direction (radians) inside one of the wave's gaps? */
export function inRingGap(h: RingHazard, angle: number): boolean {
  return h.gaps.some((g) => Math.abs(Math.atan2(Math.sin(angle - g), Math.cos(angle - g))) <= h.gapArc / 2);
}

export interface BlastPlayer { x: number; z: number; speed: number }
export interface BlastPickArgs {
  /** Boss centre and the arena's radius. */
  cx: number;
  cz: number;
  arenaR: number;
  spots: number;
  safeR: number;
  minDist: number;
  /** Living players in the arena. */
  players: BlastPlayer[];
  warn: number;
  /** Share of speed × warn assumed to be walked. */
  reach: number;
  /** Is a spot centre unusable (wall, collider, lava)? */
  bad: (x: number, z: number) => boolean;
  rand: () => number;
}
const BOSS_CLEAR = 4;

/**
 * Safe spots for the big blast (owner 2026-11-22): scattered over the arena, each at least `minDist` from every
 * living player, and every living player has one they can reach in time. Too hard to satisfy → the minimum
 * distance shrinks step by step (never kills the whole team). Null when even that finds nothing.
 */
export function pickBlastSpots(a: BlastPickArgs): { x: number; z: number }[] | null {
  const { cx, cz, safeR, players, rand } = a;
  const maxR = a.arenaR - 1;
  const reachOf = (p: BlastPlayer) => p.speed * a.warn * a.reach + safeR;
  const covers = (s: { x: number; z: number }, p: BlastPlayer) => Math.hypot(s.x - p.x, s.z - p.z) <= reachOf(p);
  const usable = (x: number, z: number, m: number, others: { x: number; z: number }[], gap: number): boolean => {
    const d = Math.hypot(x - cx, z - cz);
    if (d > maxR || d < BOSS_CLEAR || a.bad(x, z)) return false;
    if (players.some((p) => Math.hypot(x - p.x, z - p.z) < m)) return false;
    return !others.some((o) => Math.hypot(x - o.x, z - o.z) < gap);
  };
  for (const factor of [1, 0.75, 0.5, 0.25, 0]) {
    const m = a.minDist * factor;
    for (let round = 0; round < 40; round++) {
      const gap = round < 20 ? safeR * 2 + 2 : safeR * 2;
      const out: { x: number; z: number }[] = [];
      for (let i = 0; i < a.spots; i++) {
        const open = players.filter((p) => !out.some((s) => covers(s, p)));
        const targeted = open.length > 0 && a.spots - i <= open.length;
        let put: { x: number; z: number } | null = null;
        for (let k = 0; k < 30 && !put; k++) {
          let x: number;
          let z: number;
          if (targeted) {
            // Inside this player's reach, outside the minimum distance.
            const p = open[Math.floor(rand() * open.length)];
            const ang = rand() * Math.PI * 2;
            const dist = m + rand() * Math.max(0, reachOf(p) - m);
            x = p.x + Math.cos(ang) * dist;
            z = p.z + Math.sin(ang) * dist;
          } else {
            const ang = rand() * Math.PI * 2;
            const dist = Math.sqrt(rand()) * maxR;
            x = cx + Math.cos(ang) * dist;
            z = cz + Math.sin(ang) * dist;
          }
          if (usable(x, z, m, out, gap)) put = { x, z };
        }
        if (put) out.push(put);
      }
      if (out.length && players.every((p) => out.some((s) => covers(s, p)))) return out;
    }
  }
  return null;
}

interface Active {
  h: Hazard;
  hitIds: Set<number>;
  nextHit: Map<number, number>;
}

export class VolcanoHeartBrain {
  private active: Active[] = [];
  private timers: { at: number; fn: () => void }[] = [];
  private phase = 0;
  private setIndex = 0;
  private nextSet = -1;
  private idleT = 0;
  private fighting = false;
  /** When it was first hit this fight (-1 = not yet). */
  private hurtSince = -1;

  private inArena(sim: Sim, m: Monster, p: Player): boolean {
    return p.alive && Math.hypot(p.x - m.x, p.z - m.z) <= arenaRadius(sim.zone);
  }

  update(dt: number, sim: Sim, m: Monster): void {
    const t = sim.time;
    const players = sim.players.filter((p) => this.inArena(sim, m, p));
    this.resolve(sim, m, t);

    if (!players.length) {
      // Boss-room group all down: keep the fight as it is for a revive (Balance bossWipeKeepHp).
      if (m.holdsOnWipe(sim)) {
        this.idleT = 0;
        m.state = 'idle';
        return;
      }
      this.idleT += dt;
      // Hit at all counts as a fight, so its HP (raised per player) always comes back down.
      const engaged = this.fighting || m.damageBy.size > 0;
      if (engaged && this.idleT >= RESET_AFTER) this.reset(sim, m);
      else if (engaged) m.state = 'idle';
      return;
    }
    this.idleT = 0;
    m.state = 'chase';
    if (this.hurtSince < 0 && m.damageBy.size > 0) this.hurtSince = t;
    if (!this.fighting) {
      this.fighting = true;
      this.nextSet = t + FIRST_ATTACK;
    }

    const phase = m.hp <= m.maxHp * PHASE_AT[1] ? 2 : m.hp <= m.maxHp * PHASE_AT[0] ? 1 : 0;
    if (phase > this.phase) {
      this.phase = phase;
      m.enraged = true;
      sim.onHeartPhase(m, phase);
    }

    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (t >= this.timers[i].at) {
        const { fn } = this.timers[i];
        this.timers.splice(i, 1);
        fn();
      }
    }
    if (this.nextSet >= 0 && t >= this.nextSet) this.startSet(sim, m, t);
  }

  private reset(sim: Sim, m: Monster): void {
    this.active = [];
    this.timers = [];
    sim.hazards = [];
    this.phase = 0;
    this.setIndex = 0;
    this.nextSet = -1;
    this.fighting = false;
    this.hurtSince = -1;
    this.idleT = 0;
    m.state = 'idle';
    m.enraged = false;
    m.resetFight();
  }

  private add(sim: Sim, h: Hazard): void {
    this.active.push({ h, hitIds: new Set(), nextHit: new Map() });
    sim.hazards = this.active.map((a) => a.h);
  }

  /** 1 at first; 1 + GROW.step for each growth step reached (size and damage grow alike). */
  growth(t: number): number {
    if (this.hurtSince < 0) return 1;
    const since = t - this.hurtSince;
    return since < GROW.after ? 1 : 1 + GROW.step * (1 + Math.floor((since - GROW.after) / GROW.every));
  }

  private startSet(sim: Sim, m: Monster, t: number): void {
    const sets = HEART_SETS[this.phase];
    const kinds = sets[this.setIndex % sets.length];
    this.setIndex++;
    const ph = HEART_PHASES[this.phase];
    let longest = 0;
    for (const k of kinds) {
      const len = k === 'meteor' ? this.startMeteors(sim, m, t, ph)
        : k === 'ring' ? this.startRings(sim, m, t, ph)
        : k === 'beams' ? this.startBeams(sim, m, t, ph)
        : this.startBlast(sim, m, t, ph);
      longest = Math.max(longest, len);
    }
    this.nextSet = t + longest + ph.rest / m.skillSpeed;
  }

  private startMeteors(sim: Sim, m: Monster, t: number, ph: HeartPhase): number {
    for (let i = 0; i < METEOR.count; i++) {
      this.timers.push({
        at: t + i * METEOR.every,
        fn: () => {
          const targets = sim.players.filter((p) => this.inArena(sim, m, p)).slice(0, MAX_METEOR_TARGETS);
          // It heaves each volley up (its attack frames, owner 2026-11-21).
          if (targets.length) {
            sim.anim(m.id, 'attack', { duration: 0.25 });
            sim.sfx('heart_meteor', m.x, m.z);
          }
          for (const p of targets) {
            this.add(sim, { id: sim.nextHazardId(), k: 'meteor', x: p.x, z: p.z, start: sim.time, hit: sim.time + ph.meteorWarn, r: METEOR.radius * this.growth(sim.time) });
          }
        },
      });
    }
    return (METEOR.count - 1) * METEOR.every + ph.meteorWarn;
  }

  private startRings(sim: Sim, m: Monster, t: number, ph: HeartPhase): number {
    const maxR = arenaRadius(sim.zone);
    const base = Math.random() * Math.PI * 2;
    const step = (Math.PI * 2) / RING.gaps;
    for (let i = 0; i < RING.count; i++) {
      this.timers.push({
        at: t + i * ph.ringEvery,
        fn: () => {
          // Each wave's gaps sit halfway between the last one's, so standing still never works twice.
          const gaps = Array.from({ length: RING.gaps }, (_, g) => base + g * step + (i * step) / 2);
          sim.anim(m.id, 'attack', { duration: ph.ringWarn });
          sim.sfx('heart_ring', m.x, m.z);
          this.add(sim, {
            id: sim.nextHazardId(), k: 'ring', x: m.x, z: m.z, start: sim.time, hit: sim.time + ph.ringWarn,
            speed: RING.speed, width: RING.width * this.growth(sim.time), maxR, gaps, gapArc: RING.gapArc,
          });
        },
      });
    }
    return (RING.count - 1) * ph.ringEvery + ph.ringWarn + maxR / RING.speed;
  }

  private startBeams(sim: Sim, m: Monster, t: number, ph: HeartPhase): number {
    const hit = t + ph.beamWarn;
    sim.anim(m.id, 'attack', { duration: ph.beamWarn });
    sim.sfx('heart_beam', m.x, m.z);
    this.add(sim, {
      id: sim.nextHazardId(), k: 'beams', x: m.x, z: m.z, start: t, hit, end: hit + BEAMS.duration,
      a0: Math.random() * Math.PI * 2, spin: ph.beamSpin * (Math.random() < 0.5 ? -1 : 1),
      n: BEAMS.count, len: arenaRadius(sim.zone), width: BEAMS.width * this.growth(t),
    });
    return ph.beamWarn + BEAMS.duration;
  }

  private startBlast(sim: Sim, m: Monster, t: number, ph: HeartPhase): number {
    sim.anim(m.id, 'attack', { duration: ph.blastWarn });
    sim.sfx('heart_charge', m.x, m.z);
    const b = currentBalance();
    const ring = () => {
      const a0 = Math.random() * Math.PI * 2;
      return Array.from({ length: BLAST.spots }, (_, i) => {
        const a = a0 + (i * Math.PI * 2) / BLAST.spots;
        return { x: m.x + Math.cos(a) * BLAST.spotAt, z: m.z + Math.sin(a) * BLAST.spotAt };
      });
    };
    const scattered = !b.heartBlastRandom ? null : pickBlastSpots({
      cx: m.x, cz: m.z, arenaR: arenaRadius(sim.zone), spots: Math.max(1, Math.round(b.heartBlastSpots)), safeR: BLAST.safeR,
      minDist: b.heartBlastMinDist,
      players: sim.players.filter((p) => this.inArena(sim, m, p)).map((p) => ({ x: p.x, z: p.z, speed: p.moveSpeed })),
      warn: ph.blastWarn, reach: b.heartBlastReach,
      bad: (x, z) => sim.terrain.isBlocked(x, z, 1) || sim.terrain.onLava(x, z),
      rand: Math.random,
    });
    const safe = scattered ?? ring();
    this.add(sim, { id: sim.nextHazardId(), k: 'blast', x: m.x, z: m.z, start: t, hit: t + ph.blastWarn, r: clearingRadius(sim.zone), safe, safeR: BLAST.safeR });
    return ph.blastWarn;
  }

  /** Lands whatever is due and drops what has finished. */
  private resolve(sim: Sim, m: Monster, t: number): void {
    if (!this.active.length) return;
    const before = this.active.length;
    this.active = this.active.filter((a) => {
      if (t < a.h.hit) return true;
      switch (a.h.k) {
        case 'meteor': return this.landMeteor(sim, m, a.h);
        case 'ring': return this.rollRing(sim, m, a, a.h, t);
        case 'beams': return this.turnBeams(sim, m, a, a.h, t);
        case 'blast': return this.landBlast(sim, m, a.h);
        default: return false;
      }
    });
    if (this.active.length !== before) sim.hazards = this.active.map((a) => a.h);
  }

  private landMeteor(sim: Sim, m: Monster, h: MeteorHazard): boolean {
    sim.fx('ring', h.x, h.z, h.r, '#ffb070', 0.4);
    sim.fx('burst', h.x, 0.3, h.z, '#ff8a3a', 10, 4);
    sim.fx('effect', 'boss_heart_impact', h.x, h.z, 0, h.r * 1.1);
    for (const p of sim.players) {
      if (this.inArena(sim, m, p) && Math.hypot(p.x - h.x, p.z - h.z) <= h.r + p.radius) sim.hitPlayer(m, p, METEOR.mult * this.growth(sim.time), { maxHpShare: HEART_HP_SHARE });
    }
    return false;
  }

  private rollRing(sim: Sim, m: Monster, a: Active, h: RingHazard, t: number): boolean {
    const rr = ringRadiusAt(h, t);
    for (const p of sim.players) {
      if (!this.inArena(sim, m, p) || a.hitIds.has(p.id)) continue;
      const dx = p.x - h.x;
      const dz = p.z - h.z;
      if (Math.abs(Math.hypot(dx, dz) - rr) > h.width / 2 + p.radius) continue;
      if (inRingGap(h, Math.atan2(dz, dx))) continue;
      a.hitIds.add(p.id);
      sim.hitPlayer(m, p, RING.mult * this.growth(sim.time), { maxHpShare: HEART_HP_SHARE });
    }
    return rr < h.maxR;
  }

  private turnBeams(sim: Sim, m: Monster, a: Active, h: BeamsHazard, t: number): boolean {
    for (const p of sim.players) {
      if (!this.inArena(sim, m, p) || (a.nextHit.get(p.id) ?? 0) > t) continue;
      const dx = p.x - h.x;
      const dz = p.z - h.z;
      for (let i = 0; i < h.n; i++) {
        const ang = beamAngleAt(h, i, t);
        const along = dx * Math.cos(ang) + dz * Math.sin(ang);
        const across = Math.abs(-dx * Math.sin(ang) + dz * Math.cos(ang));
        if (along < 0 || along > h.len || across > h.width / 2 + p.radius) continue;
        a.nextHit.set(p.id, t + BEAMS.hitEvery);
        sim.hitPlayer(m, p, BEAMS.mult * this.growth(sim.time), { maxHpShare: HEART_HP_SHARE });
        break;
      }
    }
    return t < h.end;
  }

  private landBlast(sim: Sim, m: Monster, h: BlastHazard): boolean {
    sim.fx('ring', h.x, h.z, h.r, '#ff7a3a', 0.6);
    sim.fx('disc', h.x, h.z, h.r, '#ff5a2a', 0.5);
    sim.fx('burst', h.x, 0.5, h.z, '#ffb070', 30, 9);
    sim.fx('effect', 'boss_heart_blast', h.x, h.z, 0, Math.min(7, h.r * 0.55));
    sim.shake(0.6, h);
    for (const p of sim.players) {
      if (!this.inArena(sim, m, p) || Math.hypot(p.x - h.x, p.z - h.z) > h.r) continue;
      if (h.safe.some((s) => Math.hypot(p.x - s.x, p.z - s.z) <= h.safeR)) continue;
      sim.hitPlayer(m, p, BLAST.mult * this.growth(sim.time), { maxHpShare: HEART_HP_SHARE });
    }
    return false;
  }
}

/** The slowest a player can walk: what every warning time has to leave room for. */
export const DODGE_SPEED = BASE_MOVE_SPEED;
