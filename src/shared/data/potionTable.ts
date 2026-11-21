// The code's own potion numbers (owner 2026-11-17). Kept apart from potions.ts so balance.ts can read them
// without a circular import. Nothing else should read this table: use potionAmount / potionPrice / potionHeal
// in potions.ts, which follow the /admin balance tuning.
import type { PotionKind, PotionSize } from '../types';

export type PotionNums = { amount: number; price: number };

/** Heal 100 / 500 / 1,000 for HP and MP alike; prices scale with the heal (the old price per point healed). */
export const CODE_POTIONS: Record<PotionKind, Record<PotionSize, PotionNums>> = {
  hp: { s: { amount: 100, price: 25 }, m: { amount: 500, price: 125 }, l: { amount: 1000, price: 220 } },
  mp: { s: { amount: 100, price: 40 }, m: { amount: 500, price: 208 }, l: { amount: 1000, price: 367 } },
};
/** Swordsmen's HP potions heal this many % more (owner 2026-11-09). */
export const CODE_SWORD_POTION_BONUS = 75;
/** Dropped potions grow with the monster's level (owner 2026-11-21): from this level medium, from this level large. */
export const CODE_POTION_DROP = { dropM: 21, dropL: 41 } as const;
/** Ranges the /admin card accepts (a drop level of 81 = never, the cap is 80). */
export const POTION_RANGE = { amount: [1, 1000000], price: [0, 10000000], swordBonus: [0, 1000], dropLevel: [1, 81] } as const;
