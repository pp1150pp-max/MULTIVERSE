// Potions: three sizes each of HP and MP. They live in the bag like gear, so carrying more
// potions means less room for loot. Only the merchant sells them.
import { isPotion, type BagEntry, type PotionKind, type PotionSize, type PotionStack } from '../types';
import { itemName } from './enhance';

export const POTION_SIZES: PotionSize[] = ['s', 'm', 'l'];
/** Most potions one bag slot can hold. */
export const POTION_STACK = 10;

export const POTION_SIZE_LABEL: Record<PotionSize, string> = { s: 'เล็ก', m: 'กลาง', l: 'ใหญ่' };
export const POTION_ICON: Record<PotionKind, string> = { hp: '❤️', mp: '💧' };

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

/** Display name for any bag slot: gear name (with +N), or "ยา HP เล็ก ×5". */
export function entryName(e: BagEntry): string {
  return isPotion(e) ? `${potionName(e.potion, e.size)} ×${e.count}` : itemName(e);
}
