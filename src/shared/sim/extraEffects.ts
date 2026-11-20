// Extra effects the owner adds to a skill or a basic attack on the /admin "ระบบสกิล" tab (owner 2026-11-20,
// src/shared/skillTuning.ts EXTRA_DEF). Sim.hitMonster calls withExtras on every player hit that carries a skill id
// (HitOpts.src / skill / the skill running now), so every hit of the skill gives them: each tick, bullet, wave, and the
// hits of its summons (turret, drone, mine), which run under the caster's skill.
//
// Rules:
// - Target: "mob" = normal monsters only (boss minions are normal), "boss" = bosses only, "all" = both.
// - Merged into the hit's own options before hitMonster applies them, so the boss rules stay as they are: bosses take
//   30% of a stun, pattern bosses ignore stuns, knockback never moves a boss.
// - Same effect as the skill's own (stun, slow, armor break, attack down, knockback): the stronger one wins, and its
//   time with it (equal strength = the longer time).
// - Stun: the same monster is stunned again by the same skill's extra stun only `extraStunGap` seconds after the last
//   one began (code 2 s), so many-hit skills cannot keep it stunned.
// - Burn/poison: one per monster, player and skill; a new hit while it burns refreshes the time and keeps the stronger
//   damage (it never stacks with itself). Its ticks give no extra effects. It does stack with the skill's own burn.
import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import type { HitOpts } from './types';
import { currentBalance } from '../balance';
import { skillExtras } from '../skillTuning';

/** Launch speed of a knockback per metre it should travel (Unit.tickStatus decays it by exp(-10t)). */
const KB_PER_METRE = 10;
const BURN_COLOR = '#ff9a3a';

/** The hit's options with this skill's extra effects merged in (the same object when the skill has none). */
export function withExtras(sim: Sim, p: Player, m: Monster, src: string, opts: HitOpts): HitOpts {
  const cfg = currentBalance().skills;
  const list = skillExtras(cfg, src);
  if (!list.length) return opts;
  const o: HitOpts = { ...opts };
  for (const e of list) {
    if (e.to === 'mob' ? m.isBoss : e.to === 'boss' ? !m.isBoss : false) continue;
    if (e.v <= 0) continue;
    switch (e.k) {
      case 'stun': {
        const last = m.extraStunAt.get(src);
        if (last !== undefined && sim.time - last < cfg.extraStunGap) break;
        m.extraStunAt.set(src, sim.time);
        o.stun = Math.max(o.stun ?? 0, e.v);
        break;
      }
      case 'slow': {
        const [a, t] = stronger(o.slow, o.slowT ?? 2, e.v / 100, e.t);
        o.slow = a;
        o.slowT = t;
        break;
      }
      case 'armor': {
        const [a, t] = stronger(o.armorBreak, o.armorBreakT ?? 3, e.v / 100, e.t);
        o.armorBreak = a;
        o.armorBreakT = t;
        break;
      }
      case 'weak': {
        const [a, t] = stronger(o.weak, o.weakT ?? 3, e.v / 100, e.t);
        o.weak = a;
        o.weakT = t;
        break;
      }
      case 'kb':
        // The box is in metres, but a knockback is a launch speed that dies away (Unit.knockback: exp(-10t)), so it
        // travels speed / 10 metres: launch at v × 10 to really move v metres.
        o.kb = Math.max(o.kb ?? 0, e.v * KB_PER_METRE);
        break;
      case 'dot':
        burn(sim, p, m, src, e.v, e.t);
        break;
    }
  }
  return o;
}

/** [strength, seconds] of the stronger of the hit's own effect and the extra one (equal = the longer time). */
function stronger(own: number | undefined, ownT: number, v: number, t: number): [number, number] {
  if (!own || v > own) return [v, t];
  if (v === own) return [own, Math.max(ownT, t)];
  return [own, ownT];
}

/** Burning / poison: `mult` × ATK every second for `secs` seconds through hitMonster (crit, boss rules, aggro). */
function burn(sim: Sim, p: Player, m: Monster, src: string, mult: number, secs: number): void {
  const key = `${p.id}:${src}`;
  const until = sim.time + secs;
  m.dotUntil = Math.max(m.dotUntil, until);
  const run = m.extraDots.get(key);
  if (run) {
    run.until = Math.max(run.until, until);
    run.mult = Math.max(run.mult, mult);
    return;
  }
  const d = { until, mult };
  m.extraDots.set(key, d);
  // Ticks 1 s apart from 1 s after the hit; half a second of slack for timers that land a frame late.
  const tick = (): void => {
    if (!m.alive || !p.alive || !sim.players.includes(p) || sim.time > d.until + 0.5) {
      m.extraDots.delete(key);
      return;
    }
    sim.hitMonster(p, m, d.mult, { noExtra: true });
    sim.fx('puff', m.x, 0.9, m.z, BURN_COLOR, 0.5, 0.5);
    if (sim.time + 1 <= d.until + 0.5) sim.schedule(1, tick);
    else m.extraDots.delete(key);
  };
  sim.schedule(1, tick);
}
