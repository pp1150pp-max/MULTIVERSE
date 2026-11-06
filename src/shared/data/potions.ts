// Potions: three sizes each of HP and MP. They live in the bag like gear, so carrying more
// potions means less room for loot. Only the merchant sells them.
import { isPotion, isStone, type BagEntry, type PotionKind, type PotionSize, type PotionStack, type Stack } from '../types';
import { itemName } from './enhance';
import { STONE_NAME, STONE_STACK, stoneStackValue } from './stones';

export const POTION_SIZES: PotionSize[] = ['s', 'm', 'l'];
/** Most potions one bag slot can hold. */
export const POTION_STACK = 10;

export const POTION_SIZE_LABEL: Record<PotionSize, string> = { s: 'เล็ก', m: 'กลาง', l: 'ใหญ่' };

/** How much one bottle restores, and the merchant's price. */
export const POTIONS: Record<PotionKind, Record<PotionSize, { amount: number; price: number }>> = {
  hp: { s: { amount: 40, price: 10 }, m: { amount: 100, price: 25 }, l: { amount: 250, price: 55 } },
  mp: { s: { amount: 25, price: 10 }, m: { amount: 60, price: 25 }, l: { amount: 150, price: 55 } },
};

/** The merchant buys potions back at half price. */
export function potionSellPrice(kind: PotionKind, size: PotionSize): number {
  return Math.floor(POTIONS[kind][size].price / 2);
}

export function potionName(kind: PotionKind, size: PotionSize): string {
  return `ยา ${kind.toUpperCase()} ${POTION_SIZE_LABEL[size]}`;
}

export function stackSellValue(s: PotionStack): number {
  return potionSellPrice(s.potion, s.size) * s.count;
}

/** Most of this stack one bag or stash slot can hold. */
export function stackLimit(s: Stack): number {
  return isPotion(s) ? POTION_STACK : STONE_STACK;
}

/** What the merchant pays for a whole stack. */
export function anyStackValue(s: Stack): number {
  return isPotion(s) ? stackSellValue(s) : stoneStackValue(s);
}

/** Display name for any bag slot: gear name (with +N), "ยา HP เล็ก ×5" or "หินตีบวก ×3". */
export function entryName(e: BagEntry): string {
  if (isPotion(e)) return `${potionName(e.potion, e.size)} ×${e.count}`;
  if (isStone(e)) return `${STONE_NAME[e.stone]} ×${e.count}`;
  return itemName(e);
}
