// Where a treasure chest comes up (owner 2026-11-28: a new random spot every time it appears, anywhere on the map; rules:
// docs/systems/chests-shrines.md). Never in water (a whirlpool, an ice lake, a tide pool), lava, anything solid or the town's
// safe area, and only where a player can walk from the camp. The distances kept from the camp, the doors, the boss summoner
// and other chests are /admin numbers (TreasureConfig). Pure rules, no DOM: the server's Sim picks.
import { inSafeArea, inWhirlpoolCircle, lairOf, type ZoneDef } from './data/zones';
import type { Rng } from './rng';
import type { Terrain } from './sim/terrain';
import type { TreasureConfig } from './treasure';

export interface Spot { x: number; z: number }

/** Grid step of the search (world units). */
const CELL = 1;
/** A player walking there (Player.radius). */
const BODY = 0.4;
/** Open ground round a chest: for its picture, and the pieces it drops. */
export const CHEST_ROOM = 1.2;
/** Kept off the map's walkable edge, and off water, lava and the safe area. */
export const CHEST_EDGE = 4;
export const CHEST_WET = 2;

/** Water, lava or the safe area at (x, z), `pad` round them counted too. */
export function chestKeepOut(zone: ZoneDef, terrain: Terrain, x: number, z: number, pad = CHEST_WET): boolean {
  if (inWhirlpoolCircle(zone, x, z, pad)) return true;
  if ([...(zone.iceLakes ?? []), ...(zone.lavaPools ?? [])].some((l) => Math.hypot((x - l.x) / (l.rx + pad), (z - l.z) / (l.rz + pad)) < 1)) return true;
  if (zone.safe && (inSafeArea(zone, x, z) || (Math.abs(x - zone.safe.x) < zone.safe.half + pad && Math.abs(z - zone.safe.z) < zone.safe.half + pad))) return true;
  return terrain.props.some((p) => p.key === 'tide_pool' && Math.hypot(x - p.x, z - p.z) < pad);
}

/** Size of the squares nearbyBlocked sorts the obstacles into. */
const BUCKET = 8;

/**
 * Terrain.isBlocked (radius up to CHEST_ROOM) looking only at the obstacles near each point: asking about tens of thousands
 * of points against a farm map's whole list held the server up for over a second.
 */
function nearbyBlocked(terrain: Terrain): (x: number, z: number, r: number) => boolean {
  const near = new Map<string, Terrain>();
  return (x, z, r) => {
    const bx = Math.floor(x / BUCKET);
    const bz = Math.floor(z / BUCKET);
    const key = `${bx},${bz}`;
    let t = near.get(key);
    if (!t) {
      const cx = (bx + 0.5) * BUCKET;
      const cz = (bz + 0.5) * BUCKET;
      const reach = BUCKET * Math.SQRT1_2 + CHEST_ROOM;
      // The same terrain (and the same rules), with shorter lists.
      t = Object.create(terrain, {
        colliders: { value: terrain.colliders.filter((c) => Math.hypot(c.x - cx, c.z - cz) < c.r + reach) },
        boxes: { value: terrain.boxes.filter((b) => Math.hypot(b.x - cx, b.z - cz) < Math.hypot(b.w, b.d) / 2 + reach) },
      }) as Terrain;
      near.set(key, t);
    }
    return t.isBlocked(x, z, r);
  };
}

/** Every grid spot a chest may stand on, per zone as laid out now (searched once: it walks the whole map). */
const cache = new WeakMap<ZoneDef, { rev: number; spots: Spot[] }>();

export function chestGround(zone: ZoneDef, terrain: Terrain): readonly Spot[] {
  const had = cache.get(zone);
  if (had && had.rev === terrain.mapRev) return had.spots;
  // Walk the grid from the camp: only ground a player can get to.
  const half = Math.floor(terrain.bound / CELL);
  const n = half * 2 + 1;
  const at = (i: number) => (i - half) * CELL;
  const seen = new Uint8Array(n * n);
  const queue: number[] = [];
  const blocked = nearbyBlocked(terrain);
  const visit = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= n || r >= n || seen[r * n + c]) return;
    seen[r * n + c] = 1;
    if (!blocked(at(c), at(r), BODY)) queue.push(r * n + c);
  };
  // The start itself may be solid (a campfire): begin on the open cells nearest to it.
  const sc = Math.round(zone.start.x / CELL) + half;
  const sr = Math.round(zone.start.z / CELL) + half;
  for (let ring = 0; ring < 12 && !queue.length; ring++) {
    for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) visit(sc + dc, sr + dr);
  }
  const spots: Spot[] = [];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q] % n;
    const r = Math.floor(queue[q] / n);
    const x = at(c);
    const z = at(r);
    if (Math.abs(x) <= terrain.bound - CHEST_EDGE && Math.abs(z) <= terrain.bound - CHEST_EDGE
      && !blocked(x, z, CHEST_ROOM) && !chestKeepOut(zone, terrain, x, z)) spots.push({ x, z });
    visit(c + 1, r);
    visit(c - 1, r);
    visit(c, r + 1);
    visit(c, r - 1);
  }
  cache.set(zone, { rev: terrain.mapRev, spots });
  return spots;
}

/**
 * One random spot, the /admin distances kept; `taken` = the other chests and where this one stood last. A map too crowded for
 * the distances gets them halved until a spot fits (water and solid ground are never relaxed). Null: no ground at all.
 */
export function pickChestSpot(zone: ZoneDef, terrain: Terrain, cfg: TreasureConfig, taken: readonly Spot[], r: Rng): Spot | null {
  const ground = chestGround(zone, terrain);
  const lair = lairOf(zone);
  const away: [readonly Spot[], number][] = [
    [[zone.start, ...terrain.restSpots], cfg.campGap],
    [[...zone.portals, ...(zone.warps ?? []).flatMap((w) => [w, { x: w.toX, z: w.toZ }])], cfg.doorGap],
    [lair ? [lair] : [], cfg.bossGap],
    [taken, cfg.spotGap],
  ];
  for (const k of [1, 0.5, 0.25, 0]) {
    const fit = ground.filter((s) => away.every(([list, gap]) => list.every((o) => Math.hypot(s.x - o.x, s.z - o.z) >= gap * k)));
    if (fit.length) {
      const s = fit[Math.min(fit.length - 1, Math.floor(r() * fit.length))];
      return { x: s.x, z: s.z };
    }
  }
  return null;
}
