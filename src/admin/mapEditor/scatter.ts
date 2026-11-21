// The scatter brush and eraser's pure part (no DOM): where one dab of the brush puts new pieces, and what the eraser takes away.
// Tested in tests/map-scatter.test.ts. The tool round it (pointer, panel, one undo step per stroke) is brushTool.ts.
import { TRAIL_WIDTH } from '../../shared/groundLook';
import { pointInPolygon, roomSpawnOf, type MapCollider, type MapData, type MapProp } from '../../shared/mapSchema';
import { followersOf, halfExtent, nearOnSegment } from './geom';

/** A picture the brush may put down: its catalog height and collision radius (0 = walk-through). */
export interface ScatterKind { key: string; h: number; r: number }
export interface ScatterOpts {
  radius: number;
  /** Pieces per 100 square world units, per dab. */
  density: number;
  /** Random size range, as a factor of the catalog height (collision grows with it). */
  hMin: number;
  hMax: number;
  flip: boolean;
  rotate: boolean;
  /** Keep off roads and lakes (as the game's tree scatter does). */
  avoidPaths: boolean;
}

/** How close (world units) a new piece may come to these things, on top of its own footprint. */
export const KEEP_CLEAR = { npc: 1.5, portal: 2.5, rest: 2, lair: 3, spawn: 2, start: 3, roomSpawn: 2 } as const;
/** Walk-through pieces still keep this far apart, so a dab does not stack grass on grass. */
const LOOSE_FOOT = 0.35;
const LOOSE_GAP = 1.6;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** The round footprint of an existing piece: its solid (a box as the circle round it), or 0 when walk-through. */
function solidR(p: MapProp): number {
  if (!p.solid) return 0;
  if ('r' in p.solid) return Math.max(0, p.solid.r);
  const [hx, hz] = halfExtent(p);
  return Math.max(hx, hz);
}

/** Is a piece with this footprint (`foot`, world units) allowed at (x, z), ignoring the other pieces? */
export function spotIsFree(map: MapData, x: number, z: number, foot: number, avoidPaths: boolean): boolean {
  const B = map.walkable.half - foot;
  if (Math.abs(x) > B || Math.abs(z) > B) return false;
  const near = (p: { x: number; z: number }, d: number): boolean => Math.hypot(x - p.x, z - p.z) < d + foot;
  if (map.npcs.some((n) => near(n, KEEP_CLEAR.npc))) return false;
  if (map.portals.some((n) => near(n, KEEP_CLEAR.portal))) return false;
  if (map.rest.some((n) => near(n, KEEP_CLEAR.rest))) return false;
  if (map.spawns.some((n) => near(n, KEEP_CLEAR.spawn))) return false;
  if (map.lair && near(map.lair, KEEP_CLEAR.lair)) return false;
  if ((map.colliders ?? []).some((c) => near(c, c.r))) return false;
  if (map.room) {
    // Nothing on the boss's arena or where the players appear.
    if (near(map.room.boss, map.room.arena + 1)) return false;
    if (near(roomSpawnOf(map.zone.start), KEEP_CLEAR.roomSpawn)) return false;
  } else if (!map.zone.safe && near(map.zone.start, KEEP_CLEAR.start)) return false;
  for (const b of map.blockers) {
    if (pointInPolygon(b.pts, x, z)) return false;
    for (let i = 0; i < b.pts.length; i++) if (nearOnSegment(b.pts[i], b.pts[(i + 1) % b.pts.length], x, z).d < foot) return false;
  }
  if (avoidPaths) {
    const trail = TRAIL_WIDTH[map.zone.theme] / 2;
    for (const p of map.paths) for (let i = 1; i < p.pts.length; i++) if (nearOnSegment(p.pts[i - 1], p.pts[i], x, z).d < trail + foot) return false;
    if (map.water.some((w) => Math.hypot((x - w.x) / (w.rx + foot + 0.5), (z - w.z) / (w.rz + foot + 0.5)) < 1)) return false;
  }
  return true;
}

/** Too close to an existing (or just placed) piece? Solid pieces keep their circles apart; walk-through ones keep a small gap. */
function crowded(others: readonly MapProp[], x: number, z: number, r: number): boolean {
  for (const q of others) {
    const d = Math.hypot(x - q.x, z - q.z);
    const qr = solidR(q);
    if (r > 0 || qr > 0) { if (d < Math.max(r, LOOSE_FOOT) + Math.max(qr, LOOSE_FOOT)) return true; }
    else if (d < LOOSE_FOOT * 2 * LOOSE_GAP) return true;
  }
  return false;
}

/**
 * One dab of the brush at (cx, cz): new pieces at random spots inside the circle, each of a random kind and size, none on
 * anything that must stay clear (spotIsFree) nor crowding another piece. `newId` hands out ids no piece uses.
 */
export function scatterStamp(map: MapData, cx: number, cz: number, kinds: readonly ScatterKind[], o: ScatterOpts, rng: () => number, newId: () => string): MapProp[] {
  if (!kinds.length || o.radius <= 0) return [];
  const want = (Math.PI * o.radius * o.radius * o.density) / 100;
  // Whole pieces: the fraction is a chance of one more, so a small brush still lays something now and then.
  const target = Math.floor(want) + (rng() < want - Math.floor(want) ? 1 : 0);
  const placed: MapProp[] = [];
  const near = map.props.filter((p) => Math.hypot(p.x - cx, p.z - cz) < o.radius + 6);
  for (let tries = 0; placed.length < target && tries < target * 12 + 4; tries++) {
    const a = rng() * Math.PI * 2, d = o.radius * Math.sqrt(rng());
    const x = round3(cx + Math.cos(a) * d), z = round3(cz + Math.sin(a) * d);
    const k = kinds[Math.floor(rng() * kinds.length)];
    const s = o.hMin + (o.hMax - o.hMin) * rng();
    const r = k.r > 0 ? round3(k.r * s) : 0;
    if (!spotIsFree(map, x, z, Math.max(r, LOOSE_FOOT), o.avoidPaths)) continue;
    if (crowded(near, x, z, r) || crowded(placed, x, z, r)) continue;
    const h = round3(Math.max(0.1, k.h * s));
    placed.push({
      id: newId(), key: k.key, x, z, h,
      rot: o.rotate ? Math.round(rng() * 3600) / 10 % 360 : 0,
      flip: o.flip ? rng() < 0.5 : false,
      fade: r === 0 && h >= 1.6,
      ...(r > 0 ? { solid: { r } } : {}),
    });
  }
  return placed;
}

/** A counter of fresh prop ids for one stroke: p<n>, skipping any id in use. */
export function idMaker(map: Pick<MapData, 'props'>): () => string {
  const used = new Set(map.props.map((p) => p.id));
  let n = 0;
  for (const id of used) { const m = /^p(\d+)$/.exec(id); if (m) n = Math.max(n, Number(m[1])); }
  n = Math.max(n, map.props.length);
  return () => {
    let id = `p${++n}`;
    while (used.has(id)) id = `p${++n}`;
    used.add(id);
    return id;
  };
}

/**
 * The eraser: the map's props and loose colliders without the pieces standing inside the circle (only those whose key is in
 * `keys` when given). A hub building's loose circles go with it, as with Delete.
 */
export function eraseInCircle(map: Pick<MapData, 'props' | 'colliders'>, cx: number, cz: number, radius: number, keys: ReadonlySet<string> | null): { props: MapProp[]; colliders: MapCollider[] | undefined; removed: number } {
  const gone = new Set<string>();
  const goneCols = new Set<number>();
  for (const p of map.props) {
    if (Math.hypot(p.x - cx, p.z - cz) > radius) continue;
    if (keys && !keys.has(p.key)) continue;
    gone.add(p.id);
    for (const i of followersOf(map as MapData, p)) goneCols.add(i);
  }
  if (!gone.size) return { props: map.props, colliders: map.colliders, removed: 0 };
  return {
    props: map.props.filter((p) => !gone.has(p.id)),
    colliders: goneCols.size && map.colliders ? map.colliders.filter((_, i) => !goneCols.has(i)) : map.colliders,
    removed: gone.size,
  };
}
