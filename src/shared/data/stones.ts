// Blacksmith stones: dropped by bosses (reroll stones rarely by other monsters too), stacked in the bag like potions.
import type { StoneKind, StoneStack } from '../types';
import type { RerollKind } from './reroll';

/** Most stones one bag or stash slot can hold (owner: 10). */
export const STONE_STACK = 10;
/** What the merchant pays per stone (owner: 1,000 G). */
export const STONE_SELL = 1000;
/** Chance of each stone kind on every boss kill, rolled separately (owner: 10%). */
export const BOSS_STONE_CHANCE = 0.1;
/** Chance of each reroll stone kind on every other monster kill that can drop items, rolled separately (owner: 0.2%). */
export const MONSTER_STONE_CHANCE = 0.002;
/** Stones that other monsters can drop as well as bosses. */
export const MONSTER_STONES: StoneKind[] = ['reroll_values', 'reroll_stat'];
/** The stone each blacksmith reroll uses, one per reroll on top of the gold (owner). */
export const REROLL_STONE: Record<RerollKind, StoneKind> = { values: 'reroll_values', stat: 'reroll_stat' };

export const STONE_NAME: Record<StoneKind, string> = {
  protect: 'หินกันระดับลด',
  enhance: 'หินตีบวก',
  reroll_values: 'หินสุ่มค่า',
  reroll_stat: 'หินสุ่มสเตตัส',
};

export const STONE_DESC: Record<StoneKind, string> = {
  protect: 'ใช้ตอนตีบวก: ถ้าล้มเหลว ระดับจะไม่ลด (ใช้ 1 ก้อนต่อครั้ง)',
  enhance: 'วัตถุดิบตีบวกตั้งแต่ +11 ขึ้นไป (ใช้ 1 ก้อนต่อครั้ง)',
  reroll_values: 'ใช้ตอนสุ่มค่าตัวเลขที่ช่างตีเหล็ก (ใช้ 1 ก้อนต่อครั้ง)',
  reroll_stat: 'ใช้ตอนสุ่มสเตตัสที่ช่างตีเหล็ก (ใช้ 1 ก้อนต่อครั้ง)',
};

export const STONE_COLOR: Record<StoneKind, string> = {
  protect: '#6fd8ff',
  enhance: '#ff9a2e',
  reroll_values: '#ffd34a',
  reroll_stat: '#b67cff',
};

export function stoneStackValue(s: StoneStack): number {
  return STONE_SELL * s.count;
}
