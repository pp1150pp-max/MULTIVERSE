// Consignment market (market broker) against a throwaway database: listing, searching with filters,
// buying (including two buyers at once), the claim box, cancelling, expiry, slot limit, guests, and
// that every trade is saved together with the character (so a crash can't duplicate an item).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { Market, type MarketActor } from '../server/market';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { cleanStash } from '../src/shared/sim/stash';
import { HUB_ID, ZONES } from '../src/shared/data/zones';
import { makeItem } from '../src/shared/data/items';
import { isItem, type Item } from '../src/shared/types';
import { cleanQuery, listingFee, MARKET_MS, MARKET_SLOTS, sellerGets, type MarketCall, type MarketQuery, type MarketReply } from '../src/shared/sim/market';
import { CARD_IDS, type CardGroup, type CardRarity } from '../src/shared/data/cards';
import { cardDef } from '../src/shared/cardTuning';
import { finish, ok } from './check';

const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
let db = new Db(join(dir, 'market.db'));
let clock = Date.now();
let market = new Market(db, () => clock);
const sim = new Sim(ZONES[HUB_ID]);
const broker = sim.terrain.npcPos.broker!;
ok(!!broker, 'the hub has a market broker');

let n = 0;
function actor(name: string, guest = false): MarketActor {
  const accountId = guest ? db.createGuest(`g-${name}`, newCharacterData(name, 'mage')).accountId : db.createAccount(`acc-${name}`, 'x')!;
  const data = newCharacterData(name, 'mage');
  data.level = 40;
  const charId = guest ? db.listCharacters(accountId)[0].id : db.createCharacter(accountId, data).id;
  const player = sim.addPlayer(data);
  player.stash = cleanStash(null);
  player.x = broker.x + 1;
  player.z = broker.z;
  n++;
  return { accountId, charId, guest, player, sim };
}
const item = (base = 'necklace_3', rarity: Item['rarity'] = 'epic', level = 30): Item => makeItem(base, rarity, level, 'mage')!;
const call = (a: MarketActor, c: MarketCall): MarketReply => market.handle(a, c).reply;
const saved = (a: MarketActor) => db.loadCharacter(a.accountId, a.charId)!;
const bagHas = (p: Player, uid: string) => p.bag.some((e) => isItem(e) && e.uid === uid);

const seller = actor('Seller');
const buyer = actor('Buyer');
const rival = actor('Rival');
const guest = actor('Guesty', true);

// ------------------------------------------------------------ listing
const neck = item();
seller.player.bag[0] = neck;
seller.player.bag[1] = { potion: 'hp', size: 's', count: 5 };
seller.player.gold = 1000;
{
  const r = call(seller, { a: 'mktList', i: 0, price: 1000 });
  ok(r.ok, `list a necklace (${r.msg})`);
  ok(!seller.player.bag[0] && seller.player.gold === 1000 - listingFee(1000), 'it left the bag and the 5% fee was paid');
  ok(!saved(seller).bag.some((e) => isItem(e) && e.uid === neck.uid) && saved(seller).gold === 950, 'the character was saved with the listing');
  ok(!call(seller, { a: 'mktList', i: 1, price: 10 }).ok, 'potions cannot be listed');
  ok(!call(seller, { a: 'mktList', i: 5, price: 10 }).ok, 'an empty slot cannot be listed');
  seller.player.bag[2] = item('ring_jade', 'rare', 20);
  ok(!call(seller, { a: 'mktList', i: 2, price: 0 }).ok && !call(seller, { a: 'mktList', i: 2, price: 1.5 }).ok, 'price must be a whole number of at least 1');
  seller.player.bag[3] = { ...neck };
  ok(!call(seller, { a: 'mktList', i: 3, price: 5 }).ok && isItem(seller.player.bag[3]), 'the same item (uid) cannot be up twice, and stays in the bag');
  seller.player.bag[3] = null;
}

// ------------------------------------------------------------ distance and guests
{
  const far = actor('Far');
  far.player.x += 30;
  ok(call(far, { a: 'mktSearch', q: {} }).msg?.includes('ใกล้'), 'away from the broker: refused');
  guest.player.bag[0] = item();
  ok(!call(guest, { a: 'mktList', i: 0, price: 10 }).ok && isItem(guest.player.bag[0]), 'a guest cannot list');
  ok(call(guest, { a: 'mktSearch', q: {} }).ok, 'a guest can browse');
}

// ------------------------------------------------------------ searching
{
  // Each search waits out the per-account search limit (tests/market-throttle.test.ts covers that).
  const find = (q: object) => {
    clock += 1000;
    return call(buyer, { a: 'mktSearch', q }).page!;
  };
  ok(find({}).total === 1, 'search finds the listing');
  ok(find({ kind: 'necklace' }).total === 1 && find({ kind: 'weapon' }).total === 0, 'category filter');
  ok(find({ rarities: ['epic'] }).total === 1 && find({ rarities: ['common'] }).total === 0, 'rarity filter');
  ok(find({ stats: [{ stat: 'maxMp', min: 1 }] }).total === 1, 'stat filter: has max MP');
  ok(find({ stats: [{ stat: 'maxMp', min: 1 }, { stat: 'crit', min: 999 }] }).total === 0, 'stat filters must all match');
  ok(find({ name: 'Frost' }).total === 1 && find({ name: 'zzz' }).total === 0, 'name filter');
  ok(find({ lvMax: 10 }).total === 0 && find({ lvMin: 10, lvMax: 40 }).total === 1, 'level range');
  ok(find({ priceMax: 999 }).total === 0, 'price limit');
  ok(find({ cls: 'sword' }).total === 1, 'any-class gear shows for every class');
  ok(find({ name: '%' }).total === 0 && find({ name: "'; DROP TABLE x; --" }).total === 0, 'odd search text is just text');
  const row = find({}).rows[0];
  ok(row.price === 1000 && row.seller === 'Seller' && isItem(row.entry) && row.entry.uid === neck.uid, 'the row carries the item with its stats');
}

// ------------------------------------------------------------ buying
const id = call(buyer, { a: 'mktSearch', q: {} }).page!.rows[0].id;
{
  ok(!call(seller, { a: 'mktBuy', id, price: 1000 }).ok, 'cannot buy your own listing');
  buyer.player.gold = 999;
  ok(!call(buyer, { a: 'mktBuy', id, price: 1000 }).ok && buyer.player.gold === 999, 'not enough gold: refused');
  buyer.player.gold = 5000;
  rival.player.gold = 5000;
  ok(!call(buyer, { a: 'mktBuy', id, price: 1 }).ok, 'a price that does not match is refused');
  const out = market.handle(buyer, { a: 'mktBuy', id, price: 1000 });
  ok(out.reply.ok && buyer.player.gold === 4000 && bagHas(buyer.player, neck.uid), 'bought: gold paid, item in the bag');
  ok(saved(buyer).gold === 4000 && saved(buyer).bag.some((e) => isItem(e) && e.uid === neck.uid), 'the buyer was saved with the sale');
  ok(out.sold?.seller_account === seller.accountId, 'the seller is to be told');
  const late = call(rival, { a: 'mktBuy', id, price: 1000 });
  ok(!late.ok && rival.player.gold === 5000 && !bagHas(rival.player, neck.uid), 'a second buyer gets nothing and keeps the gold');
  ok(call(buyer, { a: 'mktSearch', q: {} }).page!.total === 0, 'sold listings leave the search');
}

// ------------------------------------------------------------ claim box: gold from the sale
{
  ok(market.boxCount(seller.accountId) === 1, 'the sale waits in the claim box');
  const before = seller.player.gold;
  const r = call(seller, { a: 'mktClaim', id: -1 });
  ok(r.ok && seller.player.gold === before + sellerGets(1000), `collected the gold minus 5% tax (${r.msg})`);
  ok(saved(seller).gold === seller.player.gold, 'the collected gold was saved');
  ok(!call(seller, { a: 'mktClaim', id: -1 }).ok && seller.player.gold === before + 950, 'cannot collect twice');
  ok(market.boxCount(seller.accountId) === 0, 'the box is empty');
}

// ------------------------------------------------------------ cancel, expiry and the box with a full bag
{
  const ring = seller.player.bag[2] as Item;
  ok(call(seller, { a: 'mktList', i: 2, price: 300 }).ok, 'list a ring');
  const rid = market.mine(seller.accountId).active[0].id;
  ok(!call(buyer, { a: 'mktCancel', id: rid }).ok, 'someone else cannot cancel it');
  ok(call(seller, { a: 'mktCancel', id: rid }).ok && market.boxCount(seller.accountId) === 1, 'cancelled: it waits in the box');
  ok(!call(buyer, { a: 'mktBuy', id: rid, price: 300 }).ok, 'a cancelled listing cannot be bought');
  const keep = seller.player.bag.slice();
  seller.player.bag.fill(item('ring_jade', 'common', 1));
  ok(!call(seller, { a: 'mktClaim', id: rid }).ok && market.boxCount(seller.accountId) === 1, 'bag full: it stays in the box');
  seller.player.bag.splice(0, seller.player.bag.length, ...keep);
  ok(call(seller, { a: 'mktClaim', id: rid }).ok && bagHas(seller.player, ring.uid), 'collected back into the bag');

  seller.player.bag[4] = item('belt_3', 'rare', 30);
  ok(call(seller, { a: 'mktList', i: 4, price: 50 }).ok, 'list a belt');
  clock += MARKET_MS + 1000;
  const ended = market.expire();
  ok(ended.length === 1 && ended[0].status === 'expired', 'after 48 hours it expires');
  const note = market.awayNote(seller.accountId);
  ok(!!note?.text.includes('หมดเวลา 1 ชิ้น'), `the seller hears about it on joining (${note?.text})`);
  ok(market.awayNote(seller.accountId) === null, 'and only once');
}

// ------------------------------------------------------------ stones, and the slot limit
{
  seller.player.bag[6] = { stone: 'enhance', count: 4 };
  seller.player.gold = 1_000_000;
  ok(call(seller, { a: 'mktList', i: 6, price: 4000 }).ok, 'a stack of stones can be listed');
  const sid = call(buyer, { a: 'mktSearch', q: { kind: 'stone' } }).page!.rows[0].id;
  ok(call(buyer, { a: 'mktBuy', id: sid, price: 4000 }).ok && buyer.player.stoneCount('enhance') === 4, 'bought the whole stack');
  // Listing only part of a stack: the rest stays in the bag, bad amounts change nothing
  seller.player.bag[7] = { stone: 'protect', count: 5 };
  const gold0 = seller.player.gold;
  for (const bad of [0, -1, 6, 2.5, NaN, '2' as unknown as number, null as unknown as number]) {
    ok(!call(seller, { a: 'mktList', i: 7, price: 100, n: bad }).ok, `listing ${String(bad)} of 5 stones is refused`);
  }
  ok(seller.player.gold === gold0 && (seller.player.bag[7] as { count: number }).count === 5, 'bad amounts cost nothing and keep the stack');
  seller.player.bag[8] = item('ring_jade', 'common', 1);
  ok(!call(seller, { a: 'mktList', i: 8, price: 100, n: 1 }).ok && isItem(seller.player.bag[8]), 'an amount on gear is refused');
  seller.player.bag[8] = null;
  ok(call(seller, { a: 'mktList', i: 7, price: 100, n: 2 }).ok && (seller.player.bag[7] as { count: number }).count === 3, 'part of the stack is listed, 3 stay');
  const part = market.mine(seller.accountId).active.find((r) => 'stone' in r.entry && r.entry.stone === 'protect');
  ok((part?.entry as { count: number } | undefined)?.count === 2, 'the listing holds exactly 2');
  ok(call(seller, { a: 'mktList', i: 7, price: 100, n: 3 }).ok && !seller.player.bag[7], 'n = the whole count lists everything and clears the slot');
  let listed = market.mine(seller.accountId).active.length;
  for (let k = 0; listed < MARKET_SLOTS; k++) {
    seller.player.bag[10] = item('ring_jade', 'common', 1);
    if (call(seller, { a: 'mktList', i: 10, price: 10 }).ok) listed++;
    else break;
  }
  ok(listed === MARKET_SLOTS, `${MARKET_SLOTS} listings at once`);
  seller.player.bag[10] = item('ring_jade', 'common', 1);
  ok(!call(seller, { a: 'mktList', i: 10, price: 10 }).ok && isItem(seller.player.bag[10]), 'one more is refused and stays in the bag');
}

// ------------------------------------------------------------ cards: own category, card rarity and group filters
{
  const carder = actor('Carder');
  carder.player.gold = 1_000_000;
  const pick = (r: CardRarity, gr: CardGroup) => CARD_IDS.find((id) => cardDef(id)?.rarity === r && cardDef(id)?.group === gr);
  const a = pick('rare', 'weapon');
  const b = CARD_IDS.find((id) => cardDef(id)?.rarity !== 'rare' && cardDef(id)?.group !== 'weapon');
  ok(!!a && !!b, 'test cards: a rare weapon card and another of other rarity and group');
  carder.player.bag[0] = { stone: a!, count: 2 };
  carder.player.bag[1] = { stone: b!, count: 1 };
  carder.player.bag[2] = { stone: 'enhance', count: 1 };
  ok(call(carder, { a: 'mktList', i: 0, price: 500 }).ok && call(carder, { a: 'mktList', i: 1, price: 600 }).ok, 'cards can be listed');
  ok(call(carder, { a: 'mktList', i: 2, price: 700 }).ok, 'and a stone next to them');
  const find = (q: MarketQuery) => call(buyer, { a: 'mktSearch', q }).page!.rows.filter((r) => r.seller === 'Carder')
    .map((r) => ('stone' in r.entry ? r.entry.stone : '')).sort();
  ok(JSON.stringify(find({ kind: 'card' })) === JSON.stringify([a, b].sort()), 'the "การ์ด" category shows both cards, not the stone');
  ok(!find({ kind: 'stone' }).some((s) => s.startsWith('card_')), 'cards are no longer under blacksmith stones');
  ok(JSON.stringify(find({ kind: 'card', rarities: ['rare'] })) === JSON.stringify([a]), 'card rarity filter');
  ok(JSON.stringify(find({ kind: 'card', cardGroups: ['weapon'] })) === JSON.stringify([a]), 'card group filter');
  ok(find({ kind: 'card', rarities: [cardDef(b!)!.rarity], cardGroups: ['weapon'] }).length === 0, 'rarity and group together');
  ok(cleanQuery({ cardGroups: ['weapon', 'bogus'] }).cardGroups?.join() === 'weapon', 'unknown groups are dropped');
  ok(find({ kind: 'card', lvMin: 50 }).length === 2, 'the level range does not hide cards');
  // A card listed before the category existed (kind 'stone') moves over when the server starts.
  const raw = (db as unknown as { db: { prepare(s: string): { run(...a: unknown[]): unknown } } }).db;
  raw.prepare("UPDATE market_listings SET kind = 'stone' WHERE json_extract(entry, '$.stone') = ?").run(a);
  // (sort 'newest': a query the market has not cached yet)
  ok(!find({ kind: 'card', sort: 'newest' }).includes(a!), 'set up an old card listing under stones');
  db.close();
  db = new Db(join(dir, 'market.db'));
  market = new Market(db, () => clock);
  ok(find({ kind: 'card' }).includes(a!), 'old card listings move to the card category on start');
}

// ------------------------------------------------------------ history cleanup
{
  const claimedBefore = (db as unknown as { db: { prepare(s: string): { get(): { n: number } } } }).db
    .prepare('SELECT COUNT(*) AS n FROM market_listings WHERE claimed_at IS NOT NULL').get().n;
  const gone = db.pruneHistory(clock + 31 * 86400e3, { sessions: 9999, chat: 9999, samples: 9999 });
  ok(claimedBefore > 0 && gone === Number(claimedBefore), 'collected listings are deleted after 30 days, nothing else');
  ok(market.mine(seller.accountId).active.length === MARKET_SLOTS, 'listings still up are kept');
}

db.close();
rmSync(dir, { recursive: true, force: true });
finish('market');
