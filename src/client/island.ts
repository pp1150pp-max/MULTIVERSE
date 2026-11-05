// What makes a zone look like a shattering island adrift in space: its broken outline, the starfield
// behind it, and the pieces floating away. Only pictures: walking and collision stay in Terrain.
import * as THREE from 'three';
import { mulberry32, type Rng } from '../shared/rng';

/** World units between samples of the outline. */
const OUTLINE_STEP = 1;
/** The land always reaches this far past the walkable square, so nobody walks over the edge. */
const MIN_LAND_PAST_BOUND = 2.2;

/**
 * Where a position `s` along the edge of a square lands, on a square of half size 1. Goes around
 * from (-1, 1): side 0 runs along z = 1, side 1 along x = 1, side 2 along z = -1, side 3 along x = -1.
 * The camera looks from the +x +z corner, so sides 0 and 1 are the ones facing it. `s` runs 0 to 8.
 */
function squarePoint(s: number): [number, number] {
  const t = ((s % 8) + 8) % 8;
  if (t < 2) return [t - 1, 1];
  if (t < 4) return [1, 3 - t];
  if (t < 6) return [5 - t, -1];
  return [-1, t - 7];
}

/** The inverse of squarePoint for any point other than the centre. */
function squarePosition(x: number, z: number): number {
  const n = Math.max(Math.abs(x), Math.abs(z));
  const ux = x / n;
  const uz = z / n;
  if (uz >= 1 - 1e-9) return ux + 1;
  if (ux >= 1 - 1e-9) return 3 - uz;
  if (uz <= -1 + 1e-9) return 5 - ux;
  return 7 + uz;
}

/** Smooth noise that repeats every `size` samples, so the outline closes without a seam. */
function loopNoise(r: Rng, size: number, knots: number): number[] {
  const k = Array.from({ length: knots }, () => r());
  return Array.from({ length: size }, (_, i) => {
    const f = (i / size) * knots;
    const a = Math.floor(f);
    const t = f - a;
    const s = t * t * (3 - 2 * t);
    return k[a % knots] * (1 - s) + k[(a + 1) % knots] * s;
  });
}

/** The broken shoreline of the island, used by the ground, cliffs, props and maps alike. */
export class IslandOutline {
  /** How far in from the zone's square the shore sits, at each sample around it. */
  private readonly inset: number[];
  /** 0 to 1 around the zone: where the rim forest thins out. */
  private readonly thin: number[];
  readonly count: number;

  constructor(readonly half: number, bound: number, seed: number) {
    const r = mulberry32(seed);
    this.count = Math.round((8 * half) / OUTLINE_STEP);
    const n = this.count;
    const most = half - bound - MIN_LAND_PAST_BOUND;
    const wide = loopNoise(r, n, 13);
    const mid = loopNoise(r, n, 53);
    const fine = loopNoise(r, n, 170);
    this.thin = loopNoise(r, n, 17);
    this.inset = Array.from({ length: n }, (_, i) => {
      const toCorner = Math.abs(((i / n) * 8) % 2 - 1);
      const corner = Math.max(0, toCorner * 6 - 5);
      const shape = wide[i] * 0.3 + mid[i] * 0.3 + fine[i] * 0.3 + r() * 0.08 + corner * 0.3;
      return shape * most;
    });
    // Chunks already gone from the shore: steep-sided bites, so no stretch of it reads as a straight line.
    for (let bite = 0; bite < 64; bite++) {
      const centre = Math.floor(r() * n);
      const reach = Math.floor(1 + r() * 4);
      const depth = (0.55 + r() * 0.45) * most;
      for (let d = -reach - 1; d <= reach + 1; d++) {
        const i = (centre + d + n) % n;
        this.inset[i] = Math.max(this.inset[i], Math.abs(d) > reach ? depth * 0.55 : depth);
      }
    }
    for (let i = 0; i < n; i++) this.inset[i] = Math.max(0, Math.min(most, this.inset[i]));
  }

  private sample(values: number[], s: number): number {
    const f = ((((s / 8) % 1) + 1) % 1) * this.count;
    const a = Math.floor(f) % this.count;
    const t = f - Math.floor(f);
    return values[a] * (1 - t) + values[(a + 1) % this.count] * t;
  }

  /** The shore at position `s` (0 to 8, see squarePoint), pushed out by `past` world units. */
  at(s: number, past = 0): [number, number] {
    const reach = this.half - this.sample(this.inset, s) + past;
    const [x, z] = squarePoint(s);
    return [x * reach, z * reach];
  }

  /** Is this point on land, at least `margin` from the shore? */
  contains(x: number, z: number, margin = 0): boolean {
    const n = Math.max(Math.abs(x), Math.abs(z));
    if (n < 1e-6) return true;
    return n + margin < this.half - this.sample(this.inset, squarePosition(x, z));
  }

  /** Where the forest around the rim should be sparse. Higher means thinner. */
  sparseness(x: number, z: number): number {
    return this.sample(this.thin, squarePosition(x, z));
  }

  /** The shore's points in order, as many as `count`. */
  points(): [number, number][] {
    return Array.from({ length: this.count }, (_, i) => this.at((i / this.count) * 8));
  }

  /**
   * The land itself: a fan from the middle out to a ring just inside the shore, then a strip to the
   * shore. `aEdge` is 0 on the shore and 1 at the inner ring, so the ground can crumble toward it.
   */
  groundGeometry(): THREE.BufferGeometry {
    const pts = this.points();
    const n = pts.length;
    const H = this.half;
    const positions: number[] = [0, 0, 0];
    const edge: number[] = [1];
    const uvs: number[] = [0.5, 0.5];
    const push = (x: number, z: number, e: number) => {
      positions.push(x, 0, z);
      edge.push(e);
      uvs.push((x + H) / (2 * H), (z + H) / (2 * H));
    };
    for (const [x, z] of pts) {
      const k = 1 - 1.4 / Math.max(Math.abs(x), Math.abs(z));
      push(x * k, z * k, 1);
    }
    for (const [x, z] of pts) push(x, z, 0);
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      index.push(0, 1 + i, 1 + j);
      index.push(1 + i, 1 + n + i, 1 + n + j, 1 + i, 1 + n + j, 1 + j);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
    geo.setIndex(index);
    return geo;
  }
}

// ------------------------------------------------------------ the sky

const SPACE_TILE = 512;
/** The darkest colour of space, for anything drawn past the edge of the map picture. */
export const SPACE_COLOUR = '#070517';
/** Colours of the nebula, darkest first. */
const SPACE_BANDS = ['#070517', '#0b0720', '#110a2c', '#1a0f3c', '#26144c', '#351a5c', '#47226a'];
let spaceTile: HTMLCanvasElement | null = null;

/** Value noise that repeats across the tile. */
function tileNoise(r: Rng, cells: number): (x: number, y: number) => number {
  const grid = Array.from({ length: cells * cells }, () => r());
  return (x, y) => {
    const fx = x * cells;
    const fy = y * cells;
    const ax = Math.floor(fx);
    const ay = Math.floor(fy);
    const tx = fx - ax;
    const ty = fy - ay;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const at = (i: number, j: number) => grid[((j + cells) % cells) * cells + ((i + cells) % cells)];
    const top = at(ax, ay) * (1 - sx) + at(ax + 1, ay) * sx;
    const bottom = at(ax, ay + 1) * (1 - sx) + at(ax + 1, ay + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}

/**
 * Stars and a violet nebula in hard bands with a dither between them, repeating in both directions.
 * Painted once: every zone drifts in this same space.
 */
export function paintSpace(): HTMLCanvasElement {
  if (spaceTile) return spaceTile;
  const r = mulberry32(90210);
  const cv = document.createElement('canvas');
  cv.width = cv.height = SPACE_TILE;
  const ctx = cv.getContext('2d')!;
  const big = tileNoise(r, 3);
  const midN = tileNoise(r, 7);
  const small = tileNoise(r, 19);
  const tiny = tileNoise(r, 47);
  const bands = SPACE_BANDS.map((c) => new THREE.Color(c).convertLinearToSRGB());
  const image = ctx.createImageData(SPACE_TILE, SPACE_TILE);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < SPACE_TILE; y++) {
    for (let x = 0; x < SPACE_TILE; x++) {
      const u = x / SPACE_TILE;
      const v = y / SPACE_TILE;
      const n = big(u, v) * 0.5 + midN(u, v) * 0.28 + small(u, v) * 0.15 + tiny(u, v) * 0.07;
      const level = Math.max(0, (n - 0.4) * 2.6) ** 1.5 * (bands.length - 1);
      const dither = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
      const c = bands[Math.min(bands.length - 1, Math.floor(level + dither))];
      const i = (y * SPACE_TILE + x) * 4;
      image.data[i] = c.r * 255;
      image.data[i + 1] = c.g * 255;
      image.data[i + 2] = c.b * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const star = (x: number, y: number, colour: string, size: 1 | 2 | 3) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, 1, 1);
    if (size === 1) return;
    ctx.globalAlpha = 0.55;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect(x + dx, y + dy, 1, 1);
    ctx.globalAlpha = 0.25;
    if (size === 3) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) ctx.fillRect(x + dx, y + dy, 1, 1);
    ctx.globalAlpha = 1;
  };
  const margin = (m: number) => m + Math.floor(r() * (SPACE_TILE - 2 * m));
  for (let i = 0; i < 620; i++) star(margin(0), margin(0), ['#8d88b8', '#6f6a9c', '#b3b0d6'][(r() * 3) | 0], 1);
  for (let i = 0; i < 46; i++) star(margin(3), margin(3), ['#ffffff', '#bfe9ff', '#ffe9b0'][(r() * 3) | 0], 2);
  for (let i = 0; i < 11; i++) star(margin(3), margin(3), ['#ffffff', '#9fe6ff', '#ffdc8a'][(r() * 3) | 0], 3);
  spaceTile = cv;
  return cv;
}

// ------------------------------------------------------------ floating pieces

const DEBRIS_VERT = /* glsl */ `
  attribute vec2 aCorner;
  attribute vec4 aPath;   // position around the island (0 to 8), distance past the shore square, height, speed
  attribute vec4 aSpin;   // start angle, turn rate, bob phase, bob height
  attribute vec2 aFall;   // drop speed, drop distance (0 = this piece doesn't fall)
  uniform float uTime, uHalf;
  uniform vec3 uRight, uUp;
  varying vec2 vUv;

  vec2 squarePoint(float s) {
    float t = mod(s, 8.0);
    if (t < 2.0) return vec2(t - 1.0, 1.0);
    if (t < 4.0) return vec2(1.0, 3.0 - t);
    if (t < 6.0) return vec2(5.0 - t, -1.0);
    return vec2(-1.0, t - 7.0);
  }

  void main() {
    vUv = uv;
    float reach = uHalf + aPath.y;
    vec2 flat_ = squarePoint(aPath.x + uTime * aPath.w / reach) * reach;
    float y = aPath.z + sin(uTime * 0.5 + aSpin.z) * aSpin.w;
    vec2 corner = aCorner;
    if (aFall.y > 0.0) {
      float d = mod(uTime * aFall.x + aSpin.z * aFall.y, aFall.y);
      y -= d;
      // Small pieces shrink away as they fall, so they never pop out of sight.
      corner *= 1.0 - d / aFall.y;
    }
    float a = aSpin.x + uTime * aSpin.y;
    float c = cos(a);
    float s = sin(a);
    vec2 q = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
    vec3 world = vec3(flat_.x, y, flat_.y) + uRight * q.x + uUp * q.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const DEBRIS_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uGlow;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (uGlow > 0.5) {
      gl_FragColor = vec4(vec3(0.72, 0.86, 1.0) * c.rgb, c.a * 0.24);
    } else {
      if (c.a < 0.5) discard;
      gl_FragColor = vec4(c.rgb, 1.0);
    }
    #include <colorspace_fragment>
  }
`;

/** One floating piece. Built up by addPiece, then turned into a mesh by build. */
export interface Piece {
  /** Position around the island, 0 to 8 (see squarePoint). */
  s: number;
  /** World units past the zone's square. Negative pieces sit inside its corners' reach. */
  past: number;
  y: number;
  /** World units a second around the island. */
  speed: number;
  /** Half width and half height. */
  w: number;
  h: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  spin?: number;
  turn?: number;
  bob?: number;
  fall?: [number, number];
}

/** Many floating pieces from one atlas as one mesh: the vertex shader moves them all for one draw call. */
export class PieceBatch {
  private readonly pos: number[] = [];
  private readonly uv: number[] = [];
  private readonly corner: number[] = [];
  private readonly path: number[] = [];
  private readonly spin: number[] = [];
  private readonly fall: number[] = [];

  constructor(private readonly r: Rng) {}

  add(p: Piece): void {
    const phase = this.r() * Math.PI * 2;
    for (const [cx, cy, u, v] of [[-1, -1, p.u0, p.v0], [1, -1, p.u1, p.v0], [1, 1, p.u1, p.v1], [-1, 1, p.u0, p.v1]]) {
      // The shader works out the real position; this only keeps three.js happy.
      this.pos.push(0, 0, 0);
      this.uv.push(u, v);
      this.corner.push(cx * p.w, cy * p.h);
      this.path.push(p.s, p.past, p.y, p.speed);
      this.spin.push(p.spin ?? 0, p.turn ?? 0, phase, p.bob ?? 0);
      this.fall.push(p.fall?.[0] ?? 0, p.fall?.[1] ?? 0);
    }
  }

  build(map: THREE.Texture, uniforms: Record<string, THREE.IUniform>, glow: boolean): { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial } {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('aCorner', new THREE.Float32BufferAttribute(this.corner, 2));
    geo.setAttribute('aPath', new THREE.Float32BufferAttribute(this.path, 4));
    geo.setAttribute('aSpin', new THREE.Float32BufferAttribute(this.spin, 4));
    geo.setAttribute('aFall', new THREE.Float32BufferAttribute(this.fall, 2));
    const index: number[] = [];
    for (let i = 0; i < this.pos.length / 12; i++) {
      const v = i * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    geo.setIndex(index);
    const mat = new THREE.ShaderMaterial({
      vertexShader: DEBRIS_VERT,
      fragmentShader: DEBRIS_FRAG,
      uniforms: { ...uniforms, uMap: { value: map }, uGlow: { value: glow ? 1 : 0 } },
      side: THREE.DoubleSide,
      ...(glow ? { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } : {}),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return { mesh, geo, mat };
  }
}

/** Pick a distance past the shore: most pieces hang close to the island, a few far out. */
export function closeBias(r: Rng, near: number, far: number): number {
  const t = r();
  return near + (far - near) * t * t;
}

