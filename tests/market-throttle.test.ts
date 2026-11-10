// Market search spam guards against a throwaway database and a fake clock: the per-account token
// bucket (burst, slow refill, shared by all of an account's characters), the 3 s cache of identical
// searches (free, cleared when something is listed/bought), the Thai refusal message, and price hints.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { Market, type MarketActor } from '../server/market';
import { SearchBuckets, SearchCache, SEARCH_BURST, SEARCH_CACHE_MS, SEARCH_REFILL_MS } from '../server/market-throttle';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { cleanStash } from '../src/shared/sim/stash';
import { HUB_ID, ZONES } from '../src/shared/data/zones';
import { makeItem } from '../src/shared/data/items';
import { MARKET_THROTTLE_MSG, type MarketCall, type MarketReply } from '../src/shared/sim/market';
import { finish, ok } from './check';

// ------------------------------------------------------------ the bucket on its own
{
  let t = 0;
  const b = new SearchBuckets(() => t);
  let granted = 0;
  for (let i = 0; i < 50; i++) if (b.take(1)) granted++;
  ok(granted === SEARCH_BURST, `a burst of ${SEARCH_BURST} searches is allowed, then it stops (${granted})`);
  ok(b.take(2), 'another account has its own bucket');
  t += SEARCH_REFILL_MS - 1;
  ok(!b.take(1), 'just under one refill period later: still refused');
  t += 1;
  ok(b.take(1) && !b.take(1), 'one token comes back per refill period');
  t += SEARCH_REFILL_MS * 100;
  let again = 0;
  for (let i = 0; i < 50; i++) if (b.take(1)) again++;
  ok(again === SEARCH_BURST, 'a long rest refills only up to the burst, not beyond');
}

// ------------------------------------------------------------ the cache on its own
{
  let t = 0;
  const c = new SearchCache<number>(() => t);
  c.set('a', 1);
  ok(c.get('a') === 1 && c.get('b') === undefined, 'cache hit and miss');
  t = SEARCH_CACHE_MS - 1;
  ok(c.get('a') === 1, 'still cached just before it expires');
  t = SEARCH_CACHE_MS;
  ok(c.get('a') === undefined, 'expired after the cache time');
  c.set('x', 2);
  c.clear();
  ok(c.get('x') === undefined, 'clear drops everything');
}

// ------------------------------------------------------------ through the market
const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
const db = new Db(join(dir, 'throttle.db'));
let clock = Date.now();
const market = new Market(db, () => clock);
const sim = new Sim(ZONES[HUB_ID]);
const broker = sim.terrain.npcPos.broker!;

function actor(name: string, accountId?: number): MarketActor {
  const data = newCharacterData(name, 'mage');
  data.level = 40;
  const acc = accountId ?? db.createAccount(`acc-${name}`, 'x')!;
  const charId = db.createCharacter(acc, data).id;
  const player = sim.addPlayer(data);
  player.stash = cleanStash(null);
  player.x = broker.x + 1;
  player.z = broker.z;
  return { accountId: acc, charId, guest: false, player, sim };
}
const call = (a: MarketActor, c: MarketCall): MarketReply => market.handle(a, c).reply;
/** A search that differs each time (so the cache can't answer it). */
const search = (a: MarketActor, i: number) => call(a, { a: 'mktSearch', q: { priceMax: 1000 + i } });

const seller = actor('Seller');
const buyer = actor('Buyer');
seller.player.gold = 100_000;
const neck = makeItem('necklace_3', 'epic', 30, 'mage')!;
seller.player.bag[0] = neck;

{
  let good = 0;
  let refused: MarketReply | null = null;
  for (let i = 0; i < SEARCH_BURST + 4; i++) {
    const r = search(buyer, i);
    if (r.ok) good++;
    else refused = r;
  }
  ok(good === SEARCH_BURST, `different searches: ${SEARCH_BURST} pass, the rest are refused (${good})`);
  ok(refused?.msg === MARKET_THROTTLE_MSG && MARKET_THROTTLE_MSG.includes('เร็วเกินไป'), 'the refusal carries the Thai message, not silence');

  // A second character of the same account shares the bucket.
  const alt = actor('BuyerAlt', buyer.accountId);
  ok(search(alt, 100).msg === MARKET_THROTTLE_MSG, 'another character of the same account shares the bucket');
  ok(search(seller, 100).ok, 'a different account is not affected');

  // Cache: the same search again is answered without a token, even while the bucket is empty.
  const q: MarketCall = { a: 'mktSearch', q: { priceMax: 1000 } };
  ok(call(buyer, q).ok, 'a search already answered a moment ago is served from the cache while throttled');

  clock += SEARCH_REFILL_MS;
  ok(search(buyer, 200).ok, 'a token returns after the refill period');
}

// Cache correctness: it hides nothing for long, and a listing clears it.
{
  clock += SEARCH_REFILL_MS * SEARCH_BURST;
  const q: MarketCall = { a: 'mktSearch', q: {} };
  ok(call(buyer, q).page!.total === 0, 'nothing is for sale yet');
  const listed = call(seller, { a: 'mktList', i: 0, price: 1000 });
  ok(listed.ok, `list a necklace (${listed.msg})`);
  ok(call(buyer, q).page!.total === 1, 'listing clears the cache: the new listing shows at once');
  const id = call(buyer, q).page!.rows[0].id;

  // Price hints.
  seller.player.bag[1] = { ...neck, uid: 'another-copy' }; // same name, so the hint is about the same thing
  clock += SEARCH_REFILL_MS * 2;
  const hint = call(seller, { a: 'mktPrice', i: 1 }).priceRef;
  ok(hint?.lowest === 1000 && hint.sold === null, 'price hint: lowest listing now, no sale yet');
  ok(!call(seller, { a: 'mktPrice', i: 30 }).ok && !call(seller, { a: 'mktPrice', i: -1 }).ok, 'price hint for an empty or invalid slot is refused');

  buyer.player.gold = 5000;
  const bought = call(buyer, { a: 'mktBuy', id, price: 1000 });
  ok(bought.ok, `buy it (${bought.msg})`);
  ok(call(buyer, q).page!.total === 0, 'buying clears the cache: the sold listing is gone from search');
  clock += SEARCH_REFILL_MS * 2;
  const after = call(seller, { a: 'mktPrice', i: 1 }).priceRef;
  ok(after?.lowest === null && after.sold === 1000 && after.soldN === 1, 'price hint: recent sold price appears after a sale');
}

db.close?.();
rmSync(dir, { recursive: true, force: true });
finish('market-throttle');
