// Floor 2, map 2: Smugglers' Cove (docs/plans/FLOOR2_PLAN.md 2, 5.2, 6, owner 2026-11-24). The map and its pier, the boss
// room with its gunboats, the Treasure Compass key and the navigator's key quest, the Lv60 gate, the four new monster moves
// (chainball, combo, spread, keg), the Peg-Leg Captain's moves (anchor, parrot + gunboats, shout, crew) and their /admin
// numbers. On real Sims, no server.
import { finish, ok } from './check';
import { BOSS_ROOMS, ZONES, ZONE_HARBOR, ZONE_HUB, floorOf, hubOf } from '../src/shared/data/zones';
import { HARBOR_ID } from '../src/shared/data/harbor';
import { MONSTERS } from '../src/shared/data/monsters';
import { BOSS_KEY, BOSS_QUEST_KEY, STONE_DESC, STONE_NAME } from '../src/shared/data/stones';
import { blockingGate } from '../src/shared/data/bossGates';
import { itemSet } from '../src/shared/data/items';
import { applyBalance, checkBalance, mergeBalance } from '../src/shared/balance';
import { codeMoves, MOVE_PARAMS } from '../src/shared/moveTuning';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import type { Player } from '../src/shared/sim/Player';
import { mv } from '../src/shared/sim/beachMoves';
import { IDLE_INTENT } from '../src/shared/sim/types';

const TICK = 1 / 30;
const COVE = ZONES.smugglers_cove;
const ROOM = BOSS_ROOMS.smugglers_cove;
const hero = (extra: Record<string, unknown> = {}) => ({ name: 'H', classId: 'sword' as const, level: 58, exp: 0, gold: 0, equipment: {}, bag: [], ...extra });
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
  p.stats.crit = 0;
  p.x = x;
  p.z = z;
  return p;
}
/** A sim of the cove with only one monster of `kind` left, standing at (x, z) (its home spot moved there too, so it never walks back). */
function alone(kind: string, x = 0, z = 0): { sim: Sim; m: Monster } {
  const sim = new Sim(COVE);
  const m = sim.monsters.find((q) => q.def.id === kind)!;
  sim.monsters = [m];
  m.x = m.area.x = x;
  m.z = m.area.z = z;
  return { sim, m };
}
/** The boss room with the captain fighting `p`. */
function room(px = 5): { sim: Sim; cap: Monster; p: Player } {
  const sim = new Sim(ROOM);
  const cap = sim.monsters.find((m) => m.isBoss)!;
  const p = tough(sim, cap.x + px, cap.z);
  cap.target = p;
  cap.state = 'chase';
  return { sim, cap, p };
}

// ---- the map, its pier and its room
{
  ok(!!COVE && floorOf(COVE) === 2 && hubOf(COVE).id === HARBOR_ID, 'smugglers_cove is on floor 2, its town is the harbour');
  ok(COVE.levels[0] === 51 && COVE.levels[1] === 60 && COVE.theme === 'cove', 'Lv51–60, cove theme');
  ok(COVE.portals.length === 1 && COVE.portals[0].to === HARBOR_ID, 'one portal, back to the harbour');
  ok(COVE.start.x < 0 && COVE.start.z > 0, 'reached from the right pier: the camp is on the left (like the marsh)');
  ok(COVE.lair?.boss === 'pegleg_captain' && !!ROOM && ROOM.boss?.monster === 'pegleg_captain' && floorOf(ROOM) === 2, 'its summoner opens the captain\'s room, on floor 2');
  const kinds = [...new Set(COVE.spawns.map((s) => s.monster))];
  ok(kinds.join() === 'prisoner,cutlass_pirate,shotgunner,keg_prisoner', `four kinds, camp to boss (${kinds.join()})`);
  const away = (k: string) => {
    const s = COVE.spawns.filter((q) => q.monster === k);
    return s.reduce((n, q) => n + Math.hypot(q.x - COVE.start.x, q.z - COVE.start.z), 0) / s.length;
  };
  const far = kinds.map(away);
  ok(far.every((d, i) => i === 0 || d > far[i - 1]), `each kind farther from the camp than the last (${far.map(Math.round).join(' < ')})`);
  const sim = new Sim(COVE);
  ok(sim.monsters.length >= COVE.spawns.length && sim.monsters.every((m) => m.level >= 51 && m.level <= 59), 'its monsters are Lv51–59');
  ok(sim.terrain.props.some((p) => p.key === 'summoner_captain'), 'the captain\'s summoner stands on the map');
  const rs = new Sim(ROOM);
  ok(rs.terrain.props.filter((p) => p.key === 'room_cove_gunboat').length === 3, 'three gunboats around the room\'s arena');
  ok(rs.terrain.props.every((p) => !/^room_cove_(pillar_0|pillar_1|rune_stone)$/.test(p.key)), 'the room uses the cove\'s own kit pieces');
  // The harbour's right pier is open now, and the cove's portal leads back.
  const harbor = new Sim(ZONE_HARBOR);
  const p = harbor.addPlayer(hero({ unlocks: ['floor2'] }));
  const pier = ZONE_HARBOR.portals.find((pt) => pt.to === COVE.id)!;
  ok(pier.x > 0 && pier.z < 0, 'its pier is the right one (+x, −z)');
  p.x = pier.x + 6;
  p.z = pier.z;
  run(harbor, 0.1);
  p.x = pier.x;
  p.z = pier.z;
  harbor.drainEvents();
  run(harbor, 0.2);
  ok(harbor.drainEvents().some((e) => e.t === 'travel' && e.zone === COVE.id), 'the harbour pier takes you to the cove');
  const cove = new Sim(COVE);
  const q = cove.addPlayer(hero({ unlocks: ['floor2'] }));
  const back = COVE.portals[0];
  q.x = back.x + 6;
  q.z = back.z;
  run(cove, 0.1);
  q.x = back.x;
  q.z = back.z;
  cove.drainEvents();
  run(cove, 0.2);
  ok(cove.drainEvents().some((e) => e.t === 'travel' && e.zone === HARBOR_ID), 'the cove\'s portal takes you back to the harbour');
}

// ---- key, quest key, gate, set drops
{
  ok(BOSS_KEY.pegleg_captain === 'key_captain' && STONE_NAME.key_captain === 'เข็มทิศชี้ขุมทรัพย์', 'its key is the Treasure Compass');
  ok(BOSS_QUEST_KEY.pegleg_captain === 'qkey_captain' && STONE_DESC.qkey_captain.includes('นักเดินเรือ'), 'its quest key comes from the navigator');
  ok(!!blockingGate(60, ['cannon_crab']) && !blockingGate(60, ['cannon_crab', 'pegleg_captain']), 'the Lv60 gate now blocks until the captain is beaten');
  const harbor = new Sim(ZONE_HARBOR);
  const hub = new Sim(ZONE_HUB);
  ok(harbor.questOffers(harbor.addPlayer(hero({ level: 55 }))).includes('pegleg_captain'), 'the navigator offers the captain key quest');
  ok(!hub.questOffers(hub.addPlayer(hero({ level: 55 }))).includes('pegleg_captain'), 'The Seeker does not');
  for (const zone of [COVE, ROOM]) {
    const sim = new Sim(zone, { bossDelay: 0 });
    for (let i = 0; i < 600 && sim.monsters.length < 4; i++) sim.step(0.1);
    const real = sim.monsters.filter((m) => !m.summoned);
    for (let k = 0; k < 60; k++) for (const m of real) (sim as unknown as { dropLoot(m: unknown): void }).dropLoot(m);
    const items = sim.loots.flatMap((l) => (l.kind.type === 'item' ? [l.kind.item] : []));
    ok(items.length > 0 && items.every((it) => itemSet(it) === 'pirate'), `${zone.id}: ${items.length} drops, all pirate pieces`);
  }
}

// ---- ship prisoner: slow on its chain, throws the ball and runs free once hurt enough
{
  const { sim, m } = alone('prisoner');
  const p = tough(sim, 3, 0);
  const slow = mv('chainball.slow');
  ok(!m.freed, 'starts on its chain');
  m.hp = m.maxHp * (mv('chainball.at') + 0.05);
  sim.hitMonster(p, m, 0.01);
  ok(!m.freed, 'not yet above the mark');
  m.hp = m.maxHp * mv('chainball.at');
  sim.hitMonster(p, m, 0.01);
  ok(m.freed && sim.projectiles.length === 1, 'down to the mark: it throws its ball and breaks free');
  // Its speed: a free prisoner runs (free / slow) times faster than a chained one.
  const { sim: s2, m: chained } = alone('prisoner', 0, 0);
  const q = tough(s2, 20, 0);
  chained.target = q;
  chained.state = 'chase';
  chained.aggroT = 10;
  run(s2, 1);
  const chainedRun = chained.x;
  const { sim: s3, m: free } = alone('prisoner', 0, 0);
  const r = tough(s3, 20, 0);
  free.freed = true;
  free.target = r;
  free.state = 'chase';
  free.aggroT = 10;
  run(s3, 1);
  ok(Math.abs(free.x / chainedRun - mv('chainball.free') / slow) < 0.25, `free it runs ×${(free.x / chainedRun).toFixed(2)} as fast (card ${(mv('chainball.free') / slow).toFixed(2)})`);
}

// ---- cutlass pirate: three cuts, the third a lunge
{
  const { sim, m } = alone('cutlass_pirate');
  const p = tough(sim, 1.4, 0);
  m.target = p;
  m.state = 'chase';
  m.aggroT = 10;
  let hits = 0;
  let last = p.hp;
  for (let i = 0; i < 60; i++) {
    run(sim, 1 / 30);
    if (p.hp < last) hits++;
    last = p.hp;
    // Keep the player in reach after the lunge's push.
    p.x = m.x + 1.4;
    p.z = m.z;
  }
  ok(hits >= 3, `three cuts within 2 seconds (${hits})`);
}

// ---- blunderbuss pirate: a fan of pellets
{
  const { sim, m } = alone('shotgunner');
  const p = tough(sim, 5, 0);
  m.target = p;
  m.state = 'chase';
  m.aggroT = 10;
  let most = 0;
  for (let i = 0; i < 90; i++) {
    run(sim, 1 / 30);
    most = Math.max(most, sim.projectiles.length);
  }
  ok(most === mv('spread.pellets'), `one shot, ${most} pellets`);
  ok(p.hp < 1e9, 'and they hit');
}

// ---- powder-keg prisoner: gets up when killed, runs at the nearest player, blows up; rewarded only once
{
  const { sim, m } = alone('keg_prisoner');
  const p = tough(sim, 6, 0);
  const exp0 = p.exp + p.level * 1e9;
  m.hp = 1;
  sim.hitMonster(p, m, 5);
  const exp1 = p.exp + p.level * 1e9;
  ok(!m.alive && exp1 > exp0, 'killed: its EXP is given');
  const runner = sim.monsters.find((q) => q !== m && q.alive && q.def.id === 'keg_prisoner');
  ok(!!runner && runner.summoned && runner.untargetable, 'it gets up as a runner that can\'t be hit');
  run(sim, 0.05);
  ok(!sim.monsters.includes(m), 'no second body left where it fell (owner 2026-11-25: the prisoner itself gets up)');
  const hp0 = runner!.hp;
  sim.hitMonster(p, runner!, 100);
  ok(runner!.hp === hp0, 'hitting the runner does nothing');
  const before = p.hp;
  let blew = false;
  for (let i = 0; i < 300 && !blew; i++) {
    run(sim, 0.05);
    blew = !runner!.alive;
  }
  ok(blew && p.hp < before, 'it runs over and blows up on the player');
  ok(p.exp + p.level * 1e9 === exp1, 'no second reward');
  run(sim, 1.2);
  ok(!sim.monsters.includes(runner!), 'and is gone');
}
{
  // Dashing out of the ring in time: no damage.
  const { sim, m } = alone('keg_prisoner');
  const p = tough(sim, 4, 0);
  m.hp = 1;
  sim.hitMonster(p, m, 5);
  const runner = sim.monsters.find((q) => q !== m && q.alive)!;
  for (let i = 0; i < 200 && (runner.keg?.fuse ?? -1) < 0; i++) run(sim, 1 / 30);
  ok((runner.keg?.fuse ?? -1) > 0, 'next to a player it lights its fuse');
  p.x = runner.x + mv('keg.radius') + 3;
  p.z = runner.z;
  const before = p.hp;
  run(sim, mv('keg.warn') + 0.2);
  ok(!runner.alive && p.hp === before, 'out of the ring before the blast: unhurt');
}

// ---- the Peg-Leg Captain
{
  ok(MONSTERS.pegleg_captain.brain === 'pegleg_captain' && MONSTERS.pegleg_captain.levels[0] === 60, 'the captain is the Lv60 boss with his own moves');
  ok(MONSTERS.pegleg_captain.summon?.monster === 'cutlass_pirate' && MONSTERS.pegleg_captain.summon.count === 3, 'he calls three cutlass pirates');
}
{
  // The parrot: on his shoulder (can't be hit), onto a player, the gunboats shell them.
  const { sim, cap, p } = room(6);
  run(sim, 0.2);
  const brain = cap.captain!;
  const parrot = brain.parrot!;
  ok(!!parrot && parrot.summoned && brain.parrotState === 'shoulder' && parrot.untargetable, 'his parrot sits on his shoulder, out of reach');
  let perched = false;
  let shells = 0;
  let hurt = false;
  for (let i = 0; i < 600 && !(perched && shells && hurt); i++) {
    const before = p.hp;
    run(sim, 0.05);
    // Keep out of his own reach: only the shells may hurt.
    p.x = ROOM.boss!.x + 6;
    p.z = ROOM.boss!.z;
    if (brain.parrotState === 'perch') perched = true;
    shells = Math.max(shells, sim.hazards.length);
    if (sim.hazards.some((h) => h.hit <= sim.time) && p.hp < before) hurt = true;
  }
  ok(perched, 'the parrot flies onto the player');
  ok(shells > 0 && hurt, 'and the gunboats shell where they stand');
  ok(sim.hazards.every((h) => h.k === 'shell'), 'as cannon shells (drawn like the crab\'s)');
}
{
  // Shot down: no death, no reward, gone for a while, then back on his shoulder.
  const { sim, cap, p } = room(6);
  run(sim, 0.2);
  const brain = cap.captain!;
  for (let i = 0; i < 400 && brain.parrotState !== 'perch'; i++) run(sim, 0.05);
  const parrot = brain.parrot!;
  ok(!parrot.untargetable, 'on a player it can be hit');
  const exp0 = p.exp + p.level * 1e9;
  parrot.hp = 1;
  sim.hitMonster(p, parrot, 5);
  run(sim, 0.1);
  ok(brain.parrotState === 'down' && !sim.monsters.includes(parrot), 'shot down: gone');
  ok(p.exp + p.level * 1e9 === exp0 && sim.loots.length === 0, 'no EXP, no loot');
  run(sim, mv('captain.parrotDown') + 3);
  ok(['home', 'shoulder', 'fly', 'perch'].includes(brain.parrotState) && sim.monsters.includes(parrot) && parrot.hp === parrot.maxHp, `back after ${mv('captain.parrotDown')} s, full HP (${brain.parrotState})`);
}
{
  // The anchor: thrown down a line at a far target, who is dragged in front of him. Both held in place until he throws.
  const { sim, cap, p } = room(8);
  const c = ROOM.boss!;
  let winding = false;
  for (let i = 0; i < 300 && !winding; i++) {
    cap.x = c.x;
    cap.z = c.z;
    p.x = c.x + 8;
    p.z = c.z;
    run(sim, 1 / 30);
    winding = cap.windupT <= 0 && Math.hypot(p.x - cap.x, p.z - cap.z) > 7 && (cap.captain as unknown as { anchorT: number }).anchorT > 0;
  }
  let pulled = false;
  for (let i = 0; i < 60 && !pulled; i++) {
    run(sim, 1 / 30);
    pulled = Math.hypot(p.x - cap.x, p.z - cap.z) < 5.5;
  }
  ok(pulled && p.hp < 1e9, 'the anchor hits and drags the target in');
}
{
  // The shout: he runs faster for a while.
  const { sim, cap } = room(5);
  let hasted = false;
  for (let i = 0; i < 400 && !hasted; i++) {
    run(sim, 0.05);
    hasted = cap.hasteT > 0;
  }
  ok(hasted && cap.haste === mv('captain.shoutSpeed'), `his shout makes him faster (+${Math.round(cap.haste * 100)}%)`);
}
{
  // Enraged: three cutlass pirates; dead: the parrot and the shells go.
  const { sim, cap, p } = room(5);
  run(sim, 0.5);
  cap.hp = cap.maxHp * 0.45;
  sim.hitMonster(p, cap, 0.01);
  run(sim, 0.1);
  const crew = sim.monsters.filter((m) => m.summoned && m.def.id === 'cutlass_pirate');
  ok(crew.length === 3, `enraged: ${crew.length} cutlass pirates`);
  const parrot = cap.captain!.parrot!;
  cap.hp = 1;
  sim.hitMonster(p, cap, 5);
  ok(!cap.alive && sim.cleared && !parrot.alive && sim.hazards.length === 0, 'dead: the room is cleared, his parrot and the shells are gone');
}

// ---- /admin numbers
{
  const code = codeMoves();
  ok(Object.keys(code).length === Object.keys(MOVE_PARAMS).length && code['captain.parrotHp'] === 15000 && code['chainball.at'] === 0.8, 'every cove move number has its code value');
  const b = mergeBalance({});
  b.moves['captain.hpMult'] = 2;
  b.moves['captain.anchorCd'] = 5;
  const c = checkBalance(b, true);
  ok('tuning' in c && c.tuning?.moves?.['captain.anchorCd'] === 5 && Object.keys(c.tuning?.moves ?? {}).length === 2, 'saved: only what differs');
  if ('tuning' in c && c.tuning) applyBalance(c.tuning);
  const sim = new Sim(ROOM);
  const cap = sim.monsters.find((m) => m.isBoss)!;
  ok(Math.abs(cap.maxHp / (MONSTERS.pegleg_captain.hp * 7 * 0.5) - 2) < 0.01, `the captain's HP ×2 from /admin (${cap.maxHp})`);
  applyBalance({});
}

finish('floor2-map2');
