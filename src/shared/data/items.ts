import {
  RARITIES, type ClassId, type EquipSlot, type Item, type Rarity, type SlotId, type StatKey, type StatLine, type Stats, type StatTier,
} from '../types';
import { mulberry32, pick, type Rng } from '../rng';

interface BaseItem {
  id: string;
  slot: SlotId;
  names: Partial<Record<ClassId | 'any', string>>;
  main: Partial<Stats>;
  minLevel: number;
}

const BASES: BaseItem[] = [
  { id: 'weapon_1', slot: 'weapon', names: { sword: 'Short Sword', mage: 'Oak Staff', gunslinger: 'Flintlock' }, main: { atk: 4 }, minLevel: 1 },
  { id: 'weapon_2', slot: 'weapon', names: { sword: 'Iron Blade', mage: 'Crystal Rod', gunslinger: 'Revolver' }, main: { atk: 7 }, minLevel: 5 },
  { id: 'weapon_3', slot: 'weapon', names: { sword: 'Knight Sword', mage: 'Arcane Staff', gunslinger: 'Rune Pistol' }, main: { atk: 10 }, minLevel: 9 },
  { id: 'cap', slot: 'helmet', names: { any: 'Leather Cap' }, main: { def: 2 }, minLevel: 1 },
  { id: 'helm', slot: 'helmet', names: { any: 'Iron Helm' }, main: { def: 4, maxHp: 8 }, minLevel: 6 },
  { id: 'tunic', slot: 'armor', names: { sword: 'Padded Tunic', mage: 'Cloth Robe', gunslinger: 'Duster Coat' }, main: { def: 3, maxHp: 10 }, minLevel: 1 },
  { id: 'leather', slot: 'armor', names: { sword: 'Leather Armor', mage: 'Silk Robe', gunslinger: 'Reinforced Coat' }, main: { def: 6, maxHp: 18 }, minLevel: 5 },
  { id: 'sandals', slot: 'boots', names: { any: 'Sandals' }, main: { def: 1, moveSpeed: 3 }, minLevel: 1 },
  { id: 'boots', slot: 'boots', names: { any: 'Leather Boots' }, main: { def: 3, moveSpeed: 5 }, minLevel: 5 },
  { id: 'ring_copper', slot: 'ring', names: { any: 'Copper Ring' }, main: {}, minLevel: 1 },
  { id: 'ring_jade', slot: 'ring', names: { any: 'Jade Ring' }, main: { maxHp: 10 }, minLevel: 6 },
  // Misty Marsh tier
  { id: 'weapon_4', slot: 'weapon', names: { sword: 'Bogsteel Saber', mage: 'Willow Wand', gunslinger: 'Marsh Repeater' }, main: { atk: 14 }, minLevel: 13 },
  { id: 'weapon_5', slot: 'weapon', names: { sword: 'Witchbane Blade', mage: 'Lantern Staff', gunslinger: 'Wisplight Pistol' }, main: { atk: 18 }, minLevel: 18 },
  { id: 'hood', slot: 'helmet', names: { any: 'Mossweave Hood' }, main: { def: 6, maxHp: 14 }, minLevel: 12 },
  { id: 'scale', slot: 'armor', names: { sword: 'Serpent Scale Mail', mage: 'Fen Robe', gunslinger: 'Oilskin Coat' }, main: { def: 10, maxHp: 30 }, minLevel: 14 },
  { id: 'waders', slot: 'boots', names: { any: 'Marsh Waders' }, main: { def: 5, moveSpeed: 6 }, minLevel: 12 },
  { id: 'ring_wisp', slot: 'ring', names: { any: 'Wisp Ring' }, main: { maxHp: 18 }, minLevel: 16 },
  // Frost Reach tier
  { id: 'weapon_6', slot: 'weapon', names: { sword: 'Frostbite Saber', mage: 'Icicle Wand', gunslinger: 'Glacier Repeater' }, main: { atk: 22 }, minLevel: 23 },
  { id: 'weapon_7', slot: 'weapon', names: { sword: 'Yeti Cleaver', mage: 'Aurora Staff', gunslinger: 'Permafrost Pistol' }, main: { atk: 26 }, minLevel: 28 },
  { id: 'frost_hood', slot: 'helmet', names: { any: 'Frostfur Hood' }, main: { def: 8, maxHp: 20 }, minLevel: 22 },
  { id: 'glacier', slot: 'armor', names: { sword: 'Glacier Plate', mage: 'Snowweave Robe', gunslinger: 'Fur-lined Coat' }, main: { def: 14, maxHp: 44 }, minLevel: 24 },
  { id: 'snowtreads', slot: 'boots', names: { any: 'Snowtread Boots' }, main: { def: 7, moveSpeed: 7 }, minLevel: 22 },
  { id: 'ring_frost', slot: 'ring', names: { any: 'Frost Ring' }, main: { maxHp: 26 }, minLevel: 26 },
  // Ashen Isle tier
  { id: 'weapon_8', slot: 'weapon', names: { sword: 'Cinder Saber', mage: 'Ember Wand', gunslinger: 'Magma Repeater' }, main: { atk: 30 }, minLevel: 33 },
  { id: 'weapon_9', slot: 'weapon', names: { sword: 'Volcanic Greatblade', mage: 'Heartflame Staff', gunslinger: 'Eruption Pistol' }, main: { atk: 34 }, minLevel: 38 },
  { id: 'ash_hood', slot: 'helmet', names: { any: 'Ashweave Hood' }, main: { def: 10, maxHp: 26 }, minLevel: 32 },
  { id: 'magma_plate', slot: 'armor', names: { sword: 'Magma Plate', mage: 'Cinderweave Robe', gunslinger: 'Soot-black Coat' }, main: { def: 18, maxHp: 58 }, minLevel: 34 },
  { id: 'cinder_boots', slot: 'boots', names: { any: 'Cinderstep Boots' }, main: { def: 9, moveSpeed: 8 }, minLevel: 32 },
  { id: 'ring_ember', slot: 'ring', names: { any: 'Ember Ring' }, main: { maxHp: 34 }, minLevel: 36 },
  { id: 'necklace_4', slot: 'necklace', names: { any: 'Magma Amulet' }, main: { maxMp: 15, crit: 2 }, minLevel: 35 },
  { id: 'gloves_4', slot: 'gloves', names: { any: 'Cinderhide Gauntlets' }, main: { atk: 5.5, atkSpeed: 2 }, minLevel: 32 },
  { id: 'belt_4', slot: 'belt', names: { any: 'Obsidian Girdle' }, main: { maxHp: 21, def: 4 }, minLevel: 32 },
  { id: 'scabbard_4', slot: 'offhand', names: { sword: 'Ember Scabbard' }, main: { def: 6.5, hpRegen: 0.9 }, minLevel: 34 },
  { id: 'orb_4', slot: 'offhand', names: { mage: 'Magma Orb' }, main: { atk: 4, mpRegen: 0.9 }, minLevel: 34 },
  { id: 'pouch_4', slot: 'offhand', names: { gunslinger: 'Cinder Ammo Case' }, main: { atk: 3, critDmg: 5 }, minLevel: 34 },
  // Necklaces, gloves and belts: one per map.
  { id: 'necklace_1', slot: 'necklace', names: { any: 'Bead Necklace' }, main: { maxMp: 6, crit: 0.5 }, minLevel: 4 },
  { id: 'necklace_2', slot: 'necklace', names: { any: 'Wisp Pendant' }, main: { maxMp: 9, crit: 1 }, minLevel: 15 },
  { id: 'necklace_3', slot: 'necklace', names: { any: 'Frost Amulet' }, main: { maxMp: 12, crit: 1.5 }, minLevel: 25 },
  { id: 'gloves_1', slot: 'gloves', names: { any: 'Leather Gloves' }, main: { atk: 1, atkSpeed: 0.5 }, minLevel: 2 },
  { id: 'gloves_2', slot: 'gloves', names: { any: 'Mossweave Gloves' }, main: { atk: 2.5, atkSpeed: 1 }, minLevel: 12 },
  { id: 'gloves_3', slot: 'gloves', names: { any: 'Frostfur Gauntlets' }, main: { atk: 4, atkSpeed: 1.5 }, minLevel: 22 },
  { id: 'belt_1', slot: 'belt', names: { any: 'Rope Belt' }, main: { maxHp: 6, def: 1 }, minLevel: 2 },
  { id: 'belt_2', slot: 'belt', names: { any: 'Serpent Belt' }, main: { maxHp: 11, def: 2 }, minLevel: 12 },
  { id: 'belt_3', slot: 'belt', names: { any: 'Glacier Girdle' }, main: { maxHp: 16, def: 3 }, minLevel: 22 },
  // Off-hands differ per class in stats too, so each is its own kind that only its class rolls.
  { id: 'scabbard_1', slot: 'offhand', names: { sword: 'Worn Scabbard' }, main: { def: 2, hpRegen: 0.3 }, minLevel: 3 },
  { id: 'scabbard_2', slot: 'offhand', names: { sword: 'Bogsteel Scabbard' }, main: { def: 3.5, hpRegen: 0.5 }, minLevel: 14 },
  { id: 'scabbard_3', slot: 'offhand', names: { sword: 'Frostbound Scabbard' }, main: { def: 5, hpRegen: 0.7 }, minLevel: 24 },
  { id: 'orb_1', slot: 'offhand', names: { mage: 'Glass Orb' }, main: { atk: 1, mpRegen: 0.3 }, minLevel: 3 },
  { id: 'tome_2', slot: 'offhand', names: { mage: 'Swamp Grimoire' }, main: { atk: 2, mpRegen: 0.5 }, minLevel: 14 },
  { id: 'orb_3', slot: 'offhand', names: { mage: 'Aurora Orb' }, main: { atk: 3, mpRegen: 0.7 }, minLevel: 24 },
  { id: 'pouch_1', slot: 'offhand', names: { gunslinger: 'Bullet Pouch' }, main: { atk: 0.5, critDmg: 2 }, minLevel: 3 },
  { id: 'pouch_2', slot: 'offhand', names: { gunslinger: 'Oilskin Ammo Pouch' }, main: { atk: 1, critDmg: 3 }, minLevel: 14 },
  { id: 'pouch_3', slot: 'offhand', names: { gunslinger: 'Glacier Ammo Case' }, main: { atk: 2, critDmg: 4 }, minLevel: 24 },
];

/** The class an item of this kind belongs to: `cls` if the kind has a version for it, else its only class. */
function ownerClass(base: BaseItem, cls: ClassId): ClassId {
  return base.names[cls] ? cls : (Object.keys(base.names)[0] as ClassId);
}

/** Names of every item's picture. Items named per class have one picture per class. */
export const ITEM_ART: string[] = BASES.flatMap((b) =>
  b.names.any ? [`item_${b.id}`] : Object.keys(b.names).map((cls) => `item_${b.id}_${cls}`),
);

/**
 * The picture for an item. An item doesn't record which class it dropped for, but its name does, so
 * everyone sees the same picture for it. An unknown base falls back to the first item of that slot.
 */
export function itemArt(item: Item): string {
  const base = BASES.find((b) => b.id === item.baseId) ?? BASES.find((b) => b.slot === item.slot)!;
  if (base.names.any) return `item_${base.id}`;
  const entries = Object.entries(base.names);
  const cls = entries.find(([, name]) => item.name.endsWith(name!)) ?? entries[0];
  return `item_${base.id}_${cls[0]}`;
}

/**
 * The class an item is made for, or null when every class can wear it (helmets, boots, rings).
 * Items from before `cls` existed are matched by their name, like itemArt does.
 */
export function itemClass(item: Item): ClassId | null {
  if (item.cls) return item.cls;
  const base = BASES.find((b) => b.id === item.baseId);
  if (!base || base.names.any) return null;
  const hit = (Object.entries(base.names) as [ClassId, string][]).find(([, name]) => item.name.endsWith(name));
  return hit ? hit[0] : null;
}

/** The picture of a slot's first item, as this class sees it. */
export function starterArt(worn: EquipSlot, cls: ClassId): string {
  const slot = worn === 'ring2' ? 'ring' : worn;
  const base = BASES.find((b) => b.slot === slot && (b.names.any || b.names[cls]))!;
  return base.names.any ? `item_${base.id}` : `item_${base.id}_${cls}`;
}

const AFFIXES: { stat: StatKey; min: number; max: number; per: number }[] = [
  { stat: 'atk', min: 1, max: 3, per: 0.5 },
  { stat: 'def', min: 1, max: 3, per: 0.4 },
  { stat: 'maxHp', min: 5, max: 15, per: 3 },
  { stat: 'maxMp', min: 4, max: 10, per: 2 },
  { stat: 'crit', min: 1, max: 4, per: 0.1 },
  { stat: 'critDmg', min: 5, max: 15, per: 0.5 },
  { stat: 'atkSpeed', min: 3, max: 8, per: 0.2 },
  { stat: 'moveSpeed', min: 2, max: 6, per: 0.1 },
  { stat: 'hpRegen', min: 0.5, max: 1.5, per: 0.1 },
  { stat: 'mpRegen', min: 0.5, max: 1.5, per: 0.1 },
];

/** Extra stats rolled from rarity are this part of the AFFIXES table (owner 2026-11-08: damage stats halved). */
const EXTRA_SCALE: Partial<Record<StatKey, number>> = { atk: 0.5, atkSpeed: 0.5, crit: 0.5, critDmg: 0.5 };

/**
 * A locked line some kinds of item always have, right after their own stats (owner 2026-11-08: weapons get
 * crit, so a legendary weapon has 6 lines like the other slots). It counts as a main line (the stat stone
 * never changes it) but rolls in the AFFIXES range without EXTRA_SCALE.
 */
const LOCKED_LINE: Partial<Record<SlotId, StatKey>> = { weapon: 'crit' };

/**
 * Tier ranges as parts of a line's whole range (0 = its lowest roll, 1 = its highest), T1 first.
 * Owner 2026-11-07: T1–T3 a quarter each, T4 15%, T5 the bottom 10%.
 */
const TIER_BAND: readonly (readonly [number, number])[] = [[0.75, 1], [0.5, 0.75], [0.25, 0.5], [0.1, 0.25], [0, 0.1]];
/** A line's lowest roll is this part of its highest (owner: medium spread, T5 starts at 40% of T1's top). */
const RANGE_FLOOR = 0.4;
/** Chance of tier 1 (best) … tier 5. */
const TIER_WEIGHT = [3, 9, 18, 30, 40];
/**
 * Where an average roll lands in its range (0 = lowest, 1 = highest) with TIER_WEIGHT and TIER_BAND.
 * Ranges are placed so that this point is the stat's old average, so items stay as strong as before on
 * average (owner's choice).
 */
const MEAN_POS = TIER_BAND.reduce((s, [a, b], i) => s + TIER_WEIGHT[i] * (a + b) / 2, 0)
  / TIER_WEIGHT.reduce((a, b) => a + b, 0);
/** Edges between tiers as parts of the range, lowest first (T5 starts at 0, T1 ends at 1). */
const TIER_EDGES = [0, ...TIER_BAND.map(([, b]) => b).reverse()];

/** Lines' min–max follow the current tier tables (TIER_BAND, RANGE_FLOOR). Older items are upgraded on load. */
export const TIER_VERSION = 3;

/** A line's whole range (lo = lowest roll, hi = highest) whose average roll (MEAN_POS) is `mean`. */
function rangeAround(mean: number): [number, number] {
  const hi = mean / (RANGE_FLOOR + MEAN_POS * (1 - RANGE_FLOOR));
  return [RANGE_FLOOR * hi, hi];
}

/** boost > 0 makes the better tiers likelier (bosses use ~1.5). */
export function rollTier(r: Rng, boost = 0): StatTier {
  const w = TIER_WEIGHT.map((x, i) => x * (1 + boost * (TIER_WEIGHT.length - 1 - i)));
  let roll = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    roll -= w[i];
    if (roll <= 0) return (i + 1) as StatTier;
  }
  return 5;
}

/** Stats stored with one decimal (regen and the % stats); the rest are whole numbers. */
const DECIMAL: ReadonlySet<StatKey> = new Set<StatKey>(['hpRegen', 'mpRegen', 'crit', 'critDmg', 'atkSpeed', 'moveSpeed']);

/** The smallest step a stat's value moves in (0.1 for decimal stats, else 1). */
export const statStep = (k: StatKey): number => (DECIMAL.has(k) ? 0.1 : 1);

/** One tier's range in stored values (both ends included). */
export interface TierRange { tier: StatTier; min: number; max: number }

/**
 * The five tier ranges of a line whose whole range is lo–hi, T1 first, as stored values: next to each
 * other with no gap or overlap, each at least one step wide (small numbers push the higher tiers up).
 */
export function tierRanges(stat: StatKey, lo: number, hi: number): TierRange[] {
  const step = statStep(stat);
  const units = (v: number) => Math.round(v / step);
  const value = (u: number) => (step === 1 ? u : u / 10);
  const out: TierRange[] = [];
  let from = Math.max(1, units(lo));
  for (let i = 0; i < 5; i++) {
    const to = Math.max(from, units(lo + TIER_EDGES[i + 1] * (hi - lo)));
    out.unshift({ tier: (5 - i) as StatTier, min: value(from), max: value(to) });
    from = to + 1;
  }
  return out;
}

/** The tier range a value falls in: above T1 counts as T1, below T5 as T5. */
export function tierOf(stat: StatKey, value: number, lo: number, hi: number): TierRange {
  const t = tierRanges(stat, lo, hi);
  return t.find((x) => value >= x.min - 1e-9) ?? t[4];
}

/** A value inside a tier range, any step equally likely. */
function rollIn(stat: StatKey, t: TierRange, r: Rng): number {
  const step = statStep(stat);
  const n = Math.round((t.max - t.min) / step);
  return fmt(stat, t.min + Math.min(n, Math.floor(r() * (n + 1))) * step);
}

/** A line of this tier: its value inside the tier's range, which the line keeps as min–max. */
function lineOfTier(stat: StatKey, tier: StatTier, lo: number, hi: number, r: Rng): StatLine {
  const t = tierRanges(stat, lo, hi)[tier - 1];
  return { stat, value: rollIn(stat, t, r), tier, min: t.min, max: t.max };
}

/** Rolls one stat in lo–hi: first its tier, then a value inside that tier's range. */
function rollLine(stat: StatKey, lo: number, hi: number, r: Rng, boost = 0): StatLine {
  return lineOfTier(stat, rollTier(r, boost), lo, hi, r);
}

const RARITY_WEIGHT = [62, 24, 10, 3.4, 0.6];
const RARITY_MULT: Record<Rarity, number> = { common: 1, uncommon: 1.15, rare: 1.3, epic: 1.5, legendary: 1.8 };
const AFFIX_COUNT: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const PREFIX: Partial<Record<Rarity, string[]>> = {
  epic: ['Verdant', 'Wild', 'Sylvan'],
  legendary: ['Emerald', 'Primordial', 'Cosmic'],
};

let uidCounter = 0;
export function newUid(): string {
  return Date.now().toString(36) + (uidCounter++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function fmt(stat: StatKey, v: number): number {
  if (DECIMAL.has(stat)) return Math.round(v * 10) / 10;
  return Math.max(1, Math.round(v));
}

/** boost > 0 shifts weight toward higher rarities (bosses use ~1.5). */
export function rollRarity(r: Rng, boost = 0): Rarity {
  const w = RARITY_WEIGHT.map((x, i) => x * (1 + boost * i));
  let roll = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    roll -= w[i];
    if (roll <= 0) return RARITIES[i];
  }
  return 'common';
}

function build(base: BaseItem, rarity: Rarity, level: number, cls: ClassId, r: Rng, boost = 0): Item {
  const lines: StatLine[] = [];
  // Main stats first (the kind's own stats), then the extras, each picked once.
  for (const k of Object.keys(base.main) as StatKey[]) lines.push(rollLine(k, ...rowRange(base, rarity, level, k, 'main'), r, boost));
  const locked = LOCKED_LINE[base.slot];
  if (locked) lines.push(rollLine(locked, ...rowRange(base, rarity, level, locked, 'locked'), r, boost));
  let n = AFFIX_COUNT[rarity] + (base.slot === 'ring' ? 1 : 0);
  const pool = [...AFFIXES];
  while (n-- > 0 && pool.length) {
    const a = pool.splice(Math.floor(r() * pool.length), 1)[0];
    lines.push(rollLine(a.stat, ...rowRange(base, rarity, level, a.stat, 'extra'), r, boost));
  }
  const stats = sumLines(lines);
  const owner = ownerClass(base, cls);
  let name = base.names.any ?? base.names[owner] ?? base.id;
  const pre = PREFIX[rarity];
  if (pre) name = `${pick(r, pre)} ${name}`;
  const value = Math.round((5 + level * 3) * (1 + RARITIES.indexOf(rarity) * 1.5));
  const item: Item = { uid: newUid(), baseId: base.id, name, slot: base.slot, rarity, level, stats, value, lines, tierV: TIER_VERSION };
  if (!base.names.any) item.cls = owner;
  return item;
}

/**
 * A drop. `band` is the map's level range (its `levels`): only the kinds made for that map drop there
 * (frost weapons in the snow, fire weapons on the volcano), whatever their minLevel inside it, so a
 * level-40 monster never drops a level-1 Flintlock. Without a band, or when no kind fits it, any kind
 * up to the level can drop.
 */
export function rollItem(r: Rng, level: number, cls: ClassId, boost = 0, band?: readonly [number, number]): Item {
  const forClass = BASES.filter((b) => b.names.any || b.names[cls]);
  const ofMap = band ? forClass.filter((b) => b.minLevel >= band[0] && b.minLevel <= band[1]) : [];
  const candidates = ofMap.length ? ofMap : forClass.filter((b) => b.minLevel <= level + 1);
  return build(pick(r, candidates), rollRarity(r, boost), level, cls, r, boost);
}

export function starterWeapon(cls: ClassId): Item {
  return build(BASES[0], 'common', 1, cls, Math.random);
}

/** Every item kind, for the admin page's spawn form. */
export const ITEM_BASES: readonly Readonly<BaseItem>[] = BASES;

/**
 * A new item of one kind and rarity, rolled the same way as a drop (admin spawn). Null for an unknown
 * kind. The caller checks rarity and level.
 */
export function makeItem(baseId: string, rarity: Rarity, level: number, cls: ClassId, r: Rng = Math.random): Item | null {
  const base = BASES.find((b) => b.id === baseId);
  return base ? build(base, rarity, level, cls, r) : null;
}

// ------------------------------------------------------------ admin: items with chosen stats

/**
 * The normal range of one stat row on an item of this kind, rarity and level, as a drop would roll it
 * (before rounding). `main`: the item kind's own stat (a weapon's ATK…); `locked`: its LOCKED_LINE;
 * `extra`: a stat from rarity.
 */
type RowKind = 'main' | 'locked' | 'extra';
function rowRange(base: BaseItem, rarity: Rarity, level: number, stat: StatKey, kind: RowKind): [number, number] {
  const rm = RARITY_MULT[rarity];
  if (kind === 'main') return rangeAround((base.main[stat] ?? 0) * (1 + (level - 1) * 0.12) * rm);
  // Extras average the middle of their table min–max, raised with item level.
  const a = AFFIXES.find((x) => x.stat === stat)!;
  const scale = kind === 'extra' ? EXTRA_SCALE[stat] ?? 1 : 1;
  return rangeAround(((a.min + a.max) / 2 + a.per * (level - 1)) * rm * scale);
}

/**
 * Each row's kind, in order: the first row of each of the kind's own stats is main, then the first row of
 * its LOCKED_LINE stat is locked, every other row is extra. `withLocked = false` gives the rules from
 * before locked lines (TIER_VERSION < 3).
 */
function rowKinds(base: BaseItem, stats: StatKey[], withLocked = true): RowKind[] {
  const seen = new Set<StatKey>();
  let lockedSeen = !withLocked || !LOCKED_LINE[base.slot];
  return stats.map((stat) => {
    if (stat in base.main && !seen.has(stat)) {
      seen.add(stat);
      return 'main';
    }
    if (!lockedSeen && stat === LOCKED_LINE[base.slot]) {
      lockedSeen = true;
      return 'locked';
    }
    return 'extra';
  });
}

/** Item stats: the total of its lines. */
function sumLines(lines: StatLine[]): Partial<Stats> {
  const stats: Partial<Stats> = {};
  for (const l of lines) stats[l.stat] = fmt(l.stat, (stats[l.stat] ?? 0) + l.value);
  return stats;
}

/** One row of a chosen-stats item with the whole range it is measured against (lo–hi before rounding, min–max as stored). */
export interface RowRange { stat: StatKey; main: boolean; lo: number; hi: number; min: number; max: number }

/**
 * The normal ranges of a list of rows, in order (see rowKinds). Locked lines count as main: the stat
 * stone never changes them. Null for an unknown kind.
 */
export function rowRanges(baseId: string, rarity: Rarity, level: number, stats: StatKey[]): RowRange[] | null {
  const base = BASES.find((b) => b.id === baseId);
  if (!base) return null;
  const kinds = rowKinds(base, stats);
  return stats.map((stat, i) => {
    const main = kinds[i] !== 'extra';
    const [lo, hi] = rowRange(base, rarity, level, stat, kinds[i]);
    const t = tierRanges(stat, lo, hi);
    return { stat, main, lo, hi, min: t[4].min, max: t[0].max };
  });
}

/** A stat value as items store it (one decimal for regen and % stats, whole numbers of at least 1 for the rest). */
export const roundStat = fmt;

/** The names an item of this kind and rarity can get (the rarity's prefixes, if any). */
export function itemNames(baseId: string, rarity: Rarity, cls: ClassId): string[] {
  const base = BASES.find((b) => b.id === baseId);
  if (!base) return [];
  const name = base.names.any ?? base.names[ownerClass(base, cls)] ?? base.id;
  const pre = PREFIX[rarity];
  return pre ? pre.map((p) => `${p} ${name}`) : [name];
}

// ------------------------------------------------------------ tiers on saved items, rerolls

/** Each line's whole range on this item, in order (null: no lines, or an unknown kind). See rowRanges. */
export function lineRanges(item: Item): RowRange[] | null {
  if (!item.lines?.length) return null;
  return rowRanges(item.baseId, item.rarity, item.level, item.lines.map((l) => l.stat));
}

/** A string's 32-bit hash, to seed rolls that must come out the same every time (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Brings an item's lines to the current tier tables (TIER_VERSION), in place: each line gets the tier its
 * value falls in now and that tier's range. Items saved before TIER_VERSION 3 also get the 2026-11-08
 * balance: extra lines of the EXTRA_SCALE stats are scaled down, and weapons get their locked crit line,
 * rolled from the item's uid so every load (and every market read) gives the same value. Items from before
 * tiers (no lines) and unknown kinds are left alone. Returns the same item.
 */
export function upgradeItem<T>(item: T): T {
  const it = item as unknown as Item;
  if (!it || typeof it !== 'object' || !('baseId' in it) || it.tierV === TIER_VERSION) return item;
  const base = BASES.find((b) => b.id === it.baseId);
  if (!base || !it.lines?.length) return item;
  if ((it.tierV ?? 0) < 3) {
    const old = rowKinds(base, it.lines.map((l) => l.stat), false);
    const lines = it.lines.map((l, i) => {
      const scale = old[i] === 'extra' ? EXTRA_SCALE[l.stat] : undefined;
      return scale ? { ...l, value: fmt(l.stat, l.value * scale) } : l;
    });
    const locked = LOCKED_LINE[base.slot];
    if (locked) {
      const at = old.filter((k) => k === 'main').length;
      const r = mulberry32(hash(String(it.uid)));
      lines.splice(at, 0, rollLine(locked, ...rowRange(base, it.rarity, it.level, locked, 'locked'), r));
    }
    it.lines = lines;
    it.stats = sumLines(lines);
  }
  const ranges = lineRanges(it)!;
  it.lines = it.lines.map((l, i) => {
    const t = tierOf(l.stat, l.value, ranges[i].lo, ranges[i].hi);
    return { stat: l.stat, value: l.value, tier: t.tier, min: t.min, max: t.max };
  });
  it.tierV = TIER_VERSION;
  return item;
}

/** Why an item can't be rerolled at the blacksmith, or null when it can. */
export function rerollBlock(item: Item): string | null {
  return lineRanges(item) ? null : 'ไอเทมรุ่นเก่า (ไม่มีข้อมูล tier) สุ่มค่าไม่ได้';
}

/** New stats total after the lines changed. */
function relines(item: Item, lines: StatLine[]): void {
  item.lines = lines;
  item.stats = sumLines(lines);
  item.tierV = TIER_VERSION;
}

/**
 * Rerolls the value of every line, each staying in its tier (the blacksmith's "สุ่มค่าตัวเลข"). Lines above
 * the normal range (admin-made) count as T1 and come back inside it. False if the item can't be rerolled.
 */
export function rerollValues(item: Item, r: Rng = Math.random): boolean {
  const ranges = lineRanges(item);
  if (!ranges || !item.lines) return false;
  relines(item, item.lines.map((l, i) => lineOfTier(l.stat, l.tier, ranges[i].lo, ranges[i].hi, r)));
  return true;
}

/**
 * The blacksmith's "สุ่มสเตตัส" (like Path of Exile's Chaos Orb): one random extra line becomes a new stat
 * (not one of the item's other extras) with a new tier and value. The kind's own stats are never touched,
 * unless the item has no extras (commons): then one of them gets a new tier and value instead.
 * Returns the index of the changed line, or -1 if the item can't be rerolled.
 */
export function rerollStat(item: Item, r: Rng = Math.random): number {
  const ranges = lineRanges(item);
  const base = BASES.find((b) => b.id === item.baseId);
  if (!ranges || !item.lines || !base) return -1;
  const lines = [...item.lines];
  const extras = ranges.map((x, i) => (x.main ? -1 : i)).filter((i) => i >= 0);
  let at: number;
  if (extras.length) {
    at = extras[Math.floor(r() * extras.length)];
    const taken = new Set(extras.filter((i) => i !== at).map((i) => lines[i].stat));
    const pool = AFFIXES.filter((a) => !taken.has(a.stat));
    const stat = pool[Math.floor(r() * pool.length)].stat;
    lines[at] = rollLine(stat, ...rowRange(base, item.rarity, item.level, stat, 'extra'), r);
  } else {
    at = Math.floor(r() * lines.length);
    lines[at] = rollLine(lines[at].stat, ranges[at].lo, ranges[at].hi, r);
  }
  relines(item, lines);
  return at;
}
