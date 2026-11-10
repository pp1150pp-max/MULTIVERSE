// Spam guards for market searches: a token bucket per ACCOUNT (shared by all its sessions) and a short
// cache of identical searches so a repeat doesn't hit the database. Times come from an injectable clock.

/** A search costs one token; the bucket holds this many (a burst), then refills slowly. */
export const SEARCH_BURST = 8;
/** One token back every this many milliseconds. */
export const SEARCH_REFILL_MS = 1000;
/** An identical search from the same account is answered from memory for this long. */
export const SEARCH_CACHE_MS = 3000;
/** Cache entries kept at most (oldest dropped first). */
const CACHE_MAX = 500;

export { MARKET_THROTTLE_MSG as SEARCH_THROTTLE_MSG } from '../src/shared/sim/market';

export class SearchBuckets {
  private readonly b = new Map<number, { tokens: number; at: number }>();

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly burst = SEARCH_BURST,
    private readonly refillMs = SEARCH_REFILL_MS,
  ) {}

  /** Takes one token for this account; false = none left (too fast). */
  take(account: number): boolean {
    const t = this.now();
    const e = this.b.get(account) ?? { tokens: this.burst, at: t };
    e.tokens = Math.min(this.burst, e.tokens + (t - e.at) / this.refillMs);
    e.at = t;
    const ok = e.tokens >= 1;
    if (ok) e.tokens -= 1;
    this.b.set(account, e);
    if (this.b.size > 5000) this.prune(t);
    return ok;
  }

  /** Forgets accounts whose bucket has refilled completely (they are indistinguishable from new ones). */
  private prune(t: number): void {
    for (const [k, e] of this.b) if (e.tokens + (t - e.at) / this.refillMs >= this.burst) this.b.delete(k);
  }
}

export class SearchCache<T> {
  private readonly m = new Map<string, { at: number; value: T }>();

  constructor(private readonly now: () => number = () => performance.now(), private readonly ttl = SEARCH_CACHE_MS) {}

  get(key: string): T | undefined {
    const e = this.m.get(key);
    if (!e) return undefined;
    if (this.now() - e.at >= this.ttl) {
      this.m.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: T): void {
    if (this.m.size >= CACHE_MAX) this.m.delete(this.m.keys().next().value as string);
    this.m.set(key, { at: this.now(), value });
  }

  /** Something on the market changed (listed, bought, cancelled, expired): nothing cached is trustworthy. */
  clear(): void {
    this.m.clear();
  }
}
