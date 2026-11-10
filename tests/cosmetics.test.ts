// Cosmetics (owner 2026-11-10): 5 kinds × 5 pieces, looks only; worn per character, saved in CharacterData.
// The mount: +30% walking speed, thrown off by a hit dealt or taken, back on (Z) only 3 s after the last
// fight, never in a boss room. (Owning and the server's checks: tests/cosmetics-server.test.ts.)
import { finish, ok } from './check';
import { BOSS_ROOMS, ZONES } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import {
  cleanCosOwned, cleanCosWorn, COSMETICS, COS_SLOTS, cosCodes, cosFromCodes, MOUNT_CALM, MOUNT_SPEED,
} from '../src/shared/data/cosmetics';

const hero = () => ({ name: 'C', classId: 'sword' as const, level: 15, exp: 0, gold: 0, equipment: {}, bag: [] });
const TICK = 1 / 30;
const run = (sim: Sim, secs: number) => {
  for (let n = 0; n < Math.round(secs / TICK); n++) sim.step(TICK);
};

// ---- catalogue
ok(COSMETICS.length === 25, `25 cosmetics (${COSMETICS.length})`);
for (const slot of COS_SLOTS) ok(COSMETICS.filter((c) => c.slot === slot).length === 5, `5 × ${slot}`);
ok(new Set(COSMETICS.map((c) => c.id)).size === 25 && new Set(COSMETICS.map((c) => c.code)).size === 25, 'ids and codes unique');
ok(COSMETICS.filter((c) => c.slot === 'title').every((c) => !!c.title), 'every title set has its title text');

// ---- worn: cleaning and snapshot codes
const worn = cleanCosWorn({ wings: 'wings_angel', mount: 'pet_cat', pet: 'pet_cat', aura: 'nope', title: 'title_gold', extra: 'x' });
ok(JSON.stringify(worn) === JSON.stringify({ wings: 'wings_angel', pet: 'pet_cat', title: 'title_gold' }), `wrong slot / unknown dropped (${JSON.stringify(worn)})`);
ok(JSON.stringify(cosFromCodes(cosCodes(worn))) === JSON.stringify(worn), 'codes round trip');
ok(JSON.stringify(cosFromCodes([999, 'x', cosCodes(worn)[0], cosCodes(worn)[0]])) === JSON.stringify({ wings: 'wings_angel' }), 'bad and doubled codes dropped');
ok(JSON.stringify(cleanCosOwned(['pet_cat', 'wings_angel', 'pet_cat', 'nope', 3])) === JSON.stringify(['wings_angel', 'pet_cat']), 'owned list cleaned, catalogue order');
ok(JSON.stringify(cleanCosWorn(undefined)) === '{}', 'old saves: nothing worn');

// ---- saved with the character
{
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer({ ...hero(), cosmetics: { wings: 'wings_mech', pet: 'pet_bot' } });
  ok(p.cosmetics.wings === 'wings_mech' && p.cosmetics.pet === 'pet_bot', 'loaded from CharacterData');
  ok(p.toData().cosmetics?.pet === 'pet_bot', 'saved in toData');
  ok(p.stats.atk === sim.addPlayer(hero()).stats.atk, 'no stats from cosmetics');
}

// ---- the mount
const field = () => {
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer({ ...hero(), cosmetics: { mount: 'mount_wolf' } });
  for (const m of sim.monsters) m.x = m.z = 9999;
  return { sim, p };
};
{
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer(hero());
  sim.toggleMount(p);
  ok(!p.mounted, 'no mount worn: cannot ride');
}
{
  const { sim, p } = field();
  const walk = p.moveSpeed;
  sim.toggleMount(p);
  ok(p.mounted, 'gets on');
  ok(Math.abs(p.moveSpeed - walk * MOUNT_SPEED) < 1e-9, `+30% speed (${walk} → ${p.moveSpeed})`);
  run(sim, 1);
  ok(p.mounted, 'stays on while nothing happens');
  sim.toggleMount(p);
  ok(!p.mounted && Math.abs(p.moveSpeed - walk) < 1e-9, 'Z again: off, normal speed');
}
{
  const { sim, p } = field();
  sim.toggleMount(p);
  run(sim, 0.2);
  p.lastAttack = sim.time;
  sim.step(TICK);
  ok(!p.mounted, 'attacking throws you off');
  sim.toggleMount(p);
  ok(!p.mounted, 'right after the fight: cannot get on');
  run(sim, MOUNT_CALM - 0.3);
  sim.toggleMount(p);
  ok(!p.mounted, `still ${MOUNT_CALM} s calm needed`);
  run(sim, 0.5);
  sim.toggleMount(p);
  ok(p.mounted, `back on ${MOUNT_CALM} s after the fight`);
  run(sim, 0.2);
  p.lastHurt = sim.time;
  sim.step(TICK);
  ok(!p.mounted, 'being hit throws you off');
}
{
  const { sim, p } = field();
  sim.toggleMount(p);
  delete p.cosmetics.mount;
  sim.step(TICK);
  ok(!p.mounted, 'mount taken off: on foot');
}
{
  const room = new Sim(Object.values(BOSS_ROOMS)[0]);
  const p = room.addPlayer({ ...hero(), cosmetics: { mount: 'mount_wolf' } });
  room.toggleMount(p);
  ok(!p.mounted, 'no riding in a boss room');
  p.mounted = true;
  room.step(TICK);
  ok(!p.mounted, 'carried into a boss room: off at once');
}

finish('cosmetics');
