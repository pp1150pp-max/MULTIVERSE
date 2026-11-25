// Spawn-spot radius × by map (/admin "ปรับสมดุล" → มอนธรรมดา): what may be saved, the audit line, and monsters really
// spreading wider (never past the map edge, into collision or the safe area), with the leash growing along.
import { applyBalance, balanceChanges, checkBalance } from '../src/shared/balance';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { finish, ok } from './check';

ok('error' in checkBalance({ spawnRadius: { [ZONE_1.id]: 5 } }, true), 'above ×4 is refused');
ok('error' in checkBalance({ spawnRadius: { [ZONE_1.id]: 0.5 } }, true), 'below ×1 is refused');
ok('error' in checkBalance({ spawnRadius: { nowhere: 2 } }, true), 'an unknown map is refused');
ok(JSON.stringify(checkBalance({ spawnRadius: { [ZONE_1.id]: 1 } }, true).tuning) === '{}', '×1 is not saved');
ok(checkBalance({ spawnRadius: { [ZONE_1.id]: 2.5 } }, true).tuning?.spawnRadius?.[ZONE_1.id] === 2.5, '×2.5 is kept');
ok(balanceChanges({}, { spawnRadius: { [ZONE_1.id]: 2 } }).includes('รัศมีจุดเกิด'), 'the audit names the change');

/** The farthest an ordinary monster stands from its own spot, over a few fresh Sims. */
function reach(): { far: number; outside: number; blocked: number } {
  let far = 0, outside = 0, blocked = 0;
  for (let i = 0; i < 4; i++) {
    const sim = new Sim(ZONE_1);
    for (const m of sim.monsters) {
      if (m.isBoss) continue;
      far = Math.max(far, Math.hypot(m.x - m.area.x, m.z - m.area.z));
      if (Math.abs(m.x) > sim.terrain.bound || Math.abs(m.z) > sim.terrain.bound) outside++;
      if (sim.terrain.isBlocked(m.x, m.z, m.radius * 0.5)) blocked++;
    }
  }
  return { far, outside, blocked };
}
applyBalance({});
const base = reach();
applyBalance({ spawnRadius: { [ZONE_1.id]: 4 } });
const wide = reach();
const sim = new Sim(ZONE_1);
ok(sim.monsters.filter((m) => !m.isBoss).every((m) => m.spread === 4), 'new monsters carry the ×4');
applyBalance({});
ok(wide.far > base.far * 1.5, `×4 spreads wider (${base.far.toFixed(1)} → ${wide.far.toFixed(1)} m)`);
ok(wide.outside === 0, 'none outside the map');
ok(wide.blocked === 0, 'none inside collision');
finish('spawn-radius');
