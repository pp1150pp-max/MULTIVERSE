// Slower levelling: the steeper EXP curve, Auto Play halving, boss gates and old-save migration.
import { finish, ok } from './check';
import { expToNext } from '../src/shared/formulas';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES } from '../src/shared/data/zones';
import type { CharacterData } from '../src/shared/sim/Player';

// ---------------------------------------------------------------- EXP curve (owner numbers, 2026-11-09)

const pinned: [number, number][] = [[25, 97_158], [30, 227_868], [40, 526_388], [49, 957_051]];
for (const [lv, want] of pinned) ok(Math.abs(expToNext(lv) - want) <= 1, `expToNext(${lv}) ≈ ${want} (${expToNext(lv)})`);
// Lv 1–19 unchanged (ramp ×1): 30·19^2.1+40 = floor → ×2 band at Lv 19
ok(expToNext(19) === Math.floor((Math.floor(30 * Math.pow(19, 2.1)) + 40) * 2), 'Lv.19 unchanged');
ok(expToNext(20) === Math.floor((Math.floor(30 * Math.pow(20, 2.1)) + 40) * 2.5), 'Lv.20 ramp is ×1');

const hero = (level: number, extra: Partial<CharacterData> = {}): CharacterData =>
  ({ name: 'H', classId: 'sword', level, exp: 0, gold: 0, equipment: {}, bag: [], ...extra });

type Priv = { shareExp(m: unknown): void; addExp(p: unknown, n: number): void };
function fixture() {
  const sim = new Sim(ZONES.emerald_forest);
  const bear = sim.monsters.find((m) => m.def.id === 'forest_bear')!;
  const mob = sim.monsters.find((m) => !m.isBoss)!;
  return { sim, bear, mob };
}
const priv = (s: Sim) => s as unknown as Priv;

// ---------------------------------------------------------------- Auto halving
{
  const { sim, mob } = fixture();
  mob.level = 5;
  (mob as { expReward: number }).expReward = 100;
  const a = sim.addPlayer(hero(5));
  const b = sim.addPlayer(hero(5));
  a.autoOn = true;
  mob.damageBy.clear();
  mob.damageBy.set(a.id, 100);
  priv(sim).shareExp(mob);
  mob.damageBy.clear();
  mob.damageBy.set(b.id, 100);
  priv(sim).shareExp(mob);
  ok(b.exp === 100 && a.exp === 50, `Auto gets 50% (${a.exp} vs ${b.exp})`);
  // party share: the Auto member's slice is halved too
  a.partyId = b.partyId = 1;
  a.exp = b.exp = 0;
  mob.damageBy.clear();
  mob.damageBy.set(b.id, 100);
  priv(sim).shareExp(mob);
  ok(b.exp === 50 && a.exp === 25, `Auto member's party share halved (${a.exp}/${b.exp})`);
}

// ---------------------------------------------------------------- gate blocks, boss kill unlocks
{
  const { sim, bear } = fixture();
  const a = sim.addPlayer(hero(10));
  ok(a.bossKills.length === 0, 'Lv.10 exactly at a gate: still needs the bear');
  priv(sim).addExp(a, expToNext(10) * 3);
  ok(a.level === 10 && a.exp === expToNext(10), `stuck at Lv.10 with a full bar (Lv ${a.level}, exp ${a.exp})`);
  priv(sim).addExp(a, 999);
  ok(a.level === 10 && a.exp === expToNext(10), 'excess EXP is lost');

  const mate = sim.addPlayer(hero(10));
  const hitter = sim.addPlayer(hero(10));
  const bystander = sim.addPlayer(hero(10)); // never hit it, not in the party
  a.partyId = mate.partyId = 7;
  hitter.exp = 0;
  mate.exp = expToNext(10);
  (bear as { expReward: number }).expReward = 1000;
  bear.damageBy.clear();
  bear.damageBy.set(a.id, 50);
  bear.damageBy.set(hitter.id, 50);
  priv(sim).shareExp(bear);
  ok(a.level === 11, `killer levels up at once (Lv ${a.level})`);
  ok(hitter.bossKills.includes('forest_bear') && hitter.exp > 0, 'someone who only hit the boss counts');
  ok(mate.bossKills.includes('forest_bear') && mate.level === 11, `party member sharing EXP counts and levels (Lv ${mate.level})`);
  ok(!bystander.bossKills.includes('forest_bear'), 'a player who did not hit it does not');
  ok(a.toData().bossKills!.includes('forest_bear'), 'kill is saved');
}

// ---------------------------------------------------------------- old saves
{
  const { sim } = fixture();
  const p35 = sim.addPlayer(hero(35));
  ok(['forest_bear', 'bog_witch', 'yeti'].every((b) => p35.bossKills.includes(b)) && !p35.bossKills.includes('volcano_heart'), 'Lv.35 old save: bear/witch/yeti passed, volcano not');
  ok(p35.level === 35, 'level never lowered');
  priv(sim).addExp(p35, expToNext(35) * 20);
  ok(p35.level > 35 && p35.level <= 40, `Lv.35 old save levels up to the Lv.40 gate (${p35.level})`);
  const p10 = sim.addPlayer(hero(10));
  ok(p10.bossKills.length === 0, 'old Lv.10 save needs the bear');
  const p11 = sim.addPlayer(hero(11));
  ok(p11.bossKills.join() === 'forest_bear', 'old Lv.11 save has passed the bear');
  const p1 = sim.addPlayer(hero(5, { bossKills: ['yeti'] }));
  ok(p1.bossKills.includes('yeti'), 'saved kills kept');
}

finish('boss-gate');
