// The map editor's pure parts (PR 6): the shared projection, the undo stack, collision outlines, snapping and the loose colliders
// that follow a hub building.
import * as THREE from 'three';
import { ok, finish } from './check';
import { CAM_RIGHT_RAW, CAM_UP_RAW, ISO, ISO_RAW, camToGround, depthOf, groundToCam } from '../src/shared/isoProjection';
import { History, HISTORY_DEPTH, pick } from '../src/admin/mapEditor/history';
import { followersOf, halfExtent, normDeg, snapPoint, solidOutline, transformProps } from '../src/admin/mapEditor/geom';
import { pointInPropSolid, type MapData, type MapProp } from '../src/shared/mapSchema';
import { diffMaps } from '../src/shared/mapDiff';
import { MapRegistry } from '../src/shared/mapRegistry';

// ---- projection: the same numbers the game's camera uses
const isoDir = new THREE.Vector3(...ISO_RAW).normalize();
const right = new THREE.Vector3(...CAM_RIGHT_RAW);
const up = new THREE.Vector3().crossVectors(right, isoDir.clone().negate()).normalize();
ok(Math.abs(isoDir.x - ISO[0]) < 1e-12 && Math.abs(isoDir.y - ISO[1]) < 1e-12 && Math.abs(isoDir.z - ISO[2]) < 1e-12, 'shared ISO equals the game camera direction');
ok(Math.abs(up.x - CAM_UP_RAW[0]) < 1e-12 && Math.abs(up.y - CAM_UP_RAW[1]) < 1e-12 && Math.abs(up.z - CAM_UP_RAW[2]) < 1e-12, 'shared camera up equals the game camera up');
{
  const [sx, sy] = groundToCam(12, -7);
  ok(Math.abs(sx - right.dot(new THREE.Vector3(12, 0, -7))) < 1e-12 && Math.abs(sy - up.dot(new THREE.Vector3(12, 0, -7))) < 1e-12, 'groundToCam matches dot(point, right/up)');
  const [x, z] = camToGround(sx, sy);
  ok(Math.abs(x - 12) < 1e-9 && Math.abs(z + 7) < 1e-9, 'camToGround undoes groundToCam');
  ok(depthOf(5, 5) > depthOf(-5, -5), 'nearer the camera (+x +z) is drawn later');
  // A prop's `rot` turns its sprite clockwise on screen (canvas y goes down): a ground vector turned by +rot must go clockwise too.
  const [ax, ay] = groundToCam(1, 0), [bx, by] = groundToCam(Math.cos(0.1), Math.sin(0.1));
  const cross = ax * -ay * 0 + (ax * (-by) - (-ay) * bx); // screen y down: y = -sy
  ok(cross > 0, 'rot turns clockwise on screen (same sense as the sprite)');
}

// ---- undo stack
{
  const m = { a: [1] as number[] } as unknown as MapData;
  const h = new History((p) => Object.assign(m, p));
  for (let i = 0; i < HISTORY_DEPTH + 30; i++) h.exec({ label: `s${i}`, before: { rev: i }, after: { rev: i + 1 } });
  let n = 0;
  while (h.canUndo) { h.undo(); n++; }
  ok(n === HISTORY_DEPTH, `undo stack is ${HISTORY_DEPTH} deep (${n})`);
  ok(m.rev === 30, 'the oldest 30 steps fell off the bottom');
  h.redo();
  ok(m.rev === 31, 'redo re-applies');
  h.exec({ label: 'new', before: { rev: 31 }, after: { rev: 99 } });
  ok(!h.canRedo, 'a new action clears redo');
}

// ---- collision outlines agree with pointInPropSolid
const prop = (o: Partial<MapProp>): MapProp => ({ id: 'a', key: 'k', x: 3, z: -2, h: 4, rot: 0, flip: false, fade: false, ...o });
{
  const box = prop({ solid: { w: 6, d: 2 }, rot: 37 });
  const o = solidOutline(box)!;
  // Every corner is on the boundary: nudged toward the middle it is inside, nudged away it is outside.
  const okCorners = o.every(([x, z]) => {
    const k = 0.02;
    const inX = x + (box.x - x) * k, inZ = z + (box.z - z) * k, outX = x - (box.x - x) * k, outZ = z - (box.z - z) * k;
    return pointInPropSolid(box, inX, inZ) && !pointInPropSolid(box, outX, outZ);
  });
  ok(okCorners, 'a turned box is drawn where pointInPropSolid says it is');
  const c = solidOutline(prop({ solid: { r: 2 } }))!;
  ok(c.every(([x, z]) => Math.abs(Math.hypot(x - 3, z + 2) - 2) < 1e-9), 'a circle outline lies on its radius');
  ok(solidOutline(prop({})) === null && solidOutline(prop({ solid: { r: 0 } })) === null, 'no solid = no outline');
  const [hx] = halfExtent(prop({ solid: { w: 6, d: 2 }, rot: 90 }));
  ok(Math.abs(hx - 1) < 1e-9, 'half extent follows the turn');
}

// ---- snapping
{
  const map = { props: [prop({ id: 'n', x: 10, z: 10, solid: { r: 2 } })] } as unknown as MapData;
  const none = new Set<string>();
  const g = snapPoint(map, none, 3.4, -1.6, [1, 1], { grid: 1, edges: false });
  ok(g[0] === 3 && g[1] === -2, 'grid snap rounds to the cell');
  const half = snapPoint(map, none, 3.3, 0.8, [1, 1], { grid: 0.5, edges: false });
  ok(half[0] === 3.5 && half[1] === 1, 'half-unit grid');
  const e = snapPoint(map, none, 13.2, 10.3, [1, 1], { grid: 2, edges: true });
  ok(e[0] === 13 && Math.abs(e[1] - 10) < 1e-9, 'a piece 0.2 off a neighbour\'s edge is pulled flush (13 = 10 + 2 + 1)');
  const far = snapPoint(map, none, 20, 20, [1, 1], { grid: 2, edges: true });
  ok(far[0] === 20 && far[1] === 20, 'a far neighbour does not pull');
  const self = snapPoint(map, new Set(['n']), 13.2, 10.3, [1, 1], { grid: 2, edges: true });
  ok(self[0] === 14, 'the pieces being moved are not snapped to');
}

// ---- hub buildings carry their loose wall circles
{
  const hub = MapRegistry.bundled('nexus_city')!;
  const houses = hub.props.filter((p) => p.key.startsWith('b3_'));
  ok(houses.length === 4 && houses.every((p) => followersOf(hub, p).length === 5), 'each of the 4 hub houses owns its 5 footprint circles');
  const fountain = hub.props.find((p) => p.key === 'town_fountain')!;
  ok(followersOf(hub, fountain).length === 1, 'the fountain owns its 1 circle');
  const all = new Set<number>();
  for (const p of hub.props) followersOf(hub, p).forEach((i) => { ok(!all.has(i), `collider ${i} has one owner`); all.add(i); });
  const first = houses[0];
  const mine = followersOf(hub, first).map((i) => hub.colliders![i]);
  const r = transformProps(hub, new Set([first.id]), (p) => ({ ...p, x: p.x + 5, z: p.z - 3 }));
  const moved = followersOf(hub, first).map((i) => r.colliders![i]);
  ok(moved.every((c, i) => Math.abs(c.x - mine[i].x - 5) < 1e-9 && Math.abs(c.z - mine[i].z + 3) < 1e-9), 'moving a house moves its circles by the same step');
  ok(r.colliders !== hub.colliders && hub.colliders![followersOf(hub, first)[0]].x === mine[0].x, 'the original map is not edited in place');
  const turned = transformProps(hub, new Set([first.id]), (p) => ({ ...p, rot: 90 }));
  const t0 = turned.colliders![followersOf(hub, first)[0]];
  ok(Math.hypot(t0.x - first.x, t0.z - first.z) - Math.hypot(mine[0].x - first.x, mine[0].z - first.z) < 1e-9, 'turning a house turns its circles about the house\'s point');
  const same = transformProps(hub, new Set([first.id]), (p) => ({ ...p, h: p.h + 1 }));
  ok(same.colliders === hub.colliders, 'editing the height leaves the colliders array untouched');
  // A second house standing close: each circle goes to the nearer house, so deleting one leaves the other whole.
  const twin = { ...first, id: 'twin', x: first.x + 6, z: first.z };
  const two = { ...hub, props: [...hub.props, twin], colliders: [...hub.colliders!, ...followersOf(hub, first).map((i) => ({ ...hub.colliders![i], x: hub.colliders![i].x + 6 }))] };
  ok(followersOf(two, first).length === 5 && followersOf(two, twin).length === 5, 'two neighbouring houses own 5 circles each');
  const turnedHouse = { ...first, rot: 90 };
  const rotated = transformProps(hub, new Set([first.id]), () => turnedHouse);
  ok(followersOf({ ...hub, props: rotated.props, colliders: rotated.colliders }, turnedHouse).length === 5, 'a turned house still finds its circles');
  const picked = pick(hub, ['props', 'colliders']);
  ok(picked.props === hub.props, 'pick keeps references');
  ok(normDeg(-90) === 270 && normDeg(450) === 90, 'normDeg');
}

// ---- diff (moved to shared for the editor's summary)
{
  const hub = MapRegistry.bundled('emerald_forest')!;
  const copy = { ...hub, props: hub.props.slice(1).concat({ ...hub.props[0], id: 'new1' }).map((p, i) => (i === 3 ? { ...p, x: p.x + 1 } : p)) };
  const d = diffMaps(hub, copy);
  ok(d.added === 1 && d.removed === 1 && d.changed === 1, `diff counts added/removed/changed (${JSON.stringify(d)})`);
}

finish('map-editor');
