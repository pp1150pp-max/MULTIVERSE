// Mage passives (owner 2026-11-14). Numbers are the skills' params (src/shared/data/classes.ts), tuned on /admin.
import type { PassiveHooks } from '../passives';

export const MAGE_PASSIVES: Record<string, PassiveHooks> = {
  // More damage to monsters under any status.
  mg_elementmastery: {
    dealMult: (p, m, v) => (m.hasStatus(p.simTime()) ? 1 + v('bonus') / 100 : 1),
  },
  // More max MP and MP regen.
  mg_manasource: {
    stats: (_p, s, v) => {
      s.maxMp *= 1 + v('maxMp') / 100;
      s.mpRegen *= 1 + v('mpRegen') / 100;
    },
  },
  // More damage, less max HP.
  mg_arcanepower: {
    dealMult: (_p, _m, v) => 1 + v('bonus') / 100,
    stats: (_p, s, v) => {
      s.maxHp *= Math.max(0.05, 1 - v('hpCut') / 100);
    },
  },
};
