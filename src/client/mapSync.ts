// Gets the map layouts the owner published (docs/plans/map-editor.md, section 3.3 step 4) into MapRegistry, so the browser builds the
// same Terrain as the server. Like the paper look: asked before the game's pictures load; anything missing or failing falls back to the
// JSON in the bundle, so the game always starts.
//
//   boot          GET /api/maps -> {zoneId: rev}; each rev comes from the cache (localStorage, one entry per zone) or GET /api/maps/:id?rev=N
//   zone change   the server's `welcome` / `zone` message carries the rev its room was built from (Terrain.mapRev); if ours differs,
//                 ensureMap() loads that one first (OnlineBackend holds the messages meanwhile)
import { refreshZone } from '../shared/data/zones';
import { MapRegistry } from '../shared/mapRegistry';
import type { MapData } from '../shared/mapSchema';

const CACHE_PREFIX = 'mv.map.';
const BOOT_TIMEOUT_MS = 3000;
const ZONE_TIMEOUT_MS = 8000;

interface Cached { rev: number; map: MapData }

function readCache(id: string): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_PREFIX + id) ?? 'null') as Cached | null;
    return c && c.rev > 0 && c.map?.id === id ? c : null;
  } catch {
    return null;
  }
}

function writeCache(id: string, c: Cached): void {
  try {
    localStorage.setItem(CACHE_PREFIX + id, JSON.stringify(c));
  } catch {
    // Full or blocked storage: the map is just fetched again next time.
  }
}

async function getJson<T>(url: string, ms: number): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}

/** The map of revision `rev` for a zone, from the cache or the server. */
async function fetchRev(id: string, rev: number, ms: number): Promise<MapData> {
  const cached = readCache(id);
  if (cached?.rev === rev) return cached.map;
  const map = await getJson<MapData>(`/api/maps/${id}?rev=${rev}`, ms);
  if (map?.id !== id) throw new Error('wrong map');
  writeCache(id, { rev, map });
  return map;
}

/** Makes the zone use revision `rev` (0 = the bundled JSON). Returns false when it could not be fetched (the bundled one is used). */
async function use(id: string, rev: number, ms: number): Promise<boolean> {
  if (!MapRegistry.ids().includes(id)) return true; // a boss room or a zone without a layout file
  if (MapRegistry.get(id)?.rev === rev) return true;
  try {
    if (rev > 0) MapRegistry.set(await fetchRev(id, rev, ms));
    else MapRegistry.clear(id);
  } catch {
    MapRegistry.clear(id);
    refreshZone(id);
    return false;
  }
  refreshZone(id);
  return true;
}

/** Before the game's pictures load: the newest published layouts. Never throws, never waits longer than BOOT_TIMEOUT_MS per fetch. */
export async function loadPublishedMaps(): Promise<void> {
  try {
    const revs = await getJson<Record<string, number>>('/api/maps', BOOT_TIMEOUT_MS);
    await Promise.all(Object.entries(revs).map(([id, rev]) => (Number.isSafeInteger(rev) ? use(id, rev, BOOT_TIMEOUT_MS) : true)));
  } catch {
    // Offline or an old server: the JSON in the bundle.
  }
}

/** Does the browser already hold revision `rev` of this zone's layout (or does the zone have none)? */
export function mapIsCurrent(zoneId: string, rev: number | undefined): boolean {
  return rev === undefined || !MapRegistry.ids().includes(zoneId) || (MapRegistry.get(zoneId)?.rev ?? 0) === rev;
}

/** Loads the layout revision the server's room for this zone was built from, so the browser's Terrain matches it. Never throws. */
export async function ensureMap(zoneId: string, rev: number | undefined): Promise<void> {
  if (rev === undefined || mapIsCurrent(zoneId, rev)) return;
  await use(zoneId, rev, ZONE_TIMEOUT_MS);
}
