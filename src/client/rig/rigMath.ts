// 2D skeletal ("cutout", like Spine) animation maths for the papercraft sword rig (owner 2026-11-16).
// No three.js and no DOM here, so the tests and the offline preview tool can use it.
//
// A rig is a tree of bones. Each bone shows one flat paper piece (a picture). Where things sit is written in
// FRACTIONS of the pictures (0..1 across, 0..1 down), so a piece swapped for another of a slightly different
// size (another armour) still lines up:
// - `pivot`: the point of the bone's own picture it turns around (its joint with the parent).
// - `at`: where on the PARENT's picture that joint is.
// Positions come out in rig pixels (the pieces' own pixels), x to the right and y UP, the root's pivot at
// `root` above the ground line. Angles are degrees, counter-clockwise on screen.

export type Vec = [number, number];

export interface RigBoneDef {
  id: string;
  parent?: string;
  /** The joint on the parent's picture (fractions). Required for every bone but the root. */
  at?: Vec;
  /** The point of this bone's picture it turns around (fractions). */
  pivot: Vec;
  /** Picture name in the piece set; missing = the bone's id. Empty string = a bone with no picture. */
  part?: string;
  /** Resting angle added to every pose (degrees). */
  rot?: number;
}

export interface RigViewDef {
  bones: RigBoneDef[];
  /** Bone ids, back to front. Bones left out are not drawn. */
  order: string[];
  /** The root pivot above the ground line, in rig pixels: [x, y]. */
  root: Vec;
}

export type Ease = 'linear' | 'smooth' | 'in' | 'out';

export interface RotKey {
  /** Fraction of the animation, 0..1. */
  t: number;
  /** Degrees on top of the bone's resting angle. */
  r: number;
  /** How the value gets from this key to the next one (default smooth). */
  e?: Ease;
}

export interface MoveKey {
  t: number;
  x: number;
  y: number;
  e?: Ease;
}

export interface RigAnim {
  /** Seconds, as made; a game event can stretch it (play's duration). */
  duration: number;
  loop: boolean;
  /** Bone id → angle keys. */
  tracks: Record<string, RotKey[]>;
  /** The whole body moved (rig pixels, y up): bob, hop. */
  root?: MoveKey[];
}

export type RigViewName = 'front' | 'back';
export const RIG_VIEWS: readonly RigViewName[] = ['front', 'back'];

export interface RigDef {
  version: 1;
  /** Rig pixels per world unit. */
  pxPerUnit: number;
  views: Record<RigViewName, RigViewDef>;
  anims: Record<string, RigAnim>;
}

/** Where one bone ended up: its pivot (rig px, y up) and its total angle (degrees, counter-clockwise). */
export interface BonePose {
  x: number;
  y: number;
  rot: number;
}

export type Pose = Record<string, number>;
export type Sizes = (part: string) => { w: number; h: number } | undefined;

const RAD = Math.PI / 180;

/** The bones in parent-first order (each after its parent). Throws on a loop or a missing parent. */
export function boneOrder(bones: readonly RigBoneDef[]): RigBoneDef[] {
  const byId = new Map(bones.map((b) => [b.id, b]));
  const out: RigBoneDef[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (b: RigBoneDef) => {
    const s = state.get(b.id);
    if (s === 2) return;
    if (s === 1) throw new Error(`loop at bone "${b.id}"`);
    state.set(b.id, 1);
    if (b.parent !== undefined) {
      const p = byId.get(b.parent);
      if (!p) throw new Error(`bone "${b.id}": no parent "${b.parent}"`);
      visit(p);
    }
    state.set(b.id, 2);
    out.push(b);
  };
  bones.forEach(visit);
  return out;
}

/** Picture of a bone (its `part`, else its id); undefined for a bone with no picture. */
export const partOf = (b: RigBoneDef): string | undefined => (b.part === '' ? undefined : (b.part ?? b.id));

/**
 * Solves a view for a pose: every bone's pivot position and total angle.
 * `pose` = extra degrees per bone; `move` = the whole body moved (rig px).
 */
export function solveView(view: RigViewDef, sizes: Sizes, pose: Pose = {}, move: Vec = [0, 0]): Map<string, BonePose> {
  const out = new Map<string, BonePose>();
  const byId = new Map(view.bones.map((b) => [b.id, b]));
  for (const b of boneOrder(view.bones)) {
    const rot = (b.rot ?? 0) + (pose[b.id] ?? 0);
    if (b.parent === undefined) {
      out.set(b.id, { x: view.root[0] + move[0], y: view.root[1] + move[1], rot });
      continue;
    }
    const parent = byId.get(b.parent)!;
    const pp = out.get(b.parent)!;
    const ps = sizeOf(parent, sizes);
    const at = b.at ?? parent.pivot;
    // From the parent's pivot to the joint, on the parent's picture (y down → up), then turned with the parent.
    const dx = (at[0] - parent.pivot[0]) * ps.w;
    const dy = -(at[1] - parent.pivot[1]) * ps.h;
    const c = Math.cos(pp.rot * RAD);
    const s = Math.sin(pp.rot * RAD);
    out.set(b.id, { x: pp.x + dx * c - dy * s, y: pp.y + dx * s + dy * c, rot: pp.rot + rot });
  }
  return out;
}

function sizeOf(b: RigBoneDef, sizes: Sizes): { w: number; h: number } {
  const p = partOf(b);
  return (p && sizes(p)) || { w: 0, h: 0 };
}

/**
 * Where the picture of a bone goes: the centre of the picture (rig px, y up) for a bone at `bp`. Pictures are
 * placed by their centre, turned by `bp.rot`.
 */
export function partCenter(b: RigBoneDef, bp: BonePose, size: { w: number; h: number }): Vec {
  const dx = (0.5 - b.pivot[0]) * size.w;
  const dy = -(0.5 - b.pivot[1]) * size.h;
  const c = Math.cos(bp.rot * RAD);
  const s = Math.sin(bp.rot * RAD);
  return [bp.x + dx * c - dy * s, bp.y + dx * s + dy * c];
}

/** 0..1 → 0..1 along an easing. */
export function ease(e: Ease | undefined, u: number): number {
  switch (e ?? 'smooth') {
    case 'linear': return u;
    case 'in': return u * u;
    case 'out': return 1 - (1 - u) * (1 - u);
    default: return u * u * (3 - 2 * u);
  }
}

/** Shortest turn from a to b, in degrees (-180..180]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * The value of a key track at `u` (fraction of the animation). Before the first key: the first; after the last:
 * the last, or (looping) on the way back to the first. Angles take the shortest turn only when `wrapAngles`.
 */
export function sampleKeys<K extends { t: number; e?: Ease }>(keys: readonly K[], u: number, loop: boolean, get: (k: K) => number, wrapAngles = false): number {
  if (!keys.length) return 0;
  if (keys.length === 1) return get(keys[0]);
  if (loop) u = ((u % 1) + 1) % 1;
  const lerp = (a: K, b: K, f: number) => {
    const va = get(a);
    const vb = get(b);
    const d = wrapAngles ? angleDelta(va, vb) : vb - va;
    return va + d * ease(a.e, f);
  };
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (u <= first.t) {
    if (!loop || first.t <= 0) return get(first);
    const span = first.t + (1 - last.t);
    return lerp(last, first, span > 0 ? (u + 1 - last.t) / span : 1);
  }
  if (u >= last.t) {
    if (!loop || last.t >= 1) return get(last);
    const span = first.t + (1 - last.t);
    return lerp(last, first, span > 0 ? (u - last.t) / span : 1);
  }
  let i = 0;
  while (i < keys.length - 2 && u >= keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  return lerp(a, b, b.t > a.t ? (u - a.t) / (b.t - a.t) : 1);
}

/** An animation's pose at `u` (fraction 0..1): extra angle per bone, and the body's move. */
export function samplePose(anim: RigAnim, u: number): { pose: Pose; move: Vec } {
  const pose: Pose = {};
  for (const [bone, keys] of Object.entries(anim.tracks)) pose[bone] = sampleKeys(keys, u, anim.loop, (k) => k.r);
  const move: Vec = anim.root?.length
    ? [sampleKeys(anim.root, u, anim.loop, (k) => k.x), sampleKeys(anim.root, u, anim.loop, (k) => k.y)]
    : [0, 0];
  return { pose, move };
}

/** Blends two poses: `k` = 0 → a, 1 → b (angles by the shortest turn). For easing from one animation into the next. */
export function blendPose(a: { pose: Pose; move: Vec }, b: { pose: Pose; move: Vec }, k: number): { pose: Pose; move: Vec } {
  const pose: Pose = {};
  for (const id of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])) {
    const va = a.pose[id] ?? 0;
    pose[id] = va + angleDelta(va, b.pose[id] ?? 0) * k;
  }
  return { pose, move: [a.move[0] + (b.move[0] - a.move[0]) * k, a.move[1] + (b.move[1] - a.move[1]) * k] };
}

// ---------------------------------------------------------------------------------------------- reading rig.json

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isVec = (x: unknown): x is Vec => Array.isArray(x) && x.length === 2 && x.every(isNum);
const ID = /^[a-z0-9_]{1,40}$/;
const EASES: readonly Ease[] = ['linear', 'smooth', 'in', 'out'];

function readKeys(x: unknown, where: string, kind: 'rot' | 'move'): RotKey[] | MoveKey[] {
  if (!Array.isArray(x) || !x.length) throw new Error(`${where}: needs a list of keys`);
  let lastT = -1;
  return x.map((k, i) => {
    if (!isObj(k) || !isNum(k.t) || k.t < 0 || k.t > 1) throw new Error(`${where} key ${i}: t must be 0..1`);
    if (k.t < lastT) throw new Error(`${where} key ${i}: keys must be in time order`);
    lastT = k.t;
    if (k.e !== undefined && !EASES.includes(k.e as Ease)) throw new Error(`${where} key ${i}: unknown ease "${String(k.e)}"`);
    const e = k.e as Ease | undefined;
    if (kind === 'rot') {
      if (!isNum(k.r) || Math.abs(k.r) > 1080) throw new Error(`${where} key ${i}: r must be a number of degrees`);
      return e ? { t: k.t, r: k.r, e } : { t: k.t, r: k.r };
    }
    if (!isNum(k.x) || !isNum(k.y)) throw new Error(`${where} key ${i}: x and y must be numbers`);
    return e ? { t: k.t, x: k.x, y: k.y, e } : { t: k.t, x: k.x, y: k.y };
  }) as RotKey[] | MoveKey[];
}

function readView(x: unknown, name: string): RigViewDef {
  if (!isObj(x)) throw new Error(`view ${name}: missing`);
  if (!Array.isArray(x.bones) || !x.bones.length) throw new Error(`view ${name}: needs bones`);
  const ids = new Set<string>();
  const bones = x.bones.map((b, i): RigBoneDef => {
    if (!isObj(b) || typeof b.id !== 'string' || !ID.test(b.id)) throw new Error(`view ${name} bone ${i}: bad id`);
    if (ids.has(b.id)) throw new Error(`view ${name}: bone "${b.id}" twice`);
    ids.add(b.id);
    if (!isVec(b.pivot)) throw new Error(`bone ${b.id}: pivot must be [x, y]`);
    const out: RigBoneDef = { id: b.id, pivot: [b.pivot[0], b.pivot[1]] };
    if (b.parent !== undefined) {
      if (typeof b.parent !== 'string') throw new Error(`bone ${b.id}: bad parent`);
      out.parent = b.parent;
      if (!isVec(b.at)) throw new Error(`bone ${b.id}: at must be [x, y]`);
      out.at = [b.at[0], b.at[1]];
    }
    if (b.part !== undefined) {
      if (typeof b.part !== 'string' || (b.part !== '' && !/^[a-z0-9_]{1,40}$/.test(b.part))) throw new Error(`bone ${b.id}: bad part`);
      out.part = b.part;
    }
    if (b.rot !== undefined) {
      if (!isNum(b.rot)) throw new Error(`bone ${b.id}: rot must be a number`);
      out.rot = b.rot;
    }
    return out;
  });
  const roots = bones.filter((b) => b.parent === undefined);
  if (roots.length !== 1) throw new Error(`view ${name}: needs exactly one root bone (has ${roots.length})`);
  boneOrder(bones); // throws on loops and missing parents
  if (!Array.isArray(x.order) || !x.order.every((id) => typeof id === 'string' && ids.has(id))) {
    throw new Error(`view ${name}: order must list bone ids`);
  }
  if (new Set(x.order).size !== x.order.length) throw new Error(`view ${name}: a bone is in order twice`);
  if (!isVec(x.root)) throw new Error(`view ${name}: root must be [x, y]`);
  return { bones, order: x.order as string[], root: [x.root[0], x.root[1]] };
}

/** Reads and checks a rig file. Throws an Error that says what is wrong. */
export function parseRig(x: unknown): RigDef {
  if (!isObj(x)) throw new Error('rig: not an object');
  if (x.version !== 1) throw new Error('rig: unknown version');
  if (!isNum(x.pxPerUnit) || x.pxPerUnit <= 0) throw new Error('rig: pxPerUnit must be > 0');
  if (!isObj(x.views)) throw new Error('rig: missing views');
  const views = { front: readView(x.views.front, 'front'), back: readView(x.views.back, 'back') };
  if (!isObj(x.anims)) throw new Error('rig: missing anims');
  const boneIds = new Set([...views.front.bones, ...views.back.bones].map((b) => b.id));
  const anims: Record<string, RigAnim> = {};
  for (const [name, a] of Object.entries(x.anims)) {
    if (!ID.test(name)) throw new Error(`anim "${name.slice(0, 40)}": bad name`);
    if (!isObj(a) || !isNum(a.duration) || a.duration <= 0 || a.duration > 30) throw new Error(`anim ${name}: duration must be 0..30 s`);
    if (typeof a.loop !== 'boolean') throw new Error(`anim ${name}: loop must be true or false`);
    if (!isObj(a.tracks)) throw new Error(`anim ${name}: missing tracks`);
    const tracks: Record<string, RotKey[]> = {};
    for (const [bone, keys] of Object.entries(a.tracks)) {
      if (!boneIds.has(bone)) throw new Error(`anim ${name}: no bone "${bone.slice(0, 40)}"`);
      tracks[bone] = readKeys(keys, `anim ${name} bone ${bone}`, 'rot') as RotKey[];
    }
    const anim: RigAnim = { duration: a.duration, loop: a.loop, tracks };
    if (a.root !== undefined) anim.root = readKeys(a.root, `anim ${name} root`, 'move') as MoveKey[];
    anims[name] = anim;
  }
  return { version: 1, pxPerUnit: x.pxPerUnit, views, anims };
}

/** Which of the two drawn views shows a facing, and whether it is mirrored. Screen x right, y up (toward camera = -y). */
export function viewFor(sx: number, sy: number): { view: RigViewName; mirror: boolean } {
  // The pieces are drawn facing LEFT: facing right on screen is the same picture flipped.
  return { view: sy <= 0 ? 'front' : 'back', mirror: sx > 0.05 };
}
