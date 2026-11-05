// Shared types — no rendering code here so the future Colyseus server can import them.

export type Vec2 = { x: number; z: number };

export type ClassId = 'sword' | 'mage' | 'gunslinger';

export type SlotId = 'weapon' | 'helmet' | 'armor' | 'boots' | 'ring';
export const SLOTS: SlotId[] = ['weapon', 'helmet', 'armor', 'boots', 'ring'];
export const SLOT_LABEL: Record<SlotId, string> = {
  weapon: 'อาวุธ',
  helmet: 'หมวก',
  armor: 'เกราะ',
  boots: 'รองเท้า',
  ring: 'แหวน',
};

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#d8d8d8',
  uncommon: '#62d862',
  rare: '#4fa0ff',
  epic: '#c56dff',
  legendary: '#ff9a2e',
};
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'ธรรมดา',
  uncommon: 'ดี',
  rare: 'หายาก',
  epic: 'มหากาพย์',
  legendary: 'ตำนาน',
};

export const STAT_KEYS = [
  'maxHp', 'maxMp', 'atk', 'def', 'crit', 'critDmg', 'atkSpeed', 'moveSpeed', 'hpRegen', 'mpRegen',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;
export const STAT_LABEL: Record<StatKey, string> = {
  maxHp: 'HP สูงสุด',
  maxMp: 'MP สูงสุด',
  atk: 'พลังโจมตี',
  def: 'พลังป้องกัน',
  crit: 'โอกาสคริติคอล %',
  critDmg: 'ดาเมจคริติคอล %',
  atkSpeed: 'ความเร็วโจมตี %',
  moveSpeed: 'ความเร็วเคลื่อนที่ %',
  hpRegen: 'ฟื้น HP / วิ',
  mpRegen: 'ฟื้น MP / วิ',
};

export interface Item {
  uid: string;
  baseId: string;
  name: string;
  slot: SlotId;
  rarity: Rarity;
  level: number;
  stats: Partial<Stats>;
  value: number;
  /** Weapon enhancement level from the blacksmith (+0 when missing). */
  plus?: number;
  /** Class that can wear it (weapons and armor). Missing = any class, or an older item (see itemClass). */
  cls?: ClassId;
  /**
   * Each rolled stat line with its tier (main stat and extras listed separately). `stats` is still the
   * total of these. Missing on items from before tiers existed — those show no tier.
   */
  lines?: StatLine[];
}

/** Stat tiers: 1 is the best 20% of the line's range, 5 the lowest 20%. */
export type StatTier = 1 | 2 | 3 | 4 | 5;

/** One rolled stat on an item: its value, tier and the range possible at this item level and rarity. */
export interface StatLine {
  stat: StatKey;
  value: number;
  tier: StatTier;
  min: number;
  max: number;
}

export type PotionKind = 'hp' | 'mp';
export type PotionSize = 's' | 'm' | 'l';

/** Potions of one kind and size sharing a bag slot (up to POTION_STACK). */
export interface PotionStack {
  potion: PotionKind;
  size: PotionSize;
  count: number;
}

/** Anything a bag slot can hold. */
export type BagEntry = Item | PotionStack;

export function isPotion(e: BagEntry | null | undefined): e is PotionStack {
  return !!e && 'potion' in e;
}
