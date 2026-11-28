// The element system (owner 2026-11-27): the owner's table of skill elements, marks and their small effects,
// reactions between two elements (once per cooldown, never from damage-over-time ticks or reaction hits), the lightning
// mark's damage, Gunslinger buffs that give the basic shot an element, and the /admin checks. On a real Sim, no server.
import { ok, finish } from './check';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES } from '../src/shared/data/zones';
import { CLASSES, CLASS_IDS } from '../src/shared/data/classes';
import { applyBalance, checkBalance, currentBalance } from '../src/shared/balance';
import { CODE_SKILL_ELEMENT, ELEMENTS, REACTIONS, codeElements, elementChanges, mergeElements, reactionOf } from '../src/shared/elementTuning';
import { hitElementOf, markOf } from '../src/shared/sim/elements';
import type { Monster } from '../src/shared/sim/Monster';
import { markPhrase, reactionPhrases } from '../src/shared/elementChart';
import { Translator, hasThai } from '../src/shared/i18n/translator';
import { englishDict } from '../src/shared/i18n/dict';

const texts = (sim: Sim) => sim.drainEvents().filter((e) => e.t === 'text').map((e) => (e as { text: string }).text);
const fresh = (cls: 'sword' | 'mage' | 'gunslinger' = 'mage') => {
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer({ name: 'T', classId: cls, level: 10, exp: 0, gold: 0, equipment: {}, bag: [] });
  const live = sim.monsters.filter((m) => !m.isBoss);
  const m = live[0];
  // A big pool of HP so hits never kill it; a second monster right next to it for the area reactions.
  m.hp = 1e9;
  const other = live.find((x) => x !== m)!;
  other.x = m.x + 1;
  other.z = m.z;
  other.hp = 1e9;
  p.x = m.x + 2;
  p.z = m.z;
  return { sim, p, m, other };
};

try {
  applyBalance({});

  // ---- the table
  const all = new Map(CLASS_IDS.flatMap((c) => CLASSES[c].skills.map((s) => [s.id, s] as const)));
  ok(Object.keys(CODE_SKILL_ELEMENT).every((id) => all.has(id)), 'every skill in the table exists');
  ok(Object.keys(CODE_SKILL_ELEMENT).every((id) => all.get(id)!.kind !== 'passive' && all.get(id)!.kind !== 'basic' && all.get(id)!.kind !== 'dash'), 'no basic attack, dash or passive has an element');
  const per = (e: string) => Object.values(CODE_SKILL_ELEMENT).filter((x) => x === e).length;
  ok(ELEMENTS.every((e) => per(e) > 0), `every element is used (${ELEMENTS.map((e) => `${e} ${per(e)}`).join(', ')})`);
  const ofClass = (c: 'sword' | 'mage' | 'gunslinger') => CLASSES[c].skills.filter((sk) => CODE_SKILL_ELEMENT[sk.id]).length;
  ok(ofClass('sword') === 23 && ofClass('mage') === 28 && ofClass('gunslinger') === 23, `the owner's table: sword 23, mage 28, gunslinger 23 (${ofClass('sword')}/${ofClass('mage')}/${ofClass('gunslinger')})`);
  ok(REACTIONS.length === 10 && ELEMENTS.every((a) => ELEMENTS.every((b) => (a === b) === (reactionOf(a, b) === null))), 'every pair of two elements has a reaction, either order');

  // ---- a mark and its small effect
  {
    const { sim, p, m } = fresh();
    sim.hitMonster(p, m, 1, { src: 'fireball' });
    ok(markOf(m, sim.time) === 'fire', 'fireball marks the monster with fire');
    ok(m.dotUntil > sim.time && m.extraDots.has(`${p.id}:el_fire`), 'the fire mark burns');
    sim.hitMonster(p, m, 1, { src: 'fireball' });
    ok(markOf(m, sim.time) === 'fire', 'the same element again: still the mark, no reaction');
    const w = fresh();
    w.sim.hitMonster(w.p, w.m, 1, { src: 'frostnova' });
    ok(markOf(w.m, w.sim.time) === 'water' && w.m.slowT > 0, 'water marks and slows');
    w.sim.hitMonster(w.p, w.m, 1, { src: 'bolt' });
    ok(markOf(w.m, w.sim.time) === 'water', 'the basic attack (no element) leaves the mark alone');
    w.sim.hitMonster(w.p, w.m, 1, { src: 'frostnova', noExtra: true });
    ok(markOf(w.m, w.sim.time) === 'water', 'a damage-over-time tick never reacts');
    w.sim.time += codeElements().markSec + 0.1;
    ok(markOf(w.m, w.sim.time) === null, 'the mark wears off');
  }

  // ---- a reaction: water then lightning
  {
    const { sim, p, m, other } = fresh();
    sim.hitMonster(p, m, 1, { src: 'frostnova' });
    sim.drainEvents();
    const before = other.hp;
    sim.hitMonster(p, m, 1, { src: 'mg_chainlightning' });
    const evs = sim.drainEvents();
    ok(evs.some((e) => e.t === 'text' && (e as { text: string }).text === 'ไฟฟ้าลาม!'), 'water + lightning: "ไฟฟ้าลาม!"');
    const fxEv = evs.find((e) => e.t === 'fx' && (e as { name: string }).name === 'reaction') as { args: [string, number, number, number, number[]] } | undefined;
    ok(!!fxEv && fxEv.args[0] === 'water+lightning' && fxEv.args[4].length >= 4, 'its own effect goes out, with the monsters it reached');
    ok(markOf(m, sim.time) === null, 'both marks are gone');
    ok(other.hp < before && other.stunT <= 0, 'it spreads to the monster next to it, no stun (owner 2026-11-27)');
    ok(codeElements().reactCd === 1, 'code: 1 s');
    sim.hitMonster(p, m, 1, { src: 'frostnova' });
    ok(markOf(m, sim.time) === null, 'right after a reaction: no new mark for 1 s');
    sim.time += 1.05;
    sim.hitMonster(p, m, 1, { src: 'frostnova' });
    ok(markOf(m, sim.time) === 'water', 'after 1 s marks stick again');
    sim.drainEvents();
    sim.hitMonster(p, m, 1, { src: 'mg_chainlightning' });
    ok(texts(sim).includes('ไฟฟ้าลาม!'), 'after 1 s the same reaction can happen again');
    // Each reaction keeps its own timer: Plasma right after Electrocute is still allowed once marks stick.
    const r2 = fresh();
    r2.m.reactReady.set('water+lightning', r2.sim.time + 100);
    r2.sim.hitMonster(r2.p, r2.m, 1, { src: 'frostnova' });
    r2.sim.drainEvents();
    r2.sim.hitMonster(r2.p, r2.m, 1, { src: 'mg_chainlightning' });
    ok(!texts(r2.sim).includes('ไฟฟ้าลาม!') && markOf(r2.m, r2.sim.time) === 'lightning', 'that reaction on cooldown: no reaction, the new mark goes on');
    r2.sim.hitMonster(r2.p, r2.m, 1, { src: 'fireball' });
    ok(texts(r2.sim).includes('ระเบิดพลาสมา!'), 'another reaction has its own timer: lightning + fire reacts');
  }

  // ---- Freeze slows instead of stunning; Numbing Shock stuns 0.5 s and never a boss
  {
    const { sim, p, m } = fresh();
    sim.hitMonster(p, m, 1, { src: 'frostnova' });
    m.slowT = 0;
    m.slowAmt = 0;
    sim.hitMonster(p, m, 1, { src: 'mg_forcewave' });
    ok(m.stunT <= 0.0001 || m.stunT < 0.5, 'Freeze: no 1.5 s stun');
    ok(Math.abs(m.slowAmt - 0.5) < 1e-9 && m.slowT >= 0.99, 'Freeze: 50% slower for 1 s');
    const n = fresh();
    n.sim.hitMonster(n.p, n.m, 1, { src: 'mg_poisonmist' });
    n.m.stunT = 0;
    n.sim.hitMonster(n.p, n.m, 1, { src: 'mg_chainlightning' });
    ok(Math.abs(n.m.stunT - 0.5) < 0.05, `Numbing Shock: 0.5 s stun (${n.m.stunT.toFixed(2)})`);
    const b = fresh();
    Object.defineProperty(b.m, 'isBoss', { value: true });
    b.sim.hitMonster(b.p, b.m, 1, { src: 'mg_poisonmist' });
    b.m.stunT = 0;
    b.sim.drainEvents();
    b.sim.hitMonster(b.p, b.m, 1, { src: 'mg_chainlightning' });
    ok(!texts(b.sim).includes('ประสาทชา!') && b.m.stunT <= 0, 'Numbing Shock never on a boss');
  }

  // ---- a reaction that kills its own target does not kill it twice
  {
    const { sim, p, m } = fresh();
    m.hp = 1e9;
    sim.hitMonster(p, m, 1, { src: 'frostnova' });
    m.hp = 1;
    let kills = 0;
    const was = sim.monsters.find((x) => x === m)!;
    const orig = p.onKill.bind(p);
    p.onKill = (x: Monster) => { if (x === was) kills++; orig(x); };
    sim.hitMonster(p, m, 1, { src: 'mg_chainlightning' });
    ok(!m.alive && kills === 1, 'the monster died once');
  }

  // ---- the lightning mark makes hits land harder
  {
    const { sim, p, m } = fresh();
    const avg = (src: string) => {
      let sum = 0;
      for (let i = 0; i < 300; i++) {
        m.hp = 1e9;
        sim.hitMonster(p, m, 1, { src, noElem: true });
        sum += 1e9 - m.hp;
      }
      return sum;
    };
    const plain = avg('bolt');
    m.elem = 'lightning';
    m.elemUntil = sim.time + 100;
    const shocked = avg('bolt');
    ok(shocked > plain * 1.05, `lightning mark: more damage (${shocked} vs ${plain})`);
  }

  // ---- Gunslinger buffs give the basic shot their element
  {
    const { sim, p } = fresh('gunslinger');
    ok(hitElementOf(p, 'shot', sim.time) === 'none', 'basic shot: no element');
    p.gun.onHit.gs_hotrounds = { until: sim.time + 5, add: 0.1 };
    ok(hitElementOf(p, 'shot', sim.time) === 'fire', 'during Hot Rounds: fire');
    p.gun.shock = { until: sim.time + 5, slow: 0.1, slowT: 1 };
    ok(hitElementOf(p, 'shot', sim.time) === 'lightning', 'Shock Rounds first: lightning');
  }

  // ---- /admin: off, a skill's element changed, checks, audit
  applyBalance(checkBalance({ skills: { elements: { on: false } } }, true).tuning!);
  {
    const { sim, p, m } = fresh();
    sim.hitMonster(p, m, 1, { src: 'fireball' });
    ok(markOf(m, sim.time) === null, 'switch off: no mark');
  }
  applyBalance(checkBalance({ skills: { elements: { skill: { fireball: 'water', bolt: 'wind' } } } }, true).tuning!);
  ok(currentBalance().skills.elements.skill.fireball === 'water' && currentBalance().skills.elements.skill.bolt === 'wind', 'a skill\'s element can be changed, basic attacks too');
  applyBalance(checkBalance({ skills: { elements: { skill: { fireball: 'none' } } } }, true).tuning!);
  ok(currentBalance().skills.elements.skill.fireball === undefined, '"none" takes the element away');
  ok('error' in checkBalance({ skills: { elements: { skill: { fireball: 'ice' } } } }, true), 'an unknown element is refused');
  ok('error' in checkBalance({ skills: { elements: { skill: { mg_elementmastery: 'fire' } } } }, true), 'a passive cannot have one');
  ok('error' in checkBalance({ skills: { elements: { reactions: { 'water+fire': { dmg: -1 } } } } }, true), 'a reaction number out of range is refused');
  ok(checkBalance({ skills: { elements: { markSec: 4, skill: { fireball: 'fire' } } } }, true).tuning?.skills === undefined, 'values equal to the code are not saved');
  ok(elementChanges(codeElements(), mergeElements({ reactions: { 'fire+poison': { dmg: 250 } } }), (id) => id).some((s) => s.includes('ระเบิดพิษ ดาเมจ (% ATK) 200 → 250')), 'changes go to the audit');
  applyBalance({});

  // The players' element chart (owner 2026-11-28): phrases from the live config, every one in the English dictionary.
  {
    const c = codeElements();
    const ph = (id: (typeof REACTIONS)[number]) => reactionPhrases(c.reactions[id]).join(' · ');
    ok(ph('water+lightning') === 'ดาเมจ 120% ATK · โดนทุกตัวในรัศมี 4 ม.', `chart: Electrocute = ${ph('water+lightning')}`);
    ok(ph('water+wind') === 'ช้าลง 50% นาน 1 วิ · โดนตัวเดียว', `chart: Freeze = ${ph('water+wind')}`);
    ok(ph('water+poison') === 'ดาเมจต่อเนื่อง 16% ATK/วิ นาน 5 วิ · โดนตัวเดียว', `chart: poison soak = ${ph('water+poison')}`);
    ok(ph('poison+lightning') === 'สตัน 0.5 วิ · โดนตัวเดียว · ไม่ใช้กับบอส', `chart: Numbing Shock = ${ph('poison+lightning')}`);
    ok(ph('lightning+wind') === 'ดาเมจ 100% ATK · ผลักออก 3 ม. · โดนทุกตัวในรัศมี 3 ม.', `chart: Thunder Gale = ${ph('lightning+wind')}`);
    ok(markPhrase(c, 'water') === 'ช้าลง 15%' && markPhrase(c, 'lightning') === 'รับดาเมจเพิ่ม 10%', 'chart: mark phrases');
    // /admin values show by themselves.
    const t = mergeElements({ reactions: { 'fire+poison': { dmg: 250, stun: 1.25 }, 'water+fire': { on: false } }, mark: { wind: 0 } });
    ok(reactionPhrases(t.reactions['fire+poison']).join(' · ') === 'ดาเมจ 250% ATK · สตัน 1.25 วิ · โดนตัวเดียว · บอสโดนสตันแค่ 30%', 'chart: admin numbers');
    ok(reactionPhrases(t.reactions['water+fire'])[0] === 'ปิดอยู่ชั่วคราว' && markPhrase(t, 'wind') === 'ไม่มีผลเพิ่ม', 'chart: switched off / zero');
    const tr = new Translator(englishDict());
    const all = [...REACTIONS.flatMap((k) => [...reactionPhrases(c.reactions[k]), ...reactionPhrases(t.reactions[k])]), ...ELEMENTS.map((e) => markPhrase(c, e)), 'ไม่มีผลเพิ่ม'];
    const missing = all.filter((s) => hasThai(tr.tr(s)));
    ok(missing.length === 0, `chart: English for every phrase (missing: ${missing.join(' | ')})`);
  }
} catch (e) {
  ok(false, `threw: ${(e as Error).stack}`);
}
finish('elements');
