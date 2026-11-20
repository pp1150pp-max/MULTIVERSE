// Starfall falls on monsters, and "+ per rank" for every skill number (owner 2026-11-20): the value at rank r is
// base + perRank × (r − 1), kept in the number's min/max, whole for counts; the code default is 0. Sim only, no server.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, codeBalance } from '../src/shared/balance';
import { CLASSES, isLearnable, type SkillDef } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import type { Player } from '../src/shared/sim/Player';
import { newCharacterData } from '../src/shared/sim/Player';
import { castSkill } from '../src/shared/sim/skills';
import { skillParam, skillParamLines } from '../src/shared/skillBook';

const sk = (id: string): SkillDef => CLASSES.mage.skills.find((s) => s.id === id)!;
const star = sk('mg_starfall');

function arena(mobCount: number): { sim: Sim; p: Player; mobs: Monster[] } {
  const sim = new Sim(ZONE_1);
  for (let i = 0; i < 400 && sim.monsters.filter((m) => m.alive && !m.isBoss).length < Math.max(mobCount, 1); i++) sim.step(0.1);
  const mobs = sim.monsters.filter((m) => m.alive && !m.isBoss).slice(0, mobCount);
  const bx = mobs[0]?.x ?? 40;
  const bz = mobs[0]?.z ?? 40;
  // Everything else out of the way, so only our monsters are near the circle.
  sim.monsters = [...mobs];
  const p = sim.addPlayer({ ...newCharacterData('Mage', 'mage'), level: 30 });
  p.x = bx - 3;
  p.z = bz;
  mobs.forEach((m) => { m.hp = 1e9; });
  return { sim, p, mobs };
}

/** Casts Starfall and returns where each star's warning ring was drawn (the star's landing spot). */
function stars(sim: Sim, p: Player, aim: { x: number; z: number }, rank = 1): { x: number; z: number; d: number; m: number }[] {
  sim.drainEvents();
  castSkill(sim, p, star, aim, rank);
  const out: { x: number; z: number; d: number; m: number }[] = [];
  for (let t = 0; t < 8; t += 0.05) {
    sim.step(0.05);
    for (const e of sim.drainEvents()) {
      if (e.t === 'fx' && e.name === 'telegraph') {
        const a = e.args as unknown as number[];
        // Distance to the nearest monster and which one, at the moment the ring is drawn (monsters walk about).
        let d = Infinity;
        let mi = -1;
        sim.monsters.forEach((m, i) => { const dd = Math.hypot(m.x - a[0], m.z - a[1]); if (dd < d) { d = dd; mi = i; } });
        out.push({ x: a[0], z: a[1], d, m: mi });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------- defaults: nothing changes
{
  applyBalance({});
  for (const c of Object.values(CLASSES)) {
    for (const s of c.skills.filter(isLearnable)) {
      for (const [k, d] of Object.entries(s.params ?? {})) {
        // Without "+ per rank" a plain number is the same at every rank (status and damage ones still grow by %).
        if (!d.status && !d.dmg) ok(skillParam(s, k, 1) === d.v && skillParam(s, k, 10) === d.v, `${s.id}.${k}: same at rank 1 and 10 by default`);
      }
    }
  }
  ok(skillParam(star, 'stars', 5) === 8 && skillParam(star, 'gap', 10) === 0.25, 'Starfall: 8 stars, 0.25 s gap at any rank by default');
}

// ---------------------------------------------------------- Starfall lands on monsters
{
  const { sim, p, mobs } = arena(3);
  const c = { x: mobs[0].x, z: mobs[0].z };
  mobs[1].x = c.x + 2.5;
  mobs[1].z = c.z;
  mobs[2].x = c.x;
  mobs[2].z = c.z + 4;
  const at = stars(sim, p, c);
  ok(at.length === 8, `8 stars (${at.length})`);
  ok(at.every((s) => s.d < 0.5), 'every star is aimed at a monster');
  const hit = mobs.map((_, i) => at.filter((s) => s.m === i).length);
  ok(hit.every((n) => n >= 2), `stars are spread over all three monsters (${hit.join('/')})`);
}
{
  const { sim, p, mobs } = arena(1);
  const at = stars(sim, p, { x: mobs[0].x, z: mobs[0].z });
  ok(at.length === 8 && at.every((s) => s.d < 0.5), 'one monster: all 8 stars on it');
}
{
  // Nobody in the circle: random spots inside it, as before.
  const { sim, p } = arena(0);
  const c = { x: p.x + 5, z: p.z };
  const at = stars(sim, p, c);
  ok(at.length === 8 && at.every((s) => Math.hypot(s.x - c.x, s.z - c.z) <= 6 + 1e-6), 'empty circle: 8 stars at random spots inside the big circle');
  ok(new Set(at.map((s) => s.x.toFixed(3))).size > 1, 'the random spots differ');
}

// ---------------------------------------------------------- + per rank
{
  const t = checkBalance({ skills: { skills: { mg_starfall: { paramsPerRank: { stars: 1, gap: -0.01 } } } } }, true);
  ok(!t.error && !!t.tuning, `+ per rank accepted (${t.error ?? ''})`);
  applyBalance(t.tuning!);
  ok(skillParam(star, 'stars', 1) === 8 && skillParam(star, 'stars', 5) === 12 && skillParam(star, 'stars', 10) === 17, 'stars +1/rank: 8 / 12 / 17');
  ok(skillParam(star, 'gap', 5) === 0.21, `gap -0.01/rank: rank 5 = 0.21 (${skillParam(star, 'gap', 5)})`);
  ok(skillParam(star, 'gap', 10) === 0.16, 'rank 10 gap 0.16');
  ok(skillParam(star, 'stars') === 8, 'no rank given = the base value');
  ok(skillParamLines(star, 5).some((l) => l.includes('จำนวนดวง 12')), 'skill window line shows the ranked value');
  const { sim, p, mobs } = arena(2);
  const at = stars(sim, p, { x: mobs[0].x, z: mobs[0].z }, 5);
  ok(at.length === 12, `rank 5 casts 12 stars (${at.length})`);
  const lines = balanceChanges({}, t.tuning!);
  ok(lines.includes('+ ต่อแรงก์'), 'audit line mentions + ต่อแรงก์');
  ok(JSON.stringify(t.tuning) === '{"skills":{"skills":{"mg_starfall":{"paramsPerRank":{"stars":1,"gap":-0.01}}}}}', `stored sparse (${JSON.stringify(t.tuning)})`);
  applyBalance({});
}
{
  // Clamping to the number's min/max, and counts rounded.
  let t = checkBalance({ skills: { skills: { mg_starfall: { paramsPerRank: { stars: 3, gap: -0.2 } } } } }, true);
  ok(!t.error, `accepted (${t.error ?? ''})`);
  applyBalance(t.tuning!);
  ok(skillParam(star, 'stars', 10) === 30, 'stars clamped to max 30 (8 + 27 = 35)');
  ok(skillParam(star, 'gap', 10) === 0.05, 'gap clamped to min 0.05');
  applyBalance({});
  t = checkBalance({ skills: { skills: { mg_starfall: { paramsPerRank: { stars: 0.5 } } } } }, true);
  applyBalance(t.tuning!);
  ok(skillParam(star, 'stars', 2) === 9 && skillParam(star, 'stars', 3) === 9 && skillParam(star, 'stars', 4) === 10, 'count rounded (8.5→9, 9→9, 9.5→10)');
  applyBalance({});
  // A time with a status growth: the % growth first, then + per rank.
  const meteor = sk('meteor');
  t = checkBalance({ skills: { skills: { meteor: { paramsPerRank: { stun: 0.1 } } } } }, true);
  applyBalance(t.tuning!);
  const want = 0.8 * (1 + 0.05 * 4) + 0.4;
  ok(Math.abs(skillParam(meteor, 'stun', 5) - want) < 1e-9, `meteor stun at rank 5: status growth then +0.1/rank (${skillParam(meteor, 'stun', 5)})`);
  applyBalance({});
}
{
  ok(checkBalance({ skills: { skills: { mg_starfall: { paramsPerRank: { nope: 1 } } } } }, true).error !== undefined, 'refused: unknown param');
  ok(checkBalance({ skills: { skills: { mg_starfall: { paramsPerRank: { stars: 4 } } } } }, true).error !== undefined, 'refused: stars +4/rank (limit 3.222)');
  ok(checkBalance({ skills: { skills: { mg_starfall: { paramsPerRank: { stars: 'a' } } } } }, true).error !== undefined, 'refused: not a number');
  const z = checkBalance({ skills: { skills: { mg_starfall: { paramsPerRank: { stars: 0 } } } } }, true);
  ok(!z.error && !z.tuning?.skills, 'zero per rank = the code value: nothing saved');
  ok(JSON.stringify(codeBalance().skills.skills.mg_starfall.paramsPerRank) === '{"radius":0,"stars":0,"starRadius":0,"gap":0}', 'code per-rank is 0 for every param');
}

finish('skill-param-rank');
