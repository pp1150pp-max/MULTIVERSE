import type { Terrain } from '../shared/sim/terrain';
import type { Vec2 } from '../shared/types';

/** Grid cell size in world units. */
const CELL = 0.5;
/** A little wider than the player (radius 0.4) so the path doesn't scrape every tree. */
const CLEARANCE = 0.5;

/** Which grid cells the player can stand in. Built once per zone (the layout never changes). */
class WalkGrid {
  readonly n: number;
  readonly blocked: Uint8Array;
  readonly half: number;

  constructor(readonly terrain: Terrain) {
    this.half = terrain.half;
    this.n = Math.floor((2 * this.half) / CELL) + 1;
    this.blocked = new Uint8Array(this.n * this.n);
    // Same rule as Terrain.isBlocked, but stamped per collider so it stays fast.
    for (let gz = 0; gz < this.n; gz++) {
      for (let gx = 0; gx < this.n; gx++) {
        const [x, z] = this.world(gx, gz);
        if (Math.abs(x) > terrain.bound || Math.abs(z) > terrain.bound) this.blocked[gz * this.n + gx] = 1;
      }
    }
    for (const c of terrain.colliders) {
      const r = c.r + CLEARANCE;
      const [x0, z0] = this.cell(c.x - r, c.z - r);
      const [x1, z1] = this.cell(c.x + r, c.z + r);
      for (let gz = z0; gz <= z1; gz++) {
        for (let gx = x0; gx <= x1; gx++) {
          const [x, z] = this.world(gx, gz);
          if (Math.hypot(c.x - x, c.z - z) < r) this.blocked[gz * this.n + gx] = 1;
        }
      }
    }
  }

  world(gx: number, gz: number): [number, number] {
    return [gx * CELL - this.half, gz * CELL - this.half];
  }

  cell(x: number, z: number): [number, number] {
    const c = (v: number) => Math.max(0, Math.min(this.n - 1, Math.round((v + this.half) / CELL)));
    return [c(x), c(z)];
  }

  free(gx: number, gz: number): boolean {
    return gx >= 0 && gz >= 0 && gx < this.n && gz < this.n && !this.blocked[gz * this.n + gx];
  }

  /** The nearest walkable cell (searching outwards), for a click on a tree or rock. */
  nearestFree(gx: number, gz: number): [number, number] | null {
    if (this.free(gx, gz)) return [gx, gz];
    for (let r = 1; r < 12; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) === r && this.free(gx + dx, gz + dz)) return [gx + dx, gz + dz];
        }
      }
    }
    return null;
  }

  /** True when a straight walk between two points crosses no blocked cell. */
  clear(ax: number, az: number, bx: number, bz: number): boolean {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const [gx, gz] = this.cell(ax + (bx - ax) * t, az + (bz - az) * t);
      if (!this.free(gx, gz)) return false;
    }
    return true;
  }
}

let cached: WalkGrid | null = null;

/** Binary min-heap keyed by f-score. */
class Heap {
  private items: number[] = [];
  constructor(private readonly f: Float32Array) {}
  get size(): number { return this.items.length; }
  push(v: number): void {
    const a = this.items;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[a[p]] <= this.f[a[i]]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.f[a[l]] < this.f[a[m]]) m = l;
        if (r < a.length && this.f[a[r]] < this.f[a[m]]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * A walkable route from `from` to `to` around trees, rocks and the zone edge (A* on a grid, then
 * straightened). Returns the waypoints after the start, or null when there is no way there.
 */
export function findPath(terrain: Terrain, from: Vec2, to: Vec2): Vec2[] | null {
  if (cached?.terrain !== terrain) cached = new WalkGrid(terrain);
  const g = cached;
  const start = g.nearestFree(...g.cell(from.x, from.z));
  const goal = g.nearestFree(...g.cell(to.x, to.z));
  if (!start || !goal) return null;
  const n = g.n;
  const si = start[1] * n + start[0];
  const gi = goal[1] * n + goal[0];

  const gScore = new Float32Array(n * n).fill(Infinity);
  const fScore = new Float32Array(n * n).fill(Infinity);
  const came = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const h = (i: number) => {
    const dx = Math.abs((i % n) - goal[0]);
    const dz = Math.abs(Math.floor(i / n) - goal[1]);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  gScore[si] = 0;
  fScore[si] = h(si);
  const open = new Heap(fScore);
  open.push(si);
  let found = false;
  while (open.size) {
    const cur = open.pop();
    if (cur === gi) {
      found = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % n;
    const cz = Math.floor(cur / n);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (!g.free(nx, nz)) continue;
        // No cutting corners between two blocked cells.
        if (dx && dz && (!g.free(cx + dx, cz) || !g.free(cx, cz + dz))) continue;
        const ni = nz * n + nx;
        if (closed[ni]) continue;
        const t = gScore[cur] + (dx && dz ? Math.SQRT2 : 1);
        if (t < gScore[ni]) {
          gScore[ni] = t;
          fScore[ni] = t + h(ni);
          came[ni] = cur;
          open.push(ni);
        }
      }
    }
  }
  if (!found) return null;

  const cells: Vec2[] = [];
  for (let i = gi; i !== -1; i = came[i]) {
    const [x, z] = g.world(i % n, Math.floor(i / n));
    cells.push({ x, z });
  }
  cells.reverse();
  // The exact clicked spot when it is walkable, not the cell centre.
  if (g.free(...g.cell(to.x, to.z))) cells[cells.length - 1] = { x: to.x, z: to.z };

  // Straighten: from each kept point jump to the farthest point it can walk to in a line.
  const out: Vec2[] = [];
  let ax = from.x;
  let az = from.z;
  let k = 0;
  while (k < cells.length - 1) {
    let far = k + 1;
    for (let j = k + 2; j < cells.length; j++) {
      if (!g.clear(ax, az, cells[j].x, cells[j].z)) break;
      far = j;
    }
    out.push(cells[far]);
    ax = cells[far].x;
    az = cells[far].z;
    k = far;
  }
  if (!out.length) out.push(cells[cells.length - 1]);
  return out;
}
