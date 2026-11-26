// Floor 2's cloud sea behind the land (docs/systems/shaders.md, FLOOR2_SKY.md), drawn from the owner's paper pictures
// while the water effects are on. Low: the tile as the scene's background, drifting on its own. High: our own full
// screen sheet (the tile with its edges bending a little) with loose clouds floating over it. Off: World keeps the
// code-painted sky as it was.
import * as THREE from 'three';
import type { SkyMood } from './assets';
import type { ZoneTheme } from '../shared/data/zones';
import { mulberry32 } from '../shared/rng';
import { frac, noiseTexture } from './waterFx';

/** The ghost ships and the maelstrom lie under a storm at night, the rest of floor 2 under a day sky (FLOOR2_SKY.md). */
export const skyMood = (theme: ZoneTheme): SkyMood => (theme === 'grave' || theme === 'kraken' ? 'storm' : 'day');

/** Screen pixels one repeat of the tile covers (the same as the code-painted sky). */
const TILE_PX = 1024;
/** How fast the tile drifts on its own, screen pixels a second (× /admin's cloudDrift). */
const DRIFT = 5;
/** Loose clouds, laid out on a loose grid so they don't bunch up. */
const COLS = 5;
const ROWS = 3;
/** One cell of the cloud atlas (4 × 2), in pixels. */
const CELL_W = 384;
const CELL_H = 320;
/** The loose clouds are nearer than the sea: they slide this much faster as the player walks. */
const CLOUD_PARALLAX = 1.75;

const SEA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SEA_FRAG = /* glsl */ `
  uniform sampler2D uSky, uNoise;
  uniform vec2 uRepeat, uOffset, uShift;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv * uRepeat + uOffset;
    // The torn edges swell and shrink a little.
    vec2 bend = texture2D(uNoise, uv * 0.9 + uShift).rg - 0.5;
    gl_FragColor = texture2D(uSky, uv + bend * 0.012);
    #include <colorspace_fragment>
  }
`;

const CLOUD_VERT = /* glsl */ `
  attribute vec2 aStart;  // where in the field, 0–1
  attribute vec3 aInfo;   // atlas cell, size, speed
  uniform vec2 uScreen, uWalk;
  uniform float uDrift;
  varying vec2 vUv;
  void main() {
    vec2 size = vec2(${CELL_W}.0, ${CELL_H}.0) * aInfo.y;
    // Wraps once the whole cloud is off the screen.
    vec2 field = uScreen + size * 2.0;
    vec2 at = mod(aStart * field - uWalk - vec2(uDrift * aInfo.z, 0.0), field) - size;
    gl_Position = vec4((at + position.xy * size) / uScreen * 2.0 - 1.0, 0.0, 1.0);
    vUv = (vec2(mod(aInfo.x, 4.0), 1.0 - floor(aInfo.x / 4.0)) + position.xy) / vec2(4.0, 2.0);
  }
`;

const CLOUD_FRAG = /* glsl */ `
  uniform sampler2D uClouds;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uClouds, vUv);
    if (c.a < 0.02) discard;
    gl_FragColor = c;
    #include <colorspace_fragment>
  }
`;

function cloudGeometry(seed: number): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const pos: number[] = [];
  const start: number[] = [];
  const info: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < COLS * ROWS - 1; i++) {
    const x = ((i % COLS) + 0.15 + r() * 0.7) / COLS;
    const y = (Math.floor(i / COLS) + 0.15 + r() * 0.7) / ROWS;
    const cloud = [i % 8, 0.5 + r() * 0.4, 1.6 + r() * 1.8];
    const base = i * 4;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      pos.push(u, v, 0);
      start.push(x, y);
      info.push(...cloud);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 2));
  geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3));
  geo.setIndex(index);
  return geo;
}

export class CloudSea {
  /** The high level's sheet and clouds; hidden at the low one. */
  readonly group = new THREE.Group();
  private readonly sea: Record<'uSky' | 'uNoise' | 'uRepeat' | 'uOffset' | 'uShift', THREE.IUniform>;
  private readonly clouds: Record<'uClouds' | 'uScreen' | 'uWalk' | 'uDrift', THREE.IUniform>;
  private readonly owned: { dispose(): void }[] = [];
  /** Screen pixels drifted so far: added up, so changing /admin's speed doesn't make the sky jump. */
  private drift = 0;

  constructor(private readonly art: { tile: THREE.Texture; clouds: THREE.Texture }, seed: number) {
    this.sea = {
      uSky: { value: art.tile }, uNoise: { value: noiseTexture() }, uRepeat: { value: new THREE.Vector2() },
      uOffset: { value: new THREE.Vector2() }, uShift: { value: new THREE.Vector2() },
    };
    this.clouds = { uClouds: { value: art.clouds }, uScreen: { value: new THREE.Vector2() }, uWalk: { value: new THREE.Vector2() }, uDrift: { value: 0 } };
    // Both stay in the opaque list and are drawn first, so the land is always drawn over them.
    const add = (geo: THREE.BufferGeometry, mat: THREE.ShaderMaterial, order: number) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.owned.push(geo, mat);
    };
    add(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.sea, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, depthTest: false, depthWrite: false,
    }), -1000);
    add(cloudGeometry(seed), new THREE.ShaderMaterial({
      uniforms: this.clouds, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, depthTest: false, depthWrite: false,
      // Soft edges while staying in the opaque list (`transparent` off).
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }), -999);
    this.group.visible = false;
  }

  /**
   * Moves the sea on by `dt` and returns the scene's background for this level (low: the drifting tile; high: none,
   * our own sheet covers the screen). `walkX` / `walkY`: screen pixels the sky has slid as the player walked.
   */
  update(level: 1 | 2, dt: number, speed: number, walkX: number, walkY: number): THREE.Texture | null {
    this.drift += dt * DRIFT * speed;
    this.group.visible = level === 2;
    const repeatX = window.innerWidth / TILE_PX;
    const repeatY = window.innerHeight / TILE_PX;
    const offX = frac((walkX + this.drift) / TILE_PX);
    const offY = frac(walkY / TILE_PX);
    if (level === 1) {
      this.art.tile.repeat.set(repeatX, repeatY);
      this.art.tile.offset.set(offX, offY);
      return this.art.tile;
    }
    this.sea.uRepeat.value.set(repeatX, repeatY);
    this.sea.uOffset.value.set(offX, offY);
    this.sea.uShift.value.set(frac(this.drift * 0.0016), frac(this.drift * 0.0011));
    this.clouds.uScreen.value.set(window.innerWidth, window.innerHeight);
    this.clouds.uWalk.value.set(walkX * CLOUD_PARALLAX, walkY * CLOUD_PARALLAX);
    this.clouds.uDrift.value = this.drift;
    return null;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** The pictures belong to the assets; only what was made here goes. */
  dispose(): void {
    for (const o of this.owned) o.dispose();
  }
}
