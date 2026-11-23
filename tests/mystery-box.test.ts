// Mystery box (src/shared/mysteryBox.ts): the odds match the owner's table, the roll follows them, the /admin
// checks hold, and opening in the Sim gives the prize and keeps orb items working. Shared rules, no server.
import { cashBuyError, cashCatalog, emptyCashShop } from '../src/shared/cashShop';
import { BOX_OPEN_COOLDOWN, MYSTERY_BOX_STACK, STONE_NAME, STONE_STACK } from '../src/shared/data/stones';
import { ZONES } from '../src/shared/data/zones';
import {
  BOX_ROWS, boxConfig, boxOdds, cleanBoxOverrides, rollBoxRow, setBoxConfig, setBoxHiddenCos, boxOrbs, type BoxOverrides,
} from '../src/shared/mysteryBox';
import { registerOrbItems } from '../src/shared/orbItems';
import { DEFAULT_ORB_LOOK } from '../src/shared/orbLook';
import { mulberry32 } from '../src/shared/rng';
import { marketKind, marketSellable } from '../src/shared/sim/market';
import { newCharacterData, sortEntries } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { cleanStash } from '../src/shared/sim/stash';
import { isItem, isStone, type StoneStack } from '../src/shared/types';
import { finish, ok } from './check';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const pctOf = (odds: ReturnType<typeof boxOdds>, id: string) => odds.find((x) => x.row.id === id)?.pct;

// ---------------------------------------------------------------- the owner's table
const cfg = boxConfig();
ok(cfg.enabled === true, 'the box drops from the start (the owner can switch it off)');
ok(cfg.mobPct === 0.5 && cfg.bossPct === 20, 'drops: monster 0.5%, boss 20%');
const odds = boxOdds(cfg, 4);
ok(near(odds.reduce((a, x) => a + x.pct, 0), 100), 'chances add up to 100%');
ok(pctOf(odds, 'gear_epic') === 10 && pctOf(odds, 'gear_legendary') === 5, 'epic 10%, legendary 5%');
ok(['stone_key_bear', 'stone_key_witch', 'stone_key_yeti', 'stone_key_heart'].every((id) => pctOf(odds, id) === 2.5), 'boss keys 2.5% each (10% in all)');
ok(pctOf(odds, 'stone_enhance') === 3 && pctOf(odds, 'stone_protect') === 3, 'enhance / protect 3%');
ok(pctOf(odds, 'stone_reroll_values') === 5 && pctOf(odds, 'stone_reroll_stat') === 5, 'reroll stones 5%');
ok(pctOf(odds, 'stone_exp_scroll') === 1 && pctOf(odds, 'stone_drop_scroll') === 1 && pctOf(odds, 'stone_megaphone') === 2, 'scrolls 1%, megaphone 2%');
ok(pctOf(odds, 'gold_big') === 1 && pctOf(odds, 'orb') === 0.05, '1,000,000 G 1%, orbs 0.05% together');
for (const id of ['gear_rare', 'gold_small', 'pot_hp_l', 'pot_mp_l', 'stone_return_scroll', 'stone_phoenix']) {
  ok(near(pctOf(odds, id) ?? 0, 53.95 / 6), `${id}: shares the rest (${(53.95 / 6).toFixed(4)}%)`);
}
ok(['gear_common', 'gear_uncommon', 'pot_hp_s', 'stone_qkey_bear'].every((id) => pctOf(odds, id) === undefined), 'rows switched off are not in the box');
const row = (id: string) => BOX_ROWS.find((r) => r.id === id)!;
ok(row('pot_hp_l').count === 5 && row('pot_mp_l').count === 5, 'large potions: 5 a time');
ok(row('stone_phoenix').count === 1 && row('stone_return_scroll').count === 1, 'phoenix / return scroll: 1 a time');
ok(row('gold_small').count === 10_000 && row('gold_big').count === 1_000_000, 'gold 10,000 and 1,000,000');
ok(row('orb').announce && BOX_ROWS.filter((r) => r.announce).length === 1, 'only orbs are announced by default');

// No orbs to give: the orb row is left out and its 0.05% goes to the shared rows.
const noOrb = boxOdds(cfg, 0);
ok(pctOf(noOrb, 'orb') === undefined && near(pctOf(noOrb, 'gear_rare') ?? 0, 54 / 6), 'no orbs: their 0.05% goes to the rest');

// ---------------------------------------------------------------- the roll follows the odds
const N = 400_000;
const r = mulberry32(12345);
const seen = new Map<string, number>();
for (let i = 0; i < N; i++) {
  const got = rollBoxRow(odds, r)!;
  seen.set(got.id, (seen.get(got.id) ?? 0) + 1);
}
let worst = 0;
for (const x of odds) {
  const p = x.pct / 100;
  const got = (seen.get(x.row.id) ?? 0) / N;
  // Within 5 standard deviations (and never seen when off).
  const z = Math.abs(got - p) / Math.sqrt((p * (1 - p)) / N);
  worst = Math.max(worst, z);
  if (z > 5) ok(false, `${x.row.id}: rolled ${(got * 100).toFixed(4)}% vs ${x.pct.toFixed(4)}%`);
}
ok(worst <= 5, `${N.toLocaleString()} rolls follow every row's chance (worst ${worst.toFixed(2)} sd)`);
ok([...seen.keys()].every((id) => odds.some((x) => x.row.id === id)), 'nothing outside the table came out');

// ---------------------------------------------------------------- /admin checks
const over = cleanBoxOverrides({ rows: { gear_epic: { pct: 60 }, gear_legendary: { pct: 50 } } });
ok(typeof over === 'string' && over.includes('เกิน 100%'), 'fixed chances over 100% are refused');
ok(typeof cleanBoxOverrides({ rows: { nope: {} } }) === 'string', 'unknown row refused');
ok(typeof cleanBoxOverrides({ rows: { pot_hp_l: { count: 11 } } }) === 'string', 'potion amount over 10 refused');
ok(typeof cleanBoxOverrides({ mobPct: -1 }) === 'string', 'negative drop chance refused');
const same = cleanBoxOverrides({ enabled: true, mobPct: 0.5, rows: { gear_epic: { pct: 10, on: true } } });
ok(typeof same !== 'string' && JSON.stringify(same) === '{}', 'values equal to the code are not stored');
const mine = cleanBoxOverrides({ enabled: false, rows: { gear_epic: { pct: null }, gear_common: { on: true } } }) as BoxOverrides;
const mineOdds = boxOdds(boxConfig(mine), 4);
ok(typeof mine !== 'string' && !boxConfig(mine).enabled, 'owner changes kept');
ok(near(pctOf(mineOdds, 'gear_epic')!, pctOf(mineOdds, 'gear_common')!) && near(mineOdds.reduce((a, x) => a + x.pct, 0), 100), 'a row set to share the rest shares it equally');
const noShare = cleanBoxOverrides({ rows: Object.fromEntries(BOX_ROWS.map((x) => [x.id, { on: x.id === 'gear_epic' || x.id === 'gear_legendary' }])) }) as BoxOverrides;
const two = boxOdds(boxConfig(noShare), 4);
ok(two.length === 2 && near(pctOf(two, 'gear_epic')!, 100 * 10 / 15), 'no share rows: fixed chances are scaled to 100%');

// ---------------------------------------------------------------- opening in the Sim
registerOrbItems([{ id: 'orb_1', n: 1, name: 'Prism Star', look: DEFAULT_ORB_LOOK }, { id: 'orb_2', n: 2, name: 'Flame Spirit', look: DEFAULT_ORB_LOOK }]);
setBoxHiddenCos(['orb_2']);
ok(JSON.stringify(boxOrbs()) === '["orb_1"]', 'hidden orbs do not come out');
const sim = new Sim(Object.values(ZONES)[0]);
const data = newCharacterData('T', 'mage');
data.level = 20;
data.bag = [{ stone: 'mystery_box', count: 3 }];
const p = sim.addPlayer(data);
/** First slot of the usable tab, where the boxes are (src/shared/bagTabs.ts). */
const U = p.bagSlots.gear;
setBoxConfig({ enabled: false });
ok(sim.openBox(p, U, false).length === 0 && (p.bag[U] as StoneStack).count === 3, 'box switched off: nothing opens');
setBoxConfig({ enabled: true, rows: { orb: { pct: 100 } } });
const ann = sim.openBox(p, U, false, mulberry32(1));
ok((p.bag[U] as StoneStack).count === 2, 'opening one uses one box');
const orbItem = p.bag.find((e) => isStone(e) && e.stone === 'orb_1') as StoneStack | undefined;
ok(!!orbItem && ann.length === 1 && ann[0] === STONE_NAME.orb_1 && STONE_NAME.orb_1 === 'ลูกแก้ว Prism Star', 'an orb prize: the orb item in the bag, announced');
ok(marketSellable(orbItem) && marketKind(orbItem!) === 'cosmetic', 'orb items go on the market under ของแต่งตัว');
setBoxConfig({ enabled: true, rows: Object.fromEntries(BOX_ROWS.map((x) => [x.id, { on: x.id === 'gear_legendary' }])) });
sim.time += 1; // past the opening cooldown
sim.openBox(p, U, true, mulberry32(2));
ok(!p.bag.some((e) => isStone(e) && e.stone === 'mystery_box') && p.bag.filter((e) => isItem(e) && e.rarity === 'legendary' && e.level === 20).length === 2, 'right click: the whole stack opens, gear at the opener\'s level');
p.bag.fill(null);
p.bag[U] = { stone: 'mystery_box', count: 2 };
for (let i = 0; i < p.bag.length; i++) if (i !== U) p.bag[i] = { potion: 'hp', size: 's', count: 10 };
sim.time += 1;
sim.openBox(p, U, true);
ok((p.bag[U] as StoneStack).count === 2, 'full bag: nothing opens, boxes kept');

// Owner 2026-11-23: one opening per 0.2 s (server-side, in the Sim), boxes stack to 100.
ok(BOX_OPEN_COOLDOWN === 0.2 && MYSTERY_BOX_STACK === 100, 'box constants: 0.2 s, 100 per slot');
setBoxConfig({ enabled: true, rows: Object.fromEntries(BOX_ROWS.map((x) => [x.id, { on: x.id === 'gold_small' }])) });
p.bag.fill(null);
p.bag[U] = { stone: 'mystery_box', count: 5 };
sim.time += 10;
sim.openBox(p, U, false, mulberry32(3));
ok((p.bag[U] as StoneStack).count === 4, 'cooldown: first opening works');
sim.openBox(p, U, false, mulberry32(3));
sim.openBox(p, U, true, mulberry32(3));
ok((p.bag[U] as StoneStack).count === 4, 'cooldown: openings within 0.2 s are ignored (one or the whole stack)');
sim.time += 0.1;
sim.openBox(p, U, false, mulberry32(3));
ok((p.bag[U] as StoneStack).count === 4, 'cooldown: still ignored after 0.1 s');
sim.time += 0.11;
sim.openBox(p, U, false, mulberry32(3));
ok((p.bag[U] as StoneStack).count === 3, 'cooldown: opens again after 0.2 s');
p.bag.fill(null);
ok(p.addStones('mystery_box', 250) && (p.bag[U] as StoneStack).count === 100 && (p.bag[U + 1] as StoneStack).count === 100 && (p.bag[U + 2] as StoneStack).count === 50, 'boxes stack to 100 per slot');
ok(p.stoneRoom('mystery_box') === 100 * (p.bagSlots.use - 3) + 50, 'box room counts 100 per free usable slot');
p.bag.fill(null);
p.addStones('reroll_stat', 25);
ok((p.bag[U] as StoneStack).count === STONE_STACK, 'other stones still stack to 10');

// Orb item to the account.
p.bag.fill(null);
p.bag[U] = { stone: 'orb_1', count: 2 };
const owned = new Set<string>();
sim.useOrbItem(p, U, (id) => owned.has(id), (id) => (owned.add(id), true));
ok(owned.has('orb_1') && (p.bag[U] as StoneStack).count === 1, 'using an orb item gives the orb to the account');
sim.useOrbItem(p, U, (id) => owned.has(id), () => true);
ok((p.bag[U] as StoneStack).count === 1, 'already owned: the item is kept');

// Saves, stash and sorting keep orb items.
ok(JSON.stringify(cleanStash({ size: 30, items: [{ stone: 'orb_1', count: 2 }], gold: 0 }).items[0]) === '{"stone":"orb_1","count":2}', 'stash keeps orb items');
ok(cleanStash({ size: 30, items: [{ stone: 'orb_x', count: 2 }], gold: 0 }).items[0] === null, 'stash drops a bad kind');
const sorted = sortEntries([{ stone: 'orb_1', count: 1 }, null, { stone: 'orb_1', count: 2 }, { stone: 'mystery_box', count: 1 }], 'rarity', false);
ok(sorted.some((e) => isStone(e) && e.stone === 'orb_1' && e.count === 3) && sorted.some((e) => isStone(e) && e.stone === 'mystery_box'), 'sorting keeps and merges orb items');

// Cash shop: orbs show "from the box" and can't be bought.
const shop = emptyCashShop();
shop.open = true;
const cat = cashCatalog(shop, { orb_1: { price: 3000 } }, Date.now(), true);
const orbEntry = cat.items.find((e) => e.ref === 'orb_1');
ok(!!orbEntry?.fromBox, 'cash shop: the orb is listed as from the box');
ok(cashBuyError(cat, orbEntry!.id, 1, 0, { crystals: 99999, bought: {} }, [], false, Date.now()) !== null, 'cash shop: an orb from the box can\'t be bought');
ok(!cashCatalog(shop, { orb_1: { price: 3000 } }, Date.now(), false).items.find((e) => e.ref === 'orb_1')?.fromBox, 'switch on: orbs sell again');

finish('mystery-box');
