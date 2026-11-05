import { Unit } from './Unit';
import type { Sim } from './Sim';
import type { Monster } from './Monster';
import type { Intent } from './types';
import { castSkill, basicAttack } from './skills';
import { CLASSES, type ClassDef, type SkillDef, type SkillSlot } from '../data/classes';
import { addInto, BASE_MOVE_SPEED, emptyStats } from '../formulas';
import { effectiveStats, sellValue } from '../data/enhance';
import { itemClass, starterWeapon } from '../data/items';
import { POTIONS, POTION_SIZES, POTION_STACK, stackSellValue } from '../data/potions';
import {
  isPotion, RARITIES, SLOTS,
  type BagEntry, type ClassId, type Item, type PotionKind, type PotionSize, type Rarity, type SlotId, type Stats, type Vec2,
} from '../types';
import type { LootKind } from './Loot';

/** Share of the HP regen stat that actually applies (owner: -60%). */
export const HP_REGEN_MULT = 0.4;
/** Same for MP regen (owner: -75%, so skills lean on MP potions). */
export const MP_REGEN_MULT = 0.25;
/** Seconds after the last hit taken, attack or skill before out-of-combat regen kicks in. */
export const COMBAT_LINGER = 5;
/** Regen multiplier while out of combat. */
export const OUT_OF_COMBAT_REGEN = 2.5;

export const BAG_SIZE = 30;
export const POTION_CD = 1.5;

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

/** Everything about a character that gets saved (browser storage now, the server database later). */
export interface CharacterData {
  name: string;
  classId: ClassId;
  level: number;
  exp: number;
  gold: number;
  equipment: Partial<Record<SlotId, Item>>;
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
  equipment: Partial<Record<SlotId, Item>>;
  bag: (BagEntry | null)[];
  potSel: PotionSelect;
  lootFilter: LootFilter;
  autoSettings: AutoSettings;
  /** Sold items the merchant still has for this player, newest first. */
  buyback: BuybackEntry[];
  /** Seconds of play until the buyback list clears. */
  buybackLeft: number;
  stats: Stats = emptyStats();
  cd: Partial<Record<SkillSlot, number>> = {};
  potCd = 0;
  lastHurt = -99;
  /** Sim time of the last basic attack or skill (ranged players rarely get hurt, so this counts as combat too). */
  lastAttack = -99;
  moveTarget: Vec2 | null = null;
  /** Shown once per session when low-level monsters start giving less EXP. */
  lowExpHinted = false;
  zone: string | undefined;
  /** False right after arriving through a portal, until the player steps away from it. */
  portalReady = true;
  portalMsgAt = -99;
  dashKind: 'dash' | 'charge' = 'dash';
  private atkT = 0;
  private faceLockT = 0;
  private aimX = 0;
  private aimZ = 0;
  dashT = 0;
  private dashVx = 0;
  private dashVz = 0;
  private chargeHit = new Set<Monster>();
  private noMpMsgT = 0;

  constructor(id: number, private readonly sim: Sim, data: CharacterData) {
    super(id);
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

  get maxHp(): number { return this.stats.maxHp; }
  get topY(): number { return 1.9; }
  get moveSpeed(): number { return BASE_MOVE_SPEED * (1 + this.stats.moveSpeed / 100) * this.speedMult(); }
  get attackRate(): number { return this.cls.attackRate * (1 + this.stats.atkSpeed / 100); }
  get isDashing(): boolean { return this.dashT > 0; }

  skill(slot: SkillSlot): SkillDef | undefined {
    return this.cls.skills.find((s) => s.slot === slot);
  }

  recompute(): void {
    const s = emptyStats();
    addInto(s, this.cls.base);
    addInto(s, this.cls.growth, this.level - 1);
    for (const it of Object.values(this.equipment)) if (it) addInto(s, effectiveStats(it));
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
    return this.lootFilter.rarities.includes(kind.item.rarity);
  }

  /** Whether there is bag room for it right now. */
  canFit(kind: LootKind): boolean {
    if (kind.type === 'gold') return true;
    if (kind.type === 'potion') return this.potionRoom(kind.pot, kind.size) >= kind.count;
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

  /**
   * Clicking gear wears it; clicking a potion makes its quick key use that size.
   * Gear of another class or above the character's level stays in the bag (gear already worn from older saves is left on).
   */
  equipFromBag(i: number): void {
    const item = this.bag[i];
    if (!item) return;
    if (isPotion(item)) {
      this.potSel[item.potion] = item.size;
      return;
    }
    if (!this.canEquip(item)) return;
    this.bag[i] = this.equipment[item.slot] ?? null;
    this.equipment[item.slot] = item;
    this.recompute();
  }

  /**
   * Drag & drop inside the bag: moves slot `from` onto slot `to`.
   * The same potion (kind and size) merges up to a full stack; anything else swaps places.
   */
  moveInBag(from: number, to: number): void {
    if (from === to) return;
    const a = this.bag[from];
    const b = this.bag[to];
    if (!a) return;
    if (isPotion(a) && isPotion(b) && a.potion === b.potion && a.size === b.size && b.count < POTION_STACK) {
      const n = Math.min(a.count, POTION_STACK - b.count);
      b.count += n;
      a.count -= n;
      if (a.count <= 0) this.bag[from] = null;
      return;
    }
    this.bag[from] = b ?? null;
    this.bag[to] = a;
  }

  unequip(slot: SlotId): void {
    const item = this.equipment[slot];
    if (!item || !this.addToBag(item)) return;
    delete this.equipment[slot];
    this.recompute();
  }

  /** Only the merchant (Sim.sellItem) calls this — items can't be sold from the bag anywhere else. */
  sell(i: number): number {
    const item = this.bag[i];
    if (!item) return 0;
    const v = isPotion(item) ? stackSellValue(item) : sellValue(item);
    this.bag[i] = null;
    this.gold += v;
    if (!isPotion(item)) this.rememberSold(item, v);
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

  /** The size the quick key drinks: the chosen one, or the smallest left once that runs out. */
  potionToUse(kind: PotionKind): PotionSize | null {
    if (this.potionCount(kind, this.potSel[kind]) > 0) return this.potSel[kind];
    return POTION_SIZES.find((s) => this.potionCount(kind, s) > 0) ?? null;
  }

  // ------------------------------------------------------------ sorting

  /**
   * Rearranges the bag by `key`. Gear is ordered by that key (ties: slot, rarity, level);
   * potions always come after the gear, merged into full stacks. Empty slots go last.
   */
  sortBag(key: SortKey, desc: boolean): void {
    const items: Item[] = [];
    const pots = new Map<string, number>();
    for (const e of this.bag) {
      if (!e) continue;
      if (isPotion(e)) pots.set(`${e.potion}:${e.size}`, (pots.get(`${e.potion}:${e.size}`) ?? 0) + e.count);
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
    const all = [...items, ...stacks];
    this.bag = Array.from({ length: BAG_SIZE }, (_, i) => all[i] ?? null);
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
    const amount = POTIONS[kind][size].amount;
    if (kind === 'hp') {
      this.hp = Math.min(this.maxHp, this.hp + amount);
      sim.text(this.x, this.topY, this.z, `+${amount}`, 'heal');
      sim.fx('burst', this.x, 1, this.z, '#ff6a6a', 8, 2);
    } else {
      this.mp = Math.min(this.stats.maxMp, this.mp + amount);
      sim.text(this.x, this.topY, this.z, `+${amount} MP`, 'mana');
      sim.fx('burst', this.x, 1, this.z, '#6aa0ff', 8, 2);
    }
    this.potCd = POTION_CD;
  }

  update(dt: number, it: Intent): void {
    const sim = this.sim;
    this.moving = false;
    if (!this.alive) return;
    this.tickStatus(dt, sim.terrain);
    for (const k of Object.keys(this.cd) as SkillSlot[]) this.cd[k] = Math.max(0, (this.cd[k] ?? 0) - dt);
    this.atkT -= dt;
    this.potCd -= dt;
    this.faceLockT -= dt;

    const inCombat = sim.time - Math.max(this.lastHurt, this.lastAttack) <= COMBAT_LINGER;
    const ooc = inCombat ? 1 : OUT_OF_COMBAT_REGEN;
    this.hp = Math.min(this.maxHp, this.hp + this.stats.hpRegen * ooc * dt);
    this.mp = Math.min(this.stats.maxMp, this.mp + this.stats.mpRegen * ooc * dt);

    if (it.potion) this.usePotion(it.potion);

    if (this.stunT > 0) return;

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

    for (const slot of it.skills) {
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
        sim.anim(this.id, `skill_${slot}`, { duration: this.attackAnimDuration(), fallback: 'attack' });
        this.mp -= sk.mp;
        this.cd[slot] = sk.cooldown;
        this.lastAttack = sim.time;
        this.faceLockT = 0.3;
      }
      if (this.dashT > 0) return;
    }

    if (it.basic && this.atkT <= 0) {
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
    } else if (moving) {
      const step = Math.min(this.moveSpeed * dt, remaining);
      this.x += mx * step;
      this.z += mz * step;
      sim.terrain.resolve(this);
    }
    if (this.faceLockT > 0) this.face(this.aimX, this.aimZ);
    else if (moving) this.face(mx, mz);
    this.moving = moving;
  }
}
