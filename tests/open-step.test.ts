// cosmetics-server's step (tests/open-step.ts) from every place a new character can appear in the hub, not just the random
// one it gets in a run: the character must end up exactly where it was sent.
import { ZONE_HUB } from '../src/shared/data/zones';
import { HUB_SPAWN_RING, Sim } from '../src/shared/sim/Sim';
import { Terrain } from '../src/shared/sim/terrain';
import { finish, ok } from './check';
import { openStep, PLAYER_RADIUS } from './open-step';

const terrain = new Terrain(ZONE_HUB);
const sim = new Sim(ZONE_HUB);
const p = sim.addPlayer({ name: 'A', classId: 'sword', level: 1, exp: 0, gold: 0, equipment: {}, bag: [] });
ok(p.radius === PLAYER_RADIUS, `the helper uses the player's radius (${p.radius})`);

let spawns = 0;
const moved: string[] = [];
for (let deg = 0; deg < 360; deg++) {
  for (let d = HUB_SPAWN_RING[0]; d <= HUB_SPAWN_RING[1] + 1e-9; d += 0.05) {
    const x = ZONE_HUB.start.x + Math.cos((deg * Math.PI) / 180) * d;
    const z = ZONE_HUB.start.z + Math.sin((deg * Math.PI) / 180) * d;
    // The same check as Sim.spawnPoint.
    if (terrain.isBlocked(x, z, 0.5)) continue;
    spawns++;
    const to = openStep(terrain, { x, z }, 3.2);
    const body = { ...to, radius: p.radius };
    terrain.resolve(body);
    if (Math.hypot(body.x - to.x, body.z - to.z) > 1e-9) moved.push(`${x.toFixed(2)},${z.toFixed(2)}`);
  }
}
ok(spawns > 1000, `spawn spots tried (${spawns})`);
ok(!moved.length, `no step is pushed away from where it was sent (${moved.length}: ${moved.slice(0, 5).join(' ')})`);

finish('open-step');
