// Area skills' standing layer (owner 2026-11-15): every skill in the table exists and has its own row, and the Sim tags
// each effect and zone with the skill that made it (also timers and shots), so the client knows which pieces to draw.
import { ok, finish } from './check';
import { CLASSES, isLearnable } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { castSkill } from '../src/shared/sim/skills';
import { IDLE_INTENT } from '../src/shared/sim/types';
import { PROP_SHEET_ROWS, SKILL_PROPS } from '../src/client/zonePropsTable';

{
  const ids = new Set(Object.values(CLASSES).flatMap((c) => c.skills.filter(isLearnable).map((s) => s.id)));
  const bad = Object.keys(SKILL_PROPS).filter((id) => !ids.has(id));
  ok(bad.length === 0, `every skill in the table exists (${bad.join(', ')})`);
  const slots = Object.values(SKILL_PROPS).map((d) => `${d.sheet}/${d.row}`);
  ok(new Set(slots).size === slots.length, 'one row per skill');
  ok(Object.values(SKILL_PROPS).every((d) => d.row >= 0 && d.row < PROP_SHEET_ROWS && d.h > 0 && d.density > 0), 'rows and sizes in range');
}

/** Casts a skill next to a monster and returns the args of the first fx event `name` / `fxName` within 3 s. */
function tagOf(cls: 'sword' | 'mage', id: string, fxName: 'effect' | 'zone', name: string): unknown[] {
  const sim = new Sim(ZONE_1);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  sim.monsters.length = 0;
  sim.monsters.push(m);
  m.x = 0;
  m.z = 0;
  m.hp = 1e7;
  const p = sim.addPlayer({ ...newCharacterData('Tag', cls), level: 40 });
  p.x = -3;
  p.z = 0;
  sim.drainEvents();
  castSkill(sim, p, CLASSES[cls].skills.find((s) => s.id === id)!, { x: 0, z: 0 }, 1);
  for (let i = 0; i < 90; i++) {
    const ev = sim.drainEvents().find((e) => e.t === 'fx' && e.name === fxName && (e.args as unknown[])[0] === name);
    if (ev && ev.t === 'fx') return ev.args as unknown[];
    sim.step(1 / 30, () => IDLE_INTENT);
  }
  return [];
}
{
  const a = tagOf('sword', 'earthquake', 'effect', 'quake');
  ok(a[7] === 'earthquake', `effect carries its skill (${JSON.stringify(a)})`);
  const b = tagOf('mage', 'mg_flameground', 'zone', 'mg_firefield');
  ok(b.length === 8 && b[6] === 'mg_flameground' && b[5] === null && typeof b[7] === 'number', `zone carries its skill, follow padded, caster id (${JSON.stringify(b)})`);
  const c = tagOf('mage', 'mg_decayring', 'zone', 'mg_decay');
  ok(c[6] === 'mg_decayring' && typeof c[5] === 'number', `following zone keeps its caster and gets its skill (${JSON.stringify(c)})`);
  const d = tagOf('mage', 'meteor', 'effect', 'crater');
  ok(d[7] === 'meteor', `a timer's effect carries the skill (${JSON.stringify(d)})`);
  const e = tagOf('mage', 'fireball', 'effect', 'explosion');
  ok(e[7] === 'fireball', `a shot's blast carries the skill (${JSON.stringify(e)})`);
}

finish('zone-props');
