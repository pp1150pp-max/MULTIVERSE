// Skill effect "extra layer" (owner 2026-11-15, docs/systems/skill-fx.md): glow around the drawn effect, light on
// the ground, particles, a pop when it goes off, a charge glow when the skill is cast, and the feel of a hit
// (white flash, short hit-stop, shake). It works on top of any sheet art, so new art from the artist keeps it.
// Picture only: nothing here reaches the Sim. Settings: /admin "ปรับสมดุล" → "เอฟเฟกต์สกิล" (src/shared/fxTuning.ts).
import { currentBalance } from '../shared/balance';
import type { FxConfig } from '../shared/fxTuning';
import type { SkillEffect } from '../shared/sim/types';

export type SparkKind = 'spark' | 'shard' | 'ember' | 'star' | 'dust';

/** How one effect is dressed up. Sizes are × the effect's own size. */
export interface FxRecipe {
  /** Colour of the glow, ground light and particles. */
  color: string;
  /** Glow around the picture (an added glowing copy + soft light behind), 0 = none. */
  glow: number;
  /** Radius of the light on the ground, 0 = none. */
  ground: number;
  sparks?: { kind: SparkKind; n: number; speed: number };
  /** The picture pops in bigger then settles. */
  pop?: boolean;
  /** How heavy the hit feels (0–1): shake and hit-stop on the caster's own screen. 0 = no hit feel. */
  heavy: number;
}

/**
 * The 5 sample skills (owner 2026-11-15): Judgement + Whirlwind (sword), Starfall + Fireball (mage), Headshot (gun).
 * Keyed by effect picture, so other skills that play the same picture get it too (see docs/systems/skill-fx.md).
 */
export const FX_RECIPES: Partial<Record<SkillEffect, FxRecipe>> = {
  sw_bigsword: { color: '#ffb35a', glow: 1, ground: 1.6, sparks: { kind: 'shard', n: 14, speed: 7 }, pop: true, heavy: 1 },
  crater: { color: '#ff8a3a', glow: 0, ground: 0, sparks: { kind: 'dust', n: 10, speed: 4 }, heavy: 0 },
  whirlwind: { color: '#9fe0ff', glow: 0.8, ground: 1.1, sparks: { kind: 'spark', n: 10, speed: 6 }, heavy: 0.35 },
  mg_starhit: { color: '#ffe08a', glow: 1, ground: 1.4, sparks: { kind: 'star', n: 7, speed: 4 }, pop: true, heavy: 0.45 },
  explosion: { color: '#ff7a2a', glow: 1, ground: 1.6, sparks: { kind: 'ember', n: 12, speed: 6 }, pop: true, heavy: 0.6 },
  headshot_hit: { color: '#ff5a4a', glow: 1.2, ground: 1.2, sparks: { kind: 'shard', n: 12, speed: 9 }, pop: true, heavy: 1 },
  reticle: { color: '#ff5a4a', glow: 0.6, ground: 0.6, heavy: 0 },
};

/** Flying shots of the sample skills, by the shot's colour: a glow around it and a trail. */
export const SHOT_RECIPES: Record<string, { color: string; trail: SparkKind }> = {
  '#ff7a2a': { color: '#ff8a3a', trail: 'ember' }, // Fireball (and the falling meteor picture)
  '#ff6a5a': { color: '#ff5a4a', trail: 'spark' }, // Headshot round
};

/** Charge glow on the caster when one of the sample skills is cast (seen by everyone). */
export const CAST_GLOW: Record<string, string> = {
  sw_judgement: '#ffb35a',
  whirlwind: '#9fe0ff',
  mg_starfall: '#ffe08a',
  fireball: '#ff7a2a',
  headshot: '#ff5a4a',
};

/** Which sample skill each heavy picture comes from, for "is this my hit?". */
const EFFECT_SKILL: Partial<Record<SkillEffect, string>> = {
  sw_bigsword: 'sw_judgement',
  whirlwind: 'whirlwind',
  mg_starhit: 'mg_starfall',
  explosion: 'fireball',
  headshot_hit: 'headshot',
};
/** A cast counts as the source of its pictures for this long (Starfall: 8 stars × 0.25 s, Fireball flight). */
const CAST_WINDOW = 4;
/** Monsters flashing inside a heavy picture this long after it played are its hits. */
const ZONE_LIFE = 0.12;
/** At most one hit-stop this often (Whirlwind and Starfall hit many times). */
const STOP_GAP = 0.15;

export const fxConfig = (): FxConfig => currentBalance().fx;
/** The layer is on and this effect has a recipe. */
export function recipeOf(name: SkillEffect): FxRecipe | null {
  return fxConfig().on ? FX_RECIPES[name] ?? null : null;
}

interface Zone { x: number; z: number; r: number; until: number; heavy: number }
export interface FlashTarget { id: number; x: number; z: number; flashWhite(): void }

/** The caster-side hit feel: knows which skills I cast lately, turns my heavy hits into shake + hit-stop. */
export class HitFeel {
  private now = 0;
  private readonly mine = new Map<string, number>();
  private zones: Zone[] = [];
  private flashed: number[] = [];
  private stopLeft = 0;
  private lastStop = -1;

  constructor(private readonly shake: (amount: number) => void) {}

  /** I cast this skill. */
  cast(skill: string): void {
    if (CAST_GLOW[skill]) this.mine.set(skill, this.now + CAST_WINDOW);
  }

  /** A layered picture played; if it is one of my heavy hits, shake now and watch for the monsters it hits. */
  effect(name: SkillEffect, x: number, z: number, size: number, r: FxRecipe): void {
    const skill = EFFECT_SKILL[name];
    if (!r.heavy || !skill || (this.mine.get(skill) ?? -1) < this.now) return;
    const c = fxConfig();
    if (c.shake > 0) this.shake(0.5 * r.heavy * c.shake);
    this.zones.push({ x, z, r: size * 1.1 + 0.6, until: this.now + ZONE_LIFE, heavy: r.heavy });
  }

  /** A monster flashed (was hit) this frame. */
  flash(id: number): void {
    if (this.zones.length) this.flashed.push(id);
  }

  /**
   * Called once a frame after the events: hits inside my heavy pictures flash white and stop the picture briefly.
   * Returns the dt the pictures (actors, effects) should move by: 0 while stopped.
   */
  frame(dt: number, find: (id: number) => FlashTarget | undefined): number {
    this.now += dt;
    if (this.flashed.length && this.zones.length) {
      const c = fxConfig();
      let heavy = 0;
      for (const id of this.flashed) {
        const t = find(id);
        if (!t) continue;
        for (const zn of this.zones) {
          if (Math.hypot(t.x - zn.x, t.z - zn.z) > zn.r) continue;
          t.flashWhite();
          heavy = Math.max(heavy, zn.heavy);
          break;
        }
      }
      if (heavy > 0 && c.hitStopMs > 0 && this.now - this.lastStop > STOP_GAP) {
        this.lastStop = this.now;
        this.stopLeft = (c.hitStopMs / 1000) * (0.6 + 0.4 * heavy);
      }
    }
    this.flashed.length = 0;
    if (this.zones.length) this.zones = this.zones.filter((zn) => zn.until > this.now);
    if (this.stopLeft > 0) {
      this.stopLeft -= dt;
      return 0;
    }
    return dt;
  }
}
