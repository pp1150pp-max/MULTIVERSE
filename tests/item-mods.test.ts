// The three item-only mods (owner 2026-11-19): "ลดคูลดาวน์สกิล %" (cdr), "เพิ่มเวลาบัฟ %" (buffDur) and
// "เจาะเกราะ %" (armorPen). Their ranges (a legendary Lv40 T1 tops out at 3.0%), the extra-line weights and the
// cooldown cap on /admin, that they work on a real Sim (cooldowns shorter, buffs longer, more damage through
// DEF, enhancement adds to them), and that items saved before them do not change. No server.
import { ok, finish } from './check';
import { applyBalance, checkBalance, codeBalance, currentBalanceTuning } from '../src/shared/balance';
import { CLASSES, isLearnable, type SkillDef } from '../src/shared/data/classes';
import { makeItem, rollItem, rowRanges, statRerollOdds, tierRanges, upgradeItem } from '../src/shared/data/items';
import { effectiveStats } from '../src/shared/data/enhance';
import { ZONE_1 } from '../src/shared/data/zones';
import { mulberry32 } from '../src/shared/rng';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { castSkill } from '../src/shared/sim/skills';
import { ITEM_ONLY_STATS, STAT_KEYS, STAT_LABEL, type ClassId, type Item, type Stats } from '../src/shared/types';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const skill = (cls: ClassId, id: string): SkillDef => CLASSES[cls].skills.filter(isLearnable).find((s) => s.id === id)!;

// ---------------------------------------------------------- names and ranges
{
  ok(ITEM_ONLY_STATS.every((k) => STAT_KEYS.includes(k)), 'the three mods are stats');
  ok(STAT_LABEL.cdr === 'ลดคูลดาวน์สกิล %' && STAT_LABEL.buffDur === 'เพิ่มเวลาบัฟ %' && STAT_LABEL.armorPen === 'เจาะเกราะ %', 'Thai names');
  const t1 = (rarity: Item['rarity'], level: number, stat: 'cdr' | 'buffDur' | 'armorPen' = 'cdr') => {
    const [x] = rowRanges('ring_copper', rarity, level, [stat])!;
    return tierRanges(stat, level, x.lo, x.hi);
  };
  for (const k of ITEM_ONLY_STATS) {
    const t = t1('legendary', 40, k as 'cdr');
    ok(t[0].max === 3 && t[0].min === 2.6 && t[4].min === 1.2, `${k}: legendary Lv40 T1 2.6–3.0, T5 from 1.2 (${t.map((x) => `${x.min}-${x.max}`).join(' ')})`);
  }
  ok(t1('uncommon', 1)[0].max === 1 && t1('rare', 20)[0].max === 1.6 && t1('legendary', 1)[0].max === 1.5, 'grows with level and rarity (uncommon Lv1 T1 ≤1.0, rare Lv20 ≤1.6, legendary Lv1 ≤1.5)');
  ok(t1('legendary', 40).every((x) => Math.round(x.min * 10) === x.min * 10), 'one decimal');
}

// ---------------------------------------------------------- extra-line weights
{
  const odds = statRerollOdds();
  ok(odds.stats.length === 13 && odds.stats.every((s) => near(s.chance, 1 / 13)), 'code: all 13 extra stats equally likely');
  // /admin: cdr never, armorPen twice as likely.
  const t = checkBalance({ affixWeight: { cdr: 0, armorPen: 2, atk: 1 } }, true);
  ok(JSON.stringify(t.tuning) === '{"affixWeight":{"cdr":0,"armorPen":2}}', `weights saved only when not 1 (${JSON.stringify(t.tuning ?? t.error)})`);
  ok(checkBalance({ affixWeight: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) }, true).error !== undefined, 'refused: every weight 0');
  ok(checkBalance({ affixWeight: { cdr: 101 } }, true).error !== undefined && checkBalance({ affixWeight: { nope: 1 } }, true).error !== undefined, 'refused: out of range / unknown stat');
  const keep = currentBalanceTuning();
  applyBalance(t.tuning!);
  const o = statRerollOdds();
  const of = (k: string) => o.stats.find((s) => s.stat === k)!.chance;
  ok(of('cdr') === 0 && near(of('armorPen'), 2 / 13) && near(of('atk'), 1 / 13), 'odds table follows the weights');
  const r = mulberry32(7);
  let cdr = 0;
  let pen = 0;
  let atk = 0;
  for (let i = 0; i < 3000; i++) {
    const it = rollItem(r, 30, 'sword', 0, undefined, 'legendary');
    const extras = it.lines!.slice(it.slot === 'weapon' ? 2 : 0).map((l) => l.stat);
    if (extras.includes('cdr')) cdr++;
    if (extras.includes('armorPen')) pen++;
    if (extras.includes('atk')) atk++;
  }
  ok(cdr === 0, `weight 0: no drop rolls cdr as an extra (${cdr})`);
  ok(pen > atk, `weight 2 rolls more often than weight 1 (${pen} vs ${atk})`);
  applyBalance(keep);
  ok(near(statRerollOdds().stats.find((s) => s.stat === 'cdr')!.chance, 1 / 13), 'back to the code weights');
}

// ---------------------------------------------------------- cooldown cap on /admin, old tunings still load
{
  ok(codeBalance().cdrCap === 75, 'cooldown cut cap 75% in code');
  ok(JSON.stringify(checkBalance({ cdrCap: 50 }, true).tuning) === '{"cdrCap":50}' && checkBalance({ cdrCap: 96 }, true).error !== undefined, 'cap tunable 0–95');
  const old = { hpRegenMult: 0.5, itemStatMult: { atk: 1.2 }, statTiers: { crit: { floor: 30 } } };
  const back = checkBalance(old, false).tuning!;
  ok(back.hpRegenMult === 0.5 && back.itemStatMult?.atk === 1.2 && back.statTiers?.crit?.floor === 30 && Object.keys(back).length === 3,
    `a tuning saved before the mods loads unchanged (${JSON.stringify(back)})`);
}

// ---------------------------------------------------------- old items do not change
{
  // An item as saved before this change (current format: TIER_VERSION 3, lines with tiers).
  const saved: Item = {
    uid: 'old1', baseId: 'ring_frost', name: 'Frost Ring', slot: 'ring', rarity: 'legendary', level: 30,
    stats: { maxHp: 80, atk: 3, crit: 1.6, critDmg: 9.2, hpRegen: 2.4 }, value: 489, tierV: 3,
    lines: [
      { stat: 'maxHp', value: 80, tier: 2, min: 74, max: 85 },
      { stat: 'atk', value: 3, tier: 4, min: 3, max: 3 },
      { stat: 'crit', value: 1.6, tier: 2, min: 1.5, max: 1.7 },
      { stat: 'critDmg', value: 9.2, tier: 3, min: 8.1, max: 9.6 },
      { stat: 'hpRegen', value: 2.4, tier: 3, min: 2.2, max: 2.6 },
    ],
  };
  const before = JSON.stringify(saved);
  const same = upgradeItem(structuredClone(saved));
  ok(JSON.stringify(same) === before, 'a saved item comes back from upgradeItem exactly the same');
  // An item rolled before (its stats from the old 10) keeps its lines when the server reads it again.
  const made = makeItem('helm', 'epic', 20, 'sword', mulberry32(3))!;
  const madeJson = JSON.stringify(made);
  ok(JSON.stringify(upgradeItem(JSON.parse(madeJson) as Item)) === madeJson, 'a rolled item reads back the same');
  ok(!saved.lines!.some((l) => ITEM_ONLY_STATS.includes(l.stat)), 'no new mod is added to an old item');
}

// ---------------------------------------------------------- on a Sim
function setup(cls: ClassId, mods: Partial<Stats>, plus = 0): { sim: Sim; p: Player } {
  const sim = new Sim(ZONE_1);
  sim.monsters.length = 0;
  const p = sim.addPlayer({ ...newCharacterData('T', cls), level: 40 });
  if (Object.keys(mods).length) {
    const ring = makeItem('ring_copper', 'legendary', 40, cls)!;
    ring.stats = { ...mods };
    ring.lines = undefined;
    ring.plus = plus;
    p.equipment.ring = ring;
  }
  p.recompute();
  return { sim, p };
}

// Cooldowns
{
  const ww = skill('sword', 'whirlwind');
  const base = setup('sword', {}).p.skillCooldown(ww);
  const { p } = setup('sword', { cdr: 20 });
  ok(near(p.stats.cdr, 20), 'item cdr reaches the character stats');
  ok(near(p.skillCooldown(ww), Math.round(base * 0.8 * 100) / 100), `20% cut: ${base} → ${p.skillCooldown(ww)} s`);
  const ult = skill('sword', 'sw_unleash');
  ok(p.skillCooldown(ult) < setup('sword', {}).p.skillCooldown(ult), 'ultimates (R) are cut too');
  const basic = CLASSES.sword.skills.find((s) => s.kind === 'basic')!;
  const dash = CLASSES.sword.skills.find((s) => s.kind === 'dash')!;
  ok(p.skillCooldown(basic) === basic.cooldown && p.skillCooldown(dash) === dash.cooldown, 'basic attack and dash not cut');
  const capped = setup('sword', { cdr: 300 }).p;
  ok(near(capped.skillCooldown(ww), Math.round(base * 0.25 * 100) / 100), 'cut stops at the 75% cap');
  const keep = currentBalanceTuning();
  applyBalance({ cdrCap: 10 });
  ok(near(p.skillCooldown(ww), Math.round(base * 0.9 * 100) / 100), '/admin cap 10% holds a 20% cut at 10%');
  applyBalance(keep);
  const plus15 = setup('sword', { cdr: 3 }, 15).p;
  ok(near(plus15.stats.cdr, 5.8) && near(effectiveStats(plus15.equipment.ring!).cdr!, 5.8), `enhancement adds to the mods like every stat (+15: 3% → ${plus15.stats.cdr}%, owner: yes)`);
}

// Buffs
{
  const overdrive = skill('sword', 'sw_overdrive');
  const a = setup('sword', {});
  const b = setup('sword', { buffDur: 50 });
  castSkill(a.sim, a.p, overdrive, { x: 1, z: 0 }, 1);
  castSkill(b.sim, b.p, overdrive, { x: 1, z: 0 }, 1);
  const ta = a.p.statBuffs.find((x) => x.id === 'sw_overdrive')!.until - a.sim.time;
  const tb = b.p.statBuffs.find((x) => x.id === 'sw_overdrive')!.until - b.sim.time;
  ok(near(tb, ta * 1.5), `sword Overdrive +50%: ${ta} → ${tb} s`);
  const guard = skill('sword', 'sw_guard');
  castSkill(a.sim, a.p, guard, { x: 1, z: 0 }, 1);
  castSkill(b.sim, b.p, guard, { x: 1, z: 0 }, 1);
  ok(near(b.p.takenUntil - b.sim.time, (a.p.takenUntil - a.sim.time) * 1.5) && near(b.p.shieldUntil - b.sim.time, (a.p.shieldUntil - a.sim.time) * 1.5), 'Guard: damage cut and shield last 50% longer');

  const m1 = setup('mage', {});
  const m2 = setup('mage', { buffDur: 20 });
  const shield = skill('mage', 'mg_manashield');
  castSkill(m1.sim, m1.p, shield, { x: 1, z: 0 }, 1);
  castSkill(m2.sim, m2.p, shield, { x: 1, z: 0 }, 1);
  ok(near(m2.p.shieldUntil - m2.sim.time, (m1.p.shieldUntil - m1.sim.time) * 1.2), 'mage Mana Shield +20%');

  const g1 = setup('gunslinger', {});
  const g2 = setup('gunslinger', { buffDur: 30 });
  const reload = skill('gunslinger', 'gs_quickreload');
  castSkill(g1.sim, g1.p, reload, { x: 1, z: 0 }, 1);
  castSkill(g2.sim, g2.p, reload, { x: 1, z: 0 }, 1);
  const tg = (s: { sim: Sim; p: Player }) => s.p.statBuffs.find((x) => x.id === 'gs_quickreload')!.until - s.sim.time;
  ok(near(tg(g2), tg(g1) * 1.3), 'gunslinger Quick Reload +30%');
  // Summons (turret, drone, land mine) last longer too, unless the buffDurSummons switch is off.
  ok(near(g2.p.summonTime(10), 13) && near(g1.p.summonTime(10), 10), 'summon life +30%');
  applyBalance({ buffDurSummons: false });
  ok(near(g2.p.summonTime(10), 10), 'switch off: summons not lengthened');
  applyBalance({});
  ok(JSON.stringify(checkBalance({ buffDurSummons: true }, true).tuning) === '{}' && checkBalance({ buffDurSummons: 1 }, true).error !== undefined, 'summon switch: code value not saved, non-boolean refused');
}

// Armor pierce
{
  const hit = (pen: number, def: number): number => {
    const { sim, p } = setup('sword', pen ? { armorPen: pen } : {});
    const s = new Sim(ZONE_1);
    const m = s.monsters.find((x) => !x.isBoss)!;
    sim.monsters.push(m);
    m.x = 1;
    m.z = 0;
    m.hp = 1e7;
    m.level = 1;
    m.defense = def;
    p.stats.crit = 0;
    p.stats.atk = 1000;
    const rand = Math.random;
    Math.random = () => 0.5;
    try {
      const hp = m.hp;
      sim.hitMonster(p, m, 1);
      return hp - m.hp;
    } finally {
      Math.random = rand;
    }
  };
  const d0 = hit(0, 60);
  const d30 = hit(30, 60);
  ok(near(d30 / d0, 120 / 102, 0.01), `30% pierce on DEF 60: ${d0} → ${d30} (×${(d30 / d0).toFixed(3)}, expected ×${(120 / 102).toFixed(3)})`);
  ok(hit(30, 0) === hit(0, 0), 'no DEF: pierce changes nothing');
}

finish('item-mods');
