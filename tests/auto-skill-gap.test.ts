// Auto waits `skillGap` seconds between two skills (default 0.3 s, 0 = no wait) and "skills only" never uses the
// basic attack (owner 2026-11-22). On real Sims, no server.
import { ok, finish } from './check';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { AutoPlay } from '../src/shared/sim/autoplay';
import { cleanAutoSettings, DEFAULT_AUTO_SETTINGS } from '../src/shared/sim/Player';
import { IDLE_INTENT } from '../src/shared/sim/types';
import { codeAuto } from '../src/shared/autoTuning';
import { oldSkills } from './skills';

const sim = new Sim(ZONE_1);
for (let i = 0; i < 300 && !sim.monsters.some((m) => m.alive && !m.isBoss); i++) sim.step(0.1);
const mob = sim.monsters.find((m) => m.alive && !m.isBoss)!;
ok(!!mob, 'zone 1 has a monster');

const p = sim.addPlayer({ name: 'G', classId: 'gunslinger', level: 30, exp: 0, gold: 0, equipment: {}, bag: [], skills: oldSkills('gunslinger') });
const at = (x: number) => { p.x = mob.x + x; p.z = mob.z; };
const fresh = () => { p.mp = 9999; p.cd = {}; };

// Defaults.
ok(codeAuto().skillGap === 0.3, 'code default gap is 0.3 s');
ok(cleanAutoSettings({}).skillGap === 0.3 && !cleanAutoSettings({}).skillsOnly, 'old saves: gap 0.3 s, basic attack on');
ok(cleanAutoSettings({ skillGap: 1.24, skillGapSet: true }).skillGap === 1.2, 'own gap kept, rounded to 0.1');
ok(cleanAutoSettings({ skillGap: 9, skillGapSet: true }).skillGap === 2 && cleanAutoSettings({ skillGap: -1, skillGapSet: true }).skillGap === 0, 'gap clamped to 0–2');
ok(cleanAutoSettings({ skillGap: 1 }).skillGap === 0.3, 'gap not set by the player follows the server default');
ok(cleanAutoSettings({ skillsOnly: true, optsSet: ['skillsOnly'] }).skillsOnly, 'skills only kept once picked');

// The gap: one skill at t=1, nothing at 1.2, the next at 1.3 (cooldowns cleared between frames so only the gap stops it).
{
  at(1);
  p.autoSettings = cleanAutoSettings({ ...DEFAULT_AUTO_SETTINGS });
  const auto = new AutoPlay();
  auto.start(p.x, p.z);
  const step = (time: number) => { fresh(); return auto.intent({ player: p, monsters: sim.monsters, loots: [], time, zone: ZONE_1 }, IDLE_INTENT); };
  ok(step(1).skills.length === 1, 'first skill goes at once');
  const mid = step(1.2);
  ok(mid.skills.length === 0 && mid.basic, 'inside the gap: no skill, basic attack goes on');
  ok(step(1.31).skills.length === 1, 'after 0.3 s the next skill goes');
}
{
  at(1);
  p.autoSettings = cleanAutoSettings({ ...DEFAULT_AUTO_SETTINGS, skillGap: 0, skillGapSet: true });
  const auto = new AutoPlay();
  auto.start(p.x, p.z);
  const step = (time: number) => { fresh(); return auto.intent({ player: p, monsters: sim.monsters, loots: [], time, zone: ZONE_1 }, IDLE_INTENT); };
  step(1);
  ok(step(1.05).skills.length === 1, 'gap 0: next skill the very next frame');
}

// Skills only: never the basic attack, even with every skill cooling down.
{
  at(1);
  p.autoSettings = cleanAutoSettings({ ...DEFAULT_AUTO_SETTINGS, skillsOnly: true, optsSet: ['skillsOnly'] });
  const auto = new AutoPlay();
  auto.start(p.x, p.z);
  fresh();
  const a = auto.intent({ player: p, monsters: sim.monsters, loots: [], time: 1, zone: ZONE_1 }, IDLE_INTENT);
  ok(!a.basic && a.skills.length === 1, 'skills only: a skill, no basic attack');
  for (const s of ['q', 'e', 'r'] as const) p.cd[p.skill(s)!.id] = 5;
  const b = auto.intent({ player: p, monsters: sim.monsters, loots: [], time: 3, zone: ZONE_1 }, IDLE_INTENT);
  ok(!b.basic && b.skills.length === 0, 'skills only, all cooling down: stands and waits');
}
sim.removePlayer(p);

finish('auto-skill-gap');
