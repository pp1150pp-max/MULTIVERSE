// Treasure chests and shrines on the farm maps (owner 2026-11-27, docs/systems/chests-shrines.md): on a real Sim, no server, plus the
// channel store that keeps opened chests shut when an empty channel closes and opens again, the map checks and the /admin tuning.
import { ok, finish } from './check';
import { ZONES } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import { applyBalance, balanceChanges, checkBalance, currentBalance } from '../src/shared/balance';
import { chestOdds, checkTreasureTuning, codeTreasure, mergeTreasure } from '../src/shared/treasure';
import { validateMap, TREASURE_MAP_IDS, type MapData } from '../src/shared/mapSchema';
import { MapRegistry, withBundledTreasure } from '../src/shared/mapRegistry';
import { Channels } from '../server/channels';

const zone = ZONES.emerald_forest;
const chest = zone.chests![0];
const shrine = zone.shrines!.find((s) => s.buff === 'atk')!;
const cfg = codeTreasure();

// ---- the maps
for (const id of TREASURE_MAP_IDS) {
  const z = ZONES[id];
  ok((z.chests?.length ?? 0) === 4 && (z.shrines?.length ?? 0) === 2, `${id}: 4 chests and 2 shrines to start with`);
}
ok(!ZONES.nexus_city.chests && !ZONES.shipwreck_beach.chests, 'none in the hub or on floor 2');
{
  const forest = MapRegistry.bundled('emerald_forest')!;
  const base = { propKeys: forest.props.map((p) => p.key), baseline: forest };
  const errs = (m: MapData) => validateMap(m, base).filter((i) => i.severity === 'error' && (i.kind === 'chest' || i.kind === 'shrine'));
  ok(errs(forest).length === 0, 'the bundled forest passes');
  ok(errs({ ...forest, chests: [...forest.chests!, { id: 'c1', x: 0, z: 0 }] }).some((i) => i.code === 'dup_id'), 'a duplicate chest id is an error');
  ok(errs({ ...forest, shrines: [{ id: 's9', x: 0, z: 0, buff: 'nope' as never }] }).length > 0, 'a shrine with an unknown buff is an error');
  ok(errs({ ...forest, chests: [{ id: 'c9', x: 999, z: 0 }] }).some((i) => i.code === 'out_of_bounds'), 'a chest outside the frame is an error');
  const beach = MapRegistry.bundled('shipwreck_beach')!;
  ok(validateMap({ ...beach, chests: [{ id: 'c1', x: beach.zone.start.x, z: beach.zone.start.z }] }, { propKeys: beach.props.map((p) => p.key) })
    .some((i) => i.kind === 'chest' && i.code === 'locked'), 'a chest on a floor-2 map is refused');
  // A layout published before chests existed (no field at all) gets the bundled ones; an empty list stays empty.
  const { chests: _c, shrines: _s, ...old } = forest;
  ok(withBundledTreasure(old as MapData).chests?.length === 4, 'an old published layout gets the bundled chests');
  ok(withBundledTreasure({ ...forest, chests: [] }).chests?.length === 0, 'the owner taking every chest away stays that way');
}

// ---- a Sim with the player standing at the chest, nothing around to hit them
const sim = new Sim(zone);
const quiet = () => { sim.monsters = []; };
const p = sim.addPlayer({ name: 'A', classId: 'sword', level: 5, exp: 0, gold: 0, equipment: {}, bag: [] });
const run = (sec: number, it: Intent = IDLE_INTENT) => {
  for (let t = 0; t < sec; t += 0.1) {
    quiet();
    sim.step(0.1, () => it);
  }
};
quiet();
p.x = chest.x;
p.z = chest.z + 1;

ok(!sim.startChest(p, 'nope'), 'an unknown chest id does nothing');
p.autoOn = true;
ok(!sim.startChest(p, chest.id) && p.chestT === 0, 'Auto Play on: the chest is refused');
p.autoOn = false;
const far = { x: p.x, z: p.z };
p.x += 20;
ok(!sim.startChest(p, chest.id), 'too far: refused');
p.x = far.x;

ok(sim.startChest(p, chest.id) && Math.abs(p.chestT - cfg.openSec) < 1e-9, `opening takes ${cfg.openSec} s`);
run(0.5, { ...IDLE_INTENT, basic: true });
ok(p.chestT === 0 && sim.chestHere(chest.id), 'attacking while opening stops it; the chest stays');

const gold0 = p.gold;
ok(sim.startChest(p, chest.id), 'start again');
run(cfg.openSec + 0.3);
ok(!sim.chestHere(chest.id) && sim.chestsGone().includes(chest.id), 'opened: the chest is gone');
const mid = (zone.levels[0] + zone.levels[1]) / 2;
const got = p.gold - gold0;
ok(got >= Math.floor(cfg.goldPerLevel * mid * 0.7) && got <= Math.ceil(cfg.goldPerLevel * mid * 1.3), `gold ${got} within 50 × Lv ${mid} ± 30%`);
{
  const mine = sim.loots.filter((l) => l.owner === p.id && Math.hypot(l.x - chest.x, l.z - chest.z) < 4);
  const purple = mine.filter((l) => l.kind.type === 'item' && l.kind.item.rarity === 'epic').length;
  ok(mine.length === cfg.pieces, `${cfg.pieces} pieces on the ground round the chest (${mine.length})`);
  ok(purple >= cfg.epicSure, `at least ${cfg.epicSure} purple (${purple})`);
  ok(mine.every((l) => l.ownerUntil > sim.time + 30) && !mine[0].canTake(sim.players.find((x) => x !== p) ?? ({ id: -1, partyId: null } as never), sim.time), 'only the opener may take them while they lie there');
  ok(p.bag.every((e) => !e), 'nothing went straight into the bag');
}

// Someone else (a guest: guests may open chests too) can't open it now.
const g = sim.addPlayer({ name: 'Guest', classId: 'gunslinger', level: 3, exp: 0, gold: 0, equipment: {}, bag: [] });
g.x = p.x; g.z = p.z;
ok(!sim.startChest(g, chest.id), 'already opened: the next player is refused');
run(cfg.chestRespawn - 5);
ok(!sim.chestHere(chest.id), 'still gone just before the respawn time');
run(10);
ok(sim.chestHere(chest.id), `back after ${cfg.chestRespawn} s`);
g.x = chest.x; g.z = chest.z + 1;
ok(sim.startChest(g, chest.id), 'the guest can open the chest once it is back');
run(cfg.openSec + 0.3);
ok(!sim.chestHere(chest.id) && g.gold > 0, 'the guest got the gold');

// The table's odds: purple 15%, orange 5%, rolled again for every piece (many chests: about that share of the rolled pieces).
{
  const s2 = new Sim(zone);
  const q = s2.addPlayer({ name: 'Many', classId: 'mage', level: 5, exp: 0, gold: 0, equipment: {}, bag: [] });
  q.x = chest.x; q.z = chest.z + 1;
  let rolled = 0, purple = 0, orange = 0;
  for (let i = 0; i < 400; i++) {
    s2.loots = [];
    s2.openChest(q, chest);
    const items = s2.loots.map((l) => (l.kind.type === 'item' ? l.kind.item.rarity : ''));
    rolled += items.length - cfg.epicSure;
    purple += items.filter((x) => x === 'epic').length - cfg.epicSure;
    orange += items.filter((x) => x === 'legendary').length;
  }
  ok(Math.abs(purple / rolled - 0.15) < 0.03, `rolled purple ≈ 15% (${((purple / rolled) * 100).toFixed(1)}%)`);
  ok(Math.abs(orange / rolled - 0.05) < 0.02, `orange ≈ 5% (${((orange / rolled) * 100).toFixed(1)}%)`);
  ok('error' in checkTreasureTuning({ pieces: 3, epicSure: 5 }, true), 'more sure purples than pieces: refused');
}

// ---- shrines
p.x = shrine.x; p.z = shrine.z + 1;
quiet();
const atk0 = p.stats.atk;
p.autoOn = true;
ok(!sim.useShrine(p, shrine.id), 'Auto Play on: the shrine is refused');
p.autoOn = false;
ok(sim.useShrine(p, shrine.id), 'touch the shrine');
ok(Math.abs(p.stats.atk - atk0 * (1 + cfg.atkPct / 100)) < 0.01, `attack +${cfg.atkPct}%`);
ok(!sim.useShrine(p, shrine.id), 'the same shrine again at once: refused (cooldown)');
ok(Math.abs((p.shrineCd[`${zone.id}:${shrine.id}`] ?? 0) - cfg.shrineCd) < 0.01, `cooldown ${cfg.shrineCd} s for this player`);
g.x = shrine.x; g.z = shrine.z + 1;
ok(sim.useShrine(g, shrine.id), 'the cooldown is per player: another player may use it');
(sim as unknown as { killPlayer(p: unknown): void }).killPlayer(g);
ok(!g.shrineBuffs.atk, 'death ends shrine buffs');

// The EXP buff: +30% on the EXP of a kill.
const expSim = new Sim(zone);
const e = expSim.addPlayer({ name: 'E', classId: 'sword', level: 5, exp: 0, gold: 0, equipment: {}, bag: [] });
const autoExp = (n: number) => (expSim as unknown as { autoExp(p: unknown, n: number): number }).autoExp(e, n);
const plain = autoExp(1000);
e.shrineBuffs.exp = { left: 10, total: 10, pct: cfg.expPct };
ok(autoExp(1000) === Math.floor(plain * (1 + cfg.expPct / 100)), `EXP buff: ${plain} → ${autoExp(1000)}`);

// Speed: +20 move-speed points, outside the gear cap.
const ms0 = e.stats.moveSpeed;
e.shrineBuffs.speed = { left: 10, total: 10, pct: cfg.speedPct };
e.recompute();
ok(Math.abs(e.stats.moveSpeed - ms0 - cfg.speedPct) < 1e-9, `move speed +${cfg.speedPct}`);

// The buff runs out (back to normal attack), and ends on death.
run(cfg.buffSec + 1);
ok(!p.shrineBuffs.atk && Math.abs(p.stats.atk - atk0) < 0.01, `the buff ends after ${cfg.buffSec} s`);
ok((p.shrineCd[`${zone.id}:${shrine.id}`] ?? 0) > 0, 'the cooldown is still running after the buff');
run(cfg.shrineCd);
ok(sim.useShrine(p, shrine.id), 'usable again after the cooldown');

// ---- the server's channels keep opened chests when an empty channel closes and opens again
{
  let now = 1_000_000;
  const ch = new Channels([zone], () => now);
  const c1 = ch.ensure(zone.id, 1)!;
  const q = c1.sim.addPlayer({ name: 'C', classId: 'sword', level: 5, exp: 0, gold: 0, equipment: {}, bag: [] });
  q.x = chest.x; q.z = chest.z + 1;
  c1.sim.monsters = [];
  c1.sim.openChest(q, chest);
  c1.sim.removePlayer(q);
  ch.sweep();
  ok(!ch.get(zone.id, 1), 'the empty channel closed');
  const again = ch.ensure(zone.id, 1)!;
  ok(again.sim !== c1.sim && !again.sim.chestHere(chest.id), 'opened again: the chest is still gone (no free refill by hopping channels)');
  ok(ch.ensure(zone.id, 2)!.sim.chestHere(chest.id), 'another channel has its own chests');
  now += cfg.chestRespawn * 1000 + 1;
  ok(again.sim.chestHere(chest.id), 'back after the respawn time on the wall clock');
}

// ---- /admin tuning: only what differs is kept, bad values are refused, the audit names the change
{
  ok(checkTreasureTuning({ chestRespawn: 600 }, true).hasOwnProperty('tuning') && (checkTreasureTuning({ chestRespawn: 600 }, true) as { tuning: unknown }).tuning === undefined, 'a code value is not stored');
  ok('error' in checkTreasureTuning({ chestRespawn: 1 }, true), 'out of range: refused');
  ok('error' in checkTreasureTuning({ rows: { gear_rare: { pct: 99 } } }, true), 'fixed chances over 100%: refused');
  const t = checkTreasureTuning({ atkPct: 25, rows: { boss_key: { on: false } } }, true) as { tuning: object };
  ok(JSON.stringify(t.tuning) === JSON.stringify({ atkPct: 25, rows: { boss_key: { on: false } } }), 'a change is stored as only what differs');
  const merged = mergeTreasure(t.tuning);
  ok(!chestOdds(merged, true).some((o) => o.row.id === 'boss_key'), 'a row switched off is not in the chest');
  const sum = chestOdds(codeTreasure(), true).reduce((a, o) => a + o.pct, 0);
  ok(Math.abs(sum - 100) < 1e-9, 'the code table adds up to 100%');
  ok(!chestOdds(codeTreasure(), false).some((o) => o.row.id === 'boss_key'), 'a map without a boss: no key row');
  const c = checkBalance({ treasure: { atkPct: 25 } }, true);
  ok(!('error' in c), 'goes through the balance check');
  applyBalance({ treasure: { atkPct: 25, chests: false } });
  ok(currentBalance().treasure.atkPct === 25 && !sim.chests.length, 'applied at once: switching chests off hides them');
  ok(balanceChanges({}, { treasure: { atkPct: 25 } }).includes('บัฟพลังโจมตี'), 'the audit line names the change');
  applyBalance({});
}

finish('chests-shrines');
