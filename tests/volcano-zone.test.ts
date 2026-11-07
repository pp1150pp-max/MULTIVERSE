// Rules of map 4 (lava, the Volcano Heart) and Auto Play's boss rule, on a real Sim with no server.
import { ok, finish } from './check';
import { arenaRadius, clearingRadius, inBossArena, lavaAt, ZONES, ZONE_4 } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { Sim } from '../src/shared/sim/Sim';
import type { Player } from '../src/shared/sim/Player';
import { AutoPlay, autoBlocked } from '../src/shared/sim/autoplay';
import { BLAST, DODGE_SPEED, HEART_PHASES, HEART_SETS, METEOR, RING, inRingGap, type Hazard, type RingHazard } from '../src/shared/sim/volcanoHeart';
import { IDLE_INTENT } from '../src/shared/sim/types';

const hero = (level = 40) => ({ name: 'T', classId: 'sword' as const, level, exp: 0, gold: 0, equipment: {}, bag: [] });
const TICK = 1 / 30;
function run(sim: Sim, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds * 30; i++) {
    sim.step(TICK);
    each?.();
    sim.drainEvents();
  }
}
const heart = (sim: Sim) => sim.monsters.find((m) => m.def.id === 'volcano_heart')!;

// ---- layout
{
  const sim = new Sim(ZONE_4);
  const b = ZONE_4.boss!;
  ok(ZONES.nexus_city.portals.some((p) => p.to === 'ashen_isle' && p.minLevel === 0), 'the hub opens map 4 to everyone');
  ok(ZONE_4.portals.some((p) => p.to === 'nexus_city'), 'map 4 leads back to the hub');
  ok(Math.abs(b.x) + clearingRadius(ZONE_4) <= sim.terrain.bound && Math.abs(b.z) + clearingRadius(ZONE_4) <= sim.terrain.bound, 'clearing fits on the island');
  for (const a of ZONE_4.spawns) ok(!!MONSTERS[a.monster], `monster ${a.monster} exists`);
  for (const l of ZONE_4.lavaPools!) {
    const r = Math.max(l.rx, l.rz);
    ok(sim.terrain.distToPath(l.x, l.z) > r + 1, `pool at ${l.x},${l.z} stays off the road`);
    ok(Math.hypot(l.x - b.x, l.z - b.z) > clearingRadius(ZONE_4) + r, 'pool stays out of the boss clearing');
    ok(ZONE_4.spawns.every((s) => Math.hypot(l.x - s.x, l.z - s.z) > s.radius * 0.8 + r), 'pool stays out of spawn areas');
  }
  const blockers = sim.terrain.colliders.filter((c) => Math.hypot(c.x - b.x, c.z - b.z) < arenaRadius(ZONE_4) - 1 && c.r !== ZONE_4.bossSolid);
  ok(blockers.length === 0, 'nothing blocks walking inside the arena');
}

// ---- the way in, from the hub
{
  const snow = new Sim(ZONES.nexus_city);
  const gate = ZONES.nexus_city.portals.find((pt) => pt.to === 'ashen_isle')!;
  ok(!snow.terrain.isBlocked(gate.x, gate.z, 0.4) && snow.terrain.distToPath(gate.x, gate.z) < 1, 'the gate stands free at the end of a path');
  const travels = (level: number) => {
    const p = snow.addPlayer(hero(level));
    p.x = gate.x + 2;
    p.z = gate.z + 2;
    snow.step(TICK);
    snow.drainEvents();
    p.x = gate.x;
    p.z = gate.z;
    snow.step(TICK);
    const went = snow.drainEvents().some((e) => e.t === 'travel' && e.to === p.id && e.zone === 'ashen_isle');
    snow.removePlayer(p);
    return went;
  };
  ok(travels(1), 'Lv.1 walks through (no level gates)');
  const isle = new Sim(ZONE_4);
  const arrived = isle.addPlayer(hero(30), 'nexus_city');
  const back = ZONE_4.portals[0];
  ok(Math.hypot(arrived.x - back.x, arrived.z - back.z) < 5 && !isle.terrain.isBlocked(arrived.x, arrived.z, 0.3), 'arrives beside the portal back');
}

// ---- lava
{
  const sim = new Sim(ZONE_4);
  const p = sim.addPlayer(hero());
  const l = ZONE_4.lavaPools![0];
  p.x = l.x;
  p.z = l.z;
  const full = p.hp;
  run(sim, 2.1);
  const burned = full - p.hp;
  ok(burned > 0 && p.alive, `lava burns over time (${burned})`);
  ok(burned <= p.maxHp * 0.15, 'lava is a nuisance, not a killer');
  p.x = l.x + l.rx + 3;
  const after = p.hp;
  run(sim, 2);
  ok(p.hp >= after, 'stepping out stops the burn');
}

// ---- warnings leave time to walk out (plain walking speed, no dash, no boots)
for (const [i, ph] of HEART_PHASES.entries()) {
  ok(ph.meteorWarn >= METEOR.radius / DODGE_SPEED + 0.3, `phase ${i + 1}: meteor warning is long enough`);
  const R = arenaRadius(ZONE_4);
  let worst = 0;
  for (let x = -R; x <= R; x += 0.5) {
    for (let z = -R; z <= R; z += 0.5) {
      if (Math.hypot(x, z) > R) continue;
      let best = Infinity;
      for (let s = 0; s < BLAST.spots; s++) {
        const a = (s * Math.PI * 2) / BLAST.spots;
        best = Math.min(best, Math.hypot(x - Math.cos(a) * BLAST.spotAt, z - Math.sin(a) * BLAST.spotAt) - BLAST.safeR);
      }
      worst = Math.max(worst, best);
    }
  }
  ok(ph.blastWarn >= worst / DODGE_SPEED + 0.3, `phase ${i + 1}: blast warning covers the farthest walk (${(worst / DODGE_SPEED).toFixed(2)}s)`);
  // The nearest gap of a wave, from anywhere: the walk is shorter than the wave's arrival.
  const off = Math.PI / RING.gaps - RING.gapArc / 2;
  for (let r = 1; r <= R; r++) {
    const walk = (2 * r * Math.sin(off / 2)) / DODGE_SPEED;
    ok(walk <= ph.ringWarn + r / RING.speed, `phase ${i + 1}: a wave's gap is reachable at distance ${r}`);
  }
  ok(ph.beamSpin * 4 <= DODGE_SPEED, `phase ${i + 1}: beams can be outwalked close to the boss`);
  ok(HEART_SETS[i].every((set) => !set.includes('blast') || set.length === 1), `phase ${i + 1}: the blast always plays alone`);
  ok(HEART_SETS[i].every((set) => !(set.includes('ring') && set.includes('beams'))), `phase ${i + 1}: rings never meet beams`);
}
ok(HEART_SETS[0].every((set) => set.length === 1), 'above half HP only one set at a time');

// ---- the fight
{
  const sim = new Sim(ZONE_4);
  const m = heart(sim);
  const { x: bx, z: bz } = m;
  const p = sim.addPlayer(hero());
  p.stats.maxHp = p.hp = 1e7;

  // Nothing happens with nobody in the arena.
  p.x = bx + arenaRadius(ZONE_4) + 4;
  p.z = bz;
  run(sim, 5);
  ok(sim.hazards.length === 0, 'waits while nobody is in the arena');
  const hpOutside = m.hp;
  sim.hitMonster(p, m, 1);
  ok(m.hp === hpOutside, 'cannot be hurt from outside the arena');

  // Inside: it attacks in the set order and never moves.
  p.x = bx + 8;
  const seen = new Set<Hazard['k']>();
  run(sim, 40, () => {
    for (const h of sim.hazards) seen.add(h.k);
  });
  ok(['meteor', 'ring', 'beams', 'blast'].every((k) => seen.has(k as Hazard['k'])), `plays all four attacks (${[...seen]})`);
  ok(m.x === bx && m.z === bz, 'never moves');
  ok(p.hp < 1e7, 'attacks land on someone who stands still');

  sim.hitMonster(p, m, 1, { stun: 5 });
  ok(m.stunT === 0, 'cannot be stunned');

  // Rings really do spare the gaps.
  const ring: RingHazard = { id: 1, k: 'ring', x: 0, z: 0, start: 0, hit: 0, speed: 5, width: 1, maxR: 16, gaps: [0], gapArc: 1 };
  ok(inRingGap(ring, 0.4) && !inRingGap(ring, 0.6) && inRingGap(ring, Math.PI * 2 - 0.4), 'gap test wraps around');

  // Phases go by HP, and damage below the marks flags it.
  m.hp = m.maxHp * 0.4;
  run(sim, 0.2);
  ok(m.enraged, 'below half HP it speeds up');

  // Everyone leaves: it recovers.
  p.x = bx + arenaRadius(ZONE_4) + 5;
  run(sim, 11);
  ok(m.hp === m.maxHp && !m.enraged, 'recovers when left alone');
  run(sim, 8);
  ok(sim.hazards.length === 0, 'stops attacking when left alone');

  // Death clears the ground.
  p.x = bx + 8;
  run(sim, 6);
  m.hp = 1;
  sim.hitMonster(p, m, 1);
  ok(!m.alive && sim.hazards.length === 0, 'dying ends its attacks');
}

// ---- Auto Play stays away from bosses, on every map
for (const zone of Object.values(ZONES)) {
  if (!zone.boss) continue;
  const sim = new Sim(zone);
  const p: Player = sim.addPlayer(hero());
  p.x = zone.boss.x + 3;
  p.z = zone.boss.z;
  ok(inBossArena(zone, p.x, p.z) && autoBlocked(zone, sim.monsters, p), `${zone.id}: no Auto in the boss arena`);
  p.x = zone.start.x;
  p.z = zone.start.z;
  ok(!autoBlocked(zone, sim.monsters, p), `${zone.id}: Auto is fine at camp`);
  const boss = sim.monsters.find((m) => m.isBoss)!;
  boss.target = p;
  boss.state = 'chase';
  ok(autoBlocked(zone, sim.monsters, p), `${zone.id}: no Auto while a boss hunts you`);
}
{
  const sim = new Sim(ZONE_4);
  const p = sim.addPlayer(hero());
  const l = ZONE_4.lavaPools![1];
  p.x = l.x + 1;
  p.z = l.z;
  const it = new AutoPlay().intent({ player: p, monsters: sim.monsters, loots: sim.loots, time: 0, zone: ZONE_4 }, IDLE_INTENT);
  ok(!!it.moveTo && !lavaAt(ZONE_4, it.moveTo.x, it.moveTo.z), 'Auto walks out of lava');
}

// ---- the Heart's drops land where players can walk (not inside its rock, zone.bossSolid)
{
  let drops = 0;
  let stuck = 0;
  for (let i = 0; i < 40; i++) {
    const sim = new Sim(ZONE_4);
    const h = heart(sim);
    (sim as unknown as { killMonster(m: unknown): void }).killMonster(h);
    for (const l of sim.loots) {
      drops++;
      if (sim.terrain.isBlocked(l.x, l.z, 0.4)) stuck++;
    }
  }
  ok(drops > 40, `the Heart drops loot (${drops} drops in 40 kills)`);
  ok(stuck === 0, `every drop is on open ground a player can stand on (${stuck} inside a solid)`);
}

finish('volcano zone');
