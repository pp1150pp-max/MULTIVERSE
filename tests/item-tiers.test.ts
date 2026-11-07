// Stat tiers with their own ranges, the blacksmith's two rerolls, and old saves loading into the new
// tables. Runs on the shared rules and a real Sim, no server needed.
import { ok, finish } from './check';
import {
  ITEM_BASES, lineRanges, makeItem, rerollBlock, rerollStat, rerollValues, rollItem, rowRanges, statStep, tierOf, tierRanges,
  TIER_VERSION, upgradeItem,
} from '../src/shared/data/items';
import { rerollCost } from '../src/shared/data/reroll';
import { customItem } from '../src/shared/admin';
import { newCharacterData, Player } from '../src/shared/sim/Player';
import { cleanStash } from '../src/shared/sim/stash';
import { Sim } from '../src/shared/sim/Sim';
import { ZONE_HUB } from '../src/shared/data/zones';
import { CLASS_IDS } from '../src/shared/data/classes';
import { RARITIES, STAT_KEYS, type Item, type StatKey } from '../src/shared/types';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const decimals = (v: number) => near(v * 10, Math.round(v * 10));

/** Every line sits inside its own tier's range, which matches the tables, and stats are the lines' total. */
function linesValid(it: Item, label: string): boolean {
  const ranges = lineRanges(it);
  if (!ranges || !it.lines || it.tierV !== TIER_VERSION) return ok(false, `${label}: has current tier lines`), false;
  let good = true;
  const total: Partial<Record<StatKey, number>> = {};
  it.lines.forEach((l, i) => {
    const t = tierRanges(l.stat, ranges[i].lo, ranges[i].hi)[l.tier - 1];
    if (l.min !== t.min || l.max !== t.max || l.value < l.min - 1e-9 || l.value > l.max + 1e-9) good = false;
    if (statStep(l.stat) === 0.1 ? !decimals(l.value) : !Number.isInteger(l.value)) good = false;
    total[l.stat] = (total[l.stat] ?? 0) + l.value;
  });
  for (const k of STAT_KEYS) if (!near(Math.round((total[k] ?? 0) * 10) / 10, it.stats[k] ?? 0)) good = false;
  return good;
}

// ---- tier tables
{
  let good = true;
  for (const stat of STAT_KEYS) {
    for (const [lo, hi] of [[0.4, 1], [2, 5], [10, 25], [40, 100], [300, 750]] as const) {
      const t = tierRanges(stat, lo, hi);
      const step = statStep(stat);
      if (t.length !== 5 || t.some((x, i) => x.tier !== i + 1 || x.max < x.min)) good = false;
      for (let i = 0; i < 4; i++) if (!near(t[i].min, t[i + 1].max + step)) good = false; // no gap, no overlap
    }
  }
  ok(good, 'tiers: five ranges, T1 on top, next to each other with no gap or overlap');
  const t = tierRanges('atk', 40, 100);
  ok(t[0].max === 100 && t[4].min === 40, 'tiers: T1 ends at the top, T5 starts at the bottom');
  ok(t[0].min === 86 && t[1].min === 71 && t[2].min === 56 && t[3].min === 47 && t[4].max === 46,
    `tiers: T1–T3 a quarter each, T4 15%, T5 10% (${t.map((x) => `${x.min}–${x.max}`).join(' ')})`);
  ok(tierOf('atk', 999, 40, 100).tier === 1 && tierOf('atk', 1, 40, 100).tier === 5 && tierOf('atk', 60, 40, 100).tier === 3,
    'tierOf: above the range is T1, below it T5');
  const small = tierRanges('atk', 2, 5);
  ok(small.every((x) => x.max >= x.min) && small[0].min > small[1].max, 'tiers: small numbers still give five distinct ranges');
}

// ---- rolled items
{
  let good = true, n = 0;
  for (let i = 0; i < 4000; i++) {
    const it = rollItem(Math.random, 1 + (i % 40), CLASS_IDS[i % 3], i % 5 === 0 ? 1.5 : 0);
    if (!linesValid(it, 'rolled')) good = false;
    n++;
  }
  ok(good, `rolled items: ${n} items, every line inside its tier range, % stats with one decimal`);
  // Every item kind (incl. necklaces, gloves, belts, off-hands, Ashen Isle gear) at every rarity.
  let kinds = true;
  for (const b of ITEM_BASES) for (const rar of RARITIES) for (const lv of [b.minLevel, 40]) {
    const cls = (Object.keys(b.names).find((k) => k !== 'any') ?? 'sword') as 'sword' | 'mage' | 'gunslinger';
    const it = makeItem(b.id, rar, lv, cls)!;
    if (!linesValid(it, b.id) || !it.lines!.length) kinds = false;
  }
  ok(kinds, `every item kind (${ITEM_BASES.length}) at every rarity gets valid tier lines`);
  // Owner: items stay as strong on average as before. Old average of a main stat = base × level × rarity.
  const base = ITEM_BASES.find((b) => b.id === 'weapon_5')!;
  let sum = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) sum += makeItem('weapon_5', 'rare', 20, 'sword')!.lines![0].value; // the main ATK line
  const old = base.main.atk! * (1 + 19 * 0.12) * 1.3;
  ok(Math.abs(sum / N / old - 1) < 0.03, `average ATK of a rolled weapon stays the same (${(sum / N).toFixed(1)} vs ${old.toFixed(1)})`);
}

// ---- reroll values (Divine-like)
{
  let good = true;
  for (let i = 0; i < 500; i++) {
    const it = rollItem(Math.random, 30, 'mage');
    const before = it.lines!.map((l) => ({ ...l }));
    if (!rerollValues(it)) good = false;
    if (!linesValid(it, 'values')) good = false;
    it.lines!.forEach((l, j) => { if (l.stat !== before[j].stat || l.tier !== before[j].tier) good = false; });
  }
  ok(good, 'reroll values: every line keeps its stat and tier and lands inside the tier range');
}

// ---- reroll stat (Chaos-like)
{
  let good = true, changedKind = 0;
  for (let i = 0; i < 1000; i++) {
    const it = makeItem('weapon_7', RARITIES[1 + (i % 4)], 30, 'sword')!;
    const before = it.lines!.map((l) => ({ ...l }));
    const mains = rowRanges(it.baseId, it.rarity, it.level, before.map((l) => l.stat))!.map((r) => r.main);
    const at = rerollStat(it);
    if (at < 0 || mains[at] || !linesValid(it, 'stat')) good = false;
    it.lines!.forEach((l, j) => {
      if (j !== at && (l.stat !== before[j].stat || l.value !== before[j].value)) good = false;
    });
    const extras = it.lines!.filter((_, j) => !mains[j]).map((l) => l.stat);
    if (new Set(extras).size !== extras.length) good = false;
    if (it.lines![at].stat !== before[at].stat) changedKind++;
  }
  ok(good, 'reroll stat: only one extra line changes, main stats untouched, no repeated extras');
  ok(changedKind > 500, `reroll stat: usually a new kind of stat (${changedKind}/1000)`);
  // Commons have no extras: one main line gets a new tier and value, same stat.
  let cgood = true;
  for (let i = 0; i < 300; i++) {
    const it = makeItem('helm', 'common', 20, 'sword')!;
    const stats = it.lines!.map((l) => l.stat).join();
    if (rerollStat(it) < 0 || it.lines!.map((l) => l.stat).join() !== stats || !linesValid(it, 'common')) cgood = false;
  }
  ok(cgood, 'reroll stat on a common: same stats, new tier and value on one main line');
  const plus = makeItem('weapon_3', 'epic', 10, 'sword')!;
  plus.plus = 9;
  rerollStat(plus);
  rerollValues(plus);
  ok(plus.plus === 9, 'rerolls keep the + level');
  ok(rerollCost(makeItem('weapon_5', 'rare', 20, 'sword')!, 'values') === Math.round(135 * 3 * 2) &&
    rerollCost(makeItem('weapon_5', 'legendary', 20, 'sword')!, 'stat') === Math.round(135 * 6 * 5), 'reroll cost: (15 + iLv×6) × 3 or 6 × rarity');
}

// ---- admin items above the normal range
{
  const rows = rowRanges('weapon_5', 'rare', 20, ['atk', 'crit'])!;
  const big = Math.round(rows[0].hi * 1.9);
  const it = customItem('weapon_5', 'rare', 20, 'sword', makeItem('weapon_5', 'rare', 20, 'sword')!.name, [
    { stat: 'atk', value: big }, { stat: 'crit', value: 3.5 },
  ]);
  ok(typeof it !== 'string' && it.lines![0].tier === 1 && it.lines![0].value === big && it.tierV === TIER_VERSION, 'admin item above the range counts as T1');
  ok(typeof it !== 'string' && it.lines![1].value === 3.5, 'admin item: % stats take one decimal');
  if (typeof it !== 'string') {
    rerollValues(it);
    ok(it.lines![0].value <= it.lines![0].max && it.lines![0].tier === 1, 'rerolling an admin item brings it back inside T1');
  }
}

// ---- old saves
/** An item as saved before this update: min–max = the whole old range, integer % stats, no tierV. */
function oldItem(): Item {
  return {
    uid: 'old1', baseId: 'weapon_5', name: 'Witchbane Blade', slot: 'weapon', rarity: 'rare', level: 20, cls: 'sword',
    stats: { atk: 80, crit: 5 }, value: 100, plus: 3,
    lines: [{ stat: 'atk', value: 80, tier: 2, min: 67, max: 98 }, { stat: 'crit', value: 5, tier: 4, min: 4, max: 8 }],
  };
}
{
  const it = upgradeItem(oldItem());
  const r = rowRanges('weapon_5', 'rare', 20, ['atk', 'crit'])!;
  ok(it.tierV === TIER_VERSION && it.lines![0].value === 80 && it.lines![1].value === 5 && it.stats.atk === 80, 'old item: values kept');
  ok(it.lines!.every((l, i) => {
    const t = tierOf(l.stat, l.value, r[i].lo, r[i].hi);
    return l.tier === t.tier && l.min === t.min && l.max === t.max;
  }), 'old item: tier and range taken from where the value falls now');
  const again = JSON.stringify(it);
  ok(JSON.stringify(upgradeItem(it)) === again, 'upgrading twice changes nothing');
  const preTier: Item = { uid: 'pre', baseId: 'weapon_1', name: 'Short Sword', slot: 'weapon', rarity: 'common', level: 1, stats: { atk: 4 }, value: 5 };
  ok(JSON.stringify(upgradeItem({ ...preTier })) === JSON.stringify(preTier) && !!rerollBlock(preTier), 'item from before tiers: left alone, cannot be rerolled');

  const data = newCharacterData('Old', 'sword');
  data.equipment = { weapon: oldItem() };
  data.bag = [{ ...oldItem(), uid: 'old2' }];
  data.buyback = [{ item: { ...oldItem(), uid: 'old3' }, paid: 10 }];
  const p = new Player(1, {} as Sim, JSON.parse(JSON.stringify(data)));
  const bagItem = p.bag[0] as Item;
  ok(p.equipment.weapon!.tierV === TIER_VERSION && bagItem.tierV === TIER_VERSION && p.buyback[0].item.tierV === TIER_VERSION,
    'old save: worn, bag and buyback items upgraded on load');
  const stash = cleanStash(JSON.parse(JSON.stringify({ size: 30, gold: 0, items: [oldItem()] })));
  ok((stash.items[0] as Item).tierV === TIER_VERSION && (stash.items[0] as Item).lines![0].value === 80, 'old stash: items upgraded on load');
}

// ---- the blacksmith on a real Sim
{
  const sim = new Sim(ZONE_HUB);
  const data = newCharacterData('Smith', 'sword');
  const p = sim.addPlayer({ ...data, level: 20, gold: 100000 });
  const item = makeItem('weapon_5', 'rare', 20, 'sword')!;
  p.bag[5] = item;
  const smith = sim.terrain.npcPos.blacksmith!;
  p.x = smith.x + 30;
  p.z = smith.z;
  ok(sim.reroll(p, item.uid, 'values') === null, 'reroll: refused away from the blacksmith');
  p.x = smith.x + 1;
  p.z = smith.z;
  const gold = p.gold;
  ok(sim.reroll(p, item.uid, 'values') === item && p.gold === gold - rerollCost(item, 'values'), 'reroll values: done next to the blacksmith, gold taken');
  ok(sim.reroll(p, item.uid, 'stat') === item && linesValid(item, 'sim'), 'reroll stat on a bag item');
  const worn = p.equipment.weapon!;
  const atkBefore = p.stats.atk;
  for (let i = 0; i < 20 && p.stats.atk === atkBefore; i++) sim.reroll(p, worn.uid, 'values');
  ok(p.stats.atk !== atkBefore || worn.lines!.every((l) => l.min === l.max), 'reroll on worn gear updates the character stats');
  ok(sim.reroll(p, 'nope', 'values') === null, 'reroll: unknown item refused');
  p.stash.items[0] = makeItem('weapon_5', 'rare', 20, 'sword');
  ok(sim.reroll(p, (p.stash.items[0] as Item).uid, 'values') === null, 'reroll: stash items refused');
  p.gold = 0;
  ok(sim.reroll(p, item.uid, 'values') === null, 'reroll: not enough gold refused');
}

finish('item-tiers');
