// Boss rooms in the map editor (docs/plans/map-editor.md, boss rooms added 2026-11-21):
// 1) validateMap's room rules: the locked fields, no doors/spawns/NPCs/paths/lakes, the spawn spot inside the arena and out of collision,
//    and the boss must stay reachable.
// 2) The game reads a room from MapRegistry like any map: a published layout (what the DB gives) makes the NEXT room use it, a room that is
//    already running keeps its own, the /admin switch off gives the bundled file back, and nothing else about the room changes.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ok, finish } from './check';
import { Db } from '../server/db';
import { applyMaps, checkMap } from '../server/maps-live';
import { BOSS_ROOMS, GENERATED_ROOMS, ZONES, refreshZone } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { MapRegistry } from '../src/shared/mapRegistry';
import { ROOM_EDGE, roomSpawnOf, validateMap, type MapData, type MapIssue } from '../src/shared/mapSchema';
import { Sim } from '../src/shared/sim/Sim';
import { SHEET_SPECS } from '../src/client/assets';
import { BOSS_ROOM_IDS } from '../tools/bake_maps';

const ctx = (id: string) => ({ propKeys: Object.keys(SHEET_SPECS), zoneIds: Object.keys(ZONES), monsterIds: Object.keys(MONSTERS), baseline: MapRegistry.bundled(id) });
const errs = (m: MapData): MapIssue[] => validateMap(m, ctx(m.id)).filter((i) => i.severity === 'error');
const has = (m: MapData, code: string): boolean => errs(m).some((i) => i.code === code);
const clone = (id: string): MapData => JSON.parse(JSON.stringify(MapRegistry.bundled(id)));

// ---------------------------------------------------------------- 1) validation
ok(BOSS_ROOM_IDS.length === 7 && BOSS_ROOM_IDS.every((id) => MapRegistry.bundled(id)?.room), 'seven bundled boss rooms (4 on floor 1, the crab, the captain and the ghost captain on floor 2), each with a room block');
for (const id of BOSS_ROOM_IDS) {
  const m = clone(id);
  const room = m.room!;
  ok(errs(m).length === 0 && checkMap(m).filter((i) => i.severity === 'error').length === 0, `${id}: the bundled room passes (also through the server's checkMap)`);
  ok(room.of === GENERATED_ROOMS[id].roomOf && room.arena > 0, `${id}: room block names its field and arena`);

  let x = clone(id); x.zone.half += 2;
  ok(has(x, 'locked'), `${id}: changing zone.half is refused`);
  x = clone(id); x.zone.theme = x.zone.theme === 'forest' ? 'snow' : 'forest';
  ok(has(x, 'locked'), `${id}: changing the theme is refused`);
  x = clone(id); x.walkable.half -= 1;
  ok(has(x, 'locked'), `${id}: changing the walkable frame is refused`);
  x = clone(id); x.room!.boss.x += 1;
  ok(has(x, 'locked'), `${id}: moving the boss is refused`);
  x = clone(id); x.room!.arena += 1;
  ok(has(x, 'locked'), `${id}: changing the arena radius is refused`);
  x = clone(id); delete x.room;
  ok(has(x, 'locked'), `${id}: dropping the room block is refused`);
  x = clone(id); x.portals = [{ to: 'nexus_city', x: 1, z: 1, minLevel: 0 }];
  ok(has(x, 'locked'), `${id}: a door is refused`);
  x = clone(id); x.spawns = [{ monster: 'green_slime', x: 1, z: 1, radius: 1, count: 1, respawn: [5, 6] }];
  ok(has(x, 'locked'), `${id}: a monster spawn is refused`);
  x = clone(id); x.npcs = [{ id: 'keeper', x: 1, z: 1 }];
  ok(has(x, 'locked'), `${id}: an NPC is refused`);
  x = clone(id); x.rest = [{ kind: 'campfire', x: 1, z: 1 }];
  ok(has(x, 'locked'), `${id}: a rest spot is refused`);
  x = clone(id); x.paths = [{ id: 'main', w: 3, pts: [[0, 0], [5, 5]] }];
  ok(has(x, 'locked'), `${id}: a path is refused`);
  x = clone(id); x.water = [{ kind: 'ice', x: 3, z: 3, rx: 2, rz: 2 }];
  ok(has(x, 'locked'), `${id}: a lake is refused`);
  x = clone(id); x.lair = { boss: room.boss.monster, x: 0, z: 0 };
  ok(has(x, 'locked'), `${id}: a summoner is refused`);
  x = clone(id); x.colliders = [...(x.colliders ?? []), { x: 6, z: 6, r: 1 }];
  ok(has(x, 'locked'), `${id}: an extra collider (no tool for it) is refused`);

  // Where players appear.
  x = clone(id); x.zone.start = { x: room.arena + 10, z: room.arena + 10 };
  ok(has(x, 'out_of_bounds'), `${id}: a spawn spot outside the arena is refused`);
  x = clone(id);
  const s = roomSpawnOf(x.zone.start);
  x.props.push({ id: 'blk', key: x.props[0].key, x: s.x, z: s.z, h: 3, rot: 0, flip: false, fade: false, solid: { r: 1 } });
  ok(has(x, 'in_collision'), `${id}: a spawn spot inside a solid prop is refused`);
  x = clone(id); x.blockers = [{ id: 'sp', pts: [[s.x - 1, s.z - 1], [s.x + 1, s.z - 1], [s.x + 1, s.z + 1], [s.x - 1, s.z + 1]] }];
  ok(has(x, 'in_collision'), `${id}: a spawn spot inside a blocker is refused`);
  x = clone(id); x.zone.start = { x: x.zone.start.x - 1, z: x.zone.start.z };
  ok(errs(x).length === 0, `${id}: moving the spawn spot a little inside the arena is fine`);

  // The boss stays reachable: a ring of blockers (a polygon is filled) around the boss and its reach.
  x = clone(id);
  const ring = (r: number) => Array.from({ length: 24 }, (_, i) => [room.boss.x + Math.cos((i / 24) * Math.PI * 2) * r, room.boss.z + Math.sin((i / 24) * Math.PI * 2) * r] as [number, number]);
  x.blockers = [{ id: 'wall', pts: ring(9) }];
  ok(has(x, 'unreachable'), `${id}: walling the boss in (nobody can get within reach) is refused`);

  // The props are the owner's to change.
  x = clone(id); x.props[0] = { ...x.props[0], x: x.props[0].x + 0.5 };
  ok(errs(x).length === 0, `${id}: moving a prop is fine`);
  x = clone(id); x.props = x.props.slice(1);
  ok(errs(x).length === 0, `${id}: deleting a prop is fine`);
}
{
  const f = clone('emerald_forest');
  f.room = clone('emerald_forest_room').room;
  ok(validateMap(f, ctx('emerald_forest')).some((i) => i.severity === 'error' && i.code === 'locked'), 'a normal map that claims to be a room is refused');
}

// ---------------------------------------------------------------- 2) the game reads rooms from the registry
const FIELD = 'emerald_forest';
const ROOM = `${FIELD}_room`;
{
  const bundled = MapRegistry.bundled(ROOM)!;
  const before = new Sim(BOSS_ROOMS[FIELD]);
  ok(before.terrain.props.length === bundled.props.length && before.terrain.mapRev === 0, 'a room Sim is built from the bundled room file (rev 0)');
  const boss = before.monsters.find((m) => m.isBoss);
  ok(!!boss && boss.def.id === bundled.room!.boss.monster && Math.hypot(boss.x - bundled.room!.boss.x, boss.z - bundled.room!.boss.z) <= bundled.room!.boss.radius, 'the boss is where the code puts it');
  const sp = before.spawnPoint();
  ok(Math.hypot(sp.x, sp.z) + 0.5 <= bundled.room!.arena + ROOM_EDGE && !before.terrain.isBlocked(sp.x, sp.z, 0.5), 'players appear inside the arena, clear of collision');
}
{
  const dir = mkdtempSync(join(tmpdir(), 'multiverse-room-test-'));
  const db = new Db(join(dir, 'test.db'));
  try {
    const old = new Sim(BOSS_ROOMS[FIELD]); // a room with players in it
    const n = old.terrain.props.length;
    const edited = clone(ROOM);
    edited.props.push({ ...edited.props[0], id: 'extra1', x: 3, z: 3 });
    edited.zone.start = { x: edited.zone.start.x - 1, z: edited.zone.start.z };
    db.publishMap(ROOM, (rev) => JSON.stringify({ ...edited, rev }), 'tester', 'test', 0);
    applyMaps(db);
    const fresh = new Sim(BOSS_ROOMS[FIELD]);
    ok(fresh.terrain.mapRev === 1 && fresh.terrain.props.length === n + 1, 'a published room: the next room built uses it (rev 1, one more prop)');
    ok(fresh.zone.start.x === edited.zone.start.x, 'and the spawn spot comes from the published file');
    ok(old.terrain.mapRev === 0 && old.terrain.props.length === n, 'a room already running keeps the layout it was built with');
    ok(fresh.zone.id === ROOM && fresh.zone.half === old.zone.half && fresh.zone.roomOf === FIELD && fresh.zone.seed === old.zone.seed, 'size, id, seed and field of the room are unchanged');

    MapRegistry.setUseOverrides(false);
    ok(new Sim(BOSS_ROOMS[FIELD]).terrain.mapRev === 0, 'the "ใช้แมพจาก DB" switch off gives the bundled file');
    MapRegistry.setUseOverrides(true);

    // A published file that breaks a lock is ignored (the bundled one stays).
    const bad = clone(ROOM);
    bad.room!.boss.x = 5;
    db.publishMap(ROOM, (rev) => JSON.stringify({ ...bad, rev }), 'tester', 'bad', 0);
    applyMaps(db);
    ok(new Sim(BOSS_ROOMS[FIELD]).terrain.mapRev === 0, 'a published room that moved the boss fails the check: the bundled file is used');
  } finally {
    MapRegistry.clear();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
{
  MapRegistry.clear();
  refreshZone(ROOM);
  const again = new Sim(BOSS_ROOMS[FIELD]);
  ok(again.terrain.mapRev === 0, 'cleared: back to the bundled room');
}

finish('map-boss-room');
