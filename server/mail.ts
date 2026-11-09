// The mailbox (rules: docs/systems/mail.md): mail sent by admins, optionally with gold, gear, potions and
// stones attached. Players read it, claim the attachments and delete it.
//
// Claiming gives everything or nothing, and exactly once. The copy is marked claimed by a guarded UPDATE
// in the same transaction that saves the character, so two clicks, or two characters of one account
// claiming an account-wide copy, can't both succeed (the market's claim box works the same way).
// Everything in the DB; nothing here touches a character that isn't online.
import type { Db, MailDbRow } from './db';
import type { Player } from '../src/shared/sim/Player';
import type { Sim } from '../src/shared/sim/Sim';
import type { BagEntry } from '../src/shared/types';
import {
  cleanAttach, describeAttach, hasAttach, putAll, rollAttach, slotsNeeded,
  MAIL_BODY_MAX, MAIL_MS, MAIL_TITLE_MAX,
  type MailAttach, type MailCall, type MailFull, type MailHead, type MailReply, type MailSendRow, type MailTargetReq,
} from '../src/shared/mail';

/** Who is using their mailbox: an online character (the world's session). */
export interface MailActor {
  accountId: number;
  charId: number;
  guest: boolean;
  player: Player;
  sim: Sim;
}

export const GUEST_MAIL_MSG = 'Guest ไม่มีกล่องจดหมาย — สมัครสมาชิกเพื่อรับจดหมาย';
const fail = (msg: string): MailReply => ({ ok: false, msg });

const parseAttach = (json: string): MailAttach => {
  try {
    const a = cleanAttach(JSON.parse(json));
    return typeof a === 'string' ? { gold: 0, items: [] } : a;
  } catch {
    return { gold: 0, items: [] };
  }
};

/** Strips control characters (the body keeps line breaks) and trims; one character over `max` is kept so the caller can tell it was too long. */
const clean = (v: unknown, max: number, multiline = false): string =>
  (typeof v === 'string' ? v : '').replace(multiline ? /[^\P{Cc}\n]|\p{Cf}/gu : /[\p{Cc}\p{Cf}]/gu, ' ').trim().slice(0, max + 1);

class Gone extends Error {}

export class Mail {
  constructor(private readonly db: Db, private readonly now: () => number = Date.now) {}

  // ------------------------------------------------------------ sending (admin)

  /**
   * Sends one mail. Returns the new send's id and how many copies went out, or a Thai error.
   * `every` targets copy the accounts / characters that exist right now (guests never get mail).
   */
  send(by: { id: number | null; name: string }, req: { target: MailTargetReq; title: unknown; body: unknown; attach: unknown }): { id: number; copies: number; label: string } | string {
    const title = clean(req.title, MAIL_TITLE_MAX);
    const body = clean(req.body, MAIL_BODY_MAX, true);
    if (!title) return 'พิมพ์หัวข้อจดหมายก่อน';
    if (title.length > MAIL_TITLE_MAX) return `หัวข้อยาวได้ไม่เกิน ${MAIL_TITLE_MAX} ตัวอักษร`;
    if (body.length > MAIL_BODY_MAX) return `เนื้อหายาวได้ไม่เกิน ${MAIL_BODY_MAX} ตัวอักษร`;
    const attach = cleanAttach(req.attach);
    if (typeof attach === 'string') return attach;
    const t = req.target as { kind?: unknown; name?: unknown; username?: unknown };
    let label: string;
    let char: { id: number; accountId: number } | undefined;
    let account: number | undefined;
    switch (t.kind) {
      case 'char': {
        const name = clean(t.name, 32);
        const c = name ? this.db.characterByName(name) : undefined;
        if (!c) return 'ไม่พบตัวละครชื่อนี้';
        if (c.guest) return 'Guest รับจดหมายไม่ได้';
        char = c;
        label = `ตัวละคร ${c.name} (#${c.id})`;
        break;
      }
      case 'account': {
        const username = clean(t.username, 32);
        const a = username ? this.db.findAccount(username) : undefined;
        if (!a) return 'ไม่พบบัญชีนี้ (Guest รับจดหมายไม่ได้)';
        account = a.id;
        label = `บัญชี ${a.username}`;
        break;
      }
      case 'allChars':
        label = 'ทุกตัวละคร';
        break;
      case 'allAccounts':
        label = 'ทุกบัญชี';
        break;
      default:
        return 'เลือกผู้รับก่อน';
    }
    const now = this.now();
    try {
      return this.db.transaction(() => {
        const id = this.db.mailSendInsert({
          senderId: by.id, senderName: by.name, target: label, title, body, attach: JSON.stringify(attach),
          hasAttach: hasAttach(attach), at: now, expiresAt: now + MAIL_MS,
        });
        let copies = 1;
        if (char) this.db.mailBoxAdd(id, char.accountId, char.id);
        else if (account !== undefined) this.db.mailBoxAdd(id, account, null);
        else copies = this.db.mailBoxFanout(id, t.kind === 'allChars' ? 'chars' : 'accounts');
        return { id, copies, label };
      });
    } catch (e) {
      console.error('[mail] send failed', e);
      return 'ส่งจดหมายไม่สำเร็จ ลองใหม่อีกครั้ง';
    }
  }

  /** Pulls back every copy nobody has claimed yet; returns how many were pulled back, or a Thai error. */
  recall(sendId: number): number | string {
    if (!this.db.mailSend(sendId)) return 'ไม่พบจดหมายนี้';
    const n = this.db.mailRecall(sendId, this.now());
    return n > 0 ? n : 'ไม่มีสำเนาที่ดึงกลับได้ — ทุกสำเนาถูกรับของไปแล้วหรือถูกดึงกลับแล้ว';
  }

  history(limit: number, before?: number): MailSendRow[] {
    return this.db.mailHistory(limit, before).map((r) => ({
      id: r.id, at: r.created_at, by: r.sender_name, target: r.target, title: r.title, body: r.body, lines: describeAttach(parseAttach(r.attach)),
      recipients: r.recipients, read: r.read, claimed: r.claimed, recalled: r.recalled,
    }));
  }

  recipients(sendId: number, limit: number) {
    return this.db.mailRecipients(sendId, limit);
  }

  // ------------------------------------------------------------ the player's mailbox

  handle(a: MailActor, call: MailCall): MailReply {
    if (a.guest) return fail(GUEST_MAIL_MSG);
    switch (call.a) {
      case 'mailList': return { ok: true, list: this.list(a), unread: this.unread(a) };
      case 'mailRead': return this.read(a, call.id);
      case 'mailClaim': return this.claim(a, call.id);
      case 'mailDelete': return this.remove(a, call.id);
      case 'mailDeleteRead': return this.removeRead(a);
      default: return fail('คำสั่งไม่ถูกต้อง');
    }
  }

  unread(a: Pick<MailActor, 'accountId' | 'charId'>): number {
    return this.db.mailUnread(a.accountId, a.charId, this.now());
  }

  /** How much mail this character hasn't been told about yet (marks it told). */
  takeFresh(a: Pick<MailActor, 'accountId' | 'charId'>): number {
    return this.db.mailTakeFresh(a.accountId, a.charId, this.now());
  }

  private head(r: MailDbRow): MailHead {
    return {
      id: r.id, from: r.sender_name, title: r.title, at: r.created_at, expiresAt: r.expires_at,
      read: r.read_at !== null, attach: r.has_attach === 1 && r.claimed_at === null,
    };
  }

  private list(a: MailActor): MailHead[] {
    return this.db.mailInbox(a.accountId, a.charId, this.now()).map((r) => this.head(r));
  }

  private read(a: MailActor, id: unknown): MailReply {
    if (typeof id !== 'number' || !Number.isInteger(id)) return fail('ไม่พบจดหมายนี้');
    const now = this.now();
    const r = this.db.mailGet(id, a.accountId, a.charId, now);
    if (!r) return fail('ไม่พบจดหมายนี้ (อาจหมดอายุหรือถูกดึงกลับแล้ว)');
    this.db.mailMarkRead(id, now);
    const att = parseAttach(r.attach);
    const mail: MailFull = { ...this.head({ ...r, read_at: r.read_at ?? now }), body: r.body, lines: r.claimed_at === null ? describeAttach(att) : [] };
    return { ok: true, mail, unread: this.unread(a) };
  }

  /** Saves the character (and its account's stash, as a normal save does) inside the current transaction. */
  private write(a: MailActor): void {
    this.db.writeCharacterAndStash(a.charId, a.player.toData(), a.accountId, a.player.stash);
  }

  /** Gives one mail's attachments, all or nothing. Returns null on success, else why not. */
  private claimOne(a: MailActor, r: MailDbRow): string | null {
    const p = a.player;
    if (r.claimed_at !== null) return 'รับของจากจดหมายฉบับนี้ไปแล้ว';
    const att = parseAttach(r.attach);
    if (!hasAttach(att)) return 'จดหมายฉบับนี้ไม่มีของแนบ';
    const entries: BagEntry[] | null = rollAttach(att, p.cls.id, p.level);
    if (!entries) return 'ของแนบเสียหาย — แจ้งผู้ดูแล';
    if (!putAll(structuredClone(p.bag), entries)) {
      const need = slotsNeeded(p.bag, entries);
      return `กระเป๋าไม่พอ — ต้องมีช่องว่างอย่างน้อย ${need} ช่อง (ตอนนี้ว่าง ${p.bag.filter((e) => !e).length} ช่อง)`;
    }
    const before = structuredClone(p.bag);
    const goldBefore = p.gold;
    putAll(p.bag, entries);
    p.gold += att.gold;
    try {
      this.db.transaction(() => {
        if (!this.db.mailMarkClaimed(r.id, a.charId, this.now())) throw new Gone();
        this.write(a);
      });
    } catch (e) {
      for (let i = 0; i < p.bag.length; i++) p.bag[i] = before[i];
      p.gold = goldBefore;
      if (e instanceof Gone) return 'รับของไม่ได้ — จดหมายถูกรับไปแล้ว หมดอายุ หรือถูกดึงกลับ';
      console.error('[mail] claiming failed', e);
      return 'รับของไม่สำเร็จ ลองใหม่อีกครั้ง';
    }
    a.sim.inventoryChanged(p);
    return null;
  }

  private claim(a: MailActor, id: unknown): MailReply {
    if (typeof id !== 'number' || !Number.isInteger(id)) return fail('ไม่พบจดหมายนี้');
    const now = this.now();
    const rows = id === -1
      ? this.db.mailInbox(a.accountId, a.charId, now).filter((r) => r.has_attach === 1 && r.claimed_at === null)
      : [this.db.mailGet(id, a.accountId, a.charId, now)].filter((r): r is MailDbRow => !!r);
    if (!rows.length) return fail(id === -1 ? 'ไม่มีจดหมายที่มีของรอรับ' : 'ไม่พบจดหมายนี้ (อาจหมดอายุหรือถูกดึงกลับแล้ว)');
    let done = 0;
    let why: string | null = null;
    let skipped = 0;
    for (const r of rows) {
      const err = this.claimOne(a, r);
      if (err === null) done++;
      else {
        skipped++;
        why ??= err;
      }
    }
    const reply: MailReply = { ok: done > 0 };
    if (id === -1) reply.msg = done ? `รับของจาก ${done} ฉบับแล้ว${skipped ? ` · ${skipped} ฉบับรับไม่ได้ (${why})` : ''}` : (why ?? '');
    else reply.msg = done ? 'รับของแล้ว' : (why ?? '');
    reply.list = this.list(a);
    reply.unread = this.unread(a);
    if (id !== -1) {
      const m = this.db.mailGet(id, a.accountId, a.charId, now);
      if (m) reply.mail = { ...this.head(m), body: m.body, lines: m.claimed_at === null ? describeAttach(parseAttach(m.attach)) : [] };
    }
    return reply;
  }

  private remove(a: MailActor, id: unknown): MailReply {
    if (typeof id !== 'number' || !Number.isInteger(id)) return fail('ไม่พบจดหมายนี้');
    if (!this.db.mailDelete(id, a.accountId, a.charId, this.now())) return fail('ลบไม่ได้ — ยังมีของแนบที่ยังไม่ได้รับ');
    return { ok: true, msg: 'ลบจดหมายแล้ว', list: this.list(a), unread: this.unread(a) };
  }

  private removeRead(a: MailActor): MailReply {
    const n = this.db.mailDeleteRead(a.accountId, a.charId, this.now());
    return { ok: true, msg: n ? `ลบจดหมายที่อ่านแล้ว ${n} ฉบับ` : 'ไม่มีจดหมายที่ลบได้ (จดหมายที่มีของแนบยังไม่ได้รับจะไม่ถูกลบ)', list: this.list(a), unread: this.unread(a) };
  }
}
