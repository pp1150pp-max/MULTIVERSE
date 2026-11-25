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

/** The 13 effects a card can give (none of them is a stone stat). Values are percents. normalAtkPct: owner 2026-11-25 (plan 12.3 no. 7). */
export type CardFx = 'atkPct' | 'defPct' | 'hpPct' | 'mpPct' | 'pierce' | 'lifesteal' | 'dmgReduce' | 'bossDmg' | 'cdr' | 'potion' | 'expPct' | 'goldPct' | 'normalAtkPct';
export const CARD_FX: CardFx[] = ['atkPct', 'defPct', 'hpPct', 'mpPct', 'pierce', 'lifesteal', 'dmgReduce', 'bossDmg', 'cdr', 'potion', 'expPct', 'goldPct', 'normalAtkPct'];
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
  normalAtkPct: 'ดาเมจโจมตีปกติ %',
};
/** "พลังโจมตี +2%" lines of a card's effects, in the fixed effect order. */
export function cardFxLines(fx: Partial<Record<CardFx, number>>): string[] {
  return CARD_FX.filter((f) => fx[f] !== undefined).map((f) => `${CARD_FX_NAME[f].replace(/\s*%$/, '')} +${fx[f]}%`);
}
/** Most effects one card may have (plan: 2–3). */
export const CARD_FX_MAX = 3;

export type CardId = `card_${string}`;

export interface CardDef {
  id: CardId;
  /** The monster on the card (MONSTERS key). It drops the card unless dropFrom is set. */
  monster: string;
  /**
   * Floor 1 or 2. Fusing takes cards of one floor and gives a card of that floor (owner 2026-11-25, cardFusePool), and
   * floor 2 cards drop only while the /admin switch floor2Drop is on (cardDropsOpen in cardTuning.ts).
   */
  floor: 1 | 2;
  /** Map 1–4 of its floor, for sorting and the admin table. */
  map: number;
  /**
   * The boss whose kill rolls this card (rate dropBossExtra per key) when the card's own monster never dies and gives
   * nothing: the Peg-Leg Captain's parrot (owner 2026-11-25).
   */
  dropFrom?: string;
  rarity: CardRarity;
  group: CardGroup;
  fx: Partial<Record<CardFx, number>>;
}

const c = (monster: string, map: number, rarity: CardRarity, group: CardGroup, fx: CardDef['fx']): CardDef =>
  ({ id: `card_${monster}`, monster, floor: 1, map, rarity, group, fx });
const c2 = (monster: string, map: number, rarity: CardRarity, group: CardGroup, fx: CardDef['fx'], dropFrom?: string): CardDef =>
  ({ id: `card_${monster}`, monster, floor: 2, map, rarity, group, fx, ...(dropFrom ? { dropFrom } : {}) });

/**
 * Floor 1's 26 cards (plan section 5.3, owner 2026-11-11: rare cards get stronger map by map) and floor 2's 21
 * (plan section 12, owner 2026-11-25: 20 monster cards + the parrot's epic card).
 */
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
  // Floor 2, map 1 Shipwreck Beach (×1.3)
  c2('hermit_crab', 1, 'rare', 'armor', { defPct: 6, dmgReduce: 4 }),
  c2('thief_gull', 1, 'rare', 'accessory', { goldPct: 8, expPct: 5 }),
  c2('shock_eel', 1, 'rare', 'weapon', { atkPct: 4, pierce: 8 }),
  c2('spike_turtle', 1, 'rare', 'armor', { hpPct: 6, dmgReduce: 4 }),
  c2('cannon_crab', 1, 'legendary', 'weapon', { atkPct: 8, pierce: 12, bossDmg: 12 }),
  // Map 2 Smugglers Cove (×1.5)
  c2('prisoner', 2, 'rare', 'armor', { hpPct: 6, defPct: 4 }),
  c2('cutlass_pirate', 2, 'rare', 'weapon', { atkPct: 5, lifesteal: 2, normalAtkPct: 6 }),
  c2('shotgunner', 2, 'rare', 'weapon', { atkPct: 5, pierce: 9, normalAtkPct: 8 }),
  c2('keg_prisoner', 2, 'rare', 'armor', { hpPct: 7, potion: 12 }),
  c2('parrot', 2, 'epic', 'weapon', { atkPct: 6, pierce: 6, bossDmg: 12 }, 'pegleg_captain'),
  c2('pegleg_captain', 2, 'legendary', 'accessory', { cdr: 6, expPct: 10, goldPct: 12 }),
  // Map 3 Ghost Ship Graveyard (×1.75)
  c2('ghost_monkey', 3, 'rare', 'accessory', { mpPct: 6, cdr: 5 }),
  c2('ghost_sailor', 3, 'rare', 'weapon', { atkPct: 6, pierce: 10 }),
  c2('ghost_siren', 3, 'rare', 'accessory', { mpPct: 6, expPct: 7 }),
  c2('barnacle_crew', 3, 'rare', 'armor', { defPct: 7, dmgReduce: 5 }),
  c2('ghost_captain', 3, 'legendary', 'armor', { hpPct: 10, defPct: 8, dmgReduce: 7 }),
  // Map 4 Kraken Maelstrom (×2)
  c2('shark_knight', 4, 'rare', 'weapon', { atkPct: 7, lifesteal: 2.5 }),
  c2('seahorse_soldier', 4, 'rare', 'accessory', { mpPct: 7, cdr: 6 }),
  c2('ghost_pirate_king', 4, 'rare', 'weapon', { atkPct: 7, pierce: 12, bossDmg: 8 }),
  c2('kraken_tentacle', 4, 'rare', 'armor', { hpPct: 8, dmgReduce: 5 }),
  c2('kraken', 4, 'legendary', 'weapon', { atkPct: 10, pierce: 15, bossDmg: 15 }),
];

export const CARD_IDS: readonly CardId[] = CARD_DEFAULTS.map((d) => d.id);
export const isCardId = (v: unknown): v is CardId => typeof v === 'string' && CARD_IDS.includes(v as CardId);

/** The card's monster picture with its own background (papercraft 512×768, art_templates/papercraft_cards/PROMPTS.md). */
export function cardArt(id: CardId): string {
  return `/assets/sprites/paper/cards/card_art_${id.slice('card_'.length)}.webp`;
}

/**
 * The papercraft frame of a rarity (512×768): a thin border with rounded corners whose whole middle is transparent
 * (owner 2026-11-25: the frame must not cover the picture). It lies over the monster picture, which fills the card;
 * the card's name, rarity, slot and effects are written under the card, not on it (src/client/cardView.ts).
 */
export function cardFrame(r: CardRarity): string {
  return `/assets/sprites/paper/cards/card_frame_${r}.webp`;
}

/** The cards a fusion of `rarity` cards from `floor` can give: same rarity, same floor (owner 2026-11-25). */
export function cardFusePool(rarity: CardRarity, floor: 1 | 2): CardId[] {
  return CARD_DEFAULTS.filter((d) => d.rarity === rarity && d.floor === floor).map((d) => d.id);
}

/** The cards a monster's death rolls: its own card, and cards whose dropFrom is this monster (the parrot's for the captain). */
export function cardsOfMonster(monster: string): CardDef[] {
  return CARD_DEFAULTS.filter((d) => (d.dropFrom ?? d.monster) === monster);
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
  { key: 'dropBossExtra', name: 'การ์ดนกแก้ว (ต่อกุญแจ 1 อัน ตอนฆ่ากัปตันขาไม้ สุ่มแยกจากการ์ดบอส)', group: 'เรทดรอป', def: 0.1, min: 0, max: 100, step: 0.0001, unit: '%' },
  { key: 'floor2Drop', name: 'การ์ดชั้น 2 ดรอปได้ (1 = เปิด, 0 = ปิด · เปิดเมื่อเปิดชั้น 2 ให้ผู้เล่น)', group: 'เรทดรอป', def: 0, min: 0, max: 1, step: 1, unit: '' },
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
  // How a card looks when viewed (src/client/cardView.ts, owner 2026-11-25): a shine that follows the pointer and a tilt.
  { key: 'viewShine', name: 'แสงสะท้อนตามเมาส์/นิ้ว (1 = เปิด, 0 = ปิด)', group: 'หน้าตาการ์ด', def: 1, min: 0, max: 1, step: 1, unit: '' },
  { key: 'viewShinePct', name: 'ความแรงแสงสะท้อน', group: 'หน้าตาการ์ด', def: 55, min: 0, max: 100, step: 1, unit: '%' },
  { key: 'viewTiltDeg', name: 'การ์ดเอียงสูงสุด (องศา, 0 = ไม่เอียง)', group: 'หน้าตาการ์ด', def: 10, min: 0, max: 30, step: 0.5, unit: '' },
  { key: 'viewRainbow', name: 'แสงรุ้งบนการ์ดตำนาน (1 = เปิด, 0 = ปิด)', group: 'หน้าตาการ์ด', def: 1, min: 0, max: 1, step: 1, unit: '' },
  ...CARD_FX.map((f): CardNumField => ({
    key: `cap_${f}`, name: `เพดาน${CARD_FX_NAME[f]} (0 = ไม่จำกัด)`, group: 'เพดานรวมทั้งตัว', min: 0, max: 100, step: 0.1, unit: '%',
    def: ({ pierce: 50, lifesteal: 10, dmgReduce: 30, bossDmg: 40, cdr: 20, potion: 40, expPct: 30, goldPct: 30, normalAtkPct: 40 } as Partial<Record<CardFx, number>>)[f] ?? 0,
  })),
];
