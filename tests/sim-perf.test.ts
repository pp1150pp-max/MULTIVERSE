// Server load switches (owner 2026-11-28, src/shared/simPerfTuning.ts): the collision grid gives the very same pushes as the
// old loops over everything, and far idle monsters doze (update every dozeEvery ticks with the skipped time) until a player
// comes near or they get hit.
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { ZONES } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { Terrain } from '../src/shared/sim/terrain';
import type { Monster } from '../src/shared/sim/Monster';
import { finish, ok } from './check';

const TICK = 1 / 30;
const hero = { name: 'A', classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] };

// ---------------------------------------------------------- settings
const code = mergeBalance({}).simPerf;
ok(code.grid && code.doze && code.dozeRadius === 45 && code.dozeEvery === 4, 'code values: grid on, doze on, 45 m, every 4 ticks');
ok(JSON.stringify(checkBalance({ simPerf: { grid: true, dozeEvery: 4 } }, true).tuning) === '{}', 'code values are not saved');
ok(checkBalance({ simPerf: { doze: false, dozeRadius: 60 } }, true).tuning?.simPerf?.dozeRadius === 60, 'a changed value is kept');
ok('error' in checkBalance({ simPerf: { dozeRadius: 20 } }, true), 'a radius inside the view (34 m) is refused');
ok('error' in checkBalance({ simPerf: { grid: 1 } }, true), 'a non-boolean is refused');
ok('error' in checkBalance({ simPerf: { what: 1 } }, true), 'an unknown key is refused');
ok(balanceChanges({}, { simPerf: { grid: false } }).includes('เช็คชนแบบตาราง'), 'the audit names it');

// ---------------------------------------------------------- Terrain.resolve: grid = the full loop
{
  let diff = 0;
  let pushed = 0;
  let n = 0;
  for (const zone of Object.values(ZONES)) {
    const t = new Terrain(zone);
    for (let i = 0; i < 4000; i++) {
      // Half the points right beside a collider (so something is pushed), half anywhere.
      const c = t.colliders[i % Math.max(1, t.colliders.length)];
      const near = i % 2 === 0 && c;
      const u = {
        x: near ? c.x + (Math.random() * 2 - 1) * (c.r + 1) : (Math.random() * 2 - 1) * t.bound,
        z: near ? c.z + (Math.random() * 2 - 1) * (c.r + 1) : (Math.random() * 2 - 1) * t.bound,
        radius: 0.3 + Math.random() * 1.2,
      };
      const a = { ...u };
      const b = { ...u };
      applyBalance({ simPerf: { grid: false } });
      t.resolve(a);
      applyBalance({});
      t.resolve(b);
      if (a.x !== b.x || a.z !== b.z) diff++;
      if (a.x !== u.x || a.z !== u.z) pushed++;
      n++;
    }
  }
  ok(diff === 0, `resolve: grid and full loop give the same spot (${n} points in every zone, ${pushed} pushed, ${diff} differ)`);
}

// ---------------------------------------------------------- separateMonsters: grid = all pairs
{
  const sim = new Sim(ZONES.emerald_forest);
  sim.addPlayer(hero);
  // Bunch monsters into a few heaps so plenty of them stand in each other.
  sim.monsters.forEach((m, i) => {
    const h = sim.monsters[i % 7];
    m.x = h.area.x + (Math.random() - 0.5) * 3;
    m.z = h.area.z + (Math.random() - 0.5) * 3;
  });
  const before = sim.monsters.map((m) => [m.x, m.z]);
  const s = sim as unknown as { separateAll(): void; separateNear(): void };
  s.separateAll();
  const all = sim.monsters.map((m) => [m.x, m.z]);
  sim.monsters.forEach((m, i) => { m.x = before[i][0]; m.z = before[i][1]; });
  s.separateNear();
  const near = sim.monsters.map((m) => [m.x, m.z]);
  const moved = all.filter((p, i) => p[0] !== before[i][0] || p[1] !== before[i][1]).length;
  const same = near.every((p, i) => p[0] === all[i][0] && p[1] === all[i][1]);
  ok(moved > 20 && same, `separateMonsters: grid pushes exactly like all pairs (${moved} monsters pushed)`);
}

// ---------------------------------------------------------- dozing
/** A Sim with one player at the camp; counts each monster's updates and the seconds they were given. */
const counted = () => {
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer(hero);
  p.stats.maxHp = p.hp = 1e9;
  const calls = new Map<Monster, { n: number; secs: number }>();
  for (const m of sim.monsters) {
    const c = { n: 0, secs: 0 };
    calls.set(m, c);
    const up = m.update.bind(m);
    m.update = (dt, s) => { c.n++; c.secs += dt; up(dt, s); };
  }
  return { sim, p, calls };
};
{
  applyBalance({});
  const { sim, p, calls } = counted();
  const far = sim.monsters.find((m) => m.dozable() && Math.hypot(m.x - p.x, m.z - p.z) > 70)!;
  const n = 120;
  for (let i = 0; i < n; i++) sim.step(TICK);
  const c = calls.get(far)!;
  ok(!!far, 'there is a plain idle monster far from the player');
  ok(c.n <= n / 4 + 1 && c.n >= n / 4 - 1, `a far idle monster updates every 4th tick (${c.n} of ${n})`);
  ok(Math.abs(c.secs + far.dozeDt - n * TICK) < 1e-9, 'it gets every second it skipped');
  // A player walks up: it updates every tick again.
  p.x = far.x + 10;
  p.z = far.z;
  const before = c.n;
  for (let i = 0; i < 30; i++) sim.step(TICK);
  ok(c.n - before === 30, 'a player within the radius: every tick');
}
{
  applyBalance({ simPerf: { doze: false } });
  const { sim, p, calls } = counted();
  const far = sim.monsters.find((m) => Math.hypot(m.x - p.x, m.z - p.z) > 70)!;
  for (let i = 0; i < 60; i++) sim.step(TICK);
  ok(calls.get(far)!.n === 60, 'doze switched off: every tick, as before');
  applyBalance({});
}
{
  // A monster in a fight (it has a target) never dozes, wherever the players are.
  const { sim, p, calls } = counted();
  const m = sim.monsters.find((x) => x.dozable() && Math.hypot(x.x - p.x, x.z - p.z) > 70)!;
  m.target = p;
  m.state = 'chase';
  ok(!m.dozable(), 'a monster with a target is not dozable');
  const c = calls.get(m)!;
  sim.step(TICK);
  sim.step(TICK);
  ok(c.n === 2, 'a chasing monster updates every tick');
}

{
  // Floor 2 (owner 2026-11-29): monsters with special moves doze too, all but the parrot, the powder keg and the tentacles.
  for (const id of ['shipwreck_beach', 'smugglers_cove', 'ghost_ship_graveyard', 'kraken_maelstrom']) {
    const sim = new Sim(ZONES[id]);
    const moves = sim.monsters.filter((m) => m.def.move);
    const dozing = moves.filter((m) => m.dozable());
    const never = sim.monsters.filter((m) => ['parrot', 'keg', 'tentacle'].includes(m.def.move ?? ''));
    ok(dozing.length > 0 && never.every((m) => !m.dozable()), `${id}: ${dozing.length} of ${moves.length} special-move monsters may doze, none of the ${never.length} parrots/kegs/tentacles`);
  }
  const sim = new Sim(ZONES.shipwreck_beach);
  const p = sim.addPlayer(hero);
  p.stats.maxHp = p.hp = 1e9;
  const crab = sim.monsters.find((m) => m.def.move === 'shell' && Math.hypot(m.x - p.x, m.z - p.z) > 70)!;
  let n = 0;
  const up = crab.update.bind(crab);
  crab.update = (dt, s) => { n++; up(dt, s); };
  for (let i = 0; i < 120; i++) sim.step(TICK);
  ok(n >= 29 && n <= 31, `a far hermit crab updates every 4th tick (${n} of 120)`);
  crab.hideT = 1;
  ok(!crab.dozable(), 'a hermit crab in its shell does not doze');
}

finish('sim-perf');
