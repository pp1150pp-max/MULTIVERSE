// Game balance the owner (and GMs, if allowed) tune from the /admin "ปรับสมดุล" tab: every class's stats
// (Lv1, per level, multipliers, boss damage), the game-wide regen cuts, and the item tier tables
// (chances, widths, floor, bosses' tier boost). Pure data and checks: the code defaults are in
// data/classes.ts and data/items.ts, and changes are saved in the server's settings table as overrides
// only (like cos_tuning), so an untouched server runs exactly the code. The server applies them at start
// and on every save, and sends them to every browser so tooltips and the blacksmith's odds match.
import { CLASSES, CLASS_IDS, MP_COST_PER_LEVEL } from './data/classes';
import {
  CODE_BOSS_TIER_BOOST, CODE_RANGE_FLOOR, setAffixWeights, CODE_TIER_WEIGHT, CODE_TIER_WIDTH, setItemStatMult, setMoveGrowth, CODE_MOVE_GROWTH, setTierTables, TIER_BAND_NAME, TIER_BANDS, tierBandOf, type TierBand, type TierTableDef,
} from './data/items';
import { CODE_POTIONS, CODE_POTION_DROP, CODE_SWORD_POTION_BONUS, POTION_RANGE, type PotionNums } from './data/potionTable';
import { MONSTERS, type MonsterDef } from './data/monsters';
import { FARM_IDS, ZONES } from './data/zones';
import { customDef } from './customZones';
import { checkFxLayerTuning, codeFxLayer, fxLayerChanges, mergeFxLayer, type FxLayerConfig, type FxLayerTuning } from './fxLayerTuning';
import { checkMenuLayoutTuning, codeMenuLayout, mergeMenuLayout, menuLayoutChanges, type MenuLayoutConfig, type MenuLayoutTuning } from './menuLayout';
import { checkHudLayoutTuning, codeHudLayout, hudLayoutChanges, mergeHudLayout, type HudLayoutConfig, type HudLayoutTuning } from './hudLayout';
import { audioChanges, checkAudioTuning, codeAudio, mergeAudio, type AudioConfig, type AudioTuning } from './audioTuning';
import { attackRootChanges, checkAttackRootTuning, codeAttackRoot, mergeAttackRoot, type AttackRootConfig, type AttackRootTuning } from './attackRootTuning';
import { checkSetTuning, codeSets, mergeSets, setChanges, type SetConfig, type SetTuning } from './data/sets';
import { checkRigLookTuning, codeRigLook, mergeRigLook, rigLookChanges, type RigLookConfig, type RigLookTuning } from './rigLookTuning';
import { autoChanges, checkAutoTuning, codeAuto, mergeAuto, type AutoConfig, type AutoTuning } from './autoTuning';
import { checkFloorGateTuning, codeFloorGate, floorGateChanges, mergeFloorGate, type FloorGateConfig, type FloorGateTuning } from './floorGate';
import { bagExpandChanges, checkBagExpand, codeBagExpand, mergeBagExpand, type BagExpandCfg, type BagExpandTuning } from './bagTabs';
import { checkNpcTalkTuning, codeNpcTalk, mergeNpcTalk, npcTalkChanges, type NpcTalkConfig, type NpcTalkTuning } from './npcTalk';
import { checkTutorialTuning, codeTutorial, mergeTutorial, tutorialChanges, type TutorialConfig, type TutorialTuning } from './tutorial';
import { checkMoveTuning, codeMoves, mergeMoves, moveChanges, type MoveConfig, type MoveTuning } from './moveTuning';
import { checkWaveTuning, codeWaves, mergeWaves, waveChanges, type WaveConfig, type WaveTuning } from './waveGame';
import { checkForgeTuning, codeForge, forgeChanges, mergeForge, type ForgeConfig, type ForgeTuning } from './forgeTuning';
import { checkSkillTuning, codeSkills, mergeSkills, skillChanges, type SkillConfig, type SkillTuning } from './skillTuning';
import { addInto, emptyStats, setExpTune } from './formulas';
import { STAT_KEYS, STAT_LABEL, type ClassId, type PotionKind, type PotionSize, type StatKey, type Stats } from './types';

/** Key in the server's settings table. */
export const BALANCE_SETTING = 'balance';

export const POTION_KINDS: readonly PotionKind[] = ['hp', 'mp'];
export const POTION_SIZE_LIST: readonly PotionSize[] = ['s', 'm', 'l'];
/** Potions in use: heal amount and price of each bottle, the swordsman's HP-potion bonus in %, and the monster levels from which drops are medium / large. */
export interface PotionBalance { hp: Record<PotionSize, PotionNums>; mp: Record<PotionSize, PotionNums>; swordBonus: number; dropM: number; dropL: number }
/** Potion changes saved: only the numbers that differ from the code. */
export interface PotionTuning { hp?: Partial<Record<PotionSize, Partial<PotionNums>>>; mp?: Partial<Record<PotionSize, Partial<PotionNums>>>; swordBonus?: number; dropM?: number; dropL?: number }
const codePotions = (): PotionBalance => ({ hp: structuredClone(CODE_POTIONS.hp), mp: structuredClone(CODE_POTIONS.mp), swordBonus: CODE_SWORD_POTION_BONUS, ...CODE_POTION_DROP });
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
/** The HUD's buff chips show the total EXP / drop bonus (scrolls × VIP), sources and times on hover (owner 2026-11-25); off = the old scroll chips. */
export const CODE_BUFF_TOTAL = true;
/** Ordinary monsters drop a target that is in a safe area / left / died at once and walk home (owner 2026-11-20). */
export const CODE_MOB_DROP_ON_SAFE = true;
/** Floor-1 farm maps: a spot whose monsters are all dead comes back somewhere else in its kind's band (owner 2026-11-25). */
export const CODE_MOB_ROAM = true;
/** …and lands this far at most from its own spot in the map (owner 2026-11-25: "near its own spot", not across the map). */
export const CODE_MOB_ROAM_REACH = 8;
/** Maps come from the DB's published layouts when there are any (docs/plans/map-editor.md 3.1); off = always the JSON in the bundle. Nothing publishes to the DB before PR 5. */
export const CODE_MAP_FROM_DB = true;
/** The "เพิ่มเวลาบัฟ %" item stat also lengthens summons: turret, drone, land mine (owner 2026-11-19). */
export const CODE_BUFF_DUR_SUMMONS = true;
/** Blacksmith: the Auto button that enhances again and again up to a chosen level (owner 2026-11-18: on). */
export const CODE_FORGE_AUTO = true;
/** Players may pick English (owner 2026-11-22, docs/systems/i18n.md); off = everyone sees Thai and the language button is hidden. */
export const CODE_ENGLISH = true;
/** Click-to-walk carries on when the browser tab is hidden: the server walks the rest of the way (owner 2026-11-18: on). */
export const CODE_WALK_HIDDEN = true;
/** Portals that need an unlock (PortalDef.requires, e.g. the way up to floor 2) let anyone through who has it; off = closed to everyone. Off in the code (owner 2026-11-24: floor 2 shut to players on main, admins go in with the /admin teleport) until the owner opens it in /admin. */
export const CODE_FLOOR_GATE_OPEN = false;
/** Those portals check the unlock (The Seeker's quest) (owner 2026-11-19: on); off = anyone at minLevel walks through. */
export const CODE_FLOOR_GATE_QUEST = true;
/** Wearing/taking off gear is refused (browser side) while the merchant's window is open, so a click meant to wear cannot sell (owner 2026-11-22). */
export const CODE_SHOP_NO_EQUIP = true;
/** Trying cosmetics on (cash shop, dress window) only in a town / safe area (owner 2026-11-25). Browser side only. */
export const CODE_TRY_ON_TOWN_ONLY = true;
/** Item links in chat: Ctrl+click an item to put a clickable [name] into a message (owner 2026-11-23: on). */
export const CODE_CHAT_LINKS = true;
/** The hub town split into channels like the farm maps (owner 2026-11-22); off = one room as before. */
export const CODE_HUB_CHANNELS = true;
/** Boss room: the boss keeps its HP and waits when the whole group is down (owner 2026-11-17); off = it walks home and heals. */
export const CODE_BOSS_WIPE_KEEP_HP = true;
/** Seconds a boss-room group that is all down has to get someone up with a feather (owner: 5). */
export const CODE_ROOM_WIPE_SECONDS = 5;
/** Volcano Heart big blast (owner 2026-11-22): safe spots scattered over the arena, away from players but reachable; off = the old ring around the boss. */
export const CODE_HEART_BLAST_RANDOM = true;
export const CODE_HEART_BLAST_SPOTS = 6;
/** Every safe spot is at least this far from every living player (relaxed only when nobody could reach a spot otherwise). */
export const CODE_HEART_BLAST_MIN_DIST = 6;
/** Share of (walk speed × warning time) a player is assumed to cover; every living player must have a spot within it. */
export const CODE_HEART_BLAST_REACH = 0.7;
/** Seconds between entering a boss room and its boss appearing (owner 2026-11-20: 13, was 5). */
export const CODE_ROOM_BOSS_DELAY = 13;
/** Longest wait (s) for everyone sent into a boss room / wave run to load the map before its countdown starts (owner 2026-11-24: 10). */
export const CODE_ROOM_LOAD_WAIT = 10;
/** Boss-room boss drops spread over the arena, wider the more pieces drop (owner 2026-11-22: on). Radius = base + k x sqrt(pieces), capped. */
export const CODE_BOSS_LOOT_SPREAD = true;
export const CODE_BOSS_LOOT_BASE = 2.5;
export const CODE_BOSS_LOOT_K = 0.8;
export const CODE_BOSS_LOOT_MAX = 12;
/** VIP bonus in percent (owner 2026-11-23: EXP +10%, drop chances +10%, stacks with the ×2 scrolls). */
export const CODE_VIP_EXP_PCT = 10;
export const CODE_VIP_DROP_PCT = 10;
/** No damage for a moment after getting up with a phoenix feather in a boss room (owner 2026-11-20: on). */
export const CODE_REVIVE_GUARD = true;
/** How long that lasts, in seconds (owner: 5); attacking, a skill, a buff or a dash ends it at once. */
export const CODE_REVIVE_GUARD_SEC = 5;
/**
 * Most a character's skill cooldowns can be cut by the "ลดคูลดาวน์สกิล %" item stat, in % (owner 2026-11-19:
 * no cap on the total from items, but a safety stop at 75% in case the multipliers are set high).
 */
export const CODE_CDR_CAP = 75;

/** Most a character's crit rate can be, in % (owner 2026-11-25: tops out at 100, gear and buffs past it do nothing). */
export const CODE_CRIT_CAP = 100;

/**
 * Most move speed % a character gets from items, in % (owner 2026-11-26): worn gear (enhance and rerolled lines
 * included) plus item-set bonuses together. Class numbers, passives, skill buffs and the mount stay outside it.
 */
export const CODE_MOVE_CAP = 50;

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
  /** Most a character's crit rate can be, in % (stats shown and every crit roll). */
  critCap: number;
  /** Most move speed % from items (gear + set bonuses); class, passives, buffs and the mount come on top. */
  moveCap: number;
  /** Per-level growth of the boots' move speed main line (data/items.ts CODE_MOVE_GROWTH). */
  moveGrowth: number;
  /** Ordinary monsters' multipliers that are not ×1 (none in code). */
  monsters: MonsterTuning;
  /** Monsters per spawn spot ×, by map id (PACK_ZONES); a map left out is ×1. */
  mobPack: Record<string, number>;
  /** Spawn-spot radius × (the circle monsters appear and wander in), by map id (a built-in map or an editor-made one); a map left out is ×1. */
  spawnRadius: Record<string, number>;
  /**
   * Floor-1 farm maps (FARM_IDS): % of the map's spawn spots in use, by map id; a map left out is 100 (owner 2026-11-25). The spots
   * switched off are spread evenly over the map and over each kind (packCount).
   */
  farmSpots: Record<string, number>;
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
  /** A monster chasing a player who steps into the town / safe area (or leaves, or dies) drops it at once and walks home (owner 2026-11-20); off = the old behaviour. */
  mobDropOnSafe: boolean;
  /** Floor-1 farm maps: once every monster of a spot is dead, the spot moves to a random place among its kind's spots before they come back (owner 2026-11-25); off = always the same spot. */
  mobRoam: boolean;
  /** How far (units) a roaming spot may land from its own spot in the map. */
  mobRoamReach: number;
  /** "ใช้แมพจาก DB": on = published map layouts in the DB replace the bundled JSON (PR 5); off = always the bundled JSON, the emergency way out. Rooms made after the change follow it (server/maps-live.ts). */
  mapFromDb: boolean;
  /** "เพิ่มเวลาบัฟ %" counts for summons too (turret, drone, land mine lifetime); off = only buffs. */
  buffDurSummons: boolean;
  /** Blacksmith Auto enhance button shown (owner 2026-11-18); off = hidden and a running Auto stops. Browser side only. */
  forgeAuto: boolean;
  /** "ภาษาอังกฤษ": players may switch the game to English (docs/systems/i18n.md); off = Thai for everyone, no language button. */
  english: boolean;
  /** Blacksmith enhancement numbers: rates, costs, pity, drop/stone/announce levels, max, cooldown, orbs, aura (forgeTuning.ts). */
  forge: ForgeConfig;
  /** A clicked walk goes on while the tab is hidden (server walks to the spot); off = the character stops as before. */
  walkHidden: boolean;
  /** Portals with an unlock (PortalDef.requires) open at all; off = closed to everyone (src/shared/floors.ts). */
  floorGateOpen: boolean;
  /** Those portals need the unlock (quest done); off = level only. */
  floorGateQuest: boolean;
  /** The navigator's quest that opens floor 2: level, boss, reward (src/shared/floorGate.ts). */
  floorGate: FloorGateConfig;
  /** No wearing/taking off gear (or fashion items) while the merchant window is open. Browser side only. */
  shopNoEquip: boolean;
  /** Trying cosmetics on only in a town / safe area; stepping out takes the try-on off (src/client/cosLook.ts). Browser side only. */
  tryOnTownOnly: boolean;
  /** Item links in chat and the megaphone (src/shared/chatLinks.ts); off = the server sends no links, Ctrl+click does nothing. */
  chatLinks: boolean;
  /** The hub town (nexus_city) split into channels CH 1–10 like the farm maps; off = one room (CH 1). Used on the next entry into town. */
  hubChannels: boolean;
  /** Boss room: when every player is down the boss keeps its HP and waits (no walking home, healing or reset); off = the old behaviour. */
  bossWipeKeepHp: boolean;
  /** Seconds a boss-room group that is all down has to revive someone before it has lost. */
  roomWipeSec: number;
  /** Seconds a boss room counts down before its boss appears. */
  roomBossDelay: number;
  /** Longest wait (s) for players to load a boss room / wave run before its countdown starts (0 = start at once). */
  roomLoadWait: number;
  /** Volcano Heart blast: safe spots scattered over the arena (off = ring round the boss), how many, minimum distance from players, reach share. */
  heartBlastRandom: boolean;
  heartBlastSpots: number;
  heartBlastMinDist: number;
  heartBlastReach: number;
  /** A boss-room boss spreads its drops over the arena (off = the old 0.5-2.5 scatter). */
  bossLootSpread: boolean;
  /** Spread radius for one piece, the extra per square root of the piece count, and the cap (world units). */
  bossLootBase: number;
  bossLootK: number;
  bossLootMax: number;
  /** VIP bonus (src/shared/vip.ts): EXP % (rounded down) and drop-chance %. */
  vipExpPct: number;
  vipDropPct: number;
  /** HUD buff chips: total EXP / drop bonus with a per-source hover (CODE_BUFF_TOTAL); off = one chip per running scroll. */
  buffTotal: boolean;
  /** Untouchable (no damage or boss effects, blinking) for a moment after a phoenix-feather revive in a boss room. */
  reviveGuard: boolean;
  /** How long that lasts; any attack, skill, buff or dash ends it early. */
  reviveGuardSec: number;
  /** Auto Play defaults, distances and switches (autoTuning.ts). */
  auto: AutoConfig;
  /** Minigame "รอดมอนเป็นระลอก" (waveGame.ts). */
  waves: WaveConfig;
  /** Buying more bag slots (bagTabs.ts), off in the code. */
  bagExpand: BagExpandCfg;
  /** The skill effects' extra layer: glow, ground light, particles, hit feel (fxLayerTuning.ts). */
  fxLayer: FxLayerConfig;
  /** Which papercraft sword / armour each item shows on the sword rig (rigLookTuning.ts). */
  rigLook: RigLookConfig;
  /** Stopping for a moment on each attack, per class (attackRootTuning.ts). */
  attackRoot: AttackRootConfig;
  /** Sound effect groups: server-wide switch and loudness (audioTuning.ts). */
  audio: AudioConfig;
  /** Which buttons the menu window and the top-right icon row show, in what order (menuLayout.ts). */
  menuLayout: MenuLayoutConfig;
  /** Where the HUD parts and windows sit, their size and which are hidden, per device (hudLayout.ts). Only the changed parts. */
  hudLayout: HudLayoutConfig;
  /** Tutorial quest rewards (tutorial.ts). */
  tutorial: TutorialConfig;
  /** NPC talk window and lines over NPC heads (npcTalk.ts). */
  npcTalk: NpcTalkConfig;
  /** Item sets: server-wide switch and each set's bonus steps (data/sets.ts). */
  sets: SetConfig;
  /** Skill points, ranks, unlock levels, refunds and every learnable skill's numbers (skillTuning.ts). */
  skills: SkillConfig;
  /** Floor 2's new monster and boss moves (moveTuning.ts). */
  moves: MoveConfig;
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
  /** Crit rate cap %, when not the code's. */
  critCap?: number;
  /** Item move speed cap %, when not the code's. */
  moveCap?: number;
  /** Boots move speed main-line growth per level, when not the code's. */
  moveGrowth?: number;
  /** Ordinary monsters' multipliers that are not ×1. */
  monsters?: MonsterTuning;
  /** Monsters-per-spot multipliers that are not ×1, by map id. */
  mobPack?: Record<string, number>;
  /** Spawn-spot radius multipliers that are not ×1, by map id. */
  spawnRadius?: Record<string, number>;
  /** Farm maps' % of spawn spots in use that are not 100, by map id. */
  farmSpots?: Record<string, number>;
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
  mobDropOnSafe?: boolean;
  /** Monster spots moving on respawn, when not the code's (on). */
  mobRoam?: boolean;
  /** Roaming reach, when not the code's (8). */
  mobRoamReach?: number;
  /** Maps from the DB, when not the code's (on). */
  mapFromDb?: boolean;
  /** Buff-time stat on summons, when not the code's (on). */
  buffDurSummons?: boolean;
  /** Blacksmith Auto enhance, when not the code's (on). */
  forgeAuto?: boolean;
  /** English allowed, when not the code's (on). */
  english?: boolean;
  /** Blacksmith enhancement numbers that differ from the code. */
  forge?: ForgeTuning;
  /** Walking on in a hidden tab, when not the code's (on). */
  walkHidden?: boolean;
  /** Unlock portals open, when not the code's (on). */
  floorGateOpen?: boolean;
  /** Unlock portals check the quest, when not the code's (on). */
  floorGateQuest?: boolean;
  /** The floor-2 quest's level, boss and reward, where they differ from the code. */
  floorGate?: FloorGateTuning;
  /** No wear/take off while the merchant window is open, when not the code's (on). */
  shopNoEquip?: boolean;
  /** Try-on in town only, when not the code's (on). */
  tryOnTownOnly?: boolean;
  /** Item links in chat, when not the code's (on). */
  chatLinks?: boolean;
  /** Hub split into channels, when not the code's (on). */
  hubChannels?: boolean;
  /** Boss keeps its HP when the group is all down, when not the code's (on). */
  bossWipeKeepHp?: boolean;
  /** Wipe revive seconds, when not the code's. */
  roomWipeSec?: number;
  /** Boss countdown seconds, when not the code's. */
  roomBossDelay?: number;
  /** Longest load wait before the countdown, when not the code's. */
  roomLoadWait?: number;
  heartBlastRandom?: boolean;
  heartBlastSpots?: number;
  heartBlastMinDist?: number;
  heartBlastReach?: number;
  bossLootSpread?: boolean;
  bossLootBase?: number;
  bossLootK?: number;
  bossLootMax?: number;
  vipExpPct?: number;
  vipDropPct?: number;
  buffTotal?: boolean;
  /** Phoenix-feather revive guard, when not the code's (on). */
  reviveGuard?: boolean;
  /** Its seconds, when not the code's. */
  reviveGuardSec?: number;
  /** Auto Play settings that differ from the code. */
  auto?: AutoTuning;
  /** Wave minigame numbers that differ from the code. */
  waves?: WaveTuning;
  /** Bag slot buying settings that differ from the code. */
  bagExpand?: BagExpandTuning;
  /** Skill effect extra-layer numbers that differ from the code. */
  fxLayer?: FxLayerTuning;
  /** Sword rig item pictures that differ from the code. */
  rigLook?: RigLookTuning;
  /** Attack stop settings that differ from the code. */
  attackRoot?: AttackRootTuning;
  audio?: AudioTuning;
  /** Menu / icon row lists that differ from the code. */
  menuLayout?: MenuLayoutTuning;
  /** HUD parts / windows moved, resized or hidden (the published "จัดหน้าจอเกม"). */
  hudLayout?: HudLayoutTuning;
  /** Tutorial quest rewards that differ from the code. */
  tutorial?: TutorialTuning;
  /** NPC talk window settings and lines that differ from the code. */
  npcTalk?: NpcTalkTuning;
  /** Item set settings that differ from the code. */
  sets?: SetTuning;
  /** Skill system settings that differ from the code. */
  skills?: SkillTuning;
  /** Floor 2 move numbers that differ from the code. */
  moves?: MoveTuning;
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
  critCap: [0, 100],
  moveCap: [0, 300],
  moveGrowth: [0, 0.12],
  monsterMult: [0.1, 10],
  mobPack: [1, 5],
  spawnRadius: [1, 4],
  farmSpots: [0, 100],
  expMult: [0.1, 10],
  bossSwitchSec: [0, 120],
  mobGiveUpSec: [0, 120],
  mobRoamReach: [2, 30],
  roomWipeSec: [3, 60],
  roomBossDelay: [0, 60],
  roomLoadWait: [0, 60],
  heartBlastSpots: [1, 12],
  heartBlastMinDist: [0, 20],
  heartBlastReach: [0.3, 1],
  bossLootBase: [0.5, 10],
  bossLootK: [0, 5],
  bossLootMax: [1, 30],
  vipExpPct: [0, 100],
  vipDropPct: [0, 100],
  reviveGuardSec: [1, 30],
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
    critCap: CODE_CRIT_CAP,
    moveCap: CODE_MOVE_CAP,
    moveGrowth: CODE_MOVE_GROWTH,
    monsters: {},
    mobPack: {},
    spawnRadius: {},
    farmSpots: {},
    expMult: {},
    potions: codePotions(),
    bossSwitchSec: CODE_BOSS_SWITCH_SEC,
    mobGiveUpSec: CODE_MOB_GIVE_UP_SEC,
    mobReturnIgnoreHits: CODE_MOB_RETURN_IGNORE_HITS,
    mobDropOnSafe: CODE_MOB_DROP_ON_SAFE,
    mobRoam: CODE_MOB_ROAM,
    mobRoamReach: CODE_MOB_ROAM_REACH,
    mapFromDb: CODE_MAP_FROM_DB,
    buffDurSummons: CODE_BUFF_DUR_SUMMONS,
    forgeAuto: CODE_FORGE_AUTO,
    english: CODE_ENGLISH,
    forge: codeForge(),
    walkHidden: CODE_WALK_HIDDEN,
    floorGateOpen: CODE_FLOOR_GATE_OPEN,
    floorGateQuest: CODE_FLOOR_GATE_QUEST,
    floorGate: codeFloorGate(),
    shopNoEquip: CODE_SHOP_NO_EQUIP,
    tryOnTownOnly: CODE_TRY_ON_TOWN_ONLY,
    chatLinks: CODE_CHAT_LINKS,
    hubChannels: CODE_HUB_CHANNELS,
    bossWipeKeepHp: CODE_BOSS_WIPE_KEEP_HP,
    roomWipeSec: CODE_ROOM_WIPE_SECONDS,
    roomBossDelay: CODE_ROOM_BOSS_DELAY,
    roomLoadWait: CODE_ROOM_LOAD_WAIT,
    heartBlastRandom: CODE_HEART_BLAST_RANDOM,
    heartBlastSpots: CODE_HEART_BLAST_SPOTS,
    heartBlastMinDist: CODE_HEART_BLAST_MIN_DIST,
    heartBlastReach: CODE_HEART_BLAST_REACH,
    bossLootSpread: CODE_BOSS_LOOT_SPREAD,
    bossLootBase: CODE_BOSS_LOOT_BASE,
    bossLootK: CODE_BOSS_LOOT_K,
    bossLootMax: CODE_BOSS_LOOT_MAX,
    vipExpPct: CODE_VIP_EXP_PCT,
    vipDropPct: CODE_VIP_DROP_PCT,
    buffTotal: CODE_BUFF_TOTAL,
    reviveGuard: CODE_REVIVE_GUARD,
    reviveGuardSec: CODE_REVIVE_GUARD_SEC,
    auto: codeAuto(),
    waves: codeWaves(),
    bagExpand: codeBagExpand(),
    fxLayer: codeFxLayer(),
    rigLook: codeRigLook(),
    attackRoot: codeAttackRoot(),
    audio: codeAudio(),
    menuLayout: codeMenuLayout(),
    hudLayout: codeHudLayout(),
    tutorial: codeTutorial(),
    npcTalk: codeNpcTalk(),
    sets: codeSets(),
    skills: codeSkills(),
    moves: codeMoves(),
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
  if (t.critCap !== undefined) b.critCap = t.critCap;
  if (t.moveCap !== undefined) b.moveCap = t.moveCap;
  if (t.moveGrowth !== undefined) b.moveGrowth = t.moveGrowth;
  if (t.monsters) b.monsters = structuredClone(t.monsters);
  if (t.mobPack) b.mobPack = { ...t.mobPack };
  if (t.spawnRadius) b.spawnRadius = { ...t.spawnRadius };
  if (t.farmSpots) b.farmSpots = { ...t.farmSpots };
  if (t.expMult) b.expMult = { ...t.expMult };
  if (t.potions) {
    for (const k of POTION_KINDS) for (const z of POTION_SIZE_LIST) Object.assign(b.potions[k][z], t.potions[k]?.[z]);
    if (t.potions.swordBonus !== undefined) b.potions.swordBonus = t.potions.swordBonus;
    if (t.potions.dropM !== undefined) b.potions.dropM = t.potions.dropM;
    if (t.potions.dropL !== undefined) b.potions.dropL = t.potions.dropL;
  }
  if (t.bossSwitchSec !== undefined) b.bossSwitchSec = t.bossSwitchSec;
  if (t.mobGiveUpSec !== undefined) b.mobGiveUpSec = t.mobGiveUpSec;
  if (t.mobRoamReach !== undefined) b.mobRoamReach = t.mobRoamReach;
  if (t.bossWipeKeepHp !== undefined) b.bossWipeKeepHp = t.bossWipeKeepHp;
  if (t.roomWipeSec !== undefined) b.roomWipeSec = t.roomWipeSec;
  if (t.roomBossDelay !== undefined) b.roomBossDelay = t.roomBossDelay;
  if (t.roomLoadWait !== undefined) b.roomLoadWait = t.roomLoadWait;
  if (t.heartBlastRandom !== undefined) b.heartBlastRandom = t.heartBlastRandom;
  if (t.heartBlastSpots !== undefined) b.heartBlastSpots = t.heartBlastSpots;
  if (t.heartBlastMinDist !== undefined) b.heartBlastMinDist = t.heartBlastMinDist;
  if (t.heartBlastReach !== undefined) b.heartBlastReach = t.heartBlastReach;
  if (t.bossLootSpread !== undefined) b.bossLootSpread = t.bossLootSpread;
  if (t.bossLootBase !== undefined) b.bossLootBase = t.bossLootBase;
  if (t.bossLootK !== undefined) b.bossLootK = t.bossLootK;
  if (t.bossLootMax !== undefined) b.bossLootMax = t.bossLootMax;
  if (t.vipExpPct !== undefined) b.vipExpPct = t.vipExpPct;
  if (t.vipDropPct !== undefined) b.vipDropPct = t.vipDropPct;
  if (t.buffTotal !== undefined) b.buffTotal = t.buffTotal;
  if (t.reviveGuard !== undefined) b.reviveGuard = t.reviveGuard;
  if (t.reviveGuardSec !== undefined) b.reviveGuardSec = t.reviveGuardSec;
  if (t.mobReturnIgnoreHits !== undefined) b.mobReturnIgnoreHits = t.mobReturnIgnoreHits;
  if (t.mobDropOnSafe !== undefined) b.mobDropOnSafe = t.mobDropOnSafe;
  if (t.mobRoam !== undefined) b.mobRoam = t.mobRoam;
  if (t.mapFromDb !== undefined) b.mapFromDb = t.mapFromDb;
  if (t.buffDurSummons !== undefined) b.buffDurSummons = t.buffDurSummons;
  if (t.forgeAuto !== undefined) b.forgeAuto = t.forgeAuto;
  if (t.english !== undefined) b.english = t.english;
  b.forge = mergeForge(t.forge);
  if (t.walkHidden !== undefined) b.walkHidden = t.walkHidden;
  if (t.floorGateOpen !== undefined) b.floorGateOpen = t.floorGateOpen;
  if (t.floorGateQuest !== undefined) b.floorGateQuest = t.floorGateQuest;
  b.floorGate = mergeFloorGate(t.floorGate);
  if (t.shopNoEquip !== undefined) b.shopNoEquip = t.shopNoEquip;
  if (t.tryOnTownOnly !== undefined) b.tryOnTownOnly = t.tryOnTownOnly;
  if (t.chatLinks !== undefined) b.chatLinks = t.chatLinks;
  if (t.hubChannels !== undefined) b.hubChannels = t.hubChannels;
  b.auto = mergeAuto(t.auto);
  b.waves = mergeWaves(t.waves);
  b.bagExpand = mergeBagExpand(t.bagExpand);
  b.fxLayer = mergeFxLayer(t.fxLayer);
  b.rigLook = mergeRigLook(t.rigLook);
  b.attackRoot = mergeAttackRoot(t.attackRoot);
  b.audio = mergeAudio(t.audio);
  b.menuLayout = mergeMenuLayout(t.menuLayout);
  b.hudLayout = mergeHudLayout(t.hudLayout);
  b.tutorial = mergeTutorial(t.tutorial);
  b.npcTalk = mergeNpcTalk(t.npcTalk);
  b.sets = mergeSets(t.sets);
  b.skills = mergeSkills(t.skills);
  b.moves = mergeMoves(t.moves);
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
  setMoveGrowth(b.moveGrowth);
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
  // A farm spot switched off in /admin (Balance.farmSpots): golden-ratio spread again, so the spots left on are even over the
  // map and over every kind (the spots are listed kind by kind).
  const on = b.farmSpots[zoneId];
  if (on !== undefined && ((index * 0.6180339887 + 0.5) % 1) >= on / 100) return 0;
  const m = b.mobPack[zoneId] ?? 1;
  if (m === 1 || count <= 0) return count;
  const want = count * m;
  const whole = Math.floor(want);
  // Golden-ratio spread: over any run of spots, the share that gets one more is close to the fraction.
  return Math.max(1, whole + (((index * 0.6180339887) % 1) < want - whole ? 1 : 0));
}

/** Spawn-spot radius × of a map (/admin; ×1 = the radius in the map file). Bosses and boss rooms ignore it (callers skip them). */
export const spawnRadiusMult = (zoneId: string, b: Balance = current): number => b.spawnRadius[zoneId] ?? 1;

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
  const TOP = ['classes', 'hpRegenMult', 'mpRegenMult', 'tierWeight', 'tierWidth', 'rangeFloor', 'bossTierBoost', 'statTiers', 'bandTiers', 'itemStatMult', 'affixWeight', 'cdrCap', 'critCap', 'moveCap', 'moveGrowth', 'monsters', 'mobPack', 'spawnRadius', 'farmSpots', 'expMult', 'potions', 'bossSwitchSec', 'mobGiveUpSec', 'mobReturnIgnoreHits', 'buffTotal', 'mobDropOnSafe', 'mobRoam', 'mobRoamReach', 'mapFromDb', 'buffDurSummons', 'forgeAuto', 'english', 'forge', 'walkHidden', 'floorGateOpen', 'floorGateQuest', 'floorGate', 'shopNoEquip', 'tryOnTownOnly', 'chatLinks', 'hubChannels', 'bossWipeKeepHp', 'roomWipeSec', 'roomBossDelay', 'roomLoadWait', 'reviveGuard', 'reviveGuardSec', 'auto', 'waves', 'bagExpand', 'tutorial', 'npcTalk', 'skills', 'fxLayer', 'rigLook', 'attackRoot', 'audio', 'menuLayout', 'bossLootSpread', 'bossLootBase', 'bossLootK', 'bossLootMax', 'vipExpPct', 'vipDropPct', 'heartBlastRandom', 'heartBlastSpots', 'heartBlastMinDist', 'heartBlastReach', 'hudLayout', 'sets', 'moves'];
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
  const one = (key: 'hpRegenMult' | 'mpRegenMult' | 'rangeFloor' | 'bossTierBoost' | 'bossSwitchSec' | 'mobGiveUpSec' | 'mobRoamReach' | 'roomWipeSec' | 'roomBossDelay' | 'roomLoadWait' | 'bossLootBase' | 'bossLootK' | 'bossLootMax' | 'vipExpPct' | 'vipDropPct' | 'reviveGuardSec' | 'cdrCap' | 'critCap' | 'moveCap' | 'moveGrowth' | 'heartBlastSpots' | 'heartBlastMinDist' | 'heartBlastReach', range: readonly [number, number], what: string): string | null => {
    const n = num(o[key], range[0], range[1], what);
    if (typeof n === 'string') return n;
    if (n !== undefined && n !== CODE[key]) out[key] = n;
    return null;
  };
  const roam = (): string | null => {
    const x = o.mobRoam;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์มอนเกิดใหม่สุ่มที่ต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.mobRoam) out.mobRoam = x;
    return null;
  };
  const returnIgnore = (): string | null => {
    const x = o.mobReturnIgnoreHits;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์มอนเดินกลับไม่สนการโจมตีต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.mobReturnIgnoreHits) out.mobReturnIgnoreHits = x;
    return null;
  };
  const buffTotal = (): string | null => {
    const x = o.buffTotal;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์ป้ายบัฟรวมต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.buffTotal) out.buffTotal = x;
    return null;
  };
  const dropOnSafe = (): string | null => {
    const x = o.mobDropOnSafe;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์มอนเลิกไล่เมื่อผู้เล่นเข้าเมืองต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.mobDropOnSafe) out.mobDropOnSafe = x;
    return null;
  };
  const mapFromDb = (): string | null => {
    const x = o.mapFromDb;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์ใช้แมพจาก DB ต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.mapFromDb) out.mapFromDb = x;
    return null;
  };
  const buffDurSummons = (): string | null => {
    const x = o.buffDurSummons;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์เวลาบัฟนับ summon ต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.buffDurSummons) out.buffDurSummons = x;
    return null;
  };
  const forgeAuto = (): string | null => {
    const x = o.forgeAuto;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์ตีบวก Auto ต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.forgeAuto) out.forgeAuto = x;
    return null;
  };
  const english = (): string | null => {
    const x = o.english;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์ภาษาอังกฤษต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.english) out.english = x;
    return null;
  };
  const walkHidden = (): string | null => {
    const x = o.walkHidden;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์เดินต่อเมื่อสลับแท็บต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.walkHidden) out.walkHidden = x;
    return null;
  };
  const flag = (key: 'floorGateOpen' | 'floorGateQuest', name: string) => (): string | null => {
    const x = o[key];
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? `สวิตช์${name}ต้องเป็นเปิด/ปิด` : null;
    if (x !== CODE[key]) out[key] = x;
    return null;
  };
  const gateOpen = flag('floorGateOpen', 'เปิดประตูที่ต้องทำเควส');
  const gateQuest = flag('floorGateQuest', 'ต้องทำเควสก่อนผ่านประตู');
  const shopNoEquip = (): string | null => {
    const x = o.shopNoEquip;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์ห้ามถอด/สวมขณะเปิดร้านต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.shopNoEquip) out.shopNoEquip = x;
    return null;
  };
  const tryOnTown = (): string | null => {
    const x = o.tryOnTownOnly;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์ลองสวมได้เฉพาะในเมืองต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.tryOnTownOnly) out.tryOnTownOnly = x;
    return null;
  };
  const chatLinks = (): string | null => {
    const x = o.chatLinks;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์ลิงก์ไอเทมในแชทต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.chatLinks) out.chatLinks = x;
    return null;
  };
  const hubChannels = (): string | null => {
    const x = o.hubChannels;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์แบ่งห้องเมืองกลางต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.hubChannels) out.hubChannels = x;
    return null;
  };
  const wipeKeep = (): string | null => {
    const x = o.bossWipeKeepHp;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์บอสไม่ฟื้นเลือดตอนทีมตายหมดต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.bossWipeKeepHp) out.bossWipeKeepHp = x;
    return null;
  };
  const heartRandom = (): string | null => {
    const x = o.heartBlastRandom;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์จุดปลอดภัยสุ่มทั่วลานต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.heartBlastRandom) out.heartBlastRandom = x;
    return null;
  };
  const bossLootSpread = (): string | null => {
    const x = o.bossLootSpread;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์กระจายของดรอปบอสต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.bossLootSpread) out.bossLootSpread = x;
    return null;
  };
  const reviveGuard = (): string | null => {
    const x = o.reviveGuard;
    if (x === undefined) return null;
    if (typeof x !== 'boolean') return strict ? 'สวิตช์อมตะหลังชุบด้วยขนนกฟีนิกซ์ต้องเป็นเปิด/ปิด' : null;
    if (x !== CODE.reviveGuard) out.reviveGuard = x;
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
  // Spawn-spot radius ×, by map: the built-in maps with spawn spots, plus any editor-made map the server knows.
  const spawnRadius = (): string | null => {
    const x = o.spawnRadius;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'รัศมีจุดเกิดไม่ถูกต้อง' : null;
    const known = (id: string) => PACK_ZONES.some((z) => z.id === id) || !!customDef(id);
    const res: Record<string, number> = {};
    for (const id of Object.keys(x)) {
      if (!known(id)) {
        if (strict) return `รัศมีจุดเกิด: ไม่รู้จักแมพ "${id.slice(0, 30)}"`;
        continue;
      }
      const n = num(x[id], ...BALANCE_RANGE.spawnRadius, `รัศมีจุดเกิด ${id}`);
      if (typeof n === 'string') return n;
      if (n !== undefined && n !== 1) res[id] = n;
    }
    if (Object.keys(res).length) out.spawnRadius = res;
    return null;
  };
  // Farm maps' % of spawn spots in use, in FARM_IDS order.
  const farmSpots = (): string | null => {
    const x = o.farmSpots;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'จุดเกิดที่เปิดใช้ไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => !FARM_IDS.includes(k));
      if (extra) return `จุดเกิดที่เปิดใช้: ไม่รู้จักแมพ "${extra.slice(0, 30)}"`;
    }
    const res: Record<string, number> = {};
    for (const id of FARM_IDS) {
      const n = num(x[id], ...BALANCE_RANGE.farmSpots, `จุดเกิดที่เปิดใช้ ${ZONES[id].nameTh}`);
      if (typeof n === 'string') return n;
      if (n !== undefined && n !== 100) res[id] = n;
    }
    if (Object.keys(res).length) out.farmSpots = res;
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
      const extra = Object.keys(x).find((k) => k !== 'hp' && k !== 'mp' && k !== 'swordBonus' && k !== 'dropM' && k !== 'dropL');
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
    for (const [f, label] of [['dropM', 'ยากลาง'], ['dropL', 'ยาใหญ่']] as const) {
      const lv = num(x[f], ...POTION_RANGE.dropLevel, `มอนดรอป${label}ตั้งแต่เลเวล`);
      if (typeof lv === 'string') return lv;
      if (lv !== undefined && Math.round(lv) !== CODE_POTION_DROP[f]) res[f] = Math.round(lv);
    }
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
  const floorGate = (): string | null => {
    const c = checkFloorGateTuning(o.floorGate, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.floorGate = c.tuning;
    return null;
  };
  const waves = (): string | null => {
    const c = checkWaveTuning(o.waves, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.waves = c.tuning;
    return null;
  };
  const bagExpand = (): string | null => {
    const c = checkBagExpand(o.bagExpand, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.bagExpand = c.tuning;
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
  const audio = (): string | null => {
    const c = checkAudioTuning(o.audio, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.audio = c.tuning;
    return null;
  };
  const attackRoot = (): string | null => {
    const c = checkAttackRootTuning(o.attackRoot, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.attackRoot = c.tuning;
    return null;
  };
  const sets = (): string | null => {
    const c = checkSetTuning(o.sets, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.sets = c.tuning;
    return null;
  };
  const moves = (): string | null => {
    const c = checkMoveTuning(o.moves, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.moves = c.tuning;
    return null;
  };
  const npcTalk = (): string | null => {
    const c = checkNpcTalkTuning(o.npcTalk, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.npcTalk = c.tuning;
    return null;
  };
  const menuLayout = (): string | null => {
    const c = checkMenuLayoutTuning(o.menuLayout, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.menuLayout = c.tuning;
    return null;
  };
  const hudLayout = (): string | null => {
    const c = checkHudLayoutTuning(o.hudLayout, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.hudLayout = c.tuning;
    return null;
  };
  const forge = (): string | null => {
    const c = checkForgeTuning(o.forge, strict);
    if ('error' in c) return c.error;
    if (c.tuning) out.forge = c.tuning;
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
    one('critCap', BALANCE_RANGE.critCap, 'อัตราคริสูงสุด %') ??
    one('moveCap', BALANCE_RANGE.moveCap, 'ความเร็วเคลื่อนที่จากไอเทมสูงสุด %') ??
    one('moveGrowth', BALANCE_RANGE.moveGrowth, 'ค่าหลักความเร็วเคลื่อนที่โตต่อเลเวล') ??
    monsters() ??
    mobPack() ??
    spawnRadius() ??
    farmSpots() ??
    expMult() ??
    potions() ??
    one('bossSwitchSec', BALANCE_RANGE.bossSwitchSec, 'บอสเปลี่ยนเป้าหมายทุก (วินาที)') ??
    one('mobGiveUpSec', BALANCE_RANGE.mobGiveUpSec, 'มอนธรรมดาเลิกไล่เมื่อไม่โดนตี (วินาที)') ??
    returnIgnore() ??
    buffTotal() ??
    roam() ??
    one('mobRoamReach', BALANCE_RANGE.mobRoamReach, 'ระยะที่จุดเกิดย้ายได้จากจุดเดิม') ??
    dropOnSafe() ??
    mapFromDb() ??
    buffDurSummons() ??
    forgeAuto() ??
    english() ??
    forge() ??
    walkHidden() ??
    gateOpen() ??
    gateQuest() ??
    floorGate() ??
    shopNoEquip() ??
    tryOnTown() ??
    chatLinks() ??
    hubChannels() ??
    wipeKeep() ??
    one('roomWipeSec', BALANCE_RANGE.roomWipeSec, 'เวลาชุบตอนตายหมดทีม (วินาที)') ??
    one('roomBossDelay', BALANCE_RANGE.roomBossDelay, 'นับถอยหลังก่อนบอสเกิด (วินาที)') ??
    one('roomLoadWait', BALANCE_RANGE.roomLoadWait, 'เวลารอผู้เล่นโหลดสูงสุด (วินาที)') ??
    heartRandom() ??
    one('heartBlastSpots', BALANCE_RANGE.heartBlastSpots, 'จำนวนจุดปลอดภัยของระเบิดใหญ่หัวใจภูเขาไฟ') ??
    one('heartBlastMinDist', BALANCE_RANGE.heartBlastMinDist, 'ระยะจุดปลอดภัยห่างผู้เล่นขั้นต่ำ') ??
    one('heartBlastReach', BALANCE_RANGE.heartBlastReach, 'ค่าเผื่อวิ่งทันของจุดปลอดภัย') ??
    bossLootSpread() ??
    one('bossLootBase', BALANCE_RANGE.bossLootBase, 'รัศมีฐานของดรอปบอส') ??
    one('bossLootK', BALANCE_RANGE.bossLootK, 'ตัวคูณรัศมีต่อจำนวนของดรอปบอส') ??
    one('bossLootMax', BALANCE_RANGE.bossLootMax, 'รัศมีสูงสุดของดรอปบอส') ??
    one('vipExpPct', BALANCE_RANGE.vipExpPct, 'โบนัส EXP ของ VIP (%)') ??
    one('vipDropPct', BALANCE_RANGE.vipDropPct, 'โบนัสดรอปของ VIP (%)') ??
    reviveGuard() ??
    one('reviveGuardSec', BALANCE_RANGE.reviveGuardSec, 'อมตะหลังชุบด้วยขนนกฟีนิกซ์ (วินาที)') ??
    auto() ??
    waves() ??
    bagExpand() ??
    tutorial() ??
    npcTalk() ??
    skills() ??
    fxLayer() ??
    rigLook() ??
    attackRoot() ??
    audio() ??
    menuLayout() ??
    hudLayout() ??
    sets() ??
    moves();
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
  if (a.critCap !== b.critCap) out.push(`อัตราคริสูงสุด ${a.critCap}% → ${b.critCap}%`);
  if (a.moveCap !== b.moveCap) out.push(`ความเร็วเคลื่อนที่จากไอเทมสูงสุด ${a.moveCap}% → ${b.moveCap}%`);
  if (a.moveGrowth !== b.moveGrowth) out.push(`ค่าหลักความเร็วเคลื่อนที่โตต่อเลเวล ${a.moveGrowth} → ${b.moveGrowth}`);
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
  for (const id of new Set([...Object.keys(a.spawnRadius), ...Object.keys(b.spawnRadius)])) {
    const p = a.spawnRadius[id] ?? 1;
    const q = b.spawnRadius[id] ?? 1;
    if (p !== q) out.push(`รัศมีจุดเกิด ${ZONES[id]?.nameTh ?? customDef(id)?.nameTh ?? id} ×${p} → ×${q}`);
  }
  for (const id of FARM_IDS) {
    const p = a.farmSpots[id] ?? 100;
    const q = b.farmSpots[id] ?? 100;
    if (p !== q) out.push(`จุดเกิดที่เปิดใช้ ${ZONES[id].nameTh} ${p}% → ${q}%`);
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
  if (a.potions.dropM !== b.potions.dropM) out.push(`มอนดรอปยากลางตั้งแต่ Lv ${a.potions.dropM} → ${b.potions.dropM}`);
  if (a.potions.dropL !== b.potions.dropL) out.push(`มอนดรอปยาใหญ่ตั้งแต่ Lv ${a.potions.dropL} → ${b.potions.dropL}`);
  if (a.bossSwitchSec !== b.bossSwitchSec) out.push(`บอสเปลี่ยนเป้าหมายทุก ${a.bossSwitchSec || 'ปิด'} → ${b.bossSwitchSec || 'ปิด'} วิ`);
  if (a.mobGiveUpSec !== b.mobGiveUpSec) out.push(`มอนธรรมดาเลิกไล่เมื่อไม่โดนตี ${a.mobGiveUpSec || 'ไม่เลิก'} → ${b.mobGiveUpSec || 'ไม่เลิก'} วิ`);
  if (a.bossWipeKeepHp !== b.bossWipeKeepHp) out.push(`บอสไม่ฟื้นเลือดตอนทีมตายหมด ${a.bossWipeKeepHp ? 'เปิด' : 'ปิด'} → ${b.bossWipeKeepHp ? 'เปิด' : 'ปิด'}`);
  if (a.roomWipeSec !== b.roomWipeSec) out.push(`เวลาชุบตอนตายหมดทีม ${a.roomWipeSec} → ${b.roomWipeSec} วิ`);
  if (a.roomBossDelay !== b.roomBossDelay) out.push(`นับถอยหลังก่อนบอสเกิด ${a.roomBossDelay} → ${b.roomBossDelay} วิ`);
  if (a.roomLoadWait !== b.roomLoadWait) out.push(`เวลารอผู้เล่นโหลดสูงสุด ${a.roomLoadWait} → ${b.roomLoadWait} วิ`);
  if (a.heartBlastRandom !== b.heartBlastRandom) out.push(`ระเบิดใหญ่หัวใจภูเขาไฟสุ่มจุดปลอดภัยทั่วลาน ${a.heartBlastRandom ? 'เปิด' : 'ปิด'} → ${b.heartBlastRandom ? 'เปิด' : 'ปิด'}`);
  if (a.heartBlastSpots !== b.heartBlastSpots) out.push(`จำนวนจุดปลอดภัยระเบิดใหญ่ ${a.heartBlastSpots} → ${b.heartBlastSpots}`);
  if (a.heartBlastMinDist !== b.heartBlastMinDist) out.push(`จุดปลอดภัยห่างผู้เล่นขั้นต่ำ ${a.heartBlastMinDist} → ${b.heartBlastMinDist}`);
  if (a.heartBlastReach !== b.heartBlastReach) out.push(`ค่าเผื่อวิ่งทันของจุดปลอดภัย ${a.heartBlastReach} → ${b.heartBlastReach}`);
  if (a.bossLootSpread !== b.bossLootSpread) out.push(`กระจายของดรอปบอส ${a.bossLootSpread ? 'เปิด' : 'ปิด'} → ${b.bossLootSpread ? 'เปิด' : 'ปิด'}`);
  if (a.bossLootBase !== b.bossLootBase) out.push(`รัศมีฐานของดรอปบอส ${a.bossLootBase} → ${b.bossLootBase}`);
  if (a.bossLootK !== b.bossLootK) out.push(`ตัวคูณรัศมีต่อจำนวนของดรอปบอส ${a.bossLootK} → ${b.bossLootK}`);
  if (a.bossLootMax !== b.bossLootMax) out.push(`รัศมีสูงสุดของดรอปบอส ${a.bossLootMax} → ${b.bossLootMax}`);
  if (a.vipExpPct !== b.vipExpPct) out.push(`โบนัส EXP ของ VIP ${a.vipExpPct}% → ${b.vipExpPct}%`);
  if (a.vipDropPct !== b.vipDropPct) out.push(`โบนัสดรอปของ VIP ${a.vipDropPct}% → ${b.vipDropPct}%`);
  if (a.buffTotal !== b.buffTotal) out.push(`ป้ายบัฟรวม EXP/ดรอป ${a.buffTotal ? 'เปิด' : 'ปิด'} → ${b.buffTotal ? 'เปิด' : 'ปิด'}`);
  if (a.reviveGuard !== b.reviveGuard) out.push(`อมตะหลังชุบด้วยขนนกฟีนิกซ์ ${a.reviveGuard ? 'เปิด' : 'ปิด'} → ${b.reviveGuard ? 'เปิด' : 'ปิด'}`);
  if (a.reviveGuardSec !== b.reviveGuardSec) out.push(`เวลาอมตะหลังชุบ ${a.reviveGuardSec} → ${b.reviveGuardSec} วิ`);
  out.push(...forgeChanges(a.forge, b.forge));
  if (a.english !== b.english) out.push(`ภาษาอังกฤษ ${a.english ? 'เปิด' : 'ปิด'} → ${b.english ? 'เปิด' : 'ปิด'}`);
  if (a.forgeAuto !== b.forgeAuto) out.push(`ตีบวก Auto ${a.forgeAuto ? 'เปิด' : 'ปิด'} → ${b.forgeAuto ? 'เปิด' : 'ปิด'}`);
  if (a.hubChannels !== b.hubChannels) out.push(`แบ่งห้องเมืองกลาง ${a.hubChannels ? 'เปิด' : 'ปิด'} → ${b.hubChannels ? 'เปิด' : 'ปิด'}`);
  if (a.tryOnTownOnly !== b.tryOnTownOnly) out.push(`ลองสวมของแต่งตัวได้เฉพาะในเมือง ${a.tryOnTownOnly ? 'เปิด' : 'ปิด'} → ${b.tryOnTownOnly ? 'เปิด' : 'ปิด'}`);
  if (a.shopNoEquip !== b.shopNoEquip) out.push(`ห้ามถอด/สวมขณะเปิดร้าน ${a.shopNoEquip ? 'เปิด' : 'ปิด'} → ${b.shopNoEquip ? 'เปิด' : 'ปิด'}`);
  if (a.chatLinks !== b.chatLinks) out.push(`ลิงก์ไอเทมในแชท ${a.chatLinks ? 'เปิด' : 'ปิด'} → ${b.chatLinks ? 'เปิด' : 'ปิด'}`);
  if (a.walkHidden !== b.walkHidden) out.push(`เดินต่อเมื่อสลับแท็บ ${a.walkHidden ? 'เปิด' : 'ปิด'} → ${b.walkHidden ? 'เปิด' : 'ปิด'}`);
  if (a.floorGateOpen !== b.floorGateOpen) out.push(`ประตูที่ต้องทำเควส (ทางขึ้นชั้น 2) ${a.floorGateOpen ? 'เปิด' : 'ปิด'} → ${b.floorGateOpen ? 'เปิด' : 'ปิด'}`);
  if (a.floorGateQuest !== b.floorGateQuest) out.push(`ต้องทำเควสก่อนผ่านประตู ${a.floorGateQuest ? 'เปิด' : 'ปิด'} → ${b.floorGateQuest ? 'เปิด' : 'ปิด'}`);
  if (a.buffDurSummons !== b.buffDurSummons) out.push(`เพิ่มเวลาบัฟนับ summon (ป้อมปืน โดรน กับระเบิด) ${a.buffDurSummons ? 'เปิด' : 'ปิด'} → ${b.buffDurSummons ? 'เปิด' : 'ปิด'}`);
  if (a.mobDropOnSafe !== b.mobDropOnSafe) out.push(`มอนเลิกไล่เมื่อผู้เล่นเข้าเมือง/safe zone ${a.mobDropOnSafe ? 'เปิด' : 'ปิด'} → ${b.mobDropOnSafe ? 'เปิด' : 'ปิด'}`);
  if (a.mapFromDb !== b.mapFromDb) out.push(`ใช้แมพจาก DB ${a.mapFromDb ? 'เปิด' : 'ปิด'} → ${b.mapFromDb ? 'เปิด' : 'ปิด'}`);
  if (a.mobRoamReach !== b.mobRoamReach) out.push(`ระยะที่จุดเกิดมอนย้ายได้จากจุดเดิม ${a.mobRoamReach} → ${b.mobRoamReach}`);
  if (a.mobRoam !== b.mobRoam) out.push(`มอนแมพฟาร์มชั้น 1 เกิดใหม่สุ่มที่ ${a.mobRoam ? 'เปิด' : 'ปิด'} → ${b.mobRoam ? 'เปิด' : 'ปิด'}`);
  if (a.mobReturnIgnoreHits !== b.mobReturnIgnoreHits) out.push(`มอนเดินกลับบ้านไม่สนการโจมตี ${a.mobReturnIgnoreHits ? 'เปิด' : 'ปิด'} → ${b.mobReturnIgnoreHits ? 'เปิด' : 'ปิด'}`);
  out.push(...floorGateChanges(a.floorGate, b.floorGate));
  out.push(...autoChanges(a.auto, b.auto));
  out.push(...waveChanges(a.waves, b.waves));
  out.push(...bagExpandChanges(a.bagExpand, b.bagExpand));
  out.push(...tutorialChanges(a.tutorial, b.tutorial));
  out.push(...npcTalkChanges(a.npcTalk, b.npcTalk));
  out.push(...skillChanges(a.skills, b.skills));
  out.push(...fxLayerChanges(a.fxLayer, b.fxLayer));
  out.push(...rigLookChanges(a.rigLook, b.rigLook));
  out.push(...attackRootChanges(a.attackRoot, b.attackRoot));
  out.push(...audioChanges(a.audio, b.audio));
  out.push(...menuLayoutChanges(a.menuLayout, b.menuLayout));
  out.push(...setChanges(a.sets, b.sets));
  out.push(...moveChanges(a.moves, b.moves));
  out.push(...hudLayoutChanges(a.hudLayout, b.hudLayout));
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

/** The same tuning with another HUD layout (`layout`, already clean): every other save keeps the published layout with this. */
export function withHudLayout(t: BalanceTuning, layout: BalanceTuning['hudLayout']): BalanceTuning {
  const { hudLayout: _, ...rest } = t;
  return checkBalance(layout ? { ...rest, hudLayout: layout } : rest, false).tuning ?? {};
}
