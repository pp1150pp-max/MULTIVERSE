// Mailbox (rules: docs/systems/mail.md): the limits, the shapes shared by the game, the admin page and
// the server, and the bag rules for claiming attachments. Pure rules, no DOM.
import { ADMIN_GOLD_MAX, ADMIN_ITEMS_MAX, adminStack, addStackToBag, adminStackName, type AdminStack } from './admin';
import { ITEM_BASES, makeItem } from './data/items';
import { MAX_PLUS } from './data/enhance';
import { MAX_LEVEL } from './formulas';
import { RARITIES, RARITY_LABEL, isPotion, type BagEntry, type ClassId, type Item, type Rarity } from './types';

/** Mail lives this long after it is sent; unclaimed attachments go with it. */
export const MAIL_DAYS = 30;
export const MAIL_MS = MAIL_DAYS * 24 * 60 * 60 * 1000;
/** The admin history (and the stored mail) is kept this long after sending. */
export const MAIL_HISTORY_DAYS = 60;
export const MAIL_TITLE_MAX = 60;
export const MAIL_BODY_MAX = 1000;

/** One attachment line. Gear is rolled when it is claimed, for the character that claims it. */
export type MailAttachItem =
  | { kind: 'equip'; baseId: string; rarity: Rarity; plus: number; level?: number; count: number }
  | { kind: 'potion'; potion: 'hp' | 'mp'; size: 's' | 'm' | 'l'; count: number; bound?: true }
  | { kind: 'stone'; stone: string; count: number; bound?: true };
// `bound`: given bound to the character that claims it (tutorial quest rewards, src/shared/tutorial.ts).
// Only the server sets it; cleanAttach (the admin form) never does.

export interface MailAttach { gold: number; items: MailAttachItem[] }

export const hasAttach = (a: MailAttach): boolean => a.gold > 0 || a.items.length > 0;

/**
 * Checks an attachment from a request (same choices and per-mail caps as the admin grant form:
 * gold up to ADMIN_GOLD_MAX, up to ADMIN_ITEMS_MAX pieces in all). Returns the clean copy or a Thai error.
 */
export function cleanAttach(raw: unknown): MailAttach | string {
  if (raw === undefined || raw === null) return { gold: 0, items: [] };
  if (typeof raw !== 'object') return 'ของแนบไม่ถูกต้อง';
  const r = raw as { gold?: unknown; items?: unknown };
  const gold = r.gold ?? 0;
  if (typeof gold !== 'number' || !Number.isInteger(gold) || gold < 0 || gold > ADMIN_GOLD_MAX) {
    return `ทองต้องเป็นจำนวนเต็ม 0–${ADMIN_GOLD_MAX.toLocaleString()}`;
  }
  const list = r.items ?? [];
  if (!Array.isArray(list) || list.length > ADMIN_ITEMS_MAX) return `แนบไอเทมได้ไม่เกิน ${ADMIN_ITEMS_MAX} รายการ`;
  const items: MailAttachItem[] = [];
  let pieces = 0;
  for (const x of list as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object') return 'ของแนบไม่ถูกต้อง';
    const count = x.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > ADMIN_ITEMS_MAX) return `จำนวนชิ้นต้องเป็น 1–${ADMIN_ITEMS_MAX}`;
    pieces += count;
    if (x.kind === 'potion' || x.kind === 'stone') {
      const s = adminStack(x);
      if (typeof s === 'string') return s;
      items.push(isPotion(s) ? { kind: 'potion', potion: s.potion, size: s.size, count } : { kind: 'stone', stone: s.stone, count });
    } else if (x.kind === 'equip') {
      const base = ITEM_BASES.find((b) => b.id === x.baseId);
      if (!base) return 'ไม่มีไอเทมชนิดนี้';
      const rarity = RARITIES.find((q) => q === x.rarity);
      if (!rarity) return 'ระดับความหายากไม่ถูกต้อง';
      const plus = x.plus ?? 0;
      if (typeof plus !== 'number' || !Number.isInteger(plus) || plus < 0 || plus > MAX_PLUS) return `ระดับตีบวกต้องเป็น 0–${MAX_PLUS}`;
      const level = x.level;
      if (level !== undefined && (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL)) return `เลเวลไอเทมต้องเป็น 1–${MAX_LEVEL}`;
      items.push({ kind: 'equip', baseId: base.id, rarity, plus, ...(level !== undefined ? { level } : {}), count });
    } else return 'ประเภทไอเทมไม่ถูกต้อง';
  }
  if (pieces > ADMIN_ITEMS_MAX) return `แนบรวมกันได้ไม่เกิน ${ADMIN_ITEMS_MAX} ชิ้นต่อจดหมาย`;
  return { gold, items };
}

/** The attachment as lines of Thai text (for the mail window and the admin history). */
export function describeAttach(a: MailAttach): string[] {
  const out: string[] = [];
  if (a.gold) out.push(`ทอง ${a.gold.toLocaleString()} G`);
  for (const x of a.items) {
    if (x.kind === 'equip') {
      const b = ITEM_BASES.find((q) => q.id === x.baseId);
      const name = b ? (b.names.any ?? Object.values(b.names)[0] ?? b.id) : x.baseId;
      out.push(`${x.plus ? `+${x.plus} ` : ''}${name} [${RARITY_LABEL[x.rarity]}]${x.level ? ` Lv.${x.level}` : ''} × ${x.count}`);
    } else {
      const s = (x.kind === 'potion' ? adminStack({ kind: 'potion', potion: x.potion, size: x.size }) : adminStack({ kind: 'stone', stone: x.stone })) as AdminStack;
      out.push(`${adminStackName(s)} × ${x.count}${x.bound ? ' (ผูกตัวละคร)' : ''}`);
    }
  }
  return out;
}

/**
 * The bag entries an attachment gives to this character: gear is rolled now for its class (item level =
 * the attachment's, else the character's, never below the kind's minimum). Lines of a kind that no longer exists are skipped.
 */
export function rollAttach(a: MailAttach, cls: ClassId, charLevel: number): BagEntry[] {
  const out: BagEntry[] = [];
  for (const x of a.items) {
    if (x.kind === 'equip') {
      const base = ITEM_BASES.find((b) => b.id === x.baseId);
      if (!base) continue; // a kind removed since it was sent
      const level = Math.min(MAX_LEVEL, Math.max(base.minLevel, x.level ?? charLevel));
      for (let k = 0; k < x.count; k++) {
        const item: Item | null = makeItem(base.id, x.rarity, level, cls);
        if (!item) continue;
        if (x.plus > 0) item.plus = x.plus;
        out.push(item);
      }
    } else {
      const s = x.kind === 'potion' ? adminStack({ kind: 'potion', potion: x.potion, size: x.size }) : adminStack({ kind: 'stone', stone: x.stone });
      if (typeof s !== 'string') out.push({ ...s, count: x.count, ...(x.bound ? { bound: true } : {}) } as BagEntry);
    }
  }
  return out;
}

/** Puts every entry into the bag (stacks top up, gear takes an empty slot). False if they don't all fit; use on a copy. */
export function putAll(bag: (BagEntry | null)[], entries: BagEntry[]): boolean {
  for (const e of entries) {
    if (isPotion(e) || 'stone' in e) {
      if (addStackToBag(bag, bag.length, e as AdminStack, (e as AdminStack).count) < (e as AdminStack).count) return false;
    } else {
      const i = bag.indexOf(null);
      if (i < 0) return false;
      bag[i] = e;
    }
  }
  return true;
}

/** How many empty bag slots this bag needs for the entries to fit (what the player is told). */
export function slotsNeeded(bag: (BagEntry | null)[], entries: BagEntry[]): number {
  const free = bag.filter((e) => !e).length;
  for (let extra = 0; extra <= 40; extra++) {
    if (putAll([...structuredClone(bag), ...Array<null>(extra).fill(null)], entries)) return free + extra;
  }
  return free + 40;
}

// ------------------------------------------------------------ the player's side

/** One mail in the list. `attach`: it still has unclaimed attachments (so it can't be deleted). */
export interface MailHead { id: number; from: string; title: string; at: number; expiresAt: number; read: boolean; attach: boolean }
export interface MailFull extends MailHead { body: string; lines: string[] }

export type MailCall =
  | { a: 'mailList' }
  | { a: 'mailRead'; id: number }
  /** id -1 = every mail with attachments (each one all-or-nothing). */
  /** Marks every mail read without claiming attachments. */
  | { a: 'mailReadAll' }
  | { a: 'mailClaim'; id: number }
  | { a: 'mailDelete'; id: number }
  /** Deletes every read mail that has nothing left to claim. */
  | { a: 'mailDeleteRead' };

export interface MailReply {
  ok: boolean;
  msg?: string;
  list?: MailHead[];
  mail?: MailFull;
  /** Unread mail count now (the icon's badge). */
  unread?: number;
}

// ------------------------------------------------------------ the admin side

/** Who a mail goes to. `char` = a character name, `account` = a username. */
export type MailTargetReq = { kind: 'char'; name: string } | { kind: 'account'; username: string } | { kind: 'allChars' } | { kind: 'allAccounts' };

export interface MailSendRow {
  id: number;
  at: number;
  by: string;
  target: string;
  title: string;
  body: string;
  lines: string[];
  recipients: number;
  read: number;
  claimed: number;
  recalled: number;
}

export interface MailRecipientRow { account: string; char: string | null; read: boolean; claimed: boolean; recalled: boolean }
