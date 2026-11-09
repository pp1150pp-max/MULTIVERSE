import { isStack, sameStack, type BagEntry } from '../types';
import { stackLimit } from '../data/potions';

const slot = (i: unknown, len: number): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < len;

/**
 * Moves `n` of the stack in src[i] onto dst[j] (the lists may be the same). The source must be a potion/stone stack
 * and 1 <= n < its count (the rest stays). The target must be empty (a new stack of n appears) or a stack that can
 * merge (n, or as much as still fits up to the stack limit, moves over). Anything else changes nothing and returns false.
 * Never creates or destroys items: what leaves src[i] always lands in dst[j].
 */
export function splitInto(src: (BagEntry | null)[], i: unknown, dst: (BagEntry | null)[], j: unknown, n: unknown): boolean {
  if (!slot(i, src.length) || !slot(j, dst.length) || typeof n !== 'number' || !Number.isInteger(n)) return false;
  if (src === dst && i === j) return false;
  const a = src[i];
  if (!isStack(a) || n < 1 || n >= a.count) return false;
  const b = dst[j];
  if (!b) {
    dst[j] = { ...a, count: n };
    a.count -= n;
    return true;
  }
  if (!isStack(b) || !sameStack(a, b)) return false;
  const room = stackLimit(b) - b.count;
  const moved = Math.min(n, room);
  if (moved <= 0) return false;
  b.count += moved;
  a.count -= moved;
  return true;
}
