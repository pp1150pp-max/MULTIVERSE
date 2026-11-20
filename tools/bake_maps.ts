// Bakes the floor-1 maps into JSON (docs/plans/map-editor.md, section 1.1, PR 2).
//
//   node --import tsx tools/bake_maps.ts
//
// Runs the old generators ONCE per map (scatterZone / hubLoners / rotateZone through ZONES, and Terrain with its
// seeded placeProps + placeTown) and writes src/shared/data/maps/<zoneId>.json as MapData. Nothing reads those
// files yet (PR 3 does). Same code, same seeds, so the output is identical on every run; tests/map-bake.test.ts
// checks that and compares every value with a fresh Terrain.
//
// Not baked: monster boosts (`SpawnArea.boost`, from the zone's monsterBoost, stays in code), zone names/levels/stats,
// boss rooms (built from the field map by bossRoom()).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_ZONES, type ZoneDef } from '../src/shared/data/zones';
import { NPC_IDS } from '../src/shared/data/npcs';
import { Terrain } from '../src/shared/sim/terrain';
import { MAP_SCHEMA_VERSION, type MapData, type MapProp, type MapCollider, type MapNpc } from '../src/shared/mapSchema';

/** The floor-1 maps, hub first. */
export const FLOOR1_IDS = ['nexus_city', 'emerald_forest', 'misty_marsh', 'frost_reach', 'ashen_isle'];

/** Trail width per theme: a copy of TRAIL_WIDTH in src/client/world.ts (which can't be imported without three). */
const TRAIL_WIDTH = { forest: 4.2, marsh: 3.6, snow: 3.8, volcano: 3.8 } as const;

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

  // Colliders no prop pushed: the town's own (fountain, house footprints, wall line). The NPCs' (r 0.45) are the very last
  // ones, pushed by the constructor; they are not stored, the NPC list gives them back.
  const npcs: MapNpc[] = [];
  for (const id of NPC_IDS) {
    const n = t.npcPos[id];
    if (n) npcs.push({ id, x: n.x, z: n.z });
  }
  const own = t.colliders.slice(0, t.colliders.length - npcs.length);
  const colliders: MapCollider[] = own.filter((_, i) => !owner.has(i)).map((c) => ({ x: c.x, z: c.z, r: c.r }));

  const water: MapData['water'] = [
    ...(zone.iceLakes ?? []).map((l) => ({ kind: 'ice' as const, x: l.x, z: l.z, rx: l.rx, rz: l.rz })),
    ...(zone.lavaPools ?? []).map((l) => ({ kind: 'lava' as const, x: l.x, z: l.z, rx: l.rx, rz: l.rz })),
  ];
  const w = TRAIL_WIDTH[zone.theme];
  const map: MapData = {
    schema: MAP_SCHEMA_VERSION,
    id: zone.id,
    floor: 1,
    rev: 0,
    zone: {
      half: zone.half,
      theme: zone.theme,
      ...(zone.quadrants ? { quadrants: [...zone.quadrants] as MapData['zone']['quadrants'] } : {}),
      start: { x: zone.start.x, z: zone.start.z },
      ...(zone.safe ? { safe: { x: zone.safe.x, z: zone.safe.z, half: zone.safe.half } } : {}),
    },
    paths: [zone.path, ...zone.branches].map((pts, i) => ({ id: i === 0 ? 'main' : `branch${i}`, w, pts: pts.map(([x, z]) => [x, z] as [number, number]) })),
    water,
    props,
    blockers: [],
    colliders,
    walkable: { half: t.bound },
    npcs,
    rest: t.restSpots.map((r) => ({ kind: r.kind, x: r.x, z: r.z })),
    portals: zone.portals.map((p) => ({ to: p.to, x: p.x, z: p.z, minLevel: p.minLevel })),
    spawns: zone.spawns.map((s) => ({ monster: s.monster, x: s.x, z: s.z, radius: s.radius, count: s.count, respawn: [s.respawn[0], s.respawn[1]] as [number, number] })),
  };
  if (zone.lair) map.lair = { boss: zone.lair.boss, x: zone.lair.x, z: zone.lair.z };
  return map;
}

/** The exact text of a baked file. */
export function bakedText(map: MapData): string {
  // One line per list item (git diffs stay readable), everything else compact.
  const rows = Object.entries(map).map(([k, v]) => {
    const body = Array.isArray(v) && v.length ? `[\n${v.map((x) => '  ' + JSON.stringify(x)).join(',\n')}\n ]` : JSON.stringify(v);
    return ` ${JSON.stringify(k)}: ${body}`;
  });
  return `{\n${rows.join(',\n')}\n}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(MAPS_DIR, { recursive: true });
  for (const id of FLOOR1_IDS) {
    const map = bakeZone(GENERATED_ZONES[id]);
    writeFileSync(join(MAPS_DIR, `${id}.json`), bakedText(map));
    console.log(`${id}: ${map.props.length} props, ${(map.colliders ?? []).length} extra colliders, ${map.spawns.length} spawns`);
  }
}
