import { Unit } from './Unit';
import type { Sim } from './Sim';
import type { Monster } from './Monster';
import type { Terrain } from './terrain';
import type { Intent } from './types';
import { castSkill, basicAttack } from './skills';
import { CLASSES, type ClassDef, type SkillDef, type SkillSlot } from '../data/classes';
import { addInto, BASE_MOVE_SPEED, emptyStats } from '../formulas';
import { auraTier, effectiveStats, plusOf, sellValue } from '../data/enhance';
import { itemClass, starterWeapon, upgradeItem } from '../data/items';
import { anyStackValue, potionHeal, POTIONS, POTION_SIZES, POTION_STACK, stackLimit } from '../data/potions';
import { STONE_STACK } from '../data/stones';
import {
  isPotion, isStack, isStone, RARITIES, sameStack, SLOTS, STONE_KINDS, wornPlaces,
  type BagEntry, type EquipSlot, type StoneKind, type ClassId, type Item, type PotionKind, type PotionSize, type Rarity, type SlotId, type Stats, type Vec2,
} from '../types';
import type { LootKind } from './Loot';
import { newStash, type StashData } from './stash';

/** Share of the HP regen stat that actually applies (owner: -60%). */
export const HP_REGEN_MULT = 0.4;
/** Same for MP regen (owner: -75%, so skills lean on MP potions). */
export const MP_REGEN_MULT = 0.25;
/** Seconds after the last hit taken, attack or skill before out-of-combat regen kicks in. */
export const COMBAT_LINGER = 5;
/** Regen multiplier while out of combat. */
export const OUT_OF_COMBAT_REGEN = 2.5;

/** How quickly a character on ice gets to the speed it wants, per second. Lower is slipperier. */
const ICE_GRIP = 1.5;
/** A slide slower than this stops. */
const ICE_STOP_SPEED = 0.25;

export const BAG_SIZE = 30;
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
  skills: Record<'q' | 'e' | 'r', boolean>;
  loot: boolean;
}
export const AUTO_PX_PER_UNIT = 50;
export const AUTO_RANGE_MIN = 100;
export const AUTO_RANGE_MAX = 2000;
/** The default before it became the maximum. */
const OLD_DEFAULT_RANGE = 300;
export const DEFAULT_AUTO_SETTINGS: AutoSettings = {
  range: 750, hpPct: 45, mpPct: 15, skills: { q: true, e: true, r: true }, loot: true,
};

/** Fill in and clamp settings from a save or from a client (never trust either). */
export function cleanAutoSettings(raw: unknown): AutoSettings {
  const r = (raw ?? {}) as Partial<AutoSettings>;
  const d = DEFAULT_AUTO_SETTINGS;
  const num = (v: unknown, def: number, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(lo, Math.min(hi, v))) : def;
  const sk = (r.skills ?? {}) as Partial<AutoSettings['skills']>;
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
    loot: r.loot !== false,
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
  const pots = new Map<string, number>();
  const stones = new Map<StoneKind, number>();
  for (const e of list) {
    if (!e) continue;
    if (isPotion(e)) pots.set(`${e.potion}:${e.size}`, (pots.get(`${e.potion}:${e.size}`) ?? 0) + e.count);
    else if (isStone(e)) stones.set(e.stone, (stones.get(e.stone) ?? 0) + e.count);
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
  if (key === 'value') potOrder.sort((a, b) => dir * (POTIONS[a[0]][a[1]].price - POTIONS[b[0]][b[1]].price));
  const stacks: BagEntry[] = [];
  for (const [k, s] of potOrder) {
    for (let n = pots.get(`${k}:${s}`) ?? 0; n > 0; n -= POTION_STACK) {
      stacks.push({ potion: k, size: s, count: Math.min(n, POTION_STACK) });
    }
  }
  // Stones last, merged into full stacks too.
  for (const k of STONE_KINDS) {
    for (let n = stones.get(k) ?? 0; n > 0; n -= STONE_STACK) stacks.push({ stone: k, count: Math.min(n, STONE_STACK) });
  }
  const all = [...items, ...stacks];
  return Array.from({ length: list.length }, (_, i) => all[i] ?? null);
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
}

/**
 * Brings every item in a save to the current tier tables (see upgradeItem), in place: worn, bag and
 * buyback. Values never change. Returns the same data.
 */
export function upgradeCharacter(data: CharacterData): CharacterData {
  if (!data || typeof data !== 'object') return data;
  for (const it of Object.values(data.equipment ?? {})) upgradeItem(it);
  for (const e of data.bag ?? []) upgradeItem(e);
  for (const b of data.buyback ?? []) upgradeItem(b?.item);
  return data;
}

/** A fresh level 1 character with the class starter weapon and a few potions. */
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
  /**
   * Enhancement aura tier (see auraTier): from the highest + item worn. The server works it out;
   * other players' mirrors in the browser have no equipment, so theirs comes from the snapshot.
   */
  aura = 0;
  stats: Stats = emptyStats();
  cd: Partial<Record<SkillSlot, number>> = {};
  potCd = 0;
  /** Potions still restoring. Several can run at once; a monster hit stops them all. */
  potHeals: PotionHeal[] = [];
  lastHurt = -99;
  /** Seconds until lava burns again. */
  lavaT = 0;
  /** Sim time of the last basic attack or skill (ranged players rarely get hurt, so this counts as combat too). */
  lastAttack = -99;
  moveTarget: Vec2 | null = null;
  /** Shown once per session when low-level monsters start giving less EXP. */
  lowExpHinted = false;
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
    this.bag = Array.from({ length: BAG_SIZE }, (_, i) => data.bag[i] ?? null);
    this.zone = data.zone;
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
    this.x += mx * step;
    this.z += mz * step;
    terrain.resolve(this);
    return true;
  }

  get maxHp(): number { return this.stats.maxHp; }
  get topY(): number { return 1.9; }
  get moveSpeed(): number { return BASE_MOVE_SPEED * (1 + this.stats.moveSpeed / 100) * this.speedMult(); }
  get attackRate(): number { return this.cls.attackRate * (1 + this.stats.atkSpeed / 100); }
  get isDashing(): boolean { return this.dashT > 0; }

  /** Angle (radians, world x/z) the player is aiming at right now. */
  aimAngle(): number {
    return Math.atan2(this.aimZ, this.aimX);
  }

  skill(slot: SkillSlot): SkillDef | undefined {
    return this.cls.skills.find((s) => s.slot === slot);
  }

  recompute(): void {
    const s = emptyStats();
    addInto(s, this.cls.base);
    addInto(s, this.cls.growth, this.level - 1);
    let best = 0;
    for (const it of Object.values(this.equipment)) {
      if (!it) continue;
      addInto(s, effectiveStats(it));
      best = Math.max(best, plusOf(it));
    }
    this.aura = auraTier(best);
    // Regen is cut so players lean on potions; applied last so gear is cut too.
    s.hpRegen *= HP_REGEN_MULT;
    s.mpRegen *= MP_REGEN_MULT;
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
      zone: this.zone,
      potSel: this.potSel,
      lootFilter: this.lootFilter,
      autoSettings: this.autoSettings,
      buyback: this.buyback,
      buybackLeft: Math.round(this.buybackLeft),
    };
  }

  // ------------------------------------------------------------ inventory

  addToBag(item: Item): boolean {
    const i = this.bag.indexOf(null);
    if (i < 0) return false;
    this.bag[i] = item;
    return true;
  }

  hasBagSpace(): boolean {
    return this.bag.includes(null);
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
    return this.hasBagSpace();
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
  sell(i: number): number {
    const item = this.bag[i];
    if (!item) return 0;
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
    let n = 0;
    for (const e of this.bag) {
      if (!e) n += POTION_STACK;
      else if (isPotion(e) && e.potion === kind && e.size === size) n += POTION_STACK - e.count;
    }
    return n;
  }

  /** Adds all `n` potions (topping up stacks first), or nothing if they don't all fit. */
  addPotions(kind: PotionKind, size: PotionSize, n: number): boolean {
    if (n <= 0 || this.potionRoom(kind, size) < n) return false;
    for (const e of this.bag) {
      if (n <= 0) break;
      if (isPotion(e) && e.potion === kind && e.size === size && e.count < POTION_STACK) {
        const add = Math.min(n, POTION_STACK - e.count);
        e.count += add;
        n -= add;
      }
    }
    for (let i = 0; i < this.bag.length && n > 0; i++) {
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
    let n = 0;
    for (const e of this.bag) {
      if (!e) n += STONE_STACK;
      else if (isStone(e) && e.stone === kind) n += STONE_STACK - e.count;
    }
    return n;
  }

  /** Adds all `n` stones (topping up stacks first), or nothing if they don't all fit. */
  addStones(kind: StoneKind, n: number): boolean {
    if (n <= 0 || this.stoneRoom(kind) < n) return false;
    for (const e of this.bag) {
      if (n <= 0) break;
      if (isStone(e) && e.stone === kind && e.count < STONE_STACK) {
        const add = Math.min(n, STONE_STACK - e.count);
        e.count += add;
        n -= add;
      }
    }
    for (let i = 0; i < this.bag.length && n > 0; i++) {
      if (this.bag[i]) continue;
      const add = Math.min(n, STONE_STACK);
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
    this.bag = sortEntries(this.bag, key, desc);
  }

  // ------------------------------------------------------------ actions

  startDash(dx: number, dz: number, dist: number, time: number, kind: 'dash' | 'charge'): void {
    const l = Math.hypot(dx, dz) || 1;
    this.dashVx = (dx / l) * (dist / time);
    this.dashVz = (dz / l) * (dist / time);
    this.dashT = time;
    this.invulnT = time + 0.05;
    this.dashKind = kind;
    this.chargeHit.clear();
    this.moveTarget = null;
    this.face(dx, dz);
    this.sim.anim(this.id, 'dash', { duration: time + 0.12 });
  }

  /** This player landed a killing blow: skills with killCdCut (sword Charge) come back sooner. */
  onKill(): void {
    for (const sk of this.cls.skills) {
      const left = this.cd[sk.slot] ?? 0;
      if (sk.killCdCut && left > 0) this.cd[sk.slot] = left * (1 - sk.killCdCut);
    }
  }

  private attackAnimDuration(): number {
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
    const amount = potionHeal(kind, size, this.cls.id);
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
      return;
    }
    this.tickStatus(dt, sim.terrain);
    for (const k of Object.keys(this.cd) as SkillSlot[]) this.cd[k] = Math.max(0, (this.cd[k] ?? 0) - dt);
    this.atkT -= dt;
    this.potCd -= dt;
    this.faceLockT -= dt;
    this.rootT = Math.max(0, this.rootT - dt);

    const inCombat = sim.time - Math.max(this.lastHurt, this.lastAttack) <= COMBAT_LINGER;
    const ooc = inCombat ? 1 : OUT_OF_COMBAT_REGEN;
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
      this.dashT -= dt;
      this.x += this.dashVx * dt;
      this.z += this.dashVz * dt;
      sim.terrain.resolve(this);
      if (this.dashKind === 'charge') {
        for (const m of sim.monsters) {
          if (!m.alive || this.chargeHit.has(m)) continue;
          if (Math.hypot(m.x - this.x, m.z - this.z) < m.radius + 1.2) {
            this.chargeHit.add(m);
            sim.hitMonster(this, m, 1.5, { kb: 9, fromX: this.x, fromZ: this.z });
            // Hidden on purpose (not in the skill text): whatever it runs into turns on this player.
            m.taunt(this);
          }
        }
      }
      this.moving = true;
      return;
    }

    const aim = it.aim;
    this.aimX = aim.x - this.x;
    this.aimZ = aim.z - this.z;

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

    if (it.dash && (this.cd.dash ?? 0) <= 0) {
      const dashSkill = this.skill('dash')!;
      const [dx, dz] = mx || mz ? [mx, mz] : [this.aimX, this.aimZ];
      this.startDash(dx, dz, 4.8, 0.18, 'dash');
      this.cd.dash = dashSkill.cooldown;
      return;
    }

    // No fighting in town; the dash above still works there.
    const peaceful = sim.inSafe(this);
    for (const slot of peaceful ? [] : it.skills) {
      const sk = this.skill(slot);
      if (!sk || (this.cd[slot] ?? 0) > 0) continue;
      if (this.mp < sk.mp) {
        if (sim.time > this.noMpMsgT) {
          sim.text(this.x, this.topY, this.z, 'MP ไม่พอ', 'mana', undefined, this.id);
          this.noMpMsgT = sim.time + 1;
        }
        continue;
      }
      this.face(this.aimX, this.aimZ);
      if (castSkill(sim, this, sk, aim)) {
        // A dedicated skill animation wins over the dash animation a movement skill just started;
        // without one the attack animation plays (unless the skill is a dash).
        // A skill that starts by aiming (Headshot) gets no attack fallback: its shot animates when it fires.
        sim.anim(this.id, `skill_${slot}`, this.rootT > 0 ? {} : { duration: this.attackAnimDuration(), fallback: 'attack' });
        this.mp -= sk.mp;
        this.cd[slot] = sk.cooldown;
        this.lastAttack = sim.time;
        this.faceLockT = 0.3;
      }
      if (this.dashT > 0 || this.rootT > 0) return;
    }

    if (it.basic && this.atkT <= 0 && !peaceful) {
      this.atkT = 1 / this.attackRate;
      this.lastAttack = sim.time;
      basicAttack(sim, this, aim);
      this.face(this.aimX, this.aimZ);
      sim.anim(this.id, 'attack', { duration: this.attackAnimDuration() });
      this.faceLockT = 0.25;
    }

    let moving = mx !== 0 || mz !== 0;
    if (it.pos) {
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
    if (this.faceLockT > 0) this.face(this.aimX, this.aimZ);
    else if (moving) this.face(mx, mz);
    this.moving = moving;
  }
}
