// Boss room, whole group down (owner 2026-11-17): the boss keeps its HP and waits (no walking home, healing or
// reset), so a phoenix-feather revive meets the same fight. Switch off = the old behaviour (walks home, heals).
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { BOSS_ROOMS } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import { finish, ok } from './check';

const hero = { name: 'A', classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] };
const TICK = 1 / 30;

// ---------------------------------------------------------- settings
ok(mergeBalance({}).bossWipeKeepHp === true && mergeBalance({}).roomWipeSec === 5, 'code defaults: on, 5 s');
ok(JSON.stringify(checkBalance({ bossWipeKeepHp: true, roomWipeSec: 5 }, true).tuning) === '{}', 'code values are not saved');
ok(checkBalance({ bossWipeKeepHp: false, roomWipeSec: 20 }, true).tuning?.roomWipeSec === 20, 'changed values are kept');
ok('error' in checkBalance({ bossWipeKeepHp: 1 }, true), 'a non-boolean switch is refused');
ok('error' in checkBalance({ roomWipeSec: 1 }, true) && 'error' in checkBalance({ roomWipeSec: 61 }, true), 'seconds outside 3–60 refused');
const ch = balanceChanges({}, { bossWipeKeepHp: false, roomWipeSec: 20 });
ok(ch.includes('บอสไม่ฟื้นเลือดตอนทีมตายหมด') && ch.includes('เวลาชุบตอนตายหมดทีม'), 'the audit names both');

// ---------------------------------------------------------- in a boss room
const room = Object.values(BOSS_ROOMS)[0];
/** A room with the hero fighting its boss, hurt to 60% HP, with the boss out of its home spot. */
const setup = () => {
  const sim = new Sim(room, { keys: 1, bossDelay: 0 });
  const p = sim.addPlayer(hero);
  p.stats.maxHp = p.hp = 1e9;
  const boss = sim.monsters.find((m) => m.isBoss) as Monster;
  boss.x = boss.area.x + 10;
  boss.z = boss.area.z;
  p.x = boss.x + 3;
  p.z = boss.z;
  sim.step(TICK);
  sim.hitMonster(p, boss, 0);
  boss.hp = boss.maxHp * 0.6;
  for (let i = 0; i < 30; i++) sim.step(TICK);
  sim.drainEvents();
  return { sim, p, boss };
};
const run = (sim: Sim, sec: number) => { for (let i = 0; i < sec * 30; i++) { sim.step(TICK); sim.drainEvents(); } };

{
  applyBalance({});
  const { sim, p, boss } = setup();
  ok(boss.alive && boss.state === 'chase', 'the boss is fighting');
  const hp = boss.hp;
  const shares = boss.damageBy.size;
  p.alive = false;
  p.hp = 0;
  run(sim, 3);
  const home = Math.hypot(boss.x - boss.area.x, boss.z - boss.area.z);
  ok(boss.hp === hp, `on: HP does not recover while everyone is down (${hp} → ${boss.hp})`);
  ok(boss.state === 'idle' && home > 3, `on: it stands where it was, not walking home (${home.toFixed(1)} away, ${boss.state})`);
  ok(boss.windupT <= 0 && boss.damageBy.size === shares, 'on: no wind-up left, damage shares kept');
  p.addStones('phoenix', 5);
  ok(sim.reviveHere(p) && p.alive, 'a feather gets the hero up');
  p.stats.maxHp = p.hp = 1e9;
  run(sim, 2);
  ok(boss.state === 'chase' && boss.hp <= hp && boss.hp > hp * 0.9, `on: it fights on with the same HP (${hp} → ${boss.hp})`);
}
{
  applyBalance({ bossWipeKeepHp: false });
  const { sim, p, boss } = setup();
  const hp = boss.hp;
  p.alive = false;
  p.hp = 0;
  run(sim, 3);
  ok(boss.hp > hp && boss.state === 'return', `off: the old behaviour, it walks home and heals (${hp} → ${boss.hp})`);
}
applyBalance({});
finish('boss-wipe');
