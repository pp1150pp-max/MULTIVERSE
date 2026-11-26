import { Unit } from './Unit';
import type { Sim } from './Sim';
import type { Monster } from './Monster';
import { suctionStep } from './kraken';
import type { Terrain } from './terrain';
import type { Intent, SkillEffect } from './types';
import { castSkill, basicAttack, quarksCue, emptyGunBuffs, type GunBuffs } from './skills';
import { passiveDashCdMult, passiveOnCast, passiveOnDash, passiveOnKill, passiveStats } from '../passives';
import { CLASSES, type ClassDef, type SkillDef, type SkillSlot } from '../data/classes';
import { cleanSkillBook, rankedCooldown, rankedMp, rankOf, skillParam, type SkillBook } from '../skillBook';
import { addInto, BASE_MOVE_SPEED, emptyStats } from '../formulas';
import { gatesPassedBy } from '../data/bossGates';
import { cleanUnlocks } from '../floors';
import { cleanCosWorn, MOUNT_SPEED, type CosWorn } from '../data/cosmetics';
import { auraTier, effectiveStats, orbCodes, plusOf, sellValue } from '../data/enhance';
import { itemClass, starterWeapon, upgradeItem } from '../data/items';
import { setBonusStats } from '../data/sets';
import { anyStackValue, potionHeal, potionPrice, POTION_SIZES, POTION_STACK, stackLimit } from '../data/potions';
import { BOSS_QUEST_KEY, BUFF_MAX, QUEST_KILLS, stoneStackMax } from '../data/stones';
import { CARD_IDS, type CardId } from '../data/cards';
import { cardFxTotal, noCardFx, type CardFxTotals } from '../cardSockets';
import { albumBonus } from '../cardAlbum';
import { cleanGearDone, cleanGearQuests } from '../gearQuests';
import type { TutorialData } from '../tutorial';
import {
  BUFF_SCROLLS, isOrbStone, isPotion, isStack, isStone, RARITIES, sameStack, SLOTS, STONE_KINDS, wornPlaces,
  type BagEntry, type BuffScroll, type EquipSlot, type StoneKind, type ClassId, type Item, type PotionKind, type PotionSize, type Rarity, type SlotId, type Stats, type Vec2,
} from '../types';
import type { LootKind } from './Loot';
import { newStash, type StashData } from './stash';
import { BAG_TABS, cleanBagSlots, freeCount, freeSlot, normalizeBag, tabAt, tabOf, tabRange, type BagSlots, type BagTab } from '../bagTabs';
import { classBalance, currentBalance, finishStats } from '../balance';
import { CHARGE_SKILLS, chargeMax, skipsAttackRoot } from '../skillTuning';
import { attackRootTime } from '../attackRootTuning';
import { classPassiveOn } from '../classPassives';
import { AUTO_DEFAULT_KEYS, AUTO_LOOT_ORDERS, AUTO_OUT_ACTIONS, AUTO_TARGET_MODES, type AutoDefaults, type AutoLootOrder, type AutoOutAction, type AutoTargetMode } from '../autoTuning';
import { MONSTERS } from '../data/monsters';

/** Seconds after the last hit taken, attack or skill before out-of-combat regen kicks in. */
export const COMBAT_LINGER = 5;
/** Regen multiplier while out of combat. */
export const OUT_OF_COMBAT_REGEN = 2.5;

/**
 * While stopped on an attack, a position the browser reports is taken only this close to where the stop began: the
 * server's stop starts a little after the browser's (the round trip), so its first steps after its own stop ends may
 * arrive while the server is still stopped. Refusing them all would leave the server behind and pull the player back.
 */
const ATTACK_ROOT_SLACK = 0.45;
/** The dash button's distance and time (the client's dashFx.ts uses the same). */
export const DASH_DIST = 4.8;
export const DASH_TIME = 0.18;
/** Warp walks the dash's path in steps this long (short enough not to slip through a thin collider). */
const WARP_STEP = 0.2;
/** How quickly a character on ice gets to the speed it wants, per second. Lower is slipperier. */
const ICE_GRIP = 1.5;
/** A slide slower than this stops. */
const ICE_STOP_SPEED = 0.25;

export const POTION_CD = 1.5;
/** A potion restores its amount evenly over this many seconds (owner: not all at once). */
export const POTION_TIME = 3;

/** A potion still being drunk: restores `perSec` until `left` runs out. */
interface PotionHeal { kind: PotionKind; perSec: number; left: number }

export type SortKey = 'rarity' | 'level' | 'slot' | 'value';
export const SORT_KEYS: SortKey[] = ['rarity', 'level', 'slot', 'value'];
/** Which potion size the quick keys (1 / 2) use. */
export type PotionSelect = Record<PotionKind, PotionSize>;
/**
 * What the player picks up from monster drops. Gold is always picked up.
 * `pots` = which potion sizes to take, per kind. Saves from before it existed only have `potions`
 * (take all or none); `potions` is kept true while any size is picked so they still read sensibly.
 */
export interface LootFilter { rarities: Rarity[]; potions: boolean; pots?: Record<PotionKind, PotionSize[]> }
export const DEFAULT_LOOT_FILTER: LootFilter = { rarities: [...RARITIES], potions: true, pots: { hp: [...POTION_SIZES], mp: [...POTION_SIZES] } };

/** Potion sizes to pick up, filling in old saves (and anything a client sends) safely. */
export function lootPots(f: Partial<LootFilter> | undefined): Record<PotionKind, PotionSize[]> {
  const clean = (v: unknown) => POTION_SIZES.filter((s) => Array.isArray(v) && v.includes(s));
  if (f?.pots && typeof f.pots === 'object') return { hp: clean(f.pots.hp), mp: clean(f.pots.mp) };
  const all = f?.potions !== false;
  return { hp: all ? [...POTION_SIZES] : [], mp: all ? [...POTION_SIZES] : [] };
}

/** The player's Auto Play options. `range` is in fixed pixels (AUTO_PX_PER_UNIT per world unit). */
export interface AutoSettings {
  range: number;
  /** True once the player has changed the range themselves. Without it, the default applies. */
  rangeSet?: boolean;
  /** Drink an HP / MP potion below this percent. */
  hpPct: number;
  mpPct: number;
  skills: Record<AutoSkill, boolean>;
  /** Priority: Auto casts the first skill in this list that is switched on and ready. Always q, e and r once each. */
  order: AutoSkill[];
  loot: boolean;
  // Options added 2026-11-13. Until the player picks one themselves (listed in `optsSet`), it follows the
  // server's default (admin "ปรับสมดุล" → Auto Play), even after the owner changes that default.
  /** The options below the player has picked themselves; the rest take the server's defaults. */
  optsSet?: (keyof AutoDefaults)[];
  /** When drops are picked up: kill attackers first / the old balanced way / drops first. */
  lootOrder: AutoLootOrder;
  /** Also pick up other players' drops once their priority time is over (false = own and party drops, and ownerless ones). */
  othersLoot: boolean;
  /** What to do when HP potions run out / MP potions run out / the bag is full. */
  noHp: AutoOutAction;
  noMp: AutoOutAction;
  bagFull: AutoOutAction;
  /** Which monster to go for. */
  target: AutoTargetMode;
  /** Monster kinds (MONSTERS ids) Auto doesn't attack, unless one attacks the player. */
  skip: string[];
  /** Skills only: no basic attack, stand and wait for a skill (follows the server default until picked, see optsSet). */
  skillsOnly: boolean;
  /** Seconds between two skills Auto casts (0 = no wait). */
  skillGap: number;
  /** True once the player has set the gap themselves. Without it, the server default (/admin) applies. */
  skillGapSet?: boolean;
}
export type AutoSkill = 'q' | 'e' | 'r';
export const AUTO_SKILLS: readonly AutoSkill[] = ['q', 'e', 'r'];
export const AUTO_PX_PER_UNIT = 50;
export const AUTO_RANGE_MIN = 100;
export const AUTO_RANGE_MAX = 2000;
/** The default before it became the maximum. */
const OLD_DEFAULT_RANGE = 300;
/** Most monster kinds the "don't attack" list may hold. */
export const AUTO_SKIP_MAX = 60;
export const DEFAULT_AUTO_SETTINGS: AutoSettings = {
  range: 750, hpPct: 45, mpPct: 15, skills: { q: true, e: true, r: true }, order: [...AUTO_SKILLS], loot: true,
  lootOrder: 'fight', othersLoot: true, noHp: 'fight', noMp: 'fight', bagFull: 'fight', target: 'attacker', skip: [],
  skillsOnly: false, skillGap: 0.3,
};
/** Longest gap a player may set between Auto's skills (seconds). */
export const AUTO_SKILL_GAP_MAX = 2;

/** Monster kinds from a save or a client: known, not bosses, each once. */
function cleanAutoSkip(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || !Object.hasOwn(MONSTERS, id) || MONSTERS[id].behavior === 'boss' || out.includes(id)) continue;
    out.push(id);
    if (out.length >= AUTO_SKIP_MAX) break;
  }
  return out;
}

/** A skill order from a save or a client: q, e and r once each, else the default Q, E, R. */
function cleanAutoOrder(raw: unknown): AutoSkill[] {
  if (!Array.isArray(raw) || raw.length !== AUTO_SKILLS.length) return [...AUTO_SKILLS];
  const seen = new Set<unknown>(raw);
  return seen.size === AUTO_SKILLS.length && AUTO_SKILLS.every((k) => seen.has(k)) ? (raw as AutoSkill[]).slice() : [...AUTO_SKILLS];
}

/** Fill in and clamp settings from a save or from a client (never trust either). */
export function cleanAutoSettings(raw: unknown): AutoSettings {
  const r = (raw ?? {}) as Partial<AutoSettings>;
  const d = DEFAULT_AUTO_SETTINGS;
  const num = (v: unknown, def: number, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(lo, Math.min(hi, v))) : def;
  const sk = (r.skills ?? {}) as Partial<AutoSettings['skills']>;
  // Options the player hasn't picked take the server's defaults (tunable on /admin).
  const auto = currentBalance().auto;
  const ad = auto.defaults;
  const gapSet = r.skillGapSet === true && typeof r.skillGap === 'number' && Number.isFinite(r.skillGap);
  const pick = <T,>(v: unknown, ok: readonly T[], def: T): T => (ok.includes(v as T) ? (v as T) : def);
  const own = AUTO_DEFAULT_KEYS.filter((k) => Array.isArray(r.optsSet) && r.optsSet.includes(k));
  const mine = (k: keyof AutoDefaults) => own.includes(k);
  return {
    // Saves from before `rangeSet` hold 300, the old default, which the player never chose: use today's default.
    // Any other number there was typed by the player, so it stays.
    range: r.rangeSet || (typeof r.range === 'number' && r.range !== OLD_DEFAULT_RANGE)
      ? num(r.range, d.range, AUTO_RANGE_MIN, AUTO_RANGE_MAX)
      : d.range,
    rangeSet: r.rangeSet === true || (typeof r.range === 'number' && r.range !== OLD_DEFAULT_RANGE),
    hpPct: num(r.hpPct, d.hpPct, 0, 100),
    mpPct: num(r.mpPct, d.mpPct, 0, 100),
    skills: { q: sk.q !== false, e: sk.e !== false, r: sk.r !== false },
    order: cleanAutoOrder(r.order),
    loot: r.loot !== false,
    optsSet: own,
    lootOrder: mine('lootOrder') ? pick(r.lootOrder, AUTO_LOOT_ORDERS, ad.lootOrder) : ad.lootOrder,
    othersLoot: mine('othersLoot') && typeof r.othersLoot === 'boolean' ? r.othersLoot : ad.othersLoot,
    noHp: mine('noHp') ? pick(r.noHp, AUTO_OUT_ACTIONS, ad.noHp) : ad.noHp,
    noMp: mine('noMp') ? pick(r.noMp, AUTO_OUT_ACTIONS, ad.noMp) : ad.noMp,
    bagFull: mine('bagFull') ? pick(r.bagFull, AUTO_OUT_ACTIONS, ad.bagFull) : ad.bagFull,
    target: mine('target') ? pick(r.target, AUTO_TARGET_MODES, ad.target) : ad.target,
    skip: cleanAutoSkip(r.skip),
    skillsOnly: mine('skillsOnly') && typeof r.skillsOnly === 'boolean' ? r.skillsOnly : ad.skillsOnly,
    skillGap: gapSet ? Math.round(Math.max(0, Math.min(AUTO_SKILL_GAP_MAX, r.skillGap!)) * 10) / 10 : auto.skillGap,
    skillGapSet: gapSet,
  };
}

/** One item the player sold to the merchant, which they can buy back. `paid` = what the merchant gave. */
export interface BuybackEntry { item: Item; paid: number }
/** The merchant keeps this many sold items per player (newest first). */
export const BUYBACK_MAX = 30;
/** Seconds of play between clears of the buyback list. */
export const BUYBACK_RESET = 30 * 60;
/** Buying back costs this much more than the item sold for. */
export const BUYBACK_MARKUP = 1.2;
export function buybackPrice(e: BuybackEntry): number {
  return Math.ceil(e.paid * BUYBACK_MARKUP);
}

/**
 * Bag or stash slots rearranged by `key`, same length back. Gear is ordered by that key (ties: slot,
 * rarity, level); potions then stones always come after the gear, merged into full stacks. Empty slots go last.
 */
export function sortEntries(list: readonly (BagEntry | null)[], key: SortKey, desc: boolean): (BagEntry | null)[] {
  const items: Item[] = [];
  // Bound stacks (tutorial rewards) are counted apart and never merge with unbound ones ("b" in the key).
  const pots = new Map<string, number>();
  const stones = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  for (const e of list) {
    if (!e) continue;
    if (isPotion(e)) add(pots, `${e.potion}:${e.size}${e.bound ? ':b' : ''}`, e.count);
    else if (isStone(e)) add(stones, `${e.stone}${e.bound ? ':b' : ''}`, e.count);
    else items.push(e);
  }
  const rank = (it: Item): number => {
    switch (key) {
      case 'rarity': return RARITIES.indexOf(it.rarity);
      case 'level': return it.level;
      case 'slot': return SLOTS.indexOf(it.slot);
      case 'value': return sellValue(it);
    }
  };
  const dir = desc ? -1 : 1;
  items.sort((a, b) =>
    dir * (rank(a) - rank(b)) ||
    SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) ||
    RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) ||
    b.level - a.level,
  );
  // Potions: HP before MP, then by size (by price when sorting by sell value).
  const potOrder = (['hp', 'mp'] as const).flatMap((k) => POTION_SIZES.map((s) => [k, s] as const));
  if (key === 'value') potOrder.sort((a, b) => dir * (potionPrice(a[0], a[1]) - potionPrice(b[0], b[1])));
  const stacks: BagEntry[] = [];
  const bound = (b: boolean) => (b ? { bound: true as const } : {});
  for (const [k, s] of potOrder) {
    for (const b of [false, true]) {
      for (let n = pots.get(`${k}:${s}${b ? ':b' : ''}`) ?? 0; n > 0; n -= POTION_STACK) {
        stacks.push({ potion: k, size: s, count: Math.min(n, POTION_STACK), ...bound(b) });
      }
    }
  }
  // Stones last, merged into full stacks too.
  // Orb items (mystery box) come after the fixed kinds, in the order of their numbers.
  const orbs = [...new Set([...stones.keys()].map((k) => k.replace(/:b$/, '')).filter(isOrbStone))].sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  // Monster cards last, in their table order (CARD_DEFAULTS: floor 1 map by map, then floor 2).
  for (const k of [...STONE_KINDS, ...orbs, ...CARD_IDS]) {
    for (const b of [false, true]) {
      for (let n = stones.get(`${k}${b ? ':b' : ''}`) ?? 0; n > 0; n -= stoneStackMax(k)) stacks.push({ stone: k, count: Math.min(n, stoneStackMax(k)), ...bound(b) });
    }
  }
  const all = [...items, ...stacks];
  return Array.from({ length: list.length }, (_, i) => all[i] ?? null);
}

/** Quests read from a save: known bosses only, counts 0..QUEST_KILLS. */
export function cleanQuests(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [boss, n] of Object.entries(raw as Record<string, unknown>)) {
    if (BOSS_QUEST_KEY[boss] && typeof n === 'number' && Number.isFinite(n)) out[boss] = Math.max(0, Math.min(QUEST_KILLS, Math.floor(n)));
  }
  return out;
}

/** Everything about a character that gets saved (browser storage now, the server database later). */
export interface CharacterData {
  name: string;
  classId: ClassId;
  level: number;
  exp: number;
  gold: number;
  equipment: Partial<Record<EquipSlot, Item>>;
  bag: (BagEntry | null)[];
  /**
   * Slots in each bag tab (src/shared/bagTabs.ts): `bag` is the gear tab then the usable tab. Missing in saves
   * from before the tabs (owner 2026-11-23): loading sorts the old bag into the two tabs (normalizeBag).
   */
  bagSlots?: BagSlots;
  /** Missing in saves from before potion sizes existed. */
  potSel?: PotionSelect;
  /** Missing in older saves = pick up everything. */
  lootFilter?: LootFilter;
  /** Missing in older saves = the defaults. */
  autoSettings?: AutoSettings;
  /** Zone id the character is in. Missing on saves from before there were zones (= the forest). */
  zone?: string;
  /** Items sold to the merchant that can be bought back. Missing in older saves = none. */
  buyback?: BuybackEntry[];
  /** Seconds of play left before the buyback list clears. Missing = a full BUYBACK_RESET. */
  buybackLeft?: number;
  /**
   * Gate bosses (BOSS_GATES) this character has killed. Missing in older saves: every gate below the
   * level counts as passed.
   */
  bossKills?: string[];
  /** Ways opened by quests, e.g. floorUnlock(2) = the portal up to floor 2 (src/shared/floors.ts). Missing = none. */
  unlocks?: string[];
  /** The Seeker's key quests taken: boss id → monsters killed so far (see QUEST_KILLS). Missing = none. */
  quests?: Record<string, number>;
  /** The Seeker's gear quests taken (src/shared/gearQuests.ts): quest id → kills so far. Missing = none. */
  gearQuests?: Record<string, number>;
  /** Gear quests handed in. Missing = none. */
  gearDone?: string[];
  /** Cosmetics worn (src/shared/data/cosmetics.ts), kept by the server to what the account owns. Missing = none. */
  cosmetics?: CosWorn;
  /** Buff scrolls running: seconds of play left on each (see BUFF_MAX). Missing = none. */
  buffs?: Buffs;
  /**
   * Skills learned (id → rank) and worn (Q/E/R, passive). Missing in saves from before the skill system (owner
   * 2026-11-14): the character starts with nothing learned and gets its points back from its level.
   */
  skills?: SkillBook;
}

export type Buffs = Partial<Record<BuffScroll, number>>;

/** Whole seconds, without the ones that ran out (for saving and the snapshot). */
export function roundBuffs(b: Buffs): Buffs {
  const out: Buffs = {};
  for (const k of BUFF_SCROLLS) {
    const t = b[k];
    if (t && t > 0) out[k] = Math.ceil(t);
  }
  return out;
}

/** A save's buff timers, kept to known kinds and 0–BUFF_MAX seconds. */
export function cleanBuffs(v: unknown): Buffs {
  const out: Buffs = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of BUFF_SCROLLS) {
    const t = (v as Record<string, unknown>)[k];
    if (typeof t === 'number' && Number.isFinite(t) && t > 0) out[k] = Math.min(t, BUFF_MAX);
  }
  return out;
}

/**
 * Brings every item in a save to the current tier tables (see upgradeItem), in place: worn, bag and
 * buyback. Values never change. Returns the same data.
 */
export function upgradeCharacter(data: CharacterData): CharacterData {
  if (!data || typeof data !== 'object') return data;
  for (const it of Object.values(data.equipment ?? {})) upgradeItem(it);
  for (const e of data.bag ?? []) upgradeItem(e);
  // Floor 1 quest rewards stopped being bound (owner 2026-11-24): old saves lose the mark.
  for (const e of data.bag ?? []) if (e && typeof e === 'object' && 'bound' in e) delete (e as { bound?: true }).bound;
  for (const b of data.buyback ?? []) upgradeItem(b?.item);
  return data;
}

/**
 * Lays a save's bag out in its two tabs, in place (normalizeBag: old saves get sorted into the tabs, nothing is
 * lost), and returns the tab sizes now in `data.bagSlots`. For code that edits a save without a Player (/admin).
 */
export function layOutBag(data: CharacterData): BagSlots {
  const laid = normalizeBag(data.bag, cleanBagSlots(data.bagSlots));
  data.bag = laid.bag;
  data.bagSlots = laid.slots;
  return laid.slots;
}

/** A fresh level 1 character with the class starter weapon and a few potions. */
/**
 * Move speed % a character gets from its items before the cap: worn gear (enhance and rerolled lines included, after
 * the class multiplier) plus item-set bonuses. The status window shows it next to the capped value.
 */
export function itemMoveSpeed(equipment: Partial<Record<EquipSlot, Item | null>>, cls: ClassId): number {
  const b = currentBalance();
  let gear = 0;
  for (const it of Object.values(equipment)) if (it) gear += effectiveStats(it).moveSpeed ?? 0;
  return gear * b.classes[cls].mult.moveSpeed + (setBonusStats(equipment, b.sets).moveSpeed ?? 0);
}

/** The part of `itemMoveSpeed` that counts: at most the /admin cap (`moveCap`, 50% in code). */
export function cappedItemMove(raw: number): number {
  return Math.min(raw, Math.max(0, currentBalance().moveCap));
}

export function newCharacterData(name: string, classId: ClassId): CharacterData {
  return {
    name,
    classId,
    level: 1,
    exp: 0,
    gold: 0,
    equipment: { weapon: starterWeapon(classId) },
    bag: [{ potion: 'hp', size: 's', count: 5 }, { potion: 'mp', size: 's', count: 5 }],
    potSel: { hp: 's', mp: 's' },
  };
}

export class Player extends Unit {
  readonly cls: ClassDef;
  readonly name: string;
  exp: number;
  gold: number;
  mp = 0;
  equipment: Partial<Record<EquipSlot, Item>>;
  bag: (BagEntry | null)[];
  /** Slots in each bag tab (gear first, then usable). Saved. */
  bagSlots: BagSlots;
  potSel: PotionSelect;
  lootFilter: LootFilter;
  autoSettings: AutoSettings;
  /** Sold items the merchant still has for this player, newest first. */
  buyback: BuybackEntry[];
  /** Seconds of play until the buyback list clears. */
  buybackLeft: number;
  /**
   * The account's storage box. Not part of CharacterData: it is saved on its own and shared by every
   * character of the account, so whoever runs the Sim hands the same object to each of them.
   */
  stash: StashData = newStash();
  /** The account's tutorial quests (src/shared/tutorial.ts): like the stash, saved on its own and shared by its characters. */
  tut: TutorialData = { done: [] };
  /** The account's card album (src/shared/cardAlbum.ts): registered cards, shared by its characters, saved by the server on its own. */
  album: CardId[] = [];
  /**
   * Enhancement aura tier (see auraTier): from the highest + item worn. The server works it out;
   * other players' mirrors in the browser have no equipment, so theirs comes from the snapshot.
   */
  aura = 0;
  /**
   * Enhancement orbs (see orbCodes): one per worn item at +7 or higher. Not saved; the server works it
   * out from the gear, and the browser's mirrors take it from the snapshot like `aura`.
   */
  orbs: readonly number[] = [];
  /**
   * The worn weapon's and armour's item kinds as everyone sees them (PlayerSnap wpn / arm): the browser's copy of
   * each player, for the papercraft sword rig's look. Not saved; the server's own players leave it empty.
   */
  seenGear: { wpn?: string; arm?: string } = {};
  /** Cosmetics worn. Saved; the server keeps it to what the account owns, mirrors take it from the snapshot. */
  cosmetics: CosWorn;
  /** Riding the worn mount (MOUNT_SPEED). Never saved. See Sim.toggleMount / Sim.tickMount. */
  mounted = false;
  /** Sim time of getting on: a hit dealt or taken after it throws the rider off. */
  mountedAt = -99;
  stats: Stats = emptyStats();
  /** Seconds of cooldown left, by skill id ('dash' for the dash): kept on the skill, so taking it off and on again doesn't reset it. */
  cd: Record<string, number> = {};
  /**
   * Charges held by skills that keep stacks (Land Mine, see chargeMax); a skill missing here is full. Not saved. While
   * a skill is short of its max, `cd[id]` is the time until the next charge; the gap between two casts is `cd[id + ':gap']`.
   */
  charges: Record<string, number> = {};
  /** Land mines lying on the ground (oldest first); one past the stack count makes the oldest vanish. Not saved. */
  mines: { gone: boolean }[] = [];
  /** Skills learned and worn. Saved; changed only through Sim.learnSkill / refundSkill / wearSkill. */
  skillBook: SkillBook;
  /** Damage multiplier of the Charge running now (set when it is cast, by its rank). */
  chargeMult = 0;
  potCd = 0;
  /** Sim time of the last blacksmith action (enhance or reroll), for forgeCd(). Not saved. */
  forgeAt = -Infinity;
  /** Seconds until the fountain or a campfire can restore this player again (Sim.rest). */
  restCd = 0;
  /** Seconds left on a return-scroll cast (0 = not casting), and where it started (moving away cancels it). */
  castT = 0;
  castX = 0;
  castZ = 0;
  /** Potions still restoring. Several can run at once; a monster hit stops them all. */
  potHeals: PotionHeal[] = [];
  lastHurt = -99;
  /** Seconds until lava burns again. */
  lavaT = 0;
  /** Sim time of the last basic attack or skill (ranged players rarely get hurt, so this counts as combat too). */
  lastAttack = -99;
  moveTarget: Vec2 | null = null;
  /** Gate bosses killed (see BOSS_GATES). Saved. */
  bossKills: string[];
  /** Ways opened by quests (PortalDef.requires). Saved. */
  unlocks: string[];
  /** The Seeker's key quests taken: boss id → monsters killed so far. Saved. */
  quests: Record<string, number>;
  /** The Seeker's gear quests taken: quest id → kills so far. Saved. */
  gearQuests: Record<string, number>;
  /** Gear quests handed in. Saved. */
  gearDone: string[];
  /** Buff scrolls running: seconds of play left on each. Saved; counted down by Sim.tickBuffs. */
  buffs: Buffs;
  /** True while Auto Play runs for this player (set by the server each tick); Sim halves their EXP. Never saved. */
  autoOn = false;
  /** The account's VIP is running (src/shared/vip.ts; set by the server, kept per account, never saved here). */
  vip = false;
  /** Told once per stuck level that a boss gate is holding the EXP bar. Never saved. */
  gateHintedAt = 0;
  /** Shown once per session when low-level monsters start giving less EXP. */
  lowExpHinted = false;
  /** Told once that monsters far above them can't be hit. */
  missHinted = false;
  /** The party this character is in (set by the server, never saved), or null. Shares EXP and loot (Sim). */
  partyId: number | null = null;
  zone: string | undefined;
  /** False right after arriving through a portal, until the player steps away from it. */
  portalReady = true;
  portalMsgAt = -99;
  /** Current velocity, kept for sliding on ice. */
  private slideX = 0;
  private slideZ = 0;
  dashKind: 'dash' | 'charge' = 'dash';
  private atkT = 0;
  private faceLockT = 0;
  private aimX = 0;
  private aimZ = 0;
  dashT = 0;
  /** Standing still to aim (Headshot): no walking, attacking or dashing until it runs out. */
  rootT = 0;
  /** Held by the Bog Witch's mud hand: can still attack and cast, but not walk or dash. */
  snareT = 0;
  /**
   * A ghost siren's song (sim/graveMoves.ts): made to walk to `charmBy` for this long. Attacks and skills still work; a dash
   * or a movement skill breaks it (owner 2026-11-24). Never saved.
   */
  charmT = 0;
  charmBy: { readonly x: number; readonly z: number; readonly alive: boolean } | null = null;
  /**
   * Stopping for a moment on an attack (attackRootTuning.ts): no walking until it runs out, but turning, attacking,
   * casting and dashing (which ends it) still work. A clicked walk carries on afterwards. Never saved.
   */
  atkRootT = 0;
  /** Where the stop began: a reported position (online) is taken only this close to it while stopped. */
  private atkRootX = 0;
  private atkRootZ = 0;
  private atkRootNew = false;
  /** Cursed into a toad by the Bog Witch (also stunned for as long). The client draws a toad instead. */
  toadT = 0;
  /**
   * Seconds left untouchable after getting up with a phoenix feather in a boss room (owner 2026-11-20): no damage
   * and no boss effects, and everyone sees the character blink. Attacking, a skill (buffs too) or a dash ends it;
   * walking and potions don't. In the browser: 1 while the server says so.
   */
  guardT = 0;
  /** Its skill buffs as the server last sent them (client only, sim/debuffs.ts BUFF_BIT). */
  buffBits = 0;
  /** The skill whose buff it got last (server: set by the cast; client: as sent), for its magic circle. '' = none. */
  buffSkill = '';
  /**
   * Skill buffs running, by skill id: when each ends (sim time) and how long it was given (server: set by the cast,
   * see castSkill). The owner sees them as icons under their HP and MP bars (owner 2026-11-19).
   */
  skillBuffs: Record<string, { until: number; total: number }> = {};
  /** Client only: our own skill buffs as the server last sent them (seconds left and given), and when that came. */
  shownBuffs: { id: string; left: number; total: number }[] = [];
  shownBuffsAt = 0;
  /** Share of damage dealt that heals the player, until sim time `lifestealUntil` (sword Q). */
  lifesteal = 0;
  lifestealUntil = -1;
  /**
   * The effects of the cards on worn gear, each capped (cardSockets.ts cardFxTotal), worked out in recompute. Percents.
   * The browser works out its own player's too (same gear, same card tuning), so cooldowns match the server.
   */
  cardFx: CardFxTotals = noCardFx();
  /** Timed stat buffs from skills (Gunslinger Sniper Focus, Quick Reload, Overdrive...), added after the class multipliers. Never saved; death ends them. */
  statBuffs: { id: string; until: number; mods: Partial<Stats> }[] = [];
  /** Gunslinger Rapid Fire line: what the basic shot does while its buffs run. Never saved. */
  gun: GunBuffs = emptyGunBuffs();
  // Timed statuses from skills (shared by every class; not saved, death ends them). Each lasts until its sim time;
  // a recast keeps the stronger value and refreshes the time.
  /** HP points of damage absorbed before HP, until `shieldUntil`. */
  shield = 0;
  /** Sim time before which this player's next mystery box opening is ignored (BOX_OPEN_COOLDOWN; not saved). */
  boxReadyAt = 0;
  shieldUntil = 0;
  /** Damage taken × this until `takenUntil` (e.g. 0.7 = 30% less). */
  takenMult = 1;
  takenUntil = 0;
  /** Damage dealt × this until `dmgUntil`. */
  dmgMult = 1;
  dmgUntil = 0;
  /** Skill cooldowns (not the dash) run (1 + haste)× as fast until `hasteUntil`. */
  haste = 0;
  hasteUntil = 0;
  /** Sword Thorn Armor: this share of damage taken goes back at the attacker until `reflectUntil`. */
  reflect = 0;
  reflectUntil = 0;
  /** Sword Thorn Armor: extra damage points added to each reflected hit (from the caster's DEF). */
  reflectFlat = 0;
  /** Sword Anchor: no stuns or knockback from monsters until this sim time. */
  steadyUntil = 0;
  /** How the hitting dash running now (Charge and the sword's dash skills) knocks back, and whether it taunts. */
  chargeKb = 9;
  chargeTaunt = true;
  private dashVx = 0;
  private dashVz = 0;
  private chargeHit = new Set<Monster>();
  private noMpMsgT = 0;

  constructor(id: number, private readonly sim: Sim, data: CharacterData) {
    super(id);
    upgradeCharacter(data);
    this.cls = CLASSES[data.classId];
    this.name = data.name;
    this.level = data.level;
    this.exp = data.exp;
    this.gold = data.gold;
    this.equipment = { ...data.equipment };
    this.bagSlots = { ...layOutBag(data) };
    this.bag = [...data.bag];
    this.zone = data.zone;
    this.quests = cleanQuests(data.quests);
    this.gearQuests = cleanGearQuests(data.gearQuests);
    this.gearDone = cleanGearDone(data.gearDone);
    this.cosmetics = cleanCosWorn(data.cosmetics);
    this.buffs = cleanBuffs(data.buffs);
    this.skillBook = cleanSkillBook(data.classId, data.skills);
    this.bossKills = [...new Set([...gatesPassedBy(data.level), ...(Array.isArray(data.bossKills) ? data.bossKills.filter((x) => typeof x === 'string') : [])])];
    this.unlocks = cleanUnlocks(data.unlocks);
    this.potSel = { hp: 's', mp: 's', ...data.potSel };
    this.lootFilter = data.lootFilter
      ? { ...data.lootFilter, rarities: [...data.lootFilter.rarities], pots: lootPots(data.lootFilter) }
      : { ...DEFAULT_LOOT_FILTER, rarities: [...RARITIES], pots: lootPots(DEFAULT_LOOT_FILTER) };
    this.autoSettings = cleanAutoSettings(data.autoSettings);
    this.buyback = Array.isArray(data.buyback)
      ? data.buyback.filter((e) => e?.item && typeof e.paid === 'number' && e.paid >= 0).slice(0, BUYBACK_MAX)
      : [];
    const left = data.buybackLeft;
    this.buybackLeft = typeof left === 'number' && left > 0 && left <= BUYBACK_RESET ? left : BUYBACK_RESET;
    this.radius = 0.4;
    this.recompute();
    this.hp = this.maxHp;
    this.mp = this.stats.maxMp;
  }

  /**
   * One frame of walking toward (mx, mz), or none if both are 0. On ice the character keeps its
   * momentum: it takes a moment to turn and slides on after letting go. Returns whether it moved.
   */
  walkStep(mx: number, mz: number, remaining: number, dt: number, terrain: Terrain): boolean {
    const speed = this.moveSpeed;
    if (terrain.onIce(this.x, this.z)) {
      const grip = Math.min(1, ICE_GRIP * dt);
      this.slideX += (mx * speed - this.slideX) * grip;
      this.slideZ += (mz * speed - this.slideZ) * grip;
      if (!mx && !mz && Math.hypot(this.slideX, this.slideZ) < ICE_STOP_SPEED) {
        this.slideX = this.slideZ = 0;
        return false;
      }
      this.x += this.slideX * dt;
      this.z += this.slideZ * dt;
      terrain.resolve(this);
      return true;
    }
    // Walking onto the ice carries this speed with it.
    this.slideX = mx * speed;
    this.slideZ = mz * speed;
    if (!mx && !mz) return false;
    const step = Math.min(speed * dt, remaining);
    const sx = this.x;
    const sz = this.z;
    this.x += mx * step;
    this.z += mz * step;
    terrain.resolve(this);
    // Walked (nearly) head-on into something round, like an NPC or the fountain: go round it
    // instead of stopping dead. Pressed into a corner of two (a wall's notch), stay put.
    if ((this.x - sx) * mx + (this.z - sz) * mz < step * 0.5) {
      const c = terrain.soleContact(this);
      if (c) {
        const ox = sx - c.x;
        const oz = sz - c.z;
        const ol = Math.hypot(ox, oz) || 1;
        let tx = -oz / ol;
        let tz = ox / ol;
        if (tx * mx + tz * mz < 0) {
          tx = -tx;
          tz = -tz;
        }
        this.x = sx + tx * step;
        this.z = sz + tz * step;
        terrain.resolve(this);
      }
    }
    return true;
  }

  get maxHp(): number { return this.stats.maxHp; }
  get topY(): number { return 1.9; }
  get moveSpeed(): number {
    return BASE_MOVE_SPEED * (1 + this.stats.moveSpeed / 100) * this.speedMult() * (this.mounted ? MOUNT_SPEED : 1);
  }
  /** Basic attacks a second: the class's rate as tuned on /admin (owner 2026-11-20) × the attack speed stat. */
  get attackRate(): number { return (currentBalance().skills.basicRate[this.cls.id] ?? this.cls.attackRate) * (1 + this.stats.atkSpeed / 100); }
  get isDashing(): boolean { return this.dashT > 0; }

  /** Angle (radians, world x/z) the player is aiming at right now. */
  aimAngle(): number {
    return Math.atan2(this.aimZ, this.aimX);
  }

  /** The skill on a button: the class's basic attack or dash, or the skill worn on Q/E/R (undefined = empty slot). */
  skill(slot: SkillSlot): SkillDef | undefined {
    if (slot === 'basic' || slot === 'dash') return this.cls.skills.find((s) => s.kind === slot);
    const id = this.skillBook.worn[slot];
    return id ? this.cls.skills.find((s) => s.id === id) : undefined;
  }

  /** Rank of a skill in use (the basic attack and dash count as 1; 0 = not learned). */
  skillRank(sk: SkillDef): number {
    return sk.kind === 'basic' || sk.kind === 'dash' ? 1 : rankOf(this.skillBook, sk.id);
  }

  /** The MP this skill costs at this character's level and the skill's rank (both tuned on the balance tab). */
  skillMp(sk: SkillDef): number {
    return rankedMp(sk, this.cls.id, this.level, Math.max(1, this.skillRank(sk)));
  }

  /**
   * Full cooldown of this skill at its rank, cut by the "ลดคูลดาวน์สกิล %" item stat (owner 2026-11-19: Q/E/R,
   * not the basic attack or the dash; at most the /admin cap).
   */
  /** Most charges this skill holds at its rank (0 = a plain cooldown skill). The mage's Warp gives the dash charges. */
  chargeMax(sk: SkillDef): number {
    if (sk.kind === 'dash') return this.warpOn() ? currentBalance().skills.classPassive.warp.stacks : 0;
    return chargeMax(currentBalance().skills, sk.id, this.skillRank(sk));
  }

  /** The gunslinger's class passive Hit and Run works now: basic attacks never hold the player still (classPassives.ts). */
  hitRunOn(): boolean {
    return classPassiveOn(currentBalance().skills.classPassive, this.cls.id, this.level, 'hitrun');
  }

  /** The mage's class passive Warp works now: the dash appears at its end at once, with charges (classPassives.ts). */
  warpOn(): boolean {
    return classPassiveOn(currentBalance().skills.classPassive, this.cls.id, this.level, 'warp');
  }

  /** The plain dash's full cooldown (the sword's passive may cut it). */
  dashCooldown(): number {
    return (this.skill('dash')?.cooldown ?? 0) * passiveDashCdMult(this);
  }

  /** Charges held right now (only meaningful when chargeMax > 0). */
  chargesOf(sk: SkillDef): number {
    const max = this.chargeMax(sk);
    return Math.min(max, this.charges[sk.id] ?? max);
  }

  /** Whether the skill can be cast as far as its cooldown goes (a charge skill: a charge in hand and the gap passed). */
  skillReady(sk: SkillDef): boolean {
    if (!this.chargeMax(sk)) return (this.cd[sk.id] ?? 0) <= 0;
    return this.chargesOf(sk) > 0 && (this.cd[sk.id + ':gap'] ?? 0) <= 0;
  }

  /** The cast spent a charge (starts the recharge when it was full) and starts the gap. */
  useCharge(sk: SkillDef): void {
    const max = this.chargeMax(sk);
    const dash = sk.kind === 'dash';
    const full = dash ? this.dashCooldown() : this.skillCooldown(sk);
    if (!max) {
      this.cd[sk.id] = full;
      return;
    }
    const had = this.chargesOf(sk);
    this.charges[sk.id] = had - 1;
    if (had >= max || !((this.cd[sk.id] ?? 0) > 0)) this.cd[sk.id] = full;
    this.cd[sk.id + ':gap'] = dash ? currentBalance().skills.classPassive.warp.gap : currentBalance().skills.mineGap;
  }

  /** Runs after the cooldowns tick: a finished recharge gives a charge back and starts the next one while still short. */
  tickCharges(): void {
    for (const sk of this.cls.skills) {
      const dash = sk.kind === 'dash';
      if (!CHARGE_SKILLS.has(sk.id) && !dash) continue;
      const max = this.chargeMax(sk);
      if (!max) {
        // Warp turned off (or the level lowered): the dash is a plain cooldown again.
        if (dash) delete this.charges[sk.id];
        continue;
      }
      let have = this.chargesOf(sk);
      if (have >= max) {
        delete this.charges[sk.id];
        continue;
      }
      if (!((this.cd[sk.id] ?? 0) > 0)) {
        have++;
        this.cd[sk.id] = have < max ? (dash ? this.dashCooldown() : this.skillCooldown(sk)) : 0;
      }
      if (have >= max) delete this.charges[sk.id];
      else this.charges[sk.id] = have;
    }
  }

  skillCooldown(sk: SkillDef): number {
    if (sk.kind === 'basic' || sk.kind === 'dash') return sk.cooldown;
    const cut = Math.min(Math.max(0, this.stats.cdr ?? 0), currentBalance().cdrCap) / 100;
    return Math.round(rankedCooldown(sk, Math.max(1, this.skillRank(sk))) * (1 - cut) * 100) / 100;
  }

  /** How long a buff this player's skill gives lasts: `seconds` × (1 + the "เพิ่มเวลาบัฟ %" item stat). */
  buffTime(seconds: number): number {
    return seconds * (1 + Math.max(0, this.stats.buffDur ?? 0) / 100);
  }

  /** How long this player's summon stays (turret, drone, land mine): buffTime when the buffDurSummons switch is on. */
  summonTime(seconds: number): number {
    return currentBalance().buffDurSummons ? this.buffTime(seconds) : seconds;
  }

  /** Hurt or attacked within the last few seconds (no swapping skills then). */
  inCombat(): boolean {
    return this.sim.time - Math.max(this.lastHurt, this.lastAttack) <= COMBAT_LINGER;
  }

  recompute(): void {
    const s = emptyStats();
    // Class numbers as tuned on the admin page (src/shared/balance.ts; the code's own when untouched).
    const c = classBalance(this.cls.id);
    addInto(s, c.base);
    addInto(s, c.growth, this.level - 1);
    // Move speed from items is capped on its own (itemMoveSpeed below), so take the gear's part back out after the loop.
    const classMove = s.moveSpeed;
    let best = 0;
    for (const it of Object.values(this.equipment)) {
      if (!it) continue;
      addInto(s, effectiveStats(it));
      best = Math.max(best, plusOf(it));
    }
    s.moveSpeed = classMove;
    this.aura = auraTier(best);
    this.orbs = orbCodes(this.equipment);
    // Cards on worn gear (cardSockets.ts), each effect capped on the whole character. Their HP/MP/ATK/DEF % multiply the
    // whole total before the class multipliers: class + level + gear + enhance + item-set bonus (owner 2026-11-26).
    // The set bonus itself still skips the class multipliers, so it gets the card % on its own (see below).
    const fx = cardFxTotal(Object.values(this.equipment));
    this.cardFx = fx;
    const pct = { maxHp: fx.hpPct, maxMp: fx.mpPct, atk: fx.atkPct, def: fx.defPct } as const;
    for (const k of Object.keys(pct) as (keyof typeof pct)[]) s[k] *= 1 + pct[k] / 100;
    // Class multipliers, then the regen cuts (so players lean on potions), gear included.
    finishStats(s, this.cls.id);
    // The cards' cooldown cut and armor pierce add to the item mods of the same name (owner 2026-11-26); the totals keep
    // their own caps (cdrCap in skillCooldown, 100% in Sim.hitMonster).
    s.cdr = (s.cdr ?? 0) + fx.cdr;
    s.armorPen = (s.armorPen ?? 0) + fx.pierce;
    // Item-set bonuses (data/sets.ts): exactly the numbers set in /admin, after the class multipliers, raised by the card %.
    const set = setBonusStats(this.equipment, currentBalance().sets);
    // Move speed from gear + set bonuses together stops at the /admin cap (owner 2026-11-26); class numbers, the
    // passive, skill buffs (below) and the mount (moveSpeed getter) come on top of it.
    delete set.moveSpeed;
    s.moveSpeed += cappedItemMove(itemMoveSpeed(this.equipment, this.cls.id));
    for (const k of Object.keys(pct) as (keyof typeof pct)[]) if (set[k]) set[k] = set[k]! * (1 + pct[k] / 100);
    addInto(s, set);
    // Card album pages completed (cardAlbum.ts): percent of the whole HP / MP / attack / defense.
    const ab = albumBonus(this.album);
    s.maxHp = Math.round(s.maxHp * (1 + ab.hpPct / 100));
    s.maxMp = Math.round(s.maxMp * (1 + ab.mpPct / 100));
    s.atk *= 1 + ab.atkPct / 100;
    s.def *= 1 + ab.defPct / 100;
    // The worn passive and skill buffs, flat in Stats units ("+40% attack speed" is +40 atkSpeed).
    passiveStats(this, s);
    for (const b of this.statBuffs) addInto(s, b.mods);
    // Crit rate tops out at the cap (owner 2026-11-25, /admin "อัตราคริสูงสุด %").
    s.crit = Math.min(s.crit, currentBalance().critCap);
    this.stats = s;
    this.hp = Math.min(this.hp, s.maxHp);
    this.mp = Math.min(this.mp, s.maxMp);
  }

  toData(): CharacterData {
    return {
      name: this.name,
      classId: this.cls.id,
      level: this.level,
      exp: this.exp,
      gold: this.gold,
      equipment: this.equipment,
      bag: this.bag,
      bagSlots: { ...this.bagSlots },
      zone: this.zone,
      potSel: this.potSel,
      lootFilter: this.lootFilter,
      autoSettings: this.autoSettings,
      buyback: this.buyback,
      buybackLeft: Math.round(this.buybackLeft),
      bossKills: this.bossKills,
      unlocks: [...this.unlocks],
      quests: { ...this.quests },
      gearQuests: { ...this.gearQuests },
      gearDone: [...this.gearDone],
      cosmetics: { ...this.cosmetics },
      buffs: roundBuffs(this.buffs),
      skills: structuredClone(this.skillBook),
    };
  }

  // ------------------------------------------------------------ inventory

  /** Puts gear in the first empty slot of the gear tab. */
  addToBag(item: Item): boolean {
    const i = freeSlot(this.bag, this.bagSlots, 'gear');
    if (i < 0) return false;
    this.bag[i] = item;
    return true;
  }

  /** An empty slot in that tab; with no tab, in both (Auto's "bag full" is either tab full, owner 2026-11-23). */
  hasBagSpace(tab?: BagTab): boolean {
    return (tab ? [tab] : BAG_TABS).every((t) => freeSlot(this.bag, this.bagSlots, t) >= 0);
  }

  /** Empty slots in a tab. */
  freeSlots(tab: BagTab): number {
    return freeCount(this.bag, this.bagSlots, tab);
  }

  /** The tab slot `i` is in, or null when it isn't a bag slot. */
  tabAt(i: number): BagTab | null {
    return tabAt(this.bagSlots, i);
  }

  /** Whether the loot filter lets this player pick it up (gold always; a thrown-away item always). */
  wantsLoot(kind: LootKind, dropped: boolean): boolean {
    if (kind.type === 'gold' || dropped) return true;
    if (kind.type === 'potion') return lootPots(this.lootFilter)[kind.pot].includes(kind.size);
    if (kind.type === 'stone') return true;
    return this.lootFilter.rarities.includes(kind.item.rarity);
  }

  /** Whether there is bag room for it right now. */
  canFit(kind: LootKind): boolean {
    if (kind.type === 'gold') return true;
    if (kind.type === 'potion') return this.potionRoom(kind.pot, kind.size) >= kind.count;
    if (kind.type === 'stone') return this.stoneRoom(kind.stone) >= kind.count;
    return this.hasBagSpace('gear');
  }

  /**
   * Why this character can't wear an item (another class's weapon/armor, or level too low), or null if it can.
   * Shown as is in the UI.
   */
  equipBlock(item: Item): string | null {
    const c = itemClass(item);
    if (c && c !== this.cls.id) return `ใส่ได้เฉพาะสาย ${CLASSES[c].name}`;
    if (item.level > this.level) return `ต้อง Lv.${item.level} ถึงจะใส่ได้ (ตอนนี้ Lv.${this.level})`;
    return null;
  }

  canEquip(item: Item): boolean {
    return !this.equipBlock(item);
  }

  /** Where clicking this item wears it: the first free place, or the first place when all are taken. */
  equipPlace(item: Item): EquipSlot {
    const places = wornPlaces(item.slot);
    return places.find((s) => !this.equipment[s]) ?? places[0];
  }

  /**
   * Clicking gear wears it; clicking a potion makes its quick key use that size.
   * Gear of another class or above the character's level stays in the bag (gear already worn from older saves is left on).
   */
  equipFromBag(i: number, place?: unknown): void {
    const item = this.bag[i];
    if (!item) return;
    if (isPotion(item)) {
      this.potSel[item.potion] = item.size;
      return;
    }
    if (isStone(item) || !this.canEquip(item)) return;
    // `place` comes from the client: only a place this kind of item can go is taken.
    if (place !== undefined && !wornPlaces(item.slot).includes(place as EquipSlot)) return;
    const to = (place as EquipSlot | undefined) ?? this.equipPlace(item);
    this.bag[i] = this.equipment[to] ?? null;
    this.equipment[to] = item;
    this.recompute();
  }

  /**
   * Drag & drop inside the bag: moves slot `from` onto slot `to`.
   * The same potion (kind and size) or stone merges up to a full stack; anything else swaps places.
   */
  moveInBag(from: number, to: number): void {
    if (from === to) return;
    const a = this.bag[from];
    const b = this.bag[to];
    if (!a) return;
    // Each tab keeps its own kind: nothing lands in (or is swapped into) the other tab.
    if (this.tabAt(to) !== tabOf(a) || (b && this.tabAt(from) !== tabOf(b))) return;
    if (isStack(a) && isStack(b) && sameStack(a, b) && b.count < stackLimit(b)) {
      const n = Math.min(a.count, stackLimit(b) - b.count);
      b.count += n;
      a.count -= n;
      if (a.count <= 0) this.bag[from] = null;
      return;
    }
    this.bag[from] = b ?? null;
    this.bag[to] = a;
  }

  unequip(slot: EquipSlot): void {
    const item = this.equipment[slot];
    if (!item || !this.addToBag(item)) return;
    delete this.equipment[slot];
    this.recompute();
  }

  /** Only the merchant (Sim.sellItem) calls this — items can't be sold from the bag anywhere else. */
  sell(i: number, n?: number): number {
    const item = this.bag[i];
    if (!item) return 0;
    if (n !== undefined && isStack(item) && n >= 1 && n < item.count) {
      // Only part of a stack: the rest stays in the slot.
      const v = anyStackValue({ ...item, count: n });
      item.count -= n;
      this.gold += v;
      return v;
    }
    const v = isStack(item) ? anyStackValue(item) : sellValue(item);
    this.bag[i] = null;
    this.gold += v;
    if (!isStack(item)) this.rememberSold(item, v);
    return v;
  }

  /**
   * Puts a sold item at the top of the buyback list. Past BUYBACK_MAX the oldest one goes,
   * but enhanced (+N) items are kept as long as there is a plain item to drop instead.
   */
  private rememberSold(item: Item, paid: number): void {
    this.buyback.unshift({ item, paid });
    while (this.buyback.length > BUYBACK_MAX) {
      let drop = -1;
      for (let k = this.buyback.length - 1; k >= 0; k--) {
        if (!(this.buyback[k].item.plus ?? 0)) {
          drop = k;
          break;
        }
      }
      this.buyback.splice(drop >= 0 ? drop : this.buyback.length - 1, 1);
    }
  }

  /** Takes an item out of the bag so it can be thrown on the ground. */
  takeFromBag(i: number): BagEntry | null {
    const item = this.bag[i];
    this.bag[i] = null;
    return item;
  }

  // ------------------------------------------------------------ potions

  /** Bottles of this kind (and size, if given) in the bag. */
  potionCount(kind: PotionKind, size?: PotionSize): number {
    let n = 0;
    for (const e of this.bag) if (isPotion(e) && e.potion === kind && (!size || e.size === size)) n += e.count;
    return n;
  }

  /** How many more of these potions fit: room left in matching stacks plus empty slots. */
  potionRoom(kind: PotionKind, size: PotionSize): number {
    let n = this.freeSlots('use') * POTION_STACK;
    for (const e of this.bag) if (isPotion(e) && !e.bound && e.potion === kind && e.size === size) n += Math.max(0, POTION_STACK - e.count);
    return n;
  }

  /** Adds all `n` potions (topping up stacks first), or nothing if they don't all fit. */
  addPotions(kind: PotionKind, size: PotionSize, n: number): boolean {
    if (n <= 0 || this.potionRoom(kind, size) < n) return false;
    for (const e of this.bag) {
      if (n <= 0) break;
      if (isPotion(e) && !e.bound && e.potion === kind && e.size === size && e.count < POTION_STACK) {
        const add = Math.min(n, POTION_STACK - e.count);
        e.count += add;
        n -= add;
      }
    }
    const [ua, ub] = tabRange(this.bagSlots, 'use');
    for (let i = ua; i < ub && n > 0; i++) {
      if (this.bag[i]) continue;
      const add = Math.min(n, POTION_STACK);
      this.bag[i] = { potion: kind, size, count: add };
      n -= add;
    }
    return true;
  }

  /** Removes one bottle, from the emptiest stack so full stacks stay full. */
  private takePotion(kind: PotionKind, size: PotionSize): boolean {
    let at = -1;
    let least = Infinity;
    this.bag.forEach((e, i) => {
      if (isPotion(e) && e.potion === kind && e.size === size && e.count < least) {
        least = e.count;
        at = i;
      }
    });
    const e = this.bag[at];
    if (!isPotion(e)) return false;
    if (--e.count <= 0) this.bag[at] = null;
    return true;
  }

  // ------------------------------------------------------------ stones

  /** Stones of this kind in the bag. */
  stoneCount(kind: StoneKind): number {
    let n = 0;
    for (const e of this.bag) if (isStone(e) && e.stone === kind) n += e.count;
    return n;
  }

  /** How many more of these stones fit: room left in matching stacks plus empty slots. */
  stoneRoom(kind: StoneKind): number {
    let n = this.freeSlots('use') * stoneStackMax(kind);
    for (const e of this.bag) if (isStone(e) && !e.bound && e.stone === kind) n += Math.max(0, stoneStackMax(kind) - e.count);
    return n;
  }

  /** Adds all `n` stones (topping up stacks first), or nothing if they don't all fit. */
  addStones(kind: StoneKind, n: number): boolean {
    if (n <= 0 || this.stoneRoom(kind) < n) return false;
    for (const e of this.bag) {
      if (n <= 0) break;
      if (isStone(e) && !e.bound && e.stone === kind && e.count < stoneStackMax(kind)) {
        const add = Math.min(n, stoneStackMax(kind) - e.count);
        e.count += add;
        n -= add;
      }
    }
    const [ua, ub] = tabRange(this.bagSlots, 'use');
    for (let i = ua; i < ub && n > 0; i++) {
      if (this.bag[i]) continue;
      const add = Math.min(n, stoneStackMax(kind));
      this.bag[i] = { stone: kind, count: add };
      n -= add;
    }
    return true;
  }

  /** Removes `n` stones (emptiest stacks first), or nothing if there aren't enough. */
  takeStones(kind: StoneKind, n: number): boolean {
    if (n <= 0) return true;
    if (this.stoneCount(kind) < n) return false;
    while (n > 0) {
      let at = -1;
      let least = Infinity;
      this.bag.forEach((e, i) => {
        if (isStone(e) && e.stone === kind && e.count < least) {
          least = e.count;
          at = i;
        }
      });
      const e = this.bag[at];
      if (!isStone(e)) return false;
      const take = Math.min(n, e.count);
      e.count -= take;
      n -= take;
      if (e.count <= 0) this.bag[at] = null;
    }
    return true;
  }

  /** The size the quick key drinks: the chosen one, or the smallest left once that runs out. */
  potionToUse(kind: PotionKind): PotionSize | null {
    if (this.potionCount(kind, this.potSel[kind]) > 0) return this.potSel[kind];
    return POTION_SIZES.find((s) => this.potionCount(kind, s) > 0) ?? null;
  }

  // ------------------------------------------------------------ sorting

  /** Rearranges the bag by `key` (see sortEntries). */
  sortBag(key: SortKey, desc: boolean): void {
    // Each tab on its own, so the tabs never mix.
    this.bag = BAG_TABS.flatMap((t) => sortEntries(this.bag.slice(...tabRange(this.bagSlots, t)), key, desc));
  }

  /**
   * Adds `n` empty slots to a tab (the slot purchase, Sim.bagExpand). Growing the gear tab moves every usable
   * slot up by `n`, so callers refuse it while something points at bag slots (an open trade).
   */
  growTab(tab: BagTab, n: number): void {
    if (tab === 'gear') this.bag.splice(this.bagSlots.gear, 0, ...Array<null>(n).fill(null));
    else this.bag.push(...Array<null>(n).fill(null));
    this.bagSlots[tab] += n;
  }

  // ------------------------------------------------------------ actions

  /**
   * Warp (mage class passive, owner 2026-11-27): the dash, but gone from here and standing at its end at once. The end
   * is found by walking the dash's path in short steps against the terrain (as a dash slides along walls), so it never
   * passes through a wall, a prop, a whirlpool or the map's edge. Same short invulnerability as a dash.
   */
  warpDash(dx: number, dz: number): void {
    const l = Math.hypot(dx, dz) || 1;
    const ux = dx / l;
    const uz = dz / l;
    const fromX = this.x;
    const fromZ = this.z;
    const u = { x: this.x, z: this.z, radius: this.radius };
    const steps = Math.ceil(DASH_DIST / WARP_STEP);
    for (let i = 0; i < steps; i++) {
      u.x += (ux * DASH_DIST) / steps;
      u.z += (uz * DASH_DIST) / steps;
      this.sim.terrain.resolve(u);
    }
    this.x = u.x;
    this.z = u.z;
    this.charmT = 0;
    this.charmBy = null;
    this.invulnT = DASH_TIME + 0.05;
    this.moveTarget = null;
    this.atkRootT = 0;
    this.kbx = this.kbz = 0;
    this.face(dx, dz);
    this.sim.fx('warp', fromX, fromZ, this.x, this.z, this.id);
    this.sim.sfx('warp', this.x, this.z);
    // The browser jumps there instead of gliding, and its older positions are refused (server/world.ts epoch).
    this.sim.markWarped(this);
    passiveOnDash(this);
  }

  startDash(dx: number, dz: number, dist: number, time: number, kind: 'dash' | 'charge'): void {
    const l = Math.hypot(dx, dz) || 1;
    this.dashVx = (dx / l) * (dist / time);
    this.dashVz = (dz / l) * (dist / time);
    this.dashT = time;
    this.invulnT = time + 0.05;
    this.dashKind = kind;
    this.chargeHit.clear();
    this.moveTarget = null;
    this.atkRootT = 0;
    this.face(dx, dz);
    this.sim.anim(this.id, 'dash', { duration: time + 0.12 });
    passiveOnDash(this);
  }

  /** Starts (or restarts) a timed stat buff from a skill: the same id replaces the one running. */
  addStatBuff(id: string, seconds: number, mods: Partial<Stats>): void {
    this.statBuffs = this.statBuffs.filter((b) => b.id !== id);
    this.statBuffs.push({ id, until: this.sim.time + seconds, mods });
    this.recompute();
  }

  /** Damage taken × `mult` for `seconds` (the stronger of this and one running wins; the later end wins). */
  addTakenMult(mult: number, seconds: number): void {
    const t = this.sim.time;
    this.takenMult = t < this.takenUntil ? Math.min(this.takenMult, mult) : mult;
    this.takenUntil = Math.max(this.takenUntil, t + seconds);
  }

  /** Damage dealt × `mult` for `seconds` (the stronger of this and one running wins; the later end wins). */
  addDmgMult(mult: number, seconds: number): void {
    const t = this.sim.time;
    this.dmgMult = t < this.dmgUntil ? Math.max(this.dmgMult, mult) : mult;
    this.dmgUntil = Math.max(this.dmgUntil, t + seconds);
  }

  /** Sim time now (for timed statuses and passives). */
  simTime(): number {
    return this.sim.time;
  }

  /** Living monsters within `r` of this player (passives such as the sword's Duelist). */
  /** Plays a skill effect drawing at (x, z) for everyone nearby (passives that show when they kick in). */
  effectAt(name: SkillEffect, x: number, z: number, angle: number, size: number): void {
    this.sim.fx('effect', name, x, z, angle, size);
  }

  monstersNear(r: number): number {
    let n = 0;
    for (const m of this.sim.monsters) if (m.alive && Math.hypot(m.x - this.x, m.z - this.z) <= r + m.radius) n++;
    return n;
  }

  /** Ends every skill buff and timed status (death). */
  clearSkillBuffs(): void {
    this.gun = emptyGunBuffs();
    this.shield = 0;
    this.shieldUntil = this.takenUntil = this.dmgUntil = this.hasteUntil = this.reflectUntil = this.steadyUntil = 0;
    this.skillBuffs = {};
    if (this.statBuffs.length) {
      this.statBuffs = [];
      this.recompute();
    }
  }

  /** This player landed a killing blow: skills with a killCdCut number (sword Charge) come back sooner. */
  onKill(m: Monster): void {
    passiveOnKill(this, m);
    for (const sk of this.cls.skills) {
      const left = this.cd[sk.id] ?? 0;
      const cut = sk.params?.killCdCut ? skillParam(sk, 'killCdCut') / 100 : 0;
      if (cut && left > 0) this.cd[sk.id] = left * (1 - cut);
    }
  }

  /** Starts (or lengthens) the stop on an attack: `skillId` null = the basic attack. */
  private startAttackRoot(skillId: string | null): void {
    // Hit and Run (gunslinger class passive): the basic attack walks on.
    if (skillId === null && this.hitRunOn()) return;
    const t = attackRootTime(currentBalance().attackRoot, this.cls.id, skillId, this.attackAnimDuration());
    if (t <= 0) return;
    if (this.atkRootT <= 0) this.atkRootNew = true;
    this.atkRootT = Math.max(this.atkRootT, t);
  }

  attackAnimDuration(): number {
    return Math.min(0.5, 0.95 / this.attackRate);
  }

  private usePotion(kind: PotionKind): void {
    if (this.potCd > 0) return;
    const sim = this.sim;
    const size = this.potionToUse(kind);
    if (!size || !this.takePotion(kind, size)) {
      return sim.text(this.x, this.topY, this.z, `ไม่มียา ${kind.toUpperCase()}`, 'info', undefined, this.id);
    }
    sim.inventoryChanged(this);
    sim.sfx('drink', this.x, this.z, this.id);
    // The cards' "ยาฟื้นเพิ่ม %" on top of the class's potion bonus (card plan 5.1).
    const amount = Math.round(potionHeal(kind, size, this.cls.id) * (1 + this.cardFx.potion / 100));
    this.potHeals.push({ kind, perSec: amount / POTION_TIME, left: POTION_TIME });
    if (kind === 'hp') {
      sim.text(this.x, this.topY, this.z, `+${amount}`, 'heal');
      sim.fx('burst', this.x, 1, this.z, '#ff6a6a', 8, 2);
    } else {
      sim.text(this.x, this.topY, this.z, `+${amount} MP`, 'mana');
      sim.fx('burst', this.x, 1, this.z, '#6aa0ff', 8, 2);
    }
    this.potCd = POTION_CD;
  }

  /** HP or MP the potions being drunk will still restore. */
  potionPending(kind: PotionKind): number {
    let n = 0;
    for (const h of this.potHeals) if (h.kind === kind) n += h.perSec * h.left;
    return n;
  }

  /** A monster hit spills the potions still being drunk. */
  interruptPotions(): void {
    if (!this.potHeals.length) return;
    this.potHeals = [];
    this.sim.text(this.x, this.topY + 0.4, this.z, 'ยาหยุดเติม', 'info', 0.8, this.id);
  }

  private tickPotions(dt: number): void {
    for (const h of this.potHeals) {
      const step = h.perSec * Math.min(dt, h.left);
      h.left -= dt;
      if (h.kind === 'hp') this.hp = Math.min(this.maxHp, this.hp + step);
      else this.mp = Math.min(this.stats.maxMp, this.mp + step);
    }
    this.potHeals = this.potHeals.filter((h) => h.left > 0);
  }

  update(dt: number, it: Intent): void {
    const sim = this.sim;
    this.moving = false;
    if (!this.alive) {
      this.potHeals = [];
      this.charmT = 0;
      this.charmBy = null;
      return;
    }
    this.tickStatus(dt, sim.terrain);
    if (this.statBuffs.some((b) => b.until <= sim.time)) {
      this.statBuffs = this.statBuffs.filter((b) => b.until > sim.time);
      this.recompute();
    }
    const cdStep = sim.time < this.hasteUntil ? dt * (1 + this.haste) : dt;
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - (k === 'dash' ? dt : cdStep));
    this.tickCharges();
    this.atkT -= dt;
    this.potCd -= dt;
    this.restCd -= dt;
    this.faceLockT -= dt;
    this.rootT = Math.max(0, this.rootT - dt);
    this.snareT = Math.max(0, this.snareT - dt);
    this.charmT = Math.max(0, this.charmT - dt);
    if (this.charmT <= 0 || !this.charmBy?.alive) this.charmBy = null;
    this.toadT = Math.max(0, this.toadT - dt);
    this.guardT = Math.max(0, this.guardT - dt);
    this.atkRootT = Math.max(0, this.atkRootT - dt);

    const ooc = this.inCombat() ? 1 : OUT_OF_COMBAT_REGEN;
    this.hp = Math.min(this.maxHp, this.hp + this.stats.hpRegen * ooc * dt);
    this.mp = Math.min(this.stats.maxMp, this.mp + this.stats.mpRegen * ooc * dt);
    this.tickPotions(dt);

    if (it.potion) this.usePotion(it.potion);

    if (this.stunT > 0) return;

    if (this.rootT > 0) {
      this.moving = false;
      this.moveTarget = null;
      return;
    }

    if (this.dashT > 0) {
      // Dashing breaks a siren's song.
      this.charmT = 0;
      this.charmBy = null;
      this.dashT -= dt;
      this.x += this.dashVx * dt;
      this.z += this.dashVz * dt;
      sim.terrain.resolve(this);
      if (this.dashKind === 'charge') {
        for (const m of sim.monsters) {
          if (!m.alive || this.chargeHit.has(m)) continue;
          if (Math.hypot(m.x - this.x, m.z - this.z) < m.radius + 1.2) {
            this.chargeHit.add(m);
            sim.hitMonster(this, m, this.chargeMult, { kb: this.chargeKb, fromX: this.x, fromZ: this.z });
            // Charge: whatever it runs into turns on this player (the other hitting dashes don't).
            if (this.chargeTaunt) m.taunt(this);
          }
        }
      }
      this.moving = true;
      return;
    }

    const aim = it.aim;
    this.aimX = aim.x - this.x;
    this.aimZ = aim.z - this.z;
    // Stopped by an earlier attack (one started this tick still lets this tick's step through, as the browser does).
    const rooted = this.atkRootT > 0;

    // Movement intent first so Dash uses the current walk direction.
    if (it.move || it.pos) this.moveTarget = null;
    if (it.moveTo && !it.pos) this.moveTarget = { ...it.moveTo };
    let mx = 0;
    let mz = 0;
    let remaining = Infinity;
    if (it.move) {
      mx = it.move.x;
      mz = it.move.z;
    } else if (this.moveTarget) {
      const dx = this.moveTarget.x - this.x;
      const dz = this.moveTarget.z - this.z;
      remaining = Math.hypot(dx, dz);
      if (remaining < 0.15) this.moveTarget = null;
      else {
        mx = dx / remaining;
        mz = dz / remaining;
      }
    }

    // Held in the mud: no walking and no dash (attacks and skills still work).
    const snared = this.snareT > 0;
    if (snared) {
      mx = 0;
      mz = 0;
      this.moveTarget = null;
    }
    // A siren's song: walking to her whatever the player asks (a dash below breaks it).
    const charm = !snared && this.charmBy ? this.charmBy : null;
    if (charm) {
      const cdx = charm.x - this.x;
      const cdz = charm.z - this.z;
      const cd = Math.hypot(cdx, cdz);
      this.moveTarget = null;
      remaining = Infinity;
      if (cd > 1) {
        mx = cdx / cd;
        mz = cdz / cd;
      } else mx = mz = 0;
    }

    const dashSkill = this.skill('dash')!;
    const warp = this.warpOn();
    if (it.dash && !snared && (warp ? this.skillReady(dashSkill) : (this.cd.dash ?? 0) <= 0)) {
      const [dx, dz] = mx || mz ? [mx, mz] : [this.aimX, this.aimZ];
      if (warp) {
        this.warpDash(dx, dz);
        this.useCharge(dashSkill);
        this.guardT = 0;
        return;
      }
      this.startDash(dx, dz, DASH_DIST, DASH_TIME, 'dash');
      quarksCue(sim, this, 'dash', Math.atan2(dz, dx));
      this.cd.dash = dashSkill.cooldown * passiveDashCdMult(this);
      this.guardT = 0;
      return;
    }

    // No fighting in town; the dash above still works there.
    const peaceful = sim.inSafe(this);
    for (const slot of peaceful ? [] : it.skills) {
      const sk = this.skill(slot);
      if (!sk || !this.skillReady(sk)) continue;
      const cost = this.skillMp(sk);
      if (this.mp < cost) {
        if (sim.time > this.noMpMsgT) {
          sim.text(this.x, this.topY, this.z, 'MP ไม่พอ', 'mana', undefined, this.id);
          this.noMpMsgT = sim.time + 1;
        }
        continue;
      }
      this.face(this.aimX, this.aimZ);
      if (castSkill(sim, this, sk, aim, Math.max(1, this.skillRank(sk)))) {
        // A dedicated skill animation wins over the dash animation a movement skill just started;
        // without one the attack animation plays (unless the skill is a dash).
        // A skill that starts by aiming (Headshot) gets no attack fallback: its shot animates when it fires.
        // The skill's own class animation (skill_q/e/r), whichever slot it sits in.
        sim.anim(this.id, `skill_${sk.anim ?? slot}`, this.rootT > 0 ? { skill: sk.id } : { duration: this.attackAnimDuration(), fallback: 'attack', skill: sk.id });
        this.mp -= cost;
        this.useCharge(sk);
        this.guardT = 0;
        this.lastAttack = sim.time;
        passiveOnCast(this, sk);
        this.faceLockT = 0.3;
        // Movement skills and buffs don't stop the player, nor do ones that already stand them still (Headshot...).
        if (this.dashT <= 0 && this.rootT <= 0 && !skipsAttackRoot(currentBalance().skills, sk.id)) this.startAttackRoot(sk.id);
      }
      if (this.dashT > 0 || this.rootT > 0) return;
    }

    if (it.basic && this.atkT <= 0 && !peaceful) {
      this.atkT = 1 / this.attackRate;
      this.lastAttack = sim.time;
      this.guardT = 0;
      basicAttack(sim, this, aim);
      this.face(this.aimX, this.aimZ);
      sim.anim(this.id, 'attack', { duration: this.attackAnimDuration() });
      this.faceLockT = 0.25;
      this.startAttackRoot(null);
    }

    let moving = mx !== 0 || mz !== 0;
    // Stopped: a reported position counts only near where the stop began (the browser stops too, a moment earlier).
    const posOk = !!it.pos && !snared && !charm && (!rooted || Math.hypot(it.pos.x - this.atkRootX, it.pos.z - this.atkRootZ) <= ATTACK_ROOT_SLACK);
    if (rooted && !posOk) {
      moving = false;
    } else if (it.pos && posOk) {
      // Online: the client already walked here (the server checked the distance).
      const dx = it.pos.x - this.x;
      const dz = it.pos.z - this.z;
      const d = Math.hypot(dx, dz);
      this.x = it.pos.x;
      this.z = it.pos.z;
      sim.terrain.resolve(this);
      moving = d > 0.002;
      if (moving) {
        mx = dx / d;
        mz = dz / d;
      }
    } else {
      moving = this.walkStep(mx, mz, remaining, dt, sim.terrain);
    }
    // The kraken's whirlpool pulls (sim/kraken.ts). A position from the browser already has it (the browser walks the pull too).
    if (!(it.pos && posOk) && sim.hazards.length) suctionStep(this, sim.hazards, sim.time, dt, sim.terrain);
    if (this.atkRootNew) {
      this.atkRootNew = false;
      this.atkRootX = this.x;
      this.atkRootZ = this.z;
    }
    if (this.faceLockT > 0 || this.atkRootT > 0) this.face(this.aimX, this.aimZ);
    else if (moving) this.face(mx, mz);
    this.moving = moving;
  }
}
