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
