// Resting at the hub's fountain and the zone camps' campfires: HP/MP full, a shared 30 s cooldown.
import { ok, finish } from './check';
import { ZONES, ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { REST_CD, REST_RANGE } from '../src/shared/sim/terrain';

const hero = () => ({ name: 'T', classId: 'sword' as const, level: 30, exp: 0, gold: 0, equipment: {}, bag: [] });
const TICK = 1 / 30;

// ---- every zone has exactly one spot: the fountain in the hub, a campfire elsewhere
for (const zone of Object.values(ZONES)) {
  const sim = new Sim(zone);
  const spots = sim.terrain.restSpots;
  ok(spots.length === 1 && spots[0].kind === (zone === ZONE_HUB ? 'fountain' : 'campfire'), `${zone.id}: one ${spots[0]?.kind}`);
  const r = spots[0];
  // Somewhere to stand next to it.
  let free = false;
  for (let a = 0; a < Math.PI * 2 && !free; a += 0.3) {
    const d = REST_RANGE[r.kind] - 0.4;
    free = !sim.terrain.isBlocked(r.x + Math.cos(a) * d, r.z + Math.sin(a) * d, 0.4);
  }
  ok(free, `${zone.id}: room to stand by it`);
  if (zone !== ZONE_HUB) {
    // The campfire is off the way in: not between the portal and where the path heads into the zone.
    const back = zone.portals[0];
    const arrived = sim.addPlayer(hero(), ZONE_HUB.id);
    ok(sim.terrain.distToPath(r.x, r.z) > 2.5, `${zone.id}: campfire beside the path`);
    ok(Math.hypot(arrived.x - r.x, arrived.z - r.z) > 2 && Math.hypot(back.x - r.x, back.z - r.z) > 4, `${zone.id}: not where you come in`);
  }
}

// ---- resting
{
  const sim = new Sim(ZONE_HUB);
  const r = sim.terrain.restSpots[0];
  const p = sim.addPlayer(hero());
  p.x = r.x + 3;
  p.z = r.z + 3;
  ok(Math.hypot(p.x - r.x, p.z - r.z) <= REST_RANGE.fountain, 'new arrivals can use the fountain');
  p.hp = 1;
  p.mp = 0;
  ok(sim.rest(p) && p.hp === p.maxHp && p.mp === p.stats.maxMp, 'HP and MP full');
  ok(Math.abs(p.restCd - REST_CD) < 1e-9, 'cooldown starts');
  p.hp = 1;
  ok(!sim.rest(p) && p.hp === 1, 'not again during the cooldown');
  for (let i = 0; i < (REST_CD + 0.2) / TICK; i++) sim.step(TICK);
  ok(p.restCd <= 0 && sim.rest(p) && p.hp === p.maxHp, 'works again after 30 s');
  p.restCd = 0;
  p.x = r.x + 10;
  ok(!sim.rest(p), 'not from too far away');
  p.x = r.x + 3;
  p.alive = false;
  ok(!sim.rest(p), 'not while dead');
}

// ---- one cooldown for all spots, kept when changing zone
{
  const forest = new Sim(ZONES.emerald_forest);
  const fire = forest.terrain.restSpots[0];
  const p = forest.addPlayer(hero());
  p.x = fire.x + 1.5;
  p.z = fire.z;
  ok(forest.rest(p), 'campfire works');
  const hub = new Sim(ZONE_HUB);
  const q = hub.addPlayer({ ...p.toData() });
  q.restCd = p.restCd; // the server copies it across like the potion cooldown
  q.hp = 1;
  ok(!hub.rest(q), 'the fountain waits for the same cooldown');
}

finish('rest');
