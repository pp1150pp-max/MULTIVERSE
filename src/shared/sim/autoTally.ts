// What Auto Play earned since it was switched on (owner 2026-11-27: the "while you were away" summary,
// docs/systems/world-and-ui.md). The server's AutoPlay keeps one tally per Auto run (it survives a dropped
// connection, like the bot itself); Sim adds to it while `Player.autoOn`, and the snapshot sends it to its owner
// (`PrivateSnap.at`, and the gear list apart as `PrivateSnap.ag`). The browser shows "now minus what it was when
// you last touched the game".
//
// Item by item (owner 2026-11-28): stacks (potions by kind and size, stones / keys / cards / boxes / scrolls by kind)
// are counted in `got`; gear keeps a copy of each piece (`gear`, the newest `auto.summaryGear` of them, /admin) so the
// summary can draw it like the bag does. `gearN` numbers every piece, so "since you last touched the game" is
// "pieces numbered after the base's gearN".
import { RARITIES, type Item, type PotionKind, type PotionSize, type Rarity, type StoneKind } from '../types';

/** One piece of gear Auto picked up: `n` is its number in the run (1, 2, ...). */
export interface GearPick {
  n: number;
  item: Item;
}

/** Why EXP earned was not all gained: the level cap, or a gate boss (its Thai name) not killed yet. */
export type ExpBlock = 'max' | `gate:${string}`;

export interface AutoTally {
  /** Which Auto run this is: a new number each time Auto is switched on. */
  id: number;
  /** EXP really gained (what reached the bar; nothing at the level cap, the rest of a full bar at a boss gate). */
  exp: number;
  /** EXP earned but lost to the level cap or a boss gate (missing on tallies from before 2026-11-28). */
  expLost?: number;
  /** Why the last EXP was lost (see expLost). */
  expWhy?: ExpBlock;
  /** Levels gained. */
  lv: number;
  gold: number;
  /** Monsters killed (every monster this player hit that died, as EXP counts it). */
  kills: number;
  /** Items picked up, by rarity (RARITIES order). */
  items: number[];
  /** Stones and keys picked up. */
  stones: number;
  /** Potions picked up and drunk. */
  potGot: number;
  potUsed: number;
  deaths: number;
  /** Stacks picked up by kind: `pot:<kind>:<size>` and `st:<stone kind>` → count (see gotKey). Missing on old tallies. */
  got?: Record<string, number>;
  /** Gear pieces picked up in this run (also those no longer kept in `gear`). */
  gearN?: number;
  /** The newest pieces (server side only: sent apart as `PrivateSnap.ag`, never inside `at`). */
  gear?: GearPick[];
}

let nextId = 1;

export function newTally(): AutoTally {
  return emptyTally(nextId++);
}

/** A tally of the same run with nothing in it yet. */
export function emptyTally(id: number): AutoTally {
  return {
    id, exp: 0, expLost: 0, lv: 0, gold: 0, kills: 0, items: RARITIES.map(() => 0), stones: 0, potGot: 0, potUsed: 0, deaths: 0,
    got: {}, gearN: 0, gear: [],
  };
}

export function copyTally(t: AutoTally): AutoTally {
  return { ...t, items: [...t.items], got: { ...(t.got ?? {}) }, gear: t.gear ? [...t.gear] : undefined };
}

/** The `got` key of a potion stack. */
export const potKey = (pot: PotionKind, size: PotionSize): string => `pot:${pot}:${size}`;
/** The `got` key of a stone stack (keys, cards, boxes and scrolls are stones too). */
export const stoneKey = (stone: StoneKind): string => `st:${stone}`;

/** Counts `count` of a stack kind (potKey / stoneKey). */
export function addGot(t: AutoTally, key: string, count: number): void {
  const got = (t.got ??= {});
  got[key] = (got[key] ?? 0) + count;
}

/** Counts a piece of gear by rarity and keeps a copy of it (only the newest `keep`). */
export function addItem(t: AutoTally, item: Item, keep = Infinity): void {
  const i = RARITIES.indexOf(item.rarity);
  if (i >= 0) t.items[i] = (t.items[i] ?? 0) + 1;
  t.gearN = (t.gearN ?? 0) + 1;
  const gear = (t.gear ??= []);
  gear.push({ n: t.gearN, item: structuredClone(item) });
  if (gear.length > keep) gear.splice(0, gear.length - Math.max(0, keep));
}

/** Counts EXP gained, and what was lost and why. */
export function addExp(t: AutoTally, gained: number, lost: number, why: ExpBlock | null): void {
  t.exp += gained;
  if (lost > 0) {
    t.expLost = (t.expLost ?? 0) + lost;
    if (why) t.expWhy = why;
  }
}

/** `now` minus `base` (each never below zero). The gear list: pieces numbered after the base's last one. */
export function tallySince(now: AutoTally, base: AutoTally): AutoTally {
  const d = (a: number, b: number) => Math.max(0, a - b);
  const got: Record<string, number> = {};
  for (const [k, n] of Object.entries(now.got ?? {})) {
    const left = d(n, base.got?.[k] ?? 0);
    if (left > 0) got[k] = left;
  }
  const from = base.gearN ?? 0;
  return {
    id: now.id, exp: d(now.exp, base.exp), expLost: d(now.expLost ?? 0, base.expLost ?? 0), expWhy: now.expWhy,
    lv: d(now.lv, base.lv), gold: d(now.gold, base.gold), kills: d(now.kills, base.kills),
    items: now.items.map((n, i) => d(n, base.items[i] ?? 0)), stones: d(now.stones, base.stones),
    potGot: d(now.potGot, base.potGot), potUsed: d(now.potUsed, base.potUsed), deaths: d(now.deaths, base.deaths),
    got, gearN: d(now.gearN ?? 0, from), gear: (now.gear ?? []).filter((g) => g.n > from),
  };
}

/** Rarity order, best first (for sorting the summary's grid). */
export const rarityRank = (r: Rarity): number => RARITIES.indexOf(r);
