// The dark water pools painted on the ground of the marsh and floor 2's farm maps (the browser's World.paintPools draws them).
// They don't change how anyone walks, but a treasure chest never comes up in one (src/shared/chestSpots.ts), so where they lie
// is worked out here, from the map's seed, the same for the server and the browser.
import { clearingRadius, lairOf, type ZoneDef } from './data/zones';
import type { MapTheme } from './mapSchema';
import { mulberry32, type Rng } from './rng';
import type { Terrain } from './sim/terrain';

export interface PoolBlob { x: number; z: number; rx: number; rz: number }

/** Pools scattered off the path, per theme (none elsewhere). */
export const GROUND_POOLS: Partial<Record<MapTheme, number>> = { marsh: 70, beach: 26, cove: 18, grave: 22, kraken: 18 };

/** What the ground paints before the pools, from the same random numbers: dark and light patches, specks, grass tufts. */
export const GROUND_PATCHES: readonly [number, number] = [260, 200];
export const GROUND_SPECKS = 70000;
export const GROUND_TUFTS = 9000;
/** Random numbers those use up: 4 a patch, 4 a speck, 2 a tuft. */
const BEFORE_POOLS = (GROUND_PATCHES[0] + GROUND_PATCHES[1]) * 4 + GROUND_SPECKS * 4 + GROUND_TUFTS * 2;

const between = (r: Rng, a: number, b: number) => a + r() * (b - a);

/** The pools (each a few overlapping ellipses), drawn from `r` as it stands: clear of the paths, the camp and the boss. */
export function rollPools(zone: ZoneDef, terrain: Terrain, r: Rng): PoolBlob[][] {
  const count = GROUND_POOLS[zone.theme] ?? 0;
  const B = terrain.bound;
  const lair = lairOf(zone);
  const away = (x: number, z: number, p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) > d;
  const pools: PoolBlob[][] = [];
  for (let i = 0, made = 0; i < 600 && made < count; i++) {
    const x = between(r, -B, B);
    const z = between(r, -B, B);
    const rad = between(r, 1.4, 4.2);
    if (terrain.distToPath(x, z) < rad + 2.2) continue;
    if (!away(x, z, zone.start, 12 + rad) || (lair && !away(x, z, lair, clearingRadius(zone) + rad))) continue;
    made++;
    pools.push(Array.from({ length: 3 + ((r() * 3) | 0) }, () => ({
      x: x + between(r, -rad * 0.6, rad * 0.6),
      z: z + between(r, -rad * 0.6, rad * 0.6),
      rx: rad * between(r, 0.5, 0.9),
      rz: rad * between(r, 0.4, 0.75),
    })));
  }
  return pools;
}

/** The pools of a zone as laid out: what the browser paints. */
export function groundPools(zone: ZoneDef, terrain: Terrain): PoolBlob[][] {
  if (!GROUND_POOLS[zone.theme]) return [];
  const r = mulberry32(zone.seed);
  for (let i = 0; i < BEFORE_POOLS; i++) r();
  return rollPools(zone, terrain, r);
}
