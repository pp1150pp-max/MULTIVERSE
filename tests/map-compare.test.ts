// The map editor's "เทียบ revision": diffMapItems lists every changed piece, and its counts agree with diffMaps (the publish box / audit).
import { ok, finish } from './check';
import { diffMapItems, diffMaps } from '../src/shared/mapDiff';
import { MapRegistry } from '../src/shared/mapRegistry';
import type { MapData } from '../src/shared/mapSchema';

const hub = MapRegistry.bundled('nexus_city')!;
const field = MapRegistry.bundled('emerald_forest')!;

/** Items grouped the way diffMaps counts them (moved and changed are both "changed"; the lair and the zone share one count). */
function counts(a: MapData, b: MapData): { added: number; removed: number; changed: number } {
  const it = diffMapItems(a, b);
  const zoneish = it.filter((i) => i.list === 'zone' || i.list === 'lair').length;
  const rest = it.filter((i) => i.list !== 'zone' && i.list !== 'lair');
  return {
    added: rest.filter((i) => i.kind === 'added').length,
    removed: rest.filter((i) => i.kind === 'removed').length,
    changed: rest.filter((i) => i.kind === 'moved' || i.kind === 'changed').length + (zoneish ? 1 : 0),
  };
}

ok(diffMapItems(hub, structuredClone(hub)).length === 0, 'identical layouts: nothing listed');

{
  const b = structuredClone(field);
  const moved = b.props[3];
  moved.x += 2;
  const turned = b.props[5];
  turned.rot = 45;
  const gone = b.props.splice(7, 1)[0];
  b.props.push({ ...b.props[0], id: 'p_new', x: 1, z: 1 });
  const it = diffMapItems(field, b);
  const m = it.find((i) => i.id === moved.id);
  ok(m?.kind === 'moved' && m.from![0] + 2 === m.to![0] && m.fields?.join() === 'x', 'a nudged prop is "moved" with its old and new place');
  ok(it.find((i) => i.id === turned.id)?.kind === 'changed', 'a turned prop (same place) is "changed"');
  ok(it.find((i) => i.id === gone.id)?.kind === 'removed', 'a deleted prop is "removed" at its old place');
  ok(it.find((i) => i.id === 'p_new')?.kind === 'added', 'a new prop is "added"');
  const c = counts(field, b), d = diffMaps(field, b);
  ok(c.added === d.added && c.removed === d.removed && c.changed === d.changed, `counts agree with diffMaps (${JSON.stringify(c)})`);
}

{
  // Lists without ids: a moved door pairs with the door, not with another door that only happens to be nearer.
  const b = structuredClone(field);
  ok(b.portals.length >= 1, 'the field has a door');
  b.portals[0] = { ...b.portals[0], x: b.portals[0].x + 3 };
  b.spawns.splice(0, 1); // one spawn removed from the front: the others are NOT listed as changed
  const it = diffMapItems(field, b);
  const door = it.filter((i) => i.list === 'portals');
  ok(door.length === 1 && door[0].kind === 'moved', 'a moved door without an id shows as one move');
  const sp = it.filter((i) => i.list === 'spawns');
  ok(sp.length === 1 && sp[0].kind === 'removed', 'removing the first spawn lists just that spawn');
  const c = counts(field, b), d = diffMaps(field, b);
  ok(c.added === d.added && c.removed === d.removed && c.changed === d.changed, 'counts agree with diffMaps without ids');
}

{
  const b = structuredClone(hub);
  b.zone.start = { x: b.zone.start.x + 1, z: b.zone.start.z };
  const z = diffMapItems(hub, b).filter((i) => i.list === 'zone');
  ok(z.length === 1 && z[0].kind === 'moved', 'a moved start point shows as the map settings moving');
}

finish('map-compare');
