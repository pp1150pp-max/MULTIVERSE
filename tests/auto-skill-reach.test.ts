// Auto casts a skill only when that skill would reach (owner 2026-11-20): a monster standing at basic-attack range
// but outside a short skill's reach gets basic attacks (or the next skill that reaches), not a whiffed skill.
// Buffs still cast; the /admin switch `aoeGuard` off = the old way. On real Sims, no server.
import { ok, finish } from './check';
import { applyBalance, checkBalance, currentBalance } from '../src/shared/balance';
import { codeAuto } from '../src/shared/autoTuning';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { AutoPlay } from '../src/shared/sim/autoplay';
import { cleanAutoSettings, DEFAULT_AUTO_SETTINGS, type AutoSkill } from '../src/shared/sim/Player';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import type { ClassId } from '../src/shared/types';

const sim = new Sim(ZONE_1);
for (let i = 0; i < 300 && !sim.monsters.some((m) => m.alive && !m.isBoss); i++) sim.step(0.1);
const mob = sim.monsters.find((m) => m.alive && !m.isBoss)!;
ok(!!mob, 'zone 1 has a monster');
const R = mob.radius;
const MARGIN = codeAuto().aoeMargin;

/** One Auto frame for a Lv40 player of `cls` wearing `worn` (rank 1, all switched on), `gap` metres (centre) from the monster. */
function frame(cls: ClassId, worn: Partial<Record<AutoSkill, string>>, gap: number, order: AutoSkill[] = ['q', 'e', 'r']): { it: Intent; worn: boolean } {
  const ranks: Record<string, number> = {};
  for (const id of Object.values(worn)) ranks[id!] = 1;
  const p = sim.addPlayer({ name: 'T', classId: cls, level: 40, exp: 0, gold: 0, equipment: {}, bag: [], skills: { ranks, worn } as never });
  const wornOk = (Object.keys(worn) as AutoSkill[]).every((s) => p.skill(s)?.id === worn[s]);
  p.x = mob.x - gap;
  p.z = mob.z;
  p.autoSettings = cleanAutoSettings({ ...DEFAULT_AUTO_SETTINGS, order, skills: { q: true, e: true, r: true } });
  p.mp = 99999;
  p.cd = {};
  const auto = new AutoPlay();
  auto.start(p.x, p.z);
  const it = auto.intent({ player: p, monsters: [mob], loots: [], time: 1, zone: ZONE_1 }, IDLE_INTENT);
  sim.removePlayer(p);
  return { it, worn: wornOk };
}
const skills = (r: { it: Intent }) => r.it.skills.join();

ok(codeAuto().aoeGuard === true, 'code default: reach check on');

// Mage Flame Wave (cone 6 m): the mage stops at 8.5 m (centre), so a monster there is in basic reach, not in the wave's.
const far = Math.min(8.3, 6 + R + MARGIN + 0.8);
ok(far - R - MARGIN > 6 && far <= 8.5, `test spot: in basic reach, out of the wave (${far.toFixed(2)} m, monster radius ${R})`);
{
  const out = frame('mage', { q: 'mg_flamewave' }, far);
  ok(out.worn, 'mage wears Flame Wave on Q');
  ok(skills(out) === '' && out.it.basic === true, 'out of the wave\'s reach: no skill, basic attack');
  const near = frame('mage', { q: 'mg_flamewave' }, 3);
  ok(skills(near) === 'q' && near.it.basic === true, 'monster moves into reach: Flame Wave cast');
  const next = frame('mage', { q: 'mg_flamewave', e: 'fireball' }, far);
  ok(next.worn && skills(next) === 'e', 'out of the wave\'s reach: the next skill that reaches (Fireball 12 m) goes');
}
// Damaging circle around the player (Frost Nova 4.5 m): needs a monster in it.
{
  ok(skills(frame('mage', { e: 'frostnova' }, far)) === '', 'Frost Nova with the monster outside the circle: not cast');
  ok(skills(frame('mage', { e: 'frostnova' }, 2)) === 'e', 'Frost Nova with the monster inside: cast');
}
// A buff (circle with no damage) casts as before, even with the monster far out of its circle.
{
  const out = frame('mage', { q: 'mg_manashield' }, far);
  ok(out.worn && skills(out) === 'q', 'Mana Shield (buff): cast at basic reach');
}
// Normal farming isn't slowed: a long shot at the gunslinger's stop distance still goes.
{
  const out = frame('gunslinger', { r: 'headshot' }, 8.9);
  ok(out.worn && skills(out) === 'r', 'gunslinger Headshot (18 m) at 8.9 m: cast');
}
// Swordsman's R while walking in (4–7 m): a 5.5 m circle waits until the monster is inside it.
{
  const gapOut = 5.5 + R + MARGIN + 0.3;
  if (gapOut < 7) {
    const out = frame('sword', { r: 'sw_unleash' }, gapOut);
    ok(out.worn && skills(out) === '' && !!out.it.moveTo, `sword Unleash at ${gapOut.toFixed(2)} m: not cast, keeps walking in`);
  } else ok(true, 'monster too big for this sword case (skipped)');
  ok(skills(frame('sword', { r: 'sw_unleash' }, 4.5)) === 'r', 'sword Unleash at 4.5 m: cast while walking in');
}

// Switch off on /admin: the old way, cast as soon as the basic attack reaches.
applyBalance(checkBalance({ auto: { aoeGuard: false } }, true).tuning!);
ok(currentBalance().auto.aoeGuard === false, 'switch off is applied');
ok(skills(frame('mage', { q: 'mg_flamewave' }, far)) === 'q', 'switch off: Flame Wave cast at basic reach (old way)');
ok(skills(frame('mage', { e: 'frostnova' }, far)) === 'e', 'switch off: Frost Nova cast with nothing in the circle (old way)');
applyBalance({});

// The margin is taken off the reach (owner 2026-11-20): just inside the cone's edge, but not by the margin → held.
{
  const edge = 6 + R - MARGIN / 2;
  ok(skills(frame('mage', { q: 'mg_flamewave' }, edge)) === '', `monster ${(MARGIN / 2).toFixed(2)} m inside the cone's edge: held (margin ${MARGIN} m)`);
  ok(skills(frame('mage', { q: 'mg_flamewave' }, 6 + R + MARGIN / 2)) === '', 'monster just outside the cone (the old bug spot): not cast');
  ok(skills(frame('mage', { q: 'mg_flamewave' }, 6 + R - MARGIN - 0.05)) === 'q', 'monster inside by the margin: cast');
}
// A bigger margin waits for the monster to come in deeper.
applyBalance(checkBalance({ auto: { aoeMargin: 3 } }, true).tuning!);
ok(skills(frame('mage', { q: 'mg_flamewave' }, 4)) === '', 'margin 3 m: Flame Wave held at 4 m');
ok(skills(frame('mage', { q: 'mg_flamewave' }, 2.5)) === 'q', 'margin 3 m: Flame Wave cast at 2.5 m');
applyBalance({});

finish('auto-skill-reach');
