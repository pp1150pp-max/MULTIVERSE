// Owner 2026-11-20: Auto with only Flame Wave (cone 6 m) still cast it whether it hit or not. Cause: the reach check's
// margin was added to the reach, so Auto cast with the monster up to 0.5 m beyond the cone. This runs AutoPlay on a
// real Sim (as the server does: intent inside Sim.step) with a monster held at a fixed distance (one that keeps its
// distance, or was knocked back) and counts casts against Flame Wave hits. No server.
import { ok, finish } from './check';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import { AutoPlay } from '../src/shared/sim/autoplay';
import { cleanAutoSettings, DEFAULT_AUTO_SETTINGS } from '../src/shared/sim/Player';
import { IDLE_INTENT } from '../src/shared/sim/types';

/** Casts and Flame Wave hits on the held monster in 3 s, the mage `gap` metres (centre) from it. */
function run(gap: number): { casts: number; hits: number; radius: number } {
  const sim = new Sim(ZONE_1);
  for (let i = 0; i < 300 && !sim.monsters.some((m) => m.alive && !m.isBoss); i++) sim.step(0.1);
  const mob = sim.monsters.find((m) => m.alive && !m.isBoss)!;
  sim.monsters = [mob];
  const p = sim.addPlayer({ name: 'M', classId: 'mage', level: 40, exp: 0, gold: 0, equipment: {}, bag: [], skills: { ranks: { mg_flamewave: 1 }, worn: { q: 'mg_flamewave' } } as never });
  p.autoSettings = cleanAutoSettings({ ...DEFAULT_AUTO_SETTINGS, skills: { q: true, e: false, r: false } });
  const auto = new AutoPlay();
  let casts = 0;
  let hits = 0;
  const hit = sim.hitMonster.bind(sim);
  sim.hitMonster = (pl, m, mult, o) => {
    if (o?.skill?.id === 'mg_flamewave' && m === mob) hits++;
    hit(pl, m, mult, o);
  };
  const hold = (m: Monster) => {
    m.hp = m.maxHp;
    m.x = p.x + gap;
    m.z = p.z;
  };
  for (let i = 0; i < 60; i++) {
    p.mp = 9999;
    p.cd = {};
    hold(mob);
    if (i === 0) auto.start(p.x, p.z);
    sim.step(0.05, (pl) => {
      if (pl !== p) return IDLE_INTENT;
      hold(mob);
      const it = auto.intent({ player: p, monsters: sim.monsters, loots: [], time: sim.time, zone: ZONE_1 }, IDLE_INTENT);
      if (it.skills.includes('q')) casts++;
      return it;
    });
  }
  return { casts, hits, radius: mob.radius };
}

let whiffs = 0;
for (const gap of [3, 4, 5, 5.5, 6, 6.2, 6.4, 6.6, 6.8, 7, 7.5, 8, 8.4]) {
  const r = run(gap);
  console.log(`  gap ${gap} m (edge ${(gap - r.radius).toFixed(2)}): ${r.casts} casts, ${r.hits} hits`);
  whiffs += r.casts - r.hits;
  if (gap - r.radius <= 5) ok(r.casts > 0 && r.hits === r.casts, `monster well inside the cone (${gap} m): cast and hit every time`);
  if (gap - r.radius > 6) ok(r.casts === 0, `monster outside the cone (${gap} m): never cast`);
}
ok(whiffs === 0, `no Flame Wave cast that misses (${whiffs})`);

finish('auto-flamewave-runtime');
