// Boss HP grows with the number of players who hit it (1 player x1, 2 x1.5, 3 x2) and goes back to
// one player's HP when the fight is over. Real Sims, no server.
import { ok, finish } from './check';
import { BOSS_ROOMS, ZONES } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';

const hero = (name: string) => ({ name, classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] });
const TICK = 1 / 30;

let rooms = 0;
for (const zone of Object.values(BOSS_ROOMS)) {
  rooms++;
  const sim = new Sim(zone);
  const m = sim.monsters.find((x) => x.def.id === zone.boss!.monster) as Monster;
  const base = m.maxHp;
  const [a, b, c] = ['A', 'B', 'C'].map((n) => {
    const p = sim.addPlayer(hero(n));
    // Next to the boss (inside the Volcano Heart's arena), and too tough to die during the test.
    p.x = m.x + 3;
    p.z = m.z;
    p.stats.maxHp = p.hp = 1e9;
    return p;
  });
  const name = m.def.id;

  sim.hitMonster(a, m, 1);
  ok(m.maxHp === base, `${name}: one player keeps its normal HP`);
  sim.hitMonster(a, m, 1);
  ok(m.maxHp === base, `${name}: the same player hitting again changes nothing`);
  const share = m.hp / m.maxHp;
  sim.hitMonster(b, m, 0);
  ok(m.maxHp === Math.round(base * 1.5), `${name}: a second player makes it x1.5 (${m.maxHp} of ${base})`);
  ok(Math.abs(m.hp / m.maxHp - share) < 0.01, `${name}: the share of HP left stays the same`);
  sim.hitMonster(c, m, 0);
  ok(m.maxHp === base * 2, `${name}: a third player makes it x2`);

  // Everyone leaves: it goes home (or the Heart waits out its timer) and is back to one player's HP.
  for (const p of [a, b, c]) {
    p.x = m.area.x + 200;
    p.z = m.area.z + 200;
  }
  for (let i = 0; i < 30 * 40 && (m.maxHp !== base || m.hp !== base); i++) {
    sim.step(TICK);
    sim.drainEvents();
  }
  ok(m.maxHp === base && m.hp === base && m.damageBy.size === 0, `${name}: with nobody fighting it goes back to normal, full HP`);
}

ok(rooms === 4, 'every boss room checked');

// Normal monsters never scale.
{
  const sim = new Sim(ZONES.emerald_forest);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  const base = m.maxHp;
  for (const n of ['A', 'B', 'C']) sim.hitMonster(sim.addPlayer(hero(n)), m, 0);
  ok(m.maxHp === base, 'normal monsters keep their HP however many hit them');
}

finish('boss hp');
