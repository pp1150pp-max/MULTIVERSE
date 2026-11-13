// Auto Play options (owner 2026-11-13): loot order (fight first / balanced / loot first), other players' drops,
// giving up on a drop it can't get, monster kinds to skip, target mode, out-of-potions / full-bag actions,
// and the server-wide admin switches and defaults (balance tuning `auto`). On a real Sim, no server.
import { ok, finish } from './check';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { Loot } from '../src/shared/sim/Loot';
import { AutoPlay, type AutoWorld } from '../src/shared/sim/autoplay';
import { cleanAutoSettings, type AutoSettings, type Player } from '../src/shared/sim/Player';
import type { Monster } from '../src/shared/sim/Monster';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import { applyBalance, checkBalance } from '../src/shared/balance';
import { AUTO_DEFAULT_KEYS } from '../src/shared/autoTuning';

const sim = new Sim(ZONE_1);
for (let i = 0; i < 300 && sim.monsters.filter((m) => m.alive && !m.isBoss).length < 2; i++) sim.step(0.1);
const mobs = sim.monsters.filter((m) => m.alive && !m.isBoss);
ok(mobs.length >= 2, 'zone 1 has monsters');
const mob = mobs[0];

const p = sim.addPlayer({ name: 'A', classId: 'sword', level: 30, exp: 0, gold: 0, equipment: {}, bag: [{ potion: 'hp', size: 's', count: 5 }, { potion: 'mp', size: 's', count: 5 }] });
const other = 999_999;
let lootId = 900_000;
const drop = (dx: number, dz: number, opts: { owner?: number; ownerUntil?: number } = {}): Loot =>
  new Loot(lootId++, p.x + dx, p.z + dz, p.x, p.z, { type: 'gold', amount: 5 }, opts);

/** The player stands next to the monster; `attacking` = it is after the player. */
function place(m: Monster, attacking: boolean, dx = 1.5): void {
  p.x = m.x + dx;
  p.z = m.z;
  m.state = attacking ? 'chase' : 'idle';
  m.target = attacking ? p : null;
}
function settings(s: Partial<AutoSettings>): void {
  // As if picked in the Auto window: every option is the player's own.
  p.autoSettings = cleanAutoSettings({ ...p.autoSettings, ...s, optsSet: [...AUTO_DEFAULT_KEYS] });
}
function run(monsters: Monster[], loots: Loot[], time = 1, auto = new AutoPlay()): { it: Intent; auto: AutoPlay } {
  if (time === 1) auto.start(p.x, p.z);
  const g: AutoWorld = { player: p, monsters, loots, time, zone: ZONE_1 };
  return { it: auto.intent(g, IDLE_INTENT), auto };
}
const goesTo = (it: Intent, l: Loot) => !!it.moveTo && Math.hypot(it.moveTo.x - l.x, it.moveTo.z - l.z) < 0.01;

// ---- defaults: a character without the new options gets the code's defaults (fight first, others' loot, fight on, attacker first)
const fresh = cleanAutoSettings({ range: 500 });
ok(fresh.lootOrder === 'fight' && fresh.othersLoot && fresh.noHp === 'fight' && fresh.noMp === 'fight' && fresh.bagFull === 'fight' && fresh.target === 'attacker' && fresh.skip.length === 0,
  'old saves get the code defaults');
const junk = cleanAutoSettings({ optsSet: ['lootOrder', 'othersLoot', 'noHp', 'target', 'bogus'], lootOrder: 'x', othersLoot: 'yes', noHp: 'boom', target: 3, skip: ['nope', mob.def.id, mob.def.id, 'boss_bear'] });
ok(junk.lootOrder === 'fight' && junk.othersLoot === true && junk.noHp === 'fight' && junk.target === 'attacker', 'bad values fall back to defaults');
ok(junk.skip.length === 1 && junk.skip[0] === mob.def.id, 'skip keeps known non-boss kinds once');

// ---- loot order
settings({ lootOrder: 'fight', othersLoot: true, skip: [], target: 'attacker' });
place(mob, true);
const near = drop(0, 2);
let r = run([mob], [near]);
ok(!goesTo(r.it, near) && (r.it.basic || !!r.it.moveTo), 'fight first: attacked → fights, ignores the drop next to it');
settings({ lootOrder: 'balanced' });
r = run([mob], [near]);
ok(goesTo(r.it, near), 'balanced: a close drop is fetched mid-fight (old behaviour)');
const far = drop(0, 9);
r = run([mob], [far]);
ok(!goesTo(r.it, far), 'balanced: a far drop waits while a monster is close');
settings({ lootOrder: 'loot' });
r = run([mob], [far]);
ok(goesTo(r.it, far), 'loot first: walks to a far drop even while attacked');
settings({ lootOrder: 'fight' });
place(mob, false, 8);
r = run([mob], [far]);
ok(goesTo(r.it, far), 'fight first: nothing attacking → picks up drops before the next monster');

// ---- give up on a drop it can't get closer to
settings({ lootOrder: 'loot' });
place(mob, false, 8);
const stuck = drop(0, 3);
const auto = new AutoPlay();
r = run([], [stuck], 1, auto);
ok(goesTo(r.it, stuck), 'walks to the drop');
r = run([], [stuck], 3, auto);
ok(goesTo(r.it, stuck), 'still trying after 2 s without getting closer');
r = run([], [stuck], 5.5, auto);
ok(!goesTo(r.it, stuck), 'gives up after 4 s without getting closer');
r = run([], [stuck], 7, auto);
ok(!goesTo(r.it, stuck), 'and stays given up');
const moving = drop(0, 10);
const auto2 = new AutoPlay();
run([], [moving], 1, auto2);
for (let t = 2; t <= 9; t++) {
  p.z += 1; // getting closer each second
  r = run([], [moving], t, auto2);
}
ok(goesTo(r.it, moving), 'a drop it keeps getting closer to is never given up');

// ---- other players' drops
place(mob, false, 8);
const theirs = drop(0, 2, { owner: other, ownerUntil: 0 });
const locked = drop(0, 1.5, { owner: other, ownerUntil: 1000 });
const mine = drop(0, 4, { owner: p.id, ownerUntil: 1000 });
settings({ othersLoot: true });
r = run([], [theirs, locked]);
ok(goesTo(r.it, theirs), 'others\' loot on: takes another player\'s drop after its priority');
r = run([], [locked]);
ok(!goesTo(r.it, locked), 'never walks to a drop still under someone else\'s priority');
settings({ othersLoot: false });
r = run([], [theirs, mine]);
ok(goesTo(r.it, mine), 'own loot only: skips another player\'s drop, takes its own');
const nobody = drop(0, 2.5);
r = run([], [theirs, nobody]);
ok(goesTo(r.it, nobody), 'own loot only: takes drops nobody owns');

// ---- skip monster kinds, target mode
settings({ lootOrder: 'fight', othersLoot: true, skip: [mob.def.id] });
place(mob, false, 3);
r = run([mob], []);
ok(!r.it.basic && !(r.it.aim.x === mob.x && r.it.aim.z === mob.z), 'skipped kind: not attacked when it leaves the player alone');
place(mob, true, 1.5);
r = run([mob], []);
ok(r.it.basic && r.it.aim.x === mob.x, 'skipped kind: fought back once it attacks');
settings({ skip: [] });
const [a, b] = mobs;
// a attacks from 6 away, b idles 2 away
p.x = b.x + 2;
p.z = b.z;
b.state = 'idle';
b.target = null;
a.state = 'chase';
a.target = p;
const ax = a.x;
const az = a.z;
a.x = p.x + 6;
a.z = p.z;
settings({ target: 'attacker' });
r = run([a, b], []);
ok(r.it.aim.x === a.x, 'target "attacker": goes for the monster attacking the player');
settings({ target: 'near' });
r = run([a, b], []);
ok(r.it.aim.x === b.x, 'target "near": goes for the nearest');
a.x = ax;
a.z = az;
a.state = 'idle';
a.target = null;

// ---- out of potions / full bag
const noPots = (): void => { p.bag = p.bag.map((e) => (e && 'potion' in e ? null : e)); };
noPots();
settings({ noHp: 'fight', noMp: 'fight', target: 'attacker' });
r = run([], []);
ok(!r.auto.takeStop(), 'no potions, "fight on": keeps going');
settings({ noHp: 'stop' });
r = run([], []);
ok(/ยา HP หมด/.test(r.auto.takeStop() ?? ''), 'no HP potions, "stop": Auto asks to switch off');
settings({ noHp: 'fight', noMp: 'scroll' });
r = run([], []);
ok(/ไม่มีม้วน/.test(r.auto.takeStop() ?? '') && !r.it.recall, 'no MP potions, "scroll" without a scroll: stops instead');
p.addStones('return_scroll', 1);
place(mob, true);
r = run([mob], []);
ok(!r.it.recall && !r.auto.takeStop() && (r.it.basic || !!r.it.moveTo), '"scroll" while attacked: fights first');
place(mob, false, 10);
r = run([mob], []);
ok(r.it.recall === true && /ม้วน/.test(r.auto.takeStop() ?? ''), '"scroll" with nothing attacking: reads the scroll and stops Auto');
// The real Sim starts the cast from that intent (Auto is off from the next tick, so nothing breaks it).
const recallIt = r.it;
sim.step(0.05, (pl) => (pl === p ? recallIt : IDLE_INTENT));
ok(p.castT > 0, 'the return scroll cast really starts');
p.castT = 0;

// ---- admin switches and defaults (balance tuning `auto`)
const c = checkBalance({ auto: { allow: { scroll: false, lootFirst: false }, giveUpSec: 2, defaults: { lootOrder: 'balanced' } } }, true);
ok(!!c.tuning?.auto, 'auto tuning passes the strict check');
ok(!!checkBalance({ auto: { giveUpSec: 999 } }, true).error, 'out-of-range auto number is refused');
ok(!!checkBalance({ auto: { defaults: { lootOrder: 'x' } } }, true).error, 'unknown default is refused');
applyBalance(c.tuning!);
r = run([mob], []);
ok(/ยา MP หมด/.test(r.auto.takeStop() ?? '') && !r.it.recall, 'scroll switched off server-wide: stops instead');
ok(cleanAutoSettings({}).lootOrder === 'balanced', 'admin default applies to characters without the option');
settings({ noMp: 'fight', lootOrder: 'loot' });
place(mob, true);
const far2 = drop(0, 9);
r = run([mob], [far2]);
ok(!goesTo(r.it, far2), '"loot first" switched off: behaves like balanced');
applyBalance({});
r = run([mob], [far2]);
ok(goesTo(r.it, far2), '"loot first" back on: walks to the far drop again');

// ---- an option the player never picked keeps following the server default, through save and load
const saved = JSON.parse(JSON.stringify(cleanAutoSettings({ range: 500 }))) as AutoSettings;
ok(saved.lootOrder === 'fight' && (saved.optsSet ?? []).length === 0, 'a character that never picked saves no own options');
applyBalance(checkBalance({ auto: { defaults: { lootOrder: 'loot', noHp: 'stop' } } }, true).tuning!);
const reloaded = cleanAutoSettings(saved);
ok(reloaded.lootOrder === 'loot' && reloaded.noHp === 'stop', 'after the owner changes the defaults, it follows them on load');
const picked = cleanAutoSettings({ ...saved, lootOrder: 'balanced', optsSet: ['lootOrder'] });
const picked2 = cleanAutoSettings(JSON.parse(JSON.stringify(picked)));
ok(picked2.lootOrder === 'balanced' && picked2.noHp === 'stop', 'an option the player picked stays theirs; the rest follow the default');
ok(cleanAutoSettings({ lootOrder: 'balanced' }).lootOrder === 'loot', 'a value without optsSet (old/forged) is not taken as the player\'s pick');
applyBalance({});

sim.removePlayer(p as Player);
finish('auto-options');
