// The "while you were away" Auto summary (owner 2026-11-27): the Auto run's tally counts EXP, levels, gold, kills,
// items by rarity, stones, potions and deaths only while Auto is on; a new Auto start is a fresh tally; the browser
// shows "now minus when you last touched the game". The /admin switch and minutes. On a real Sim, no server.
import { ok, finish } from './check';
import { Sim } from '../src/shared/sim/Sim';
import { Loot } from '../src/shared/sim/Loot';
import { ZONE_1 } from '../src/shared/data/zones';
import { makeItem } from '../src/shared/data/items';
import { AutoPlay } from '../src/shared/sim/autoplay';
import { copyTally, emptyTally, tallySince } from '../src/shared/sim/autoTally';
import { applyBalance, checkBalance, currentBalance } from '../src/shared/balance';
import { autoChanges, codeAuto, mergeAuto } from '../src/shared/autoTuning';
import { expToNext, MAX_LEVEL } from '../src/shared/formulas';
import { CARD_IDS } from '../src/shared/data/cards';

const sim = new Sim(ZONE_1);
const p = sim.addPlayer({ name: 'T', classId: 'sword', level: 5, exp: 0, gold: 0, equipment: {}, bag: [] });
const auto = new AutoPlay();
auto.start(p.x, p.z);
let ids = 95000;
const lootAt = (kind: Loot['kind']) => {
  const l = new Loot(ids++, p.x, p.z, p.x, p.z, kind, { ownerUntil: 0 });
  sim.loots.push(l);
  return l;
};
const kill = () => {
  const m = sim.monsters.find((x) => x.alive && !x.isBoss)!;
  m.hp = 1;
  sim.hitMonster(p, m, 50);
  return m;
};

// ---- Auto off: nothing is counted
p.autoTally = auto.tally;
p.autoOn = false;
kill();
sim.pickup(p, lootAt({ type: 'gold', amount: 100 }));
ok(auto.tally.kills === 0 && auto.tally.gold === 0 && auto.tally.exp === 0, 'Auto off: the tally stays empty');

// ---- Auto on: counted
p.autoOn = true;
const gold0 = p.gold;
kill();
ok(auto.tally.kills === 1, 'a kill with Auto on is counted');
ok(auto.tally.exp > 0, 'its EXP is counted');
sim.pickup(p, lootAt({ type: 'gold', amount: 250 }));
ok(auto.tally.gold === 250 && p.gold === gold0 + 250, 'gold picked up is counted');
sim.pickup(p, lootAt({ type: 'item', item: makeItem('weapon_1', 'rare', 5, 'sword')! }));
sim.pickup(p, lootAt({ type: 'item', item: makeItem('weapon_1', 'common', 5, 'sword')! }));
ok(auto.tally.items[2] === 1 && auto.tally.items[0] === 1, 'items are counted by rarity');
sim.pickup(p, lootAt({ type: 'potion', pot: 'hp', size: 's', count: 3 }));
ok(auto.tally.potGot === 3, 'potions picked up are counted');
const lv0 = p.level;
for (let i = 0; i < 400 && p.level === lv0; i++) kill();
ok(p.level > lv0 && auto.tally.lv === p.level - lv0, 'levels gained are counted');

// ---- the browser's sum: since the last touch
const base = copyTally(auto.tally);
kill();
const d = tallySince(auto.tally, base);
ok(d.kills === 1 && d.gold === 0, 'since the last touch: only what came after');
ok(tallySince(auto.tally, emptyTally(auto.tally.id)).kills === auto.tally.kills, 'from an empty base: the whole run');

// ---- a new start is a new run
const id = auto.tally.id;
auto.start(p.x, p.z);
ok(auto.tally.id !== id && auto.tally.kills === 0, 'switching Auto on again starts a fresh tally');
p.autoTally = auto.tally;

// ---- item by item (owner 2026-11-28): stacks by kind, gear as copies
sim.pickup(p, lootAt({ type: 'potion', pot: 'hp', size: 'm', count: 2 }));
sim.pickup(p, lootAt({ type: 'potion', pot: 'hp', size: 'm', count: 1 }));
sim.pickup(p, lootAt({ type: 'potion', pot: 'mp', size: 's', count: 4 }));
sim.pickup(p, lootAt({ type: 'stone', stone: 'enhance', count: 2 }));
const got = auto.tally.got ?? {};
ok(got['pot:hp:m'] === 3 && got['pot:mp:s'] === 4 && got['st:enhance'] === 2, 'potions and stones are counted by kind');
ok(auto.tally.potGot === 7 && auto.tally.stones === 2, 'the totals still add up');
const rare = makeItem('weapon_1', 'rare', 5, 'sword')!;
sim.pickup(p, lootAt({ type: 'item', item: rare }));
sim.pickup(p, lootAt({ type: 'item', item: makeItem('weapon_1', 'common', 5, 'sword')! }));
ok(auto.tally.gearN === 2 && auto.tally.gear?.length === 2, 'each piece of gear is kept');
ok(auto.tally.gear?.[0].item.uid === rare.uid && auto.tally.gear[0].item !== rare, 'as a copy of the item');
rare.plus = 9;
ok(!auto.tally.gear?.[0].item.plus, 'enhancing it later does not change the summary');

// since the last touch: only the new pieces and the new counts
const base2 = copyTally(auto.tally);
sim.pickup(p, lootAt({ type: 'item', item: makeItem('weapon_1', 'epic', 5, 'sword')! }));
sim.pickup(p, lootAt({ type: 'potion', pot: 'hp', size: 'm', count: 1 }));
const d2 = tallySince(auto.tally, base2);
ok(d2.gear?.length === 1 && d2.gear[0].item.rarity === 'epic' && d2.gearN === 1, 'since the last touch: only the new gear');
ok(d2.got?.['pot:hp:m'] === 1 && d2.got['pot:mp:s'] === undefined && d2.got['st:enhance'] === undefined, 'since the last touch: only the new stacks');
const oldBase = { ...emptyTally(auto.tally.id), got: undefined, gearN: undefined, gear: undefined };
ok(tallySince(auto.tally, oldBase).got?.['pot:hp:m'] === 4, 'a base from before item-by-item counts from zero');

// the /admin cap on gear pictures: the newest are kept, the rest still counted
ok(codeAuto().summaryGear === 100, 'code: 100 gear pictures per run');
applyBalance(checkBalance({ auto: { summaryGear: 10 } }, true).tuning!);
const n0 = auto.tally.gearN ?? 0;
for (let i = 0; i < 12; i++) sim.pickup(p, lootAt({ type: 'item', item: makeItem('weapon_1', 'common', 5, 'sword')! }));
ok(auto.tally.gearN === n0 + 12 && auto.tally.gear?.length === 10, 'past the cap: counted, but only 10 pictures');
ok(auto.tally.gear?.[0].n === n0 + 3, 'the oldest pictures go first');
ok('error' in checkBalance({ auto: { summaryGear: 5 } }, true), 'a cap below 10 is refused');
applyBalance(checkBalance({}, true).tuning!);

// ---- cards go straight to the bag: counted too
(sim as unknown as { grantCard(p: unknown, id: string): void }).grantCard(p, CARD_IDS[0]!);
ok(auto.tally.got?.[`st:${CARD_IDS[0]}`] === 1, 'a card dropped to the bag is counted');

// ---- EXP really gained (owner 2026-11-28: the summary showed +0 after 50 kills)
const killFor = (expReward?: number) => {
  const m = sim.monsters.find((x) => x.alive && !x.isBoss)!;
  if (expReward !== undefined) (m as unknown as { expReward: number }).expReward = expReward;
  m.hp = 1;
  sim.hitMonster(p, m, 50);
};
p.level = 5;
p.exp = 0;
p.bossKills = [];
let e0 = auto.tally.exp;
killFor(1);
ok(auto.tally.exp - e0 >= 1, 'a 1-EXP kill with Auto on still gives 1 EXP (it used to halve down to 0)');
// a boss gate: the bar is full, nothing counts, and the summary says why
p.level = 10;
p.exp = expToNext(10);
e0 = auto.tally.exp;
const lost0 = auto.tally.expLost ?? 0;
killFor();
ok(auto.tally.exp === e0 && (auto.tally.expLost ?? 0) > lost0, 'at a boss gate: EXP that is lost is not counted as gained');
ok(auto.tally.expWhy === 'gate:หมี', 'and the reason names the boss');
// the level cap
p.level = MAX_LEVEL;
e0 = auto.tally.exp;
killFor();
ok(auto.tally.exp === e0 && auto.tally.expWhy === 'max', 'at the level cap: nothing counted, reason "max"');

// ---- /admin: switch and minutes
ok(codeAuto().summary === true && codeAuto().summaryMin === 3, 'code: on, 3 minutes');
applyBalance(checkBalance({ auto: { summary: false, summaryMin: 10 } }, true).tuning!);
ok(currentBalance().auto.summary === false && currentBalance().auto.summaryMin === 10, 'switch and minutes are applied');
ok(autoChanges(codeAuto(), mergeAuto({ summary: false })).some((s) => s.includes('หน้าสรุปผล Auto')), 'the change goes to the audit');
ok('error' in checkBalance({ auto: { summaryMin: 0 } }, true), 'minutes below 1 are refused');
ok('error' in checkBalance({ auto: { summary: 'yes' } }, true), 'a switch that is not on/off is refused');
applyBalance(checkBalance({}, true).tuning!);
ok(currentBalance().auto.summary === true, 'back to the code');

finish('auto-summary');
