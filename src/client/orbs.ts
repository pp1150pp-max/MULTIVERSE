// Enhancement orbs: one small orb circling a character for each worn item at +7 or higher (orbCodes in
// src/shared/data/enhance.ts). Drawn on top of the enhancement aura, for every player on screen.
//
// Cheap on purpose (many players, up to 10 orbs each): every character gets two THREE.Points (one for
// the solid orbs, one additive for halos, trails and sparks) with buffers sized once, shared materials,
// and motion worked out from the clock (no per-frame allocations, no history to keep).
import * as THREE from 'three';
import { orbPlus, orbSlot } from '../shared/data/enhance';
import { EQUIP_SLOTS } from '../shared/types';

/** How an orb of one + level looks. Sizes are in world units (the player is about 1.9 tall). */
export interface OrbLevel {
  /** Orb diameter. */
  size: number;
  /** Halo diameter and opacity. */
  glow: number;
  glowAlpha: number;
  /** Trail dots following the orb (0 = none). */
  trail: number;
  /** Sparks drifting up from the orb (0 = none). */
  particles: number;
  /** Orb picture: 0 plain, 1 energy band, 2 star core, 3 star core with rays. */
  detail: number;
}

/** Index = + level. Only +7 to +15 are used. */
export const ORB_LEVELS: Record<number, OrbLevel> = {
  7: { size: 0.2, glow: 0.55, glowAlpha: 0.35, trail: 0, particles: 0, detail: 0 },
  8: { size: 0.23, glow: 0.65, glowAlpha: 0.4, trail: 0, particles: 0, detail: 0 },
  9: { size: 0.26, glow: 0.75, glowAlpha: 0.45, trail: 0, particles: 0, detail: 0 },
  10: { size: 0.29, glow: 0.9, glowAlpha: 0.5, trail: 0, particles: 2, detail: 0 },
  11: { size: 0.32, glow: 1.0, glowAlpha: 0.55, trail: 0, particles: 3, detail: 1 },
  12: { size: 0.35, glow: 1.2, glowAlpha: 0.7, trail: 0, particles: 5, detail: 1 },
  13: { size: 0.39, glow: 1.35, glowAlpha: 0.75, trail: 4, particles: 6, detail: 2 },
  14: { size: 0.43, glow: 1.55, glowAlpha: 0.85, trail: 5, particles: 7, detail: 2 },
  15: { size: 0.48, glow: 1.8, glowAlpha: 0.95, trail: 7, particles: 9, detail: 3 },
};
const MAX_TRAIL = 7;
const MAX_PARTICLES = 9;
const MAX_ORBS = EQUIP_SLOTS.length;

/** Tuning knobs (the preview page changes them; the game keeps the defaults). */
export const orbTuning = {
  /** Multiplies every orb, halo and spark size. */
  scale: 1,
  /** Orbit radius around the character's feet. */
  radius: 0.95,
  /** Turns per second of the whole ring. */
  speed: 0.17,
};

// ------------------------------------------------------------ palettes

/** Colors of one orb: the body, a light accent (energy band, star), and the halo. */
interface OrbColors { core: string; accent: string; glow: string }

export interface OrbPalette {
  id: string;
  /** Shown on the preview page. */
  name: string;
  colors(slot: number, plus: number): OrbColors;
}

/** Mixes two #rrggbb colors; k = 0 → a, 1 → b. */
function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  let out = 0;
  for (const sh of [16, 8, 0]) {
    const ca = (pa >> sh) & 255;
    const cb = (pb >> sh) & 255;
    out |= Math.round(ca + (cb - ca) * k) << sh;
  }
  return `#${out.toString(16).padStart(6, '0')}`;
}

/** 0 at +7, 1 at +15. */
const lvK = (plus: number): number => Math.max(0, Math.min(1, (plus - 7) / 8));

/** A palette that shifts from a low-level look to a high-level look. */
function graded(id: string, name: string, lo: OrbColors, hi: OrbColors): OrbPalette {
  return {
    id, name,
    colors: (_slot, plus) => {
      const k = lvK(plus);
      return { core: mix(lo.core, hi.core, k), accent: mix(lo.accent, hi.accent, k), glow: mix(lo.glow, hi.glow, k) };
    },
  };
}

/** One color per worn place, in EQUIP_SLOTS order (weapon, offhand, helmet, necklace, armor, gloves, belt, boots, ring, ring2). */
const SLOT_COLORS = ['#ff5a4a', '#ff9a2e', '#ffd34a', '#7ee05a', '#3fc8b0', '#4fa0ff', '#6a6cff', '#c56dff', '#ff6fc8', '#e8e8f8'];

/** Matches the aura's tiers: blue at +7, violet at +10, orange at +13, gold at +15. */
const AURA_STEPS: [number, string][] = [[7, '#6fb8ff'], [10, '#c56dff'], [13, '#ff9a2e'], [15, '#ffd34a']];
function auraColor(plus: number): string {
  for (let i = AURA_STEPS.length - 1; i >= 0; i--) {
    const [lv, c] = AURA_STEPS[i];
    if (plus >= lv) {
      const next = AURA_STEPS[i + 1];
      return next ? mix(c, next[1], (plus - lv) / (next[0] - lv) * 0.5) : c;
    }
  }
  return AURA_STEPS[0][1];
}

export const ORB_PALETTES: OrbPalette[] = [
  graded('arcane', 'Arcane ฟ้า/ม่วง',
    { core: '#4f8cff', accent: '#d8f0ff', glow: '#3f7cff' },
    { core: '#a65cff', accent: '#ffe0ff', glow: '#b060ff' }),
  graded('holy', 'Holy ทอง',
    { core: '#d9a02e', accent: '#fff6c8', glow: '#ffbf3a' },
    { core: '#ffe27a', accent: '#ffffff', glow: '#fff09a' }),
  graded('fire', 'Fire แดง/ส้ม',
    { core: '#b8261e', accent: '#ffc070', glow: '#ff3a1a' },
    { core: '#ff7a1a', accent: '#fff0a0', glow: '#ffa030' }),
  {
    id: 'slot', name: 'สีตามช่องที่สวม',
    colors: (slot, plus) => {
      const c = SLOT_COLORS[slot] ?? '#ffffff';
      return { core: mix(c, '#000000', 0.15 * (1 - lvK(plus))), accent: mix(c, '#ffffff', 0.75), glow: c };
    },
  },
  {
    id: 'tier', name: 'ไล่สีตามระดับ (เข้ากับออร่า)',
    colors: (_slot, plus) => {
      const c = auraColor(plus);
      return { core: c, accent: mix(c, '#ffffff', 0.75), glow: c };
    },
  },
];

let palette = ORB_PALETTES[0];
/** Bumped when the palette changes, so every ring repaints. */
let paletteVer = 0;

export function orbPalette(): OrbPalette {
  return palette;
}

export function setOrbPalette(id: string): void {
  const p = ORB_PALETTES.find((x) => x.id === id);
  if (!p || p === palette) return;
  palette = p;
  paletteVer++;
}

/** Writes a #rrggbb color as 0..1 sRGB values (the shaders write them to the screen as they are). */
function putRgb(arr: Float32Array, i: number, hex: string): void {
  const n = parseInt(hex.slice(1), 16);
  arr[i] = ((n >> 16) & 255) / 255;
  arr[i + 1] = ((n >> 8) & 255) / 255;
  arr[i + 2] = (n & 255) / 255;
}

// ------------------------------------------------------------ textures and materials

const ORB_PX = 16;

/**
 * Four 16×16 pixel-art orbs side by side, one per `detail`. Channels are masks the shader colors in:
 * R = shading (0 = dark outline), G = white highlight, B = accent color, A = solid.
 */
function orbAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = ORB_PX * 4;
  c.height = ORB_PX;
  const g = c.getContext('2d')!;
  const img = g.createImageData(c.width, c.height);
  for (let d = 0; d < 4; d++) {
    // The +15 orb is a little smaller in its cell so its rays fit.
    const r = d === 3 ? 5.5 : 6.5;
    for (let y = 0; y < ORB_PX; y++) {
      for (let x = 0; x < ORB_PX; x++) {
        const dx = x + 0.5 - ORB_PX / 2;
        const dy = y + 0.5 - ORB_PX / 2;
        const dist = Math.hypot(dx, dy);
        let a = 0, sh = 0, hi = 0, ac = 0;
        if (dist <= r + 1) {
          a = 255;
          if (dist > r) sh = 0; // outline
          else {
            // Light from the top left, in three flat bands (16-bit style, no smooth gradient).
            const l = (-dx - dy) / (r * 2) + 0.5 - dist / (r * 3);
            sh = l > 0.45 ? 1 : l > 0.1 ? 0.72 : 0.45;
            if (Math.hypot(dx + r * 0.4, dy + r * 0.4) < r * 0.28) hi = 1;
            if (d === 1 && Math.abs(dy - dx * 0.35) < 0.9 && dist < r - 0.5) ac = 1; // energy band
            if (d >= 2 && ((Math.abs(dx) < 0.6 && Math.abs(dy) < 2.6) || (Math.abs(dy) < 0.6 && Math.abs(dx) < 2.6))) ac = 1; // star core
            if (d >= 2 && dist < 1.2) hi = 1;
          }
        } else if (d === 3 && ((Math.abs(dx) < 0.6 && dist < 8) || (Math.abs(dy) < 0.6 && dist < 8))) {
          a = 255; ac = 1; hi = 0.5; // rays
        }
        const o = (y * c.width + d * ORB_PX + x) * 4;
        img.data[o] = sh * 255;
        img.data[o + 1] = hi * 255;
        img.data[o + 2] = ac * 255;
        img.data[o + 3] = a;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return pixelTex(c);
}

/** Two 16×16 cells: a banded halo (like the game's glow) and a small plus-shaped spark. Alpha only. */
function glowAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 16;
  const g = c.getContext('2d')!;
  const img = g.createImageData(32, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      const d = Math.hypot(dx, dy) / 8;
      const halo = d <= 0.3 ? 1 : d <= 0.55 ? 0.6 : d <= 0.78 ? 0.28 : d <= 1 ? 0.1 : 0;
      const spark = (Math.abs(dx) < 2 && Math.abs(dy) < 6) || (Math.abs(dy) < 2 && Math.abs(dx) < 6) ? (Math.abs(dx) < 2 && Math.abs(dy) < 2 ? 1 : 0.6) : 0;
      for (const [cell, v] of [[0, halo], [1, spark]] as const) {
        const o = (y * 32 + cell * 16 + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = v * 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return pixelTex(c);
}

function pixelTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

/** Drawing-buffer height in pixels, so point sizes can be given in world units (orthographic camera). */
const screenH = { value: 1080 };
const bufSize = new THREE.Vector2();

// gl_PointSize from a world size: projectionMatrix[1][1] = 2 / (view height in world units).
const POINT_SIZE = 'gl_PointSize = max(1.0, floor(size * projectionMatrix[1][1] * uScreenH * 0.5));';

let coreMat: THREE.ShaderMaterial | null = null;
let glowMat: THREE.ShaderMaterial | null = null;

function materials(): [THREE.ShaderMaterial, THREE.ShaderMaterial] {
  coreMat ??= new THREE.ShaderMaterial({
    uniforms: { map: { value: orbAtlas() }, uScreenH: screenH },
    vertexShader: `
      attribute vec3 color; attribute vec3 accent; attribute float size; attribute float detail;
      uniform float uScreenH;
      varying vec3 vColor; varying vec3 vAccent; varying float vDetail;
      void main() {
        vColor = color; vAccent = accent; vDetail = detail;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        ${POINT_SIZE}
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying vec3 vColor; varying vec3 vAccent; varying float vDetail;
      void main() {
        vec4 t = texture2D(map, vec2((gl_PointCoord.x + vDetail) / 4.0, 1.0 - gl_PointCoord.y));
        if (t.a < 0.5) discard;
        vec3 c = vColor * (0.3 + 0.9 * t.r);
        c = mix(c, vAccent, t.b);
        c = mix(c, vec3(1.0), t.g);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  glowMat ??= new THREE.ShaderMaterial({
    uniforms: { map: { value: glowAtlas() }, uScreenH: screenH },
    vertexShader: `
      attribute vec3 color; attribute float size; attribute float alpha; attribute float kind;
      uniform float uScreenH;
      varying vec3 vColor; varying float vAlpha; varying float vKind;
      void main() {
        vColor = color; vAlpha = alpha; vKind = kind;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        ${POINT_SIZE}
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying vec3 vColor; varying float vAlpha; varying float vKind;
      void main() {
        float a = texture2D(map, vec2((gl_PointCoord.x + vKind) / 2.0, 1.0 - gl_PointCoord.y)).a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return [coreMat, glowMat];
}

function points(cap: number, mat: THREE.ShaderMaterial, attrs: Record<string, number>): THREE.Points {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
  for (const [name, n] of Object.entries(attrs)) {
    geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage));
  }
  // The points sit around the object's origin (the character's feet): a fixed sphere lets off-screen rings be skipped.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 3.5);
  geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, mat);
  pts.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(bufSize);
    screenH.value = bufSize.y;
  };
  return pts;
}

// ------------------------------------------------------------ one character's ring

const TAU = Math.PI * 2;
/** Each orb's base height above the feet, by its place in the ring (neighbours differ so they never stack). */
const HEIGHTS = [1.05, 1.4, 0.75];
const GLOW_PER_ORB = 1 + MAX_TRAIL + MAX_PARTICLES;

/** Base height of orb `i` of `n`: neighbours (including last → first around the ring) never share one. */
function heightIndex(i: number, n: number): number {
  return n % 3 === 1 && i === n - 1 ? 1 : i % 3;
}

/**
 * Where orb `i` of `n` is, relative to the character's feet, at time `t` (seconds). `phase` makes
 * each character's ring start differently. Pure, so it can be checked without a browser.
 */
export function orbOffset(i: number, n: number, t: number, phase: number, out: THREE.Vector3): THREE.Vector3 {
  const spacing = TAU / n;
  const ph = phase + i * 1.7;
  // One shared turn keeps the ring evenly spaced; each orb sways a little ahead and behind its place at
  // its own rate, so they don't move as one rigid wheel. The sway shrinks as the ring fills up, so
  // neighbours never touch (checked for 2–10 orbs at +15).
  const sway = n > 1 ? Math.sin(t * (0.9 + 0.23 * i) + ph) * spacing * SWAY[Math.min(n, 10)] : 0;
  const a = t * orbTuning.speed * TAU + i * spacing + sway;
  const r = orbTuning.radius * (1 + 0.06 * Math.sin(t * 0.7 + ph));
  const y = HEIGHTS[heightIndex(i, n)] + Math.sin(t * (1.6 + 0.19 * i) + ph) * 0.09;
  return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
}
/** Sway (share of the gap between orbs) by orb count. */
const SWAY = [0, 0, 0.22, 0.22, 0.2, 0.18, 0.15, 0.13, 0.11, 0.09, 0.08];

/** Small deterministic hash → 0..1. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** The orbs around one character. Rebuilds its colors only when the orb list or palette changes. */
export class OrbRing {
  private readonly core: THREE.Points;
  private readonly glow: THREE.Points;
  private codes: readonly number[] = [];
  private paletteVer = -1;
  private n = 0;
  private readonly levels: OrbLevel[] = [];
  /** Per orb: core, accent and glow colors (9 floats). */
  private readonly cols = new Float32Array(MAX_ORBS * 9);
  private readonly phase: number;
  private readonly v = new THREE.Vector3();
  /** Glow points written so far this frame. */
  private g = 0;
  private readonly cBuf: Record<'cPos' | 'cCol' | 'cAcc' | 'cSize' | 'cDet', Float32Array>;
  private readonly gBuf: Record<'gPos' | 'gCol' | 'gSize' | 'gA' | 'gKind', Float32Array>;

  constructor(private readonly scene: THREE.Scene, seed = Math.random() * 1000) {
    const [cm, gm] = materials();
    this.core = points(MAX_ORBS, cm, { color: 3, accent: 3, size: 1, detail: 1 });
    this.glow = points(MAX_ORBS * GLOW_PER_ORB, gm, { color: 3, size: 1, alpha: 1, kind: 1 });
    this.phase = seed;
    const ca = (name: string) => this.core.geometry.attributes[name].array as Float32Array;
    const ga = (name: string) => this.glow.geometry.attributes[name].array as Float32Array;
    this.cBuf = { cPos: ca('position'), cCol: ca('color'), cAcc: ca('accent'), cSize: ca('size'), cDet: ca('detail') };
    this.gBuf = { gPos: ga('position'), gCol: ga('color'), gSize: ga('size'), gA: ga('alpha'), gKind: ga('kind') };
    this.core.visible = this.glow.visible = false;
    scene.add(this.core, this.glow);
  }

  private setCodes(codes: readonly number[]): void {
    this.codes = codes;
    this.paletteVer = paletteVer;
    this.n = Math.min(MAX_ORBS, codes.length);
    for (let i = 0; i < this.n; i++) {
      const plus = Math.max(7, Math.min(15, orbPlus(codes[i])));
      this.levels[i] = ORB_LEVELS[plus];
      const c = palette.colors(orbSlot(codes[i]), plus);
      putRgb(this.cols, i * 9, c.core);
      putRgb(this.cols, i * 9 + 3, c.accent);
      putRgb(this.cols, i * 9 + 6, c.glow);
    }
  }

  private sameCodes(codes: readonly number[]): boolean {
    const cur = this.codes;
    if (cur === codes) return true;
    if (cur.length !== codes.length) return false;
    for (let i = 0; i < cur.length; i++) if (cur[i] !== codes[i]) return false;
    return true;
  }

  private orbAt(i: number, t: number, out: THREE.Vector3): THREE.Vector3 {
    return orbOffset(i, this.n, t, this.phase, out);
  }

  /** `codes` = the player's orbs (Player.orbs); `show` false hides the whole ring (e.g. dead). */
  update(t: number, x: number, z: number, codes: readonly number[], show: boolean): void {
    if (!this.sameCodes(codes) || this.paletteVer !== paletteVer) this.setCodes(codes);
    const on = show && this.n > 0;
    this.core.visible = this.glow.visible = on;
    if (!on) return;
    this.core.position.set(x, 0, z);
    this.glow.position.set(x, 0, z);

    const sc = orbTuning.scale;
    const { cPos, cCol, cAcc, cSize, cDet } = this.cBuf;
    const v = this.v;
    this.g = 0;

    for (let i = 0; i < this.n; i++) {
      const L = this.levels[i];
      const o = i * 9;
      this.orbAt(i, t, v);
      cPos[i * 3] = v.x; cPos[i * 3 + 1] = v.y; cPos[i * 3 + 2] = v.z;
      for (let k = 0; k < 3; k++) {
        cCol[i * 3 + k] = this.cols[o + k];
        cAcc[i * 3 + k] = this.cols[o + 3 + k];
      }
      cSize[i] = L.size * sc;
      cDet[i] = L.detail;

      // Halo, breathing slowly.
      const pulse = 1 + 0.1 * Math.sin(t * 3 + this.phase + i);
      this.glowPoint(v.x, v.y, v.z, o + 6, L.glow * sc * pulse, L.glowAlpha, 0);

      // Trail: where the orb was a moment ago, smaller and fainter.
      for (let j = 1; j <= L.trail; j++) {
        this.orbAt(i, t - j * 0.045, v);
        const k = 1 - j / (L.trail + 1);
        this.glowPoint(v.x, v.y, v.z, o + 6, L.size * sc * (0.5 + 0.9 * k), 0.75 * k, 0);
      }

      // Sparks: each one lives SPARK_LIFE seconds, starts where the orb was, then drifts up and fades.
      for (let j = 0; j < L.particles; j++) {
        const cyc = t / SPARK_LIFE + j / L.particles + hash(i * 13 + j);
        const age = cyc - Math.floor(cyc);
        const seed = Math.floor(cyc) * 31 + i * 7 + j;
        this.orbAt(i, t - age * SPARK_LIFE, v);
        const jx = (hash(seed) - 0.5) * L.size * 1.4;
        const jz = (hash(seed + 0.5) - 0.5) * L.size * 1.4;
        this.glowPoint(v.x + jx, v.y + age * 0.45, v.z + jz, o + 3, 0.14 * sc * (1 - age * 0.6), 1 - age, 1);
      }
    }

    const cg = this.core.geometry;
    const gg = this.glow.geometry;
    cg.setDrawRange(0, this.n);
    gg.setDrawRange(0, this.g);
    for (const name of CORE_ATTRS) markRange(cg, name, this.n);
    for (const name of GLOW_ATTRS) markRange(gg, name, this.g);
  }

  private glowPoint(px: number, py: number, pz: number, ci: number, size: number, alpha: number, kind: number): void {
    const { gPos, gCol, gSize, gA, gKind } = this.gBuf;
    const g = this.g++;
    gPos[g * 3] = px; gPos[g * 3 + 1] = py; gPos[g * 3 + 2] = pz;
    gCol[g * 3] = this.cols[ci]; gCol[g * 3 + 1] = this.cols[ci + 1]; gCol[g * 3 + 2] = this.cols[ci + 2];
    gSize[g] = size; gA[g] = alpha; gKind[g] = kind;
  }

  dispose(): void {
    this.scene.remove(this.core, this.glow);
    this.core.geometry.dispose();
    this.glow.geometry.dispose();
  }
}

const SPARK_LIFE = 0.9;
const CORE_ATTRS = ['position', 'color', 'accent', 'size', 'detail'];
const GLOW_ATTRS = ['position', 'color', 'size', 'alpha', 'kind'];

/** Uploads only the first `count` entries of an attribute this frame. */
function markRange(geo: THREE.BufferGeometry, name: string, count: number): void {
  const a = geo.attributes[name] as THREE.BufferAttribute;
  a.clearUpdateRanges();
  a.addUpdateRange(0, count * a.itemSize);
  a.needsUpdate = true;
}
