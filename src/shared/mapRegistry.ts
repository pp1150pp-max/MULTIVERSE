// Where the game gets a map's layout from (docs/plans/map-editor.md, section 3.4, PR 3).
//
// For now there is only one source: the JSON baked into the bundle (src/shared/data/maps/*.json, made by
// tools/bake_maps.ts). Server and browser import the same files, so both build the same Terrain. No DB, no network:
// PR 5 adds `set()` callers (published layouts from the DB, a draft preview) and the /admin switch below decides
// whether those are used at all.
import type { MapData } from './mapSchema';
import nexus_city from './data/maps/nexus_city.json';
import emerald_forest from './data/maps/emerald_forest.json';
import misty_marsh from './data/maps/misty_marsh.json';
import frost_reach from './data/maps/frost_reach.json';
import ashen_isle from './data/maps/ashen_isle.json';
import emerald_forest_room from './data/maps/emerald_forest_room.json';
import misty_marsh_room from './data/maps/misty_marsh_room.json';
import frost_reach_room from './data/maps/frost_reach_room.json';
import ashen_isle_room from './data/maps/ashen_isle_room.json';

const BUNDLED: Record<string, MapData> = Object.fromEntries(
  ([nexus_city, emerald_forest, emerald_forest_room, misty_marsh, misty_marsh_room, frost_reach, frost_reach_room, ashen_isle, ashen_isle_room] as unknown as MapData[]).map((m) => [m.id, m]),
);

/** Layouts that replace the bundled ones (empty in PR 3: nothing sets them yet). */
const override = new Map<string, MapData>();
/**
 * Maps made in the editor with "＋ แมพใหม่" (src/shared/customZones.ts): they have no bundled JSON, only a published layout in the DB.
 * Not touched by the "ใช้แมพจาก DB" switch (there is no file to fall back to); a hidden or deleted one is simply not here.
 */
const custom = new Map<string, MapData>();
/** /admin "ใช้แมพจาก DB" (balance.mapFromDb). Off = always the bundled JSON, the emergency way out. Does nothing while `override` is empty. */
let useOverrides = true;

export const MapRegistry = {
  /** The layout for a zone or floor-1 boss room (id `<field>_room`), or undefined when it has none. */
  get(zoneId: string): MapData | undefined {
    return (useOverrides ? override.get(zoneId) : undefined) ?? BUNDLED[zoneId] ?? custom.get(zoneId);
  },
  /** The JSON that ships with the game, whatever the switch says. */
  bundled(zoneId: string): MapData | undefined {
    return BUNDLED[zoneId];
  },
  /** The bundled maps, then the editor-made maps the game runs now. */
  ids(): string[] {
    return [...Object.keys(BUNDLED), ...custom.keys()];
  },
  /** An editor-made map (published, not hidden) for the game to run. */
  setCustom(map: MapData): void {
    custom.set(map.id, map);
  },
  removeCustom(zoneId?: string): void {
    if (zoneId) custom.delete(zoneId);
    else custom.clear();
  },
  isCustom(zoneId: string): boolean {
    return custom.has(zoneId);
  },
  /** Replace a zone's layout (PR 5 and later). Takes effect for Terrains built afterwards. */
  set(map: MapData): void {
    override.set(map.id, map);
  },
  clear(zoneId?: string): void {
    if (zoneId) override.delete(zoneId);
    else override.clear();
  },
  setUseOverrides(on: boolean): void {
    useOverrides = on;
  },
};
