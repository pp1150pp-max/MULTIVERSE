// Floors and their towns (docs/plans/FLOOR2_PLAN.md 4.2, 4.3): the return scroll, death, boss rooms and
// login go to the town of the floor you're on; portals can need a quest unlock, with two /admin switches.
// Floor 2 isn't built yet (PR #3), so a made-up floor-2 town and map are registered here.
import { finish, ok } from './check';
import { BOSS_ROOMS, FLOOR_HUBS, HUB_ID, ZONES, ZONE_HUB, floorOf, hubOf, isHub, zoneById, type ZoneDef } from '../src/shared/data/zones';
import { applyBalance, checkBalance, balanceChanges, currentBalance } from '../src/shared/balance';
import { floorUnlock, loginHub, portalLock } from '../src/shared/floors';
import { MONSTERS } from '../src/shared/data/monsters';
import { Sim } from '../src/shared/sim/Sim';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import { RETURN_CAST } from '../src/shared/data/stones';

const TICK = 1 / 30;
const run = (sim: Sim, secs: number, it: () => Intent = () => IDLE_INTENT) => {
  for (let n = 0; n < Math.round(secs / TICK); n++) sim.step(TICK, it);
};
const hero = (extra: Record<string, unknown> = {}) => ({ name: 'F', classId: 'sword' as const, level: 45, exp: 0, gold: 0, equipment: {}, bag: [], ...extra });
const OPEN = { floorGateOpen: true, floorGateQuest: true };

// ---- floor 1 stays as it was
ok(Object.values(ZONES).every((z) => floorOf(z) === 1), 'every zone today is on floor 1');
ok(Object.values(ZONES).every((z) => hubOf(z).id === HUB_ID), 'floor 1: every zone\'s town is nexus_city');
ok(Object.values(BOSS_ROOMS).every((r) => hubOf(r).id === HUB_ID), 'floor 1 boss rooms: nexus_city too');
ok(isHub(ZONE_HUB) && Object.values(ZONES).filter(isHub).length === 1, 'only nexus_city is a town');
ok(loginHub({ zone: 'emerald_forest' }).id === HUB_ID && loginHub({}).id === HUB_ID && loginHub({ zone: 'nope' }).id === HUB_ID, 'login: floor 1 → nexus_city (also missing/unknown zone)');

// ---- switches: code defaults, check, audit text
ok(currentBalance().floorGateOpen === true && currentBalance().floorGateQuest === true, 'both switches on in the code');
{
  const c = checkBalance({ floorGateOpen: false, floorGateQuest: true }, true);
  ok(!c.error && c.tuning?.floorGateOpen === false && c.tuning.floorGateQuest === undefined, 'only values that differ from the code are kept');
  ok(!!checkBalance({ floorGateQuest: 'x' }, true).error, 'a non-boolean is refused');
  ok(balanceChanges({}, { floorGateOpen: false }).includes('ประตูที่ต้องทำเควส'), 'audit line for the switch');
}

// ---- portalLock
ok(portalLock([], undefined, OPEN) === null, 'no requirement: open');
ok(portalLock([], 'floor2', OPEN) === 'quest', 'quest not done: locked');
ok(portalLock(['floor2'], 'floor2', OPEN) === null, 'quest done: open');
ok(portalLock(['floor2'], 'floor2', { floorGateOpen: false, floorGateQuest: true }) === 'closed', 'gate closed: shut even with the quest');
ok(portalLock([], 'floor2', { floorGateOpen: true, floorGateQuest: false }) === null, 'quest switch off: open without the quest');
ok(portalLock([], undefined, { floorGateOpen: false, floorGateQuest: true }) === null, 'gate switch leaves ordinary portals alone');

// ---- a floor without its town falls back to floor 1's
const FIELD: ZoneDef = { ...ZONES.emerald_forest, id: 'test_beach', floor: 2, levels: [41, 50] };
ok(hubOf(FIELD).id === HUB_ID, 'floor 2 before its town exists → nexus_city');

// ---- register a made-up floor 2
const HARBOR: ZoneDef = { ...ZONE_HUB, id: 'test_harbor', floor: 2, levels: [41, 80], spawns: [], portals: [{ to: HUB_ID, x: 0, z: -30, minLevel: 0 }] };
FIELD.portals = [{ to: HARBOR.id, x: 49.5, z: 49.5, minLevel: 0 }];
ZONES[HARBOR.id] = HARBOR;
ZONES[FIELD.id] = FIELD;
FLOOR_HUBS[2] = HARBOR.id;

ok(hubOf(FIELD).id === HARBOR.id && hubOf(HARBOR).id === HARBOR.id, 'floor 2 → its own town');
ok(isHub(HARBOR) && !isHub(FIELD), 'the harbor counts as a town, its map does not');
ok(hubOf(ZONES.emerald_forest).id === HUB_ID, 'floor 1 unchanged once floor 2 exists');

// login
ok(loginHub({ zone: FIELD.id, unlocks: ['floor2'] }, OPEN).id === HARBOR.id, 'login after floor 2 (quest done) → harbor');
ok(loginHub({ zone: HARBOR.id, unlocks: [floorUnlock(2)] }, OPEN).id === HARBOR.id, 'login in the harbor → harbor');
ok(loginHub({ zone: FIELD.id }, OPEN).id === HUB_ID, 'no quest (e.g. moved there by a GM) → nexus_city');
ok(loginHub({ zone: FIELD.id, unlocks: ['floor2'] }, { floorGateOpen: false, floorGateQuest: true }).id === HUB_ID, 'gate closed → nexus_city');
ok(loginHub({ zone: FIELD.id }, { floorGateOpen: true, floorGateQuest: false }).id === HARBOR.id, 'quest switch off → harbor');
ok(loginHub({ zone: 'emerald_forest', unlocks: ['floor2'] }, OPEN).id === HUB_ID, 'logged out on floor 1 → nexus_city');

// ---- return scroll on floor 2
{
  const sim = new Sim(FIELD);
  const p = sim.addPlayer(hero());
  p.addStones('return_scroll', 1);
  for (const m of sim.monsters) m.x = m.z = 9999;
  sim.drainEvents();
  sim.step(TICK, () => ({ ...IDLE_INTENT, recall: true }));
  run(sim, RETURN_CAST + 0.2);
  const evs = sim.drainEvents();
  const ev = evs.find((e) => e.t === 'travel');
  ok(!!ev && ev.t === 'travel' && ev.zone === HARBOR.id && ev.atCamp === true, 'return scroll on floor 2 → harbor');
  ok(evs.some((e) => e.t === 'log' && e.msg.includes(`กลับ${HARBOR.nameTh}`)), 'the log names the floor\'s town');
}

// ---- death on floor 2
{
  const sim = new Sim(FIELD);
  const p = sim.addPlayer(hero());
  p.alive = false;
  sim.drainEvents();
  sim.respawn(p);
  const ev = sim.drainEvents().find((e) => e.t === 'travel');
  ok(!!ev && ev.t === 'travel' && ev.zone === HARBOR.id, 'revive on floor 2 → harbor');
}
// ---- death on floor 1 still goes to nexus_city
{
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer(hero());
  p.alive = false;
  sim.drainEvents();
  sim.respawn(p);
  const ev = sim.drainEvents().find((e) => e.t === 'travel');
  ok(!!ev && ev.t === 'travel' && ev.zone === HUB_ID, 'revive on floor 1 → nexus_city');
}

// ---- a portal that needs the quest
{
  const gate = { to: HARBOR.id, x: 0, z: -30, minLevel: 40, requires: floorUnlock(2) };
  const town: ZoneDef = { ...ZONE_HUB, portals: [...ZONE_HUB.portals, gate] };
  const tryGate = (extra: Record<string, unknown>) => {
    const sim = new Sim(town);
    const p = sim.addPlayer(hero(extra));
    p.x = gate.x + 6;
    p.z = gate.z;
    run(sim, 0.1);
    p.x = gate.x;
    p.z = gate.z;
    sim.drainEvents();
    run(sim, 0.2);
    const evs = sim.drainEvents();
    return { travel: evs.some((e) => e.t === 'travel' && e.zone === HARBOR.id), log: evs.filter((e) => e.t === 'log').map((e) => (e as { msg: string }).msg).join(' ') };
  };
  let r = tryGate({});
  ok(!r.travel && r.log.includes('The Seeker'), 'no quest: turned away, told to see The Seeker');
  r = tryGate({ unlocks: ['floor2'] });
  ok(r.travel, 'quest done: walks through');
  r = tryGate({ unlocks: ['floor2'], level: 30 });
  ok(!r.travel, 'still needs minLevel');
  applyBalance({ floorGateOpen: false });
  r = tryGate({ unlocks: ['floor2'] });
  ok(!r.travel && r.log.includes('ปิดอยู่'), 'gate switch off: shut, says closed');
  applyBalance({ floorGateQuest: false });
  r = tryGate({});
  ok(r.travel, 'quest switch off: anyone at the level walks through');
  applyBalance({});
}

// ---- unlocks are saved
{
  const sim = new Sim(ZONE_HUB);
  const p = sim.addPlayer(hero({ unlocks: ['floor2', 'floor2', 7] }));
  ok(p.unlocks.length === 1 && p.unlocks[0] === 'floor2', 'unlocks cleaned on load');
  ok(p.toData().unlocks?.[0] === 'floor2', 'unlocks saved');
  ok(sim.addPlayer(hero()).unlocks.length === 0, 'old saves: none');
}

// ---- monsters of floor 2 find a floor-2 home map, never the harbor
{
  const sim = new Sim(ZONE_HUB) as unknown as { homeOf(d: { levels: [number, number] }): ZoneDef | undefined };
  ok(sim.homeOf({ levels: [45, 45] })?.id === FIELD.id, 'a Lv45 monster belongs to the floor-2 map');
  ok(sim.homeOf(MONSTERS[Object.keys(MONSTERS)[0]])?.id !== HARBOR.id, 'a floor-1 monster never belongs to the harbor');
}

finish('multi-hub');
