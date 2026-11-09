// Rules of the hub town (Nexus City) and how the four zones hang off it, on real Sims with no server.
import { ok, finish } from './check';
import { HUB_ID, ZONES, ZONE_HUB, inSafeArea } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { NPC_IDS } from '../src/shared/data/npcs';
import { Sim } from '../src/shared/sim/Sim';
import { AUTO_TOWN_MSG, autoBlocked } from '../src/shared/sim/autoplay';
import { IDLE_INTENT } from '../src/shared/sim/types';

const hero = (level = 40) => ({ name: 'T', classId: 'sword' as const, level, exp: 0, gold: 0, equipment: {}, bag: [] });
const TICK = 1 / 30;
const safe = ZONE_HUB.safe!;
const fields = Object.values(ZONES).filter((z) => z.id !== HUB_ID);

// ---- layout: one portal per hub corner, and each zone's camp on the far side from where you walk in
{
  const hub = new Sim(ZONE_HUB);
  ok(fields.length === 4 && ZONE_HUB.portals.length === 4, 'four zones, four hub portals');
  ok(!ZONE_HUB.boss && ZONE_HUB.allowAutoPlay, 'no boss in the hub; Auto allowed outside town');
  for (const id of NPC_IDS) {
    const n = hub.terrain.npcPos[id];
    ok(!!n && inSafeArea(ZONE_HUB, n.x, n.z), `${id} stands in town`);
  }
  for (const pt of ZONE_HUB.portals) {
    const zone = ZONES[pt.to];
    ok(pt.minLevel === 0, `${pt.to}: no level gate`);
    ok(!hub.terrain.isBlocked(pt.x, pt.z, 0.4) && hub.terrain.distToPath(pt.x, pt.z) < 1, `${pt.to}: hub portal stands free on a road`);
    ok(zone.portals.length === 1 && zone.portals[0].to === HUB_ID, `${zone.id}: one portal, back to the hub`);
    const back = zone.portals[0];
    ok(Math.sign(back.x) === -Math.sign(pt.x) && Math.sign(back.z) === -Math.sign(pt.z), `${zone.id}: its portal is on the opposite side`);
    ok(Math.hypot(back.x - zone.start.x, back.z - zone.start.z) < 9, `${zone.id}: portal beside the camp`);
    const sim = new Sim(zone);
    ok(Object.keys(sim.terrain.npcPos).length === 0, `${zone.id}: no NPCs left at the camp`);
    ok(sim.npcDistance(sim.addPlayer(hero()), 'merchant') === Infinity, `${zone.id}: no merchant to trade with`);
    const arrived = sim.addPlayer(hero(), HUB_ID);
    ok(Math.hypot(arrived.x - back.x, arrived.z - back.z) < 5 && !sim.terrain.isBlocked(arrived.x, arrived.z, 0.3), `${zone.id}: arrives beside the portal`);
    const home = hub.addPlayer(hero(), zone.id);
    ok(Math.hypot(home.x - pt.x, home.z - pt.z) < 5 && !hub.terrain.isBlocked(home.x, home.z, 0.3), `${zone.id}: comes back beside its hub portal`);
    const b = zone.boss!;
    ok(Math.abs(b.x) < sim.terrain.bound && Math.abs(b.z) < sim.terrain.bound, `${zone.id}: boss still on the island`);
    for (const sp of zone.spawns) ok(Math.abs(sp.x) <= sim.terrain.bound && Math.abs(sp.z) <= sim.terrain.bound, `${zone.id}: ${sp.monster} area on the island`);
  }
  const start = hub.addPlayer(hero());
  ok(inSafeArea(ZONE_HUB, start.x, start.z) && !hub.terrain.isBlocked(start.x, start.z, 0.3), 'new arrivals stand in town');
}

// ---- monsters outside town: monster 1 and 2 of each zone, 5 each, alone and spread out
{
  const hub = new Sim(ZONE_HUB);
  ok(ZONE_HUB.spawns.length === 60 && ZONE_HUB.spawns.every((s) => s.count === 1), '60 single monsters');
  for (const zone of fields) {
    const kinds = [...new Set(zone.spawns.map((s) => s.monster))].slice(0, 2);
    const mine = ZONE_HUB.spawns.filter((s) => kinds.includes(s.monster));
    const portal = ZONE_HUB.portals.find((p) => p.to === zone.id)!;
    ok(mine.length === 15 && mine.filter((s) => s.monster === kinds[0]).length === 8 && mine.filter((s) => s.monster === kinds[1]).length === 7, `${zone.id}: 8 ${kinds[0]} and 7 ${kinds[1]}`);
    ok(mine.every((s) => Math.sign(s.x) === Math.sign(portal.x) && Math.sign(s.z) === Math.sign(portal.z)), `${zone.id}: in front of its own portal`);
    const home = zone.monsterBoost;
    ok(mine.every((s) => !home || (s.boost?.stats === home.stats && s.boost?.speed === home.speed && s.boost?.skill === home.skill)), `${zone.id}: as strong as at home`);
    ok(mine.every((s) => !s.boost?.aggro), `${zone.id}: keeps its own temper in town`);
  }
  let closest = Infinity;
  for (const a of ZONE_HUB.spawns) for (const b of ZONE_HUB.spawns) if (a !== b) closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
  ok(closest >= 8, `spread out (closest pair ${closest.toFixed(1)})`);
  ok(ZONE_HUB.spawns.every((s) => Math.hypot(s.x, s.z) >= safe.half * Math.SQRT2 + 3), 'none near town');
  ok(ZONE_HUB.spawns.every((s) => ZONE_HUB.portals.every((p) => Math.hypot(s.x - p.x, s.z - p.z) >= 12)), 'none on top of a portal');
  ok(ZONE_HUB.spawns.every((s) => !hub.terrain.isBlocked(s.x, s.z, 0.6)), 'every spot is open ground');
  ok(hub.monsters.length === 60 && hub.monsters.every((m) => !!MONSTERS[m.def.id]), 'all 60 alive at start');
}

// ---- town is safe: no fighting either way, and monsters can't come in
{
  const hub = new Sim(ZONE_HUB);
  const p = hub.addPlayer(hero());
  const m = hub.monsters[0];
  p.x = safe.x + safe.half - 1;
  p.z = safe.z;
  const hp = m.hp;
  hub.hitMonster(p, m, 5);
  ok(m.hp === hp, 'a player in town deals no damage');
  const php = p.hp;
  hub.hitPlayer(m, p, 5, {});
  ok(p.hp === php, 'a player in town takes no damage');
  m.x = safe.x + safe.half - 1;
  m.z = safe.z + 1;
  m.target = p;
  hub.step(TICK);
  ok(!inSafeArea(ZONE_HUB, m.x, m.z), 'a monster is pushed out of town');
  ok(m.target === null, 'and stops chasing whoever is in town');
  // Swinging in town does nothing; the dash still works.
  const near = hub.monsters[1];
  near.x = p.x + 1.5;
  near.z = p.z;
  const before = near.hp;
  for (let i = 0; i < 30; i++) hub.step(TICK, () => ({ ...IDLE_INTENT, basic: true, aim: { x: near.x, z: near.z } }));
  ok(near.hp === before, 'basic attacks do nothing in town');
  ok(autoBlocked(ZONE_HUB, hub.monsters, p) === AUTO_TOWN_MSG, 'no Auto in town');
  p.x = 45;
  p.z = 0;
  ok(autoBlocked(ZONE_HUB, hub.monsters, p) === null, 'Auto is fine outside town');
}

// ---- dying: out in a zone you wake up in the hub's town; in the hub, in its town
{
  for (const zone of [ZONES.emerald_forest, ZONE_HUB]) {
    const sim = new Sim(zone);
    const p = sim.addPlayer(hero());
    p.alive = false;
    p.hp = 0;
    sim.respawn(p);
    const ev = sim.drainEvents();
    const revived = ev.findIndex((e) => e.t === 'revived');
    const travel = ev.findIndex((e) => e.t === 'travel' && e.to === p.id && e.zone === HUB_ID && e.atCamp === true);
    if (zone.id === HUB_ID) ok(revived >= 0 && travel < 0 && inSafeArea(zone, p.x, p.z), 'hub: revived in town');
    else ok(revived >= 0 && travel > revived, `${zone.id}: revived, then sent to the hub's town`);
  }
}

finish('hub');
