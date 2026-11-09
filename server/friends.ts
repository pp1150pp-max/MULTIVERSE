// Friends, friend requests and blocks. Unlike parties and trades they are saved (server/db.ts: friends,
// friend_requests, blocks) and belong to the ACCOUNT: adding a character befriends its whole account, and
// the list shows the character that account plays now, or played last.
//
// A request needs the other side to accept; it waits in the database, so an offline player can be asked.
// A block ends any friendship or request between the two and stops the blocked account sending friend
// requests, whispers, party invites and trade requests (world.ts asks blocks() for the last three).
// Guests can't use any of this. The world passes the messages on; this class only decides and stores.
import type { Db } from './db';
import {
  BLOCK_MAX, FRIEND_MAX, FRIEND_NAME_MAX, FRIEND_PENDING_MAX, FRIEND_REREQUEST_GAP,
  type BlockEntry, type FriendChar, type FriendEntry, type FriendsView,
} from '../src/shared/friends';

/** What the world does for the friends system. */
export interface FriendsHost {
  /** The character this account plays right now (the newest login when it has several on), or null when offline. */
  playing(accountId: number): FriendChar | null;
  /** A system line in the chat of every character this account has online. */
  tell(accountId: number, text: string): void;
  /** Something on this account's friends window changed: send it the new view (if online). */
  changed(accountId: number): void;
}

/** Who acts: the account and whether it is a guest. */
export interface FriendActor {
  accountId: number;
  guest: boolean;
}

export const FRIEND_GUEST_MSG = 'Guest ใช้ระบบเพื่อนไม่ได้ — สมัครสมาชิกเพื่อใช้งาน';

export class Friends {
  /** `${from}:${to}` → when (ms) the last request between them went out. */
  private readonly lastRequest = new Map<string, number>();

  constructor(private readonly db: Db, private readonly host: FriendsHost, private readonly now: () => number = () => Date.now()) {}

  /** Whether `blocker` blocked `other` (then `other` can't whisper, invite or ask to trade them). */
  blocks(blocker: number, other: number): boolean {
    return this.db.isBlocked(blocker, other);
  }

  /** The accounts on this one's friends list. */
  friendsOf(accountId: number): number[] {
    return this.db.friendIds(accountId);
  }

  /** How many friend requests wait for this account's answer. */
  incomingCount(accountId: number): number {
    return this.db.incomingRequests(accountId).length;
  }

  /** The character to show for an account: the one played now, else the last one. */
  private charOf(accountId: number): FriendEntry {
    const live = this.host.playing(accountId);
    return { acc: accountId, online: !!live, char: live ?? this.db.lastCharacter(accountId) };
  }

  private nameOf(accountId: number): string {
    return this.charOf(accountId).char?.name ?? 'ผู้เล่น';
  }

  /** Everything this account's friends window shows. */
  view(accountId: number): FriendsView {
    const friends = this.db.friendIds(accountId).map((a) => this.charOf(a));
    friends.sort((x, y) => Number(y.online) - Number(x.online) || (x.char?.name ?? '').localeCompare(y.char?.name ?? ''));
    const blocked: BlockEntry[] = this.db.blockedIds(accountId).map((a) => ({ acc: a, name: this.db.lastCharacter(a)?.name ?? 'ผู้เล่น' }));
    return {
      friends,
      incoming: this.db.incomingRequests(accountId).map((a) => this.charOf(a)),
      outgoing: this.db.outgoingRequests(accountId).map((a) => this.charOf(a)),
      blocked,
    };
  }

  /** A character name from the client, checked, or null. */
  private lookup(name: unknown): { accountId: number; name: string; guest: boolean } | null | undefined {
    if (typeof name !== 'string') return null;
    const n = name.trim();
    if (!n || n.length > FRIEND_NAME_MAX) return null;
    return this.db.characterByName(n);
  }

  /** `me` asks the account playing character `name` to be friends. Returns an error line, or null. */
  request(me: FriendActor, name: unknown): string | null {
    if (me.guest) return FRIEND_GUEST_MSG;
    const to = this.lookup(name);
    if (to === null) return null;
    if (!to) return 'ไม่พบตัวละครชื่อนี้';
    if (to.guest) return 'เพิ่ม Guest เป็นเพื่อนไม่ได้';
    if (to.accountId === me.accountId) return 'เพิ่มตัวละครในบัญชีตัวเองเป็นเพื่อนไม่ได้';
    if (this.db.isBlocked(me.accountId, to.accountId)) return `คุณบล็อก ${to.name} ไว้ — ปลดบล็อกก่อนถึงจะเพิ่มเพื่อนได้`;
    // Neutral on purpose: a blocked player isn't told they are blocked.
    if (this.db.isBlocked(to.accountId, me.accountId)) return `ส่งคำขอเป็นเพื่อนถึง ${to.name} ไม่ได้`;
    if (this.db.areFriends(me.accountId, to.accountId)) return `${to.name} เป็นเพื่อนกับคุณอยู่แล้ว`;
    // They asked first: asking back accepts.
    if (this.db.hasFriendRequest(to.accountId, me.accountId)) return this.answer(me, to.accountId, true);
    if (this.db.hasFriendRequest(me.accountId, to.accountId)) return `ส่งคำขอถึง ${to.name} ไว้แล้ว รอคำตอบอยู่`;
    const full = this.fullBlock(me.accountId, to.accountId, to.name);
    if (full) return full;
    if (this.db.outgoingRequests(me.accountId).length >= FRIEND_PENDING_MAX) {
      return `มีคำขอที่รอคำตอบอยู่ ${FRIEND_PENDING_MAX} คำขอแล้ว — ยกเลิกบางคำขอก่อน`;
    }
    const t = this.now();
    const key = `${me.accountId}:${to.accountId}`;
    const last = this.lastRequest.get(key);
    if (last !== undefined && t - last < FRIEND_REREQUEST_GAP * 1000) {
      return `ส่งคำขอถึง ${to.name} ซ้ำได้อีกใน ${Math.ceil((last + FRIEND_REREQUEST_GAP * 1000 - t) / 1000)} วินาที`;
    }
    this.lastRequest.set(key, t);
    for (const [k, at] of this.lastRequest) if (t - at >= FRIEND_REREQUEST_GAP * 1000) this.lastRequest.delete(k);
    this.db.addFriendRequest(me.accountId, to.accountId);
    this.host.tell(me.accountId, `ส่งคำขอเป็นเพื่อนถึง ${to.name} แล้ว`);
    this.host.tell(to.accountId, `${this.nameOf(me.accountId)} ขอเป็นเพื่อนกับคุณ — เปิดหน้าต่างเพื่อนเพื่อตอบ`);
    this.host.changed(me.accountId);
    this.host.changed(to.accountId);
    return null;
  }

  /** Why these two can't become friends because a list is full, or null. */
  private fullBlock(me: number, other: number, otherName: string): string | null {
    if (this.db.friendIds(me).length >= FRIEND_MAX) return `รายชื่อเพื่อนเต็มแล้ว (สูงสุด ${FRIEND_MAX} คน)`;
    if (this.db.friendIds(other).length >= FRIEND_MAX) return `รายชื่อเพื่อนของ ${otherName} เต็มแล้ว`;
    return null;
  }

  /** `me` accepts or declines the request from account `from`. Returns an error line, or null. */
  answer(me: FriendActor, from: unknown, yes: unknown): string | null {
    if (me.guest) return FRIEND_GUEST_MSG;
    if (!Number.isSafeInteger(from) || typeof yes !== 'boolean') return null;
    const fromAcc = from as number;
    if (!this.db.hasFriendRequest(fromAcc, me.accountId)) return yes ? 'คำขอนี้ไม่มีแล้ว' : null;
    const name = this.nameOf(fromAcc);
    if (yes) {
      const full = this.fullBlock(me.accountId, fromAcc, name);
      if (full) return full;
    }
    this.db.transaction(() => {
      this.db.removeFriendRequest(fromAcc, me.accountId);
      if (yes) {
        // A request the other way too would be left over: it's answered by this.
        this.db.removeFriendRequest(me.accountId, fromAcc);
        this.db.addFriend(me.accountId, fromAcc);
      }
    });
    if (yes) {
      this.host.tell(me.accountId, `คุณกับ ${name} เป็นเพื่อนกันแล้ว`);
      this.host.tell(fromAcc, `${this.nameOf(me.accountId)} ตอบรับคำขอเป็นเพื่อนแล้ว`);
    }
    this.host.changed(me.accountId);
    this.host.changed(fromAcc);
    return null;
  }

  /** `me` takes back its request to account `to`. */
  cancel(me: FriendActor, to: unknown): string | null {
    if (me.guest) return FRIEND_GUEST_MSG;
    if (!Number.isSafeInteger(to)) return null;
    if (!this.db.removeFriendRequest(me.accountId, to as number)) return null;
    this.host.changed(me.accountId);
    this.host.changed(to as number);
    return null;
  }

  /** `me` removes account `other` from its friends (both lists). */
  remove(me: FriendActor, other: unknown): string | null {
    if (me.guest) return FRIEND_GUEST_MSG;
    if (!Number.isSafeInteger(other)) return null;
    const o = other as number;
    if (!this.db.removeFriend(me.accountId, o)) return 'ไม่ได้เป็นเพื่อนกันอยู่';
    this.host.tell(me.accountId, `ลบ ${this.nameOf(o)} ออกจากรายชื่อเพื่อนแล้ว`);
    this.host.changed(me.accountId);
    this.host.changed(o);
    return null;
  }

  /** `me` blocks the account playing character `name`. */
  block(me: FriendActor, name: unknown): string | null {
    if (me.guest) return FRIEND_GUEST_MSG;
    const to = this.lookup(name);
    if (to === null) return null;
    if (!to) return 'ไม่พบตัวละครชื่อนี้';
    if (to.accountId === me.accountId) return 'บล็อกตัวละครในบัญชีตัวเองไม่ได้';
    if (this.db.isBlocked(me.accountId, to.accountId)) return `บล็อก ${to.name} ไว้อยู่แล้ว`;
    if (this.db.blockedIds(me.accountId).length >= BLOCK_MAX) return `บล็อกได้สูงสุด ${BLOCK_MAX} คน — ปลดบล็อกบางคนก่อน`;
    this.db.addBlock(me.accountId, to.accountId);
    this.host.tell(me.accountId, `บล็อก ${to.name} แล้ว — เขาจะส่งคำขอเพื่อน กระซิบ ชวนปาร์ตี้ หรือขอเทรดหาคุณไม่ได้`);
    this.host.changed(me.accountId);
    this.host.changed(to.accountId);
    return null;
  }

  /** `me` unblocks account `other`. */
  unblock(me: FriendActor, other: unknown): string | null {
    if (me.guest) return FRIEND_GUEST_MSG;
    if (!Number.isSafeInteger(other)) return null;
    const o = other as number;
    if (!this.db.removeBlock(me.accountId, o)) return null;
    this.host.tell(me.accountId, `ปลดบล็อก ${this.db.lastCharacter(o)?.name ?? 'ผู้เล่น'} แล้ว`);
    this.host.changed(me.accountId);
    return null;
  }
}
