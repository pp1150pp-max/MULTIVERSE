// Gunslinger passives (owner approved 2026-11-14). Numbers are the passives' SkillDef.params in data/classes.ts.
import type { PassiveHooks } from '../passives';
import type { Player } from '../sim/Player';

/** Trigger Finger shows its flash every this many basic shots (owner 2026-11-15). */
export const TRIGGER_FX_EVERY = 4;
const shotsFired = new WeakMap<Player, number>();

/** The Special Weapons line (index in ClassDef.lines). */
export const SPECIAL_LINE = 2;

export const GUNSLINGER_PASSIVES: Record<string, PassiveHooks> = {
  // Hawkeye: crit chance and crit damage.
  gs_hawkeye: {
    stats(_p, s, v) {
      s.crit += v('crit');
      s.critDmg += v('critDmg');
    },
    // Its effect: the hawk eye over every monster this player crits.
    onCrit(sim, _p, m) {
      sim.fx('effect', 'gs_hawkeye', m.x, m.z, 0, 0.7);
    },
  },
  // Trigger Finger: attack speed and move speed.
  gs_triggerfinger: {
    stats(_p, s, v) {
      s.atkSpeed += v('atkSpeed');
      s.moveSpeed += v('moveSpeed');
    },
    // Its effect: a flash at the gun every few basic shots.
    onBasic(sim, p) {
      const n = (shotsFired.get(p) ?? 0) + 1;
      shotsFired.set(p, n % TRIGGER_FX_EVERY);
      if (n % TRIGGER_FX_EVERY === 0) {
        const a = p.aimAngle();
        sim.fx('effect', 'gs_trigger', p.x + Math.cos(a) * 0.8, p.z + Math.sin(a) * 0.8, a, 0.5);
      }
    },
  },
  // Special Ammo: Special Weapons skills hit harder and blow up bigger. Its ring on those blasts is drawn by castSkill.
  gs_specialammo: {
    skillScale(_p, sk, v) {
      if (sk.line !== SPECIAL_LINE) return {};
      return { dmg: 1 + v('dmg') / 100, area: 1 + v('area') / 100 };
    },
  },
};
