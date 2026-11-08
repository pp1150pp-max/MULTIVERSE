// Drops follow the map: each outer map drops only the item kinds made for it (frost weapons in the
// snow, fire weapons on the volcano), never an old kind from an earlier map.
import { ok, finish } from './check';
import { ITEM_BASES, rollItem } from '../src/shared/data/items';
import { ZONE_1, ZONE_2, ZONE_3, ZONE_4, ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { CLASS_IDS } from '../src/shared/data/classes';

const minLevel = new Map(ITEM_BASES.map((b) => [b.id, b.minLevel]));
const zones = [ZONE_1, ZONE_2, ZONE_3, ZONE_4];

// Every item kind belongs to exactly one outer map.
for (const b of ITEM_BASES) {
  const n = zones.filter((z) => b.minLevel >= z.levels[0] && b.minLevel <= z.levels[1]).length;
  ok(n === 1, `${b.id} (Lv.${b.minLevel}) belongs to one map`);
}

for (const z of zones) {
  const [lo, hi] = z.levels;
  const seen = new Set<string>();
  let outside = 0;
  for (let i = 0; i < 6000; i++) {
    const level = lo + (i % (hi - lo + 1));
    const it = rollItem(Math.random, level, CLASS_IDS[i % CLASS_IDS.length], i % 7 === 0 ? 1.5 : 0, z.levels);
    const ml = minLevel.get(it.baseId)!;
    if (ml < lo || ml > hi) outside++;
    seen.add(it.baseId);
    if (it.level !== level) outside++;
  }
  ok(outside === 0, `${z.id}: every drop is one of the map's own kinds at the monster's level`);
  const own = ITEM_BASES.filter((b) => b.minLevel >= lo && b.minLevel <= hi).map((b) => b.id);
  ok(own.every((id) => seen.has(id)), `${z.id}: all ${own.length} of its kinds can drop`);
}

// The reported case: a level-40 volcano monster never drops a level-1 Flintlock.
let flintlocks = 0;
for (let i = 0; i < 5000; i++) if (rollItem(Math.random, 40, 'gunslinger', 1.5, ZONE_4.levels).baseId === 'weapon_1') flintlocks++;
ok(flintlocks === 0, 'volcano boss never drops a Flintlock');

// No band (old callers): any kind up to the level, as before.
const any = new Set<string>();
for (let i = 0; i < 4000; i++) any.add(rollItem(Math.random, 40, 'gunslinger').baseId);
ok(any.has('weapon_1') && any.has('weapon_9'), 'without a map, any kind up to the level can drop');

// Real Sims: monsters in every map, the hub's lone monsters in front of each portal too, drop only
// their own map's kinds.
for (const zone of [ZONE_HUB, ...zones]) {
  const sim = new Sim(zone);
  for (let i = 0; i < 600 && sim.monsters.length < 4; i++) sim.step(0.1);
  let wrong = 0;
  let items = 0;
  for (let k = 0; k < 100; k++) for (const m of sim.monsters) (sim as unknown as { dropLoot(m: unknown): void }).dropLoot(m);
  const home = (lv: number) => zones.find((z) => lv >= z.levels[0] && lv <= z.levels[1])!;
  for (const l of sim.loots) {
    if (l.kind.type !== 'item') continue;
    items++;
    const z = home(l.kind.item.level);
    const ml = minLevel.get(l.kind.item.baseId)!;
    if (ml < z.levels[0] || ml > z.levels[1]) wrong++;
  }
  ok(sim.monsters.length > 0 && items > 0 && wrong === 0, `${zone.id}: ${items} drops from its monsters, all from their own map`);
}

finish('zone-drops');
