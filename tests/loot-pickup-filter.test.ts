// Pickup filter (owner 2026-11-28, docs/systems/loot-pickup-filter.md): categories, gear rarity / tier / level,
// /admin defaults for players who never set it, server-side cleaning, and that Auto, walking over loot and the pet all obey it.
import { ok, finish } from './check';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { Loot, lootCat, type LootKind } from '../src/shared/sim/Loot';
import { DEFAULT_LOOT_FILTER, gearPasses, lootPick } from '../src/shared/sim/Player';
import { tickPetLoot } from '../src/shared/sim/petLoot';
import { applyBalance, balanceChanges, checkBalance, currentBalance } from '../src/shared/balance';
import { cleanPickup, LOOT_CATS, LOOT_LV_MAX, LOOT_TIER_ANY } from '../src/shared/autoTuning';
import { CARD_IDS } from '../src/shared/data/cards';
import { RARITIES, type Item, type StatTier } from '../src/shared/types';

const gear = (o: { level?: number; rarity?: Item['rarity']; tiers?: StatTier[] } = {}): Item => ({
  uid: `u${Math.random()}`, baseId: 'x', name: 'x', slot: 'weapon', rarity: o.rarity ?? 'rare', level: o.level ?? 10, stats: {}, value: 1,
  lines: o.tiers?.map((tier) => ({ stat: 'str', value: 1, tier, min: 0, max: 1 })) as Item['lines'],
});
const item = (o: Parameters<typeof gear>[0] = {}): LootKind => ({ type: 'item', item: gear(o) });
const stone = (k: string): LootKind => ({ type: 'stone', stone: k as never, count: 1 });
const POT: LootKind = { type: 'potion', pot: 'hp', size: 's', count: 1 };
const GOLD: LootKind = { type: 'gold', amount: 5 };

// ---- categories
ok(lootCat(GOLD) === null, 'gold has no category (always picked up)');
ok(lootCat(item()) === 'gear' && lootCat(POT) === 'potion', 'gear and potions');
ok(lootCat(stone('enhance')) === 'stone' && lootCat(stone('protect')) === 'stone', 'blacksmith stones');
ok(lootCat(stone(CARD_IDS[0])) === 'card', 'monster cards');
ok(lootCat(stone('key_bear')) === 'key' && lootCat(stone('qkey_bear')) === 'key', 'boss and quest keys');
ok(lootCat(stone('return_scroll')) === 'scroll' && lootCat(stone('exp_scroll')) === 'scroll', 'return and buff scrolls');
ok(lootCat(stone('mystery_box')) === 'box', 'mystery box');
ok(lootCat(stone('phoenix')) === 'other' && lootCat(stone('orb_1')) === 'other' && lootCat(stone('megaphone')) === 'other', 'the rest is "other"');

// ---- old saves: everything picked up
const sim = new Sim(ZONE_1);
const p = sim.addPlayer({ name: 'A', classId: 'sword', level: 30, exp: 0, gold: 0, equipment: {}, bag: [] });
ok(p.lootFilter.pick === undefined, 'a save without the new filter keeps no own pickup settings');
ok(LOOT_CATS.every((c) => lootPick(p.lootFilter).cats.includes(c)), 'old save: every category on');
ok([item(), POT, stone('enhance'), stone(CARD_IDS[0]), stone('key_bear'), stone('return_scroll'), stone('mystery_box'), stone('phoenix'), GOLD]
  .every((k) => p.wantsLoot(k, false)), 'old save: picks up everything');
const q = sim.addPlayer({ name: 'B', classId: 'mage', level: 30, exp: 0, gold: 0, equipment: {}, bag: [], lootFilter: { ...DEFAULT_LOOT_FILTER } });
ok(q.lootFilter.pick === undefined && p.wantsLoot(stone('mystery_box'), false), 'a save from before `pick` loads fine');

// ---- the player's own settings (cleaned by the server)
const set = (pick: unknown) => sim.setLootFilter(p, { rarities: [...RARITIES], potions: true, pick: pick as never });
set({ cats: ['gear', 'potion', 'bogus', 'gear'], gearTier: 9, gearLvMin: 50, gearLvMax: 5 });
const own = p.lootFilter.pick!;
ok(own.cats.join() === 'gear,potion', 'unknown and repeated categories are dropped');
ok(own.gearTier === LOOT_TIER_ANY, 'tier clamped to 1–5');
ok(own.gearLvMin === 5 && own.gearLvMax === 50, 'min above max is swapped');
ok(!p.wantsLoot(stone('mystery_box'), false) && !p.wantsLoot(stone(CARD_IDS[0]), false) && !p.wantsLoot(stone('key_bear'), false),
  'unticked categories are left on the ground');
ok(p.wantsLoot(GOLD, false), 'gold is always picked up');
ok(p.wantsLoot(stone('mystery_box'), true), 'something a player threw away is always picked up');
ok(p.wantsLoot(item({ level: 20 }), false) && !p.wantsLoot(item({ level: 4 }), false) && !p.wantsLoot(item({ level: 51 }), false), 'gear level range');
set({ cats: [], gearTier: 1, gearLvMin: 1, gearLvMax: LOOT_LV_MAX });
ok(![item(), POT, stone('enhance')].some((k) => p.wantsLoot(k, false)), 'nothing ticked: only gold');
set('nope');
ok(p.lootFilter.pick?.cats.length === 0, 'a client sending junk keeps the old own settings');
sim.setLootFilter(p, { rarities: [...RARITIES], potions: true });
ok(p.lootFilter.pick?.cats.length === 0, 'an older page without `pick` keeps the own settings');

// ---- gear tier and rarity
const pickT2 = cleanPickup({ cats: ['gear'], gearTier: 2, gearLvMin: 1, gearLvMax: LOOT_LV_MAX });
ok(gearPasses(gear({ tiers: [4, 2] }), RARITIES, pickT2), 'a T2 line passes "T2 or better"');
ok(!gearPasses(gear({ tiers: [3, 4] }), RARITIES, pickT2), 'best line T3 fails "T2 or better"');
ok(gearPasses(gear({}), RARITIES, pickT2), 'gear without tiers always passes');
ok(!gearPasses(gear({ rarity: 'common' }), ['rare'], cleanPickup({})), 'rarity filter still applies');
ok(gearPasses(gear({ tiers: [5] }), RARITIES, cleanPickup({ gearTier: LOOT_TIER_ANY })), 'tier 5 = any');
// Potion sizes still apply under the potion category.
sim.setLootFilter(p, { rarities: [...RARITIES], potions: true, pots: { hp: ['m'], mp: [] }, pick: cleanPickup({}) });
ok(!p.wantsLoot(POT, false) && p.wantsLoot({ ...POT, size: 'm' } as LootKind, false), 'potion sizes still filter');

// ---- /admin defaults
const tun = checkBalance({ auto: { pickup: { cats: ['gear', 'potion'], gearTier: 3 } } }, true);
ok(!('error' in tun), 'admin pickup defaults are accepted');
applyBalance(('tuning' in tun && tun.tuning) || {});
ok(currentBalance().auto.pickup.cats.join() === 'gear,potion' && currentBalance().auto.pickup.gearTier === 3, 'admin defaults applied');
ok(!q.wantsLoot(stone('mystery_box'), false) && q.wantsLoot(POT, false), 'a player who never set it follows the admin default at once');
ok(p.wantsLoot(stone('mystery_box'), false), 'a player with own settings keeps them');
ok(balanceChanges({}, ('tuning' in tun && tun.tuning) || {}).includes('ตัวกรองเก็บของ'), 'the audit log names the change');
const bad = [
  { auto: { pickup: { cats: ['nope'] } } },
  { auto: { pickup: { gearTier: 0 } } },
  { auto: { pickup: { gearLvMax: LOOT_LV_MAX + 1 } } },
  { auto: { pickup: { extra: 1 } } },
];
ok(bad.every((b) => 'error' in checkBalance(b, true)), 'strict check rejects bad admin values');
const same = checkBalance({ auto: { pickup: { cats: [...LOOT_CATS], gearTier: LOOT_TIER_ANY } } }, true);
ok('tuning' in same && !same.tuning?.auto, 'values equal to the code are not saved');

// ---- Auto, walking over loot and the pet all use it
applyBalance({});
sim.setLootFilter(p, { rarities: [...RARITIES], potions: true, pick: cleanPickup({ cats: ['gear'] }) });
let id = 990000;
const landed = (kind: LootKind, dx = 0): Loot => {
  const l = new Loot(id++, p.x + dx, p.z, p.x, p.z, kind, { owner: p.id, ownerUntil: sim.time + 10 });
  l.t = 5;
  sim.loots.push(l);
  return l;
};
const box = landed(stone('mystery_box'));
const sword = landed(item({ level: 10 }));
for (let i = 0; i < 20; i++) {
  box.update(0.05, sim);
  sword.update(0.05, sim);
}
ok(!box.dead && sword.dead, 'walking over loot: the box stays, the gear is picked up');
sim.loots.length = 0;
p.cosmetics = { pet: 'pet_cat' };
p.petLootCd = 0;
const box2 = landed(stone('mystery_box'), 3);
for (let i = 0; i < 20; i++) tickPetLoot(sim, 0.1);
ok(!box2.dead, 'the pet leaves filtered drops alone');

finish('loot-pickup-filter');
