// Top-up by PromptPay (เติมคริสตัลมิติ, owner 2026-11-22, docs/systems/topup.md). Half by hand: the player
// picks a package of the cash shop, the server makes a request whose amount is the package price plus a
// few satang no other open request has (100.37), the game shows a Thai QR (EMVCo, built here, no outside
// service) for exactly that amount, and the owner confirms it in /admin after seeing the money arrive in
// the bank app (never from a slip). Pure data and checks, used by browser and server.
import type { CashPackage } from './cashShop';

export const TOPUP_SETTING = 'topup';
/** `{ at, by }` once the owner switched the close beta refund on (no row = off). */
export const TOPUP_REFUND_SETTING = 'topup_refund';

export const TOPUP_EXPIRE_HOURS_MAX = 168;
export const TOPUP_PENDING_MAX = 5;
export const TOPUP_PER_DAY_MAX = 100;
export const TOPUP_NOTICE_MAX = 1000;

/** The text players see in the top-up window (owner approved the draft 2026-11-22). */
export const TOPUP_NOTICE_DEFAULT = [
  'ช่วง Close Beta: การเติมคริสตัลมิติเป็นการสนับสนุนการพัฒนาเกม',
  '• คริสตัลมิติแลกคืนเป็นเงินไม่ได้',
  '• ของที่ซื้อและคริสตัลที่เหลือจะหายตอนล้างข้อมูลก่อน Open Beta',
  '• เมื่อเปิด Open Beta จะได้คริสตัลมิติคืนเท่าที่ได้รับรวมโบนัสทั้งหมด เข้าบัญชีเดิมอัตโนมัติ',
  '• โอนตามยอดที่แสดงให้ตรงทุกสตางค์ ทีมงานตรวจยอดเข้าจริงแล้วจะเติมให้ (ไม่ต้องส่งสลิป)',
].join('\n');

export interface TopupCfg {
  /** Players may make requests. */
  open: boolean;
  /** PromptPay id, digits only: phone (10, starts with 0), national / tax id (13) or e-wallet (15). '' = not set. */
  promptpay: string;
  /** A request waits this long for the owner (an expired one can still be confirmed in /admin). */
  expireHours: number;
  /** Open requests one account may have at once. */
  maxPending: number;
  /** New requests one account may make per day (cancelling and asking again uses up the satang). */
  perDay: number;
  notice: string;
}

export const defaultTopup = (): TopupCfg => ({ open: false, promptpay: '', expireHours: 24, maxPending: 1, perDay: 10, notice: TOPUP_NOTICE_DEFAULT });

/** Digits only; null if it isn't a PromptPay id. */
export function promptPayId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(d)) return null;
  if (d.length === 10 && d.startsWith('0')) return d;
  if (d.length === 13 || d.length === 15) return d;
  return null;
}

/** Only the last 4 digits (logs, audit, GMs): the full number never goes there. */
export const maskPromptPay = (id: string): string => (id ? `••••${id.slice(-4)}` : '(ยังไม่ตั้ง)');

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

type Check<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

/** Settings sent by /admin (`strict`) or read from the database (lenient: wrong parts fall back to the default). */
export function checkTopup(v: unknown, strict: boolean): Check<TopupCfg> {
  const out = defaultTopup();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'ค่าการเติมเงินไม่ถูกต้อง' } : { value: out };
  const o = v as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => !(k in out));
    if (extra) return { error: `ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const bad = (why: string): Check<TopupCfg> | null => (strict ? { error: why } : null);
  if (o.open !== undefined) {
    if (typeof o.open === 'boolean') out.open = o.open;
    else { const b = bad('เปิดการเติมต้องเป็น true/false'); if (b) return b; }
  }
  if (o.promptpay !== undefined && o.promptpay !== '') {
    const id = promptPayId(o.promptpay);
    if (id) out.promptpay = id;
    else { const b = bad('เลขพร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก (ขึ้นต้น 0) เลขบัตรประชาชน/ผู้เสียภาษี 13 หลัก หรือ e-Wallet 15 หลัก'); if (b) return b; }
  }
  const num = (k: 'expireHours' | 'maxPending' | 'perDay', max: number, what: string): Check<TopupCfg> | null => {
    if (o[k] === undefined) return null;
    if (isInt(o[k], 1, max)) out[k] = o[k] as number;
    else return bad(`${what}ต้องเป็นจำนวนเต็ม 1–${max}`);
    return null;
  };
  for (const r of [num('expireHours', TOPUP_EXPIRE_HOURS_MAX, 'อายุคำขอ (ชั่วโมง) '), num('maxPending', TOPUP_PENDING_MAX, 'คำขอค้างต่อบัญชี '), num('perDay', TOPUP_PER_DAY_MAX, 'คำขอต่อวันต่อบัญชี ')]) {
    if (r) return r;
  }
  if (o.notice !== undefined) {
    if (typeof o.notice === 'string' && o.notice.trim() && o.notice.length <= TOPUP_NOTICE_MAX) out.notice = o.notice.trim();
    else { const b = bad(`ข้อความแจ้งผู้เล่นต้องมี 1–${TOPUP_NOTICE_MAX} ตัวอักษร`); if (b) return b; }
  }
  if (strict && out.open && !out.promptpay) return { error: 'ตั้งเลขพร้อมเพย์ก่อนเปิดการเติม' };
  return { value: out };
}

/** Only what differs from the default is stored (all default = no row). */
export function topupToStore(c: TopupCfg): Partial<TopupCfg> | null {
  const d = defaultTopup();
  const out: Partial<TopupCfg> = {};
  for (const k of Object.keys(d) as (keyof TopupCfg)[]) if (c[k] !== d[k]) (out as Record<string, unknown>)[k] = c[k];
  return Object.keys(out).length ? out : null;
}

/** Audit text of what changed (the number masked). */
export function topupChanges(a: TopupCfg, b: TopupCfg): string {
  const out: string[] = [];
  if (a.open !== b.open) out.push(b.open ? 'เปิดการเติม' : 'ปิดการเติม');
  if (a.promptpay !== b.promptpay) out.push(`เลขพร้อมเพย์ ${maskPromptPay(a.promptpay)} → ${maskPromptPay(b.promptpay)}`);
  if (a.expireHours !== b.expireHours) out.push(`อายุคำขอ ${a.expireHours} → ${b.expireHours} ชม.`);
  if (a.maxPending !== b.maxPending) out.push(`คำขอค้างต่อบัญชี ${a.maxPending} → ${b.maxPending}`);
  if (a.perDay !== b.perDay) out.push(`คำขอต่อวัน ${a.perDay} → ${b.perDay}`);
  if (a.notice !== b.notice) out.push('แก้ข้อความแจ้งผู้เล่น');
  return out.join(', ');
}

// ------------------------------------------------------------ money (whole satang, never floats)

/** 10037 → "100.37" (the QR's amount field). */
export function satangText(satang: number): string {
  return `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`;
}

/** 123456 → "1,234.56" (shown to people). */
export function bahtText(satang: number): string {
  return `${Math.floor(satang / 100).toLocaleString('en-US')}.${String(satang % 100).padStart(2, '0')}`;
}

/**
 * The amount for a new request: `baht` plus 1–99 satang, not equal to any amount in `taken` (the open
 * requests). `rnd` picks among the free ones. null = all 99 taken.
 */
export function pickAmount(baht: number, taken: ReadonlySet<number>, rnd: () => number = Math.random): number | null {
  const free: number[] = [];
  for (let s = 1; s <= 99; s++) if (!taken.has(baht * 100 + s)) free.push(baht * 100 + s);
  return free.length ? free[Math.floor(rnd() * free.length)] : null;
}

// ------------------------------------------------------------ Thai QR (EMVCo merchant-presented, PromptPay)

const tlv = (tag: string, value: string): string => `${tag}${String(value.length).padStart(2, '0')}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, start 0xFFFF) of the ASCII text, as EMVCo tag 63 wants. */
export function crc16(text: string): number {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

/**
 * The text inside a PromptPay QR for `id` (promptPayId digits) and, if given, an amount in satang (the
 * bank app then fills it in and can't change it). Tag order and formats as the widely used promptpay-qr.
 */
export function promptPayPayload(id: string, amountSatang?: number): string {
  const target = id.length === 10
    ? tlv('01', `0066${id.slice(1)}`)
    : tlv(id.length === 13 ? '02' : '03', id);
  const body = tlv('00', '01')
    + tlv('01', amountSatang ? '12' : '11')
    + tlv('29', tlv('00', 'A000000677010111') + target)
    + tlv('58', 'TH')
    + tlv('53', '764')
    + (amountSatang ? tlv('54', satangText(amountSatang)) : '')
    + '6304';
  return body + crc16(body).toString(16).toUpperCase().padStart(4, '0');
}

// ------------------------------------------------------------ requests

export type TopupStatus = 'pending' | 'expired' | 'cancelled' | 'rejected' | 'confirmed' | 'reversed';
export const TOPUP_STATUS_NAME: Record<TopupStatus, string> = {
  pending: 'รอยืนยัน', expired: 'หมดอายุ', cancelled: 'ผู้เล่นยกเลิก', rejected: 'ปฏิเสธ', confirmed: 'ยืนยันแล้ว', reversed: 'ย้อนแล้ว',
};
/** The owner may still confirm these (the player may have paid before it ran out / was cancelled). */
export const TOPUP_CONFIRMABLE: readonly TopupStatus[] = ['pending', 'expired', 'cancelled'];

/** The player's open request, as the window shows it. */
export interface TopupPending {
  id: number;
  crystals: number;
  bonus: number;
  baht: number;
  /** To transfer, in satang. */
  amount: number;
  expiresAt: number;
  /** The QR text (made by the server). */
  qr: string;
}

/** What the browser is sent: whether top-up is open, the notice, and this account's open requests. */
export interface TopupView { open: boolean; notice: string; pending: TopupPending[]; maxPending: number }

export const closedTopup = (): TopupView => ({ open: false, notice: '', pending: [], maxPending: 1 });

/** Why a package can't be asked for, or null (`pk` = the packages on sale now). */
export function topupNewError(v: TopupView, pk: readonly CashPackage[], p: { crystals?: unknown; bonus?: unknown; baht?: unknown }, guest: boolean): string | null {
  if (guest) return 'Guest เติมคริสตัลมิติไม่ได้ สมัครสมาชิกก่อน';
  if (!v.open) return 'ยังไม่เปิดให้เติมคริสตัลมิติ';
  if (!pk.some((x) => x.crystals === p.crystals && x.bonus === p.bonus && x.baht === p.baht)) return 'แพ็กเกจนี้เปลี่ยนไปแล้ว เปิดดูใหม่อีกครั้ง';
  if (v.pending.length >= v.maxPending) return v.maxPending === 1 ? 'มีคำขอเติมที่รอยืนยันอยู่แล้ว รอให้ยืนยันหรือยกเลิกก่อน' : `มีคำขอรอยืนยันครบ ${v.maxPending} รายการแล้ว`;
  return null;
}

/** One request in /admin. */
export interface TopupRow {
  id: number;
  accountId: number;
  username: string;
  charName: string;
  crystals: number;
  bonus: number;
  baht: number;
  amount: number;
  status: TopupStatus;
  createdAt: number;
  expiresAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  confirmedAt: number | null;
}

/** GET /api/admin/topup. */
export interface AdminTopup {
  cfg: TopupCfg;
  /** The full PromptPay number and the settings / refund buttons are the owner's (others see it masked). */
  isOwner: boolean;
  /** May confirm / reject / reverse (the `topupConfirm` switch). */
  canConfirm: boolean;
  rows: TopupRow[];
  /** The close beta refund: when it was switched on, by whom, and how many accounts got it so far. */
  refund: { at: number; by: string } | null;
  refunded: { accounts: number; crystals: number };
  /** Every confirmed top-up so far: requests, money (satang), crystals (with bonus). */
  totals: { count: number; amount: number; crystals: number };
}
