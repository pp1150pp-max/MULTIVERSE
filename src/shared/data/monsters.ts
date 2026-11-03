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
    behavior: 'passive', itemChance: 0.06, potionChance: 0.03,
  },
  wild_rabbit: {
    id: 'wild_rabbit', name: 'Wild Rabbit', nameTh: 'กระต่ายป่า', levels: [2, 3],
    hp: 40, atk: 7, def: 2, speed: 3.0, exp: 14, gold: [2, 4],
    aggroRange: 0, attackRange: 0.9, attackCooldown: 1.3, height: 1.1, radius: 0.35,
    behavior: 'skittish', itemChance: 0.07, potionChance: 0.03,
  },
  forest_fox: {
    id: 'forest_fox', name: 'Forest Fox', nameTh: 'จิ้งจอกป่า', levels: [3, 4],
    hp: 58, atk: 10, def: 3, speed: 3.3, exp: 22, gold: [3, 6],
    aggroRange: 5, attackRange: 1.0, attackCooldown: 1.2, height: 1.25, radius: 0.4,
    behavior: 'aggressive', itemChance: 0.08, potionChance: 0.035,
  },
  wild_boar: {
    id: 'wild_boar', name: 'Wild Boar', nameTh: 'หมูป่า', levels: [5, 6],
    hp: 110, atk: 15, def: 7, speed: 2.6, exp: 38, gold: [5, 9],
    aggroRange: 0, attackRange: 1.1, attackCooldown: 1.6, height: 1.5, radius: 0.55,
    behavior: 'charger', itemChance: 0.1, potionChance: 0.04,
  },
  forest_wolf: {
    id: 'forest_wolf', name: 'Forest Wolf', nameTh: 'หมาป่า', levels: [7, 8],
    hp: 140, atk: 19, def: 8, speed: 3.7, exp: 55, gold: [7, 12],
    aggroRange: 7, attackRange: 1.15, attackCooldown: 1.25, height: 1.65, radius: 0.55,
    behavior: 'aggressive', pack: true, itemChance: 0.12, potionChance: 0.04,
  },
  forest_bear: {
    id: 'forest_bear', name: 'Forest Bear', nameTh: 'หมี (Mini Boss)', levels: [10, 10],
    hp: 1400, atk: 32, def: 14, speed: 2.9, exp: 600, gold: [80, 140],
    aggroRange: 9, attackRange: 1.9, attackCooldown: 1.8, height: 3.3, radius: 1.2,
    behavior: 'boss', itemChance: 1, potionChance: 1,
  },
};
