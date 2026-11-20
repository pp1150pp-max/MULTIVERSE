import { ok, finish } from './check';
import { validateMap, isPointBlocked, pointInPropSolid, type MapData, type MapIssue } from '../src/shared/mapSchema';

const ctx = { propKeys: ['b3_vault', 'tree1', 'fence'], zoneIds: ['nexus_city', 'emerald_forest'], monsterIds: ['green_slime', 'forest_bear'] };

function base(): MapData {
  return {
    schema: 1, id: 'nexus_city', floor: 1, rev: 0,
    zone: { half: 69, theme: 'forest', start: { x: 0, z: 0 }, safe: { x: 0, z: 0, half: 15 } },
    paths: [{ id: 'main', w: 4.2, pts: [[-58, -58], [0, 0], [58, 58]] }],
    water: [{ kind: 'ice', x: -32, z: 34, rx: 12, rz: 9 }],
    props: [{ id: 'p1', key: 'b3_vault', x: -15, z: -6, h: 7.4, rot: 0, flip: false, fade: true, solid: { r: 2 } }],
    blockers: [{ id: 'b1', pts: [[20, 20], [20, 30], [30, 30]] }],
    walkable: { half: 61 },
    npcs: [{ id: 'keeper', x: -9, z: -3 }],
    rest: [{ kind: 'fountain', x: 0, z: 0 }],
    portals: [{ to: 'emerald_forest', x: -54.5, z: -54.5, minLevel: 0 }],
    spawns: [{ monster: 'green_slime', x: 10, z: 4, radius: 2.5, count: 1, respawn: [6, 10] }],
    lair: { boss: 'forest_bear', x: -42, z: -42 },
  };
}
const codes = (m: MapData): string[] => validateMap(m, ctx).map((i: MapIssue) => i.code);
const has = (m: MapData, code: string, id?: string) => validateMap(m, ctx).some(i => i.code === code && (id === undefined || i.id === id));

ok(validateMap(base(), ctx).length === 0, 'valid map has no issues');

let m = base(); m.props[0].key = 'nope';
ok(has(m, 'bad_key', 'p1'), 'unknown sprite key');

m = base(); m.props.push({ ...m.props[0] });
ok(has(m, 'dup_id', 'p1'), 'duplicate prop id');
m = base(); m.npcs.push({ id: 'keeper', x: 1, z: 1 });
ok(has(m, 'dup_id', 'keeper'), 'duplicate npc id');

m = base(); m.props[0].x = 200;
ok(has(m, 'out_of_bounds', 'p1'), 'prop outside frame');

m = base(); m.spawns[0].x = -15; m.spawns[0].z = -6;
ok(has(m, 'in_collision'), 'monster spawn inside a prop solid');
m = base(); m.npcs[0].x = -15; m.npcs[0].z = -6;
ok(has(m, 'in_collision', 'keeper'), 'npc inside collision');
m = base(); m.portals[0].x = 22; m.portals[0].z = 28;
ok(has(m, 'in_collision', '0'), 'portal inside a blocker polygon');

// a wall that seals off the portal corner
m = base();
m.blockers = [
  { id: 'w1', pts: [[-61, -45], [-61, -47], [-44, -47], [-44, -45]] },
  { id: 'w2', pts: [[-45, -61], [-47, -61], [-47, -44], [-45, -44]] },
];
ok(has(m, 'unreachable', '0'), 'portal walled off is unreachable');

m = base(); m.blockers[0].pts = [[0, 0], [10, 10], [0, 10], [10, 0]];
ok(has(m, 'polygon', 'b1'), 'self-crossing polygon');
m = base(); m.blockers[0].pts = [[1, 1], [2, 2]];
ok(has(m, 'polygon', 'b1'), 'polygon with < 3 points');
m = base(); m.blockers[0].pts = [[0, 0], [5, 5], [10, 10]];
ok(has(m, 'polygon', 'b1'), 'degenerate polygon (no area)');

m = base(); m.props[0].rot = 360;
ok(has(m, 'range', 'p1'), 'rot 360 is out of range');
m = base(); m.props[0].rot = 359.9;
ok(codes(m).length === 0, 'rot 359.9 is fine');
m = base(); m.props[0].h = -1;
ok(has(m, 'range', 'p1'), 'negative height');
m = base(); m.props[0].x = NaN;
ok(has(m, 'range', 'p1'), 'NaN coordinate');
m = base(); m.spawns[0].count = 0;
ok(has(m, 'range'), 'spawn count 0');
m = base(); m.spawns[0].respawn = [10, 6];
ok(has(m, 'range'), 'respawn min > max');
m = base(); m.portals[0].to = 'ghost';
ok(has(m, 'bad_ref', '0'), 'portal to unknown zone');
m = base(); m.spawns[0].monster = 'ghost';
ok(has(m, 'bad_ref'), 'unknown monster id');

// rotated box collision: 6 wide, 2 deep, rot 0 vs 90
const box = { id: 'f', key: 'fence', x: 0, z: 0, h: 2, rot: 0, flip: false, fade: false, solid: { w: 6, d: 2 } };
ok(pointInPropSolid(box, 2.5, 0) && !pointInPropSolid(box, 0, 2.5), 'box rot 0 is long along x');
const turned = { ...box, rot: 90 };
ok(!pointInPropSolid(turned, 2.5, 0) && pointInPropSolid(turned, 0, 2.5), 'box rot 90 is long along z');
const diag = { ...box, rot: 45 };
ok(pointInPropSolid(diag, 1.5, 1.5) && !pointInPropSolid(diag, 1.5, -1.5), 'box rot 45 follows the diagonal');
m = base(); m.props = [{ ...box, x: 10, z: 10 }];
ok(isPointBlocked(m, 12.5, 10) && !isPointBlocked(m, 10, 12.5) && isPointBlocked(m, 70, 0), 'isPointBlocked: box and frame');
m = base(); m.props.push({ ...box, id: 'ok', x: 5, z: 5, solid: undefined });
ok(!isPointBlocked(m, 5, 5), 'prop without solid is walk-through');

// never throws on garbage
for (const junk of [null, undefined, 5, {}, { schema: 1 }, { ...base(), props: 'x' }, { ...base(), blockers: [{ id: 'z' }] }, { ...base(), schema: 2 }]) {
  let threw = false, list: MapIssue[] = [];
  try { list = validateMap(junk as unknown as MapData, ctx); } catch { threw = true; }
  ok(!threw && list.length > 0, `garbage input does not throw (${JSON.stringify(junk)?.slice(0, 30)})`);
}

// extra colliders (PR 2) and the two relaxed checks
m = base(); m.colliders = [{ x: 30, z: 30, r: 2 }];
ok(validateMap(m, ctx).length === 0 && isPointBlocked(m, 31, 30) && !isPointBlocked(m, 33, 30), 'extra collider blocks and validates');
m = base(); m.colliders = [{ x: 30, z: 30, r: 0 }, { x: 999, z: 0, r: 1 }];
ok(has(m, 'range') && has(m, 'out_of_bounds'), 'bad extra colliders are reported');
m = base(); m.lair = { boss: 'forest_bear', x: -15, z: -6 };
ok(!has(m, 'in_collision'), 'lair may stand on its own solid');
m = base(); m.zone.start = { x: -15, z: -6 };
ok(validateMap(m, ctx).every(i => i.severity === 'warn' && i.code === 'in_collision'), 'start inside collision is only a warning');

finish('map-schema');
