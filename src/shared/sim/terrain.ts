// Zone layout and collision, without any rendering. Built from the zone seed, so the browser and
// the server get exactly the same trees, rocks and camp.
import { arenaRadius, clearingRadius, lairOf, lavaAt, themeAt, type Lair, type ZoneDef, type ZoneTheme } from '../data/zones';
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
/** The boss summoner on each map: its picture, height and how much of it is solid. */
export const SUMMONER_PROP: Record<ZoneTheme, string> = {
  forest: 'summoner_forest',
  marsh: 'summoner_marsh',
  snow: 'summoner_snow',
  volcano: 'summoner_volcano',
};
export const SUMMONER_HEIGHT = 3.6;
export const SUMMONER_SOLID = 1.2;
/** How close a player must stand to the summoner to put keys in (the server checks it). */
export const SUMMONER_RANGE = 3.5;

/** Where players can rest: the hub's fountain and each zone camp's campfire. See Sim.rest. */
export interface RestSpot { x: number; z: number; kind: 'fountain' | 'campfire' }
/** How close a player must stand to rest (the fountain is wide; a campfire as close as to an NPC), and how long until they can again. */
export const REST_RANGE: Record<RestSpot['kind'], number> = { fountain: 4.5, campfire: 3 };
export const REST_CD = 30;

/** The rest spot a player at (x, z) can use, if any (the nearest in range). */
export function restSpotNear(spots: readonly RestSpot[], p: { x: number; z: number }): RestSpot | null {
  let best: RestSpot | null = null;
  let bestD = Infinity;
  for (const r of spots) {
    const d = Math.hypot(p.x - r.x, p.z - r.z);
    if (d <= REST_RANGE[r.kind] && d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

/** How far the hub's quarters wobble into each other (see themeAt). The props add their own scatter on top. */
export const QUADRANT_JITTER = 6;

export class Terrain {
  readonly half: number;
  readonly bound: number;
  readonly colliders: Collider[] = [];
  readonly props: PropSpec[] = [];
  /** Only zones with `npcs` (the hub) have any. */
  readonly npcPos: Partial<Record<NpcId, Vec2>> = {};
  readonly restSpots: RestSpot[] = [];
  /** The map's boss summoner, if it has one (see ZoneDef.lair). */
  readonly summoner: Lair | null;
  private readonly segs: Seg[] = [];

  constructor(readonly zone: ZoneDef) {
    this.half = zone.half;
    this.bound = zone.half - 8;
    this.summoner = zone.lair ?? null;
    for (const line of [zone.path, ...zone.branches]) {
      for (let i = 1; i < line.length; i++) this.segs.push([line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]]);
    }
    this.placeProps(mulberry32(zone.seed + 1));
    for (const id of NPC_IDS) {
      const n = this.npcPos[id];
      if (n) this.colliders.push({ ...n, r: 0.45 });
    }
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

  /**
   * The prop set at (x, z). In the hub the quarters' sets are scattered into each other near the
   * borders, so the land changes gradually instead of along a line.
   */
  private setAt(r: Rng, x: number, z: number): ThemeProps {
    if (!this.zone.quadrants) return THEME_PROPS[this.zone.theme];
    return THEME_PROPS[themeAt(this.zone, x + rand(r, -7, 7), z + rand(r, -7, 7), QUADRANT_JITTER)];
  }

  private addTree(r: Rng, x: number, z: number): void {
    this.addProp(pick(r, this.setAt(r, x, z).trees), x, z, rand(r, 4.6, 6.4), 0.55, true);
  }

  /**
   * The hub's town: the ruins of an old city inside a square wall. The wall pictures run along the
   * world's two axes (on screen the town is a diamond), so the walls do too, one long straight run
   * per side. The four roads leave along the diagonals, through an opening between two stone pillars
   * on each corner (on screen the top, right, bottom and left of the diamond), straight on to the portals. The NPCs, their
   * stalls and the fallen houses stand on the axes between the roads. Brick underfoot (World paints it).
   * Until a ruin picture exists it borrows an older prop's (see assets.ts).
   */
  private placeTown(r: Rng): void {
    const s = this.zone.start;
    const R = this.zone.safe?.half ?? 17.6;
    const at = (key: string, dx: number, dz: number, height: number, collideR: number, fade = false) =>
      this.addProp(key, s.x + dx, s.z + dz, height, collideR, fade);
    const polar = (key: string, deg: number, rad: number, height: number, collideR: number, fade = false) =>
      at(key, Math.cos((deg * Math.PI) / 180) * rad, Math.sin((deg * Math.PI) / 180) * rad, height, collideR, fade);

    at('ruin_fountain', 0, 0, 4.2, 1.7);
    this.restSpots.push({ x: s.x, z: s.z, kind: 'fountain' });
    this.npcPos.seeker = { x: s.x, z: s.z - 5.8 };
    at('ruin_statue', 0, -8.6, 3.8, 0.8);
    // The merchant and the market broker share the +x side, turned apart so that on screen the
    // merchant's stall sits up and to the right and the broker with his booth below it: neither
    // stall covers the other's NPC and their name badges don't stack.
    const deg = (d: number, rad: number) => ({ x: s.x + Math.cos((d * Math.PI) / 180) * rad, z: s.z + Math.sin((d * Math.PI) / 180) * rad });
    this.npcPos.merchant = deg(-7.5, 5.8);
    polar('town_stall', -7.5, 8.6, 3.4, 1.2);
    polar('barrel', -15, 10.5, 0.9, 0.35);
    this.npcPos.broker = deg(27.5, 8.8);
    polar('town_market', 17.5, 11.6, 3.4, 1.2);
    this.npcPos.blacksmith = { x: s.x, z: s.z + 5.8 };
    at('town_forge', 0, 8.8, 3.6, 1.3);
    this.npcPos.keeper = { x: s.x - 5.8, z: s.z };
    at('town_vault', -8.8, 0, 3.2, 1.3);

    // Broken pillars either side of the roads (none at 22.5°, where the market booth stands), fallen houses and towers further out, two old trees.
    for (let a = 67.5; a < 360; a += 45) polar('ruin_pillar', a, 10.6, 3.4, 0.5, true);
    for (const a of [0, 180]) polar('ruin_house', a, 13.6, 5.8, 2.1, true);
    for (const a of [90, 270]) polar('ruin_tower', a, 13.6, 6.4, 1.8, true);
    // Clear of the market booth (17.5°), so the tree doesn't hide it.
    polar('tree_2', 337.5, 14.6, 6.2, 0.55, true);
    polar('tree_2', 157.5, 14.6, 6.2, 0.55, true);

    // Rubble where it fell: off the roads, clear of everything else.
    let piles = 0;
    for (let i = 0; i < 300 && piles < 10; i++) {
      const x = s.x + rand(r, -R + 3, R - 3);
      const z = s.z + rand(r, -R + 3, R - 3);
      if (Math.hypot(x - s.x, z - s.z) < 5 || this.distToPath(x, z) < 3) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 2.2)) continue;
      if (Object.values(this.npcPos).some((n) => n && Math.hypot(n.x - x, n.z - z) < 3)) continue;
      this.addProp('ruin_rubble', x, z, rand(r, 1, 1.4), 0.6);
      piles++;
    }

    // The wall kit (tools/cut_hub.cjs): one scale for all pieces, U world units per pixel. Each wall
    // picture's foot runs at the camera's slope for a world axis, so copies line up end to end, one end
    // pillar over the next. They're anchored at their lowest pixel (the near end), and the wall's middle
    // stands higher on screen than that, so each anchor goes half the picture's width nearer the camera
    // (+x +z) than the line the wall stands on.
    const U = 3.6 / 249;
    const along = (px: number) => (px * U) / Math.SQRT1_2;
    const WALL_LEN = along(226);
    const STEP = WALL_LEN * 0.86;
    const back = (px: number) => (px * U) / (2 * Math.SQRT2);
    // How far each side's wall stops short of a corner, leaving the gateway there.
    const GAP = 3;
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      // An open way through on each corner, a stone pillar either side where the two walls stop.
      at('town_wall_end', cx * (R - GAP), cz * R, 167 * U * 1.25, 0.8, true);
      at('town_wall_end', cx * R, cz * (R - GAP), 167 * U * 1.25, 0.8, true);
    }
    for (const [ax, wallKey] of [[true, 'town_wall_b'], [false, 'town_wall_a']] as const) {
      // ax: the side runs along x (z = ±R), else along z (x = ±R).
      for (const edge of [-R, R]) {
        const pos = (t: number): [number, number] => [s.x + (ax ? t : edge), s.z + (ax ? edge : t)];
        const len = 2 * (R - GAP - 0.4);
        const n = Math.ceil((len - WALL_LEN) / STEP) + 1;
        const step = (len - WALL_LEN) / (n - 1);
        for (let i = 0; i < n; i++) {
          const [x, z] = pos(-len / 2 + WALL_LEN / 2 + i * step);
          this.addProp(r() < 0.3 ? `${wallKey}_broken` : wallKey, x + back(226), z + back(226), 250 * U, 0, true);
        }
        // The wall's own line is solid from one gateway to the next.
        for (let t = -(R - GAP); t <= R - GAP; t += 0.9) {
          const [x, z] = pos(t);
          this.colliders.push({ x, z, r: 0.6 });
        }
      }
    }
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

    const s = zone.start;
    if (zone.npcs) this.placeTown(r);
    else if (!zone.roomOf) this.placeCamp();

    // Pebbles along the paths (no collision).
    for (const [ax, az, bx, bz] of this.segs) {
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = rand(r, 2, 6); t < len; t += rand(r, 5, 11)) {
        const f = t / len;
        const side = r() < 0.5 ? -1 : 1;
        const off = side * rand(r, 2.6, 3.4);
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        const x = ax + (bx - ax) * f + nx * off;
        const z = az + (bz - az) * f + nz * off;
        if (!this.setAt(r, x, z).campDecor) continue;
        if (near(x, z, s, zone.safe ? zone.safe.half * 1.45 + 2 : 10) || Math.abs(x) > B || Math.abs(z) > B) continue;
        this.addProp(pick(r, ['pebble_0', 'pebble_1']), x, z, rand(r, 0.3, 0.45), 0);
      }
    }

    // Boss clearing ring of runestones: around the boss in its room, around the summoner on its map.
    const b = lairOf(zone);
    if (b) {
      const ring = arenaRadius(zone);
      const set = this.setAt(r, b.x, b.z);
      if (zone.boss && zone.bossSolid) this.colliders.push({ x: b.x, z: b.z, r: zone.bossSolid });
      if (zone.lair) this.addProp(SUMMONER_PROP[zone.theme], b.x, b.z, SUMMONER_HEIGHT, SUMMONER_SOLID);
      if (zone.roomOf) this.placeRoom(r, b, ring);
      else {
        for (let a = 0.3; a < Math.PI * 2; a += Math.PI / 4) {
          const [ringRock, ringH] = set.ringRock;
          this.addProp(a % 2 > 1 ? ringRock : 'runestone', b.x + Math.cos(a) * ring, b.z + Math.sin(a) * ring, a % 2 > 1 ? ringH : 2.6, 0.6);
        }
      }
    }

    // Portals: walk-through, so no collider.
    for (const p of zone.portals) this.addProp('portal', p.x, p.z, 3.4, 0);

    // Scattered forest inside, as thick in a big map as in a small one.
    const fill = (B / 56) ** 2;
    const safe = zone.safe;
    let placed = 0;
    for (let i = 0; i < 1600 * fill && placed < 280 * fill; i++) {
      const x = rand(r, -B + 2, B - 2);
      const z = rand(r, -B + 2, B - 2);
      if (this.distToPath(x, z) < 3.2) continue;
      if (near(x, z, s, 11) || (b && near(x, z, b, clearingRadius(zone))) || zone.portals.some((p) => near(x, z, p, 5))) continue;
      if (safe && Math.max(Math.abs(x - safe.x), Math.abs(z - safe.z)) < safe.half + 4) continue;
      // Single monsters (the hub's) still get a little room to stand in.
      if (zone.spawns.some((sp) => near(x, z, sp, sp.radius <= 1 ? 3 : sp.radius * 0.55))) continue;
      if ([...(zone.iceLakes ?? []), ...(zone.lavaPools ?? [])].some((l) => Math.hypot((x - l.x) / (l.rx + 2), (z - l.z) / (l.rz + 2)) < 1)) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < 2.2)) continue;
      const set = this.setAt(r, x, z);
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

  /**
   * A boss room's own ruins (art_templates/boss_rooms): pillars, braziers and carved stones in a ring
   * around the arena, with a gap where the players come in (the +x +z corner), and walls, boulders,
   * rubble and a tree or two between the ring and the edge of the room.
   */
  private placeRoom(r: Rng, b: { x: number; z: number }, ring: number): void {
    const kit = (name: string) => `room_${this.zone.theme}_${name}`;
    const way = Math.PI / 4;
    const gap = (a: number) => Math.abs(Math.atan2(Math.sin(a - way), Math.cos(a - way))) < 0.42;
    const RING: [string, number, number][] = [['pillar_0', 3.2, 0.6], ['brazier', 2.3, 0.4], ['pillar_1', 2.4, 0.6], ['rune_stone', 2.2, 0.6]];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      if (gap(a)) continue;
      const [name, h, solid] = RING[i % RING.length];
      this.addProp(kit(name), b.x + Math.cos(a) * (ring + 1.6), b.z + Math.sin(a) * (ring + 1.6), h, solid);
    }
    const OUTER: [string, number, number][] = [['wall', 2.4, 1.2], ['boulder', 2, 1.1], ['rubble', 1.2, 0.8], ['tree', 4, 0.6]];
    const B = this.bound;
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 12; tries++) {
      const a = r() * Math.PI * 2;
      const d = ring + 4 + r() * (B - ring - 3);
      const x = b.x + Math.cos(a) * d;
      const z = b.z + Math.sin(a) * d;
      if (gap(a) || Math.abs(x) > B - 1 || Math.abs(z) > B - 1) continue;
      if (this.distToPath(x, z) < 3 || this.zone.portals.some((p) => Math.hypot(p.x - x, p.z - z) < 4)) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 2.4)) continue;
      const [name, h, solid] = OUTER[placed % OUTER.length];
      this.addProp(kit(name), x, z, h, solid);
      placed++;
    }
  }

  /** The camp each zone's hub portal opens next to. The NPCs moved to the hub; the camp stays as scenery. */
  private placeCamp(): void {
    const s = this.zone.start;
    const B = this.bound;
    const set = THEME_PROPS[this.zone.theme];
    // The camp was laid out for the bottom corner; zones turned to face the hub turn it with them.
    const turns = s.x >= 0 ? (s.z >= 0 ? 0 : 3) : s.z >= 0 ? 1 : 2;
    const at = (key: string, dx: number, dz: number, height: number, collideR: number) => {
      for (let i = 0; i < turns; i++) [dx, dz] = [-dz, dx];
      this.addProp(key, s.x + dx, s.z + dz, height, collideR);
      if (key === 'campfire') this.restSpots.push({ x: s.x + dx, z: s.z + dz, kind: 'campfire' });
    };
    at('tent', 3, -4, 3, 1.4);
    at('tent', -4, 3, 3, 1.4);
    // Beside the way in from the portal (which runs through the middle of the camp), not on it.
    at('campfire', 4.5, -1, 1, 0.5);
    at('sign', -5, -6.5, 2, 0.2);
    // On the far side of the camp from the hub portal (5.5, 5.5), clear of the path and the other props.
    at('runestone', -7.5, 1, 2.6, 0.5);
    if (set.campDecor) {
      // Camp life: the merchant's stock, the blacksmith's cart, a well and a lookout tower.
      at('well', -6, -1.5, 2, 0.9);
      at('barrel', -3.2, 6.2, 0.9, 0.35);
      at('barrel', -0.3, 6.7, 0.9, 0.35);
      at('chest', 0.9, 6.2, 0.8, 0.45);
      at('cart', 6.8, -3.6, 1.2, 0.8);
      at('banner_red', 6.6, 0.3, 2, 0.2);
      at('flag', -2, -7, 1.8, 0.15);
      at('watchtower', 9, -10, 4.2, 1.1);
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
      const fx = s.x + Math.cos(a) * 9;
      const fz = s.z + Math.sin(a) * 9;
      if (this.distToPath(fx, fz) < 3 || Math.abs(fx) > B || Math.abs(fz) > B) continue;
      this.addProp('fence', fx, fz, 1.1, 0.6);
    }
  }
}
