// The Bog Witch's spells (owner 2026-11-10): poison vials that leave pools, mud hands that grab, and a
// curse that turns a player into a toad. Each one is warned of on the ground first and can be dodged.
// She still walks, hits and slams like other bosses; these come on top, one every SPELL_GAP seconds
// (twice as often once her frenzy starts). Like the Volcano Heart's attacks, they go out as plain data
// in `Sim.hazards`, so every player sees the same thing at the same moment.
import type { HazardBase } from './volcanoHeart';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';

/** A vial in the air: lands on (x, z) at `hit` and leaves a pool there. */
export interface VialHazard extends HazardBase { k: 'vial'; fromX: number; fromZ: number; r: number }
/** Poison on the ground from `hit` until `end`: hurts whoever stands in it, once a second. */
export interface PoolHazard extends HazardBase { k: 'pool'; r: number; end: number }
/** A mud hand bursting up at `hit`: hurts and holds whoever stands on it. Drawn until `end`. */
export interface GraspHazard extends HazardBase { k: 'grasp'; r: number; end: number }
/** A curse on player `pid`: still inside the circle at `hit`, they become a toad. */
export interface HexHazard extends HazardBase { k: 'hex'; r: number; pid: number }
export type WitchHazard = VialHazard | PoolHazard | GraspHazard | HexHazard;

/** Seconds between spells (a random time in this range), times her frenzy's `skill` once enraged. */
export const SPELL_GAP: [number, number] = [8, 12];
/** Seconds before the first spell of a fight. */
const FIRST_SPELL = 3;
/** Players farther than this from her are left alone. */
export const SPELL_RANGE = 16;

/** Damage numbers are times her ATK, so keys (×ATK) make them stronger too. */
export const VIAL = { count: 3, flight: 1, radius: 1.8, poolTime: 5, tickEvery: 1, mult: 0.4, spread: 3 };
export const GRASP = { warn: 1.2, radius: 1.4, mult: 1.2, hold: 1.5, show: 0.8 };
export const HEX = { warn: 2, radius: 2.2, toad: 2 };

type Spell = 'vial' | 'grasp' | 'hex';
const ORDER: Spell[] = ['vial', 'grasp', 'hex'];

interface Active {
  h: WitchHazard;
  nextHit: Map<number, number>;
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

  private add(sim: Sim, h: WitchHazard): void {
    this.active.push({ h, nextHit: new Map() });
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
    this.active = this.active.filter((a) => {
      const h = a.h;
      if (t < h.hit) return true;
      switch (h.k) {
        case 'vial':
          sim.fx('burst', h.x, 0.3, h.z, '#7aff6a', 10, 3);
          sim.sfx('boss_slam', h.x, h.z);
          added.push({ h: { id: sim.nextHazardId(), k: 'pool', x: h.x, z: h.z, start: h.hit, hit: h.hit, r: h.r, end: h.hit + VIAL.poolTime }, nextHit: new Map() });
          return false;
        case 'pool':
          for (const p of sim.players) {
            if (!p.alive || (a.nextHit.get(p.id) ?? 0) > t || Math.hypot(p.x - h.x, p.z - h.z) > h.r + p.radius) continue;
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
              if (!p.alive || Math.hypot(p.x - h.x, p.z - h.z) > h.r + p.radius) continue;
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
          const p = sim.players.find((x) => x.id === h.pid);
          if (p?.alive && p.invulnT <= 0 && !sim.inSafe(p) && Math.hypot(p.x - h.x, p.z - h.z) <= h.r) {
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

  /** Casts the next spell in turn at whoever is near. Returns false when nobody is. */
  cast(sim: Sim, m: Monster, target: Player | null): boolean {
    const near = this.targets(sim, m);
    if (!near.length) return false;
    const spell = ORDER[this.next % ORDER.length];
    this.next++;
    const t = sim.time;
    if (spell === 'vial') {
      // One vial at each of up to 3 players; with fewer, the rest land around them.
      const picks = [...near].sort(() => Math.random() - 0.5);
      for (let i = 0; i < VIAL.count; i++) {
        const p = picks[i % picks.length];
        const off = i < picks.length ? 0 : VIAL.spread;
        const a = Math.random() * Math.PI * 2;
        this.add(sim, {
          id: sim.nextHazardId(), k: 'vial', x: p.x + Math.cos(a) * off, z: p.z + Math.sin(a) * off,
          fromX: m.x, fromZ: m.z, start: t, hit: t + VIAL.flight, r: VIAL.radius,
        });
      }
      sim.text(m.x, m.topY + 0.6, m.z, 'ขวดยาพิษ!', 'info', 1);
    } else if (spell === 'grasp') {
      for (const p of near) {
        this.add(sim, { id: sim.nextHazardId(), k: 'grasp', x: p.x, z: p.z, start: t, hit: t + GRASP.warn, r: GRASP.radius, end: t + GRASP.warn + GRASP.show });
      }
      sim.text(m.x, m.topY + 0.6, m.z, 'มือโคลนดูด!', 'info', 1);
    } else {
      const p = target && near.includes(target) ? target : near[Math.floor(Math.random() * near.length)];
      this.add(sim, { id: sim.nextHazardId(), k: 'hex', x: p.x, z: p.z, start: t, hit: t + HEX.warn, r: HEX.radius, pid: p.id });
      sim.text(m.x, m.topY + 0.6, m.z, `สาป ${p.name}!`, 'info', 1);
    }
    return true;
  }
}
