// The skill effects' extra layer (owner 2026-11-15): the /admin numbers (fxLayerTuning.ts) and what the Sim sends so
// the caster's own screen can feel a hit (Whirlwind: the caster's id and whether it hit). The drawing itself
// (src/client/fxLayer.ts) needs a screen and is looked at in the game.
import { ok, finish } from './check';
import { balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { CLASSES } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { basicAttack, castSkill } from '../src/shared/sim/skills';
import { ON_CUE, ON_EFFECT, ON_ZONE } from '../src/client/quarksHooks';
import { QUARKS_SKILLS } from '../src/shared/fxLayerTuning';
import { checkFxLayerTuning, codeFxLayer, fxLayerChanges, mergeFxLayer } from '../src/shared/fxLayerTuning';
import { IDLE_INTENT } from '../src/shared/sim/types';
import { circleDesign } from '../src/client/circleDesigns';
import { CIRCLE_FALLBACKS } from '../src/shared/fxLayerTuning';

// One magic circle per skill (owner 2026-11-18): every skill and fallback has a design, and no two are alike.
{
  const ids = [...new Set([...Object.values(CLASSES).flatMap((c) => c.skills.map((s) => s.id)), ...CIRCLE_FALLBACKS])];
  const missing = ids.filter((id) => !circleDesign(id));
  ok(missing.length === 0, `every skill has a circle (missing: ${missing.join(', ')})`);
  const looks = ids.map((id) => { const d = circleDesign(id)!; return d && `${d.color}|${d.motif}|${d.rings}|${d.runes}|${d.spokes}`; });
  ok(new Set(looks).size === looks.length, `no two circles alike (${looks.length})`);
  // Per-skill settings: only differences kept, unknown skills and bad numbers refused.
  const t = checkBalance({ fxLayer: { skills: { meteor: { size: 1.5, circle: true, speed: 1 }, frostnova: { extra: false }, sw_guard: {} } } }, true).tuning!;
  ok(JSON.stringify(t) === '{"fxLayer":{"skills":{"meteor":{"size":1.5},"frostnova":{"extra":false}}}}', `per-skill differences only (${JSON.stringify(t)})`);
  ok('error' in checkBalance({ fxLayer: { skills: { nosuch: { size: 2 } } } }, true), 'unknown skill refused');
  ok('error' in checkBalance({ fxLayer: { skills: { meteor: { size: 9 } } } }, true), 'size out of range refused');
  ok(mergeBalance(t).fxLayer.skills.meteor.size === 1.5, 'merged per-skill value');
}

// The skill a buff or debuff came from is kept for its circle (sent as PlayerSnap.bs / MonsterSnap.ds).
{
  const sim = new Sim(ZONE_1);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  sim.monsters.length = 0;
  sim.monsters.push(m);
  m.x = 1;
  m.z = 0;
  m.hp = 1e7;
  const p = sim.addPlayer({ ...newCharacterData('Guard', 'sword'), level: 40 });
  p.x = 0;
  p.z = 0;
  castSkill(sim, p, CLASSES.sword.skills.find((s) => s.id === 'sw_guard')!, { x: 1, z: 0 }, 1);
  ok(p.buffSkill === 'sw_guard', `buff source kept (${p.buffSkill})`);
  castSkill(sim, p, CLASSES.sword.skills.find((s) => s.id === 'sw_sunder')!, { x: 1, z: 0 }, 1);
  for (let i = 0; i < 30; i++) sim.step(1 / 30, () => IDLE_INTENT);
  ok(m.debuffSkill === 'sw_sunder', `debuff source kept (${m.debuffSkill})`);
}

{
  const c = codeFxLayer();
  ok(c.enabled && c.glow === 1 && c.ground === 1 && c.particles === 1 && c.shake === 1 && c.hitstopMs === 60 && c.crit === 1, 'code values');
  ok(JSON.stringify(mergeBalance({}).fxLayer) === JSON.stringify(c), 'the balance carries the code values');
  const t = checkBalance({ fxLayer: { enabled: true, glow: 1.5, hitstopMs: 80, crit: 1 } }, true).tuning!;
  ok(JSON.stringify(t) === '{"fxLayer":{"glow":1.5,"hitstopMs":80}}', `only differences stored (${JSON.stringify(t)})`);
  ok(mergeBalance(t).fxLayer.glow === 1.5 && mergeBalance(t).fxLayer.shake === 1, 'merged over the code values');
  ok(balanceChanges({}, t) === 'เอฟเฟกต์สกิล × แสงเรือง 1 → 1.5, เอฟเฟกต์สกิล ภาพค้างตอนโดน (ms) 60 → 80', `audit (${balanceChanges({}, t)})`);
  ok(balanceChanges({}, { fxLayer: { enabled: false } }) === 'เอฟเฟกต์สกิล (ชั้นเสริม) เปิด → ปิด', 'audit: switched off');
  for (const bad of [{ glow: 4 }, { hitstopMs: 500 }, { crit: 0.1 }, { shake: 'x' }, { enabled: 1 }, { what: 1 }]) {
    ok(checkBalance({ fxLayer: bad }, true).error !== undefined, `strict refuses ${JSON.stringify(bad)}`);
  }
  ok(checkBalance({ fxLayer: { glow: 4, ground: 2 } }, false).tuning?.fxLayer?.glow === undefined, 'loose: a bad value is dropped, the rest kept');
}

/** Casts Whirlwind once and returns the args of its effect event. */
function whirl(withMonster: boolean): unknown[] {
  const sim = new Sim(ZONE_1);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  sim.monsters.length = 0;
  if (withMonster) sim.monsters.push(m);
  m.x = 0;
  m.z = 0;
  m.hp = 1e7;
  const p = sim.addPlayer({ ...newCharacterData('Spin', 'sword'), level: 40 });
  p.x = -1.5;
  p.z = 0;
  sim.drainEvents();
  castSkill(sim, p, CLASSES.sword.skills.find((s) => s.id === 'whirlwind')!, { x: 0, z: 0 }, 1);
  const ev = sim.drainEvents().find((e) => e.t === 'fx' && e.name === 'effect' && (e.args as unknown[])[0] === 'whirlwind');
  return ev && ev.t === 'fx' ? [...(ev.args as unknown[]), p.id] : [];
}
{
  const a = whirl(true);
  ok(a.length > 0 && a[5] === a.at(-1) && a[6] === true && a[7] === 'whirlwind', `Whirlwind that hits: caster id and hit = true (${JSON.stringify(a)})`);
  const b = whirl(false);
  ok(b.length > 0 && b[5] === b.at(-1) && b[6] === false, `Whirlwind into the air: hit = false (${JSON.stringify(b)})`);
}

// Every skill's effects carry the caster, also when played later: a Fireball's blast (its shot flies first) and the
// Meteor's crater (a timer).
function later(cls: 'mage', id: string, name: string, withMonster: boolean): unknown[] {
  const sim = new Sim(ZONE_1);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  sim.monsters.length = 0;
  if (withMonster) sim.monsters.push(m);
  m.x = 0;
  m.z = 0;
  m.hp = 1e7;
  const p = sim.addPlayer({ ...newCharacterData('Caster', cls), level: 40 });
  p.x = -5;
  p.z = 0;
  castSkill(sim, p, CLASSES[cls].skills.find((s) => s.id === id)!, { x: 0, z: 0 }, 1);
  for (let i = 0; i < 90; i++) {
    sim.step(1 / 30, () => IDLE_INTENT);
    const ev = sim.drainEvents().find((e) => e.t === 'fx' && e.name === 'effect' && (e.args as unknown[])[0] === name);
    if (ev && ev.t === 'fx') return [...(ev.args as unknown[]), p.id];
  }
  return [];
}
{
  const a = later('mage', 'fireball', 'explosion', true);
  ok(a[5] === a.at(-1) && a[6] === true && a[7] === 'fireball', `Fireball's blast: caster id, hit (${JSON.stringify(a)})`);
  const b = later('mage', 'meteor', 'crater', true);
  ok(b[5] === b.at(-1) && b[6] === true && b[7] === 'meteor', `Meteor's crater (a timer): caster id, hit (${JSON.stringify(b)})`);
  const c = later('mage', 'meteor', 'crater', false);
  ok(c[5] === c.at(-1) && c[6] === false, `Meteor on nothing: hit = false (${JSON.stringify(c)})`);
}

// three.quarks for every skill (owner 2026-11-19): every non-passive skill of the classes done so far has a switch and a
// hook, and the Sim really sends each picture / zone / cue the hook table names, tagged with its skill (a typo there
// would silently draw nothing).
for (const cls of ['sword', 'mage', 'gunslinger'] as const) {
  const list = CLASSES[cls].skills.filter((s) => s.kind !== 'passive');
  const noSwitch = list.filter((s) => !(s.id in QUARKS_SKILLS)).map((s) => s.id);
  ok(noSwitch.length === 0, `every ${cls} skill has a qk switch (missing: ${noSwitch.join(', ')})`);
  const hooks = (id: string) => [
    ...Object.entries(ON_EFFECT).filter(([, h]) => h!.skill === id).map(([k]) => ['effect', k.split('/')[1]] as const),
    ...Object.entries(ON_ZONE).filter(([, h]) => h!.skill === id).map(([k]) => ['zone', k.split('/')[1]] as const),
    ...Object.entries(ON_CUE).filter(([k, h]) => h.skill === id && !k.startsWith('dash/') && CLASSES[cls].skills.find((s) => s.id === id)?.kind !== 'basic').map(() => ['cue', id] as const),
  ];
  const noHook = list.filter((s) => s.id !== 'dash' && s.kind !== 'basic' && s.id !== 'mg_firerain' && !hooks(s.id).length).map((s) => s.id);
  ok(noHook.length === 0, `every ${cls} skill has a hook (missing: ${noHook.join(', ')})`);
  ok(Object.keys(ON_CUE).includes(`dash/${cls}`), `the ${cls} dash has a cue`);
  const basic = list.find((s) => s.kind === 'basic')!;
  ok(ON_CUE[basic.id]?.skill === basic.id, `the ${cls} basic attack has a cue`);
  for (const sk of list) {
    const wants = hooks(sk.id);
    if (!wants.length) continue;
    const sim = new Sim(ZONE_1);
    const m = sim.monsters.find((x) => !x.isBoss)!;
    sim.monsters.length = 0;
    sim.monsters.push(m);
    m.x = sk.id === 'gs_mine' ? 0.6 : 2; // a mine goes off only when one steps close
    m.z = 0;
    (m as unknown as { baseHp: number }).baseHp = m.hp = 1e9; // big enough to outlive a burn
    const p = sim.addPlayer({ ...newCharacterData('Sw', cls), level: 40 });
    p.x = 0;
    p.z = 0;
    const seen = new Set<string>();
    const take = () => {
      for (const e of sim.drainEvents()) {
        if (e.t !== 'fx') continue;
        const a = e.args as unknown[];
        if (e.name === 'effect' && a[7] === sk.id) seen.add(`effect:${a[0]}`);
        if (e.name === 'zone' && a[6] === sk.id && typeof a[7] === 'number') seen.add(`zone:${a[0]}`);
        if (e.name === 'burst' && a[4] === 0 && a[7] === sk.id) seen.add(`cue:${sk.id}`);
      }
    };
    sim.drainEvents();
    castSkill(sim, p, sk, { x: 2, z: 0 }, 1);
    take();
    // 11 s: Hex Seed bursts when its 10 s seed runs out.
    for (let i = 0; i < 330; i++) { sim.step(1 / 30, () => IDLE_INTENT); take(); }
    for (const [kind, name] of wants) ok(seen.has(`${kind}:${name}`), `${sk.id} plays ${kind} ${name} tagged with itself (saw ${[...seen].join(',')})`);
  }
}
for (const cls of ['sword', 'mage', 'gunslinger'] as const) {
  // the basic attack and the dash send a cue: a burst of 0 tagged with the skill, colour = class, speed = angle
  const sim = new Sim(ZONE_1);
  const p = sim.addPlayer({ ...newCharacterData('Cue', cls), level: 5 });
  p.x = 0;
  p.z = 0;
  const basicId = CLASSES[cls].skills.find((s) => s.kind === 'basic')!.id;
  sim.drainEvents();
  basicAttack(sim, p, { x: 3, z: 0 });
  const cue = sim.drainEvents().find((e) => e.t === 'fx' && e.name === 'burst' && (e.args as unknown[])[7] === basicId);
  ok(!!cue && cue.t === 'fx' && (cue.args as unknown[])[4] === 0 && (cue.args as unknown[])[3] === cls, `${cls} basic attack cue`);
  sim.step(1 / 30, () => ({ ...IDLE_INTENT, dash: true, move: { x: 1, z: 0 } }));
  const dcue = sim.drainEvents().find((e) => e.t === 'fx' && e.name === 'burst' && (e.args as unknown[])[7] === 'dash');
  ok(!!dcue && dcue.t === 'fx' && (dcue.args as unknown[])[4] === 0 && (dcue.args as unknown[])[3] === cls, `${cls} dash cue`);
}

// Support Drone (owner 2026-11-19): one "drone" message per cast (owner id + life) and one per shot (angle), no position stream.
{
  const sim = new Sim(ZONE_1);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  sim.monsters.length = 0;
  sim.monsters.push(m);
  m.x = 3;
  m.z = 0;
  m.hp = 1e9;
  const p = sim.addPlayer({ ...newCharacterData('Drone', 'gunslinger'), level: 40 });
  p.x = 0;
  p.z = 0;
  p.mp = p.stats.maxMp;
  castSkill(sim, p, CLASSES.gunslinger.skills.find((s) => s.id === 'gs_drone')!, { x: 3, z: 0 }, 1);
  const msgs: unknown[][] = [];
  for (let i = 0; i < 150; i++) {
    sim.step(1 / 30, () => IDLE_INTENT);
    for (const e of sim.drainEvents()) if (e.t === 'fx' && e.name === 'drone') msgs.push(e.args as unknown[]);
  }
  ok(msgs.length >= 2 && msgs[0][0] === p.id && (msgs[0][1] as number) > 0 && msgs[0].length === 2, `drone appears once with its life (${JSON.stringify(msgs[0])})`);
  ok(msgs.slice(1).every((a) => a[0] === p.id && a[1] === 0 && typeof a[2] === 'number'), 'each shot is (owner, 0, angle)');
}

// Enhancement aura and orb light (owner 2026-11-23, flicker at +13/+15): only differences kept, ranges checked.
{
  const c = codeFxLayer();
  ok(c.enhAuraGlow === 1 && c.enhSparkGlow === 1 && c.enhSparkRate === 1 && c.enhSparkFadeIn === 0.3 && c.enhOrbGlowFront, 'aura/orb light code values');
  const same = checkFxLayerTuning({ enhAuraGlow: 1, enhSparkRate: 1, enhSparkFadeIn: 0.3, enhOrbGlowFront: true }, true);
  ok('tuning' in same && same.tuning === undefined, 'code values are not stored');
  const t = checkFxLayerTuning({ enhSparkRate: 0, enhSparkFadeIn: 0.5, enhOrbGlowFront: false, enhAuraGlow: 0.6, enhSparkGlow: 0.5 }, true);
  const tu = 'tuning' in t ? t.tuning : undefined;
  ok(JSON.stringify(tu) === '{"enhOrbGlowFront":false,"enhAuraGlow":0.6,"enhSparkGlow":0.5,"enhSparkRate":0,"enhSparkFadeIn":0.5}', `differences stored (${JSON.stringify(tu)})`);
  ok('error' in checkFxLayerTuning({ enhSparkFadeIn: 0.7 }, true), 'fade-in past 0.6 refused');
  ok('error' in checkFxLayerTuning({ enhAuraGlow: 2 }, true), 'ground glow past 1.4 refused');
  ok('error' in checkFxLayerTuning({ enhOrbGlowFront: 1 }, true), 'orb light switch must be on/off');
  const m = mergeFxLayer(tu);
  ok(m.enhSparkRate === 0 && !m.enhOrbGlowFront, 'merged');
  const lines = fxLayerChanges(codeFxLayer(), m).join(' | ');
  ok(lines.includes('ประกายออร่าตีบวก: × จำนวนต่อวิ (0 = ปิด) 1 → 0') && lines.includes('แสงลูกแก้วตีบวกอยู่หน้าลูก (ปิด = หลังลูก) เปิด → ปิด'), `audit lines (${lines})`);
}

finish('fx-layer');
