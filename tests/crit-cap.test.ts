// Crit rate tops out at 100% (owner 2026-11-25): gear and buffs past it do nothing, and /admin can set a lower cap.
import { ok, finish } from './check';
import { applyBalance, checkBalance, codeBalance, currentBalanceTuning } from '../src/shared/balance';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';

ok(codeBalance().critCap === 100, 'crit cap 100% in code');
ok(JSON.stringify(checkBalance({ critCap: 60 }, true).tuning) === '{"critCap":60}', '/admin can set it');
ok(checkBalance({ critCap: 101 }, true).error !== undefined && checkBalance({ critCap: -1 }, true).error !== undefined, 'only 0–100');

const sim = new Sim(ZONE_1);
const p = sim.addPlayer({ ...newCharacterData('Crit', 'gunslinger'), level: 40 });
const base = p.stats.crit;
ok(base < 100, `starts under the cap (${base}%)`);
p.addStatBuff('test_crit', 60, { crit: 500 });
ok(p.stats.crit === 100, `+500% crit stops at 100% (${p.stats.crit}%)`);

const keep = currentBalanceTuning();
applyBalance({ critCap: 30 });
p.recompute();
ok(p.stats.crit === 30, `/admin cap 30% holds it at 30% (${p.stats.crit}%)`);
applyBalance(keep);
p.recompute();
ok(p.stats.crit === 100, 'back to 100% with the code cap');

p.statBuffs = [];
p.recompute();
ok(p.stats.crit === base, 'under the cap nothing changes');

finish('crit-cap');
