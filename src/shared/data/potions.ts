// Potions: three sizes each of HP and MP. They live in the bag like gear, so carrying more
// potions means less room for loot. Only the merchant sells them.
import { isPotion, isStone, type BagEntry, type PotionKind, type PotionSize, type PotionStack, type Stack } from '../types';
import { currentBalance } from '../balance';
import { itemName } from './enhance';
import { STONE_NAME, stoneStackMax, stoneStackValue } from './stones';

export const POTION_SIZES: PotionSize[] = ['s', 'm', 'l'];
/** Most potions one bag slot can hold. */
export const POTION_STACK = 10;

export const POTION_SIZE_LABEL: Record<PotionSize, string> = { s: 'เล็ก', m: 'กลาง', l: 'ใหญ่' };

/** How much one bottle restores before any class bonus (the /admin balance tuning on top of the code). */
export function potionAmount(kind: PotionKind, size: PotionSize): number {
  return currentBalance().potions[kind][size].amount;
}

/** The merchant's price for one bottle. */
export function potionPrice(kind: PotionKind, size: PotionSize): number {
  return currentBalance().potions[kind][size].price;
}

/** HP restored by one bottle for this class: swordsmen fight up close, so their HP potions heal more (code: 75%). */
export function potionHeal(kind: PotionKind, size: PotionSize, cls: string): number {
  const base = potionAmount(kind, size);
  return kind === 'hp' && cls === 'sword' ? Math.round((base * (100 + currentBalance().potions.swordBonus)) / 100) : base;
}

/** Size of a potion a monster of this level drops: small, medium from `dropM`, large from `dropL` (/admin card "ยา"). */
export function dropPotionSize(level: number): PotionSize {
  const { dropM, dropL } = currentBalance().potions;
  return level >= dropL ? 'l' : level >= dropM ? 'm' : 's';
}

/** The merchant buys potions back at half price. */
export function potionSellPrice(kind: PotionKind, size: PotionSize): number {
  return Math.floor(potionPrice(kind, size) / 2);
}

export function potionName(kind: PotionKind, size: PotionSize): string {
  return `ยา ${kind.toUpperCase()} ${POTION_SIZE_LABEL[size]}`;
}

export function stackSellValue(s: PotionStack): number {
  return potionSellPrice(s.potion, s.size) * s.count;
}

/** Most of this stack one bag or stash slot can hold. */
export function stackLimit(s: Stack): number {
  return isPotion(s) ? POTION_STACK : stoneStackMax(s.stone);
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
