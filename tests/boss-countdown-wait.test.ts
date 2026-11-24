// The boss room's countdown (and a wave run's countdown to wave 1) waits for everyone sent in to load the map, or the
// longest wait (/admin roomLoadWait), whichever comes first (owner 2026-11-24): the number players see starts at the value set.
// Driven through a stand-in for the world (real Sims, a fake clock, no sockets), like tests/boss-rooms.test.ts.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, mergeBalance, CODE_ROOM_LOAD_WAIT } from '../src/shared/balance';
import { BOSS_ROOMS, ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { BossRooms, type RoomActor } from '../server/bossRooms';
import { WaveRooms } from '../server/waveRooms';
import { ROOM_BOSS_DELAY } from '../src/shared/bossRoom';
import { cleanCustomDef, emptyMap, zoneFromCustom } from '../src/shared/customZones';
import { codeWaves } from '../src/shared/waveGame';
import type { BossKey } from '../src/shared/types';

const TICK = 1 / 30;
const hero = (name: string) => ({ ...newCharacterData(name, 'sword'), level: 40 });

// ---------------------------------------------------------------- the setting
ok(CODE_ROOM_LOAD_WAIT === 10 && mergeBalance({}).roomLoadWait === 10, 'code: wait at most 10 s');
ok(JSON.stringify(checkBalance({ roomLoadWait: 10 }, true).tuning) === '{}', 'the code value is not stored');
ok(checkBalance({ roomLoadWait: 0 }, true).tuning?.roomLoadWait === 0, 'a changed value is stored (0 = do not wait)');
ok('error' in checkBalance({ roomLoadWait: -1 }, true) && 'error' in checkBalance({ roomLoadWait: 61 }, true), 'outside 0–60 refused');
ok(balanceChanges({}, { roomLoadWait: 5 }).includes('เวลารอผู้เล่นโหลดสูงสุด 10 → 5 วิ'), 'the audit names the change');

// ---------------------------------------------------------------- the Sim on its own
{
  const sim = new Sim(BOSS_ROOMS.emerald_forest, { bossDelay: 13, hold: true });
  ok(sim.waiting && sim.bossAt === null, 'held: no countdown yet');
  for (let i = 0; i < Math.round(20 / TICK); i++) sim.step(TICK);
  ok(!sim.monsters.some((m) => m.isBoss) && sim.bossAt === null, 'held: no boss even after 20 s');
  sim.startCountdown();
  ok(!sim.waiting && Math.abs(sim.bossAt! - sim.time - 13) < 1e-9, 'started: the full 13 s from now');
  for (let i = 0; i < Math.round(13.2 / TICK); i++) sim.step(TICK);
  ok(sim.monsters.filter((m) => m.isBoss).length === 1 && sim.bossAt === null, 'then the boss appears');
  const now = new Sim(BOSS_ROOMS.emerald_forest, { bossDelay: 0, hold: true });
  ok(!now.waiting && now.monsters.some((m) => m.isBoss), 'countdown 0: the boss is there at once, nothing to wait for');
}

// ---------------------------------------------------------------- boss rooms, through a stand-in world
let clock = 1_000_000;
const field = new Sim(ZONE_1);
const lair = ZONE_1.lair!;
const chars = new Map<number, RoomActor>();
const parties = new Map<number, number[]>();
function add(charId: number, name: string, keys = 0): void {
  const p = field.addPlayer(hero(name));
  p.x = lair.x + 2;
  p.z = lair.z + 1;
  if (keys) p.addStones('key_bear', keys);
  chars.set(charId, { charId, name, player: p, sim: field });
}
function move(a: RoomActor, sim: Sim): void {
  a.sim.removePlayer(a.player);
  a.player = sim.addPlayer(a.player.toData());
  a.sim = sim;
}
const rooms = new BossRooms({
  actor: (id) => chars.get(id),
  party: (id) => {
    for (const [leader, members] of parties) {
      if (members.includes(id)) return { leader, members: members.map((m) => ({ charId: m, name: chars.get(m)?.name ?? '?' })) };
    }
    return undefined;
  },
  tell: () => {},
  invite: () => {},
  inviteGone: () => {},
  lobby: () => {},
  enter: (ids, sim) => ids.forEach((id) => move(chars.get(id)!, sim)),
  toLair: (sim, p) => {
    const a = [...chars.values()].find((x) => x.player === p)!;
    move(a, field);
  },
  refund: (id, key: BossKey, n) => void chars.get(id)!.player.addStones(key, n),
  save: () => {},
}, () => clock);

/** A party of three goes in; returns the room's Sim. */
function partyIn(ids: [number, number, number]): Sim {
  ids.forEach((id, i) => add(id, `P${id}`, i === 0 ? 1 : 0));
  parties.set(ids[0], [...ids]);
  ok(rooms.open(ids[0], 1) === null, 'the leader opens the room');
  for (const id of ids.slice(1)) {
    const lobby = (rooms as unknown as { lobbies: Map<number, { id: number; leader: number }> }).lobbies;
    const l = [...lobby.values()].find((x) => x.leader === ids[0])!;
    rooms.answer(id, l.id, true);
  }
  ok(rooms.start(ids[0]) === null, 'everyone said yes: in they go');
  const sim = chars.get(ids[0])!.sim;
  ok(sim.zone.id === BOSS_ROOMS.emerald_forest.id && ids.every((id) => chars.get(id)!.sim === sim), 'all three in the same room');
  return sim;
}
const wait = (sim: Sim, id: number) => rooms.snap(sim, chars.get(id)!.player)?.bossWait;
const bossIn = (sim: Sim, id: number) => rooms.snap(sim, chars.get(id)!.player)?.bossIn;
function run(sim: Sim, sec: number): void {
  for (let i = 0; i < Math.round(sec / TICK); i++) {
    sim.step(TICK);
    clock += TICK * 1000;
    rooms.tick();
  }
}

// Nobody has loaded: no countdown, however long the Sim runs (short of the longest wait).
{
  const sim = partyIn([1, 2, 3]);
  ok(sim.waiting && sim.bossAt === null && bossIn(sim, 1) === undefined, 'no countdown before anyone has loaded');
  ok(wait(sim, 1)?.ready === 0 && wait(sim, 1)?.total === 3, 'the players see "0/3 loaded"');
  run(sim, 3);
  rooms.loaded(1);
  rooms.loaded(1); // twice changes nothing
  rooms.loaded(99); // someone not in the room: nothing
  ok(sim.waiting && wait(sim, 2)?.ready === 1, 'one loaded: 1/3, still waiting');
  rooms.loaded(2);
  ok(sim.waiting && wait(sim, 3)?.ready === 2, 'two loaded: 2/3');
  rooms.loaded(3);
  ok(!sim.waiting && wait(sim, 1) === undefined, 'everyone loaded: the wait is over');
  ok(bossIn(sim, 1) === ROOM_BOSS_DELAY && Math.ceil(bossIn(sim, 2)!) === ROOM_BOSS_DELAY, `the number starts at the value set (${bossIn(sim, 1)})`);
  run(sim, ROOM_BOSS_DELAY + 0.2);
  ok(sim.monsters.some((m) => m.isBoss) && bossIn(sim, 1) === undefined, 'and the boss comes after the full countdown');
}

// Someone never loads: the server starts the countdown itself after the longest wait (from /admin).
{
  applyBalance({ roomLoadWait: 4 });
  const sim = partyIn([11, 12, 13]);
  applyBalance({});
  rooms.loaded(11);
  rooms.loaded(12);
  run(sim, 3.9);
  ok(sim.waiting && sim.bossAt === null, 'still waiting for the third before the 4 s are up');
  run(sim, 0.2);
  ok(!sim.waiting && Math.ceil(bossIn(sim, 11)!) === ROOM_BOSS_DELAY, 'the 4 s are up: the countdown starts without them, from the top');
}

// Someone leaves (drops, quits) while the others wait: not waited for.
{
  const sim = partyIn([21, 22, 23]);
  rooms.loaded(21);
  rooms.loaded(22);
  const gone = chars.get(23)!;
  sim.removePlayer(gone.player);
  chars.delete(23); // offline: the world has no actor for them
  rooms.tick();
  ok(!sim.waiting && Math.ceil(bossIn(sim, 21)!) === ROOM_BOSS_DELAY, 'the one who dropped is not waited for');
}

// Longest wait 0: the countdown starts as the room opens (the old way).
{
  applyBalance({ roomLoadWait: 0 });
  const sim = partyIn([31, 32, 33]);
  applyBalance({});
  ok(!sim.waiting && sim.bossAt === sim.time + ROOM_BOSS_DELAY, 'wait 0: counting at once');
}

// ---------------------------------------------------------------- wave runs: the same rule
{
  const base = { nameTh: 'ทดสอบ', name: '', floor: 1, levels: [1, 10], safe: false, channels: true, autoPlay: true };
  const c = cleanCustomDef({ ...base, minigame: 'waves', waveMonsters: ['green_slime'] }, 'c_w');
  const map = emptyMap('c_w', 1, 'forest', 40);
  map.waveSpots = [{ x: 10, z: 0, radius: 3 }];
  const zone = zoneFromCustom((c as { def: never }).def, map);
  const where = new Map<number, Sim>();
  const waves = new WaveRooms(() => {}, () => clock, (id) => where.get(id));
  applyBalance({ waves: { countdown: 5 } });
  const { sim } = waves.open(zone, [41, 42], { field: 'nexus_city', x: 0, z: 0 }, null);
  applyBalance({});
  for (const id of [41, 42]) {
    sim.addPlayer(hero(`W${id}`));
    where.set(id, sim);
  }
  const me = sim.players[0];
  ok(sim.waiting && waves.snap(sim, me)?.nextIn === undefined && waves.snap(sim, me)?.wait?.total === 2, 'a wave run waits for its players too');
  waves.tick();
  ok(sim.waiting, 'nobody loaded: still waiting');
  waves.loaded(41);
  ok(sim.waiting && waves.snap(sim, me)?.wait?.ready === 1, 'one of two loaded');
  waves.joined(43, sim); // a party member walking in late is waited for as well
  sim.addPlayer(hero('W43'));
  where.set(43, sim);
  waves.loaded(42);
  ok(sim.waiting && waves.snap(sim, me)?.wait?.total === 3, 'the late one is waited for');
  waves.loaded(43);
  ok(!sim.waiting && waves.snap(sim, me)?.nextIn === 5 && sim.waveRun?.wave === 0, 'everyone loaded: the full 5 s to wave 1');
  ok(codeWaves().countdown === 10, 'the code countdown is unchanged');
}

finish('boss-countdown-wait');
