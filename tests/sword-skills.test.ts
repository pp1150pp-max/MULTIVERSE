// The Swordsman's 30 skills and 3 passives (owner approved 2026-11-14, docs/plans/sword-skills.md): the table's
// shape (3 lines × 8 normal + 2 ultimates, 3 passives), reach and /admin tuning for every skill, old saves (Charge
// moved from R to a normal skill), and each skill cast on a real Sim: damage lands, buffs and statuses take hold,
// passives change damage, defense and the dash. No server.
import { ok, finish } from './check';
import { checkBalance } from '../src/shared/balance';
import { CLASSES, CLASS_IDS, isLearnable, type SkillDef } from '../src/shared/data/classes';
import { SKILL_REACH } from '../src/shared/data/skillRanges';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import type { Monster } from '../src/shared/sim/Monster';
import { castSkill } from '../src/shared/sim/skills';
import { cleanSkillBook, skillReach } from '../src/shared/skillBook';
import { codeSkills } from '../src/shared/skillTuning';
import { IDLE_INTENT } from '../src/shared/sim/types';

const TICK = 1 / 30;
const sword = CLASSES.sword;
const learn = sword.skills.filter(isLearnable);
const sk = (id: string): SkillDef => learn.find((s) => s.id === id)!;
/** Buffs on the player alone: no reach. */
const SELF_ONLY = ['sw_overdrive', 'sw_guard', 'sw_thorns', 'sw_anchor'];

// ---------------------------------------------------------- the table
{
  const normals = learn.filter((s) => s.kind === 'normal');
  const ults = learn.filter((s) => s.kind === 'ult');
  const passives = learn.filter((s) => s.kind === 'passive');
  ok(normals.length === 24 && ults.length === 6 && passives.length === 3, `24 normal, 6 ultimates, 3 passives (${normals.length}/${ults.length}/${passives.length})`);
  for (let line = 0; line < 3; line++) {
    const n = normals.filter((s) => s.line === line).map((s) => s.tier).sort();
    const u = ults.filter((s) => s.line === line).map((s) => s.tier).sort();
    ok(n.join() === '0,1,2,3,4,5,6,7' && u.join() === '0,1', `line ${line}: normal tiers 0–7, ultimate tiers 0–1`);
  }
  ok(passives.map((s) => s.tier).sort().join() === '0,1,2', 'passive tiers 0–2');
  ok(sword.lines.map((l) => l.nameTh).join() === 'สายคมดาบ,สายวายุ,สายปราการ', 'line names');
  ok(sk('whirlwind').line === 0 && sk('earthquake').line === 2 && sk('charge').line === 1 && sk('charge').kind === 'normal' && sk('charge').tier === 0,
    'old skills kept: Whirlwind line 0, Earthquake line 2, Charge now the first normal skill of line 1');
  const all = CLASS_IDS.flatMap((c) => CLASSES[c].skills.filter(isLearnable).map((s) => s.id));
  ok(new Set(all).size === all.length, 'learnable skill ids unique across classes');
  ok(learn.every((s) => s.anim === undefined ? s.kind === 'passive' : ['q', 'e', 'r'].includes(s.anim)), 'every active skill plays an existing animation row');
  const actives = learn.filter((s) => s.kind !== 'passive');
  ok(actives.every((s) => SELF_ONLY.includes(s.id) ? !SKILL_REACH[s.id] : !!skillReach(s)), 'every skill but the self buffs has a reach');
  ok(passives.every((s) => !SKILL_REACH[s.id]), 'passives have no reach');
  const code = codeSkills();
  ok(learn.every((s) => !!code.skills[s.id] && Object.keys(s.params ?? {}).every((k) => code.skills[s.id].params[k] === s.params![k].v)),
    'every skill and every number of it is on the /admin table');
  ok(checkBalance({ skills: code }, true).error === undefined, '/admin can save the whole table as it is (no-reach buffs included)');
  const t = checkBalance({ skills: { skills: { sw_guard: { reach: 0, params: { less: 55 } }, sw_execute: { params: { bonus: 150 } } } } }, true);
  ok(JSON.stringify(t.tuning) === '{"skills":{"skills":{"sw_guard":{"params":{"less":55}},"sw_execute":{"params":{"bonus":150}}}}}', `sword numbers tunable (${JSON.stringify(t.tuning ?? t.error)})`);
  ok(checkBalance({ skills: { skills: { sw_flurry: { params: { hits: 99 } } } } }, true).error !== undefined, 'refused: out of range');
  ok(passives.every((s) => Object.values(s.params ?? {}).some((p) => p.status)), 'passive effects grow with rank (status %/rank)');
}

// ---------------------------------------------------------- old saves
{
  const b = cleanSkillBook('sword', { ranks: { charge: 3, whirlwind: 2 }, worn: { q: 'whirlwind', r: 'charge' } });
  ok(b.ranks.charge === 3 && b.worn.r === undefined && b.worn.q === 'whirlwind', 'Charge worn on R (old ultimate): taken off R, rank kept');
  ok(cleanSkillBook('sword', { ranks: { charge: 1 }, worn: { e: 'charge' } }).worn.e === 'charge', 'Charge can be worn on Q/E now');
}

// ---------------------------------------------------------- casting on a Sim
/** A Sim with one tough monster 1.6 m east of a Lv.40 sword who can't die. */
function arena(dist = 1.6): { sim: Sim; p: Player; m: Monster } {
  const sim = new Sim(ZONE_1);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  sim.monsters.length = 0;
  sim.monsters.push(m);
  m.x = 0;
  m.z = 0;
  m.hp = 1e7;
  const p = sim.addPlayer({ ...newCharacterData('Sword', 'sword'), level: 40 });
  p.x = -dist;
  p.z = 0;
  p.stats.maxHp = p.hp = 1e9;
  return { sim, p, m };
}
const run = (sim: Sim, secs: number) => { for (let t = 0; t < secs; t += TICK) sim.step(TICK, () => IDLE_INTENT); };

for (const s of learn.filter((x) => x.kind !== 'passive' && x.dmg > 0)) {
  const dist = s.id === 'sw_crush' || s.id === 'sw_judgement' ? 2.5 : 1.6;
  const { sim, p, m } = arena(dist);
  const before = m.hp;
  const cast = castSkill(sim, p, s, { x: m.x, z: m.z }, 1);
  run(sim, 2.5);
  ok(cast && m.hp < before, `${s.nameTh}: casts and hits (${Math.round(before - m.hp)} damage)`);
}

{
  const { sim, p } = arena();
  sim.monsters.length = 0;
  ok(!castSkill(sim, p, sk('sw_shadowswap'), { x: 0, z: 0 }, 1) && !castSkill(sim, p, sk('sw_thousandcuts'), { x: 0, z: 0 }, 1),
    'Shadow Swap / Thousand Cuts with nobody around: not cast (nothing spent)');
}

{
  const { sim, p, m } = arena();
  m.target = null;
  castSkill(sim, p, sk('sw_taunt'), { x: 0, z: 0 }, 1);
  ok((m.target as Player | null) === p && p.takenUntil > sim.time && Math.abs(p.takenMult - 0.8) < 1e-9, 'Taunt: the monster turns on the player, damage taken ×0.8');
  castSkill(sim, p, sk('sw_guard'), { x: 0, z: 0 }, 1);
  ok(Math.abs(p.takenMult - 0.6) < 1e-9, 'Guard: the stronger cut wins (×0.6)');
  const before = p.hp;
  sim.hitPlayer(m, p, 1, {});
  ok(p.hp < before, 'still takes (less) damage');
}

{
  const { sim, p, m } = arena();
  castSkill(sim, p, sk('sw_thorns'), { x: 0, z: 0 }, 1);
  const before = m.hp;
  sim.hitPlayer(m, p, 3, {});
  ok(p.reflectUntil > sim.time && m.hp < before, 'Thorn Armor: a hit taken hurts the attacker back');
}

{
  const { sim, p, m } = arena();
  const speed = p.stats.moveSpeed;
  castSkill(sim, p, sk('sw_anchor'), { x: 0, z: 0 }, 1);
  ok(p.stats.moveSpeed === speed - 30 && p.steadyUntil > sim.time && Math.abs(p.takenMult - 0.5) < 1e-9, 'Anchor: half damage, slower walk, steady');
  sim.hitPlayer(m, p, 1, { stun: 2, kb: 9 });
  ok(p.stunT === 0 && p.kbx === 0, 'Anchor: no stun or knockback');
  run(sim, 6);
  ok(p.stats.moveSpeed === speed && p.statBuffs.length === 0, 'Anchor ends: walk speed back');
}

{
  const { sim, p } = arena();
  const as = p.stats.atkSpeed;
  castSkill(sim, p, sk('sw_overdrive'), { x: 0, z: 0 }, 1);
  ok(p.stats.atkSpeed === as + 40, 'Overdrive: +40 attack speed');
  castSkill(sim, p, sk('sw_overdrive'), { x: 0, z: 0 }, 1);
  ok(p.stats.atkSpeed === as + 40, 'recast refreshes, does not stack');
}

{
  const { sim, p } = arena();
  const q = sim.addPlayer({ ...newCharacterData('Friend', 'mage'), level: 40 });
  q.x = p.x + 3;
  q.z = p.z;
  const far = sim.addPlayer({ ...newCharacterData('Far', 'mage'), level: 40 });
  far.x = p.x + 30;
  const def = q.stats.def;
  castSkill(sim, p, sk('sw_warcry'), { x: 0, z: 0 }, 1);
  ok(Math.abs(q.stats.def - def * 1.3) < 1e-6 && q.dmgMult === 1.15 && q.dmgUntil > sim.time, 'War Cry: anyone in the circle (no party) gets +30% defense and +15% damage');
  ok(far.statBuffs.length === 0 && far.dmgUntil === 0, 'War Cry: nobody outside the circle');
  castSkill(sim, p, sk('sw_warcry'), { x: 0, z: 0 }, 1);
  ok(Math.abs(q.stats.def - def * 1.3) < 1e-6, 'recast does not stack on itself');
}

{
  const { sim, p } = arena();
  p.hp = 1000;
  p.stats.maxHp = 10000;
  castSkill(sim, p, sk('sw_unbreakable'), { x: 0, z: 0 }, 1);
  run(sim, 6.5);
  // 1,000 + 2,500 healed, plus a little regen.
  ok(p.hp >= 3490 && p.hp <= 3700, `Unbreakable: heals 25% of max HP over its time (${Math.round(p.hp)})`);
}

{
  const { sim, p, m } = arena();
  m.hp = 1;
  const execute = sk('sw_execute');
  // HP 1: well under 30%.
  castSkill(sim, p, execute, { x: 0, z: 0 }, 1);
  ok(sim.drainEvents().some((e) => e.t === 'text' && e.text === 'ประหาร!'), 'Execute: low HP shows the bonus');
}

{
  // Shadow Swap: no damage for the whole move, between and after its dashes too.
  const { sim, p, m } = arena(3);
  for (const [x, z] of [[2, 2], [-1, 3]]) {
    const extra = Object.assign(Object.create(Object.getPrototypeOf(m)), m) as Monster;
    extra.x = x;
    extra.z = z;
    sim.monsters.push(extra);
  }
  ok(castSkill(sim, p, sk('sw_shadowswap'), { x: 0, z: 0 }, 1), 'Shadow Swap: cast with monsters around');
  const hp = p.hp;
  // Its three legs end by 0.6 s; it guards until 0.86 s.
  for (let i = 0; i < 24; i++) {
    sim.step(TICK, () => IDLE_INTENT);
    sim.hitPlayer(m, p, 5, {});
  }
  ok(p.hp === hp, `Shadow Swap: no damage taken during the whole move (${hp - p.hp})`);
}

// ---------------------------------------------------------- passives
{
  const { sim, p, m } = arena();
  p.level = 40;
  p.skillBook.ranks.sw_ironhide = 1;
  const def = p.stats.def;
  sim.wearSkill(p, 'passive', 'sw_ironhide');
  ok(Math.abs(p.stats.def - def * 1.1) < 1e-6, 'Iron Hide: +10% defense once worn');
  p.skillBook.ranks.sw_ironhide = 10;
  p.recompute();
  ok(Math.abs(p.stats.def - def * 1.145) < 1e-6, 'Iron Hide rank 10: +14.5% (+5% of the value a rank)');
  // At low HP the passive cuts damage further: compare many hits.
  const hit = (hp: number) => {
    let n = 0;
    for (let i = 0; i < 200; i++) {
      p.hp = hp;
      sim.hitPlayer(m, p, 1, {});
      n += hp - p.hp;
    }
    return n;
  };
  const high = hit(p.maxHp);
  const low = hit(p.maxHp * 0.3);
  ok(low < high * 0.85, `Iron Hide: less damage taken under 40% HP (${Math.round(low)} vs ${Math.round(high)})`);
}

{
  const { sim, p, m } = arena();
  p.stats.crit = 0;
  const avg = () => {
    let n = 0;
    for (let i = 0; i < 300; i++) {
      p.stats.crit = 0;
      const before = m.hp;
      sim.hitMonster(p, m, 1);
      n += before - m.hp;
    }
    return n;
  };
  const plain = avg();
  p.skillBook.ranks.sw_duelist = 1;
  p.skillBook.worn.passive = 'sw_duelist';
  const duel = avg();
  ok(duel > plain * 1.08, `Duelist: +12% damage with one monster around (${Math.round(duel)} vs ${Math.round(plain)})`);
}

{
  const { sim, p } = arena();
  p.skillBook.ranks.sw_lightfeet = 1;
  p.skillBook.worn.passive = 'sw_lightfeet';
  sim.step(TICK, () => ({ ...IDLE_INTENT, dash: true }));
  ok(Math.abs(p.cd.dash - 2.5 * 0.9) < 1e-6, `Light Feet: dash cooldown −10% (${p.cd.dash})`);
}

finish('sword-skills');
