import type * as THREE from 'three';
import type { Game } from '../Game';
import type { Player } from './Player';
import type { Monster } from './Monster';

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
}

export class Projectile {
  dead = false;
  private x: number;
  private z: number;
  private readonly dx: number;
  private readonly dz: number;
  private traveled = 0;
  private readonly sprite: THREE.Sprite;
  private readonly hit = new Set<Monster>();

  constructor(private readonly g: Game, private readonly owner: Player, private readonly o: ProjOpts) {
    this.x = o.x;
    this.z = o.z;
    this.dx = Math.cos(o.angle);
    this.dz = Math.sin(o.angle);
    this.sprite = g.fx.glowSprite(o.color, o.size);
    this.sprite.position.set(this.x, 0.85, this.z);
    g.scene.add(this.sprite);
  }

  update(dt: number): void {
    if (this.dead) return;
    const step = this.o.speed * dt;
    this.x += this.dx * step;
    this.z += this.dz * step;
    this.traveled += step;
    this.sprite.position.set(this.x, 0.85, this.z);
    if (Math.random() < 0.5) this.g.fx.puff(this.x, 0.85, this.z, this.o.color, 0.18, this.o.size * 0.6);

    for (const m of this.g.monsters) {
      if (!m.alive || this.hit.has(m)) continue;
      if (Math.hypot(m.x - this.x, m.z - this.z) < this.o.radius + m.radius) {
        if (this.o.pierce) {
          this.hit.add(m);
          this.g.hitMonster(this.owner, m, this.o.mult, { kb: this.o.kb ?? 2, fromX: this.x - this.dx, fromZ: this.z - this.dz });
          this.g.fx.burst(this.x, 0.85, this.z, this.o.color, 4, 3);
          continue;
        }
        return this.impact(m);
      }
    }
    if (this.traveled >= this.o.range) {
      if (this.o.explode) this.impact(null);
      else this.die();
    }
  }

  private impact(m: Monster | null): void {
    const g = this.g;
    if (this.o.explode) {
      const r = this.o.explode;
      g.fx.disc(this.x, this.z, r, this.o.color, 0.3);
      g.fx.ring(this.x, this.z, r, '#ffd28a', 0.35);
      g.fx.burst(this.x, 0.8, this.z, this.o.color, 12, 5);
      for (const t of g.monsters) {
        if (t.alive && Math.hypot(t.x - this.x, t.z - this.z) <= r + t.radius) {
          g.hitMonster(this.owner, t, this.o.mult, { kb: 4, fromX: this.x, fromZ: this.z });
        }
      }
    } else if (m) {
      g.hitMonster(this.owner, m, this.o.mult, { kb: this.o.kb ?? 2, fromX: this.x - this.dx, fromZ: this.z - this.dz });
      g.fx.burst(this.x, 0.85, this.z, this.o.color, 5, 3);
    }
    this.die();
  }

  die(): void {
    this.dead = true;
    this.g.scene.remove(this.sprite);
    this.sprite.material.dispose();
  }
}
