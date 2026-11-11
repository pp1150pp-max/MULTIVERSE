// Monster cards (plan: docs/plans/card-system.md). Code defaults only: the owner can change every number
// on the /admin "การ์ด" tab, so game code must read cards and numbers through src/shared/cardTuning.ts
// (cardDef / cardNum), never these tables directly.
import { MONSTERS } from './monsters';

/** Where a card fits: weapon + off-hand · helmet, armor, gloves, belt, boots · necklace + rings. */
export type CardGroup = 'weapon' | 'armor' | 'accessory';
export const CARD_GROUPS: CardGroup[] = ['weapon', 'armor', 'accessory'];
export const CARD_GROUP_NAME: Record<CardGroup, string> = {
  weapon: 'อาวุธ (อาวุธ อาวุธรอง)',
  armor: 'เกราะ (หมวก เกราะ ถุงมือ เข็มขัด รองเท้า)',
  accessory: 'เครื่องประดับ (สร้อย แหวน)',
};

export type CardRarity = 'rare' | 'epic' | 'legendary';
export const CARD_RARITIES: CardRarity[] = ['rare', 'epic', 'legendary'];

/** The 12 effects a card can give (none of them is a stone stat). Values are percents. */
export type CardFx = 'atkPct' | 'defPct' | 'hpPct' | 'mpPct' | 'pierce' | 'lifesteal' | 'dmgReduce' | 'bossDmg' | 'cdr' | 'potion' | 'expPct' | 'goldPct';
export const CARD_FX: CardFx[] = ['atkPct', 'defPct', 'hpPct', 'mpPct', 'pierce', 'lifesteal', 'dmgReduce', 'bossDmg', 'cdr', 'potion', 'expPct', 'goldPct'];
export const CARD_FX_NAME: Record<CardFx, string> = {
  atkPct: 'พลังโจมตี %',
  defPct: 'พลังป้องกัน %',
  hpPct: 'HP สูงสุด %',
  mpPct: 'MP สูงสุด %',
  pierce: 'เจาะเกราะ %',
  lifesteal: 'ดูดเลือด %',
  dmgReduce: 'ลดดาเมจที่ได้รับ %',
  bossDmg: 'ดาเมจต่อบอส %',
  cdr: 'ลดคูลดาวน์สกิล %',
  potion: 'ยาฟื้นเพิ่ม %',
  expPct: 'EXP %',
  goldPct: 'ทอง %',
};
/** Most effects one card may have (plan: 2–3). */
export const CARD_FX_MAX = 3;

export type CardId = `card_${string}`;

export interface CardDef {
  id: CardId;
  /** The monster that drops it (MONSTERS key). */
  monster: string;
  /** Map 1–4 of floor 1, for sorting and the admin table. */
  map: number;
  rarity: CardRarity;
  group: CardGroup;
  fx: Partial<Record<CardFx, number>>;
}

const c = (monster: string, map: number, rarity: CardRarity, group: CardGroup, fx: CardDef['fx']): CardDef =>
  ({ id: `card_${monster}`, monster, map, rarity, group, fx });

/** Floor 1's 26 cards (plan section 5.3, owner 2026-11-11: rare cards get stronger map by map). */
export const CARD_DEFAULTS: readonly CardDef[] = [
  c('green_slime', 1, 'rare', 'armor', { hpPct: 2, potion: 5 }),
  c('wild_rabbit', 1, 'rare', 'accessory', { expPct: 3, goldPct: 3 }),
  c('forest_fox', 1, 'rare', 'weapon', { atkPct: 2, pierce: 3 }),
  c('wild_boar', 1, 'rare', 'armor', { defPct: 2, dmgReduce: 1 }),
  c('forest_wolf', 1, 'rare', 'weapon', { atkPct: 2, lifesteal: 0.5 }),
  c('forest_bear', 1, 'epic', 'weapon', { atkPct: 4, bossDmg: 8, pierce: 4 }),
  c('bog_toad', 2, 'rare', 'armor', { hpPct: 3, potion: 7 }),
  c('marsh_leech', 2, 'rare', 'weapon', { atkPct: 2, lifesteal: 1 }),
  c('swamp_serpent', 2, 'rare', 'weapon', { atkPct: 2, pierce: 5 }),
  c('mire_ghoul', 2, 'rare', 'armor', { defPct: 3, dmgReduce: 2 }),
  c('will_o_wisp', 2, 'rare', 'accessory', { mpPct: 4, cdr: 2 }),
  c('bog_witch', 2, 'legendary', 'accessory', { mpPct: 8, cdr: 6, potion: 15 }),
  c('frost_penguin', 3, 'rare', 'armor', { hpPct: 3, defPct: 2 }),
  c('tusk_seal', 3, 'rare', 'armor', { defPct: 4, dmgReduce: 2 }),
  c('snow_owl', 3, 'rare', 'accessory', { mpPct: 4, cdr: 3 }),
  c('snow_sprite', 3, 'rare', 'accessory', { mpPct: 5, expPct: 4 }),
  c('snow_brawler', 3, 'rare', 'weapon', { atkPct: 3, pierce: 5 }),
  c('polar_bear', 3, 'rare', 'armor', { hpPct: 5, dmgReduce: 3 }),
  c('yeti', 3, 'legendary', 'armor', { hpPct: 8, defPct: 6, dmgReduce: 5 }),
  c('ember_wisp', 4, 'rare', 'accessory', { goldPct: 6, expPct: 4 }),
  c('salamander', 4, 'rare', 'armor', { hpPct: 4, potion: 10 }),
  c('lava_bat', 4, 'rare', 'weapon', { atkPct: 3, lifesteal: 1.5 }),
  c('magma_golem', 4, 'rare', 'armor', { defPct: 5, dmgReduce: 3 }),
  c('ash_mage', 4, 'rare', 'accessory', { mpPct: 5, cdr: 4 }),
  c('ash_knight', 4, 'rare', 'weapon', { atkPct: 4, pierce: 7 }),
  c('volcano_heart', 4, 'legendary', 'weapon', { atkPct: 6, pierce: 10, bossDmg: 10 }),
];

export const CARD_IDS: readonly CardId[] = CARD_DEFAULTS.map((d) => d.id);
export const isCardId = (v: unknown): v is CardId => typeof v === 'string' && CARD_IDS.includes(v as CardId);

/** The card's monster picture (512×768, from art_templates/cards/PROMPTS.md). */
export function cardArt(id: CardId): string {
  return `/assets/sprites/cards/card_art_${id.slice('card_'.length)}.webp`;
}

/** "การ์ดหมาป่า" (the monster's Thai name without "(Boss)" / "(Mini Boss)"). */
export function cardName(id: CardId): string {
  const d = CARD_DEFAULTS.find((x) => x.id === id);
  const th = d ? MONSTERS[d.monster]?.nameTh ?? d.monster : id;
  return `การ์ด${th.replace(/\s*\(.*\)\s*$/, '')}`;
}

/** One adjustable number of the card system (plan sections 3, 4, 6 and 5.1). */
export interface CardNumField {
  key: string;
  name: string;
  /** Heading on the admin tab. */
  group: string;
  def: number;
  min: number;
  max: number;
  /** Smallest step (also how values are rounded). */
  step: number;
  unit: '%' | 'G' | '×' | '';
}

const RARITY_TH: Record<CardRarity, string> = { rare: 'หายาก', epic: 'มหากาพย์', legendary: 'ตำนาน' };
export const CARD_RARITY_NAME = RARITY_TH;

/** Every adjustable number with its code default. Percents are stored as percents (0.01 = 0.01%). */
export const CARD_NUM_FIELDS: readonly CardNumField[] = [
  { key: 'dropMonster', name: 'การ์ดจากมอนทั่วไป (ต่อการฆ่า)', group: 'เรทดรอป', def: 0.01, min: 0, max: 100, step: 0.0001, unit: '%' },
  { key: 'dropBoss', name: 'การ์ดบอส (ต่อกุญแจ 1 อัน)', group: 'เรทดรอป', def: 0.1, min: 0, max: 100, step: 0.0001, unit: '%' },
  { key: 'drillDropMonster', name: 'หินเจาะรูจากมอนทั่วไป', group: 'เรทดรอป', def: 0.2, min: 0, max: 100, step: 0.0001, unit: '%' },
  { key: 'drillDropBoss', name: 'หินเจาะรูจากบอส (ต่อกุญแจ)', group: 'เรทดรอป', def: 10, min: 0, max: 100, step: 0.0001, unit: '%' },
  { key: 'drill0', name: 'เจาะแล้วได้ 0 ช่อง', group: 'เจาะรู (3 ช่องรวมกันต้องได้ 100%)', def: 40, min: 0, max: 100, step: 0.1, unit: '%' },
  { key: 'drill1', name: 'เจาะแล้วได้ 1 ช่อง', group: 'เจาะรู (3 ช่องรวมกันต้องได้ 100%)', def: 50, min: 0, max: 100, step: 0.1, unit: '%' },
  { key: 'drill2', name: 'เจาะแล้วได้ 2 ช่อง', group: 'เจาะรู (3 ช่องรวมกันต้องได้ 100%)', def: 10, min: 0, max: 100, step: 0.1, unit: '%' },
  { key: 'drillCostMult', name: 'ค่าทองเจาะรู = (15 + Lv×6) × ค่านี้ × ตัวคูณความหายากของไอเทม', group: 'เจาะรู (3 ช่องรวมกันต้องได้ 100%)', def: 5, min: 0, max: 1000, step: 0.1, unit: '×' },
  { key: 'socketCost', name: 'ค่าเสียบการ์ด', group: 'ค่าทอง', def: 0, min: 0, max: 100_000_000, step: 1, unit: 'G' },
  { key: 'unsocketCost', name: 'ค่าถอดการ์ด (การ์ดแตก)', group: 'ค่าทอง', def: 0, min: 0, max: 100_000_000, step: 1, unit: 'G' },
  ...CARD_RARITIES.map((r): CardNumField => ({ key: `fuseCost_${r}`, name: `ค่ารวมการ์ด${RARITY_TH[r]}`, group: 'รวมการ์ด', def: r === 'rare' ? 5000 : r === 'epic' ? 20000 : 100000, min: 0, max: 100_000_000, step: 1, unit: 'G' })),
  ...CARD_RARITIES.map((r): CardNumField => ({ key: `fuseOn_${r}`, name: `เปิดรวมการ์ด${RARITY_TH[r]} (1 = เปิด, 0 = ปิด)`, group: 'รวมการ์ด', def: r === 'epic' ? 0 : 1, min: 0, max: 1, step: 1, unit: '' })),
  ...CARD_RARITIES.map((r): CardNumField => ({ key: `sell_${r}`, name: `ขายพ่อค้า: การ์ด${RARITY_TH[r]}`, group: 'ราคาขายพ่อค้า', def: r === 'rare' ? 2000 : r === 'epic' ? 10000 : 50000, min: 0, max: 100_000_000, step: 1, unit: 'G' })),
  { key: 'sell_drill', name: 'ขายพ่อค้า: หินเจาะรู', group: 'ราคาขายพ่อค้า', def: 1000, min: 0, max: 100_000_000, step: 1, unit: 'G' },
  ...CARD_FX.map((f): CardNumField => ({
    key: `cap_${f}`, name: `เพดาน${CARD_FX_NAME[f]} (0 = ไม่จำกัด)`, group: 'เพดานรวมทั้งตัว', min: 0, max: 100, step: 0.1, unit: '%',
    def: ({ pierce: 50, lifesteal: 10, dmgReduce: 30, bossDmg: 40, cdr: 20, potion: 40, expPct: 30, goldPct: 30 } as Partial<Record<CardFx, number>>)[f] ?? 0,
  })),
];
