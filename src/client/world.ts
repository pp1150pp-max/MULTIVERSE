import * as THREE from 'three';
import type { Terrain } from '../shared/sim/terrain';
import type { ZoneTheme } from '../shared/data/zones';
import { mulberry32, pick, rand, type Rng } from '../shared/rng';
import { fxTex, groundTiles, sheets, type GroundTile } from './assets';

/** World units covered by one repeat of a ground tile: about the same pixel size as the sprites. */
const TILE_UNITS = 10.4;
/** Planks are drawn narrower than a full tile so they suit the width of the walkway. */
const PLANK_UNITS = 5.2;
/** How many directions a boardwalk's planks can run in. */
const PLANK_ANGLES = 12;

/** What each pixel of the ground mask stands for (stored as id * 16 in its red channel). */
const enum GroundId { Base, PathRim, Path, Bank, WaterEdge, Water, ClearingRim, Clearing }

const GROUND_VERT = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vWorld = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform sampler2D uMask, uBase, uPath, uDirt, uWater;
  uniform float uHalf, uBound, uTileUnits, uPathUnits, uTurnPath, uTime;
  varying vec2 vWorld;

  void main() {
    vec4 mask = texture2D(uMask, (vWorld + uHalf) / (2.0 * uHalf));
    int id = int(floor(mask.r * 255.0 / 16.0 + 0.5));
    vec2 tile = vWorld / uTileUnits;
    vec3 col;
    if (id == 0) {
      // Patches of the same tile turned a quarter turn hide the repeat.
      float patchy = sin(vWorld.x * 0.17 + sin(vWorld.y * 0.13) * 1.3) + sin(vWorld.y * 0.19 + sin(vWorld.x * 0.11) * 1.7);
      col = texture2D(uBase, patchy > 0.0 ? tile : vec2(tile.y, -tile.x) + 0.37).rgb;
    } else if (id == 1) {
      col = texture2D(uDirt, tile).rgb * 0.62;
    } else if (id == 2) {
      vec2 p = vWorld;
      if (uTurnPath > 0.5) {
        // Planks lie across the walkway, whichever way this stretch of it runs.
        float a = mask.g * 3.14159265;
        vec2 along = vec2(cos(a), sin(a));
        p = vec2(dot(vWorld, vec2(-along.y, along.x)), dot(vWorld, along));
      }
      col = texture2D(uPath, p / uPathUnits).rgb;
    } else if (id == 3) {
      col = texture2D(uDirt, tile).rgb * 0.85;
    } else if (id == 4) {
      col = texture2D(uDirt, tile).rgb * 0.35;
    } else if (id == 5) {
      col = texture2D(uWater, tile + vec2(uTime * 0.012, sin(uTime * 0.25) * 0.006)).rgb;
    } else if (id == 6) {
      col = texture2D(uDirt, tile).rgb * 0.8;
    } else {
      col = texture2D(uDirt, tile).rgb;
    }
    if (abs(vWorld.x) > uBound || abs(vWorld.y) > uBound) col *= 0.5;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

interface Fadeable { mat: THREE.SpriteMaterial; x: number; z: number; w: number; h: number; o: number }
interface Fog { spr: THREE.Sprite; vx: number; vz: number; base: number; phase: number }

const S = Math.SQRT1_2;

/** Colours for painting a zone's ground (the minimap, and the fallback if a tile is missing). */
interface GroundPalette {
  /** Repeating textures for the real ground. `dirt` also covers clearings and pond banks. */
  tiles: { base: GroundTile; path: GroundTile; dirt: GroundTile };
  background: string;
  base: string;
  patchDark: string[];
  patchLight: string[];
  specks: string[];
  tuft: [string, string];
  clearing: string[];
  clearingRim: string[];
  clearingStone: string;
  path: [number, string[]][];
  /** Pebbles along the path, or plank seams for a boardwalk. */
  pathDetail: { kind: 'pebbles' | 'planks'; colors: string[] };
  flowers: string[];
  flowerCore: string;
  edge: string;
  /** Murky water pools scattered off the path. */
  pools: number;
  /** Drifting mist sprites. */
  fog: number;
  portalGlow: string;
}

const PALETTES: Record<ZoneTheme, GroundPalette> = {
  forest: {
    tiles: { base: 'grass', path: 'dirt', dirt: 'dirt' },
    background: '#16301a',
    base: '#4e8a39',
    patchDark: ['#467f35', '#427a33', '#4a8337'],
    patchLight: ['#56933f', '#5b9842', '#528e3c'],
    specks: ['#3f7530', '#5a9842', '#36692a', '#6aa94c', '#47823a', '#7bb85a'],
    tuft: ['#356628', '#7fbf5c'],
    clearing: ['#96794f', '#9f8257', '#8f7450'],
    clearingRim: ['#7d6a45', '#86724c'],
    clearingStone: '#b5976b',
    path: [
      [4.8, ['#5c4528', '#654d2e']],
      [4.2, ['#8a6d47', '#967a52', '#7f6440']],
      [3.0, ['#a98b62', '#b49670', '#9c7f57', '#a98b62']],
    ],
    pathDetail: { kind: 'pebbles', colors: ['#8a6c48', '#b5976b', '#7a5e3e', '#c2a77c'] },
    flowers: ['#f5f1e0', '#f6d84a', '#ee8fb4', '#a9c9ff', '#ffffff'],
    flowerCore: '#c9a227',
    edge: 'rgba(10,35,12,0.45)',
    pools: 0,
    fog: 0,
    portalGlow: '#6affd0',
  },
  marsh: {
    tiles: { base: 'marsh', path: 'planks', dirt: 'mud' },
    background: '#121c19',
    base: '#46573b',
    patchDark: ['#3e4f37', '#3a4b34', '#425239'],
    patchLight: ['#4e5e40', '#546343', '#4a5a3d'],
    specks: ['#3b4a30', '#56663e', '#31402c', '#5f6f45', '#4a5a38', '#6b7a4c'],
    tuft: ['#2d3b27', '#71844f'],
    clearing: ['#62543c', '#6a5b41', '#5a4e38'],
    clearingRim: ['#4e4632', '#574e38'],
    clearingStone: '#7a6a4c',
    path: [
      [4.2, ['#2e2116']],
      [3.5, ['#6a4f33', '#634a30']],
      [2.7, ['#7c5f3f', '#856846', '#75593a']],
    ],
    pathDetail: { kind: 'planks', colors: ['#3e2c1c', '#8a6c48'] },
    flowers: ['#c9b6e8', '#8fd0c0', '#e8e2c0'],
    flowerCore: '#6a5a8a',
    edge: 'rgba(8,16,14,0.55)',
    pools: 70,
    fog: 34,
    portalGlow: '#6affd0',
  },
};

/** Draws a zone: painted ground plus the props laid out by the shared Terrain. */
export class World {
  readonly groundCanvas: HTMLCanvasElement;
  readonly half: number;
  readonly bound: number;
  private readonly pal: GroundPalette;
  private readonly fadeables: Fadeable[] = [];
  private readonly flames: THREE.Sprite[] = [];
  private readonly portals: THREE.Sprite[] = [];
  private readonly fog: Fog[] = [];
  /** Everything added to the scene, so a zone change can take it all down again. */
  private readonly objects: THREE.Object3D[] = [];
  private readonly ownMats: THREE.Material[] = [];
  private readonly sharedMats = new Map<string, THREE.SpriteMaterial>();
  private readonly shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly groundTex: THREE.CanvasTexture;
  private groundUniforms: Record<string, THREE.IUniform> | null = null;
  /** Scratch canvas for paintBand; released once the ground is painted. */
  private maskCtx: CanvasRenderingContext2D | null = null;
  /** Water shapes, so flowers don't grow on the pools. */
  private poolBlobs: { x: number; z: number; rx: number; rz: number }[] = [];
  private t = 0;

  constructor(private readonly scene: THREE.Scene, private readonly terrain: Terrain) {
    this.half = terrain.half;
    this.bound = terrain.bound;
    this.pal = PALETTES[terrain.zone.theme];
    scene.background = new THREE.Color(this.pal.background);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: fxTex.shadow, transparent: true, depthWrite: false, opacity: 0.4 });

    this.groundCanvas = this.paintGround(mulberry32(terrain.zone.seed));
    const t = this.pal.tiles;
    const tiles = [groundTiles[t.base], groundTiles[t.path], groundTiles[t.dirt], groundTiles.water];
    if (tiles.every(Boolean)) {
      const mask = new THREE.CanvasTexture(this.paintMask());
      mask.colorSpace = THREE.NoColorSpace;
      mask.flipY = false;
      mask.magFilter = THREE.NearestFilter;
      mask.minFilter = THREE.NearestFilter;
      mask.generateMipmaps = false;
      this.groundTex = mask;
      this.groundUniforms = {
        uMask: { value: mask },
        uBase: { value: tiles[0] },
        uPath: { value: tiles[1] },
        uDirt: { value: tiles[2] },
        uWater: { value: tiles[3] },
        uHalf: { value: this.half },
        uBound: { value: this.bound },
        uTileUnits: { value: TILE_UNITS },
        uPathUnits: { value: this.pal.pathDetail.kind === 'planks' ? PLANK_UNITS : TILE_UNITS },
        uTurnPath: { value: this.pal.pathDetail.kind === 'planks' ? 1 : 0 },
        uTime: { value: 0 },
      };
    } else {
      const tex = new THREE.CanvasTexture(this.groundCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      this.groundTex = tex;
    }
    this.maskCtx = null;
    this.add(new THREE.Mesh(
      new THREE.PlaneGeometry(this.half * 2, this.half * 2).rotateX(-Math.PI / 2),
      this.own(this.groundUniforms
        ? new THREE.ShaderMaterial({ uniforms: this.groundUniforms, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG })
        : new THREE.MeshBasicMaterial({ map: this.groundTex })),
    ));
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2),
      this.own(new THREE.MeshBasicMaterial({ color: this.pal.background })),
    );
    outer.position.y = -0.05;
    this.add(outer);

    for (const p of terrain.props) this.addProp(p.key, p.x, p.z, p.height, p.fade);
    const fire = terrain.props.find((p) => p.key === 'campfire');
    if (fire) this.flames.push(this.glow(fire.x, 0.5, fire.z, '#ffa040', 0.55));
    for (const p of terrain.zone.portals) this.portals.push(this.glow(p.x, 1.5, p.z, this.pal.portalGlow, 0.5));
    this.addFog(mulberry32(terrain.zone.seed + 7));
  }

  private get zone() {
    return this.terrain.zone;
  }

  private get segs() {
    return this.terrain.pathSegments;
  }

  private distToPath(x: number, z: number): number {
    return this.terrain.distToPath(x, z);
  }

  private add<T extends THREE.Object3D>(o: T): T {
    this.scene.add(o);
    this.objects.push(o);
    return o;
  }

  private own<T extends THREE.Material>(m: T): T {
    this.ownMats.push(m);
    return m;
  }

  private glow(x: number, y: number, z: number, color: string, opacity: number): THREE.Sprite {
    const s = this.add(new THREE.Sprite(this.own(new THREE.SpriteMaterial({
      map: fxTex.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity,
    }))));
    s.position.set(x, y, z);
    return s;
  }

  /** Big soft mist blobs drifting slowly over the zone. */
  private addFog(r: Rng): void {
    const B = this.bound;
    for (let i = 0; i < this.pal.fog; i++) {
      const base = rand(r, 0.09, 0.17);
      const spr = this.add(new THREE.Sprite(this.own(new THREE.SpriteMaterial({
        map: fxTex.mist, color: '#d8e6e0', transparent: true, depthWrite: false, opacity: base,
      }))));
      const size = rand(r, 12, 22);
      spr.scale.set(size, size * 0.55, 1);
      spr.position.set(rand(r, -B, B), rand(r, 0.8, 2.2), rand(r, -B, B));
      spr.renderOrder = 5;
      this.fog.push({ spr, vx: rand(r, 0.25, 0.6), vz: rand(r, -0.3, 0.3), base, phase: r() * Math.PI * 2 });
    }
  }

  /** Takes everything this zone added back out of the scene. */
  dispose(): void {
    for (const o of this.objects) this.scene.remove(o);
    for (const m of this.ownMats) m.dispose();
    for (const m of this.sharedMats.values()) m.dispose();
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
    this.groundTex.dispose();
  }

  /** Fade trees that stand between the camera and the player. */
  update(dt: number, px: number, pz: number): void {
    this.t += dt;
    if (this.groundUniforms) this.groundUniforms.uTime.value = this.t;
    for (const f of this.fadeables) {
      const depth = f.x + f.z - (px + pz);
      let target = 1;
      if (depth > 0 && depth < f.h * 1.9) {
        const sdx = (f.x - f.z - (px - pz)) * S;
        if (Math.abs(sdx) < f.w * 0.42) target = 0.35;
      }
      if (target === f.o) continue;
      f.o += (target - f.o) * Math.min(1, dt * 10);
      if (Math.abs(f.o - target) < 0.01) f.o = target;
      const faded = f.o < 0.99;
      f.mat.transparent = faded;
      f.mat.depthWrite = !faded;
      f.mat.alphaTest = faded ? 0.05 : 0.5;
      f.mat.opacity = f.o;
    }
    for (const fl of this.flames) {
      const k = 1 + Math.sin(this.t * 13) * 0.08 + Math.sin(this.t * 7.3) * 0.06;
      fl.scale.set(3.2 * k, 3.2 * k, 1);
    }
    for (const p of this.portals) {
      const k = 1 + Math.sin(this.t * 2.4) * 0.12;
      p.scale.set(4.6 * k, 5 * k, 1);
      (p.material as THREE.SpriteMaterial).opacity = 0.4 + Math.sin(this.t * 3.1) * 0.12;
    }
    const B = this.bound;
    for (const f of this.fog) {
      const s = f.spr.position;
      s.x += f.vx * dt;
      s.z += f.vz * dt;
      if (s.x > B) s.x = -B;
      if (s.z > B) s.z = -B;
      if (s.z < -B) s.z = B;
      (f.spr.material as THREE.SpriteMaterial).opacity = f.base * (0.75 + 0.25 * Math.sin(this.t * 0.4 + f.phase));
    }
  }

  private addProp(key: string, x: number, z: number, height: number, fade: boolean): void {
    const sh = sheets[key];
    let mat: THREE.SpriteMaterial;
    if (fade) {
      mat = this.own(new THREE.SpriteMaterial({ map: sh.texture, alphaTest: 0.5, transparent: false }));
    } else {
      mat = this.sharedMats.get(key) ?? new THREE.SpriteMaterial({ map: sh.texture, alphaTest: 0.5, transparent: false });
      this.sharedMats.set(key, mat);
    }
    const spr = this.add(new THREE.Sprite(mat));
    const w = height * sh.cellAspect;
    spr.center.set(0.5, 0.03);
    spr.scale.set(w, height, 1);
    spr.position.set(x, 0, z);
    const sd = this.add(new THREE.Mesh(this.shadowGeo, this.shadowMat));
    sd.scale.set(w * 0.8, 1, w * 0.45);
    sd.position.set(x, 0.015, z);
    if (fade) this.fadeables.push({ mat, x, z, w, h: height, o: 1 });
  }

  /** Darkens everything outside the walkable area. */
  private paintEdge(ctx: CanvasRenderingContext2D, P: (x: number, z: number) => [number, number]): void {
    const N = ctx.canvas.width;
    const [lo] = P(-this.bound, 0);
    const [hi] = P(this.bound, 0);
    ctx.fillStyle = this.pal.edge;
    ctx.fillRect(0, 0, N, lo);
    ctx.fillRect(0, hi, N, N - hi);
    ctx.fillRect(0, lo, lo, hi - lo);
    ctx.fillRect(hi, lo, N - hi, hi - lo);
  }

  private paintGround(r: Rng): HTMLCanvasElement {
    const N = 2048;
    const H = this.half;
    const k = N / (2 * H);
    const pal = this.pal;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d')!;
    const P = (x: number, z: number): [number, number] => [(x + H) * k, (z + H) * k];

    ctx.fillStyle = pal.base;
    ctx.fillRect(0, 0, N, N);
    // Grass patches: overlapping hard-edged blobs of darker and lighter ground.
    const patches = (count: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (let i = 0; i < count; i++) {
        const x = r() * N;
        const y = r() * N;
        const rad = 14 + r() * 80;
        m.moveTo(x + rad, y);
        m.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), 0, 0, Math.PI * 2);
      }
      m.fill();
    };
    this.paintBand(ctx, pal.patchDark, 3, patches(260));
    this.paintBand(ctx, pal.patchLight, 3, patches(200));
    const specks = pal.specks;
    for (let i = 0; i < 70000; i++) {
      ctx.fillStyle = specks[(r() * specks.length) | 0];
      ctx.fillRect((r() * N) | 0, (r() * N) | 0, 2 + ((r() * 2) | 0), 2);
    }
    for (let i = 0; i < 9000; i++) {
      const x = (r() * N) | 0;
      const y = (r() * N) | 0;
      ctx.fillStyle = pal.tuft[0];
      ctx.fillRect(x, y, 1, 4);
      ctx.fillRect(x + 2, y + 1, 1, 3);
      ctx.fillStyle = pal.tuft[1];
      ctx.fillRect(x + 1, y, 1, 2);
    }

    if (pal.pools) this.paintPools(ctx, r, P, k);

    // Bare ground around the camp and the boss: a rough outer rim, then packed dirt with stones.
    const clearings: [number, number, number][] = [
      [this.zone.start.x, this.zone.start.z, 9],
      [this.zone.boss.x, this.zone.boss.z, 12],
    ];
    const clearing = (scale: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (const [x, z, rad] of clearings) {
        const [px, py] = P(x, z);
        m.moveTo(px + rad * scale * k, py);
        m.arc(px, py, rad * scale * k, 0, Math.PI * 2);
      }
      m.fill();
    };
    this.paintBand(ctx, pal.clearingRim, 3, clearing(1));
    this.paintBand(ctx, pal.clearing, 3, clearing(0.84));
    for (const [cx, cz, rad] of clearings) {
      for (let i = 0; i < rad * 12; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * rad * 0.8;
        const [px, py] = P(cx + Math.cos(a) * d, cz + Math.sin(a) * d);
        const x = px | 0;
        const y = py | 0;
        ctx.fillStyle = pal.clearingRim[0];
        ctx.fillRect(x, y + 1, 3, 1);
        ctx.fillStyle = pal.clearingStone;
        ctx.fillRect(x, y, 3, 1);
      }
    }

    const lines = [this.zone.path, ...this.zone.branches];
    const detail = pal.pathDetail;
    // Dirt roads get a wobbly edge; a boardwalk is built, so its edge stays straight.
    const roadWobble = detail.kind === 'planks' ? 0 : 2;
    for (const [w, tones] of pal.path) {
      this.paintBand(ctx, tones, roadWobble, (m) => {
        m.lineCap = 'round';
        m.lineJoin = 'round';
        m.lineWidth = w * k;
        for (const l of lines) {
          m.beginPath();
          l.forEach(([x, z], i) => {
            const [px, py] = P(x, z);
            if (i) m.lineTo(px, py);
            else m.moveTo(px, py);
          });
          m.stroke();
        }
      });
    }
    if (detail.kind === 'planks') {
      // Boardwalk: a seam across the walkway every half unit, with a lighter edge beside it.
      const half = (pal.path[pal.path.length - 1][0] / 2) * 0.95;
      const seams = (width: number, shift: number) => (m: CanvasRenderingContext2D) => {
        m.lineWidth = width;
        m.beginPath();
        for (const [ax, az, bx, bz] of this.segs) {
          const len = Math.hypot(bx - ax, bz - az);
          const nx = -(bz - az) / len;
          const nz = (bx - ax) / len;
          for (let t = 0; t < len; t += 0.55) {
            const f = t / len;
            const cx = ax + (bx - ax) * f;
            const cz = az + (bz - az) * f;
            const [x0, y0] = P(cx - nx * half, cz - nz * half);
            const [x1, y1] = P(cx + nx * half, cz + nz * half);
            m.moveTo(x0 + shift, y0 + shift);
            m.lineTo(x1 + shift, y1 + shift);
          }
        }
        m.stroke();
      };
      this.paintBand(ctx, [detail.colors[0]], 0, seams(2.5, 0));
      this.paintBand(ctx, [detail.colors[1]], 0, seams(1.5, 2));
    } else {
      for (const [ax, az, bx, bz] of this.segs) {
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        // Small stones: a lit top and a shaded bottom so they read as pixel-art pebbles.
        for (let t = 0; t < len; t += 0.5) {
          const f = t / len;
          const [px, py] = P(ax + (bx - ax) * f + rand(r, -1.5, 1.5), az + (bz - az) * f + rand(r, -1.5, 1.5));
          const x = px | 0;
          const y = py | 0;
          const w = 3 + ((r() * 3) | 0);
          ctx.fillStyle = detail.colors[0];
          ctx.fillRect(x, y, w, 3);
          ctx.fillStyle = detail.colors[3];
          ctx.fillRect(x, y, w - 1, 1);
          ctx.fillStyle = detail.colors[2];
          ctx.fillRect(x, y + 2, w, 1);
        }
        // Grass tufts growing over both road edges hide the join with the ground.
        for (let t = 0; t < len; t += 0.4) {
          const f = t / len;
          const side = r() < 0.5 ? -1 : 1;
          const off = side * rand(r, 2.0, 2.5);
          const [px, py] = P(ax + (bx - ax) * f + nx * off, az + (bz - az) * f + nz * off);
          const x = px | 0;
          const y = py | 0;
          ctx.fillStyle = pal.tuft[0];
          ctx.fillRect(x, y, 1, 4);
          ctx.fillRect(x + 2, y + 1, 1, 3);
          ctx.fillStyle = pal.tuft[1];
          ctx.fillRect(x + 1, y, 1, 2);
        }
      }
    }

    for (let i = 0; i < 700; i++) {
      const x = rand(r, -H, H);
      const z = rand(r, -H, H);
      if (this.distToPath(x, z) < 3) continue;
      if (this.poolBlobs.some((b) => Math.hypot((x - b.x) / (b.rx + 2), (z - b.z) / (b.rz + 2)) < 1)) continue;
      const col = pick(r, pal.flowers);
      const n = 3 + ((r() * 7) | 0);
      for (let j = 0; j < n; j++) {
        const [px, py] = P(x + rand(r, -1.2, 1.2), z + rand(r, -1.2, 1.2));
        ctx.fillStyle = col;
        ctx.fillRect(px | 0, py | 0, 3, 3);
        ctx.fillStyle = pal.flowerCore;
        ctx.fillRect((px | 0) + 1, (py | 0) + 1, 1, 1);
      }
    }

    const [lo] = P(-this.bound, 0);
    const [hi] = P(this.bound, 0);
    ctx.fillStyle = pal.edge;
    ctx.fillRect(0, 0, N, lo);
    ctx.fillRect(0, hi, N, N - hi);
    ctx.fillRect(0, lo, lo, hi - lo);
    ctx.fillRect(hi, lo, N - hi, hi - lo);
    return c;
  }

  /**
   * Fills a shape with hard pixel edges and no blending. `draw` marks the shape in solid white on
   * a scratch canvas; every marked ground pixel then takes one of `tones`, in small clumps.
   * `ripple` lays the tones in short horizontal strokes, like still water.
   */
  private paintBand(
    ctx: CanvasRenderingContext2D,
    tones: string[],
    wobble: number,
    draw: (mask: CanvasRenderingContext2D) => void,
    ripple = false,
  ): void {
    const N = ctx.canvas.width;
    if (!this.maskCtx) {
      const scratch = document.createElement('canvas');
      scratch.width = scratch.height = N;
      this.maskCtx = scratch.getContext('2d', { willReadFrequently: true })!;
    }
    const m = this.maskCtx;
    m.clearRect(0, 0, N, N);
    m.fillStyle = m.strokeStyle = '#fff';
    draw(m);
    const src = m.getImageData(0, 0, N, N).data;
    const image = ctx.getImageData(0, 0, N, N);
    const dst = image.data;
    const rgb = tones.map((t) => [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)]);
    const wave = new Int8Array((N >> 2) + 1);
    for (let i = 0; i < wave.length; i++) wave[i] = Math.round((wobble * (Math.sin(i * 1.7) + Math.sin(i * 0.53))) / 2);
    for (let y = 0; y < N; y++) {
      const wx = wave[y >> 2];
      for (let x = 0; x < N; x++) {
        const sx = x + wx;
        const sy = y + wave[x >> 2];
        if (sx < 0 || sy < 0 || sx >= N || sy >= N || src[(sy * N + sx) * 4 + 3] < 128) continue;
        const cell = ripple
          ? Math.imul((x + (y >> 2) * 11) >> 3, 73856093) ^ Math.imul(y >> 1, 19349663)
          : Math.imul(x >> 1, 73856093) ^ Math.imul(y >> 1, 19349663);
        const c = rgb[(cell >>> 7) % rgb.length];
        const d = (y * N + x) * 4;
        dst[d] = c[0];
        dst[d + 1] = c[1];
        dst[d + 2] = c[2];
        dst[d + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  /**
   * Map of what covers each patch of ground, read by the ground shader: red holds a GroundId, green
   * holds the direction of a boardwalk. Uses the pools laid out by paintGround, so call that first.
   */
  private paintMask(): HTMLCanvasElement {
    const N = 2048;
    const H = this.half;
    const k = N / (2 * H);
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, N, N);
    const P = (x: number, z: number): [number, number] => [(x + H) * k, (z + H) * k];
    const hex = (v: number) => v.toString(16).padStart(2, '0');
    const tone = (id: GroundId, angle = 0) => [`#${hex(id * 16)}${hex(angle)}00`];

    if (this.poolBlobs.length) {
      const pool = (grow: number) => (m: CanvasRenderingContext2D) => {
        m.beginPath();
        for (const b of this.poolBlobs) {
          const [px, py] = P(b.x, b.z);
          const rx = Math.max(0.1, b.rx + grow) * k;
          m.moveTo(px + rx, py);
          m.ellipse(px, py, rx, Math.max(0.1, b.rz + grow) * k, 0, 0, Math.PI * 2);
        }
        m.fill();
      };
      this.paintBand(ctx, tone(GroundId.Bank), 2, pool(0.55));
      this.paintBand(ctx, tone(GroundId.WaterEdge), 2, pool(0.25));
      this.paintBand(ctx, tone(GroundId.Water), 2, pool(0.1));
    }

    const clearings: [number, number, number][] = [
      [this.zone.start.x, this.zone.start.z, 9],
      [this.zone.boss.x, this.zone.boss.z, 12],
    ];
    const clearing = (scale: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (const [x, z, rad] of clearings) {
        const [px, py] = P(x, z);
        m.moveTo(px + rad * scale * k, py);
        m.arc(px, py, rad * scale * k, 0, Math.PI * 2);
      }
      m.fill();
    };
    this.paintBand(ctx, tone(GroundId.ClearingRim), 3, clearing(1));
    this.paintBand(ctx, tone(GroundId.Clearing), 3, clearing(0.9));

    const planks = this.pal.pathDetail.kind === 'planks';
    const wobble = planks ? 0 : 2;
    const stroke = (width: number, segs: readonly (readonly number[])[]) => (m: CanvasRenderingContext2D) => {
      m.lineCap = 'round';
      m.lineWidth = width * k;
      m.beginPath();
      for (const [ax, az, bx, bz] of segs) {
        const [x0, y0] = P(ax, az);
        const [x1, y1] = P(bx, bz);
        m.moveTo(x0, y0);
        m.lineTo(x1, y1);
      }
      m.stroke();
    };
    const widths = this.pal.path.map(([w]) => w);
    this.paintBand(ctx, tone(GroundId.PathRim), wobble, stroke(widths[0], this.segs));
    if (planks) {
      // One pass per plank direction, since each stores its own angle in the mask.
      const byAngle = new Map<number, (readonly number[])[]>();
      for (const seg of this.segs) {
        const [ax, az, bx, bz] = seg;
        const turn = ((Math.atan2(bz - az, bx - ax) % Math.PI) + Math.PI) % Math.PI;
        const bucket = Math.round((turn / Math.PI) * PLANK_ANGLES) % PLANK_ANGLES;
        byAngle.set(bucket, [...(byAngle.get(bucket) ?? []), seg]);
      }
      for (const [bucket, segs] of byAngle) {
        this.paintBand(ctx, tone(GroundId.Path, Math.round((bucket / PLANK_ANGLES) * 255)), 0, stroke(widths[1], segs));
      }
    } else {
      this.paintBand(ctx, tone(GroundId.Path), wobble, stroke(widths[1], this.segs));
    }
    return c;
  }

  /** Dark, still water pools with a muddy rim, a few lily pads and light glints. */
  private paintPools(ctx: CanvasRenderingContext2D, r: Rng, P: (x: number, z: number) => [number, number], k: number): void {
    const B = this.bound;
    const zone = this.zone;
    const away = (x: number, z: number, p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) > d;
    const allBlobs: { x: number; z: number; rx: number; rz: number }[][] = [];
    for (let i = 0, made = 0; i < 600 && made < this.pal.pools; i++) {
      const x = rand(r, -B, B);
      const z = rand(r, -B, B);
      const rad = rand(r, 1.4, 4.2);
      if (this.distToPath(x, z) < rad + 2.2) continue;
      if (!away(x, z, zone.start, 12 + rad) || !away(x, z, zone.boss, 13 + rad)) continue;
      made++;
      allBlobs.push(Array.from({ length: 3 + ((r() * 3) | 0) }, () => ({
        x: x + rand(r, -rad * 0.6, rad * 0.6),
        z: z + rand(r, -rad * 0.6, rad * 0.6),
        rx: rad * rand(r, 0.5, 0.9),
        rz: rad * rand(r, 0.4, 0.75),
      })));
    }
    this.poolBlobs = allBlobs.flat();
    const fill = (grow: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (const blobs of allBlobs) {
        for (const b of blobs) {
          const [px, py] = P(b.x, b.z);
          const rx = Math.max(0.1, b.rx + grow) * k;
          m.moveTo(px + rx, py);
          m.ellipse(px, py, rx, Math.max(0.1, b.rz + grow) * k, 0, 0, Math.PI * 2);
        }
      }
      m.fill();
    };
    this.paintBand(ctx, ['#3c3426', '#4a3f2c', '#352e22'], 2, fill(0.55));
    this.paintBand(ctx, ['#16261f'], 2, fill(0.25));
    this.paintBand(ctx, ['#1f3a3a', '#1b3436'], 2, fill(0), true);
    this.paintBand(ctx, ['#25464a', '#2a5053', '#25464a'], 2, fill(-0.35), true);
    this.paintBand(ctx, ['#2e585a', '#356668', '#2e585a'], 2, fill(-0.85), true);
    for (const blobs of allBlobs) {
      const spot = () => {
        const b = pick(r, blobs);
        const [px, py] = P(b.x + rand(r, -b.rx * 0.5, b.rx * 0.5), b.z + rand(r, -b.rz * 0.5, b.rz * 0.5));
        return [px | 0, py | 0];
      };
      // Glints
      for (let j = 0; j < 5; j++) {
        const [x, y] = spot();
        const w = 5 + ((r() * 8) | 0);
        ctx.fillStyle = '#8fc4bc';
        ctx.fillRect(x, y, w, 1);
        ctx.fillStyle = '#d8efe8';
        ctx.fillRect(x + 1, y, Math.max(1, w >> 2), 1);
      }
      // Lily pads: a pixel disc with a wedge cut out, a dark rim and a lit patch.
      for (let j = 0; j < 3; j++) {
        if (r() < 0.4) continue;
        const [cx, cy] = spot();
        const s = Math.round(0.35 * k);
        for (let dy = -s; dy <= s; dy++) {
          for (let dx = -s; dx <= s; dx++) {
            const d = dx * dx + dy * dy;
            if (d > s * s || (dx > 0 && Math.abs(dy) <= dx / 2)) continue;
            ctx.fillStyle = d > (s - 1) * (s - 1) ? '#274a24' : dx + dy < -s * 0.4 ? '#5d8f45' : '#3f6b34';
            ctx.fillRect(cx + dx, cy + dy, 1, 1);
          }
        }
        if (r() < 0.3) {
          ctx.fillStyle = '#e9c6e0';
          ctx.fillRect(cx - 1, cy - 2, 3, 3);
          ctx.fillStyle = '#f7c844';
          ctx.fillRect(cx, cy - 1, 1, 1);
        }
      }
    }
  }
}
