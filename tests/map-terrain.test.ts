// PR 3 of docs/plans/map-editor.md: the game builds Terrain from the baked JSON (MapRegistry) instead of the generators.
// 1) Terrain from JSON == Terrain from the old generators (props, colliders, NPCs, rest spots, spawns, portals, bounds).
// 2) Turned solid boxes and blocker polygons collide (isBlocked / resolve) and the client's pathfinder walks round them.
import { ok, finish } from './check';
import { ZONES, GENERATED_ZONES, GENERATED_ROOMS, BOSS_ROOMS } from '../src/shared/data/zones';
import { Terrain, boxHit } from '../src/shared/sim/terrain';
import { MapRegistry } from '../src/shared/mapRegistry';
import { pointInPropSolid, type MapData, type MapProp } from '../src/shared/mapSchema';
import { findPath } from '../src/client/pathfind';
import { MAP_IDS, BOSS_ROOM_IDS } from '../tools/bake_maps';
import { mergeBalance, checkBalance, balanceChanges } from '../src/shared/balance';

// Stable text of a value: keys sorted, undefined dropped.
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).filter(([, y]) => y !== undefined).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const cmp = (a: { x: number; z: number; r: number }, b: { x: number; z: number; r: number }) => a.x - b.x || a.z - b.z || a.r - b.r;

// ---------------------------------------------------------------- 1) JSON == generators
// Every map (floor 1 and 2) and, with them, the five boss rooms (their zone is BOSS_ROOMS[field], their Terrain reads `<field>_room.json`).
const live = (id: string) => (GENERATED_ROOMS[id] ? BOSS_ROOMS[GENERATED_ROOMS[id].roomOf!] : ZONES[id]);
for (const id of [...MAP_IDS, ...BOSS_ROOM_IDS]) {
  const generated = GENERATED_ZONES[id] ?? GENERATED_ROOMS[id];
  const gen = new Terrain(generated, null);
  const json = new Terrain(live(id));
  ok(canon(live(id)) === canon(generated), `${id}: the zone the game runs (layout from JSON) equals the generated zone, spawns (${live(id).spawns.length}) and portals (${live(id).portals.length}) included`);
  ok(canon(json.props) === canon(gen.props), `${id}: props (${gen.props.length}) equal, in order`);
  ok(canon([...json.colliders].sort(cmp)) === canon([...gen.colliders].sort(cmp)), `${id}: colliders (${gen.colliders.length}) equal as a set`);
  ok(json.boxes.length === 0 && json.blockers.length === 0, `${id}: no boxes or blockers yet`);
  ok(json.roomEdge === gen.roomEdge && json.mapRev === 0, `${id}: room edge equal, built from rev 0`);
  ok(canon(json.npcPos) === canon(gen.npcPos), `${id}: npcPos equal`);
  ok(canon(json.restSpots) === canon(gen.restSpots), `${id}: restSpots equal`);
  ok(canon(json.pathSegments) === canon(gen.pathSegments), `${id}: path segments equal`);
  ok(json.half === gen.half && json.bound === gen.bound && canon(json.summoner) === canon(gen.summoner), `${id}: half, bound, summoner equal`);

  // Blocking is order-free: every sample point must agree. Resolve pushes one collider after another, so its result can
  // differ a hair where a body touches two at once; it must never differ much.
  let blockDiff = 0;
  let pushDiff = 0;
  let maxPush = 0;
  for (let x = -json.half; x <= json.half; x += 0.7) {
    for (let z = -json.half; z <= json.half; z += 0.7) {
      for (const r of [0, 0.4]) if (json.isBlocked(x, z, r) !== gen.isBlocked(x, z, r)) blockDiff++;
      const a = { x, z, radius: 0.4 };
      const b = { x, z, radius: 0.4 };
      json.resolve(a);
      gen.resolve(b);
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 1e-9) pushDiff++;
      maxPush = Math.max(maxPush, d);
    }
  }
  ok(blockDiff === 0, `${id}: isBlocked agrees on every sample point (${blockDiff} differ)`);
  ok(maxPush < 1.5, `${id}: resolve agrees to within ${maxPush.toFixed(3)} (${pushDiff} points not bit-identical; order of overlapping colliders)`);
}

// ---------------------------------------------------------------- 2) rotated boxes, polygons
const base = MapRegistry.bundled('emerald_forest')!;
const zone = ZONES.emerald_forest;
const prop = (over: Partial<MapProp>): MapProp => ({ id: 'w', key: 'tree_0', x: 0, z: 0, h: 3, rot: 0, flip: false, fade: false, solid: { w: 4, d: 1 }, ...over });
const mapOf = (props: MapProp[], blockers: MapData['blockers'] = []): MapData => ({
  ...base, props, blockers, colliders: [], npcs: [], rest: [], spawns: [], portals: [], lair: undefined,
});
const terrainOf = (props: MapProp[], blockers: MapData['blockers'] = []) => new Terrain(zone, mapOf(props, blockers));

for (const rot of [0, 30, 45, 90, 135, 200, 271.5]) {
  const p = prop({ x: 3, z: -2, rot });
  const t = terrainOf([p]);
  let bad = 0;
  for (let x = -3; x <= 9; x += 0.37) for (let z = -8; z <= 4; z += 0.37) if (t.isBlocked(x, z, 0) !== pointInPropSolid(p, x, z)) bad++;
  ok(bad === 0, `box 4x1 rot ${rot}: isBlocked(r=0) matches the schema's pointInPropSolid (${bad} differ)`);
  ok(t.props[0].rot === (rot || undefined), `box rot ${rot}: PropSpec.rot carried to the renderer`);
  // resolve: a body pushed out of the box ends clear of it and stays on the side it came from
  let stuck = 0;
  for (let x = 0; x <= 6; x += 0.31) for (let z = -5; z <= 1; z += 0.31) {
    const u = { x, z, radius: 0.4 };
    t.resolve(u);
    if (t.isBlocked(u.x, u.z, 0.4 - 0.001)) stuck++;
  }
  ok(stuck === 0, `box rot ${rot}: resolve leaves nobody inside it (${stuck} stuck)`);
}

{
  // The long axis really turns: rot 0 runs along x, rot 90 along z, rot 45 along the x=z diagonal.
  const at = (rot: number) => terrainOf([prop({ rot })]);
  ok(at(0).isBlocked(1.9, 0, 0) && !at(0).isBlocked(0, 1.9, 0), 'rot 0: long side along x');
  ok(at(90).isBlocked(0, 1.9, 0) && !at(90).isBlocked(1.9, 0, 0), 'rot 90: long side along z');
  ok(at(45).isBlocked(1.4, 1.4, 0) && !at(45).isBlocked(1.4, -1.4, 0), 'rot 45: long side along the x = z diagonal');
  const t = at(0);
  const u = { x: 1.5, z: 0.2, radius: 0.4 };
  t.resolve(u);
  ok(Math.abs(u.z - 0.9) < 1e-9 && u.x === 1.5, 'a body inside the box is pushed out through the nearest face, r clear of it');
  const side = { x: 2.2, z: 0, radius: 0.4 }; // 0.2 past the end face
  t.resolve(side);
  ok(Math.abs(side.x - 2.4) < 1e-9, 'a body touching a face from outside is pushed back to exactly r away');
  ok(boxHit({ x: 0, z: 0, w: 2, d: 2, rot: 0 }, 1.3, 1.3, 0.4) === false, 'a circle near a box corner uses the corner distance (0.424), not the sides');
  ok(boxHit({ x: 0, z: 0, w: 2, d: 2, rot: 0 }, 1.3, 1.3, 0.43), 'and touches it once within the corner distance');
}

{
  const square = [[10, 10], [14, 10], [14, 14], [10, 14]] as [number, number][];
  const L = [[-20, -20], [-8, -20], [-8, -16], [-16, -16], [-16, -8], [-20, -8]] as [number, number][]; // concave
  const t = terrainOf([], [{ id: 'b1', pts: square }, { id: 'b2', pts: L }]);
  ok(t.isBlocked(12, 12, 0) && !t.isBlocked(9, 12, 0) && t.isBlocked(9.8, 12, 0.4) && !t.isBlocked(9.5, 12, 0.4), 'polygon: inside and within r of an edge are blocked, clear otherwise');
  ok(t.isBlocked(-12, -18, 0) && t.isBlocked(-18, -12, 0) && !t.isBlocked(-12, -12, 0), 'concave polygon: the notch is open');
  const a = { x: 9.8, z: 12, radius: 0.4 };
  t.resolve(a);
  ok(Math.abs(a.x - 9.6) < 1e-9 && a.z === 12, 'polygon: pressed against an edge is pushed back to r away');
  const inn = { x: 13.5, z: 12, radius: 0.4 }; // inside, nearest the right edge
  t.resolve(inn);
  ok(Math.abs(inn.x - 14.4) < 1e-9, 'polygon: a body inside is pushed out through the nearest edge');
  let stuck = 0;
  for (let x = 6; x <= 18; x += 0.23) for (let z = 6; z <= 18; z += 0.23) {
    const u = { x, z, radius: 0.4 };
    t.resolve(u);
    if (t.isBlocked(u.x, u.z, 0.4 - 0.001)) stuck++;
  }
  ok(stuck === 0, `polygon: resolve leaves nobody inside (${stuck} stuck)`);
  ok(t.soleContact({ x: 9.7, z: 12, radius: 0.4 }) === null, 'soleContact: a wall (polygon) is never something to walk round');
}

{
  // The client's pathfinder reads the same shapes: a long turned wall across the way is walked round, never through.
  const wall = prop({ x: 0, z: 0, solid: { w: 1, d: 30 }, rot: 20 });
  const t = terrainOf([wall], [{ id: 'b', pts: [[8, -6], [12, -6], [12, 6], [8, 6]] }]);
  const route = findPath(t, { x: -8, z: 0 }, { x: 16, z: 0 });
  ok(!!route && route.length > 0, 'pathfind: finds a way round a turned wall and a blocker');
  if (route) {
    let at = { x: -8, z: 0 };
    let hit = 0;
    for (const w of route) {
      const n = Math.ceil(Math.hypot(w.x - at.x, w.z - at.z) / 0.1);
      for (let i = 0; i <= n; i++) if (t.isBlocked(at.x + ((w.x - at.x) * i) / n, at.z + ((w.z - at.z) * i) / n, 0.4)) hit++;
      at = w;
    }
    ok(hit === 0, `pathfind: the route never touches a wall or the blocker (${hit} blocked samples)`);
    ok(route.some((w) => Math.abs(w.z) > 10), 'pathfind: and goes round the end of the wall');
  }
}

{
  // The registry: an override replaces the bundled map for Terrains built after it; the switch turns it off.
  const marker = prop({ id: 'marker', x: 20, z: 20, solid: { r: 1 } });
  MapRegistry.set({ ...base, props: [...base.props, marker] });
  ok(new Terrain(ZONES.emerald_forest).props.length === base.props.length + 1, 'MapRegistry.set: new Terrains use the replaced layout');
  MapRegistry.setUseOverrides(false);
  ok(new Terrain(ZONES.emerald_forest).props.length === base.props.length, 'switch off: always the bundled JSON');
  MapRegistry.setUseOverrides(true);
  MapRegistry.clear('emerald_forest');
  ok(new Terrain(ZONES.emerald_forest).props.length === base.props.length && MapRegistry.get('emerald_forest') === MapRegistry.bundled('emerald_forest'), 'clear: back to the bundled JSON');
  ok(MapRegistry.get('emerald_forest_room')?.room?.of === 'emerald_forest', 'boss rooms have a map file with a room block');
}

{
  // The /admin switch (skeleton: stored and audited, no effect until PR 5 puts published maps in the DB).
  ok(mergeBalance({}).mapFromDb === true, 'mapFromDb: code default on');
  ok(JSON.stringify(checkBalance({ mapFromDb: true }, true).tuning) === '{}', 'mapFromDb: the code value is not saved');
  ok(checkBalance({ mapFromDb: false }, true).tuning?.mapFromDb === false, 'mapFromDb: off is kept');
  ok('error' in checkBalance({ mapFromDb: 'x' }, true), 'mapFromDb: a non-boolean is refused');
  ok(balanceChanges({}, { mapFromDb: false }).includes('ใช้แมพจาก DB'), 'mapFromDb: the audit names it');
}

finish('map-terrain');
