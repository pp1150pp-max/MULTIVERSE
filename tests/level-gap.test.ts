// EXP and hits against monsters far above the player, and the tougher, always-hostile monsters of maps 3 and 4.
import { ok, finish } from './check';
import { expGapMult } from '../src/shared/formulas';
import { BOSS_ROOMS, HUB_ID, ZONES } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { Sim } from '../src/shared/sim/Sim';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const hero = (level: number) => ({ name: 'T', classId: 'sword' as const, level, exp: 0, gold: 0, equipment: {}, bag: [] });
const TICK = 1 / 30;

// ---- EXP by level gap
ok(expGapMult(20, 20) === 1 && expGapMult(20, 24) === 1, 'up to 4 levels above: full EXP');
ok(near(expGapMult(20, 25), 0.5), '5 levels above: half');
ok(near(expGapMult(20, 26), 0.4) && near(expGapMult(20, 27), 0.3) && near(expGapMult(20, 29), 0.1), '10% less for each level past 5');
ok(expGapMult(20, 30) === 0, '10 levels above: nothing');
ok(near(expGapMult(20, 16), 0.8), 'monsters below the player work as before');

// ---- MISS at 10 levels up
{
  const sim = new Sim(ZONES.ashen_isle);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  const low = sim.addPlayer(hero(m.level - 10));
  low.x = m.x + 1;
  low.z = m.z;
  const before = m.hp;
  sim.hitMonster(low, m, 5);
  ok(m.hp === before && !m.damageBy.has(low.id), '10 levels below: every hit misses');
  const ok9 = sim.addPlayer(hero(m.level - 9));
  ok9.x = m.x + 1;
  ok9.z = m.z;
  sim.hitMonster(ok9, m, 5);
  ok(m.hp < before, '9 levels below: hits land');
}

// ---- maps 3 and 4: stronger, faster, and every monster attacks on sight
for (const [id, stats, tough, mob] of [['frost_reach', 4.5, 0.7, 0.75], ['ashen_isle', 7, 0.5, 0.7]] as const) {
  const zone = ZONES[id];
  ok(zone.monsterBoost?.stats === stats && zone.monsterBoost?.tough === tough, `${id}: attack x${stats}, HP and defense x${stats * tough}`);
  const sim = new Sim(zone);
  const passive = sim.monsters.find((m) => m.def.aggroRange === 0 && !m.isBoss)!;
  ok(!!passive, `${id}: has a monster that is passive by nature (${passive?.def.id})`);
  const base = MONSTERS[passive.def.id];
  const sc = 1 + 0.18 * (passive.level - base.levels[0]);
  ok(passive.maxHp === Math.round(base.hp * sc * stats * (tough * mob)), `${id}: ordinary monsters' HP is x${(stats * tough * mob).toFixed(3)}`);
  const p = sim.addPlayer(hero(40));
  p.stats.maxHp = p.hp = 1e9;
  p.x = passive.x + 4;
  p.z = passive.z;
  for (let i = 0; i < 10; i++) sim.step(TICK);
  ok(passive.target === p, `${id}: a passive monster attacks a player who walks up to it`);
}

// ---- the hub's copies keep their own temper
{
  const sim = new Sim(ZONES[HUB_ID]);
  const passive = sim.monsters.find((m) => m.def.aggroRange === 0);
  if (passive) {
    const p = sim.addPlayer(hero(40));
    p.x = passive.x + 3;
    p.z = passive.z;
    for (let i = 0; i < 10; i++) sim.step(TICK);
    ok(passive.target !== p, `hub: ${passive.def.id} stays passive`);
  }
  ok(ZONES[HUB_ID].spawns.every((s) => !s.boost?.aggro), 'hub: no spawn area forces aggro');
}

// ---- the yeti's minions keep the full x4.5 HP and are 30% faster
{
  const sim = new Sim(BOSS_ROOMS.frost_reach);
  const yeti = sim.monsters.find((m) => m.def.id === 'yeti')!;
  ok(yeti.maxHp === Math.round(MONSTERS.yeti.hp * 4.5 * 0.7), `yeti: HP x3.15 (${yeti.maxHp})`);
  ok(MONSTERS.yeti_minion.ignoreTough === true && MONSTERS.yeti_minion.speedMult === 1.3, 'yeti minions: full HP and defense, 30% faster');
}

// ---- boss drops: 6 pieces of gear plus guaranteed epics
for (const [zoneId, epics] of [['frost_reach', 1], ['ashen_isle', 2]] as const) {
  const sim = new Sim(BOSS_ROOMS[zoneId]);
  const boss = sim.monsters.find((m) => m.isBoss)!;
  const p = sim.addPlayer(hero(50));
  p.x = boss.x + 3;
  p.z = boss.z;
  p.stats.atk = 1e12;
  sim.hitMonster(p, boss, 1);
  const items = sim.loots.filter((l) => l.kind.type === 'item').map((l) => (l.kind as { item: { rarity: string } }).item);
  ok(!boss.alive && items.length === 6 + epics, `${boss.def.id}: drops ${6 + epics} pieces of gear (${items.length})`);
  ok(items.filter((i) => i.rarity === 'epic').length >= epics, `${boss.def.id}: at least ${epics} of them epic`);
}

finish('level gap');
