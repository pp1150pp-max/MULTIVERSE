// The boss respawn countdown and the "boss is back" alert, on real Sims with no server.
import { ok, finish } from './check';
import { ZONES } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';

const hero = { name: 'T', classId: 'sword' as const, level: 50, exp: 0, gold: 0, equipment: {}, bag: [] };
const TICK = 1 / 30;

for (const zone of Object.values(ZONES)) {
  if (!zone.boss) {
    ok(new Sim(zone).bossRespawnIn() === null, `${zone.id}: no boss, no countdown`);
    continue;
  }
  const sim = new Sim(zone);
  ok(!sim.drainEvents().some((e) => e.t === 'bossSpawn'), `${zone.id}: no alert for the boss already there at start`);
  ok(sim.bossRespawnIn() === null, `${zone.id}: no countdown while the boss is alive`);

  const m = sim.monsters.find((x) => x.def.id === zone.boss!.monster)!;
  const p = sim.addPlayer(hero);
  p.x = m.x + 3;
  p.z = m.z;
  p.stats.atk = 1e9;
  sim.hitMonster(p, m, 1);
  sim.step(TICK);
  sim.drainEvents();
  const left = sim.bossRespawnIn();
  const [lo, hi] = zone.boss.respawn;
  ok(!m.alive && left !== null && left <= hi && left >= lo - 1, `${zone.id}: dead boss counts down from its respawn time (${left?.toFixed(1)}s)`);

  let alert = false;
  let steps = 0;
  while (!alert && steps++ < (hi + 5) * 30) {
    sim.step(TICK);
    alert = sim.drainEvents().some((e) => e.t === 'bossSpawn');
  }
  ok(alert, `${zone.id}: everyone in the zone is told when it comes back`);
  ok(sim.bossRespawnIn() === null, `${zone.id}: countdown gone once it is back`);
}

finish('boss respawn');
