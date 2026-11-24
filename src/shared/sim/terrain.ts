// Zone layout and collision, without any rendering. Built from the zone seed, so the browser and
// the server get exactly the same trees, rocks and camp.
import { arenaRadius, clearingRadius, lairOf, lavaAt, themeAt, type Lair, type ZoneDef, type ZoneTheme } from '../data/zones';
import { NPC_IDS, type NpcId } from '../data/npcs';
import {
  HARBOR_BOATS, HARBOR_CORNERS, HARBOR_DECKS, HARBOR_GARDEN, HARBOR_LIGHTHOUSE, HARBOR_MAIN, HARBOR_PIER, HARBOR_PLAZA_RADIUS,
  HARBOR_SHIPYARD, insideDeck, onDeck,
} from '../data/harbor';
import { mulberry32, pick, rand, type Rng } from '../rng';
import type { Vec2 } from '../types';
import { MapRegistry } from '../mapRegistry';
import { pointInPolygon, ROOM_EDGE, type MapData, type Pt } from '../mapSchema';

export interface Collider { x: number; z: number; r: number }
/**
 * A solid box turned by `rot` degrees about its middle (x, z): `w` across along x and `d` deep along z before the turn.
 * The angle is the one in map files (src/shared/mapSchema.ts): the box's own axes are the world axes turned by rot.
 */
export interface BoxCollider { x: number; z: number; w: number; d: number; rot: number }
function toLocal(b: BoxCollider, x: number, z: number): [number, number] {
  const a = (-b.rot * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - b.x;
  const dz = z - b.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
/** Is a circle (x, z, r) touching the box? Same `<` rule as the circle colliders. */
export function boxHit(b: BoxCollider, x: number, z: number, r: number): boolean {
  const [lx, lz] = toLocal(b, x, z);
  if (Math.abs(lx) <= b.w / 2 && Math.abs(lz) <= b.d / 2) return true;
  const cx = Math.max(-b.w / 2, Math.min(b.w / 2, lx));
  const cz = Math.max(-b.d / 2, Math.min(b.d / 2, lz));
  return (lx - cx) ** 2 + (lz - cz) ** 2 < r * r;
}
function nearestOnPoly(poly: readonly Pt[], x: number, z: number): { px: number; pz: number; d: number } {
  let best = { px: poly[0][0], pz: poly[0][1], d: Infinity };
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const [bx, bz] = poly[i];
    const vx = bx - ax;
    const vz = bz - az;
    const len2 = vx * vx + vz * vz;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2)) : 0;
    const px = ax + vx * t;
    const pz = az + vz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { px, pz, d };
  }
  return best;
}
/** Is a circle touching a closed polygon (its inside is solid)? */
export function polyHit(poly: readonly Pt[], x: number, z: number, r: number): boolean {
  if (pointInPolygon(poly, x, z)) return true;
  return r > 0 && nearestOnPoly(poly, x, z).d < r;
}
/** One prop to draw. `fade` = turns see-through when the player walks behind it. */
export interface PropSpec { key: string; /** Degrees (as in map files): turns the picture and its shadow about the point it stands on. Absent = 0. */ rot?: number; x: number; z: number; height: number; fade: boolean; /** Drawn mirrored. */ flip?: boolean; /** Never faded, however tall (World fades tall props near the player). */ solid?: boolean }
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
  /** Extras drawn bigger than a rock, as [height, collider radius] (the beach's wrecks and treasure). */
  extraSize?: Record<string, [number, number]>;
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
  // Floor 2's Shipwreck Beach (FLOOR2_M1_BEACH.md, cut by tools/cut_papercraft.cjs floor2_m1).
  beach: {
    trees: ['coconut_palm_0', 'coconut_palm_1', 'coconut_palm_2'],
    bushes: ['hibiscus', 'tropical_fern'],
    rocks: ['sea_rock_0', 'sea_rock_1'],
    stump: 'plank_pile',
    tallStump: 'rock_pillar',
    extra: ['giant_clam', 'broken_ladder', 'wreck_crates', 'salvage_barrel', 'stuck_anchor', 'old_cannon', 'tide_pool', 'coin_pile',
      'treasure_chest', 'wreck_hull', 'torn_sail_mast', 'beached_rowboat', 'skull_flag', 'brass_lantern'],
    extraSize: {
      wreck_hull: [4, 1.6], torn_sail_mast: [4.5, 0.5], beached_rowboat: [1.4, 0.9], skull_flag: [2.6, 0.2], stuck_anchor: [2, 0.4],
      old_cannon: [1.3, 0.6], brass_lantern: [1.4, 0.2], broken_ladder: [1.8, 0.4], giant_clam: [1.2, 0.6], treasure_chest: [1.1, 0.5],
      wreck_crates: [1.3, 0.6], salvage_barrel: [1, 0.4], tide_pool: [0.5, 0], coin_pile: [0.5, 0],
    },
    ringRock: ['sea_rock_1', 2.2],
    campDecor: false,
  },
  // Floor 2's Smugglers' Cove (FLOOR2_M2_COVE.md, cut by tools/cut_papercraft.cjs floor2_m2): rock outcrops among the palms,
  // the smugglers' goods (powder kegs, crates, rum, a wanted board) and a hidden cave or two.
  cove: {
    trees: ['cliff_palm_0', 'cliff_palm_1', 'cliff_palm_0', 'cliff_rock_0'],
    bushes: ['thicket_0', 'thicket_1'],
    rocks: ['cliff_rock_1', 'cliff_rock_2'],
    stump: 'rum_barrel',
    tallStump: 'powder_keg',
    extra: ['cave_mouth', 'tent_0', 'tent_1', 'stilt_hut', 'small_falls', 'smuggled_crates', 'pirate_lantern', 'wanted_board', 'cliff_cannon',
      'cannonball_pile', 'smuggler_flag', 'cargo_net', 'bottles', 'loot_chest', 'pirate_boat'],
    extraSize: {
      cave_mouth: [3.6, 1.6], tent_0: [2.8, 1.2], tent_1: [2.6, 1.2], stilt_hut: [4, 1.2], small_falls: [2.8, 1], smuggled_crates: [1.4, 0.6],
      pirate_lantern: [1.6, 0.2], wanted_board: [1.8, 0.4], cliff_cannon: [1.3, 0.6], cannonball_pile: [0.6, 0.3], smuggler_flag: [2.6, 0.2],
      cargo_net: [0.9, 0.5], bottles: [0.8, 0.4], loot_chest: [1, 0.5], pirate_boat: [2.2, 1.2],
    },
    ringRock: ['cliff_rock_1', 2.2],
    campDecor: false,
  },
};

/**
 * A boss room's kit pieces (room_<theme>_<name>) under another name where a theme's art has no piece of that name:
 * the cove's sheet (tools/cut_papercraft.cjs floor2_m2) has one pillar, a mast and a gunboat instead of two pillars and a rune stone.
 */
const ROOM_KIT: Partial<Record<ZoneTheme, Record<string, string>>> = {
  cove: { pillar_0: 'pillar', pillar_1: 'mast', rune_stone: 'boulder' },
};
/** Where the cove room's gunboats lie around the arena (angles from the boss; the way in is at π/4). */
export const GUNBOAT_ANGLES = [Math.PI * 1.25, Math.PI * 0.72, Math.PI * 1.78];
/** How far from the boss the gunboats lie: just outside the arena. */
export const gunboatDist = (arena: number): number => arena + 2.2;

/** How close a player has to walk to a portal to use it. */
export const PORTAL_RANGE = 1.4;
/** The boss summoner on each map: its picture, height and how much of it is solid. */
export const SUMMONER_PROP: Record<ZoneTheme, string> = {
  forest: 'summoner_forest',
  marsh: 'summoner_marsh',
  snow: 'summoner_snow',
  volcano: 'summoner_volcano',
  beach: 'summoner_crab',
  cove: 'summoner_captain',
};
export const SUMMONER_HEIGHT = 3.6;
export const SUMMONER_SOLID = 1.2;
/** A boss room's walkable circle reaches this far past its arena (inside the ring of pillars). Defined in mapSchema: the validator checks it too. */
export { ROOM_EDGE };
/** How close a player must stand to the summoner to put keys in (the server checks it). */
export const SUMMONER_RANGE = 3.5;

/** Where players can rest: the hub's fountain and each zone camp's campfire. See Sim.rest. */
export interface RestSpot { x: number; z: number; kind: 'fountain' | 'campfire' }
/** How close a player must stand to rest (the fountain is wide; a campfire as close as to an NPC), and how long until they can again. */
// The fountain grew with the rebuilt town (owner 2026-11-18: 4.5 → 6.5, so you can rest beside its benches).
export const REST_RANGE: Record<RestSpot['kind'], number> = { fountain: 6.5, campfire: 3 };
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

/** Radius of the hub's round plaza (World paints it; nothing stands on it but the fountain). */
export const HUB_PLAZA_RADIUS = 8.5;
/** The hub's fountain: drawn this tall (its benches about a person's size), solid out to this radius. */
export const HUB_FOUNTAIN_HEIGHT = 9;
export const HUB_FOUNTAIN_RADIUS = 3.6;
/** The hub's NPC buildings: drawn this tall, a square footprint this wide (two side by side per top wall). */
export const HUB_BUILDING_HEIGHT = 7.4;
// Drawn deeper since 2026-11-19 (owner: 25% thicker).
export const HUB_BUILDING_SIZE = 5.2;
/** Gap between the two buildings on a wall. */
export const HUB_BUILDING_GAP = 3.4;

/** How far the hub's quarters wobble into each other (see themeAt). The props add their own scatter on top. */
export const QUADRANT_JITTER = 6;

/**
 * Whether an NPC standing in this zone is solid (Terrain pushes an r 0.45 collider for it). The navigator in nexus_city is seen only by
 * some players (src/client/Game.ts): no invisible wall for the rest. tools/bake_maps.ts uses this to tell those colliders apart.
 */
export function npcHasCollider(id: NpcId, zone: ZoneDef): boolean {
  return !(id === 'navigator' && zone.town !== 'harbor');
}

export class Terrain {
  readonly half: number;
  readonly bound: number;
  readonly colliders: Collider[] = [];
  /** Solid boxes (a prop's `solid: {w, d}` turned by its `rot`). Only maps that have them. */
  readonly boxes: BoxCollider[] = [];
  /** Closed polygons nobody can enter (a map's `blockers`). */
  readonly blockers: Pt[][] = [];
  readonly props: PropSpec[] = [];
  /** Only zones with `npcs` (the hub) have any. */
  readonly npcPos: Partial<Record<NpcId, Vec2>> = {};
  readonly restSpots: RestSpot[] = [];
  /** The map's boss summoner, if it has one (see ZoneDef.lair). */
  readonly summoner: Lair | null;
  /** In a boss room: how far from the boss (the middle) anyone may walk. Null elsewhere. */
  readonly roomEdge: number | null;
  /** The `rev` of the map file this was built from (0 = the bundled one, or the old generators). The server tells the browser so it builds the same. */
  readonly mapRev: number;
  private readonly segs: Seg[] = [];

  /**
   * `map` = the layout to build from (default: the zone's, from MapRegistry; boss rooms have none). `null` runs the old
   * seeded generators instead: that is only for tools/bake_maps.ts and the tests that check the files against it.
   */
  constructor(readonly zone: ZoneDef, map: MapData | null | undefined = MapRegistry.get(zone.id)) {
    this.half = zone.half;
    this.mapRev = map ? map.rev : 0;
    this.bound = map ? map.walkable.half : zone.half - 8;
    this.summoner = zone.lair ?? null;
    this.roomEdge = zone.roomOf ? arenaRadius(zone) + ROOM_EDGE : null;
    for (const line of map ? map.paths.map((p) => p.pts) : [zone.path, ...zone.branches]) {
      for (let i = 1; i < line.length; i++) this.segs.push([line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]]);
    }
    if (map) this.loadMap(map);
    else if (zone.town === 'harbor') this.placeHarbor(mulberry32(zone.seed + 1));
    else this.placeProps(mulberry32(zone.seed + 1));
    for (const id of NPC_IDS) {
      const n = this.npcPos[id];
      if (n && npcHasCollider(id, zone)) this.colliders.push({ ...n, r: 0.45 });
    }
  }

  /** Terrain from a layout file: the props, colliders, NPCs and rest spots the generators made when it was baked. */
  private loadMap(map: MapData): void {
    for (const p of map.props) {
      const spec: PropSpec = { key: p.key, x: p.x, z: p.z, height: p.h, fade: p.fade };
      if (p.flip) spec.flip = true;
      if (p.rot) spec.rot = p.rot;
      this.props.push(spec);
      const s = p.solid;
      if (!s) continue;
      if ('r' in s) this.colliders.push({ x: p.x, z: p.z, r: s.r });
      else this.boxes.push({ x: p.x, z: p.z, w: s.w, d: s.d, rot: p.rot });
    }
    for (const c of map.colliders ?? []) this.colliders.push({ x: c.x, z: c.z, r: c.r });
    for (const b of map.blockers) this.blockers.push(b.pts.map(([x, z]) => [x, z] as Pt));
    for (const n of map.npcs) this.npcPos[n.id as NpcId] = { x: n.x, z: n.z };
    for (const r of map.rest) this.restSpots.push({ x: r.x, z: r.z, kind: r.kind });
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
    // A boss room: nobody walks out of the arena (owner).
    if (this.roomEdge !== null && Math.hypot(x, z) + r > this.roomEdge) return true;
    // The harbour: off the planks is water (its edges' colliders keep walkers on; this turns clicks and spots away).
    // The decks are laid round the map's middle (HARBOR_DECKS), not round `start`, so moving the spawn in the editor doesn't move the water.
    if (this.zone.town === 'harbor' && !onDeck(x, z, -0.3)) return true;
    if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r)) return true;
    return this.boxes.some((b) => boxHit(b, x, z, r)) || this.blockers.some((b) => polyHit(b, x, z, r));
  }

  /** Frozen lake underfoot? Players slide here (see Player.walkStep). */
  onIce(x: number, z: number): boolean {
    return !!this.zone.iceLakes?.some((l) => Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz) < 1);
  }

  /**
   * The boss is dead: takes its solid (zone.bossSolid, the Volcano Heart's rock) away so its spot can be walked on.
   * Whatever sits on the boss's exact spot goes, whether it came from a layout file or the generator. Only boss rooms.
   */
  releaseBossSolid(): void {
    const b = this.zone.boss;
    if (!b || !this.zone.roomOf || !this.zone.bossSolid) return;
    for (let i = this.colliders.length - 1; i >= 0; i--) {
      const c = this.colliders[i];
      if (Math.abs(c.x - b.x) < 0.01 && Math.abs(c.z - b.z) < 0.01 && c.r <= this.zone.bossSolid + 0.01) this.colliders.splice(i, 1);
    }
  }

  /** Lava underfoot? It burns (see Sim.tickLava). */
  onLava(x: number, z: number): boolean {
    return !!lavaAt(this.zone, x, z);
  }

  /** The one collider a circle is pressed against, or null when it touches none or several (a corner). */
  soleContact(u: { x: number; z: number; radius: number }): Collider | null {
    let hit: Collider | null = null;
    for (const c of this.colliders) {
      if (Math.hypot(u.x - c.x, u.z - c.z) > c.r + u.radius + 0.01) continue;
      if (hit) return null;
      hit = c;
    }
    // Pressed against a box or a blocker too: that is a wall, not something round to walk around.
    const rr = u.radius + 0.01;
    if (this.boxes.some((b) => boxHit(b, u.x, u.z, rr)) || this.blockers.some((b) => polyHit(b, u.x, u.z, rr))) return null;
    return hit;
  }

  /**
   * The nearest spot a circle of radius r can stand on at or next to (x, z), for a click on an NPC,
   * a forge or a tree: pushed out of whatever is there, toward `from` when (x, z) is its very middle.
   * Null when there is none close by (a gap too narrow to stand in).
   */
  standSpot(x: number, z: number, r: number, from: { x: number; z: number }): { x: number; z: number } | null {
    const d = Math.hypot(from.x - x, from.z - z) || 1;
    const u = { x: x + ((from.x - x) / d) * 0.01, z: z + ((from.z - z) / d) * 0.01, radius: r };
    // Up to 8 pushes: a big building with an NPC at its door can take more than a few.
    for (let i = 0; i < 8 && this.isBlocked(u.x, u.z, r - 0.01); i++) this.resolve(u);
    return this.isBlocked(u.x, u.z, r - 0.01) ? null : { x: u.x, z: u.z };
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
    for (const b of this.boxes) this.pushOutOfBox(u, b);
    for (const poly of this.blockers) this.pushOutOfPoly(u, poly);
    u.x = Math.max(-this.bound, Math.min(this.bound, u.x));
    u.z = Math.max(-this.bound, Math.min(this.bound, u.z));
    // A boss room: nothing is pushed out past its edge either (a knockback, the Giant Cannon Crab's fling).
    if (this.roomEdge !== null) {
      const max = Math.max(0, this.roomEdge - u.radius);
      const d = Math.hypot(u.x, u.z);
      if (d > max) {
        u.x *= max / d;
        u.z *= max / d;
      }
    }
  }

  private pushOutOfBox(u: { x: number; z: number; radius: number }, b: BoxCollider): void {
    if (!boxHit(b, u.x, u.z, u.radius)) return;
    const [lx, lz] = toLocal(b, u.x, u.z);
    const hw = b.w / 2;
    const hd = b.d / 2;
    let tx: number;
    let tz: number;
    if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) {
      // The middle of the circle is inside: out through the nearest face.
      if (hw - Math.abs(lx) < hd - Math.abs(lz)) { tx = (lx < 0 ? -1 : 1) * (hw + u.radius); tz = lz; }
      else { tx = lx; tz = (lz < 0 ? -1 : 1) * (hd + u.radius); }
    } else {
      const cx = Math.max(-hw, Math.min(hw, lx));
      const cz = Math.max(-hd, Math.min(hd, lz));
      const d = Math.hypot(lx - cx, lz - cz) || 0.001;
      tx = cx + ((lx - cx) / d) * u.radius;
      tz = cz + ((lz - cz) / d) * u.radius;
    }
    // The push, back in world axes (the inverse of toLocal).
    const a = (-b.rot * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const ddx = tx - lx;
    const ddz = tz - lz;
    u.x += ddx * c + ddz * s;
    u.z += -ddx * s + ddz * c;
  }

  private pushOutOfPoly(u: { x: number; z: number; radius: number }, poly: readonly Pt[]): void {
    const inside = pointInPolygon(poly, u.x, u.z);
    const n = nearestOnPoly(poly, u.x, u.z);
    if (!inside && n.d >= u.radius) return;
    const d = n.d || 0.001;
    // Outside: straight away from the edge until r clear. Inside: out through the nearest edge and r past it.
    if (inside) {
      const k = (d + u.radius) / d;
      u.x += (n.px - u.x) * k;
      u.z += (n.pz - u.z) * k;
    } else {
      const k = (u.radius - d) / d;
      u.x += (u.x - n.px) * k;
      u.z += (u.z - n.pz) * k;
    }
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
   * The hub's town (owner 2026-11-19, round 6, art_templates/papercraft_maps/HUB.md 7): a big fountain on a round plaza
   * in the middle; rows of attached townhouses along the two walls at the top of the screen, fronts to the fountain,
   * with the vault and the crystal shop (top-left row) and the guild hall and the forge (top-right row) among them; and
   * a market along the two bottom walls, split either side of the road to the bottom gate: the merchant's half on the
   * bottom-left wall, the broker's on the bottom-right. Everything faces the fountain and lies along its wall.
   * The square wall runs round it all, with an open way through on each corner, straight on to the portals.
   * Paper pictures only, whatever the art switch says.
   */
  private placeTown(r: Rng): void {
    void r;
    const s = this.zone.start;
    const R = this.zone.safe?.half ?? 20;
    const at = (key: string, dx: number, dz: number, height: number, collideR: number, fade = false, flip = false) => {
      this.addProp(key, s.x + dx, s.z + dz, height, collideR, fade);
      if (flip) this.props[this.props.length - 1].flip = true;
    };
    const rad = (d: number) => (d * Math.PI) / 180;
    const polar = (key: string, deg: number, r: number, height: number, collideR: number) =>
      at(key, Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r, height, collideR);

    // The plaza: the big fountain (benches round it are part of its picture), nothing else on it.
    // In its picture (256 px tall) the middle of the fountain's round foot is 49 px above the bottom edge, where the
    // picture stands. A step toward the camera on the ground moves a point down the screen by sin(elevation) = 0.716
    // of it, so the picture stands that far out along +x +z for its middle to land on the plaza's middle.
    const fr = ((HUB_FOUNTAIN_HEIGHT * 49) / 256 / 0.716) / Math.SQRT2;
    at('town_fountain', fr, fr, HUB_FOUNTAIN_HEIGHT, 0);
    this.colliders.push({ x: s.x, z: s.z, r: HUB_FOUNTAIN_RADIUS });
    this.restSpots.push({ x: s.x, z: s.z, kind: 'fountain' });

    // ---- The NPC buildings (owner 2026-11-19): two whole buildings side by side against each top wall, fronts to the
    // fountain. Each is a box D deep and L long; its picture stands on the point straight below the box's middle on
    // screen, level with its nearest corner. Top-left wall (x = −R): the vault (top-gate side) and the crystal shop;
    // top-right wall (z = −R): the guild hall (top-gate side) and the forge.
    const D = HUB_BUILDING_SIZE;
    const L = HUB_BUILDING_SIZE;
    const q = (D + L) / 4;
    const houseBoxes: [number, number, number, number][] = [];
    const house = (key: string, alongX: boolean, t: number): Vec2 => {
      const [cx, cz] = alongX ? [t, -R + D / 2] : [-R + D / 2, t];
      houseBoxes.push([cx - D / 2, cz - D / 2, cx + D / 2, cz + D / 2]);
      at(key, cx + q, cz + q, HUB_BUILDING_HEIGHT, 0, true);
      for (const [ox, oz] of [[0, 0], [1.3, 1.3], [-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3]]) {
        this.colliders.push({ x: s.x + cx + ox * 0.8, z: s.z + cz + oz * 0.8, r: D / 2 - 0.5 });
      }
      // Where someone stands at its door: in front, toward the plaza.
      // Far enough out that they are drawn in front of the building (its picture stands D / 2 out from its front).
      // Pulled toward the middle of the wall, off the roads to the corner gates (owner 2026-11-19: they blocked the way).
      const dt = t * 0.6;
      return alongX ? { x: s.x + dt, z: s.z - R + D + D / 2 + 0.9 } : { x: s.x - R + D + D / 2 + 0.9, z: s.z + dt };
    };
    // Apart, with a gap between them (owner 2026-11-19).
    const half = L / 2 + HUB_BUILDING_GAP / 2;
    this.npcPos.keeper = house('b3_vault', false, -half);
    this.npcPos.crystal = house('b3_crystal', false, half);
    this.npcPos.seeker = house('b3_guild', true, -half);
    this.npcPos.blacksmith = house('b3_forge', true, half);

    // ---- The market (owner 2026-11-19): the merchant on the bottom-left wall and the broker on the bottom-right, each
    // in a half-ellipse of stalls open toward the fountain, the road to the bottom gate between them left clear.
    // The stall pictures run along z and come as fronts (*_front, open toward +x, the camera's side) and backs (open
    // toward −x); mirrored they run along x and open toward +z (fronts) or −z (backs). Every stall opens toward its
    // seller, who stands in the middle facing the fountain.
    // [slot, is a stall, mirrored, x, z, height, solid radius], around a seller at (0, 0) whose back is to the wall at +z.
    // Every stall has its back to that wall and opens toward the plaza (owner 2026-11-19), set out in a half-ellipse
    // round the seller: the main stall behind them, the second stall and the rest bending forward on either side.
    const ring: [string, boolean, boolean, number, number, number, number][] = [
      // Mirrored the other way from along the wall: the stalls stand ACROSS it, short end to the wall (owner 2026-11-19).
      // Drawn taller than the other props: their pictures were sheared to the wall's slope, which made each box taller
      // (tools/cut_papercraft.cjs 'slope'), so at 3.4 they looked squeezed thin (owner 2026-11-19).
      ['main_back', true, false, 0, 3.6, 4.4, 1.6],
      // In one line with the main stall, along the wall (owner 2026-11-19).
      ['wing_back', true, false, 5, 3.6, 4.4, 1.6],
      ['table', false, false, -5, 3.6, 1.6, 0.9], ['P0', false, false, 5.8, 1, 1.9, 1],
      ['P1', false, false, -5.8, 1, 1.6, 0.8], ['P2', false, false, -2.4, 5, 1.6, 0.9], ['P3', false, false, 2.4, 5, 1.6, 0.8],
    ];
    // `set`: the seller's pictures (tools/cut_papercraft.cjs hub, HUB.md 7.6), ml_* or mr_*; `props`: their four odds and ends.
    // Pictures drawn the other way round from the rest (market_right.png's booth), so they mirror the other way.
    const DRAWN_TURNED = new Set<string>();
    const BACKS: Record<string, Record<string, string>> = {
      ml: { main_back: 'mk_goods_stall', wing_back: 'mk_veg_stall' },
      mr: { main_back: 'mk_auction_booth', wing_back: 'mk_veg_stall' },
    };
    // `turn`: mirror that seller's stalls once more (the merchant's: owner 2026-11-19, fronts to the fountain and backs
    // to their wall, so from the camera, which is on the wall's side, we see their backs).
    const stalls = (seller: Vec2, alongX: boolean, set: string, props: string[], turn = false) => {
      for (const [slot, stall, mirrored, u, v, h, c] of ring) {
        // The stalls are the ones clearly seen from behind (market_backs.png): in the sellers' own sheets GPT drew the
        // scalloped canopy edge toward the camera, so their "backs" read as fronts (owner 2026-11-19).
        const key = slot.startsWith('P') ? `${set}_${props[Number(slot[1])]}` : stall ? BACKS[set][slot] : `${set}_${slot}`;
        // alongX: the seller's back is to the bottom-left wall (+z), so (u, v) is (x, z); otherwise to the bottom-right
        // wall (+x): (u, v) turns into (z, x), and the stalls' pictures turn with it (mirrored flips).
        const [dx, dz] = alongX ? [u, v] : [v, u];
        // Owner 2026-11-19, from the screen: the broker's stalls as drawn, the merchant's mirrored.
        at(key, seller.x - s.x + dx, seller.z - s.z + dz, h, c, false, stall && turn);
        void mirrored;
      }
    };
    this.npcPos.merchant = { x: s.x, z: s.z + R - 6 };
    stalls(this.npcPos.merchant, true, 'ml', ['cart', 'barrels', 'sacks', 'crates'], true);
    this.npcPos.broker = { x: s.x + R - 6, z: s.z };
    stalls(this.npcPos.broker, false, 'mr', ['wagon', 'strongbox', 'chests', 'rugs']);

    // Each gateway: a lamp post either side of the way through, just inside the wall (owner 2026-11-19), and a banner
    // pole either side of the road a little further in.
    const corner = R * Math.SQRT2;
    for (const road of [45, 135, 225, 315]) {
      const a2 = rad(road);
      const ux = Math.cos(a2), uz = Math.sin(a2);
      // Not in front of the NPC buildings (owner 2026-11-19: they hid the banners): a pole whose spot is within reach of
      // a building's footprint is left out.
      const nearHouse = (x: number, z: number) => houseBoxes.some(([x0, z0, x1, z1]) => x > x0 - 2.5 && x < x1 + 2.5 && z > z0 - 2.5 && z < z1 + 2.5);
      const pair = (key: string, along: number, side: number, h: number) => {
        for (const sd of [-1, 1]) {
          const x = ux * along - uz * sd * side;
          const z = uz * along + ux * sd * side;
          if (!nearHouse(x, z)) at(key, x, z, h, 0.3);
        }
      };
      pair('lamp_post', corner - 3.7, 2.2, 3.8);
      pair('banner_pole', corner - 6.7, 2.8, 4);
    }
    for (const deg of [176, 290]) polar('planter', deg, HUB_PLAZA_RADIUS + 1.6, 1.6, 0.7);
    // The knight's statue on the plaza's edge where the top road comes in, the road parting round it (owner 2026-11-19:
    // beside the road it stood behind the vault).
    polar('town_statue', 225, HUB_PLAZA_RADIUS + 1, 3.8, 0.8);
    // Floor 2's navigator: in front of the fountain, on the camera's side (owner 2026-11-20: beside the statue his
    // badge covered The Seeker's).
    {
      const d = HUB_FOUNTAIN_RADIUS + 1.6;
      this.npcPos.navigator = { x: s.x + d * Math.SQRT1_2, z: s.z + d * Math.SQRT1_2 };
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

  /**
   * Floor 2's harbour town (src/shared/data/harbor.ts, FLOOR2_HUB.md, art M0b_harbor_docks): the plank platforms
   * are shut in by a chain of colliders along every edge that isn't inside another platform (the water can't be
   * walked on, owner 2026-11-19); the ship's-wheel fountain on the plaza; the six shops round the main platform
   * laid out like nexus_city's (stores on the top two edges, the market on the bottom two); a ship moored by each
   * pier's end; the lighthouse, the shipyard, a garden and a boat landing on the side platforms.
   */
  private placeHarbor(r: Rng): void {
    const s = this.zone.start;
    const at = (key: string, x: number, z: number, height: number, collideR = 0, fade = false, flip = false) => {
      this.addProp(key, s.x + x, s.z + z, height, collideR, fade);
      if (flip) this.props[this.props.length - 1].flip = true;
    };

    // ---- the water's edge: a collider every 0.8 along each platform edge, a little outside it, except where the
    // edge runs inside another platform (a pier or bridge joining). Mooring posts stand along the open edges.
    const STEP = 0.8;
    const OUT = 0.55;
    for (const deck of HARBOR_DECKS) {
      const mx = deck.reduce((t, p) => t + p[0], 0) / deck.length;
      const mz = deck.reduce((t, p) => t + p[1], 0) / deck.length;
      for (let i = 0; i < deck.length; i++) {
        const [ax, az] = deck[i];
        const [bx, bz] = deck[(i + 1) % deck.length];
        const len = Math.hypot(bx - ax, bz - az);
        // Outward normal: away from the polygon's middle.
        let nx = -(bz - az) / len;
        let nz = (bx - ax) / len;
        if (nx * ((ax + bx) / 2 - mx) + nz * ((az + bz) / 2 - mz) < 0) {
          nx = -nx;
          nz = -nz;
        }
        let sincePost = 2;
        for (let t = 0; t <= len; t += STEP) {
          const ex = ax + ((bx - ax) * t) / len;
          const ez = az + ((bz - az) * t) / len;
          // Open: just past the edge is still a platform.
          if (HARBOR_DECKS.some((d) => d !== deck && insideDeck(d, ex + nx * 0.9, ez + nz * 0.9))) {
            sincePost = 2;
            continue;
          }
          this.colliders.push({ x: s.x + ex + nx * OUT, z: s.z + ez + nz * OUT, r: 0.6 });
          sincePost += STEP;
          if (sincePost >= 4.8 && t > 1 && t < len - 1) {
            // On the planks just inside the edge (owner 2026-11-20: they stood out over the water).
            at('hb_bollard', ex - nx * 0.7, ez - nz * 0.7, 1.05);
            sincePost = 0;
          }
        }
      }
    }

    // ---- the plaza: the ship's-wheel fountain (its picture stands on its round foot, as in placeTown).
    const FOUNTAIN_H = 6.2;
    const fr = ((FOUNTAIN_H * 40) / 256 / 0.716) / Math.SQRT2;
    at('hb_wheel_fountain', fr, fr, FOUNTAIN_H);
    this.colliders.push({ x: s.x, z: s.z, r: 2.7 });
    this.restSpots.push({ x: s.x, z: s.z, kind: 'fountain' });
    // Lamps round the plaza, benches facing the fountain, banners: all off the four roads to the piers (45°, 135° …).
    const rad = (d: number) => (d * Math.PI) / 180;
    const polar = (key: string, deg: number, d: number, h: number, c = 0) => at(key, Math.cos(rad(deg)) * d, Math.sin(rad(deg)) * d, h, c);
    for (const deg of [20, 70, 110, 160, 200, 250, 290, 340]) polar('hb_lamp_post', deg, HARBOR_PLAZA_RADIUS + 0.4, 3.6, 0.3);
    for (const deg of [0, 90, 180, 270]) polar(deg % 180 ? 'hb_bench_a' : 'hb_bench_b', deg, HARBOR_PLAZA_RADIUS - 2.4, 1.3, 0.7);
    for (const deg of [65, 115, 245, 295]) polar('hb_banner_pole', deg, HARBOR_PLAZA_RADIUS + 2.2, 4, 0.3);

    // ---- the shops: each a building against its edge of the main platform with its keeper in front, toward the
    // plaza (like nexus_city: stores on the two top edges, the market on the two bottom ones). The picture stands on
    // the point below the middle of its square footprint on screen, as in placeTown.
    const D = HUB_BUILDING_SIZE;
    const q = D / 2;
    const E = HARBOR_MAIN;
    const shop = (key: string, h: number, alongX: boolean, side: number, t: number): Vec2 => {
      // On the two bottom edges (toward the camera) the picture stands out past its footprint's near corner, so those
      // buildings stand further in (owner 2026-11-20: they hung out over the water).
      const back = side > 0 ? E - D / 2 - 2.6 : E - D / 2 - 0.4;
      const [cx, cz] = alongX ? [t, side * back] : [side * back, t];
      at(key, cx + q, cz + q, h, 0, true);
      for (const [ox, oz] of [[0, 0], [1.2, 1.2], [-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2]]) {
        this.colliders.push({ x: s.x + cx + ox, z: s.z + cz + oz, r: D / 2 - 0.6 });
      }
      const front = back - D / 2 - 1.3;
      return alongX ? { x: s.x + t * 0.75, z: s.z + side * front } : { x: s.x + side * front, z: s.z + t * 0.75 };
    };
    // Top-left edge (x = −E): the warehouse (stash) and the smuggler's stall; top-right (z = −E): the forge.
    this.npcPos.keeper = shop('hb_warehouse', HUB_BUILDING_HEIGHT, false, -1, -5);
    this.npcPos.crystal = shop('hb_smuggler', HUB_BUILDING_HEIGHT * 0.95, false, -1, 5.5);
    this.npcPos.blacksmith = shop('hb_forge', HUB_BUILDING_HEIGHT, true, -1, 5);
    // The navigator (The Seeker's role here) by the brass globe on the top-right edge, toward the lighthouse.
    at('hb_brass_globe', -6.2, -E + 2.2, 2.6, 0.9);
    this.npcPos.seeker = { x: s.x - 4.2, z: s.z - E + 4.6 };
    // Bottom-left edge (z = +E): the ship's supply shop; bottom-right (x = +E): the broker's office.
    this.npcPos.merchant = shop('hb_supply', HUB_BUILDING_HEIGHT, true, 1, -4.5);
    this.npcPos.broker = shop('hb_broker', HUB_BUILDING_HEIGHT, false, 1, 4.5);
    // Goods about the shops.
    at('hb_barrels', -E + 2, -E + 7.5, 1.5, 0.8);
    at('hb_crates', -E + 2.2, 12.2, 1.6, 0.8);
    at('hb_sacks', -11, E - 2, 1.2, 0.7);
    at('hb_crates', 2.5, E - 2.2, 1.5, 0.7);
    at('hb_rope_coil', E - 2.2, -3.5, 0.9, 0.6);
    at('hb_barrels', E - 2, 12, 1.4, 0.7);
    at('hb_rope_coil', 11.5, -E + 2.2, 0.9, 0.6);
    // A palm in a tub and a bunting post either side of each pier's mouth, on the main platform along its two edges
    // (owner 2026-11-20: they stood out over the water).
    for (const [sx, sz] of HARBOR_CORNERS) {
      at('hb_palm_pot', sx * (E - 1.8), sz * (E - 7), 3, 0.7);
      at('hb_bunting_post', sx * (E - 7), sz * (E - 1.8), 2.6, 0.3);
    }

    // ---- the piers: lamps either side, and a ship moored on the water beside each end.
    const SHIPS = ['hb_ship_green', 'hb_ship_blue', 'hb_ship_white', 'hb_ship_red'];
    HARBOR_CORNERS.forEach(([sx, sz], i) => {
      const ux = sx * Math.SQRT1_2;
      const uz = sz * Math.SQRT1_2;
      for (const along of [25]) {
        for (const side of [-1, 1]) at('hb_lamp_post', ux * along - uz * side * 2.4, uz * along + ux * side * 2.4, 3.2, 0.3);
      }
      const side = i % 2 ? 1 : -1;
      at(SHIPS[i], sx * HARBOR_PIER - uz * side * 8.5, sz * HARBOR_PIER + ux * side * 8.5, 8, 0, true, side > 0);
    });

    // ---- the side platforms.
    {
      const [cx, cz] = HARBOR_LIGHTHOUSE;
      at('hb_lighthouse', cx - 1.2, cz + 0.2, 10, 0, true);
      this.colliders.push({ x: s.x + cx - 2.4, z: s.z + cz - 1.2, r: 2.2 });
      at('hb_barrels', cx + 3, cz + 3, 1.3, 0.6);
    }
    {
      const [cx, cz] = HARBOR_SHIPYARD;
      at('hb_shipyard', cx + 1.2, cz + 0.4, 5.5, 0, true);
      this.colliders.push({ x: s.x + cx + 0.5, z: s.z + cz, r: 2.6 });
      at('hb_crates', cx - 3.2, cz - 3.4, 1.4, 0.6);
      at('hb_rope_coil', cx - 3.2, cz + 3.4, 0.9, 0.5);
    }
    {
      const [cx, cz] = HARBOR_GARDEN;
      at('hb_palm_pot', cx - 1.8, cz - 1.8, 3.2, 0.6);
      at('hb_bench_b', cx + 1.5, cz + 1.8, 1.3, 0.6);
      at('hb_bunting_post', cx - 2.6, cz + 2.4, 2.6, 0.3);
    }
    {
      const [cx, cz] = HARBOR_BOATS;
      at('hb_rowboat', cx + 1, cz + 6.5, 3.2);
      at('hb_sacks', cx - 2.4, cz + 2.2, 1.2, 0.6);
      at('hb_bench_a', cx + 2.2, cz - 1.4, 1.3, 0.6);
    }

    // ---- the portals: walk-through, no collider.
    for (const p of this.zone.portals) at(p.prop ?? 'portal', p.x - s.x, p.z - s.z, p.prop === 'hb_portal_return' ? 5.6 : 5);

    // ---- on the water: gulls on posts and a few floating barrels, clear of the platforms and of each other.
    let placed = 0;
    for (let i = 0; i < 400 && placed < 7; i++) {
      const x = rand(r, -this.bound + 3, this.bound - 3);
      const z = rand(r, -this.bound + 3, this.bound - 3);
      if (HARBOR_DECKS.some((d) => insideDeck(d, x, z, -3))) continue;
      if (this.props.some((p) => Math.hypot(p.x - x, p.z - z) < 5)) continue;
      at(placed % 3 ? 'hb_float_barrel' : 'hb_gull_post', x, z, placed % 3 ? 1.1 : 2.2);
      placed++;
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
      if (safe && Math.max(Math.abs(x - safe.x), Math.abs(z - safe.z)) < safe.half + 7) continue; // Trees and rocks keep off the town wall (owner 2026-11-19: 4 was too close).
      // Single monsters (the hub's) still get a little room to stand in.
      if (zone.spawns.some((sp) => near(x, z, sp, sp.radius <= 1 ? 3 : sp.radius * 0.55))) continue;
      if ([...(zone.iceLakes ?? []), ...(zone.lavaPools ?? [])].some((l) => Math.hypot((x - l.x) / (l.rx + 2), (z - l.z) / (l.rz + 2)) < 1)) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < 2.2)) continue;
      const set = this.setAt(r, x, z);
      const roll = r();
      if (roll < 0.55) this.addTree(r, x, z);
      else if (roll < 0.8) this.addProp(pick(r, set.bushes), x, z, rand(r, 0.9, 1.3), 0);
      else if (roll < (set.extra.length ? 0.9 : 0.93)) this.addProp(pick(r, set.rocks), x, z, rand(r, 0.7, 1.1), 0.5);
      else if (roll < 0.95 && set.extra.length) {
        const key = pick(r, set.extra);
        const size = set.extraSize?.[key];
        this.addProp(key, x, z, size ? size[0] * rand(r, 0.9, 1.1) : rand(r, 0.8, 1.1), size?.[1] ?? 0);
      }
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
    const theme = this.zone.theme;
    const kit = (name: string) => `room_${theme}_${ROOM_KIT[theme]?.[name] ?? name}`;
    const way = Math.PI / 4;
    const gap = (a: number) => Math.abs(Math.atan2(Math.sin(a - way), Math.cos(a - way))) < 0.42;
    const near = (a: number, b2: number) => Math.abs(Math.atan2(Math.sin(a - b2), Math.cos(a - b2))) < 0.3;
    // The cove's gunboats stand at the edge of the arena (the Peg-Leg Captain's parrot calls their shots), in the ring's place.
    const boats = theme === 'cove' ? GUNBOAT_ANGLES : [];
    for (const a of boats) this.addProp('room_cove_gunboat', b.x + Math.cos(a) * gunboatDist(ring), b.z + Math.sin(a) * gunboatDist(ring), 2.4, 1);
    const RING: [string, number, number][] = [['pillar_0', 3.2, 0.6], ['brazier', 2.3, 0.4], ['pillar_1', 2.4, 0.6], ['rune_stone', 2.2, 0.6]];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      if (gap(a) || boats.some((g) => near(a, g))) continue;
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
  }
}
