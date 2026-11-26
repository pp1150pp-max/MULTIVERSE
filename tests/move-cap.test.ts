// Move speed from items tops out at 50% (owner 2026-11-26, docs/systems/balance.md "เพดานความเร็วเคลื่อนที่"): worn gear
// (enhance and rerolled lines included) plus item-set bonuses together. The class numbers, the passive, skill buffs and
// the mount come on top. The item values themselves never change, so old saves are capped the moment they load.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, codeBalance, currentBalanceTuning } from '../src/shared/balance';
import { ZONE_1 } from '../src/shared/data/zones';
import { makeItem } from '../src/shared/data/items';
import { BASE_MOVE_SPEED } from '../src/shared/formulas';
import { MOUNT_SPEED } from '../src/shared/data/cosmetics';
import { Sim } from '../src/shared/sim/Sim';
import { itemMoveSpeed, newCharacterData } from '../src/shared/sim/Player';

ok(codeBalance().moveCap === 50, 'item move speed cap 50% in code');
ok(JSON.stringify(checkBalance({ moveCap: 30 }, true).tuning) === '{"moveCap":30}', '/admin can set it');
ok(JSON.stringify(checkBalance({ moveCap: 50 }, true).tuning) === '{}', 'the code value is not saved');
ok(checkBalance({ moveCap: 301 }, true).error !== undefined && checkBalance({ moveCap: -1 }, true).error !== undefined, 'only 0–300');
ok(balanceChanges({}, { moveCap: 30 }).includes('ความเร็วเคลื่อนที่จากไอเทมสูงสุด 50% → 30%'), 'the audit names it');

const boots = (move: number, uid = 'b1') => ({ ...makeItem('sandals', 'legendary', 1, 'sword')!, uid, stats: { def: 1, moveSpeed: move } });
const sim = new Sim(ZONE_1);

// Old save: boots worth 190% before the cap existed.
const data = { ...newCharacterData('Fast', 'sword'), level: 40 };
data.equipment = { boots: boots(190) };
const p = sim.addPlayer(data);
ok(p.equipment.boots!.stats.moveSpeed === 190, 'the item keeps its 190 (nothing rewritten)');
ok(itemMoveSpeed(p.equipment, 'sword') === 190, 'items total 190 before the cap');
ok(p.stats.moveSpeed === 50, `old save loads capped at 50 (${p.stats.moveSpeed})`);
ok(Math.abs(p.moveSpeed - BASE_MOVE_SPEED * 1.5) < 1e-9, 'walking speed = base × 1.5');

// Under the cap nothing changes.
p.equipment.boots = boots(20);
p.recompute();
ok(p.stats.moveSpeed === 20, `20 from items stays 20 (${p.stats.moveSpeed})`);

// Enhanced items and several lines add up before the cap.
p.equipment.boots = { ...boots(30), plus: 10 };
p.equipment.ring = { ...makeItem('ring_copper', 'legendary', 1, 'sword')!, uid: 'r1', stats: { moveSpeed: 40 } };
p.recompute();
ok(itemMoveSpeed(p.equipment, 'sword') > 70 && p.stats.moveSpeed === 50, `boots +10 and a ring together stop at 50 (${p.stats.moveSpeed})`);
delete p.equipment.ring;

// Set bonuses count toward the cap.
const keep = currentBalanceTuning();
applyBalance({ sets: { bonus: { beach: [{ moveSpeed: 30 }, {}, {}] } } });
const beach = (part: string) => ({ ...makeItem(`beach_${part}`, 'common', 41, 'sword')!, stats: {} });
p.equipment = { helmet: beach('helmet'), armor: beach('armor'), gloves: beach('gloves'), boots: boots(40) };
p.recompute();
ok(itemMoveSpeed(p.equipment, 'sword') === 70 && p.stats.moveSpeed === 50, `boots 40 + set 30 stop at 50 (${p.stats.moveSpeed})`);
applyBalance(keep);

// A skill buff sits on top of the cap.
p.equipment = { boots: boots(190) };
p.addStatBuff('test_move', 60, { moveSpeed: 20 });
ok(p.stats.moveSpeed === 70, `cap 50 + buff 20 = 70 (${p.stats.moveSpeed})`);
p.statBuffs = [];
p.recompute();

// The mount multiplies on top.
p.mounted = true;
ok(Math.abs(p.moveSpeed - BASE_MOVE_SPEED * 1.5 * MOUNT_SPEED) < 1e-9, 'mounted: × the mount on top of the cap');
p.mounted = false;

// The gunslinger's own +5 is outside the cap.
const g = sim.addPlayer({ ...newCharacterData('Gun', 'gunslinger'), level: 1, equipment: { boots: boots(190, 'b2') } });
const gunBase = sim.addPlayer({ ...newCharacterData('Gun2', 'gunslinger'), level: 1 }).stats.moveSpeed;
ok(gunBase > 0 && Math.abs(g.stats.moveSpeed - (gunBase + 50)) < 1e-9, `gunslinger base ${gunBase} + cap 50 (${g.stats.moveSpeed})`);

// /admin cap changes apply right away.
applyBalance({ moveCap: 30 });
p.recompute();
ok(p.stats.moveSpeed === 30, `/admin cap 30 holds it at 30 (${p.stats.moveSpeed})`);
applyBalance({ moveCap: 0 });
p.recompute();
ok(p.stats.moveSpeed === 0, 'cap 0: items give no move speed');
applyBalance(keep);
p.recompute();
ok(p.stats.moveSpeed === 50, 'back to 50 with the code cap');

finish('move-cap');
