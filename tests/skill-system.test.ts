// The skill system (owner 2026-11-14): points (1 a level up to Lv.40), learning = rank 1 for a point, a point per
// rank up to 10, unlock levels by kind and tier, Q/E normal and R ultimate, taking points back (free while under
// 21 points, then 1,000 G each), growth per rank (damage +5%, MP +10%, cooldown -2%), old saves starting from zero
// with their points back, the cooldown kept on the skill, and the /admin balance checks. On real Sims, no server.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, mergeBalance, skillMpCost } from '../src/shared/balance';
import { CLASSES } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { IDLE_INTENT } from '../src/shared/sim/types';
import {
  cleanSkillBook, pointsEarned, pointsLeft, rankedCooldown, rankedDmg, rankedMp, refundPrice, skillParam, skillReach, unlockLevel,
} from '../src/shared/skillBook';
import { codeSkills } from '../src/shared/skillTuning';
import { oldSkills } from './skills';

const sk = (id: string) => [...CLASSES.sword.skills, ...CLASSES.mage.skills, ...CLASSES.gunslinger.skills].find((s) => s.id === id)!;

// ---------------------------------------------------------- the code's numbers
{
  const c = codeSkills();
  ok(c.pointsPerLevel === 1 && c.lastPointLevel === 40 && c.maxRank === 10, '1 point a level up to Lv.40, max rank 10');
  ok(c.unlock.normal.join() === '1,3,6,9,12,16,20,25' && c.unlock.ult.join() === '5,10' && c.unlock.passive.join() === '10,20,30', 'unlock levels');
  ok(c.freeRefundBelow === 21 && c.refundCost === 1000, 'refunds free under 21 points, then 1,000 G');
  ok(pointsEarned(1) === 1 && pointsEarned(40) === 40 && pointsEarned(50) === 40, 'points: Lv1 1, Lv40 40, Lv50 still 40');
  ok(unlockLevel(sk('fireball')) === 1 && unlockLevel(sk('meteor')) === 5 && unlockLevel(sk('headshot')) === 5, 'tier 0 normal at Lv1, tier 0 ultimate at Lv5');
  ok(Math.abs(rankedDmg(sk('fireball'), 10) / rankedDmg(sk('fireball'), 1) - 1.45) < 1e-9, 'damage +5% a rank: rank 10 = ×1.45');
  ok(rankedMp(sk('fireball'), 'mage', 1, 10) === 19 && rankedMp(sk('fireball'), 'mage', 40, 1) === skillMpCost(10, 'mage', 40), 'MP +10% a rank on top of the level formula');
  ok(Math.abs(rankedCooldown(sk('fireball'), 10) - 2.5 * 0.82) < 0.01, 'cooldown -2% a rank: rank 10 = ×0.82');
  ok(refundPrice(20) === 0 && refundPrice(21) === 1000, 'refund free at Lv20 (20 points), 1,000 G at Lv21');
}

// ---------------------------------------------------------- old and bad saves
{
  ok(JSON.stringify(cleanSkillBook('mage', undefined)) === '{"ranks":{},"worn":{}}', 'old save: nothing learned');
  const b = cleanSkillBook('mage', {
    ranks: { fireball: 3, meteor: 1, whirlwind: 5, frostnova: 0, bolt: 2, x: 1 },
    worn: { q: 'meteor', e: 'fireball', r: 'meteor', passive: 'fireball' },
  });
  ok(JSON.stringify(b.ranks) === '{"fireball":3,"meteor":1}', 'only this class\'s learnable skills with whole ranks from 1');
  ok(b.worn.q === undefined && b.worn.e === 'fireball' && b.worn.r === 'meteor' && b.worn.passive === undefined, 'worn kept to the slot\'s kind');
  ok(cleanSkillBook('mage', { ranks: { fireball: 1 }, worn: { q: 'fireball', e: 'fireball' } }).worn.e === undefined, 'a skill is worn once');
  ok(cleanSkillBook('mage', { ranks: {}, worn: { q: 'fireball' } }).worn.q === undefined, 'a skill not learned is not worn');

  const sim = new Sim(ZONE_1);
  const p = sim.addPlayer({ ...newCharacterData('Old', 'sword'), level: 30 });
  ok(!p.skill('q') && !p.skill('e') && !p.skill('r'), 'an old Lv.30 character starts with empty Q/E/R');
  ok(pointsLeft(p.level, p.skillBook) === 30, 'and 30 points to spend');
  ok(p.skill('basic')?.id === 'slash' && p.skill('dash')?.id === 'dash', 'basic attack and dash still work');
}

// ---------------------------------------------------------- learning, wearing, refunds on a Sim
{
  const sim = new Sim(ZONE_1);
  const p = sim.addPlayer({ ...newCharacterData('New', 'mage') });
  ok(!sim.learnSkill(p, 'meteor'), 'Lv1: an ultimate (Lv5) can\'t be learned');
  ok(sim.learnSkill(p, 'fireball') && p.skillBook.ranks.fireball === 1 && p.skill('q')?.id === 'fireball', 'Lv1: learns Fireball, worn on the first empty normal slot');
  ok(!sim.learnSkill(p, 'fireball'), 'no points left at Lv1');
  ok(!sim.learnSkill(p, 'whirlwind') && !sim.learnSkill(p, 42) && !sim.learnSkill(p, 'dash') && !sim.learnSkill(p, 'bolt'), 'other class / junk / basic / dash refused');
  p.level = 10;
  ok(sim.learnSkill(p, 'meteor') && p.skill('r')?.id === 'meteor', 'Lv10: learns Meteor, worn on R');
  ok(sim.learnSkill(p, 'frostnova') && p.skill('e')?.id === 'frostnova', 'Frost Nova goes to E');
  for (let i = 0; i < 20; i++) sim.learnSkill(p, 'fireball');
  ok(p.skillBook.ranks.fireball === 8 && pointsLeft(p.level, p.skillBook) === 0, 'ranks up while points last (10 points: 8 + 1 + 1)');
  p.level = 40;
  for (let i = 0; i < 20; i++) sim.learnSkill(p, 'fireball');
  ok(p.skillBook.ranks.fireball === 10, 'stops at max rank 10');

  ok(!sim.wearSkill(p, 'q', 'meteor'), 'an ultimate can\'t go on Q');
  ok(!sim.wearSkill(p, 'r', 'fireball'), 'a normal skill can\'t go on R');
  ok(!sim.wearSkill(p, 'x', 'fireball') && !sim.wearSkill(p, 'q', 7), 'junk slot / id refused');
  ok(sim.wearSkill(p, 'q', 'frostnova') && p.skill('q')?.id === 'frostnova' && p.skill('e')?.id === 'fireball', 'Q ↔ E swap');
  ok(sim.wearSkill(p, 'q', null) && !p.skill('q'), 'take off');
  p.lastHurt = sim.time;
  ok(!sim.wearSkill(p, 'q', 'frostnova') && !sim.refundSkill(p, 'fireball'), 'no wearing or refunds in combat');
  p.lastHurt = -99;

  // Refund: Lv40 has 40 points (≥ 21): 1,000 G each.
  p.gold = 500;
  ok(!sim.refundSkill(p, 'fireball') && p.skillBook.ranks.fireball === 10, 'not enough gold: refused');
  p.gold = 2500;
  ok(sim.refundSkill(p, 'fireball') && p.skillBook.ranks.fireball === 9 && p.gold === 1500, 'one point back for 1,000 G');
  p.level = 20;
  ok(sim.refundSkill(p, 'meteor') && p.skillBook.ranks.meteor === undefined && !p.skill('r') && p.gold === 1500, 'Lv20: free; rank 1 → forgotten and taken off R');

  const back = sim.addPlayer(p.toData());
  ok(JSON.stringify(back.skillBook) === JSON.stringify(p.skillBook), 'the book is saved and loaded');
}

// ---------------------------------------------------------- casting: rank MP and the cooldown kept on the skill
{
  const sim = new Sim(ZONE_1);
  for (let i = 0; i < 300 && !sim.monsters.some((m) => m.alive && !m.isBoss); i++) sim.step(0.1);
  const mob = sim.monsters.find((m) => m.alive && !m.isBoss)!;
  const p = sim.addPlayer({ ...newCharacterData('C', 'mage'), skills: oldSkills('mage', 10) });
  p.x = mob.x + 2;
  p.z = mob.z;
  const full = p.stats.maxMp;
  p.mp = full;
  sim.step(0.01, (x) => (x === p ? { ...IDLE_INTENT, aim: { x: mob.x, z: mob.z }, skills: ['q'] } : IDLE_INTENT));
  ok(Math.abs(full - p.mp - 19) < 0.5, `rank 10 Lv1 fireball costs 19 MP (${(full - p.mp).toFixed(2)})`);
  ok(Math.abs((p.cd.fireball ?? 0) - 2.05) < 0.02, `cooldown at rank 10 = 2.05 s (${p.cd.fireball})`);
  const left = p.cd.fireball;
  p.lastAttack = -99;
  sim.wearSkill(p, 'q', null);
  sim.wearSkill(p, 'q', 'fireball');
  ok(p.cd.fireball === left, 'taking it off and on keeps the cooldown');
}

// ---------------------------------------------------------- /admin balance checks
{
  const t = checkBalance({ skills: { maxRank: 10, refundCost: 2000, skills: { fireball: { dmg: 2.2, dmgPerRank: 8 } } } }, true).tuning!;
  ok(JSON.stringify(t) === '{"skills":{"refundCost":2000,"skills":{"fireball":{"dmgPerRank":8}}}}', `only differences stored (${JSON.stringify(t)})`);
  ok(balanceChanges({}, t) === 'ค่าคืนแต้ม (G ต่อแต้ม) 1000 → 2000, สกิล ลูกไฟ ดาเมจ %/แรงก์ 5 → 8', `audit (${balanceChanges({}, t)})`);
  for (const [what, v] of [
    ['max rank 0', { maxRank: 0 }], ['points 1.5', { pointsPerLevel: 1.5 }], ['unlock unsorted', { unlock: { ult: [10, 5] } }],
    ['unlock wrong length', { unlock: { normal: [1, 2] } }], ['unknown skill', { skills: { nope: { dmg: 1 } } }], ['dmg too big', { skills: { fireball: { dmg: 1000 } } }],
    ['unknown key', { x: 1 }],
  ] as const) {
    ok(checkBalance({ skills: v }, true).error !== undefined, `refused: ${what}`);
  }
  ok(JSON.stringify(checkBalance({ skills: { maxRank: 5, refundCost: -1 } }, false).tuning) === '{"skills":{"maxRank":5}}', 'not strict: bad value dropped');
  applyBalance(checkBalance({ skills: { pointsPerLevel: 2, lastPointLevel: 10, unlock: { ult: [2, 3] } } }, true).tuning!);
  ok(pointsEarned(40) === 20 && unlockLevel(sk('meteor')) === 2, 'tuning applies: 2 points a level to Lv10, ultimates at Lv2');
  applyBalance({});
  ok(mergeBalance({}).skills.skills.fireball.dmg === 2.2, 'fireball 220% in code');
  // Reach and a skill's own numbers (stun, slow...) are tuned too; status ones grow with the rank.
  const t2 = checkBalance({ skills: { skills: { earthquake: { reach: 6, params: { stun: 2 } }, fireball: { params: { blast: 3 } } } } }, true).tuning!;
  ok(JSON.stringify(t2) === '{"skills":{"skills":{"earthquake":{"reach":6,"params":{"stun":2}},"fireball":{"params":{"blast":3}}}}}', `reach and params stored (${JSON.stringify(t2)})`);
  ok(checkBalance({ skills: { skills: { earthquake: { params: { nope: 1 } } } } }, true).error !== undefined, 'refused: unknown param');
  ok(checkBalance({ skills: { skills: { frostnova: { params: { slow: 150 } } } } }, true).error !== undefined, 'refused: slow 150%');
  ok(balanceChanges({}, t2).includes('สตัน 1 → 2 วิ'), `audit names the param (${balanceChanges({}, t2)})`);
  applyBalance(t2);
  ok(skillParam(sk('earthquake'), 'stun') === 2 && Math.abs(skillParam(sk('earthquake'), 'stun', 10) - 2.9) < 1e-9, 'stun 2 s, rank 10 = ×1.45 (status +5%)');
  const r = skillReach(sk('earthquake'));
  const f = skillReach(sk('fireball'));
  ok(r?.kind === 'self' && r.radius === 6 && f?.kind === 'shot' && f.blast === 3 && f.range === 12, 'tuned reach: earthquake radius 6, fireball blast 3 (range 12)');
  applyBalance({});
  ok(skillParam(sk('rapidfire'), 'shots') === 3 && skillParam(sk('charge'), 'killCdCut') === 50, 'code: 3 shots, Charge kill cut 50%');
}

finish('skill-system');
