// Which skill picture / cue plays which three.quarks template (src/client/quarksFx.ts). Kept apart from quarksFx so
// the headless tests can check that the Sim really sends every effect named here (tests/fx-layer.test.ts) without
// loading the particle library.
import type { QuarksSkill } from '../shared/fxLayerTuning';
import type { SkillEffect } from '../shared/sim/types';

export interface QuarksHook {
  skill: QuarksSkill;
  /** Template name, or one picked from the picture's size. */
  tpl: string | ((size: number) => string);
  /** Height of the emitter (0.3 if left out). */
  y?: number;
  /** Move the emitter this far along the effect's angle first (a swing's reach). */
  fwd?: number;
}

/**
 * A skill's picture (`skill/effect`) → the template drawn over it. A skill that plays two pictures at one spot is
 * hooked on one of them only, so it isn't drawn twice.
 */
export const ON_EFFECT: Partial<Record<`${QuarksSkill}/${SkillEffect}`, QuarksHook>> = {
  'meteor/crater': { skill: 'meteor', tpl: 'meteorBlast', y: 0.4 },
  'fireball/explosion': { skill: 'fireball', tpl: 'fireBlast', y: 0.6 },
  'mg_starfall/mg_starhit': { skill: 'mg_starfall', tpl: 'starHit' },
  'frostnova/mg_frostnova': { skill: 'frostnova', tpl: 'frostNova', y: 0.4 },
  'sw_judgement/sw_bigsword': { skill: 'sw_judgement', tpl: 'judgement' },
  'whirlwind/whirlwind': { skill: 'whirlwind', tpl: 'whirlwind', y: 0.8 },
  'earthquake/quake': { skill: 'earthquake', tpl: 'quake' },
  // Unleash plays a ring and a quake at the same spot: drawn on the ring only
  'sw_unleash/sw_nova': { skill: 'sw_unleash', tpl: 'unleash', y: 0.5 },
  'gs_rocketrain/gs_blast': { skill: 'gs_rocketrain', tpl: 'rocket' },
  'gs_explosive/gs_blast': { skill: 'gs_explosive', tpl: 'blastBig', y: 0.5 },
  'headshot/headshot_hit': { skill: 'headshot', tpl: 'headshot', y: 1 },
  // the main blast (size 3) and the bomblets (1.5)
  'gs_cluster/gs_blast': { skill: 'gs_cluster', tpl: (size) => (size >= 2.2 ? 'blastBig' : 'blastSmall'), y: 0.5 },

  // ---- Swordsman (owner 2026-11-19: every skill). Blade line
  'sw_heavyslash/sw_cleave': { skill: 'sw_heavyslash', tpl: 'swHeavy', y: 0.9 },
  'sw_sunder/sw_armorhit': { skill: 'sw_sunder', tpl: 'swShatter', y: 0.9 },
  'sw_swordwave/slash': { skill: 'sw_swordwave', tpl: 'swWave', y: 0.9 },
  'sw_execute/sw_cleave_red': { skill: 'sw_execute', tpl: 'swExecute', y: 0.9 },
  'sw_flurry/sw_cleave': { skill: 'sw_flurry', tpl: 'swFlurry', y: 0.9 },
  'sw_bladering/sw_nova': { skill: 'sw_bladering', tpl: 'swBladeRing', y: 0.5 },
  'sw_crush/crater': { skill: 'sw_crush', tpl: 'swCrush' },
  // Gale line
  'charge/charge': { skill: 'charge', tpl: 'swCharge', y: 0.7 },
  'sw_triple/slash': { skill: 'sw_triple', tpl: 'swTripleHit', y: 0.9 },
  'sw_triple/sw_windring': { skill: 'sw_triple', tpl: 'swWind', y: 0.7 },
  'sw_backstep/sw_streak': { skill: 'sw_backstep', tpl: 'swTrail', y: 0.6 },
  'sw_hunt/sw_streak': { skill: 'sw_hunt', tpl: 'swTrail', y: 0.6 },
  'sw_spindodge/sw_windring': { skill: 'sw_spindodge', tpl: 'swWind', y: 0.7 },
  'sw_bladedance/sw_windring': { skill: 'sw_bladedance', tpl: 'swWindSmall', y: 0.7 },
  'sw_shadowstep/sw_streak': { skill: 'sw_shadowstep', tpl: 'swShadowTrail', y: 0.6 },
  'sw_overdrive/sw_aura': { skill: 'sw_overdrive', tpl: 'swOverdrive' },
  'sw_shadowswap/sw_xslash': { skill: 'sw_shadowswap', tpl: 'swXHit', y: 0.9 },
  'sw_thousandcuts/sw_xslash': { skill: 'sw_thousandcuts', tpl: 'swXTiny', y: 0.9 },
  // Bulwark line
  'sw_armorbash/sw_armorhit': { skill: 'sw_armorbash', tpl: 'swBash', y: 0.9 },
  'sw_taunt/sw_shout': { skill: 'sw_taunt', tpl: 'swTaunt', y: 0.5 },
  'sw_guard/sw_barrier': { skill: 'sw_guard', tpl: 'swGuard' },
  'sw_shockwave/sw_crack': { skill: 'sw_shockwave', tpl: 'swShock' },
  'sw_thorns/sw_armorhit': { skill: 'sw_thorns', tpl: 'swThorns', y: 0.8 },
  'sw_anchor/sw_barrier': { skill: 'sw_anchor', tpl: 'swAnchor' },
  'sw_warcry/sw_shout': { skill: 'sw_warcry', tpl: 'swWarcry', y: 0.5 },
  'sw_cataclysm/quake': { skill: 'sw_cataclysm', tpl: 'swCata' },
  'sw_unbreakable/sw_shout': { skill: 'sw_unbreakable', tpl: 'swKing', y: 0.5 },
};

/**
 * Cues for what the Sim plays no picture for: the basic attack and the dash. The Sim sends a burst of 0 particles
 * tagged with the skill (`quarksCue`, src/shared/sim/skills.ts: colour = the caster's class, speed = the angle); the
 * old effects draw nothing for it. Keyed by the skill id, and `dash/<class>` since every class has the same dash.
 */
export const ON_CUE: Record<string, QuarksHook> = {
  'slash': { skill: 'slash', tpl: 'swSlashLite', y: 0.9, fwd: 1.5 },
  'dash/sword': { skill: 'dash', tpl: 'swDash', y: 0.3 },
};

export const cueKey = (skill: string, cls: string): string => (skill === 'dash' ? `dash/${cls}` : skill);
