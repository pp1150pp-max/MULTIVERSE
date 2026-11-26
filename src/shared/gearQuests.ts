// The gear quests of each floor's quest giver (owner 2026-11-12; floor 2 2026-11-26): The Seeker in nexus_city
// gives floor 1's, the navigator of the dimensions in the harbour floor 2's (Sim.ownFloor, both are NPC id 'seeker').
// From the first level of each farm map, three quests in a row (weapon → armour → jewellery). Each asks for a
// number of monsters of that map (/admin, floor 1 20, floor 2 40), then gives a set of gear made for the player's
// class and level, of the map's rarity (/admin, floor 1 green on maps 1–2 and blue after, floor 2 blue; on floor 2
// that is the map's set pieces, all nine places). Not bound to the character, and a player above a map can still
// take its quests. One place for the rules, so the window, the quest tracker, the ! / ? over his head and Sim never
// disagree. /admin: the 'เควสอุปกรณ์' card (BalanceTuning.gear, src/shared/gearTuning.ts).
import { floorOf, type ZoneDef } from './data/zones';
import { ITEM_BASES, makeItem } from './data/items';
import { currentBalance } from './balance';
import { GEAR_KILLS_MAX, gearMaps, type GearConfig } from './gearTuning';
import type { ClassId, Item, Rarity, SlotId } from './types';

export { gearMaps } from './gearTuning';

const cfg = (): GearConfig => currentBalance().gear;

/** Monsters of the map to kill for one of its gear quests (/admin per floor). */
export function gearKills(map: ZoneDef): number {
  return cfg().floors[floorOf(map)]?.kills ?? GEAR_KILLS_MAX;
}

/** Whether the map's floor gives gear quests now (/admin per floor; off = hidden, refused, not counted, progress kept). */
export function gearOn(map: ZoneDef): boolean {
  return cfg().floors[floorOf(map)]?.on ?? false;
}

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

/** Rarity of a map's quest gear (/admin per map). */
export function gearRarity(map: ZoneDef): Rarity {
  return cfg().rarity[map.id] ?? 'rare';
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

/** Every gear quest as this player sees it (floors switched on only), map by map, each map's in GEAR_PARTS order. */
export function gearRows(p: GearHolder): GearRow[] {
  return gearMaps().filter(gearOn).flatMap((map) => {
    const need = gearKills(map);
    let before = true;
    return GEAR_PARTS.map((part) => {
      const id = gearQuestId(map, part);
      const kills = p.gearQuests[id];
      const state: GearState = p.gearDone.includes(id) ? 'done'
        : kills !== undefined ? (kills >= need ? 'ready' : 'going')
        : before && p.level >= map.levels[0] ? 'offer' : 'locked';
      before = state === 'done';
      return { id, map, part, kills: Math.min(kills ?? 0, need), state };
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

/** Gear quests read from a save: known ids only (every floor, whatever the switches), counts 0..GEAR_KILLS_MAX. */
export function cleanGearQuests(raw: unknown): Record<string, number> {
  const ids = new Set(gearMaps().flatMap((m) => GEAR_PARTS.map((p) => gearQuestId(m, p))));
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    if (ids.has(id) && typeof n === 'number' && Number.isFinite(n)) out[id] = Math.max(0, Math.min(GEAR_KILLS_MAX, Math.floor(n)));
  }
  return out;
}

/** Handed-in gear quests read from a save: known ids, once each. */
export function cleanGearDone(raw: unknown): string[] {
  const ids = new Set(gearMaps().flatMap((m) => GEAR_PARTS.map((p) => gearQuestId(m, p))));
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && ids.has(x)))] : [];
}
