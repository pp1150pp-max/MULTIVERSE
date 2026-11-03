import * as THREE from 'three';
import type { Terrain } from '../shared/sim/terrain';
import { mulberry32, type Rng } from '../shared/rng';
import { fxTex, sheets } from './assets';

interface Fadeable { mat: THREE.SpriteMaterial; x: number; z: number; w: number; h: number; o: number }

const S = Math.SQRT1_2;

/** Draws a zone: painted ground plus the props laid out by the shared Terrain. */
export class World {
  readonly groundCanvas: HTMLCanvasElement;
  readonly half: number;
  readonly bound: number;
  private readonly fadeables: Fadeable[] = [];
  private readonly flames: THREE.Sprite[] = [];
  private readonly sharedMats = new Map<string, THREE.SpriteMaterial>();
  private readonly shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private t = 0;

  constructor(private readonly scene: THREE.Scene, private readonly terrain: Terrain) {
    this.half = terrain.half;
    this.bound = terrain.bound;
    this.shadowMat = new THREE.MeshBasicMaterial({ map: fxTex.shadow, transparent: true, depthWrite: false, opacity: 0.4 });

    this.groundCanvas = this.paintGround(mulberry32(terrain.zone.seed));
    const tex = new THREE.CanvasTexture(this.groundCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.half * 2, this.half * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    scene.add(ground);
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#3e6e2b' }),
    );
    outer.position.y = -0.05;
    scene.add(outer);

    for (const p of terrain.props) this.addProp(p.key, p.x, p.z, p.height, p.fade);
    const fire = terrain.props.find((p) => p.key === 'campfire');
    if (fire) {
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({
        map: fxTex.glow, color: '#ffa040', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55,
      }));
      flame.position.set(fire.x, 0.5, fire.z);
      scene.add(flame);
      this.flames.push(flame);
    }
  }

  private get zone() {
    return this.terrain.zone;
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
  }

  private addProp(key: string, x: number, z: number, height: number, fade: boolean): void {
    const sh = sheets[key];
    let mat: THREE.SpriteMaterial;
    if (fade) {
      mat = new THREE.SpriteMaterial({ map: sh.texture, alphaTest: 0.5, transparent: false });
    } else {
      mat = this.sharedMats.get(key) ?? new THREE.SpriteMaterial({ map: sh.texture, alphaTest: 0.5, transparent: false });
      this.sharedMats.set(key, mat);
    }
    const spr = new THREE.Sprite(mat);
    const w = height * sh.cellAspect;
    spr.center.set(0.5, 0.03);
    spr.scale.set(w, height, 1);
    spr.position.set(x, 0, z);
    this.scene.add(spr);
    const sd = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    sd.scale.set(w * 0.8, 1, w * 0.45);
    sd.position.set(x, 0.015, z);
    this.scene.add(sd);
    if (fade) this.fadeables.push({ mat, x, z, w, h: height, o: 1 });
  }

  /**
   * Grass and sand from the CraftPix tileset. Its edge tiles only fit a square grid, so paths and
   * clearings are drawn as shapes filled with the sand tile, with the tileset's edge look
   * (light rim, dark outline, shaded sand) painted around them.
   */
  private paintGround(r: Rng): HTMLCanvasElement {
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

    const [lo] = P(-this.bound, 0);
    const [hi] = P(this.bound, 0);
    ctx.fillStyle = 'rgba(10,35,12,0.45)';
    ctx.fillRect(0, 0, N, lo);
    ctx.fillRect(0, hi, N, N - hi);
    ctx.fillRect(0, lo, lo, hi - lo);
    ctx.fillRect(hi, lo, N - hi, hi - lo);
    return c;
  }
}
