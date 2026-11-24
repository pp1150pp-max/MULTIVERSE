import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import type { HitOpts, SkillEffect } from './types';
import type { ShotArt } from '../data/monsters';

export interface ProjOpts {
  x: number;
  z: number;
  angle: number;
  speed: number;
  range: number;
  radius: number;
  mult: number;
  color: string;
  size: number;
  /** > 0 = explodes in this radius instead of hitting a single target. */
  explode?: number;
  /**
   * Player shots that explode (Volatile Orb, owner 2026-11-20): > 0 = the orb does not go off on the first normal monster
   * it meets. Normal monsters within this many metres of its edge are swept along with it and go off with it at the
   * end of its range. A boss (or a scripted-pattern monster) still stops it at once.
   */
  carry?: number;
  pierce?: boolean;
  kb?: number;
  /** Extra hit options for a single-target shot (crit, armor break, ...). */
  hit?: HitOpts;
  /** Drawn on the target when this single-target shot lands, instead of the small burst. */
  hitFx?: { name: SkillEffect; size: number };
  /** Monster shots: the picture to draw. Player shots leave this out. */
  art?: ShotArt;
  /** Monster shots: runs where it ends, on a player or at the end of its flight (a ghost monkey's curse ring). */
  onEnd?: (x: number, z: number) => void;
  /** Player shots: extra damage multiplier (× ATK) on this target, worked out as it lands (execute, stacks, weak spots). */
  bonus?: (m: Monster) => number;
  /** Player shots: runs after a single-target or piercing hit lands on `m` (bounces, burning, marks). */
  after?: (m: Monster) => void;
  /** Player shots that explode: the blast picture (the fireball's 'explosion' if left out). */
  blastFx?: SkillEffect;
  /** Also show the Special Ammo passive's ring on the blast (Gunslinger). */
  specialFx?: boolean;
  /**
   * Player shots: the skill its effects are tagged with when `hit.skill` is left out (that one also feeds damage
   * passives). Visual only: the client's three.quarks particles (src/client/quarksFx.ts) pick the skill by it.
   */
  fxSkill?: string;
}

/** A monster's shot: flies straight until it hits a player or runs out of range, so it can be dodged. */
export class EnemyShot {
  dead = false;
  x: number;
  z: number;
  private readonly dx: number;
  private readonly dz: number;
  private traveled = 0;

  constructor(readonly id: number, private readonly sim: Sim, private readonly owner: Monster, readonly o: ProjOpts) {
    this.x = o.x;
    this.z = o.z;
    this.dx = Math.cos(o.angle);
    this.dz = Math.sin(o.angle);
  }

  update(dt: number): void {
    if (this.dead) return;
    const sim = this.sim;
    const step = this.o.speed * dt;
    this.x += this.dx * step;
    this.z += this.dz * step;
    this.traveled += step;
    for (const p of sim.players) {
      if (p.alive && Math.hypot(p.x - this.x, p.z - this.z) < this.o.radius + p.radius) {
        sim.hitPlayer(this.owner, p, this.o.mult, { kb: this.o.kb ?? 2, fromX: this.x - this.dx, fromZ: this.z - this.dz });
        sim.fx('burst', this.x, 0.85, this.z, this.o.color, 7, 3);
        this.dead = true;
        this.o.onEnd?.(this.x, this.z);
        return;
      }
    }
    if (this.traveled >= this.o.range) {
      sim.fx('burst', this.x, 0.4, this.z, this.o.color, 4, 2);
      this.dead = true;
      this.o.onEnd?.(this.x, this.z);
    }
  }
}

export class Projectile {
  dead = false;
  x: number;
  z: number;
  private readonly dx: number;
  private readonly dz: number;
  private traveled = 0;
  private readonly hit = new Set<Monster>();
  /** Monsters swept along by a carrying orb. */
  private readonly carried = new Set<Monster>();

  constructor(readonly id: number, private readonly sim: Sim, private readonly owner: Player, readonly o: ProjOpts) {
    this.x = o.x;
    this.z = o.z;
    this.dx = Math.cos(o.angle);
    this.dz = Math.sin(o.angle);
  }

  update(dt: number): void {
    // A player's shot: its blast and hits are that player's doing (Sim.asCaster).
    this.sim.asCaster(this.owner, () => this.fly(dt), this.o.fxSkill ?? this.o.hit?.skill?.id);
  }

  private fly(dt: number): void {
    if (this.dead) return;
    const sim = this.sim;
    const step = this.o.speed * dt;
    this.x += this.dx * step;
    this.z += this.dz * step;
    this.traveled += step;
    const carry = this.o.explode ? (this.o.carry ?? 0) : 0;
    if (carry > 0) {
      // Swept monsters move with the orb and stand still on their own feet meanwhile.
      for (const m of this.carried) {
        if (!m.alive) {
          this.carried.delete(m);
          continue;
        }
        m.x += this.dx * step;
        m.z += this.dz * step;
        sim.terrain.resolve(m);
        m.pinnedUntil = Math.max(m.pinnedUntil, sim.time + 0.2);
      }
    }

    for (const m of sim.monsters) {
      if (!m.alive || this.hit.has(m)) continue;
      if (carry > 0 && !m.isBoss && !m.def.pattern) {
        if (this.carried.has(m)) continue;
        if (Math.hypot(m.x - this.x, m.z - this.z) < this.o.radius + carry + m.radius) this.carried.add(m);
        continue;
      }
      if (Math.hypot(m.x - this.x, m.z - this.z) < this.o.radius + m.radius) {
        if (this.o.pierce) {
          this.hit.add(m);
          const mult = this.o.mult + (this.o.bonus?.(m) ?? 0);
          sim.hitMonster(this.owner, m, mult, { kb: this.o.kb ?? 2, fromX: this.x - this.dx, fromZ: this.z - this.dz, ...this.o.hit });
          this.o.after?.(m);
          sim.fx('burst', this.x, 0.85, this.z, this.o.color, 4, 3);
          continue;
        }
        return this.impact(m);
      }
    }
    if (this.traveled >= this.o.range) {
      if (this.o.explode) this.impact(null);
      else this.dead = true;
    }
  }

  private impact(m: Monster | null): void {
    const sim = this.sim;
    if (this.o.explode) {
      const r = this.o.explode;
      sim.fx('effect', this.o.blastFx ?? 'explosion', this.x, this.z, 0, r);
      if (this.o.specialFx) sim.fx('effect', 'gs_special', this.x, this.z, 0, r);
      for (const t of sim.monsters) {
        if (t.alive && Math.hypot(t.x - this.x, t.z - this.z) <= r + t.radius) {
          sim.hitMonster(this.owner, t, this.o.mult, { kb: 4, fromX: this.x, fromZ: this.z, ...this.o.hit });
        }
      }
    } else if (m) {
      const mult = this.o.mult + (this.o.bonus?.(m) ?? 0);
      // A carrier shot (mult 0) only delivers its after() (a mark that goes off later).
      if (mult > 0) sim.hitMonster(this.owner, m, mult, { kb: this.o.kb ?? 2, fromX: this.x - this.dx, fromZ: this.z - this.dz, ...this.o.hit });
      this.o.after?.(m);
      if (this.o.hitFx) sim.fx('effect', this.o.hitFx.name, m.x, m.z, this.o.angle, this.o.hitFx.size);
      else sim.fx('burst', this.x, 0.85, this.z, this.o.color, 5, 3);
    }
    this.dead = true;
  }
}
