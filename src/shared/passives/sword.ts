// Swordsman passives (owner approved 2026-11-14). Numbers are the passives' SkillDef.params in data/swordSkills.ts;
// the % ones grow +5% of the value a rank (status %/rank).
import type { PassiveHooks } from '../passives';
import type { Player } from '../sim/Player';

/** Light Feet: sim time each player's damage bonus after a dash runs until. Never saved. */
const lightFeetUntil = new WeakMap<Player, number>();

export const SWORD_PASSIVES: Record<string, PassiveHooks> = {
  // Duelist: more damage while few monsters are close (bosses, single fights).
  sw_duelist: {
    dealMult(p, _m, v) {
      return p.monstersNear(v('area')) <= v('near') ? 1 + v('dmg') / 100 : 1;
    },
  },
  // Light Feet: after any dash (plain or a skill's), more damage for a few seconds; the plain dash comes back sooner.
  sw_lightfeet: {
    onDash(p, v) {
      lightFeetUntil.set(p, p.simTime() + v('time'));
    },
    dealMult(p, _m, v) {
      return p.simTime() < (lightFeetUntil.get(p) ?? -1) ? 1 + v('dmg') / 100 : 1;
    },
    dashCdMult(_p, v) {
      return Math.max(0.1, 1 - v('dashCd') / 100);
    },
  },
  // Iron Hide: more defense; at low HP, less damage taken on top.
  sw_ironhide: {
    stats(_p, s, v) {
      s.def *= 1 + v('def') / 100;
    },
    takenMult(p, v) {
      return p.hp < p.maxHp * (v('lowHp') / 100) ? Math.max(0.05, 1 - v('less') / 100) : 1;
    },
  },
};
