// Move speed from items tops out at 50% (owner 2026-11-26, docs/systems/balance.md "เพดานความเร็วเคลื่อนที่"): worn gear
// (enhance and rerolled lines included) plus item-set bonuses together. The class numbers, the passive, skill buffs and
// the mount come on top. The item values themselves never change, so old saves are capped the moment they load.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, codeBalance, currentBalanceTuning } from '../src/shared/balance';
import { ZONE_1 } from '../src/shared/data/zones';
import { CODE_MOVE_GROWTH, makeItem, rowRanges, upgradeItem } from '../src/shared/data/items';
import type { Item } from '../src/shared/types';
import { cleanStash } from '../src/shared/sim/stash';
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

// ---------------------------------------------------------------- boots move speed main line grows slower (owner 2026-11-26)
ok(CODE_MOVE_GROWTH === 0.003 && codeBalance().moveGrowth === 0.003, 'move growth 0.003 in code');
ok(JSON.stringify(checkBalance({ moveGrowth: 0.01 }, true).tuning) === '{"moveGrowth":0.01}', '/admin can set the growth');
ok(JSON.stringify(checkBalance({ moveGrowth: 0.003 }, true).tuning) === '{}', 'the code growth is not saved');
ok(checkBalance({ moveGrowth: 0.13 }, true).error !== undefined && checkBalance({ moveGrowth: -0.001 }, true).error !== undefined, 'growth only 0–0.12');
ok(balanceChanges({}, { moveGrowth: 0.01 }).includes('ค่าหลักความเร็วเคลื่อนที่โตต่อเลเวล 0.003 → 0.01'), 'the audit names the growth');

const t1Max = (id: string, lv: number) => rowRanges(id, 'legendary', lv, ['moveSpeed'])![0].max;
ok(Math.abs(t1Max('sandals', 1) - 10.1) < 0.2, `legendary sandals Lv1 T1 up to ~10 (${t1Max('sandals', 1)})`);
ok(Math.abs(t1Max('cinder_boots', 40) - 30.1) < 0.5, `legendary cinder boots Lv40 T1 up to ~30 (${t1Max('cinder_boots', 40)})`);
ok(Math.abs(t1Max('sea_king_boots', 80) - 50.1) < 0.5, `legendary sea king boots Lv80 T1 up to ~50 (${t1Max('sea_king_boots', 80)})`);
const extraMax = rowRanges('sea_king_boots', 'legendary', 80, ['moveSpeed', 'moveSpeed'])![1].max;
ok(Math.abs(extraMax - 40.1) < 0.2, `extra move speed lines keep their range (${extraMax})`);

const fresh = makeItem('sea_king_boots', 'legendary', 80, 'sword')!;
ok(fresh.mvG === 0.003, 'new boots are stamped with the growth');
ok(makeItem('cap', 'legendary', 80, 'sword')!.mvG === undefined, 'other kinds carry no growth stamp');

// An old save's boots: rolled with 0.12 (no stamp), main line 400, an extra move speed line 30.
const old = makeItem('sea_king_boots', 'legendary', 80, 'sword')!;
const mainAt = old.lines!.findIndex((l) => l.stat === 'moveSpeed');
old.lines![mainAt] = { ...old.lines![mainAt], value: 400, tier: 1, min: 360.8, max: 424.3 };
old.lines!.push({ stat: 'moveSpeed', value: 30, tier: 2, min: 0, max: 0 });
old.stats = { ...old.stats, moveSpeed: 430 };
delete old.mvG;
const oldDef = old.stats.def;
upgradeItem(old);
const want = Math.round(400 * (1 + 79 * 0.003) / (1 + 79 * 0.12) * 10) / 10;
ok(old.lines![mainAt].value === want, `old main line 400 → ${want} (${old.lines![mainAt].value})`);
ok(old.lines![old.lines!.length - 1].value === 30, 'the extra line keeps 30');
// makeItem may also roll extra move speed lines of its own: they count too.
const allMove = Math.round(old.lines!.filter((l) => l.stat === 'moveSpeed').reduce((t, l) => t + l.value, 0) * 10) / 10;
ok(old.stats.moveSpeed === allMove && old.stats.def === oldDef, `stats add up again (${old.stats.moveSpeed}), other stats untouched`);
ok(old.mvG === 0.003 && old.lines![mainAt].tier === 1, 'stamped, and still a T1 line on the new range');
const ml = old.lines![mainAt];
const newT1 = rowRanges('sea_king_boots', 'legendary', 80, ['moveSpeed'])![0];
ok(ml.min <= ml.value && ml.value <= ml.max, `the line's stored range moved too: ${ml.min} ≤ ${ml.value} ≤ ${ml.max}`);
ok(ml.max === newT1.max && ml.max < 60, `stored T1 range is the new one (max ${ml.max}), not 361–424`);
const once = JSON.stringify(old);
upgradeItem(old);
ok(JSON.stringify(old) === once, 'loading again changes nothing');

// /admin changes the growth: the stamped boots follow it, once.
applyBalance({ moveGrowth: 0.01 });
const before = old.lines![mainAt].value;
upgradeItem(old);
const want2 = Math.round(before * (1 + 79 * 0.01) / (1 + 79 * 0.003) * 10) / 10;
ok(old.lines![mainAt].value === want2 && old.mvG === 0.01, `growth 0.01: ${before} → ${want2} (${old.lines![mainAt].value})`);
applyBalance(keep);

// An old save loads with the new values.
const saveBoots: Item = JSON.parse(once);
saveBoots.lines![mainAt].value = 400;
saveBoots.stats.moveSpeed = 430;
delete saveBoots.mvG;
const q = sim.addPlayer({ ...newCharacterData('OldBoots', 'sword'), level: 80, equipment: { boots: saveBoots } });
ok(q.equipment.boots!.lines![mainAt].value === want && q.stats.moveSpeed === 50, `old save: boots ${q.equipment.boots!.lines![mainAt].value} + 30, still capped at 50`);

// The shared stash is read through upgradeItem too (market listings: server/market.ts; mail rolls new items on claim).
const stashBoots: Item = JSON.parse(once);
stashBoots.lines![mainAt] = { ...stashBoots.lines![mainAt], value: 400, min: 360.8, max: 424.3 };
delete stashBoots.mvG;
const st = cleanStash({ size: 30, gold: 0, items: [stashBoots] });
const sl = (st.items[0] as Item).lines![mainAt];
ok(sl.value === want && sl.min <= sl.value && sl.value <= sl.max && sl.tier === 1, `stash boots: ${sl.value} in ${sl.min}–${sl.max} T${sl.tier}`);

finish('move-cap');
