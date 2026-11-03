import { RARITIES, type ClassId, type Item, type Rarity, type SlotId, type StatKey, type Stats } from '../types';
import { pick, rand, type Rng } from '../rng';

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
];

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

function build(base: BaseItem, rarity: Rarity, level: number, cls: ClassId, r: Rng): Item {
  const rm = RARITY_MULT[rarity];
  const lvMult = 1 + (level - 1) * 0.12;
  const stats: Partial<Stats> = {};
  for (const k of Object.keys(base.main) as StatKey[]) stats[k] = fmt(k, (base.main[k] ?? 0) * lvMult * rm);
  let n = AFFIX_COUNT[rarity] + (base.slot === 'ring' ? 1 : 0);
  const pool = [...AFFIXES];
  while (n-- > 0 && pool.length) {
    const a = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const v = rand(r, a.min, a.max) + a.per * (level - 1);
    stats[a.stat] = fmt(a.stat, (stats[a.stat] ?? 0) + v * rm);
  }
  let name = base.names[cls] ?? base.names.any ?? base.id;
  const pre = PREFIX[rarity];
  if (pre) name = `${pick(r, pre)} ${name}`;
  const value = Math.round((5 + level * 3) * (1 + RARITIES.indexOf(rarity) * 1.5));
  return { uid: newUid(), baseId: base.id, name, slot: base.slot, rarity, level, stats, value };
}

export function rollItem(r: Rng, level: number, cls: ClassId, boost = 0): Item {
  const candidates = BASES.filter((b) => b.minLevel <= level + 1);
  return build(pick(r, candidates), rollRarity(r, boost), level, cls, r);
}

export function starterWeapon(cls: ClassId): Item {
  return build(BASES[0], 'common', 1, cls, Math.random);
}
