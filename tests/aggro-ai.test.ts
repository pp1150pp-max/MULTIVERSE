// Monster target rules (owner 2026-11-17), real Sims, no server:
//  - a boss that has been on one target for N s (code 10) switches, at random, to another living player who hurt it;
//  - alone, or while winding up, it keeps the target; taunt / a new target restarts the count;
//  - ordinary monsters no longer give up after 12 s without a hit (unless /admin turns the give-up time on),
//    but the distance leash still sends them home; the new settings are checked and audited.
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { BOSS_ROOMS, ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import { finish, ok } from './check';

const hero = (name: string) => ({ name, classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] });
const TICK = 1 / 30;
const run = (sim: Sim, s: number): void => { for (let i = 0; i < s * 30; i++) { sim.step(TICK); sim.drainEvents(); } };
const tough = <T extends { stats: { maxHp: number }; hp: number }>(p: T): T => { p.stats.maxHp = p.hp = 1e9; return p; };

// ---------------------------------------------------------- settings
ok(mergeBalance({}).bossSwitchSec === 10 && mergeBalance({}).mobGiveUpSec === 0, 'code defaults: boss 10 s, ordinary never gives up');
ok(JSON.stringify(checkBalance({ bossSwitchSec: 10, mobGiveUpSec: 0 }, true).tuning) === '{}', 'the code values are not saved');
ok(checkBalance({ bossSwitchSec: 0 }, true).tuning?.bossSwitchSec === 0, 'boss switch 0 (off) is kept');
ok(checkBalance({ mobGiveUpSec: 12 }, true).tuning?.mobGiveUpSec === 12, 'give-up 12 s is kept');
ok('error' in checkBalance({ bossSwitchSec: -1 }, true) && 'error' in checkBalance({ mobGiveUpSec: 500 }, true), 'out of range is refused');
ok(balanceChanges({}, { bossSwitchSec: 5 }).includes('บอสเปลี่ยนเป้าหมาย') && balanceChanges({}, { mobGiveUpSec: 12 }).includes('เลิกไล่'), 'the audit names both');

// ---------------------------------------------------------- boss
// A plain boss (no pattern, spells or vanish) keeps the timing easy to read.
const zone = Object.values(BOSS_ROOMS).find((z) => {
  const d = new Sim(z).monsters.find((m) => m.def.id === z.boss!.monster)!.def;
  return !d.pattern && !d.spells && !d.summon?.vanish;
})!;
const boss = () => {
  const sim = new Sim(zone);
  const m = sim.monsters.find((x) => x.def.id === zone.boss!.monster) as Monster;
  const [a, b] = ['A', 'B'].map((n) => {
    const p = tough(sim.addPlayer(hero(n)));
    p.x = m.x + 3;
    p.z = m.z;
    return p;
  });
  return { sim, m, a, b };
};
/** Seconds until the boss' target is no longer `from`, within `limit`; -1 = never. */
const untilSwitch = (sim: Sim, m: Monster, from: unknown, limit: number): number => {
  for (let i = 0; i < limit * 30; i++) {
    sim.step(TICK);
    sim.drainEvents();
    if (m.target !== from) return (i + 1) * TICK;
  }
  return -1;
};
{
  const { sim, m, a, b } = boss();
  sim.hitMonster(a, m, 0);
  sim.hitMonster(b, m, 0);
  m.target = a;
  const t = untilSwitch(sim, m, a, 25);
  ok(t >= 10 - 1e-6 && t < 14, `two players: switches to the other after 10 s (${t.toFixed(2)} s)`);
  ok(m.target === b, 'and it is the one who hurt it');
  const t2 = untilSwitch(sim, m, b, 25);
  ok(t2 >= 10 - 1e-6 && t2 < 14, `the count restarted: the next switch is 10 s later (${t2.toFixed(2)} s)`);
}
{
  const { sim, m, a } = boss();
  sim.hitMonster(a, m, 0);
  ok(untilSwitch(sim, m, a, 40) === -1, 'one player: no switch, the target stays');
}
{
  // Someone who never hurt it is not picked.
  const { sim, m, a, b } = boss();
  const c = tough(sim.addPlayer(hero('C')));
  c.x = m.x + 3;
  c.z = m.z + 1;
  sim.hitMonster(a, m, 0);
  sim.hitMonster(b, m, 0);
  m.target = a;
  untilSwitch(sim, m, a, 25);
  ok(m.target === b, 'switches to the one who hurt it, never C who did not');
}
{
  // Taunt restarts the count.
  const { sim, m, a, b } = boss();
  sim.hitMonster(a, m, 0);
  sim.hitMonster(b, m, 0);
  m.target = a;
  run(sim, 8);
  ok(m.target === a, 'not before 10 s');
  m.taunt(b);
  const t = untilSwitch(sim, m, b, 25);
  ok(t >= 10 - 1e-6, `taunt restarted the count: the next switch comes a full 10 s later (${t.toFixed(2)} s)`);
}
{
  // Not in the middle of a wind-up.
  const { sim, m, a, b } = boss();
  sim.hitMonster(a, m, 0);
  sim.hitMonster(b, m, 0);
  m.target = a;
  run(sim, 9.5);
  const priv = m as unknown as { windupT: number; swT: number };
  priv.swT = 11;
  priv.windupT = 5;
  sim.step(TICK);
  ok(m.target === a, 'past 10 s but winding up: keeps the target');
  priv.windupT = 0;
  sim.step(TICK);
  ok(m.target === b || m.state !== 'chase', 'free again: switches');
}
{
  // 0 = off.
  applyBalance({ bossSwitchSec: 0 });
  const { sim, m, a, b } = boss();
  sim.hitMonster(a, m, 0);
  sim.hitMonster(b, m, 0);
  m.target = a;
  ok(untilSwitch(sim, m, a, 30) === -1, 'switch time 0 = off');
  applyBalance({});
}

// ---------------------------------------------------------- ordinary monsters
// A passive one only chases after it is hit, so the aggro range cannot hold it on the player.
const calmMob = (sim: Sim, not?: Monster): Monster => sim.monsters.find((m) => m !== not && !m.isBoss && m.def.behavior === 'passive') as Monster;
{
  const sim = new Sim(ZONE_1);
  const m = calmMob(sim);
  const p = tough(sim.addPlayer(hero('A')));
  p.x = m.x + 6;
  p.z = m.z;
  sim.hitMonster(p, m, 0);
  ok(m.target === p && m.state === 'chase', 'a hit makes a passive monster chase');
  run(sim, 30);
  ok(m.target === p && m.state !== 'return', 'still after the player 30 s later, with no more hits (no 12 s give-up)');
  // Leash: dragged past 22 from home, it goes home as before.
  m.x = m.area.x + 30;
  run(sim, 1);
  ok(m.state === 'return' && m.target === null, 'the distance leash still sends it home');
  // The target leaves the map: it lets go.
  const m2 = calmMob(sim, m);
  p.x = m2.x + 4;
  p.z = m2.z;
  sim.hitMonster(p, m2, 0);
  ok(m2.target === p, 'second monster chases');
  sim.removePlayer(p);
  ok(m2.target === null, 'the target leaving the map ends the chase');
}
{
  // Give-up time switched on: it quits after N s without a hit.
  applyBalance({ mobGiveUpSec: 12 });
  const sim = new Sim(ZONE_1);
  const m = calmMob(sim);
  const p = tough(sim.addPlayer(hero('A')));
  p.x = m.x + 6;
  p.z = m.z;
  sim.hitMonster(p, m, 0);
  run(sim, 10);
  ok(m.target === p, 'give-up on: still chasing at 10 s');
  run(sim, 4);
  ok(m.target === null, 'give-up on: stops after 12 s without a hit');
  applyBalance({});
}
finish('aggro-ai');
