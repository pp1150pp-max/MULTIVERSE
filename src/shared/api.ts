// Online account API: request/response shapes and validation rules, shared by the browser and
// the server so both check names and passwords the same way.
import type { ClassId } from './types';
import { CLASS_IDS } from './data/classes';

export const MAX_CHARACTERS = 3;
export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;
/** Letters (Thai included), digits, underscore and inner spaces; 2–16 characters. */
const CHAR_NAME_RE = /^[\p{L}\p{M}\p{N}_](?:[\p{L}\p{M}\p{N}_ ]{0,14}[\p{L}\p{M}\p{N}_])?$/u;

/** Returns an error message in Thai, or null when the value is fine. */
export function checkUsername(u: string): string | null {
  return USERNAME_RE.test(u) ? null : 'ชื่อผู้ใช้ต้องยาว 3–16 ตัว ใช้ได้เฉพาะ A–Z, 0–9 และ _';
}

export function checkPassword(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัว`;
  if (p.length > PASSWORD_MAX) return `รหัสผ่านยาวได้ไม่เกิน ${PASSWORD_MAX} ตัว`;
  return null;
}

export function checkCharacterName(n: string): string | null {
  if (n.length < 2 || n.length > 16 || !CHAR_NAME_RE.test(n)) {
    return 'ชื่อตัวละครต้องยาว 2–16 ตัว ใช้ได้เฉพาะตัวอักษร ตัวเลข _ และเว้นวรรคตรงกลาง';
  }
  return null;
}

export function isClassId(v: unknown): v is ClassId {
  return typeof v === 'string' && (CLASS_IDS as string[]).includes(v);
}

// ------------------------------------------------------------ requests / responses

export interface AuthRequest { username: string; password: string }
export interface AuthResponse { token: string; username: string }
/**
 * `guest`: the token belongs to a guest (a temporary account with one character), not a real account.
 * `google`: the email of the linked Google account (null = none) · `hasPassword`: can log in with a password.
 */
export interface MeResponse { username: string; guest: boolean; google?: string | null; hasPassword?: boolean }
/** Register: `guestToken` (optional) moves that guest's character into the new account. */
export interface RegisterRequest extends AuthRequest { guestToken?: string }
export interface GuestRequest { name: string; classId: ClassId }
export interface GuestResponse { token: string; character: CharacterSummary }

/** Hours a guest survives without being online (the server deletes it after that). */
export const GUEST_TTL_HOURS = 24;
/** New guests one address may make per hour. */
export const GUEST_PER_IP_HOUR = 5;

/** One row on the character select screen. */
export interface CharacterSummary {
  id: number; name: string; classId: ClassId; level: number;
  /** The floor its next login lands on (src/shared/floors.ts loginHub), for the loading pictures. Missing = 1. */
  floor?: number;
}
export interface CreateCharacterRequest { name: string; classId: ClassId }

/** Why a banned account can't play: shown at login and when joining. `until` = BAN_FOREVER is permanent. */
export function banMessage(until: number, reason: string): string {
  const when = until >= 8_000_000_000_000_000
    ? 'ถาวร'
    : `ถึง ${new Date(until).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`;
  return `บัญชีนี้ถูกระงับ${when}${reason ? ` — เหตุผล: ${reason}` : ''}`;
}

// ------------------------------------------------------------ Google login (server/google.ts)

/** `settings` key: '0' = the owner switched Google login off on the admin page (no row = on). */
export const GOOGLE_LOGIN_SETTING = 'google_login';
/** Whether the Login page shows the Google button (switched on and the client file in place). */
export interface GoogleConfigResponse { enabled: boolean }
/** GET /api + this: where the game connection may go directly (src/client/net/route.ts); null = only through the tunnel. */
export const NET_ROUTE_PATH = '/net-route';
export interface NetRouteResponse { direct: string | null }
/** login: log in or make an account (a guest on this browser moves into a new one) · link: add Google to the logged-in account · upgrade: the guest becomes a Google account. */
export interface GoogleStartRequest { mode: 'login' | 'link' | 'upgrade'; guestToken?: string }
export interface GoogleStartResponse { url: string }
/**
 * The ticket from /#google=…; with `username` for a new account (after a needName answer).
 * `useGuest` (login mode): true = this browser's guest moves into the new account, otherwise a blank account
 * and the guest stays (owner 2026-11-27: asked first). Upgrade mode always moves the guest.
 */
export interface GoogleFinishRequest { ticket: string; username?: string; useGuest?: boolean }
/** The guest a Google round trip may take along, for the question before it does (read on the server). */
export interface GuestCharInfo { name: string; level: number }
export type GoogleFinishResponse =
  | { kind: 'session'; token: string; username: string }
  | { kind: 'needName'; email: string; guest: boolean; mode?: 'login' | 'upgrade'; guestChar?: GuestCharInfo | null }
  | { kind: 'linked'; email: string }
  | { kind: 'error'; message: string };

// ------------------------------------------------------------ account settings by the player (server/account-api.ts)

/** `settings` key of the /admin "บัญชีผู้เล่น" card: only the values that differ from ACCOUNT_TUNING_DEFAULT. */
export const ACCOUNT_TUNING_SETTING = 'account_tuning';
/** The switches and numbers of the player's account tools (docs/systems/accounts-and-admin.md, owner 2026-11-27). */
export interface AccountTuning {
  /** A Google-only account may set a password (then log in both ways, and unlink Google). */
  setPassword: boolean;
  /** A guest may pick a username and password in the game (no leaving). */
  guestUpgrade: boolean;
  /** Change the password (with the old one). */
  changePassword: boolean;
  /** Change the username (every real account). */
  rename: boolean;
  /** Forgot the password: log in with Google, then set a new one without the old. */
  recover: boolean;
  /** Days between two username changes (0 = no limit). */
  renameDays: number;
  /** Minutes after a Google login in which the password may be reset without the old one. */
  recoverMin: number;
}
export const ACCOUNT_TUNING_DEFAULT: AccountTuning = {
  setPassword: true, guestUpgrade: true, changePassword: true, rename: true, recover: true, renameDays: 30, recoverMin: 10,
};
export const ACCOUNT_RENAME_DAYS_MAX = 365;
export const ACCOUNT_RECOVER_MIN_MAX = 60;
const ACCOUNT_SWITCHES = ['setPassword', 'guestUpgrade', 'changePassword', 'rename', 'recover'] as const;

/** Whatever is stored (or sent by the admin page), as complete valid settings: bad values fall back to the default. */
export function cleanAccountTuning(raw: unknown): AccountTuning {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const t = { ...ACCOUNT_TUNING_DEFAULT };
  for (const k of ACCOUNT_SWITCHES) if (typeof o[k] === 'boolean') t[k] = o[k];
  const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  t.renameDays = int(o.renameDays, 0, ACCOUNT_RENAME_DAYS_MAX) ?? t.renameDays;
  t.recoverMin = int(o.recoverMin, 1, ACCOUNT_RECOVER_MIN_MAX) ?? t.recoverMin;
  return t;
}

/** Only what differs from the code's values (what the settings row keeps). */
export function accountTuningDiff(t: AccountTuning): Partial<AccountTuning> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(ACCOUNT_TUNING_DEFAULT) as (keyof AccountTuning)[]) if (t[k] !== ACCOUNT_TUNING_DEFAULT[k]) out[k] = t[k];
  return out as Partial<AccountTuning>;
}

/** GET /api/account: how the logged-in account can log in, and what the player may change now. */
export interface AccountInfoResponse {
  username: string;
  hasPassword: boolean;
  /** Email of the linked Google account, or null. */
  google: string | null;
  /** Google login switched on and set up (link / log in with Google are possible). */
  googleOn: boolean;
  /** This login came from Google within the recovery minutes: a new password needs no old one. */
  recoverUntil: number | null;
  /** The next time the username may be changed (null = now). */
  renameAt: number | null;
  tools: AccountTuning;
}
/** POST /api/account/password. `oldPassword` is needed unless the account has none yet or this is a fresh Google login. */
export interface AccountPasswordRequest { password: string; oldPassword?: string }
/** POST /api/account/username. */
export interface AccountRenameRequest { username: string }
/** POST /api/account/guest-upgrade (sent with the guest's token): the guest becomes this account, character and all. */
export interface GuestUpgradeRequest { username: string; password: string }

/** Every failed request answers with this body and a 4xx/5xx status. */
export interface ApiError { error: string }
