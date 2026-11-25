import type { BossEffect } from '../sim/types';

export type Behavior = 'passive' | 'skittish' | 'aggressive' | 'charger' | 'boss';

/** The picture a monster's shot flies as: the client's sheet fx_<art>. The cove's are paper only (sprites/paper/fx/). */
export type ShotArt = 'ice_shard' | 'snowball' | 'ember_bolt' | 'iron_ball' | 'bomb' | 'pellets' | 'ghost_skull' | 'bubble';

/** A straight shot at the player. */
export interface ShotDef {
  /** Which picture it flies as. */
  art: ShotArt;
  speed: number;
  range: number;
  mult: number;
  /** Hit radius and drawn size, in world units. */
  radius: number;
  size: number;
  color: string;
}

/**
 * Smugglers' Cove's monster moves (sim/coveMoves.ts, plan 5.2): chainball = slow on its chain, then throws the ball and runs
 * free once hurt · combo = three cuts, the third a short lunge · spread = a fan of pellets · keg = gets up when killed and runs
 * at the nearest player to blow up · parrot = the captain's parrot (sim/peglegCaptain.ts moves it).
 */
export type CoveMove = 'chainball' | 'combo' | 'spread' | 'keg' | 'parrot';

/**
 * The Ghost Ship Graveyard's monster moves (sim/graveMoves.ts, plan 5.3): curse = its thrown skull leaves a ring that slows ·
 * phase = walks through props, fades out (can't be hit) and comes back beside its target with a strike · song = sings, and
 * players in the circle are made to walk to it (a dash breaks it) · split = breaks into small ones when killed.
 */
export type GraveMove = 'curse' | 'phase' | 'song' | 'split';

/**
 * The Kraken Maelstrom's monster moves (sim/maelstromMoves.ts, plan 5.4): dive = sinks out of reach (only its fin shows), slides
 * under its target and bursts up after a warning circle · bubble = its shot traps whoever it hits in a bubble (can't move or dash) ·
 * wave = slashes a wave of power that runs along a straight line · tentacle = never moves, slams a long line at whoever comes near.
 */
export type MaelstromMove = 'dive' | 'bubble' | 'wave' | 'tentacle';

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
  /** Only ever comes when a boss calls it (no spawn area): left out of the admin's monster multipliers. */
  summonOnly?: boolean;
  /** Not weakened by the zone's `tough` (keeps the full `stats` HP and defense). */
  ignoreTough?: boolean;
  /** Extra speed on top of the zone's: moving, attacking and skill cooldowns. */
  speedMult?: number;
  /** Bosses: gear dropped (default 2-3), extra epics on top, and the chance of each stone kind. */
  bossLoot?: { items: number; epics: number; stoneChance?: number };
  /** Bosses only: multiplies the cooldowns of its slam and throw (0.5 = twice as often). */
  skillCd?: number;
  /** Bosses only: casts the Bog Witch's spells on top of its usual attacks (see sim/bogWitch.ts). */
  spells?: 'witch';
  /** Fights by a scripted attack pattern and never moves (see sim/volcanoHeart.ts). */
  pattern?: 'volcano_heart';
  /**
   * Floor 2's new monster moves (sim/beachMoves.ts), their numbers in src/shared/floor2Tuning.ts (/admin):
   * shell = hides when hit (less damage), then strikes back · steal = swoops for gold and flies off ·
   * chain = lightning that jumps from player to player · thorns = reflects part of close-range hits.
   */
  move?: 'shell' | 'steal' | 'chain' | 'thorns' | CoveMove | GraveMove | MaelstromMove;
  /**
   * Never moves and can't be pushed, pulled or knocked back (the kraken and its tentacles round a whirlpool, owner 2026-11-24):
   * no walking, no wandering home, no shoving by other monsters or players.
   */
  anchored?: boolean;
  /**
   * Bosses with their own moves on top of walking and hitting: the Giant Cannon Crab (sim/cannonCrab.ts),
   * the Peg-Leg Captain (sim/peglegCaptain.ts), the Ghost Captain (sim/ghostCaptain.ts), the Kraken (sim/kraken.ts).
   */
  brain?: 'cannon_crab' | 'pegleg_captain' | 'ghost_captain' | 'kraken';
  /**
   * Bosses: the painted effect each of its skills plays (owner 2026-11-21, src/client/bossFx.ts): its hit (sent at
   * the boss with its facing and reach), ground slam, enrage, jumping off / landing, and where its minions appear.
   */
  fx?: { melee?: BossEffect; slam?: BossEffect; enrage?: BossEffect; jump?: BossEffect; summon?: BossEffect };
  itemChance: number;
  potionChance: number;
}

/** Every gold drop is this many times the monster's own range (Sim.dropLoot). */
export const DROP_GOLD_MULT = 2;

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
    behavior: 'boss', summon: { monster: 'forest_wolf', count: 4 },
    fx: { melee: 'boss_bear_claw', slam: 'boss_bear_slam', enrage: 'boss_bear_roar' },
    itemChance: 1, potionChance: 1,
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
    hp: 14872, atk: 124.5, def: 24, speed: 2.1, exp: 3000, gold: [220, 360],
    aggroRange: 9, attackRange: 2.0, attackCooldown: 1.7, height: 3.6, radius: 1.1,
    behavior: 'boss', frenzy: { speed: 3, skill: 0.5 }, spells: 'witch',
    fx: { melee: 'boss_witch_swipe', slam: 'boss_witch_slam', enrage: 'boss_witch_frenzy' },
    itemChance: 1, potionChance: 1,
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
    hp: 42500, atk: 320, def: 34, speed: 2.2, exp: 7000, gold: [550, 900],
    aggroRange: 9, attackRange: 2.1, attackCooldown: 1.8, height: 3.9, radius: 1.25,
    behavior: 'boss', summon: { monster: 'yeti_minion', count: 3, vanish: true }, enrageAt: 0.3, enrageRamp: true, slamRadius: 5.5, skillCd: 0.5,
    fx: { melee: 'boss_yeti_hit', slam: 'boss_yeti_slam', enrage: 'boss_yeti_snow', jump: 'boss_yeti_snow', summon: 'boss_yeti_blizzard' },
    bossLoot: { items: 6, epics: 1 },
    thrown: { art: 'snowball', speed: 9, range: 10, mult: 1.3, radius: 0.6, size: 1.5, color: '#e6f2fb', minRange: 5, cooldown: 5 },
    itemChance: 1, potionChance: 1,
  },
  // Only comes when the yeti calls it, so no EXP, gold or drops (see Sim.killMonster).
  yeti_minion: {
    id: 'yeti_minion', name: 'Yeti Minion', nameTh: 'เยติลูกน้อง', levels: [28, 28],
    hp: 1800, atk: 85, def: 22, speed: 2.5, exp: 0, gold: [0, 0],
    aggroRange: 9, attackRange: 1.4, attackCooldown: 1.4, height: 2.3, radius: 0.8,
    ignoreTough: true, speedMult: 1.3, summonOnly: true,
    behavior: 'aggressive', itemChance: 0, potionChance: 0,
    leap: { cooldown: 8, windup: 1, radius: 1.8, mult: 1.5, minRange: 2.5, maxRange: 8 },
    thrown: { art: 'snowball', speed: 8, range: 8, mult: 1, radius: 0.45, size: 1, color: '#e6f2fb', minRange: 3, cooldown: 6 },
  },

  // Zone 4 — Ashen Isle. The zone's monsterBoost multiplies these (see zones.ts).
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
    hp: 157500, atk: 380, def: 31.85, speed: 0, exp: 16000, gold: [1300, 2100],
    aggroRange: 0, attackRange: 0, attackCooldown: 99, height: 4.4, radius: 1.5,
    behavior: 'boss', pattern: 'volcano_heart', itemChance: 1, potionChance: 1,
    bossLoot: { items: 6, epics: 2, stoneChance: 0.2 },
  },

  // Floor 2, map 1 — Shipwreck Beach (Lv41–50). Numbers: owner 2026-11-20 (plan 5.1); the zone's monsterBoost is Ashen Isle's.
  hermit_crab: {
    id: 'hermit_crab', name: 'Hermit Crab', nameTh: 'ปูเสฉวน', levels: [41, 42],
    hp: 2200, atk: 270, def: 58, speed: 2.0, exp: 1600, gold: [95, 145],
    aggroRange: 0, attackRange: 1.2, attackCooldown: 1.6, height: 1.5, radius: 0.6,
    behavior: 'passive', move: 'shell', itemChance: 0.19, potionChance: 0.12,
  },
  thief_gull: {
    id: 'thief_gull', name: 'Thief Gull', nameTh: 'นกนางนวลขโมย', levels: [43, 44],
    hp: 2400, atk: 300, def: 50, speed: 3.4, exp: 1900, gold: [110, 165],
    aggroRange: 7, attackRange: 1.15, attackCooldown: 1.3, height: 1.6, radius: 0.5,
    behavior: 'aggressive', move: 'steal', itemChance: 0.19, potionChance: 0.12,
  },
  shock_eel: {
    id: 'shock_eel', name: 'Shock Eel', nameTh: 'ปลาไหลไฟฟ้า', levels: [45, 46],
    hp: 2900, atk: 340, def: 60, speed: 2.4, exp: 2200, gold: [130, 195],
    aggroRange: 6, attackRange: 1.2, attackCooldown: 1.5, height: 1.7, radius: 0.5,
    behavior: 'aggressive', move: 'chain', itemChance: 0.2, potionChance: 0.13,
  },
  spike_turtle: {
    id: 'spike_turtle', name: 'Spike Turtle', nameTh: 'เต่าหลังหนาม', levels: [47, 49],
    hp: 4600, atk: 360, def: 90, speed: 1.6, exp: 2600, gold: [150, 230],
    aggroRange: 6, attackRange: 1.4, attackCooldown: 1.8, height: 1.8, radius: 0.85,
    behavior: 'aggressive', move: 'thorns', itemChance: 0.21, potionChance: 0.13,
  },
  // Its id is fixed by the Lv50 gate (BOSS_GATES); its pictures are cut as giant_crab_* (art/floor2-cut).
  cannon_crab: {
    id: 'cannon_crab', name: 'Giant Cannon Crab', nameTh: 'ปูยักษ์กระดองปืนใหญ่ (Boss)', levels: [50, 50],
    hp: 240000, atk: 520, def: 45, speed: 2.0, exp: 26000, gold: [2000, 3200],
    aggroRange: 9, attackRange: 2.2, attackCooldown: 1.8, height: 4.2, radius: 1.5,
    behavior: 'boss', brain: 'cannon_crab', itemChance: 1, potionChance: 1,
    bossLoot: { items: 6, epics: 2, stoneChance: 0.2 },
  },

  // Floor 2, map 2 — Smugglers' Cove (Lv51–60). Numbers: owner 2026-11-24 (the proposed table, plan 5.2); the zone's boost is the beach's.
  // Their new moves (sim/coveMoves.ts) take their numbers from moveTuning.ts (/admin).
  prisoner: {
    id: 'prisoner', name: 'Ship Prisoner', nameTh: 'นักโทษในเรือ', levels: [51, 52],
    hp: 3100, atk: 350, def: 66, speed: 2.0, exp: 2250, gold: [135, 205],
    aggroRange: 0, attackRange: 1.2, attackCooldown: 1.6, height: 1.6, radius: 0.55,
    behavior: 'passive', move: 'chainball', itemChance: 0.21, potionChance: 0.13,
  },
  cutlass_pirate: {
    id: 'cutlass_pirate', name: 'Cutlass Pirate', nameTh: 'โจรสลัดดาบโค้ง', levels: [53, 54],
    hp: 3400, atk: 390, def: 70, speed: 2.6, exp: 2650, gold: [155, 235],
    aggroRange: 7, attackRange: 1.3, attackCooldown: 1.9, height: 1.7, radius: 0.5,
    behavior: 'aggressive', move: 'combo', itemChance: 0.21, potionChance: 0.13,
  },
  shotgunner: {
    id: 'shotgunner', name: 'Blunderbuss Pirate', nameTh: 'มือปืนลูกซอง', levels: [55, 56],
    hp: 3300, atk: 440, def: 62, speed: 2.2, exp: 3100, gold: [180, 275],
    aggroRange: 8, attackRange: 6.5, attackCooldown: 2.2, height: 1.7, radius: 0.5,
    behavior: 'aggressive', move: 'spread', itemChance: 0.22, potionChance: 0.14,
    // One pellet of the fan (coveMoves.ts fires several): its damage and range are the /admin card's, these are the defaults.
    shot: { art: 'pellets', speed: 11, range: 8, mult: 0.5, radius: 0.3, size: 0.55, color: '#ffd27a' },
  },
  keg_prisoner: {
    id: 'keg_prisoner', name: 'Powder-Keg Prisoner', nameTh: 'นักโทษถังดินปืน', levels: [57, 59],
    hp: 5200, atk: 470, def: 85, speed: 2.0, exp: 3600, gold: [210, 320],
    aggroRange: 7, attackRange: 1.3, attackCooldown: 1.8, height: 1.8, radius: 0.6,
    behavior: 'aggressive', move: 'keg', itemChance: 0.22, potionChance: 0.14,
    thrown: { art: 'bomb', speed: 8, range: 9, mult: 1.3, radius: 0.6, size: 0.9, color: '#ff8a3a', minRange: 3, cooldown: 5 },
  },
  // Its id is fixed by the Lv60 gate (BOSS_GATES); its pictures are cut as peg_captain_* (a placeholder until the owner's own).
  pegleg_captain: {
    id: 'pegleg_captain', name: 'Peg-Leg Captain', nameTh: 'กัปตันขาไม้ (Boss)', levels: [60, 60],
    hp: 340000, atk: 680, def: 52, speed: 2.0, exp: 36000, gold: [2800, 4500],
    aggroRange: 9, attackRange: 2.2, attackCooldown: 1.8, height: 4.4, radius: 1.3,
    behavior: 'boss', brain: 'pegleg_captain', summon: { monster: 'cutlass_pirate', count: 3 }, itemChance: 1, potionChance: 1,
    bossLoot: { items: 6, epics: 2, stoneChance: 0.2 },
  },
  // The captain's parrot (sim/peglegCaptain.ts): flies onto a player and calls the gunboats' shots. It never dies: shot down,
  // it is gone for a while, then back on his shoulder. No rewards. Its HP is the /admin card's (moveTuning captain.parrotHp).
  parrot: {
    id: 'parrot', name: "Captain's Parrot", nameTh: 'นกแก้วคู่ใจ', levels: [60, 60],
    hp: 15000, atk: 0, def: 0, speed: 7, exp: 0, gold: [0, 0],
    aggroRange: 0, attackRange: 0, attackCooldown: 99, height: 1.1, radius: 0.45,
    behavior: 'passive', move: 'parrot', summonOnly: true, ignoreTough: true, itemChance: 0, potionChance: 0,
  },

  // Floor 2, map 3 — Ghost Ship Graveyard (Lv61–70). Every one a ghost. Numbers: owner 2026-11-24 (the proposed table: the cove's
  // step again, HP ×1.4 ATK ×1.3 EXP ×1.4 gold ×1.45); the zone's boost is the cove's. Move numbers: moveTuning.ts (/admin).
  ghost_monkey: {
    id: 'ghost_monkey', name: 'Ghost Sailor Monkey', nameTh: 'ลิงกะลาสีผี', levels: [61, 62],
    hp: 4350, atk: 455, def: 76, speed: 2.4, exp: 3150, gold: [195, 295],
    aggroRange: 0, attackRange: 1.2, attackCooldown: 1.6, height: 1.4, radius: 0.5,
    behavior: 'passive', move: 'curse', itemChance: 0.22, potionChance: 0.14,
    // Its skull leaves a curse ring where it lands (graveMoves.ts); the ring's slow and time are the /admin card's.
    thrown: { art: 'ghost_skull', speed: 8, range: 8, mult: 1.2, radius: 0.55, size: 0.9, color: '#7fe0d0', minRange: 2.5, cooldown: 5 },
  },
  ghost_sailor: {
    id: 'ghost_sailor', name: 'Ghost Sailor', nameTh: 'กะลาสีผี', levels: [63, 64],
    hp: 4750, atk: 505, def: 80, speed: 2.5, exp: 3700, gold: [225, 340],
    aggroRange: 7, attackRange: 1.3, attackCooldown: 1.8, height: 1.7, radius: 0.5,
    behavior: 'aggressive', move: 'phase', itemChance: 0.22, potionChance: 0.14,
  },
  ghost_siren: {
    id: 'ghost_siren', name: 'Ghost Siren', nameTh: 'ไซเรนผี', levels: [65, 66],
    hp: 4600, atk: 570, def: 72, speed: 2.2, exp: 4350, gold: [260, 400],
    aggroRange: 8, attackRange: 1.4, attackCooldown: 1.9, height: 1.7, radius: 0.5,
    behavior: 'aggressive', move: 'song', itemChance: 0.23, potionChance: 0.14,
  },
  barnacle_crew: {
    id: 'barnacle_crew', name: 'Barnacle Ghost Crew', nameTh: 'ลูกเรือหอยเกาะผี', levels: [67, 69],
    hp: 7300, atk: 610, def: 98, speed: 2.0, exp: 5050, gold: [305, 465],
    aggroRange: 7, attackRange: 1.4, attackCooldown: 1.9, height: 1.9, radius: 0.65,
    behavior: 'aggressive', move: 'split', itemChance: 0.23, potionChance: 0.15,
  },
  // What a barnacle ghost crew breaks into (graveMoves.ts): 30% of its HP, 70% of its ATK, its level. No rewards (owner 2026-11-24).
  barnacle_small: {
    id: 'barnacle_small', name: 'Small Barnacle Ghost', nameTh: 'หอยเกาะผีตัวเล็ก', levels: [67, 69],
    hp: 2190, atk: 427, def: 98, speed: 2.6, exp: 0, gold: [0, 0],
    aggroRange: 8, attackRange: 1.2, attackCooldown: 1.5, height: 1.1, radius: 0.4,
    behavior: 'aggressive', summonOnly: true, itemChance: 0, potionChance: 0,
  },
  // Its id is fixed by the Lv70 gate (BOSS_GATES); its picture is the cut sheet ghost_captain (walk, slash, bell, vanish).
  ghost_captain: {
    id: 'ghost_captain', name: 'Ghost Captain of the Dead Ship', nameTh: 'กัปตันผีเรือคนตาย (Boss)', levels: [70, 70],
    hp: 476000, atk: 885, def: 60, speed: 2.0, exp: 50400, gold: [4060, 6525],
    aggroRange: 9, attackRange: 2.2, attackCooldown: 1.8, height: 4.4, radius: 1.3,
    behavior: 'boss', brain: 'ghost_captain', itemChance: 1, potionChance: 1,
    bossLoot: { items: 6, epics: 2, stoneChance: 0.2 },
  },

  // Floor 2, map 4 — Kraken Maelstrom (Lv71–80). Numbers: owner 2026-11-24 (the proposed table: the graveyard's slot by slot, HP ×1.4
  // ATK ×1.3 DEF ×1.15 EXP ×1.4 gold ×1.45); the zone's boost is the graveyard's. Move numbers: moveTuning.ts (/admin).
  shark_knight: {
    id: 'shark_knight', name: 'Shark Knight', nameTh: 'อัศวินฉลาม', levels: [71, 72],
    hp: 6100, atk: 590, def: 87, speed: 2.5, exp: 4400, gold: [285, 430],
    aggroRange: 7, attackRange: 1.4, attackCooldown: 1.7, height: 1.9, radius: 0.55,
    behavior: 'aggressive', move: 'dive', itemChance: 0.23, potionChance: 0.15,
  },
  seahorse_soldier: {
    id: 'seahorse_soldier', name: 'Seahorse Soldier', nameTh: 'ม้าน้ำทหาร', levels: [73, 74],
    hp: 6650, atk: 655, def: 92, speed: 2.2, exp: 5200, gold: [325, 495],
    aggroRange: 9, attackRange: 9, attackCooldown: 2.4, height: 1.6, radius: 0.5,
    behavior: 'aggressive', move: 'bubble', itemChance: 0.23, potionChance: 0.15,
    // Its bubble traps whoever it hits (maelstromMoves.ts); the trap's time is the /admin card's, its reach and damage here.
    shot: { art: 'bubble', speed: 7, range: 9, mult: 1, radius: 0.5, size: 0.9, color: '#8ae0f0' },
  },
  ghost_pirate_king: {
    id: 'ghost_pirate_king', name: 'Ghost Pirate King', nameTh: 'ราชาโจรสลัดผี', levels: [75, 76],
    hp: 6450, atk: 740, def: 83, speed: 2.3, exp: 6100, gold: [375, 580],
    aggroRange: 8, attackRange: 1.5, attackCooldown: 1.9, height: 2.1, radius: 0.6,
    behavior: 'aggressive', move: 'wave', itemChance: 0.24, potionChance: 0.15,
  },
  // Round the whirlpool's rim (zones.ts rimSpawns): never moves, slams a long line at whoever comes within reach.
  kraken_tentacle: {
    id: 'kraken_tentacle', name: 'Kraken Tentacle', nameTh: 'หนวดคราเคน', levels: [77, 79],
    hp: 10200, atk: 795, def: 113, speed: 0, exp: 7050, gold: [440, 675],
    aggroRange: 7, attackRange: 7, attackCooldown: 2.4, height: 3.2, radius: 0.7,
    behavior: 'aggressive', move: 'tentacle', anchored: true, itemChance: 0.24, potionChance: 0.15,
  },
  // The kraken's own arms in its room (sim/kraken.ts): its picture is the tentacle's; HP a share of the kraken's (/admin), no rewards.
  kraken_arm: {
    id: 'kraken_arm', name: 'Kraken Arm', nameTh: 'หนวดคราเคน', levels: [80, 80],
    hp: 10200, atk: 1150, def: 69, speed: 0, exp: 0, gold: [0, 0],
    aggroRange: 9, attackRange: 7, attackCooldown: 2.4, height: 3.6, radius: 0.8,
    behavior: 'aggressive', move: 'tentacle', anchored: true, summonOnly: true, ignoreTough: true, itemChance: 0, potionChance: 0,
  },
  // Its id is fixed by the Lv80 gate (BOSS_GATES). It lies under its room's whirlpool and never moves (sim/kraken.ts).
  kraken: {
    id: 'kraken', name: 'Kraken', nameTh: 'คราเคน (Boss)', levels: [80, 80],
    hp: 666000, atk: 1150, def: 69, speed: 0, exp: 70500, gold: [5890, 9460],
    aggroRange: 16, attackRange: 6, attackCooldown: 2.2, height: 6.5, radius: 3.8,
    behavior: 'boss', brain: 'kraken', anchored: true, itemChance: 1, potionChance: 1,
    bossLoot: { items: 6, epics: 2, stoneChance: 0.2 },
  },
};
