// Floor 2, map 1: Shipwreck Beach (docs/plans/FLOOR2_PLAN.md 2, 5.1, 6, owner 2026-11-20). The map and its pier, the
// boss room, the Golden Crab Claw key and the navigator's key quest, the Lv50 gate, the four new monster moves (shell,
// steal, chain, thorns), the Giant Cannon Crab's moves, and their /admin numbers. On real Sims, no server.
import { finish, ok } from './check';
import { BOSS_ROOMS, ZONES, ZONE_HARBOR, ZONE_HUB, floorOf, hubOf } from '../src/shared/data/zones';
import { HARBOR_ID } from '../src/shared/data/harbor';
import { MONSTERS } from '../src/shared/data/monsters';
import { BOSS_KEY, BOSS_QUEST_KEY, STONE_DESC, STONE_NAME } from '../src/shared/data/stones';
import { blockingGate } from '../src/shared/data/bossGates';
import { gearMaps } from '../src/shared/gearQuests';
import { applyBalance, balanceChanges, checkBalance, currentBalance, mergeBalance } from '../src/shared/balance';
import { codeMoves, MOVE_PARAMS } from '../src/shared/moveTuning';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import type { Player } from '../src/shared/sim/Player';
import { chainStrike, mv, stealGold } from '../src/shared/sim/beachMoves';
import { IDLE_INTENT } from '../src/shared/sim/types';
import type { ShellHazard } from '../src/shared/sim/cannonCrab';

const TICK = 1 / 30;
const BEACH = ZONES.shipwreck_beach;
const ROOM = BOSS_ROOMS.shipwreck_beach;
const hero = (extra: Record<string, unknown> = {}) => ({ name: 'H', classId: 'sword' as const, level: 48, exp: 0, gold: 0, equipment: {}, bag: [], ...extra });
const run = (sim: Sim, secs: number) => {
  for (let n = 0; n < Math.round(secs / TICK); n++) sim.step(TICK, () => IDLE_INTENT);
};
/** A sturdy player with no defense (damage easy to read), at (x, z). */
function tough(sim: Sim, x: number, z: number, extra: Record<string, unknown> = {}): Player {
  const p = sim.addPlayer(hero(extra));
  p.stats.maxHp = 1e9;
  p.hp = 1e9;
  p.stats.def = 0;
  p.stats.hpRegen = 0;
  p.x = x;
  p.z = z;
  return p;
}
/** A sim of the beach with only one monster of `kind` left, standing at (x, z). */
function alone(kind: string, x = 0, z = 0): { sim: Sim; m: Monster } {
  const sim = new Sim(BEACH);
  const m = sim.monsters.find((q) => q.def.id === kind)!;
  sim.monsters = [m];
  m.x = x;
  m.z = z;
  return { sim, m };
}

// ---- the map, its pier and its room
{
  ok(!!BEACH && floorOf(BEACH) === 2 && hubOf(BEACH).id === HARBOR_ID, 'shipwreck_beach is on floor 2, its town is the harbour');
  ok(BEACH.levels[0] === 41 && BEACH.levels[1] === 50 && BEACH.theme === 'beach', 'Lv41–50, beach theme');
  ok(BEACH.portals.length === 1 && BEACH.portals[0].to === HARBOR_ID, 'one portal, back to the harbour');
  ok(BEACH.lair?.boss === 'cannon_crab' && !!ROOM && ROOM.boss?.monster === 'cannon_crab' && floorOf(ROOM) === 2, 'its summoner opens the crab\'s room, on floor 2');
  const kinds = [...new Set(BEACH.spawns.map((s) => s.monster))];
  ok(kinds.join() === 'hermit_crab,thief_gull,shock_eel,spike_turtle', `four kinds, camp to boss (${kinds.join()})`);
  const sim = new Sim(BEACH);
  ok(sim.monsters.length >= BEACH.spawns.length && sim.monsters.every((m) => m.level >= 41 && m.level <= 49), 'its monsters are Lv41–49');
  ok(sim.terrain.props.some((p) => p.key === 'summoner_crab'), 'the crab summoner stands on the map');
  // The harbour's top pier is open now.
  const harbor = new Sim(ZONE_HARBOR);
  const p = harbor.addPlayer(hero({ unlocks: ['floor2'] }));
  const pier = ZONE_HARBOR.portals.find((pt) => pt.to === BEACH.id)!;
  p.x = pier.x + 6;
  p.z = pier.z;
  run(harbor, 0.1);
  p.x = pier.x;
  p.z = pier.z;
  harbor.drainEvents();
  run(harbor, 0.2);
  ok(harbor.drainEvents().some((e) => e.t === 'travel' && e.zone === BEACH.id), 'the harbour pier takes you to the beach');
}

// ---- key, quest key, gate, gear quests
{
  ok(BOSS_KEY.cannon_crab === 'key_crab' && STONE_NAME.key_crab === 'ก้ามปูทอง', 'its key is the Golden Crab Claw');
  ok(BOSS_QUEST_KEY.cannon_crab === 'qkey_crab' && STONE_DESC.qkey_crab.includes('นักเดินเรือ'), 'its quest key comes from the navigator');
  ok(!!blockingGate(50, []) && !blockingGate(50, ['cannon_crab']), 'the Lv50 gate now blocks until the crab is beaten');
  ok(gearMaps().some((z) => z.id === BEACH.id), 'the beach has gear quests (owner 2026-11-26, tests/gear-quests-f2.test.ts)');
  const harbor = new Sim(ZONE_HARBOR);
  const hub = new Sim(ZONE_HUB);
  ok(harbor.questOffers(harbor.addPlayer(hero({ level: 45 }))).includes('cannon_crab'), 'the navigator offers the crab key quest');
  ok(!hub.questOffers(hub.addPlayer(hero({ level: 45 }))).includes('cannon_crab'), 'The Seeker does not');
}

// ---- hermit crab: hides when hit, takes less damage, strikes back
{
  const { sim, m } = alone('hermit_crab');
  const p = tough(sim, 1.2, 0);
  p.stats.crit = 0;
  const hp0 = m.hp;
  sim.hitMonster(p, m, 1);
  const first = hp0 - m.hp;
  ok(m.hideT > 0 && sim.time < m.guardUntil, 'hit: it hides in its shell');
  const hp1 = m.hp;
  sim.hitMonster(p, m, 1);
  const second = hp1 - m.hp;
  ok(second < first * (1 - mv('shell.cut')) * 1.3 && second > 0, `in its shell it takes about ${Math.round((1 - mv('shell.cut')) * 100)}% (${first} → ${second})`);
  const before = p.hp;
  run(sim, mv('shell.hide') + 0.2);
  ok(m.hideT <= 0 && p.hp < before, 'out again, it strikes back');
}

// ---- thief gull: steals real gold, gives it back when shot down in time
{
  const { sim, m } = alone('thief_gull');
  const p = tough(sim, 1, 0, { gold: 10000 });
  stealGold(sim, m, p);
  const took = Math.min(mv('steal.max'), Math.floor(10000 * mv('steal.share')));
  ok(p.gold === 10000 - took && m.stolen?.gold === took, `it takes ${took} G`);
  stealGold(sim, m, p);
  ok(p.gold === 10000 - took, 'no second theft while it carries gold');
  m.hp = 1;
  sim.hitMonster(p, m, 5);
  ok(!m.alive && p.gold === 10000, 'shot down: the gold comes back');
}
{
  const { sim, m } = alone('thief_gull');
  const p = tough(sim, 1, 0, { gold: 1e7 });
  stealGold(sim, m, p);
  ok(p.gold === 1e7 - mv('steal.max'), 'never more than the most per theft');
  m.stolen!.until = sim.time;
  run(sim, 0.1);
  m.hp = 1;
  sim.hitMonster(p, m, 5);
  ok(!m.stolen && p.gold === 1e7 - mv('steal.max'), 'too late: the gold is gone');
}

// ---- shock eel: the shock jumps from player to player, weaker each time
{
  const { sim, m } = alone('shock_eel');
  const a = tough(sim, 2, 0);
  const b = tough(sim, 2 + mv('chain.jumpRange') - 0.5, 0);
  const c = tough(sim, 2 + 2 * (mv('chain.jumpRange') - 0.5), 0);
  const far = tough(sim, 40, 40);
  m.target = a;
  chainStrike(sim, m, a);
  const lost = [a, b, c].map((q) => 1e9 - q.hp);
  ok(lost.every((n) => n > 0) && far.hp === 1e9, `three linked players hit, the far one not (${lost.map(Math.round).join(' / ')})`);
  ok(lost[1] < lost[0] && lost[2] < lost[1], 'weaker at each jump');
}

// ---- spike turtle: close hits bounce back, no loop with the sword's Thorn Armor
{
  const { sim, m } = alone('spike_turtle');
  const p = tough(sim, 1.2, 0);
  const hp0 = m.hp;
  sim.hitMonster(p, m, 1);
  const dealt = hp0 - m.hp;
  const back = 1e9 - p.hp;
  ok(Math.abs(back - Math.round(dealt * mv('thorns.share'))) <= 1, `a close hit: ${Math.round(mv('thorns.share') * 100)}% back (${dealt} → ${back})`);
  const far = tough(sim, 9, 0);
  sim.hitMonster(far, m, 1);
  ok(far.hp === 1e9, 'from afar: nothing back');
  p.reflect = 0.5;
  p.reflectUntil = sim.time + 10;
  const hp1 = m.hp;
  sim.hitMonster(p, m, 1);
  ok(m.hp < hp1, 'thorns against Thorn Armor ends (no endless bounce)');
}

// ---- the Giant Cannon Crab
{
  ok(MONSTERS.cannon_crab.brain === 'cannon_crab' && MONSTERS.cannon_crab.levels[0] === 50, 'the crab is the Lv50 boss with its own moves');
  const sim = new Sim(ROOM);
  const crab = sim.monsters.find((m) => m.isBoss)!;
  const p = tough(sim, crab.x + 6, crab.z);
  run(sim, 6);
  const shells = () => sim.hazards.filter((h): h is ShellHazard => h.k === 'shell');
  let saw = 0;
  let hurt = false;
  for (let i = 0; i < 400 && !(saw && hurt); i++) {
    // Stand on a ball about to land (and nowhere near the crab's claw), see it hurt.
    const ball = shells().find((h) => h.hit > sim.time);
    if (ball) {
      p.x = ball.x;
      p.z = ball.z;
    }
    const before = p.hp;
    run(sim, 0.1);
    saw = Math.max(saw, shells().length);
    if (ball && p.hp < before) hurt = true;
  }
  ok(saw > 0 && hurt, `cannonballs marked and landing (${saw} at once)`);
}
{
  // The claw: hold, then a fling that stays inside the arena.
  const sim = new Sim(ROOM);
  const crab = sim.monsters.find((m) => m.isBoss)!;
  const p = tough(sim, crab.x + 2.2, crab.z);
  crab.target = p;
  crab.state = 'chase';
  let held = false;
  let maxD = 0;
  // Its picture's events, in order (src/client/paperMoves.ts): grab wind-up, held up, flung.
  const anims: string[] = [];
  for (let i = 0; i < 600; i++) {
    run(sim, 0.05);
    for (const e of sim.drainEvents()) if (e.t === 'anim' && e.id === crab.id && e.name.startsWith('claw')) anims.push(e.name);
    if (p.snareT > 0) held = true;
    maxD = Math.max(maxD, Math.hypot(p.x - crab.x, p.z - crab.z));
    if (held && maxD > 6) break;
    if (!held) {
      p.x = crab.x + 2.2;
      p.z = crab.z;
    }
  }
  ok(held, 'the claw grabs');
  ok(anims.slice(0, 3).join() === 'claw,claw_hold,claw_fling', `and says so for its picture (${anims.slice(0, 3).join()})`);
  ok(maxD > 6, `then flings far (${maxD.toFixed(1)} away)`);
  run(sim, 1);
  ok(Math.hypot(p.x - ROOM.boss!.x, p.z - ROOM.boss!.z) <= (ROOM.arenaRadius ?? 11) + 1.6, 'and never out of the arena');
}
{
  // Low HP: into the shell, barrage over the arena.
  const sim = new Sim(ROOM);
  const crab = sim.monsters.find((m) => m.isBoss)!;
  const p = tough(sim, crab.x + 5, crab.z);
  crab.target = p;
  crab.state = 'chase';
  crab.hp = crab.maxHp * mv('crab.lowHp') * 0.9;
  run(sim, 0.2);
  ok(sim.time < crab.guardUntil && crab.guard === mv('crab.shellCut'), 'low HP: hides in its shell');
  ok(sim.hazards.length >= mv('crab.barrageShells'), `and a barrage falls (${sim.hazards.length} balls)`);
  crab.hp = 0;
  sim.hitMonster(p, crab, 1);
  ok(!crab.alive && sim.hazards.length === 0, 'dead: nothing left on the ground');
}

// ---- /admin numbers
{
  const code = codeMoves();
  ok(Object.keys(code).length === Object.keys(MOVE_PARAMS).length && code['crab.cannonMult'] === 1.5, 'every move number has its code value');
  const b = mergeBalance({});
  b.moves['steal.max'] = 900;
  b.moves['crab.hpMult'] = 2;
  const c = checkBalance(b, true);
  ok('tuning' in c && c.tuning?.moves?.['steal.max'] === 900 && Object.keys(c.tuning?.moves ?? {}).length === 2, 'saved: only what differs');
  ok(balanceChanges({}, { moves: b.moves }).includes('ขโมยได้สูงสุดต่อครั้ง 500 → 900'), 'and in the audit line');
  const bad = mergeBalance({});
  bad.moves['chain.jumps'] = 99;
  ok('error' in checkBalance(bad, true), 'out of range is refused');
  if ('tuning' in c && c.tuning) applyBalance(c.tuning);
  ok(mv('steal.max') === 900 && currentBalance().moves['crab.hpMult'] === 2, 'in use at once');
  const sim = new Sim(ROOM);
  const crab = sim.monsters.find((m) => m.isBoss)!;
  ok(Math.abs(crab.maxHp / (MONSTERS.cannon_crab.hp * 7 * 0.5) - 2) < 0.01, `the crab's HP ×2 from /admin (${crab.maxHp})`);
  applyBalance({});
}

finish('floor2-map1');
