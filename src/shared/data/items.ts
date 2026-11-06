import {
  RARITIES, type ClassId, type Item, type Rarity, type SlotId, type StatKey, type StatLine, type Stats, type StatTier,
} from '../types';
import { pick, type Rng } from '../rng';

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
];

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
export function starterArt(slot: SlotId, cls: ClassId): string {
  const base = BASES.find((b) => b.slot === slot)!;
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

/** Main stats (a weapon's ATK, armor's DEF…) roll over a range this wide (±20% of their level value). */
const MAIN_SPREAD = 0.2;
/** Chance of tier 1 (best) … tier 5. */
const TIER_WEIGHT = [3, 9, 18, 30, 40];
/**
 * Where an average roll lands in its range (0 = min, 1 = max) with TIER_WEIGHT: about 0.31, because low tiers
 * are common. Ranges are placed so that this point is the stat's old average, so items are as strong as
 * before tiers on average (owner's choice) and tier 1 rolls go above the old values.
 */
const MEAN_POS = TIER_WEIGHT.reduce((s, w, i) => s + w * (TIER_WEIGHT.length - 0.5 - i), 0)
  / TIER_WEIGHT.length / TIER_WEIGHT.reduce((a, b) => a + b, 0);

/** A range `span` wide whose average roll (MEAN_POS) is `mean`. */
function rangeAround(mean: number, span: number): [number, number] {
  const lo = mean - MEAN_POS * span;
  return [lo, lo + span];
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

/** Rolls one stat between lo and hi: the tier picks a 20% band (tier 1 = top), the value lands inside it. */
function rollLine(stat: StatKey, lo: number, hi: number, r: Rng, boost = 0): StatLine {
  const tier = rollTier(r, boost);
  const band = (hi - lo) / 5;
  const from = lo + band * (5 - tier);
  return { stat, value: fmt(stat, from + r() * band), tier, min: fmt(stat, lo), max: fmt(stat, hi) };
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
  if (stat === 'hpRegen' || stat === 'mpRegen') return Math.round(v * 10) / 10;
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
  const rm = RARITY_MULT[rarity];
  const lvMult = 1 + (level - 1) * 0.12;
  const lines: StatLine[] = [];
  // Main stats: a range 2 × MAIN_SPREAD wide, averaging the level value.
  for (const k of Object.keys(base.main) as StatKey[]) {
    const mid = (base.main[k] ?? 0) * lvMult * rm;
    lines.push(rollLine(k, ...rangeAround(mid, 2 * MAIN_SPREAD * mid), r, boost));
  }
  // Extra stats: as wide as their min–max, averaging its middle; raised with item level.
  let n = AFFIX_COUNT[rarity] + (base.slot === 'ring' ? 1 : 0);
  const pool = [...AFFIXES];
  while (n-- > 0 && pool.length) {
    const a = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const mid = ((a.min + a.max) / 2 + a.per * (level - 1)) * rm;
    lines.push(rollLine(a.stat, ...rangeAround(mid, (a.max - a.min) * rm), r, boost));
  }
  const stats: Partial<Stats> = {};
  for (const l of lines) stats[l.stat] = fmt(l.stat, (stats[l.stat] ?? 0) + l.value);
  let name = base.names[cls] ?? base.names.any ?? base.id;
  const pre = PREFIX[rarity];
  if (pre) name = `${pick(r, pre)} ${name}`;
  const value = Math.round((5 + level * 3) * (1 + RARITIES.indexOf(rarity) * 1.5));
  const item: Item = { uid: newUid(), baseId: base.id, name, slot: base.slot, rarity, level, stats, value, lines };
  if (!base.names.any) item.cls = cls;
  return item;
}

export function rollItem(r: Rng, level: number, cls: ClassId, boost = 0): Item {
  const candidates = BASES.filter((b) => b.minLevel <= level + 1);
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
