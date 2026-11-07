export type Behavior = 'passive' | 'skittish' | 'aggressive' | 'charger' | 'boss';

/** A straight shot at the player. */
export interface ShotDef {
  /** Which picture it flies as. */
  art: 'ice_shard' | 'snowball' | 'ember_bolt';
  speed: number;
  range: number;
  mult: number;
  /** Hit radius and drawn size, in world units. */
  radius: number;
  size: number;
  color: string;
}

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
  /** Different monsters with the same packId alert each other too. */
  packId?: string;
  /**
   * Bosses only: calls these minions once per fight when it drops below half HP. With `vanish` it
   * jumps off the map at the same time, and comes back only when they are all dead.
   */
  summon?: { monster: string; count: number; vanish?: boolean };
  /** Ranged monsters: every attack fires this instead of hitting up close. attackRange is how far away it shoots from. */
  shot?: ShotDef;
  /** Thrown at a target standing farther off than minRange. */
  thrown?: ShotDef & { minRange: number; cooldown: number };
  /** Bosses only: radius of the ground slam (default 4.2). */
  slamRadius?: number;
  /** Jumps onto a spot marked on the ground, hurting everyone on it when it lands. */
  leap?: { cooldown: number; windup: number; radius: number; mult: number; minRange: number; maxRange: number };
  /** Bosses only: share of HP at which it enrages (default 0.5). */
  enrageAt?: number;
  /**
   * Bosses only: its speed-up for not landing a hit starts only once enraged, and replaces the
   * usual enrage run speed. It drops back to normal at each hit, then climbs again.
   */
  enrageRamp?: boolean;
  /** Bosses only: below half HP, chase speed is multiplied by `speed` and every attack's
   *  cooldown and wind-up by `skill` — replaces the usual enrage boost. */
  frenzy?: { speed: number; skill: number };
  /** Fights by a scripted attack pattern and never moves (see sim/volcanoHeart.ts). */
  pattern?: 'volcano_heart';
  itemChance: number;
  potionChance: number;
}

// Zone 1 — Emerald Forest (ตามชีตคอนเซ็ปต์)
export const MONSTERS: Record<string, MonsterDef> = {
  green_slime: {
    id: 'green_slime', name: 'Green Slime', nameTh: 'สไลม์เขียว', levels: [1, 2],
    hp: 32, atk: 5, def: 1, speed: 1.12, exp: 10, gold: [1, 3],
    aggroRange: 0, attackRange: 0.9, attackCooldown: 1.6, height: 0.95, radius: 0.4,
    behavior: 'passive', itemChance: 0.06, potionChance: 0.03,
  },
  wild_rabbit: {
    id: 'wild_rabbit', name: 'Wild Rabbit', nameTh: 'กระต่ายป่า', levels: [2, 3],
    hp: 40, atk: 7, def: 2, speed: 2.1, exp: 14, gold: [2, 4],
    aggroRange: 0, attackRange: 0.9, attackCooldown: 1.3, height: 1.1, radius: 0.35,
    behavior: 'skittish', itemChance: 0.07, potionChance: 0.03,
  },
  forest_fox: {
    id: 'forest_fox', name: 'Forest Fox', nameTh: 'จิ้งจอกป่า', levels: [3, 4],
    hp: 58, atk: 10, def: 3, speed: 2.31, exp: 22, gold: [3, 6],
    aggroRange: 5, attackRange: 1.0, attackCooldown: 1.2, height: 1.25, radius: 0.4,
    behavior: 'aggressive', itemChance: 0.08, potionChance: 0.035,
  },
  wild_boar: {
    id: 'wild_boar', name: 'Wild Boar', nameTh: 'หมูป่า', levels: [5, 6],
    hp: 110, atk: 15, def: 7, speed: 1.82, exp: 38, gold: [5, 9],
    aggroRange: 0, attackRange: 1.1, attackCooldown: 1.6, height: 1.5, radius: 0.55,
    behavior: 'charger', itemChance: 0.1, potionChance: 0.04,
  },
  forest_wolf: {
    id: 'forest_wolf', name: 'Forest Wolf', nameTh: 'หมาป่า', levels: [7, 8],
    hp: 140, atk: 19, def: 8, speed: 2.59, exp: 55, gold: [7, 12],
    aggroRange: 7, attackRange: 1.15, attackCooldown: 1.25, height: 1.65, radius: 0.55,
    behavior: 'aggressive', pack: true, itemChance: 0.12, potionChance: 0.04,
  },
  forest_bear: {
    id: 'forest_bear', name: 'Forest Bear', nameTh: 'หมี (Mini Boss)', levels: [10, 10],
    hp: 2366, atk: 42, def: 14, speed: 2.03, exp: 600, gold: [80, 140],
    aggroRange: 9, attackRange: 1.9, attackCooldown: 1.8, height: 3.3, radius: 1.2,
    behavior: 'boss', summon: { monster: 'forest_wolf', count: 4 }, itemChance: 1, potionChance: 1,
  },

  // Zone 2 — Misty Marsh
  bog_toad: {
    id: 'bog_toad', name: 'Bog Toad', nameTh: 'คางคกหนอง', levels: [11, 12],
    hp: 230, atk: 26, def: 11, speed: 1.54, exp: 110, gold: [10, 16],
    aggroRange: 0, attackRange: 1.1, attackCooldown: 1.6, height: 1.45, radius: 0.6,
    behavior: 'passive', itemChance: 0.1, potionChance: 0.08,
  },
  marsh_leech: {
    id: 'marsh_leech', name: 'Marsh Leech', nameTh: 'ปลิงหนอง', levels: [12, 13],
    hp: 250, atk: 29, def: 10, speed: 1.75, exp: 130, gold: [11, 18],
    aggroRange: 5, attackRange: 1.0, attackCooldown: 1.3, height: 1.5, radius: 0.45,
    behavior: 'aggressive', itemChance: 0.1, potionChance: 0.08,
  },
  swamp_serpent: {
    id: 'swamp_serpent', name: 'Swamp Serpent', nameTh: 'งูหนองน้ำ', levels: [14, 15],
    hp: 310, atk: 35, def: 13, speed: 2.38, exp: 170, gold: [13, 21],
    aggroRange: 0, attackRange: 1.2, attackCooldown: 1.5, height: 1.6, radius: 0.5,
    behavior: 'charger', itemChance: 0.11, potionChance: 0.08,
  },
  mire_ghoul: {
    id: 'mire_ghoul', name: 'Mire Ghoul', nameTh: 'ผีโคลน', levels: [16, 17],
    hp: 400, atk: 41, def: 16, speed: 2.24, exp: 230, gold: [16, 26],
    aggroRange: 7, attackRange: 1.2, attackCooldown: 1.3, height: 2.0, radius: 0.55,
    behavior: 'aggressive', pack: true, itemChance: 0.12, potionChance: 0.09,
  },
  will_o_wisp: {
    id: 'will_o_wisp', name: "Will-o'-Wisp", nameTh: 'ผีไต้ไฟ', levels: [18, 19],
    hp: 360, atk: 47, def: 13, speed: 2.73, exp: 290, gold: [18, 29],
    aggroRange: 8, attackRange: 1.1, attackCooldown: 1.2, height: 1.6, radius: 0.45,
    behavior: 'aggressive', itemChance: 0.13, potionChance: 0.1,
  },
  bog_witch: {
    id: 'bog_witch', name: 'Bog Witch', nameTh: 'แม่มดหนอง (Boss)', levels: [20, 20],
    hp: 7436, atk: 83, def: 24, speed: 2.1, exp: 3000, gold: [220, 360],
    aggroRange: 9, attackRange: 2.0, attackCooldown: 1.7, height: 3.6, radius: 1.1,
    behavior: 'boss', frenzy: { speed: 3, skill: 0.5 }, itemChance: 1, potionChance: 1,
  },

  // Zone 3 — Frost Reach
  frost_penguin: {
    id: 'frost_penguin', name: 'Frost Penguin', nameTh: 'เพนกวินหิมะ', levels: [21, 22],
    hp: 480, atk: 56, def: 18, speed: 2.0, exp: 400, gold: [22, 34],
    aggroRange: 0, attackRange: 1.1, attackCooldown: 1.5, height: 1.5, radius: 0.5,
    behavior: 'charger', itemChance: 0.13, potionChance: 0.1,
  },
  tusk_seal: {
    id: 'tusk_seal', name: 'Tusk Seal', nameTh: 'แมวน้ำเขี้ยวยาว', levels: [23, 24],
    hp: 680, atk: 66, def: 24, speed: 1.75, exp: 490, gold: [26, 40],
    aggroRange: 6, attackRange: 1.3, attackCooldown: 1.6, height: 1.6, radius: 0.7,
    behavior: 'aggressive', pack: true, itemChance: 0.13, potionChance: 0.1,
  },
  snow_owl: {
    id: 'snow_owl', name: 'Snow Owl', nameTh: 'นกฮูกหิมะ', levels: [25, 26],
    hp: 560, atk: 80, def: 18, speed: 3.1, exp: 580, gold: [30, 46],
    aggroRange: 7, attackRange: 1.15, attackCooldown: 1.15, height: 1.7, radius: 0.5,
    behavior: 'aggressive', itemChance: 0.14, potionChance: 0.1,
  },
  snow_sprite: {
    id: 'snow_sprite', name: 'Snow Sprite', nameTh: 'ภูตหิมะ', levels: [27, 28],
    hp: 640, atk: 90, def: 22, speed: 2.1, exp: 680, gold: [34, 52],
    aggroRange: 9, attackRange: 7, attackCooldown: 2, height: 1.7, radius: 0.5,
    behavior: 'aggressive', pack: true, packId: 'snow_sprite', itemChance: 0.14, potionChance: 0.11,
    shot: { art: 'ice_shard', speed: 8, range: 11, mult: 1, radius: 0.35, size: 0.55, color: '#bfeaff' },
  },
  // Same strength as the sprite that shoots; they come in groups of 1 sprite and 2 of these.
  snow_brawler: {
    id: 'snow_brawler', name: 'Snow Brawler', nameTh: 'ภูตหิมะหมัดน้ำแข็ง', levels: [27, 28],
    hp: 640, atk: 90, def: 22, speed: 2.1, exp: 680, gold: [34, 52],
    aggroRange: 9, attackRange: 1.2, attackCooldown: 1.4, height: 1.8, radius: 0.55,
    behavior: 'aggressive', pack: true, packId: 'snow_sprite', itemChance: 0.14, potionChance: 0.11,
  },
  polar_bear: {
    id: 'polar_bear', name: 'Polar Bear', nameTh: 'หมีขั้วโลก', levels: [29, 29],
    hp: 1500, atk: 105, def: 30, speed: 2.2, exp: 1100, gold: [55, 85],
    aggroRange: 6, attackRange: 1.5, attackCooldown: 1.7, height: 2.5, radius: 0.95,
    behavior: 'charger', itemChance: 0.2, potionChance: 0.12,
  },
  yeti: {
    id: 'yeti', name: 'Yeti', nameTh: 'เยติ (Boss)', levels: [30, 30],
    hp: 17000, atk: 160, def: 34, speed: 2.2, exp: 7000, gold: [550, 900],
    aggroRange: 9, attackRange: 2.1, attackCooldown: 1.8, height: 3.9, radius: 1.25,
    behavior: 'boss', summon: { monster: 'yeti_minion', count: 3, vanish: true }, enrageAt: 0.3, enrageRamp: true, slamRadius: 5.5,
    thrown: { art: 'snowball', speed: 9, range: 10, mult: 1.3, radius: 0.6, size: 1.5, color: '#e6f2fb', minRange: 5, cooldown: 5 },
    itemChance: 1, potionChance: 1,
  },
  // Only comes when the yeti calls it, so no EXP, gold or drops (see Sim.killMonster).
  yeti_minion: {
    id: 'yeti_minion', name: 'Yeti Minion', nameTh: 'เยติลูกน้อง', levels: [28, 28],
    hp: 1800, atk: 85, def: 22, speed: 2.5, exp: 0, gold: [0, 0],
    aggroRange: 9, attackRange: 1.4, attackCooldown: 1.4, height: 2.3, radius: 0.8,
    behavior: 'aggressive', itemChance: 0, potionChance: 0,
    leap: { cooldown: 8, windup: 1, radius: 1.8, mult: 1.5, minRange: 2.5, maxRange: 8 },
    thrown: { art: 'snowball', speed: 8, range: 8, mult: 1, radius: 0.45, size: 1, color: '#e6f2fb', minRange: 3, cooldown: 6 },
  },

  // Zone 4 — Ashen Isle. Final numbers: this zone sets no monsterBoost.
  ember_wisp: {
    id: 'ember_wisp', name: 'Ember Wisp', nameTh: 'ลูกไฟจิ๋ว', levels: [31, 32],
    hp: 1350, atk: 170, def: 36, speed: 2.4, exp: 1000, gold: [60, 90],
    aggroRange: 0, attackRange: 1.1, attackCooldown: 1.4, height: 1.4, radius: 0.45,
    behavior: 'passive', itemChance: 0.15, potionChance: 0.11,
  },
  salamander: {
    id: 'salamander', name: 'Salamander', nameTh: 'ซาลาแมนเดอร์', levels: [33, 34],
    hp: 1900, atk: 195, def: 46, speed: 2.1, exp: 1200, gold: [70, 105],
    aggroRange: 0, attackRange: 1.3, attackCooldown: 1.6, height: 1.6, radius: 0.65,
    behavior: 'charger', itemChance: 0.15, potionChance: 0.11,
  },
  lava_bat: {
    id: 'lava_bat', name: 'Lava Bat', nameTh: 'ค้างคาวลาวา', levels: [35, 36],
    hp: 1600, atk: 230, def: 34, speed: 3.5, exp: 1400, gold: [82, 125],
    aggroRange: 7, attackRange: 1.15, attackCooldown: 1.15, height: 1.7, radius: 0.5,
    behavior: 'aggressive', itemChance: 0.16, potionChance: 0.11,
  },
  magma_golem: {
    id: 'magma_golem', name: 'Magma Golem', nameTh: 'โกเลมแมกมา', levels: [37, 38],
    hp: 3200, atk: 255, def: 62, speed: 1.7, exp: 1700, gold: [98, 150],
    aggroRange: 6, attackRange: 1.5, attackCooldown: 1.9, height: 2.5, radius: 0.95,
    behavior: 'aggressive', itemChance: 0.17, potionChance: 0.12,
  },
  ash_mage: {
    id: 'ash_mage', name: 'Ash Mage', nameTh: 'จอมเวทเถ้าถ่าน', levels: [39, 39],
    hp: 2300, atk: 285, def: 44, speed: 2.3, exp: 1900, gold: [115, 175],
    aggroRange: 9, attackRange: 7, attackCooldown: 2, height: 1.9, radius: 0.5,
    behavior: 'aggressive', pack: true, packId: 'ash', itemChance: 0.18, potionChance: 0.12,
    shot: { art: 'ember_bolt', speed: 8, range: 11, mult: 1, radius: 0.35, size: 0.6, color: '#ffa95a' },
  },
  ash_knight: {
    id: 'ash_knight', name: 'Ash Knight', nameTh: 'อัศวินเถ้าถ่าน', levels: [39, 39],
    hp: 2800, atk: 285, def: 56, speed: 2.3, exp: 1900, gold: [115, 175],
    aggroRange: 9, attackRange: 1.3, attackCooldown: 1.4, height: 2, radius: 0.6,
    behavior: 'aggressive', pack: true, packId: 'ash', itemChance: 0.18, potionChance: 0.12,
  },
  volcano_heart: {
    id: 'volcano_heart', name: 'Volcano Heart', nameTh: 'หัวใจภูเขาไฟ (Boss)', levels: [40, 40],
    hp: 45000, atk: 380, def: 65, speed: 0, exp: 16000, gold: [1300, 2100],
    aggroRange: 0, attackRange: 0, attackCooldown: 99, height: 4.4, radius: 1.5,
    behavior: 'boss', pattern: 'volcano_heart', itemChance: 1, potionChance: 1,
  },
};
