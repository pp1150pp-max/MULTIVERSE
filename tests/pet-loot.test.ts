// Pets pick up loot (owner 2026-11-27, docs/systems/pet-loot.md): on a real Sim, no server.
// Hand play = own drops near the player · Auto = Auto's own rules inside the Auto circle · /admin switches and numbers.
import { ok, finish } from './check';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { Loot, LOOT_PRIORITY_TIME, type LootKind } from '../src/shared/sim/Loot';
import { AUTO_PX_PER_UNIT } from '../src/shared/sim/Player';
import { tickPetLoot } from '../src/shared/sim/petLoot';
import { applyBalance, balanceChanges, checkBalance, currentBalance, mergeBalance } from '../src/shared/balance';
import { checkPetLootTuning, codePetLoot, mergePetLoot, petLootChanges } from '../src/shared/petLootTuning';

const sim = new Sim(ZONE_1);
const p = sim.addPlayer({ name: 'A', classId: 'sword', level: 30, exp: 0, gold: 0, equipment: {}, bag: [] });
const q = sim.addPlayer({ name: 'B', classId: 'mage', level: 30, exp: 0, gold: 0, equipment: {}, bag: [] });
q.x = p.x + 200; // far away: never in reach of p's drops
q.z = p.z + 200;
let nextId = 900000;
const GOLD: LootKind = { type: 'gold', amount: 10 };
/** A landed drop `dx` units east of p; `owner` = whose priority (null = nobody's). */
const drop = (dx: number, owner: number | null, o: { kind?: LootKind; dz?: number; age?: number; until?: number; dropped?: boolean } = {}): Loot => {
  const l = new Loot(nextId++, p.x + dx, p.z + (o.dz ?? 0), p.x, p.z, o.kind ?? GOLD, {
    ...(owner !== null ? { owner, ownerUntil: o.until ?? sim.time + LOOT_PRIORITY_TIME } : {}),
    dropped: o.dropped,
  });
  l.t = o.age ?? 1;
  sim.loots.push(l);
  return l;
};
const clear = () => {
  sim.loots.length = 0;
  p.petLootCd = 0;
};
const tick = (dt = 0.1) => tickPetLoot(sim, dt);

// ---- code defaults
const c = codePetLoot();
ok(c.on && c.auto && c.hand, 'code: on, in Auto and by hand');
ok(c.handRadius === 6 && c.interval === 0.5, 'code: 6 m by hand, one drop every 0.5 s');
ok(['pet_slime', 'pet_cat', 'pet_dragon', 'pet_bot', 'pet_wisp'].every((id) => c.pets[id] === true), 'code: every pet collects');

// ---- no pet worn: nothing
p.cosmetics = {};
clear();
const l0 = drop(3, p.id);
tick();
ok(!l0.dead, 'no pet worn: the drop stays');

// ---- hand play
p.cosmetics = { pet: 'pet_cat' };
p.autoOn = false;
clear();
const g0 = p.gold;
const own = drop(4, p.id);
tick();
ok(own.dead && p.gold === g0 + 10, 'hand: own drop 4 m away is fetched (gold added)');
const ev = sim.drainEvents().find((e) => e.t === 'fx' && e.name === 'petLoot');
ok(!!ev && ev.t === 'fx' && ev.name === 'petLoot' && ev.args[2] === p.id && ev.args[3] === 'gold', 'hand: petLoot fx sent with the player and kind');

clear();
const young = drop(3, p.id, { age: 0.1 });
tick();
ok(!young.dead, 'hand: a drop still in its pop arc is not taken');

clear();
const far = drop(7, p.id);
tick();
ok(!far.dead, 'hand: own drop beyond 6 m is not taken');

clear();
const theirs = drop(3, q.id, { until: sim.time - 1 }); // another player's, priority over
tick();
ok(!theirs.dead, "hand: someone else's drop is not taken, even after its priority");

clear();
const nobody = drop(3, null);
tick();
ok(!nobody.dead, 'hand: a drop nobody owns is not taken (not from our kill)');

clear();
const thrown = drop(3, p.id, { dropped: true });
tick();
ok(!thrown.dead, 'hand: a drop thrown on the ground is not taken');

// loot filter: potions off
clear();
const savedFilter = p.lootFilter;
p.lootFilter = { ...p.lootFilter, pots: { hp: [], mp: [] } };
const pot = drop(3, p.id, { kind: { type: 'potion', pot: 'hp', size: 's', count: 1 } });
tick();
ok(!pot.dead, 'hand: a kind the loot filter skips is not taken');
p.lootFilter = savedFilter;
tick(0.6);
ok(pot.dead, 'hand: filter back on: the potion is fetched');

// interval
clear();
const a1 = drop(2, p.id);
const a2 = drop(3, p.id);
tick();
ok(a1.dead && !a2.dead, 'interval: one drop per pickup, nearest first');
tick(0.2);
ok(!a2.dead, 'interval: not again before 0.5 s');
tick(0.35);
ok(a2.dead, 'interval: the next one after 0.5 s');

// full bag (items): skipped silently, the next kind still comes
clear();
const realFit = p.canFit.bind(p);
p.canFit = (k) => k.type !== 'stone' && realFit(k);
const stone = drop(2, p.id, { kind: { type: 'stone', stone: 'return_scroll', count: 1 } });
const coin = drop(3, p.id);
sim.drainEvents();
tick();
ok(!stone.dead && coin.dead, 'full bag: the drop that does not fit is skipped, the next one comes');
ok(!sim.drainEvents().some((e) => e.t === 'text' && e.text.includes('เต็ม')), 'full bag: no "bag full" text from the pet');
p.canFit = realFit;

// ---- Auto on: the whole Auto circle around its anchor, Auto's rules
p.autoOn = true;
p.autoSettings = { ...p.autoSettings, range: 30 * AUTO_PX_PER_UNIT, loot: true, othersLoot: true };
p.autoAnchor = { x: p.x + 10, z: p.z };
clear();
const inCircle = drop(25, p.id); // 25 m from the player, 15 m from the anchor
tick();
ok(inCircle.dead, 'Auto: a drop far from the player but inside the Auto circle is fetched');

clear();
const outCircle = drop(45, p.id); // 35 m from the anchor
tick();
ok(!outCircle.dead, 'Auto: a drop outside the Auto circle is not taken');

clear();
const others = drop(5, q.id, { until: sim.time - 1 });
tick();
ok(others.dead, "Auto + others' loot on: someone else's drop after its 10 s priority is fetched");

clear();
const locked = drop(5, q.id);
tick();
ok(!locked.dead, "Auto: someone else's drop inside its 10 s priority is not taken");

clear();
p.autoSettings = { ...p.autoSettings, othersLoot: false };
const others2 = drop(5, q.id, { until: sim.time - 1 });
const free = drop(6, null);
tick();
ok(!others2.dead && free.dead, "Auto + own loot only: someone else's drop stays, a drop nobody owns is fetched");
p.autoSettings = { ...p.autoSettings, othersLoot: true };

clear();
p.autoSettings = { ...p.autoSettings, loot: false };
const noLoot = drop(5, p.id);
tick();
ok(!noLoot.dead, 'Auto with looting switched off by the player: the pet takes nothing');
p.autoSettings = { ...p.autoSettings, loot: true };

// server switch "others' loot" off overrides the player's choice
applyBalance(checkBalance({ auto: { allow: { othersLoot: false } } }, true).tuning!);
clear();
const others3 = drop(5, q.id, { until: sim.time - 1 });
tick();
ok(!others3.dead, "Auto: /admin switched others' loot off: someone else's drop stays");
applyBalance({});

// ---- /admin switches
const setPet = (t: object) => applyBalance(checkBalance({ petLoot: t }, true).tuning ?? {});
setPet({ pets: { pet_cat: false } });
ok(currentBalance().petLoot.pets.pet_cat === false, 'pet_cat ticked off is applied');
clear();
const off1 = drop(5, p.id);
tick();
ok(!off1.dead, 'a pet ticked off in /admin takes nothing');
p.cosmetics = { pet: 'pet_dragon' };
tick();
ok(off1.dead, 'another pet that is still ticked on collects');

setPet({ on: false });
clear();
const off2 = drop(5, p.id);
tick();
ok(!off2.dead, 'server switch off: nothing is taken');

setPet({ auto: false });
clear();
const off3 = drop(5, p.id);
tick();
ok(!off3.dead, 'Auto pickup switched off: nothing in Auto');
p.autoOn = false;
p.autoAnchor = null;
tick();
ok(off3.dead, 'Auto pickup off: hand play still works');

setPet({ hand: false, handRadius: 10, interval: 2 });
clear();
const off4 = drop(5, p.id);
tick();
ok(!off4.dead, 'hand pickup switched off: nothing by hand');
setPet({ handRadius: 10, interval: 2 });
clear();
const r1 = drop(9, p.id);
const r2 = drop(9.5, p.id);
tick();
ok(r1.dead, 'hand radius 10: a drop 9 m away is fetched');
tick(1.5);
ok(!r2.dead, 'interval 2 s: not yet after 1.6 s');
tick(0.5);
ok(r2.dead, 'interval 2 s: fetched after 2.1 s');
applyBalance({});

// ---- inside a real Sim step (the pet runs before the drops' own update)
clear();
const live = drop(5, p.id);
sim.step(0.05);
ok(live.dead && !sim.loots.includes(live), 'Sim.step: the pet fetches and the drop leaves the list');

// ---- saving: only what differs, strict checks, audit lines
ok(checkPetLootTuning({ on: true, handRadius: 6, interval: 0.5, pets: { pet_cat: true } }, true).hasOwnProperty('tuning')
  && (checkPetLootTuning({ on: true, handRadius: 6, pets: { pet_cat: true } }, true) as { tuning?: unknown }).tuning === undefined, 'code values are not saved');
const t1 = checkPetLootTuning({ on: false, handRadius: 8, pets: { pet_cat: false, pet_bot: true } }, true);
ok('tuning' in t1 && t1.tuning?.on === false && t1.tuning.handRadius === 8 && t1.tuning.pets?.pet_cat === false && !('pet_bot' in (t1.tuning.pets ?? {})), 'only changes are saved');
ok('error' in checkPetLootTuning({ handRadius: 50 }, true), 'radius out of range refused');
ok('error' in checkPetLootTuning({ interval: 0 }, true), 'interval out of range refused');
ok('error' in checkPetLootTuning({ pets: { pet_nope: false } }, true), 'unknown pet refused (strict)');
ok('error' in checkPetLootTuning({ what: 1 }, true), 'unknown key refused (strict)');
const lax = checkPetLootTuning({ pets: { pet_nope: false, pet_cat: false } }, false);
ok('tuning' in lax && lax.tuning?.pets?.pet_cat === false && !('pet_nope' in (lax.tuning.pets ?? {})), 'lenient: unknown pet dropped');
const lines = petLootChanges(codePetLoot(), mergePetLoot({ on: false, interval: 1, pets: { pet_wisp: false } }));
ok(lines.length === 3 && lines.some((s) => s.includes('ภูติไฟ')), 'audit lines name each change');
const full = mergeBalance(checkBalance({ petLoot: { hand: false } }, true).tuning!);
ok(balanceChanges({}, checkBalance(full, true).tuning!).includes('ตอนเล่นเอง'), 'balance audit includes the pet card');

finish('pet-loot');
