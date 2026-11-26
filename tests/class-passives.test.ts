// Class passives (owner 2026-11-27, docs/systems/skills.md "พาสซีฟประจำอาชีพ"): the gunslinger's Hit and Run walks on while
// basic-attacking (skills still stop), the mage's Warp stands at the dash's end at once, never through a wall, a prop or the
// map's edge, holds 2 warps that come back one dash cooldown apart with a 0.2 s gap, and the /admin numbers check and audit.
// A real Sim, no server.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, currentBalance } from '../src/shared/balance';
import { cleanSkillBook } from '../src/shared/skillBook';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { DASH_DIST, newCharacterData, type Player } from '../src/shared/sim/Player';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import type { ClassId } from '../src/shared/types';

const TICK = 1 / 30;

function field(cls: ClassId, level = 40): { sim: Sim; p: Player } {
  const sim = new Sim(ZONE_1);
  sim.monsters.length = 0;
  const p = sim.addPlayer({ ...newCharacterData('Tester', cls), level });
  p.skillBook = cleanSkillBook(cls, {});
  p.stats.maxHp = p.hp = 1e9;
  p.mp = p.stats.maxMp = 1e6;
  // An open spot of the farm map (no colliders within the dash's reach).
  const spot = open(sim, p);
  p.x = spot.x;
  p.z = spot.z;
  return { sim, p };
}
/** A spot with nothing solid within 6 m, away from the town's safe area. */
function open(sim: Sim, p: Player): { x: number; z: number } {
  const t = sim.terrain;
  for (let x = -60; x <= 60; x += 3) {
    for (let z = -60; z <= 60; z += 3) {
      let clear = true;
      for (let a = 0; a < 16 && clear; a++) {
        for (let d = 0; d <= 6 && clear; d += 0.5) {
          if (t.isBlocked(x + Math.cos((a / 16) * Math.PI * 2) * d, z + Math.sin((a / 16) * Math.PI * 2) * d, p.radius)) clear = false;
        }
      }
      if (clear && !sim.inSafe({ x, z })) return { x, z };
    }
  }
  throw new Error('no open spot');
}
const step = (sim: Sim, it: Partial<Intent>) => sim.step(TICK, () => ({ ...IDLE_INTENT, aim: { x: 1000, z: 0 }, ...it }));
const wait = (sim: Sim, sec: number) => { for (let i = 0; i < Math.round(sec / TICK); i++) step(sim, {}); };
const events = (sim: Sim) => sim.drainEvents();

try {
  applyBalance({});

  // ---------------------------------------------------------- Hit and Run
  {
    const { sim, p } = field('gunslinger');
    ok(p.hitRunOn(), 'a gunslinger has Hit and Run at Lv 40');
    const x0 = p.x;
    for (let i = 0; i < 30; i++) step(sim, { move: { x: 1, z: 0 }, basic: true });
    const walked = p.x - x0;
    ok(walked > p.moveSpeed * 0.9, `walks on while basic-attacking (${walked.toFixed(2)} m in 1 s, speed ${p.moveSpeed.toFixed(2)})`);
    ok(p.atkRootT === 0, 'no stop on the basic attack');
  }
  {
    // Off on /admin: the old stop is back.
    applyBalance({ skills: { classPassive: { hitrun: { on: false } } } });
    const { sim, p } = field('gunslinger');
    ok(!p.hitRunOn(), 'switched off');
    const x0 = p.x;
    for (let i = 0; i < 30; i++) step(sim, { move: { x: 1, z: 0 }, basic: true });
    ok(p.x - x0 < p.moveSpeed * 0.75, `switched off: the basic attack stops again (${(p.x - x0).toFixed(2)} m)`);
    applyBalance({});
  }
  {
    // Below the unlock level: no Hit and Run.
    applyBalance({ skills: { classPassive: { hitrun: { level: 20 } } } });
    ok(!field('gunslinger', 19).p.hitRunOn() && field('gunslinger', 20).p.hitRunOn(), 'unlocks at the level set on /admin');
    applyBalance({});
    ok(!field('mage').p.hitRunOn() && !field('sword').p.hitRunOn(), 'only the gunslinger has Hit and Run');
  }

  // ---------------------------------------------------------- Warp: at the end at once
  {
    const { sim, p } = field('mage');
    const dash = p.skill('dash')!;
    ok(p.warpOn() && p.chargeMax(dash) === 2 && p.chargesOf(dash) === 2, 'a mage holds 2 warps');
    events(sim);
    const x0 = p.x;
    const z0 = p.z;
    step(sim, { move: { x: 1, z: 0 }, dash: true });
    ok(Math.abs(p.x - x0 - DASH_DIST) < 0.01 && Math.abs(p.z - z0) < 0.01, `stands at the dash's end in the same tick (${(p.x - x0).toFixed(2)} m)`);
    ok(!p.isDashing, 'no dash movement (no puffs, no path)');
    ok(p.invulnT > 0.2, 'the same short invulnerability as a dash');
    const ev = events(sim);
    ok(ev.some((e) => e.t === 'fx' && e.name === 'warp'), 'tells the browser to draw the Warp rings');
    ok(ev.some((e) => e.t === 'warped' && e.id === p.id), 'tells the server to bump the epoch (the browser jumps)');
    ok(!ev.some((e) => e.t === 'anim' && e.name === 'dash'), 'no dash animation');
    ok(p.chargesOf(dash) === 1, 'one warp left');
    step(sim, { move: { x: 1, z: 0 }, dash: true });
    ok(p.chargesOf(dash) === 1, 'again at once: refused (0.2 s gap)');
    wait(sim, 0.2);
    const x1 = p.x;
    step(sim, { move: { x: 1, z: 0 }, dash: true });
    ok(p.chargesOf(dash) === 0 && p.x - x1 > 4, 'after the gap the second warp goes');
    wait(sim, 0.25);
    const x2 = p.x;
    step(sim, { dash: true });
    ok(p.x === x2, 'none left: refused');
    // Back one at a time, one dash cooldown each.
    const full = p.dashCooldown();
    const t0 = sim.time;
    let t1 = 0;
    let t2 = 0;
    for (let i = 0; i < 20 * 30 && !t2; i++) {
      step(sim, {});
      if (!t1 && p.chargesOf(dash) === 1) t1 = sim.time - t0;
      if (t1 && p.chargesOf(dash) === 2) t2 = sim.time - t0;
    }
    ok(t1 > 0 && t1 <= full + 0.1, `one warp back after about the dash cooldown (${t1.toFixed(2)} s of ${full})`);
    ok(t2 - t1 > full - 0.15 && t2 - t1 < full + 0.15, `the next one dash cooldown later (${(t2 - t1).toFixed(2)} s)`);
  }

  // ---------------------------------------------------------- Warp: never through walls, props or the map's edge
  {
    const { sim, p } = field('mage');
    const b = sim.terrain.bound;
    p.x = b - 1.5;
    p.z = 0;
    sim.terrain.resolve(p);
    step(sim, { move: { x: 1, z: 0 }, dash: true });
    ok(p.x <= b && !sim.terrain.isBlocked(p.x, p.z, p.radius - 0.01), `stops at the map's edge (x ${p.x.toFixed(2)}, edge ${b})`);
  }
  {
    // A prop in the way: put a collider 2 m ahead and warp into it.
    const { sim, p } = field('mage');
    sim.terrain.colliders.push({ x: p.x + 2.5, z: p.z, r: 0.5 });
    const x0 = p.x;
    step(sim, { move: { x: 1, z: 0 }, dash: true });
    ok(p.x < x0 + 2.5 - 0.5, `stops before a prop in its path, never on the far side (${(p.x - x0).toFixed(2)} m)`);
    ok(!sim.terrain.isBlocked(p.x, p.z, p.radius - 0.01), 'stands on open ground');
  }
  {
    // A thin prop (smaller than one step of an ordinary dash tick) is not slipped through either.
    const { sim, p } = field('mage');
    sim.terrain.colliders.push({ x: p.x + 3, z: p.z, r: 0.05 });
    const x0 = p.x;
    step(sim, { move: { x: 1, z: 0 }, dash: true });
    ok(p.x < x0 + 3, `a thin prop stops it too (${(p.x - x0).toFixed(2)} m)`);
  }
  {
    // Held in the mud (snare): no warp, as no dash.
    const { sim, p } = field('mage');
    p.snareT = 2;
    const x0 = p.x;
    step(sim, { move: { x: 1, z: 0 }, dash: true });
    ok(p.x === x0 && p.chargesOf(p.skill('dash')!) === 2, 'snared: no warp, no charge spent');
  }
  {
    // Off on /admin, or below its level: the ordinary dash.
    applyBalance({ skills: { classPassive: { warp: { on: false } } } });
    const { sim, p } = field('mage');
    ok(!p.warpOn() && p.chargeMax(p.skill('dash')!) === 0, 'switched off: the dash has no charges');
    step(sim, { move: { x: 1, z: 0 }, dash: true });
    ok(p.isDashing, 'switched off: the old dash');
    applyBalance({ skills: { classPassive: { warp: { stacks: 3, level: 30 } } } });
    ok(!field('mage', 29).p.warpOn(), 'below the unlock level: no Warp');
    const q = field('mage', 30).p;
    ok(q.chargeMax(q.skill('dash')!) === 3, 'stacks as set on /admin');
    applyBalance({});
    ok(!field('gunslinger').p.warpOn() && !field('sword').p.warpOn(), 'only the mage has Warp');
  }

  // ---------------------------------------------------------- /admin numbers: check and audit
  {
    const good = checkBalance({ skills: { classPassive: { hitrun: { level: 10 }, warp: { stacks: 3, gap: 0.5, look: { size: 1.5, color1: '#FFAA00' } } } } }, true);
    ok('tuning' in good, 'good values pass');
    const t = ('tuning' in good ? good.tuning : undefined) ?? {};
    ok(t.skills?.classPassive?.warp?.look?.color1 === '#ffaa00', 'colours are kept in lower case');
    const same = checkBalance({ skills: { classPassive: { warp: { stacks: 2, on: true } } } }, true);
    ok('tuning' in same && !same.tuning?.skills, 'values equal to the code are left out');
    for (const bad of [{ warp: { stacks: 0 } }, { warp: { stacks: 2.5 } }, { warp: { gap: -1 } }, { hitrun: { level: 0 } }, { warp: { look: { color1: 'red' } } }, { warp: { x: 1 } }, { sword: {} }]) {
      ok('error' in checkBalance({ skills: { classPassive: bad } }, true), `refused: ${JSON.stringify(bad)}`);
    }
    const lines = balanceChanges({}, t);
    ok(/ยิงแล้ววิ่ง เลเวลปลดล็อก 1 → 10/.test(lines) && /ก้าวมิติ จำนวนครั้งที่เก็บได้ 2 → 3/.test(lines), `audit lines (${lines})`);
    ok(currentBalance().skills.classPassive.warp.stacks === 2, 'the code value is 2');
  }
} catch (e) {
  ok(false, `threw: ${(e as Error).stack}`);
}
finish('class-passives');
