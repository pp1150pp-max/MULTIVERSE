// The Seeker's gear quests (owner 2026-11-12): from the first level of each farm map, three quests in a
// row (weapon → armour → jewellery). Each asks for GEAR_KILLS monsters of that map, then gives a set of
// gear made for the player's class and level, green on the first two maps, blue after. Not bound to the
// character, and a player above a map can still take its quests. One place for the rules, so his window,
// the quest tracker, the ! / ? over his head and Sim never disagree.
import { ZONES, type ZoneDef } from './data/zones';
import { ITEM_BASES, makeItem } from './data/items';
import type { ClassId, Item, Rarity, SlotId } from './types';

/** Monsters of the map to kill for one gear quest (owner: 20). */
export const GEAR_KILLS = 20;

export type GearPart = 'weapon' | 'armor' | 'jewel';
/** The order a map's quests come in: the next one opens once the one before is handed in. */
export const GEAR_PARTS: readonly GearPart[] = ['weapon', 'armor', 'jewel'];
export const GEAR_PART_NAME: Record<GearPart, string> = { weapon: 'อาวุธ', armor: 'ชุดเกราะ', jewel: 'เครื่องประดับ' };
/** The pieces each quest gives (owner: all nine worn places; two rings). */
export const GEAR_SLOTS: Record<GearPart, readonly SlotId[]> = {
  weapon: ['weapon', 'offhand'],
  armor: ['helmet', 'armor', 'gloves', 'belt', 'boots'],
  jewel: ['necklace', 'ring', 'ring'],
};
const SLOT_NAME: Record<SlotId, string> = {
  weapon: 'อาวุธ', offhand: 'มือรอง', helmet: 'หมวก', armor: 'เกราะ', gloves: 'ถุงมือ', belt: 'เข็มขัด', boots: 'รองเท้า', necklace: 'สร้อย', ring: 'แหวน',
} as Record<SlotId, string>;

/** Farm maps in order (the ones with a boss lair, so never the hub or a boss room). */
export function gearMaps(): ZoneDef[] {
  return Object.values(ZONES).filter((z) => z.lair).sort((a, b) => a.levels[0] - b.levels[0]);
}

/** Rarity of a map's quest gear (owner: maps 1–2 green, 3–4 blue; never above blue). */
export function gearRarity(map: ZoneDef): Rarity {
  return gearMaps().indexOf(map) < 2 ? 'uncommon' : 'rare';
}

export const gearQuestId = (map: ZoneDef, part: GearPart): string => `${map.id}:${part}`;

/** offer: can take it · going: taken · ready: kills done, hand it in · done: handed in · locked: level too low or the one before isn't done. */
export type GearState = 'offer' | 'going' | 'ready' | 'done' | 'locked';

export interface GearRow { id: string; map: ZoneDef; part: GearPart; kills: number; state: GearState }

/** What the rules read from a player (Player has all of it). */
export interface GearHolder {
  level: number;
  /** Gear quests taken: quest id → kills so far. */
  gearQuests: Record<string, number>;
  /** Gear quests handed in. */
  gearDone: string[];
}

/** Every gear quest as this player sees it, map by map, each map's in GEAR_PARTS order. */
export function gearRows(p: GearHolder): GearRow[] {
  return gearMaps().flatMap((map) => {
    let before = true;
    return GEAR_PARTS.map((part) => {
      const id = gearQuestId(map, part);
      const kills = p.gearQuests[id];
      const state: GearState = p.gearDone.includes(id) ? 'done'
        : kills !== undefined ? (kills >= GEAR_KILLS ? 'ready' : 'going')
        : before && p.level >= map.levels[0] ? 'offer' : 'locked';
      before = state === 'done';
      return { id, map, part, kills: kills ?? 0, state };
    });
  });
}

/** A gear quest's row by id, or undefined for an unknown id. */
export function gearRow(p: GearHolder, id: string): GearRow | undefined {
  return gearRows(p).find((r) => r.id === id);
}

/** What a quest gives, as text: "อาวุธ + มือรอง (ดี)" style, without the rarity. */
export function gearRewardText(part: GearPart): string {
  const slots = GEAR_SLOTS[part];
  const rings = slots.filter((s) => s === 'ring').length;
  const names = [...new Set(slots)].map((s) => (s === 'ring' && rings > 1 ? `${SLOT_NAME[s]} ${rings} วง` : SLOT_NAME[s]));
  return names.join(' + ');
}

/**
 * The gear a quest gives this player: one piece per slot of the part, for their class, of the map's kinds,
 * at their level kept inside the map's range (a level-35 player doing the forest gets level-10 gear). Each
 * slot uses the map's kind with the highest minLevel the item level reaches (else the map's lowest kind).
 */
export function gearReward(map: ZoneDef, part: GearPart, cls: ClassId, playerLevel: number): Item[] {
  const [lo, hi] = map.levels;
  const level = Math.max(lo, Math.min(hi, playerLevel));
  const rarity = gearRarity(map);
  const out: Item[] = [];
  for (const slot of GEAR_SLOTS[part]) {
    const kinds = ITEM_BASES
      .filter((b) => b.slot === slot && (b.names.any || b.names[cls]) && b.minLevel >= lo && b.minLevel <= hi)
      .sort((a, b) => a.minLevel - b.minLevel);
    const base = [...kinds].reverse().find((b) => b.minLevel <= level) ?? kinds[0];
    const item = base && makeItem(base.id, rarity, level, cls);
    if (item) out.push(item);
  }
  return out;
}

/** Gear quests read from a save: known ids only, counts 0..GEAR_KILLS. */
export function cleanGearQuests(raw: unknown): Record<string, number> {
  const ids = new Set(gearMaps().flatMap((m) => GEAR_PARTS.map((p) => gearQuestId(m, p))));
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    if (ids.has(id) && typeof n === 'number' && Number.isFinite(n)) out[id] = Math.max(0, Math.min(GEAR_KILLS, Math.floor(n)));
  }
  return out;
}

/** Handed-in gear quests read from a save: known ids, once each. */
export function cleanGearDone(raw: unknown): string[] {
  const ids = new Set(gearMaps().flatMap((m) => GEAR_PARTS.map((p) => gearQuestId(m, p))));
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && ids.has(x)))] : [];
}
