// Gunslinger's 30 skills and 3 passives (owner approved 2026-11-14): the table's shape, every skill casting and
// hurting monsters on a real Sim, the Rapid Fire line's basic-shot buffs (on-hit, double tap, split, storm), timed
// stat buffs, the passives through the shared passive hook, /admin tuning reaching the skills, and old saves.
import { ok, finish } from './check';
import { applyBalance, checkBalance } from '../src/shared/balance';
import { CLASSES, LEARNABLE_SKILLS, type SkillDef } from '../src/shared/data/classes';
import { SKILL_REACH } from '../src/shared/data/skillRanges';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import type { Monster } from '../src/shared/sim/Monster';
import { Projectile } from '../src/shared/sim/Projectile';
import { castSkill } from '../src/shared/sim/skills';
import { IDLE_INTENT } from '../src/shared/sim/types';
import { cleanSkillBook, skillParam, unlockLevel } from '../src/shared/skillBook';
import { codeSkills } from '../src/shared/skillTuning';

const GS = CLASSES.gunslinger.skills;
const sk = (id: string): SkillDef => GS.find((s) => s.id === id)!;

// ---------------------------------------------------------- the table
{
  for (let line = 0; line < 3; line++) {
    const normal = GS.filter((s) => s.kind === 'normal' && s.line === line).map((s) => s.tier).sort();
    const ult = GS.filter((s) => s.kind === 'ult' && s.line === line).map((s) => s.tier).sort();
    ok(normal.join() === '0,1,2,3,4,5,6,7' && ult.join() === '0,1', `line ${line}: 8 normal (tiers 0-7) and 2 ultimates (0-1)`);
  }
  ok(GS.filter((s) => s.kind === 'passive').map((s) => s.tier).sort().join() === '0,1,2', '3 passives');
  ok(sk('rapidfire').line === 1 && sk('pierce').line === 0 && sk('headshot').line === 0 && sk('headshot').kind === 'ult', 'old skills kept in their lines');
  ok(unlockLevel(sk('pierce')) === 1 && unlockLevel(sk('gs_lockon')) === 25 && unlockLevel(sk('gs_turret')) === 10 && unlockLevel(sk('gs_specialammo')) === 30, 'unlock levels by tier');
  const ids = LEARNABLE_SKILLS.map((x) => x.sk.id);
  ok(new Set(ids).size === ids.length, 'skill ids unique across classes');
  ok(GS.filter((s) => s.id.startsWith('gs_')).length === 30, '30 new gs_ ids');
  const buffs = new Set(['gs_sniperfocus', 'gs_hotrounds', 'gs_quickreload', 'gs_doubletap', 'gs_shockrounds', 'gs_stackfire', 'gs_splitshot', 'gs_piercerounds', 'gs_overdrive', 'gs_bulletstorm']);
  const active = GS.filter((s) => s.kind === 'normal' || s.kind === 'ult');
  ok(active.every((s) => buffs.has(s.id) || SKILL_REACH[s.id]), 'every non-buff skill has a reach');
  ok(active.every((s) => s.anim === 'q' || s.anim === 'e' || s.anim === 'r'), 'every skill plays an existing animation row');
  const c = codeSkills();
  ok(GS.filter((s) => s.kind !== 'basic' && s.kind !== 'dash').every((s) => c.skills[s.id] && Object.keys(c.skills[s.id].params).length === Object.keys(s.params ?? {}).length),
    'every skill and its own numbers are on the /admin table');
}

// ---------------------------------------------------------- a Sim with a monster next to the player
function arena(): { sim: Sim; p: Player; mob: Monster } {
  const sim = new Sim(ZONE_1);
  for (let i = 0; i < 300 && !sim.monsters.some((m) => m.alive && !m.isBoss); i++) sim.step(0.1);
  const mob = sim.monsters.find((m) => m.alive && !m.isBoss)!;
  const p = sim.addPlayer({ ...newCharacterData('G', 'gunslinger'), level: 30 });
  p.x = mob.x + 2;
  p.z = mob.z;
  mob.hp = mob.maxHp * 50; // stays alive through every test hit
  return { sim, p, mob };
}
/** Counts the player's hits that land from now on (monsters spawning meanwhile don't skew it). */
function countHits(sim: Sim, p: Player): () => number {
  let n = 0;
  const hit = sim.hitMonster.bind(sim);
  sim.hitMonster = (who, m, mult, opts) => {
    if (who === p && m.alive) n++;
    hit(who, m, mult, opts);
  };
  return () => n;
}
const playerShots = (sim: Sim): Projectile[] => sim.projectiles.filter((x): x is Projectile => x instanceof Projectile);

// ---------------------------------------------------------- every damaging skill casts and hurts
{
  for (const s of GS.filter((x) => (x.kind === 'normal' || x.kind === 'ult') && x.dmg > 0 && x.id !== 'gs_bulletstorm')) {
    const { sim, p, mob } = arena();
    const hits = countHits(sim, p);
    // A mine goes off when a monster is close: lay it right next to one.
    if (s.id === 'gs_mine') p.x = mob.x + 1;
    const aim = { x: mob.x, z: mob.z };
    sim.step(1 / 30, (x) => (x === p ? { ...IDLE_INTENT, aim } : IDLE_INTENT)); // the player has aimed (Counter Shot fires at the aim)
    const cast = castSkill(sim, p, s, aim, 1);
    // The server's tick (30 Hz): fast bullets move ~1.7 m a step.
    for (let i = 0; i < 120; i++) sim.step(1 / 30, (x) => (x === p ? { ...IDLE_INTENT, aim } : IDLE_INTENT));
    ok(cast && hits() > 0, `${s.id} casts and deals damage`);
  }
}

// ---------------------------------------------------------- the Rapid Fire line: buffs on the basic shot
{
  const { sim, p, mob } = arena();
  const aim = { x: mob.x, z: mob.z };
  const basic = (): Projectile[] => {
    const had = new Set(playerShots(sim));
    sim.step(0.01, (x) => (x === p ? { ...IDLE_INTENT, aim, basic: true } : IDLE_INTENT));
    return playerShots(sim).filter((x) => !had.has(x));
  };
  const one = basic();
  ok(one.length === 1 && one[0].o.mult === 1, 'plain basic shot: 1 bullet at 100% ATK');

  castSkill(sim, p, sk('gs_hotrounds'), aim, 1);
  for (let i = 0; i < 60; i++) sim.step(0.01);
  const hot = basic();
  ok(hot.length === 1 && Math.abs(hot[0].o.mult - 1.3) < 1e-9, `Hot Rounds: on-hit +0.3 (${hot[0]?.o.mult})`);

  castSkill(sim, p, sk('gs_hotrounds'), aim, 10);
  for (let i = 0; i < 60; i++) sim.step(0.01);
  const hot10 = basic();
  ok(Math.abs(hot10[0].o.mult - (1 + 0.3 * 1.45)) < 1e-9, `on-hit grows with the damage %/rank: rank 10 = 0.435 (${hot10[0]?.o.mult})`);

  castSkill(sim, p, sk('gs_splitshot'), aim, 1);
  for (let i = 0; i < 60; i++) sim.step(0.01);
  const split = basic();
  ok(split.length === 3 && split.filter((x) => Math.abs(x.o.mult - 1.435 * 0.5) < 1e-9).length === 2, 'Split Shot: 3 bullets, the side ones at 50%');

  castSkill(sim, p, sk('gs_bulletstorm'), aim, 1);
  for (let i = 0; i < 60; i++) sim.step(0.01);
  const storm = basic();
  ok(storm.length === 5 && storm.every((x) => Math.abs(x.o.mult - (0.6 + 0.435)) < 1e-9), 'Bullet Storm: 5 pellets of 0.6 + on-hit (wins over Split)');

  castSkill(sim, p, sk('gs_doubletap'), aim, 1);
  for (let i = 0; i < 60; i++) sim.step(0.01);
  let fired = 0;
  const add = sim.addProjectile.bind(sim);
  sim.addProjectile = (o, opts) => {
    fired++;
    add(o, opts);
  };
  basic();
  for (let i = 0; i < 12; i++) sim.step(0.01);
  sim.addProjectile = add;
  ok(fired === 10 && p.gun.double.left === 7, 'Double Tap: a second volley follows, 7 left');

  castSkill(sim, p, sk('gs_piercerounds'), aim, 1);
  for (let i = 0; i < 60; i++) sim.step(0.01);
  ok(basic().every((x) => x.o.pierce === true), 'Piercing Rounds: basic shots pierce');

  p.hp = 0;
  (sim as unknown as { killPlayer(p: Player): void }).killPlayer(p);
  ok(Object.keys(p.gun.onHit).length === 0 && p.gun.storm.until === 0, 'death clears the basic-shot buffs');
}

// ---------------------------------------------------------- timed stat buffs
{
  const { sim, p } = arena();
  const crit = p.stats.crit;
  const spd = p.stats.atkSpeed;
  castSkill(sim, p, sk('gs_sniperfocus'), { x: p.x + 1, z: p.z }, 1);
  ok(p.stats.crit === crit + 40, `Sniper Focus: crit +40 (${p.stats.crit - crit})`);
  castSkill(sim, p, sk('gs_quickreload'), { x: p.x + 1, z: p.z }, 1);
  ok(p.stats.atkSpeed === spd + 40, 'Quick Reload: attack speed +40');
  for (let i = 0; i < 55; i++) sim.step(0.1);
  ok(p.stats.atkSpeed === spd && p.stats.crit === crit + 40, 'Quick Reload ends after 5 s, Sniper Focus (8 s) still on');
  for (let i = 0; i < 40; i++) sim.step(0.1);
  ok(p.stats.crit === crit && p.statBuffs.length === 0, 'Sniper Focus ends too');
}

// ---------------------------------------------------------- passives (shared hook)
{
  const { sim, p } = arena();
  const crit = p.stats.crit;
  const cd = p.stats.critDmg;
  ok(sim.learnSkill(p, 'gs_hawkeye') && p.skillBook.worn.passive === 'gs_hawkeye', 'Hawkeye learned and worn on the passive slot');
  ok(Math.abs(p.stats.crit - (crit + 8)) < 1e-9 && Math.abs(p.stats.critDmg - (cd + 20)) < 1e-9, 'Hawkeye rank 1: crit +8, crit damage +20');
  for (let i = 0; i < 9; i++) sim.learnSkill(p, 'gs_hawkeye');
  ok(Math.abs(p.stats.crit - (crit + 8 * 1.45)) < 1e-9, `rank 10: +8 × 1.45 (status %/rank) (${p.stats.crit - crit})`);
  ok(sim.wearSkill(p, 'passive', null) && p.stats.crit === crit, 'taken off: back to normal');

  p.level = 30;
  const spd = p.stats.atkSpeed;
  sim.learnSkill(p, 'gs_triggerfinger');
  sim.wearSkill(p, 'passive', 'gs_triggerfinger');
  ok(p.stats.atkSpeed === spd + 15, 'Trigger Finger: attack speed +15');

  // Special Ammo: Special Weapons skills hit harder and blow up bigger.
  sim.learnSkill(p, 'gs_specialammo');
  sim.wearSkill(p, 'passive', 'gs_specialammo');
  castSkill(sim, p, sk('gs_explosive'), { x: p.x + 5, z: p.z }, 1);
  const ex = playerShots(sim).at(-1)!;
  ok(Math.abs(ex.o.mult - 1.6 * 1.15) < 1e-9 && Math.abs(ex.o.explode! - 2.4 * 1.15) < 1e-9, 'Special Ammo: Explosive Round +15% damage and blast');
  castSkill(sim, p, sk('pierce'), { x: p.x + 5, z: p.z }, 1);
  ok(playerShots(sim).at(-1)!.o.mult === 1.5, 'other lines untouched');

  const back = sim.addPlayer(p.toData());
  ok(back.skillBook.worn.passive === 'gs_specialammo' && back.statBuffs.length === 0, 'the worn passive is saved; skill buffs are not');
}

// ---------------------------------------------------------- Deadeye mark and Finisher
{
  const { sim, p, mob } = arena();
  const aim = { x: mob.x, z: mob.z };
  castSkill(sim, p, sk('gs_deadeye'), aim, 1);
  for (let i = 0; i < 20; i++) sim.step(0.02);
  ok(mob.markBy === p.id && mob.markCrit === 30 && mob.markUntil > sim.time, 'Deadeye marks the monster for this player');
  mob.hp = mob.maxHp * 0.2;
  const fin = sk('gs_finisher');
  castSkill(sim, p, fin, aim, 1);
  const shot = playerShots(sim).at(-1)!;
  ok(Math.abs(shot.o.bonus!(mob) - 2.2) < 1e-9, 'Finisher: ×2 under 30% HP (bonus = one more 220%)');
  mob.hp = mob.maxHp;
  ok(shot.o.bonus!(mob) === 0, 'no bonus above 30%');
}

// ---------------------------------------------------------- /admin tuning reaches the skill
{
  applyBalance(checkBalance({ skills: { skills: { gs_hotrounds: { params: { onHit: 0.5 } }, gs_explosive: { params: { blast: 4 } } } } }, true).tuning!);
  ok(skillParam(sk('gs_hotrounds'), 'onHit') === 0.5 && skillParam(sk('gs_explosive'), 'blast') === 4, 'tuned numbers used');
  const { sim, p, mob } = arena();
  castSkill(sim, p, sk('gs_hotrounds'), { x: mob.x, z: mob.z }, 1);
  sim.step(0.01, (x) => (x === p ? { ...IDLE_INTENT, aim: { x: mob.x, z: mob.z }, basic: true } : IDLE_INTENT));
  ok(Math.abs(playerShots(sim).at(-1)!.o.mult - 1.5) < 1e-9, 'tuned on-hit reaches the basic shot');
  ok(checkBalance({ skills: { skills: { gs_hotrounds: { reach: 0, dmg: 0, params: { onHit: 0.3 } }, gs_hawkeye: { reach: 0 } } } }, true).error === undefined, 'a buff / passive row sent back as is (reach 0) is accepted');
  ok(checkBalance({ skills: { skills: { gs_shockrounds: { params: { slow: 150 } } } } }, true).error !== undefined, 'refused: slow 150%');
  applyBalance({});
}

// ---------------------------------------------------------- old saves
{
  const b = cleanSkillBook('gunslinger', { ranks: { rapidfire: 3, pierce: 2, headshot: 1, gs_mine: 1 }, worn: { q: 'rapidfire', e: 'pierce', r: 'headshot' } });
  ok(b.ranks.rapidfire === 3 && b.worn.q === 'rapidfire' && b.worn.e === 'pierce' && b.worn.r === 'headshot', 'old skill ids still load and stay worn');
}

finish('gunslinger-skills');
