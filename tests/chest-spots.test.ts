// A treasure chest comes up at a new random spot every time (owner 2026-11-28, docs/systems/chests-shrines.md): on every farm map
// of floors 1 and 2, never in water, a whirlpool, lava, anything solid or the safe area, only where a player can walk from the
// camp, the /admin distances kept; a new spot each respawn, the same across a channel closing, the pins when switched off.
import { Channels } from '../server/channels';
import { applyBalance, balanceChanges } from '../src/shared/balance';
import { CHEST_ROOM, chestGround, pickChestSpot, type Spot } from '../src/shared/chestSpots';
import { inSafeArea, lairOf, ZONES, type ZoneDef } from '../src/shared/data/zones';
import { groundPools, GROUND_POOLS } from '../src/shared/groundPools';
import { MapRegistry, withBundledTreasure } from '../src/shared/mapRegistry';
import { CHEST_MAP_IDS, SHRINE_MAP_IDS, validateMap, type MapData } from '../src/shared/mapSchema';
import { mulberry32 } from '../src/shared/rng';
import { Sim } from '../src/shared/sim/Sim';
import { Terrain } from '../src/shared/sim/terrain';
import { checkTreasureTuning, codeTreasure } from '../src/shared/treasure';
import { finish, ok } from './check';

const cfg = codeTreasure();
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);

/** What is wrong with a chest standing at `s` (empty = fine), worked out here, not by the module under test. */
function wrong(zone: ZoneDef, t: Terrain, s: Spot): string[] {
  const out: string[] = [];
  if (t.isBlocked(s.x, s.z, CHEST_ROOM)) out.push('solid / off the map');
  if ((zone.whirlpools ?? []).some((w) => dist(s, w) < w.r)) out.push('whirlpool');
  if ([...(zone.iceLakes ?? []), ...(zone.lavaPools ?? [])].some((l) => ((s.x - l.x) / l.rx) ** 2 + ((s.z - l.z) / l.rz) ** 2 < 1)) out.push('ice / lava');
  if (t.props.some((p) => p.key === 'tide_pool' && dist(s, p) < 1.2)) out.push('tide pool');
  if (groundPools(zone, t).flat().some((l) => ((s.x - l.x) / l.rx) ** 2 + ((s.z - l.z) / l.rz) ** 2 < 1)) out.push('painted pool');
  if (inSafeArea(zone, s.x, s.z)) out.push('safe area');
  if (dist(s, zone.start) < cfg.campGap || t.restSpots.some((r) => dist(s, r) < cfg.campGap)) out.push('camp');
  if (zone.portals.some((p) => dist(s, p) < cfg.doorGap) || (zone.warps ?? []).some((w) => dist(s, w) < cfg.doorGap)) out.push('door');
  const lair = lairOf(zone);
  if (lair && dist(s, lair) < cfg.bossGap) out.push('boss summoner');
  return out;
}

ok(CHEST_MAP_IDS.length === 8 && SHRINE_MAP_IDS.length === 4, 'chests on the 8 farm maps, shrines on floor 1 only');
for (const id of CHEST_MAP_IDS) {
  const zone = ZONES[id];
  const t = new Terrain(zone);
  ok((zone.chests?.length ?? 0) === 4, `${id}: 4 chests`);
  const pools = groundPools(zone, t);
  ok(pools.length === (GROUND_POOLS[zone.theme] ?? 0), `${id}: its painted pools are known (${pools.length})`);
  const r = mulberry32(1234);
  const bad = new Map<string, number>();
  const seen = new Set<string>();
  let last: Spot[] = [];
  let close = 0;
  for (let i = 0; i < 400; i++) {
    const s = pickChestSpot(zone, t, cfg, last, r)!;
    for (const w of wrong(zone, t, s)) bad.set(w, (bad.get(w) ?? 0) + 1);
    if (last.some((o) => dist(s, o) < cfg.spotGap)) close++;
    seen.add(`${s.x},${s.z}`);
    last = [...last, s].slice(-4);
  }
  ok(!bad.size, `${id}: 400 rolls, none in a wrong place (${JSON.stringify([...bad])})`);
  ok(!close, `${id}: apart from the last 4 spots (${close})`);
  ok(seen.size > 300, `${id}: spread over the map (${seen.size} different spots)`);
  const ground = chestGround(zone, t);
  ok(ground.every((s) => !t.isBlocked(s.x, s.z, CHEST_ROOM)), `${id}: every candidate agrees with the whole terrain (${ground.length})`);
  ok([-1, 1].every((sx) => [-1, 1].every((sz) => ground.some((s) => Math.sign(s.x) === sx && Math.sign(s.z) === sz))), `${id}: all four quarters of the map`);
  // The pins used with random spots off stand on that ground too.
  ok(zone.chests!.every((c) => !t.isBlocked(c.x, c.z, 0.4)), `${id}: the pins are on open ground`);
}

// ---- the safe area, and ground nobody can walk to
{
  const base = ZONES.emerald_forest;
  const safe: ZoneDef = { ...base, safe: { x: 0, z: 0, half: 30 } };
  const ground = chestGround(safe, new Terrain(safe));
  ok(ground.length > 0 && ground.every((s) => !inSafeArea(safe, s.x, s.z)), 'none in a safe area');
  const walled: ZoneDef = { ...base };
  const t = new Terrain(walled);
  // A wall round a square in the middle: open ground inside, no way in.
  const box = (x0: number, z0: number, x1: number, z1: number) => t.blockers.push([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  box(-22, -22, 22, -19); box(-22, 19, 22, 22); box(-22, -22, -19, 22); box(19, -22, 22, 22);
  const reach = chestGround(walled, t);
  ok(reach.length > 0 && !reach.some((s) => Math.abs(s.x) < 22 && Math.abs(s.z) < 22), 'none where a player can\'t walk to');
}

// ---- in the Sim: a new spot every respawn
{
  applyBalance({ treasure: { openSec: 0 } });
  for (const id of ['emerald_forest', 'kraken_maelstrom']) {
    const zone = ZONES[id];
    const sim = new Sim(zone);
    let now = 0;
    sim.chestClock = () => now;
    const p = sim.addPlayer({ name: 'A', classId: 'sword', level: 75, exp: 0, gold: 0, equipment: {}, bag: [] });
    let moved = 0;
    let stable = true;
    let loot = true;
    const spots: Spot[] = [];
    for (let i = 0; i < 25; i++) {
      const c = sim.chests[0];
      spots.push(c);
      stable &&= dist(sim.chests[0], c) === 0 && sim.chestsShown().some((x) => x.id === c.id);
      p.x = c.x; p.z = c.z + 1.5;
      sim.loots = [];
      sim.startChest(p, c.id);
      stable &&= !sim.chestsShown().some((x) => x.id === c.id) && dist(sim.chests[0], c) === 0;
      loot &&= sim.loots.length > 0 && sim.loots.every((l) => dist({ x: l.fromX, z: l.fromZ }, c) === 0);
      now += cfg.chestRespawn + 1;
      if (dist(sim.chests[0], c) >= cfg.spotGap) moved++;
    }
    ok(stable, `${id}: a chest stands still while it is there, and is not shown once opened`);
    ok(loot, `${id}: the pieces fall round where it stood`);
    ok(moved === 25, `${id}: every respawn is somewhere else (${moved}/25)`);
    const t = new Terrain(zone);
    ok(spots.every((s) => !wrong(zone, t, s).length), `${id}: all in good places`);
    ok(new Set(sim.chests.map((c) => `${c.x},${c.z}`)).size === 4, `${id}: the four stand apart`);
  }
  // Opening takes time: a chest that moved before the bar ends is not opened from afar.
  applyBalance({});
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer({ name: 'B', classId: 'sword', level: 5, exp: 0, gold: 0, equipment: {}, bag: [] });
  const c = sim.chests[0];
  p.x = c.x; p.z = c.z + 1;
  sim.monsters = [];
  ok(sim.startChest(p, c.id), 'opening starts');
  sim.chestSpots.get(c.id)!.x += 20;
  for (let i = 0; i < 30; i++) { sim.monsters = []; sim.step(0.1, () => ({ move: null, moveTo: null, aim: { x: 0, z: 0 }, basic: false, skills: [], dash: false, potion: null })); }
  ok(sim.chestHere(c.id) && p.gold === 0, 'it moved meanwhile: nothing from it');
}

// ---- off: the pins; on again: random
{
  const zone = ZONES.shipwreck_beach;
  const sim = new Sim(zone);
  applyBalance({ treasure: { randomSpots: false } });
  ok(JSON.stringify(sim.chests) === JSON.stringify(zone.chests), 'random off: where the map editor put them');
  applyBalance({});
  ok(JSON.stringify(sim.chests) !== JSON.stringify(zone.chests), 'random on: somewhere else');
}

// ---- the server's channels keep the spots when an empty channel closes and opens again
{
  const zone = ZONES.emerald_forest;
  const ch = new Channels([zone]);
  const a = ch.ensure(zone.id, 1)!;
  const spots = JSON.stringify(a.sim.chests);
  ch.sweep();
  const b = ch.ensure(zone.id, 1)!;
  ok(a.sim !== b.sim && JSON.stringify(b.sim.chests) === spots, 'reopened channel: the same spots (hopping channels moves nothing)');
  ok(JSON.stringify(ch.ensure(zone.id, 2)!.sim.chests) !== spots, 'another channel has its own');
  // The zones are rebuilt on every balance save: the same layout in a new object moves nothing, a changed one does.
  let changed = false;
  const rebuilt = new Channels([zone], Date.now, undefined, (z) => (changed ? { ...z, start: { x: z.start.x - 4, z: z.start.z } } : { ...z }));
  const c = rebuilt.ensure(zone.id, 1)!;
  const was = JSON.stringify(c.sim.chests);
  rebuilt.sweep();
  const d = rebuilt.ensure(zone.id, 1)!;
  ok(d.sim.zone !== c.sim.zone && JSON.stringify(d.sim.chests) === was, 'the same layout rebuilt: the same spots');
  ok(chestGround(d.sim.zone, d.sim.terrain) === chestGround(c.sim.zone, c.sim.terrain), 'and it is not searched again');
  changed = true;
  rebuilt.sweep();
  ok(JSON.stringify(rebuilt.ensure(zone.id, 1)!.sim.chests) !== was, 'a changed layout: new spots');
}

// ---- map files and /admin
{
  const beach = MapRegistry.bundled('shipwreck_beach')!;
  const ctx = { propKeys: beach.props.map((p) => p.key), baseline: beach };
  const errs = (m: MapData) => validateMap(m, ctx).filter((i) => i.severity === 'error');
  ok(!errs(beach).length, `the bundled beach with chests passes (${JSON.stringify(errs(beach))})`);
  ok(errs({ ...beach, shrines: [{ id: 's1', x: 0, z: 0, buff: 'atk' }] }).some((i) => i.kind === 'shrine' && i.code === 'locked'), 'a shrine on floor 2 is refused');
  const { chests: _c, ...old } = beach;
  ok(withBundledTreasure(old as MapData).chests?.length === 4, 'a floor-2 layout published before chests gets the bundled ones');
  ok('error' in checkTreasureTuning({ spotGap: 500 }, true), 'a distance out of range is refused');
  ok('error' in checkTreasureTuning({ randomSpots: 1 }, true), 'the switch must be on or off');
  const t = checkTreasureTuning({ ...codeTreasure(), randomSpots: false, campGap: 40 }, true) as { tuning: object };
  ok(JSON.stringify(t.tuning) === JSON.stringify({ randomSpots: false, campGap: 40 }), `only what differs is stored (${JSON.stringify(t.tuning)})`);
  const audit = balanceChanges({}, { treasure: { randomSpots: false, campGap: 40 } });
  ok(audit.includes('หีบสุ่มจุดเกิด') && audit.includes('ห่างจุดเริ่ม'), 'the audit names both');
}

finish('chest-spots');
