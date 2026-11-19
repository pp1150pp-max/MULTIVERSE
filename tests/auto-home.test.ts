// Auto Play with nothing to fight (owner 2026-11-19): goes back to the spot where Auto was switched on and
// stands still there; the /admin switch `homeWait` off = the old way (walk to a spawn spot in the circle).
// On a real Sim, no server.
import { ok, finish } from './check';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { AutoPlay, type AutoWorld } from '../src/shared/sim/autoplay';
import { IDLE_INTENT } from '../src/shared/sim/types';
import { applyBalance, checkBalance, currentBalance } from '../src/shared/balance';
import { checkAutoTuning, codeAuto, mergeAuto, autoChanges } from '../src/shared/autoTuning';

const sim = new Sim(ZONE_1);
const p = sim.addPlayer({ name: 'A', classId: 'sword', level: 30, exp: 0, gold: 0, equipment: {}, bag: [{ potion: 'hp', size: 's', count: 5 }, { potion: 'mp', size: 's', count: 5 }] });
const home = { x: p.x, z: p.z };
p.autoSettings = { ...p.autoSettings, range: 500 };
const auto = new AutoPlay();
auto.start(home.x, home.z);
let t = 1;
const step = (): { moveTo: { x: number; z: number } | null } => {
  const g: AutoWorld = { player: p, monsters: [], loots: [], time: (t += 0.1), zone: ZONE_1 };
  return auto.intent(g, IDLE_INTENT);
};
const at = (m: { x: number; z: number } | null, q: { x: number; z: number }) => !!m && Math.hypot(m.x - q.x, m.z - q.z) < 0.01;

// ---- switch on (code default): walk back to the start spot, stand still there
ok(codeAuto().homeWait === true, 'code default: on');
p.x = home.x + 12;
p.z = home.z + 3;
ok(at(step().moveTo, home), 'no monster, far from the start spot: goes back to it');
p.x = home.x + 0.5;
p.z = home.z;
ok(at(step().moveTo, p), 'at the start spot: stands still');
p.x = home.x + 1.8; // between arrive and leave: no jitter
ok(at(step().moveTo, p), 'a little off the spot: stays put (no jitter)');
p.x = home.x + 4;
ok(at(step().moveTo, home), 'drifted farther away: walks back');
ok(!!auto.takeHint() || (t += 20, step(), !!auto.takeHint()), 'the "waiting for monsters" hint still shows');

// ---- a start spot that can't be used (not reachable): waits where it is, never walks forever
{
  const a2 = new AutoPlay();
  a2.start(home.x, home.z);
  p.x = home.x + 12;
  p.z = home.z;
  let tt = 100;
  const go = () => a2.intent({ player: p, monsters: [], loots: [], time: (tt += 0.5), zone: ZONE_1 }, IDLE_INTENT).moveTo;
  ok(at(go(), home), 'walks towards the spot');
  for (let i = 0; i < 10; i++) go(); // never gets closer (a wall): 5 s
  ok(at(go(), p), 'no progress for a few seconds: gives up and waits where it is');
}

// ---- switch off in /admin: the old way (not the start spot)
applyBalance(checkBalance({ auto: { homeWait: false } }, true).tuning!);
ok(currentBalance().auto.homeWait === false, 'switch off is applied');
{
  const a3 = new AutoPlay();
  a3.start(home.x, home.z);
  p.x = home.x + 1.5;
  p.z = home.z;
  const mt = a3.intent({ player: p, monsters: [], loots: [], time: 1, zone: ZONE_1 }, IDLE_INTENT).moveTo;
  ok(!!mt && !at(mt, home) && !at(mt, p), 'switch off: walks to a spot in the circle, not the start spot');
}
applyBalance({});
ok(currentBalance().auto.homeWait === true, 'cleared tuning: back to on');

// ---- saving: only what differs from the code
ok(!('tuning' in checkAutoTuning({ homeWait: 'no' }, true)) , 'non on/off is refused');
const off = checkAutoTuning({ homeWait: false }, true);
ok('tuning' in off && off.tuning?.homeWait === false, 'off is saved');
const on = checkAutoTuning({ homeWait: true }, true);
ok('tuning' in on && on.tuning === undefined, 'on (= code) is not saved');
ok(mergeAuto({ homeWait: false }).homeWait === false, 'merged config uses the saved value');
ok(autoChanges(codeAuto(), mergeAuto({ homeWait: false })).length === 1, 'the change goes to the audit');

finish('auto-home');
