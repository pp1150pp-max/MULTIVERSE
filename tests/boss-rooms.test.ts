// Boss rooms: the room maps, the key multiplier, the shut portal, and the summoning lobby (server/bossRooms.ts)
// driven through a stand-in for the world (real Sims, a fake clock, no sockets).
import { ok, finish } from './check';
import { BOSS_ROOMS, LAIR_EXIT_RADIUS, ZONES, ZONE_1, ZONE_HUB, arenaRadius, inBossArena, lairExitSpot } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { Sim } from '../src/shared/sim/Sim';
import { Monster } from '../src/shared/sim/Monster';
import { marketSellable } from '../src/shared/sim/market';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { PORTAL_RANGE, ROOM_EXIT_RANGE, SUMMONER_RANGE } from '../src/shared/sim/terrain';
import { BossRooms, type RoomActor } from '../server/bossRooms';
import { ROOM_BOSS_DELAY, ROOM_END_SECONDS, ROOM_INVITE_SECONDS, ROOM_LOBBY_SECONDS, ROOM_WIPE_SECONDS, type RoomLobbyView } from '../src/shared/bossRoom';
import { REVIVES_PER_KEY } from '../src/shared/data/stones';
import type { BossKey } from '../src/shared/types';

const hero = (name: string, level = 40) => ({ ...newCharacterData(name, 'sword'), level });
const TICK = 1 / 30;

// ---------------------------------------------------------------- the maps
let rooms = 0;
for (const field of [ZONES.emerald_forest, ZONES.misty_marsh, ZONES.frost_reach, ZONES.ashen_isle]) {
  const room = BOSS_ROOMS[field.id];
  rooms++;
  const map = new Sim(field);
  ok(!map.monsters.some((m) => m.isBoss), `${field.id}: no boss on the map any more`);
  ok(!!field.lair && map.terrain.summoner === field.lair, `${field.id}: the summoner stands where the boss was`);
  ok(map.terrain.colliders.some((c) => c.x === field.lair!.x && c.z === field.lair!.z), `${field.id}: the summoner is solid`);
  const sim = new Sim(room);
  const boss = sim.monsters.filter((m) => m.isBoss);
  ok(boss.length === 1 && boss[0].def.id === field.lair!.boss, `${room.id}: its boss is there`);
  ok(arenaRadius(room) + 2 <= sim.terrain.bound, `${room.id}: the arena fits in the room`);
  const p = sim.addPlayer(hero('A'));
  ok(!sim.terrain.isBlocked(p.x, p.z, 0.4) && inBossArena(room, p.x * 0.9, p.z * 0.9), `${room.id}: players arrive at the arena's edge`);
  const exit = room.portals[0];
  ok(Math.hypot(p.x - exit.x, p.z - exit.z) > PORTAL_RANGE + 1.5 && Math.abs(exit.x) < sim.terrain.bound, `${room.id}: the exit is behind them, not on them`);
  ok(!room.allowAutoPlay && !ZONES[room.id], `${room.id}: no Auto, and not one of the open maps`);
  const edge = arenaRadius(room);
  ok(!sim.terrain.isBlocked(edge - 1, 0, 0.4) && sim.terrain.isBlocked(edge + 2, 0, 0.4) && sim.terrain.isBlocked(0, edge + 2, 0.4), `${room.id}: nobody walks out of the arena`);
  ok(Math.hypot(exit.x, exit.z) < edge && !sim.terrain.isBlocked(exit.x, exit.z, 0.4), `${room.id}: the portal home stands inside it`);
  ok(sim.returnBlocked(p) !== null && map.returnBlocked(p) === null, `${room.id}: no return scroll in the room`);
}
ok(rooms === 4, 'four boss rooms');

// ---------------------------------------------------------------- keys multiply HP, attack and rewards
{
  const one = new Sim(BOSS_ROOMS.frost_reach).monsters.find((m) => m.isBoss)!;
  const three = new Sim(BOSS_ROOMS.frost_reach, { keys: 3 }).monsters.find((m) => m.isBoss)!;
  ok(three.maxHp === Math.round(MONSTERS.yeti.hp * 4.5 * 0.7 * 3) && Math.abs(three.atk - one.atk * 3) < 1e-6, `×3 keys: HP and attack ×3 (${three.maxHp})`);
  ok(three.defense === one.defense, 'defense stays the same');

  const sim = new Sim(BOSS_ROOMS.frost_reach, { keys: 2 });
  const yeti = sim.monsters.find((m) => m.isBoss)!;
  const p = sim.addPlayer(hero('A', 30));
  p.x = yeti.x + 3;
  p.z = yeti.z;
  p.stats.atk = 1e12;
  const exit = BOSS_ROOMS.frost_reach.portals[0];
  /** Walks onto the portal, then clicks it: whether walking took them, the refusal, and where clicking sends them. */
  const tryExit = (at = 0) => {
    p.x = exit.x + 3;
    p.z = exit.z + 3;
    sim.step(TICK);
    sim.drainEvents();
    p.x = exit.x + at;
    p.z = exit.z;
    sim.step(TICK);
    const walked = sim.drainEvents().some((e) => e.t === 'travel' && e.to === p.id);
    const why = sim.leaveRoom(p);
    const ev = sim.drainEvents().find((e) => e.t === 'travel' && e.to === p.id);
    return { walked, why, to: ev?.t === 'travel' ? ev : undefined };
  };
  const shut = tryExit();
  ok(!shut.walked && !shut.to && shut.why?.includes('ปราบบอส') === true, 'the portal stays shut while the boss lives');
  p.x = yeti.x + 3;
  p.z = yeti.z;
  const [lv0, exp0] = [p.level, p.exp];
  sim.hitMonster(p, yeti, 1);
  const items = sim.loots.filter((l) => l.kind.type === 'item');
  ok(!yeti.alive && sim.cleared, 'the yeti is down');
  ok(items.length === (6 + 1) * 2, `×2 keys: twice the gear (${items.length})`);
  ok(sim.loots.every((l) => l.life === Infinity), 'room drops stay until the room closes');
  ok(p.level > lv0 || p.exp > exp0, 'EXP for the kill');
  for (let i = 0; i < 30 * 5; i++) sim.step(TICK);
  ok(!sim.monsters.some((m) => m.isBoss && m.alive), 'the boss never comes back');
  const far = tryExit(ROOM_EXIT_RANGE + 1);
  ok(!far.to && far.why?.includes('เข้าใกล้') === true, 'clicked from too far: walk closer first');
  const out = tryExit();
  ok(!out.walked, 'walking into the open portal does nothing (it is clicked, owner 2026-11-12)');
  const lairF = ZONES.frost_reach.lair!;
  ok(out.why === null && out.to?.zone === 'frost_reach' && !!out.to.spot &&
    Math.abs(Math.hypot(out.to.spot.x - lairF.x, out.to.spot.z - lairF.z) - LAIR_EXIT_RADIUS) < 1e-6, 'clicked after the kill: out by the summoner of its map');
}

// The countdown: the boss appears ROOM_BOSS_DELAY s after the room opens (owner 2026-11-12).
{
  const sim = new Sim(BOSS_ROOMS.misty_marsh, { bossDelay: ROOM_BOSS_DELAY });
  ok(!sim.monsters.some((m) => m.isBoss) && sim.bossAt === ROOM_BOSS_DELAY, `no boss yet: ${ROOM_BOSS_DELAY} s to go`);
  for (let i = 0; i < Math.round((ROOM_BOSS_DELAY - 0.2) / TICK); i++) sim.step(TICK);
  ok(!sim.monsters.some((m) => m.isBoss), 'still none just before');
  sim.drainEvents();
  for (let i = 0; i < Math.round(0.4 / TICK); i++) sim.step(TICK);
  ok(sim.monsters.filter((m) => m.isBoss).length === 1 && sim.bossAt === null, 'then the witch appears');
  ok(sim.drainEvents().some((e) => e.t === 'banner' && e.text.includes('แม่มดหนอง')), 'with her name across the screen');
}

// Dying in a room and getting up (no feather): out by the summoner, full HP (owner 2026-11-12).
{
  const sim = new Sim(BOSS_ROOMS.misty_marsh);
  const p = sim.addPlayer(hero('Fallen'));
  p.alive = false;
  p.hp = 0;
  sim.respawn(p);
  const ev = sim.drainEvents().find((e) => e.t === 'travel');
  const lairM = ZONES.misty_marsh.lair!;
  ok(p.alive && p.hp === p.maxHp && ev?.t === 'travel' && ev.zone === 'misty_marsh' && !!ev.spot &&
    Math.hypot(ev.spot.x - lairM.x, ev.spot.z - lairM.z) <= LAIR_EXIT_RADIUS + 1e-6, 'gets up by the summoner, HP full');
  const town = new Sim(ZONE_1);
  const q = town.addPlayer(hero('Field'));
  q.alive = false;
  town.respawn(q);
  ok(town.drainEvents().some((e) => e.t === 'travel' && e.zone === ZONE_HUB.id), 'out on a map it is still town');
}

// Minions spread over every player instead of all chasing one.
{
  const sim = new Sim(BOSS_ROOMS.emerald_forest, { keys: 2 });
  const bear = sim.monsters.find((m) => m.isBoss)!;
  const ps = ['A', 'B'].map((n) => {
    const p = sim.addPlayer(hero(n));
    p.x = bear.x + 3;
    p.z = bear.z;
    return p;
  });
  bear.target = ps[0];
  sim.onBossEnrage(bear);
  const wolves = sim.monsters.filter((m) => m.summoned);
  ok(wolves.length === MONSTERS.forest_bear.summon!.count, 'the same number of minions');
  ok(ps.every((p) => wolves.some((w) => w.target === p)), 'each player gets some of them');
  // The same wolf at the same level, as it would be outside a room.
  const plain = new Monster(0, MONSTERS.forest_wolf, wolves[0].level, wolves[0].area, 0, 0, ZONE_1.monsterBoost);
  ok(wolves[0].maxHp === plain.maxHp * 2 && Math.abs(wolves[0].atk - plain.atk * 2) < 1e-6, 'minions are ×keys too');
}

// ---------------------------------------------------------------- the lobby, through a stand-in world
let clock = 1_000_000;
const field = new Sim(ZONE_1);
const hub = new Sim(ZONE_HUB);
const lair = ZONE_1.lair!;
const chars = new Map<number, RoomActor>();
const said: [number, string][] = [];
const invites: { to: number; id: number }[] = [];
const gone: { to: number; id: number }[] = [];
const lobbies = new Map<number, RoomLobbyView | null>();
const parties = new Map<number, number[]>(); // leader → members (leader first)

function add(charId: number, name: string, keys = 0): Player {
  const p = field.addPlayer(hero(name));
  p.x = lair.x + 2;
  p.z = lair.z + 1;
  if (keys) p.addStones('key_bear', keys);
  chars.set(charId, { charId, name, player: p, sim: field });
  return p;
}
function move(a: RoomActor, sim: Sim): void {
  a.sim.removePlayer(a.player);
  const p = sim.addPlayer(a.player.toData());
  a.player = p;
  a.sim = sim;
}
const rooms2 = new BossRooms({
  actor: (id) => chars.get(id),
  party: (id) => {
    for (const [leader, members] of parties) {
      if (members.includes(id)) return { leader, members: members.map((m) => ({ charId: m, name: chars.get(m)?.name ?? '?' })) };
    }
    return undefined;
  },
  tell: (id, t) => said.push([id, t]),
  invite: (to, id) => invites.push({ to, id }),
  inviteGone: (to, id) => gone.push({ to, id }),
  lobby: (id, v) => lobbies.set(id, v),
  enter: (ids, sim) => ids.forEach((id) => move(chars.get(id)!, sim)),
  toLair: (sim, p) => {
    const a = [...chars.values()].find((x) => x.player === p)!;
    const spot = lairExitSpot(sim.zone)!;
    move(a, ZONES[spot.field] === ZONE_1 ? field : hub);
    a.player.x = spot.x;
    a.player.z = spot.z;
    if (!a.player.alive) {
      a.player.alive = true;
      a.player.hp = a.player.maxHp;
    }
  },
  refund: (id, key: BossKey, n) => void chars.get(id)!.player.addStones(key, n),
  save: () => {},
}, () => clock);
const lastSaid = (id: number) => said.filter(([c]) => c === id).at(-1)?.[1] ?? '';

// Refusals.
{
  const p = add(1, 'Solo', 5);
  ok(rooms2.open(1, 11)?.includes('1–10') === true, 'more than 10 keys is refused');
  ok(rooms2.open(1, 6)?.includes('ไม่พอ') === true && p.stoneCount('key_bear') === 5, 'more keys than you have is refused, nothing taken');
  p.x = lair.x + SUMMONER_RANGE + 3;
  ok(rooms2.open(1, 1)?.includes('แท่นเรียกบอส') === true, 'too far from the summoner is refused');
  p.x = lair.x + 2;
}

// Alone: straight in, keys gone, channel 1; a second group gets channel 2.
{
  ok(rooms2.open(1, 3) === null, 'a player on their own opens the room');
  const a = chars.get(1)!;
  const run = rooms2.run(a.sim);
  ok(!!run && run.channel === 1 && run.keys === 3 && a.sim.keys === 3, 'in the room: channel 1, ×3');
  ok(a.player.stoneCount('key_bear') === 2, 'the 3 keys are gone');
  add(2, 'Other', 1);
  rooms2.open(2, 1);
  ok(rooms2.run(chars.get(2)!.sim)?.channel === 2 && chars.get(2)!.sim !== a.sim, 'the next group gets its own copy, channel 2');
  ok(rooms2.snap(a.sim, a.player)?.channel === 1 && rooms2.snap(field, a.player) === undefined, 'snapshots carry the room');
}

// The room ends 90 s after the kill; an emptied room goes away.
{
  const a = chars.get(1)!;
  const sim = a.sim;
  ok((rooms2.snap(sim, a.player)?.bossIn ?? 0) === ROOM_BOSS_DELAY, 'the room opens with the countdown');
  for (let i = 0; i < Math.round((ROOM_BOSS_DELAY + 0.2) / TICK); i++) sim.step(TICK);
  ok(rooms2.snap(sim, a.player)?.bossIn === undefined, 'and it is gone once the boss is up');
  const boss = sim.monsters.find((m) => m.isBoss)!;
  a.player.x = boss.x + 3;
  a.player.z = boss.z;
  a.player.stats.atk = 1e12;
  sim.hitMonster(a.player, boss, 1);
  rooms2.tick();
  ok(rooms2.snap(sim, a.player)?.leaveIn === ROOM_END_SECONDS, `${ROOM_END_SECONDS} s to pick things up`);
  clock += (ROOM_END_SECONDS - 1) * 1000;
  rooms2.tick();
  ok(a.sim === sim, 'still there a second before');
  clock += 1000;
  rooms2.tick();
  const nearLair = (x: RoomActor) => Math.hypot(x.player.x - lair.x, x.player.z - lair.z) <= LAIR_EXIT_RADIUS + 1e-6;
  ok(a.sim === field && nearLair(a), 'then sent out by the summoner');
  rooms2.tick();
  ok(!rooms2.sims().includes(sim), 'the empty room is gone');
}

// Everyone down: a few seconds (ROOM_WIPE_SECONDS) to get up with a phoenix feather, else lost and back to town.
{
  const b = chars.get(2)!;
  const sim = b.sim;
  const me = b.player;
  ok(sim.revivesLeft(me) === REVIVES_PER_KEY * sim.keys, `${REVIVES_PER_KEY} revives per key`);
  me.alive = false;
  me.hp = 0;
  ok(!sim.reviveHere(me) && !me.alive, 'no feather, no getting up');
  rooms2.tick();
  ok(b.sim === sim && (rooms2.snap(sim, me)?.wipeIn ?? 0) > 0, 'everyone down: a few seconds to get up');
  me.addStones('phoenix', 5);
  ok(sim.reviveHere(me) && me.alive && me.hp === Math.round(me.maxHp / 2), 'a feather: up where it fell, half HP');
  ok(me.stoneCount('phoenix') === 4 && sim.revivesLeft(me) === REVIVES_PER_KEY * sim.keys - 1, 'one feather and one revive used');
  rooms2.tick();
  ok(rooms2.snap(sim, me)?.wipeIn === undefined, 'standing again: not lost');
  for (let i = 0; i < 10; i++) {
    me.alive = false;
    sim.reviveHere(me);
  }
  ok(!me.alive && sim.revivesLeft(me) === 0 && me.stoneCount('phoenix') === 5 - REVIVES_PER_KEY * sim.keys, 'no more than the room allows');
  rooms2.tick();
  clock += (ROOM_WIPE_SECONDS - 1) * 1000;
  rooms2.tick();
  ok(b.sim === sim, 'still a moment to go');
  clock += 1000;
  rooms2.tick();
  ok(b.sim === field && Math.hypot(b.player.x - lair.x, b.player.z - lair.z) <= LAIR_EXIT_RADIUS + 1e-6 && b.player.alive && b.player.hp === b.player.maxHp,
    'then the group has lost: out by the summoner, up again with full HP');
}

// A party: invites, answers, the leader starts; only those who said yes go.
{
  const L = add(10, 'Lead', 4);
  add(11, 'Yes');
  add(12, 'No');
  add(13, 'Late');
  parties.set(10, [10, 11, 12, 13]);
  ok(rooms2.open(11, 1)?.includes('หัวตี้') === true, 'only the leader may put keys in');
  ok(rooms2.open(10, 2) === null && L.stoneCount('key_bear') === 2, 'the leader puts 2 in (gone at once)');
  const ids = invites.filter((i) => i.to >= 11).map((i) => i.to);
  ok([11, 12, 13].every((m) => ids.includes(m)) && !ids.includes(10), 'every member is invited');
  const id = invites.at(-1)!.id;
  rooms2.answer(11, id, true);
  rooms2.answer(12, id, false);
  ok(rooms2.start(10)?.includes('รอสมาชิกตอบ') === true && chars.get(10)!.sim === field, 'no start while someone has not answered yet');
  ok(lobbies.get(10)!.answerLeft > 0, 'the leader sees how long they still have');
  ok(lobbies.get(10)?.members.map((m) => m.answer).join() === 'yes,no,wait', 'the leader sees the answers');
  clock += ROOM_INVITE_SECONDS * 1000;
  rooms2.tick();
  ok(lobbies.get(10)?.members.find((m) => m.name === 'Late')?.answer === 'no' && gone.some((g) => g.to === 13), 'no answer in 30 s counts as no');
  rooms2.start(10);
  ok(chars.get(10)!.sim === chars.get(11)!.sim && rooms2.run(chars.get(10)!.sim)?.keys === 2, 'leader and the one who said yes go in together');
  ok(chars.get(12)!.sim === field && chars.get(13)!.sim === field, 'the others stay');
  ok(lobbies.get(10) === null, 'the lobby window closes');
}

// Called off: by the button, by time, or the leader leaving. The keys come back each time.
{
  const L = add(20, 'Lead2', 3);
  add(21, 'Mate2');
  parties.set(20, [20, 21]);
  rooms2.open(20, 3);
  ok(L.stoneCount('key_bear') === 0, 'keys taken');
  rooms2.cancel(20);
  ok(L.stoneCount('key_bear') === 3 && lobbies.get(20) === null, 'cancel: keys back, lobby closed');

  rooms2.open(20, 2);
  clock += ROOM_LOBBY_SECONDS * 1000;
  rooms2.tick();
  ok(L.stoneCount('key_bear') === 3 && lastSaid(20).includes('คืนกุญแจ'), 'not started in time: keys back');

  rooms2.open(20, 1);
  rooms2.gone(20);
  ok(L.stoneCount('key_bear') === 3, 'the leader leaving: keys back');

  rooms2.open(20, 1);
  rooms2.closeAll();
  ok(L.stoneCount('key_bear') === 3, 'server stopping: keys back');
}

// Phoenix feathers at the merchant: 1,000 G, sell back for half, stack to 10, not on the market.
{
  const town = new Sim(ZONE_HUB);
  const buyer = town.addPlayer({ ...hero('Buyer'), gold: 15_000 });
  const m = town.terrain.npcPos.merchant!;
  buyer.x = m.x + 1;
  buyer.z = m.z + 1;
  ok(town.buyPhoenix(buyer, 12) && buyer.stoneCount('phoenix') === 12 && buyer.gold === 3_000, '12 feathers for 12,000 G');
  ok(buyer.bag.filter((e) => e && 'stone' in e && e.stone === 'phoenix').length === 2, 'they stack 10 to a slot');
  ok(!town.buyPhoenix(buyer, 5) && buyer.gold === 3_000, 'not without the gold');
  const i = buyer.bag.findIndex((e) => e && 'stone' in e && e.stone === 'phoenix');
  ok(town.sellItem(buyer, i, 1) === 500, 'sold back for 500 G');
  ok(!marketSellable(buyer.bag[i]), 'not on the market');
  ok(town.revivesLeft(buyer) === 0 && !town.reviveHere(buyer), 'no reviving outside a boss room');
}

finish('boss rooms');
