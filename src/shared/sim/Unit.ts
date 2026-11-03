import type { Terrain } from './terrain';

/** Anything that moves, fights and can die. Pure state — the renderer reads it each frame. */
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
  /** Direction the sprite should face, and whether it is walking (renderer hints). */
  faceX = 0;
  faceZ = 1;
  moving = false;

  constructor(readonly id: number) {}

  abstract get maxHp(): number;
  /** Height above ground for nameplates and damage numbers. */
  abstract get topY(): number;

  face(dx: number, dz: number): void {
    if (dx * dx + dz * dz < 1e-6) return;
    this.faceX = dx;
    this.faceZ = dz;
  }

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

  protected tickStatus(dt: number, terrain: Terrain): void {
    this.stunT = Math.max(0, this.stunT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    if (Math.abs(this.kbx) + Math.abs(this.kbz) > 0.05) {
      this.x += this.kbx * dt;
      this.z += this.kbz * dt;
      const decay = Math.exp(-10 * dt);
      this.kbx *= decay;
      this.kbz *= decay;
      terrain.resolve(this);
    } else {
      this.kbx = this.kbz = 0;
    }
  }
}
