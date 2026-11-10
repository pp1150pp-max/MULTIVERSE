// The Seeker's key quests: take one by him, kill 30 monsters of the boss's map (a hit counts, the hub's
// visitors from that map too), hand it in for a bound key that opens the room at ×1 without being used
// up, stays in the bag, and goes once the boss is killed. Real Sims, no server.
import { ok, finish } from './check';
import { BOSS_ROOMS, ZONES, ZONE_1, ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { marketSellable } from '../src/shared/sim/market';
import { makeOffer } from '../src/shared/trade';
import { BOUND_MSG, QUEST_KILLS } from '../src/shared/data/stones';
import { BossRooms, type RoomActor } from '../server/bossRooms';
import type { Monster } from '../src/shared/sim/Monster';

const hero = (name: string, level: number) => ({ ...newCharacterData(name, 'sword'), level });
const priv = (s: Sim) => s as unknown as { killMonster(m: Monster): void };

const hub = new Sim(ZONE_HUB);
const seeker = hub.terrain.npcPos.seeker!;
const atSeeker = (p: Player) => {
  p.x = seeker.x + 1;
  p.z = seeker.z + 1;
};

// ---- what he offers
const low = hub.addPlayer(hero('Low', 5));
atSeeker(low);
ok(hub.questOffers(low).join() === 'forest_bear', 'Lv.5: only the bear');
const mid = hub.addPlayer(hero('Mid', 25));
atSeeker(mid);
ok(hub.questOffers(mid).join() === 'yeti', `Lv.25 (bear and witch beaten by level): the yeti (${hub.questOffers(mid).join()})`);

// ---- taking it
const p = hub.addPlayer(hero('Quester', 8));
p.x = seeker.x + 20;
ok(!hub.questAccept(p, 'forest_bear'), 'only beside The Seeker');
atSeeker(p);
ok(!hub.questAccept(p, 'yeti'), 'not a quest he offers this player');
ok(hub.questAccept(p, 'forest_bear') && p.quests.forest_bear === 0, 'taken');
ok(!hub.questOffers(p).includes('forest_bear'), 'not offered twice');
ok(!hub.questTurnIn(p, 'forest_bear'), 'nothing to hand in yet');

// ---- killing: a hit counts (not only the last), the hub's forest monsters count, other maps don't
{
  const field = new Sim(ZONE_1);
  const q = field.addPlayer(p.toData());
  q.quests = p.quests;
  const other = field.addPlayer(hero('Other', 8));
  const mobs = field.monsters.filter((m) => !m.isBoss);
  // q hits, someone else lands the kill.
  const m = mobs[0];
  m.damageBy.set(q.id, 1);
  m.damageBy.set(other.id, 999);
  priv(field).killMonster(m);
  ok(q.quests.forest_bear === 1, 'a hit is enough, someone else may finish it');
  const untouched = mobs[1];
  untouched.damageBy.set(other.id, 5);
  priv(field).killMonster(untouched);
  ok(q.quests.forest_bear === 1, 'monsters it never hit do not count');

  const hubMob = hub.monsters.find((x) => ZONE_1.spawns.some((s) => s.monster === x.def.id))!;
  hubMob.damageBy.set(p.id, 3);
  priv(hub).killMonster(hubMob);
  ok(p.quests.forest_bear === 2, 'a forest monster standing in the hub counts');
  const snowMob = hub.monsters.find((x) => ZONES.frost_reach.spawns.some((s) => s.monster === x.def.id))!;
  snowMob.damageBy.set(p.id, 3);
  priv(hub).killMonster(snowMob);
  ok(p.quests.forest_bear === 2, "another map's monster does not");

  for (let i = 0; i < QUEST_KILLS + 5; i++) {
    const x = mobs[(i % (mobs.length - 2)) + 2];
    x.alive = true;
    x.damageBy.set(q.id, 1);
    priv(field).killMonster(x);
  }
  ok(q.quests.forest_bear === QUEST_KILLS, `stops at ${QUEST_KILLS}`);
}

// ---- handing in: a bound key
{
  p.bag = p.bag.map(() => ({ stone: 'enhance' as const, count: 10 }));
  ok(!hub.questTurnIn(p, 'forest_bear') && p.quests.forest_bear === QUEST_KILLS, 'a full bag keeps the quest open');
  p.bag = p.bag.map(() => null);
  ok(hub.questTurnIn(p, 'forest_bear') && p.stoneCount('qkey_bear') === 1, 'handed in: the quest key');
  ok(p.quests.forest_bear === undefined && !hub.questOffers(p).includes('forest_bear'), 'no second quest while holding the key');
  const data = JSON.parse(JSON.stringify(p.toData()));
  ok(hub.addPlayer(data).stoneCount('qkey_bear') === 1, 'the key survives a save');
}

// ---- it stays in the bag
{
  const i = p.bag.findIndex((e) => e && 'stone' in e && e.stone === 'qkey_bear');
  const merchant = hub.terrain.npcPos.merchant!;
  p.x = merchant.x + 1;
  p.z = merchant.z + 1;
  ok(hub.sellItem(p, i) === 0 && p.stoneCount('qkey_bear') === 1, 'not sold');
  ok(!hub.dropFromBag(p, i) && p.stoneCount('qkey_bear') === 1, 'not dropped');
  const keeper = hub.terrain.npcPos.keeper!;
  p.x = keeper.x + 1;
  p.z = keeper.z + 1;
  ok(!hub.stashPut(p, i) && !hub.stashSplit(p, 'bag', i, 'stash', 0, 1) && p.stoneCount('qkey_bear') === 1, 'not into the stash');
  ok(!marketSellable(p.bag[i]) && makeOffer(p.bag, i) === BOUND_MSG, 'not on the market, not in a trade');
  hub.moveInBag(p, i, 20);
  ok((p.bag[20] as { stone?: string } | null)?.stone === 'qkey_bear', 'but it moves around the bag');
}

// ---- it opens the room at ×1 and is not used up; killing the bear takes it away
{
  const field = new Sim(ZONE_1);
  const q = field.addPlayer(p.toData());
  q.x = ZONE_1.lair!.x + 2;
  q.z = ZONE_1.lair!.z;
  const actor: RoomActor = { charId: 1, name: 'Quester', player: q, sim: field };
  const rooms = new BossRooms({
    actor: (id) => (id === 1 ? actor : undefined),
    party: () => undefined,
    tell: () => {},
    invite: () => {},
    inviteGone: () => {},
    lobby: () => {},
    enter: (_ids, sim) => {
      actor.sim.removePlayer(actor.player);
      actor.player = sim.addPlayer(actor.player.toData());
      actor.sim = sim;
    },
    toTown: () => {},
    refund: () => {},
    save: () => {},
  });
  ok(rooms.open(1, 7, true) === null, 'opened with the quest key');
  const room = actor.sim;
  ok(room.zone === BOSS_ROOMS.emerald_forest && room.keys === 1, 'always ×1, whatever was asked');
  const me = actor.player;
  ok(me.stoneCount('qkey_bear') === 1, 'the key is still there');
  const bear = room.monsters.find((m) => m.isBoss)!;
  me.x = bear.x + 2;
  me.z = bear.z;
  me.level = 10;
  me.stats.atk = 1e12;
  room.hitMonster(me, bear, 1);
  ok(!bear.alive && me.bossKills.includes('forest_bear'), 'the bear is beaten');
  ok(me.stoneCount('qkey_bear') === 0, 'and the quest key is gone');
}

finish('boss-quest');
