// Shared types — no rendering code here so the future Colyseus server can import them.

export type Vec2 = { x: number; z: number };

export type ClassId = 'sword' | 'mage' | 'gunslinger';

/** The kinds of gear an item can be. */
export type SlotId = 'weapon' | 'offhand' | 'helmet' | 'necklace' | 'armor' | 'gloves' | 'belt' | 'boots' | 'ring';
export const SLOTS: SlotId[] = ['weapon', 'offhand', 'helmet', 'necklace', 'armor', 'gloves', 'belt', 'boots', 'ring'];
/** Where gear is worn: one place per kind, plus a second place for rings. A ring's own `slot` is always 'ring'. */
export type EquipSlot = SlotId | 'ring2';
export const EQUIP_SLOTS: EquipSlot[] = [...SLOTS, 'ring2'];
export const SLOT_LABEL: Record<SlotId, string> = {
  weapon: 'อาวุธ',
  offhand: 'อาวุธรอง',
  helmet: 'หมวก',
  necklace: 'สร้อย',
  armor: 'เกราะ',
  gloves: 'ถุงมือ',
  belt: 'เข็มขัด',
  boots: 'รองเท้า',
  ring: 'แหวน',
};
export const EQUIP_SLOT_LABEL: Record<EquipSlot, string> = { ...SLOT_LABEL, ring: 'แหวน 1', ring2: 'แหวน 2' };
/** The places an item of this kind can be worn. */
export const wornPlaces = (slot: SlotId): EquipSlot[] => (slot === 'ring' ? ['ring', 'ring2'] : [slot]);

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
  /** Enhancement level from the blacksmith (+0 when missing). */
  plus?: number;
  /** Failed enhancement attempts since the last success; each one raises the next chance a little. */
  pity?: number;
  /** Class that can wear it (weapons and armor). Missing = any class, or an older item (see itemClass). */
  cls?: ClassId;
  /**
   * Each rolled stat line with its tier (main stat and extras listed separately). `stats` is still the
   * total of these. Missing on items from before tiers existed — those show no tier.
   */
  lines?: StatLine[];
  /** Tier tables the lines follow (see TIER_VERSION in data/items). Missing = older lines, upgraded on load. */
  tierV?: number;
}

/** Stat tiers: 1 is the best, 5 the lowest. Each has its own range (see tierRanges in data/items). */
export type StatTier = 1 | 2 | 3 | 4 | 5;

/**
 * One rolled stat on an item: its value, tier and that tier's range at this item level and rarity
 * (shown as "+34 ATK (T1: 30–40)"). Before TIER_VERSION 2, min–max was the line's whole range.
 */
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

/** Boss-only blacksmith materials: protection keeps the + level on a fail, enhance is needed from +11. */
export type BlacksmithStone = 'protect' | 'enhance' | 'reroll_values' | 'reroll_stat';
export const BLACKSMITH_STONES: BlacksmithStone[] = ['protect', 'enhance', 'reroll_values', 'reroll_stat'];
/**
 * Boss keys (Artifacts): one per boss, put into its summoner to open the boss room. They stack, sell,
 * trade and go on the market exactly like stones, so they share the stone stack (see BOSS_KEY in data/stones).
 */
export type BossKey = 'key_bear' | 'key_witch' | 'key_yeti' | 'key_heart';
export const BOSS_KEYS: BossKey[] = ['key_bear', 'key_witch', 'key_yeti', 'key_heart'];
/**
 * Quest keys from The Seeker: one per boss, bound to the character. They open the boss's room at ×1
 * without being used up, and vanish once that boss is killed. They can't leave the bag (no selling,
 * dropping, stash, trade or market), only move around in it. See isBound.
 */
export type QuestKey = 'qkey_bear' | 'qkey_witch' | 'qkey_yeti' | 'qkey_heart';
export const QUEST_KEYS: QuestKey[] = ['qkey_bear', 'qkey_witch', 'qkey_yeti', 'qkey_heart'];
/** Phoenix feathers: sold by the merchant, used to get up again where you fell in a boss room. */
export type ShopStone = 'phoenix';
/** Everything a stone stack can hold: blacksmith stones, boss keys, quest keys and phoenix feathers. */
export type StoneKind = BlacksmithStone | BossKey | QuestKey | ShopStone;
export const STONE_KINDS: StoneKind[] = [...BLACKSMITH_STONES, ...BOSS_KEYS, ...QUEST_KEYS, 'phoenix'];
export const isBossKey = (k: StoneKind): k is BossKey => (BOSS_KEYS as StoneKind[]).includes(k);
export const isQuestKey = (k: StoneKind): k is QuestKey => (QUEST_KEYS as StoneKind[]).includes(k);
/** A quest key: stays in its owner's bag. */
export const isBound = (e: BagEntry | null | undefined): boolean => isStone(e) && isQuestKey(e.stone);

/** Stones of one kind sharing a bag slot (up to STONE_STACK). */
export interface StoneStack {
  stone: StoneKind;
  count: number;
}

/** Anything a bag slot can hold. */
export type BagEntry = Item | PotionStack | StoneStack;
/** Bag entries that stack: potions and stones. */
export type Stack = PotionStack | StoneStack;

export function isPotion(e: BagEntry | null | undefined): e is PotionStack {
  return !!e && 'potion' in e;
}

export function isStone(e: BagEntry | null | undefined): e is StoneStack {
  return !!e && 'stone' in e;
}

export function isStack(e: BagEntry | null | undefined): e is Stack {
  return isPotion(e) || isStone(e);
}

/** Gear (anything that isn't a stack). */
export function isItem(e: BagEntry | null | undefined): e is Item {
  return !!e && !isStack(e);
}

/** Two stacks that may merge: the same potion kind and size, or the same stone. */
export function sameStack(a: BagEntry | null | undefined, b: BagEntry | null | undefined): boolean {
  if (isPotion(a) && isPotion(b)) return a.potion === b.potion && a.size === b.size;
  if (isStone(a) && isStone(b)) return a.stone === b.stone;
  return false;
}
