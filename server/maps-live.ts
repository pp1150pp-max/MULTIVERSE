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
import { setCustomDefs, type CustomZoneDef } from '../src/shared/customZones';

/** Every editor-made map in the DB (hidden ones too): doors to them stay valid, the editor may open them. Set by applyMaps. */
let customIds: string[] = [];
/** The settings of an editor-made map as stored, or undefined when the row does not parse. */
export function parseDef(json: string): CustomZoneDef | undefined {
  try {
    const d = JSON.parse(json) as CustomZoneDef;
    return d && typeof d === 'object' && typeof d.id === 'string' ? d : undefined;
  } catch {
    return undefined;
  }
}
export const isCustomZone = (id: string): boolean => customIds.includes(id);

/** The sprite keys a map may use: the ones in the client's SHEET_SPECS (the catalog test keeps the two the same). */
const PROP_KEYS = (propCatalog as { props: { key: string; inSheetSpecs: boolean }[] }).props.filter((p) => p.inSheetSpecs).map((p) => p.key);

/** validateMap with the same context everywhere on the server. */
export function checkMap(map: MapData): MapIssue[] {
  // `baseline` = the bundled file: a boss room may not change what it locks (boss, arena, size) from it.
  return validateMap(map, { propKeys: PROP_KEYS, zoneIds: [...Object.keys(ZONES), ...customIds], monsterIds: Object.keys(MONSTERS), baseline: MapRegistry.bundled(map?.id) });
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

/** Is this zone one the map editor / MapRegistry knows (has a bundled layout)? Floor-1 boss rooms are, under `<field>_room`. */
export const isMapZone = (id: string): boolean => !!MapRegistry.bundled(id) || isCustomZone(id);

/** Loads the published layouts and the switch into MapRegistry and rebuilds the zones. A layout that fails the check is skipped (the bundled one stays). */
export function applyMaps(db: Db): void {
  const rows = db.customZones();
  const defs = rows.map((r) => parseDef(r.def)).filter((d): d is CustomZoneDef => !!d && d.id !== undefined);
  setCustomDefs(defs);
  const before = customIds;
  customIds = rows.map((r) => r.id);
  const live = new Set(rows.filter((r) => r.status === 'live').map((r) => r.id));
  MapRegistry.clear();
  MapRegistry.removeCustom();
  MapRegistry.setUseOverrides(currentBalance().mapFromDb);
  for (const row of db.publishedMaps()) {
    const map = parseMap(row.json);
    if (!map || map.id !== row.zoneId || !isMapZone(row.zoneId)) continue;
    const custom = isCustomZone(row.zoneId);
    if (custom && !live.has(row.zoneId)) continue; // hidden: out of the game
    if (checkMap(map).some((i) => i.severity === 'error')) {
      console.warn(`[maps] ${row.zoneId} rev ${row.rev} fails the check, ${custom ? 'left out of the game' : 'using the bundled layout'}`);
      continue;
    }
    if (custom) MapRegistry.setCustom(map);
    else MapRegistry.set(map);
  }
  // The bundled maps, every editor-made one, and any that just went away (refreshZone drops those from ZONES).
  for (const id of new Set([...MapRegistry.ids(), ...customIds, ...before])) refreshZone(id);
}

/**
 * The layout a map-editor preview room is built from (docs/plans/map-editor.md 2.3): the saved draft, else the newest published
 * one, else the bundled one, the same order as GET /api/admin/maps/:id/draft. Undefined when the zone has none or the layout
 * fails the check (a broken draft is never run).
 */
export function previewLayout(db: Db, id: string): MapData | undefined {
  if (!isMapZone(id)) return undefined;
  const draft = db.mapDraft(id);
  const pub = db.mapPublished(id);
  const map = (draft && parseMap(draft.json)) ?? (pub && parseMap(pub.json)) ?? MapRegistry.bundled(id);
  if (!map || map.id !== id || checkMap(map).some((i) => i.severity === 'error')) return undefined;
  return map;
}

/** The revisions of every zone that the browsers may fetch: {zoneId: rev}. Empty when the switch is off (they use their bundled JSON). */
export function publishedRevs(db: Db): Record<string, number> {
  if (!currentBalance().mapFromDb) return {};
  const out: Record<string, number> = {};
  for (const row of db.publishedMaps()) if (!isCustomZone(row.zoneId) || MapRegistry.isCustom(row.zoneId)) out[row.zoneId] = row.rev;
  return out;
}

/** The editor-made maps the game runs now, for the browsers (GET /api/zones): their settings and published revision. */
export function liveCustomZones(db: Db): { def: CustomZoneDef; rev: number }[] {
  const out: { def: CustomZoneDef; rev: number }[] = [];
  for (const r of db.customZones()) {
    const def = parseDef(r.def);
    const map = MapRegistry.isCustom(r.id) ? MapRegistry.get(r.id) : undefined;
    if (def && map) out.push({ def, rev: map.rev });
  }
  return out;
}
