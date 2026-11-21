// Maps made in the /admin map editor with "＋ แมพใหม่" (owner 2026-11-21): a zone that is not in zones.ts but in the DB table
// custom_zones (its settings, CustomZoneDef) plus map_layouts (its layout, like every other map). Shared by the server and the browser.
//
//   settings  name, floor, recommended levels, safe zone, channels, Auto Play: CustomZoneDef, edited in the editor's "ตั้งค่าแมพ"
//   layout    the editor's draft / published revisions; the game runs a map only once it is published and not hidden
//   entering  through doors other maps have (the editor's door tool); there is no boss and no NPC in such a map (yet)
//
// The game learns them through MapRegistry.setCustom (the layout) + setCustomDefs (the settings), then refreshZone(id) puts the
// ZoneDef into ZONES (customZoneHook below). A map that is hidden or deleted drops out of ZONES: saves that name it land in the hub.
import { customZoneHook, type ZoneDef } from './data/zones';
import { MAP_SCHEMA_VERSION, roomSpawnOf, type MapData, type MapTheme } from './mapSchema';

export interface CustomZoneDef {
  /** `c_<letters, digits, _>`, chosen by the server when the map is made; never reused while the map exists. */
  id: string;
  /** English name (logs, some UI); may be empty, then the Thai one is used. */
  name: string;
  nameTh: string;
  floor: number;
  /** Recommended levels (shown like other maps; doors have their own minimum level). */
  levels: [number, number];
  /** The whole map (or the copied hub's walled town) is a safe zone: no fighting, monsters stay out. */
  safe: boolean;
  /** Split into channels (CH 1–10) like the farm maps. */
  channels: boolean;
  /** Auto Play allowed. */
  autoPlay: boolean;
}

export const CUSTOM_ID_RE = /^c_[a-z0-9_]{1,30}$/;
export const NAME_MAX = 40;
/** Size of a new empty floor: half its width, in world units (owner 2026-11-21: 20–150, 50 by default). */
export const EMPTY_HALF = { min: 20, max: 150, def: 50 } as const;
const THEMES: MapTheme[] = ['forest', 'marsh', 'snow', 'volcano'];

/** Settings from the page, cleaned; or the reason they are refused (Thai, shown as it is). */
export function cleanCustomDef(raw: unknown, id: string): { def: CustomZoneDef } | { error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim() : '');
  const nameTh = text(r.nameTh), name = text(r.name);
  if (!nameTh) return { error: 'ต้องมีชื่อแมพ (ภาษาไทย)' };
  if ([...nameTh].length > NAME_MAX || [...name].length > NAME_MAX) return { error: `ชื่อแมพยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร` };
  const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  const floor = int(r.floor, 1, 9);
  if (floor === null) return { error: 'ชั้นต้องเป็น 1–9' };
  const lv = Array.isArray(r.levels) ? r.levels : [];
  const lo = int(lv[0], 1, 80), hi = int(lv[1], 1, 80);
  if (lo === null || hi === null || lo > hi) return { error: 'ช่วงเลเวลต้องเป็น 1–80 และต่ำสุดไม่เกินสูงสุด' };
  return { def: { id, name, nameTh, floor, levels: [lo, hi], safe: r.safe === true, channels: r.channels === true, autoPlay: r.autoPlay !== false } };
}

// ------------------------------------------------------------------ the first layout of a new map

/** A bare floor of this theme and size: start in the middle, nothing on it. */
export function emptyMap(id: string, floor: number, theme: MapTheme, half: number): MapData {
  const h = Math.round(Math.min(EMPTY_HALF.max, Math.max(EMPTY_HALF.min, half)));
  return {
    schema: MAP_SCHEMA_VERSION, id, floor, rev: 0,
    zone: { half: h, theme: THEMES.includes(theme) ? theme : 'forest', start: { x: 0, z: 0 } },
    paths: [], water: [], props: [], blockers: [], colliders: [],
    walkable: { half: Math.max(4, h - 8) },
    npcs: [], rest: [], portals: [], spawns: [],
  };
}

/**
 * Another map's layout as the start of a new one (copy, or an imported file): its id and floor become the new map's, the revision
 * starts again, and what a new map cannot have is taken out: the boss (a boss room's `room` block and a field's summoner — owner
 * 2026-11-21: a copied room is a plain map, its arena just ground and decoration) and the NPCs (they belong to the hub's town).
 */
export function copyMap(src: MapData, id: string, floor: number): MapData {
  const m = structuredClone(src) as MapData & { room?: unknown; lair?: unknown };
  // A room's players appear 2 units off `start` (Sim.spawnPoint); on a plain map they appear on it.
  const start = m.room ? roomSpawnOf(m.zone.start) : m.zone.start;
  delete m.room;
  delete m.lair;
  return { ...m, schema: MAP_SCHEMA_VERSION, id, floor, rev: 0, zone: { ...m.zone, start: { x: start.x, z: start.z } }, npcs: [] };
}

// ------------------------------------------------------------------ the ZoneDef the game runs

const seedOf = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The zone the game runs for an editor-made map: its settings plus what its layout says (like zoneWithMap does for the others). */
export function zoneFromCustom(def: CustomZoneDef, map: MapData): ZoneDef {
  const [main, ...rest] = map.paths;
  const water = (kind: 'ice' | 'lava') => map.water.filter((w) => w.kind === kind).map(({ x, z, rx, rz }) => ({ x, z, rx, rz }));
  const ice = water('ice'), lava = water('lava');
  return {
    id: def.id,
    name: def.name || def.nameTh,
    nameTh: def.nameTh,
    subtitle: '',
    levels: [def.levels[0], def.levels[1]],
    theme: map.zone.theme,
    allowAutoPlay: def.autoPlay,
    ...(def.channels ? { channels: true } : {}),
    half: map.zone.half,
    seed: seedOf(def.id),
    start: { ...map.zone.start },
    path: main ? main.pts.map(([x, z]) => [x, z] as [number, number]) : [],
    branches: rest.map((b) => b.pts.map(([x, z]) => [x, z] as [number, number])),
    spawns: map.spawns.map((s) => ({ monster: s.monster, x: s.x, z: s.z, radius: s.radius, count: s.count, respawn: [s.respawn[0], s.respawn[1]] as [number, number] })),
    portals: map.portals.map((p) => ({ ...p })),
    // Safe: the copied hub's walled town if the layout has one, else the whole map.
    ...(def.safe ? { safe: map.zone.safe ? { ...map.zone.safe } : { x: 0, z: 0, half: map.zone.half + 1 } } : {}),
    ...(map.zone.quadrants ? { quadrants: [...map.zone.quadrants] as ZoneDef['quadrants'] } : {}),
    ...(ice.length ? { iceLakes: ice } : {}),
    ...(lava.length ? { lavaPools: lava } : {}),
    custom: true,
  };
}

// ------------------------------------------------------------------ the settings this side knows

const DEFS = new Map<string, CustomZoneDef>();

/** Replaces the known settings (the server: every editor-made map, hidden too; the browser: the ones the game runs). */
export function setCustomDefs(defs: readonly CustomZoneDef[]): void {
  DEFS.clear();
  for (const d of defs) DEFS.set(d.id, d);
}
/** Adds or replaces one (a preview of a map the browser did not know yet). */
export function putCustomDef(def: CustomZoneDef): void {
  DEFS.set(def.id, def);
}
export const customDef = (id: string): CustomZoneDef | undefined => DEFS.get(id);
export const customDefs = (): CustomZoneDef[] => [...DEFS.values()];

customZoneHook.build = (id, map) => {
  const def = DEFS.get(id);
  return def ? zoneFromCustom(def, map) : undefined;
};
