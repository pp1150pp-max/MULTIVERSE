// Game balance the owner (and GMs, if allowed) tune from the /admin "ปรับสมดุล" tab: every class's stats
// (Lv1, per level, multipliers, boss damage), the game-wide regen cuts, and the item tier tables
// (chances, widths, floor, bosses' tier boost). Pure data and checks: the code defaults are in
// data/classes.ts and data/items.ts, and changes are saved in the server's settings table as overrides
// only (like cos_tuning), so an untouched server runs exactly the code. The server applies them at start
// and on every save, and sends them to every browser so tooltips and the blacksmith's odds match.
import { CLASSES, CLASS_IDS, MP_COST_PER_LEVEL } from './data/classes';
import {
  CODE_BOSS_TIER_BOOST, CODE_RANGE_FLOOR, setAffixWeights, CODE_TIER_WEIGHT, CODE_TIER_WIDTH, setItemStatMult, setTierTables, TIER_BAND_NAME, TIER_BANDS, tierBandOf, type TierBand, type TierTableDef,
} from './data/items';
import { CODE_POTIONS, CODE_SWORD_POTION_BONUS, POTION_RANGE, type PotionNums } from './data/potionTable';
import { MONSTERS, type MonsterDef } from './data/monsters';
import { ZONES } from './data/zones';
import { checkFxLayerTuning, codeFxLayer, fxLayerChanges, mergeFxLayer, type FxLayerConfig, type FxLayerTuning } from './fxLayerTuning';
import { checkMenuLayoutTuning, codeMenuLayout, mergeMenuLayout, menuLayoutChanges, type MenuLayoutConfig, type MenuLayoutTuning } from './menuLayout';
import { attackRootChanges, checkAttackRootTuning, codeAttackRoot, mergeAttackRoot, type AttackRootConfig, type AttackRootTuning } from './attackRootTuning';
import { checkRigLookTuning, codeRigLook, mergeRigLook, rigLookChanges, type RigLookConfig, type RigLookTuning } from './rigLookTuning';
import { autoChanges, checkAutoTuning, codeAuto, mergeAuto, type AutoConfig, type AutoTuning } from './autoTuning';
import { checkTutorialTuning, codeTutorial, mergeTutorial, tutorialChanges, type TutorialConfig, type TutorialTuning } from './tutorial';
import { checkSkillTuning, codeSkills, mergeSkills, skillChanges, type SkillConfig, type SkillTuning } from './skillTuning';
import { addInto, emptyStats, setExpTune } from './formulas';
import { STAT_KEYS, STAT_LABEL, type ClassId, type PotionKind, type PotionSize, type StatKey, type Stats } from './types';

/** Key in the server's settings table. */
export const BALANCE_SETTING = 'balance';

export const POTION_KINDS: readonly PotionKind[] = ['hp', 'mp'];
export const POTION_SIZE_LIST: readonly PotionSize[] = ['s', 'm', 'l'];
/** Potions in use: heal amount and price of each bottle, and the swordsman's HP-potion bonus in %. */
export interface PotionBalance { hp: Record<PotionSize, PotionNums>; mp: Record<PotionSize, PotionNums>; swordBonus: number }
/** Potion changes saved: only the numbers that differ from the code. */
export interface PotionTuning { hp?: Partial<Record<PotionSize, Partial<PotionNums>>>; mp?: Partial<Record<PotionSize, Partial<PotionNums>>>; swordBonus?: number }
const codePotions = (): PotionBalance => ({ hp: structuredClone(CODE_POTIONS.hp), mp: structuredClone(CODE_POTIONS.mp), swordBonus: CODE_SWORD_POTION_BONUS });
export { POTION_RANGE };

/** Share of the HP regen stat that actually applies (owner: -60%). */
export const CODE_HP_REGEN_MULT = 0.4;
/** Same for MP regen (owner: -75%, so skills lean on MP potions). */
export const CODE_MP_REGEN_MULT = 0.25;
/** Boss switches target every this many seconds (owner 2026-11-17); 0 = off. */
export const CODE_BOSS_SWITCH_SEC = 10;
/** Ordinary monsters give up after this many seconds without a hit (owner 2026-11-17: off). */
export const CODE_MOB_GIVE_UP_SEC = 0;
export const CODE_MOB_RETURN_IGNORE_HITS = true;
/** Blacksmith: the Auto button that enhances again and again up to a chosen level (owner 2026-11-18: on). */
export const CODE_FORGE_AUTO = true;
/** Click-to-walk carries on when the browser tab is hidden: the server walks the rest of the way (owner 2026-11-18: on). */
export const CODE_WALK_HIDDEN = true;
/** Boss room: the boss keeps its HP and waits when the whole group is down (owner 2026-11-17); off = it walks home and heals. */
export const CODE_BOSS_WIPE_KEEP_HP = true;
/** Seconds a boss-room group that is all down has to get someone up with a feather (owner: 5). */
export const CODE_ROOM_WIPE_SECONDS = 5;
/**
 * Most a character's skill cooldowns can be cut by the "ลดคูลดาวน์สกิล %" item stat, in % (owner 2026-11-19:
 * no cap on the total from items, but a safety stop at 75% in case the multipliers are set high).
 */
export const CODE_CDR_CAP = 75;

/**
 * One class's numbers: Lv1 stats, added per level, final multipliers (gear included), damage to bosses, and how
 * many % more MP its skills cost per level above 1 (see skillMpCost).
 */
export interface ClassBalance { base: Stats; growth: Stats; mult: Stats; bossDmgMult: number; mpCostPerLevel: number }
export type StatPart = 'base' | 'growth' | 'mult';
export const STAT_PARTS: readonly StatPart[] = ['base', 'growth', 'mult'];
export const STAT_PART_NAME: Record<StatPart, string> = { base: 'Lv1', growth: 'ต่อเลเวล', mult: 'ตัวคูณ' };

/**
 * Some parts of a tier table (owner 2026-11-11): each part given replaces the one it would otherwise use, each
 * part left out falls through. Arrays T1 first; widths and floor in %. A stat at an item's level band takes
 * each part from the first that has it: the stat's table for that band -> the stat's table for every level ->
 * the band's table for every stat -> the central table.
 */
export interface TierParts { weight?: number[]; width?: number[]; floor?: number; bossBoost?: number }
/** One stat's own tier table for every level, plus its tables for single level bands. */
export interface StatTierTuning extends TierParts { bands?: Partial<Record<TierBand, TierParts>> }
export type StatTierPart = keyof TierParts;
export const STAT_TIER_PARTS: readonly StatTierPart[] = ['weight', 'width', 'floor', 'bossBoost'];
export const STAT_TIER_PART_NAME: Record<StatTierPart, string> = { weight: 'โอกาส', width: 'ความกว้าง', floor: 'ค่าต่ำสุด', bossBoost: 'บอสเพิ่ม tier' };

/**
 * Ordinary monsters' multipliers (owner 2026-11-12): by level band (of the monster kind's lowest level) and by
 * kind, the two multiplied together. Not bosses; the minions a boss calls count by their own kind (owner 2026-11-13).
 */
export const MONSTER_STATS = ['hp', 'atk', 'def', 'speed', 'atkSpeed', 'exp', 'gold', 'aggro', 'range'] as const;
export type MonsterStat = (typeof MONSTER_STATS)[number];
export type MonsterMults = Record<MonsterStat, number>;
export const MONSTER_STAT_NAME: Record<MonsterStat, string> = {
  hp: 'HP', atk: 'ATK', def: 'DEF', speed: 'วิ่งเร็ว', atkSpeed: 'ตีเร็ว', exp: 'EXP', gold: 'ทอง', aggro: 'ระยะ aggro', range: 'ระยะโจมตี',
};
/** Multipliers that are not ×1: per level band and per monster kind (id). */
export interface MonsterTuning {
  bands?: Partial<Record<TierBand, Partial<MonsterMults>>>;
  types?: Record<string, Partial<MonsterMults>>;
}
export const NO_MONSTER_MULT: Readonly<MonsterMults> = Object.freeze(Object.fromEntries(MONSTER_STATS.map((k) => [k, 1])) as MonsterMults);
/** Monster kinds the multipliers apply to: all but bosses (minions a boss calls are included, owner 2026-11-13). */
export const isTunableMonster = (def: MonsterDef): boolean => def.behavior !== 'boss';
/** Tunable kinds, by lowest level (the admin page's list). */
export const TUNABLE_MONSTERS: readonly MonsterDef[] = Object.values(MONSTERS)
  .filter(isTunableMonster)
  .sort((a, b) => a.levels[0] - b.levels[0] || a.levels[1] - b.levels[1]);
/** The level band a monster kind is tuned in (index into TIER_BANDS): by its lowest level. */
export const monsterBandOf = (def: MonsterDef): number => tierBandOf(def.levels[0]);

/**
 * Monsters per spawn spot, by map (owner 2026-11-17): each spot keeps this many times its code count, as a pack
 * at the same spot (the maps have no room for more spots). Decimals spread over the spots (×1.5 = every other
 * spot one more). Bosses are never multiplied. Takes effect live: more = the extra ones come in on the spot's
 * respawn timer, fewer = the extra ones are not replaced when they die.
 */
export const PACK_ZONES: readonly { id: string; nameTh: string }[] = Object.values(ZONES)
  .filter((z) => z.spawns.length > 0)
  .map((z) => ({ id: z.id, nameTh: z.nameTh }));

/** Every tunable number, as the game uses it. Tier arrays are T1 first; widths and floor in %. */
export interface Balance {
  classes: Record<ClassId, ClassBalance>;
  hpRegenMult: number;
  mpRegenMult: number;
  tierWeight: number[];
  tierWidth: number[];
  rangeFloor: number;
  bossTierBoost: number;
  /** Stats with a tier table of their own (none in code); the others use the central one above. */
  statTiers: Partial<Record<StatKey, StatTierTuning>>;
  /** Level bands with a tier table of their own for every stat (none in code). */
  bandTiers: Partial<Record<TierBand, TierParts>>;
  /**
   * Item stat multipliers (owner 2026-11-11): every line of that stat on every item, new and old, is this many
   * times what it was rolled at. Only the owner changes them (a separate confirm that also scales every saved
   * item, see server/admin-tools.ts); the normal save keeps them as they are.
   */
  itemStatMult: Record<StatKey, number>;
  /** How likely each stat is as an extra line on items, relative to the others (owner 2026-11-19: 1 each in code). */
  affixWeight: Record<StatKey, number>;
  /** Most the "ลดคูลดาวน์สกิล %" stat can cut a skill's cooldown, in %. */
  cdrCap: number;
  /** Ordinary monsters' multipliers that are not ×1 (none in code). */
  monsters: MonsterTuning;
  /** Monsters per spawn spot ×, by map id (PACK_ZONES); a map left out is ×1. */
  mobPack: Record<string, number>;
  /** EXP needed to level × this, per 10 levels (owner 2026-11-19); a band left out is ×1. */
  expMult: Partial<Record<TierBand, number>>;
  /** Potion heal amounts, prices and the swordsman's bonus (owner 2026-11-17). */
  potions: PotionBalance;
  /** Boss swaps to another player who hurt it after this many seconds on one target; 0 = never (owner 2026-11-17). */
  bossSwitchSec: number;
  /** Ordinary monsters stop chasing after this many seconds without being hit; 0 = they never give up (the leash still holds). */
  mobGiveUpSec: number;
  /** A monster walking home (leash / hurt after a fight) ignores hits: no turning back to chase (owner 2026-11-17); off = the old behaviour. */
  mobReturnIgnoreHits: boolean;
  /** Blacksmith Auto enhance button shown (owner 2026-11-18); off = hidden and a running Auto stops. Browser side only. */
  forgeAuto: boolean;
  /** A clicked walk goes on while the tab is hidden (server walks to the spot); off = the character stops as before. */
  walkHidden: boolean;
  /** Boss room: when every player is down the boss keeps its HP and waits (no walking home, healing or reset); off = the old behaviour. */
  bossWipeKeepHp: boolean;
  /** Seconds a boss-room group that is all down has to revive someone before it has lost. */
  roomWipeSec: number;
  /** Auto Play defaults, distances and switches (autoTuning.ts). */
  auto: AutoConfig;
  /** The skill effects' extra layer: glow, ground light, particles, hit feel (fxLayerTuning.ts). */
  fxLayer: FxLayerConfig;
  /** Which papercraft sword / armour each item shows on the sword rig (rigLookTuning.ts). */
  rigLook: RigLookConfig;
  /** Stopping for a moment on each attack, per class (attackRootTuning.ts). */
  attackRoot: AttackRootConfig;
  /** Which buttons the menu window and the top-right icon row show, in what order (menuLayout.ts). */
  menuLayout: MenuLayoutConfig;
  /** Tutorial quest rewards (tutorial.ts). */
  tutorial: TutorialConfig;
  /** Skill points, ranks, unlock levels, refunds and every learnable skill's numbers (skillTuning.ts). */
  skills: SkillConfig;
}

/** What is saved: only what differs from the code. Tier arrays are saved whole when any entry differs. */
export interface BalanceTuning {
  classes?: Partial<Record<ClassId, { base?: Partial<Stats>; growth?: Partial<Stats>; mult?: Partial<Stats>; bossDmgMult?: number; mpCostPerLevel?: number }>>;
  hpRegenMult?: number;
  mpRegenMult?: number;
  tierWeight?: number[];
  tierWidth?: number[];
  rangeFloor?: number;
  bossTierBoost?: number;
  /**
   * A stat listed here has its own tier table (only the parts given; the rest follow the central table).
   * Kept even when its numbers equal the code's: listing it is the change ("ตั้งเอง").
   */
  statTiers?: Partial<Record<StatKey, StatTierTuning>>;
  /** Same for level bands (all stats on items of that level band). */
  bandTiers?: Partial<Record<TierBand, TierParts>>;
  /** Item stat multipliers that are not ×1. */
  itemStatMult?: Partial<Record<StatKey, number>>;
  /** Extra-line weights that are not 1. */
  affixWeight?: Partial<Record<StatKey, number>>;
  /** Cooldown cut cap %, when not the code's. */
  cdrCap?: number;
  /** Ordinary monsters' multipliers that are not ×1. */
  monsters?: MonsterTuning;
  /** Monsters-per-spot multipliers that are not ×1, by map id. */
  mobPack?: Record<string, number>;
  /** EXP multipliers per 10 levels that are not ×1. */
  expMult?: Partial<Record<TierBand, number>>;
  /** Potion numbers that differ from the code. */
  potions?: PotionTuning;
  /** Boss target switch seconds, when not the code's. */
  bossSwitchSec?: number;
  /** Ordinary monsters' give-up seconds, when not the code's. */
  mobGiveUpSec?: number;
  /** Walking-home monsters ignoring hits, when not the code's (on). */
  mobReturnIgnoreHits?: boolean;
  /** Blacksmith Auto enhance, when not the code's (on). */
  forgeAuto?: boolean;
  /** Walking on in a hidden tab, when not the code's (on). */
  walkHidden?: boolean;
  /** Boss keeps its HP when the group is all down, when not the code's (on). */
  bossWipeKeepHp?: boolean;
  /** Wipe revive seconds, when not the code's. */
  roomWipeSec?: number;
  /** Auto Play settings that differ from the code. */
  auto?: AutoTuning;
  /** Skill effect extra-layer numbers that differ from the code. */
  fxLayer?: FxLayerTuning;
  /** Sword rig item pictures that differ from the code. */
  rigLook?: RigLookTuning;
  /** Attack stop settings that differ from the code. */
  attackRoot?: AttackRootTuning;
  /** Menu / icon row lists that differ from the code. */
  menuLayout?: MenuLayoutTuning;
  /** Tutorial quest rewards that differ from the code. */
  tutorial?: TutorialTuning;
  /** Skill system settings that differ from the code. */
  skills?: SkillTuning;
}

/** Highest Lv1 / per-level value of each stat (owner 2026-11-11); the lowest is 0. */
export const STAT_MAX: Record<StatKey, number> = {
  maxHp: 100000, maxMp: 100000, atk: 10000, def: 10000, crit: 100, critDmg: 1000, atkSpeed: 300, moveSpeed: 300, hpRegen: 1000, mpRegen: 1000,
  cdr: 100, buffDur: 300, armorPen: 100,
};
/** Ranges of the other numbers (owner 2026-11-11), both ends allowed. */
export const BALANCE_RANGE = {
  mult: [0, 10],
  bossDmgMult: [0.1, 10],
  mpCostPerLevel: [0, 20],
  regenMult: [0, 5],
  tierWeight: [0, 1000],
  tierWidth: [1, 96],
  rangeFloor: [5, 95],
  bossTierBoost: [0, 10],
  itemStatMult: [0.1, 10],
  affixWeight: [0, 100],
  cdrCap: [0, 95],
  monsterMult: [0.1, 10],
  mobPack: [1, 5],
  expMult: [0.1, 10],
  bossSwitchSec: [0, 120],
  mobGiveUpSec: [0, 120],
  roomWipeSec: [3, 60],
} as const satisfies Record<string, readonly [number, number]>;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const full = (p: Partial<Stats> | undefined, fill: number): Stats => {
  const s = emptyStats();
  for (const k of STAT_KEYS) s[k] = p?.[k] ?? fill;
  return s;
};

/** The code's own numbers (a fresh copy). */
export function codeBalance(): Balance {
  const classes = {} as Record<ClassId, ClassBalance>;
  for (const id of CLASS_IDS) {
    const c = CLASSES[id];
    classes[id] = { base: full(c.base, 0), growth: full(c.growth, 0), mult: full(c.statMult, 1), bossDmgMult: c.bossDmgMult ?? 1, mpCostPerLevel: MP_COST_PER_LEVEL };
  }
  return {
    classes,
    hpRegenMult: CODE_HP_REGEN_MULT,
    mpRegenMult: CODE_MP_REGEN_MULT,
    tierWeight: [...CODE_TIER_WEIGHT],
    tierWidth: [...CODE_TIER_WIDTH],
    rangeFloor: CODE_RANGE_FLOOR,
    bossTierBoost: CODE_BOSS_TIER_BOOST,
    statTiers: {},
    bandTiers: {},
    itemStatMult: full(undefined, 1),
    affixWeight: full(undefined, 1),
    cdrCap: CODE_CDR_CAP,
    monsters: {},
    mobPack: {},
    expMult: {},
    potions: codePotions(),
    bossSwitchSec: CODE_BOSS_SWITCH_SEC,
    mobGiveUpSec: CODE_MOB_GIVE_UP_SEC,
    mobReturnIgnoreHits: CODE_MOB_RETURN_IGNORE_HITS,
    forgeAuto: CODE_FORGE_AUTO,
    walkHidden: CODE_WALK_HIDDEN,
    bossWipeKeepHp: CODE_BOSS_WIPE_KEEP_HP,
    roomWipeSec: CODE_ROOM_WIPE_SECONDS,
    auto: codeAuto(),
    fxLayer: codeFxLayer(),
    rigLook: codeRigLook(),
    attackRoot: codeAttackRoot(),
    menuLayout: codeMenuLayout(),
    tutorial: codeTutorial(),
    skills: codeSkills(),
  };
}

const CODE = codeBalance();

/** The numbers with this (clean) tuning on top of the code. */
export function mergeBalance(t: BalanceTuning): Balance {
  const b = codeBalance();
  for (const id of CLASS_IDS) {
    const ct = t.classes?.[id];
    if (!ct) continue;
    const c = b.classes[id];
    for (const part of STAT_PARTS) Object.assign(c[part], ct[part]);
    if (ct.bossDmgMult !== undefined) c.bossDmgMult = ct.bossDmgMult;
    if (ct.mpCostPerLevel !== undefined) c.mpCostPerLevel = ct.mpCostPerLevel;
  }
  if (t.hpRegenMult !== undefined) b.hpRegenMult = t.hpRegenMult;
  if (t.mpRegenMult !== undefined) b.mpRegenMult = t.mpRegenMult;
  if (t.tierWeight) b.tierWeight = [...t.tierWeight];
  if (t.tierWidth) b.tierWidth = [...t.tierWidth];
  if (t.rangeFloor !== undefined) b.rangeFloor = t.rangeFloor;
  if (t.bossTierBoost !== undefined) b.bossTierBoost = t.bossTierBoost;
  if (t.statTiers) b.statTiers = structuredClone(t.statTiers);
  if (t.bandTiers) b.bandTiers = structuredClone(t.bandTiers);
  Object.assign(b.itemStatMult, t.itemStatMult);
  Object.assign(b.affixWeight, t.affixWeight);
  if (t.cdrCap !== undefined) b.cdrCap = t.cdrCap;
  if (t.monsters) b.monsters = structuredClone(t.monsters);
  if (t.mobPack) b.mobPack = { ...t.mobPack };
  if (t.expMult) b.expMult = { ...t.expMult };
  if (t.potions) {
    for (const k of POTION_KINDS) for (const z of POTION_SIZE_LIST) Object.assign(b.potions[k][z], t.potions[k]?.[z]);
    if (t.potions.swordBonus !== undefined) b.potions.swordBonus = t.potions.swordBonus;
  }
  if (t.bossSwitchSec !== undefined) b.bossSwitchSec = t.bossSwitchSec;
  if (t.mobGiveUpSec !== undefined) b.mobGiveUpSec = t.mobGiveUpSec;
  if (t.bossWipeKeepHp !== undefined) b.bossWipeKeepHp = t.bossWipeKeepHp;
  if (t.roomWipeSec !== undefined) b.roomWipeSec = t.roomWipeSec;
  if (t.mobReturnIgnoreHits !== undefined) b.mobReturnIgnoreHits = t.mobReturnIgnoreHits;
  if (t.forgeAuto !== undefined) b.forgeAuto = t.forgeAuto;
  if (t.walkHidden !== undefined) b.walkHidden = t.walkHidden;
  b.auto = mergeAuto(t.auto);
  b.fxLayer = mergeFxLayer(t.fxLayer);
  b.rigLook = mergeRigLook(t.rigLook);
  b.attackRoot = mergeAttackRoot(t.attackRoot);
  b.menuLayout = mergeMenuLayout(t.menuLayout);
  b.tutorial = mergeTutorial(t.tutorial);
  b.skills = mergeSkills(t.skills);
  return b;
}

let tuning: BalanceTuning = {};
let current: Balance = mergeBalance({});

/** Uses this tuning from now on, everywhere (already checked by checkBalance). */
export function applyBalance(t: BalanceTuning): void {
  tuning = t;
  current = mergeBalance(t);
  const b = current;
  setTierTables((stat, band) => statTierTable(b, stat, band));
  setItemStatMult(b.itemStatMult);
  setAffixWeights(b.affixWeight);
  setExpTune(expTuneOf(b));
}

/** A balance's EXP multipliers as expToNext takes them (TIER_BANDS order, ×1 where not set). */
export const expTuneOf = (b: Pick<Balance, 'expMult'>): number[] => TIER_BANDS.map((id) => b.expMult[id] ?? 1);

/** The tables a stat at a band takes parts from, first first (see TierParts); null stat / band = any. */
function tierChain(b: Balance, stat: StatKey | null, band: number | null): TierParts[] {
  const id = band === null ? null : TIER_BANDS[band];
  const st = stat ? b.statTiers[stat] : undefined;
  const out: (TierParts | undefined)[] = [id ? st?.bands?.[id] : undefined, st, id ? b.bandTiers[id] : undefined];
  return out.filter((x): x is TierParts => !!x);
}

/**
 * The whole tier table a stat uses on items of a level band (index into TIER_BANDS). `stat` null = stats
 * without their own; `band` null = every level (the stat's own table for all levels, or the central one).
 */
export function statTierTable(b: Balance, stat: StatKey | null, band: number | null): TierTableDef {
  const chain = tierChain(b, stat, band);
  const pick = <P extends StatTierPart>(p: P): TierParts[P] => chain.find((c) => c[p] !== undefined)?.[p];
  return {
    width: pick('width') ?? b.tierWidth,
    floor: pick('floor') ?? b.rangeFloor,
    weight: pick('weight') ?? b.tierWeight,
    bossBoost: pick('bossBoost') ?? b.bossTierBoost,
  };
}

/** Where a stat at a band takes its table from, in Thai (for the admin page). */
export function tierSourceName(b: Balance, stat: StatKey | null, band: number | null): string {
  const id = band === null ? null : TIER_BANDS[band];
  const st = stat ? b.statTiers[stat] : undefined;
  if (stat && id && hasParts(st?.bands?.[id])) return `${STAT_LABEL[stat]} ${TIER_BAND_NAME[id]}`;
  if (stat && hasParts(st)) return `${STAT_LABEL[stat]} ทุกเลเวล`;
  if (id && hasParts(b.bandTiers[id])) return `ทุกสเตตัส ${TIER_BAND_NAME[id]}`;
  return 'ตารางกลาง';
}

/** Whether these tier parts set anything. */
export const hasParts = (t: TierParts | undefined): boolean => !!t && STAT_TIER_PARTS.some((p) => t[p] !== undefined);

/** The numbers in use. */
export const currentBalance = (): Balance => current;
/** The tuning in use (only the changes from the code). */
export const currentBalanceTuning = (): BalanceTuning => tuning;
/**
 * A monster kind's multipliers in use: its level band's times its own. ×1 for bosses.
 */
export function monsterMults(def: MonsterDef, b: Balance = current): MonsterMults {
  if (!isTunableMonster(def)) return NO_MONSTER_MULT;
  const band = b.monsters.bands?.[TIER_BANDS[monsterBandOf(def)]];
  const own = b.monsters.types?.[def.id];
  if (!band && !own) return NO_MONSTER_MULT;
  const m = { ...NO_MONSTER_MULT };
  for (const k of MONSTER_STATS) m[k] = (band?.[k] ?? 1) * (own?.[k] ?? 1);
  return m;
}

/** One class's numbers in use. */
export const classBalance = (id: ClassId): ClassBalance => current.classes[id];

/**
 * How many monsters spawn spot number `index` of map `zoneId` keeps, `count` in the code: count × the map's
 * multiplier, the fraction spread evenly over the spots by index (so ×1.5 gives every other spot one more).
 */
export function packCount(zoneId: string, count: number, index: number, b: Balance = current): number {
  const m = b.mobPack[zoneId] ?? 1;
  if (m === 1 || count <= 0) return count;
  const want = count * m;
  const whole = Math.floor(want);
  // Golden-ratio spread: over any run of spots, the share that gets one more is close to the fraction.
  return Math.max(1, whole + (((index * 0.6180339887) % 1) < want - whole ? 1 : 0));
}

/**
 * The MP a skill costs a character of this class at this level (owner 2026-11-13): the skill's `mp` in code
 * × (1 + k × (level − 1)), k = the class's % per level, rounded to the nearest whole MP. Free skills stay free.
 * Casting, the "enough MP?" checks, Auto and the HUD all use this.
 */
export function skillMpCost(baseMp: number, id: ClassId, level: number, b: Balance = current): number {
  if (baseMp <= 0) return 0;
  const k = b.classes[id].mpCostPerLevel;
  return Math.round((baseMp * (100 + k * Math.max(0, level - 1))) / 100);
}

/**
 * The last steps of a character's stats, after class, level and gear are added up: the class multipliers
 * (gear included), then the regen cuts so players lean on potions. Player.recompute and the admin preview
 * both use it.
 */
export function finishStats(s: Stats, id: ClassId, b: Balance = current): void {
  const m = b.classes[id].mult;
  for (const k of STAT_KEYS) s[k] *= m[k];
  s.hpRegen *= b.hpRegenMult;
  s.mpRegen *= b.mpRegenMult;
}

/** A class's stats at a level with nothing worn (the admin preview). */
export function classStatsAt(id: ClassId, level: number, b: Balance = current): Stats {
  const c = b.classes[id];
  const s = emptyStats();
  addInto(s, c.base);
  addInto(s, c.growth, level - 1);
  finishStats(s, id, b);
  return s;
}

type Checked = { tuning: BalanceTuning; error?: undefined } | { tuning?: undefined; error: string };

/**
 * Checks tuning sent by a browser (`strict`: anything unknown, mistyped or out of range is an error) or
 * read back from the database (not strict: such entries are dropped, the rest kept). Numbers are rounded
 * to 3 decimals, values equal to the code left out, and keys come in a fixed order (so two equal tunings
 * give the same JSON). Returns the clean tuning or a Thai error.
 */
export function checkBalance(v: unknown, strict: boolean): Checked {
  const bad = (error: string): Checked | null => (strict ? { error } : null);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'ค่าสมดุลไม่ถูกต้อง' } : { tuning: {} };
  const o = v as Record<string, unknown>;
  const TOP = ['classes', 'hpRegenMult', 'mpRegenMult', 'tierWeight', 'tierWidth', 'rangeFloor', 'bossTierBoost', 'statTiers', 'bandTiers', 'itemStatMult', 'affixWeight', 'cdrCap', 'monsters', 'mobPack', 'expMult', 'potions', 'bossSwitchSec', 'mobGiveUpSec', 'mobReturnIgnoreHits', 'forgeAuto', 'walkHidden', 'bossWipeKeepHp', 'roomWipeSec', 'auto', 'tutorial', 'skills', 'fxLayer', 'rigLook', 'attackRoot', 'menuLayout'];
  if (strict) {
    const extra = Object.keys(o).find((k) => !TOP.includes(k));
    if (extra) return { error: `ไม่รู้จักค่า "${extra.slice(0, 30)}"` };
  }
  /** A number in [lo, hi] rounded, or undefined (missing / dropped); a string is an error to return. */
  const num = (x: unknown, lo: number, hi: number, what: string): number | undefined | string => {
    if (x === undefined) return undefined;
    if (typeof x !== 'number' || !Number.isFinite(x)) return strict ? `${what} ต้องเป็นตัวเลข` : undefined;
    if (x < lo || x > hi) return strict ? `${what} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` : undefined;
    return round3(x);
  };
  const out: BalanceTuning = {};

  // Classes
  if (o.classes !== undefined) {
    if (!o.classes || typeof o.classes !== 'object' || Array.isArray(o.classes)) {
      const e = bad('ค่าอาชีพไม่ถูกต้อง');
      if (e) return e;
    } else {
      const given = o.classes as Record<string, unknown>;
      if (strict) {
        const extra = Object.keys(given).find((k) => !(CLASS_IDS as string[]).includes(k));
        if (extra) return { error: `ไม่มีอาชีพ "${extra.slice(0, 30)}"` };
      }
      const classes: NonNullable<BalanceTuning['classes']> = {};
      for (const id of CLASS_IDS) {
        const g = given[id];
        if (g === undefined) continue;
        const name = CLASSES[id].nameTh;
        if (!g || typeof g !== 'object' || Array.isArray(g)) {
          const e = bad(`ค่าของ${name}ไม่ถูกต้อง`);
          if (e) return e;
          continue;
        }
        const go = g as Record<string, unknown>;
        if (strict) {
          const extra = Object.keys(go).find((k) => !(STAT_PARTS as string[]).includes(k) && k !== 'bossDmgMult' && k !== 'mpCostPerLevel');
          if (extra) return { error: `${name}: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
        }
        const code = CODE.classes[id];
        const cls: NonNullable<BalanceTuning['classes']>[ClassId] = {};
        for (const part of STAT_PARTS) {
          const gp = go[part];
          if (gp === undefined) continue;
          if (!gp || typeof gp !== 'object' || Array.isArray(gp)) {
            const e = bad(`${name}: ค่า${STAT_PART_NAME[part]}ไม่ถูกต้อง`);
            if (e) return e;
            continue;
          }
          const gs = gp as Record<string, unknown>;
          if (strict) {
            const extra = Object.keys(gs).find((k) => !(STAT_KEYS as readonly string[]).includes(k));
            if (extra) return { error: `${name}: ไม่รู้จักสเตตัส "${extra.slice(0, 20)}"` };
          }
          const vals: Partial<Stats> = {};
          for (const k of STAT_KEYS) {
            const [lo, hi] = part === 'mult' ? BALANCE_RANGE.mult : [0, STAT_MAX[k]];
            const n = num(gs[k], lo, hi, `${name} ${STAT_PART_NAME[part]} ${STAT_LABEL[k]}`);
            if (typeof n === 'string') return { error: n };
            if (n !== undefined && n !== code[part][k]) vals[k] = n;
          }
          if (Object.keys(vals).length) cls[part] = vals;
        }
        const bm = num(go.bossDmgMult, ...BALANCE_RANGE.bossDmgMult, `${name} ดาเมจใส่บอส`);
        if (typeof bm === 'string') return { error: bm };
        if (bm !== undefined && bm !== code.bossDmgMult) cls.bossDmgMult = bm;
        const mc = num(go.mpCostPerLevel, ...BALANCE_RANGE.mpCostPerLevel, `${name} MP สกิลเพิ่ม % ต่อเลเวล`);
        if (typeof mc === 'string') return { error: mc };
        if (mc !== undefined && mc !== code.mpCostPerLevel) cls.mpCostPerLevel = mc;
        if (Object.keys(cls).length) classes[id] = cls;
      }
      if (Object.keys(classes).length) out.classes = classes;
    }
  }

  // Single numbers
  const one = (key: 'hpRegenMult' | 'mpRegenMult' | 'rangeFloor' | 'bossTierBoost' | 'bossSwitchSec' | 'mobGiveUpSec' | 'roomWipeSec' | 'cdrCap', range: readonly [number, number], what: string): string | null => {
    const n = num(o[key], range[0], range[1], what);
    if (typeof n === 'string') return n;
    if (n !== undefined && n !== CODE[key]) out[key] = n;
    return null;
  };
  const returnIgnore = (): string | null => {
    const x = o.mobReturnIgnoreHits;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์มอนเดินกลับไม่สนการโจมตีต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.mobReturnIgnoreHits) out.mobReturnIgnoreHits = x;
    return null;
  };
  const forgeAuto = (): string | null => {
    const x = o.forgeAuto;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์ตีบวก Auto ต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.forgeAuto) out.forgeAuto = x;
    return null;
  };
  const walkHidden = (): string | null => {
    const x = o.walkHidden;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์เดินต่อเมื่อสลับแท็บต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.walkHidden) out.walkHidden = x;
    return null;
  };
  const wipeKeep = (): string | null => {
    const x = o.bossWipeKeepHp;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์บอสไม่ฟื้นเลือดตอนทีมตายหมดต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.bossWipeKeepHp) out.bossWipeKeepHp = x;
    return null;
  };
  /** A tier array (5 numbers, T1 first): the array, undefined (missing / dropped), or an error to return. */
  const tierArr = (x: unknown, range: readonly [number, number], what: string, whole: (a: number[]) => string | null): number[] | undefined | string => {
    if (x === undefined) return undefined;
    if (!Array.isArray(x) || x.length !== 5) return strict ? `${what} ต้องมี 5 ค่า (T1–T5)` : undefined;
    const a: number[] = [];
    for (let i = 0; i < 5; i++) {
      const n = num(x[i], range[0], range[1], `${what} T${i + 1}`);
      if (typeof n === 'string') return n;
      if (n === undefined) return strict ? `${what} T${i + 1} ต้องเป็นตัวเลข` : undefined;
      a.push(n);
    }
    const e = whole(a);
    if (e) return strict ? e : undefined;
    return a;
  };
  const weightsOk = (what: string) => (a: number[]): string | null => (a.reduce((s, n) => s + n, 0) > 0 ? null : `${what} รวมกันต้องมากกว่า 0`);
  const widthsOk = (what: string) => (a: number[]): string | null => {
    const sum = round3(a.reduce((s, n) => s + n, 0));
    return Math.abs(sum - 100) <= 0.001 ? null : `${what} รวมกันต้องได้ 100% (ตอนนี้ ${sum}%)`;
  };
  // Central tier arrays: saved whole when any entry differs from the code.
  const arr = (key: 'tierWeight' | 'tierWidth', range: readonly [number, number], what: string, whole: (a: number[]) => string | null): string | null => {
    const a = tierArr(o[key], range, what, whole);
    if (typeof a === 'string') return a;
    if (a && a.some((n, i) => n !== CODE[key][i])) out[key] = a;
    return null;
  };
  /** Tier parts of one table (`what` names it): every part given is kept, equal to the code or not, in STAT_TIER_PARTS order. */
  const tierParts = (go: Record<string, unknown>, what: string, extraKeys: readonly string[]): TierParts | string => {
    if (strict) {
      const extra = Object.keys(go).find((p) => !(STAT_TIER_PARTS as readonly string[]).includes(p) && !extraKeys.includes(p));
      if (extra) return `ตาราง ${what}: ไม่รู้จักค่า "${extra.slice(0, 20)}"`;
    }
    const t: TierParts = {};
    const w = tierArr(go.weight, BALANCE_RANGE.tierWeight, `โอกาส ${what}`, weightsOk(`โอกาส ${what}`));
    if (typeof w === 'string') return w;
    if (w) t.weight = w;
    const wd = tierArr(go.width, BALANCE_RANGE.tierWidth, `ความกว้าง ${what}`, widthsOk(`ความกว้าง ${what}`));
    if (typeof wd === 'string') return wd;
    if (wd) t.width = wd;
    const f = num(go.floor, ...BALANCE_RANGE.rangeFloor, `ค่าต่ำสุดของช่วง ${what} %`);
    if (typeof f === 'string') return f;
    if (f !== undefined) t.floor = f;
    const bb = num(go.bossBoost, ...BALANCE_RANGE.bossTierBoost, `บอสเพิ่มโอกาส ${what} ดี`);
    if (typeof bb === 'string') return bb;
    if (bb !== undefined) t.bossBoost = bb;
    return t;
  };
  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  /** Tables per level band from `x` (in TIER_BANDS order), or an error; `what` names whose. */
  const bandTables = (x: unknown, what: string): Partial<Record<TierBand, TierParts>> | string => {
    const res: Partial<Record<TierBand, TierParts>> = {};
    if (x === undefined) return res;
    if (!isObj(x)) return strict ? `ตาราง tier ตามช่วงเลเวล${what}ไม่ถูกต้อง` : res;
    if (strict) {
      const extra = Object.keys(x).find((k) => !(TIER_BANDS as readonly string[]).includes(k));
      if (extra) return `ตาราง tier${what}: ไม่รู้จักช่วงเลเวล "${extra.slice(0, 20)}"`;
    }
    for (const id of TIER_BANDS) {
      const g = x[id];
      if (g === undefined) continue;
      const name = `tier${what} ${TIER_BAND_NAME[id]}`;
      if (!isObj(g)) {
        if (strict) return `ตาราง ${name} ไม่ถูกต้อง`;
        continue;
      }
      const t = tierParts(g, name, []);
      if (typeof t === 'string') return t;
      if (hasParts(t)) res[id] = t;
    }
    return res;
  };
  // Stats' own tier tables (every level, then per level band), in STAT_KEYS order.
  const statTiers = (): string | null => {
    const x = o.statTiers;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'ตาราง tier ต่อสเตตัสไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => !(STAT_KEYS as readonly string[]).includes(k));
      if (extra) return `ตาราง tier: ไม่รู้จักสเตตัส "${extra.slice(0, 20)}"`;
    }
    const res: Partial<Record<StatKey, StatTierTuning>> = {};
    for (const k of STAT_KEYS) {
      const g = x[k];
      if (g === undefined) continue;
      const name = `tier ${STAT_LABEL[k]}`;
      if (!isObj(g)) {
        if (strict) return `ตาราง ${name} ไม่ถูกต้อง`;
        continue;
      }
      const t: StatTierTuning | string = tierParts(g, name, ['bands']);
      if (typeof t === 'string') return t;
      const bands = bandTables(g.bands, ` ${STAT_LABEL[k]}`);
      if (typeof bands === 'string') return bands;
      if (Object.keys(bands).length) t.bands = bands;
      if (hasParts(t) || t.bands) res[k] = t;
    }
    if (Object.keys(res).length) out.statTiers = res;
    return null;
  };
  // Item stat multipliers: only those not ×1 are kept, in STAT_KEYS order.
  const itemMult = (): string | null => {
    const x = o.itemStatMult;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'ตัวคูณสเตตัสบนไอเทมไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => !(STAT_KEYS as readonly string[]).includes(k));
      if (extra) return `ตัวคูณสเตตัสบนไอเทม: ไม่รู้จักสเตตัส "${extra.slice(0, 20)}"`;
    }
    const res: Partial<Record<StatKey, number>> = {};
    for (const k of STAT_KEYS) {
      const n = num(x[k], ...BALANCE_RANGE.itemStatMult, `ตัวคูณ${STAT_LABEL[k]}บนไอเทม`);
      if (typeof n === 'string') return n;
      if (n !== undefined && n !== 1) res[k] = n;
    }
    if (Object.keys(res).length) out.itemStatMult = res;
    return null;
  };
  // Extra-line weights: only those not 1 are kept, in STAT_KEYS order.
  const affixWeight = (): string | null => {
    const x = o.affixWeight;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'น้ำหนักสุ่มสเตตัสเสริมไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => !(STAT_KEYS as readonly string[]).includes(k));
      if (extra) return `น้ำหนักสุ่มสเตตัสเสริม: ไม่รู้จักสเตตัส "${extra.slice(0, 20)}"`;
    }
    const res: Partial<Record<StatKey, number>> = {};
    for (const k of STAT_KEYS) {
      const n = num(x[k], ...BALANCE_RANGE.affixWeight, `น้ำหนักสุ่ม${STAT_LABEL[k]}`);
      if (typeof n === 'string') return n;
      if (n !== undefined && n !== 1) res[k] = n;
    }
    if (STAT_KEYS.every((k) => (res[k] ?? 1) === 0)) return strict ? 'น้ำหนักสุ่มสเตตัสเสริมต้องมีอย่างน้อย 1 ตัวที่มากกว่า 0' : null;
    if (Object.keys(res).length) out.affixWeight = res;
    return null;
  };
  /** One set of monster multipliers (only those not ×1, in MONSTER_STATS order), or an error; `what` names whose. */
  const monsterSet = (x: unknown, what: string): Partial<MonsterMults> | string => {
    const res: Partial<MonsterMults> = {};
    if (!isObj(x)) return strict ? `ตัวคูณมอน${what}ไม่ถูกต้อง` : res;
    if (strict) {
      const extra = Object.keys(x).find((k) => !(MONSTER_STATS as readonly string[]).includes(k));
      if (extra) return `ตัวคูณมอน${what}: ไม่รู้จักค่า "${extra.slice(0, 20)}"`;
    }
    for (const k of MONSTER_STATS) {
      const n = num(x[k], ...BALANCE_RANGE.monsterMult, `ตัวคูณ${MONSTER_STAT_NAME[k]}มอน${what}`);
      if (typeof n === 'string') return n;
      if (n !== undefined && n !== 1) res[k] = n;
    }
    return res;
  };
  // Ordinary monsters' multipliers: level bands in TIER_BANDS order, then kinds in TUNABLE_MONSTERS order.
  const monsters = (): string | null => {
    const x = o.monsters;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'ตัวคูณมอนไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => k !== 'bands' && k !== 'types');
      if (extra) return `ตัวคูณมอน: ไม่รู้จักค่า "${extra.slice(0, 20)}"`;
    }
    const res: MonsterTuning = {};
    if (x.bands !== undefined) {
      if (!isObj(x.bands)) {
        if (strict) return 'ตัวคูณมอนตามช่วงเลเวลไม่ถูกต้อง';
      } else {
        const given = x.bands;
        if (strict) {
          const extra = Object.keys(given).find((k) => !(TIER_BANDS as readonly string[]).includes(k));
          if (extra) return `ตัวคูณมอน: ไม่รู้จักช่วงเลเวล "${extra.slice(0, 20)}"`;
        }
        const bands: NonNullable<MonsterTuning['bands']> = {};
        for (const id of TIER_BANDS) {
          if (given[id] === undefined) continue;
          const m = monsterSet(given[id], ` ${TIER_BAND_NAME[id]}`);
          if (typeof m === 'string') return m;
          if (Object.keys(m).length) bands[id] = m;
        }
        if (Object.keys(bands).length) res.bands = bands;
      }
    }
    if (x.types !== undefined) {
      if (!isObj(x.types)) {
        if (strict) return 'ตัวคูณมอนรายตัวไม่ถูกต้อง';
      } else {
        const given = x.types;
        if (strict) {
          const extra = Object.keys(given).find((k) => !TUNABLE_MONSTERS.some((d) => d.id === k));
          if (extra) return `ตัวคูณมอน: ปรับมอน "${extra.slice(0, 30)}" ไม่ได้`;
        }
        const types: Record<string, Partial<MonsterMults>> = {};
        for (const d of TUNABLE_MONSTERS) {
          if (given[d.id] === undefined) continue;
          const m = monsterSet(given[d.id], ` ${d.nameTh}`);
          if (typeof m === 'string') return m;
          if (Object.keys(m).length) types[d.id] = m;
        }
        if (Object.keys(types).length) res.types = types;
      }
    }
    if (res.bands || res.types) out.monsters = res;
    return null;
  };
  // Monsters per spawn spot, by map, in PACK_ZONES order.
  const mobPack = (): string | null => {
    const x = o.mobPack;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'จำนวนมอนต่อจุดไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => !PACK_ZONES.some((z) => z.id === k));
      if (extra) return `จำนวนมอนต่อจุด: ไม่รู้จักแมพ "${extra.slice(0, 30)}"`;
    }
    const res: Record<string, number> = {};
    for (const z of PACK_ZONES) {
      const n = num(x[z.id], ...BALANCE_RANGE.mobPack, `จำนวนมอนต่อจุด ${z.nameTh}`);
      if (typeof n === 'string') return n;
      if (n !== undefined && n !== 1) res[z.id] = n;
    }
    if (Object.keys(res).length) out.mobPack = res;
    return null;
  };
  // EXP needed to level ×, per 10 levels, in TIER_BANDS order.
  const expMult = (): string | null => {
    const x = o.expMult;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'ตัวคูณ EXP ไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => !(TIER_BANDS as readonly string[]).includes(k));
      if (extra) return `ตัวคูณ EXP: ไม่รู้จักช่วงเลเวล "${extra.slice(0, 20)}"`;
    }
    const res: Partial<Record<TierBand, number>> = {};
    for (const id of TIER_BANDS) {
      const n = num(x[id], ...BALANCE_RANGE.expMult, `ตัวคูณ EXP ${TIER_BAND_NAME[id]}`);
      if (typeof n === 'string') return n;
      if (n !== undefined && n !== 1) res[id] = n;
    }
    if (Object.keys(res).length) out.expMult = res;
    return null;
  };
  // Potions: only numbers that differ from the code are kept.
  const potions = (): string | null => {
    const x = o.potions;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'ค่ายาไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => k !== 'hp' && k !== 'mp' && k !== 'swordBonus');
      if (extra) return `ยา: ไม่รู้จักค่า "${extra.slice(0, 30)}"`;
    }
    const res: PotionTuning = {};
    for (const k of POTION_KINDS) {
      const g = x[k];
      if (g === undefined) continue;
      if (!isObj(g)) { if (strict) return `ค่ายา ${k.toUpperCase()} ไม่ถูกต้อง`; continue; }
      if (strict) {
        const extra = Object.keys(g).find((z) => !(POTION_SIZE_LIST as readonly string[]).includes(z));
        if (extra) return `ยา ${k.toUpperCase()}: ไม่รู้จักขนาด "${extra.slice(0, 30)}"`;
      }
      const kind: NonNullable<PotionTuning['hp']> = {};
      for (const z of POTION_SIZE_LIST) {
        const e = g[z];
        if (e === undefined) continue;
        const name = `ยา ${k.toUpperCase()} ${z === 's' ? 'เล็ก' : z === 'm' ? 'กลาง' : 'ใหญ่'}`;
        if (!isObj(e)) { if (strict) return `ค่า${name}ไม่ถูกต้อง`; continue; }
        if (strict) {
          const extra = Object.keys(e).find((f) => f !== 'amount' && f !== 'price');
          if (extra) return `${name}: ไม่รู้จักค่า "${extra.slice(0, 20)}"`;
        }
        const part: Partial<PotionNums> = {};
        const am = num(e.amount, ...POTION_RANGE.amount, `ฟื้นของ${name}`);
        if (typeof am === 'string') return am;
        if (am !== undefined && Math.round(am) !== CODE_POTIONS[k][z].amount) part.amount = Math.round(am);
        const pr = num(e.price, ...POTION_RANGE.price, `ราคา${name}`);
        if (typeof pr === 'string') return pr;
        if (pr !== undefined && Math.round(pr) !== CODE_POTIONS[k][z].price) part.price = Math.round(pr);
        if (Object.keys(part).length) kind[z] = part;
      }
      if (Object.keys(kind).length) res[k] = kind;
    }
    const sb = num(x.swordBonus, ...POTION_RANGE.swordBonus, 'โบนัสยา HP นักดาบ (%)');
    if (typeof sb === 'string') return sb;
    if (sb !== undefined && sb !== CODE_SWORD_POTION_BONUS) res.swordBonus = sb;
    if (Object.keys(res).length) out.potions = res;
    return null;
  };
  // Level bands' own tier tables (all stats).
  const bandTiers = (): string | null => {
    const bands = bandTables(o.bandTiers, '');
    if (typeof bands === 'string') return bands;
    if (Object.keys(bands).length) out.bandTiers = bands;
    return null;
  };
  const auto = (): string | null => {
    const c = checkAutoTuning(o.auto, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.auto = c.tuning;
    return null;
  };
  const tutorial = (): string | null => {
    const c = checkTutorialTuning(o.tutorial, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.tutorial = c.tuning;
    return null;
  };
  const fxLayer = (): string | null => {
    const c = checkFxLayerTuning(o.fxLayer, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.fxLayer = c.tuning;
    return null;
  };
  const rigLook = (): string | null => {
    const c = checkRigLookTuning(o.rigLook, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.rigLook = c.tuning;
    return null;
  };
  const attackRoot = (): string | null => {
    const c = checkAttackRootTuning(o.attackRoot, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.attackRoot = c.tuning;
    return null;
  };
  const menuLayout = (): string | null => {
    const c = checkMenuLayoutTuning(o.menuLayout, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.menuLayout = c.tuning;
    return null;
  };
  const skills = (): string | null => {
    const c = checkSkillTuning(o.skills, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.skills = c.tuning;
    return null;
  };
  const err =
    one('hpRegenMult', BALANCE_RANGE.regenMult, 'ตัวคูณฟื้น HP') ??
    one('mpRegenMult', BALANCE_RANGE.regenMult, 'ตัวคูณฟื้น MP') ??
    arr('tierWeight', BALANCE_RANGE.tierWeight, 'โอกาส tier', weightsOk('โอกาส tier')) ??
    arr('tierWidth', BALANCE_RANGE.tierWidth, 'ความกว้าง tier', widthsOk('ความกว้าง tier')) ??
    one('rangeFloor', BALANCE_RANGE.rangeFloor, 'ค่าต่ำสุดของช่วง %') ??
    one('bossTierBoost', BALANCE_RANGE.bossTierBoost, 'บอสเพิ่มโอกาส tier ดี') ??
    statTiers() ??
    bandTiers() ??
    itemMult() ??
    affixWeight() ??
    one('cdrCap', BALANCE_RANGE.cdrCap, 'ลดคูลดาวน์ได้สูงสุด %') ??
    monsters() ??
    mobPack() ??
    expMult() ??
    potions() ??
    one('bossSwitchSec', BALANCE_RANGE.bossSwitchSec, 'บอสเปลี่ยนเป้าหมายทุก (วินาที)') ??
    one('mobGiveUpSec', BALANCE_RANGE.mobGiveUpSec, 'มอนธรรมดาเลิกไล่เมื่อไม่โดนตี (วินาที)') ??
    returnIgnore() ??
    forgeAuto() ??
    walkHidden() ??
    wipeKeep() ??
    one('roomWipeSec', BALANCE_RANGE.roomWipeSec, 'เวลาชุบตอนตายหมดทีม (วินาที)') ??
    auto() ??
    tutorial() ??
    skills() ??
    fxLayer() ??
    rigLook() ??
    attackRoot() ??
    menuLayout();
  if (err) return { error: err };
  // Fixed key order.
  const ordered: BalanceTuning = {};
  for (const k of TOP) if ((out as Record<string, unknown>)[k] !== undefined) (ordered as Record<string, unknown>)[k] = (out as Record<string, unknown>)[k];
  return { tuning: ordered };
}

/** Same tuning? (both already clean, as checkBalance returns them) */
export function sameBalance(a: BalanceTuning, b: BalanceTuning): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether any stat's tier widths or floor differ, central or its own (so item tier labels are redone). */
export function tierLabelsChange(a: BalanceTuning, b: BalanceTuning): boolean {
  const labels = (t: BalanceTuning): string => {
    const m = mergeBalance(t);
    return JSON.stringify([null, ...STAT_KEYS].map((k) => TIER_BANDS.map((_, band) => {
      const d = statTierTable(m, k, band);
      return [d.width, d.floor];
    })));
  };
  return labels(a) !== labels(b);
}

/** Short Thai text of what differs, for the audit log (e.g. "นักดาบ Lv1 พลังโจมตี 12 → 15"). */
export function balanceChanges(before: BalanceTuning, after: BalanceTuning): string {
  const a = mergeBalance(before);
  const b = mergeBalance(after);
  const out: string[] = [];
  for (const id of CLASS_IDS) {
    const name = CLASSES[id].nameTh;
    for (const part of STAT_PARTS) {
      for (const k of STAT_KEYS) {
        const x = a.classes[id][part][k];
        const y = b.classes[id][part][k];
        if (x !== y) out.push(`${name} ${STAT_PART_NAME[part]} ${STAT_LABEL[k]} ${x} → ${y}`);
      }
    }
    if (a.classes[id].bossDmgMult !== b.classes[id].bossDmgMult) out.push(`${name} ดาเมจใส่บอส ×${a.classes[id].bossDmgMult} → ×${b.classes[id].bossDmgMult}`);
    if (a.classes[id].mpCostPerLevel !== b.classes[id].mpCostPerLevel) out.push(`MP สกิล/เลเวล ${name} ${a.classes[id].mpCostPerLevel}% → ${b.classes[id].mpCostPerLevel}%`);
  }
  if (a.hpRegenMult !== b.hpRegenMult) out.push(`ตัวคูณฟื้น HP ${a.hpRegenMult} → ${b.hpRegenMult}`);
  if (a.mpRegenMult !== b.mpRegenMult) out.push(`ตัวคูณฟื้น MP ${a.mpRegenMult} → ${b.mpRegenMult}`);
  if (a.tierWeight.join() !== b.tierWeight.join()) out.push(`โอกาส tier ${a.tierWeight.join('/')} → ${b.tierWeight.join('/')}`);
  if (a.tierWidth.join() !== b.tierWidth.join()) out.push(`ความกว้าง tier ${a.tierWidth.join('/')} → ${b.tierWidth.join('/')}`);
  if (a.rangeFloor !== b.rangeFloor) out.push(`ค่าต่ำสุดของช่วง ${a.rangeFloor}% → ${b.rangeFloor}%`);
  if (a.bossTierBoost !== b.bossTierBoost) out.push(`บอสเพิ่มโอกาส tier ดี ${a.bossTierBoost} → ${b.bossTierBoost}`);
  const part = (p: StatTierPart, v: TierParts[StatTierPart]): string =>
    v === undefined ? 'ไม่ได้ตั้ง' : Array.isArray(v) ? v.join('/') : p === 'floor' ? `${v}%` : String(v);
  const parts = (what: string, x: TierParts | undefined, y: TierParts | undefined): void => {
    for (const p of STAT_TIER_PARTS) {
      if (JSON.stringify(x?.[p]) !== JSON.stringify(y?.[p])) out.push(`tier ${what} ${STAT_TIER_PART_NAME[p]} ${part(p, x?.[p])} → ${part(p, y?.[p])}`);
    }
  };
  for (const id of TIER_BANDS) parts(`ทุกสเตตัส ${TIER_BAND_NAME[id]}`, a.bandTiers[id], b.bandTiers[id]);
  for (const k of STAT_KEYS) {
    parts(STAT_LABEL[k], a.statTiers[k], b.statTiers[k]);
    for (const id of TIER_BANDS) parts(`${STAT_LABEL[k]} ${TIER_BAND_NAME[id]}`, a.statTiers[k]?.bands?.[id], b.statTiers[k]?.bands?.[id]);
  }
  for (const k of STAT_KEYS) {
    if (a.itemStatMult[k] !== b.itemStatMult[k]) out.push(`ตัวคูณ${STAT_LABEL[k]}บนไอเทม ×${a.itemStatMult[k]} → ×${b.itemStatMult[k]}`);
  }
  for (const k of STAT_KEYS) {
    if (a.affixWeight[k] !== b.affixWeight[k]) out.push(`น้ำหนักสุ่ม${STAT_LABEL[k]} ${a.affixWeight[k]} → ${b.affixWeight[k]}`);
  }
  if (a.cdrCap !== b.cdrCap) out.push(`ลดคูลดาวน์ได้สูงสุด ${a.cdrCap}% → ${b.cdrCap}%`);
  const mons = (what: string, x: Partial<MonsterMults> | undefined, y: Partial<MonsterMults> | undefined): void => {
    for (const k of MONSTER_STATS) {
      const p = x?.[k] ?? 1;
      const q = y?.[k] ?? 1;
      if (p !== q) out.push(`มอน ${what} ${MONSTER_STAT_NAME[k]} ×${p} → ×${q}`);
    }
  };
  for (const id of TIER_BANDS) mons(TIER_BAND_NAME[id], a.monsters.bands?.[id], b.monsters.bands?.[id]);
  for (const d of TUNABLE_MONSTERS) mons(d.nameTh, a.monsters.types?.[d.id], b.monsters.types?.[d.id]);
  for (const z of PACK_ZONES) {
    const p = a.mobPack[z.id] ?? 1;
    const q = b.mobPack[z.id] ?? 1;
    if (p !== q) out.push(`มอนต่อจุด ${z.nameTh} ×${p} → ×${q}`);
  }
  for (const id of TIER_BANDS) {
    const p = a.expMult[id] ?? 1;
    const q = b.expMult[id] ?? 1;
    if (p !== q) out.push(`EXP ที่ต้องใช้ ${TIER_BAND_NAME[id]} ×${p} → ×${q}`);
  }
  for (const k of POTION_KINDS) {
    for (const z of POTION_SIZE_LIST) {
      const p = a.potions[k][z];
      const q = b.potions[k][z];
      const name = `ยา ${k.toUpperCase()} ${z === 's' ? 'เล็ก' : z === 'm' ? 'กลาง' : 'ใหญ่'}`;
      if (p.amount !== q.amount) out.push(`${name} ฟื้น ${p.amount} → ${q.amount}`);
      if (p.price !== q.price) out.push(`${name} ราคา ${p.price} → ${q.price} G`);
    }
  }
  if (a.potions.swordBonus !== b.potions.swordBonus) out.push(`โบนัสยา HP นักดาบ +${a.potions.swordBonus}% → +${b.potions.swordBonus}%`);
  if (a.bossSwitchSec !== b.bossSwitchSec) out.push(`บอสเปลี่ยนเป้าหมายทุก ${a.bossSwitchSec || 'ปิด'} → ${b.bossSwitchSec || 'ปิด'} วิ`);
  if (a.mobGiveUpSec !== b.mobGiveUpSec) out.push(`มอนธรรมดาเลิกไล่เมื่อไม่โดนตี ${a.mobGiveUpSec || 'ไม่เลิก'} → ${b.mobGiveUpSec || 'ไม่เลิก'} วิ`);
  if (a.bossWipeKeepHp !== b.bossWipeKeepHp) out.push(`บอสไม่ฟื้นเลือดตอนทีมตายหมด ${a.bossWipeKeepHp ? 'เปิด' : 'ปิด'} → ${b.bossWipeKeepHp ? 'เปิด' : 'ปิด'}`);
  if (a.roomWipeSec !== b.roomWipeSec) out.push(`เวลาชุบตอนตายหมดทีม ${a.roomWipeSec} → ${b.roomWipeSec} วิ`);
  if (a.forgeAuto !== b.forgeAuto) out.push(`ตีบวก Auto ${a.forgeAuto ? 'เปิด' : 'ปิด'} → ${b.forgeAuto ? 'เปิด' : 'ปิด'}`);
  if (a.walkHidden !== b.walkHidden) out.push(`เดินต่อเมื่อสลับแท็บ ${a.walkHidden ? 'เปิด' : 'ปิด'} → ${b.walkHidden ? 'เปิด' : 'ปิด'}`);
  if (a.mobReturnIgnoreHits !== b.mobReturnIgnoreHits) out.push(`มอนเดินกลับบ้านไม่สนการโจมตี ${a.mobReturnIgnoreHits ? 'เปิด' : 'ปิด'} → ${b.mobReturnIgnoreHits ? 'เปิด' : 'ปิด'}`);
  out.push(...autoChanges(a.auto, b.auto));
  out.push(...tutorialChanges(a.tutorial, b.tutorial));
  out.push(...skillChanges(a.skills, b.skills));
  out.push(...fxLayerChanges(a.fxLayer, b.fxLayer));
  out.push(...rigLookChanges(a.rigLook, b.rigLook));
  out.push(...attackRootChanges(a.attackRoot, b.attackRoot));
  out.push(...menuLayoutChanges(a.menuLayout, b.menuLayout));
  return out.join(', ');
}

/**
 * The same tuning with other item stat multipliers (`mult`, already clean), in the fixed key order. The normal
 * save keeps the multipliers in use with this, and the owner's confirm changes only them.
 */
export function withItemStatMult(t: BalanceTuning, mult: BalanceTuning['itemStatMult']): BalanceTuning {
  const { itemStatMult: _, ...rest } = t;
  return checkBalance(mult ? { ...rest, itemStatMult: mult } : rest, false).tuning ?? {};
}

/** The same tuning with another menu layout (`layout`, already clean): the balance tab's save keeps the layout in use with this. */
export function withMenuLayout(t: BalanceTuning, layout: BalanceTuning['menuLayout']): BalanceTuning {
  const { menuLayout: _, ...rest } = t;
  return checkBalance(layout ? { ...rest, menuLayout: layout } : rest, false).tuning ?? {};
}
