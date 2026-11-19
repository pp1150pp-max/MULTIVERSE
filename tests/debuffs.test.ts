// Debuffs on monsters (owner 2026-11-15): what the server sends in the snapshot so the client can show them, and the
// /admin switch for the icons and effects.
import { ok, finish } from './check';
import { checkBalance, balanceChanges } from '../src/shared/balance';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { DEBUFF_BIT, debuffMask, hasDebuff, runningSkillBuffs } from '../src/shared/sim/debuffs';
import { CLASSES } from '../src/shared/data/classes';
import { newCharacterData } from '../src/shared/sim/Player';
import { castSkill } from '../src/shared/sim/skills';

const sim = new Sim(ZONE_1);
const m = sim.monsters.find((x) => !x.isBoss)!;
const now = sim.time;
ok(debuffMask(m, now, 1) === 0, 'a fresh monster has none');
m.stunT = 1;
m.slowT = 1;
m.armorBreak = 0.3;
m.armorBreakUntil = now + 2;
m.weak = 0.2;
m.weakUntil = now + 2;
m.dotUntil = now + 2;
m.markBy = 7;
m.markUntil = now + 2;
const all = debuffMask(m, now, 7);
ok(all === 63 && ['stun', 'slow', 'armor', 'weak', 'dot', 'mark'].every((d) => hasDebuff(all, d as never)), `all six (${all})`);
ok(!hasDebuff(debuffMask(m, now, 8), 'mark') && debuffMask(m, now, 8) === 63 - DEBUFF_BIT.mark, 'the mark shows only to the player who put it');
ok(debuffMask(m, now + 3, 7) === (DEBUFF_BIT.stun | DEBUFF_BIT.slow), 'timed ones end (stun/slow count down in the sim)');
m.armorBreak = 0;
ok(!hasDebuff(debuffMask(m, now, 7), 'armor'), 'armor break of 0 is no debuff');

const t = checkBalance({ fxLayer: { debuffs: false } }, true).tuning!;
ok(JSON.stringify(t) === '{"fxLayer":{"debuffs":false}}', `switch stored (${JSON.stringify(t)})`);
ok(balanceChanges({}, t) === 'ดีบัฟบนตัวมอน (ไอคอน + เอฟเฟกต์) เปิด → ปิด', `audit (${balanceChanges({}, t)})`);
ok(checkBalance({ fxLayer: { debuffs: 1 } }, true).error !== undefined, 'strict refuses a non-boolean');

// Skill buffs under the owner's HP and MP bars (owner 2026-11-19): each buff cast is noted by skill id with its time.
{
  const gs = sim.addPlayer({ ...newCharacterData('Gun', 'gunslinger'), level: 40 });
  const skill = (id: string) => CLASSES.gunslinger.skills.find((s) => s.id === id)!;
  ok(runningSkillBuffs(gs, sim.time).length === 0, 'no skill buffs at first');
  castSkill(sim, gs, skill('gs_sniperfocus'), { x: 1, z: 0 }, 1);
  castSkill(sim, gs, skill('gs_hotrounds'), { x: 1, z: 0 }, 1);
  const sb = runningSkillBuffs(gs, sim.time);
  ok(sb.length === 2 && sb.some(([id]) => id === 'gs_sniperfocus') && sb.some(([id]) => id === 'gs_hotrounds'), `both buff skills listed (${JSON.stringify(sb)})`);
  ok(sb.every(([, left, total]) => left > 0 && left === total), 'seconds left = seconds given right after the cast');
  const longest = Math.max(...sb.map(([, , t]) => t));
  ok(runningSkillBuffs(gs, sim.time + longest + 0.1).length === 0, 'they drop once their time is up');
  castSkill(sim, gs, skill('gs_sniperfocus'), { x: 1, z: 0 }, 1);
  gs.clearSkillBuffs();
  ok(runningSkillBuffs(gs, sim.time).length === 0, 'death clears them');
}

finish('debuffs');
