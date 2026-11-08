// Clicking a drop picks it up even when the loot filter skips its kind (walking over it still doesn't),
// and Auto Play fetches drops anywhere inside its farming circle. On a real Sim, no server.
import { ok, finish } from './check';
import { Sim, LOOT_CLICK_RANGE } from '../src/shared/sim/Sim';
import { Loot } from '../src/shared/sim/Loot';
import { ZONE_1 } from '../src/shared/data/zones';
import { makeItem } from '../src/shared/data/items';
import { AutoPlay } from '../src/shared/sim/autoplay';
import { IDLE_INTENT } from '../src/shared/sim/types';
import { AUTO_PX_PER_UNIT } from '../src/shared/sim/Player';

const hero = () => ({ name: 'T', classId: 'sword' as const, level: 10, exp: 0, gold: 0, equipment: {}, bag: [] });
let ids = 90000;
function drop(sim: Sim, x: number, z: number, owner?: number) {
  const item = makeItem('weapon_1', 'common', 5, 'sword')!;
  const l = new Loot(ids++, x, z, x, z, { type: 'item', item }, { owner, ownerUntil: owner === undefined ? 0 : 1e9 });
  sim.loots.push(l);
  return { l, item };
}
const inBag = (p: { bag: unknown[] }, uid: string) => p.bag.some((b) => !!b && (b as { uid?: string }).uid === uid);

{
  const sim = new Sim(ZONE_1);
  const p = sim.addPlayer(hero());
  sim.setLootFilter(p, { rarities: ['rare', 'epic', 'legendary'], potions: true });
  const { l, item } = drop(sim, p.x + 0.3, p.z);
  for (let i = 0; i < 60; i++) sim.step(1 / 30);
  ok(!l.dead && !inBag(p, item.uid), 'walking over a filtered-out drop leaves it');
  ok(sim.pickupLoot(p, l.id) && l.dead && inBag(p, item.uid), 'clicking it picks it up');

  const far = drop(sim, p.x + LOOT_CLICK_RANGE + 1, p.z);
  ok(!sim.pickupLoot(p, far.l.id) && !far.l.dead, 'too far away: refused');
  ok(!sim.pickupLoot(p, 123456), 'unknown drop: refused');

  const other = sim.addPlayer(hero());
  const theirs = drop(sim, p.x + 0.5, p.z, other.id);
  ok(!sim.pickupLoot(p, theirs.l.id) && !theirs.l.dead, "another player's drop (their pick time): refused");
}

{
  const sim = new Sim(ZONE_1);
  const p = sim.addPlayer(hero());
  p.x = ZONE_1.start.x - 20;
  p.z = ZONE_1.start.z - 20;
  sim.monsters.length = 0;
  p.autoSettings = { ...p.autoSettings, range: 30 * AUTO_PX_PER_UNIT, loot: true };
  sim.setLootFilter(p, { rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'], potions: true });
  const { l } = drop(sim, p.x + 14, p.z);
  const auto = new AutoPlay();
  auto.start(p.x, p.z);
  const it = auto.intent({ player: p, monsters: sim.monsters, loots: sim.loots, time: 5, zone: ZONE_1 }, IDLE_INTENT);
  ok(!!it.moveTo && Math.hypot(it.moveTo.x - l.x, it.moveTo.z - l.z) < 0.01, 'Auto walks to a drop 14 units away inside its circle');
}

finish('loot-click');
