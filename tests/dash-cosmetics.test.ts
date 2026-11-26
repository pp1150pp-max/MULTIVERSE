// Dash effects as cosmetics (owner 2026-11-26, docs/systems/cosmetics.md "เอฟเฟกต์แดช"): the six pieces, their
// snapshot codes, their per-piece look values, the /admin switch, old saves, and that the effect's cue comes from
// the dash button of every class only (not from the skills that dash). A real Sim, no server.
import { ok, finish } from './check';
import { COSMETICS, COS_SLOTS, cleanCosWorn, cosById, cosCodes, cosFromCodes } from '../src/shared/data/cosmetics';
import { checkCosTuning, colorNum, COS_AXES, COS_TUNE_FIELDS, cosTuneDefaults, cosTuningChanges } from '../src/shared/cosTuning';
import { applyBalance, checkBalance, currentBalance } from '../src/shared/balance';
import { checkCosShop, mayPutOnCos } from '../src/shared/cosShop';
import { DASH_DIST, DASH_STYLE, DASH_TIME, dashLookOf } from '../src/client/dashFx';
import { CLASSES, isLearnable } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { IDLE_INTENT, type Intent, type SimEvent } from '../src/shared/sim/types';
import type { ClassId } from '../src/shared/types';

// ---- the pieces
const pieces = COSMETICS.filter((c) => c.slot === 'dash');
ok(pieces.length === 6, `six dash pieces (${pieces.length})`);
ok(COS_SLOTS[COS_SLOTS.length - 1] === 'dash' && COS_SLOTS.indexOf('levelup') === 6, 'the new slot is last: older slots keep their codes');
ok(cosById('wings_angel')?.code === 1 && cosById('levelup_shadow')?.code === 102, 'older codes unchanged');
ok(pieces.map((c) => c.code).join(',') === '113,114,115,116,117,118', `codes 113–118 (${pieces.map((c) => c.code)})`);
ok(new Set(COSMETICS.map((c) => c.code)).size === COSMETICS.length, 'every code unique');
ok(pieces.every((c) => c.name.startsWith('แดช: ')), 'names start with "แดช: "');
ok(new Set(pieces.map((c) => DASH_STYLE[c.id])).size === 6 && pieces.every((c) => DASH_STYLE[c.id]), 'each piece has its own drawing');
const worn = { wings: 'wings_bat', levelup: 'levelup_fire', dash: 'dash_thunder' };
ok(JSON.stringify(cosFromCodes(cosCodes(worn))) === JSON.stringify(worn), 'a worn dash piece goes through the snapshot codes');
// an old save has no dash: reads as before; a bad one is dropped
ok(JSON.stringify(cleanCosWorn({ wings: 'wings_bat' })) === '{"wings":"wings_bat"}', 'an old save without a dash reads as before');
ok(JSON.stringify(cleanCosWorn({ dash: 'levelup_fire', levelup: 'dash_wind' })) === '{}', 'pieces in the wrong slot are dropped');

// ---- look values
const windLook = cosTuneDefaults('dash_wind')!;
ok(windLook.color1 === colorNum('#c8f4ff') && windLook.sec === 0.55 && windLook.size === 1 && windLook.ends && windLook.trail && windLook.ghosts && windLook.sparks, 'wind starts with its catalogue colours, 0.55 s, every part on');
ok(pieces.every((c) => cosTuneDefaults(c.id)!.color2 === colorNum(c.color2)), 'each piece starts in its own colours');
ok(COS_AXES.dash.length === 0 && Object.keys(COS_TUNE_FIELDS.dash).join(',') === 'color1,color2,size,sec,ends,trail,ghosts,sparks', 'only look fields, no placement');
const good = checkCosTuning({ dash_fire: { color1: 0xff0000, sec: 1, ghosts: false } }, true);
ok(JSON.stringify(good.tuning) === '{"dash_fire":{"color1":16711680,"sec":1,"ghosts":false}}', `strict check keeps good values (${JSON.stringify(good)})`);
ok(!!checkCosTuning({ dash_fire: { sec: 3 } }, true).error, 'time over 1.5 s is refused');
ok(!!checkCosTuning({ dash_fire: { size: 0.1 } }, true).error, 'size under 0.3 is refused');
ok(!!checkCosTuning({ dash_fire: { main: true } }, true).error, 'a level-up field is not a dash field');
ok(cosTuningChanges({}, { dash_star: { color1: 0x112233 } }) === 'dash_star.color1 #ffe27a → #112233', 'audit shows colours as #rrggbb');
const look = dashLookOf(checkCosTuning({ dash_leaf: { color1: 0x00ff00, trail: false } }, true).tuning!.dash_leaf);
ok(look.color1 === '#00ff00' && !look.trail && look.ends && look.sec === 0.55, 'the effect reads the piece\'s values');
ok(DASH_DIST === 4.8 && DASH_TIME === 0.18, 'the effect knows the dash button\'s distance and time');

// ---- shop and wearing rules (shared with every cosmetic)
ok(JSON.stringify(checkCosShop({ dash_star: { price: 300 } }, true).shop) === '{"dash_star":{"price":300}}', 'a dash piece can be priced');
ok(JSON.stringify(checkCosShop({}, true).shop) === '{}', 'no price in code: not on sale until the owner sets one');
ok(mayPutOnCos('dash_fire', undefined, new Set()) && !mayPutOnCos('dash_fire', undefined, new Set(['dash_fire'])), 'hidden pieces cannot be put on');

// ---- the /admin switch
ok(currentBalance().fxLayer.dashNew === true, 'on in code');
ok(checkBalance({ fxLayer: { dashNew: false } }, true).tuning?.fxLayer?.dashNew === false, 'the on/off switch is on the balance tab');

// ---- the cue: the dash button of every class, never a skill that dashes
const TICK = 1 / 30;
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
/** The dash cues in what the Sim sent: burst(x, y, z, class, 0, angle, by, 'dash'). */
const cues = (evs: SimEvent[]) => evs.filter((e) => e.t === 'fx' && e.name === 'burst' && (e.args as unknown[])[7] === 'dash').map((e) => (e as { args: unknown[] }).args);

// The mage's class passive Warp (classPassives.ts) turns its dash into a vanish-and-appear: the plain dash is checked with it off.
applyBalance({ skills: { classPassive: { warp: { on: false } } } });
for (const cls of ['sword', 'mage', 'gunslinger'] as const) {
  const { sim, p } = field(cls);
  sim.drainEvents();
  const x0 = p.x;
  step(sim, { move: { x: 1, z: 0 }, dash: true });
  const c = cues(sim.drainEvents());
  ok(c.length === 1 && c[0][6] === p.id && c[0][4] === 0 && Math.abs(c[0][5] as number) < 1e-6 && Math.abs((c[0][0] as number) - x0) < 0.5,
    `${cls}: the dash button sends one cue with its id and direction (${JSON.stringify(c)})`);
}
applyBalance({});
{
  // Warp on (the code's own): no dash cue, its own two rings instead (the old dash never shows on top).
  const { sim, p } = field('mage');
  sim.drainEvents();
  step(sim, { move: { x: 1, z: 0 }, dash: true });
  const evs = sim.drainEvents();
  ok(cues(evs).length === 0 && evs.some((e) => e.t === 'fx' && e.name === 'warp') && !p.isDashing, 'mage with Warp: no dash cue, the Warp rings instead');
}
let skillCues = 0;
let dashing = 0;
for (const cls of ['sword', 'mage', 'gunslinger'] as const) {
  for (const sk of CLASSES[cls].skills.filter(isLearnable).filter((s) => s.kind !== 'passive')) {
    const { sim, p } = field(cls);
    p.skillBook.ranks[sk.id] = 1;
    p.skillBook.worn.q = sk.id;
    sim.drainEvents();
    step(sim, { skills: ['q'] });
    if (p.isDashing) dashing++;
    for (let i = 0; i < 10; i++) step(sim, {});
    skillCues += cues(sim.drainEvents()).length;
  }
}
ok(dashing > 0, `some skills dash (${dashing})`);
ok(skillCues === 0, `no skill sends the dash button's cue (${skillCues})`);

finish('dash-cosmetics');
