// Boss rooms (owner 2026-11-20): the boss countdown comes from the balance settings (code 13 s), and getting up
// with a phoenix feather makes the player untouchable for a moment (code 5 s: no damage, no boss effects), which
// ends at once on a basic attack, a skill (buffs too) or a dash, but not on walking or a potion. A real Sim, no server.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { ROOM_BOSS_DELAY } from '../src/shared/bossRoom';
import { BOSS_ROOMS } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import type { Monster } from '../src/shared/sim/Monster';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';

const TICK = 1 / 30;

// ---------------------------------------------------------- settings
{
  const code = mergeBalance({});
  ok(code.roomBossDelay === 13 && ROOM_BOSS_DELAY === 13, 'code: the boss comes after 13 s');
  ok(code.reviveGuard === true && code.reviveGuardSec === 5, 'code: guard on, 5 s');
  ok(JSON.stringify(checkBalance({ roomBossDelay: 13, reviveGuard: true, reviveGuardSec: 5 }, true).tuning) === '{}', 'code values are not saved');
  const t = checkBalance({ roomBossDelay: 20, reviveGuard: false, reviveGuardSec: 8 }, true).tuning;
  ok(t?.roomBossDelay === 20 && t.reviveGuard === false && t.reviveGuardSec === 8, 'changed values are kept');
  ok('error' in checkBalance({ roomBossDelay: -1 }, true) && 'error' in checkBalance({ roomBossDelay: 61 }, true), 'countdown outside 0–60 refused');
  ok('error' in checkBalance({ reviveGuardSec: 0 }, true) && 'error' in checkBalance({ reviveGuardSec: 31 }, true), 'guard seconds outside 1–30 refused');
  ok('error' in checkBalance({ reviveGuard: 1 }, true), 'a non-boolean switch is refused');
  const ch = balanceChanges({}, { roomBossDelay: 20, reviveGuard: false, reviveGuardSec: 8 });
  ok(ch.includes('นับถอยหลังก่อนบอสเกิด') && ch.includes('อมตะหลังชุบด้วยขนนกฟีนิกซ์') && ch.includes('เวลาอมตะหลังชุบ'), 'the audit names all three');
}

// ---------------------------------------------------------- the guard
const room = BOSS_ROOMS.misty_marsh;
/** A room with the hero next to its boss, down and then up again with a feather. */
function revived(): { sim: Sim; p: Player; boss: Monster } {
  const sim = new Sim(room, { keys: 1, bossDelay: 0 });
  const p = sim.addPlayer({ ...newCharacterData('A', 'sword'), level: 40 });
  const boss = sim.monsters.find((m) => m.isBoss) as Monster;
  p.x = boss.x + 2;
  p.z = boss.z;
  p.addStones('phoenix', 5);
  p.alive = false;
  p.hp = 0;
  ok(sim.reviveHere(p) && p.alive, 'up with a feather');
  p.stats.maxHp = p.hp = 1e9;
  p.mp = p.stats.maxMp = 1e6;
  return { sim, p, boss };
}
const step = (sim: Sim, it: Partial<Intent> = {}) => { sim.step(TICK, () => ({ ...IDLE_INTENT, aim: { x: 0, z: 0 }, ...it })); sim.drainEvents(); };

try {
  applyBalance({});
  {
    const { sim, p, boss } = revived();
    ok(p.guardT === 5, `guarded for 5 s (${p.guardT})`);
    const hp = p.hp;
    sim.hitPlayer(boss, p, 50, { stun: 2, kb: 9, fromX: boss.x, fromZ: boss.z });
    ok(p.hp === hp && p.stunT === 0 && p.kbx === 0 && p.kbz === 0, 'a hit: no damage, no stun, no knockback');
    // The boss keeps attacking while the hero just walks about and drinks: nothing gets through.
    let least = p.hp;
    for (let i = 0; i < Math.round(4.8 / TICK); i++) {
      step(sim, { move: i % 60 < 30 ? { x: 0, z: 1 } : { x: 0, z: -1 }, potion: i === 10 ? 'hp' : null });
      least = Math.min(least, p.hp);
    }
    ok(least >= hp && p.guardT > 0, `walking and potions keep it, nothing hurts (${p.guardT.toFixed(2)} s left)`);
    for (let i = 0; i < Math.round(0.4 / TICK); i++) step(sim);
    ok(p.guardT === 0, 'gone once the time is up');
    const before = p.hp;
    sim.hitPlayer(boss, p, 1, {});
    ok(p.hp < before, 'and hits hurt again');
  }
  {
    const { sim, p } = revived();
    step(sim, { basic: true });
    ok(p.guardT === 0, 'a basic attack ends it');
  }
  {
    const { sim, p } = revived();
    p.skillBook.ranks.sw_heavyslash = 1;
    p.skillBook.worn.q = 'sw_heavyslash';
    step(sim, { skills: ['q'] });
    ok(p.guardT === 0, 'a skill ends it');
  }
  {
    // A buff on yourself counts too (owner 2026-11-20), even with no monster hit.
    const { sim, p } = revived();
    p.skillBook.ranks.sw_overdrive = 1;
    p.skillBook.worn.q = 'sw_overdrive';
    step(sim, { skills: ['q'] });
    ok(p.guardT === 0 && p.statBuffs.some((b) => b.id === 'sw_overdrive'), 'a buff ends it');
  }
  {
    const { sim, p } = revived();
    step(sim, { dash: true, move: { x: 1, z: 0 } });
    ok(p.guardT === 0, 'a dash ends it');
  }
  {
    applyBalance({ reviveGuardSec: 2 });
    const { p } = revived();
    ok(p.guardT === 2, 'the seconds come from /admin');
    applyBalance({ reviveGuard: false });
    const off = revived();
    ok(off.p.guardT === 0, 'switch off: no guard');
  }
  {
    // Getting up anywhere else (the town respawn) gives no guard.
    applyBalance({});
    const { sim, p } = revived();
    p.alive = false;
    p.hp = 0;
    sim.respawn(p);
    ok(p.guardT === 0, 'dying ends it; no guard from other ways of getting up');
  }
} finally {
  applyBalance({});
}
finish('revive-guard');
