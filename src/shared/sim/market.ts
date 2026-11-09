// The consignment market (market broker in town): players leave gear and stones with the broker at
// a price, and anyone else can buy them, even while the seller is offline. The listings live only in
// the server's database; what sold, expired or was cancelled waits in the seller's claim box at the
// broker. Shared so the browser shows the same fees and limits the server checks.
import { CLASS_IDS } from '../data/classes';
import { effectiveStats } from '../data/enhance';
import { itemClass } from '../data/items';
import {
  isBossKey, isItem, isStone, RARITIES, SLOTS, STAT_KEYS,
  type BagEntry, type ClassId, type Item, type Rarity, type SlotId, type StatKey, type StoneStack,
} from '../types';

/** Listings one account may have up at once, all its characters together (owner: 20). */
export const MARKET_SLOTS = 20;
/** How long a listing stays up before it goes back to the claim box (owner: 48 hours). */
export const MARKET_HOURS = 48;
export const MARKET_MS = MARKET_HOURS * 60 * 60 * 1000;
/** Paid when listing, kept even if it never sells (owner: 5%, no minimum). */
export const MARKET_FEE_PCT = 5;
/** Taken from the price when it sells (owner: 5%). */
export const MARKET_TAX_PCT = 5;
export const MARKET_PRICE_MIN = 1;
export const MARKET_PRICE_MAX = 100_000_000;
/** Listings per page of search results. */
export const MARKET_PAGE = 20;
/** Most stat filters in one search (owner asked to find gear by stat, e.g. crit, HP, MP). */
export const MARKET_STAT_FILTERS = 3;
export const MARKET_NAME_MAX = 30;
/** Sold, expired and cancelled listings are kept this long after they are claimed (history). */
export const MARKET_HISTORY_DAYS = 30;

export const listingFee = (price: number): number => Math.floor((price * MARKET_FEE_PCT) / 100);
export const saleTax = (price: number): number => Math.floor((price * MARKET_TAX_PCT) / 100);
/** What the seller collects when it sells. */
export const sellerGets = (price: number): number => price - saleTax(price);

/** What a listing is, for the category filter: a gear kind, blacksmith stones, or boss keys (Artifacts). */
export type MarketKind = SlotId | 'stone' | 'artifact';
export const MARKET_KINDS: MarketKind[] = [...SLOTS, 'stone', 'artifact'];

/** Gear and stones can be listed; potions can't (the merchant sells them). */
export function marketSellable(e: BagEntry | null | undefined): e is Item | StoneStack {
  return isItem(e) || isStone(e);
}

export function marketKind(e: Item | StoneStack): MarketKind {
  return isStone(e) ? (isBossKey(e.stone) ? 'artifact' : 'stone') : e.slot;
}

/** The stats a listing can be searched by: the item's totals including its enhancement. */
export function searchStats(e: Item | StoneStack): Partial<Record<StatKey, number>> {
  return isItem(e) ? effectiveStats(e) : {};
}

export type MarketSort = 'priceAsc' | 'priceDesc' | 'newest' | 'level' | 'ending' | 'stat';
export const MARKET_SORTS: MarketSort[] = ['priceAsc', 'priceDesc', 'newest', 'level', 'ending', 'stat'];

export interface MarketStatFilter {
  stat: StatKey;
  /** At least this much (0 = just has the stat). */
  min: number;
}

/** A search on the Buy tab. Every field is optional; the server cleans it with cleanQuery. */
export interface MarketQuery {
  kind?: MarketKind;
  /** Gear for this class (gear any class can wear is included). */
  cls?: ClassId;
  rarities?: Rarity[];
  /** Part of the item name. */
  name?: string;
  lvMin?: number;
  lvMax?: number;
  plusMin?: number;
  priceMax?: number;
  stats?: MarketStatFilter[];
  sort?: MarketSort;
  /** From 0. */
  page?: number;
}

/** A listing as the browser sees it. */
export interface MarketRow {
  id: number;
  entry: Item | StoneStack;
  price: number;
  fee: number;
  seller: string;
  /** Milliseconds since 1970 (server clock), like expiresAt. */
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'sold' | 'expired' | 'cancelled';
  /** Sold listings: who bought it and the tax taken. */
  buyer?: string;
  soldAt?: number;
  tax?: number;
  /** Listed by this account. */
  mine?: boolean;
}

export interface MarketPage { rows: MarketRow[]; total: number; page: number }

/** The Sell and Claim box tabs: this account's listings still up, and what waits to be collected. */
export interface MarketMine {
  active: MarketRow[];
  box: MarketRow[];
  slotsUsed: number;
}

/** A request from the market window; the reply is a `market` message with the same `req`. */
export type MarketCall =
  | { a: 'mktSearch'; q: MarketQuery }
  | { a: 'mktMine' }
  /** `n` = list only that many stones of a stack (omitted = the whole slot); the rest stays in the bag. */
  | { a: 'mktList'; i: number; price: number; n?: number }
  | { a: 'mktCancel'; id: number }
  | { a: 'mktBuy'; id: number; price: number }
  /** id -1 = collect everything that fits. */
  | { a: 'mktClaim'; id: number };

export interface MarketReply {
  ok: boolean;
  /** Shown to the player (what happened, or why not). */
  msg?: string;
  page?: MarketPage;
  mine?: MarketMine;
  /** The server's clock (ms since 1970) when it answered, so the browser can show time left. */
  now?: number;
}

const int = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : undefined;

/** Keeps only sane fields of a search from the browser. */
export function cleanQuery(raw: unknown): MarketQuery {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const q: MarketQuery = {};
  if (MARKET_KINDS.includes(r.kind as MarketKind)) q.kind = r.kind as MarketKind;
  if (CLASS_IDS.includes(r.cls as ClassId)) q.cls = r.cls as ClassId;
  if (Array.isArray(r.rarities)) {
    const rs = RARITIES.filter((x) => (r.rarities as unknown[]).includes(x));
    if (rs.length && rs.length < RARITIES.length) q.rarities = rs;
  }
  if (typeof r.name === 'string') {
    const n = r.name.trim().slice(0, MARKET_NAME_MAX);
    if (n) q.name = n;
  }
  q.lvMin = int(r.lvMin, 0, 999);
  q.lvMax = int(r.lvMax, 0, 999);
  q.plusMin = int(r.plusMin, 0, 99);
  q.priceMax = int(r.priceMax, 0, MARKET_PRICE_MAX);
  if (Array.isArray(r.stats)) {
    const seen = new Set<StatKey>();
    q.stats = [];
    for (const f of r.stats.slice(0, MARKET_STAT_FILTERS) as Record<string, unknown>[]) {
      if (!f || !STAT_KEYS.includes(f.stat as StatKey) || seen.has(f.stat as StatKey)) continue;
      seen.add(f.stat as StatKey);
      const min = typeof f.min === 'number' && Number.isFinite(f.min) ? Math.max(0, Math.min(1e6, f.min)) : 0;
      q.stats.push({ stat: f.stat as StatKey, min });
    }
    if (!q.stats.length) delete q.stats;
  }
  q.sort = MARKET_SORTS.includes(r.sort as MarketSort) ? (r.sort as MarketSort) : 'priceAsc';
  if (q.sort === 'stat' && !q.stats) q.sort = 'priceAsc';
  q.page = int(r.page, 0, 10_000) ?? 0;
  for (const k of Object.keys(q) as (keyof MarketQuery)[]) if (q[k] === undefined) delete q[k];
  return q;
}

/** The class column stored with a listing (null = any class can wear it, and stones). */
export function listingClass(e: Item | StoneStack): ClassId | null {
  return isItem(e) ? itemClass(e) : null;
}

/** "3 ชม." / "45 นาที" until a time (server clock). */
export function timeLeftText(ms: number): string {
  if (ms <= 0) return 'หมดเวลา';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h} ชม.`;
  return `${Math.max(1, Math.ceil(ms / 60_000))} นาที`;
}
