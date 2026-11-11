// The Bog Witch's spells (owner 2026-11-10, retuned 2026-11-12): poison vials that always hit and leave
// slowing pools, mud hands that grab, and a curse that follows everyone and turns whoever is still in it
// into a toad. She still walks, hits and slams like other bosses; these come on top, one every SPELL_GAP
// seconds (twice as often once her frenzy starts). Like the Volcano Heart's attacks, they go out as plain
// data in `Sim.hazards`, so every player sees the same thing at the same moment.
import type { HazardBase } from './volcanoHeart';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';

/**
 * A vial thrown at player `pid`: it follows them and lands on their head at `hit` (it can't be dodged),
 * then leaves a pool there.
 */
export interface VialHazard extends HazardBase { k: 'vial'; pid: number; fromX: number; fromZ: number; r: number }
/** Poison on the ground from `hit` until `end`: hurts whoever stands in it once a second, and slows them. */
export interface PoolHazard extends HazardBase { k: 'pool'; r: number; end: number }
/** A mud hand bursting up at `hit`: hurts and holds whoever stands on it. Drawn until `end`. */
export interface GraspHazard extends HazardBase { k: 'grasp'; r: number; end: number }
/**
 * A curse on player `pid`: the circle follows them until `lock`, then stays where they last were and
 * flashes; still inside it at `hit`, they become a toad.
 */
export interface HexHazard extends HazardBase { k: 'hex'; r: number; pid: number; lock: number }
export type WitchHazard = VialHazard | PoolHazard | GraspHazard | HexHazard;

/** Seconds between spells (a random time in this range), times her frenzy's `skill` once enraged. */
export const SPELL_GAP: [number, number] = [8, 12];
/** Seconds before the first spell of a fight. */
const FIRST_SPELL = 3;
/** Players farther than this from her are left alone. */
export const SPELL_RANGE = 16;

/** Damage numbers are times her ATK, so keys (×ATK) make them stronger too. */
export const VIAL = { flight: 0.5, hitMult: 0.4, radius: 3.6, poolTime: 5, tickEvery: 1, mult: 0.4, slow: 0.3, slowFor: 0.3 };
/** One hand under each player and `extra` more around them, `spread` away at most. */
export const GRASP = { warn: 0.5, radius: 1.4, mult: 1.2, hold: 1.5, show: 0.8, extra: 4, spread: 4 };
export const HEX = { follow: 2, flash: 0.5, radius: 2.2, toad: 2 };

type Spell = 'vial' | 'grasp' | 'hex';
const ORDER: Spell[] = ['vial', 'grasp', 'hex'];

interface Active {
  h: WitchHazard;
  nextHit: Map<number, number>;
  /** Mud hands of one cast share this, so a player caught by two is hurt once. */
  cast?: Set<number>;
}

export class WitchSpells {
  /** Counts down with the boss's other skill timers (Monster.update), so ramp and frenzy speed it up. */
  cd = FIRST_SPELL;
  private next = 0;
  private active: Active[] = [];

  /** Players she may target: alive, near and not in town. */
  private targets(sim: Sim, m: Monster): Player[] {
    return sim.players.filter((p) => p.alive && !sim.inSafe(p) && Math.hypot(p.x - m.x, p.z - m.z) <= SPELL_RANGE);
  }

  private add(sim: Sim, h: WitchHazard, cast?: Set<number>): void {
    this.active.push({ h, nextHit: new Map(), cast });
    this.publish(sim);
  }

  private publish(sim: Sim): void {
    sim.hazards = this.active.map((a) => a.h);
  }

  /** Fight over (she went home, reset or died): nothing of hers stays on the ground. */
  clear(sim: Sim): void {
    if (!this.active.length) return;
    this.active = [];
    this.publish(sim);
  }

  /** Back to the start of a fight. */
  reset(sim: Sim): void {
    this.clear(sim);
    this.cd = FIRST_SPELL;
    this.next = 0;
  }

  /** Every tick, even while she is stunned or winding up: what is on the ground keeps working. */
  update(sim: Sim, m: Monster): void {
    if (!this.active.length) return;
    const t = sim.time;
    const before = this.active.length;
    const added: Active[] = [];
    const player = (id: number) => sim.players.find((x) => x.id === id && x.alive);
    this.active = this.active.filter((a) => {
      const h = a.h;
      // Vials and curses follow their player (the vial all the way, the curse until it locks).
      if (h.k === 'vial' || (h.k === 'hex' && t < h.lock)) {
        const p = player(h.pid);
        if (p) {
          h.x = p.x;
          h.z = p.z;
        }
      }
      if (t < h.hit) return true;
      switch (h.k) {
        case 'vial': {
          sim.fx('burst', h.x, 0.3, h.z, '#7aff6a', 10, 3);
          sim.sfx('boss_slam', h.x, h.z);
          const p = player(h.pid);
          if (p) sim.hitPlayer(m, p, VIAL.hitMult, {});
          added.push({ h: { id: sim.nextHazardId(), k: 'pool', x: h.x, z: h.z, start: h.hit, hit: h.hit, r: h.r, end: h.hit + VIAL.poolTime }, nextHit: new Map() });
          return false;
        }
        case 'pool':
          for (const p of sim.players) {
            if (!p.alive || Math.hypot(p.x - h.x, p.z - h.z) > h.r + p.radius) continue;
            // Slowed while standing in it (and a moment after stepping out).
            p.slowAmt = Math.max(p.slowT > 0 ? p.slowAmt : 0, VIAL.slow);
            p.slowT = Math.max(p.slowT, VIAL.slowFor);
            if ((a.nextHit.get(p.id) ?? 0) > t) continue;
            a.nextHit.set(p.id, t + VIAL.tickEvery);
            sim.hitPlayer(m, p, VIAL.mult, {});
          }
          return t < h.end;
        case 'grasp':
          if (!a.nextHit.has(0)) {
            a.nextHit.set(0, t);
            sim.fx('burst', h.x, 0.4, h.z, '#6a4a2a', 12, 4);
            sim.sfx('boss_slam', h.x, h.z);
            for (const p of sim.players) {
              if (!p.alive || a.cast?.has(p.id) || Math.hypot(p.x - h.x, p.z - h.z) > h.r + p.radius) continue;
              a.cast?.add(p.id);
              const hurt = p.invulnT <= 0 && !sim.inSafe(p);
              sim.hitPlayer(m, p, GRASP.mult, {});
              if (hurt && p.alive) {
                p.snareT = Math.max(p.snareT, GRASP.hold);
                sim.text(p.x, p.topY + 0.4, p.z, 'ติดโคลน!', 'info', 0.8);
              }
            }
          }
          return t < h.end;
        case 'hex': {
          const p = player(h.pid);
          if (p && p.invulnT <= 0 && !sim.inSafe(p) && Math.hypot(p.x - h.x, p.z - h.z) <= h.r) {
            p.stunT = Math.max(p.stunT, HEX.toad);
            p.toadT = Math.max(p.toadT, HEX.toad);
            p.interruptPotions();
            sim.cancelReturnCast(p, 'โดนสาป');
            sim.fx('burst', p.x, 1, p.z, '#9a7aff', 16, 4);
            sim.text(p.x, p.topY + 0.4, p.z, 'กลายเป็นคางคก!', 'info', 1.2);
          } else {
            sim.fx('ring', h.x, h.z, h.r, '#9a7aff', 0.4);
          }
          return false;
        }
      }
    });
    this.active.push(...added);
    if (this.active.length !== before || added.length) this.publish(sim);
  }

  /** Casts the next spell in turn at everyone near. Returns false when nobody is. */
  cast(sim: Sim, m: Monster, _target: Player | null): boolean {
    const near = this.targets(sim, m);
    if (!near.length) return false;
    const spell = ORDER[this.next % ORDER.length];
    this.next++;
    const t = sim.time;
    if (spell === 'vial') {
      // One at each player, landing on their head however they run.
      for (const p of near) {
        this.add(sim, { id: sim.nextHazardId(), k: 'vial', pid: p.id, x: p.x, z: p.z, fromX: m.x, fromZ: m.z, start: t, hit: t + VIAL.flight, r: VIAL.radius });
      }
      sim.text(m.x, m.topY + 0.6, m.z, 'ขวดยาพิษ!', 'info', 1);
    } else if (spell === 'grasp') {
      // One under each player and a few more around them, to catch the way out.
      const caught = new Set<number>();
      for (const p of near) {
        const spots = [{ x: p.x, z: p.z }];
        for (let i = 0; i < GRASP.extra; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = GRASP.radius + Math.random() * (GRASP.spread - GRASP.radius);
          spots.push({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d });
        }
        for (const s of spots) {
          this.add(sim, { id: sim.nextHazardId(), k: 'grasp', x: s.x, z: s.z, start: t, hit: t + GRASP.warn, r: GRASP.radius, end: t + GRASP.warn + GRASP.show }, caught);
        }
      }
      sim.text(m.x, m.topY + 0.6, m.z, 'มือโคลนดูด!', 'info', 1);
    } else {
      // A curse on everyone: it follows them, then stops and flashes, then lands. Dash out when it flashes.
      for (const p of near) {
        this.add(sim, { id: sim.nextHazardId(), k: 'hex', x: p.x, z: p.z, start: t, lock: t + HEX.follow, hit: t + HEX.follow + HEX.flash, r: HEX.radius, pid: p.id });
      }
      sim.text(m.x, m.topY + 0.6, m.z, 'คำสาปคางคก!', 'info', 1);
    }
    return true;
  }
}
