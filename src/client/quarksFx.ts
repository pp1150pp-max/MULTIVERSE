// Trial (owner 2026-11-18, docs/systems/skill-fx-layer.md): skill particles drawn with three.quarks, a GPU-batched
// particle library, instead of one sprite per particle. Only the Meteor uses it so far. Switched on /admin →
// ปรับสมดุล → "เอฟเฟกต์สกิล (ชั้นเสริม)" (fxLayer.quarks); off = everything plays as before. The look was tried
// on a test bench first (outside this repo) with the same three version and isometric camera.
//
// Every effect is built once as a template and cloned per play, so a cast doesn't build gradients and curves on
// the spot (that showed up as frame spikes on the bench). Textures are drawn on canvases here: no image files.
import * as THREE from 'three';
import {
  BatchedRenderer, ParticleSystem, RenderMode, ConstantValue, IntervalValue, ConstantColor, Gradient, PiecewiseBezier, Bezier,
  SizeOverLife, ColorOverLife, RotationOverLife, ApplyForce, PointEmitter, SphereEmitter, CircleEmitter,
  Vector3 as QVector3, Vector4 as QVector4,
  type Behavior, type ValueGenerator, type FunctionValueGenerator, type EmitterShape, type BurstParameters,
} from 'three.quarks';
import { currentBalance } from '../shared/balance';

export const quarksOn = (): boolean => currentBalance().fxLayer.enabled && currentBalance().fxLayer.quarks;

// quarks.core has its own vector classes (same shape as three's); its behaviours want those
const V3 = (x: number, y: number, z: number) => new QVector3(x, y, z);
const V4 = (x: number, y: number, z: number, w: number) => new QVector4(x, y, z, w);
const cv = (v: number) => new ConstantValue(v);
const iv = (a: number, b: number) => new IntervalValue(a, b);
const curve = (a: number, b: number, c: number, d: number) => new PiecewiseBezier([[new Bezier(a, b, c, d), 0]]);
const grad = (stops: Array<[string, number]>, alphas: Array<[number, number]> = [[1, 0], [1, 0.6], [0, 1]]) =>
  new ColorOverLife(new Gradient(stops.map(([h, t]) => { const c = new THREE.Color(h); return [V3(c.r, c.g, c.b), t] as [QVector3, number]; }), alphas));
const fade = () => new ColorOverLife(new Gradient([[V3(1, 1, 1), 0], [V3(1, 1, 1), 1]], [[0, 0], [1, 0.15], [0, 1]]));
const burst = (n: number, time = 0): BurstParameters => ({ time, count: cv(n), cycle: 1, interval: 0.01, probability: 1 });
/** Turns an emitter's +Z (a circle's normal) to point up. */
const FLAT = -Math.PI / 2;
/** Phones and tablets (same test as fxLayer.ts): drawn with fxLayer.quarksTouch × the particles. */
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function radial(g: CanvasRenderingContext2D, x: number, y: number, r: number, stops: Array<[number, string]>): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  g.fillStyle = gr;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
}

type TexName = 'glow' | 'spark' | 'smoke';
interface Recipe {
  tex?: TexName;
  additive?: boolean;
  /** Lay the emitter flat (circle shapes on the ground). */
  flat?: boolean;
  duration?: number;
  looping?: boolean;
  /** false: particles move with the emitter (a ball's core); true: they stay where they were born (a trail). */
  worldSpace?: boolean;
  life: ValueGenerator | FunctionValueGenerator;
  speed?: ValueGenerator | FunctionValueGenerator;
  size: ValueGenerator | FunctionValueGenerator;
  color?: QVector4;
  /** Particles per second. */
  rate?: number;
  /** Particles at the start. */
  bursts?: number;
  shape?: EmitterShape;
  stretched?: number;
  behaviors?: Behavior[];
}

export class QuarksFx {
  private readonly batch = new BatchedRenderer();
  private readonly tex: Record<TexName, THREE.Texture>;
  private readonly mats = new Map<string, THREE.MeshBasicMaterial>();
  /** Templates by name; `play` clones one. */
  private readonly tpl = new Map<string, ParticleSystem[]>();
  private readonly moving: Array<{ obj: THREE.Object3D; t: number; life: number; tick: (k: number) => void; done?: () => void }> = [];
  /** Particles on screen, counted once a frame in update(). */
  private live = 0;

  /** `isMine(by)`: whether an effect cast by player `by` is this screen's player (undefined = not known: drawn as one's own). */
  constructor(private readonly scene: THREE.Scene, private readonly isMine: (by: number | undefined) => boolean) {
    scene.add(this.batch);
    this.tex = {
      glow: canvasTex(64, (g, s) => radial(g, s / 2, s / 2, s / 2, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.75)'], [1, 'rgba(255,255,255,0)']])),
      spark: canvasTex(32, (g, s) => radial(g, s / 2, s / 2, s / 2, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,0)']])),
      smoke: canvasTex(64, (g, s) => {
        for (let i = 0; i < 12; i++) {
          const r = s * 0.18 * ((i % 3) / 2 + 0.3);
          radial(g, s / 2 + Math.cos(i * 2.4) * r, s / 2 + Math.sin(i * 2.4) * r, s * 0.28, [[0, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
        }
      }),
    };
    this.buildMeteor();
  }

  private mat(tex: TexName, additive: boolean): THREE.MeshBasicMaterial {
    const k = tex + (additive ? '+' : '');
    let m = this.mats.get(k);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        map: this.tex[tex], transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.mats.set(k, m);
    }
    return m;
  }

  private system(r: Recipe): ParticleSystem {
    return new ParticleSystem({
      duration: r.duration ?? 0.1, looping: r.looping ?? false, worldSpace: r.worldSpace ?? true, autoDestroy: true,
      startLife: r.life, startSpeed: r.speed ?? cv(0), startSize: r.size,
      startColor: new ConstantColor(r.color ?? V4(1, 1, 1, 1)), startRotation: iv(0, Math.PI * 2),
      emissionOverTime: cv(r.rate ?? 0), emissionBursts: r.bursts ? [burst(r.bursts)] : [],
      shape: r.shape ?? new PointEmitter(),
      renderMode: r.stretched !== undefined ? RenderMode.StretchedBillBoard : RenderMode.BillBoard,
      rendererEmitterSettings: r.stretched !== undefined ? { speedFactor: r.stretched, lengthFactor: 0 } : undefined,
      behaviors: r.behaviors ?? [],
      material: this.mat(r.tex ?? 'glow', r.additive ?? true),
    });
  }

  private define(name: string, recipes: Recipe[]): void {
    this.tpl.set(name, recipes.map((r) => {
      const s = this.system(r);
      s.emitter.userData.flat = !!r.flat;
      return s;
    }));
  }

  /**
   * Clones a template's systems at (x, y, z), or inside `parent` at its origin, cast by player `by`. Particles ×
   * fxLayer.particles, × quarksOthers when it isn't ours, × quarksTouch on a touch screen; another player's effect
   * isn't drawn at all while the screen is over quarksCap (docs/systems/skill-fx-layer.md).
   */
  private play(name: string, x: number, y: number, z: number, by: number | undefined, parent: THREE.Object3D = this.scene): ParticleSystem[] {
    const cfg = currentBalance().fxLayer;
    const mine = this.isMine(by);
    if (!mine && this.live >= cfg.quarksCap) return [];
    const k = cfg.particles * (mine ? 1 : cfg.quarksOthers) * (TOUCH ? cfg.quarksTouch : 1);
    if (k <= 0) return [];
    return (this.tpl.get(name) ?? []).map((t) => {
      const s = t.clone();
      if (k !== 1) {
        if (s.emissionOverTime instanceof ConstantValue) s.emissionOverTime = cv(s.emissionOverTime.value * k);
        s.emissionBursts = s.emissionBursts.map((b) => ({ ...b, count: b.count instanceof ConstantValue ? cv(Math.max(1, Math.round(b.count.value * k))) : b.count }));
      }
      s.emitter.position.set(x, y, z);
      if (t.emitter.userData.flat) s.emitter.rotation.x = FLAT;
      parent.add(s.emitter);
      this.batch.addSystem(s);
      return s;
    });
  }

  update(dt: number): void {
    for (let i = this.moving.length - 1; i >= 0; i--) {
      const m = this.moving[i];
      m.t += dt;
      const k = Math.min(1, m.t / m.life);
      m.tick(k);
      if (k >= 1) {
        this.moving.splice(i, 1);
        m.done?.();
      }
    }
    this.batch.update(dt);
    let n = 0;
    for (const s of this.batch.systemToBatchIndex.keys()) n += s.particleNum;
    this.live = n;
  }

  // ------------------------------------------------------------------ Meteor
  private buildMeteor(): void {
    this.define('meteorBall', [
      { worldSpace: false, looping: true, duration: 5, life: cv(0.1), size: cv(2), rate: 30, behaviors: [grad([['#fff2c0', 0], ['#ff7a20', 1]])] },
      { looping: true, duration: 5, life: iv(0.4, 0.7), size: iv(0.8, 1.4), rate: 140, shape: new SphereEmitter({ radius: 0.4 }),
        behaviors: [grad([['#ffe080', 0], ['#ff5010', 0.4], ['#401010', 1]]), new SizeOverLife(curve(1, 0.9, 0.5, 0))] },
      { tex: 'smoke', additive: false, looping: true, duration: 5, life: iv(0.8, 1.2), size: iv(0.8, 1.2), rate: 40, color: V4(0.18, 0.15, 0.16, 0.7),
        behaviors: [new SizeOverLife(curve(0.6, 1, 1.5, 1.8))] },
    ]);
    this.define('meteorBlast', [
      { life: cv(0.18), size: cv(8), bursts: 1, behaviors: [grad([['#fff2c0', 0], ['#ffa030', 1]], [[1, 0], [0, 1]])] },
      { life: iv(0.4, 0.8), speed: iv(1, 7), size: iv(1.4, 2.8), bursts: 50, shape: new SphereEmitter({ radius: 0.3 }),
        behaviors: [grad([['#fff2c0', 0], ['#ffa030', 0.35], ['#d23a10', 1]]), new SizeOverLife(curve(0.6, 1.2, 1, 0.2)), new RotationOverLife(iv(-2, 2))] },
      { tex: 'spark', life: iv(0.3, 0.7), speed: iv(5, 18), size: cv(0.12), bursts: 30, shape: new SphereEmitter({ radius: 0.2 }), stretched: 0.06,
        behaviors: [grad([['#ffffff', 0], ['#ffa030', 1]]), new ApplyForce(V3(0, -1, 0), cv(9))] },
      { tex: 'smoke', additive: false, life: iv(1.2, 2), speed: iv(0.5, 1.6), size: iv(2.2, 4), color: V4(0.25, 0.22, 0.24, 0.8), bursts: 12,
        shape: new SphereEmitter({ radius: 1 }), behaviors: [new SizeOverLife(curve(0.5, 1, 1.3, 1.5)), new ApplyForce(V3(0, 1, 0), cv(0.6)), new RotationOverLife(iv(-0.6, 0.6)), fade()] },
      { flat: true, duration: 2.5, life: iv(0.6, 1.2), speed: iv(0.3, 1), size: iv(0.08, 0.16), rate: 30, shape: new CircleEmitter({ radius: 2.2, thickness: 1 }),
        behaviors: [grad([['#ffd070', 0], ['#ff4010', 1]]), new ApplyForce(V3(0, 1, 0), cv(1.5))] },
    ]);
  }

  /** The Meteor falling onto (x, z) over `duration` (same path as Effects.meteor). */
  meteorFall(x: number, z: number, duration: number, by?: number): void {
    const ball = new THREE.Group();
    this.scene.add(ball);
    const systems = this.play('meteorBall', 0, 0, 0, by, ball);
    this.moving.push({
      obj: ball, t: 0, life: duration,
      tick: (k) => { const e = k * k; ball.position.set(x - 4 * (1 - e), 14 * (1 - e) + 0.4, z - 4 * (1 - e)); },
      // stop emitting; the trail's last particles fade out on their own, then the group goes
      done: () => {
        for (const s of systems) s.endEmit();
        this.moving.push({ obj: ball, t: 0, life: 1.5, tick: () => {}, done: () => this.scene.remove(ball) });
      },
    });
  }

  /** The Meteor's blast where it lands, over the hand-drawn crater. */
  meteorBlast(x: number, z: number, by?: number): void {
    this.play('meteorBlast', x, 0.4, z, by);
  }
}
