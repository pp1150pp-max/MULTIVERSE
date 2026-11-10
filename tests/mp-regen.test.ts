// Starting MP regen (owner 2026-11-10): every class regains 5 MP a second at Lv.1 with nothing worn.
import { finish, ok } from './check';
import { CLASS_IDS } from '../src/shared/data/classes';
import { ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';

const sim = new Sim(ZONE_HUB);
for (const cls of CLASS_IDS) {
  const p = sim.addPlayer(newCharacterData('M', cls));
  ok(Math.abs(p.stats.mpRegen - 5) < 1e-9, `${cls}: Lv.1 MP regen is 5/s (${p.stats.mpRegen})`);
}
finish('mp-regen');
