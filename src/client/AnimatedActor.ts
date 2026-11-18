import * as THREE from 'three';
import { disposeShadow, shadowFade, shadowGeometry, sharedShadowMat } from './SpriteActor';
import { animTuneAt } from './animTune';
import type { DirTune } from '../shared/animTuning';

/**
 * Facing rows an animation file may contain. `side`, `down_side` and `up_side` are mirrored for
 * the opposite side; `left` / `right` are separately drawn rows used as-is, never mirrored.
 */
export type Dir = 'down' | 'down_side' | 'side' | 'up_side' | 'up' | 'left' | 'right';
const DIR_ANGLE: Record<Dir, number> = { down: 0, down_side: 45, side: 90, up_side: 135, up: 180, left: 90, right: 90 };

export interface AnimDef {
  file: string;
  frames: number;
  fps: number;
  loop?: boolean;
  /** Row order in this file, if it differs from the manifest default (e.g. death drawn in one direction only). */
  directions?: Dir[];
  /** Per-animation frame size / feet when this file was cut differently from the manifest defaults. */
  frameWidth?: number;
  frameHeight?: number;
  feet?: number;
}

/** Contents of `sprite.json` next to a character's animation PNGs. */
export interface CharManifest {
  frameWidth: number;
  frameHeight: number;
  /** World height of one whole frame. The player is about 1.9 units tall. */
  height: number;
  /** Where the feet are, as a fraction of frame height measured from the bottom. */
  feet: number;
  /** Which way the side / diagonal rows face in the image. */
  sideFaces: 'left' | 'right';
  /** Default row order (top to bottom) for every animation file. */
  directions: Dir[];
  animations: Record<string, AnimDef>;
}

export interface AnimSet {
  manifest: CharManifest;
  textures: Record<string, THREE.Texture>;
  /** `class.art` of the per-facing fixes (src/shared/animTuning.ts) this set uses; none = never tuned. */
  tuneKey?: string;
}

/** Common surface of SpriteActor and AnimatedActor so units can use either. */
export interface Actor {
  readonly group: THREE.Group;
  readonly height: number;
  face(dx: number, dz: number): void;
  update(dt: number, moving: boolean, fps?: number): void;
  flash(): void;
  setOpacity(o: number): void;
  /** One-shot animation; returns false when the actor has no such animation. */
  play(name: string, opts?: PlayOpts): boolean;
  has(name: string): boolean;
  /** Cancel any one-shot animation. */
  reset(): void;
  dispose(): void;
  /** Riding pose instead of idle / run (actors with riding poses). */
  setRide?(name: string | null): void;
  /** Speed of the run cycle, 1 = as drawn (actors with a run cycle). */
  setStride?(rate: number): void;
}

export interface PlayOpts {
  /** Stretch or squeeze the animation to last this many seconds. */
  duration?: number;
  /** Keep showing the last frame until something else plays (death). */
  hold?: boolean;
  /** Start on the last frame, e.g. someone who was already lying dead when they came into view. */
  atEnd?: boolean;
}

// A higher priority one-shot may interrupt a lower one, never the reverse.
const PRIORITY: Record<string, number> = { death: 100, revive: 90, dash: 50, skill: 40, attack: 30, hit: 20 };
const priorityOf = (name: string) => PRIORITY[name] ?? PRIORITY[name.split('_')[0]] ?? 10;

const S = Math.SQRT1_2;

/** Move speed (units/s) at which the run cycle plays as drawn; slower or faster scales it, within MIN–MAX. */
const STRIDE_SPEED = 5;
const STRIDE_MIN = 0.6;
const STRIDE_MAX = 1.6;
/** The run-cycle rate (setStride) for a character seen moving at `speed` units/s: the game and the /admin bench. */
export const strideRate = (speed: number): number => Math.min(STRIDE_MAX, Math.max(STRIDE_MIN, speed / STRIDE_SPEED));

/** Optional looping animation shown instead of `run` while firing on the move. */
const RUN_ATTACK = 'run_attack';
/** Keeps the gun raised between shots so the arm doesn't flicker during continuous fire. */
const AIM_HOLD = 0.3;
const isAttack = (name: string) => name.startsWith('attack');

export class AnimatedActor implements Actor {
  readonly group = new THREE.Group();
  readonly height: number;
  private readonly sprite: THREE.Sprite;
  private readonly mat: THREE.SpriteMaterial;
  private readonly shadow: THREE.Mesh;
  private readonly tex: Record<string, THREE.Texture> = {};
  private readonly m: CharManifest;
  private readonly tuneKey: string | undefined;
  private base = 'idle';
  private shown = '';
  private baseT = 0;
  private oneShot: { name: string; t: number; fps: number; hold: boolean } | null = null;
  private stride = 1;
  private sx = 0;
  private sy = -1;
  private flashT = 0;
  private moving = false;
  private aimT = 0;
  /** A riding pose shown instead of idle / run while on a mount (see setRide). */
  private ride: string | null = null;
  private drawn: { dir: Dir; flip: boolean; frame: number; frames: number } = { dir: 'down', flip: false, frame: 0, frames: 1 };

  constructor(set: AnimSet, shadowRadius: number) {
    this.m = set.manifest;
    this.tuneKey = set.tuneKey;
    for (const [name, t] of Object.entries(set.textures)) {
      const c = t.clone();
      c.needsUpdate = true;
      this.tex[name] = c;
    }
    const first = this.tex.idle ?? Object.values(this.tex)[0];
    this.mat = new THREE.SpriteMaterial({ map: first, alphaTest: 0.5, transparent: false });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(0.5, this.m.feet);
    this.height = this.m.height;
    this.sprite.scale.set(this.m.height * (this.m.frameWidth / this.m.frameHeight), this.m.height, 1);

    // One plane and (while fully shown) one material for every actor's shadow.
    const shadow = new THREE.Mesh(shadowGeometry(), sharedShadowMat());
    this.shadow = shadow;
    shadow.scale.set(shadowRadius * 2.2, 1, shadowRadius * 1.4);
    shadow.position.y = 0.02;
    this.group.add(shadow, this.sprite);
  }

  /** Riding: loops `name` (frame 0 when standing still, bobbing while moving) instead of idle / run; null = on foot. */
  setRide(name: string | null): void {
    this.ride = name && this.has(name) ? name : null;
  }

  has(name: string): boolean {
    return name in this.tex;
  }

  face(dx: number, dz: number): void {
    if (dx * dx + dz * dz < 1e-6) return;
    this.sx = (dx - dz) * S;
    this.sy = (-dx - dz) * S;
  }

  play(name: string, opts: PlayOpts = {}): boolean {
    const def = this.m.animations[name];
    if (!def || !this.tex[name]) return false;
    if (this.oneShot && priorityOf(this.oneShot.name) > priorityOf(name)) return false;
    const fps = opts.duration ? def.frames / opts.duration : def.fps;
    // A standing attack has planted feet, so playing it on the move would look like sliding.
    if (this.moving && isAttack(name) && this.has(RUN_ATTACK)) {
      this.aimT = def.frames / fps + AIM_HOLD;
      return true;
    }
    this.oneShot = { name, t: opts.atEnd ? def.frames / fps : 0, fps, hold: !!opts.hold };
    return true;
  }

  update(dt: number, moving: boolean): void {
    this.moving = moving;
    this.aimT = Math.max(0, this.aimT - dt);
    if (moving && this.oneShot && isAttack(this.oneShot.name) && this.has(RUN_ATTACK)) {
      const frames = this.m.animations[this.oneShot.name].frames;
      this.aimT = Math.max(0, frames / this.oneShot.fps - this.oneShot.t) + AIM_HOLD;
      this.oneShot = null;
    }
    let name: string;
    let frame: number;
    if (this.oneShot) {
      const o = this.oneShot;
      const def = this.m.animations[o.name];
      o.t += dt * (this.tune(o.name)?.rate ?? 1);
      frame = Math.floor(o.t * o.fps);
      if (frame >= def.frames) {
        if (o.hold) frame = def.frames - 1;
        else this.oneShot = null;
      }
    }
    if (this.oneShot) {
      name = this.oneShot.name;
      frame = Math.min(Math.floor(this.oneShot.t * this.oneShot.fps), this.m.animations[name].frames - 1);
    } else {
      const legs = this.has('run') ? 'run' : this.has('walk') ? 'walk' : 'idle';
      const want = this.ride ?? (!moving ? 'idle' : this.aimT > 0 && this.has(RUN_ATTACK) ? RUN_ATTACK : legs);
      if (want !== this.base) {
        // Raising or lowering the gun keeps the stride going instead of restarting the legs.
        const sameStride = (want === RUN_ATTACK && this.base === 'run') || (want === 'run' && this.base === RUN_ATTACK);
        this.base = want;
        if (!sameStride) this.baseT = 0;
      }
      // Legs keep pace with the ground actually covered (setStride); idle runs at its own speed.
      this.baseT += (this.base === 'idle' ? dt : dt * this.stride) * (this.tune(this.base)?.rate ?? 1);
      const def = this.m.animations[this.base] ?? Object.values(this.m.animations)[0];
      name = this.base in this.tex ? this.base : Object.keys(this.tex)[0];
      frame = this.ride && !moving ? 0 : Math.floor(this.baseT * def.fps) % def.frames;
    }

    if (name !== this.shown) {
      this.shown = name;
      this.mat.map = this.tex[name];
    }
    const tune = this.tune(name);
    // Keep world size per source pixel constant so differently-cut files line up; then the facing's size and nudge.
    const def = this.m.animations[name];
    const unit = (this.m.height / this.m.frameHeight) * (tune?.scale ?? 1);
    const w = (def.frameWidth ?? this.m.frameWidth) * unit;
    const hh = (def.frameHeight ?? this.m.frameHeight) * unit;
    this.sprite.scale.set(w, hh, 1);
    this.sprite.center.set(0.5 - (tune?.x ?? 0) / w, (def.feet ?? this.m.feet) - (tune?.y ?? 0) / hh);
    this.applyUV(name, frame, tune);

    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT) / 0.15;
      this.mat.color.setRGB(1, 1 - 0.65 * k, 1 - 0.65 * k);
    }
  }

  /** This facing's fixes of animation `name` (src/shared/animTuning.ts), if any. */
  private tune(name: string): DirTune | undefined {
    return this.tuneKey ? animTuneAt(`${this.tuneKey}.${name}`, this.sx, this.sy) : undefined;
  }

  private applyUV(name: string, frame: number, tune: DirTune | undefined): void {
    const def = this.m.animations[name];
    const dirs = def.directions ?? this.m.directions;
    // Screen angle of the facing: 0 = toward camera, 90 = sideways, 180 = away.
    const ang = (Math.atan2(Math.abs(this.sx), -this.sy) * 180) / Math.PI;
    let row = 0;
    let best = Infinity;
    dirs.forEach((d, i) => {
      if ((d === 'left' && this.sx > 0) || (d === 'right' && this.sx <= 0)) return;
      const diff = Math.abs(DIR_ANGLE[d] - ang);
      if (diff < best) {
        best = diff;
        row = i;
      }
    });
    // The owner's pick of row for this facing, when this file has that row.
    if (tune?.row && dirs.includes(tune.row)) row = dirs.indexOf(tune.row);
    const dir = dirs[row];
    const mirrorable = dir === 'side' || dir === 'down_side' || dir === 'up_side';
    const flip = tune?.flip ?? (mirrorable && Math.abs(this.sx) > 0.05 && (this.m.sideFaces === 'right') !== this.sx > 0);

    this.drawn = { dir, flip, frame, frames: def.frames };
    const t = this.tex[name];
    const w = 1 / def.frames;
    const h = 1 / dirs.length;
    const v = 1 - (row + 1) * h;
    if (flip) {
      t.repeat.set(-w, h);
      t.offset.set((frame + 1) * w, v);
    } else {
      t.repeat.set(w, h);
      t.offset.set(frame * w, v);
    }
  }

  flash(): void {
    this.flashT = 0.15;
  }

  /** Which picture row, mirrored or not, and which frame the last update drew (the /admin animation bench). */
  get drawnFrame(): { dir: Dir; flip: boolean; frame: number; frames: number } {
    return this.drawn;
  }

  /** The animation shown on the last update (RigActor asks it to know when to hand over). */
  get shownAnim(): string {
    return this.shown;
  }

  /** Shows or hides the character picture, keeping the shadow (RigActor draws its own body). */
  setSpriteVisible(v: boolean): void {
    this.sprite.visible = v;
  }

  /** How fast the run/walk cycle plays, 1 = as drawn (its fps). */
  setStride(rate: number): void {
    this.stride = rate;
  }

  setOpacity(o: number): void {
    this.mat.transparent = o < 1;
    this.mat.alphaTest = o < 1 ? 0.02 : 0.5;
    this.mat.opacity = o;
    shadowFade(this.shadow, o);
  }

  reset(): void {
    this.oneShot = null;
    this.aimT = 0;
  }

  dispose(): void {
    for (const t of Object.values(this.tex)) t.dispose();
    this.mat.dispose();
    disposeShadow(this.shadow);
  }
}
