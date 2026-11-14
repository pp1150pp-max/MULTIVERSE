// Auto casts the highest skill in the player's order that is switched on and ready, one per frame;
// the order is kept in the settings (Q, E, R by default and for bad or old data). On real Sims, no server.
import { ok, finish } from './check';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { AutoPlay } from '../src/shared/sim/autoplay';
import { cleanAutoSettings, DEFAULT_AUTO_SETTINGS, type AutoSkill } from '../src/shared/sim/Player';
import { IDLE_INTENT } from '../src/shared/sim/types';
import type { ClassId } from '../src/shared/types';
import { oldSkills } from './skills';

const sim = new Sim(ZONE_1);
for (let i = 0; i < 300 && !sim.monsters.some((m) => m.alive && !m.isBoss); i++) sim.step(0.1);
const mob = sim.monsters.find((m) => m.alive && !m.isBoss)!;
ok(!!mob, 'zone 1 has a monster');

/** What Auto casts this frame for a player of this class standing next to the monster. */
function cast(classId: ClassId, opts: { order?: AutoSkill[]; off?: AutoSkill[]; cooling?: AutoSkill[] }): string[] {
  const p = sim.addPlayer({ name: 'T', classId, level: 30, exp: 0, gold: 0, equipment: {}, bag: [], skills: oldSkills(classId) });
  p.x = mob.x + 1;
  p.z = mob.z;
  const skills = { q: true, e: true, r: true };
  for (const s of opts.off ?? []) skills[s] = false;
  p.autoSettings = cleanAutoSettings({ ...DEFAULT_AUTO_SETTINGS, order: opts.order, skills });
  p.mp = 9999;
  p.cd = {};
  for (const s of opts.cooling ?? []) p.cd[p.skill(s)!.id] = 5;
  const auto = new AutoPlay();
  auto.start(p.x, p.z);
  const it = auto.intent({ player: p, monsters: sim.monsters, loots: [], time: 1, zone: ZONE_1 }, IDLE_INTENT);
  sim.removePlayer(p);
  return it.skills;
}
const same = (a: string[], b: string[]) => a.join() === b.join();

for (const cls of ['sword', 'mage', 'gunslinger'] as const) {
  ok(same(cast(cls, {}), ['q']), `${cls}: default order casts Q first`);
  ok(same(cast(cls, { order: ['r', 'q', 'e'] }), ['r']), `${cls}: rank 1 (R) goes first`);
  ok(same(cast(cls, { order: ['r', 'q', 'e'], cooling: ['r'] }), ['q']), `${cls}: rank 1 cooling down → rank 2`);
  ok(same(cast(cls, { order: ['e', 'r', 'q'], off: ['e'] }), ['r']), `${cls}: a skill switched off is skipped`);
  ok(same(cast(cls, { order: ['e', 'r', 'q'], off: ['e'], cooling: ['r'] }), ['q']), `${cls}: off and cooling both skipped`);
  ok(same(cast(cls, { off: ['q', 'e', 'r'] }), []), `${cls}: all off → no skill`);
}

const def = (o: unknown) => same(cleanAutoSettings({ order: o }).order, ['q', 'e', 'r']);
ok(def(undefined), 'old saves with no order get Q, E, R');
ok(def(['q', 'q', 'e']) && def(['q', 'e']) && def(['q', 'e', 'x']) && def('qer') && def(['q', 'e', 'r', 'r']), 'bad orders fall back to Q, E, R');
ok(same(cleanAutoSettings({ order: ['e', 'r', 'q'] }).order, ['e', 'r', 'q']), 'a valid order is kept');

finish('auto-skill-order');
