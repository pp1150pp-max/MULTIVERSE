// Weapon enhancement (ตีบวก) at the blacksmith. Pure rules, no rendering — the server can reuse it.
import type { Item, StatKey, Stats } from '../types';
import type { Rng } from '../rng';

export const MAX_PLUS = 10;
/** Attempts that aim for this level or higher lose one + level when they fail. */
export const DROP_ON_FAIL_FROM = 7;

// Indexed by + level.
const ATK_MULT = [0, 0.08, 0.16, 0.25, 0.35, 0.46, 0.58, 0.72, 0.88, 1.06, 1.3];
const CRIT_BONUS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
/** Chance to succeed when trying to reach this + level. */
const SUCCESS = [1, 1, 1, 1, 1, 1, 0.9, 0.75, 0.6, 0.45, 0.3];

export type EnhanceResult = 'success' | 'fail' | 'drop';

export const plusOf = (item: Item): number => item.plus ?? 0;
export const canEnhance = (item: Item): boolean => item.slot === 'weapon' && plusOf(item) < MAX_PLUS;

export function itemName(item: Item): string {
  const p = plusOf(item);
  return p ? `+${p} ${item.name}` : item.name;
}

/** Extra attack (a share of the weapon's own attack plus 1 per level) and crit chance. */
export function enhanceBonus(item: Item, plus = plusOf(item)): Partial<Stats> {
  if (plus <= 0 || item.slot !== 'weapon') return {};
  const atk = item.stats.atk ?? 0;
  return { atk: Math.round(atk * ATK_MULT[plus]) + plus, crit: CRIT_BONUS[plus] };
}

/** Item stats including the enhancement bonus. */
export function effectiveStats(item: Item, plus = plusOf(item)): Partial<Stats> {
  const out: Partial<Stats> = { ...item.stats };
  const bonus = enhanceBonus(item, plus);
  for (const k of Object.keys(bonus) as StatKey[]) out[k] = (out[k] ?? 0) + (bonus[k] ?? 0);
  return out;
}

export function successRate(item: Item): number {
  return SUCCESS[Math.min(MAX_PLUS, plusOf(item) + 1)];
}

export function enhanceCost(item: Item): number {
  return Math.round((15 + item.level * 6) * Math.pow(plusOf(item) + 1, 1.7));
}

export function dropsOnFail(item: Item): boolean {
  return plusOf(item) + 1 >= DROP_ON_FAIL_FROM;
}

/** Rolls one attempt and updates `item.plus`. Gold is handled by the caller. */
export function rollEnhance(item: Item, r: Rng): EnhanceResult {
  const cur = plusOf(item);
  if (r() < successRate(item)) {
    item.plus = cur + 1;
    return 'success';
  }
  if (dropsOnFail(item)) {
    item.plus = cur - 1;
    return 'drop';
  }
  return 'fail';
}

/** What the merchant pays. Enhanced weapons are worth more. */
export function sellValue(item: Item): number {
  return Math.round(item.value * (1 + 0.5 * plusOf(item)));
}
