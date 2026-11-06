// Admin page (/admin): roles, limits and the shapes of the /api/admin requests, shared by the page
// and the server. The server checks the role and every value on each call; the page is only a view.
import { STAT_KEYS, STAT_LABEL, type BagEntry, type ClassId, type Item, type Rarity, type SlotId, type StatKey, type StatLine } from './types';
import type { ShutdownMode } from './net/protocol';
import { itemNames, makeItem, roundStat, rowRanges, tierOf } from './data/items';

/** owner: everything, plus granting/revoking GM. gm: view and edit players. */
export type AdminRole = 'owner' | 'gm';
export const ADMIN_ROLES: AdminRole[] = ['owner', 'gm'];
/** The 403 text when a login has no admin role (or not this one); the page treats it as "signed out of admin". */
export const ADMIN_NO_RIGHTS = 'ไม่มีสิทธิ์';

export const isAdminRole = (v: unknown): v is AdminRole => v === 'owner' || v === 'gm';

// Limits per admin action (change them here).
/** Most gold one action may give or take. */
export const ADMIN_GOLD_MAX = 1_000_000;
/** Most items one action may spawn. */
export const ADMIN_ITEMS_MAX = 10;
/** Most stat rows an item with chosen stats may have (one per stat in the game; repeats allowed). */
export const ADMIN_ITEM_ROWS_MAX = 10;
/** A chosen stat may be at most this many times the top of its normal range. */
export const ADMIN_STAT_MULT = 2;
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
  /** How long this session has been in the game (since the join; zone changes don't reset it). */
  playedMs: number;
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
export type AdminFeature = 'customItem' | 'users' | 'resetPassword' | 'ban' | 'broadcast' | 'backup' | 'sessions' | 'stats' | 'chatLog' | 'chatDelete';

/**
 * Who may use each tool. To open one to GMs, add 'gm', e.g. `ban: ['owner', 'gm']`. The server
 * checks this on every call. Deleting accounts/characters is not here: it is always owner only.
 */
export const FEATURE_ROLES: Record<AdminFeature, AdminRole[]> = {
  // Spawning an item with chosen stats (without it, spawned items roll like drops).
  customItem: ['owner'],
  users: ['owner'],
  resetPassword: ['owner'],
  ban: ['owner'],
  // GMs too (owner's choice): to everyone or to one online player.
  broadcast: ['owner', 'gm'],
  backup: ['owner'],
  sessions: ['owner'],
  stats: ['owner'],
  chatLog: ['owner'],
  chatDelete: ['owner'],
};

export const canUse = (role: AdminRole, f: AdminFeature): boolean => FEATURE_ROLES[f].includes(role);

/** Longest announcement a broadcast may send. */
export const BROADCAST_MAX = 200;
/** One announcement per sender this often at most. */
export const BROADCAST_EVERY_MS = 3000;
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

// ------------------------------------------------------------ items with chosen stats

/** One stat row the admin asks for. */
export interface AdminItemRow { stat: StatKey; value: number }

/**
 * An item of this kind, rarity and level with exactly these stat rows (admin spawn with chosen stats).
 * Checks every value, so the server can pass what the page sent; answers a Thai error instead of an item.
 * Each row's tier and min–max come from the normal range for that row (see rowRanges).
 */
export function customItem(baseId: string, rarity: Rarity, level: number, cls: ClassId, name: unknown, rows: unknown): Item | string {
  if (!Array.isArray(rows)) return 'แถวสเตตัสไม่ถูกต้อง';
  if (rows.length > ADMIN_ITEM_ROWS_MAX) return `สเตตัสได้ไม่เกิน ${ADMIN_ITEM_ROWS_MAX} แถว`;
  const asked: AdminItemRow[] = [];
  for (const r of rows as unknown[]) {
    const row = r as Partial<AdminItemRow> | null;
    if (!row || typeof row !== 'object' || !STAT_KEYS.includes(row.stat as StatKey)) return 'ชนิดสเตตัสไม่ถูกต้อง';
    if (typeof row.value !== 'number' || !Number.isFinite(row.value)) return 'ค่าสเตตัสต้องเป็นตัวเลข';
    asked.push({ stat: row.stat as StatKey, value: row.value });
  }
  const ranges = rowRanges(baseId, rarity, level, asked.map((r) => r.stat));
  const item = makeItem(baseId, rarity, level, cls);
  if (!ranges || !item) return 'ไม่มีไอเทมชนิดนี้';
  if (typeof name !== 'string' || !itemNames(baseId, rarity, cls).includes(name)) return 'ชื่อไอเทมไม่ถูกต้อง';
  const lines: StatLine[] = [];
  for (let i = 0; i < asked.length; i++) {
    const { stat, value } = asked[i];
    const r = ranges[i];
    const top = roundStat(stat, r.hi * ADMIN_STAT_MULT);
    if (value < statStep(stat) || roundStat(stat, value) !== value || value > top) return `${STAT_LABEL[stat]} ต้องอยู่ระหว่าง ${statStep(stat)}–${top}`;
    lines.push({ stat, value, tier: tierOf(value, r.lo, r.hi), min: r.min, max: r.max });
  }
  item.name = name;
  item.lines = lines;
  item.stats = {};
  for (const l of lines) item.stats[l.stat] = roundStat(l.stat, (item.stats[l.stat] ?? 0) + l.value);
  return item;
}

/** The smallest value a chosen stat row may have. */
export const statStep = (k: StatKey): number => (roundStat(k, 0.1) === 0.1 ? 0.1 : 1);
