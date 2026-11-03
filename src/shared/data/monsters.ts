export type Behavior = 'passive' | 'skittish' | 'aggressive' | 'charger' | 'boss';

export interface MonsterDef {
  id: string;
  name: string;
  nameTh: string;
  levels: [number, number];
  hp: number;
  atk: number;
  def: number;
  speed: number;
  exp: number;
  gold: [number, number];
  /** 0 = only fights back when hit. */
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  /** World height of one sprite cell. */
  height: number;
  radius: number;
  behavior: Behavior;
  /** Wolves alert each other when one is hit. */
  pack?: boolean;
  itemChance: number;
  potionChance: number;
}

// Zone 1 — Emerald Forest (ตามชีตคอนเซ็ปต์)
export const MONSTERS: Record<string, MonsterDef> = {
  green_slime: {
    id: 'green_slime', name: 'Green Slime', nameTh: 'สไลม์เขียว', levels: [1, 2],
    hp: 32, atk: 5, def: 1, speed: 1.6, exp: 10, gold: [1, 3],
    aggroRange: 0, attackRange: 0.9, attackCooldown: 1.6, height: 0.95, radius: 0.4,
    behavior: 'passive', itemChance: 0.06, potionChance: 0.06,
  },
  wild_rabbit: {
    id: 'wild_rabbit', name: 'Wild Rabbit', nameTh: 'กระต่ายป่า', levels: [2, 3],
    hp: 40, atk: 7, def: 2, speed: 3.0, exp: 14, gold: [2, 4],
    aggroRange: 0, attackRange: 0.9, attackCooldown: 1.3, height: 1.1, radius: 0.35,
    behavior: 'skittish', itemChance: 0.07, potionChance: 0.06,
  },
  forest_fox: {
    id: 'forest_fox', name: 'Forest Fox', nameTh: 'จิ้งจอกป่า', levels: [3, 4],
    hp: 58, atk: 10, def: 3, speed: 3.3, exp: 22, gold: [3, 6],
    aggroRange: 5, attackRange: 1.0, attackCooldown: 1.2, height: 1.25, radius: 0.4,
    behavior: 'aggressive', itemChance: 0.08, potionChance: 0.07,
  },
  wild_boar: {
    id: 'wild_boar', name: 'Wild Boar', nameTh: 'หมูป่า', levels: [5, 6],
    hp: 110, atk: 15, def: 7, speed: 2.6, exp: 38, gold: [5, 9],
    aggroRange: 0, attackRange: 1.1, attackCooldown: 1.6, height: 1.5, radius: 0.55,
    behavior: 'charger', itemChance: 0.1, potionChance: 0.08,
  },
  forest_wolf: {
    id: 'forest_wolf', name: 'Forest Wolf', nameTh: 'หมาป่า', levels: [7, 8],
    hp: 140, atk: 19, def: 8, speed: 3.7, exp: 55, gold: [7, 12],
    aggroRange: 7, attackRange: 1.15, attackCooldown: 1.25, height: 1.65, radius: 0.55,
    behavior: 'aggressive', pack: true, itemChance: 0.12, potionChance: 0.08,
  },
  forest_bear: {
    id: 'forest_bear', name: 'Forest Bear', nameTh: 'หมี (Mini Boss)', levels: [10, 10],
    hp: 1400, atk: 32, def: 14, speed: 2.9, exp: 600, gold: [80, 140],
    aggroRange: 9, attackRange: 1.9, attackCooldown: 1.8, height: 3.3, radius: 1.2,
    behavior: 'boss', itemChance: 1, potionChance: 1,
  },

  // Zone 2 — Misty Marsh
  bog_toad: {
    id: 'bog_toad', name: 'Bog Toad', nameTh: 'คางคกหนอง', levels: [11, 12],
    hp: 230, atk: 26, def: 11, speed: 2.2, exp: 110, gold: [10, 16],
    aggroRange: 0, attackRange: 1.1, attackCooldown: 1.6, height: 1.45, radius: 0.6,
    behavior: 'passive', itemChance: 0.1, potionChance: 0.08,
  },
  marsh_leech: {
    id: 'marsh_leech', name: 'Marsh Leech', nameTh: 'ปลิงหนอง', levels: [12, 13],
    hp: 250, atk: 29, def: 10, speed: 2.5, exp: 130, gold: [11, 18],
    aggroRange: 5, attackRange: 1.0, attackCooldown: 1.3, height: 1.5, radius: 0.45,
    behavior: 'aggressive', itemChance: 0.1, potionChance: 0.08,
  },
  swamp_serpent: {
    id: 'swamp_serpent', name: 'Swamp Serpent', nameTh: 'งูหนองน้ำ', levels: [14, 15],
    hp: 310, atk: 35, def: 13, speed: 3.4, exp: 170, gold: [13, 21],
    aggroRange: 0, attackRange: 1.2, attackCooldown: 1.5, height: 1.6, radius: 0.5,
    behavior: 'charger', itemChance: 0.11, potionChance: 0.08,
  },
  mire_ghoul: {
    id: 'mire_ghoul', name: 'Mire Ghoul', nameTh: 'ผีโคลน', levels: [16, 17],
    hp: 400, atk: 41, def: 16, speed: 3.2, exp: 230, gold: [16, 26],
    aggroRange: 7, attackRange: 1.2, attackCooldown: 1.3, height: 2.0, radius: 0.55,
    behavior: 'aggressive', pack: true, itemChance: 0.12, potionChance: 0.09,
  },
  will_o_wisp: {
    id: 'will_o_wisp', name: "Will-o'-Wisp", nameTh: 'ผีไต้ไฟ', levels: [18, 19],
    hp: 360, atk: 47, def: 13, speed: 3.9, exp: 290, gold: [18, 29],
    aggroRange: 8, attackRange: 1.1, attackCooldown: 1.2, height: 1.6, radius: 0.45,
    behavior: 'aggressive', itemChance: 0.13, potionChance: 0.1,
  },
  bog_witch: {
    id: 'bog_witch', name: 'Bog Witch', nameTh: 'แม่มดหนอง (Boss)', levels: [20, 20],
    hp: 4400, atk: 64, def: 24, speed: 3.0, exp: 3000, gold: [220, 360],
    aggroRange: 9, attackRange: 2.0, attackCooldown: 1.7, height: 3.6, radius: 1.1,
    behavior: 'boss', itemChance: 1, potionChance: 1,
  },
};
