// Perfect Dodge (owner 2026-11-27): a hit that misses because of the dash, with the dash pressed at most `window`
// seconds before, gives extra invulnerability and a damage buff, once per cooldown; bosses' hits count unless the
// /admin switch says no. On a real Sim, no server.
import { ok, finish } from './check';
import { Sim } from '../src/shared/sim/Sim';
import { ZONE_1 } from '../src/shared/data/zones';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import { applyBalance, checkBalance, currentBalance } from '../src/shared/balance';
import { codeDodge, dodgeChanges, mergeDodge } from '../src/shared/dodgeTuning';
import { buffMask, BUFF_BIT } from '../src/shared/sim/debuffs';

const TICK = 1 / 30;
const sim = new Sim(ZONE_1);
const p = sim.addPlayer({ name: 'T', classId: 'sword', level: 10, exp: 0, gold: 0, equipment: {}, bag: [] });
const mob = sim.monsters.find((m) => !m.isBoss)!;
const step = (it: Partial<Intent> = {}) => sim.step(TICK, () => ({ ...IDLE_INTENT, aim: { x: 1000, z: 0 }, ...it }));
const wait = (sec: number) => { for (let i = 0; i < Math.round(sec / TICK); i++) step(); };
const texts = () => sim.drainEvents().filter((e) => e.t === 'text').map((e) => (e as { text: string }).text);
// Keep the test player out of the monsters' reach between checks: we call the hits ourselves.
const hit = (m = mob) => sim.hitPlayer(m, p, 1, {});

try {
  applyBalance({});
  const cfg = codeDodge();
  ok(cfg.on && cfg.boss && cfg.window === 0.3 && cfg.invuln === 0.5 && cfg.dmgPct === 20 && cfg.dmgSec === 3 && cfg.cooldown === 5, 'code defaults as agreed');

  // ---- a hit while not dashing: no dodge, damage taken
  texts();
  const hp0 = p.hp;
  hit();
  ok(p.hp < hp0, 'no dash: the hit lands');
  ok(!texts().includes('PERFECT DODGE!'), 'no dash: no Perfect Dodge');
  p.hp = p.maxHp;

  // ---- dash, then the hit lands at once: Perfect Dodge
  step({ move: { x: 1, z: 0 }, dash: true });
  ok(p.invulnT > 0, 'the dash makes you invulnerable');
  texts();
  hit();
  const t1 = texts();
  ok(t1.includes('PERFECT DODGE!') && !t1.includes('MISS'), 'a hit right after pressing dash: PERFECT DODGE! instead of MISS');
  ok(p.hp === p.maxHp, 'no damage taken');
  ok(p.invulnT >= 0.5 - 1e-9, 'extra invulnerability');
  ok(Math.abs(p.perfectMult - 1.2) < 1e-9 && p.perfectUntil > sim.time + 2.9, '+20% damage for 3 s');
  ok((buffMask(p, sim.time) & BUFF_BIT.attack) !== 0, 'shows as an attack buff (magic circle)');

  // ---- the damage buff really multiplies damage
  {
    const target = sim.monsters.find((m) => !m.isBoss && m !== mob)!;
    const tries = 200;
    let withBuff = 0;
    for (let i = 0; i < tries; i++) {
      target.hp = 1e9;
      sim.hitMonster(p, target, 1);
      withBuff += 1e9 - target.hp;
    }
    p.perfectUntil = 0;
    let without = 0;
    for (let i = 0; i < tries; i++) {
      target.hp = 1e9;
      sim.hitMonster(p, target, 1);
      without += 1e9 - target.hp;
    }
    ok(withBuff > without * 1.1, `the buff raises damage (${withBuff} vs ${without})`);
  }

  // ---- cooldown: a second dodge right away is a plain MISS
  const since = sim.time;
  for (let i = 0; i < 200 && (p.cd.dash ?? 0) > 0; i++) step();
  ok(sim.time - since < codeDodge().cooldown - 0.5, 'the dash is ready again before the Perfect Dodge cooldown ends');
  step({ move: { x: -1, z: 0 }, dash: true });
  texts();
  hit();
  const t2 = texts();
  ok(p.invulnT > 0 && t2.includes('MISS') && !t2.includes('PERFECT DODGE!'), 'inside the cooldown: only MISS');

  // ---- too late after pressing dash: plain MISS (window shrunk so the dash's own invulnerability outlasts it)
  wait(6);
  applyBalance(checkBalance({ dodge: { window: 0.05 } }, true).tuning!);
  step({ move: { x: 1, z: 0 }, dash: true });
  wait(0.1);
  ok(p.invulnT > 0, 'still invulnerable from the dash');
  texts();
  hit();
  ok(!texts().includes('PERFECT DODGE!'), 'pressed dash longer ago than the window: no Perfect Dodge');
  applyBalance({});

  // ---- bosses: on by default, off by the switch
  const room = new Sim(ZONE_1);
  const q = room.addPlayer({ name: 'B', classId: 'mage', level: 10, exp: 0, gold: 0, equipment: {}, bag: [] });
  const fakeBoss = Object.create(mob, { isBoss: { value: true } }) as typeof mob;
  q.dodgeDashAt = room.time;
  q.invulnT = 0.2;
  room.drainEvents();
  room.hitPlayer(fakeBoss, q, 1, {});
  ok(room.drainEvents().some((e) => e.t === 'text' && (e as { text: string }).text === 'PERFECT DODGE!'), "a boss's hit counts (switch on)");
  applyBalance(checkBalance({ dodge: { boss: false } }, true).tuning!);
  q.dodgeReadyAt = 0;
  q.invulnT = 0.2;
  q.dodgeDashAt = room.time;
  room.hitPlayer(fakeBoss, q, 1, {});
  ok(!room.drainEvents().some((e) => e.t === 'text' && (e as { text: string }).text === 'PERFECT DODGE!'), "boss switch off: a boss's hit doesn't count");

  // ---- switch off: nothing
  applyBalance(checkBalance({ dodge: { on: false } }, true).tuning!);
  q.dodgeReadyAt = 0;
  q.invulnT = 0.2;
  q.dodgeDashAt = room.time;
  room.hitPlayer(mob, q, 1, {});
  ok(!room.drainEvents().some((e) => e.t === 'text' && (e as { text: string }).text === 'PERFECT DODGE!'), 'switch off: never');

  // ---- /admin checks and audit
  ok('error' in checkBalance({ dodge: { window: 0 } }, true), 'window below 0.05 is refused');
  ok('error' in checkBalance({ dodge: { dmgPct: 'x' } }, true), 'a number that is not a number is refused');
  ok('error' in checkBalance({ dodge: { foo: 1 } }, true), 'an unknown key is refused');
  ok(checkBalance({ dodge: { invuln: 0.5 } }, true).tuning?.dodge === undefined, 'a value equal to the code is not saved');
  ok(dodgeChanges(codeDodge(), mergeDodge({ dmgPct: 30 })).some((s) => s.includes('ดาเมจเพิ่ม (%) 20 → 30')), 'changes go to the audit');
  applyBalance({});
  ok(currentBalance().dodge.on, 'back to the code');
} catch (e) {
  ok(false, `threw: ${(e as Error).stack}`);
}
finish('perfect-dodge');
