// Crystal Spikes (venom crystal) and Hex Seed (stored-damage seed that jumps), owner 2026-11-20,
// docs/systems/skills-mage.md. Real Sims, no server. Dice pinned (no crit, ×1.0 roll) and monster defense 0, so each
// hit is exactly ATK × multiplier.
import { ok, finish } from './check';
import { applyBalance, classBalance } from '../src/shared/balance';
import { CLASSES, type SkillDef } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { castSkill } from '../src/shared/sim/skills';
import { tickHexSeeds } from '../src/shared/sim/hexSeed';
import { checkSkillTuning } from '../src/shared/skillTuning';

const sk = (id: string): SkillDef => CLASSES.mage.skills.find((s) => s.id === id)!;
const CRYSTAL = sk('mg_crystalspikes');
const HEX = sk('mg_hexseed');
const ATK = 100;

function field(n: number): { sim: Sim; p: Player; mobs: Monster[] } {
  const sim = new Sim(ZONE_1);
  for (let i = 0; i < 2000 && sim.monsters.filter((m) => m.alive && !m.isBoss).length < n; i++) sim.step(0.1);
  const mobs = sim.monsters.filter((m) => m.alive && !m.isBoss).slice(0, n);
  sim.monsters = mobs;
  const p = sim.addPlayer({ ...newCharacterData('Mage', 'mage'), level: 30 });
  p.stats.atk = ATK;
  p.stats.crit = 0;
  p.stats.maxHp = p.hp = 1e9;
  p.x = 0;
  p.z = 0;
  mobs.forEach((m, i) => {
    // A tight ring 3 m east of the player (all within 2 m of each other).
    const a = (i / n) * Math.PI * 2;
    m.x = 3 + Math.cos(a) * 1;
    m.z = Math.sin(a) * 1;
    m.defense = 0;
    m.level = 1;
    m.hp = 1e9;
    // Held where they are (no chasing, no walking home and forgetting the fight).
    m.pinnedUntil = 1e9;
  });
  return { sim, p, mobs };
}
const dealt = (m: Monster, p: Player): number => m.damageBy.get(p.id) ?? 0;

const realRandom = Math.random;
Math.random = () => 0.5;
try {
  applyBalance({});

  // ---------------------------------------------------------- Crystal Spikes: stacks to 5, then shatters the rest
  {
    const { sim, p, mobs } = field(3);
    const m = mobs[0];
    ok(castSkill(sim, p, CRYSTAL, { x: 3, z: 0 }, 1), 'crystal cast');
    const deltas: number[] = [];
    let last = 0;
    for (let t = 0; t < 9; t += 0.05) {
      sim.step(0.05);
      const d = dealt(m, p);
      if (d !== last) deltas.push(d - last);
      last = d;
    }
    // 0.15 × ATK per stack per second: 15, 30, 45, 60, 75, 75 on the 6 pulses, then the shatter: 5 stacks × 2 s left.
    ok(deltas.slice(0, 6).join() === '15,30,45,60,75,75', `stacks grow by one a pulse and stop at 5 (${deltas.join()})`);
    ok(deltas[6] === 150 && deltas.length === 7, `shatter: all the poison still to tick at once, then nothing (${deltas.slice(6).join()})`);
  }
  {
    // A monster that walks out of the circle keeps its poison until it runs out; the shatter takes what is left.
    const { sim, p, mobs } = field(2);
    const [a, b] = mobs;
    castSkill(sim, p, CRYSTAL, { x: 3, z: 0 }, 1);
    sim.step(0.05);
    a.x = 3; a.z = 0;
    b.x = 3; b.z = 0;
    // b leaves after the first pulse (1 stack, poison 3 s): it takes 15 at once, 15 a second until t=3, nothing at shatter.
    b.x = 40;
    for (let t = 0; t < 8; t += 0.05) sim.step(0.05);
    ok(dealt(b, p) === 45, `out of the circle: 1 stack ticks for its 3 s, no shatter (${dealt(b, p)})`);
    ok(dealt(a, p) === 15 + 30 + 45 + 60 + 75 + 75 + 150, `in the circle the whole time (${dealt(a, p)})`);
  }

  // ---------------------------------------------------------- Hex Seed
  const seedOn = (sim: Sim, m: Monster) => sim.hexSeeds.find((s) => s.m === m);
  {
    // One seed, on the monster nearest the mouse; it stores the caster's damage only, never a party member's or its own.
    const { sim, p, mobs } = field(3);
    const [a] = mobs;
    const q = sim.addPlayer({ ...newCharacterData('Friend', 'sword'), level: 30 });
    q.stats.atk = ATK;
    q.stats.crit = 0;
    ok(castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1), 'hex seed cast');
    ok(sim.hexSeeds.length === 1 && seedOn(sim, a)?.until === sim.time + 10, 'one seed, on the monster under the mouse, 10 s');
    ok(!castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1) || sim.hexSeeds.filter((s) => s.m === a).length === 1, 'never two of one caster\'s seeds in one monster');
    sim.hexSeeds = sim.hexSeeds.filter((s) => s.m === a);
    sim.hitMonster(p, a, 1);
    ok(seedOn(sim, a)!.stored === 100, `the caster's hit is stored (${seedOn(sim, a)!.stored})`);
    sim.hitMonster(q, a, 1);
    ok(seedOn(sim, a)!.stored === 100, 'a party member\'s hit is not');
    sim.hitMonster(p, a, 1, { skill: HEX });
    ok(seedOn(sim, a)!.stored === 100, 'the seed\'s own damage is not');
    sim.removePlayer(q);
  }
  {
    // The host dies: burst around it for stored + the skill's 2.2, then a seed with 50% jumps to every living one near.
    const { sim, p, mobs } = field(4);
    const [a, b, c, d] = mobs;
    d.x = 30; // too far to be hit or jumped to
    castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1);
    sim.hitMonster(p, a, 1);
    a.hp = 100;
    sim.hitMonster(p, a, 1);
    ok(!a.alive && seedOn(sim, a)!.stored === 200, 'the killing blow is stored too (200)');
    tickHexSeeds(sim);
    ok(dealt(b, p) === Math.round(ATK * (200 / ATK + 2.2)) && dealt(c, p) === dealt(b, p), `burst = stored + 2.2 × ATK (${dealt(b, p)})`);
    ok(dealt(d, p) === 0 && !seedOn(sim, d), 'outside 5 m: no hit, no seed');
    ok(seedOn(sim, b)?.stored === 100 && seedOn(sim, c)?.stored === 100, 'jumped seeds carry 50% of the stored damage');
    ok(seedOn(sim, b)!.until === sim.time + 10 && !seedOn(sim, a), 'jumped seeds start a fresh 10 s; the dead host has none');
  }
  {
    // At most 8 of one caster's seeds at once, and a cast past that is refused.
    const { sim, p, mobs } = field(12);
    const a = mobs[0];
    castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1);
    a.hp = 1;
    sim.hitMonster(p, a, 1);
    tickHexSeeds(sim);
    ok(sim.hexSeeds.length === 8, `11 monsters near, 8 seeds (${sim.hexSeeds.length})`);
    ok(!castSkill(sim, p, HEX, { x: mobs[11].x, z: mobs[11].z }, 1) && sim.hexSeeds.length === 8, 'a 9th cast is refused');
  }
  {
    // One burst never hits harder than 30 × ATK.
    const { sim, p, mobs } = field(2);
    const [a, b] = mobs;
    castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1);
    seedOn(sim, a)!.stored = 1e7;
    a.hp = 1;
    sim.hitMonster(p, a, 1);
    tickHexSeeds(sim);
    ok(dealt(b, p) === 30 * ATK, `capped at 30 × ATK (${dealt(b, p)})`);
  }
  {
    // A boss host: its burst uses 20% of the stored damage. Time runs out: the host alone, no jump.
    const { sim, p, mobs } = field(3);
    const [a, b] = mobs;
    Object.defineProperty(a, 'isBoss', { get: () => true });
    castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1);
    seedOn(sim, a)!.stored = 1000;
    sim.time = seedOn(sim, a)!.until;
    tickHexSeeds(sim);
    const bm = classBalance('mage').bossDmgMult;
    ok(dealt(a, p) === Math.round(ATK * (1000 * 0.2 / ATK + 2.2) * bm), `boss: 20% of stored + 2.2 (${dealt(a, p)})`);
    ok(dealt(b, p) === 0 && sim.hexSeeds.length === 0, 'time out: the host alone, nothing jumps');
  }
  {
    // Time runs out on a normal monster: stored + 2.2 on it alone, no jump.
    const { sim, p, mobs } = field(3);
    const [a, b] = mobs;
    castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1);
    seedOn(sim, a)!.stored = 300;
    for (let t = 0; t < 10.2; t += 0.05) sim.step(0.05);
    ok(dealt(a, p) === Math.round(ATK * 5.2) && dealt(b, p) === 0 && sim.hexSeeds.length === 0, `time out: 300 + 2.2 × ATK on the host only (${dealt(a, p)})`);
  }
  {
    // A boss next to a dying host takes only 20% of the stored part too.
    const { sim, p, mobs } = field(2);
    const [a, b] = mobs;
    Object.defineProperty(b, 'isBoss', { get: () => true });
    castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1);
    seedOn(sim, a)!.stored = 1000;
    a.hp = 1;
    sim.hitMonster(p, a, 1);
    tickHexSeeds(sim);
    const bm = classBalance('mage').bossDmgMult;
    ok(dealt(b, p) === Math.round(ATK * (1001 * 0.2 / ATK + 2.2) * bm), `a boss caught in a burst: 20% of stored (${dealt(b, p)})`);
  }
  {
    // Clean-up: caster leaves / dies, host leaves the field → seeds dropped with no burst, no errors.
    const { sim, p, mobs } = field(3);
    const [a, b] = mobs;
    castSkill(sim, p, HEX, { x: a.x, z: a.z }, 1);
    sim.monsters = sim.monsters.filter((m) => m !== a);
    tickHexSeeds(sim);
    ok(sim.hexSeeds.length === 0 && dealt(b, p) === 0, 'host gone from the field: seed dropped, no burst');
    castSkill(sim, p, HEX, { x: b.x, z: b.z }, 1);
    p.alive = false;
    b.hp = 1;
    tickHexSeeds(sim);
    ok(sim.hexSeeds.length === 0, 'caster dead: seeds dropped');
    p.alive = true;
    castSkill(sim, p, HEX, { x: b.x, z: b.z }, 1);
    sim.removePlayer(p);
    ok(sim.hexSeeds.length === 0, 'caster left: seeds dropped');
    for (let t = 0; t < 12; t += 0.1) sim.step(0.1);
    ok(true, 'steps after all that: no errors');
  }

  // ---------------------------------------------------------- /admin: every number tunable, old keys dropped
  {
    const keys = (s: SkillDef) => Object.keys(s.params ?? {}).sort().join();
    ok(keys(CRYSTAL) === 'life,maxStacks,poisonLife,pulse,radius', `crystal params (${keys(CRYSTAL)})`);
    ok(keys(HEX) === 'bossPct,burst,cap,carry,jump,maxSeeds,radius,seedLife', `hex seed params (${keys(HEX)})`);
    const old = checkSkillTuning({ skills: { mg_crystalspikes: { params: { every: 0.5, duration: 9, life: 7 } }, mg_hexseed: { params: { poison: 1, seedTime: 3, seedBlast: 4, carry: 40 } } } }, false);
    ok('tuning' in old && JSON.stringify(old.tuning) === JSON.stringify({ skills: { mg_crystalspikes: { params: { life: 7 } }, mg_hexseed: { params: { carry: 40 } } } }), `old settings dropped, new kept (${JSON.stringify('tuning' in old ? old.tuning : old)})`);
  }
} finally {
  Math.random = realRandom;
}
finish('mage crystal + hex seed');
