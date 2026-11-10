// Blacksmith stones: dropped by bosses (reroll stones rarely by other monsters too), stacked in the bag like potions.
// Boss keys (Artifacts) share the stone stack: they stack, sell, trade and list on the market the same way.
import { isConsumable, type BossKey, type StoneKind, type StoneStack } from '../types';
import type { RerollKind } from './reroll';

/** Most stones (or keys) one bag or stash slot can hold (owner: 10). */
export const STONE_STACK = 10;
/** What the merchant pays per stone or key (owner: 1,000 G each). */
export const STONE_SELL = 1000;
/** Chance of each stone kind on every boss kill, rolled separately (owner: 10%). */
export const BOSS_STONE_CHANCE = 0.1;
/** Chance of each reroll stone kind on every other monster kill that can drop items, rolled separately (owner: 0.2%). */
export const MONSTER_STONE_CHANCE = 0.002;
/** Stones that other monsters can drop as well as bosses. */
export const MONSTER_STONES: StoneKind[] = ['reroll_values', 'reroll_stat'];
/** The stone each blacksmith reroll uses, one per reroll on top of the gold (owner). */
export const REROLL_STONE: Record<RerollKind, StoneKind> = { values: 'reroll_values', stat: 'reroll_stat' };

/** Each boss's key, by the boss's monster id (owner: one Artifact per boss). */
export const BOSS_KEY: Record<string, BossKey> = {
  forest_bear: 'key_bear',
  bog_witch: 'key_witch',
  yeti: 'key_yeti',
  volcano_heart: 'key_heart',
};
/** Chance that a monster from a boss's map drops that boss's key, also when it stands in the hub (owner: 1%). */
export const KEY_DROP_CHANCE = 0.01;

export const STONE_NAME: Record<StoneKind, string> = {
  protect: 'หินกันระดับลด',
  enhance: 'หินตีบวก',
  reroll_values: 'หินสุ่มค่า',
  reroll_stat: 'หินสุ่มสเตตัส',
  key_bear: 'อุ้งเท้าหมี',
  key_witch: 'ลูกแก้วแม่มดหนอง',
  key_yeti: 'เขี้ยวเยติ',
  key_heart: 'แกนหัวใจลาวา',
  return_scroll: 'ม้วนคัมภีร์กลับเมือง',
};

const keyDesc = (boss: string, zone: string): string =>
  `กุญแจห้องบอส${boss} ใส่ที่แท่นเรียกบอสใน${zone} (ครั้งละ 1–10 อัน ยิ่งใส่มาก บอสยิ่งแรงและรางวัลยิ่งมาก)`;

export const STONE_DESC: Record<StoneKind, string> = {
  protect: 'ใช้ตอนตีบวก: ถ้าล้มเหลว ระดับจะไม่ลด (ใช้ 1 ก้อนต่อครั้ง)',
  enhance: 'วัตถุดิบตีบวกตั้งแต่ +11 ขึ้นไป (ใช้ 1 ก้อนต่อครั้ง)',
  reroll_values: 'ใช้ตอนสุ่มค่าตัวเลขที่ช่างตีเหล็ก (ใช้ 1 ก้อนต่อครั้ง)',
  reroll_stat: 'ใช้ตอนสุ่มสเตตัสที่ช่างตีเหล็ก (ใช้ 1 ก้อนต่อครั้ง)',
  key_bear: keyDesc('หมี', 'ป่ามรกต'),
  key_witch: keyDesc('แม่มดหนอง', 'หนองน้ำหมอก'),
  key_yeti: keyDesc('เยติ', 'ดินแดนหิมะ'),
  key_heart: keyDesc('หัวใจภูเขาไฟ', 'เกาะภูเขาไฟ'),
  return_scroll: 'ร่าย 3 วินาทีแล้ววาร์ปกลับกลางเมืองศูนย์กลางมิติ (ปุ่ม G หรือคลิก) · โดนโจมตี เดิน ตี หรือใช้สกิลระหว่างร่าย = ยกเลิก ม้วนไม่หาย',
};

export const STONE_COLOR: Record<StoneKind, string> = {
  protect: '#6fd8ff',
  enhance: '#ff9a2e',
  reroll_values: '#ffd34a',
  reroll_stat: '#b67cff',
  key_bear: '#9ad86a',
  key_witch: '#6fd8b0',
  key_yeti: '#cfeeff',
  key_heart: '#ff6a3a',
  return_scroll: '#5fe0d0',
};

/** "ก้อน" for stones, "อัน" for keys, "ม้วน" for the return scroll. */
export const stoneUnit = (k: StoneKind): string => (k === 'return_scroll' ? 'ม้วน' : k.startsWith('key_') ? 'อัน' : 'ก้อน');

/** Return scroll: the merchant's price (owner: 500 G) and how long it takes to cast (owner: 3 s). */
export const RETURN_SCROLL_PRICE = 500;
export const RETURN_CAST = 3;

/** What the merchant pays for one: consumables half their shop price, stones and keys STONE_SELL. */
export function stoneSellPrice(k: StoneKind): number {
  return isConsumable(k) ? Math.floor(RETURN_SCROLL_PRICE / 2) : STONE_SELL;
}

export function stoneStackValue(s: StoneStack): number {
  return stoneSellPrice(s.stone) * s.count;
}
