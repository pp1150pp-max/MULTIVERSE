// Player-to-player trade (server/trade.ts, src/shared/trade.ts): the pure swap check and tax, the request
// rules (guest, same account, same map, block setting, 30 s timeout, re-request gap), the flow
// (offer → confirm → 3 s → swap), that any change voids the confirms, a full bag, bad inputs, auto-cancel
// (death, leaving, changing map), that the swap and both saves are ONE transaction, and that no item or
// gold is ever created or lost. Uses a throwaway database and a fake clock, no server needed.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { Trades, type TradeActor, type TradeHost } from '../server/trade';
import { Sim } from '../src/shared/sim/Sim';
import { BAG_SIZE, newCharacterData } from '../src/shared/sim/Player';
import { cleanStash } from '../src/shared/sim/stash';
import { HUB_ID, ZONES } from '../src/shared/data/zones';
import { makeItem } from '../src/shared/data/items';
import { isItem, isStack, type BagEntry, type Item } from '../src/shared/types';
import {
  afterTax, makeOffer, planSwap, taxOf, TRADE_COUNTDOWN, TRADE_GOLD_MAX, TRADE_REQUEST_TTL, TRADE_REREQUEST_GAP, TRADE_SLOTS,
  type TradeView,
} from '../src/shared/trade';
import { finish, ok } from './check';

const item = (base = 'necklace_3', rarity: Item['rarity'] = 'epic', level = 30): Item => makeItem(base, rarity, level, 'mage')!;
const pot = (count: number): BagEntry => ({ potion: 'hp', size: 's', count });

// ---------------------------------------------------------------- pure: tax, offers, the swap check
{
  ok(taxOf(1000) === 30 && afterTax(1000) === 970, 'owner example: offer 1,000 → tax 30, receiver gets 970');
  ok(taxOf(0) === 0 && afterTax(0) === 0 && taxOf(33) === 0 && taxOf(34) === 1, 'tax rounds down (under 34 G pays none)');
  ok(taxOf(1_000_000_000) === 30_000_000, '3% of a billion');

  const bag: (BagEntry | null)[] = Array(BAG_SIZE).fill(null);
  const it = item();
  bag[0] = it;
  bag[1] = pot(10);
  const whole = makeOffer(bag, 0);
  ok(typeof whole !== 'string' && isItem(whole.entry) && whole.entry !== it && whole.entry.uid === it.uid, 'an item offer is a copy of that item');
  const part = makeOffer(bag, 1, 4);
  ok(typeof part !== 'string' && isStack(part.entry) && part.entry.count === 4 && (bag[1] as { count: number }).count === 10, 'part of a stack: a copy of 4, the bag is untouched');
  const all = makeOffer(bag, 1);
  ok(typeof all !== 'string' && isStack(all.entry) && all.entry.count === 10, 'no amount = the whole stack');
  for (const bad of [-1, 30, 1.5, '1', null, undefined, NaN, Infinity]) ok(typeof makeOffer(bag, bad) === 'string', `slot ${String(bad)} refused`);
  ok(typeof makeOffer(bag, 5) === 'string', 'an empty slot refused');
  for (const n of [0, -1, 11, 1.5, '3', NaN, null]) ok(typeof makeOffer(bag, 1, n) === 'string', `amount ${String(n)} refused`);
}
{
  const mk = (name: string, gold: number): { name: string; bag: (BagEntry | null)[]; gold: number; offers: never[]; offerGold: number } =>
    ({ name, bag: Array(BAG_SIZE).fill(null), gold, offers: [], offerGold: 0 });
  // Full bags swap one for one (the offered slot is freed first).
  const a = mk('A', 100);
  const b = mk('B', 100);
  for (let i = 0; i < BAG_SIZE; i++) {
    a.bag[i] = item('ring_jade', 'rare', 10 + i);
    b.bag[i] = item('ring_jade', 'rare', 10 + i);
  }
  const oa = makeOffer(a.bag, 3) as ReturnType<typeof makeOffer> & object;
  const ob = makeOffer(b.bag, 7) as ReturnType<typeof makeOffer> & object;
  const full = planSwap({ ...a, offers: [oa as never], offerGold: 0 }, { ...b, offers: [ob as never], offerGold: 0 });
  ok(full.ok, 'two full bags can swap one item for one');
  const oneSided = planSwap({ ...a, offers: [oa as never], offerGold: 0 }, { ...b, offers: [], offerGold: 0 });
  ok(!oneSided.ok && oneSided.who === 'b' && oneSided.msg.includes('กระเป๋า'), 'a full bag cannot receive one more');
}

// ---------------------------------------------------------------- the registry
const dir = mkdtempSync(join(tmpdir(), 'multiverse-trade-test-'));
const db = new Db(join(dir, 'trade.db'));
let clock = 1_000_000;
const sim = new Sim(ZONES[HUB_ID]);
/** Another map, and another channel (Sim) of the same map: both count as "not together". */
const elsewhere = new Sim(ZONES.emerald_forest);
const otherChannel = new Sim(ZONES[HUB_ID]);

interface Out {
  chat: Map<number, string[]>;
  views: Map<number, TradeView>;
  ended: Map<number, { ok: boolean; msg: string }[]>;
  requests: Map<number, number[]>;
  gone: Map<number, number[]>;
}
const out: Out = { chat: new Map(), views: new Map(), ended: new Map(), requests: new Map(), gone: new Map() };
const push = <T>(m: Map<number, T[]>, k: number, v: T) => m.set(k, [...(m.get(k) ?? []), v]);
const actors = new Map<number, TradeActor>();
const host: TradeHost = {
  actor: (id) => actors.get(id),
  requested: (to, from) => push(out.requests, to, from),
  requestGone: (to, from) => push(out.gone, to, from),
  tell: (id, text) => push(out.chat, id, text),
  view: (id, v) => out.views.set(id, v),
  ended: (id, okk, msg) => push(out.ended, id, { ok: okk, msg }),
};
const trades = new Trades(db, host, () => clock);

let n = 0;
function actor(name: string, opts: { guest?: boolean; account?: number } = {}): TradeActor {
  const data = newCharacterData(name, 'mage');
  data.level = 40;
  let accountId = opts.account;
  if (accountId === undefined) accountId = db.createAccount(`acc-${name}-${n++}`, 'x')!;
  const charId = db.createCharacter(accountId, data).id;
  const player = sim.addPlayer(data);
  player.stash = cleanStash(null);
  const a: TradeActor = { charId, accountId, name, guest: opts.guest === true, zone: 'hub', alive: true, player, sim };
  actors.set(charId, a);
  return a;
}
const lastChat = (a: TradeActor): string => out.chat.get(a.charId)?.at(-1) ?? '';
const lastEnd = (a: TradeActor) => out.ended.get(a.charId)?.at(-1);
const saved = (a: TradeActor) => db.loadCharacter(a.accountId, a.charId)!;
const uids = (...xs: TradeActor[]): string[] => xs.flatMap((x) => x.player.bag.filter(isItem).map((e) => e.uid)).sort();
const potions = (...xs: TradeActor[]): number => xs.reduce((s, x) => s + x.player.bag.reduce((t, e) => t + (e && 'potion' in e ? e.count : 0), 0), 0);
const gold = (...xs: TradeActor[]): number => xs.reduce((s, x) => s + x.player.gold, 0);
function open(a: TradeActor, b: TradeActor): void {
  clock += 60_000; // past any re-request gap
  const e1 = trades.request(a, b, false);
  const e2 = trades.answer(b, a.charId, true);
  ok(e1 === null && e2 === null && trades.busy(a.charId) && trades.busy(b.charId), `trade opened (${e1} ${e2})`);
}
const ver = (a: TradeActor): number => out.views.get(a.charId)!.ver;
const advance = (ms: number): void => {
  clock += ms;
  trades.tick();
};

const A = actor('Alice');
const B = actor('Bob');
const C = actor('Cara');
const G = actor('Guesty', { guest: true });
const A2 = actor('AliceAlt', { account: A.accountId });

// ------------------------------------------------------------ requests
{
  ok(trades.request(G, A, false)?.includes('Guest'), 'a guest cannot ask');
  ok(trades.request(A, G, false)?.includes('Guest'), 'a guest cannot be asked');
  ok(trades.request(A, undefined, false)?.includes('ไม่พบ'), 'an offline target is refused');
  ok(trades.request(A, A, false) !== null, 'trading with yourself is refused');
  ok(trades.request(A, A2, false)?.includes('บัญชีตัวเอง'), 'two characters of one account cannot trade');
  B.sim = elsewhere;
  ok(trades.request(A, B, false)?.includes('แมพ'), 'different maps are refused');
  B.sim = otherChannel;
  ok(trades.request(A, B, false)?.includes('CH'), 'another channel of the same map is refused');
  B.sim = sim;
  B.alive = false;
  ok(trades.request(A, B, false)?.includes('ตาย'), 'a dead target is refused');
  B.alive = true;
  ok(trades.request(A, B, true)?.includes('ปิดการรับ'), 'the block setting refuses requests');
  ok(!trades.busy(A.charId) && !trades.busy(B.charId), 'nothing opened by refused requests');
}
{
  // Decline, time out, re-request gap, one pending request each way.
  clock += 60_000;
  ok(trades.request(A, B, false) === null && out.requests.get(B.charId)?.at(-1) === A.charId, 'a request reaches B');
  ok(trades.request(A, C, false)?.includes('รอคำตอบ'), 'A may have only one open request');
  ok(trades.request(C, B, false)?.includes('รอคำตอบ'), 'B may have only one open request waiting');
  ok(trades.answer(B, A.charId, false) === null && !trades.busy(A.charId) && lastChat(A).includes('ปฏิเสธ'), 'declining tells A and opens nothing');
  ok(trades.request(A, B, false)?.includes('ซ้ำได้อีกใน'), 're-asking at once waits out the gap');
  clock += TRADE_REREQUEST_GAP * 1000 + 1;
  ok(trades.request(A, B, false) === null, 'after the gap A may ask again');
  advance(TRADE_REQUEST_TTL * 1000 - 100);
  ok(trades.answer(B, A.charId, true) === null && trades.busy(A.charId), 'accepting just before the timeout works');
  trades.cancel(A);
  clock += 60_000;
  ok(trades.request(A, B, false) === null, 'asked again');
  advance(TRADE_REQUEST_TTL * 1000 + 100);
  ok(lastChat(A).includes('หมดเวลา') && out.gone.get(B.charId)?.at(-1) === A.charId, 'no answer in 30 s: A is told, the popup closes');
  ok(trades.answer(B, A.charId, true)?.includes('หมดอายุ') && !trades.busy(A.charId), 'accepting after the timeout is refused');
}

// ------------------------------------------------------------ a normal trade, with the 3 s countdown and the tax
{
  A.player.gold = 5000;
  B.player.gold = 2000;
  const sword = item('necklace_3', 'epic', 30);
  const shield = item('ring_jade', 'rare', 20);
  A.player.bag[0] = sword;
  A.player.bag[1] = pot(10);
  B.player.bag[0] = shield;
  const before = { gold: gold(A, B), uids: uids(A, B), pots: potions(A, B), potA: potions(A), potB: potions(B) };
  open(A, B);

  ok(trades.add(A, 0) === null && trades.add(A, 1, 4) === null, 'A offers the necklace and 4 of 10 potions');
  ok(trades.add(B, 0) === null, 'B offers the ring');
  ok(trades.setGold(A, 1000) === null && trades.setGold(B, 2000) === null, 'both add gold');
  ok(A.player.bag[0] === sword && (A.player.bag[1] as { count: number }).count === 10, 'offered things stay in the bag until the swap');
  const v = out.views.get(B.charId)!;
  ok(v.you === 'b' && v.a.items.length === 2 && v.b.items.length === 1 && v.a.gold === 1000, 'B sees A\'s offer');

  ok(trades.confirm(A, ver(A)) === null, 'A confirms');
  ok(out.views.get(B.charId)!.a.confirmed && !out.views.get(B.charId)!.b.confirmed, 'B sees A confirmed, B waiting');
  // Rule 6: an offer changed after a confirm resets BOTH.
  ok(trades.confirm(B, ver(B)) === null, 'B confirms too → countdown starts');
  ok(out.views.get(A.charId)!.cd !== null && out.views.get(A.charId)!.cd! <= TRADE_COUNTDOWN, 'the countdown runs');
  const v1 = ver(A);
  ok(trades.setGold(B, 1500) === null, 'B changes the gold during the countdown');
  const after = out.views.get(A.charId)!;
  ok(!after.a.confirmed && !after.b.confirmed && after.cd === null && after.ver > v1, 'the change cancelled both confirms and the countdown');
  advance(TRADE_COUNTDOWN * 1000 + 500);
  ok(trades.busy(A.charId) && A.player.bag[0] === sword, 'nothing was swapped');
  ok(trades.confirm(A, v1)?.includes('เปลี่ยน'), 'confirming a stale view is refused');
  ok(trades.confirm(A, ver(A)) === null && trades.confirm(A, ver(A)) === null, 'a double click on confirm is harmless');
  ok(trades.confirm(B, ver(B)) === null, 'B confirms the new offer');
  advance(TRADE_COUNTDOWN * 1000 - 500);
  ok(trades.busy(A.charId), 'before 3 s nothing happens');
  advance(600);
  ok(!trades.busy(A.charId) && !trades.busy(B.charId), 'after 3 s the trade is over');
  ok(lastEnd(A)?.ok === true && lastEnd(B)?.ok === true, 'both are told it worked');

  ok(!A.player.bag.some((e) => isItem(e) && e.uid === sword.uid) && B.player.bag.some((e) => isItem(e) && e.uid === sword.uid), 'the necklace moved to B');
  ok(A.player.bag.some((e) => isItem(e) && e.uid === shield.uid), 'the ring moved to A');
  ok(potions(A) === before.potA - 4 && potions(B) === before.potB + 4, 'A gave 4 of its 10 potions to B');
  // A sent 1,000 → B gets 970; B sent 1,500 → A gets 1,455.
  ok(A.player.gold === 5000 - 1000 + 1455 && B.player.gold === 2000 - 1500 + 970, `gold with the 3% tax (A ${A.player.gold}, B ${B.player.gold})`);
  const taxTotal = taxOf(1000) + taxOf(1500);
  ok(before.gold - gold(A, B) === taxTotal, 'the only gold that left the game is the tax');
  ok(JSON.stringify(uids(A, B)) === JSON.stringify(before.uids) && potions(A, B) === before.pots, 'no item or potion created or lost');
  ok(saved(A).gold === A.player.gold && saved(B).gold === B.player.gold, 'both characters were saved');
  ok(saved(A).bag.some((e) => e && isItem(e) && e.uid === shield.uid) && saved(B).bag.some((e) => e && isItem(e) && e.uid === sword.uid), 'the saves hold the new bags');
  const log = db.tradeLog(10);
  ok(log.length === 1 && log[0].a.name === 'Alice' && log[0].b.name === 'Bob' && log[0].a.gold === 1000 && log[0].a.tax === 30 && log[0].b.gold === 1500 && log[0].b.tax === 45, 'the trade log has gold and tax');
  ok(log[0].a.items.length === 2 && log[0].b.items.length === 1 && log[0].zone === 'hub' && log[0].at > 0, 'and the items, zone and time');
  ok(db.tradeLog(10, undefined, 'bob').length === 1 && db.tradeLog(10, undefined, 'zzz').length === 0, 'the log can be searched by name');
}

// ------------------------------------------------------------ bad inputs
{
  open(A, B);
  A.player.bag[10] = item();
  A.player.bag[11] = pot(10);
  for (const bad of [-1, 30, 1.5, '1', null, NaN, 99]) ok(trades.add(A, bad) !== null, `add slot ${String(bad)} refused`);
  ok(trades.add(A, 20) !== null, 'an empty slot refused');
  for (const bad of [0, -1, 11, 2.5, '3', NaN]) ok(trades.add(A, 11, bad) !== null, `amount ${String(bad)} refused`);
  for (const bad of [-1, 1.5, NaN, Infinity, '5', null, undefined, TRADE_GOLD_MAX + 1, A.player.gold + 1]) ok(trades.setGold(A, bad) !== null, `gold ${String(bad)} refused`);
  ok(trades.remove(A, 10) !== null, 'removing something not offered is refused');
  ok(trades.confirm(A, 'x') !== null && trades.confirm(A, undefined) !== null, 'a junk version is refused');
  ok(trades.confirm(A, ver(A))?.includes('ยังไม่มี'), 'confirming an empty trade is refused');
  // More than 8 slots.
  for (let i = 0; i < 9; i++) A.player.bag[12 + i] = item('ring_jade', 'rare', 10 + i);
  let accepted = 0;
  for (let i = 0; i < 9; i++) if (trades.add(A, 12 + i) === null) accepted++;
  ok(accepted === TRADE_SLOTS, `only ${TRADE_SLOTS} slots can be offered (${accepted})`);
  ok(trades.add(A, 12, 1) === null, 'offering the same slot again just changes it');
  ok(trades.remove(A, 12) === null && trades.add(A, 20) === null, 'remove frees a slot');
  ok(trades.add(C, 0) !== null && trades.cancel(C) !== null, 'someone not trading can do nothing');
  trades.cancel(A);
  ok(lastEnd(A)?.ok === false && lastEnd(B)?.ok === false && A.player.bag[12] !== null, 'cancel closes it and everything is still in the bag');
  for (let i = 10; i < 30; i++) A.player.bag[i] = null;
}

// ------------------------------------------------------------ bag space
{
  const X = actor('Xena');
  const Y = actor('Yuri');
  for (let i = 0; i < BAG_SIZE; i++) Y.player.bag[i] = item('ring_jade', 'rare', 10 + i);
  X.player.bag[0] = item();
  X.player.bag[1] = pot(5);
  open(X, Y);
  ok(trades.add(X, 0) === null, 'X offers a necklace to a player with a full bag');
  const why = trades.confirm(Y, ver(Y));
  ok(trades.confirm(X, ver(X)) !== null || why !== null, 'a confirm that cannot work is refused up front');
  ok(trades.confirm(Y, ver(Y))?.includes('กระเป๋า'), 'with a clear bag message');
  // A swap of one for one works even when both are full.
  for (let i = 0; i < BAG_SIZE; i++) X.player.bag[i] = item('ring_jade', 'rare', 10 + i);
  trades.add(X, 0);
  trades.add(Y, 0);
  ok(trades.confirm(X, ver(X)) === null && trades.confirm(Y, ver(Y)) === null, 'two full bags confirm a 1-for-1 swap');
  advance(TRADE_COUNTDOWN * 1000 + 100);
  ok(lastEnd(X)?.ok === true, 'and it goes through');
  ok(X.player.bag.every((e) => e) && Y.player.bag.every((e) => e), 'both bags are still full, nothing lost');
}
{
  // The bag fills up between confirm and the swap → cancelled, nothing moves.
  const P = actor('Pia');
  const Q = actor('Quin');
  P.player.bag[0] = item();
  for (let i = 0; i < BAG_SIZE - 1; i++) Q.player.bag[i] = item('ring_jade', 'rare', 10 + i);
  open(P, Q);
  trades.add(P, 0);
  ok(trades.confirm(P, ver(P)) === null && trades.confirm(Q, ver(Q)) === null, 'confirmed with one free slot');
  Q.player.bag[BAG_SIZE - 1] = item('ring_jade', 'rare', 5); // picks something up
  const pBefore = JSON.stringify(P.player.bag);
  advance(TRADE_COUNTDOWN * 1000 + 100);
  ok(!trades.busy(P.charId) && lastEnd(P)?.ok === false && lastEnd(P)!.msg.includes('กระเป๋า'), 'the swap is cancelled with a bag message');
  ok(JSON.stringify(P.player.bag) === pBefore && !Q.player.bag.some((e) => isItem(e) && e.uid === (P.player.bag[0] as Item).uid), 'nothing moved');
}

// ------------------------------------------------------------ things that change under the offer
{
  const P = actor('Pete');
  const Q = actor('Quill');
  const it = item();
  P.player.bag[0] = it;
  P.player.bag[1] = pot(10);
  P.player.gold = 500;
  open(P, Q);
  trades.add(P, 0);
  trades.add(P, 1, 6);
  trades.setGold(P, 500);
  trades.confirm(P, ver(P));
  trades.confirm(Q, ver(Q));
  // The player sold the necklace (a sell the world should have blocked) and spent the gold.
  P.player.bag[0] = null;
  P.player.gold = 100;
  const total = gold(P, Q);
  const potP = potions(P);
  const potQ = potions(Q);
  advance(TRADE_COUNTDOWN * 1000 + 100);
  ok(lastEnd(P)?.ok === false && P.player.gold === 100 && gold(P, Q) === total && potions(P) === potP && potions(Q) === potQ, 'offered things gone: cancelled, no gold or potions moved');
  // Potions drunk down below the offered amount.
  open(P, Q);
  P.player.gold = 0;
  const potQ2 = potions(Q);
  trades.add(P, 1, 8);
  trades.confirm(P, ver(P));
  trades.confirm(Q, ver(Q));
  (P.player.bag[1] as { count: number }).count = 5;
  advance(TRADE_COUNTDOWN * 1000 + 100);
  ok(lastEnd(P)?.ok === false && potions(P) === 5 + (potP - 10) && potions(Q) === potQ2, 'fewer potions than offered: cancelled');
}

// ------------------------------------------------------------ the swap and the saves are one transaction
{
  const P = actor('Pax');
  const Q = actor('Quad');
  const it = item();
  P.player.bag[0] = it;
  P.player.gold = 1000;
  Q.player.gold = 50;
  db.saveCharacter(P.charId, P.player.toData());
  db.saveCharacter(Q.charId, Q.player.toData());
  open(P, Q);
  trades.add(P, 0);
  trades.setGold(P, 1000);
  trades.confirm(P, ver(P));
  trades.confirm(Q, ver(Q));
  const logs = db.tradeLog(100).length;
  const orig = db.writeCharacterAndStash.bind(db);
  let calls = 0;
  db.writeCharacterAndStash = (...args) => {
    // The first save works, the second fails (a crash in the middle): the whole transaction must roll back.
    if (++calls === 2) throw new Error('disk full');
    orig(...args);
  };
  const errs = console.error;
  console.error = () => undefined;
  advance(TRADE_COUNTDOWN * 1000 + 100);
  console.error = errs;
  db.writeCharacterAndStash = orig;
  ok(calls === 2 && lastEnd(P)?.ok === false, 'a failing save cancels the trade');
  ok(P.player.bag[0] === it && P.player.gold === 1000 && Q.player.gold === 50 && !Q.player.bag.some(isItem), 'memory is put back exactly');
  ok(saved(P).gold === 1000 && saved(P).bag.some((e) => e && isItem(e) && e.uid === it.uid), 'and the database still has the old state for the first character too');
  ok(saved(Q).gold === 50 && db.tradeLog(100).length === logs, 'the second character and the log were not touched either');
}

// ------------------------------------------------------------ auto-cancel
{
  const P = actor('Rex');
  const Q = actor('Sam');
  P.player.bag[0] = item();
  const run = (what: string, act: () => void, text: string) => {
    open(P, Q);
    trades.add(P, 0);
    trades.confirm(P, ver(P));
    act();
    trades.tick();
    ok(!trades.busy(P.charId) && !trades.busy(Q.charId) && lastEnd(Q)?.ok === false && lastEnd(Q)!.msg.includes(text), `${what}: cancelled at once (${lastEnd(Q)?.msg})`);
    ok(P.player.bag[0] !== null && saved(P).bag.length > 0, `${what}: the item is still in the bag`);
  };
  run('a player dies', () => (Q.alive = false), 'เสียชีวิต');
  Q.alive = true;
  run('the other player dies', () => (P.alive = false), 'เสียชีวิต');
  P.alive = true;
  run('a player changes map', () => (Q.sim = elsewhere), 'คนละแมพ');
  Q.sim = sim;
  run('a player switches channel', () => (Q.sim = otherChannel), 'คนละแมพ');
  Q.sim = sim;
  run('a player disconnects', () => {
    trades.cancelChar(Q.charId, 'Sam ออกจากเกม');
    actors.delete(Q.charId);
  }, 'ออกจากเกม');
  actors.set(Q.charId, Q);
  // A request waiting on someone who leaves.
  clock += 60_000;
  trades.request(P, Q, false);
  trades.cancelChar(Q.charId, 'Sam ออกจากเกม');
  ok(out.gone.get(Q.charId)?.at(-1) === P.charId && lastChat(P).includes('ยกเลิก'), 'a pending request is dropped when the target leaves');
  ok(trades.answer(Q, P.charId, true) !== null, 'and cannot be accepted afterwards');
}

// ------------------------------------------------------------ two clicks, or two answers, never make two trades
{
  const P = actor('Tia');
  const Q = actor('Uma');
  const R = actor('Vic');
  clock += 60_000;
  trades.request(P, Q, false);
  ok(trades.answer(Q, P.charId, true) === null, 'accepted once');
  ok(trades.answer(Q, P.charId, true) !== null, 'a second accept does nothing');
  ok(trades.request(R, P, false)?.includes('กำลังเทรด'), 'someone in a trade cannot be asked');
  ok(trades.request(P, R, false)?.includes('กำลังเทรด'), 'or ask');
}

// ------------------------------------------------------------ totals
ok(db.tradeLog(100).length === 2, `exactly the 2 trades that went through are in the log (${db.tradeLog(100).length})`);
db.close();
rmSync(dir, { recursive: true, force: true });
finish('trade');
