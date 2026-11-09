// Gear enhancement (ตีบวก) at the blacksmith. Pure rules, no rendering — the server runs it.
// Owner decisions 2026-11-06: every slot, max +15, bonus = % of every stat line on the item.
import { EQUIP_SLOTS, type EquipSlot, type Item, type StatKey, type Stats } from '../types';
import type { Rng } from '../rng';

export const MAX_PLUS = 15;
/** Attempts that aim for this level or higher lose one + level when they fail (unless protected). */
export const DROP_ON_FAIL_FROM = 7;
/** Attempts that aim for this level or higher also use enhancement stones. */
export const STONE_FROM = 11;
/** Enhancement stones used per attempt from STONE_FROM up (owner: 1). */
export const ENHANCE_STONES_PER_TRY = 1;
/** Each failed attempt adds this to the item's next success chance, until it succeeds (owner: +1%). */
export const PITY_STEP = 0.01;
/** Reaching this level or higher is announced to the whole server. */
export const ANNOUNCE_FROM = 10;

/** Bonus % of each stat line gained by reaching this level (index = + level). +5 = 20%, +10 = 45%, +15 = 95%. */
const STEP_PCT = [0, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 10, 10, 10, 10, 10];
/** Total bonus % at each + level. */
const TOTAL_PCT = STEP_PCT.map((_, i) => STEP_PCT.slice(0, i + 1).reduce((a, b) => a + b, 0));
/** Chance to succeed when trying to reach this + level. Owner 2026-11-08: +1..+4 100%, +5..+7 40%, +8..+9 20%, +10 10%; +11..+15 unchanged. */
const SUCCESS = [1, 1, 1, 1, 1, 0.4, 0.4, 0.4, 0.2, 0.2, 0.1, 0.15, 0.1, 0.05, 0.025, 0.01];
/** Cost multiplier for reaching this + level (times the item's base cost). */
const COST_MULT = [0, 1, 2, 3, 4, 5, 7, 9, 12, 15, 20, 30, 40, 55, 75, 100];
/** Stats shown as whole numbers; the rest (%, regen) keep one decimal. */
const WHOLE: ReadonlySet<StatKey> = new Set<StatKey>(['maxHp', 'maxMp', 'atk', 'def']);

/** success: +1 · fail: level kept · drop: level −1 · saved: would have dropped, the protection stone kept it. */
export type EnhanceResult = 'success' | 'fail' | 'drop' | 'saved';

export const plusOf = (item: Item): number => item.plus ?? 0;
export const canEnhance = (item: Item): boolean => plusOf(item) < MAX_PLUS;

export function itemName(item: Item): string {
  const p = plusOf(item);
  return p ? `+${p} ${item.name}` : item.name;
}

/** Total bonus percent at this + level. */
export function bonusPct(plus: number): number {
  return TOTAL_PCT[Math.max(0, Math.min(MAX_PLUS, plus))];
}

function roundStat(k: StatKey, v: number): number {
  return WHOLE.has(k) ? Math.round(v) : Math.round(v * 10) / 10;
}

/** Extra stats from enhancement: the same percent of every stat line on the item. */
export function enhanceBonus(item: Item, plus = plusOf(item)): Partial<Stats> {
  const pct = bonusPct(plus) / 100;
  if (pct <= 0) return {};
  const out: Partial<Stats> = {};
  for (const k of Object.keys(item.stats) as StatKey[]) {
    const v = roundStat(k, (item.stats[k] ?? 0) * pct);
    if (v) out[k] = v;
  }
  return out;
}

/** Item stats including the enhancement bonus. */
export function effectiveStats(item: Item, plus = plusOf(item)): Partial<Stats> {
  const out: Partial<Stats> = { ...item.stats };
  const bonus = enhanceBonus(item, plus);
  for (const k of Object.keys(bonus) as StatKey[]) out[k] = (out[k] ?? 0) + (bonus[k] ?? 0);
  return out;
}

/** The table chance to reach the next level, before pity. */
export function baseRate(item: Item): number {
  return SUCCESS[Math.min(MAX_PLUS, plusOf(item) + 1)];
}

/** Extra chance from earlier fails on this item. */
export function pityBonus(item: Item): number {
  return baseRate(item) >= 1 ? 0 : Math.max(0, item.pity ?? 0) * PITY_STEP;
}

export function successRate(item: Item): number {
  return Math.min(1, baseRate(item) + pityBonus(item));
}

/** Rate table for the forge's help panel (index = target level). */
export function rateFor(target: number): number {
  return SUCCESS[target] ?? 0;
}

export function enhanceCost(item: Item): number {
  return Math.round((15 + item.level * 6) * COST_MULT[Math.min(MAX_PLUS, plusOf(item) + 1)]);
}

export function dropsOnFail(item: Item): boolean {
  return plusOf(item) + 1 >= DROP_ON_FAIL_FROM;
}

/** Enhancement stones the next attempt needs. */
export function stonesNeeded(item: Item): number {
  return plusOf(item) + 1 >= STONE_FROM ? ENHANCE_STONES_PER_TRY : 0;
}

/**
 * Rolls one attempt and updates `item.plus` and `item.pity`. Gold and stones are handled by the caller.
 * `protect` = a protection stone is used, so a fail that would drop keeps the level.
 */
export function rollEnhance(item: Item, r: Rng, protect: boolean): EnhanceResult {
  const cur = plusOf(item);
  if (r() < successRate(item)) {
    item.plus = cur + 1;
    delete item.pity;
    return 'success';
  }
  item.pity = (item.pity ?? 0) + 1;
  if (!dropsOnFail(item)) return 'fail';
  if (protect) return 'saved';
  item.plus = cur - 1;
  return 'drop';
}

/** Aura tier shown around a character for this + level: 0 none, 1 = +7, 2 = +10, 3 = +13, 4 = +15. */
export function auraTier(plus: number): number {
  return plus >= 15 ? 4 : plus >= 13 ? 3 : plus >= 10 ? 2 : plus >= 7 ? 1 : 0;
}

/** Each worn item at this + level or higher gets an orb circling its wearer (owner 2026-11-10). */
export const ORB_MIN_PLUS = 7;

/**
 * The enhancement orbs a character shows: one per worn item at ORB_MIN_PLUS or higher, in EQUIP_SLOTS
 * order, each packed as `slot index * 16 + plus` (so the browser knows the slot as well as the level).
 */
export function orbCodes(equipment: Partial<Record<EquipSlot, Item>>): number[] {
  const out: number[] = [];
  EQUIP_SLOTS.forEach((slot, i) => {
    const it = equipment[slot];
    const p = it ? Math.min(MAX_PLUS, plusOf(it)) : 0;
    if (p >= ORB_MIN_PLUS) out.push(i * 16 + p);
  });
  return out;
}

/** Unpacks an orb code from orbCodes: the EQUIP_SLOTS index and the + level. */
export const orbSlot = (code: number): number => code >> 4;
export const orbPlus = (code: number): number => code & 15;

/** True when `code` is a well-formed orb code (a real slot, a level from ORB_MIN_PLUS to MAX_PLUS). */
export function validOrbCode(code: unknown): code is number {
  return typeof code === 'number' && Number.isInteger(code) && orbSlot(code) < EQUIP_SLOTS.length
    && orbPlus(code) >= ORB_MIN_PLUS && orbPlus(code) <= MAX_PLUS && code >= 0;
}

/** What the merchant pays. Enhanced gear is worth more. */
export function sellValue(item: Item): number {
  return Math.round(item.value * (1 + 0.5 * plusOf(item)));
}
