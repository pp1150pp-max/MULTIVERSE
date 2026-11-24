// Boss room drops spread over the arena (owner 2026-11-22): the more pieces, the wider; capped; every piece
// on ground a player can stand on; pickup priority unchanged; switch off = the old scatter.
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { BOSS_ROOMS } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import { finish, ok } from './check';

const hero = { name: 'A', classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] };
const TICK = 1 / 30;
const room = Object.values(BOSS_ROOMS)[0];

// ---------------------------------------------------------- settings
const d = mergeBalance({});
ok(d.bossLootSpread === true && d.bossLootBase === 2.5 && d.bossLootK === 0.8 && d.bossLootMax === 12, 'code defaults: on, 2.5 / 0.8 / 12');
ok(JSON.stringify(checkBalance({ bossLootSpread: true, bossLootBase: 2.5, bossLootK: 0.8, bossLootMax: 12 }, true).tuning) === '{}', 'code values are not saved');
ok(checkBalance({ bossLootMax: 20 }, true).tuning?.bossLootMax === 20, 'a changed value is kept');
ok('error' in checkBalance({ bossLootSpread: 1 }, true), 'a non-boolean switch is refused');
ok('error' in checkBalance({ bossLootMax: 0 }, true) && 'error' in checkBalance({ bossLootK: 6 }, true), 'out of range refused');
ok(balanceChanges({}, { bossLootSpread: false }).includes('กระจายของดรอปบอส'), 'the audit names the switch');

// ---------------------------------------------------------- drops
/** Kill the boss of a fresh room with `keys` keys; returns the drops and who hit it. */
const drop = (keys: number) => {
  const sim = new Sim(room, { keys, bossDelay: 0 });
  const p = sim.addPlayer(hero);
  const boss = sim.monsters.find((m) => m.isBoss) as Monster;
  sim.step(TICK);
  boss.damageBy.set(p.id, 100);
  sim.loots.length = 0;
  (sim as unknown as { dropLoot(m: Monster): void }).dropLoot(boss);
  return { sim, p, boss, loots: sim.loots };
};
const spread = (boss: Monster, loots: { x: number; z: number }[]) => Math.max(...loots.map((l) => Math.hypot(l.x - boss.x, l.z - boss.z)));
const mean = (boss: Monster, loots: { x: number; z: number }[]) => loots.reduce((s, l) => s + Math.hypot(l.x - boss.x, l.z - boss.z), 0) / loots.length;

applyBalance({});
{
  const few = drop(1);
  const many = drop(10);
  ok(many.loots.length > few.loots.length * 5, `more keys, more pieces (${few.loots.length} → ${many.loots.length})`);
  ok(mean(many.boss, many.loots) > mean(few.boss, few.loots) * 1.3, `many pieces spread wider (${mean(few.boss, few.loots).toFixed(1)} → ${mean(many.boss, many.loots).toFixed(1)} avg)`);
  ok(spread(many.boss, many.loots) <= 12 + 1e-6, `never past the max radius (${spread(many.boss, many.loots).toFixed(1)})`);
  for (const r of [few, many]) {
    const bad = r.loots.filter((l) => r.sim.terrain.isBlocked(l.x, l.z, 0.4)).length;
    ok(bad === 0, `every piece is on ground a player can stand on (${bad} blocked of ${r.loots.length})`);
  }
  // Same priority as before: the top damage dealer first, then anyone after the priority time.
  ok(many.loots.every((x) => x.owner === many.p.id && x.ownerUntil > many.sim.time && x.forever), 'owner, priority time and "forever" are unchanged');
  const other = { id: many.p.id + 99, partyId: null };
  ok(many.loots.every((x) => x.canTake(many.p, many.sim.time) && !x.canTake(other, many.sim.time) && x.canTake(other, many.sim.time + 10.5)), 'only the owner at first, anyone after 10 s');
}
{
  // A small max caps the spread; a big k with a small count still stays under it.
  applyBalance({ bossLootMax: 4 });
  const r = drop(10);
  ok(spread(r.boss, r.loots) <= 4 + 1e-6, `max 4: nothing past 4 (${spread(r.boss, r.loots).toFixed(1)})`);
}
{
  // Switch off: the old 0.5–2.5 scatter next to the boss (a blocked spot may push a piece a bit further).
  applyBalance({ bossLootSpread: false });
  const r = drop(10);
  ok(mean(r.boss, r.loots) < 3, `off: old scatter close to the boss (${mean(r.boss, r.loots).toFixed(1)} avg)`);
}
applyBalance({});
finish('boss-loot-spread');
