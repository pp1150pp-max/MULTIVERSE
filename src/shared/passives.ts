// What the worn passive does (owner 2026-11-14: 3 passives a class, one worn at a time, ranked like skills).
// Shared core of the hook the three class PRs agreed on: each class writes its passives in passives/<class>.ts and
// the Sim and Player only call the functions here. A passive's numbers are its SkillDef.params (tuned on /admin);
// `status` ones grow by the skill's status %/rank.
import type { Player } from './sim/Player';
import type { Monster } from './sim/Monster';
import type { SkillDef } from './data/classes';
import type { Stats } from './types';
import { learnable, rankOf, skillParam } from './skillBook';
import { SWORD_PASSIVES } from './passives/sword';

/** One of the worn passive's numbers at its rank. */
export type PassiveValue = (key: string) => number;

/** What a passive may change. Every hook is optional. */
export interface PassiveHooks {
  /** Adds to the player's stats (in Player.recompute, after the class multipliers). */
  stats?(p: Player, s: Stats, v: PassiveValue): void;
  /** × damage dealt to `m` (Sim.hitMonster). */
  dealMult?(p: Player, m: Monster, v: PassiveValue): number;
  /** × damage taken (Sim.hitPlayer). */
  takenMult?(p: Player, v: PassiveValue): number;
  /** A skill of this player's was just cast (Player.update). */
  onCast?(p: Player, sk: SkillDef, v: PassiveValue): void;
  /** This player landed a killing blow on `m` (Player.onKill). */
  onKill?(p: Player, m: Monster, v: PassiveValue): void;
  /** The player started a dash, plain or a skill's (Player.startDash). */
  onDash?(p: Player, v: PassiveValue): void;
  /** How a skill is cast: × its damage and × the size of its blasts and areas (castSkill). */
  skillScale?(p: Player, sk: SkillDef, v: PassiveValue): { dmg?: number; area?: number };
  /** × the dash's cooldown (Player.update, the plain dash). */
  dashCdMult?(p: Player, v: PassiveValue): number;
}

/** Every class's passives by skill id. Each class PR adds its own file here. */
const HOOKS: Record<string, PassiveHooks> = {
  ...SWORD_PASSIVES,
};

/** The passive this player wears, with its hooks and numbers, if any. */
function worn(p: Player): { h: PassiveHooks; v: PassiveValue } | undefined {
  const id = p.skillBook.worn.passive;
  if (!id) return undefined;
  const h = HOOKS[id];
  const sk = learnable(p.cls.id, id);
  const rank = rankOf(p.skillBook, id);
  if (!h || !sk || rank < 1) return undefined;
  return { h, v: (key) => skillParam(sk, key, rank) };
}

export function passiveStats(p: Player, s: Stats): void {
  const w = worn(p);
  w?.h.stats?.(p, s, w.v);
}

export function passiveDealMult(p: Player, m: Monster): number {
  const w = worn(p);
  return w?.h.dealMult?.(p, m, w.v) ?? 1;
}

export function passiveTakenMult(p: Player): number {
  const w = worn(p);
  return w?.h.takenMult?.(p, w.v) ?? 1;
}

export function passiveOnCast(p: Player, sk: SkillDef): void {
  const w = worn(p);
  w?.h.onCast?.(p, sk, w.v);
}

export function passiveOnKill(p: Player, m: Monster): void {
  const w = worn(p);
  w?.h.onKill?.(p, m, w.v);
}

export function passiveOnDash(p: Player): void {
  const w = worn(p);
  w?.h.onDash?.(p, w.v);
}

export function passiveSkillScale(p: Player, sk: SkillDef): { dmg: number; area: number } {
  const w = worn(p);
  const r = w?.h.skillScale?.(p, sk, w.v);
  return { dmg: r?.dmg ?? 1, area: r?.area ?? 1 };
}

export function passiveDashCdMult(p: Player): number {
  const w = worn(p);
  return w?.h.dashCdMult?.(p, w.v) ?? 1;
}
