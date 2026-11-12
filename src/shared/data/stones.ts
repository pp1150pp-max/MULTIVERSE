// Blacksmith stones: dropped by bosses (reroll stones rarely by other monsters too), stacked in the bag like potions.
// Boss keys (Artifacts) share the stone stack: they stack, sell, trade and list on the market the same way.
import { isBuffScroll, isConsumable, type BossKey, type BuffScroll, type QuestKey, type StoneKind, type StoneStack } from '../types';
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
/** A phoenix feather at the merchant (owner: 1,000 G); it sells back for half, like potions. */
export const PHOENIX_PRICE = 1000;
/** Revives each player may use in a boss room, per key put in (owner: 3 × keys). */
export const REVIVES_PER_KEY = 3;

/** Each boss's quest key from The Seeker (bound to the character, see isBound). */
export const BOSS_QUEST_KEY: Record<string, QuestKey> = {
  forest_bear: 'qkey_bear',
  bog_witch: 'qkey_witch',
  yeti: 'qkey_yeti',
  volcano_heart: 'qkey_heart',
};
/** The Seeker's key quest: kill this many monsters of the boss's map (owner: 30). */
export const QUEST_KILLS = 30;
/** Said whenever a quest key would leave the bag. */
export const BOUND_MSG = 'ของชิ้นนี้ผูกกับตัวละคร — ขาย ทิ้ง ฝากคลัง เทรด หรือลงตลาดไม่ได้';
/** Chance that a monster from a boss's map drops that boss's key, also when it stands in the hub (owner: 1%, lowered to 0.3% on 2026-11-10). */
export const KEY_DROP_CHANCE = 0.003;

export const STONE_NAME: Record<StoneKind, string> = {
  protect: 'หินกันระดับลด',
  enhance: 'หินตีบวก',
  reroll_values: 'หินสุ่มค่า',
  reroll_stat: 'หินสุ่มสเตตัส',
  key_bear: 'อุ้งเท้าหมี',
  key_witch: 'ลูกแก้วแม่มดหนอง',
  key_yeti: 'เขี้ยวเยติ',
  key_heart: 'แกนหัวใจลาวา',
  qkey_bear: 'อุ้งเท้าหมี (เควส)',
  qkey_witch: 'ลูกแก้วแม่มดหนอง (เควส)',
  qkey_yeti: 'เขี้ยวเยติ (เควส)',
  qkey_heart: 'แกนหัวใจลาวา (เควส)',
  phoenix: 'ขนนกฟีนิกซ์',
  return_scroll: 'ม้วนคัมภีร์กลับเมือง',
  exp_scroll: 'ใบคูณ EXP 100%',
  drop_scroll: 'ใบคูณดรอป 100%',
};

const keyDesc = (boss: string, zone: string): string =>
  `กุญแจห้องบอส${boss} ใส่ที่แท่นเรียกบอสใน${zone} (ครั้งละ 1–10 อัน ยิ่งใส่มาก บอสยิ่งแรงและรางวัลยิ่งมาก)`;

const questDesc = (boss: string): string =>
  `กุญแจจาก The Seeker: เปิดห้องบอส${boss}ได้ระดับ ×1 โดยไม่หายเมื่อใช้ และจะหายไปเมื่อปราบ${boss}ได้ (ผูกกับตัวละคร)`;

export const STONE_DESC: Record<StoneKind, string> = {
  protect: 'ใช้ตอนตีบวก: ถ้าล้มเหลว ระดับจะไม่ลด (ใช้ 1 ก้อนต่อครั้ง)',
  enhance: 'วัตถุดิบตีบวกตั้งแต่ +11 ขึ้นไป (ใช้ 1 ก้อนต่อครั้ง)',
  reroll_values: 'ใช้ตอนสุ่มค่าตัวเลขที่ช่างตีเหล็ก (ใช้ 1 ก้อนต่อครั้ง)',
  reroll_stat: 'ใช้ตอนสุ่มสเตตัสที่ช่างตีเหล็ก (ใช้ 1 ก้อนต่อครั้ง)',
  key_bear: keyDesc('หมี', 'ป่ามรกต'),
  key_witch: keyDesc('แม่มดหนอง', 'หนองน้ำหมอก'),
  key_yeti: keyDesc('เยติ', 'ดินแดนหิมะ'),
  key_heart: keyDesc('หัวใจภูเขาไฟ', 'เกาะภูเขาไฟ'),
  qkey_bear: questDesc('หมี'),
  qkey_witch: questDesc('แม่มดหนอง'),
  qkey_yeti: questDesc('เยติ'),
  qkey_heart: questDesc('หัวใจภูเขาไฟ'),
  phoenix: 'ใช้ตอนล้มในห้องบอส: ฟื้นตรงที่ล้มด้วย HP/MP ครึ่งหนึ่ง (1 อันต่อครั้ง ใช้ได้สูงสุด 3 ครั้งต่อกุญแจที่ใส่)',
  return_scroll: 'ร่าย 3 วินาทีแล้ววาร์ปกลับกลางเมืองศูนย์กลางมิติ (ปุ่ม G หรือคลิก) · โดนโจมตี เดิน ตี หรือใช้สกิลระหว่างร่าย = ยกเลิก ม้วนไม่หาย',
  exp_scroll: 'คลิกเพื่อใช้: EXP ที่ได้ ×2 (รวมส่วนแบ่งปาร์ตี้และตอนเปิด Auto) นาน 30 นาทีที่ออนไลน์ · ใช้ซ้อนได้ บวกเวลาเพิ่ม สูงสุด 5 ชั่วโมง',
  drop_scroll: 'คลิกเพื่อใช้: โอกาสดรอปไอเทม ยา หิน และกุญแจ ×2 (ไม่รวมทอง) นาน 30 นาทีที่ออนไลน์ · นับใบของคนที่ได้สิทธิ์เก็บของ · ใช้ซ้อนได้ บวกเวลาเพิ่ม สูงสุด 5 ชั่วโมง',
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
  qkey_bear: '#9ad86a',
  qkey_witch: '#6fd8b0',
  qkey_yeti: '#cfeeff',
  qkey_heart: '#ff6a3a',
  phoenix: '#ff9a3a',
  return_scroll: '#5fe0d0',
  exp_scroll: '#7ee06a',
  drop_scroll: '#ffc23a',
};

/** "ก้อน" for stones, "อัน" for keys and feathers, "ม้วน" for the return scroll. */
export const stoneUnit = (k: StoneKind): string => (k === 'return_scroll' ? 'ม้วน' : isBuffScroll(k) ? 'ใบ' : k.includes('key_') || k === 'phoenix' ? 'อัน' : 'ก้อน');

/** Return scroll: the merchant's price (owner: 500 G) and how long it takes to cast (owner: 3 s). */
export const RETURN_SCROLL_PRICE = 500;
export const RETURN_CAST = 3;

/** What the merchant pays for one: shop items (feather, consumables) half their shop price, stones and keys STONE_SELL. */
export function stoneSellPrice(k: StoneKind): number {
  if (k === 'phoenix') return PHOENIX_PRICE / 2;
  // Bound rewards never reach the merchant.
  if (isBuffScroll(k)) return 0;
  return isConsumable(k) ? Math.floor(RETURN_SCROLL_PRICE / 2) : STONE_SELL;
}

export function stoneStackValue(s: StoneStack): number {
  return stoneSellPrice(s.stone) * s.count;
}

/** A buff scroll's boost (owner 2026-11-12: +100% = ×2), what one scroll adds (30 min) and the most that can be stored (5 h), in seconds of play. */
export const BUFF_MULT = 2;
export const BUFF_TIME = 30 * 60;
export const BUFF_MAX = 5 * 60 * 60;
/** Short label of each buff on the HUD. */
export const BUFF_LABEL: Record<BuffScroll, string> = { exp_scroll: 'EXP ×2', drop_scroll: 'ดรอป ×2' };

/** Buff time left as "1 ชม. 05 นาที" / "12 นาที". */
export function fmtBuff(sec: number): string {
  const m = Math.ceil(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} ชม. ${String(m % 60).padStart(2, '0')} นาที` : `${m} นาที`;
}
