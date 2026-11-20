// Gear enhancement (ตีบวก) at the blacksmith. Pure rules, no rendering — the server runs it.
// Owner decisions 2026-11-06: every slot, max +15, bonus = % of every stat line on the item.
// Every number is tunable in /admin (forgeTuning.ts); the code values are in codeForge().
import { EQUIP_SLOTS, type EquipSlot, type Item, type StatKey, type Stats } from '../types';
import type { Rng } from '../rng';
import { currentBalance } from '../balance';
import { PLUS_CAP, PLUS_NEVER, type ForgeConfig } from '../forgeTuning';

/** The /admin-tuned enhancement numbers in use (forgeTuning.ts, owner 2026-11-20: every number tunable). */
export const forgeConfig = (): ForgeConfig => currentBalance().forge;
export { PLUS_CAP, PLUS_NEVER };
/** Highest level the blacksmith enhances to now. Gear already above it (after the owner lowers it) keeps its level. */
export const maxPlus = (): number => forgeConfig().maxPlus;
/** Seconds between two blacksmith actions (enhance or reroll) by the same player. */
export const forgeCd = (): number => forgeConfig().cd;
/** Reaching this level or higher is announced to the whole server. */
export const announceFrom = (): number => forgeConfig().announceFrom;
/** Each failed attempt adds this to the item's next success chance (0..1), until it succeeds. */
export const pityStep = (): number => forgeConfig().pity / 100;
/** Each worn item at this + level or higher gets an orb circling its wearer (owner 2026-11-10: +7). */
export const orbMinPlus = (): number => forgeConfig().orbMin;

/** Stats shown as whole numbers; the rest (%, regen) keep one decimal. */
const WHOLE: ReadonlySet<StatKey> = new Set<StatKey>(['maxHp', 'maxMp', 'atk', 'def']);

/** success: +1 · fail: level kept · drop: level −1 · saved: would have dropped, the protection stone kept it. */
export type EnhanceResult = 'success' | 'fail' | 'drop' | 'saved';

export const plusOf = (item: Item): number => item.plus ?? 0;
export const canEnhance = (item: Item): boolean => plusOf(item) < maxPlus();

export function itemName(item: Item): string {
  const p = plusOf(item);
  return p ? `+${p} ${item.name}` : item.name;
}

/** Total bonus percent at this + level. */
export function bonusPct(plus: number): number {
  const step = forgeConfig().bonusStep;
  const top = Math.max(0, Math.min(PLUS_CAP, plus));
  let sum = 0;
  for (let i = 1; i <= top; i++) sum += step[i];
  return Math.round(sum * 1000) / 1000;
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
  return rateFor(Math.min(PLUS_CAP, plusOf(item) + 1));
}

/** Extra chance from earlier fails on this item. */
export function pityBonus(item: Item): number {
  return baseRate(item) >= 1 ? 0 : Math.max(0, item.pity ?? 0) * pityStep();
}

export function successRate(item: Item): number {
  return Math.min(1, baseRate(item) + pityBonus(item));
}

/** Rate table for the forge's help panel (index = target level). */
export function rateFor(target: number): number {
  const r = forgeConfig().rate[target];
  return r === undefined ? 0 : r / 100;
}

export function enhanceCost(item: Item): number {
  const f = forgeConfig();
  return Math.round((f.costBase + item.level * f.costPerLevel) * f.costMult[Math.min(PLUS_CAP, plusOf(item) + 1)]);
}

export function dropsOnFail(item: Item): boolean {
  // Never below +0 (the owner may set the drop level to +1).
  return plusOf(item) > 0 && plusOf(item) + 1 >= forgeConfig().dropFrom;
}

/** Enhancement stones the next attempt needs. */
export function stonesNeeded(item: Item): number {
  const f = forgeConfig();
  return plusOf(item) + 1 >= f.stoneFrom ? f.stonesPerTry : 0;
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

/** Aura tier shown around a character for this + level: 0 none, then 1..4 from the tuned levels (code +7/+10/+13/+15). */
export function auraTier(plus: number): number {
  return forgeConfig().aura.filter((from) => plus >= from).length;
}

/**
 * The enhancement orbs a character shows: one per worn item at orbMinPlus() or higher, in EQUIP_SLOTS
 * order, each packed as `slot index * 16 + plus` (so the browser knows the slot as well as the level).
 */
export function orbCodes(equipment: Partial<Record<EquipSlot, Item>>): number[] {
  const out: number[] = [];
  const min = orbMinPlus();
  EQUIP_SLOTS.forEach((slot, i) => {
    const it = equipment[slot];
    const p = it ? Math.min(PLUS_CAP, plusOf(it)) : 0;
    if (p > 0 && p >= min) out.push(i * 16 + p);
  });
  return out;
}

/** Unpacks an orb code from orbCodes: the EQUIP_SLOTS index and the + level. */
export const orbSlot = (code: number): number => code >> 4;
export const orbPlus = (code: number): number => code & 15;

/** True when `code` is a well-formed orb code (a real slot, a level 1..PLUS_CAP; the server picks which levels show). */
export function validOrbCode(code: unknown): code is number {
  return typeof code === 'number' && Number.isInteger(code) && orbSlot(code) < EQUIP_SLOTS.length
    && orbPlus(code) >= 1 && orbPlus(code) <= PLUS_CAP && code >= 0;
}

/** What the merchant pays. Enhanced gear is worth more (code: +50% per level). */
export function sellValue(item: Item): number {
  return Math.round(item.value * (1 + (forgeConfig().sellPerPlus / 100) * plusOf(item)));
}
