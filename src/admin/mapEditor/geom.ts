// Pure map-editor geometry (no DOM): the shapes the editor draws and the snapping rules. Tested in tests/map-editor.test.ts.
import type { MapCollider, MapData, MapProp, Pt } from '../../shared/mapSchema';

const RAD = Math.PI / 180;
/** Turns (x, z) by `deg` the way a prop's `rot` turns its solid (see pointInPropSolid in mapSchema.ts, the inverse of this). */
export function turn(x: number, z: number, deg: number): Pt {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  return [x * c - z * s, x * s + z * c];
}

export const normDeg = (d: number): number => ((d % 360) + 360) % 360;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** The outline of a prop's solid in world units (a circle as 28 points, a box as its 4 corners turned by `rot`), or null when walk-through. */
export function solidOutline(p: MapProp, steps = 28): Pt[] | null {
  const s = p.solid;
  if (!s) return null;
  if ('r' in s) {
    if (s.r <= 0) return null;
    return Array.from({ length: steps }, (_, i) => [p.x + Math.cos((i / steps) * Math.PI * 2) * s.r, p.z + Math.sin((i / steps) * Math.PI * 2) * s.r] as Pt);
  }
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]).map(([a, b]) => {
    const [tx, tz] = turn((a * s.w) / 2, (b * s.d) / 2, p.rot);
    return [p.x + tx, p.z + tz] as Pt;
  });
}

/** Half sizes of the axis-aligned box round a prop's solid, used to snap pieces edge to edge. A walk-through piece counts as small. */
export function halfExtent(p: MapProp): [number, number] {
  const o = solidOutline(p, 16);
  if (!o) return [0.4, 0.4];
  let hx = 0, hz = 0;
  for (const [x, z] of o) { hx = Math.max(hx, Math.abs(x - p.x)); hz = Math.max(hz, Math.abs(z - p.z)); }
  return [hx, hz];
}

export interface SnapOpts { grid: number; edges: boolean; threshold?: number }

/**
 * Where a piece dropped at (x, z) lands: on the grid (grid > 0), then pulled flush against a neighbour's edge when one is
 * within `threshold` (so two buildings touch without a gap). Each axis is decided on its own.
 */
export function snapPoint(map: MapData, moving: ReadonlySet<string>, x: number, z: number, ext: [number, number], o: SnapOpts): Pt {
  let sx = o.grid > 0 ? Math.round(x / o.grid) * o.grid : x;
  let sz = o.grid > 0 ? Math.round(z / o.grid) * o.grid : z;
  if (o.edges) {
    const th = o.threshold ?? 0.45;
    let bx = th, bz = th;
    for (const q of map.props) {
      if (moving.has(q.id)) continue;
      const [qx, qz] = halfExtent(q);
      if (Math.abs(q.x - x) > qx + ext[0] + 4 || Math.abs(q.z - z) > qz + ext[1] + 4) continue; // only the near ones
      // Only snap along an axis when the pieces are side by side on the other one (otherwise an edge far away would pull).
      const nearZ = Math.abs(q.z - z) <= qz + ext[1] + th, nearX = Math.abs(q.x - x) <= qx + ext[0] + th;
      if (nearZ) for (const c of [q.x + qx + ext[0], q.x - qx - ext[0]]) if (Math.abs(c - x) < bx) { bx = Math.abs(c - x); sx = c; }
      if (nearX) for (const c of [q.z + qz + ext[1], q.z - qz - ext[1]]) if (Math.abs(c - z) < bz) { bz = Math.abs(c - z); sz = c; }
    }
  }
  return [round3(sx), round3(sz)];
}

// ------------------------------------------------------------------ colliders that belong to a piece

/**
 * The hub's buildings and fountain have no solid of their own: their walls are loose circles in `map.colliders`
 * (Terrain.placeTown). A building's picture stands HUB_BUILDING_SIZE/2 out from its footprint's middle, the fountain's
 * 1.7 out from the plaza's middle. These circles follow their piece when it is moved, turned, copied or deleted
 * (owner 2026-11-20). The wall line has no such link yet (it comes with the collider tool in PR 7).
 */
const FOLLOW = [
  { key: /^b3_/, dx: -2.6, dz: -2.6, reach: 1.7 },
  { key: /^town_fountain$/, dx: -1.7, dz: -1.7, reach: 0.4 },
];

/** Indices into `map.colliders` of the loose circles that belong to `p` (none for a piece with its own solid). */
export function followersOf(map: MapData, p: MapProp): number[] {
  const rule = !p.solid ? FOLLOW.find((f) => f.key.test(p.key)) : undefined;
  if (!rule || !map.colliders) return [];
  // Where a piece's circles are centred: its point plus the rule's offset, turned with the piece.
  const anchor = (q: MapProp): Pt => { const [ox, oz] = turn(rule.dx, rule.dz, q.rot); return [q.x + ox, q.z + oz]; };
  const mine = anchor(p);
  // A circle goes to the nearest piece of its kind, so two buildings side by side do not take each other's.
  const rivals = map.props.filter((q) => q !== p && !q.solid && rule.key.test(q.key)).map(anchor);
  const out: number[] = [];
  map.colliders.forEach((c, i) => {
    const d = Math.hypot(c.x - mine[0], c.z - mine[1]);
    if (d > rule.reach) return;
    if (rivals.some(([rx, rz]) => Math.hypot(c.x - rx, c.z - rz) < d)) return;
    out.push(i);
  });
  return out;
}

/** The piece's followers moved by (dx, dz) and turned by `dRot` degrees about the piece's own point. */
export function moveFollower(c: MapCollider, about: Pt, dx: number, dz: number, dRot: number): MapCollider {
  const [tx, tz] = dRot ? turn(c.x - about[0], c.z - about[1], dRot) : [c.x - about[0], c.z - about[1]];
  return { ...c, x: round3(about[0] + tx + dx), z: round3(about[1] + tz + dz) };
}

/** A new prop id that no piece uses: p<max+1>. */
export function nextPropId(map: MapData): string {
  let n = 0;
  for (const p of map.props) { const m = /^p(\d+)$/.exec(p.id); if (m) n = Math.max(n, Number(m[1])); }
  return `p${Math.max(n + 1, map.props.length + 1)}`;
}

/**
 * The map's props and colliders after `fn` has been applied to the props whose id is in `ids`. Loose colliders that belong to
 * a changed piece (followersOf) are moved/turned with it. `colliders` is the very same array when none moved.
 */
export function transformProps(map: Pick<MapData, 'props' | 'colliders'>, ids: ReadonlySet<string>, fn: (p: MapProp) => MapProp): { props: MapProp[]; colliders: MapCollider[] | undefined } {
  let colliders = map.colliders;
  const props = map.props.map((p) => {
    if (!ids.has(p.id)) return p;
    const q = fn(p);
    const dx = q.x - p.x, dz = q.z - p.z, dRot = normDeg(q.rot - p.rot);
    if (colliders && (dx || dz || dRot)) {
      const own = followersOf(map as MapData, p);
      if (own.length) {
        const set = new Set(own);
        colliders = colliders.map((c, i) => (set.has(i) ? moveFollower(c, [p.x, p.z], dx, dz, dRot) : c));
      }
    }
    return q;
  });
  return { props, colliders };
}
