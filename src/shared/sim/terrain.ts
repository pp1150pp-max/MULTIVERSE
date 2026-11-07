// Zone layout and collision, without any rendering. Built from the zone seed, so the browser and
// the server get exactly the same trees, rocks and camp.
import { arenaRadius, clearingRadius, lavaAt, type ZoneDef, type ZoneTheme } from '../data/zones';
import { NPC_IDS, type NpcId } from '../data/npcs';
import { mulberry32, pick, rand, type Rng } from '../rng';
import type { Vec2 } from '../types';

export interface Collider { x: number; z: number; r: number }
/** One prop to draw. `fade` = turns see-through when the player walks behind it. */
export interface PropSpec { key: string; x: number; z: number; height: number; fade: boolean }
type Seg = [number, number, number, number];

/** Prop keys each theme scatters around. Every key needs an entry in the client's SHEET_SPECS. */
interface ThemeProps {
  trees: string[];
  bushes: string[];
  rocks: string[];
  stump: string;
  tallStump?: string;
  extra: string[];
  /** Rock between the runestones around the boss clearing, and its height. */
  ringRock: [string, number];
  /** Camp decor (well, barrels, cart, …) and pebbles along the paths. */
  campDecor: boolean;
}

const THEME_PROPS: Record<ZoneTheme, ThemeProps> = {
  forest: {
    trees: ['tree_0', 'tree_1', 'tree_2'],
    bushes: ['bush_0', 'bush_1', 'bush_2'],
    rocks: ['rock_0', 'rock_1', 'rock_2'],
    stump: 'stump',
    tallStump: 'stump_tall',
    extra: [],
    ringRock: ['rock_0', 1.5],
    campDecor: true,
  },
  marsh: {
    trees: ['swamp_tree_0', 'swamp_tree_1', 'swamp_tree_2', 'willow'],
    bushes: ['reeds_0', 'reeds_1', 'fern'],
    rocks: ['mossrock_0', 'mossrock_1'],
    stump: 'swamp_stump',
    extra: ['mushrooms'],
    ringRock: ['mossrock_1', 2.2],
    campDecor: false,
  },
  snow: {
    trees: ['snow_pine_0', 'snow_pine_1', 'snow_pine_2', 'frost_tree'],
    bushes: ['snow_shrub_0', 'snow_shrub_1', 'frost_fern'],
    rocks: ['snow_rock_0', 'snow_rock_1'],
    stump: 'snow_stump',
    extra: ['ice_crystal_0', 'ice_crystal_1'],
    ringRock: ['snow_rock_1', 2.2],
    campDecor: false,
  },
  volcano: {
    trees: ['burnt_pillar_0', 'burnt_pillar_1', 'burnt_pillar_2', 'charred_tree'],
    bushes: ['ash_shrub_0', 'ash_shrub_1', 'ember_fern'],
    rocks: ['basalt_0', 'basalt_1'],
    stump: 'charred_stump',
    extra: ['magma_crystal_0', 'magma_crystal_1'],
    ringRock: ['basalt_1', 2.2],
    campDecor: false,
  },
};

/** How close a player has to walk to a portal to use it. */
export const PORTAL_RANGE = 1.4;

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

  /** Frozen lake underfoot? Players slide here (see Player.walkStep). */
  onIce(x: number, z: number): boolean {
    return !!this.zone.iceLakes?.some((l) => Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz) < 1);
  }

  /** Lava underfoot? It burns (see Sim.tickLava). */
  onLava(x: number, z: number): boolean {
    return !!lavaAt(this.zone, x, z);
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

  private get set() {
    return THEME_PROPS[this.zone.theme];
  }

  private addTree(r: Rng, x: number, z: number): void {
    this.addProp(pick(r, this.set.trees), x, z, rand(r, 4.6, 6.4), 0.55, true);
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
    this.addProp('sign', s.x - 5, s.z - 6.5, 2, 0.2);
    this.addProp('runestone', s.x + 5, s.z + 3.5, 2.6, 0.5);
    if (this.set.campDecor) {
      // Camp life: the merchant's stock, the blacksmith's cart, a well and a lookout tower.
      this.addProp('well', s.x - 6, s.z - 1.5, 2, 0.9);
      this.addProp('barrel', s.x - 3.2, s.z + 6.2, 0.9, 0.35);
      this.addProp('barrel', s.x - 0.3, s.z + 6.7, 0.9, 0.35);
      this.addProp('chest', s.x + 0.9, s.z + 6.2, 0.8, 0.45);
      this.addProp('cart', s.x + 6.8, s.z - 3.6, 1.2, 0.8);
      this.addProp('banner_red', s.x + 6.6, s.z + 0.3, 2, 0.2);
      this.addProp('flag', s.x - 2, s.z - 7, 1.8, 0.15);
      this.addProp('watchtower', s.x + 9, s.z - 10, 4.2, 1.1);
    }
    this.npcPos.seeker = { x: s.x + 3.5, z: s.z + 1.5 };
    this.npcPos.merchant = { x: s.x - 1.5, z: s.z + 5 };
    this.npcPos.blacksmith = { x: s.x + 5, z: s.z - 1.5 };
    // A few steps from the merchant, on the other side of the barrels.
    this.npcPos.keeper = { x: s.x - 5, z: s.z + 5.5 };
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
      const fx = s.x + Math.cos(a) * 9;
      const fz = s.z + Math.sin(a) * 9;
      if (this.distToPath(fx, fz) < 3 || Math.abs(fx) > B || Math.abs(fz) > B) continue;
      this.addProp('fence', fx, fz, 1.1, 0.6);
    }

    // Pebbles along the paths (no collision).
    for (const [ax, az, bx, bz] of this.set.campDecor ? this.segs : []) {
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = rand(r, 2, 6); t < len; t += rand(r, 5, 11)) {
        const f = t / len;
        const side = r() < 0.5 ? -1 : 1;
        const off = side * rand(r, 2.6, 3.4);
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        const x = ax + (bx - ax) * f + nx * off;
        const z = az + (bz - az) * f + nz * off;
        if (near(x, z, s, 10) || Math.abs(x) > B || Math.abs(z) > B) continue;
        this.addProp(pick(r, ['pebble_0', 'pebble_1']), x, z, rand(r, 0.3, 0.45), 0);
      }
    }

    // Boss clearing ring of runestones.
    const b = zone.boss;
    const ring = arenaRadius(zone);
    if (zone.bossSolid) this.colliders.push({ x: b.x, z: b.z, r: zone.bossSolid });
    for (let a = 0.3; a < Math.PI * 2; a += Math.PI / 4) {
      const [ringRock, ringH] = this.set.ringRock;
      this.addProp(a % 2 > 1 ? ringRock : 'runestone', b.x + Math.cos(a) * ring, b.z + Math.sin(a) * ring, a % 2 > 1 ? ringH : 2.6, 0.6);
    }

    // Portals: walk-through, so no collider.
    for (const p of zone.portals) this.addProp('portal', p.x, p.z, 3.4, 0);

    // Scattered forest inside.
    const set = this.set;
    let placed = 0;
    for (let i = 0; i < 1600 && placed < 280; i++) {
      const x = rand(r, -B + 2, B - 2);
      const z = rand(r, -B + 2, B - 2);
      if (this.distToPath(x, z) < 3.2) continue;
      if (near(x, z, s, 11) || near(x, z, b, clearingRadius(zone)) || zone.portals.some((p) => near(x, z, p, 5))) continue;
      if (zone.spawns.some((sp) => near(x, z, sp, sp.radius * 0.55))) continue;
      if ([...(zone.iceLakes ?? []), ...(zone.lavaPools ?? [])].some((l) => Math.hypot((x - l.x) / (l.rx + 2), (z - l.z) / (l.rz + 2)) < 1)) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < 2.2)) continue;
      const roll = r();
      if (roll < 0.55) this.addTree(r, x, z);
      else if (roll < 0.8) this.addProp(pick(r, set.bushes), x, z, rand(r, 0.9, 1.3), 0);
      else if (roll < (set.extra.length ? 0.9 : 0.93)) this.addProp(pick(r, set.rocks), x, z, rand(r, 0.7, 1.1), 0.5);
      else if (roll < 0.95 && set.extra.length) this.addProp(pick(r, set.extra), x, z, rand(r, 0.8, 1.1), 0);
      else if (set.tallStump && roll >= 0.97) this.addProp(set.tallStump, x, z, 1.3, 0.5);
      else this.addProp(set.stump, x, z, 0.8, 0.4);
      placed++;
    }
  }
}
