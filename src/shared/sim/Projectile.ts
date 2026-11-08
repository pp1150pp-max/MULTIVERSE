import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import type { HitOpts, SkillEffect } from './types';

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
  pierce?: boolean;
  kb?: number;
  /** Extra hit options for a single-target shot (crit, armor break, ...). */
  hit?: HitOpts;
  /** Drawn on the target when this single-target shot lands, instead of the small burst. */
  hitFx?: { name: SkillEffect; size: number };
  /** Monster shots: the picture to draw. Player shots leave this out. */
  art?: 'ice_shard' | 'snowball' | 'ember_bolt';
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
        return;
      }
    }
    if (this.traveled >= this.o.range) {
      sim.fx('burst', this.x, 0.4, this.z, this.o.color, 4, 2);
      this.dead = true;
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

  constructor(readonly id: number, private readonly sim: Sim, private readonly owner: Player, readonly o: ProjOpts) {
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

    for (const m of sim.monsters) {
      if (!m.alive || this.hit.has(m)) continue;
      if (Math.hypot(m.x - this.x, m.z - this.z) < this.o.radius + m.radius) {
        if (this.o.pierce) {
          this.hit.add(m);
          sim.hitMonster(this.owner, m, this.o.mult, { kb: this.o.kb ?? 2, fromX: this.x - this.dx, fromZ: this.z - this.dz });
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
      sim.fx('effect', 'explosion', this.x, this.z, 0, r);
      for (const t of sim.monsters) {
        if (t.alive && Math.hypot(t.x - this.x, t.z - this.z) <= r + t.radius) {
          sim.hitMonster(this.owner, t, this.o.mult, { kb: 4, fromX: this.x, fromZ: this.z });
        }
      }
    } else if (m) {
      sim.hitMonster(this.owner, m, this.o.mult, { kb: this.o.kb ?? 2, fromX: this.x - this.dx, fromZ: this.z - this.dz, ...this.o.hit });
      if (this.o.hitFx) sim.fx('effect', this.o.hitFx.name, m.x, m.z, this.o.angle, this.o.hitFx.size);
      else sim.fx('burst', this.x, 0.85, this.z, this.o.color, 5, 3);
    }
    this.dead = true;
  }
}
