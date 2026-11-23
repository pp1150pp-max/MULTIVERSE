// VIP (owner 2026-11-23, docs/systems/cash-shop.md "VIP"): bought with crystals in the cash shop, kept per
// account (`accounts.vip_until`, ms). While it runs: EXP +vipExpPct% (rounded down), every drop chance
// +vipDropPct% (both from /admin balance, code 10%), and no daily trade limit. Stacks with the ×2 scrolls.
// The server alone decides: it sets `Player.vip` (never saved with the character) when a character joins,
// when VIP is bought / granted / removed, and when it runs out.
import { currentBalance } from './balance';

export const VIP_DAY_MS = 86_400_000;
/** Most days in one package / one admin grant. */
export const VIP_DAYS_MAX = 3650;

/** EXP after the VIP bonus (rounded down, never less than `n`). */
export function vipExp(n: number, vip: boolean): number {
  return vip ? Math.floor((n * (100 + currentBalance().vipExpPct)) / 100) : n;
}

/** The drop-chance multiplier for a VIP / non-VIP first picker. */
export function vipDropMult(vip: boolean): number {
  return vip ? 1 + currentBalance().vipDropPct / 100 : 1;
}

/** The new expiry after buying / granting `days` more: from now, or from the old end if it is still running. */
export function vipExtend(until: number, days: number, now: number): number {
  return Math.max(until, now) + days * VIP_DAY_MS;
}

/** "5 วัน 3 ชม." / "3 ชม. 20 นาที" / "12 นาที" for the time left, or '' when it is over. */
export function vipLeftText(until: number, now: number): string {
  const ms = until - now;
  if (ms <= 0) return '';
  const min = Math.ceil(ms / 60_000);
  const d = Math.floor(min / 1440);
  const hr = Math.floor((min % 1440) / 60);
  const mn = min % 60;
  if (d > 0) return `${d} วัน ${hr} ชม.`;
  if (hr > 0) return `${hr} ชม. ${mn} นาที`;
  return `${mn} นาที`;
}
