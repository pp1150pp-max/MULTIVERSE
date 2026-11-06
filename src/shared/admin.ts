// Admin page (/admin): roles, limits and the shapes of the /api/admin requests, shared by the page
// and the server. The server checks the role and every value on each call; the page is only a view.
import type { BagEntry, ClassId, Item, Rarity, SlotId } from './types';
import type { ShutdownMode } from './net/protocol';

/** owner: everything, plus granting/revoking GM. gm: view and edit players. */
export type AdminRole = 'owner' | 'gm';
export const ADMIN_ROLES: AdminRole[] = ['owner', 'gm'];
export const isAdminRole = (v: unknown): v is AdminRole => v === 'owner' || v === 'gm';

// Limits per admin action (change them here).
/** Most gold one action may give or take. */
export const ADMIN_GOLD_MAX = 1_000_000;
/** Most items one action may spawn. */
export const ADMIN_ITEMS_MAX = 10;
/** Rows the character search returns. */
export const ADMIN_SEARCH_MAX = 30;
/** Rows one page of the audit log returns. */
export const ADMIN_AUDIT_PAGE = 100;

/** `features`: the owner tools this role may use (see FEATURE_ROLES). */
export interface AdminMe { username: string; role: AdminRole; features: AdminFeature[] }

export interface AdminMeta {
  maxLevel: number;
  maxPlus: number;
  goldMax: number;
  itemsMax: number;
  zones: { id: string; nameTh: string; levels: [number, number] }[];
  /** Item kinds the spawn form offers; `name` is what the given class sees, `names` per class. */
  bases: { id: string; slot: SlotId; names: Partial<Record<ClassId | 'any', string>>; minLevel: number }[];
  rarities: Rarity[];
}

/** One online player in the admin table. Ping numbers are from the latest report (null = none yet). */
export interface AdminOnlineRow {
  charId: number;
  accountId: number;
  username: string;
  guest: boolean;
  name: string;
  classId: ClassId;
  level: number;
  zone: string;
  rtt: number | null;
  fps: number | null;
  /** Longest frame since the last per-minute log line, ms. */
  maxFrame: number | null;
  hidden: boolean;
  gpu: string | null;
  ip: string;
}

export interface AdminOnline {
  zones: { id: string; nameTh: string; count: number }[];
  players: AdminOnlineRow[];
}

/** A character found by name, online or not. */
export interface AdminCharRow {
  charId: number;
  accountId: number;
  username: string;
  guest: boolean;
  name: string;
  classId: ClassId;
  level: number;
  exp: number;
  expToNext: number;
  gold: number;
  zone: string;
  bagFree: number;
  online: boolean;
}

export interface RoleRow { accountId: number; username: string; role: AdminRole }

export interface AuditRow { id: number; at: number; admin: string; action: string; target: string; details: string }

/** Every admin edit answers with a Thai line for the page and the character as it is now. */
export interface AdminEditResult { msg: string; char: AdminCharRow | null }

/** Owner's server panel: whether a restart comes back by itself, and a countdown already running. */
export interface AdminServerState { supervised: boolean; stopping: ShutdownMode | null }

// ------------------------------------------------------------ owner tools (users, bans, broadcast, backups…)

/** The newer admin tools. Each is its own switch so some can be opened to GMs later. */
export type AdminFeature = 'users' | 'resetPassword' | 'ban' | 'broadcast' | 'backup' | 'sessions' | 'stats' | 'chatLog' | 'chatDelete';

/**
 * Who may use each tool. To open one to GMs, add 'gm', e.g. `ban: ['owner', 'gm']`. The server
 * checks this on every call. Deleting accounts/characters is not here: it is always owner only.
 */
export const FEATURE_ROLES: Record<AdminFeature, AdminRole[]> = {
  users: ['owner'],
  resetPassword: ['owner'],
  ban: ['owner'],
  broadcast: ['owner'],
  backup: ['owner'],
  sessions: ['owner'],
  stats: ['owner'],
  chatLog: ['owner'],
  chatDelete: ['owner'],
};

export const canUse = (role: AdminRole, f: AdminFeature): boolean => FEATURE_ROLES[f].includes(role);

/** Longest announcement a broadcast may send. */
export const BROADCAST_MAX = 200;
/** Longest ban reason. */
export const BAN_REASON_MAX = 200;
/** Ban lengths the page offers; null = permanent. */
export const BAN_DURATIONS: { id: string; label: string; ms: number | null }[] = [
  { id: '1h', label: '1 ชั่วโมง', ms: 60 * 60 * 1000 },
  { id: '1d', label: '1 วัน', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 วัน', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'perm', label: 'ถาวร', ms: null },
];
/** Stored as the end time of a permanent ban. */
export const BAN_FOREVER = 8_640_000_000_000_000;

/** One row of the "ผู้ใช้ทั้งหมด" table. */
export interface AdminAccountRow {
  accountId: number;
  username: string;
  guest: boolean;
  role: AdminRole | null;
  createdAt: number;
  /** Guests only (real accounts don't record it yet); null = unknown. */
  lastOnline: number | null;
  online: boolean;
  characters: number;
  names: string[];
  maxLevel: number;
  /** All characters' gold plus the stash's. */
  totalGold: number;
  stashSize: number | null;
  /** Ban end time (BAN_FOREVER = permanent) while banned, else null. */
  bannedUntil: number | null;
  banReason: string | null;
}

export interface AdminAccountsResponse {
  summary: { accounts: number; guests: number; characters: number; signupsToday: number };
  rows: AdminAccountRow[];
}

/** A character with everything it carries, for the account details. */
export interface AdminCharDetail extends AdminCharRow {
  equipment: Partial<Record<SlotId, Item>>;
  bag: (BagEntry | null)[];
}

export interface AdminAccountDetail {
  account: AdminAccountRow;
  characters: AdminCharDetail[];
  stash: { size: number; gold: number; items: (BagEntry | null)[] } | null;
}

export interface BackupRow { name: string; size: number; at: number; kind: string }

// ------------------------------------------------------------ history (play sessions, chat, graphs)

/** Days each kind of history is kept (older rows are deleted every hour). */
export const HISTORY_DAYS = { sessions: 90, chat: 30, samples: 90 };
/** Rows per page of the session and chat lists. */
export const HISTORY_PAGE = 100;

export interface PlaySessionRow {
  id: number;
  accountId: number;
  username: string;
  guest: boolean;
  charId: number;
  charName: string;
  joinedAt: number;
  /** null while playing, or when the server stopped without saying goodbye. */
  leftAt: number | null;
  ip: string;
  gpu: string | null;
  avgRtt: number | null;
  avgFps: number | null;
  /** Still in the world right now. */
  online: boolean;
}

export interface ChatLogRow { id: number; at: number; accountId: number; username: string; charName: string; zone: string; text: string }

export type StatsRange = '24h' | '7d' | '30d';
export interface StatsPoint { at: number; v: number }
export interface AdminStats {
  range: StatsRange;
  /** Most players online in each time bucket. */
  online: StatsPoint[];
  /** Real-account sign-ups per day (last 30 days, local days). */
  signups: StatsPoint[];
  /** Daily average level and ping of the players online (from the minute samples). */
  avgLevel: StatsPoint[];
  avgPing: StatsPoint[];
  /** Right now: players online, average level of every character. */
  now: { online: number; avgLevelAll: number | null };
  /** When the minute samples start (null = none yet). */
  since: number | null;
}
