// Password hashing, login tokens and a simple brake on password guessing.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 64;

/** Stored as `scrypt$<salt hex>$<hash hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltHex, hashHex] = stored.split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

/** Login tokens last 30 days; logging in again issues a new one. */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Counts failed logins/registrations per address. After too many in the window, further
 * attempts from that address are refused until the window passes.
 */
export class AttemptLimiter {
  private readonly hits = new Map<string, { n: number; until: number }>();

  constructor(private readonly max = 10, private readonly windowMs = 10 * 60 * 1000) {}

  blocked(key: string): boolean {
    const h = this.hits.get(key);
    if (!h) return false;
    if (Date.now() > h.until) {
      this.hits.delete(key);
      return false;
    }
    return h.n >= this.max;
  }

  fail(key: string): void {
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || now > h.until) this.hits.set(key, { n: 1, until: now + this.windowMs });
    else h.n++;
  }

  clear(key: string): void {
    this.hits.delete(key);
  }
}
