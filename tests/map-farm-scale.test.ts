// Floor 1's four farm maps grew x1.5 a side (owner 2026-11-24, docs/systems/map-editor.md "ขยายแมพฟาร์มชั้น 1"):
// - only those four changed size; the towns, boss rooms and floor 2 keep theirs
// - each has about as many monster spots per area as before (FARM_DENSITY)
// - a layout drawn at another size than the game's file fails validateMap ('locked'), so the server skips an old published rev
//   (applyMaps) and does not tell the browsers to load it (publishedRevs). Throwaway DB in the temp folder, never server/data.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ok, finish } from './check';
import { FARM_SCALE, ZONES } from '../src/shared/data/zones';
import { MapRegistry } from '../src/shared/mapRegistry';
import { validateMap, type MapData } from '../src/shared/mapSchema';
import { SHEET_SPECS } from '../src/client/assets';
import { Db } from '../server/db';
import { applyMaps, publishedRevs } from '../server/maps-live';

const FARMS = ['emerald_forest', 'misty_marsh', 'frost_reach', 'ashen_isle'];
/** Sizes before the change (half 64, 47-ish spots each). */
const OLD_HALF = 64;
const OLD_SPOTS: Record<string, number> = { emerald_forest: 47, misty_marsh: 44, frost_reach: 38, ashen_isle: 42 };

ok(FARM_SCALE === 1.5, 'farm maps grow x1.5 a side');
for (const id of FARMS) {
  const map = MapRegistry.bundled(id)!;
  ok(map.zone.half === OLD_HALF * FARM_SCALE && ZONES[id].half === map.zone.half, `${id}: half ${map.zone.half} (was ${OLD_HALF})`);
  ok(map.walkable.half === map.zone.half - 8, `${id}: walkable frame follows (${map.walkable.half})`);
  const ratio = map.spawns.length / OLD_SPOTS[id];
  ok(ratio > 2.1 && ratio < 2.4, `${id}: ${map.spawns.length} monster spots, x${ratio.toFixed(2)} for x2.25 the area`);
  const zone = ZONES[id];
  const back = zone.portals[0];
  ok(Math.hypot(back.x - zone.start.x, back.z - zone.start.z) < 9, `${id}: portal back to town still beside the camp`);
}
// Untouched: the towns, the boss rooms and floor 2.
for (const [id, half] of [['nexus_city', 69], ['harbor_town', 35], ['shipwreck_beach', 64], ['smugglers_cove', 64]] as const) {
  ok(MapRegistry.bundled(id)?.zone.half === half, `${id}: keeps half ${half}`);
}
for (const id of FARMS) ok(MapRegistry.bundled(`${id}_room`)!.zone.half < 40, `${id}_room: boss room keeps its own size`);

// validateMap: another size than the bundled file = 'locked'; the same file passes.
const PROP_KEYS = Object.keys(SHEET_SPECS);
const ctx = (id: string) => ({ propKeys: PROP_KEYS, baseline: MapRegistry.bundled(id) });
const bundled = structuredClone(MapRegistry.bundled('emerald_forest')!);
ok(!validateMap(bundled, ctx('emerald_forest')).some((i) => i.code === 'locked'), 'the bundled farm map passes the size check');
const wrongSize: MapData = { ...structuredClone(bundled), zone: { ...bundled.zone, half: 100 } };
ok(validateMap(wrongSize, ctx('emerald_forest')).some((i) => i.code === 'locked' && i.severity === 'error'), 'a layout of another size fails (locked)');
ok(!validateMap(wrongSize, { propKeys: PROP_KEYS }).some((i) => i.code === 'locked'), 'without a bundled file (an editor-made map) the size is free');

// Server: an old-size published row is skipped and not advertised; a right-size one is used and advertised.
const dir = mkdtempSync(join(tmpdir(), 'multiverse-farm-scale-'));
const db = new Db(join(dir, 'test.db'));
try {
  const raw = (db as unknown as { db: { prepare(sql: string): { run(...a: unknown[]): unknown } } }).db;
  const put = (map: MapData) => raw.prepare("INSERT INTO map_layouts (zone_id, rev, json, status, author, updated_at) VALUES (?, ?, ?, 'published', 'test', 0)")
    .run(map.id, map.rev, JSON.stringify(map));
  put({ ...wrongSize, rev: 1 });
  const marsh = { ...structuredClone(MapRegistry.bundled('misty_marsh')!), rev: 1 };
  put(marsh);
  const warn = console.warn;
  const warned: string[] = [];
  console.warn = (m: string) => warned.push(String(m));
  try { applyMaps(db); } finally { console.warn = warn; }
  ok(warned.some((m) => m.includes('emerald_forest rev 1 fails the check')), 'server logs the old-size layout as skipped');
  ok(MapRegistry.get('emerald_forest')?.rev === 0 && ZONES.emerald_forest.half === 96, 'the game runs the bundled (new-size) forest');
  ok(MapRegistry.get('misty_marsh')?.rev === 1, 'a right-size published layout is still used');
  const revs = publishedRevs(db);
  ok(!('emerald_forest' in revs), 'browsers are not told to load the skipped layout');
  ok(revs.misty_marsh === 1, 'browsers are told about the used one');
} finally {
  MapRegistry.clear();
  db.close();
  rmSync(dir, { recursive: true, force: true });
}

finish('map-farm-scale');
