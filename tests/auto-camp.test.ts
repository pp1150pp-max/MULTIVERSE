// Auto Play fights monsters above the player's level (warning only when 10+ levels above), and the camp's
// runestone stands clear of the portal back to the hub. On real Sims, no server.
import { ok, finish } from './check';
import { ZONE_1, ZONE_2, ZONE_3, ZONE_4, ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { AutoPlay, AUTO_LEVEL_WARN } from '../src/shared/sim/autoplay';
import { IDLE_INTENT } from '../src/shared/sim/types';

const hero = (level: number) => ({ name: 'T', classId: 'gunslinger' as const, level, exp: 0, gold: 0, equipment: {}, bag: [] });

/** A player next to one of the hub's volcano monsters (Lv.31+), Auto just switched on there. */
function autoNextToVolcanoMonster(level: number) {
  const sim = new Sim(ZONE_HUB);
  for (let i = 0; i < 300 && !sim.monsters.some((m) => m.level >= 31); i++) sim.step(0.1);
  const m = sim.monsters.find((x) => x.level >= 31 && !x.isBoss)!;
  const p = sim.addPlayer(hero(level));
  p.x = m.x + 3;
  p.z = m.z;
  const auto = new AutoPlay();
  auto.start(p.x, p.z);
  const it = auto.intent({ player: p, monsters: sim.monsters, loots: sim.loots, time: 1, zone: ZONE_HUB }, IDLE_INTENT);
  return { m, p, it, hint: auto.takeHint() };
}

{
  const { m, p, it, hint } = autoNextToVolcanoMonster(5);
  ok(!!m, 'the hub has volcano monsters');
  ok(!!it.aim, `Lv.${p.level} Auto goes for a Lv.${m.level} monster`);
  ok(!!hint && hint.includes('ระวัง') && hint.includes(`Lv.${m.level}`), `warning shown ${m.level - p.level} levels above: ${hint}`);
}
{
  const { m, p, it, hint } = autoNextToVolcanoMonster(30);
  ok(!!it.aim, `Lv.${p.level} Auto goes for a Lv.${m.level} monster`);
  ok(m.level - p.level < AUTO_LEVEL_WARN && hint === null, 'no warning under 10 levels above');
}

for (const zone of [ZONE_1, ZONE_2, ZONE_3, ZONE_4]) {
  const sim = new Sim(zone);
  const portal = zone.portals.find((p) => p.to === ZONE_HUB.id)!;
  const stones = sim.terrain.props.filter((p) => p.key === 'runestone' && Math.hypot(p.x - zone.start.x, p.z - zone.start.z) < 12);
  const gap = Math.min(...stones.map((s) => Math.hypot(s.x - portal.x, s.z - portal.z)));
  ok(stones.length === 1 && gap > 8, `${zone.id}: camp runestone ${gap.toFixed(1)} from the hub portal`);
}

finish('auto-camp');
