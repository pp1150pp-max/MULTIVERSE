// Blacksmith rerolls (owner 2026-11-07, like Path of Exile 2's Divine and Chaos orbs, paid in gold).
// Pure rules: the rolls themselves are rerollValues / rerollStat in data/items.
import type { Item, Rarity } from '../types';

/** values = "สุ่มค่าตัวเลข" (every line, tiers kept) · stat = "สุ่มสเตตัส" (one extra line → a new stat). */
export type RerollKind = 'values' | 'stat';
export const REROLL_KINDS: RerollKind[] = ['values', 'stat'];

export const REROLL_NAME: Record<RerollKind, string> = {
  values: 'สุ่มค่าตัวเลข',
  stat: 'สุ่มสเตตัส',
};

/** Times the enhancement base cost (15 + iLv × 6) per reroll (owner: ×3 values, ×6 stat). */
const KIND_MULT: Record<RerollKind, number> = { values: 3, stat: 6 };
/** Times the cost by rarity (owner). */
const RARITY_COST: Record<Rarity, number> = { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 };

export function rerollCost(item: Item, kind: RerollKind): number {
  return Math.round((15 + item.level * 6) * KIND_MULT[kind] * RARITY_COST[item.rarity]);
}
