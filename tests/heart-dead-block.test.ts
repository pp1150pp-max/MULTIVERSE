// The Volcano Heart's rock (a 1.5 collider on the boss's spot) must go when the boss dies: its spot has to be walkable.
import { BOSS_ROOMS } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import { finish, ok } from './check';

const hero = { name: 'A', classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] };
const TICK = 1 / 30;
const room = BOSS_ROOMS.ashen_isle;
const sim = new Sim(room, { keys: 1, bossDelay: 0 });
const p = sim.addPlayer(hero);
p.stats.maxHp = p.hp = 1e9;
const boss = sim.monsters.find((m) => m.isBoss) as Monster;
const { x, z } = boss.area;

ok(sim.terrain.isBlocked(x, z, p.radius), 'alive: the rock blocks the boss spot');
ok(sim.terrain.isBlocked(x + 1.2, z, p.radius), 'alive: and its edge');
sim.step(TICK);
sim.hitMonster(p, boss, boss.maxHp * 10);
for (let i = 0; i < 60; i++) { sim.step(TICK); sim.drainEvents(); }
ok(!boss.alive && sim.cleared, 'the boss is dead');
ok(!sim.terrain.isBlocked(x, z, p.radius), 'dead: the boss spot can be stood on');

// Walk the hero straight through the spot.
p.x = x - 4; p.z = z;
for (let i = 0; i < 200; i++) { p.moveTarget = { x: x + 4, z }; sim.step(TICK); sim.drainEvents(); }
ok(p.x > x + 3, `dead: the hero walked across it (x=${p.x.toFixed(1)})`);
finish('heart-dead-block');
