// Trial (owner 2026-11-18, docs/systems/skill-fx-layer.md): skill particles drawn with three.quarks, a GPU-batched
// particle library, instead of one sprite per particle: the Meteor first, then 12 more skills the owner picked
// (QUARKS_SKILLS in src/shared/fxLayerTuning.ts, one /admin switch each). Switched on /admin → ปรับสมดุล →
// "เอฟเฟกต์สกิล (ชั้นเสริม)" (fxLayer.quarks); off = everything plays as before. This module is its own chunk:
// Effects loads it only once the switch is on, so players with it off never download the library.
//
// Every effect is built once as a template and cloned per play, so a cast doesn't build gradients and curves on
// the spot (that showed up as frame spikes on the bench). Textures are drawn on canvases here: no image files.
import * as THREE from 'three';
import {
  BatchedRenderer, ParticleSystem, RenderMode, ConstantValue, IntervalValue, ConstantColor, Gradient, PiecewiseBezier, Bezier,
  SizeOverLife, ColorOverLife, RotationOverLife, ApplyForce, OrbitOverLife, SpeedOverLife,
  PointEmitter, SphereEmitter, CircleEmitter, ConeEmitter,
  Vector3 as QVector3, Vector4 as QVector4,
  type Behavior, type ValueGenerator, type FunctionValueGenerator, type EmitterShape, type BurstParameters,
} from 'three.quarks';
import { currentBalance } from '../shared/balance';
import { quarksKey, type QuarksSkill } from '../shared/fxLayerTuning';
import type { SkillEffect } from '../shared/sim/types';
import { gfxOthers, gfxParticles } from './gfxPrefs';
import { cueKey, ON_CUE, ON_EFFECT, type QuarksHook } from './quarksHooks';

// quarks.core has its own vector classes (same shape as three's); its behaviours want those
const V3 = (x: number, y: number, z: number) => new QVector3(x, y, z);
const V4 = (x: number, y: number, z: number, w: number) => new QVector4(x, y, z, w);
const rgba = (hex: string, a = 1) => { const c = new THREE.Color(hex); return V4(c.r, c.g, c.b, a); };
const cv = (v: number) => new ConstantValue(v);
const iv = (a: number, b: number) => new IntervalValue(a, b);
const curve = (a: number, b: number, c: number, d: number) => new PiecewiseBezier([[new Bezier(a, b, c, d), 0]]);
const grad = (stops: Array<[string, number]>, alphas: Array<[number, number]> = [[1, 0], [1, 0.6], [0, 1]]) =>
  new ColorOverLife(new Gradient(stops.map(([h, t]) => { const c = new THREE.Color(h); return [V3(c.r, c.g, c.b), t] as [QVector3, number]; }), alphas));
const fade = () => new ColorOverLife(new Gradient([[V3(1, 1, 1), 0], [V3(1, 1, 1), 1]], [[0, 0], [1, 0.15], [0, 1]]));
const burst = (n: number, time = 0): BurstParameters => ({ time, count: cv(n), cycle: 1, interval: 0.01, probability: 1 });
/** Turns an emitter's +Z (a circle's normal, a cone's axis) to point up. */
const FLAT = -Math.PI / 2;
/** Phones and tablets (same test as fxLayer.ts): drawn with fxLayer.quarksTouch × the particles. */
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** Whether /admin has this skill's own switch on (the main switch is checked by Effects before it loads this). */
const skillOn = (s: QuarksSkill): boolean => currentBalance().fxLayer[quarksKey(s)];

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
  /** Lay the emitter flat (circle shapes on the ground, cones pointing up). */
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
  /** Point the emitter's +Z (a cone's axis) along the effect's angle, plus `turn` (π = behind it). */
  dir?: boolean;
  turn?: number;
  stretched?: number;
  behaviors?: Behavior[];
}

const FIRE = () => grad([['#fff2c0', 0], ['#ffa030', 0.35], ['#d23a10', 1]]);
const shrink = () => new SizeOverLife(curve(1, 0.9, 0.5, 0));
const grow = () => new SizeOverLife(curve(0.6, 1.2, 1, 0.2));
const puff = () => new SizeOverLife(curve(0.5, 1, 1.3, 1.5));
const slow = () => new SpeedOverLife(curve(1, 0.5, 0.2, 0));
const down = (g = 9) => new ApplyForce(V3(0, -1, 0), cv(g));
const up = (g = 1.5) => new ApplyForce(V3(0, 1, 0), cv(g));
const flash = (size: number, from: string, to: string, life = 0.16): Recipe =>
  ({ life: cv(life), size: cv(size), bursts: 1, behaviors: [grad([[from, 0], [to, 1]], [[1, 0], [0, 1]])] });
const smoke = (color: QVector4, n: number, size: [number, number], speed: [number, number], radius = 0.6): Recipe => ({
  tex: 'smoke', additive: false, life: iv(0.9, 1.5), speed: iv(...speed), size: iv(...size), color, bursts: n,
  shape: new SphereEmitter({ radius }), behaviors: [puff(), up(0.5), new RotationOverLife(iv(-0.6, 0.6)), fade()],
});
const sparks = (n: number, speed: [number, number], from: string, to: string, g = 9): Recipe => ({
  tex: 'spark', life: iv(0.25, 0.6), speed: iv(...speed), size: cv(0.1), bursts: n, shape: new SphereEmitter({ radius: 0.2 }), stretched: 0.06,
  behaviors: [grad([[from, 0], [to, 1]]), down(g)],
});
/** A ring running out along the ground (frost, shockwaves, dust). */
const ring = (n: number, speed: [number, number], size: [number, number], behaviors: Behavior[], extra: Partial<Recipe> = {}): Recipe => ({
  flat: true, life: iv(0.35, 0.6), speed: iv(...speed), size: iv(...size), bursts: n,
  shape: new CircleEmitter({ radius: 0.4, thickness: 0.2 }), behaviors, ...extra,
});
/** A dust ring that slows and spreads. */
const dust = (n: number, speed: [number, number], color: QVector4): Recipe =>
  ring(n, speed, [1.4, 2.6], [puff(), slow(), fade()], { tex: 'smoke', additive: false, life: iv(0.9, 1.4), color });
/** Heavy bits thrown up that fall back (rocks). */
const debris = (n: number, color: string, speed: [number, number], spread = 0.6): Recipe => ({
  flat: true, additive: false, life: iv(0.6, 1), speed: iv(...speed), size: iv(0.18, 0.4), bursts: n, color: rgba(color),
  shape: new ConeEmitter({ radius: 1.2, angle: spread, thickness: 1 }), behaviors: [down(16), new RotationOverLife(iv(-6, 6))],
});
/** Embers floating up off the ground over `secs`. */
const embers = (radius: number, secs: number, rate: number, from: string, to: string): Recipe => ({
  flat: true, duration: secs, life: iv(0.6, 1.2), speed: iv(0.3, 1), size: iv(0.08, 0.16), rate,
  shape: new CircleEmitter({ radius, thickness: 1 }), behaviors: [grad([[from, 0], [to, 1]]), up()],
});

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
    this.buildMore();
    this.buildSword();
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
      s.emitter.userData.dir = !!r.dir;
      s.emitter.userData.turn = r.turn ?? 0;
      return s;
    }));
  }

  /**
   * Clones a template's systems at (x, y, z), or inside `parent` at its origin, cast by player `by`. Particles ×
   * fxLayer.particles, × quarksOthers when it isn't ours, × quarksTouch on a touch screen, × the player's graphics
   * window (quality, and other players' particles: src/client/gfxPrefs.ts); another player's effect isn't drawn
   * at all while the screen is over quarksCap (docs/systems/skill-fx-layer.md).
   */
  private play(name: string, x: number, y: number, z: number, by: number | undefined, parent: THREE.Object3D = this.scene, yaw?: number): ParticleSystem[] {
    const cfg = currentBalance().fxLayer;
    const mine = this.isMine(by);
    if (!mine && this.live >= cfg.quarksCap) return [];
    const k = cfg.particles * gfxParticles() * (mine ? 1 : cfg.quarksOthers * gfxOthers()) * (TOUCH ? cfg.quarksTouch : 1);
    if (k <= 0) return [];
    return (this.tpl.get(name) ?? []).map((t) => {
      const s = t.clone();
      if (k !== 1) {
        if (s.emissionOverTime instanceof ConstantValue) s.emissionOverTime = cv(s.emissionOverTime.value * k);
        s.emissionBursts = s.emissionBursts.map((b) => ({ ...b, count: b.count instanceof ConstantValue ? cv(Math.max(1, Math.round(b.count.value * k))) : b.count }));
      }
      s.emitter.position.set(x, y, z);
      if (t.emitter.userData.flat) s.emitter.rotation.x = FLAT;
      if (t.emitter.userData.dir && yaw !== undefined) s.emitter.rotation.y = Math.PI / 2 - (yaw + t.emitter.userData.turn);
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

  /**
   * Template `name` falling onto (x, 0.4, z) over `duration` from `height` up (and 4·`drift` back on both axes, the
   * Meteor's slant), then `land`. Nothing is drawn when it is cut (quarksCap) or turned down to 0.
   */
  private fall(name: string, x: number, z: number, duration: number, by: number | undefined, height: number, drift: number, land?: () => void): void {
    const ball = new THREE.Group();
    const at = (k: number) => { const e = k * k; ball.position.set(x - 4 * drift * (1 - e), height * (1 - e) + 0.4, z - 4 * drift * (1 - e)); };
    at(0);
    this.scene.add(ball);
    const systems = this.play(name, 0, 0, 0, by, ball);
    if (!systems.length) {
      this.scene.remove(ball);
      return;
    }
    this.moving.push({
      obj: ball, t: 0, life: duration, tick: at,
      // stop emitting; the trail's last particles fade out on their own, then the group goes
      done: () => {
        for (const s of systems) s.endEmit();
        land?.();
        this.moving.push({ obj: ball, t: 0, life: 1.5, tick: () => {}, done: () => this.scene.remove(ball) });
      },
    });
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

  /**
   * The Meteor falling onto (x, z) over `duration` (same path as Effects.meteor). false = its own switch is off, so
   * the old ball plays. A ball cut by the cap or turned down to 0 still returns true (nothing drawn: that's the point).
   */
  meteorFall(x: number, z: number, duration: number, by?: number): boolean {
    if (!skillOn('meteor')) return false;
    this.fall('meteorBall', x, z, duration, by, 14, 1);
    return true;
  }

  // ------------------------------------------------------------------ The owner's 12 more skills (2026-11-18)
  /**
   * A skill's effect (Effects.effect, tagged with its skill by Sim.asCaster): the three.quarks particles drawn over
   * its hand-drawn art. Which picture of which skill plays which template: ON_EFFECT below.
   */
  onEffect(name: SkillEffect, skill: string, x: number, z: number, size: number, by?: number, angle = 0): void {
    this.hook(ON_EFFECT[`${skill}/${name}` as keyof typeof ON_EFFECT], x, z, size, by, angle);
  }

  private hook(h: QuarksHook | undefined, x: number, z: number, size: number, by: number | undefined, angle: number): void {
    if (!h || !skillOn(h.skill)) return;
    const reach = h.fwd ?? 0;
    this.play(typeof h.tpl === 'string' ? h.tpl : h.tpl(size), x + Math.cos(angle) * reach, h.y ?? 0.3, z + Math.sin(angle) * reach, by, undefined, angle);
  }

  /** A skill's warning circle (tagged by Sim.asCaster): Starfall's star falls during it, landing as its hit plays. */
  onTelegraph(skill: string, x: number, z: number, duration: number, by?: number): void {
    if (skill === 'mg_starfall' && skillOn('mg_starfall')) this.fall('starBall', x, z, duration, by, 9, 0.35);
  }

  /**
   * A skill's burst (Effects.burst): Fire Rain's falling fire. true = drawn here instead of the old sparks. A burst of
   * 0 is a cue for the basic attack or the dash (quarksCue in the Sim): colour = the caster's class, speed = the angle.
   */
  onBurst(skill: string, x: number, z: number, by?: number, n?: number, speed?: number, cls?: string): boolean {
    if (n === 0) {
      this.hook(ON_CUE[cueKey(skill, cls ?? '')], x, z, 1, by, speed ?? 0);
      return true;
    }
    if (skill !== 'mg_firerain' || !skillOn('mg_firerain')) return false;
    this.fall('fireDrop', x, z, 0.28, by, 7, 0.25, () => this.play('fireSplash', x, 0.3, z, by));
    return true;
  }

  private buildMore(): void {
    // Fireball's blast: the Meteor's, smaller
    this.define('fireBlast', [
      flash(4.5, '#fff2c0', '#ffa030'),
      { life: iv(0.35, 0.65), speed: iv(1, 4.5), size: iv(0.9, 1.8), bursts: 26, shape: new SphereEmitter({ radius: 0.25 }),
        behaviors: [FIRE(), grow(), new RotationOverLife(iv(-2, 2))] },
      sparks(16, [4, 11], '#ffffff', '#ffa030'),
      smoke(V4(0.25, 0.22, 0.24, 0.7), 6, [1.4, 2.4], [0.4, 1.2]),
    ]);
    // Starfall: a falling star (core + gold trail), and where it lands
    this.define('starBall', [
      { worldSpace: false, looping: true, duration: 5, life: cv(0.1), size: cv(1.2), rate: 30, behaviors: [grad([['#ffffff', 0], ['#ffe08a', 1]])] },
      { looping: true, duration: 5, life: iv(0.25, 0.45), size: iv(0.3, 0.6), rate: 90, shape: new SphereEmitter({ radius: 0.15 }),
        behaviors: [grad([['#fff6c8', 0], ['#ffd040', 0.5], ['#a070ff', 1]]), shrink()] },
    ]);
    this.define('starHit', [
      flash(3.2, '#ffffff', '#ffd040', 0.14),
      { tex: 'spark', life: iv(0.4, 0.8), speed: iv(2, 6), size: iv(0.12, 0.22), bursts: 18, shape: new SphereEmitter({ radius: 0.3 }),
        behaviors: [grad([['#ffffff', 0], ['#ffe08a', 0.5], ['#c89aff', 1]]), down(3)] },
      ring(16, [4, 6], [0.25, 0.4], [grad([['#fff6c8', 0], ['#ffd040', 1]]), shrink()]),
    ]);
    // Frost Nova: ice shards and cold mist running out along the ground, frost sparkles in the whole circle
    this.define('frostNova', [
      flash(5, '#ffffff', '#9fd8ff', 0.18),
      ring(36, [7, 10], [0.3, 0.6], [grad([['#ffffff', 0], ['#9fd8ff', 0.5], ['#3a7aff', 1]]), shrink()], { tex: 'spark', stretched: 0.05 }),
      ring(14, [3, 6], [1.4, 2.4], [puff(), fade()], { tex: 'smoke', additive: false, life: iv(0.6, 1), color: V4(0.75, 0.88, 1, 0.55) }),
      { flat: true, life: iv(0.8, 1.4), speed: iv(0.2, 0.8), size: iv(0.08, 0.16), bursts: 24, shape: new CircleEmitter({ radius: 4, thickness: 1 }),
        behaviors: [grad([['#ffffff', 0], ['#9fd8ff', 1]]), up(0.4)] },
    ]);
    // Fire Rain: a drop of fire falling, and its splash
    this.define('fireDrop', [
      { worldSpace: false, looping: true, duration: 2, life: cv(0.1), size: cv(0.9), rate: 30, behaviors: [grad([['#fff2c0', 0], ['#ff7a20', 1]])] },
      { looping: true, duration: 2, life: iv(0.2, 0.35), size: iv(0.35, 0.6), rate: 70, shape: new SphereEmitter({ radius: 0.15 }),
        behaviors: [grad([['#ffe080', 0], ['#ff5010', 0.5], ['#401010', 1]]), shrink()] },
    ]);
    this.define('fireSplash', [
      flash(2.2, '#fff2c0', '#ff7a20', 0.12),
      { life: iv(0.3, 0.5), speed: iv(1, 3), size: iv(0.5, 0.9), bursts: 10, shape: new SphereEmitter({ radius: 0.2 }), behaviors: [FIRE(), grow()] },
      { ...embers(0.8, 0.1, 0, '#ffd070', '#ff4010'), bursts: 8 },
    ]);
    // Judgement: the giant sword's blow — flash, rocks, a dust ring, gold sparks
    this.define('judgement', [
      flash(7, '#fff2c0', '#ff6a3a', 0.2),
      debris(26, '#7a6050', [7, 12]),
      dust(18, [5, 8], V4(0.45, 0.38, 0.32, 0.75)),
      sparks(28, [6, 16], '#ffffff', '#ffb35a'),
    ]);
    // Whirlwind: sparks circling the swordsman
    this.define('whirlwind', [
      { worldSpace: false, flat: true, life: iv(0.3, 0.5), speed: iv(0.5, 1.5), size: iv(0.18, 0.32), bursts: 40, shape: new CircleEmitter({ radius: 1.8, thickness: 0.3 }),
        behaviors: [grad([['#ffffff', 0], ['#9fe0ff', 0.5], ['#3a8aff', 1]]), new OrbitOverLife(cv(14), V3(0, 0, 1)), shrink()] },
      { tex: 'spark', worldSpace: false, flat: true, life: iv(0.2, 0.4), speed: iv(3, 6), size: cv(0.08), bursts: 14, shape: new CircleEmitter({ radius: 1.6, thickness: 0.2 }), stretched: 0.05,
        behaviors: [grad([['#ffffff', 0], ['#9fe0ff', 1]])] },
    ]);
    // Earthquake: rocks thrown up all round, a dust ring
    this.define('quake', [
      debris(30, '#8a6a4a', [5, 9], 0.8),
      dust(20, [4, 7], V4(0.5, 0.42, 0.32, 0.7)),
    ]);
    // Unleash: the gathered power bursting out — flash, a gold shockwave, sparks, embers rising
    this.define('unleash', [
      flash(9, '#ffffff', '#ffb35a', 0.22),
      ring(40, [10, 13], [0.5, 0.9], [grad([['#fff2c0', 0], ['#ffb35a', 0.5], ['#ff5a2a', 1]]), shrink()]),
      sparks(36, [8, 18], '#ffffff', '#ffb35a', 6),
      embers(4, 1.5, 30, '#ffd070', '#ff6a2a'),
    ]);
    // Gunslinger blasts: big (Explosive Round, Cluster Bomb's main blast) and small (bomblets)
    const blast = (k: number): Recipe[] => [
      flash(4 * k, '#ffffff', '#ffb040', 0.14),
      { life: iv(0.3, 0.55), speed: iv(1, 4 * k), size: iv(0.7 * k, 1.4 * k), bursts: Math.round(18 * k), shape: new SphereEmitter({ radius: 0.2 }), behaviors: [FIRE(), grow()] },
      sparks(Math.round(14 * k), [4, 10 * k], '#ffffff', '#7affe0'),
      smoke(V4(0.22, 0.22, 0.24, 0.65), Math.round(5 * k), [1.2 * k, 2 * k], [0.3, 1]),
    ];
    this.define('blastBig', blast(1));
    this.define('blastSmall', blast(0.6));
    // Rocket Rain: a small blast, and the rocket's smoke trail left standing over it
    this.define('rocket', [
      ...blast(0.6),
      { tex: 'smoke', additive: false, flat: true, life: iv(0.7, 1.1), speed: iv(2, 9), size: iv(0.5, 0.9), bursts: 10, color: V4(0.6, 0.6, 0.62, 0.55),
        shape: new ConeEmitter({ radius: 0.1, angle: 0.06, thickness: 1 }), behaviors: [new SpeedOverLife(curve(1, 0.3, 0.1, 0)), new SizeOverLife(curve(0.6, 1, 1.4, 1.6)), fade()] },
      { tex: 'spark', flat: true, life: iv(0.15, 0.3), speed: iv(10, 18), size: cv(0.12), bursts: 6, shape: new ConeEmitter({ radius: 0.05, angle: 0.04, thickness: 1 }), stretched: 0.08,
        behaviors: [grad([['#ffffff', 0], ['#ffb040', 1]])] },
    ]);
    // Headshot: a red flash on the target, fast sparks, a small ring
    this.define('headshot', [
      flash(2.6, '#ffffff', '#ff5a4a', 0.12),
      sparks(26, [10, 22], '#ffffff', '#ff5a4a', 4),
      ring(14, [5, 7], [0.2, 0.35], [grad([['#ffd0c8', 0], ['#ff3a2a', 1]]), shrink()]),
    ]);
  }
  // ------------------------------------------------------------------ Swordsman: every skill (owner 2026-11-19)
  // Light on purpose: the basic attack and the dashes are used all the time, buffs are a soft glow round the body.
  private buildSword(): void {
    const ORANGE: [string, string] = ['#fff2c0', '#ff7a4a'];
    const CYAN: [string, string] = ['#ffffff', '#7ad8ff'];
    const GOLD: [string, string] = ['#fff6c8', '#ffcf5a'];
    const RED: [string, string] = ['#ffd0c8', '#ff3a2a'];
    /** Sparks thrown forward along the swing (the emitter is turned to the effect's angle). */
    const fan = (n: number, speed: [number, number], c: [string, string], spread = 0.7, extra: Partial<Recipe> = {}): Recipe => ({
      dir: true, tex: 'spark', life: iv(0.15, 0.32), speed: iv(...speed), size: cv(0.1), bursts: n, stretched: 0.06,
      shape: new ConeEmitter({ radius: 0.15, angle: spread, thickness: 1 }), behaviors: [grad([[c[0], 0], [c[1], 1]]), down(3)], ...extra,
    });
    /** Sparks flying out every way. */
    const radial = (n: number, speed: [number, number], c: [string, string], g = 3): Recipe => sparks(n, speed, c[0], c[1], g);
    /** Light motes lifting off the ground round a point: the glow of a buff. */
    const rise = (n: number, radius: number, c: [string, string], secs = 0.1): Recipe => ({
      flat: true, duration: secs, life: iv(0.6, 1.1), speed: iv(0.3, 0.9), size: iv(0.08, 0.16), bursts: n,
      shape: new CircleEmitter({ radius, thickness: 1 }), behaviors: [grad([[c[0], 0], [c[1], 1]]), up(1.2)],
    });
    const glowRing = (n: number, speed: [number, number], c: [string, string]): Recipe =>
      ring(n, speed, [0.22, 0.4], [grad([[c[0], 0], [c[1], 1]]), shrink()], { tex: 'spark', stretched: 0.05 });
    const chip = (n: number, color: string): Recipe => ({ ...debris(n, color, [4, 8], 0.9), life: iv(0.4, 0.7), size: iv(0.1, 0.22) });

    // basic attack: a few sparks along the swing; the dash: a puff and sparks left behind
    this.define('swSlashLite', [fan(5, [4, 8], ORANGE, 0.8, { life: iv(0.12, 0.25) })]);
    this.define('swDash', [
      { tex: 'smoke', additive: false, life: iv(0.4, 0.7), speed: iv(0.2, 0.8), size: iv(0.6, 1), bursts: 3, color: V4(0.62, 0.58, 0.5, 0.5),
        shape: new SphereEmitter({ radius: 0.25 }), behaviors: [puff(), fade()] },
      fan(4, [3, 6], CYAN, 0.5, { turn: Math.PI }),
    ]);
    // Blade line
    this.define('swHeavy', [flash(2.8, '#fff2c0', '#ff7a4a', 0.14), fan(16, [6, 13], ORANGE, 0.75), chip(4, '#ffb070')]);
    this.define('swShatter', [flash(2.4, '#ffffff', '#ffb05a', 0.12), chip(10, '#b8c4d0'), radial(10, [3, 8], ['#ffffff', '#ffb05a'], 9)]);
    this.define('swWave', [flash(1.8, '#ffffff', '#9fe0ff', 0.12), fan(10, [8, 15], ['#ffffff', '#7ad8ff'], 0.35)]);
    this.define('swExecute', [flash(3, '#ffe0d8', '#ff3a2a', 0.15), fan(18, [6, 13], RED, 0.8), radial(8, [2, 5], ['#ff8a7a', '#8a1010'], 6)]);
    this.define('swFlurry', [fan(5, [4, 9], ORANGE, 0.8, { life: iv(0.12, 0.24) })]);
    this.define('swBladeRing', [flash(3.2, '#fff2c0', '#ff7a4a', 0.14), glowRing(24, [7, 10], ORANGE)]);
    this.define('swCrush', [flash(4.5, '#fff2c0', '#ff6a3a', 0.18), debris(16, '#7a6050', [6, 10]), dust(10, [4, 7], V4(0.45, 0.38, 0.32, 0.7)), radial(14, [5, 12], ['#ffffff', '#ffb35a'], 8)]);
    // Gale line
    this.define('swCharge', [fan(12, [8, 14], ORANGE, 0.45, { turn: Math.PI }), dust(6, [2, 4], V4(0.55, 0.5, 0.42, 0.55))]);
    this.define('swTripleHit', [fan(5, [4, 9], CYAN, 0.8, { life: iv(0.12, 0.25) })]);
    this.define('swWind', [flash(2.6, '#ffffff', '#9fe0ff', 0.14), glowRing(16, [5, 8], CYAN)]);
    this.define('swWindSmall', [glowRing(8, [4, 6], CYAN)]);
    this.define('swTrail', [fan(8, [5, 10], CYAN, 0.4, { turn: Math.PI })]);
    this.define('swShadowTrail', [fan(10, [6, 12], ['#ffffff', '#8a7aff'], 0.4, { turn: Math.PI }), radial(6, [1, 3], ['#d0c8ff', '#5a3aff'], 1)]);
    this.define('swOverdrive', [flash(2.6, '#ffffff', '#7ad8ff', 0.2), rise(16, 0.9, CYAN)]);
    this.define('swXHit', [flash(2, '#ffffff', '#c8f0ff', 0.1), radial(8, [3, 8], ['#ffffff', '#9fe0ff'], 4)]);
    this.define('swXTiny', [radial(4, [2, 5], ['#ffffff', '#9fe0ff'], 4)]);
    // Bulwark line
    this.define('swBash', [flash(2.6, '#fff6c8', '#ffcf5a', 0.13), fan(12, [5, 11], GOLD, 0.6), chip(5, '#b8a070')]);
    this.define('swTaunt', [flash(3, '#ffe0d8', '#ff5a3a', 0.2), glowRing(24, [6, 9], RED)]);
    this.define('swGuard', [flash(2.2, '#ffffff', '#ffe08a', 0.18), rise(14, 1.2, GOLD)]);
    // a crack along the ground: sparks run both ways from its middle
    this.define('swShock', [
      fan(10, [0, 18], GOLD, 0.05, { life: iv(0.2, 0.32), size: cv(0.14) }),
      fan(10, [0, 18], GOLD, 0.05, { life: iv(0.2, 0.32), size: cv(0.14), turn: Math.PI }),
      fan(4, [0, 12], GOLD, 0.1, { tex: 'smoke', additive: false, stretched: undefined, size: iv(0.8, 1.4), life: iv(0.5, 0.8), color: V4(0.5, 0.42, 0.32, 0.55) }),
    ]);
    this.define('swThorns', [flash(2, '#ffe0c8', '#ff7a4a', 0.12), radial(18, [4, 9], ['#ffffff', '#ff6a3a'], 5), glowRing(10, [3, 5], RED)]);
    this.define('swAnchor', [dust(8, [2, 4], V4(0.5, 0.42, 0.32, 0.6)), chip(8, '#8a7a5a'), rise(10, 1.2, GOLD)]);
    this.define('swWarcry', [flash(3, '#fff6c8', '#ffcf5a', 0.2), glowRing(24, [6, 9], GOLD), rise(22, 4.5, GOLD)]);
    this.define('swCata', [debris(14, '#8a6a4a', [4, 8], 0.8), dust(10, [4, 7], V4(0.5, 0.42, 0.32, 0.65)), glowRing(14, [6, 9], GOLD)]);
    this.define('swKing', [flash(6, '#ffffff', '#ffe08a', 0.24), glowRing(30, [7, 11], GOLD), rise(30, 5, ['#ffffff', '#ffcf5a'], 1.2)]);
  }
}
