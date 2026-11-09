// Stack splitting (Shift+drag) and selling part of a stack. Shared rules only, no server needed.
import { splitInto } from '../src/shared/sim/split';
import { newCharacterData } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES } from '../src/shared/data/zones';
import { STONE_STACK } from '../src/shared/data/stones';
import { POTION_STACK, potionSellPrice } from '../src/shared/data/potions';
import { isStack, type BagEntry } from '../src/shared/types';
import { finish, ok } from './check';

const hp = (count: number, size: 's' | 'm' | 'l' = 's'): BagEntry => ({ potion: 'hp', size, count });
const stone = (count: number): BagEntry => ({ stone: 'protect', count });
const total = (...lists: (BagEntry | null)[][]) =>
  lists.flat().reduce((s, e) => s + (isStack(e) ? e.count : 0), 0);

// --- splitInto: pure rules
{
  const bag: (BagEntry | null)[] = [hp(8), null, hp(4), hp(9, 'm'), stone(5)];
  ok(splitInto(bag, 0, bag, 1, 3) && (bag[0] as { count: number }).count === 5 && (bag[1] as { count: number }).count === 3, 'split to an empty slot');
  ok(bag[1] !== bag[0], 'the new stack is its own object');
  ok(splitInto(bag, 0, bag, 2, 3) && (bag[2] as { count: number }).count === 7 && (bag[0] as { count: number }).count === 2, 'merge onto the same stack');
  ok(!splitInto(bag, 2, bag, 3, 1), 'a different size does not merge');
  ok(!splitInto(bag, 2, bag, 4, 1), 'a potion does not merge with a stone');
  // merge is capped by room: 7 + 5 would be 12, only 3 fit
  bag[0] = hp(9);
  ok(splitInto(bag, 0, bag, 2, 5) && (bag[2] as { count: number }).count === POTION_STACK && (bag[0] as { count: number }).count === 6, 'merge stops at the stack limit');
  ok(!splitInto(bag, 0, bag, 2, 1), 'a full target takes nothing');
  bag[1] = null;
  const before = JSON.stringify(bag);
  for (const bad of [0, -1, 1.5, NaN, Infinity, 99, '2' as unknown as number, null as unknown as number]) {
    ok(!splitInto(bag, 0, bag, 1, bad), `bad amount ${String(bad)} is refused`);
  }
  ok(!splitInto(bag, 0, bag, 1, (bag[0] as { count: number }).count), 'moving the whole stack is not a split');
  ok(!splitInto(bag, 0, bag, 0, 1), 'same slot is refused');
  ok(!splitInto(bag, -1, bag, 1, 1) && !splitInto(bag, 0, bag, 99, 1) && !splitInto(bag, 0.5, bag, 1, 1), 'bad slots are refused');
  ok(!splitInto(bag, 1, bag, 0, 1), 'an empty source is refused');
  ok(JSON.stringify(bag) === before, 'refused splits change nothing');
  const gear = [{ uid: 'x', slot: 'gloves' } as unknown as BagEntry, null];
  ok(!splitInto(gear, 0, gear, 1, 1), 'gear is not a stack');
}

// --- Sim: bag, stash, merchant. Nothing is created or lost.
{
  const sim = new Sim(Object.values(ZONES)[0]);
  const data = newCharacterData('T', 'sword');
  data.level = 30;
  data.bag = [hp(8), stone(6)];
  const p = sim.addPlayer(data);
  const stand = (id: 'keeper' | 'merchant') => {
    const near = (sim as unknown as { near(p: unknown, id: string): boolean }).near.bind(sim);
    for (let x = -60; x <= 60; x++) for (let z = -60; z <= 60; z++) {
      p.x = x;
      p.z = z;
      if (near(p, id)) return;
    }
  };
  const startPots = total(p.bag);
  ok(sim.splitInBag(p, 0, 5, 3) && total(p.bag) === startPots, 'bag split keeps the total');
  ok(!sim.splitInBag(p, 0, 1, 1), 'onto a different stack is refused');
  ok(!sim.splitInBag(p, 0, 5, 5), 'taking all of what is left in the slot is refused');

  stand('keeper');
  const all = () => total(p.bag, p.stash.items);
  const t0 = all();
  ok(sim.stashSplit(p, 'bag', 5, 'stash', 0, 2) && all() === t0, 'bag to stash part of a stack');
  ok((p.stash.items[0] as { count: number }).count === 2 && (p.bag[5] as { count: number }).count === 1, 'the right amounts moved');
  ok(sim.stashSplit(p, 'stash', 0, 'stash', 4, 1) && all() === t0, 'inside the stash');
  ok(sim.stashSplit(p, 'bag', 0, 'stash', 4, 2) && all() === t0 && (p.stash.items[4] as { count: number }).count === 3, 'bag onto the same stack in the stash');
  ok(!sim.stashSplit(p, 'bag', 0, 'nowhere' as 'bag', 3, 1), 'unknown list is refused');
  ok(!sim.stashSplit(p, 'bag', 1, 'stash', 0, 1), 'a stone onto a potion in the stash is refused');
  ok(all() === t0, 'still nothing lost or made');
  stand('merchant');
  ok(!sim.stashSplit(p, 'bag', 5, 'stash', 9, 1), 'away from the keeper it is refused');

  // selling part of a stack
  const slot = p.bag.findIndex((e) => (e as { potion?: string } | null)?.potion === 'hp');
  const have = (p.bag[slot] as { count: number }).count;
  const gold = p.gold;
  ok(sim.sellItem(p, slot, 0) === 0 && sim.sellItem(p, slot, -1) === 0 && sim.sellItem(p, slot, have + 1) === 0 && sim.sellItem(p, slot, 1.5) === 0, 'bad sell amounts are refused');
  ok(p.gold === gold && (p.bag[slot] as { count: number }).count === have, 'nothing sold for a bad amount');
  ok(sim.sellItem(p, slot, 2) === potionSellPrice('hp', 's') * 2, 'part of a stack sells for that many');
  ok(p.gold === gold + potionSellPrice('hp', 's') * 2 && (p.bag[slot] as { count: number }).count === have - 2, 'the rest stays');
  const left = (p.bag[slot] as { count: number }).count;
  ok(sim.sellItem(p, slot, left) > 0 && !p.bag[slot], 'selling every one clears the slot');
  const sIdx = p.bag.findIndex((e) => (e as { stone?: string } | null)?.stone);
  ok(sIdx >= 0 && STONE_STACK >= 2 && sim.sellItem(p, sIdx, 1) > 0 && !!p.bag[sIdx], 'a stone can be sold one at a time');
}

finish('split');
