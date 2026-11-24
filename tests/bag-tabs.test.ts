// Bag tabs (owner 2026-11-23, docs/systems/items-and-forge.md): gear in "กระเป๋า", stacks in "ประเภทใช้งาน".
// Old saves must be sorted into the tabs on load with nothing lost. Shared rules only, no server needed.
import { normalizeBag, nextExpand, codeBagExpand, cleanBagSlots, tabRange, freeCount, type BagSlots } from '../src/shared/bagTabs';
import { layOutBag, newCharacterData, type CharacterData } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES } from '../src/shared/data/zones';
import { putAll, slotsNeeded } from '../src/shared/mail';
import { planSwap } from '../src/shared/trade';
import { applyBalance, checkBalance } from '../src/shared/balance';
import { isItem, isStack, type BagEntry, type Item } from '../src/shared/types';
import { finish, ok } from './check';

const gear = (uid: string): Item => ({ uid, base: 'sword', slot: 'weapon', name: uid, rarity: 'common', level: 1, lines: [] }) as unknown as Item;
const hp = (count: number): BagEntry => ({ potion: 'hp', size: 's', count });
const stone = (kind: string, count: number, bound = false): BagEntry => ({ stone: kind, count, ...(bound ? { bound: true } : {}) }) as BagEntry;
/** The entries of a bag as sorted strings (order-free), to compare what is in it. */
const multiset = (bag: readonly (BagEntry | null)[]) => bag.filter((e) => !!e).map((e) => JSON.stringify(e)).sort();
const sameSet = (a: readonly (BagEntry | null)[], b: readonly (BagEntry | null)[]) => JSON.stringify(multiset(a)) === JSON.stringify(multiset(b));
/** Every entry sits in its own tab. */
const inTabs = (bag: readonly (BagEntry | null)[], s: BagSlots) => {
  const [ga, gb] = tabRange(s, 'gear');
  return bag.length === s.gear + s.use && bag.every((e, i) => !e || (isItem(e) ? i >= ga && i < gb : i >= gb));
};

// ---------------------------------------------------------------- old saves (no bagSlots)
{
  // A full mixed 30-slot bag: gear and stacks taking turns.
  const old: (BagEntry | null)[] = Array.from({ length: 30 }, (_, i) => (i % 2 ? hp(i % 10 + 1) : gear(`g${i}`)));
  const { bag, slots } = normalizeBag(old, null);
  ok(slots.gear === 30 && slots.use === 30 && bag.length === 60, 'an old save gets 30 + 30 slots');
  ok(sameSet(old, bag), 'full mixed bag: nothing lost or added');
  ok(inTabs(bag, slots), 'full mixed bag: gear in slots 0–29, stacks in 30–59');
  ok(JSON.stringify(bag.slice(0, 15).map((e) => (e as Item).uid)) === JSON.stringify(old.filter(isItem).map((e) => e.uid)), 'gear keeps its old order, packed from slot 0');
  ok(JSON.stringify(bag.slice(30, 45)) === JSON.stringify(old.filter(isStack)), 'stacks keep their old order, packed from slot 30');
}
{
  // Nulls all over, a short bag, bound stacks and quest keys.
  const old: (BagEntry | null)[] = [null, stone('qkey_bear', 1), null, gear('a'), stone('protect', 5, true), null, null, hp(3), gear('b'), null, stone('mystery_box', 100)];
  const { bag, slots } = normalizeBag(old, null);
  ok(sameSet(old, bag) && inTabs(bag, slots), 'scattered nulls, short bag, bound stacks and quest keys: all kept, in their tabs');
  ok(bag[0] && (bag[0] as Item).uid === 'a' && (bag[1] as Item).uid === 'b' && JSON.stringify(bag[30]) === JSON.stringify(stone('qkey_bear', 1)), 'packed in order per tab');
  ok((bag[31] as { bound?: true }).bound === true, 'a bound stack stays bound');
}
{
  const { bag, slots } = normalizeBag(undefined, null);
  ok(bag.length === 60 && bag.every((e) => e === null) && slots.gear === 30, 'a missing bag gives two empty tabs');
  const junk = normalizeBag([5, 'x', null, gear('z')] as unknown[], null);
  ok(junk.bag.filter(Boolean).length === 1 && (junk.bag[0] as Item).uid === 'z', 'non-objects in a save are dropped, entries kept');
}

// ---------------------------------------------------------------- laid-out saves
{
  const s: BagSlots = { gear: 30, use: 30 };
  const bag: (BagEntry | null)[] = Array(60).fill(null);
  bag[5] = gear('x');
  bag[40] = hp(2);
  const again = normalizeBag(bag, s);
  ok(JSON.stringify(again.bag) === JSON.stringify(bag) && again.slots.gear === 30, 'a laid-out bag is left exactly as it is');
  // Something in the wrong tab (an old bug, an admin edit) moves to its own tab, nothing lost.
  bag[2] = hp(4);
  bag[33] = gear('y');
  const fixed = normalizeBag(bag, s);
  ok(sameSet(bag, fixed.bag) && inTabs(fixed.bag, fixed.slots) && (fixed.bag[5] as Item).uid === 'x' && JSON.stringify(fixed.bag[40]) === JSON.stringify(hp(2)), 'misplaced entries move to their tab, the rest stay put');
  // A tab with no room grows (by whole steps) rather than dropping anything.
  const crowded: (BagEntry | null)[] = [...Array.from({ length: 30 }, (_, i) => gear(`c${i}`)), ...Array.from({ length: 30 }, (_, i) => gear(`d${i}`))];
  const grown = normalizeBag(crowded, s);
  ok(sameSet(crowded, grown.bag) && grown.slots.gear === 60 && grown.slots.use === 30 && inTabs(grown.bag, grown.slots), '60 gear in a 30-slot tab: the tab grows, nothing lost');
  ok(cleanBagSlots(undefined) === null && cleanBagSlots({ gear: 5, use: 1e9 })!.gear === 30 && cleanBagSlots({ gear: 5, use: 1e9 })!.use === 200, 'saved slot counts are kept in bounds');
}

// ---------------------------------------------------------------- loading a Player, saving, loading again
const sim = new Sim(Object.values(ZONES)[0]);
{
  const data = newCharacterData('Old', 'sword') as CharacterData;
  data.bag = [hp(5), gear('w1'), stone('protect', 3), null, gear('w2')];
  const before = structuredClone(data.bag);
  const p = sim.addPlayer(data);
  ok(sameSet(before, p.bag) && inTabs(p.bag, p.bagSlots), 'Player load: an old save is laid out in tabs');
  const saved = p.toData();
  ok(saved.bagSlots?.gear === 30 && saved.bagSlots.use === 30, 'the save now has its slot counts');
  const json = JSON.stringify(saved.bag);
  const p2 = sim.addPlayer(JSON.parse(JSON.stringify(saved)));
  ok(JSON.stringify(p2.bag) === json, 'load → save → load changes nothing');
  // The offline (/admin) path lays it out the same way.
  const off = newCharacterData('Off', 'mage') as CharacterData;
  off.bag = structuredClone(before);
  layOutBag(off);
  ok(JSON.stringify(off.bag) === JSON.stringify(p.bag) && off.bagSlots?.use === 30, 'layOutBag (offline edits) gives the same layout as loading');
}

// ---------------------------------------------------------------- the tabs at work
{
  const data = newCharacterData('T', 'sword');
  data.bag = [];
  const p = sim.addPlayer(data);
  ok(p.addToBag(gear('n1')) && p.bag.findIndex((e) => isItem(e)) === 0, 'gear goes into the gear tab');
  ok(p.addStones('protect', 3) && p.bag.findIndex((e) => isStack(e)) === 30, 'stones go into the usable tab');
  ok(p.addPotions('hp', 's', 4) && isStack(p.bag[31]), 'potions go into the usable tab');
  p.moveInBag(0, 32);
  ok(isItem(p.bag[0]) && !p.bag[32], 'gear can\'t be dragged into the usable tab');
  p.moveInBag(30, 5);
  ok(isStack(p.bag[30]) && !p.bag[5], 'a stack can\'t be dragged into the gear tab');
  p.moveInBag(30, 0);
  ok(isItem(p.bag[0]) && isStack(p.bag[30]), 'no swap across tabs');
  p.moveInBag(30, 33);
  ok(isStack(p.bag[33]) && !p.bag[30], 'moving inside the usable tab works');
  ok(!sim.splitInBag(p, 33, 1, 1) && (p.bag[33] as { count: number }).count === 3, 'splitting a stack into the gear tab is refused');
  ok(sim.splitInBag(p, 33, 35, 1) && (p.bag[35] as { count: number }).count === 1, 'splitting inside the usable tab works');
  // Fill the usable tab: stones no longer fit although the gear tab has room.
  for (let i = 30; i < 60; i++) if (!p.bag[i]) p.bag[i] = stone('enhance', 1);
  ok(!p.addStones('reroll_values', 1) && p.freeSlots('gear') > 0, 'usable tab full: a new stack is refused even with gear room');
  ok(!p.hasBagSpace() && p.hasBagSpace('gear') && !p.hasBagSpace('use'), 'hasBagSpace: either tab full = full (Auto), per tab on request');
  ok(p.canFit({ type: 'item', item: gear('q') }) && !p.canFit({ type: 'stone', stone: 'reroll_values', count: 1 }), 'pickup room is per tab');
  p.sortBag('rarity', false);
  ok(inTabs(p.bag, p.bagSlots), 'sorting keeps each tab to itself');
  p.growTab('gear', 10);
  ok(p.bagSlots.gear === 40 && p.bag.length === 70 && inTabs(p.bag, p.bagSlots), 'growing the gear tab shifts the usable tab up, still in tabs');
}

// ---------------------------------------------------------------- mail / trade placement
{
  const s: BagSlots = { gear: 30, use: 30 };
  const bag: (BagEntry | null)[] = Array(60).fill(null);
  for (let i = 30; i < 60; i++) bag[i] = stone('protect', 30);
  const copy = structuredClone(bag);
  ok(putAll(copy, [gear('m')], s) && (copy[0] as Item).uid === 'm', 'mail gear goes into the gear tab');
  ok(!putAll(structuredClone(bag), [stone('enhance', 1)], s), 'mail stones are refused when the usable tab is full');
  const need = slotsNeeded(bag, [stone('enhance', 1), gear('k')], s);
  ok(need.use === 1 && need.gear === 30, 'slotsNeeded says how many each tab needs');
  const side = (name: string, b: (BagEntry | null)[]) => ({ name, bag: b, bagSlots: s, gold: 0, offers: [], offerGold: 0 });
  const giver: (BagEntry | null)[] = Array(60).fill(null);
  giver[30] = stone('enhance', 2);
  const plan = planSwap({ ...side('A', giver), offers: [{ slot: 30, entry: stone('enhance', 2) }] }, side('B', bag));
  ok(!plan.ok && plan.who === 'b' && plan.msg.includes('ประเภทใช้งาน'), 'trade: a full usable tab refuses stones, and says which tab');
}

// ---------------------------------------------------------------- buying slots (hidden: off in the code)
{
  const c = codeBagExpand();
  ok(!c.on && typeof nextExpand(c, { gear: 30, use: 30 }, 'gear') === 'string', 'slot buying is off in the code');
  const on = { ...c, on: true };
  const first = nextExpand(on, { gear: 30, use: 30 }, 'use');
  const third = nextExpand(on, { gear: 30, use: 50 }, 'use');
  ok(typeof first !== 'string' && first.add === 10 && first.gold === 10_000 && first.crystal === 100, 'first buy: +10 for 10,000 G or 100 crystals');
  ok(typeof third !== 'string' && third.gold === 40_000 && third.crystal === 100, 'gold doubles each buy, crystals stay 100');
  ok(typeof nextExpand(on, { gear: 90, use: 30 }, 'gear') === 'string', 'no buying past 90');

  const data = newCharacterData('Buyer', 'sword');
  data.gold = 25_000;
  const p = sim.addPlayer(data);
  ok(!sim.bagExpandGold(p, 'use', 10_000) && p.bagSlots.use === 30, 'switched off: the server refuses');
  applyBalance(checkBalance({ bagExpand: { on: true } }, true).tuning!);
  ok(!sim.bagExpandGold(p, 'use', 9_999) && p.gold === 25_000, 'a price that doesn\'t match is refused');
  ok(sim.bagExpandGold(p, 'use', 10_000) && p.bagSlots.use === 40 && p.bag.length === 70 && p.gold === 15_000, 'buying 10 usable slots with gold');
  const useBefore = JSON.stringify(p.bag.slice(...tabRange(p.bagSlots, 'use')));
  ok(sim.bagExpandGold(p, 'gear', 10_000) && p.gold === 5_000 && p.bagSlots.gear === 40, 'the gear tab has its own count (first buy 10,000)');
  ok(inTabs(p.bag, p.bagSlots) && JSON.stringify(p.bag.slice(...tabRange(p.bagSlots, 'use'))) === useBefore, 'buying gear slots shifts the usable tab up intact');
  ok(!sim.bagExpandGold(p, 'use', 20_000) && p.bagSlots.use === 40, 'not enough gold: refused');
  ok(checkBalance({ bagExpand: { step: 0 } }, true).error !== undefined && checkBalance({ bagExpand: { on: false } }, true).tuning!.bagExpand === undefined, '/admin values are checked, code values are not stored');
  applyBalance({});
  ok(freeCount(p.bag, p.bagSlots, 'use') === 40 - p.bag.slice(...tabRange(p.bagSlots, 'use')).filter(Boolean).length, 'freeCount counts the usable tab');
}

finish('bag-tabs');
