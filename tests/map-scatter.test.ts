// The map editor's scatter brush and eraser (src/admin/mapEditor/scatter.ts): placements stay inside the circle, keep clear of
// what must stay clear, never crowd, get fresh ids, and the eraser takes only what it should.
import { ok, finish } from './check';
import { eraseInCircle, idMaker, KEEP_CLEAR, scatterStamp, spotIsFree, type ScatterOpts } from '../src/admin/mapEditor/scatter';
import { MapRegistry } from '../src/shared/mapRegistry';
import { ZONES } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { mulberry32 } from '../src/shared/rng';
import { pointInPolygon, validateMap, type MapData } from '../src/shared/mapSchema';

const field = MapRegistry.bundled('emerald_forest')!;
const opts: ScatterOpts = { radius: 6, density: 9, hMin: 0.8, hMax: 1.2, flip: true, rotate: false, avoidPaths: true };
const tree = { key: field.props.find((p) => p.solid)!.key, h: 3, r: 0.8 };
const grass = { key: 'decor_forest', h: 0.6, r: 0 };

/** An open spot on the field, away from doors, spawns and roads; the trees round it are cleared so a dab there lays pieces. */
function openSpot(map: MapData): [number, number] {
  const r = mulberry32(7);
  for (let i = 0; i < 5000; i++) {
    const x = (r() * 2 - 1) * (map.walkable.half - 10), z = (r() * 2 - 1) * (map.walkable.half - 10);
    if (!spotIsFree(map, x, z, 7, true)) continue;
    const keep = map.props.filter((p) => Math.hypot(p.x - x, p.z - z) > 9);
    if (keep.length < map.props.length && map.colliders?.length) continue; // keep loose colliders matched to their pieces
    map.props = keep;
    return [x, z];
  }
  throw new Error('no open spot');
}

{
  const map = structuredClone(field);
  const [cx, cz] = openSpot(map);
  const put = scatterStamp(map, cx, cz, [tree, grass], opts, mulberry32(1), idMaker(map));
  ok(put.length > 3, `a dense dab on open ground lays pieces (${put.length})`);
  ok(put.every((p) => Math.hypot(p.x - cx, p.z - cz) <= opts.radius + 1e-6), 'every piece lands inside the circle');
  const ids = new Set(map.props.map((p) => p.id));
  ok(put.every((p) => !ids.has(p.id)) && new Set(put.map((p) => p.id)).size === put.length, 'ids are fresh and unique in the stroke');
  ok(put.every((p) => p.h >= tree.h * 0.8 - 1e-6 || p.key === grass.key), 'sizes stay in the random range');
  const solid = put.filter((p) => p.solid);
  ok(solid.every((p) => p.solid && 'r' in p.solid && Math.abs(p.solid.r / p.h - tree.r / tree.h) < 0.01), 'collision grows with the random size');
  ok(put.filter((p) => !p.solid).every((p) => !p.fade), 'short walk-through pieces do not fade');
  let crowd = false;
  for (const a of solid) for (const b of solid) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 2 * 0.8 * 0.8) crowd = true;
  ok(!crowd, 'solid pieces of one dab do not overlap');
  ok(put.every((p) => !p.rot), 'no rotation unless asked');
  map.props.push(...put);
  const errs = validateMap(map, { propKeys: [...new Set(map.props.map((p) => p.key))], zoneIds: Object.keys(ZONES), monsterIds: Object.keys(MONSTERS) }).filter((i) => i.severity === 'error');
  ok(!errs.length, `the brushed map still passes validateMap (${errs.map((e) => e.code).join(',') || 'none'})`);
}

{
  // Keeps clear of doors, NPCs, spawns, the start, polygons and roads.
  const map = structuredClone(field);
  const door = map.portals[0];
  const put = scatterStamp(map, door.x, door.z, [tree], { ...opts, radius: KEEP_CLEAR.portal }, mulberry32(2), idMaker(map));
  ok(put.length === 0, 'nothing lands right on a door');
  const sp = map.spawns[0];
  ok(!spotIsFree(map, sp.x + 0.5, sp.z, 0.35, false), 'a spawn point is kept clear');
  ok(!spotIsFree(map, map.zone.start.x, map.zone.start.z, 0.35, false), 'the start is kept clear');
  if (map.paths.length) {
    const [px, pz] = map.paths[0].pts[0];
    ok(!spotIsFree(map, px, pz, 0.35, true) || Math.abs(px) > map.walkable.half - 1, 'roads are kept clear when asked');
  }
  map.blockers.push({ id: 'bx', pts: [[-3, -3], [3, -3], [3, 3], [-3, 3]] });
  map.npcs = []; map.portals = []; map.spawns = []; map.rest = []; map.paths = []; map.water = []; map.props = []; map.colliders = [];
  map.zone.start = { x: 40, z: 40 };
  const inBox = scatterStamp(map, 0, 0, [grass], { ...opts, radius: 5 }, mulberry32(3), idMaker(map));
  ok(inBox.every((p) => !pointInPolygon(map.blockers[map.blockers.length - 1].pts, p.x, p.z)), 'nothing lands inside a blocker polygon');
  ok(inBox.length > 0, 'the free ring round the polygon still gets pieces');
}

{
  const map = structuredClone(field);
  const [cx, cz] = openSpot(map);
  map.props.push(...scatterStamp(map, cx, cz, [tree, grass], opts, mulberry32(4), idMaker(map)));
  const all = eraseInCircle(map, cx, cz, opts.radius, null);
  ok(all.removed > 0 && all.props.every((p) => Math.hypot(p.x - cx, p.z - cz) > opts.radius), 'the eraser clears the circle');
  ok(all.props.length === map.props.length - all.removed, 'and nothing outside it');
  const some = eraseInCircle(map, cx, cz, opts.radius, new Set([grass.key]));
  ok(some.props.some((p) => p.key === tree.key && Math.hypot(p.x - cx, p.z - cz) <= opts.radius) && !some.props.some((p) => p.key === grass.key && Math.hypot(p.x - cx, p.z - cz) <= opts.radius), 'erase only the picked kinds');
  const none = eraseInCircle(map, 9999, 9999, 3, null);
  ok(none.removed === 0 && none.props === map.props, 'an empty circle changes nothing (same list)');
}

{
  const hub = structuredClone(MapRegistry.bundled('nexus_city')!);
  const b3 = hub.props.find((p) => /^b3_/.test(p.key) && !p.solid);
  if (b3 && hub.colliders?.length) {
    const before = hub.colliders.length;
    const r = eraseInCircle(hub, b3.x, b3.z, 0.5, new Set([b3.key]));
    ok(r.removed >= 1 && (r.colliders?.length ?? 0) < before, 'erasing a hub building takes its loose collision circles too');
  }
  const mk = idMaker({ props: [{ id: 'p5' }, { id: 'p9' }, { id: 'x' }] as never });
  ok(mk() === 'p10' && mk() === 'p11', 'ids continue after the highest p<n>');
}

finish('map-scatter');
