// Auto with a ranged class stops once the target is in reach instead of walking on into its face
// (the walk target from approaching it used to stay set). On a real Sim, no server.
import { ok, finish } from './check';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { AutoPlay } from '../src/shared/sim/autoplay';
import { IDLE_INTENT } from '../src/shared/sim/types';

const sim = new Sim(ZONE_1);
for (let i = 0; i < 300 && !sim.monsters.some((m) => m.alive && !m.isBoss); i++) sim.step(0.1);
const mob = sim.monsters.find((m) => m.alive && !m.isBoss)!;
ok(!!mob, 'zone 1 has a monster');

for (const classId of ['mage', 'gunslinger'] as const) {
  const p = sim.addPlayer({ name: 'T', classId, level: 30, exp: 0, gold: 0, equipment: {}, bag: [] });
  p.x = mob.x + 6;
  p.z = mob.z;
  p.moveTarget = { x: mob.x, z: mob.z }; // left over from walking up to it
  const auto = new AutoPlay();
  auto.start(p.x, p.z);
  const it = auto.intent({ player: p, monsters: sim.monsters, loots: [], time: 1, zone: ZONE_1 }, IDLE_INTENT);
  ok(it.basic, `${classId}: in reach at 6 → attacks`);
  const x0 = p.x;
  p.update(0.1, it);
  ok(Math.abs(p.x - x0) < 0.01 && !p.moveTarget, `${classId}: stays put instead of walking up to the monster`);
  sim.removePlayer(p);
}

finish('auto-ranged');
