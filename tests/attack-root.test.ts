// Stopping for a moment on each attack (owner 2026-11-18, src/shared/attackRootTuning.ts): walking and then
// attacking holds the player still for the stop, then walking (a held key or a clicked spot) carries on. Movement
// and buff skills don't stop, a dash ends the stop, the browser's reported position is held too (with a little
// slack), the /admin switch off = the old behaviour, and the /admin numbers check and audit. A real Sim, no server.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, currentBalance } from '../src/shared/balance';
import { attackRootTime, codeAttackRoot, NO_ATTACK_ROOT } from '../src/shared/attackRootTuning';
import { CLASSES, isLearnable } from '../src/shared/data/classes';
import { HUB_ID, ZONE_1, zoneById } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import type { ClassId } from '../src/shared/types';

const TICK = 1 / 30;
const EAST = { x: 1, z: 0 };

/** A Sim with no monsters and one Lv.40 player of `cls` standing in the open (not in town). */
function field(cls: ClassId): { sim: Sim; p: Player } {
  const sim = new Sim(ZONE_1);
  sim.monsters.length = 0;
  const p = sim.addPlayer({ ...newCharacterData('Tester', cls), level: 40 });
  p.x = -6;
  p.z = 0;
  p.stats.maxHp = p.hp = 1e9;
  p.mp = p.stats.maxMp = 1e6;
  return { sim, p };
}
const step = (sim: Sim, it: Partial<Intent>) => sim.step(TICK, () => ({ ...IDLE_INTENT, aim: { x: 10, z: 0 }, ...it }));

try {
  // ---------------------------------------------------------- walk, attack, stand, walk on
  for (const cls of ['sword', 'mage', 'gunslinger'] as const) {
    const { sim, p } = field(cls);
    ok(!sim.inSafe(p), `${cls}: the test spot is outside town`);
    for (let i = 0; i < 10; i++) step(sim, { move: EAST });
    const x0 = p.x;
    ok(x0 > -6 + 0.5, `${cls}: walks east first (${x0.toFixed(2)})`);
    step(sim, { move: EAST, basic: true });
    const want = Math.min(codeAttackRoot().classes[cls].basicSec, p.attackAnimDuration());
    ok(Math.abs(p.atkRootT - want) < 1e-6, `${cls}: the basic attack stops for ${want.toFixed(2)} s (${p.atkRootT.toFixed(2)})`);
    const xHit = p.x;
    let still = true;
    let ticks = 0;
    while (p.atkRootT > 0 && ticks < 60) {
      // The tick the stop runs out in already walks again.
      const ending = p.atkRootT <= TICK + 1e-9;
      step(sim, { move: EAST });
      if (!ending && (Math.abs(p.x - xHit) > 1e-9 || p.moving)) still = false;
      ticks++;
    }
    ok(still, `${cls}: stands still for the whole stop though the walk key is held (${ticks} ticks)`);
    ok(Math.abs(ticks * TICK - want) < TICK * 1.5, `${cls}: the stop lasts about its time (${(ticks * TICK).toFixed(2)} s)`);
    step(sim, { move: EAST });
    step(sim, { move: EAST });
    ok(p.x > xHit + 0.1 && p.moving, `${cls}: then walks on by itself`);
  }

  // ---------------------------------------------------------- a clicked spot is kept through the stop
  {
    const { sim, p } = field('sword');
    step(sim, { moveTo: { x: 4, z: 0 } });
    step(sim, { basic: true });
    const xHit = p.x;
    step(sim, {});
    ok(p.x === xHit && !!p.moveTarget, 'click-walk: stops on the attack but keeps the clicked spot');
    for (let i = 0; i < 30; i++) step(sim, {});
    ok(p.x > xHit + 0.5, 'click-walk: walks on to the spot afterwards');
  }

  // ---------------------------------------------------------- online: the browser's reported position
  {
    const { sim, p } = field('sword');
    step(sim, { basic: true });
    const x0 = p.x;
    step(sim, { pos: { x: x0 + 1.5, z: 0 } });
    ok(p.x === x0, 'reported position far from the stop: refused while stopped');
    step(sim, { pos: { x: x0 + 0.3, z: 0 } });
    ok(Math.abs(p.x - (x0 + 0.3)) < 1e-6, 'reported position within the slack: taken (the browser stops a moment earlier)');
    while (p.atkRootT > 0) step(sim, {});
    step(sim, { pos: { x: x0 + 0.6, z: 0 } });
    ok(Math.abs(p.x - (x0 + 0.6)) < 1e-6, 'after the stop: reported positions taken again');
  }

  // ---------------------------------------------------------- skills
  const learnable = (cls: ClassId) => CLASSES[cls].skills.filter(isLearnable).filter((s) => s.kind !== 'passive');
  const wear = (p: Player, id: string) => {
    p.skillBook.ranks[id] = 1;
    p.skillBook.worn.q = id;
  };
  {
    const { sim, p } = field('sword');
    wear(p, 'sw_heavyslash');
    step(sim, { move: EAST });
    step(sim, { move: EAST, skills: ['q'] });
    const want = codeAttackRoot().classes.sword.basicSec * codeAttackRoot().skillMult;
    ok(Math.abs(p.atkRootT - want) < 1e-6, `a swinging skill (Heavy Slash) stops for basic × skill multiplier (${p.atkRootT.toFixed(2)})`);
  }
  {
    const { sim, p } = field('sword');
    wear(p, 'charge');
    const x0 = p.x;
    step(sim, { move: EAST, skills: ['q'] });
    ok(p.isDashing && p.atkRootT === 0, 'a movement skill (Charge) dashes without stopping');
    for (let i = 0; i < 10; i++) step(sim, {});
    ok(p.x > x0 + 2, `Charge still carries the player (${(p.x - x0).toFixed(2)} m)`);
  }
  {
    const { sim, p } = field('sword');
    wear(p, 'sw_overdrive');
    step(sim, { move: EAST, skills: ['q'] });
    ok(p.atkRootT === 0, 'a buff skill (Overdrive) doesn\'t stop');
  }
  {
    const all = [...learnable('sword'), ...learnable('mage'), ...learnable('gunslinger')].map((s) => s.id);
    ok([...NO_ATTACK_ROOT].every((id) => all.includes(id)), 'every skill on the no-stop list exists');
  }

  // ---------------------------------------------------------- a dash ends the stop
  {
    const { sim, p } = field('sword');
    step(sim, { basic: true });
    ok(p.atkRootT > 0, 'dash: stopped by the attack first');
    const x0 = p.x;
    step(sim, { move: EAST, dash: true });
    ok(p.isDashing && p.atkRootT === 0, 'dash during the stop: dashes and the stop ends');
    for (let i = 0; i < 8; i++) step(sim, { move: EAST });
    ok(p.x > x0 + 3, `dash moves the player (${(p.x - x0).toFixed(2)} m)`);
  }

  // ---------------------------------------------------------- no attacks in town = no stop
  {
    const sim = new Sim(zoneById(HUB_ID));
    const p = sim.addPlayer({ ...newCharacterData('Towner', 'sword'), level: 40 });
    p.x = 0;
    p.z = 0;
    ok(sim.inSafe(p), 'town: standing in the safe area');
    step(sim, { basic: true, move: EAST });
    ok(p.atkRootT === 0, 'in town: no attack, no stop');
  }

  // ---------------------------------------------------------- /admin switch off = the old behaviour
  {
    const t = checkBalance({ attackRoot: { classes: { sword: { on: false } } } }, true);
    ok(!!t.tuning, `switch off saves (${JSON.stringify(t.tuning ?? t.error)})`);
    applyBalance(t.tuning!);
    const { sim, p } = field('sword');
    step(sim, { move: EAST });
    step(sim, { move: EAST, basic: true });
    const x0 = p.x;
    step(sim, { move: EAST });
    ok(p.atkRootT === 0 && p.x > x0 && p.moving, 'sword switched off: walks on while attacking (the old way)');
    const g = field('gunslinger');
    step(g.sim, { move: EAST, basic: true });
    ok(g.p.atkRootT > 0, 'the other classes keep their own switch');
    applyBalance({});
  }

  // ---------------------------------------------------------- /admin numbers
  {
    const code = codeAttackRoot();
    ok(code.classes.sword.on && code.classes.mage.on && code.classes.gunslinger.on && code.skillMult === 1, 'code: on for all three, skill × 1');
    const same = checkBalance({ attackRoot: { classes: { sword: { on: true, basicSec: code.classes.sword.basicSec } }, skillMult: 1 } }, true);
    ok(!!same.tuning && same.tuning.attackRoot === undefined, 'values equal to the code are not saved');
    ok(!!checkBalance({ attackRoot: { classes: { mage: { basicSec: 1.5 } } } }, true).error, 'refused: stop over 1 s');
    ok(!!checkBalance({ attackRoot: { skillMult: -1 } }, true).error, 'refused: skill multiplier below 0');
    ok(!!checkBalance({ attackRoot: { classes: { thief: { on: false } } } }, true).error, 'refused: unknown class');
    const t = checkBalance({ attackRoot: { classes: { mage: { basicSec: 0.2 } }, skillMult: 1.5 } }, true);
    const audit = balanceChanges({}, t.tuning!);
    ok(audit.includes('หยุดตอนตีธรรมดา นักเวท') && audit.includes('×1 → ×1.5'), `audit in Thai (${audit})`);
    applyBalance(t.tuning!);
    ok(currentBalance().attackRoot.classes.mage.basicSec === 0.2, 'applied: the game uses the new stop');
    const { sim, p } = field('mage');
    step(sim, { basic: true });
    ok(Math.abs(p.atkRootT - 0.2) < 1e-6, 'the Sim stops for the tuned time');
    applyBalance({});
    ok(attackRootTime(codeAttackRoot(), 'sword', null, 0.2) === 0.2, 'a basic stop never outlasts the attack animation (fast attack speed)');
    ok(attackRootTime(codeAttackRoot(), 'sword', 'charge', 0.5) === 0, 'movement skills: no stop');
  }
} finally {
  applyBalance({});
}

finish('attack-root');
