// The Bog Witch's spells (owner 2026-11-10): poison vials that leave pools, mud hands that hold, and a
// toad curse. Each is warned of first and can be dodged; damage is times her ATK, so keys raise it too.
// Real Sims of her room, no server.
import { ok, finish } from './check';
import { BOSS_ROOMS } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import type { Monster } from '../src/shared/sim/Monster';
import type { Intent } from '../src/shared/sim/types';
import { GRASP, HEX, VIAL, WitchSpells, type HexHazard } from '../src/shared/sim/bogWitch';
import { MONSTERS } from '../src/shared/data/monsters';

const ROOM = BOSS_ROOMS.misty_marsh;
const IDLE: Intent = { move: null, moveTo: null, aim: { x: 0, z: 0 }, basic: false, skills: [], dash: false, potion: null };

ok(MONSTERS.bog_witch.spells === 'witch', 'the Bog Witch casts spells');

/** A tough player (no defense, so damage is easy to compare) standing at (x, z). */
function tough(sim: Sim, name: string, x: number, z: number): Player {
  const p = sim.addPlayer({ ...newCharacterData(name, 'sword'), level: 20 });
  p.stats.maxHp = 1e9;
  p.hp = 1e9;
  p.stats.def = 0;
  p.stats.hpRegen = 0;
  p.x = x;
  p.z = z;
  return p;
}

/**
 * A room whose witch stands aside: the spells are driven by hand, so nothing else she does gets in
 * the way. Returns the sim, the witch and a fresh set of spells.
 */
function bench(keys = 1): { sim: Sim; m: Monster; sp: WitchSpells } {
  const sim = new Sim(ROOM, { keys });
  const m = sim.monsters.find((x) => x.isBoss)!;
  sim.monsters = [];
  return { sim, m, sp: new WitchSpells() };
}

/** Runs `secs` of the room with the spells ticking, players moving as `intent` says. */
function run(sim: Sim, sp: WitchSpells, m: Monster, secs: number, intent: (p: Player) => Intent = () => IDLE): void {
  for (let i = 0; i < Math.round(secs / 0.05); i++) {
    sim.step(0.05, intent);
    sp.update(sim, m);
  }
}

/** Casts until the given spell comes up (they go in turn: vial, grasp, hex). */
function castUntil(sim: Sim, sp: WitchSpells, m: Monster, p: Player | null, k: string): void {
  for (let i = 0; i < 3; i++) {
    const before = sim.hazards.length;
    sp.cast(sim, m, p);
    if (sim.hazards.slice(before).some((h) => h.k === k)) return;
    sp.clear(sim);
  }
  throw new Error(`no ${k}`);
}

// ---- vials and pools: one at each player, landing on their head however they run
{
  const { sim, m, sp } = bench();
  const a = tough(sim, 'Stays', m.x + 4, m.z);
  const b = tough(sim, 'Runs', m.x - 4, m.z);
  castUntil(sim, sp, m, a, 'vial');
  const vials = sim.hazards.filter((h) => h.k === 'vial');
  ok(vials.length === 2, 'a vial for each player (no cap)');
  const runB = (p: Player) => (p === b ? { ...IDLE, move: { x: -1, z: 0 } } : IDLE);
  run(sim, sp, m, VIAL.flight + 0.05, runB);
  ok(a.hp < 1e9 && b.hp < 1e9, 'both are hit, even the one running away');
  const pools = sim.hazards.filter((h) => h.k === 'pool');
  ok(pools.length === 2 && pools.every((h) => h.k === 'pool' && h.r === VIAL.radius), `each leaves a pool, radius ${VIAL.radius}`);
  ok(pools.some((h) => Math.hypot(h.x - b.x, h.z - b.z) < 0.5), "the runner's pool is where it caught them");
  run(sim, sp, m, 0.1, runB);
  ok(a.slowT > 0 && Math.abs(a.slowAmt - VIAL.slow) < 1e-9, `standing in the pool slows by ${VIAL.slow * 100}%`);
  const hpA = a.hp;
  run(sim, sp, m, 3, runB);
  const ticks = Math.round((hpA - a.hp) / (m.atk * VIAL.mult));
  ok(ticks >= 2 && ticks <= 4, `poison about once a second (${ticks} ticks in 3 s)`);
  ok(b.hp > a.hp, 'the runner took less (out of the pool)');
  ok(b.slowT === 0, 'and is no longer slowed');
  run(sim, sp, m, VIAL.poolTime);
  ok(!sim.hazards.length, `the pools dry up after ${VIAL.poolTime} s`);
}

// ---- mud hands: one under each player and GRASP.extra more around them, warned GRASP.warn s
{
  const { sim, m, sp } = bench();
  const a = tough(sim, 'Stays', m.x + 5, m.z);
  const b = tough(sim, 'Leaves', m.x - 5, m.z);
  castUntil(sim, sp, m, a, 'grasp');
  const hands = sim.hazards.filter((h) => h.k === 'grasp');
  ok(hands.length === 2 * (1 + GRASP.extra), `${1 + GRASP.extra} hands per player`);
  ok(hands.every((h) => Math.abs(h.hit - h.start - GRASP.warn) < 1e-9), `warned ${GRASP.warn} s`);
  ok(hands.every((h) => Math.min(Math.hypot(h.x - a.x, h.z - a.z), Math.hypot(h.x - b.x, h.z - b.z)) <= GRASP.spread + 1e-9), 'all of them around the players');
  // b gets well clear of every hand before they come up.
  b.x = m.x - 5 - 12;
  run(sim, sp, m, GRASP.warn + 0.05);
  const lost = 1e9 - a.hp;
  ok(lost > 0 && lost < m.atk * GRASP.mult * 1.15 && a.snareT > 0, 'caught: hurt once (however many hands) and held');
  ok(b.snareT === 0 && b.hp === 1e9, 'out of reach: nothing');
  const x0 = a.x;
  run(sim, sp, m, 0.5, () => ({ ...IDLE, move: { x: 1, z: 0 }, dash: true }));
  ok(a.x === x0, 'held: no walking, no dash');
  run(sim, sp, m, GRASP.hold, () => ({ ...IDLE, move: { x: 1, z: 0 } }));
  ok(a.snareT === 0 && a.x > x0, 'free again after the hold');
}

// ---- the toad curse: on everyone, follows them, then stops and flashes, then lands
{
  const { sim, m, sp } = bench();
  const a = tough(sim, 'Stays', m.x + 4, m.z);
  const b = tough(sim, 'Dashes', m.x - 4, m.z);
  castUntil(sim, sp, m, a, 'hex');
  const hexes = sim.hazards.filter((h) => h.k === 'hex') as HexHazard[];
  ok(hexes.length === 2 && hexes.some((h) => h.pid === a.id) && hexes.some((h) => h.pid === b.id), 'a curse on every player');
  // Both walk about while it follows.
  run(sim, sp, m, HEX.follow - 0.1, () => ({ ...IDLE, move: { x: 0, z: 1 } }));
  const onB = hexes.find((h) => h.pid === b.id)!;
  ok(Math.hypot(onB.x - b.x, onB.z - b.z) < 0.01, 'the circle follows them');
  run(sim, sp, m, 0.15);
  const locked = { x: onB.x, z: onB.z };
  // It has stopped: b dashes out, a stays.
  run(sim, sp, m, HEX.flash - 0.1, (p) => (p === b ? { ...IDLE, move: { x: -1, z: 0 }, dash: true } : IDLE));
  ok(onB.x === locked.x && onB.z === locked.z, 'then it stays where they were');
  run(sim, sp, m, 0.15);
  ok(a.toadT > 0 && a.stunT > 0, 'stayed in it: a toad, stunned');
  ok(a.hp === 1e9, 'the curse itself does no damage');
  ok(b.toadT === 0, 'dashed out while it flashed: no toad');
  run(sim, sp, m, HEX.toad);
  ok(a.toadT === 0 && a.stunT === 0, `back to normal after ${HEX.toad} s`);
}

// ---- keys make the poison stronger
{
  const hurt = (keys: number): number => {
    const { sim, m, sp } = bench(keys);
    const a = tough(sim, 'K', m.x + 4, m.z);
    castUntil(sim, sp, m, a, 'vial');
    run(sim, sp, m, VIAL.flight + 3.05);
    return 1e9 - a.hp;
  };
  const one = hurt(1);
  const three = hurt(3);
  ok(three / one > 2.4 && three / one < 3.6, `×3 keys: about 3 times the poison (${(three / one).toFixed(2)})`);
}

// ---- in a real fight: she casts on her own, and nothing stays once it ends
{
  const sim = new Sim(ROOM);
  const m = sim.monsters.find((x) => x.isBoss)!;
  const p = tough(sim, 'Fighter', m.x + 3, m.z);
  const seen = new Set<string>();
  for (let i = 0; i < 40 / 0.05 && seen.size < 3; i++) {
    sim.step(0.05);
    for (const h of sim.hazards) seen.add(h.k === 'pool' ? 'vial' : h.k);
  }
  ok(['vial', 'grasp', 'hex'].every((k) => seen.has(k)), `all three spells within 40 s (${[...seen].join(', ')})`);

  // Everyone leaves: she gives up, and her spells go with the fight.
  for (let i = 0; i < 200 && !sim.hazards.length; i++) sim.step(0.05);
  ok(sim.hazards.length > 0, 'something of hers is on the ground');
  sim.removePlayer(p);
  for (let i = 0; i < 40; i++) sim.step(0.05);
  ok(!sim.hazards.length, 'gone once nobody is fighting her');

  // A kill clears them too.
  const q = tough(sim, 'Killer', m.x + 3, m.z);
  for (let i = 0; i < 2000 && !sim.hazards.length; i++) sim.step(0.05);
  ok(sim.hazards.length > 0, 'she casts again in the next fight');
  q.stats.atk = 1e12;
  sim.hitMonster(q, m, 1);
  ok(!m.alive && !sim.hazards.length, 'gone when she dies');
}

finish('witch-skills');
