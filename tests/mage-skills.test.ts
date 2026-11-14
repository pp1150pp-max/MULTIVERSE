// Mage skills (owner-approved table 2026-11-14, docs/systems/skills-mage.md): 3 lines of 8 normal + 2 ultimates and
// 3 passives, every skill cast for real on a Sim, the shared statuses (shield, attack down, damage buff, cooldown haste,
// damage over time), the passives, every number tunable on /admin, and old saves. On real Sims, no server.
import { ok, finish } from './check';
import { applyBalance, checkBalance } from '../src/shared/balance';
import { CLASSES, CLASS_IDS, isLearnable, type SkillDef } from '../src/shared/data/classes';
import { SKILL_REACH } from '../src/shared/data/skillRanges';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import type { Player } from '../src/shared/sim/Player';
import { newCharacterData } from '../src/shared/sim/Player';
import { castSkill } from '../src/shared/sim/skills';
import { cleanSkillBook, skillParam, skillReach, unlockLevel } from '../src/shared/skillBook';
import { codeSkills } from '../src/shared/skillTuning';
import { passiveDealMult } from '../src/shared/passives';

const MAGE = CLASSES.mage.skills.filter(isLearnable);
const sk = (id: string): SkillDef => CLASSES.mage.skills.find((s) => s.id === id)!;

// ---------------------------------------------------------- the table
{
  ok(MAGE.length === 33, `33 learnable skills (${MAGE.length})`);
  for (let line = 0; line < 3; line++) {
    const normal = MAGE.filter((s) => s.kind === 'normal' && s.line === line).map((s) => s.tier).sort();
    const ult = MAGE.filter((s) => s.kind === 'ult' && s.line === line).map((s) => s.tier).sort();
    ok(normal.join() === '0,1,2,3,4,5,6,7' && ult.join() === '0,1', `line ${line + 1}: normal tiers 0-7 and ultimate tiers 0-1`);
  }
  ok(MAGE.filter((s) => s.kind === 'passive').map((s) => s.tier).sort().join() === '0,1,2', '3 passives, tiers 0-2');
  const all = CLASS_IDS.flatMap((c) => CLASSES[c].skills.map((s) => s.id)).filter((id) => id !== 'dash');
  ok(new Set(all).size === all.length, 'skill ids unique across classes');
  ok(MAGE.every((s) => s.id === 'fireball' || s.id === 'frostnova' || s.id === 'meteor' || s.id.startsWith('mg_')), 'new ids start with mg_');
  ok(MAGE.filter((s) => s.kind !== 'passive').every((s) => SKILL_REACH[s.id] && (s.anim === 'q' || s.anim === 'e' || s.anim === 'r')), 'every active skill has a reach and an existing animation');
  ok(MAGE.filter((s) => s.kind === 'passive').every((s) => !SKILL_REACH[s.id] && s.anim === undefined), 'passives have no reach or animation');
  // A point skill's circle is its radius param and a shot's explosion its blast param, so the tooltip and ring agree.
  for (const s of MAGE) {
    const r = SKILL_REACH[s.id];
    if (r?.kind === 'point') ok(s.params?.radius?.v === r.radius, `${s.id}: radius param = reach circle`);
    if (r?.kind === 'shot' && r.blast !== undefined) ok(s.params?.blast?.v === r.blast, `${s.id}: blast param = reach blast`);
  }
  ok(unlockLevel(sk('mg_chargedblast')) === 25 && unlockLevel(sk('mg_starfall')) === 10 && unlockLevel(sk('mg_arcanepower')) === 30, 'unlock: tier 7 Lv25, ultimate tier 1 Lv10, passive tier 2 Lv30');
}

// ---------------------------------------------------------- old saves keep the old skills where they were
{
  const b = cleanSkillBook('mage', { ranks: { fireball: 2, frostnova: 1, meteor: 3 }, worn: { q: 'fireball', e: 'frostnova', r: 'meteor' } });
  ok(b.worn.q === 'fireball' && b.worn.e === 'frostnova' && b.worn.r === 'meteor' && b.ranks.meteor === 3, 'old save: Fireball/Frost Nova/Meteor still worn');
}

// ---------------------------------------------------------- a Sim with a pack of monsters next to a Lv30 mage
function arena(skills?: unknown): { sim: Sim; p: Player; mobs: Monster[] } {
  const sim = new Sim(ZONE_1);
  for (let i = 0; i < 400 && sim.monsters.filter((m) => m.alive && !m.isBoss).length < 4; i++) sim.step(0.1);
  const mobs = sim.monsters.filter((m) => m.alive && !m.isBoss).slice(0, 4);
  const p = sim.addPlayer({ ...newCharacterData('Mage', 'mage'), level: 30, skills: skills as never });
  // Away from the town, the pack in a tight clump 3 m east of the player.
  const base = mobs[0];
  p.x = base.x - 3;
  p.z = base.z;
  mobs.forEach((m, i) => {
    m.x = base.x + (i % 2) * 0.6;
    m.z = base.z + (i > 1 ? 0.6 : 0);
    // Huge HP so nothing dies mid-test (hp only; max HP is a getter).
    m.hp = 1e9;
  });
  return { sim, p, mobs };
}
// Damage this test's mage dealt (a monster that walks home heals, so HP alone can't tell).
const hpLost = (mobs: Monster[]) => mobs.reduce((n, m) => n + [...m.damageBy.values()].reduce((a, b) => a + b, 0), 0);
const run = (sim: Sim, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.05) sim.step(0.05);
};

// ---------------------------------------------------------- every skill does its job
{
  const BUFFS = new Set(['mg_empowerfield', 'mg_manashield', 'mg_manawell']);
  for (const s of MAGE.filter((x) => x.kind !== 'passive')) {
    const { sim, p, mobs } = arena();
    const aim = { x: mobs[0].x, z: mobs[0].z };
    const cast = castSkill(sim, p, s, aim, 1);
    run(sim, 12);
    if (BUFFS.has(s.id)) ok(cast && hpLost(mobs) === 0, `${s.id}: cast, no damage (a buff)`);
    else ok(cast && hpLost(mobs) > 0, `${s.id}: cast and hurt the pack (${Math.round(hpLost(mobs))})`);
  }
  // No target in reach: Chain Lightning is not cast (no MP spent).
  const { sim, p } = arena();
  sim.monsters = [];
  ok(!castSkill(sim, p, sk('mg_chainlightning'), { x: p.x + 5, z: p.z }, 1), 'chain lightning with nothing in reach: not cast');
}

// ---------------------------------------------------------- statuses
{
  // Damage over time keeps hurting after the cast and marks the monster.
  // (The first poison tick lands a second after the cast.)
  const { sim, p, mobs } = arena();
  castSkill(sim, p, sk('mg_poisonmist'), { x: mobs[0].x, z: mobs[0].z }, 1);
  run(sim, 0.1);
  const early = hpLost(mobs);
  ok(mobs[0].dotUntil > sim.time && mobs[0].hasStatus(sim.time), 'poison marks the monster (status)');
  run(sim, 4);
  ok(hpLost(mobs) > early, 'poison ticks after the cast');
}
{
  // Attack down and the shield on monster hits.
  const { sim, p, mobs } = arena();
  castSkill(sim, p, sk('mg_sealveil'), p, 1);
  const m = mobs[0];
  ok(m.weak === 0.3 && m.weakUntil > sim.time, 'sealing veil: attack -30%');
  castSkill(sim, p, sk('mg_manashield'), p, 1);
  const shield = Math.round(p.maxHp * 0.15);
  ok(p.shield === shield && p.shieldUntil > sim.time, `mana shield: 15% max HP (${p.shield})`);
  const hp = p.hp;
  sim.hitPlayer(m, p, 0.0001, {});
  ok(p.hp === hp && p.shield < shield, 'a hit goes into the shield first');
  p.shieldUntil = 0;
  p.hp = p.maxHp;
  const avg = (fn: () => void) => {
    let n = 0;
    for (let i = 0; i < 200; i++) {
      p.alive = true;
      const before = p.hp;
      fn();
      n += before - p.hp;
      p.hp = p.maxHp;
    }
    return n / 200;
  };
  m.atk = 100;
  const weak = avg(() => sim.hitPlayer(m, p, 1, {}));
  m.weakUntil = 0;
  const full = avg(() => sim.hitPlayer(m, p, 1, {}));
  ok(weak < full * 0.85, `attack down lowers the monster's hits (${weak.toFixed(0)} < ${full.toFixed(0)})`);
}
{
  // Area buffs: every player in the circle (party or not), nobody outside.
  const { sim, p } = arena();
  const near = sim.addPlayer({ ...newCharacterData('Near', 'sword'), level: 30 });
  const far = sim.addPlayer({ ...newCharacterData('Far', 'sword'), level: 30 });
  near.x = p.x + 3; near.z = p.z;
  far.x = p.x + 20; far.z = p.z;
  castSkill(sim, p, sk('mg_empowerfield'), p, 1);
  ok(p.dmgMult === 1.2 && near.dmgMult === 1.2 && near.dmgUntil > sim.time && far.dmgUntil === 0, 'empowering field: caster and the player in the circle, not the one outside');
  castSkill(sim, p, sk('mg_timewarp'), p, 1);
  near.cd.x = 5;
  sim.step(1);
  ok(Math.abs(near.cd.x - 3.5) < 0.01, `time warp: cooldowns run 1.5× (${near.cd.x})`);
  near.mp = 0;
  castSkill(sim, p, sk('mg_manawell'), p, 1);
  run(sim, 1.2);
  ok(near.mp > 0 && near.shield > 0, 'mana well: MP back and a shield for the player in the circle');
}
{
  // Gravity Well pulls normal monsters in, never bosses.
  const { sim, p, mobs } = arena();
  const m = mobs[0];
  const c = { x: m.x + 3, z: m.z };
  castSkill(sim, p, sk('mg_gravitywell'), c, 1);
  const d0 = Math.hypot(m.x - c.x, m.z - c.z);
  run(sim, 1);
  ok(Math.hypot(m.x - c.x, m.z - c.z) < d0 - 0.3, 'gravity well pulls a monster toward its centre');
}
{
  // Dying or leaving the zone stops the caster's zones.
  const { sim, p, mobs } = arena();
  castSkill(sim, p, sk('mg_firerain'), { x: mobs[0].x, z: mobs[0].z }, 1);
  run(sim, 0.6);
  sim.removePlayer(p);
  const lost = hpLost(mobs);
  run(sim, 6);
  ok(hpLost(mobs) === lost, 'fire rain stops when the caster leaves');
}

// ---------------------------------------------------------- passives
{
  const { sim, p, mobs } = arena();
  const mp = p.stats.maxMp;
  const hp = p.stats.maxHp;
  sim.learnSkill(p, 'mg_manasource');
  ok(p.skillBook.worn.passive === 'mg_manasource' && Math.abs(p.stats.maxMp - mp * 1.15) < 0.01, `mana source: max MP +15% when learned and worn (${mp} → ${p.stats.maxMp})`);
  for (let i = 0; i < 9; i++) sim.learnSkill(p, 'mg_manasource');
  ok(Math.abs(p.stats.maxMp - mp * (1 + 0.15 * 1.45)) < 0.01, 'rank 10: +5% of the value a rank (15% → 21.75%)');
  sim.learnSkill(p, 'mg_arcanepower');
  ok(sim.wearSkill(p, 'passive', 'mg_arcanepower') && Math.abs(p.stats.maxHp - hp * 0.85) < 0.01 && Math.abs(p.stats.maxMp - mp) < 0.01, 'arcane power swapped in: max HP -15%, mana source off');
  ok(Math.abs(passiveDealMult(p, mobs[0]) - 1.18) < 1e-9, 'arcane power: damage ×1.18');
  p.gold = 10000;
  p.lastHurt = p.lastAttack = -99;
  sim.refundSkill(p, 'mg_arcanepower');
  ok(!p.skillBook.worn.passive && Math.abs(p.stats.maxHp - hp) < 0.01, 'refunded: off and HP back');
  sim.learnSkill(p, 'mg_elementmastery');
  ok(passiveDealMult(p, mobs[0]) === 1, 'elemental mastery: no bonus on a monster with no status');
  mobs[0].slowT = 2;
  ok(Math.abs(passiveDealMult(p, mobs[0]) - 1.12) < 1e-9, 'elemental mastery: +12% on a slowed monster');
}

// ---------------------------------------------------------- every number tunable on /admin
{
  const code = codeSkills();
  ok(MAGE.every((s) => code.skills[s.id] && Object.keys(s.params ?? {}).every((k) => code.skills[s.id].params[k] === s.params![k].v)), 'every mage skill and param is in the /admin skill table');
  const t = checkBalance({ skills: { skills: {
    mg_flameground: { reach: 14, params: { radius: 4, duration: 6 } },
    mg_elementmastery: { params: { bonus: 30 } },
    mg_chainlightning: { params: { jumps: 5 } },
  } } }, true);
  ok(!t.error, `tuning accepted (${t.error ?? ''})`);
  applyBalance(t.tuning!);
  const r = skillReach(sk('mg_flameground'));
  ok(r?.kind === 'point' && r.range === 14 && r.radius === 4, 'flame ground: tuned range 14, circle 4');
  ok(skillParam(sk('mg_elementmastery'), 'bonus', 1) === 30 && skillParam(sk('mg_chainlightning'), 'jumps') === 5, 'passive bonus 30%, 5 jumps');
  applyBalance({});
}

finish('mage-skills');
