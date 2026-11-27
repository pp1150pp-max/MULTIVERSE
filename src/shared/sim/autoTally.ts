// What Auto Play earned since it was switched on (owner 2026-11-27: the "while you were away" summary,
// docs/systems/world-and-ui.md). The server's AutoPlay keeps one tally per Auto run (it survives a dropped
// connection, like the bot itself); Sim adds to it while `Player.autoOn`, and the snapshot sends it to its owner
// (`PrivateSnap.at`). The browser shows "now minus what it was when you last touched the game".
import { RARITIES, type Rarity } from '../types';

export interface AutoTally {
  /** Which Auto run this is: a new number each time Auto is switched on. */
  id: number;
  exp: number;
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
}

let nextId = 1;

export function newTally(): AutoTally {
  return { id: nextId++, exp: 0, lv: 0, gold: 0, kills: 0, items: RARITIES.map(() => 0), stones: 0, potGot: 0, potUsed: 0, deaths: 0 };
}

/** A tally of the same run with nothing in it yet. */
export function emptyTally(id: number): AutoTally {
  return { id, exp: 0, lv: 0, gold: 0, kills: 0, items: RARITIES.map(() => 0), stones: 0, potGot: 0, potUsed: 0, deaths: 0 };
}

export function copyTally(t: AutoTally): AutoTally {
  return { ...t, items: [...t.items] };
}

export function addItem(t: AutoTally, r: Rarity): void {
  const i = RARITIES.indexOf(r);
  if (i >= 0) t.items[i] = (t.items[i] ?? 0) + 1;
}

/** `now` minus `base` (each never below zero). */
export function tallySince(now: AutoTally, base: AutoTally): AutoTally {
  const d = (a: number, b: number) => Math.max(0, a - b);
  return {
    id: now.id, exp: d(now.exp, base.exp), lv: d(now.lv, base.lv), gold: d(now.gold, base.gold), kills: d(now.kills, base.kills),
    items: now.items.map((n, i) => d(n, base.items[i] ?? 0)), stones: d(now.stones, base.stones),
    potGot: d(now.potGot, base.potGot), potUsed: d(now.potUsed, base.potUsed), deaths: d(now.deaths, base.deaths),
  };
}
