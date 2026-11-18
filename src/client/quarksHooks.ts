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
  /** Same, in multiples of the picture's size (-1 = back to where a cone's picture starts: its size is half its reach). */
  fwdSize?: number;
  /** Scale the template (drawn on a circle of radius 1) by the picture's size: its radius. */
  scale?: boolean;
  /** A zone's field: keeps going as long as the zone does (not for a zone that follows a player). */
  timed?: boolean;
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

  // ---- Mage. Line 0
  'mg_chainlightning/mg_lightning': { skill: 'mg_chainlightning', tpl: 'mgChain', y: 1 },
  'mg_manaburst/mg_burst': { skill: 'mg_manaburst', tpl: 'mgBurst', y: 0.4, scale: true },
  'mg_flamewave/mg_flamewave': { skill: 'mg_flamewave', tpl: 'mgFlameWave', y: 0.8, fwdSize: -1 },
  'mg_volatileorb/explosion': { skill: 'mg_volatileorb', tpl: 'mgOrbBlast', y: 0.6 },
  'mg_crystalrain/mg_starhit': { skill: 'mg_crystalrain', tpl: 'mgCrystalHit' },
  'mg_chargedblast/mg_burst': { skill: 'mg_chargedblast', tpl: 'mgCharged', y: 0.4, scale: true },
  // Line 1
  'mg_searingmark/mg_curse': { skill: 'mg_searingmark', tpl: 'mgMark', y: 1 },
  'mg_thunderstorm/mg_lightning': { skill: 'mg_thunderstorm', tpl: 'mgZap', y: 1 },
  'mg_cursedash/mg_ash': { skill: 'mg_cursedash', tpl: 'mgAsh', y: 0.8, fwdSize: -1 },
  'mg_hexseed/explosion': { skill: 'mg_hexseed', tpl: 'mgHexBlast', y: 0.5 },
  // Line 2
  'mg_forcewave/mg_shock': { skill: 'mg_forcewave', tpl: 'mgShock', y: 0.4 },
  'mg_icecage/frost': { skill: 'mg_icecage', tpl: 'mgIceHit', y: 0.9 },
  'mg_gravitywell/mg_burst': { skill: 'mg_gravitywell', tpl: 'mgBurst', y: 0.4, scale: true },
};

/**
 * A skill's zone (a lasting area, Effects.zone) → the template. `timed` = a field that goes on for the zone's
 * duration; the others play once when the zone starts (a zone that follows a player never gets a timed one).
 */
export const ON_ZONE: Partial<Record<`${QuarksSkill}/${SkillEffect}`, QuarksHook>> = {
  'mg_flameground/mg_firefield': { skill: 'mg_flameground', tpl: 'mgFireField', y: 0.2, scale: true, timed: true },
  'mg_poisonmist/mg_poison': { skill: 'mg_poisonmist', tpl: 'mgMist', y: 0.3, scale: true, timed: true },
  'mg_decayring/mg_decay': { skill: 'mg_decayring', tpl: 'mgDecayRing', y: 0.3, scale: true },
  'mg_hexseed/mg_poison': { skill: 'mg_hexseed', tpl: 'mgMist', y: 0.3, scale: true, timed: true },
  'mg_decayfield/mg_decay': { skill: 'mg_decayfield', tpl: 'mgDecayField', y: 0.3, scale: true },
  'mg_frailcurse/mg_curse': { skill: 'mg_frailcurse', tpl: 'mgFrail', y: 0.3, scale: true },
  'mg_gravitywell/mg_vortex': { skill: 'mg_gravitywell', tpl: 'mgVortex', y: 0.3, scale: true, timed: true },
  'mg_sealveil/mg_curse': { skill: 'mg_sealveil', tpl: 'mgVeil', y: 0.3, scale: true },
  'mg_empowerfield/mg_empower': { skill: 'mg_empowerfield', tpl: 'mgEmpower', y: 0.3, scale: true },
  'mg_manashield/mg_shield': { skill: 'mg_manashield', tpl: 'mgShield', y: 0.3, scale: true },
  'mg_timewarp/mg_timewarp': { skill: 'mg_timewarp', tpl: 'mgTimewarp', y: 0.3, scale: true },
  'mg_manawell/mg_shield': { skill: 'mg_manawell', tpl: 'mgManaWell', y: 0.3, scale: true, timed: true },
};

/**
 * Cues for what the Sim plays no picture for: the basic attack and the dash. The Sim sends a burst of 0 particles
 * tagged with the skill (`quarksCue`, src/shared/sim/skills.ts: colour = the caster's class, speed = the angle); the
 * old effects draw nothing for it. Keyed by the skill id, and `dash/<class>` since every class has the same dash.
 */
export const ON_CUE: Record<string, QuarksHook> = {
  'slash': { skill: 'slash', tpl: 'swSlashLite', y: 0.9, fwd: 1.5 },
  'dash/sword': { skill: 'dash', tpl: 'swDash', y: 0.3 },
  'bolt': { skill: 'bolt', tpl: 'mgBolt', y: 1, fwd: 0.9 },
  'dash/mage': { skill: 'dash', tpl: 'mgDash', y: 0.3 },
  // no picture of their own: the Sim sends a cue where they land (quarksCue)
  'mg_arcanelance': { skill: 'mg_arcanelance', tpl: 'mgLance', y: 1, fwd: 1 },
  'mg_crystalspikes': { skill: 'mg_crystalspikes', tpl: 'mgSpikes', y: 0.8 },
};

export const cueKey = (skill: string, cls: string): string => (skill === 'dash' ? `dash/${cls}` : skill);
