import * as THREE from 'three';
import type { ZoneDef } from '../shared/data/zones';
import { mulberry32, pick, rand, type Rng } from '../shared/rng';
import { fxTex, sheets } from './assets';

export interface Collider { x: number; z: number; r: number }
interface Fadeable { mat: THREE.SpriteMaterial; x: number; z: number; w: number; h: number; o: number }
type Seg = [number, number, number, number];

const S = Math.SQRT1_2;

export class World {
  readonly colliders: Collider[] = [];
  readonly groundCanvas: HTMLCanvasElement;
  readonly half: number;
  readonly bound: number;
  private readonly segs: Seg[] = [];
  private readonly fadeables: Fadeable[] = [];
  private readonly flames: THREE.Sprite[] = [];
  private readonly sharedMats = new Map<string, THREE.SpriteMaterial>();
  private readonly shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private t = 0;
  /** Camp NPC spots, set while placing props. */
  npcPos = { seeker: { x: 0, z: 0 }, merchant: { x: 0, z: 0 }, blacksmith: { x: 0, z: 0 } };

  constructor(private readonly scene: THREE.Scene, readonly zone: ZoneDef) {
    this.half = zone.half;
    this.bound = zone.half - 8;
    for (const line of [zone.path, ...zone.branches]) {
      for (let i = 1; i < line.length; i++) this.segs.push([line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]]);
    }
    const rng = mulberry32(zone.seed);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: fxTex.shadow, transparent: true, depthWrite: false, opacity: 0.4 });

    this.groundCanvas = this.paintGround(rng);
    const tex = new THREE.CanvasTexture(this.groundCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.half * 2, this.half * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    scene.add(ground);
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#16301a' }),
    );
    outer.position.y = -0.05;
    scene.add(outer);

    this.placeProps(rng);
  }

  distToPath(x: number, z: number): number {
    let best = Infinity;
    for (const [ax, az, bx, bz] of this.segs) {
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
      if (d < best) best = d;
    }
    return best;
  }

  isBlocked(x: number, z: number, r: number): boolean {
    if (Math.abs(x) > this.bound || Math.abs(z) > this.bound) return true;
    return this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r);
  }

  /** Push a circle out of static colliders and keep it inside the zone. */
  resolve(u: { x: number; z: number; radius: number }): void {
    for (const c of this.colliders) {
      const dx = u.x - c.x;
      const dz = u.z - c.z;
      const min = c.r + u.radius;
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001;
        const push = (min - d) / d;
        u.x += dx * push;
        u.z += dz * push;
      }
    }
    u.x = Math.max(-this.bound, Math.min(this.bound, u.x));
    u.z = Math.max(-this.bound, Math.min(this.bound, u.z));
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

  addProp(key: string, x: number, z: number, height: number, collideR: number, fade = false): THREE.Sprite {
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
    if (collideR > 0) this.colliders.push({ x, z, r: collideR });
    if (fade) this.fadeables.push({ mat, x, z, w, h: height, o: 1 });
    return spr;
  }

  private addTree(r: Rng, x: number, z: number): void {
    this.addProp(pick(r, ['tree_0', 'tree_1', 'tree_2']), x, z, rand(r, 4.6, 6.4), 0.55, true);
  }

  private placeProps(r: Rng): void {
    const zone = this.zone;
    const H = this.half;
    const B = this.bound;
    const near = (x: number, z: number, p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) < d;

    // Dense forest wall around the playable area.
    for (let x = -H + 1; x <= H - 1; x += 2.6) {
      for (let z = -H + 1; z <= H - 1; z += 2.6) {
        if (Math.max(Math.abs(x), Math.abs(z)) < B - 1) continue;
        this.addTree(r, x + rand(r, -1, 1), z + rand(r, -1, 1));
      }
    }

    // Camp at the start point, with The Seeker.
    const s = zone.start;
    this.addProp('tent', s.x + 3, s.z - 4, 3, 1.4);
    this.addProp('tent', s.x - 4, s.z + 3, 3, 1.4);
    this.addProp('campfire', s.x, s.z, 1, 0.5);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fxTex.glow, color: '#ffa040', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55,
    }));
    flame.position.set(s.x, 0.5, s.z);
    this.scene.add(flame);
    this.flames.push(flame);
    this.addProp('sign', s.x - 5, s.z - 6.5, 1.4, 0.2);
    this.addProp('runestone', s.x + 5, s.z + 3.5, 2.2, 0.5);
    this.npcPos = {
      seeker: { x: s.x + 3.5, z: s.z + 1.5 },
      merchant: { x: s.x - 1.5, z: s.z + 5 },
      blacksmith: { x: s.x + 5, z: s.z - 1.5 },
    };
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
      const fx = s.x + Math.cos(a) * 9;
      const fz = s.z + Math.sin(a) * 9;
      if (this.distToPath(fx, fz) < 3 || Math.abs(fx) > B || Math.abs(fz) > B) continue;
      this.addProp('fence', fx, fz, 1.1, 0.6);
    }

    // Boss clearing ring of runestones.
    const b = zone.boss;
    for (let a = 0.3; a < Math.PI * 2; a += Math.PI / 4) {
      this.addProp(a % 2 > 1 ? 'rock_1' : 'runestone', b.x + Math.cos(a) * 11, b.z + Math.sin(a) * 11, 2.2, 0.6);
    }

    // Scattered forest inside.
    let placed = 0;
    for (let i = 0; i < 1600 && placed < 280; i++) {
      const x = rand(r, -B + 2, B - 2);
      const z = rand(r, -B + 2, B - 2);
      if (this.distToPath(x, z) < 3.2) continue;
      if (near(x, z, s, 11) || near(x, z, b, 13)) continue;
      if (zone.spawns.some((sp) => near(x, z, sp, sp.radius * 0.55))) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < 2.2)) continue;
      const roll = r();
      if (roll < 0.55) this.addTree(r, x, z);
      else if (roll < 0.8) this.addProp(pick(r, ['bush_0', 'bush_1']), x, z, rand(r, 0.9, 1.3), 0);
      else if (roll < 0.93) this.addProp(pick(r, ['rock_0', 'rock_1']), x, z, rand(r, 0.7, 1.1), 0.5);
      else this.addProp('stump', x, z, 0.8, 0.4);
      placed++;
    }
  }

  private paintGround(r: Rng): HTMLCanvasElement {
    const N = 2048;
    const H = this.half;
    const k = N / (2 * H);
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d')!;
    const P = (x: number, z: number): [number, number] => [(x + H) * k, (z + H) * k];

    ctx.fillStyle = '#4e8a39';
    ctx.fillRect(0, 0, N, N);
    const patch = ['rgba(34,82,34,0.35)', 'rgba(120,170,72,0.28)', 'rgba(62,112,46,0.32)', 'rgba(140,150,70,0.18)'];
    for (let i = 0; i < 520; i++) {
      const x = r() * N;
      const y = r() * N;
      const rad = 20 + r() * 130;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, pick(r, patch));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const specks = ['#3f7530', '#5a9842', '#36692a', '#6aa94c', '#47823a', '#7bb85a'];
    for (let i = 0; i < 70000; i++) {
      ctx.fillStyle = specks[(r() * specks.length) | 0];
      ctx.fillRect((r() * N) | 0, (r() * N) | 0, 2 + ((r() * 2) | 0), 2);
    }
    for (let i = 0; i < 9000; i++) {
      const x = (r() * N) | 0;
      const y = (r() * N) | 0;
      ctx.fillStyle = '#356628';
      ctx.fillRect(x, y, 1, 4);
      ctx.fillRect(x + 2, y + 1, 1, 3);
      ctx.fillStyle = '#7fbf5c';
      ctx.fillRect(x + 1, y, 1, 2);
    }

    const clearing = (x: number, z: number, rad: number) => {
      const [px, py] = P(x, z);
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad * k);
      g.addColorStop(0, 'rgba(150,122,82,0.95)');
      g.addColorStop(0.7, 'rgba(140,115,75,0.6)');
      g.addColorStop(1, 'rgba(140,115,75,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - rad * k, py - rad * k, rad * 2 * k, rad * 2 * k);
    };
    clearing(this.zone.start.x, this.zone.start.z, 9);
    clearing(this.zone.boss.x, this.zone.boss.z, 12);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lines = [this.zone.path, ...this.zone.branches];
    const strokes: [number, string][] = [[4.8, '#6f5434'], [3.8, '#9c7f57'], [2.4, '#a98b62']];
    for (const [w, col] of strokes) {
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
    const pebbles = ['#8a6c48', '#b5976b', '#7a5e3e', '#c2a77c'];
    for (const [ax, az, bx, bz] of this.segs) {
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = 0; t < len; t += 0.35) {
        const f = t / len;
        const [px, py] = P(ax + (bx - ax) * f + rand(r, -1.6, 1.6), az + (bz - az) * f + rand(r, -1.6, 1.6));
        ctx.fillStyle = pick(r, pebbles);
        ctx.fillRect(px | 0, py | 0, 2 + ((r() * 3) | 0), 2);
      }
    }

    const flowers = ['#f5f1e0', '#f6d84a', '#ee8fb4', '#a9c9ff', '#ffffff'];
    for (let i = 0; i < 700; i++) {
      const x = rand(r, -H, H);
      const z = rand(r, -H, H);
      if (this.distToPath(x, z) < 3) continue;
      const col = pick(r, flowers);
      const n = 3 + ((r() * 7) | 0);
      for (let j = 0; j < n; j++) {
        const [px, py] = P(x + rand(r, -1.2, 1.2), z + rand(r, -1.2, 1.2));
        ctx.fillStyle = col;
        ctx.fillRect(px | 0, py | 0, 3, 3);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect((px | 0) + 1, (py | 0) + 1, 1, 1);
      }
    }

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
