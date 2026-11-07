// Gear places: the new kinds, two rings, stats and saves. Runs on the shared rules, no server needed.
import { ITEM_ART, ITEM_BASES, itemClass, makeItem, rollItem, starterArt } from '../src/shared/data/items';
import { newCharacterData, Player } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES } from '../src/shared/data/zones';
import { cleanStash } from '../src/shared/sim/stash';
import { CLASS_IDS } from '../src/shared/data/classes';
import { EQUIP_SLOTS, SLOTS, type EquipSlot, type Item, type SlotId } from '../src/shared/types';
import { finish, ok } from './check';

const make = (baseId: string, level = 30, cls: 'sword' | 'mage' | 'gunslinger' = 'sword'): Item =>
  makeItem(baseId, 'common', level, cls)!;

function player(bag: Item[], cls: 'sword' | 'mage' | 'gunslinger' = 'sword', equipment: Partial<Record<EquipSlot, Item>> = {}): Player {
  const data = newCharacterData('T', cls);
  data.level = 30;
  data.equipment = equipment;
  data.bag = bag;
  return new Player(1, {} as Sim, data);
}

// Item table
const ids = ITEM_BASES.map((b) => b.id);
ok(new Set(ids).size === ids.length, 'item kinds have unique ids');
const newSlots: SlotId[] = ['necklace', 'gloves', 'belt', 'offhand'];
for (const s of ['necklace', 'gloves', 'belt']) {
  ok(ITEM_BASES.filter((b) => b.slot === s).length === 3, `${s} has 3 kinds`);
}
ok(ITEM_BASES.filter((b) => b.slot === 'offhand').length === 9, 'off-hands: 3 kinds per class');
ok(ITEM_ART.length === new Set(ITEM_ART).size, 'item pictures have unique names');

// Off-hands belong to one class
for (const cls of CLASS_IDS) {
  const seen = new Set<string>();
  for (let n = 0; n < 4000; n++) {
    const it = rollItem(Math.random, 30, cls);
    seen.add(it.slot);
    if (it.slot === 'offhand') ok(itemClass(it) === cls, `${cls} only rolls its own off-hand`);
    if (it.name === it.baseId) ok(false, `rolled item has a real name: ${it.baseId}`);
  }
  for (const s of newSlots) ok(seen.has(s), `${cls} can roll ${s}`);
  for (const s of EQUIP_SLOTS) ok(starterArt(s, cls).startsWith('item_'), `empty ${s} has a picture for ${cls}`);
}
const foreign = make('scabbard_1', 30, 'mage');
ok(foreign.cls === 'sword' && foreign.name === 'Worn Scabbard', 'a scabbard stays a sword item even if made for a mage');
ok(!!player([], 'mage').equipBlock(foreign), 'a mage cannot wear a scabbard');

// Each new place wears and removes, and the stats add up
{
  const items = [make('necklace_3'), make('gloves_3'), make('belt_3'), make('scabbard_3')];
  const p = player(items.slice());
  const before = { ...p.stats };
  for (let i = 0; i < items.length; i++) p.equipFromBag(i);
  for (const it of items) ok(p.equipment[it.slot] === it, `${it.slot} is worn`);
  ok(p.bag.slice(0, 4).every((x) => !x), 'worn items left the bag');
  const sum = (k: 'maxHp' | 'maxMp' | 'atk' | 'def' | 'crit' | 'atkSpeed') =>
    items.reduce((s, it) => s + (it.stats[k] ?? 0), 0);
  for (const k of ['maxHp', 'maxMp', 'atk', 'def', 'crit', 'atkSpeed'] as const) {
    ok(p.stats[k] === before[k] + sum(k), `${k} includes the new gear`);
  }
  for (const it of items) p.unequip(it.slot);
  ok(p.stats.atk === before.atk && p.stats.maxHp === before.maxHp, 'removing them restores the stats');
  ok(p.bag.filter(Boolean).length === 4, 'removed items are back in the bag');
}

// Two rings
{
  const [a, b, c, d] = [make('ring_frost'), make('ring_jade'), make('ring_wisp'), make('ring_copper')];
  const p = player([a, b, c, d]);
  p.equipFromBag(0);
  ok(p.equipment.ring === a && !p.equipment.ring2, 'first ring goes to ring 1');
  p.equipFromBag(1);
  ok(p.equipment.ring === a && p.equipment.ring2 === b, 'second ring goes to the free ring 2');
  p.equipFromBag(2);
  ok(p.equipment.ring === c && p.equipment.ring2 === b && p.bag[2] === a, 'with both worn a click replaces ring 1');
  p.equipFromBag(3, 'ring2');
  ok(p.equipment.ring2 === d && p.bag[3] === b, 'a chosen place replaces that ring');
  ok(p.stats.maxHp > player([]).stats.maxHp, 'both rings count');
  p.unequip('ring2');
  ok(!p.equipment.ring2 && p.equipment.ring === c, 'ring 2 comes off alone');
  ok(p.bag.includes(d), 'ring 2 is back in the bag');
}

// Values from the client are checked
{
  const ring = make('ring_frost');
  const helm = make('helm');
  const p = player([ring, helm]);
  for (const bad of ['weapon', 'ring3', '__proto__', 5, null, {}]) p.equipFromBag(0, bad);
  ok(p.bag[0] === ring && !p.equipment.ring && !p.equipment.ring2, 'a ring ignores places it cannot go');
  p.equipFromBag(1, 'ring2');
  ok(p.bag[1] === helm && !p.equipment.ring2, 'a helmet cannot go in a ring place');
}

// Old saves: everything they wear stays where it is
{
  const old = { weapon: make('weapon_7'), helmet: make('helm'), armor: make('glacier'), boots: make('boots'), ring: make('ring_frost') };
  const p = player([], 'sword', old);
  for (const [s, it] of Object.entries(old)) ok(p.equipment[s as SlotId] === it, `old save keeps ${s}`);
  ok(!p.equipment.ring2, 'old save has an empty ring 2');
  ok(EQUIP_SLOTS.length === SLOTS.length + 1, 'ring 2 is the only extra place');
}

// Stash keeps the new kinds, and no item can claim to be a ring 2
{
  const items = [make('necklace_1'), make('pouch_1', 30, 'gunslinger'), { ...make('ring_jade'), slot: 'ring2' }];
  const s = cleanStash({ size: 30, items });
  ok((s.items[0] as Item | null)?.uid === items[0].uid && (s.items[1] as Item | null)?.uid === items[1].uid, 'stash keeps new kinds');
  ok(s.items[2] === null, 'stash refuses an item whose kind is ring 2');
}

// Stash, merchant and ground work the same for the new kinds (on a real zone, standing next to each NPC)
{
  const sim = new Sim(Object.values(ZONES)[0]);
  const data = newCharacterData('T', 'sword');
  data.level = 30;
  const items = [make('necklace_3'), make('gloves_3'), make('belt_3')];
  data.bag = items.slice();
  const p = sim.addPlayer(data);
  const stand = (id: 'keeper' | 'merchant') => {
    const near = (sim as unknown as { near(p: Player, id: string): boolean }).near.bind(sim);
    for (let x = -60; x <= 60; x++) for (let z = -60; z <= 60; z++) {
      p.x = x;
      p.z = z;
      if (near(p, id)) return;
    }
  };
  const bagAt = (it: Item) => p.bag.findIndex((x) => (x as Item | null)?.uid === it.uid);
  stand('keeper');
  ok(sim.stashPut(p, 0), 'a necklace goes into the stash');
  const inStash = p.stash.items.findIndex((x) => (x as Item | null)?.uid === items[0].uid);
  ok(inStash >= 0 && bagAt(items[0]) < 0, 'it moved from the bag to the stash');
  ok(sim.stashTake(p, inStash) && bagAt(items[0]) >= 0, 'and comes back to the bag');
  stand('merchant');
  const gloves = bagAt(items[1]);
  ok(sim.sellItem(p, gloves) > 0 && !p.bag[gloves], 'gloves sell at the merchant');
  const belt = bagAt(items[2]);
  ok(sim.dropFromBag(p, belt) && !p.bag[belt], 'a belt drops on the ground');
}

finish('equip slots');
