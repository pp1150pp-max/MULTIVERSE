// Volcano Heart big blast (owner 2026-11-22): safe spots scattered over the arena, away from players, and
// every living player can reach one in time. Switch off = the old ring round the boss.
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { BOSS_ROOMS, arenaRadius } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { BLAST, pickBlastSpots, type BlastPlayer } from '../src/shared/sim/volcanoHeart';
import type { BlastHazard } from '../src/shared/sim/volcanoHeart';
import type { Monster } from '../src/shared/sim/Monster';
import { finish, ok } from './check';

// ---------------------------------------------------------- settings
const d = mergeBalance({});
ok(d.heartBlastRandom === true && d.heartBlastSpots === 6 && d.heartBlastMinDist === 6 && d.heartBlastReach === 0.7, 'code defaults');
ok(JSON.stringify(checkBalance({ heartBlastRandom: true, heartBlastSpots: 6, heartBlastMinDist: 6, heartBlastReach: 0.7 }, true).tuning) === '{}', 'code values are not saved');
ok(checkBalance({ heartBlastSpots: 8, heartBlastRandom: false }, true).tuning?.heartBlastSpots === 8, 'changed values are kept');
ok('error' in checkBalance({ heartBlastRandom: 1 }, true) && 'error' in checkBalance({ heartBlastSpots: 0 }, true) && 'error' in checkBalance({ heartBlastReach: 2 }, true), 'bad values refused');
ok(balanceChanges({}, { heartBlastRandom: false, heartBlastMinDist: 3 }).includes('จุดปลอดภัย'), 'the audit names it');

// ---------------------------------------------------------- the picker
let seed = 12345;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const A = 16;
const base = { cx: 0, cz: 0, arenaR: A, spots: 6, safeR: BLAST.safeR, minDist: 6, warn: 3, reach: 0.7, bad: () => false, rand };
const reachOf = (p: BlastPlayer) => p.speed * base.warn * base.reach + base.safeR;
const randomPlayers = (n: number): BlastPlayer[] =>
  Array.from({ length: n }, () => { const a = rand() * 6.28; const r = rand() * (A - 1); return { x: Math.cos(a) * r, z: Math.sin(a) * r, speed: 3.5 }; });
let farOk = true, reachOkAll = true, insideOk = true, tried = 0;
for (let i = 0; i < 300; i++) {
  const players = randomPlayers(1 + (i % 3));
  const s = pickBlastSpots({ ...base, players });
  tried++;
  if (!s) { reachOkAll = false; continue; }
  if (s.length !== 6) farOk = false;
  for (const sp of s) if (Math.hypot(sp.x, sp.z) > A - 1 + 1e-9) insideOk = false;
  // Distance holds whenever it was not relaxed: check against a lenient 0 only if the strict pass could not find it.
  const strict = s.every((sp) => players.every((p) => Math.hypot(sp.x - p.x, sp.z - p.z) >= 6 - 1e-9));
  if (!strict) farOk = false;
  if (!players.every((p) => s.some((sp) => Math.hypot(sp.x - p.x, sp.z - p.z) <= reachOf(p)))) reachOkAll = false;
}
ok(farOk, `every spot is ≥ 6 from every player and there are 6 of them (${tried} tries)`);
ok(reachOkAll, 'every living player can reach a spot in time');
ok(insideOk, 'spots stay inside the arena');
const key = (s: { x: number; z: number }[] | null) => JSON.stringify(s?.map((p) => [p.x.toFixed(2), p.z.toFixed(2)]));
const p1 = [{ x: 5, z: 0, speed: 3.5 }];
ok(key(pickBlastSpots({ ...base, players: p1 })) !== key(pickBlastSpots({ ...base, players: p1 })), 'two draws differ');
// A wall: spots never land in it.
const wall = (x: number) => x > -2 && x < 2;
const w = pickBlastSpots({ ...base, players: p1, bad: (x) => wall(x) });
ok(!!w && w.every((s) => !wall(s.x)), 'unusable ground (walls, lava) is avoided');
// Too hard (a player hugging the boss would need distance 20): relaxes instead of failing.
const crowd: BlastPlayer[] = [{ x: 8, z: 0, speed: 3.5 }, { x: -8, z: 0, speed: 3.5 }, { x: 0, z: 8, speed: 3.5 }, { x: 0, z: -8, speed: 3.5 }];
const hard = pickBlastSpots({ ...base, players: crowd, minDist: 20 });
ok(!!hard && crowd.every((p) => hard.some((s) => Math.hypot(s.x - p.x, s.z - p.z) <= reachOf(p))), 'impossible minimum distance relaxes, nobody left without a spot');
ok(pickBlastSpots({ ...base, players: p1, bad: () => true }) === null, 'nothing usable → null (the caller falls back to the ring)');

// ---------------------------------------------------------- in the real fight
const room = BOSS_ROOMS.ashen_isle;
const hero = { name: 'A', classId: 'sword' as const, level: 40, exp: 0, gold: 0, equipment: {}, bag: [] };
const blastsOf = (random: boolean, n: number): BlastHazard[] => {
  applyBalance({ heartBlastRandom: random });
  const out: BlastHazard[] = [];
  for (let k = 0; k < n; k++) {
    const sim = new Sim(room, { keys: 1, bossDelay: 0 });
    const p = sim.addPlayer(hero);
    p.stats.maxHp = p.hp = 1e9;
    const boss = sim.monsters.find((m) => m.isBoss) as Monster;
    p.x = boss.x + 6;
    p.z = boss.z;
    sim.step(1 / 30);
    sim.hitMonster(p, boss, 0);
    boss.hp = boss.maxHp * 0.9;
    let got: BlastHazard | undefined;
    for (let i = 0; i < 30 * 40 && !got; i++) {
      p.hp = p.stats.maxHp = 1e9;
      sim.step(1 / 30);
      sim.drainEvents();
      got = sim.hazards.find((h): h is BlastHazard => h.k === 'blast');
    }
    if (got) {
      out.push({ ...got });
      const px = p.x, pz = p.z;
      ok(got.safe.every((s) => Math.hypot(s.x - px, s.z - pz) >= 6 - 1e-6) || !random, 'real fight: spots are far from the player');
      const cx = boss.x, cz = boss.z;
      ok(got.safe.every((s) => !sim.terrain.isBlocked(s.x, s.z, 1) && Math.hypot(s.x - cx, s.z - cz) <= arenaRadius(sim.zone)), 'real fight: spots stand on walkable ground in the arena');
    }
  }
  return out;
};
const on = blastsOf(true, 3);
ok(on.length === 3 && on.every((b) => b.safe.length === 6), 'on: the blast comes with 6 spots');
ok(new Set(on.map((b) => key(b.safe))).size === 3, 'on: spots differ each time');
const off = blastsOf(false, 2);
ok(off.length === 2 && off.every((b) => b.safe.every((s) => Math.abs(Math.hypot(s.x - b.x, s.z - b.z) - BLAST.spotAt) < 1e-6)), 'off: the old ring at 9 round the boss');
applyBalance({});
finish('heart-blast-spots');
