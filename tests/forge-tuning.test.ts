// Blacksmith enhancement numbers tuned in /admin (BalanceTuning.forge, src/shared/forgeTuning.ts, owner 2026-11-20):
// the code values are unchanged, checkBalance keeps only what differs and refuses bad values, and the Sim and the
// shared rules (rates, pity, drop level, stones, cost, cooldown, max, orbs, aura, sell value) use what is applied.
// Runs on the shared rules, no server.
import { applyBalance, balanceChanges, checkBalance } from '../src/shared/balance';
import {
  auraTier, bonusPct, canEnhance, dropsOnFail, effectiveStats, enhanceCost, forgeCd, maxPlus, orbCodes, PLUS_CAP, rateFor, rollEnhance, sellValue, stonesNeeded, successRate,
} from '../src/shared/data/enhance';
import { makeItem } from '../src/shared/data/items';
import { ZONES } from '../src/shared/data/zones';
import { codeForge } from '../src/shared/forgeTuning';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import type { Item } from '../src/shared/types';
import { finish, ok } from './check';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const fresh = (plus: number, pity = 0): Item => {
  const it = makeItem('weapon_3', 'epic', 30, 'sword')!;
  it.plus = plus;
  if (pity) it.pity = pity;
  return it;
};
/** Applies a tuning as the server does (strict check first). */
const use = (forge: unknown): void => {
  const c = checkBalance({ forge }, true);
  if (c.error) throw new Error(c.error);
  applyBalance(c.tuning!);
};

// ---------------------------------------------------------- code values (nothing applied)
{
  const it = fresh(4);
  ok(rateFor(5) === 0.4 && rateFor(14) === 0.025 && rateFor(15) === 0.01 && rateFor(1) === 1, 'code rates: +5 40%, +14 2.5%, +15 1%');
  ok(bonusPct(5) === 20 && bonusPct(10) === 45 && bonusPct(15) === 95, 'code bonus: +5 20%, +10 45%, +15 95%');
  ok(enhanceCost(it) === Math.round((15 + 30 * 6) * 5), 'code cost: (15 + Lv×6) × 5 for +5');
  ok(!dropsOnFail(fresh(5)) && dropsOnFail(fresh(6)), 'code: drops from +7');
  ok(stonesNeeded(fresh(9)) === 0 && stonesNeeded(fresh(10)) === 1, 'code: one stone from +11');
  ok(near(successRate(fresh(4, 3)), 0.43), 'code pity +1% per fail');
  ok(maxPlus() === 15 && forgeCd() === 1, 'code max +15, cooldown 1 s');
  ok(auraTier(6) === 0 && auraTier(7) === 1 && auraTier(12) === 2 && auraTier(13) === 3 && auraTier(15) === 4, 'code aura +7/+10/+13/+15');
  ok(orbCodes({ weapon: fresh(6) }).length === 0 && orbCodes({ weapon: fresh(7) }).length === 1, 'code orbs from +7');
  const v = fresh(2);
  ok(sellValue(v) === Math.round(v.value * 2), 'code sell value +50% per level');
}

// ---------------------------------------------------------- checks
{
  const c = checkBalance({ forge: codeForge() }, true);
  ok(!c.error && c.tuning!.forge === undefined, 'the code numbers sent back = nothing saved');
  const d = checkBalance({ forge: { rate: { 12: 30, 5: 40 }, pity: 2, maxPlus: 12 } }, true);
  ok(JSON.stringify(d.tuning!.forge) === '{"rate":{"12":30},"pity":2,"maxPlus":12}', 'only the differences are kept, in a fixed order');
  for (const [what, forge] of [
    ['rate -1', { rate: { 3: -1 } }],
    ['level 0', { rate: { 0: 50 } }],
    ['max 0', { maxPlus: 0 }],
    ['stones 2.5', { stonesPerTry: 2.5 }],
    ['aura of 3', { aura: [7, 10, 13] }],
    ['announce 17', { announceFrom: 17 }],
  ] as const) ok(!!checkBalance({ forge }, true).error, `bad ${what} refused`);
  const loose = checkBalance({ forge: { rate: { 3: 500, 6: 50 }, maxPlus: 99 } }, false);
  ok(JSON.stringify(loose.tuning!.forge) === '{"rate":{"6":50}}', 'from the DB, bad entries are dropped and the rest kept');
  const audit = balanceChanges({}, { forge: { rate: { 5: 50 }, dropFrom: 16 } });
  ok(audit.includes('โอกาสสำเร็จ % +5 40 → 50') && audit.includes('ระดับเริ่มตกเมื่อล้ม +7 → ไม่มี'), `audit lists old → new (${audit})`);
}

// ---------------------------------------------------------- rules follow the tuning
{
  use({ rate: { 5: 100, 8: 0 }, pity: 10, dropFrom: 9, stoneFrom: 6, stonesPerTry: 3, costBase: 100, costPerLevel: 0, costMult: { 5: 2 }, bonusStep: { 1: 10 } });
  ok(successRate(fresh(4)) === 1, 'rate +5 tuned to 100%');
  ok(near(successRate(fresh(7, 4)), 0.4), 'rate +8 0% + pity 10% × 4 fails = 40%');
  ok(!dropsOnFail(fresh(6)) && !dropsOnFail(fresh(7)) && dropsOnFail(fresh(8)), 'drops only from +9 now');
  ok(stonesNeeded(fresh(4)) === 0 && stonesNeeded(fresh(5)) === 3, 'three stones from +6 now');
  ok(enhanceCost(fresh(4)) === 200, 'cost (100 + Lv×0) × 2');
  ok(bonusPct(1) === 10 && bonusPct(5) === 26, 'bonus steps add up with the tuned +1');

  // A fail at +7 aiming for +8: pity grows, no drop below +9.
  const a = fresh(7);
  ok(rollEnhance(a, () => 0.99, false) === 'fail' && a.plus === 7 && a.pity === 1, 'a fail at +8 keeps the level now');
  const b = fresh(8);
  ok(rollEnhance(b, () => 0.99, false) === 'drop' && b.plus === 7, 'a fail aiming at +9 drops');

  use({ dropFrom: 1, rate: { 1: 0 } });
  const z = fresh(0);
  ok(!dropsOnFail(z) && rollEnhance(z, () => 0.99, false) === 'fail' && z.plus === 0, 'drop level +1 never takes +0 below zero');
}

// ---------------------------------------------------------- the Sim uses it
{
  use({ cd: 5, announceFrom: 3, stoneFrom: 16 });
  const sim = new Sim(Object.values(ZONES)[0]);
  const data = newCharacterData('T', 'sword');
  data.level = 30;
  data.gold = 10_000_000;
  const item = fresh(0);
  data.bag = [item];
  const p = sim.addPlayer(data);
  const nearNpc = (sim as unknown as { near(p: Player, id: string): boolean }).near.bind(sim);
  outer: for (let x = -80; x <= 80; x++) for (let zz = -80; zz <= 80; zz++) {
    p.x = x;
    p.z = zz;
    if (nearNpc(p, 'blacksmith')) break outer;
  }
  ok(nearNpc(p, 'blacksmith'), 'standing at the blacksmith');
  p.forgeAt = -Infinity;
  ok(sim.enhance(p, item.uid, false)?.result === 'success', 'enhance +1 (100%)');
  sim.time += 2;
  ok(sim.enhance(p, item.uid, false) === null, 'the tuned 5 s cooldown still holds after 2 s');
  sim.time += 3.1;
  ok(sim.enhance(p, item.uid, false)?.result === 'success', 'allowed again after 5 s');
  sim.time += 5.1;
  (sim as unknown as { events: unknown[] }).events.length = 0;
  ok(sim.enhance(p, item.uid, false)?.result === 'success' && item.plus === 3, 'to +3');
  ok((sim as unknown as { events: { t: string }[] }).events.some((e) => e.t === 'announce'), 'announced from +3 now');

  // Lowering the max: gear above it keeps level, stats and orb; it just can't go higher.
  use({ maxPlus: 2, cd: 5 });
  const stats3 = JSON.stringify(effectiveStats(item));
  sim.time += 10;
  ok(!canEnhance(item) && sim.enhance(p, item.uid, false) === null && item.plus === 3, 'over the max: enhancing refused, level kept');
  use({ maxPlus: 2, cd: 5, rate: {} });
  const top = fresh(PLUS_CAP);
  const topStats = JSON.stringify(effectiveStats(top));
  applyBalance({});
  ok(JSON.stringify(effectiveStats(top)) === topStats && JSON.stringify(effectiveStats(item)) === stats3, 'a lower max never cuts the bonus of gear above it');
  use({ maxPlus: 10 });
  ok(JSON.stringify(effectiveStats(top)) === topStats && bonusPct(15) === 95, '+15 gear keeps its full bonus under max +10');
  ok(orbCodes({ weapon: top }).length === 1 && auraTier(15) === 4, '+15 gear keeps its orb and aura under max +10');
}

// ---------------------------------------------------------- orbs, aura and sell value
{
  use({ orbMin: 10, aura: [3, 5, 16, 16], sellPerPlus: 0 });
  ok(orbCodes({ weapon: fresh(9) }).length === 0 && orbCodes({ weapon: fresh(10) }).length === 1, 'orbs from +10 now');
  ok(auraTier(2) === 0 && auraTier(3) === 1 && auraTier(15) === 2, 'aura tiers +3/+5, the last two never');
  const s = fresh(5);
  ok(sellValue(s) === s.value, 'no sell bonus at 0%');
  use({ orbMin: 16 });
  ok(orbCodes({ weapon: fresh(15) }).length === 0, 'orbs off with +16');
}

applyBalance({});
finish('forge-tuning');
