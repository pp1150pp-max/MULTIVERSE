import * as THREE from 'three';
import type { Terrain } from '../shared/sim/terrain';
import type { ZoneTheme } from '../shared/data/zones';
import { mulberry32, pick, rand, type Rng } from '../shared/rng';
import { fxTex, sheets } from './assets';

interface Fadeable { mat: THREE.SpriteMaterial; x: number; z: number; w: number; h: number; o: number }
interface Fog { spr: THREE.Sprite; vx: number; vz: number; base: number; phase: number }

const S = Math.SQRT1_2;

/** Colours for painting a zone's ground. */
interface GroundPalette {
  background: string;
  base: string;
  patches: string[];
  specks: string[];
  tuft: [string, string];
  clearing: [string, string, string];
  path: [number, string][];
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
    background: '#16301a',
    base: '#4e8a39',
    patches: ['rgba(34,82,34,0.35)', 'rgba(120,170,72,0.28)', 'rgba(62,112,46,0.32)', 'rgba(140,150,70,0.18)'],
    specks: ['#3f7530', '#5a9842', '#36692a', '#6aa94c', '#47823a', '#7bb85a'],
    tuft: ['#356628', '#7fbf5c'],
    clearing: ['rgba(150,122,82,0.95)', 'rgba(140,115,75,0.6)', 'rgba(140,115,75,0)'],
    path: [[4.8, '#6f5434'], [3.8, '#9c7f57'], [2.4, '#a98b62']],
    pathDetail: { kind: 'pebbles', colors: ['#8a6c48', '#b5976b', '#7a5e3e', '#c2a77c'] },
    flowers: ['#f5f1e0', '#f6d84a', '#ee8fb4', '#a9c9ff', '#ffffff'],
    flowerCore: '#c9a227',
    edge: 'rgba(10,35,12,0.45)',
    pools: 0,
    fog: 0,
    portalGlow: '#6affd0',
  },
  marsh: {
    background: '#121c19',
    base: '#46573b',
    patches: ['rgba(28,48,40,0.42)', 'rgba(96,112,62,0.3)', 'rgba(52,72,58,0.36)', 'rgba(86,74,58,0.28)'],
    specks: ['#3b4a30', '#56663e', '#31402c', '#5f6f45', '#4a5a38', '#6b7a4c'],
    tuft: ['#2d3b27', '#71844f'],
    clearing: ['rgba(98,84,60,0.95)', 'rgba(90,78,57,0.6)', 'rgba(90,78,57,0)'],
    path: [[4.2, '#2e2116'], [3.5, '#6a4f33'], [2.7, '#7c5f3f']],
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
  private t = 0;

  constructor(private readonly scene: THREE.Scene, private readonly terrain: Terrain) {
    this.half = terrain.half;
    this.bound = terrain.bound;
    this.pal = PALETTES[terrain.zone.theme];
    scene.background = new THREE.Color(this.pal.background);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: fxTex.shadow, transparent: true, depthWrite: false, opacity: 0.4 });

    this.groundCanvas = this.paintGround(mulberry32(terrain.zone.seed));
    const tex = new THREE.CanvasTexture(this.groundCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (this.tiled) {
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
    } else {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
    }
    this.groundTex = tex;
    this.add(new THREE.Mesh(
      new THREE.PlaneGeometry(this.half * 2, this.half * 2).rotateX(-Math.PI / 2),
      this.own(new THREE.MeshBasicMaterial({ map: tex })),
    ));
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2),
      this.own(new THREE.MeshBasicMaterial({ color: this.tiled ? '#3e6e2b' : this.pal.background })),
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
        map: fxTex.glow, color: '#d8e6e0', transparent: true, depthWrite: false, opacity: base,
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

  /** The forest uses the CraftPix grass/sand tiles; other zones are painted from their palette. */
  private get tiled(): boolean {
    return this.zone.theme === 'forest';
  }

  private paintGround(r: Rng): HTMLCanvasElement {
    return this.tiled ? this.paintTiledGround(r) : this.paintPaletteGround(r);
  }

  /**
   * Grass and sand from the CraftPix tileset. Its edge tiles only fit a square grid, so paths and
   * clearings are drawn as shapes filled with the sand tile, with the tileset's edge look
   * (light rim, dark outline, shaded sand) painted around them.
   */
  private paintTiledGround(r: Rng): HTMLCanvasElement {
    const N = 2048;
    const H = this.half;
    const k = N / (2 * H);
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d')!;
    const P = (x: number, z: number): [number, number] => [(x + H) * k, (z + H) * k];
    const tile = (key: string, worldSize: number): CanvasPattern => {
      const img = sheets[key].texture.image as HTMLImageElement | HTMLCanvasElement;
      const pat = ctx.createPattern(img, 'repeat')!;
      pat.setTransform(new DOMMatrix().scaleSelf((worldSize * k) / img.width));
      return pat;
    };

    ctx.fillStyle = tile('ground_grass', 6);
    ctx.fillRect(0, 0, N, N);
    // Soft light and dark patches so wide grass doesn't look flat.
    for (let i = 0; i < 180; i++) {
      const x = r() * N;
      const y = r() * N;
      const rad = 40 + r() * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, r() < 0.5 ? 'rgba(255,250,190,0.09)' : 'rgba(20,60,20,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }

    const PATH_W = 4.4;
    const clearings: [number, number, number][] = [
      [this.zone.start.x, this.zone.start.z, 8],
      [this.zone.boss.x, this.zone.boss.z, 10],
    ];
    const lines = [this.zone.path, ...this.zone.branches];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    /** Paths and clearings grown by `extra` world units on every side. */
    const sandShape = (extra: number, fill: string | CanvasPattern) => {
      ctx.strokeStyle = fill;
      ctx.fillStyle = fill;
      ctx.lineWidth = (PATH_W + extra * 2) * k;
      for (const l of lines) {
        ctx.beginPath();
        l.forEach(([x, z], i) => {
          const [px, py] = P(x, z);
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        });
        ctx.stroke();
      }
      for (const [x, z, rad] of clearings) {
        const [px, py] = P(x, z);
        ctx.beginPath();
        ctx.arc(px, py, (rad + extra) * k, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    sandShape(0.55, '#9bbf3b');
    sandShape(0.35, '#384b21');
    sandShape(0.18, '#d49558');
    sandShape(0, tile('ground_sand', 6));

    this.paintEdge(ctx, P);
    return c;
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

  private paintPaletteGround(r: Rng): HTMLCanvasElement {
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
    for (let i = 0; i < 520; i++) {
      const x = r() * N;
      const y = r() * N;
      const rad = 20 + r() * 130;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, pick(r, pal.patches));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
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

    const clearing = (x: number, z: number, rad: number) => {
      const [px, py] = P(x, z);
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad * k);
      g.addColorStop(0, pal.clearing[0]);
      g.addColorStop(0.7, pal.clearing[1]);
      g.addColorStop(1, pal.clearing[2]);
      ctx.fillStyle = g;
      ctx.fillRect(px - rad * k, py - rad * k, rad * 2 * k, rad * 2 * k);
    };
    clearing(this.zone.start.x, this.zone.start.z, 9);
    clearing(this.zone.boss.x, this.zone.boss.z, 12);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lines = [this.zone.path, ...this.zone.branches];
    for (const [w, col] of pal.path) {
      ctx.lineWidth = w * k;
      ctx.strokeStyle = col;
      for (const l of lines) {
        ctx.beginPath();
        l.forEach(([x, z], i) => {
          const [px, py] = P(x, z);
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        });
        ctx.stroke();
      }
    }
    const detail = pal.pathDetail;
    for (const [ax, az, bx, bz] of this.segs) {
      const len = Math.hypot(bx - ax, bz - az);
      if (detail.kind === 'planks') {
        // Boardwalk: a seam across the walkway every half unit, with a lighter edge.
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        const half = (pal.path[pal.path.length - 1][0] / 2) * 0.95;
        for (let t = 0; t < len; t += 0.55) {
          const f = t / len;
          const cx = ax + (bx - ax) * f;
          const cz = az + (bz - az) * f;
          const [x0, y0] = P(cx - nx * half, cz - nz * half);
          const [x1, y1] = P(cx + nx * half, cz + nz * half);
          ctx.lineWidth = 2;
          ctx.strokeStyle = detail.colors[0];
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.strokeStyle = detail.colors[1];
          ctx.beginPath();
          ctx.moveTo(x0 + 2, y0 + 2);
          ctx.lineTo(x1 + 2, y1 + 2);
          ctx.stroke();
        }
      } else {
        for (let t = 0; t < len; t += 0.35) {
          const f = t / len;
          const [px, py] = P(ax + (bx - ax) * f + rand(r, -1.6, 1.6), az + (bz - az) * f + rand(r, -1.6, 1.6));
          ctx.fillStyle = pick(r, detail.colors);
          ctx.fillRect(px | 0, py | 0, 2 + ((r() * 3) | 0), 2);
        }
      }
    }

    for (let i = 0; i < 700; i++) {
      const x = rand(r, -H, H);
      const z = rand(r, -H, H);
      if (this.distToPath(x, z) < 3) continue;
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

  /** Dark, still water pools with a muddy rim, a few lily pads and light glints. */
  private paintPools(ctx: CanvasRenderingContext2D, r: Rng, P: (x: number, z: number) => [number, number], k: number): void {
    const B = this.bound;
    const zone = this.zone;
    const away = (x: number, z: number, p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) > d;
    for (let i = 0, made = 0; i < 600 && made < this.pal.pools; i++) {
      const x = rand(r, -B, B);
      const z = rand(r, -B, B);
      const rad = rand(r, 1.4, 4.2);
      if (this.distToPath(x, z) < rad + 2.2) continue;
      if (!away(x, z, zone.start, 12 + rad) || !away(x, z, zone.boss, 13 + rad)) continue;
      made++;
      const blobs = Array.from({ length: 3 + ((r() * 3) | 0) }, () => ({
        x: x + rand(r, -rad * 0.6, rad * 0.6),
        z: z + rand(r, -rad * 0.6, rad * 0.6),
        rx: rad * rand(r, 0.5, 0.9),
        rz: rad * rand(r, 0.4, 0.75),
      }));
      const fill = (grow: number, color: string) => {
        ctx.fillStyle = color;
        for (const b of blobs) {
          const [px, py] = P(b.x, b.z);
          ctx.beginPath();
          ctx.ellipse(px, py, (b.rx + grow) * k, (b.rz + grow) * k, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      fill(0.5, 'rgba(60,52,38,0.85)');
      fill(0.2, '#24382f');
      fill(0, '#1f3a3a');
      fill(-0.35, '#25464a');
      // Glints
      ctx.fillStyle = 'rgba(170,210,205,0.35)';
      for (let j = 0; j < 4; j++) {
        const b = pick(r, blobs);
        const [px, py] = P(b.x + rand(r, -b.rx * 0.5, b.rx * 0.5), b.z + rand(r, -b.rz * 0.5, b.rz * 0.5));
        ctx.fillRect(px | 0, py | 0, 6 + ((r() * 8) | 0), 1);
      }
      // Lily pads
      for (let j = 0; j < 3; j++) {
        if (r() < 0.4) continue;
        const b = pick(r, blobs);
        const [px, py] = P(b.x + rand(r, -b.rx * 0.5, b.rx * 0.5), b.z + rand(r, -b.rz * 0.5, b.rz * 0.5));
        const s = 0.35 * k;
        ctx.fillStyle = '#3f6b34';
        ctx.beginPath();
        ctx.arc(px, py, s, 0.4, Math.PI * 2);
        ctx.lineTo(px, py);
        ctx.fill();
        ctx.fillStyle = '#5d8f45';
        ctx.fillRect((px - s * 0.4) | 0, (py - s * 0.4) | 0, 3, 2);
        if (r() < 0.3) {
          ctx.fillStyle = '#e9c6e0';
          ctx.fillRect((px + 2) | 0, (py - 3) | 0, 3, 3);
        }
      }
    }
  }
}
