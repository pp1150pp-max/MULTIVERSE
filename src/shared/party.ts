// Party rules shared by the server (which decides) and the browser (which shows them). Parties live
// only in the server's memory: they are never saved, and a server restart ends them all.
import type { ClassId } from './types';

/** Most characters in one party. */
export const PARTY_MAX = 3;
/** An invite with no answer this long counts as declined (seconds). */
export const INVITE_TTL = 30;
/** The same character may be invited by the same party at most this often (seconds). */
export const REINVITE_GAP = 10;
/** A member whose connection dropped stays in the party (shown offline) this long (seconds). */
export const OFFLINE_GRACE = 60;
/** Share of a member's EXP they keep; the rest is split among eligible members on the same map. */
export const EXP_KEEP = 0.5;
/** Members more than this many levels below the earner get none of their EXP. */
export const EXP_LEVEL_GAP = 5;
/** Longest search text, and most names one search returns. */
export const PARTY_SEARCH_MAX = 20;
export const PARTY_SEARCH_LIMIT = 20;

/** One member as every member's browser sees them. */
export interface PartyMemberSnap {
  charId: number;
  name: string;
  cls: ClassId;
  lv: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  leader: boolean;
  online: boolean;
  /** Zone the member is in (offline: the last one). */
  zone: string;
  /** Their player id inside that zone's simulation (-1 when offline), so nameplates can find them. */
  pid: number;
  x: number;
  z: number;
}

export interface PartySnap {
  id: number;
  members: PartyMemberSnap[];
}

/** A character found by the invite search. */
export interface PartyFound {
  name: string;
  lv: number;
  cls: ClassId;
  /** Already in a party (an invite would be refused). */
  inParty: boolean;
}

/**
 * Splits `exp` the earner got from a kill (already their damage share × level-gap multiplier).
 * `mates` = the levels of the other party members who may share it (same map, alive). Members more
 * than EXP_LEVEL_GAP levels below the earner get nothing; if nobody is left, the earner keeps it all.
 * Shares are rounded down and the remainder stays with the earner, so the total never changes.
 * Returns the earner's EXP and one amount per mate (in order).
 */
export function splitExp(exp: number, earnerLevel: number, mates: number[]): { keep: number; shares: number[] } {
  const eligible = mates.map((lv) => lv >= earnerLevel - EXP_LEVEL_GAP);
  const n = eligible.filter(Boolean).length;
  if (!n) return { keep: exp, shares: mates.map(() => 0) };
  const each = Math.floor((exp * (1 - EXP_KEEP)) / n);
  const shares = eligible.map((e) => (e ? each : 0));
  return { keep: exp - each * n, shares };
}
