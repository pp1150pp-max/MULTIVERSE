// The map layouts the game runs on the server (docs/plans/map-editor.md, section 3.3): the published rows of
// `map_layouts` replace the JSON that ships with the game, unless the /admin switch "ใช้แมพจาก DB" is off.
//
// applyMaps() puts them into MapRegistry and rebuilds the zones from it. It is cheap and can run any time: a channel
// or boss room that is already running keeps the ZoneDef and Terrain it was made with, so nothing changes under the feet
// of the players in it. Every channel opened afterwards (a new Sim) takes the new layout, and the empty hub is made again
// with it (Channels.sweep). No restart.
import type { Db } from './db';
import { currentBalance } from '../src/shared/balance';
import { MONSTERS } from '../src/shared/data/monsters';
import propCatalog from '../src/shared/data/propCatalog.json';
import { refreshZone, ZONES } from '../src/shared/data/zones';
import { MapRegistry } from '../src/shared/mapRegistry';
import { validateMap, type MapData, type MapIssue } from '../src/shared/mapSchema';

/** The sprite keys a map may use: the ones in the client's SHEET_SPECS (the catalog test keeps the two the same). */
const PROP_KEYS = (propCatalog as { props: { key: string; inSheetSpecs: boolean }[] }).props.filter((p) => p.inSheetSpecs).map((p) => p.key);

/** validateMap with the same context everywhere on the server. */
export function checkMap(map: MapData): MapIssue[] {
  return validateMap(map, { propKeys: PROP_KEYS, zoneIds: Object.keys(ZONES), monsterIds: Object.keys(MONSTERS) });
}

/** A map from stored JSON, or undefined when it does not parse. */
export function parseMap(json: string): MapData | undefined {
  try {
    const m = JSON.parse(json) as MapData;
    return m && typeof m === 'object' ? m : undefined;
  } catch {
    return undefined;
  }
}

/** Is this zone one the map editor / MapRegistry knows (has a bundled layout)? */
export const isMapZone = (id: string): boolean => MapRegistry.ids().includes(id);

/** Loads the published layouts and the switch into MapRegistry and rebuilds the zones. A layout that fails the check is skipped (the bundled one stays). */
export function applyMaps(db: Db): void {
  MapRegistry.clear();
  MapRegistry.setUseOverrides(currentBalance().mapFromDb);
  for (const row of db.publishedMaps()) {
    const map = parseMap(row.json);
    if (!map || map.id !== row.zoneId || !isMapZone(row.zoneId)) continue;
    if (checkMap(map).some((i) => i.severity === 'error')) {
      console.warn(`[maps] ${row.zoneId} rev ${row.rev} fails the check, using the bundled layout`);
      continue;
    }
    MapRegistry.set(map);
  }
  for (const id of MapRegistry.ids()) refreshZone(id);
}

/** The revisions of every zone that the browsers may fetch: {zoneId: rev}. Empty when the switch is off (they use their bundled JSON). */
export function publishedRevs(db: Db): Record<string, number> {
  if (!currentBalance().mapFromDb) return {};
  const out: Record<string, number> = {};
  for (const row of db.publishedMaps()) out[row.zoneId] = row.rev;
  return out;
}
