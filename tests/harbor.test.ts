// Floor 2's harbour town and the way up to it (docs/plans/FLOOR2_PLAN.md 3, 4.1–4.2, owner 2026-11-19): the plank
// platforms on the water, its NPCs, the shut piers, the way back down, and the navigator in nexus_city who gives the
// quest that opens floor 2 and takes players up. On real Sims, no server.
import { finish, ok } from './check';
import { HUB_ID, ZONES, ZONE_HARBOR, ZONE_HUB, hubOf, inSafeArea, isHub } from '../src/shared/data/zones';
import { HARBOR_ID, HARBOR_PIER, onDeck } from '../src/shared/data/harbor';
import { NPC_IDS, npcLook } from '../src/shared/data/npcs';
import { applyBalance, balanceChanges, checkBalance, currentBalance } from '../src/shared/balance';
import { codeFloorGate, FLOOR2_UNLOCK, navState } from '../src/shared/floorGate';
import { loginHub } from '../src/shared/floors';
import { Sim } from '../src/shared/sim/Sim';
import { IDLE_INTENT } from '../src/shared/sim/types';

const TICK = 1 / 30;
const hero = (extra: Record<string, unknown> = {}) => ({ name: 'H', classId: 'sword' as const, level: 45, exp: 0, gold: 0, equipment: {}, bag: [], ...extra });
const run = (sim: Sim, secs: number) => {
  for (let n = 0; n < Math.round(secs / TICK); n++) sim.step(TICK, () => IDLE_INTENT);
};

// ---- the town
{
  // ZONES holds the harbour with its layout read from harbor_town.json (zoneWithMap): a copy of ZONE_HARBOR, not the same object.
  ok(ZONES[HARBOR_ID]?.id === ZONE_HARBOR.id && isHub(ZONE_HARBOR) && hubOf(ZONE_HARBOR) === ZONES[HARBOR_ID], 'harbor_town is floor 2\'s town');
  ok(!ZONE_HARBOR.allowAutoPlay && ZONE_HARBOR.spawns.length === 0, 'no monsters, no Auto');
  const sim = new Sim(ZONE_HARBOR);
  const t = sim.terrain;
  ok(t.restSpots.length === 1 && t.restSpots[0].kind === 'fountain', 'the ship\'s-wheel fountain to rest at');
  for (const id of NPC_IDS.filter((n) => n !== 'navigator')) {
    const n = t.npcPos[id];
    ok(!!n && inSafeArea(ZONE_HARBOR, n.x, n.z) && !!t.standSpot(n.x, n.z, 0.4, { x: 0, z: 0 }), `${id} stands in town, reachable`);
  }
  ok(!t.npcPos.navigator, 'the harbour\'s quest giver stands in The Seeker\'s place (no separate navigator id)');
  ok(npcLook('merchant', 'harbor').name === 'แม่ค้าเสบียงเรือ' && npcLook('seeker', 'harbor').name === 'นักเดินเรือแห่งมิติ' && npcLook('merchant').name === 'พ่อค้า', 'harbour names, floor 1 unchanged');
  // Water: walking stops at the edge; a spot in the water is no place to stand.
  ok(t.isBlocked(22, 9, 0.4) && !onDeck(22, 9), 'the water between platforms is not walkable');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    let clear = true;
    for (let d = 3; d < HARBOR_PIER; d += 0.5) {
      // Round the fountain and a lamp or two: a small sidestep is fine, the pier itself must run through.
      if (t.isBlocked(sx * d, sz * d, 0.35) && t.isBlocked(sx * d + 1.2, sz * d - 1.2, 0.35) && t.isBlocked(sx * d - 1.2, sz * d + 1.2, 0.35)) clear = false;
    }
    ok(clear, `pier ${sx},${sz}: a way from the plaza to its end`);
  }
  // A walker pushed toward the water stays on the planks.
  const p = sim.addPlayer(hero());
  p.x = 15;
  p.z = 8;
  for (let i = 0; i < 90; i++) p.walkStep(1, 0, 10, TICK, t);
  ok(onDeck(p.x, p.z, -0.3), 'walking off the edge stops at the water');
  for (let i = 0; i < 5; i++) {
    const s = sim.spawnPoint();
    ok(onDeck(s.x, s.z) && !t.isBlocked(s.x, s.z, 0.4), 'spawn by the fountain, on the planks');
  }
}

// ---- piers whose map isn't in the game yet are shut (maps 1–3 are: tests/floor2-map1/2/3.test.ts), the lighthouse gate goes home
{
  const sim = new Sim(ZONE_HARBOR);
  const p = sim.addPlayer(hero({ unlocks: [FLOOR2_UNLOCK] }));
  const shut = ZONE_HARBOR.portals.filter((pt) => pt.soonName && !ZONES[pt.to]);
  const pier = shut[0];
  ok(ZONE_HARBOR.portals.filter((pt) => pt.soonName).length === 4 && shut.length === 1, 'four piers, one of their maps not built yet');
  p.x = pier.x + 6;
  p.z = pier.z;
  run(sim, 0.1);
  p.x = pier.x;
  p.z = pier.z;
  sim.drainEvents();
  run(sim, 0.2);
  let evs = sim.drainEvents();
  ok(!evs.some((e) => e.t === 'travel'), 'a shut pier takes nobody anywhere');
  ok(evs.some((e) => e.t === 'log' && e.msg.includes('ยังไม่เปิด') && e.msg.includes(pier.soonName!)), 'and says it isn\'t open yet');
  const home = ZONE_HARBOR.portals.find((pt) => pt.to === HUB_ID)!;
  p.x = home.x + 6;
  run(sim, 0.1);
  p.x = home.x;
  p.z = home.z;
  sim.drainEvents();
  run(sim, 0.2);
  evs = sim.drainEvents();
  ok(evs.some((e) => e.t === 'travel' && e.zone === HUB_ID), 'the lighthouse gate leads back to nexus_city');
  // Arriving: up by the lighthouse gate; back down beside the navigator.
  const up = sim.addPlayer(hero(), HUB_ID);
  ok(Math.hypot(up.x - home.x, up.z - home.z) < 5 && !sim.terrain.isBlocked(up.x, up.z, 0.3), 'arrives in the harbour beside the gate home');
  const hub = new Sim(ZONE_HUB);
  const down = hub.addPlayer(hero(), HARBOR_ID);
  const nav = hub.terrain.npcPos.navigator!;
  ok(Math.hypot(down.x - nav.x, down.z - nav.z) < 3 && !hub.terrain.isBlocked(down.x, down.z, 0.3), 'comes back down beside the navigator');
}

// ---- the navigator's rules
{
  const b = { floorGateOpen: true, floorGateQuest: true, floorGate: codeFloorGate() };
  const who = (level: number, kills: string[], unlocks: string[] = []) => ({ level, bossKills: kills, unlocks });
  ok(navState(who(39, ['volcano_heart']), b) === 'locked', 'Lv39: not for them');
  ok(navState(who(40, []), b) === 'locked', 'Lv40 without the Volcano Heart: not for them');
  ok(navState(who(40, ['volcano_heart']), b) === 'offer', 'Lv40 + the Volcano Heart: the quest');
  ok(navState(who(45, ['volcano_heart'], [FLOOR2_UNLOCK]), b) === 'go', 'quest done: he takes them up');
  ok(navState(who(45, ['volcano_heart'], [FLOOR2_UNLOCK]), { ...b, floorGateOpen: false }) === 'closed', 'way shut: closed');
  ok(navState(who(40, []), { ...b, floorGateQuest: false }) === 'go', 'quest switch off: the level is enough');
  ok(navState(who(30, []), { ...b, floorGateQuest: false }) === 'locked', 'quest switch off: still needs the level');
  ok(navState(who(35, []), { ...b, floorGate: { ...b.floorGate, minLevel: 35, needBoss: false } }) === 'offer', '/admin level and boss switch count');
}

// ---- shut in the code (owner 2026-11-24): the navigator neither offers the quest nor takes anyone up
{
  const sim = new Sim(ZONE_HUB);
  const nav = sim.terrain.npcPos.navigator!;
  const p = sim.addPlayer(hero({ level: 45, bossKills: ['volcano_heart'], unlocks: [FLOOR2_UNLOCK] }));
  p.x = nav.x + 1;
  p.z = nav.z + 1;
  ok(navState(p, currentBalance()) === 'closed' && !sim.floorTravel(p), 'code default: the way up is shut, even with the quest done');
  const q = sim.addPlayer(hero({ level: 45, bossKills: ['volcano_heart'] }));
  q.x = nav.x + 1;
  q.z = nav.z + 1;
  ok(navState(q, currentBalance()) === 'closed' && !sim.floorTurnIn(q), 'code default: the quest cannot be taken or handed in');
}

// ---- the quest and the trip, in nexus_city (the way opened in /admin)
{
  applyBalance({ floorGateOpen: true });
  const sim = new Sim(ZONE_HUB);
  const nav = sim.terrain.npcPos.navigator!;
  ok(!!nav && inSafeArea(ZONE_HUB, nav.x, nav.z), 'the navigator stands in nexus_city');
  ok(!sim.terrain.colliders.some((c) => c.x === nav.x && c.z === nav.z), 'no invisible wall where he stands');
  const p = sim.addPlayer(hero({ level: 40, bossKills: ['forest_bear', 'bog_witch', 'yeti', 'volcano_heart'] }));
  p.x = 8;
  p.z = 8;
  ok(!sim.floorTurnIn(p) && !sim.floorTravel(p), 'from afar: nothing');
  p.x = nav.x + 1;
  p.z = nav.z + 1;
  ok(!sim.floorTravel(p), 'no trip before the quest');
  sim.drainEvents();
  const got = sim.floorTurnIn(p);
  ok(!!got && p.unlocks.includes(FLOOR2_UNLOCK), 'handing it in opens the way');
  ok(!!got && got.reward.items.length === 2 && got.reward.items.every((it) => it.kind === 'stone' && it.bound), 'reward: the two scrolls, bound');
  ok(!sim.floorTurnIn(p), 'only once');
  got!.undo();
  ok(!p.unlocks.includes(FLOOR2_UNLOCK), 'undo (mail failed) takes it back');
  sim.floorTurnIn(p);
  sim.drainEvents();
  ok(sim.floorTravel(p), 'then he takes them up');
  ok(sim.drainEvents().some((e) => e.t === 'travel' && e.zone === HARBOR_ID), 'to the harbour');
  ok(loginHub({ zone: HARBOR_ID, unlocks: [FLOOR2_UNLOCK] }).id === HARBOR_ID, 'logging in on floor 2 lands in the harbour');
  const low = sim.addPlayer(hero({ level: 40, bossKills: ['forest_bear'] }));
  low.x = nav.x + 1;
  low.z = nav.z + 1;
  ok(!sim.floorTurnIn(low) && !sim.floorTravel(low), 'without the Volcano Heart: nothing');
  applyBalance({});
}

// ---- each floor's quest giver has his own floor's quests
{
  const harbor = new Sim(ZONE_HARBOR);
  const p = harbor.addPlayer(hero({ level: 30 }));
  ok(harbor.questOffers(p).length === 0, 'the harbour\'s navigator offers no floor-1 boss quest');
  const hub = new Sim(ZONE_HUB);
  ok(hub.questOffers(hub.addPlayer(hero({ level: 30 }))).length > 0, 'The Seeker still does');
}

// ---- /admin: the floor-2 card's values
{
  ok(currentBalance().floorGate.minLevel === 40 && currentBalance().floorGate.needBoss, 'code: Lv40 and the Volcano Heart');
  const c = checkBalance({ floorGate: { minLevel: 42, needBoss: true, reward: codeFloorGate().reward } }, true);
  ok(!c.error && c.tuning?.floorGate?.minLevel === 42 && c.tuning.floorGate.needBoss === undefined && !c.tuning.floorGate.reward, 'only what differs is kept');
  ok(!!checkBalance({ floorGate: { minLevel: 0 } }, true).error && !!checkBalance({ floorGate: { reward: { gold: -1, items: [] } } }, true).error, 'bad values refused');
  ok(balanceChanges({}, { floorGate: { minLevel: 42 } }).includes('เลเวลขั้นต่ำเควสขึ้นชั้น 2'), 'audit line');
  applyBalance({ floorGate: { minLevel: 42 } });
  const sim = new Sim(ZONE_HUB);
  const nav = sim.terrain.npcPos.navigator!;
  const p = sim.addPlayer(hero({ level: 41, bossKills: ['volcano_heart'] }));
  p.x = nav.x + 1;
  p.z = nav.z + 1;
  ok(!sim.floorTurnIn(p), 'the level set in /admin holds on the server');
  applyBalance({});
}

finish('harbor');
