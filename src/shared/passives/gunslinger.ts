// Gunslinger passives (owner approved 2026-11-14). Numbers are the passives' SkillDef.params in data/classes.ts.
import type { PassiveHooks } from '../passives';

/** The Special Weapons line (index in ClassDef.lines). */
export const SPECIAL_LINE = 2;

export const GUNSLINGER_PASSIVES: Record<string, PassiveHooks> = {
  // Hawkeye: crit chance and crit damage.
  gs_hawkeye: {
    stats(_p, s, v) {
      s.crit += v('crit');
      s.critDmg += v('critDmg');
    },
  },
  // Trigger Finger: attack speed and move speed.
  gs_triggerfinger: {
    stats(_p, s, v) {
      s.atkSpeed += v('atkSpeed');
      s.moveSpeed += v('moveSpeed');
    },
  },
  // Special Ammo: Special Weapons skills hit harder and blow up bigger.
  gs_specialammo: {
    skillScale(_p, sk, v) {
      if (sk.line !== SPECIAL_LINE) return {};
      return { dmg: 1 + v('dmg') / 100, area: 1 + v('area') / 100 };
    },
  },
};
