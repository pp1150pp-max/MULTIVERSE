// Extra effects per skill and the basic attack on the /admin "ระบบสกิล" tab (owner 2026-11-20): Sim only.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, currentBalance } from '../src/shared/balance';
import { CLASSES } from '../src/shared/data/classes';
import { MONSTERS } from '../src/shared/data/monsters';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { Monster } from '../src/shared/sim/Monster';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { basicAttack, castSkill } from '../src/shared/sim/skills';
import { rankedDmg, skillParamLines, skillReach } from '../src/shared/skillBook';
import { codeSkills, type ExtraEffect } from '../src/shared/skillTuning';
import type { ClassId } from '../src/shared/types';

const skill = (cls: ClassId, id: string) => CLASSES[cls].skills.find((s) => s.id === id)!;
const tune = (skills: unknown): void => {
  const c = checkBalance({ skills }, true);
  ok(!c.error, `tuning accepted (${c.error ?? ''})`);
  applyBalance(c.tuning ?? {});
};
const fx = (id: string, ...l: ExtraEffect[]) => ({ effects: { [id]: l } });

/** A sim with only our monsters: a normal one and a boss (Forest Bear: no scripted pattern), right in front of the player. */
function arena(cls: ClassId): { sim: Sim; p: Player; mob: Monster; boss: Monster } {
  const sim = new Sim(ZONE_1);
  const p = sim.addPlayer({ ...newCharacterData('X', cls), level: 40 });
  p.x = 0;
  p.z = 0;
  const mob = new Monster(9001, MONSTERS.forest_wolf, 10, ZONE_1.spawns[0], 2, 0.3);
  const boss = new Monster(9002, MONSTERS.forest_bear, 10, ZONE_1.spawns[0], 2, -0.3);
  for (const m of [mob, boss]) m.hp = 1e9;
  sim.monsters = [mob, boss];
  ok(!mob.isBoss && boss.isBoss && !boss.def.pattern, 'test monsters: a normal one and a boss without a pattern');
  return { sim, p, mob, boss };
}

// ---------------------------------------------------------- the owner's example: Flame Wave stuns 0.5 s, monsters only
{
  ok(!CLASSES.mage.skills.find((s) => s.id === 'mg_flamewave')!.params?.stun, 'Flame Wave has no stun of its own');
  tune(fx('mg_flamewave', { k: 'stun', to: 'mob', v: 0.5, t: 0 }));
  const { sim, p, mob, boss } = arena('mage');
  castSkill(sim, p, skill('mage', 'mg_flamewave'), { x: 5, z: 0 }, 1);
  ok(mob.stunT === 0.5, `normal monster stunned 0.5 s (${mob.stunT})`);
  ok(boss.stunT === 0, `boss not stunned (${boss.stunT})`);
  ok(skillParamLines(skill('mage', 'mg_flamewave'), 1).includes('เพิ่ม: สตัน 0.5 วิ (มอนธรรมดา)'), 'the tooltip lists it with (มอนธรรมดา)');

  // Positive control: the same boss is stunned when the target is "both" (30% of it, the boss rule).
  tune(fx('mg_flamewave', { k: 'stun', to: 'all', v: 0.5, t: 0 }));
  const b = arena('mage');
  castSkill(b.sim, b.p, skill('mage', 'mg_flamewave'), { x: 5, z: 0 }, 1);
  ok(Math.abs(b.boss.stunT - 0.15) < 1e-9 && b.mob.stunT === 0.5, `"ทั้งคู่": boss 0.15 s, monster 0.5 s (${b.boss.stunT}, ${b.mob.stunT})`);

  // Boss only.
  tune(fx('mg_flamewave', { k: 'stun', to: 'boss', v: 1, t: 0 }));
  const c = arena('mage');
  castSkill(c.sim, c.p, skill('mage', 'mg_flamewave'), { x: 5, z: 0 }, 1);
  ok(c.mob.stunT === 0 && c.boss.stunT > 0, `"บอสเท่านั้น": only the boss (${c.mob.stunT}, ${c.boss.stunT})`);
}

// ---------------------------------------------------------- stun gap: no perma-stun from a skill hitting again and again
{
  tune({ ...fx('mg_flamewave', { k: 'stun', to: 'mob', v: 0.5, t: 0 }), extraStunGap: 2 });
  const { sim, p, mob } = arena('mage');
  const fw = skill('mage', 'mg_flamewave');
  castSkill(sim, p, fw, { x: 5, z: 0 }, 1);
  mob.stunT = 0;
  mob.x = 2; mob.z = 0.3;
  castSkill(sim, p, fw, { x: 5, z: 0 }, 1);
  ok(mob.stunT === 0, 'a second hit within 2 s does not stun again');
  sim.time += 2.1;
  mob.x = 2; mob.z = 0.3;
  castSkill(sim, p, fw, { x: 5, z: 0 }, 1);
  ok(mob.stunT === 0.5, 'after the gap it stuns again');
}

// ---------------------------------------------------------- stronger wins against the skill's own effect
{
  // Frost Nova slows on its own; an extra slow that is weaker changes nothing, a stronger one wins with its time.
  const nova = skill('mage', 'frostnova');
  tune(fx('frostnova', { k: 'slow', to: 'all', v: 1, t: 15 }));
  const a = arena('mage');
  castSkill(a.sim, a.p, nova, { x: 1, z: 0 }, 1);
  const own = a.mob.slowAmt;
  ok(own > 0.01 && a.mob.slowT < 15, `weaker extra slow: the skill's own slow stays (${own}, ${a.mob.slowT})`);
  tune(fx('frostnova', { k: 'slow', to: 'all', v: 90, t: 7 }));
  const b = arena('mage');
  castSkill(b.sim, b.p, nova, { x: 1, z: 0 }, 1);
  ok(b.mob.slowAmt === 0.9 && b.mob.slowT === 7, `stronger extra slow wins with its time (${b.mob.slowAmt}, ${b.mob.slowT})`);
}

// ---------------------------------------------------------- basic attacks: effects and their own numbers
{
  tune(fx('slash', { k: 'slow', to: 'all', v: 50, t: 3 }, { k: 'armor', to: 'mob', v: 40, t: 4 }));
  const { sim, p, mob, boss } = arena('sword');
  basicAttack(sim, p, { x: 2, z: 0 });
  ok(mob.slowAmt === 0.5 && mob.slowT === 3, `sword basic: slow 50% 3 s (${mob.slowAmt}, ${mob.slowT})`);
  ok(Math.abs(mob.armorBreak - 0.4) < 1e-9 && boss.armorBreak === 0, 'sword basic: armor break on the monster only');

  // The mage's bolt is a shot: its id rides along to where it lands.
  tune(fx('bolt', { k: 'weak', to: 'all', v: 30, t: 5 }));
  const m = arena('mage');
  m.sim.monsters = [m.mob];
  m.mob.x = 3; m.mob.z = 0;
  basicAttack(m.sim, m.p, { x: 3, z: 0 });
  for (let i = 0; i < 20 && m.mob.weak === 0; i++) m.sim.step(0.05);
  ok(Math.abs(m.mob.weak - 0.3) < 1e-9, `mage basic bolt: attack down 30% when it lands (${m.mob.weak})`);

  // Damage, reach and speed of the basic attack.
  tune({ skills: { slash: { dmg: 2, reach: 3.5 } }, basicRate: { sword: 2.5 } });
  ok(rankedDmg(skill('sword', 'slash'), 1) === 2, 'slash tuned to 200% ATK');
  const r = skillReach(skill('sword', 'slash'));
  ok(r?.kind === 'cone' && r.range === 3.5, 'slash reach 3.5 m');
  const s = arena('sword');
  ok(Math.abs(s.p.attackRate - 2.5 * (1 + s.p.stats.atkSpeed / 100)) < 1e-9, `sword attacks 2.5 a second before atk speed (${s.p.attackRate})`);
  s.mob.x = 3.2; s.mob.z = 0;
  s.sim.monsters = [s.mob];
  const hp = s.mob.hp;
  basicAttack(s.sim, s.p, { x: 3.2, z: 0 });
  ok(s.mob.hp < hp, 'a monster 3.2 m away is in the tuned reach');
  ok(checkBalance({ skills: { skills: { slash: { mp: 5 } } } }, true).error !== undefined, 'a basic attack takes no MP');
}

// ---------------------------------------------------------- burn: refreshes, never stacks with itself, ticks give no extras
{
  tune(fx('slash', { k: 'dot', to: 'mob', v: 0.5, t: 3 }, { k: 'stun', to: 'mob', v: 0.3, t: 0 }));
  const { sim, p, mob } = arena('sword');
  sim.monsters = [mob];
  basicAttack(sim, p, { x: 2, z: 0 });
  basicAttack(sim, p, { x: 2, z: 0 });
  ok(mob.extraDots.size === 1, 'two hits: one burn');
  const hp = mob.hp;
  mob.stunT = 0;
  for (let i = 0; i < 70; i++) sim.step(0.05);
  ok(mob.hp < hp, 'the burn ticks');
  ok(mob.stunT === 0, 'its ticks do not stun');
}

// ---------------------------------------------------------- summons: the drone's shots carry the skill
{
  tune(fx('gs_drone', { k: 'weak', to: 'all', v: 25, t: 5 }));
  const { sim, p, mob } = arena('gunslinger');
  sim.monsters = [mob];
  mob.x = 3; mob.z = -0.8;
  castSkill(sim, p, skill('gunslinger', 'gs_drone'), { x: 3, z: 0 }, 1);
  for (let i = 0; i < 80 && mob.weak === 0; i++) sim.step(0.05);
  ok(Math.abs(mob.weak - 0.25) < 1e-9, `drone shots give the drone's extra effect (${mob.weak})`);
}

// ---------------------------------------------------------- checks on what /admin sends
{
  const bad = (skills: unknown, what: string) => ok(checkBalance({ skills }, true).error !== undefined, `refused: ${what}`);
  bad(fx('mg_flamewave', { k: 'stun', to: 'mob', v: 6, t: 0 }), 'stun 6 s');
  bad(fx('mg_flamewave', { k: 'slow', to: 'mob', v: 95, t: 2 }), 'slow 95%');
  bad(fx('mg_flamewave', { k: 'slow', to: 'mob', v: 30, t: 16 }), 'slow 16 s');
  bad(fx('mg_flamewave', { k: 'dot', to: 'mob', v: 11, t: 3 }), 'burn 11×ATK');
  bad(fx('mg_flamewave', { k: 'dot', to: 'mob', v: 1, t: 16 }), 'burn 16 s');
  bad(fx('mg_flamewave', { k: 'armor', to: 'mob', v: 91, t: 3 }), 'armor break 91%');
  bad(fx('mg_flamewave', { k: 'weak', to: 'mob', v: 50, t: 20 }), 'attack down 20 s');
  bad(fx('mg_flamewave', { k: 'kb', to: 'mob', v: 11, t: 0 }), 'knockback 11 m');
  bad(fx('mg_flamewave', { k: 'fly' as never, to: 'mob', v: 1, t: 0 }), 'unknown kind');
  bad(fx('mg_flamewave', { k: 'stun', to: 'everyone' as never, v: 1, t: 0 }), 'unknown target');
  bad(fx('mg_flamewave', ...Array.from({ length: 5 }, () => ({ k: 'stun', to: 'mob', v: 0.1, t: 0 }) as ExtraEffect)), '5 effects');
  bad(fx('mg_elementmastery', { k: 'stun', to: 'mob', v: 1, t: 0 }), 'a passive');
  bad(fx('nope', { k: 'stun', to: 'mob', v: 1, t: 0 }), 'an unknown skill');
  bad({ basicRate: { sword: 20 } }, 'basic attack 20 a second');
  bad({ extraStunGap: 31 }, 'stun gap 31 s');
  ok(checkBalance({ skills: fx('mg_flamewave', { k: 'stun', to: 'mob', v: 5, t: 0 }, { k: 'kb', to: 'all', v: 10, t: 0 }) }, true).error === undefined, 'top values allowed');
}

// ---------------------------------------------------------- code defaults store nothing; the audit names the change
{
  ok(JSON.stringify(checkBalance({ skills: codeSkills() }, true).tuning) === '{}', 'the whole code config stores nothing');
  ok(JSON.stringify(checkBalance({ skills: { effects: { mg_flamewave: [] }, basicRate: { ...codeSkills().basicRate }, extraStunGap: 2 } }, true).tuning) === '{}',
    'no effects, code speeds and code stun gap: nothing stored');
  const t = checkBalance({ skills: fx('mg_flamewave', { k: 'stun', to: 'mob', v: 0.5, t: 3 }) }, true).tuning!;
  ok(JSON.stringify(t) === '{"skills":{"effects":{"mg_flamewave":[{"k":"stun","to":"mob","v":0.5,"t":0}]}}}', `stored as sent, stun time cleared (${JSON.stringify(t)})`);
  const audit = balanceChanges({}, t);
  ok(audit.includes('คลื่นเพลิง เอฟเฟกต์พิเศษ ไม่มี → สตัน 0.5 วิ (มอนธรรมดา)'), `audit line (${audit})`);
  const r = checkBalance({ skills: { basicRate: { mage: 2 } } }, true).tuning!;
  ok(balanceChanges({}, r).includes('ความเร็วตีธรรมดานักเวท 1.4 → 2'), `audit: basic speed (${balanceChanges({}, r)})`);
  applyBalance({});
  ok(Object.keys(currentBalance().skills.effects).length === 0, 'reset: no extra effects');
}

finish('skill-extras');
