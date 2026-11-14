// Swordsman passives (owner approved 2026-11-14). Numbers are the passives' SkillDef.params in data/swordSkills.ts;
// the % ones grow +5% of the value a rank (status %/rank).
import type { PassiveHooks } from '../passives';
import type { Player } from '../sim/Player';

/** Light Feet: sim time each player's damage bonus after a dash runs until. Never saved. */
const lightFeetUntil = new WeakMap<Player, number>();
/** When each player's passive last showed its effect: shown at most every so often, not on every hit. */
const shownAt = new WeakMap<Player, number>();
function showEvery(p: Player, every: number): boolean {
  const t = p.simTime();
  if (t < (shownAt.get(p) ?? -99) + every) return false;
  shownAt.set(p, t);
  return true;
}

export const SWORD_PASSIVES: Record<string, PassiveHooks> = {
  // Duelist: more damage while few monsters are close (bosses, single fights).
  sw_duelist: {
    dealMult(p, m, v) {
      if (p.monstersNear(v('area')) > v('near')) return 1;
      // A small gold crossed-blades flash on the target while the bonus is on (owner 2026-11-15).
      if (showEvery(p, 1.5)) p.effectAt('sw_xslash_gold', m.x, m.z, 0, 0.7);
      return 1 + v('dmg') / 100;
    },
  },
  // Light Feet: after any dash (plain or a skill's), more damage for a few seconds; the plain dash comes back sooner.
  sw_lightfeet: {
    onDash(p, v) {
      lightFeetUntil.set(p, p.simTime() + v('time'));
      if (showEvery(p, 1)) p.effectAt('sw_aura', p.x, p.z, 0, 0.8);
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
      if (p.hp >= p.maxHp * (v('lowHp') / 100)) return 1;
      // The golden barrier flashes when it saves the player some damage.
      if (showEvery(p, 2)) p.effectAt('sw_barrier', p.x, p.z, 0, 0.9);
      return Math.max(0.05, 1 - v('less') / 100);
    },
  },
};
