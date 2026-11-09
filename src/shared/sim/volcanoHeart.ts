// The Volcano Heart: a boss that never moves and fights only with ground attacks, each warned of
// first. The server decides everything; `Sim.hazards` goes out in snapshots as plain data, so every
// player (late arrivals too) draws the same attack at the same moment.
import { BASE_MOVE_SPEED } from '../formulas';
import { arenaRadius, clearingRadius } from '../data/zones';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';

interface HazardBase {
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
export type Hazard = MeteorHazard | RingHazard | BeamsHazard | BlastHazard;

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
    this.add(sim, {
      id: sim.nextHazardId(), k: 'beams', x: m.x, z: m.z, start: t, hit, end: hit + BEAMS.duration,
      a0: Math.random() * Math.PI * 2, spin: ph.beamSpin * (Math.random() < 0.5 ? -1 : 1),
      n: BEAMS.count, len: arenaRadius(sim.zone), width: BEAMS.width * this.growth(t),
    });
    return ph.beamWarn + BEAMS.duration;
  }

  private startBlast(sim: Sim, m: Monster, t: number, ph: HeartPhase): number {
    const a0 = Math.random() * Math.PI * 2;
    const safe = Array.from({ length: BLAST.spots }, (_, i) => {
      const a = a0 + (i * Math.PI * 2) / BLAST.spots;
      return { x: m.x + Math.cos(a) * BLAST.spotAt, z: m.z + Math.sin(a) * BLAST.spotAt };
    });
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
      }
    });
    if (this.active.length !== before) sim.hazards = this.active.map((a) => a.h);
  }

  private landMeteor(sim: Sim, m: Monster, h: MeteorHazard): boolean {
    sim.fx('ring', h.x, h.z, h.r, '#ffb070', 0.4);
    sim.fx('burst', h.x, 0.3, h.z, '#ff8a3a', 10, 4);
    sim.sfx('boss_slam', h.x, h.z);
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
    sim.shake(0.6, h);
    sim.sfx('boss_slam', h.x, h.z);
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
