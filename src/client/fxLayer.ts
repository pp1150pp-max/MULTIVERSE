// The skill effects' extra layer (owner 2026-11-15, docs/systems/skill-fx-layer.md). The hand-drawn frames step
// through 6 pictures and cut out hard, which reads as choppy. This layer draws over each effect: a glow that rises
// fast and fades out a little after the frames, a soft light on the ground, particles that move every rendered frame,
// a pop of size when it appears, and, on the caster's own screen when it hit something, a screen shake and a short
// freeze. Each effect's recipe is below (keyed by the effect's name, as in the doc's tables); the server-wide
// multipliers are on /admin (fxLayerTuning.ts). An effect with no recipe plays as before.
import * as THREE from 'three';
import { fxTex } from './assets';
import { currentBalance } from '../shared/balance';
import type { SkillEffect } from '../shared/sim/types';

/** spark = thin streaks flying out · shard = heavy bits that fall · ember = rising sparks · star = twinkles · dust = low puffs. */
export type ParticleKind = 'spark' | 'shard' | 'ember' | 'star' | 'dust';

export interface FxRecipe {
  /** Colour of the glow, the ground light and the particles. */
  color: string;
  /** Strength of the glow around the frames (0 = none, 1 = normal, about 1.5 at most). */
  glow: number;
  /** Radius of the ground light, × the effect's size (0 = none). */
  ground: number;
  particles?: { kind: ParticleKind; n: number };
  /** Grows big when it appears and settles back. */
  punch?: boolean;
  /** 0–1: how heavy a hit feels on the caster's screen (shake and freeze). 0 for buffs and lasting zones. */
  heavy: number;
}

/**
 * Recipes by effect name, the values of the doc's tables (SKILL_FX_ALL.md, owner 2026-11-15: Whirlwind first, then
 * all of them). Effects not listed (sw_wave, sw_xslash_gold, impact: no skill uses them yet) play as before.
 * Lasting zones (fields, mist, mine, drone, turret…) are played again every tick, so they stay light and weigh 0.
 */
export const FX_RECIPES: Partial<Record<SkillEffect, FxRecipe>> = {
  // Sword
  slash: { color: '#ffe6b0', glow: 0.5, ground: 0.6, particles: { kind: 'spark', n: 4 }, heavy: 0.2 },
  whirlwind: { color: '#9fe0ff', glow: 0.8, ground: 1.1, particles: { kind: 'spark', n: 10 }, heavy: 0.35 },
  charge: { color: '#ffd08a', glow: 0.8, ground: 0.8, particles: { kind: 'dust', n: 8 }, punch: true, heavy: 0.5 },
  quake: { color: '#d8a060', glow: 0.4, ground: 1.4, particles: { kind: 'dust', n: 14 }, heavy: 0.8 },
  sw_cleave: { color: '#ffd6a0', glow: 0.6, ground: 0.7, particles: { kind: 'spark', n: 6 }, heavy: 0.4 },
  sw_cleave_red: { color: '#ff5a5a', glow: 0.9, ground: 1, particles: { kind: 'shard', n: 10 }, punch: true, heavy: 0.8 },
  sw_bigsword: { color: '#ffb35a', glow: 1, ground: 1.6, particles: { kind: 'shard', n: 14 }, punch: true, heavy: 1 },
  crater: { color: '#ff8a3a', glow: 0, ground: 0, particles: { kind: 'dust', n: 10 }, heavy: 0 },
  sw_nova: { color: '#ffb35a', glow: 1, ground: 1.4, particles: { kind: 'spark', n: 12 }, punch: true, heavy: 0.7 },
  sw_streak: { color: '#9fe0ff', glow: 0.8, ground: 0.5, particles: { kind: 'spark', n: 6 }, heavy: 0.3 },
  sw_windring: { color: '#9fe0ff', glow: 0.7, ground: 1, particles: { kind: 'spark', n: 8 }, heavy: 0.35 },
  sw_xslash: { color: '#c8f0ff', glow: 1, ground: 0.8, particles: { kind: 'shard', n: 8 }, punch: true, heavy: 0.6 },
  sw_aura: { color: '#9fe0ff', glow: 0.6, ground: 0.8, particles: { kind: 'star', n: 5 }, heavy: 0 },
  sw_barrier: { color: '#ffd36a', glow: 0.7, ground: 1, particles: { kind: 'star', n: 5 }, heavy: 0 },
  sw_shout: { color: '#ff9a4a', glow: 0.6, ground: 1.2, particles: { kind: 'dust', n: 8 }, heavy: 0.3 },
  sw_crack: { color: '#d8a060', glow: 0.4, ground: 1, particles: { kind: 'dust', n: 12 }, heavy: 0.7 },
  sw_armorhit: { color: '#e0e6ff', glow: 0.7, ground: 0.5, particles: { kind: 'shard', n: 8 }, punch: true, heavy: 0.5 },
  // Mage
  explosion: { color: '#ff7a2a', glow: 1, ground: 1.6, particles: { kind: 'ember', n: 12 }, punch: true, heavy: 0.6 },
  frost: { color: '#9fd8ff', glow: 0.8, ground: 1.2, particles: { kind: 'shard', n: 12 }, punch: true, heavy: 0.5 },
  mg_lightning: { color: '#bfe0ff', glow: 1.2, ground: 1, particles: { kind: 'spark', n: 10 }, punch: true, heavy: 0.5 },
  mg_burst: { color: '#c89aff', glow: 1, ground: 1.3, particles: { kind: 'star', n: 8 }, punch: true, heavy: 0.6 },
  mg_starhit: { color: '#ffe08a', glow: 1, ground: 1.4, particles: { kind: 'star', n: 7 }, punch: true, heavy: 0.45 },
  mg_firefield: { color: '#ff7a2a', glow: 0.5, ground: 0.8, particles: { kind: 'ember', n: 3 }, heavy: 0 },
  mg_flamewave: { color: '#ff7a2a', glow: 0.8, ground: 1.2, particles: { kind: 'ember', n: 10 }, heavy: 0.4 },
  mg_poison: { color: '#9be05a', glow: 0.4, ground: 0.7, particles: { kind: 'ember', n: 3 }, heavy: 0 },
  mg_ash: { color: '#b0a0a0', glow: 0.3, ground: 0.6, particles: { kind: 'dust', n: 6 }, heavy: 0 },
  mg_decay: { color: '#a070ff', glow: 0.5, ground: 0.9, particles: { kind: 'ember', n: 3 }, heavy: 0 },
  mg_shock: { color: '#9fd8ff', glow: 0.7, ground: 1.2, particles: { kind: 'dust', n: 10 }, punch: true, heavy: 0.5 },
  mg_curse: { color: '#c040ff', glow: 0.6, ground: 0.8, particles: { kind: 'star', n: 4 }, heavy: 0 },
  mg_vortex: { color: '#8a6aff', glow: 0.5, ground: 0.7, particles: { kind: 'ember', n: 2 }, heavy: 0 },
  mg_empower: { color: '#ffd36a', glow: 0.6, ground: 1, particles: { kind: 'star', n: 5 }, heavy: 0 },
  mg_shield: { color: '#7fd0ff', glow: 0.6, ground: 1, particles: { kind: 'star', n: 5 }, heavy: 0 },
  mg_timewarp: { color: '#b0a0ff', glow: 0.7, ground: 1.2, particles: { kind: 'star', n: 6 }, heavy: 0 },
  // Gunslinger (the muzzle flash plays on almost every shot, so it stays light)
  muzzle: { color: '#ffe08a', glow: 0.6, ground: 0.3, particles: { kind: 'spark', n: 3 }, heavy: 0 },
  reticle: { color: '#ff5a4a', glow: 0.6, ground: 0.6, heavy: 0 },
  headshot_hit: { color: '#ff5a4a', glow: 1.2, ground: 1.2, particles: { kind: 'shard', n: 12 }, punch: true, heavy: 1 },
  gs_aura_crit: { color: '#ff5a6a', glow: 0.6, ground: 0.7, particles: { kind: 'spark', n: 4 }, heavy: 0 },
  gs_aura_rapid: { color: '#ffc85a', glow: 0.6, ground: 0.7, particles: { kind: 'spark', n: 4 }, heavy: 0 },
  gs_burn: { color: '#ff8a3a', glow: 0.5, ground: 0.5, particles: { kind: 'ember', n: 2 }, heavy: 0 },
  gs_smoke: { color: '#a0a0a0', glow: 0, ground: 0, particles: { kind: 'dust', n: 4 }, heavy: 0 },
  gs_mine: { color: '#ff5a4a', glow: 0.4, ground: 0.3, heavy: 0 },
  gs_drone: { color: '#6affc8', glow: 0.4, ground: 0, heavy: 0 },
  gs_turret: { color: '#7affe0', glow: 0.3, ground: 0.3, heavy: 0 },
  gs_blast: { color: '#ffb040', glow: 1, ground: 1.5, particles: { kind: 'ember', n: 10 }, punch: true, heavy: 0.6 },
  gs_hawkeye: { color: '#ffe08a', glow: 0.6, ground: 0, particles: { kind: 'star', n: 3 }, heavy: 0 },
  gs_trigger: { color: '#ffc85a', glow: 0.6, ground: 0.3, particles: { kind: 'spark', n: 4 }, heavy: 0 },
  gs_special: { color: '#7affe0', glow: 0.6, ground: 0.8, particles: { kind: 'spark', n: 6 }, heavy: 0.2 },
};

/**
 * Flying shots by their colour (the doc's "ลูกที่บิน" table): a glow around the shot and a trail of particles behind
 * it. The basic attacks' shots (mage #9fd8ff, gun #ffe08a, rapid #ffc85a, buffed #ffb040) fly too often for one.
 */
export const SHOT_LAYERS: Record<string, { color: string; tail: ParticleKind }> = {
  '#ff7a2a': { color: '#ff8a3a', tail: 'ember' }, // Fireball, the falling meteor
  '#ff6a5a': { color: '#ff5a4a', tail: 'spark' }, // Headshot
  '#ffb06a': { color: '#ffb06a', tail: 'spark' }, // Arcane Lance
  '#ff9a4a': { color: '#ff9a4a', tail: 'ember' }, // Volatile Orb
  '#bfe6ff': { color: '#bfe6ff', tail: 'star' }, // Ice Cage
  '#9be05a': { color: '#9be05a', tail: 'ember' }, // Searing Mark, Crystal Spikes
  '#ff7a4a': { color: '#ffb35a', tail: 'spark' }, // Sword Wave
  '#7affe0': { color: '#7affe0', tail: 'spark' }, // Armor-Piercing, Explosive Round, Turret
  '#ff5a6a': { color: '#ff5a6a', tail: 'spark' }, // the crit line's shots
  '#ff8a3a': { color: '#ff8a3a', tail: 'ember' }, // Incendiary
  '#6affc8': { color: '#6affc8', tail: 'dust' }, // Seeker rocket (smoke)
  '#a0fff4': { color: '#a0fff4', tail: 'spark' }, // Railgun
};

/** A flying shot's glow (a child of its sprite, so it follows) and its trail, or null when it has none / the layer is off. */
export class ShotLayer {
  private t = 0;
  private readonly glow: THREE.Sprite;
  private readonly at = new THREE.Vector3();

  private constructor(private readonly host: FxLayerHost, private readonly look: { color: string; tail: ParticleKind }, private readonly sprite: THREE.Sprite) {
    const cfg = currentBalance().fxLayer;
    // Relative to the shot sprite's own scale.
    this.glow = glowSprite(look.color, 1.6);
    this.glow.material.opacity = Math.min(1, 0.6 * cfg.glow);
    this.glow.renderOrder = -1;
    sprite.add(this.glow);
  }

  static for(host: FxLayerHost, color: string, sprite: THREE.Sprite): ShotLayer | null {
    const look = SHOT_LAYERS[color];
    return look && currentBalance().fxLayer.enabled ? new ShotLayer(host, look, sprite) : null;
  }

  dispose(): void {
    this.glow.removeFromParent();
    this.glow.material.dispose();
  }

  /** Drops trail particles behind the shot as it flies (about 25 a second, × the particles setting). */
  update(dt: number): void {
    const every = 0.04 / Math.max(0.05, currentBalance().fxLayer.particles);
    this.t += dt;
    if (this.t < every) return;
    this.t = 0;
    if (currentBalance().fxLayer.particles <= 0) return;
    this.sprite.getWorldPosition(this.at);
    trail(this.host, this.look.tail, this.look.color, this.at);
  }
}

/** One small trail particle left at a flying shot's place. */
function trail(host: FxLayerHost, kind: ParticleKind, color: string, at: THREE.Vector3): void {
  const s = glowSprite(color, kind === 'dust' ? 0.5 : 0.28, kind === 'dust' ? 0.5 : 0.28, kind !== 'dust');
  s.position.copy(at);
  const m = s.material;
  const life = kind === 'dust' ? 0.5 : 0.3;
  const rise = kind === 'ember' ? 0.8 : kind === 'dust' ? 0.3 : 0;
  host.add(s, life, (k, dt) => {
    s.position.y += rise * dt;
    m.opacity = (kind === 'dust' ? 0.4 : 0.8) * (1 - k) * (kind === 'star' ? 0.5 + 0.5 * Math.sin(k * 20) : 1);
    if (kind === 'dust') s.scale.setScalar(0.5 + 0.6 * k);
  });
}

/** What the layer needs from the game: whose screen this is, and the hit feel. */
export interface FxLayerHooks {
  me(): number;
  /** Screen shake (the Sim's own heavy hits send 0.3–0.5). */
  shake(amount: number): void;
  /** Freezes the effects and the characters' animation for this many seconds (positions keep moving). */
  hitstop(sec: number): void;
}

/** What the layer needs from the effects: adding an object that lives `life` seconds and ticks every frame. */
export interface FxLayerHost {
  add(obj: THREE.Object3D, life: number, tick?: (k: number, dt: number) => void): void;
}

/** The longest freeze, whatever the admin sets (a long one feels like lag). */
const HITSTOP_MAX = 0.12;
/** The glow and ground light outlast the frames by this much (× the effect's life), so the end fades instead of cutting. */
const TAIL = 1.5;
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** 0 → 1 over the first 15 %, then eases back to 0. */
const envelope = (k: number): number => (k < 0.15 ? k / 0.15 : (1 - (k - 0.15) / 0.85) ** 2);

/** The on-screen angle of a world direction under the isometric camera (same as effects.ts). */
const screenAngle = (dx: number, dz: number) => Math.atan2(-dx - dz, dx - dz);

function glowSprite(color: string, sx: number, sy = sx, additive = true): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: fxTex.glow, color, transparent: true, depthWrite: false, opacity: 0,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  s.scale.set(sx, sy, 1);
  return s;
}

/**
 * Draws the layer of one effect, if it has a recipe and the layer is on. `obj` is the frames' own object (for the
 * pop), `y` its height, `life` how long its frames play.
 */
export function playLayer(
  host: FxLayerHost, hooks: FxLayerHooks | null, name: SkillEffect, obj: THREE.Object3D,
  x: number, y: number, z: number, size: number, life: number, by?: number, hit?: boolean,
): void {
  const r = FX_RECIPES[name];
  const cfg = currentBalance().fxLayer;
  if (!r || !cfg.enabled) return;
  const tail = life * TAIL;

  // Glow around the frames.
  const glow = r.glow * cfg.glow;
  if (glow > 0) {
    const s = glowSprite(r.color, size * 2.4);
    s.position.set(x, Math.max(y, 0.5), z);
    const m = s.material;
    host.add(s, tail, (k) => {
      m.opacity = Math.min(1, 0.55 * glow) * envelope(k);
      s.scale.setScalar(size * 2.4 * (0.85 + 0.25 * k));
    });
  }

  // Light on the ground.
  const ground = r.ground * cfg.ground;
  if (ground > 0) {
    const m = new THREE.MeshBasicMaterial({
      map: fxTex.glow, color: r.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), m);
    mesh.position.set(x, 0.04, z);
    mesh.scale.setScalar(size * ground);
    host.add(mesh, tail, (k) => {
      m.opacity = 0.7 * envelope(k);
    });
  }

  // A pop of size: 125 % at once, settling back over the first quarter.
  if (r.punch) {
    const base = obj.scale.clone();
    host.add(new THREE.Object3D(), life, (k) => {
      obj.scale.copy(base).multiplyScalar(1 + 0.25 * Math.max(0, 1 - k / 0.25));
    });
  }

  if (r.particles) {
    let n = Math.round(r.particles.n * cfg.particles);
    if (TOUCH && r.particles.kind === 'dust') n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) particle(host, r.particles.kind, r.color, x, z, size);
  }

  // The hit, on the caster's own screen only, and only when it hit something.
  if (hooks && hit && by !== undefined && by === hooks.me() && r.heavy > 0) {
    if (cfg.shake > 0) hooks.shake(0.5 * r.heavy * cfg.shake);
    const stop = Math.min(HITSTOP_MAX, (r.heavy * cfg.hitstopMs) / 1000);
    if (stop > 0) hooks.hitstop(stop);
  }
}

/** One particle of a kind, starting around the effect and moving every frame. */
function particle(host: FxLayerHost, kind: ParticleKind, color: string, x: number, z: number, size: number): void {
  const a = Math.random() * Math.PI * 2;
  const dx = Math.cos(a), dz = Math.sin(a);
  const start = size * (0.3 + Math.random() * 0.4);
  switch (kind) {
    case 'spark': {
      // A thin streak pointing the way it flies, slowing down.
      const s = glowSprite(color, 0.7, 0.14);
      s.material.rotation = screenAngle(dx, dz);
      s.position.set(x + dx * start, 0.5 + Math.random() * 0.6, z + dz * start);
      const v = 6 + Math.random() * 5;
      const m = s.material;
      host.add(s, 0.3 + Math.random() * 0.2, (k, dt) => {
        const sp = v * (1 - k);
        s.position.x += dx * sp * dt;
        s.position.z += dz * sp * dt;
        m.opacity = 1 - k;
        s.scale.set(0.7 * (1 - 0.5 * k), 0.14, 1);
      });
      return;
    }
    case 'shard': {
      // Thrown up and out, falls to the ground and lies there fading.
      const s = glowSprite(color, 0.22);
      s.position.set(x + dx * start * 0.5, 0.6, z + dz * start * 0.5);
      const v = 3 + Math.random() * 3;
      let vy = 3 + Math.random() * 3;
      const m = s.material;
      host.add(s, 0.6 + Math.random() * 0.2, (k, dt) => {
        if (s.position.y > 0.06) {
          s.position.x += dx * v * dt;
          s.position.z += dz * v * dt;
          s.position.y = Math.max(0.05, s.position.y + vy * dt);
          vy -= 14 * dt;
        }
        m.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
      });
      return;
    }
    case 'ember': {
      // Rises slowly, drifting, flickering out.
      const s = glowSprite(color, 0.18);
      s.position.set(x + dx * start, 0.3 + Math.random() * 0.5, z + dz * start);
      const rise = 1 + Math.random() * 1.2;
      const drift = (Math.random() - 0.5) * 0.8;
      const m = s.material;
      host.add(s, 0.7 + Math.random() * 0.5, (k, dt) => {
        s.position.y += rise * dt;
        s.position.x += drift * dt;
        m.opacity = (1 - k) * (0.6 + 0.4 * Math.sin(k * 40));
      });
      return;
    }
    case 'star': {
      // Twinkles in place, rising a little.
      const s = glowSprite(color, 0.3);
      s.position.set(x + dx * start, 0.4 + Math.random() * 1.2, z + dz * start);
      const m = s.material;
      const phase = Math.random() * Math.PI * 2;
      host.add(s, 0.6 + Math.random() * 0.4, (k, dt) => {
        s.position.y += 0.4 * dt;
        m.opacity = (1 - k) * (0.5 + 0.5 * Math.sin(phase + k * 18));
      });
      return;
    }
    case 'dust': {
      // A low puff rolling out and growing.
      const s = glowSprite(color, 0.6, 0.6, false);
      s.position.set(x + dx * start * 0.6, 0.15, z + dz * start * 0.6);
      const v = 1.5 + Math.random() * 1.5;
      const m = s.material;
      host.add(s, 0.6 + Math.random() * 0.3, (k, dt) => {
        s.position.x += dx * v * (1 - k) * dt;
        s.position.z += dz * v * (1 - k) * dt;
        s.scale.setScalar(0.6 + 0.8 * k);
        m.opacity = 0.45 * (1 - k);
      });
      return;
    }
  }
}
