// A monster walking home ignores hits (owner 2026-11-17): hit on the way, it neither turns to chase nor wakes its
// pack; it still takes damage and heals; at home it fights back as usual. The /admin switch off = the old behaviour.
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import { finish, ok } from './check';

const hero = { name: 'A', classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] };
const TICK = 1 / 30;

// ---------------------------------------------------------- settings
ok(mergeBalance({}).mobReturnIgnoreHits === true, 'code default: on');
ok(JSON.stringify(checkBalance({ mobReturnIgnoreHits: true }, true).tuning) === '{}', 'the code value is not saved');
ok(checkBalance({ mobReturnIgnoreHits: false }, true).tuning?.mobReturnIgnoreHits === false, 'off is kept');
ok('error' in checkBalance({ mobReturnIgnoreHits: 1 }, true), 'a non-boolean is refused');
ok(balanceChanges({}, { mobReturnIgnoreHits: false }).includes('มอนเดินกลับบ้านไม่สนการโจมตี'), 'the audit names it');

// ---------------------------------------------------------- in a Sim
/** A Sim with the hero beside a pack monster dragged out of its leash, so it is walking home. */
const setup = () => {
  const sim = new Sim(ZONE_1);
  const p = sim.addPlayer(hero);
  p.stats.maxHp = p.hp = 1e9;
  const m = sim.monsters.find((x) => !x.isBoss && x.def.pack) as Monster;
  const key = m.def.packId ?? m.def.id;
  const mate = sim.monsters.find((o) => o !== m && (o.def.packId ?? o.def.id) === key) as Monster;
  m.x = m.area.x + 30;
  m.z = m.area.z;
  p.x = m.x + 2;
  p.z = m.z;
  mate.x = m.x + 3;
  mate.z = m.z + 3;
  sim.step(TICK);
  sim.drainEvents();
  return { sim, p, m, mate };
};
const dist = (m: Monster) => Math.hypot(m.x - m.area.x, m.z - m.area.z);

for (const on of [true, false]) {
  applyBalance({ mobReturnIgnoreHits: on });
  const { sim, p, m, mate } = setup();
  ok(m.state === 'return', `[${on ? 'on' : 'off'}] past the leash it walks home`);
  mate.state = 'return';
  m.hp = m.maxHp * 0.5;
  let turned = false;
  for (let i = 0; i < 30 * 30 && m.state !== 'idle'; i++) {
    if (i % 5 === 0) {
      sim.hitMonster(p, m, 0);
      if (m.state === 'chase') turned = true;
    }
    sim.step(TICK);
    sim.drainEvents();
    if (!on) break;
  }
  if (on) {
    ok(!turned, 'on: hit over and over on the way, it never turns to chase');
    ok(m.state === 'idle' && dist(m) < 1.5, `on: it got home (${dist(m).toFixed(1)} away, ${m.state})`);
    ok(mate.state === 'return', 'on: its pack mate walking home is not woken either');
  } else {
    ok(turned, 'off: a hit turns it around as before (then the leash sends it home again)');
  }
}
{
  applyBalance({ mobReturnIgnoreHits: true });
  const { sim, p, m } = setup();
  m.hp = m.maxHp * 0.5;
  const hp = m.hp;
  sim.hitMonster(p, m, 0.05);
  ok(m.alive && m.hp < hp && m.state === 'return', `a hit while walking home still lands (${hp} → ${m.hp}) and it keeps walking`);
  for (let i = 0; i < 30 * 30 && m.state === 'return'; i++) { sim.step(TICK); sim.drainEvents(); }
  ok(m.state === 'idle', 'it reaches home');
  sim.hitMonster(p, m, 0);
  ok(m.state === 'chase', 'at home a hit makes it fight back as usual');
}
applyBalance({});
finish('mob-return');
