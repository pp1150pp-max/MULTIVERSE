// Debuffs on monsters (owner 2026-11-15): what the server sends in the snapshot so the client can show them, and the
// /admin switch for the icons and effects.
import { ok, finish } from './check';
import { checkBalance, balanceChanges } from '../src/shared/balance';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { DEBUFF_BIT, debuffMask, hasDebuff } from '../src/shared/sim/debuffs';

const sim = new Sim(ZONE_1);
const m = sim.monsters.find((x) => !x.isBoss)!;
const now = sim.time;
ok(debuffMask(m, now, 1) === 0, 'a fresh monster has none');
m.stunT = 1;
m.slowT = 1;
m.armorBreak = 0.3;
m.armorBreakUntil = now + 2;
m.weak = 0.2;
m.weakUntil = now + 2;
m.dotUntil = now + 2;
m.markBy = 7;
m.markUntil = now + 2;
const all = debuffMask(m, now, 7);
ok(all === 63 && ['stun', 'slow', 'armor', 'weak', 'dot', 'mark'].every((d) => hasDebuff(all, d as never)), `all six (${all})`);
ok(!hasDebuff(debuffMask(m, now, 8), 'mark') && debuffMask(m, now, 8) === 63 - DEBUFF_BIT.mark, 'the mark shows only to the player who put it');
ok(debuffMask(m, now + 3, 7) === (DEBUFF_BIT.stun | DEBUFF_BIT.slow), 'timed ones end (stun/slow count down in the sim)');
m.armorBreak = 0;
ok(!hasDebuff(debuffMask(m, now, 7), 'armor'), 'armor break of 0 is no debuff');

const t = checkBalance({ fxLayer: { debuffs: false } }, true).tuning!;
ok(JSON.stringify(t) === '{"fxLayer":{"debuffs":false}}', `switch stored (${JSON.stringify(t)})`);
ok(balanceChanges({}, t) === 'ดีบัฟบนตัวมอน (ไอคอน + เอฟเฟกต์) เปิด → ปิด', `audit (${balanceChanges({}, t)})`);
ok(checkBalance({ fxLayer: { debuffs: 1 } }, true).error !== undefined, 'strict refuses a non-boolean');

finish('debuffs');
