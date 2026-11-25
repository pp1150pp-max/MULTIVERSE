// Map data schema v1 + validator for the /admin map editor (docs/plans/map-editor.md, sections 1.3 and 2.2).
// Pure rules: no `three`, no DOM, and no client imports. The set of valid sprite keys (client SHEET_SPECS),
// zone ids and monster ids are passed in through `MapValidateCtx` so this file stays usable on the server.

export const MAP_SCHEMA_VERSION = 1;

/** A boss room's walkable circle reaches this far past its arena (Terrain.isBlocked). */
export const ROOM_EDGE = 1;
/** Players of a room appear this far in x and z from `zone.start` (Sim.spawnPoint), so `start` itself lies outside the arena. */
export const ROOM_SPAWN_OFFSET = 2;
/** Radius of a player's body, for the room checks. */
const PLAYER_R = 0.5;
/** A free spot this close to the boss counts as reaching it (melee range, with the Volcano Heart's rock in between). */
const BOSS_REACH = 4;

/** Where players of a boss room stand when they come in (Sim.spawnPoint). */
export const roomSpawnOf = (start: { x: number; z: number }): { x: number; z: number } => ({ x: start.x - ROOM_SPAWN_OFFSET, z: start.z - ROOM_SPAWN_OFFSET });

export type MapTheme = 'forest' | 'marsh' | 'snow' | 'volcano' | 'beach' | 'cove' | 'grave' | 'kraken';
/** Every theme a map file may name (floor 2's beach, cove and ghost-ship graveyard included). */
export const MAP_THEMES: readonly string[] = ['forest', 'marsh', 'snow', 'volcano', 'beach', 'cove', 'grave', 'kraken'];
export type Pt = [number, number]; // [x, z] in world units

/** Collision of a prop: a circle `{r}` or a box `{w, d}` (full width along x, full depth along z, before `rot`). */
export type PropSolid = { r: number } | { w: number; d: number };

export interface MapProp {
  id: string;
  key: string;      // sprite key, must exist in SHEET_SPECS
  x: number;
  z: number;
  h: number;        // drawn height in world units
  /** Degrees 0 ≤ rot < 360 around the point the piece stands on. Turns the sprite on screen AND the solid shape. */
  rot: number;
  flip: boolean;
  fade: boolean;    // fades when the player walks behind it
  solid?: PropSolid; // absent = walk-through
}

export interface MapPath { id: string; w: number; pts: Pt[] }
/** `whirlpool`: a circle (rx = rz) nobody walks into (ZoneDef.whirlpools, the Kraken Maelstrom). */
export interface MapWater { kind: 'ice' | 'lava' | 'whirlpool'; x: number; z: number; rx: number; rz: number }
/** A closed polygon the player cannot enter (its inside is blocked). */
export interface MapBlocker { id: string; pts: Pt[] }
/** A solid circle that no prop owns (the hub's fountain, wall line and house footprints). Drawn as nothing. */
export interface MapCollider { x: number; z: number; r: number }
export interface MapNpc { id: string; x: number; z: number }
export interface MapRest { kind: 'fountain' | 'campfire'; x: number; z: number }
export interface MapPortal {
  to: string;
  x: number;
  z: number;
  minLevel: number;
  /** An unlock the player must have on top of minLevel (PortalDef.requires, the way up a floor). */
  requires?: string;
  /** The place it will lead to while `to` is not in the game yet: it stays shut and says so (the harbour's piers, PortalDef.soonName). */
  soonName?: string;
  /** Its picture, when not the usual 'portal' (PortalDef.prop: the harbour's dock and lighthouse gates). */
  prop?: string;
}
export interface MapSpawn { monster: string; x: number; z: number; radius: number; count: number; respawn: [number, number] }
export interface MapLair { boss: string; x: number; z: number }
/**
 * Marks a boss room (docs/plans/map-editor.md, boss rooms added 2026-11-21). Everything in it is locked: validateMap() compares it
 * with the bundled file, so only props, blockers/colliders and `zone.start` (where players appear) can change.
 */
export interface MapRoom {
  /** The field map whose summoner opens this room. */
  of: string;
  /** Arena radius: the ring of stones; nobody walks past it (+ROOM_EDGE). */
  arena: number;
  boss: { monster: string; x: number; z: number; radius: number };
}

export interface MapData {
  schema: 1;
  id: string;
  floor: number;
  rev: number;
  zone: {
    half: number;
    theme: MapTheme;
    quadrants?: [MapTheme, MapTheme, MapTheme, MapTheme];
    start: { x: number; z: number };
    safe?: { x: number; z: number; half: number };
  };
  paths: MapPath[];
  water: MapWater[];
  props: MapProp[];
  blockers: MapBlocker[];
  /** Extra solid circles that belong to no prop. Absent = none. Added in PR 2 so the hub bakes exactly (owner OK 2026-11-20). */
  colliders?: MapCollider[];
  walkable: { half: number };
  npcs: MapNpc[];
  rest: MapRest[];
  portals: MapPortal[];
  spawns: MapSpawn[];
  /**
   * Minigame "รอดมอนเป็นระลอก" (src/shared/waveGame.ts): where the waves' monsters come out, on a map made in the editor whose
   * settings pick that minigame. Absent = none (every other map, every file made before 2026-11-21).
   */
  waveSpots?: { x: number; z: number; radius: number }[];
  lair?: MapLair;
  /** Only boss rooms have it. Absent on every other map. */
  room?: MapRoom;
}

export interface MapValidateCtx {
  /** Every sprite key that exists (Object.keys(SHEET_SPECS) on the client). Required: unknown keys are errors. */
  propKeys: Iterable<string>;
  /** Optional: when given, portal targets / monster ids / lair boss must be in these sets. */
  zoneIds?: Iterable<string>;
  monsterIds?: Iterable<string>;
  /** BFS grid cell size in world units (default 1). */
  cell?: number;
  /**
   * The bundled file of this map (MapRegistry.bundled). A boss room is compared with it: what the editor must not change
   * (id, floor, half, theme, walkable frame, the `room` block) has to equal it. Without it only the shape of a room is checked.
   */
  baseline?: MapData;
}

export type MapIssueCode =
  | 'schema' | 'range' | 'dup_id' | 'bad_key' | 'bad_ref' | 'out_of_bounds'
  | 'polygon' | 'in_collision' | 'unreachable' | 'locked';

export interface MapIssue {
  severity: 'error' | 'warn';
  code: MapIssueCode;
  /** Which collection and id the issue is about, so the editor can jump to it. */
  kind?: 'zone' | 'prop' | 'blocker' | 'path' | 'water' | 'npc' | 'rest' | 'portal' | 'spawn' | 'lair' | 'walkable' | 'wave';
  id?: string;
  message: string;
}

// ---------------------------------------------------------------- geometry

const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Is (x, z) inside the closed polygon (even-odd rule)? */
export function pointInPolygon(pts: readonly Pt[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function polygonArea(pts: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return Math.abs(a) / 2;
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Do segments ab and cd properly cross (touching at a shared end point does not count)? */
function segCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
}

function selfIntersects(pts: readonly Pt[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue; // neighbours share a corner
      if (segCross(a, b, pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Is (x, z) inside the prop's solid? `rot` turns the solid about the prop's own point (angle measured the same way for circle and box). */
export function pointInPropSolid(p: MapProp, x: number, z: number): boolean {
  const s = p.solid;
  if (!s) return false;
  const dx = x - p.x, dz = z - p.z;
  if ('r' in s) return dx * dx + dz * dz <= s.r * s.r;
  const a = (-p.rot * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const lx = dx * c - dz * sn, lz = dx * sn + dz * c; // into the box's own axes
  return Math.abs(lx) <= s.w / 2 && Math.abs(lz) <= s.d / 2;
}

/** Can a body NOT stand at (x, z)? Outside the walkable frame, inside a solid prop, or inside a blocker polygon. */
export function isPointBlocked(map: MapData, x: number, z: number): boolean {
  const h = map.walkable.half;
  if (Math.abs(x) > h || Math.abs(z) > h) return true;
  for (const p of map.props) if (pointInPropSolid(p, x, z)) return true;
  for (const b of map.blockers) if (pointInPolygon(b.pts, x, z)) return true;
  if (map.colliders) for (const c of map.colliders) if ((x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r) return true;
  return false;
}

// ---------------------------------------------------------------- validator

/** Checks a map and returns every problem found. Never throws, even on garbage input. */
export function validateMap(map: MapData, ctx: MapValidateCtx): MapIssue[] {
  const out: MapIssue[] = [];
  const err = (code: MapIssueCode, message: string, kind?: MapIssue['kind'], id?: string) =>
    out.push({ severity: 'error', code, kind, id, message });
  try {
    validateInner(map, ctx, err, (code, message, kind, id) => out.push({ severity: 'warn', code, kind, id, message }));
  } catch (e) {
    err('schema', `map is malformed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return out;
}

type Err = (code: MapIssueCode, message: string, kind?: MapIssue['kind'], id?: string) => void;

function validateInner(map: MapData, ctx: MapValidateCtx, err: Err, warn: Err): void {
  if (!map || typeof map !== 'object') return err('schema', 'map is not an object');
  if (map.schema !== MAP_SCHEMA_VERSION) return err('schema', `schema must be ${MAP_SCHEMA_VERSION}, got ${String(map.schema)}`);
  const need = (k: string, v: unknown, isArr = true) => {
    if (isArr ? !Array.isArray(v) : !v || typeof v !== 'object') { err('schema', `"${k}" is missing or the wrong type`); return false; }
    return true;
  };
  let shape = true;
  for (const k of ['paths', 'water', 'props', 'blockers', 'npcs', 'rest', 'portals', 'spawns'] as const) shape = need(k, map[k]) && shape;
  shape = need('zone', map.zone, false) && shape;
  shape = need('walkable', map.walkable, false) && shape;
  if (!shape) return;
  if (typeof map.id !== 'string' || !map.id) err('schema', 'id must be a non-empty string', 'zone');
  if (!Number.isInteger(map.floor) || map.floor < 1 || map.floor > 9) err('range', `floor ${map.floor} must be an integer 1–9`, 'zone');
  if (!Number.isInteger(map.rev) || map.rev < 0) err('range', `rev ${map.rev} must be an integer ≥ 0`, 'zone');

  const range = (v: unknown, lo: number, hi: number, what: string, kind: MapIssue['kind'], id?: string, hiExclusive = false): boolean => {
    const good = fin(v) && v >= lo && (hiExclusive ? v < hi : v <= hi);
    if (!good) err('range', `${what} = ${String(v)} is outside ${lo}–${hi}`, kind, id);
    return good;
  };

  // zone + walkable
  const z = map.zone;
  const zoneOk = range(z.half, 4, 500, 'zone.half', 'zone');
  const half = zoneOk ? z.half : 500;
  if (!MAP_THEMES.includes(z.theme)) err('range', `zone.theme "${String(z.theme)}" is unknown`, 'zone');
  if (z.quadrants && (!Array.isArray(z.quadrants) || z.quadrants.length !== 4 || z.quadrants.some(q => !MAP_THEMES.includes(q))))
    err('range', 'zone.quadrants must be 4 valid themes', 'zone');
  const wOk = range(map.walkable.half, 1, half, 'walkable.half', 'walkable');
  const whalf = wOk ? map.walkable.half : half;
  const inWalk = (x: number, zz: number) => fin(x) && fin(zz) && Math.abs(x) <= whalf && Math.abs(zz) <= whalf;
  if (!z.start || !fin(z.start.x) || !fin(z.start.z)) err('range', 'zone.start needs finite x and z', 'zone');
  else if (!inWalk(z.start.x, z.start.z)) err('out_of_bounds', 'zone.start is outside the walkable frame', 'zone');
  if (z.safe) {
    if (!fin(z.safe.x) || !fin(z.safe.z) || !range(z.safe.half, 0.5, half, 'zone.safe.half', 'zone'))
      err('range', 'zone.safe needs finite x, z and a half size', 'zone');
  }

  // ids + keys
  const dup = (kind: NonNullable<MapIssue['kind']>, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (typeof id !== 'string' || !id) err('schema', `a ${kind} has no id`, kind);
      else if (seen.has(id)) err('dup_id', `duplicate ${kind} id "${id}"`, kind, id);
      seen.add(id);
    }
  };
  dup('prop', map.props.map(p => p.id));
  dup('blocker', map.blockers.map(b => b.id));
  dup('path', map.paths.map(p => p.id));
  dup('npc', map.npcs.map(n => n.id));

  const keys = new Set(ctx.propKeys);
  const zones = ctx.zoneIds ? new Set(ctx.zoneIds) : null;
  const mons = ctx.monsterIds ? new Set(ctx.monsterIds) : null;

  // props
  for (const p of map.props) {
    if (!keys.has(p.key)) err('bad_key', `prop "${p.id}" uses unknown sprite key "${p.key}"`, 'prop', p.id);
    const xz = fin(p.x) && fin(p.z);
    if (!xz) err('range', `prop "${p.id}" needs finite x and z`, 'prop', p.id);
    else if (Math.abs(p.x) > half || Math.abs(p.z) > half) err('out_of_bounds', `prop "${p.id}" is outside the map frame`, 'prop', p.id);
    range(p.h, 0.1, 100, `prop "${p.id}" h`, 'prop', p.id);
    range(p.rot, 0, 360, `prop "${p.id}" rot`, 'prop', p.id, true);
    if (typeof p.flip !== 'boolean' || typeof p.fade !== 'boolean') err('schema', `prop "${p.id}" flip/fade must be booleans`, 'prop', p.id);
    if (p.solid) {
      if ('r' in p.solid) range(p.solid.r, 0.05, 50, `prop "${p.id}" solid.r`, 'prop', p.id);
      else if ('w' in p.solid && 'd' in p.solid) {
        range(p.solid.w, 0.05, 100, `prop "${p.id}" solid.w`, 'prop', p.id);
        range(p.solid.d, 0.05, 100, `prop "${p.id}" solid.d`, 'prop', p.id);
      } else err('schema', `prop "${p.id}" solid must be {r} or {w, d}`, 'prop', p.id);
    }
  }

  // extra colliders
  if (map.colliders !== undefined && !Array.isArray(map.colliders)) err('schema', '"colliders" must be an array');
  else (map.colliders ?? []).forEach((c, i) => {
    if (!c || !fin(c.x) || !fin(c.z)) return err('range', `colliders[${i}] needs finite x and z`);
    if (Math.abs(c.x) > half || Math.abs(c.z) > half) err('out_of_bounds', `colliders[${i}] is outside the map frame`);
    range(c.r, 0.05, 50, `colliders[${i}] r`, undefined);
  });

  // paths / water
  for (const p of map.paths) {
    range(p.w, 0.5, 30, `path "${p.id}" w`, 'path', p.id);
    if (!Array.isArray(p.pts) || p.pts.length < 2 || p.pts.some(q => !Array.isArray(q) || !fin(q[0]) || !fin(q[1])))
      err('polygon', `path "${p.id}" needs at least 2 finite points`, 'path', p.id);
    else if (p.pts.some(q => Math.abs(q[0]) > half + 20 || Math.abs(q[1]) > half + 20))
      err('out_of_bounds', `path "${p.id}" has a point far outside the map frame`, 'path', p.id);
  }
  map.water.forEach((w, i) => {
    const id = String(i);
    if (w.kind !== 'ice' && w.kind !== 'lava' && w.kind !== 'whirlpool') err('range', `water[${i}] kind must be ice, lava or whirlpool`, 'water', id);
    if (!fin(w.x) || !fin(w.z)) err('range', `water[${i}] needs finite x and z`, 'water', id);
    else if (Math.abs(w.x) > half || Math.abs(w.z) > half) err('out_of_bounds', `water[${i}] is outside the map frame`, 'water', id);
    range(w.rx, 0.5, 200, `water[${i}] rx`, 'water', id);
    range(w.rz, 0.5, 200, `water[${i}] rz`, 'water', id);
  });

  // blockers
  for (const b of map.blockers) {
    const okPts = Array.isArray(b.pts) && b.pts.every(q => Array.isArray(q) && fin(q[0]) && fin(q[1]));
    if (!okPts || b.pts.length < 3) { err('polygon', `blocker "${b.id}" needs at least 3 finite points`, 'blocker', b.id); continue; }
    if (b.pts.some(q => Math.abs(q[0]) > half || Math.abs(q[1]) > half)) err('out_of_bounds', `blocker "${b.id}" has a point outside the map frame`, 'blocker', b.id);
    if (polygonArea(b.pts) < 1e-6) err('polygon', `blocker "${b.id}" has no area`, 'blocker', b.id);
    else if (selfIntersects(b.pts)) err('polygon', `blocker "${b.id}" crosses itself`, 'blocker', b.id);
  }

  // placed things: inside the walkable frame, not inside collision
  const placed = (kind: NonNullable<MapIssue['kind']>, id: string, x: number, zz: number, label: string): boolean => {
    if (!fin(x) || !fin(zz)) { err('range', `${label} needs finite x and z`, kind, id); return false; }
    if (!inWalk(x, zz)) { err('out_of_bounds', `${label} is outside the walkable frame`, kind, id); return false; }
    if (isPointBlocked(map, x, zz)) { err('in_collision', `${label} stands inside collision`, kind, id); return false; }
    return true;
  };
  for (const n of map.npcs) placed('npc', n.id, n.x, n.z, `npc "${n.id}"`);
  map.rest.forEach((r, i) => {
    if (r.kind !== 'fountain' && r.kind !== 'campfire') err('range', `rest[${i}] kind must be fountain or campfire`, 'rest', String(i));
    if (!fin(r.x) || !fin(r.z)) err('range', `rest[${i}] needs finite x and z`, 'rest', String(i));
    else if (!inWalk(r.x, r.z)) err('out_of_bounds', `rest[${i}] is outside the walkable frame`, 'rest', String(i));
  });
  map.spawns.forEach((s, i) => {
    const id = String(i);
    if (mons && !mons.has(s.monster)) err('bad_ref', `spawn ${i} uses unknown monster "${s.monster}"`, 'spawn', id);
    if (typeof s.monster !== 'string' || !s.monster) err('schema', `spawn ${i} has no monster`, 'spawn', id);
    range(s.radius, 0, 50, `spawn ${i} radius`, 'spawn', id);
    if (!Number.isInteger(s.count) || s.count < 1 || s.count > 50) err('range', `spawn ${i} count ${s.count} must be an integer 1–50`, 'spawn', id);
    if (!Array.isArray(s.respawn) || s.respawn.length !== 2 || !fin(s.respawn[0]) || !fin(s.respawn[1]) || s.respawn[0] <= 0 || s.respawn[0] > s.respawn[1] || s.respawn[1] > 3600)
      err('range', `spawn ${i} respawn must be [min, max] seconds with 0 < min ≤ max ≤ 3600`, 'spawn', id);
    placed('spawn', id, s.x, s.z, `spawn ${i} (${s.monster})`);
  });
  if (map.waveSpots !== undefined) {
    if (!Array.isArray(map.waveSpots)) err('schema', '"waveSpots" must be a list', 'wave');
    else {
      if (map.waveSpots.length > 30) err('range', 'จุดเกิดระลอกได้ไม่เกิน 30 จุด', 'wave');
      map.waveSpots.forEach((w, i) => {
        const id = String(i);
        range(w?.radius, 0, 30, `wave spot ${i} radius`, 'wave', id);
        placed('wave', id, w?.x, w?.z, `จุดเกิดระลอก ${i + 1}`);
      });
    }
  }
  map.portals.forEach((p, i) => {
    const id = String(i);
    if (zones && !zones.has(p.to) && !p.soonName) err('bad_ref', `portal ${i} leads to unknown zone "${p.to}"`, 'portal', id);
    if (typeof p.to !== 'string' || !p.to) err('schema', `portal ${i} has no target`, 'portal', id);
    if (!Number.isInteger(p.minLevel) || p.minLevel < 0 || p.minLevel > 200) err('range', `portal ${i} minLevel ${p.minLevel} must be an integer 0–200`, 'portal', id);
    placed('portal', id, p.x, p.z, `portal ${i} (to ${p.to})`);
  });
  if (map.lair) {
    if (mons && !mons.has(map.lair.boss)) err('bad_ref', `lair boss "${map.lair.boss}" is unknown`, 'lair');
    // The lair is where the boss summoner stands, solid itself, so it is only checked against the frame (not "in collision").
    if (!fin(map.lair.x) || !fin(map.lair.z)) err('range', 'lair needs finite x and z', 'lair', 'lair');
    else if (!inWalk(map.lair.x, map.lair.z)) err('out_of_bounds', 'lair is outside the walkable frame', 'lair', 'lair');
  }

  if (map.room) validateRoom(map, ctx, err, whalf);
  else if (ctx.baseline?.room) err('locked', 'แมพนี้เป็นห้องบอส ต้องมีบล็อก room ตามไฟล์เดิม', 'zone');

  // reachability: BFS on a grid from zone.start; every portal must be reachable
  if (!z.start || !fin(z.start.x) || !fin(z.start.z) || !wOk) return;
  const cell = ctx.cell && ctx.cell > 0 ? ctx.cell : 1;
  const n = Math.max(1, Math.ceil((whalf * 2) / cell));
  if (n > 2000) return; // absurd grid (already reported as a range error elsewhere)
  const cx = (i: number) => -whalf + (i + 0.5) * cell;
  const toIdx = (v: number) => Math.min(n - 1, Math.max(0, Math.floor((v + whalf) / cell)));
  const blocked = new Uint8Array(n * n);
  const room = map.room;
  // A boss room is walked from where players appear, and nobody leaves its arena (Terrain.isBlocked).
  const from = room ? roomSpawnOf(z.start) : z.start;
  const roomEdge = room && fin(room.arena) ? room.arena + ROOM_EDGE - PLAYER_R : Infinity;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) blocked[r * n + c] = isPointBlocked(map, cx(c), cx(r)) || Math.hypot(cx(c), cx(r)) > roomEdge ? 1 : 0;
  const seen = new Uint8Array(n * n);
  const queue: number[] = [];
  let s0 = toIdx(from.z) * n + toIdx(from.x);
  if (blocked[s0] && room) return; // the spawn spot is reported as a room error
  if (blocked[s0]) {
    // The hub's start is the middle of its fountain (players are pushed out of it): warn, and walk from the nearest free cell.
    let best = -1, bestD = Infinity;
    for (let k = 0; k < n * n; k++) {
      if (blocked[k]) continue;
      const d = (cx(k % n) - z.start.x) ** 2 + (cx((k / n) | 0) - z.start.z) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best < 0) { err('in_collision', 'zone.start stands inside collision and there is no free ground', 'zone'); return; }
    warn('in_collision', 'zone.start stands inside collision (reachability is checked from the nearest free spot)', 'zone');
    s0 = best;
  }
  seen[s0] = 1; queue.push(s0);
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q], r = (cur / n) | 0, c = cur % n;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const k = rr * n + cc;
      if (seen[k] || blocked[k]) continue;
      seen[k] = 1; queue.push(k);
    }
  }
  map.portals.forEach((p, i) => {
    if (!inWalk(p.x, p.z) || isPointBlocked(map, p.x, p.z)) return; // already reported
    if (!seen[toIdx(p.z) * n + toIdx(p.x)]) err('unreachable', `portal ${i} (to ${p.to}) cannot be reached from the start point`, 'portal', String(i));
  });
  if (room && room.boss && fin(room.boss.x) && fin(room.boss.z)) {
    let near = false;
    for (let k = 0; k < n * n && !near; k++) near = !!seen[k] && Math.hypot(cx(k % n) - room.boss.x, cx((k / n) | 0) - room.boss.z) <= BOSS_REACH;
    if (!near) err('unreachable', 'เดินจากจุดเกิดไปถึงบอสไม่ได้ (ของ/collision ปิดทางจนเข้าไปตีบอสไม่ถึง)', 'zone');
  }
}

/** What a boss room may and may not be (see MapRoom): everything but props, blockers, extra colliders and the spawn spot is locked. */
function validateRoom(map: MapData, ctx: MapValidateCtx, err: Err, whalf: number): void {
  const r = map.room;
  if (!r || typeof r !== 'object' || typeof r.of !== 'string' || !fin(r.arena) || !r.boss || typeof r.boss.monster !== 'string'
    || !fin(r.boss.x) || !fin(r.boss.z) || !fin(r.boss.radius)) return err('schema', '"room" is missing or malformed', 'zone');
  const locked = (what: string, kind?: MapIssue['kind']): void => err('locked', `ห้องบอสแก้ ${what} ไม่ได้`, kind ?? 'zone');
  if (map.lair) locked('ที่เรียกบอส (lair)', 'lair');
  if (map.zone.quadrants || map.zone.safe) locked('เขตปลอดภัย/ควอดแรนท์');
  const lists: [string, unknown[], MapIssue['kind']][] = [['ประตู', map.portals, 'portal'], ['จุดเกิดมอน', map.spawns, 'spawn'], ['NPC', map.npcs, 'npc'],
    ['จุดพัก', map.rest, 'rest'], ['ทางเดิน', map.paths, 'path'], ['ทะเลสาบ/ลาวา', map.water, 'water'], ['จุดเกิดระลอก', map.waveSpots ?? [], 'wave']];
  for (const [name, list, kind] of lists) if (list.length) err('locked', `ห้องบอสห้ามมี${name} (ลบออก)`, kind);
  const b = ctx.baseline;
  if (b) {
    const same = (x: unknown, y: unknown): boolean => JSON.stringify(x) === JSON.stringify(y);
    if (!b.room) err('locked', 'ไฟล์เดิมของแมพนี้ไม่ใช่ห้องบอส', 'zone');
    else {
      if (!same(r, b.room)) locked('ข้อมูลห้อง (ตำแหน่งบอส รัศมีสนาม ฟาร์มต้นทาง)');
      if (map.id !== b.id || map.floor !== b.floor) locked('id/ชั้น');
      if (map.zone.half !== b.zone.half || map.zone.theme !== b.zone.theme) locked('ขนาดแมพ/ธีม (half, theme)');
      if (map.walkable.half !== b.walkable.half) locked('กรอบเดินได้ (walkable)', 'walkable');
      // The extra circles belong to no prop and have no tool: the Volcano Heart's rock is one.
      if (!same(map.colliders ?? [], b.colliders ?? [])) locked('วง collision พิเศษ (เช่นก้อนหินกลางห้องภูเขาไฟ)');
    }
  }
  // Where players appear: inside the arena, not in collision.
  const s = fin(map.zone.start?.x) && fin(map.zone.start?.z) ? roomSpawnOf(map.zone.start) : null;
  if (!s) return;
  if (Math.hypot(s.x, s.z) + PLAYER_R > r.arena + ROOM_EDGE) err('out_of_bounds', 'จุดเกิดผู้เล่นอยู่นอกสนามบอส (ต้องอยู่ในวงสนาม)', 'zone');
  else if (Math.abs(s.x) > whalf || Math.abs(s.z) > whalf || isPointBlocked(map, s.x, s.z)) err('in_collision', 'จุดเกิดผู้เล่นอยู่ในของที่ชน (collision) หรือนอกกรอบเดินได้', 'zone');
}
