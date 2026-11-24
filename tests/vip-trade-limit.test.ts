// VIP, the daily trade limit and drop = destroy (owner 2026-11-23; docs/systems/trade.md, cash-shop.md, items-and-forge.md):
// - the Thai day turns at 00:00 Thai time (17:00 UTC); 3 finished trades per account per day, cancelled ones don't count;
// - refused when asking / accepting at the limit, and counted again inside the swap (two characters of one account);
// - VIP: no limit; EXP ×(1 + vipExpPct) rounded down, drop chances ×(1 + vipDropPct), on top of the ×2 scrolls;
// - buying VIP in the cash shop takes the crystals and extends the time; the /admin settings keep VIP packages;
// - dropping a bag item destroys it (nothing on the ground), quest keys still can't be dropped.
// Throwaway database and a fake clock, no server.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { CashShop } from '../server/cashShop';
import { Trades, type TradeActor, type TradeHost } from '../server/trade';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { cleanStash } from '../src/shared/sim/stash';
import { HUB_ID, ZONES } from '../src/shared/data/zones';
import { makeItem } from '../src/shared/data/items';
import { TRADE_DAILY_MAX, tradeDay, type TradeView } from '../src/shared/trade';
import { checkCashShop, emptyCashShop, vipBuyError, cashCatalog } from '../src/shared/cashShop';
import { applyBalance } from '../src/shared/balance';
import { VIP_DAY_MS, vipDropMult, vipExp, vipExtend, vipLeftText } from '../src/shared/vip';
import { finish, ok } from './check';

// ------------------------------------------------------------ the Thai day
{
  const before = Date.UTC(2026, 10, 23, 16, 59, 59, 999); // 23:59:59.999 Thai time
  const after = Date.UTC(2026, 10, 23, 17, 0, 0, 0); // 00:00 Thai time, the 24th
  ok(tradeDay(after) === tradeDay(before) + 1, 'a new Thai day starts at 17:00 UTC');
  ok(tradeDay(Date.UTC(2026, 10, 23, 0, 0)) === tradeDay(before), '07:00 and 23:59 Thai time are the same day');
}

// ------------------------------------------------------------ trades
const dir = mkdtempSync(join(tmpdir(), 'multiverse-vip-test-'));
const db = new Db(join(dir, 'vip.db'));
// 2026-11-23 10:00 Thai time.
let clock = Date.UTC(2026, 10, 23, 3, 0);
const sim = new Sim(ZONES[HUB_ID]);
const chat = new Map<number, string[]>();
const views = new Map<number, TradeView>();
const ended = new Map<number, { ok: boolean; msg: string }[]>();
const push = <T>(m: Map<number, T[]>, k: number, v: T) => m.set(k, [...(m.get(k) ?? []), v]);
const actors = new Map<number, TradeActor>();
const host: TradeHost = {
  actor: (id) => actors.get(id),
  requested: () => {},
  requestGone: () => {},
  tell: (id, text) => push(chat, id, text),
  view: (id, v) => views.set(id, v),
  ended: (id, okk, msg) => push(ended, id, { ok: okk, msg }),
};
const trades = new Trades(db, host, () => clock);
let n = 0;
function actor(name: string, account?: number): TradeActor {
  const data = newCharacterData(name, 'mage');
  const accountId = account ?? db.createAccount(`acc-${name}-${n++}`, 'x')!;
  const charId = db.createCharacter(accountId, data).id;
  const player = sim.addPlayer(data);
  player.stash = cleanStash(null);
  player.gold = 1_000_000;
  const a: TradeActor = { charId, accountId, name, guest: false, zone: 'hub', alive: true, player, sim };
  actors.set(charId, a);
  return a;
}
const tick = (ms: number) => {
  clock += ms;
  trades.tick();
};
/** Opens a trade a → b (or returns the refusal). */
function open(a: TradeActor, b: TradeActor): string | null {
  clock += 60_000;
  return trades.request(a, b, false) ?? trades.answer(b, a.charId, true);
}
/** One trade of 100 gold a → b, all the way through; returns whether it went through. */
function trade(a: TradeActor, b: TradeActor): boolean {
  const e = open(a, b);
  if (e) return false;
  trades.setGold(a, 100);
  trades.confirm(a, views.get(a.charId)!.ver);
  trades.confirm(b, views.get(b.charId)!.ver);
  tick(4000);
  return ended.get(a.charId)?.at(-1)?.ok === true;
}

const A = actor('Ann');
const B = actor('Ben');
const C = actor('Cat');
const D = actor('Dan');
{
  ok(open(A, B) === null && views.get(A.charId)?.left === TRADE_DAILY_MAX, `the window shows ${TRADE_DAILY_MAX} left`);
  trades.cancel(A);
  ok(trades.left(A.accountId) === TRADE_DAILY_MAX, 'a cancelled trade does not count');
  ok(trade(A, B) && trade(A, B) && trade(A, C), 'three trades go through');
  ok(trades.left(A.accountId) === 0 && trades.left(B.accountId) === 1 && trades.left(C.accountId) === 2, 'each account counts its own (3 / 2 / 1)');
  ok(chat.get(A.charId)?.some((t) => t.includes('เหลืออีก 0/3')), 'told how many are left after a trade');
  const e = open(A, D);
  ok(!!e && e.includes('ครบ') && !trades.busy(A.charId), `a 4th request is refused (${e})`);
  const e2 = open(D, A);
  ok(!!e2 && e2.includes('Ann') && e2.includes('ครบ'), 'asking someone at the limit is refused too');

  // A second character of A's account shares the count.
  const A2 = actor('AnnAlt', A.accountId);
  ok(open(A2, D)?.includes('ครบ'), 'another character of the same account is at the limit too');

  // The Thai day turns: the count starts again.
  clock = Date.UTC(2026, 10, 23, 16, 59, 0);
  ok(trades.left(A.accountId) === 0, '23:59 Thai time: still at the limit');
  clock = Date.UTC(2026, 10, 23, 17, 0, 0);
  ok(trades.left(A.accountId) === TRADE_DAILY_MAX && trades.left(B.accountId) === TRADE_DAILY_MAX, '00:00 Thai time: a fresh 3');

  // Counted again at the swap: two characters of one account with a trade each open at 2 used.
  ok(trade(A, B) && trade(A, B), 'two trades on the new day');
  const A3 = actor('AnnThird', A.accountId);
  ok(open(A, C) === null && open(A3, D) === null, 'two windows open at 2 used (both pass the request check)');
  for (const [x, y] of [[A, C], [A3, D]] as const) {
    trades.setGold(x, 100);
    trades.confirm(x, views.get(x.charId)!.ver);
    trades.confirm(y, views.get(y.charId)!.ver);
  }
  const goldBefore = A3.player.gold + D.player.gold;
  tick(4000);
  const r1 = ended.get(A.charId)?.at(-1);
  const r2 = ended.get(A3.charId)?.at(-1);
  ok(!!r1?.ok !== !!r2?.ok, `only one of them goes through (${r1?.msg} / ${r2?.msg})`);
  const lost = r1?.ok ? r2 : r1;
  ok(!!lost?.msg.includes('ครบ'), 'the other is cancelled for the limit');
  ok(r1?.ok || A3.player.gold + D.player.gold === goldBefore, 'and nothing moved in the cancelled one');
  ok(trades.left(A.accountId) === 0, 'the account is at exactly the limit');

  // VIP: no limit.
  db.setVipUntil(A.accountId, clock + VIP_DAY_MS);
  ok(trades.left(A.accountId) === null, 'VIP: no limit');
  ok(open(A, D) === null && views.get(A.charId)?.left === null, 'VIP can open a 4th, the window says no limit');
  trades.cancel(A);
  ok(trade(A, D) && trade(A, D), 'VIP trades past the limit');
  db.setVipUntil(A.accountId, clock - 1);
  ok(trades.left(A.accountId) === 0, 'VIP over: the limit is back');
}

// ------------------------------------------------------------ VIP bonuses
{
  applyBalance({});
  ok(vipExp(100, false) === 100 && vipExp(100, true) === 110 && vipExp(15, true) === 16 && vipExp(9, true) === 9, 'EXP +10% rounded down');
  ok(vipDropMult(false) === 1 && Math.abs(vipDropMult(true) - 1.1) < 1e-9, 'drop chances ×1.1');
  applyBalance({ vipExpPct: 50, vipDropPct: 25 });
  ok(vipExp(100, true) === 150 && vipDropMult(true) === 1.25, 'the /admin percentages are used');
  applyBalance({});
  // Through the Sim: scroll ×2 then VIP ×1.1 = ×2.2.
  const p = sim.addPlayer(newCharacterData('Exp', 'mage'));
  const exp = (sim as unknown as { autoExp(p: unknown, n: number): number }).autoExp.bind(sim);
  ok(exp(p, 100) === 100, 'no VIP: 100');
  p.vip = true;
  ok(exp(p, 100) === 110, 'VIP: 110');
  p.buffs.exp_scroll = 60;
  ok(exp(p, 100) === 220, 'VIP + EXP scroll: 220');
  p.autoOn = true;
  ok(exp(p, 100) === 110, 'VIP + scroll + Auto (half): 110');
  ok(vipExtend(0, 7, 1000) === 1000 + 7 * VIP_DAY_MS && vipExtend(5000 + VIP_DAY_MS, 1, 5000) === 5000 + 2 * VIP_DAY_MS, 'buying again adds to a running VIP');
  ok(vipLeftText(0, 1) === '' && vipLeftText(1 + 2 * VIP_DAY_MS + 3_600_000, 1) === '2 วัน 1 ชม.', 'time left text');
}

// ------------------------------------------------------------ buying VIP in the cash shop
{
  ok(!!checkCashShop({ vip: [{ days: 0, price: 10 }] }, true, {}).error, 'a 0-day package is refused');
  ok(!!checkCashShop({ vip: [{ days: 7, price: 10 }, { days: 7, price: 20 }] }, true, {}).error, 'two packages of the same days are refused');
  const cfg = checkCashShop({ open: true, vip: [{ days: 30, price: 1000 }, { days: 7, price: 300 }] }, true, {}).value!;
  ok(cfg.vip.length === 2 && cfg.vip[0].days === 7, 'packages kept, shortest first');
  ok(vipBuyError(cashCatalog(emptyCashShop(), {}, clock), 7, 300, { crystals: 9999 }, false) !== null, 'no packages = not sold');

  let now = clock;
  const shop = new CashShop(db, () => now);
  // Only VIP packages set: the settings must still be saved (not treated as "all defaults").
  shop.setCfg({ ...emptyCashShop(), vip: cfg.vip });
  ok(shop.cfg().vip.length === 2, 'VIP packages alone are saved');
  shop.setCfg(cfg);
  const acc = db.createAccount('vip-buyer', 'x')!;
  const who = { accountId: acc, guest: false, charId: 1, charName: 'Buyer' };
  db.setCrystals(acc, 500);
  ok(!shop.buyVip({ ...who, days: 7, price: 299 }).ok && db.crystals(acc) === 500, 'a changed price is refused, nothing taken');
  ok(!shop.buyVip({ ...who, days: 30, price: 1000 }).ok && db.crystals(acc) === 500, 'not enough crystals, nothing taken');
  ok(!shop.buyVip({ ...who, guest: true, days: 7, price: 300 }).ok, 'a guest cannot buy');
  const r = shop.buyVip({ ...who, days: 7, price: 300 });
  ok(r.ok && db.crystals(acc) === 200 && db.vipUntil(acc) === now + 7 * VIP_DAY_MS, `bought 7 days (${r.msg})`);
  ok(shop.state(acc, false).vipUntil === db.vipUntil(acc), 'the state carries the VIP end');
  now += VIP_DAY_MS;
  db.setCrystals(acc, 300);
  ok(shop.buyVip({ ...who, days: 7, price: 300 }).ok && db.vipUntil(acc) === clock + 14 * VIP_DAY_MS, 'buying again adds 7 more days to the end');
  ok(db.cashBought(acc)['vip:7'] === 2, 'both purchases recorded');
}

// ------------------------------------------------------------ drop = destroy
{
  const p = sim.addPlayer(newCharacterData('Dropper', 'mage'));
  const i = p.bag.findIndex((e) => !e);
  p.bag[i] = makeItem('necklace_3', 'epic', 30, 'mage')!;
  const loots = sim.loots.length;
  const gone = sim.dropFromBag(p, i);
  ok(!!gone && !p.bag[i] && sim.loots.length === loots, 'the item is gone and nothing lands on the ground');
  ok(sim.dropFromBag(p, i) === null, 'an empty slot drops nothing');
}

db.close();
rmSync(dir, { recursive: true, force: true });
finish('vip-trade-limit');
