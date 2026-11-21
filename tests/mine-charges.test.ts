// Land Mine charges (owner 2026-11-19, docs/systems/skills.md "กับระเบิด"): rank 1/5/10 hold 1/2/3, charges come back one
// at a time, laying again waits the gap, no more mines lie on the ground than the stack count, laying never holds the
// player still (switch in /admin), and the /admin numbers check and audit. A real Sim, no server.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, currentBalance } from '../src/shared/balance';
import { chargeMax } from '../src/shared/skillTuning';
import { cleanSkillBook } from '../src/shared/skillBook';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';

const TICK = 1 / 30;

function field(rank: number): { sim: Sim; p: Player } {
  const sim = new Sim(ZONE_1);
  sim.monsters.length = 0;
  const p = sim.addPlayer({ ...newCharacterData('Tester', 'gunslinger'), level: 40 });
  p.skillBook = cleanSkillBook('gunslinger', { ranks: { gs_mine: rank }, worn: { e: 'gs_mine' } });
  p.x = -6;
  p.z = 0;
  p.stats.maxHp = p.hp = 1e9;
  p.mp = p.stats.maxMp = 1e6;
  return { sim, p };
}
const step = (sim: Sim, it: Partial<Intent>) => sim.step(TICK, () => ({ ...IDLE_INTENT, aim: { x: 10, z: 0 }, ...it }));
const wait = (sim: Sim, sec: number) => { for (let i = 0; i < Math.round(sec / TICK); i++) step(sim, {}); };
const lay = (sim: Sim) => step(sim, { skills: ['e'] });

try {
  applyBalance({});
  const sk = (p: Player) => p.skill('e')!;

  // ---------------------------------------------------------- stacks by rank
  for (const [rank, want] of [[1, 1], [4, 1], [5, 2], [9, 2], [10, 3]] as const) {
    const { p } = field(rank);
    ok(p.chargeMax(sk(p)) === want, `rank ${rank} holds ${want} (${p.chargeMax(sk(p))})`);
    ok(p.chargesOf(sk(p)) === want, `rank ${rank} starts full`);
  }
  ok(chargeMax(currentBalance().skills, 'gs_smoke', 10) === 0, 'other skills are plain cooldown skills');

  // ---------------------------------------------------------- the gap, and charges come back one at a time
  {
    const { sim, p } = field(10);
    const full = p.skillCooldown(sk(p));
    lay(sim);
    ok(p.chargesOf(sk(p)) === 2, 'laying one leaves 2');
    lay(sim);
    ok(p.chargesOf(sk(p)) === 2, 'laying again at once is refused (gap 0.3 s)');
    wait(sim, 0.3);
    lay(sim);
    ok(p.chargesOf(sk(p)) === 1, 'after the gap the next one is laid');
    wait(sim, 0.3);
    lay(sim);
    ok(p.chargesOf(sk(p)) === 0, 'all 3 laid');
    wait(sim, 0.3);
    lay(sim);
    ok(p.chargesOf(sk(p)) === 0, 'none left: refused');
    ok(sim.time > 0 && (p.cd.gs_mine ?? 0) > 0 && (p.cd.gs_mine ?? 0) <= full, 'the first laid one is being counted back');
    const tStart = sim.time;
    // Count how long until a charge returns, then until the second one does.
    let t1 = 0;
    let t2 = 0;
    for (let i = 0; i < 20 * 30 && !t2; i++) {
      step(sim, {});
      if (!t1 && p.chargesOf(sk(p)) === 1) t1 = sim.time - tStart;
      if (t1 && p.chargesOf(sk(p)) === 2) t2 = sim.time - tStart;
    }
    ok(t1 > 0 && t1 <= full + 0.1, `one charge is back after about the cooldown (${t1.toFixed(2)} s of ${full})`);
    ok(t2 - t1 > full - 0.2 && t2 - t1 < full + 0.2, `the next comes one cooldown later (${(t2 - t1).toFixed(2)} s)`);
  }

  // ---------------------------------------------------------- never more mines on the ground than stacks
  {
    const { sim, p } = field(5);
    lay(sim);
    const first = p.mines[0];
    wait(sim, 0.3);
    lay(sim);
    ok(p.mines.length === 2 && !first.gone, 'two lie at rank 5');
    wait(sim, 0.3);
    // Out of charges: nothing new. Refill by hand (the test of the cap itself) and lay a third.
    p.charges = {};
    delete p.cd.gs_mine;
    lay(sim);
    ok(p.mines.length === 2 && first.gone, 'a third makes the oldest vanish: still 2 on the ground');
  }

  // ---------------------------------------------------------- laying holds nobody still
  {
    const { sim, p } = field(1);
    for (let i = 0; i < 10; i++) step(sim, { move: { x: 1, z: 0 } });
    const x0 = p.x;
    step(sim, { move: { x: 1, z: 0 }, skills: ['e'] });
    ok(p.atkRootT === 0, 'no stop after laying a mine');
    for (let i = 0; i < 5; i++) step(sim, { move: { x: 1, z: 0 } });
    ok(p.x > x0 + 0.5 && p.moving, `keeps walking while laying (${(p.x - x0).toFixed(2)} m)`);
  }
  {
    applyBalance({ skills: { mineNoRoot: false } });
    const { sim, p } = field(1);
    step(sim, { skills: ['e'] });
    ok(p.atkRootT > 0, 'with the switch off a mine stops the player like any skill');
    applyBalance({});
  }

  // ---------------------------------------------------------- /admin numbers
  {
    ok(checkBalance({ skills: { mineMax: 2, mineGap: 1, mineRanks: [1, 3, 6, 10, 10] } }, true).error === undefined, 'valid mine numbers accepted');
    ok(checkBalance({ skills: { mineMax: 9 } }, true).error !== undefined, 'refused: 9 stacks');
    ok(checkBalance({ skills: { mineRanks: [5, 1, 10, 10, 10] } }, true).error !== undefined, 'refused: ranks out of order');
    ok(checkBalance({ skills: { mineNoRoot: 'x' } }, true).error !== undefined, 'refused: switch is not a boolean');
    ok(checkBalance({ skills: { mineMax: 3, mineGap: 0.3, mineNoRoot: true, mineRanks: [1, 5, 10, 10, 10] } }, true).tuning?.skills === undefined, 'values equal to the code are not stored');
    applyBalance({ skills: { mineMax: 2, mineRanks: [1, 3, 6, 10, 10] } });
    ok(chargeMax(currentBalance().skills, 'gs_mine', 3) === 2 && chargeMax(currentBalance().skills, 'gs_mine', 2) === 1, 'tuned ranks and max take effect');
    const audit = balanceChanges({}, { skills: { mineNoRoot: false, mineRanks: [1, 3, 6, 10, 10] } });
    ok(audit.includes('กับระเบิดวางไม่ชะงัก') && audit.includes('กับระเบิดแรงก์ที่ได้สแตค'), 'audit lists the mine changes');
    applyBalance({});
  }
} finally {
  applyBalance({});
}
finish('mine-charges');
