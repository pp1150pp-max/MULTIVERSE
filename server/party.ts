// Parties: who is with whom, invites, and members whose connection dropped. Only in memory: never
// saved, so a server restart ends every party. Everything is keyed on the character id, because a
// player's id inside a zone's Sim changes whenever they walk through a portal. The world (world.ts)
// tells this registry what happens and passes its messages on; the Sim only sees Player.partyId.
import type { ClassId } from '../src/shared/types';
import { INVITE_TTL, OFFLINE_GRACE, PARTY_MAX, REINVITE_GAP } from '../src/shared/party';

/** A character in the world, as far as parties care. */
export interface PartyChar {
  charId: number;
  accountId: number;
  name: string;
  cls: ClassId;
  level: number;
  guest: boolean;
}

export interface PartyMember {
  charId: number;
  accountId: number;
  name: string;
  cls: ClassId;
  /** Last known level, max HP / MP and zone (used while the member is offline). */
  level: number;
  maxHp: number;
  maxMp: number;
  zone: string;
  /** Channel of that zone (1 when it has none). */
  ch?: number;
  online: boolean;
  /** While offline: when (ms) they drop out of the party for good. */
  offlineUntil: number;
}

/** members[0] is the leader. Room to grow (a boss room, say) goes here. */
export interface Party {
  id: number;
  members: PartyMember[];
}

interface Invite {
  partyId: number;
  from: number;
  to: number;
  toName: string;
  until: number;
}

/** What the world passes on to the players involved. */
export interface PartyEvents {
  /** A system line in these members' party chat. */
  notice(charIds: number[], text: string): void;
  /** This character joined (partyId) or left (null) a party: update its Player.partyId. */
  moved(charId: number, partyId: number | null): void;
  /** Show this character an invite popup. */
  invited(toCharId: number, partyId: number, fromName: string, seconds: number): void;
  /** Close an invite popup that is no longer valid (answered, expired, party gone). */
  inviteGone(toCharId: number, partyId: number): void;
  /** A one-off line just for this character (a refusal, or "X declined"). */
  tell(charId: number, text: string): void;
}

const GUEST_MSG = 'Guest ใช้ระบบปาร์ตี้ไม่ได้ — สมัครสมาชิกเพื่อใช้งาน';

export class Parties {
  private readonly parties = new Map<number, Party>();
  private readonly byChar = new Map<number, Party>();
  private invites: Invite[] = [];
  /** `${from}:${to}` → when (ms) the last invite between them went out. */
  private readonly lastInvite = new Map<string, number>();
  private nextId = 1;

  constructor(private readonly ev: PartyEvents, private readonly now: () => number = () => Date.now()) {}

  of(charId: number): Party | undefined {
    return this.byChar.get(charId);
  }

  member(charId: number): PartyMember | undefined {
    return this.byChar.get(charId)?.members.find((m) => m.charId === charId);
  }

  private ids(p: Party, onlyOnline = true): number[] {
    return p.members.filter((m) => !onlyOnline || m.online).map((m) => m.charId);
  }

  private newMember(c: PartyChar, info?: { maxHp: number; maxMp: number; zone: string }): PartyMember {
    return {
      charId: c.charId, accountId: c.accountId, name: c.name, cls: c.cls, level: c.level,
      maxHp: info?.maxHp ?? 1, maxMp: info?.maxMp ?? 1, zone: info?.zone ?? '', online: true, offlineUntil: 0,
    };
  }

  /** Starts a party with this character as its leader. Returns an error message, or null. */
  create(c: PartyChar): string | null {
    if (c.guest) return GUEST_MSG;
    if (this.byChar.has(c.charId)) return 'คุณอยู่ในปาร์ตี้อยู่แล้ว';
    const p: Party = { id: this.nextId++, members: [this.newMember(c)] };
    this.parties.set(p.id, p);
    this.byChar.set(c.charId, p);
    this.ev.moved(c.charId, p.id);
    this.ev.notice([c.charId], 'สร้างปาร์ตี้แล้ว — คุณเป็นหัวหน้าปาร์ตี้');
    return null;
  }

  /** Why `to` can't join party `p` right now, or null if they can. Checked on invite and again on accepting. */
  private joinBlock(p: Party, to: PartyChar): string | null {
    if (to.guest) return 'ชวน Guest เข้าปาร์ตี้ไม่ได้';
    if (p.members.some((m) => m.charId === to.charId)) return `${to.name} อยู่ในปาร์ตี้ของคุณแล้ว`;
    const other = this.byChar.get(to.charId);
    if (other) return `${to.name} อยู่ในปาร์ตี้อื่นอยู่แล้ว — ต้องออกจากปาร์ตี้เดิมก่อน`;
    if (p.members.length >= PARTY_MAX) return `ปาร์ตี้เต็มแล้ว (สูงสุด ${PARTY_MAX} คน)`;
    if (p.members.some((m) => m.accountId === to.accountId)) return 'ปาร์ตี้มีตัวละครจากบัญชีเดียวกันอยู่แล้ว — บัญชีหนึ่งเข้าได้ 1 ตัว';
    return null;
  }

  /**
   * The leader (or someone with no party yet, who then gets one) invites `to`. `toBlocks` = the target
   * turned party invites off. Returns an error message for the inviter, or null when the invite went out.
   */
  invite(from: PartyChar, to: PartyChar | undefined, toBlocks: boolean): string | null {
    if (from.guest) return GUEST_MSG;
    if (!to) return 'ไม่พบผู้เล่นนี้ (ต้องออนไลน์อยู่)';
    if (to.charId === from.charId) return 'ชวนตัวเองไม่ได้';
    let p = this.byChar.get(from.charId);
    if (p && p.members[0].charId !== from.charId) return 'เฉพาะหัวหน้าปาร์ตี้เท่านั้นที่ชวนได้';
    if (p) {
      const why = this.joinBlock(p, to);
      if (why) return why;
    } else if (to.guest) return 'ชวน Guest เข้าปาร์ตี้ไม่ได้';
    else if (to.accountId === from.accountId) return 'ปาร์ตี้มีตัวละครจากบัญชีเดียวกันอยู่แล้ว — บัญชีหนึ่งเข้าได้ 1 ตัว';
    else if (this.byChar.has(to.charId)) return `${to.name} อยู่ในปาร์ตี้อื่นอยู่แล้ว — ต้องออกจากปาร์ตี้เดิมก่อน`;
    if (toBlocks) return `${to.name} ปิดการรับคำชวนปาร์ตี้ไว้`;
    const t = this.now();
    const key = `${from.charId}:${to.charId}`;
    const last = this.lastInvite.get(key);
    if (last !== undefined && t - last < REINVITE_GAP * 1000) {
      return `ชวน ${to.name} ซ้ำได้อีกใน ${Math.ceil((last + REINVITE_GAP * 1000 - t) / 1000)} วินาที`;
    }
    if (!p) {
      this.create(from);
      p = this.byChar.get(from.charId)!;
    }
    const pid = p.id;
    if (this.invites.some((i) => i.partyId === pid && i.to === to.charId && i.until > t)) return `ชวน ${to.name} ไว้แล้ว รอคำตอบอยู่`;
    this.lastInvite.set(key, t);
    this.invites.push({ partyId: pid, from: from.charId, to: to.charId, toName: to.name, until: t + INVITE_TTL * 1000 });
    this.ev.invited(to.charId, pid, from.name, INVITE_TTL);
    this.ev.tell(from.charId, `ส่งคำชวนปาร์ตี้ถึง ${to.name} แล้ว`);
    return null;
  }

  /** Accept or decline an invite from party `partyId`. Returns an error message for `c`, or null. */
  answer(c: PartyChar, partyId: number, yes: boolean, info?: { maxHp: number; maxMp: number; zone: string }): string | null {
    const t = this.now();
    const inv = this.invites.find((i) => i.partyId === partyId && i.to === c.charId && i.until > t);
    this.invites = this.invites.filter((i) => !(i.partyId === partyId && i.to === c.charId));
    this.ev.inviteGone(c.charId, partyId);
    if (!inv) return yes ? 'คำชวนนี้หมดอายุแล้ว' : null;
    const p = this.parties.get(partyId);
    if (!yes) {
      if (p) this.ev.tell(inv.from, `${c.name} ปฏิเสธคำชวนปาร์ตี้`);
      return null;
    }
    if (!p) return 'ปาร์ตี้นี้ถูกยุบไปแล้ว';
    const why = this.joinBlock(p, c);
    if (why) return why;
    p.members.push(this.newMember(c, info));
    this.byChar.set(c.charId, p);
    // An invite from another party can't be taken any more.
    for (const i of this.invites.filter((x) => x.to === c.charId)) this.ev.inviteGone(c.charId, i.partyId);
    this.invites = this.invites.filter((x) => x.to !== c.charId);
    this.ev.moved(c.charId, p.id);
    this.ev.notice(this.ids(p), `${c.name} เข้าร่วมปาร์ตี้`);
    return null;
  }

  /** Leaves the party (by choice, or the grace time ran out). `why` picks the wording. */
  leave(charId: number, why: 'left' | 'kicked' | 'timeout' = 'left'): void {
    const p = this.byChar.get(charId);
    if (!p) return;
    const i = p.members.findIndex((m) => m.charId === charId);
    const m = p.members[i];
    p.members.splice(i, 1);
    this.byChar.delete(charId);
    this.ev.moved(charId, null);
    if (why === 'kicked') this.ev.tell(charId, 'คุณถูกเตะออกจากปาร์ตี้');
    else if (why === 'left') this.ev.tell(charId, 'คุณออกจากปาร์ตี้แล้ว');
    const text = why === 'kicked' ? `${m.name} ถูกเตะออกจากปาร์ตี้` : why === 'timeout' ? `${m.name} หลุดการเชื่อมต่อนานเกินไป — ออกจากปาร์ตี้` : `${m.name} ออกจากปาร์ตี้`;
    this.ev.notice(this.ids(p), text);
    if (p.members.length <= 1) return this.disband(p);
    if (i === 0) this.ev.notice(this.ids(p), `${p.members[0].name} เป็นหัวหน้าปาร์ตี้คนใหม่`);
  }

  /** The leader removes a member. Returns an error message, or null. */
  kick(leader: PartyChar, charId: number): string | null {
    const p = this.byChar.get(leader.charId);
    if (!p) return 'คุณไม่ได้อยู่ในปาร์ตี้';
    if (p.members[0].charId !== leader.charId) return 'เฉพาะหัวหน้าปาร์ตี้เท่านั้นที่เตะสมาชิกได้';
    if (charId === leader.charId) return 'เตะตัวเองไม่ได้ — ใช้ปุ่มออกจากปาร์ตี้';
    if (!p.members.some((m) => m.charId === charId)) return 'ไม่พบสมาชิกคนนี้ในปาร์ตี้';
    this.leave(charId, 'kicked');
    return null;
  }

  private disband(p: Party): void {
    for (const m of p.members) {
      this.byChar.delete(m.charId);
      this.ev.moved(m.charId, null);
      if (m.online) this.ev.tell(m.charId, 'ปาร์ตี้ถูกยุบ (เหลือสมาชิกคนเดียว)');
    }
    p.members = [];
    this.parties.delete(p.id);
    for (const i of this.invites.filter((x) => x.partyId === p.id)) this.ev.inviteGone(i.to, i.partyId);
    this.invites = this.invites.filter((x) => x.partyId !== p.id);
  }

  /** The connection dropped: the member stays, shown offline, for OFFLINE_GRACE seconds. */
  offline(charId: number, last: { level: number; maxHp: number; maxMp: number; zone: string; ch?: number }): void {
    for (const i of this.invites.filter((x) => x.to === charId)) this.ev.inviteGone(i.to, i.partyId);
    this.invites = this.invites.filter((x) => x.to !== charId);
    const m = this.member(charId);
    if (!m) return;
    Object.assign(m, last);
    m.online = false;
    m.offlineUntil = this.now() + OFFLINE_GRACE * 1000;
  }

  /** The character is in the world (again). Returns their party id, or null. */
  online(charId: number): number | null {
    const m = this.member(charId);
    if (!m) return null;
    m.online = true;
    m.offlineUntil = 0;
    return this.byChar.get(charId)!.id;
  }

  /** Called about once a second: ends unanswered invites and drops members offline too long. */
  tick(): void {
    const t = this.now();
    for (const i of this.invites.filter((x) => x.until <= t)) {
      this.ev.inviteGone(i.to, i.partyId);
      this.ev.tell(i.from, `${i.toName} ไม่ได้ตอบรับคำชวนปาร์ตี้ (หมดเวลา)`);
    }
    this.invites = this.invites.filter((x) => x.until > t);
    for (const [k, at] of this.lastInvite) if (t - at >= REINVITE_GAP * 1000) this.lastInvite.delete(k);
    for (const p of [...this.parties.values()]) {
      for (const m of [...p.members]) if (!m.online && m.offlineUntil <= t) this.leave(m.charId, 'timeout');
    }
  }
}
