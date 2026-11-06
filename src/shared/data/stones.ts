// Blacksmith stones: dropped only by bosses, stacked in the bag like potions.
import type { StoneKind, StoneStack } from '../types';

/** Most stones one bag or stash slot can hold (owner: 10). */
export const STONE_STACK = 10;
/** What the merchant pays per stone (owner: 1,000 G). */
export const STONE_SELL = 1000;
/** Chance of each stone kind on every boss kill, rolled separately (owner: 10%). */
export const BOSS_STONE_CHANCE = 0.1;

export const STONE_NAME: Record<StoneKind, string> = {
  protect: 'หินกันระดับลด',
  enhance: 'หินตีบวก',
};

export const STONE_DESC: Record<StoneKind, string> = {
  protect: 'ใช้ตอนตีบวก: ถ้าล้มเหลว ระดับจะไม่ลด (ใช้ 1 ก้อนต่อครั้ง)',
  enhance: 'วัตถุดิบตีบวกตั้งแต่ +11 ขึ้นไป (ใช้ 1 ก้อนต่อครั้ง)',
};

export const STONE_COLOR: Record<StoneKind, string> = {
  protect: '#6fd8ff',
  enhance: '#ff9a2e',
};

export function stoneStackValue(s: StoneStack): number {
  return STONE_SELL * s.count;
}
