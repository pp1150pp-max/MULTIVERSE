// The skill effects' extra layer (owner 2026-11-15): the /admin numbers (fxLayerTuning.ts) and what the Sim sends so
// the caster's own screen can feel a hit (Whirlwind: the caster's id and whether it hit). The drawing itself
// (src/client/fxLayer.ts) needs a screen and is looked at in the game.
import { ok, finish } from './check';
import { balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { CLASSES } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { castSkill } from '../src/shared/sim/skills';
import { codeFxLayer } from '../src/shared/fxLayerTuning';

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
  ok(a.length > 0 && a[5] === a[7] && a[6] === true, `Whirlwind that hits: caster id and hit = true (${JSON.stringify(a)})`);
  const b = whirl(false);
  ok(b.length > 0 && b[5] === b[7] && b[6] === false, `Whirlwind into the air: hit = false (${JSON.stringify(b)})`);
}

finish('fx-layer');
