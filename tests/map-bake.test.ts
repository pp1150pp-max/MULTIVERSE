// The baked floor-1 maps (src/shared/data/maps/*.json, made by tools/bake_maps.ts) must equal what the old generators
// build, value for value (docs/plans/map-editor.md 1.1). PR 3 reads them (see map-terrain.test.ts); this compares them with the generators.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ok, finish } from './check';
import { ZONES, GENERATED_ZONES } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { NPC_IDS } from '../src/shared/data/npcs';
import { Terrain } from '../src/shared/sim/terrain';
import { validateMap, type MapData } from '../src/shared/mapSchema';
import { SHEET_SPECS } from '../src/client/assets';
import { FLOOR1_IDS, MAPS_DIR, bakeZone, bakedText } from '../tools/bake_maps';

const NPC_COLLIDER_R = 0.45; // Terrain's constructor gives every NPC one
const cmpXZR = (a: { x: number; z: number; r: number }, b: { x: number; z: number; r: number }) => a.x - b.x || a.z - b.z || a.r - b.r;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

for (const id of FLOOR1_IDS) {
  const file = readFileSync(join(MAPS_DIR, `${id}.json`), 'utf8');
  const map = JSON.parse(file) as MapData;
  const zone = GENERATED_ZONES[id];
  const old = new Terrain(zone, null);

  ok(file === bakedText(bakeZone(zone)), `${id}: re-baking gives the very same file`);
  const all = validateMap(map, { propKeys: Object.keys(SHEET_SPECS), zoneIds: Object.keys(ZONES), monsterIds: Object.keys(MONSTERS) });
  const issues = all.filter((i) => i.severity === 'error');
  ok(issues.length === 0, `${id}: passes validateMap${issues.length ? ' ' + JSON.stringify(issues.slice(0, 5)) : ''}`);
  // The only thing allowed to be a warning: the hub's start is the middle of its fountain.
  ok(all.every((i) => i.severity === 'error' || (id === 'nexus_city' && i.code === 'in_collision' && i.kind === 'zone')), `${id}: no unexpected warnings`);
  ok(map.rev === 0 && map.floor === 1 && map.props.every((p) => p.rot === 0), `${id}: rev 0, floor 1, every rot 0`);

  // props: same order, every field
  ok(same(map.props.map((p) => ({ key: p.key, x: p.x, z: p.z, height: p.h, fade: p.fade, flip: p.flip })),
    old.props.map((p) => ({ key: p.key, x: p.x, z: p.z, height: p.height, fade: p.fade, flip: !!p.flip }))), `${id}: props (${old.props.length}) equal`);
  ok(new Set(map.props.map((p) => p.id)).size === map.props.length, `${id}: prop ids unique`);

  // colliders: what the JSON gives (solid props + extras + one per NPC) as the same set as the old list
  const fromJson = [
    ...map.props.filter((p) => p.solid).map((p) => ({ x: p.x, z: p.z, r: (p.solid as { r: number }).r })),
    ...(map.colliders ?? []),
    ...map.npcs.map((n) => ({ x: n.x, z: n.z, r: NPC_COLLIDER_R })),
  ].sort(cmpXZR);
  ok(map.props.every((p) => !p.solid || 'r' in p.solid), `${id}: baked solids are circles`);
  ok(same(fromJson, [...old.colliders].sort(cmpXZR)), `${id}: colliders (${old.colliders.length}) equal`);

  // spawns, portals, npcs, rest spots, lair, zone, paths, water
  ok(same(map.spawns, zone.spawns.map((s) => ({ monster: s.monster, x: s.x, z: s.z, radius: s.radius, count: s.count, respawn: s.respawn }))), `${id}: spawns (${zone.spawns.length}) equal`);
  ok(same(map.portals, zone.portals.map((p) => ({ to: p.to, x: p.x, z: p.z, minLevel: p.minLevel }))), `${id}: portals equal`);
  const npcOld = NPC_IDS.filter((n) => old.npcPos[n]).map((n) => ({ id: n, x: old.npcPos[n]!.x, z: old.npcPos[n]!.z }));
  ok(same(map.npcs, npcOld), `${id}: npcPos (${npcOld.length}) equal`);
  ok(same(map.rest, old.restSpots.map((r) => ({ kind: r.kind, x: r.x, z: r.z }))), `${id}: restSpots equal`);
  ok(same(map.lair, zone.lair), `${id}: lair equal`);
  ok(map.zone.half === zone.half && map.walkable.half === old.bound && map.zone.theme === zone.theme
    && same(map.zone.quadrants, zone.quadrants) && same(map.zone.start, zone.start) && same(map.zone.safe, zone.safe), `${id}: zone, walkable, safe, quadrants equal`);
  ok(same(map.paths.map((p) => p.pts), [zone.path, ...zone.branches]), `${id}: paths equal`);
  ok(same(map.water.filter((w) => w.kind === 'ice').map(({ kind, ...r }) => r), zone.iceLakes ?? [])
    && same(map.water.filter((w) => w.kind === 'lava').map(({ kind, ...r }) => r), zone.lavaPools ?? []), `${id}: ice lakes and lava pools equal`);
}

finish('map-bake');
