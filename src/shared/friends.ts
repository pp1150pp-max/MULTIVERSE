// Friends, friend requests and blocks: rules shared by the server (which decides, server/friends.ts) and
// the browser (which shows them). Unlike parties they are saved in the server's database, and they belong
// to the ACCOUNT, not to one character: a friend is shown as the character they play now (or played last).
import type { ClassId } from './types';

/** Most friends one account may have. */
export const FRIEND_MAX = 50;
/** Most friend requests one account may have waiting for an answer at once. */
export const FRIEND_PENDING_MAX = 20;
/** Most accounts one account may block. */
export const BLOCK_MAX = 100;
/** The same account may send the same account a friend request at most this often (seconds). */
export const FRIEND_REREQUEST_GAP = 10;
/** Longest character name the server looks up. */
export const FRIEND_NAME_MAX = 40;

/** The character an account plays now, or played last when offline. */
export interface FriendChar {
  name: string;
  cls: ClassId;
  lv: number;
  /** Zone id (offline: the one they logged out in; may be one this browser doesn't know). */
  zone: string;
  /** The channel of that zone (1 when it has none). Missing for an offline friend. */
  ch?: number;
}

/** A friend, or the other side of a request. `char` is null when the account has no character left. */
export interface FriendEntry {
  /** Their account id: what the actions name them by. */
  acc: number;
  online: boolean;
  char: FriendChar | null;
}

/** Someone you blocked, named by their latest character. */
export interface BlockEntry {
  acc: number;
  name: string;
}

/** Everything the friends window shows (sent whenever any of it changes). */
export interface FriendsView {
  /** Online first, then by name. */
  friends: FriendEntry[];
  /** Requests to you, waiting for your answer (oldest first). */
  incoming: FriendEntry[];
  /** Your requests, waiting for theirs. */
  outgoing: FriendEntry[];
  blocked: BlockEntry[];
}
