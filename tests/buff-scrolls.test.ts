// EXP and drop scrolls (owner 2026-11-12): +100% for 30 minutes of play, using another adds 30 minutes
// up to 5 hours, bound to the character, time only runs while online (saved with the character).
import { finish, ok } from './check';
import { ZONES, ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { cleanBuffs, Player } from '../src/shared/sim/Player';
import { IDLE_INTENT } from '../src/shared/sim/types';
import { BUFF_MAX, BUFF_TIME, stoneSellPrice } from '../src/shared/data/stones';
import { isBound } from '../src/shared/types';
import { marketSellable } from '../src/shared/sim/market';
import { makeOffer } from '../src/shared/trade';

const hero = () => ({ name: 'B', classId: 'sword' as const, level: 15, exp: 0, gold: 0, equipment: {}, bag: [] });
const TICK = 1 / 30;
const field = () => {
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer(hero());
  return { sim, p };
};

// ---- bound: no selling, dropping, trading, market or stash
{
  const { sim, p } = field();
  p.addStones('exp_scroll', 3);
  const i = p.bag.findIndex((e) => e && 'stone' in e && e.stone === 'exp_scroll');
  ok(isBound(p.bag[i]), 'EXP scroll is bound');
  ok(isBound({ stone: 'drop_scroll', count: 1 }), 'drop scroll is bound');
  ok(!marketSellable(p.bag[i]), 'not on the market');
  ok(typeof makeOffer(p.bag, i) === 'string', 'not tradeable');
  ok(sim.sellItem(p, i) === 0 && p.stoneCount('exp_scroll') === 3, 'merchant refuses it');
  ok(!sim.dropFromBag(p, i) && p.stoneCount('exp_scroll') === 3, 'can not be dropped');
  ok(stoneSellPrice('drop_scroll') === 0, 'no merchant price');
  const hub = new Sim(ZONE_HUB);
  const h = hub.addPlayer(p.toData());
  const keeper = hub.terrain.npcPos.keeper!;
  h.x = keeper.x + 1;
  h.z = keeper.z + 1;
  ok(!hub.stashPut(h, i) && !hub.stashSplit(h, 'bag', i, 'stash', 0, 1) && h.stoneCount('exp_scroll') === 3, 'not into the stash, not even part of it');
}

// ---- using: 30 min each, stacks up to 5 h, a scroll past the cap is kept
{
  const { sim, p } = field();
  p.addStones('exp_scroll', 10);
  p.addStones('exp_scroll', 2);
  sim.useBuffScroll(p, 'exp_scroll');
  ok(p.buffs.exp_scroll === BUFF_TIME && p.stoneCount('exp_scroll') === 11, 'one scroll = 30 min');
  sim.useBuffScroll(p, 'exp_scroll');
  ok(p.buffs.exp_scroll === 2 * BUFF_TIME, 'a second one adds 30 min');
  for (let n = 0; n < 8; n++) sim.useBuffScroll(p, 'exp_scroll');
  ok(p.buffs.exp_scroll === BUFF_MAX && p.stoneCount('exp_scroll') === 2, `10 scrolls = 5 h (${p.buffs.exp_scroll})`);
  sim.useBuffScroll(p, 'exp_scroll');
  ok(p.buffs.exp_scroll === BUFF_MAX && p.stoneCount('exp_scroll') === 2, 'past the cap: refused and kept');
  sim.useBuffScroll(p, 'drop_scroll');
  ok(p.buffs.drop_scroll === undefined, 'no drop scroll in the bag: nothing happens');
  sim.useBuffScroll(p, 'return_scroll');
  sim.useBuffScroll(p, 'enhance');
  ok(Object.keys(p.buffs).length === 1, 'other kinds are ignored');
}

// ---- counting down while playing, and saving
{
  const { sim, p } = field();
  p.addStones('drop_scroll', 1);
  sim.useBuffScroll(p, 'drop_scroll');
  for (let n = 0; n < 300; n++) sim.step(TICK, () => IDLE_INTENT);
  const left = p.buffs.drop_scroll!;
  ok(Math.abs(left - (BUFF_TIME - 10)) < 0.1, `10 s of play off (${left})`);
  const data = p.toData();
  ok(data.buffs?.drop_scroll === Math.ceil(left), 'saved in whole seconds');
  const again = new Player(99, sim, JSON.parse(JSON.stringify(data)));
  ok(again.buffs.drop_scroll === Math.ceil(left), 'loaded back from the save');
  p.buffs.drop_scroll = 0.02;
  sim.step(TICK, () => IDLE_INTENT);
  ok(p.buffs.drop_scroll === undefined && !('drop_scroll' in p.toData().buffs!), 'runs out and is gone');
}

// ---- old or bad saves
ok(Object.keys(cleanBuffs(undefined)).length === 0, 'missing = none');
{
  const b = cleanBuffs({ exp_scroll: 99_999, drop_scroll: -5, bogus: 100 });
  ok(b.exp_scroll === BUFF_MAX && b.drop_scroll === undefined && !('bogus' in b), 'clamped and cleaned');
}

// ---- EXP ×2, also on top of Auto's half
{
  const { sim, p } = field();
  const exp = (n: number) => (sim as unknown as { autoExp(p: Player, n: number): number }).autoExp(p, n);
  ok(exp(100) === 100, 'no scroll: 100');
  p.buffs.exp_scroll = 60;
  ok(exp(100) === 200, 'with scroll: 200');
  p.autoOn = true;
  ok(exp(100) === 100, 'Auto (50%) with scroll: 100');
}

// ---- drop chance ×2 for whoever gets first pick (the top damage dealer)
{
  const { sim, p } = field();
  const mob = sim.monsters.find((m) => !m.isBoss && m.def.itemChance > 0 && m.def.itemChance < 0.4)!;
  const drops = (buff: boolean) => {
    if (buff) p.buffs.drop_scroll = 9999;
    else delete p.buffs.drop_scroll;
    mob.damageBy.clear();
    mob.damageBy.set(p.id, 10);
    sim.loots = [];
    let items = 0;
    let gold = 0;
    const N = 6000;
    for (let n = 0; n < N; n++) {
      (sim as unknown as { dropLoot(m: unknown): void }).dropLoot(mob);
      for (const l of sim.loots) {
        if (l.kind.type === 'item') items++;
        if (l.kind.type === 'gold') gold += l.kind.amount;
      }
      sim.loots = [];
    }
    return { items: items / N, gold: gold / N };
  };
  const base = drops(false);
  const boosted = drops(true);
  const ratio = boosted.items / base.items;
  ok(ratio > 1.7 && ratio < 2.3, `item drops about ×2 (${ratio.toFixed(2)})`);
  const goldRatio = boosted.gold / base.gold;
  ok(goldRatio > 0.9 && goldRatio < 1.1, `gold unchanged (${goldRatio.toFixed(2)})`);
}

finish('buff-scrolls');
