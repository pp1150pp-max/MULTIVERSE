// Channels (server/channels.ts) on real Sims with a fake clock, no server: placement, the 20 / 22 caps,
// opening and closing, reconnecting to the same channel, keeping the CH number between maps, and the
// 10 s out-of-combat rule for switching. The end-to-end wiring is in channels-server.test.ts.
import { finish, ok } from './check';
import { Channels, FightClock, type Channel } from '../server/channels';
import { BOSS_ROOMS, ZONE_1, ZONE_2, ZONE_HUB, ZONES } from '../src/shared/data/zones';
import { CH_PARTY_CAP, CH_RECONNECT_MS, CH_SOLO_CAP, CH_SWITCH_CALM, hasChannels, placeLabel } from '../src/shared/channels';

let n = 0;
const hero = () => ({ name: `P${++n}`, classId: 'sword' as const, level: 10, exp: 0, gold: 0, equipment: {}, bag: [] });
/** Puts `k` more players into a channel. */
const fill = (c: Channel, k: number) => {
  for (let i = 0; i < k; i++) c.sim.addPlayer(hero());
};
/** Empties a channel. */
const empty = (c: Channel) => {
  for (const p of [...c.sim.players]) c.sim.removePlayer(p);
};

// ---------------------------------------------------------------- which maps
{
  ok([ZONE_1, ZONE_2].every(hasChannels) && Object.values(ZONES).filter(hasChannels).length === 4, 'the 4 farm maps have channels');
  ok(!hasChannels(ZONE_HUB), 'the hub does not (yet)');
  ok(Object.values(BOSS_ROOMS).every((r) => !hasChannels(r)), 'boss rooms do not (they have their own rooms)');
  ok(placeLabel(ZONE_1, 2) === 'ป่ามรกต · CH 2' && placeLabel(ZONE_HUB, 1) === ZONE_HUB.nameTh, 'label: "ป่ามรกต · CH 2", the hub just its name');
  ok(CH_SOLO_CAP === 20 && CH_PARTY_CAP === 22 && CH_SWITCH_CALM === 10 && CH_RECONNECT_MS === 60_000, 'owner numbers: 20 / 22 / 10 s / 60 s');
}

// ---------------------------------------------------------------- auto-placement and full at 20
{
  const C = new Channels(Object.values(ZONES), () => 0);
  ok(Object.values(ZONES).every((z) => C.channels(z.id).length === 1 && C.channels(z.id)[0].ch === 1), 'every map starts with CH 1');
  const ch1 = C.get(ZONE_1.id, 1)!;
  ok(C.place(ZONE_1.id) === ch1, 'entering an empty map: CH 1');
  fill(ch1, CH_SOLO_CAP - 1);
  ok(C.place(ZONE_1.id) === ch1, '19 players: still CH 1');
  fill(ch1, 1);
  const ch2 = C.place(ZONE_1.id)!;
  ok(ch2 !== ch1 && ch2.ch === 2 && C.channels(ZONE_1.id).length === 2, 'CH 1 at 20 takes nobody more alone: CH 2 opens');
  ok(C.place(ZONE_1.id) === ch2, 'the next one goes to CH 2 (lowest with room)');
  fill(ch2, 5);
  empty(ch1);
  ok(C.place(ZONE_1.id) === ch1, 'room in CH 1 again: the lowest-numbered channel with room comes first');
  // The hub (no channels) has one copy whatever the count.
  const hub = C.get(ZONE_HUB.id, 1)!;
  fill(hub, 30);
  ok(C.place(ZONE_HUB.id) === hub && C.channels(ZONE_HUB.id).length === 1, 'a map without channels never splits');
  ok(C.place('nowhere') === undefined, 'an unknown zone gives nothing');
  // Auto Play counts like anyone: a channel counts the players in its Sim, Auto or not.
  const auto = C.get(ZONE_2.id, 1)!;
  fill(auto, CH_SOLO_CAP);
  for (const p of auto.sim.players) p.autoOn = true;
  ok(C.place(ZONE_2.id)!.ch === 2, 'players on Auto Play count as full players');
}

// ---------------------------------------------------------------- party up to 22
{
  const C = new Channels([ZONE_1], () => 0);
  const ch1 = C.get(ZONE_1.id, 1)!;
  fill(ch1, CH_SOLO_CAP);
  ok(C.place(ZONE_1.id, { leader: ch1.sim }) === ch1, 'a member follows the leader into a full (20) channel');
  fill(ch1, 1);
  ok(C.place(ZONE_1.id, { leader: ch1.sim }) === ch1, '... and at 21');
  fill(ch1, 1);
  const other = C.place(ZONE_1.id, { leader: ch1.sim })!;
  ok(other !== ch1 && C.count(ch1) === CH_PARTY_CAP, 'at 22 not even a member gets in: placed like anyone');
  ok(C.place(ZONE_1.id) !== ch1, 'someone alone never joins a channel at 20+');
  const elsewhere = new Channels([ZONE_2], () => 0).get(ZONE_2.id, 1)!;
  ok(C.place(ZONE_1.id, { leader: elsewhere.sim }) !== ch1, 'a leader on another map does not count');
  ok(C.capFor(ch1, ch1.sim) === CH_PARTY_CAP && C.capFor(ch1) === CH_SOLO_CAP && C.capFor(ch1, other.sim) === CH_SOLO_CAP, 'switch cap: 22 into the leader\'s channel, else 20');
}

// ---------------------------------------------------------------- channels open and close
{
  const C = new Channels([ZONE_1], () => 0);
  const ch1 = C.get(ZONE_1.id, 1)!;
  fill(ch1, CH_SOLO_CAP);
  const ch2 = C.place(ZONE_1.id)!;
  fill(ch2, CH_SOLO_CAP);
  const ch3 = C.place(ZONE_1.id)!;
  ok(ch3.ch === 3, 'all full again: CH 3 opens');
  fill(ch3, 1);
  ok(C.sweep().length === 0 && C.channels(ZONE_1.id).length === 3, 'channels with players stay');
  empty(ch2);
  const closed = C.sweep();
  ok(closed.length === 1 && closed[0] === ch2 && !C.get(ZONE_1.id, 2) && C.of(ch2.sim) === undefined, 'an empty channel closes');
  ok(C.get(ZONE_1.id, 3) === ch3 && C.count(ch3) === 1, 'nobody is moved to merge (CH 3 keeps its player)');
  ok(C.place(ZONE_1.id) === ch3, 'the next one joins CH 3 (CH 1 full)');
  fill(ch3, CH_SOLO_CAP - C.count(ch3));
  const again = C.place(ZONE_1.id)!;
  ok(again.ch === 2, 'a new channel takes the lowest free number (CH 2 again)');
  fill(again, 1);
  empty(ch1);
  C.sweep();
  ok(C.get(ZONE_1.id, 1) === ch1, 'CH 1 never closes, even empty');
  ok(C.list(ZONE_1.id).map((r) => r.ch).join() === '1,2,3', 'the list is in channel order');
  ok(C.sims().includes(ch3.sim) && !C.sims().includes(ch2.sim), 'closed channels are no longer run');
}

// ---------------------------------------------------------------- same CH number on a map change
{
  const C = new Channels([ZONE_1, ZONE_2, ZONE_HUB], () => 0);
  for (const z of [ZONE_1, ZONE_2]) {
    fill(C.get(z.id, 1)!, CH_SOLO_CAP);
    fill(C.place(z.id)!, 3);
  }
  const f2 = C.get(ZONE_1.id, 2)!;
  ok(C.place(ZONE_2.id, { prefer: 2 })!.ch === 2, 'last in CH 2: the next map puts you in its CH 2 if it has room');
  ok(C.place(ZONE_HUB.id, { prefer: 2 })!.ch === 1, 'the hub has one copy whatever was preferred');
  ok(C.place(ZONE_1.id, { prefer: 3 })!.ch === 2 && C.channels(ZONE_1.id).length === 2, 'a number the map does not have: placed like anyone (no channel opens for it)');
  empty(C.get(ZONE_1.id, 1)!);
  ok(C.place(ZONE_1.id, { prefer: 2 }) === f2, 'the same number comes before a lower one with room');
  fill(f2, CH_SOLO_CAP - C.count(f2));
  ok(C.place(ZONE_1.id, { prefer: 2 })!.ch === 1, 'that channel full (20): the lowest with room instead');
}

// ---------------------------------------------------------------- reconnect within 60 s
{
  let now = 1_000;
  const C = new Channels([ZONE_1], () => now);
  const ch1 = C.get(ZONE_1.id, 1)!;
  fill(ch1, CH_SOLO_CAP);
  const ch2 = C.place(ZONE_1.id)!;
  C.dropped(7, ch2.sim, 12.5, -3);
  ok(C.sweep().length === 0 && C.get(ZONE_1.id, 2) === ch2, 'an empty channel waits while a dropped player may come back');
  now += CH_RECONNECT_MS - 1;
  const back = C.returning(7);
  ok(back?.channel === ch2 && back.x === 12.5 && back.z === -3, 'back within 60 s: same map, same channel, same spot');
  ok(C.returning(7) === undefined, 'used once');

  C.dropped(8, ch2.sim, 1, 1);
  now += CH_RECONNECT_MS;
  ok(C.returning(8) === undefined, 'back after 60 s: the hub as usual');
  ok(C.sweep()[0] === ch2, 'and the empty channel closes once nobody can come back to it');

  const ch2b = C.place(ZONE_1.id)!;
  C.dropped(9, ch2b.sim, 2, 2);
  C.forget(9);
  ok(C.returning(9) === undefined, 'leaving on purpose forgets it');

  C.dropped(10, ch1.sim, 3, 3);
  fill(ch1, CH_PARTY_CAP - C.count(ch1));
  const full = C.returning(10);
  ok(full?.channel === ch2b && full.x === 3, 'old channel at 22: another channel of the same map, same spot');

  C.dropped(11, ch1.sim, 4, 4);
  empty(ch1);
  fill(ch1, CH_SOLO_CAP);
  ok(C.returning(11)?.channel === ch1, 'old channel at 20: still allowed back (up to 22)');
}

// ---------------------------------------------------------------- switching, and 10 s out of combat
{
  const C = new Channels([ZONE_1, ZONE_HUB], () => 0);
  const ch1 = C.get(ZONE_1.id, 1)!;
  fill(ch1, CH_SOLO_CAP);
  const ch2 = C.place(ZONE_1.id)!;
  const hub = C.get(ZONE_HUB.id, 1)!;
  ok(C.switchError(true, ch2, ch1, CH_SOLO_CAP, 0)?.includes('เต็ม'), 'switching into a channel at 20 is refused');
  ok(C.switchError(true, ch2, ch1, CH_PARTY_CAP, 0) === null, 'unless it is the leader\'s (22)');
  ok(C.switchError(true, ch1, ch2, CH_SOLO_CAP, 0) === null, 'a channel with room: allowed');
  ok(C.switchError(true, ch1, ch1, CH_SOLO_CAP, 0)?.includes('อยู่แล้ว'), 'the channel you are in: refused');
  ok(C.switchError(true, ch1, undefined, CH_SOLO_CAP, 0) !== null, 'a channel that does not exist: refused');
  ok(C.switchError(true, hub, hub, CH_SOLO_CAP, 0)?.includes('ไม่มีแชนแนล'), 'a map without channels: refused');
  ok(C.switchError(false, ch1, ch2, CH_SOLO_CAP, 0)?.includes('ตาย'), 'dead: refused');
  ok(C.switchError(true, ch1, ch2, CH_SOLO_CAP, 3.2)?.includes('4 วินาที'), 'still in combat: refused, with the seconds left');

  // FightClock: Sim times of the player, wall-clock ms.
  const f = new FightClock(-99);
  ok(f.calmLeft(0) === 0, 'never fought: may switch at once');
  f.seen(5, 1_000); // hit at Sim time 5
  ok(f.calmLeft(1_000) === CH_SWITCH_CALM, 'just fought: 10 s to wait');
  ok(f.calmLeft(1_000 + 9_999) > 0, '9.999 s later: still blocked');
  f.seen(5, 8_000);
  ok(f.calmLeft(1_000 + 9_999) > 0 && f.calmLeft(11_000) === 0, 'the same hit seen again does not restart it; 10 s later: allowed');
  f.seen(30, 20_000);
  ok(f.calmLeft(25_000) === 5, 'a new hit restarts the 10 s');
  f.moved(-99); // through a portal: a new Player, Sim times start over
  f.seen(-99, 26_000);
  ok(f.calmLeft(26_000) === 4, 'walking to another map does not clear it');
  f.seen(1, 27_000);
  ok(f.calmLeft(27_000) === CH_SWITCH_CALM, 'fighting in the new map counts');
}

finish('channels');
