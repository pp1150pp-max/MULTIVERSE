// Return scroll (owner 2026-11-10): bought at the merchant for 500 G, 10 per slot, a 3 s cast that a hit,
// walking or attacking cancels (the scroll is kept), then back to the hub's town square.
import { finish, ok } from './check';
import { HUB_ID, ZONES, ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import { RETURN_CAST, RETURN_SCROLL_PRICE, stoneSellPrice, stoneStackValue } from '../src/shared/data/stones';
import { marketKind } from '../src/shared/sim/market';

const hero = (gold = 0) => ({ name: 'R', classId: 'sword' as const, level: 15, exp: 0, gold, equipment: {}, bag: [] });
const TICK = 1 / 30;
const run = (sim: Sim, secs: number, it: (n: number) => Intent = () => IDLE_INTENT) => {
  for (let n = 0; n < Math.round(secs / TICK); n++) sim.step(TICK, () => it(n));
};
const recall: Intent = { ...IDLE_INTENT, recall: true };

// ---- prices and the market tab
ok(stoneSellPrice('return_scroll') === RETURN_SCROLL_PRICE / 2, 'sells back for half (250 G)');
ok(stoneStackValue({ stone: 'return_scroll', count: 3 }) === 750, 'a stack of 3 sells for 750 G');
ok(stoneSellPrice('enhance') === 1000, 'stones still sell for 1,000 G');
ok(marketKind({ stone: 'return_scroll', count: 1 }) === 'consumable', 'listed under ของใช้');

// ---- buying at the merchant
{
  const sim = new Sim(ZONE_HUB);
  const p = sim.addPlayer(hero(RETURN_SCROLL_PRICE * 12));
  const m = sim.terrain.npcPos.merchant!;
  ok(!sim.buyReturnScroll(p, 1) || sim.near(p, 'merchant'), 'needs to stand at the merchant');
  p.x = m.x + 1;
  p.z = m.z;
  ok(sim.buyReturnScroll(p, 11), 'buys 11');
  ok(p.stoneCount('return_scroll') === 11 && p.gold === RETURN_SCROLL_PRICE, `11 scrolls, 500 G left (${p.gold})`);
  ok(p.bag.filter((e) => e && 'stone' in e).length === 2, 'two slots: 10 + 1');
  ok(!sim.buyReturnScroll(p, 2), 'not enough gold for 2');
}

// ---- out in a zone: cast, then travel to the hub's town square
const fieldSim = () => {
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer(hero());
  p.addStones('return_scroll', 2);
  const mob = sim.monsters.find((m) => !m.isBoss)!;
  // Stand where monsters can hit (outside the camp's safe area).
  p.x = mob.x + 0.5;
  p.z = mob.z;
  for (const m of sim.monsters) m.x = m.z = 9999;
  sim.drainEvents();
  return { sim, p, mob };
};
{
  const { sim, p } = fieldSim();
  sim.step(TICK, () => recall);
  ok(p.castT > 0, 'casting started');
  run(sim, RETURN_CAST - 0.2);
  ok(p.castT > 0 && p.stoneCount('return_scroll') === 2, 'still casting, scroll not used yet');
  run(sim, 0.4);
  const ev = sim.drainEvents().find((e) => e.t === 'travel');
  ok(!!ev && ev.t === 'travel' && ev.zone === HUB_ID && ev.atCamp === true, 'travels to the hub town square');
  ok(p.stoneCount('return_scroll') === 1, 'one scroll used');
}
// ---- a hit cancels and keeps the scroll
{
  const { sim, p, mob } = fieldSim();
  sim.step(TICK, () => recall);
  run(sim, 1);
  sim.hitPlayer(mob, p, 0.01, {});
  ok(p.castT === 0, 'hit cancels the cast');
  run(sim, RETURN_CAST);
  ok(!sim.drainEvents().some((e) => e.t === 'travel') && p.stoneCount('return_scroll') === 2, 'no travel, scroll kept');
}
// ---- walking and attacking cancel
{
  const { sim, p } = fieldSim();
  sim.step(TICK, () => recall);
  run(sim, 0.5, () => ({ ...IDLE_INTENT, move: { x: 1, z: 0 } }));
  ok(p.castT === 0 && p.stoneCount('return_scroll') === 2, 'walking cancels, scroll kept');
  sim.step(TICK, () => recall);
  sim.step(TICK, () => ({ ...IDLE_INTENT, basic: true }));
  ok(p.castT === 0, 'attacking cancels');
}
// ---- no scroll, no cast; the boss-room hook can block it
{
  const { sim, p } = fieldSim();
  p.takeStones('return_scroll', 2);
  sim.step(TICK, () => recall);
  ok(p.castT === 0, 'no scroll: nothing happens');
  p.addStones('return_scroll', 1);
  sim.returnBlocked = () => 'ใช้ในห้องบอสไม่ได้';
  sim.step(TICK, () => recall);
  ok(p.castT === 0, 'returnBlocked stops the cast');
}
// ---- the scroll leaves the bag mid-cast: no warp
{
  const { sim, p } = fieldSim();
  sim.step(TICK, () => recall);
  p.takeStones('return_scroll', 2);
  run(sim, RETURN_CAST + 0.2);
  ok(!sim.drainEvents().some((e) => e.t === 'travel'), 'sold during the cast: no travel');
}
// ---- already in the hub: warped to the spawn point
{
  const sim = new Sim(ZONE_HUB);
  const p = sim.addPlayer(hero());
  p.addStones('return_scroll', 1);
  p.x += 40;
  const far = { x: p.x, z: p.z };
  sim.drainEvents();
  sim.step(TICK, () => recall);
  run(sim, RETURN_CAST + 0.2);
  const evs = sim.drainEvents();
  ok(evs.some((e) => e.t === 'warped' && e.id === p.id) && !evs.some((e) => e.t === 'travel'), 'warped, not travelled');
  ok(Math.hypot(p.x - far.x, p.z - far.z) > 10 && p.stoneCount('return_scroll') === 0, 'moved to the town square, scroll used');
}

finish('return-scroll');
