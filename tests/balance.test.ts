// Server-wide game balance (the /admin "ปรับสมดุล" tab, src/shared/balance.ts): the checks on what may be
// saved, that the code's own numbers are unchanged, that tuned tier tables only relabel saved items (values
// never change), and the /admin API against a real game server this script starts on a free port with a
// throwaway database (never the real server or server/data): owner and GM save (until the owner switches
// GM off), bad values refused, audit log, players online get new stats at once, reset to the code.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  applyBalance, BALANCE_SETTING, balanceChanges, checkBalance, classStatsAt, codeBalance, currentBalanceTuning, mergeBalance, tierLabelsChange, withItemStatMult,
} from '../src/shared/balance';
import { CLASSES, CLASS_IDS } from '../src/shared/data/classes';
import { ITEM_BASES, lineRanges, makeItem, rerollStat, rerollValues, rollItem, roundStat, rowRanges, statRerollOdds, tierChances, tierRanges, upgradeItem } from '../src/shared/data/items';
import { ZONE_HUB } from '../src/shared/data/zones';
import { mulberry32 } from '../src/shared/rng';
import { newCharacterData } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import type { Item } from '../src/shared/types';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-balance-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ---------------------------------------------------------- the code's own numbers (no server)
{
  const b = codeBalance();
  for (const id of CLASS_IDS) {
    const c = CLASSES[id];
    ok(b.classes[id].base.atk === c.base.atk && b.classes[id].growth.maxHp === (c.growth.maxHp ?? 0), `${id}: code Lv1/per-level numbers read from classes.ts`);
  }
  ok(b.classes.sword.mult.atk === 2 && b.classes.sword.mult.maxHp === 2 && b.classes.sword.mult.def === 2 && b.classes.sword.mult.crit === 1 && b.classes.mage.mult.atk === 1, 'sword ×2 ATK/HP/DEF, everything else ×1');
  ok(b.classes.sword.bossDmgMult === 2 && b.classes.gunslinger.bossDmgMult === 1, 'sword hits bosses ×2');
  ok(b.hpRegenMult === 0.4 && b.mpRegenMult === 0.25, 'regen cuts 0.4 / 0.25');
  ok(b.tierWeight.join() === '3,9,18,30,40' && b.tierWidth.join() === '25,25,25,15,10' && b.rangeFloor === 40 && b.bossTierBoost === 1.5, 'tier tables as in code');
  ok(JSON.stringify(currentBalanceTuning()) === '{}', 'nothing applied = the code');

  const s1 = classStatsAt('sword', 1);
  ok(s1.maxHp === 260 && s1.atk === 24 && s1.def === 12 && near(s1.hpRegen, 1.2 * 0.4) && near(s1.mpRegen, 5), 'sword Lv1 preview: HP 260, ATK 24, DEF 12, regen cut');
  const s50 = classStatsAt('mage', 50);
  ok(near(s50.maxHp, 90 + 12 * 49) && near(s50.atk, 14 + 3 * 49), 'mage Lv50 preview adds 49 levels of growth');

  // The preview and the real character agree (nothing worn).
  const sim = new Sim(ZONE_HUB);
  for (const id of CLASS_IDS) {
    const data = newCharacterData('B', id);
    data.equipment = {};
    data.level = 10;
    const p = sim.addPlayer(data);
    const pre = classStatsAt(id, 10);
    ok(Object.entries(pre).every(([k, v]) => near(v, p.stats[k as keyof typeof pre])), `${id}: Lv10 preview = the character's real stats`);
  }
}

// ---------------------------------------------------------- checks on what may be saved
{
  ok(JSON.stringify(checkBalance({ classes: { sword: { base: { atk: 12 } } }, rangeFloor: 40, tierWeight: [3, 9, 18, 30, 40] }, true).tuning) === '{}', 'values equal to the code are not stored');
  ok(checkBalance({ classes: { mage: { growth: { atk: 3.12345 } } } }, true).tuning?.classes?.mage?.growth?.atk === 3.123, 'numbers rounded to 3 decimals');
  ok(JSON.stringify(checkBalance(codeBalance(), true).tuning) === '{}', 'the whole code balance sent back stores nothing');
  for (const [what, t] of [
    ['HP over 100,000', { classes: { sword: { base: { maxHp: 100001 } } } }],
    ['negative ATK', { classes: { sword: { growth: { atk: -1 } } } }],
    ['crit over 100', { classes: { mage: { base: { crit: 101 } } } }],
    ['multiplier over 10', { classes: { mage: { mult: { atk: 11 } } } }],
    ['boss multiplier under 0.1', { classes: { mage: { bossDmgMult: 0 } } }],
    ['regen cut over 5', { hpRegenMult: 6 }],
    ['unknown class', { classes: { ninja: { base: { atk: 1 } } } }],
    ['unknown stat', { classes: { sword: { base: { luck: 1 } } } }],
    ['unknown part', { classes: { sword: { extra: {} } } }],
    ['unknown key', { hack: 1 }],
    ['number as text', { hpRegenMult: '0.5' }],
    ['widths not 100', { tierWidth: [20, 20, 20, 20, 10] }],
    ['4 widths', { tierWidth: [25, 25, 25, 25] }],
    ['width under 1', { tierWidth: [0.5, 25, 25, 25, 24.5] }],
    ['all chances 0', { tierWeight: [0, 0, 0, 0, 0] }],
    ['chance over 1000', { tierWeight: [1001, 9, 18, 30, 40] }],
    ['floor 2%', { rangeFloor: 2 }],
    ['boss boost 11', { bossTierBoost: 11 }],
    ['not an object', 'x'],
  ] as const) {
    ok(!!checkBalance(t, true).error, `refused: ${what}`);
  }
  const lenient = checkBalance({ classes: { ninja: { base: { atk: 1 } }, sword: { base: { atk: 99999999, def: 7 } } }, tierWidth: [1, 2, 3], rangeFloor: 50 }, false).tuning;
  ok(JSON.stringify(lenient) === '{"classes":{"sword":{"base":{"def":7}}},"rangeFloor":50}', 'read back leniently: bad entries dropped, the rest kept');
  ok(balanceChanges({}, { classes: { sword: { base: { atk: 15 } } } }) === 'นักดาบ Lv1 พลังโจมตี 12 → 15', 'audit text lists what changed');
}

// ---------------------------------------------------------- applying: class stats, tiers
{
  applyBalance({ classes: { gunslinger: { growth: { crit: 0.5 }, mult: { atk: 1.5 } } }, hpRegenMult: 1 });
  const g = classStatsAt('gunslinger', 11);
  ok(near(g.crit, 12 + 5) && near(g.atk, (9 + 2 * 10) * 1.5), 'tuned growth and multiplier used');
  ok(near(classStatsAt('mage', 1).hpRegen, 0.8), 'tuned regen cut used');
  const sim = new Sim(ZONE_HUB);
  const p = sim.addPlayer(newCharacterData('G', 'gunslinger'));
  p.equipment = {};
  p.level = 11;
  p.recompute();
  ok(near(p.stats.crit, 17), 'a character uses the tuned numbers');
  applyBalance({});

  // Ranges stay put when only the chances change (owner 2026-11-11), and the chances do change.
  const before = JSON.stringify(rowRanges('weapon_3', 'rare', 10, ['atk', 'crit', 'def']));
  applyBalance({ tierWeight: [40, 30, 18, 9, 3] });
  ok(JSON.stringify(rowRanges('weapon_3', 'rare', 10, ['atk', 'crit', 'def'])) === before, 'changing the tier chances does not move any range');
  ok(near(statRerollOdds().tiers[0], 0.4), 'the blacksmith odds use the tuned chances');
  applyBalance({});
  ok(near(statRerollOdds().tiers[0], 0.03), 'back to the code chances');

  // Boss tier boost changes the tiers only, not the rarity.
  const rarities = (seed: number) => Array.from({ length: 200 }, (_, i) => rollItem(mulberry32(seed + i), 20, 'mage', 1.5).rarity).join();
  const r0 = rarities(7);
  applyBalance({ bossTierBoost: 0 });
  ok(rarities(7) === r0, 'the boss tier boost leaves the boss rarity odds alone');
  applyBalance({});

  // Widths / floor: saved items keep their values, only the labels are redone (and back again).
  const items: Item[] = Array.from({ length: 40 }, (_, i) => makeItem('weapon_5', 'legendary', 20, 'sword', mulberry32(100 + i))!);
  const orig = JSON.stringify(items);
  ok(items.every((it) => it.tierK === undefined && it.tierV === 3), 'untuned items carry no tuning key');
  applyBalance({ tierWidth: [10, 20, 30, 20, 20], rangeFloor: 30 });
  const copy = structuredClone(items).map((it) => upgradeItem(it));
  ok(copy.every((it, i) => it.lines!.every((l, j) => l.value === items[i].lines![j].value)) && JSON.stringify(copy.map((it) => it.stats)) === JSON.stringify(items.map((it) => it.stats)), 'tuned widths: every value stays the same');
  ok(copy.some((it, i) => it.lines!.some((l, j) => l.tier !== items[i].lines![j].tier || l.min !== items[i].lines![j].min)), 'tuned widths: tier labels / ranges are redone');
  ok(copy.every((it) => it.tierK === '10,20,30,20,20|30'), 'relabelled items remember the tables they follow');
  const again = JSON.stringify(copy);
  copy.forEach((it) => upgradeItem(it));
  ok(JSON.stringify(copy) === again, 'relabelling twice changes nothing');
  ok(makeItem('cap', 'common', 1, 'mage')!.tierK === '10,20,30,20,20|30', 'new drops carry the key');
  applyBalance({});
  copy.forEach((it) => upgradeItem(it));
  ok(JSON.stringify(copy) === orig, 'back to the code tables: the items are exactly as before');
  // A chances-only tuning keeps the key empty (ranges unchanged, nothing to relabel).
  applyBalance({ tierWeight: [10, 10, 20, 30, 30] });
  ok(makeItem('cap', 'common', 1, 'mage')!.tierK === undefined, 'chances alone do not mark items');
  applyBalance({});
  ok(JSON.stringify(mergeBalance({})) === JSON.stringify(codeBalance()), 'an empty tuning is the code');
}

// ---------------------------------------------------------- each stat's own tier table (owner 2026-11-11)
{
  // What may be saved: a listed stat is kept even when its numbers equal the code (listing it is the change).
  const same = checkBalance({ statTiers: { moveSpeed: { floor: 40, weight: [3, 9, 18, 30, 40] } } }, true).tuning;
  ok(JSON.stringify(same) === '{"statTiers":{"moveSpeed":{"weight":[3,9,18,30,40],"floor":40}}}', 'a stat\'s own table is kept even with code numbers, parts in a fixed order');
  const order = checkBalance({ statTiers: { moveSpeed: { floor: 20 }, atk: { bossBoost: 0 } } }, true).tuning;
  ok(JSON.stringify(order) === '{"statTiers":{"atk":{"bossBoost":0},"moveSpeed":{"floor":20}}}', 'stats come in STAT_KEYS order');
  for (const [what, t] of [
    ['unknown stat', { statTiers: { luck: { floor: 20 } } }],
    ['unknown part', { statTiers: { moveSpeed: { colour: 1 } } }],
    ['not an object', { statTiers: [1] }],
    ['own widths not 100', { statTiers: { moveSpeed: { width: [20, 20, 20, 20, 10] } } }],
    ['own chances all 0', { statTiers: { moveSpeed: { weight: [0, 0, 0, 0, 0] } } }],
    ['own floor 2%', { statTiers: { moveSpeed: { floor: 2 } } }],
    ['own boss boost 11', { statTiers: { moveSpeed: { bossBoost: 11 } } }],
  ] as const) {
    ok(!!checkBalance(t, true).error, `refused: ${what}`);
  }
  const lenient = checkBalance({ statTiers: { luck: { floor: 20 }, moveSpeed: { floor: 2, width: [10, 20, 30, 20, 20] }, atk: { floor: 1 } } }, false).tuning;
  ok(JSON.stringify(lenient) === '{"statTiers":{"moveSpeed":{"width":[10,20,30,20,20]}}}', 'own tables read back leniently: bad parts dropped, empty stats dropped');
  ok(balanceChanges({}, { statTiers: { moveSpeed: { floor: 20 } } }).endsWith('ค่าต่ำสุด ไม่ได้ตั้ง → 20%'), 'audit text names the stat\'s own table');
  ok(tierLabelsChange({}, { statTiers: { moveSpeed: { floor: 20 } } }) && !tierLabelsChange({}, { statTiers: { moveSpeed: { weight: [1, 1, 1, 1, 1] } } }),
    'only own widths/floor change labels, own chances do not');

  // Chances: each stat rolls from its own; the ranges never move.
  const stats = ['atk', 'crit', 'moveSpeed'] as const;
  const before = JSON.stringify(rowRanges('weapon_3', 'rare', 10, [...stats]));
  applyBalance({ statTiers: { moveSpeed: { weight: [100, 0, 0, 0, 0], bossBoost: 0 } } });
  ok(JSON.stringify(rowRanges('weapon_3', 'rare', 10, [...stats])) === before, 'a stat\'s own chances do not move any range');
  ok(near(tierChances('moveSpeed', 1)[0], 1) && near(tierChances('atk', 1)[0], 0.03), 'the stat uses its own chances, the others the central ones');
  ok(near(tierChances('moveSpeed', 1, true)[0], 1) && tierChances('atk', 1, true)[0] > 0.03, 'boss boost per stat (own 0, central 1.5)');
  ok(near(statRerollOdds().tiers[0], 0.9 * 0.03 + 0.1 * 1), 'the blacksmith row is every stat\'s chances together');
  const drops = Array.from({ length: 400 }, (_, i) => rollItem(mulberry32(500 + i), 20, 'mage', 1.5)).flatMap((it) => it.lines ?? []);
  const move = drops.filter((l) => l.stat === 'moveSpeed');
  ok(move.length > 10 && move.every((l) => l.tier === 1), `real drops: every moveSpeed line rolls T1 (${move.length} lines)`);
  ok(drops.some((l) => l.stat !== 'moveSpeed' && l.tier !== 1), 'real drops: the other stats still roll every tier');
  ok(makeItem('cap', 'common', 1, 'mage')!.tierK === undefined, 'own chances alone do not mark items');

  // Widths / floor: only items carrying that stat are relabelled, values never change, and back again.
  applyBalance({});
  const items: Item[] = Array.from({ length: 300 }, (_, i) => rollItem(mulberry32(900 + i), 20, 'sword'));
  const orig = JSON.stringify(items);
  const has = (it: Item) => it.lines!.some((l) => l.stat === 'moveSpeed');
  ok(items.some(has) && items.some((it) => !has(it)), 'test items both with and without a moveSpeed line');
  applyBalance({ statTiers: { moveSpeed: { floor: 10, width: [40, 30, 15, 10, 5] } } });
  const copy = structuredClone(items).map((it) => upgradeItem(it));
  ok(copy.every((it, i) => JSON.stringify(it.stats) === JSON.stringify(items[i].stats) && it.lines!.every((l, j) => l.value === items[i].lines![j].value)), 'own widths: every value stays the same');
  ok(copy.every((it, i) => has(it) ? it.tierK === ';moveSpeed=40,30,15,10,5|10' : JSON.stringify(it) === JSON.stringify(items[i])), 'only items with the stat get the key; the rest are untouched');
  ok(copy.every((it, i) => it.lines!.every((l, j) => l.stat === 'moveSpeed' || (l.tier === items[i].lines![j].tier && l.min === items[i].lines![j].min))), 'other lines keep their labels');
  ok(copy.some((it, i) => it.lines!.some((l, j) => l.stat === 'moveSpeed' && (l.tier !== items[i].lines![j].tier || l.min !== items[i].lines![j].min))), 'moveSpeed lines are relabelled');
  // Central tuned too: the central part of the key keeps its old form.
  applyBalance({ tierWidth: [10, 20, 30, 20, 20], statTiers: { moveSpeed: { floor: 10, width: [40, 30, 15, 10, 5] } } });
  copy.forEach((it) => upgradeItem(it));
  ok(copy.every((it) => it.tierK === (has(it) ? '10,20,30,20,20|40;moveSpeed=40,30,15,10,5|10' : '10,20,30,20,20|40')), 'central key unchanged in form, the stat added after it');
  // A stat set back to the code numbers while the central table is tuned keeps the code labels.
  applyBalance({ rangeFloor: 30, statTiers: { moveSpeed: { width: [25, 25, 25, 15, 10], floor: 40 } } });
  applyBalance({});
  const codeMove = JSON.stringify(rowRanges('weapon_3', 'rare', 10, ['moveSpeed']));
  const codeAtk = JSON.stringify(rowRanges('weapon_3', 'rare', 10, ['atk']));
  applyBalance({ rangeFloor: 30, statTiers: { moveSpeed: { width: [25, 25, 25, 15, 10], floor: 40 } } });
  ok(JSON.stringify(rowRanges('weapon_3', 'rare', 10, ['moveSpeed'])) === codeMove && JSON.stringify(rowRanges('weapon_3', 'rare', 10, ['atk'])) !== codeAtk,
    'an own table with the code numbers keeps that stat on the code ranges while the central one moves');
  applyBalance({});
  copy.forEach((it) => upgradeItem(it));
  ok(JSON.stringify(copy) === orig, 'back to the code tables: the items are exactly as before');

  // The blacksmith rolls each stat from its own table too.
  applyBalance({ statTiers: { moveSpeed: { weight: [100, 0, 0, 0, 0], floor: 10, width: [40, 30, 15, 10, 5] } } });
  const rare = items.filter((it) => it.rarity === 'rare' || it.rarity === 'epic').map((it) => upgradeItem(structuredClone(it)));
  let n = 0;
  let t1 = 0;
  let expect = 0;
  let moveOk = true;
  for (let i = 0; i < 3000; i++) {
    const it = structuredClone(rare[i % rare.length]);
    expect += statRerollOdds(it).tiers[0];
    const at = rerollStat(it, mulberry32(7000 + i));
    const l = it.lines![at];
    n++;
    if (l.tier === 1) t1++;
    if (l.stat === 'moveSpeed' && l.tier !== 1) moveOk = false;
  }
  ok(moveOk, 'สุ่มสเตตัส: a new moveSpeed line always rolls T1 from its own chances');
  ok(Math.abs(t1 / n - expect / n) < 0.02, `สุ่มสเตตัส: T1 rate ${(t1 / n).toFixed(3)} matches the odds row ${(expect / n).toFixed(3)}`);
  const withMove = items.filter(has).map((it) => upgradeItem(structuredClone(it)));
  let inRange = true;
  for (const [i, it] of withMove.entries()) {
    rerollValues(it, mulberry32(8000 + i));
    const r = lineRanges(it)!;
    it.lines!.forEach((l, j) => {
      const t = tierRanges(l.stat, it.level, r[j].lo, r[j].hi)[l.tier - 1];
      if (l.value < t.min - 1e-9 || l.value > t.max + 1e-9 || l.min !== t.min || l.max !== t.max) inRange = false;
    });
  }
  ok(inRange && withMove.length > 0, 'สุ่มค่าตัวเลข: every line (moveSpeed on its own widths) lands in its tier range');
  ok(withMove.every((it) => it.tierK === ';moveSpeed=40,30,15,10,5|10'), 'rerolled items carry the key of the stats on them');
  applyBalance({});
}

// ---------------------------------------------------------- tier tables per item-level band (owner 2026-11-11)
{
  // What may be saved.
  const t = checkBalance({ bandTiers: { '31-40': { floor: 20 }, '1-10': { bossBoost: 0 } }, statTiers: { moveSpeed: { bands: { '41-50': { weight: [1, 1, 1, 1, 1] } }, floor: 30 } } }, true).tuning;
  ok(JSON.stringify(t) === '{"statTiers":{"moveSpeed":{"floor":30,"bands":{"41-50":{"weight":[1,1,1,1,1]}}}},"bandTiers":{"1-10":{"bossBoost":0},"31-40":{"floor":20}}}',
    'band tables kept in TIER_BANDS order, a stat\'s bands after its own parts');
  for (const [what, x] of [
    ['unknown band', { bandTiers: { '51-60': { floor: 20 } } }],
    ['unknown band of a stat', { statTiers: { atk: { bands: { '0-9': { floor: 20 } } } } }],
    ['band floor 2%', { bandTiers: { '11-20': { floor: 2 } } }],
    ['stat band widths not 100', { statTiers: { atk: { bands: { '11-20': { width: [50, 50, 50, 50, 50] } } } } }],
    ['bands not an object', { bandTiers: [1] }],
  ] as const) {
    ok(!!checkBalance(x, true).error, `refused: ${what}`);
  }
  ok(JSON.stringify(checkBalance({ bandTiers: { '51-60': { floor: 20 }, '11-20': { floor: 2, bossBoost: 3 } } }, false).tuning) === '{"bandTiers":{"11-20":{"bossBoost":3}}}', 'band tables read back leniently');
  ok(balanceChanges({}, { bandTiers: { '31-40': { floor: 20 } } }).includes('Lv31–40 ค่าต่ำสุด ไม่ได้ตั้ง → 20%'), 'audit text names the band');
  ok(tierLabelsChange({}, { bandTiers: { '31-40': { floor: 20 } } }) && tierLabelsChange({}, { statTiers: { atk: { bands: { '1-10': { width: [40, 30, 15, 10, 5] } } } } }), 'band widths/floor change labels');

  // Which table wins, part by part: stat+band → stat → band → central.
  applyBalance({
    tierWeight: [1, 0, 0, 0, 0],
    bandTiers: { '31-40': { weight: [0, 1, 0, 0, 0] } },
    statTiers: { moveSpeed: { weight: [0, 0, 1, 0, 0], bands: { '31-40': { weight: [0, 0, 0, 1, 0] } } }, atk: { bossBoost: 0 } },
  });
  const top = (stat: 'moveSpeed' | 'atk' | 'def', level: number) => tierChances(stat, level).indexOf(1) + 1;
  ok(top('def', 5) === 1 && top('def', 35) === 2 && top('atk', 35) === 2 && top('moveSpeed', 5) === 3 && top('moveSpeed', 35) === 4,
    'stat+band → stat → band → central (def Lv5 T1, def/atk Lv35 T2, moveSpeed Lv5 T3, moveSpeed Lv35 T4)');
  ok(top('atk', 40) === 2 && top('atk', 41) === 1 && top('atk', 31) === 2 && top('atk', 30) === 1, 'band edges: Lv31–40 in, 30 and 41 out');
  const drops = (level: number) => Array.from({ length: 150 }, (_, i) => rollItem(mulberry32(40 + i), level, 'gunslinger')).flatMap((it) => it.lines ?? []);
  ok(drops(35).every((l) => l.tier === (l.stat === 'moveSpeed' ? 4 : 2)) && drops(15).every((l) => l.tier === (l.stat === 'moveSpeed' ? 3 : 1)), 'real drops follow the item level\'s band');
  applyBalance({});

  // Widths / floor of one band: only items of that level are relabelled; values never change.
  const items: Item[] = [15, 35, 45].flatMap((lv) => Array.from({ length: 30 }, (_, i) => rollItem(mulberry32(lv * 100 + i), lv, 'mage')));
  const orig = JSON.stringify(items);
  applyBalance({ bandTiers: { '31-40': { floor: 15, width: [10, 20, 30, 20, 20] } } });
  const copy = structuredClone(items).map((it) => upgradeItem(it));
  ok(copy.every((it, i) => JSON.stringify(it.stats) === JSON.stringify(items[i].stats)), 'band widths: every value stays the same');
  ok(copy.every((it, i) => it.level === 35 ? it.tierK === '10,20,30,20,20|15' : JSON.stringify(it) === JSON.stringify(items[i])), 'only items of Lv31–40 get the key; the others are untouched');
  ok(copy.some((it, i) => it.level === 35 && it.lines!.some((l, j) => l.tier !== items[i].lines![j].tier || l.min !== items[i].lines![j].min)), 'Lv31–40 items are relabelled');
  applyBalance({});
  copy.forEach((it) => upgradeItem(it));
  ok(JSON.stringify(copy) === orig, 'back to the code tables: the items are exactly as before');
}

// ---------------------------------------------------------- item stat multipliers (owner 2026-11-11)
{
  // What may be saved: ×1 is left out, keys in STAT_KEYS order, 0.1–10.
  ok(JSON.stringify(checkBalance({ itemStatMult: { moveSpeed: 0.75, atk: 1, crit: 2 } }, true).tuning) === '{"itemStatMult":{"crit":2,"moveSpeed":0.75}}', 'multipliers kept without ×1, in order');
  for (const [what, x] of [['0.05', { itemStatMult: { atk: 0.05 } }], ['11', { itemStatMult: { atk: 11 } }], ['unknown stat', { itemStatMult: { luck: 2 } }], ['not an object', { itemStatMult: 2 }]] as const) {
    ok(!!checkBalance(x, true).error, `multiplier refused: ${what}`);
  }
  ok(balanceChanges({}, { itemStatMult: { moveSpeed: 0.75 } }).includes('×1 → ×0.75'), 'audit text names the multiplier');
  const kept = withItemStatMult({ rangeFloor: 30, itemStatMult: { atk: 2 } }, { moveSpeed: 0.5 });
  ok(JSON.stringify(kept) === '{"rangeFloor":30,"itemStatMult":{"moveSpeed":0.5}}' && JSON.stringify(withItemStatMult(kept, undefined)) === '{"rangeFloor":30}', 'withItemStatMult swaps only the multipliers');

  // New rolls: the stat's whole range is scaled, the others stay.
  const stats = ['atk', 'crit', 'moveSpeed'] as const;
  const r0 = rowRanges('weapon_3', 'rare', 30, [...stats])!;
  applyBalance({ itemStatMult: { moveSpeed: 0.5 } });
  const r1 = rowRanges('weapon_3', 'rare', 30, [...stats])!;
  ok(near(r1[2].hi, r0[2].hi * 0.5) && near(r1[2].lo, r0[2].lo * 0.5) && r1[0].hi === r0[0].hi && r1[1].hi === r0[1].hi, 'the multiplier scales that stat\'s range only');
  const fresh = Array.from({ length: 50 }, (_, i) => rollItem(mulberry32(300 + i), 30, 'sword'));
  ok(fresh.every((it) => it.mulK === 'moveSpeed=0.5'), 'new drops carry the multipliers they were rolled under');
  ok(fresh.every((it) => JSON.stringify(upgradeItem(structuredClone(it))) === JSON.stringify(it)), 'and loading them changes nothing');
  applyBalance({});

  // Old items: every line of the stat (main ones too) is scaled once, rounded like the stat; labels redone.
  const boots = ITEM_BASES.filter((b) => b.main.moveSpeed).map((b) => b.id);
  const items: Item[] = [
    ...Array.from({ length: 60 }, (_, i) => rollItem(mulberry32(600 + i), 25, 'mage')),
    ...boots.flatMap((id, j) => Array.from({ length: 5 }, (_, i) => makeItem(id, 'epic', 25, 'mage', mulberry32(700 + j * 10 + i))!)),
  ];
  ok(boots.length > 0 && items.every((it) => it.mulK === undefined), 'items made at ×1 carry no multiplier key');
  const orig = structuredClone(items);
  applyBalance({ itemStatMult: { moveSpeed: 0.5, atk: 2 } });
  const copy = structuredClone(items).map((it) => upgradeItem(it));
  const scaledRight = copy.every((it, i) => it.lines!.every((l, j) => {
    const v = orig[i].lines![j].value;
    const want = l.stat === 'moveSpeed' ? roundStat(l.stat, v * 0.5) : l.stat === 'atk' ? roundStat(l.stat, v * 2) : v;
    return l.value === want;
  }));
  ok(scaledRight, 'old items: moveSpeed lines ×0.5, ATK lines ×2 (rounded), every other line as it was');
  ok(copy.some((it, i) => boots.includes(it.baseId) && it.lines![1].stat === 'moveSpeed' && it.lines![1].value !== orig[i].lines![1].value), 'main moveSpeed lines (boots) are scaled too');
  ok(copy.every((it) => it.mulK === 'atk=2;moveSpeed=0.5' && Object.entries(it.stats).every(([k, v]) => near(v as number, roundStat(k as never, it.lines!.filter((l) => l.stat === k).reduce((s, l) => s + l.value, 0))))), 'scaled items carry the key and their stats are the lines\' total');
  ok(copy.every((it) => it.lines!.every((l) => l.value >= l.min - 1e-9 || l.tier === 5)), 'tier labels redone against the scaled ranges');
  const once = JSON.stringify(copy);
  copy.forEach((it) => upgradeItem(it));
  ok(JSON.stringify(copy) === once, 'loading again never scales twice');
  // Back to ×1: values come back (within rounding), the key goes.
  applyBalance({});
  copy.forEach((it) => upgradeItem(it));
  ok(copy.every((it) => it.mulK === undefined), 'back to ×1: no key');
  ok(copy.every((it, i) => it.lines!.every((l, j) => Math.abs(l.value - orig[i].lines![j].value) <= 1)), 'back to ×1: values within one rounding step of the originals');
  // Items from before lines: their stats are scaled.
  const legacy = { uid: 'x1', baseId: boots[0], name: 'Old', slot: 'boots', rarity: 'common', level: 1, value: 1, stats: { moveSpeed: 4, def: 3 } } as unknown as Item;
  applyBalance({ itemStatMult: { moveSpeed: 0.5 } });
  upgradeItem(legacy);
  ok(legacy.stats.moveSpeed === 2 && legacy.stats.def === 3 && legacy.mulK === 'moveSpeed=0.5', 'items without lines: their stats are scaled');
  applyBalance({});
}

// ---------------------------------------------------------- against a real server
function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once('error', rej);
    s.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => res(port));
    });
  });
}

const dbRead = <T>(f: (db: DatabaseSync) => T): T => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  try {
    return f(db);
  } finally {
    db.close();
  }
};
const auditCount = (): number => dbRead((db) => (db.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action = 'balance'").get() as { n: number }).n);
const settingRow = (): string | null => dbRead((db) => (db.prepare('SELECT value FROM settings WHERE key = ?').get(BALANCE_SETTING) as { value: string } | undefined)?.value ?? null);

async function run(): Promise<void> {
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const startServer = async (): Promise<void> => {
    proc = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
      cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE }, stdio: ['ignore', 'ignore', 'inherit'],
    });
    for (let i = 0; ; i++) {
      try {
        await fetch(`${base}/api/me`);
        break;
      } catch {
        if (i > 100) throw new Error('test server did not start');
        await sleep(100);
      }
    }
  };
  await startServer();
  const api = async (method: string, path: string, body?: unknown, token?: string) => {
    const r = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
  };
  const joinWorld = (token: string, characterId: number) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`);
    const msgs: any[] = [];
    const ready = new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data));
        msgs.push(m);
        if (m.t === 'snap') {
          clearTimeout(t);
          res();
        }
      };
    });
    return { ws, msgs, ready };
  };
  const lastSnap = (msgs: any[]) => msgs.filter((m) => m.t === 'snap').at(-1);
  const lastInv = (msgs: any[]) => msgs.filter((m) => m.t === 'snap' && m.me?.inv).at(-1)?.me.inv;

  const tok: Record<string, string> = {};
  const chars: Record<string, number> = {};
  for (const u of ['owner1', 'gm1', 'plain1']) {
    tok[u] = (await api('POST', '/register', { username: u, password: 'secret123' })).data.token;
    chars[u] = (await api('POST', '/characters', { name: `C_${u}`, classId: 'sword' }, tok[u])).data.id;
  }
  spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE } });
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: 'gm' }, tok.owner1)).status === 200, 'gm1 made GM');

  // A fresh database: the code's numbers.
  const gmGet = await api('GET', '/admin/balance', undefined, tok.gm1);
  ok(gmGet.status === 200 && JSON.stringify(gmGet.data.tuning) === '{}', 'GM reads the balance (nothing saved yet)');
  ok((await api('GET', '/admin/balance', undefined, tok.plain1)).status === 403, 'a player cannot read it');
  ok((await api('POST', '/admin/balance', { tuning: { hpRegenMult: 1 } }, tok.plain1)).status === 403, 'a player cannot save it');
  ok(JSON.stringify((await api('GET', '/admin/meta', undefined, tok.gm1)).data.balance) === '{}', 'admin meta carries the balance');

  // Bad values are refused and change nothing.
  for (const [what, tuning] of [
    ['range', { classes: { sword: { base: { atk: 20000 } } } }],
    ['unknown class', { classes: { ninja: {} } }],
    ['widths', { tierWidth: [50, 50, 50, 50, 50] }],
    ['own table of an unknown stat', { statTiers: { luck: { floor: 20 } } }],
    ['not an object', 'x'],
  ] as const) {
    ok((await api('POST', '/admin/balance', { tuning }, tok.owner1)).status === 400, `bad ${what} refused`);
  }
  ok(auditCount() === 0 && settingRow() === null, 'refused saves leave no audit row and no setting');

  // A sword player online: new stats and relabelled items at once.
  const p1 = joinWorld(tok.plain1, chars.plain1);
  await p1.ready;
  ok(JSON.stringify(p1.msgs.find((m) => m.t === 'welcome')?.balance) === '{}', 'joining sends the (empty) balance in welcome');
  const hp0 = lastSnap(p1.msgs).me.stats.maxHp;
  const weapon0 = lastInv(p1.msgs)?.equipment?.weapon;
  ok(weapon0 && weapon0.tierK === undefined, 'the starter weapon has code labels');

  const tuning = { classes: { sword: { base: { maxHp: 200 } } }, tierWidth: [10, 20, 30, 20, 20] };
  const saved = await api('POST', '/admin/balance', { tuning }, tok.gm1);
  ok(saved.status === 200 && saved.data.tuning.classes?.sword?.base?.maxHp === 200, 'GM saves (on by default)');
  await sleep(400);
  ok(p1.msgs.filter((m) => m.t === 'balance').length === 1, 'a player online gets the new balance');
  ok(near(lastSnap(p1.msgs).me.stats.maxHp, hp0 + (200 - 130) * 2), `the player's stats are worked out again at once (${hp0} → ${lastSnap(p1.msgs).me.stats.maxHp})`);
  const weapon1 = lastInv(p1.msgs)?.equipment?.weapon;
  ok(weapon1?.tierK === '10,20,30,20,20|40' && weapon1.lines.every((l: any, i: number) => l.value === weapon0.lines[i].value), 'worn item relabelled for the new widths, values unchanged');
  ok(auditCount() === 1, 'the save is in the audit log');
  ok(JSON.parse(settingRow() ?? '{}').classes?.sword?.base?.maxHp === 200, 'saved in the settings table');
  await api('POST', '/admin/balance', { tuning }, tok.owner1);
  await sleep(200);
  ok(auditCount() === 1 && p1.msgs.filter((m) => m.t === 'balance').length === 1, 'saving the same again logs and sends nothing');

  // The saved numbers survive a server restart (main.ts applies them before anything is read).
  p1.ws.close();
  await sleep(300);
  const old = proc!;
  const exited = new Promise((r) => old.once('exit', r));
  old.kill();
  await exited;
  await startServer();
  const r1 = joinWorld(tok.plain1, chars.plain1);
  await r1.ready;
  ok(r1.msgs.find((m) => m.t === 'welcome')?.balance?.classes?.sword?.base?.maxHp === 200, 'after a restart, joining gets the saved balance');
  ok(near(lastSnap(r1.msgs).me.stats.maxHp, hp0 + (200 - 130) * 2), 'after a restart, the character uses the saved numbers');
  ok(lastInv(r1.msgs)?.equipment?.weapon?.tierK === '10,20,30,20,20|40', 'after a restart, items keep the tuned labels');
  p1.ws = r1.ws;
  p1.msgs = r1.msgs;

  // The owner switches the tool off for GMs.
  const defs = (await api('GET', '/admin/role-defs', undefined, tok.owner1)).data;
  const gm = defs.roles.find((r: any) => r.id === 'gm');
  const off = await api('POST', '/admin/role-defs', { id: 'gm', name: gm.name, features: gm.features.filter((f: string) => f !== 'balance') }, tok.owner1);
  ok(off.status === 200, 'owner turns "balance" off for GM');
  ok((await api('POST', '/admin/balance', { tuning: {} }, tok.gm1)).status === 403 && (await api('GET', '/admin/balance', undefined, tok.gm1)).status === 403, 'GM without the switch cannot read or save');

  // Back to the code.
  const reset = await api('POST', '/admin/balance', { reset: true }, tok.owner1);
  await sleep(400);
  ok(reset.status === 200 && JSON.stringify(reset.data.tuning) === '{}' && settingRow() === null, 'reset goes back to the code and removes the setting');
  ok(near(lastSnap(p1.msgs).me.stats.maxHp, hp0), 'the player is back to the code stats');
  ok(lastInv(p1.msgs)?.equipment?.weapon?.tierK === undefined, 'and the code labels');
  ok(auditCount() === 2, 'the reset is in the audit log');
  p1.ws.close();

  // Item stat multipliers: owner only, scales every item in play and saved, backs up first.
  const gmMult = await api('POST', '/admin/balance/item-mult', { mult: { atk: 2 } }, tok.gm1);
  ok(gmMult.status === 403, 'a GM cannot confirm item stat multipliers');
  ok((await api('POST', '/admin/balance/item-mult', { mult: { atk: 20 } }, tok.owner1)).status === 400, 'a multiplier out of range is refused');
  const p2 = joinWorld(tok.plain1, chars.plain1);
  await p2.ready;
  const w0 = lastInv(p2.msgs)?.equipment?.weapon;
  const atk0 = lastSnap(p2.msgs).me.stats.atk;
  const ownerChar0 = dbRead((db) => JSON.parse((db.prepare('SELECT data FROM characters WHERE id = ?').get(chars.owner1) as { data: string }).data));
  // A market listing (written straight into the test database) with its searchable stats.
  const listed = { ...structuredClone(ownerChar0.equipment.weapon), uid: 'test-listing-1' };
  const listedAtk = listed.stats.atk as number;
  const listingId = (() => {
    const db = new DatabaseSync(DB_FILE);
    try {
      const id = Number(db.prepare(`INSERT INTO market_listings (seller_account, seller_char, seller_name, entry, uid, name, kind, rarity, level, plus, cls, count, price, fee, created_at, expires_at, status)
        VALUES (1, ?, 'C_owner1', ?, ?, ?, 'equip', ?, ?, 0, 'sword', 1, 100, 5, ?, ?, 'active')`).run(
        chars.owner1, JSON.stringify(listed), listed.uid, listed.name, listed.rarity, listed.level, Date.now(), Date.now() + 3_600_000).lastInsertRowid);
      db.prepare("INSERT INTO market_listing_stats (listing_id, stat, value) VALUES (?, 'atk', ?)").run(id, listedAtk);
      return id;
    } finally {
      db.close();
    }
  })();
  const auditBefore = auditCount();
  const m = await api('POST', '/admin/balance/item-mult', { mult: { atk: 2 } }, tok.owner1);
  await sleep(400);
  ok(m.status === 200 && m.data.tuning.itemStatMult?.atk === 2 && typeof m.data.backup === 'string' && m.data.scaled?.characters >= 1, `owner confirms ×2 ATK (${JSON.stringify(m.data.scaled)}, ${m.data.ms} ms)`);
  ok(readdirSync(join(dir, 'backups')).some((f) => f.includes('before-item-mult')), 'a backup was made first');
  ok(auditCount() === auditBefore + 1, 'the confirm is in the audit log');
  const w1 = lastInv(p2.msgs)?.equipment?.weapon;
  ok(w1?.mulK === 'atk=2' && w1.lines.every((l: any, i: number) => l.value === (l.stat === 'atk' ? roundStat('atk', w0.lines[i].value * 2) : w0.lines[i].value)), 'the worn weapon of a player online is scaled at once');
  ok(lastSnap(p2.msgs).me.stats.atk > atk0, `the player's ATK went up at once (${atk0} → ${lastSnap(p2.msgs).me.stats.atk})`);
  const ownerChar1 = dbRead((db) => JSON.parse((db.prepare('SELECT data FROM characters WHERE id = ?').get(chars.owner1) as { data: string }).data));
  const wOff0 = ownerChar0.equipment.weapon;
  const wOff1 = ownerChar1.equipment.weapon;
  ok(wOff1.mulK === 'atk=2' && wOff1.lines.every((l: any, i: number) => l.value === (l.stat === 'atk' ? roundStat('atk', wOff0.lines[i].value * 2) : wOff0.lines[i].value)), 'an offline character\'s saved weapon is scaled in the database');
  const lst = dbRead((db) => ({
    entry: JSON.parse((db.prepare('SELECT entry FROM market_listings WHERE id = ?').get(listingId) as { entry: string }).entry),
    atk: (db.prepare("SELECT value FROM market_listing_stats WHERE listing_id = ? AND stat = 'atk'").get(listingId) as { value: number }).value,
  }));
  ok(m.data.scaled?.listings === 1 && lst.entry.mulK === 'atk=2' && lst.entry.stats.atk > listedAtk && lst.atk === lst.entry.stats.atk, `a market listing is scaled and its search stats redone (ATK ${listedAtk} → ${lst.atk})`);
  ok((await api('POST', '/admin/balance/item-mult', { mult: { atk: 2 } }, tok.owner1)).data.scaled === undefined && auditCount() === auditBefore + 1, 'confirming the same again does nothing');
  // The normal save (and its reset) never touch the multipliers.
  await api('POST', '/admin/balance', { tuning: { hpRegenMult: 1 } }, tok.owner1);
  ok(JSON.parse(settingRow() ?? '{}').itemStatMult?.atk === 2, 'a normal save keeps the multipliers');
  const rs = await api('POST', '/admin/balance', { reset: true }, tok.owner1);
  ok(JSON.stringify(rs.data.tuning) === '{"itemStatMult":{"atk":2}}', 'the reset keeps the multipliers too');
  p2.ws.close();
}

run()
  .catch((e) => ok(false, `crashed: ${(e as Error).stack ?? e}`))
  .finally(async () => {
    proc?.kill();
    await sleep(300);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may still hold the database for a moment; it is in the temp folder anyway.
    }
    finish('balance');
  });
