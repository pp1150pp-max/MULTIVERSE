// Bakes the floor-1 and floor-2 maps into JSON (docs/plans/map-editor.md, section 1.1, PR 2).
//
//   node --import tsx tools/bake_maps.ts
//
// Runs the old generators ONCE per map (scatterZone / hubLoners / rotateZone through ZONES, and Terrain with its
// seeded placeProps + placeTown) and writes src/shared/data/maps/<zoneId>.json as MapData. Nothing reads those
// files yet (PR 3 does). Same code, same seeds, so the output is identical on every run; tests/map-bake.test.ts
// checks that and compares every value with a fresh Terrain.
//
// Also bakes the four floor-1 boss rooms (<field>_room.json, GENERATED_ROOMS) with a `room` block that marks them and the values the
// editor may not change (boss, arena); validateMap() compares them with the bundled file.
//
// Not baked: monster boosts (`SpawnArea.boost`, from the zone's monsterBoost, stays in code), zone names/levels/stats, the boss's stats.
import { bakedText } from '../src/shared/mapText';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_ROOMS, GENERATED_ZONES, arenaRadius, type ZoneDef } from '../src/shared/data/zones';
import { NPC_IDS } from '../src/shared/data/npcs';
import { npcHasCollider, Terrain } from '../src/shared/sim/terrain';
import { TRAIL_WIDTH } from '../src/shared/groundLook';
import { MAP_SCHEMA_VERSION, type MapData, type MapProp, type MapCollider, type MapNpc } from '../src/shared/mapSchema';

/** The floor-1 maps, hub first. */
export const FLOOR1_IDS = ['nexus_city', 'emerald_forest', 'misty_marsh', 'frost_reach', 'ashen_isle'];
/** The floor-2 maps, its town first (the harbour, then Shipwreck Beach, Smugglers' Cove, the Ghost Ship Graveyard and the Kraken Maelstrom). */
export const FLOOR2_IDS = ['harbor_town', 'shipwreck_beach', 'smugglers_cove', 'ghost_ship_graveyard', 'kraken_maelstrom'];
/** Every map (not boss rooms), floor by floor. */
export const MAP_IDS = [...FLOOR1_IDS, ...FLOOR2_IDS];
/** The boss rooms (ZoneDef.id of GENERATED_ROOMS), each next to its field. */
export const BOSS_ROOM_IDS = MAP_IDS.filter((id) => GENERATED_ZONES[id].lair).map((id) => `${id}_room`);
/** Every map file the bake writes: the maps, then the rooms. */
export const BAKED_IDS = [...MAP_IDS, ...BOSS_ROOM_IDS];
/** The generator's zone for a baked map id (a map or a boss room). */
export const generatedZone = (id: string): ZoneDef => GENERATED_ZONES[id] ?? GENERATED_ROOMS[id];

export const MAPS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'data', 'maps');

type AddProp = (key: string, x: number, z: number, height: number, collideR: number, fade?: boolean) => void;

/** Builds a Terrain the old way and records which collider each prop pushed (Terrain does not keep that). */
function buildTerrain(zone: ZoneDef): { terrain: Terrain; owner: Map<number, number> } {
  const proto = Terrain.prototype as unknown as { addProp: AddProp };
  const original = proto.addProp;
  const owner = new Map<number, number>(); // collider index -> prop index
  proto.addProp = function (this: Terrain, key, x, z, height, collideR, fade) {
    const before = this.colliders.length;
    original.call(this, key, x, z, height, collideR, fade);
    if (this.colliders.length > before) owner.set(this.colliders.length - 1, this.props.length - 1);
  };
  try {
    return { terrain: new Terrain(zone, null), owner };
  } finally {
    proto.addProp = original;
  }
}

export function bakeZone(zone: ZoneDef): MapData {
  const { terrain: t, owner } = buildTerrain(zone);

  const colliderOfProp = new Map<number, MapCollider>();
  for (const [ci, pi] of owner) colliderOfProp.set(pi, t.colliders[ci]);
  const props: MapProp[] = t.props.map((p, i) => {
    const prop: MapProp = { id: `p${i + 1}`, key: p.key, x: p.x, z: p.z, h: p.height, rot: 0, flip: !!p.flip, fade: p.fade };
    const c = colliderOfProp.get(i);
    if (c) prop.solid = { r: c.r };
    return prop;
  });

  // Colliders no prop pushed: the town's own (fountain, house footprints, wall line, the harbour's water edge). The NPCs' (r 0.45)
  // are the very last ones, pushed by the constructor for each solid NPC (npcHasCollider); not stored, the NPC list gives them back.
  const npcs: MapNpc[] = [];
  let npcSolids = 0;
  for (const id of NPC_IDS) {
    const n = t.npcPos[id];
    if (!n) continue;
    npcs.push({ id, x: n.x, z: n.z });
    if (npcHasCollider(id, zone)) npcSolids++;
  }
  const own = t.colliders.slice(0, t.colliders.length - npcSolids);
  const colliders: MapCollider[] = own.filter((_, i) => !owner.has(i)).map((c) => ({ x: c.x, z: c.z, r: c.r }));

  const water: MapData['water'] = [
    ...(zone.iceLakes ?? []).map((l) => ({ kind: 'ice' as const, x: l.x, z: l.z, rx: l.rx, rz: l.rz })),
    ...(zone.lavaPools ?? []).map((l) => ({ kind: 'lava' as const, x: l.x, z: l.z, rx: l.rx, rz: l.rz })),
    // A boss room's whirlpool stays in code (bossRoom, like its boss and arena): a room file holds no water (validateMap).
    ...(zone.roomOf ? [] : zone.whirlpools ?? []).map((w) => ({ kind: 'whirlpool' as const, x: w.x, z: w.z, rx: w.r, rz: w.r, ...(w.island ? { island: w.island } : {}) })),
  ];
  const w = TRAIL_WIDTH[zone.theme];
  const map: MapData = {
    schema: MAP_SCHEMA_VERSION,
    id: zone.id,
    floor: zone.floor ?? 1,
    rev: 0,
    zone: {
      half: zone.half,
      theme: zone.theme,
      ...(zone.quadrants ? { quadrants: [...zone.quadrants] as MapData['zone']['quadrants'] } : {}),
      start: { x: zone.start.x, z: zone.start.z },
      ...(zone.safe ? { safe: { x: zone.safe.x, z: zone.safe.z, half: zone.safe.half } } : {}),
    },
    // A boss room has no path (its "path" is one empty list): bake none instead of a path without points.
    paths: [zone.path, ...zone.branches].filter((pts) => pts.length > 0).map((pts, i) => ({ id: i === 0 ? 'main' : `branch${i}`, w, pts: pts.map(([x, z]) => [x, z] as [number, number]) })),
    water,
    props,
    blockers: [],
    colliders,
    walkable: { half: t.bound },
    npcs,
    rest: t.restSpots.map((r) => ({ kind: r.kind, x: r.x, z: r.z })),
    portals: zone.portals.map((p) => ({
      to: p.to, x: p.x, z: p.z, minLevel: p.minLevel,
      ...(p.requires ? { requires: p.requires } : {}), ...(p.soonName ? { soonName: p.soonName } : {}), ...(p.prop ? { prop: p.prop } : {}),
    })),
    spawns: zone.spawns.map((s) => ({ monster: s.monster, x: s.x, z: s.z, radius: s.radius, count: s.count, respawn: [s.respawn[0], s.respawn[1]] as [number, number] })),
  };
  if (zone.warps?.length) map.warps = zone.warps.map((w) => ({ x: w.x, z: w.z, toX: w.toX, toZ: w.toZ }));
  if (zone.lair) map.lair = { boss: zone.lair.boss, x: zone.lair.x, z: zone.lair.z };
  if (zone.roomOf && zone.boss) {
    map.room = { of: zone.roomOf, arena: arenaRadius(zone), boss: { monster: zone.boss.monster, x: zone.boss.x, z: zone.boss.z, radius: zone.boss.radius } };
  }
  return map;
}

export { bakedText };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(MAPS_DIR, { recursive: true });
  for (const id of BAKED_IDS) {
    const map = bakeZone(generatedZone(id));
    writeFileSync(join(MAPS_DIR, `${id}.json`), bakedText(map));
    console.log(`${id}: ${map.props.length} props, ${(map.colliders ?? []).length} extra colliders, ${map.spawns.length} spawns`);
  }
}
