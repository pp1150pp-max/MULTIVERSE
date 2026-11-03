import type { Game } from '../Game';
import type { Actor } from '../AnimatedActor';

export abstract class Unit {
  x = 0;
  z = 0;
  radius = 0.4;
  level = 1;
  hp = 1;
  alive = true;
  stunT = 0;
  slowT = 0;
  slowAmt = 0;
  invulnT = 0;
  kbx = 0;
  kbz = 0;

  constructor(readonly actor: Actor) {}

  abstract get maxHp(): number;
  /** Height above ground for nameplates and damage numbers. */
  abstract get topY(): number;

  speedMult(): number {
    return this.slowT > 0 ? 1 - this.slowAmt : 1;
  }

  knockback(fromX: number, fromZ: number, power: number): void {
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.kbx = (dx / d) * power;
    this.kbz = (dz / d) * power;
  }

  protected tickStatus(dt: number, g: Game): void {
    this.stunT = Math.max(0, this.stunT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    if (Math.abs(this.kbx) + Math.abs(this.kbz) > 0.05) {
      this.x += this.kbx * dt;
      this.z += this.kbz * dt;
      const decay = Math.exp(-10 * dt);
      this.kbx *= decay;
      this.kbz *= decay;
      g.world.resolve(this);
    } else {
      this.kbx = this.kbz = 0;
    }
  }

  syncView(): void {
    this.actor.group.position.x = this.x;
    this.actor.group.position.z = this.z;
  }
}
