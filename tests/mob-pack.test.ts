// Monsters per spawn spot, by map (/admin "ปรับสมดุล" → มอนธรรมดา, owner 2026-11-17): each spot keeps count ×the
// map's multiplier as a pack, decimals spread over the spots, bosses never; checks on what may be saved; and the
// change taking effect live in a running Sim (more come in on the respawn timer, extra ones are not replaced).
import { applyBalance, balanceChanges, checkBalance, mergeBalance, packCount, PACK_ZONES } from '../src/shared/balance';
import { ZONE_1, ZONE_2 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { finish, ok } from './check';

const ordinary = (s: Sim) => s.monsters.filter((m) => !m.isBoss && m.alive).length;
const spotTotal = (id: string, spawns: { count: number }[], t = {}) => spawns.reduce((n, a, i) => n + packCount(id, a.count, i, mergeBalance(t)), 0);
const base1 = ZONE_1.spawns.reduce((n, a) => n + a.count, 0);

// ---------------------------------------------------------- the numbers
ok(PACK_ZONES.some((z) => z.id === ZONE_1.id) && PACK_ZONES.some((z) => z.id === ZONE_2.id), 'the farm maps are listed');
ok(spotTotal(ZONE_1.id, ZONE_1.spawns) === base1, 'untouched = the code count');
ok(spotTotal(ZONE_1.id, ZONE_1.spawns, { mobPack: { [ZONE_1.id]: 3 } }) === base1 * 3, '×3 = three times as many');
const half = spotTotal(ZONE_1.id, ZONE_1.spawns, { mobPack: { [ZONE_1.id]: 1.5 } });
ok(Math.abs(half - base1 * 1.5) <= 2, `×1.5 ≈ half again (${half} of ${base1})`);
ok(spotTotal(ZONE_2.id, ZONE_2.spawns, { mobPack: { [ZONE_1.id]: 3 } }) === ZONE_2.spawns.reduce((n, a) => n + a.count, 0), 'another map is not touched');

// ---------------------------------------------------------- what may be saved
ok('error' in checkBalance({ mobPack: { [ZONE_1.id]: 6 } }, true), 'above ×5 is refused');
ok('error' in checkBalance({ mobPack: { [ZONE_1.id]: 0.5 } }, true), 'below ×1 is refused');
ok('error' in checkBalance({ mobPack: { nowhere: 2 } }, true), 'an unknown map is refused');
ok(JSON.stringify(checkBalance({ mobPack: { [ZONE_1.id]: 1 } }, true).tuning) === '{}', '×1 is not saved');
ok(checkBalance({ mobPack: { [ZONE_1.id]: 2.5 } }, true).tuning?.mobPack?.[ZONE_1.id] === 2.5, '×2.5 is kept');
ok(balanceChanges({}, { mobPack: { [ZONE_1.id]: 2 } }).includes('มอนต่อจุด'), 'the audit names the change');

// ---------------------------------------------------------- live in a Sim
{
  applyBalance({ mobPack: { [ZONE_1.id]: 3 } });
  const sim = new Sim(ZONE_1);
  ok(ordinary(sim) === base1 * 3, `a new Sim starts with ×3 (${ordinary(sim)})`);
  applyBalance({});
  for (const m of sim.monsters) if (!m.isBoss) (sim as unknown as { killMonster(m: unknown): void }).killMonster(m);
  for (let i = 0; i < 30 * 40; i++) sim.step(1 / 30);
  ok(ordinary(sim) === base1, `lowered back to ×1: only the code count comes back (${ordinary(sim)})`);
  applyBalance({ mobPack: { [ZONE_1.id]: 2 } });
  sim.step(1 / 30);
  ok(ordinary(sim) === base1, 'raised: the extra ones do not appear at once');
  for (let i = 0; i < 30 * 30; i++) sim.step(1 / 30);
  ok(ordinary(sim) === base1 * 2, `raised to ×2: they come in on the respawn timer (${ordinary(sim)})`);
  applyBalance({});
}
finish('mob-pack');
