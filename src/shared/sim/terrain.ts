// Zone layout and collision, without any rendering. Built from the zone seed, so the browser and
// the server get exactly the same trees, rocks and camp.
import type { ZoneDef } from '../data/zones';
import { NPC_IDS, type NpcId } from '../data/npcs';
import { mulberry32, pick, rand, type Rng } from '../rng';
import type { Vec2 } from '../types';

export interface Collider { x: number; z: number; r: number }
/** One prop to draw. `fade` = turns see-through when the player walks behind it. */
export interface PropSpec { key: string; x: number; z: number; height: number; fade: boolean }
type Seg = [number, number, number, number];

export class Terrain {
  readonly half: number;
  readonly bound: number;
  readonly colliders: Collider[] = [];
  readonly props: PropSpec[] = [];
  readonly npcPos = {} as Record<NpcId, Vec2>;
  private readonly segs: Seg[] = [];

  constructor(readonly zone: ZoneDef) {
    this.half = zone.half;
    this.bound = zone.half - 8;
    for (const line of [zone.path, ...zone.branches]) {
      for (let i = 1; i < line.length; i++) this.segs.push([line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]]);
    }
    this.placeProps(mulberry32(zone.seed + 1));
    for (const id of NPC_IDS) this.colliders.push({ ...this.npcPos[id], r: 0.45 });
  }

  get pathSegments(): readonly Seg[] {
    return this.segs;
  }

  distToPath(x: number, z: number): number {
    let best = Infinity;
    for (const [ax, az, bx, bz] of this.segs) {
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
      if (d < best) best = d;
    }
    return best;
  }

  isBlocked(x: number, z: number, r: number): boolean {
    if (Math.abs(x) > this.bound || Math.abs(z) > this.bound) return true;
    return this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r);
  }

  /** Push a circle out of static colliders and keep it inside the zone. */
  resolve(u: { x: number; z: number; radius: number }): void {
    for (const c of this.colliders) {
      const dx = u.x - c.x;
      const dz = u.z - c.z;
      const min = c.r + u.radius;
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001;
        const push = (min - d) / d;
        u.x += dx * push;
        u.z += dz * push;
      }
    }
    u.x = Math.max(-this.bound, Math.min(this.bound, u.x));
    u.z = Math.max(-this.bound, Math.min(this.bound, u.z));
  }

  private addProp(key: string, x: number, z: number, height: number, collideR: number, fade = false): void {
    this.props.push({ key, x, z, height, fade });
    if (collideR > 0) this.colliders.push({ x, z, r: collideR });
  }

  private addTree(r: Rng, x: number, z: number): void {
    this.addProp(pick(r, ['tree_0', 'tree_1', 'tree_2']), x, z, rand(r, 4.6, 6.4), 0.55, true);
  }

  private placeProps(r: Rng): void {
    const zone = this.zone;
    const H = this.half;
    const B = this.bound;
    const near = (x: number, z: number, p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) < d;

    // Dense forest wall around the playable area.
    for (let x = -H + 1; x <= H - 1; x += 2.6) {
      for (let z = -H + 1; z <= H - 1; z += 2.6) {
        if (Math.max(Math.abs(x), Math.abs(z)) < B - 1) continue;
        this.addTree(r, x + rand(r, -1, 1), z + rand(r, -1, 1));
      }
    }

    // Camp at the start point, with the NPCs.
    const s = zone.start;
    this.addProp('tent', s.x + 3, s.z - 4, 3, 1.4);
    this.addProp('tent', s.x - 4, s.z + 3, 3, 1.4);
    this.addProp('campfire', s.x, s.z, 1, 0.5);
    this.addProp('sign', s.x - 5, s.z - 6.5, 1.4, 0.2);
    this.addProp('runestone', s.x + 5, s.z + 3.5, 2.2, 0.5);
    this.npcPos.seeker = { x: s.x + 3.5, z: s.z + 1.5 };
    this.npcPos.merchant = { x: s.x - 1.5, z: s.z + 5 };
    this.npcPos.blacksmith = { x: s.x + 5, z: s.z - 1.5 };
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
      const fx = s.x + Math.cos(a) * 9;
      const fz = s.z + Math.sin(a) * 9;
      if (this.distToPath(fx, fz) < 3 || Math.abs(fx) > B || Math.abs(fz) > B) continue;
      this.addProp('fence', fx, fz, 1.1, 0.6);
    }

    // Boss clearing ring of runestones.
    const b = zone.boss;
    for (let a = 0.3; a < Math.PI * 2; a += Math.PI / 4) {
      this.addProp(a % 2 > 1 ? 'rock_1' : 'runestone', b.x + Math.cos(a) * 11, b.z + Math.sin(a) * 11, 2.2, 0.6);
    }

    // Scattered forest inside.
    let placed = 0;
    for (let i = 0; i < 1600 && placed < 280; i++) {
      const x = rand(r, -B + 2, B - 2);
      const z = rand(r, -B + 2, B - 2);
      if (this.distToPath(x, z) < 3.2) continue;
      if (near(x, z, s, 11) || near(x, z, b, 13)) continue;
      if (zone.spawns.some((sp) => near(x, z, sp, sp.radius * 0.55))) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < 2.2)) continue;
      const roll = r();
      if (roll < 0.55) this.addTree(r, x, z);
      else if (roll < 0.8) this.addProp(pick(r, ['bush_0', 'bush_1']), x, z, rand(r, 0.9, 1.3), 0);
      else if (roll < 0.93) this.addProp(pick(r, ['rock_0', 'rock_1']), x, z, rand(r, 0.7, 1.1), 0.5);
      else this.addProp('stump', x, z, 0.8, 0.4);
      placed++;
    }
  }
}
