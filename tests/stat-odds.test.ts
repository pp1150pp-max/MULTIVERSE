// The blacksmith's "สุ่มสเตตัส" odds table (statRerollOdds) matches what rerollStat really rolls.
import { ok, finish } from './check';
import { rerollStat, rollItem, statRerollOdds } from '../src/shared/data/items';
import { mulberry32 } from '../src/shared/rng';
import type { Item, StatKey } from '../src/shared/types';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ---- in general
const gen = statRerollOdds();
ok(gen.stats.length === 10 && gen.stats.every((s) => near(s.chance, 0.1, 1e-9)), '10 stats, 10% each');
ok(gen.tiers.map((t) => Math.round(t * 100)).join() === '3,9,18,30,40', 'T1–T5: 3 / 9 / 18 / 30 / 40 %');
ok(near(sum(gen.tiers), 1, 1e-9), 'tiers add up to 100%');

// ---- for items: every chance adds up, matches many real rolls, and a stat another extra has is 0
const r = mulberry32(7);
const of = (rarity: Item['rarity']) => rollItem(r, 30, 'sword', 0, undefined, rarity);
for (const rarity of ['epic', 'legendary', 'uncommon', 'common'] as const) {
  const item = of(rarity);
  const odds = statRerollOdds(item);
  ok(near(sum(odds.stats.map((s) => s.chance)), 1, 1e-9), `${rarity}: stat chances add up to 100%`);
  ok(odds.mainOnly === (rarity === 'common'), `${rarity}: mainOnly = ${odds.mainOnly}`);
  const N = 40000;
  const seen = new Map<StatKey, number>();
  const tiers = [0, 0, 0, 0, 0];
  const rr = mulberry32(99);
  for (let i = 0; i < N; i++) {
    const copy: Item = JSON.parse(JSON.stringify(item));
    const at = rerollStat(copy, rr);
    const l = copy.lines![at];
    seen.set(l.stat, (seen.get(l.stat) ?? 0) + 1);
    tiers[l.tier - 1]++;
  }
  const statsOk = odds.stats.every((s) => near((seen.get(s.stat) ?? 0) / N, s.chance, 0.01));
  ok(statsOk, `${rarity}: stat odds match ${N} real rolls`);
  ok(tiers.every((n, i) => near(n / N, odds.tiers[i], 0.01)), `${rarity}: tier odds match ${N} real rolls`);
}

finish('stat-odds');
