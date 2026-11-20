// A monster chasing a player who steps into the town (safe area), leaves the map or dies drops the chase at once and
// walks home (owner 2026-11-20); it does not re-aggro on a player staying in town. Switch `mobDropOnSafe` off = old behaviour.
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import { finish, ok } from './check';

const hero = { name: 'A', classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] };
const TICK = 1 / 30;

// ---------------------------------------------------------- settings
ok(mergeBalance({}).mobDropOnSafe === true, 'code default: on');
ok(JSON.stringify(checkBalance({ mobDropOnSafe: true }, true).tuning) === '{}', 'the code value is not saved');
ok(checkBalance({ mobDropOnSafe: false }, true).tuning?.mobDropOnSafe === false, 'off is kept');
ok('error' in checkBalance({ mobDropOnSafe: 'x' }, true), 'a non-boolean is refused');
ok(balanceChanges({}, { mobDropOnSafe: false }).includes('มอนเลิกไล่เมื่อผู้เล่นเข้าเมือง'), 'the audit names it');

// ---------------------------------------------------------- in a Sim
const dist = (m: Monster) => Math.hypot(m.x - m.area.x, m.z - m.area.z);

/** The hub with one ordinary monster out beside the town wall, chasing the hero who stands just outside it. */
const setup = () => {
  const sim = new Sim(ZONE_HUB);
  const p = sim.addPlayer(hero);
  p.stats.maxHp = p.hp = 1e9;
  const safe = ZONE_HUB.safe!;
  // Park everyone else far away, so only `m` matters.
  const m = sim.monsters.find((x) => !x.isBoss && x.def.behavior !== 'boss') as Monster;
  for (const o of sim.monsters) if (o !== m) { o.x = 500; o.z = 500; }
  m.x = safe.half + 8;
  m.z = 0;
  // Its home is a little further out on the same side (the hub's own loners live out at the corners).
  Object.assign(m.area, { x: safe.half + 14, z: 0 });
  p.x = safe.half + 3;
  p.z = 0;
  m.target = p;
  m.aggroT = 10;
  m.state = 'chase';
  sim.step(TICK);
  sim.drainEvents();
  return { sim, p, m, safe };
};

for (const on of [true, false]) {
  applyBalance({ mobDropOnSafe: on });
  const { sim, p, m, safe } = setup();
  ok(m.state === 'chase' && m.target === p, `[${on ? 'on' : 'off'}] it chases the hero outside the wall`);
  p.x = 0;
  p.z = 0; // into the town
  sim.step(TICK);
  sim.drainEvents();
  if (on) {
    ok(m.target === null && m.state === 'return', 'on: one tick after the hero is in town it has dropped the chase and is walking home');
    for (let i = 0; i < 30 * 40 && m.state !== 'idle'; i++) { sim.step(TICK); sim.drainEvents(); }
    ok(m.state === 'idle' && dist(m) < 1.5, `on: it got home (${dist(m).toFixed(1)} away, ${m.state})`);
    // Aggressive loners next to the wall do not take the town-dweller as prey either.
    m.x = safe.half + 1;
    m.z = 0;
    for (let i = 0; i < 30; i++) { sim.step(TICK); sim.drainEvents(); }
    ok(m.target === null, 'on: it does not pick the hero in town as a target again');
  } else {
    ok(m.target === null && m.state !== 'return', `off: old behaviour, it just calms down where it stands (${m.state})`);
  }
}
applyBalance({ mobDropOnSafe: true });
{
  // The hero leaves the map: the monster goes home, not stays at the portal.
  const { sim, p, m } = setup();
  sim.removePlayer(p);
  ok(m.target === null && m.state === 'return', 'a player who leaves the map: the monster walks home');
}
{
  // The hero dies: the monster goes home.
  const { sim, p, m } = setup();
  p.alive = false;
  sim.step(TICK);
  sim.drainEvents();
  ok(m.target === null && m.state === 'return', 'a dead target: the monster walks home');
}
applyBalance({});
finish('mob-drop-safe');
