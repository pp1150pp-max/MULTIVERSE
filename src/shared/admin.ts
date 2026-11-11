// Admin page (/admin): roles, limits and the shapes of the /api/admin requests, shared by the page
// and the server. The server checks the role and every value on each call; the page is only a view.
import { isPotion, isStack, isStone, RARITIES, RARITY_LABEL, sameStack, STAT_KEYS, STAT_LABEL, STONE_KINDS, type BagEntry, type PotionKind, type PotionStack, type StoneStack, type ClassId, type EquipSlot, type Item, type Rarity, type SlotId, type StatKey, type StatLine } from './types';
import type { ShutdownMode } from './net/protocol';
import type { OrbLook } from './orbLook';
import type { CosTuning } from './cosTuning';
import type { CardTuning } from './cardTuning';
import type { BalanceTuning } from './balance';
import { ITEM_BASES, itemNames, makeItem, roundStat, rowRanges, stampTier, statStep, tierOf } from './data/items';
import { CLASS_IDS } from './data/classes';
import { MAX_LEVEL } from './formulas';
import { MAX_PLUS } from './data/enhance';
import { entryName, POTION_SIZES, potionName, stackLimit } from './data/potions';
import { STONE_NAME } from './data/stones';

/**
 * A role id in `accounts.admin_role`. 'owner' has every tool and is made from the command line only;
 * 'gm' is built in (its tools can be changed, it can't be deleted); the owner may add more (e.g. 'tester')
 * on the Permissions tab, stored in the `admin_roles` table. Any other text there = a normal player.
 */
export type AdminRole = string;
export const OWNER_ROLE = 'owner';
export const GM_ROLE = 'gm';
/** Built-in roles: always exist, never deleted. */
export const BUILTIN_ROLES: readonly AdminRole[] = [OWNER_ROLE, GM_ROLE];
/** The 403 text when a login has no admin role (or not this one); the page treats it as "signed out of admin". */
export const ADMIN_NO_RIGHTS = 'ไม่มีสิทธิ์';

/** A new role's id: lower-case English letters, digits and _, starting with a letter (2–20 long). */
export const ROLE_ID_RE = /^[a-z][a-z0-9_]{1,19}$/;
/** Ids that can never be a custom role ('none' means "no role" on the command line). */
export const RESERVED_ROLE_IDS: readonly string[] = [OWNER_ROLE, GM_ROLE, 'none', 'null', 'admin'];
/** Longest display name of a role. */
export const ROLE_NAME_MAX = 20;
/** Most custom roles (besides owner and gm). */
export const CUSTOM_ROLES_MAX = 20;
/** The display name of a built-in role until the owner renames it ('owner' can't be renamed). */
export const BUILTIN_ROLE_NAME: Record<string, string> = { owner: 'Owner', gm: 'GM' };

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

/**
 * `features`: the tools this role may use (FEATURE_ROLES, changed by the owner on the Permissions tab).
 * `roleNames`: display name of every role (id → name), for the badges.
 */
export interface AdminMe { username: string; role: AdminRole; roleName: string; features: AdminFeature[]; roleNames: Record<AdminRole, string> }

export interface AdminMeta {
  maxLevel: number;
  maxPlus: number;
  goldMax: number;
  itemsMax: number;
  zones: { id: string; nameTh: string; levels: [number, number] }[];
  /** Item kinds the spawn form offers; `name` is what the given class sees, `names` per class. */
  bases: { id: string; slot: SlotId; names: Partial<Record<ClassId | 'any', string>>; minLevel: number }[];
  rarities: Rarity[];
  /** The game balance in use (src/shared/balance.ts), so the custom-item form's tiers match the server's. */
  balance: BalanceTuning;
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
  /** Channel of that zone (1 when it has none or in a boss room). */
  ch: number;
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
  /** One line per map, or per channel (`ch`) of a map with channels. */
  zones: { id: string; nameTh: string; ch?: number; count: number }[];
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

/** One role on the Permissions tab. */
export interface RoleDef {
  id: AdminRole;
  name: string;
  /** What the role may use now (owner: everything). */
  features: AdminFeature[];
  /** owner / gm: can't be deleted (owner can't be changed at all). */
  builtin: boolean;
  /** Accounts that hold it. */
  members: number;
}

/** GET /api/admin/role-defs: every role and the accounts holding one. */
export interface RoleDefsResponse { roles: RoleDef[]; admins: RoleRow[] }

export interface AuditRow { id: number; at: number; admin: string; action: string; target: string; details: string }

/** Every admin edit answers with a Thai line for the page and the character as it is now. */
export interface AdminEditResult { msg: string; char: AdminCharRow | null }

/** Owner's server panel: whether a restart comes back by itself, and a countdown already running. */
export interface AdminServerState { supervised: boolean; stopping: ShutdownMode | null }

/**
 * The countdown texts (Server tab): what is in use now and the defaults. Saving sends
 * `{ restart?, shutdown? }`, each a text holding SHUTDOWN_TIME_TOKEN, or null = back to the default.
 */
export interface AdminShutdownText { texts: Record<ShutdownMode, string>; defaults: Record<ShutdownMode, string> }

// ------------------------------------------------------------ owner tools (users, bans, broadcast, backups…)

/**
 * Every admin tool that can be switched on per role (Permissions tab). Owner-only for good, never a
 * switch: the Permissions tab, the audit log, restarting / stopping the server, deleting accounts or
 * characters, and making someone owner (command line).
 */
export type AdminFeature = 'online' | 'charView' | 'charEdit' | 'kick' | 'teleport' | 'staffTarget' | 'customItem' | 'users' | 'resetPassword' | 'ban' | 'broadcast' | 'backup' | 'sessions' | 'stats' | 'chatLog' | 'chatDelete' | 'shutdownText' | 'mail' | 'tradeLog' | 'orbPreview' | 'orbLook' | 'channelWarp' | 'reports' | 'reportBan' | 'cosmetics' | 'cosPreview' | 'cosLook' | 'cardView' | 'cardTune' | 'balance' | 'itemEdit';

/**
 * The defaults: which built-in role may use each tool (owner always has all). The owner can change
 * GM's and add roles on the Permissions tab; the DB keeps only what differs from this, so a tool added
 * later starts as written here. A custom role starts with nothing. The server checks on every call.
 */
export const FEATURE_ROLES: Record<AdminFeature, AdminRole[]> = {
  // The base tools (every admin had them before the Permissions tab; GMs still do by default).
  online: ['owner', 'gm'],
  charView: ['owner', 'gm'],
  charEdit: ['owner', 'gm'],
  kick: ['owner', 'gm'],
  teleport: ['owner', 'gm'],
  // Acting on other staff accounts / their characters (ban, password, edit…). Never on an owner's.
  staffTarget: ['owner'],
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
  // The countdown banner text before a restart / shutdown (Server tab).
  shutdownText: ['owner'],
  // The Mail tab: send mail (with gold / items attached) to players, see who read it, pull it back.
  mail: ['owner'],
  // The Trades tab: every completed player-to-player trade (who, items, gold, tax).
  tradeLog: ['owner'],
  // The orb test bench tab (owner 2026-11-10: owner and GMs). Only looks; changes nothing in the game.
  orbPreview: ['owner', 'gm'],
  // Saving the server-wide orb look from that tab (owner 2026-11-10: owner only).
  orbLook: ['owner'],
  // Moving an online character (yourself or anyone) into a chosen channel, however full it is (owner 2026-11-10: owner and GMs).
  channelWarp: ['owner', 'gm'],
  // The Reports tab: read bug reports / feedback and set their status (owner 2026-11-10: owner and GMs).
  reports: ['owner', 'gm'],
  // Banning an account from sending reports (owner only for now).
  reportBan: ['owner'],
  // Giving / taking back cosmetics on an account's sheet (owner only for now).
  cosmetics: ['owner'],
  // The cosmetics test bench tab "ของแต่งตัว" (owner 2026-11-10: owner and GMs). Only looks; changes nothing in the game.
  cosPreview: ['owner', 'gm'],
  // Saving the server-wide cosmetic tuning from that tab (owner 2026-11-10: owner only).
  cosLook: ['owner'],
  // The card tuning tab "การ์ด" (owner 2026-11-11: owner and GMs may look).
  cardView: ['owner', 'gm'],
  // Saving the server-wide card numbers from that tab (owner 2026-11-11: owner only).
  cardTune: ['owner'],
  // The "ปรับสมดุล" tab: class stats and item tier tables, saved server-wide (owner 2026-11-11: owner and GMs).
  balance: ['owner', 'gm'],
  // Editing or deleting any item a player wears / carries / stores, from the account sheet (owner 2026-11-11: owner and GMs).
  itemEdit: ['owner', 'gm'],
};

export const ADMIN_FEATURES = Object.keys(FEATURE_ROLES) as AdminFeature[];
export const isAdminFeature = (v: unknown): v is AdminFeature => typeof v === 'string' && Object.hasOwn(FEATURE_ROLES, v);

/** A role's changes to the defaults (feature → on/off), as stored in `admin_roles.features`. */
export type FeatureOverrides = Partial<Record<AdminFeature, boolean>>;

/** What a role may use: owner everything; otherwise its stored changes over FEATURE_ROLES (custom roles start empty). */
export function roleFeatures(role: AdminRole, overrides: FeatureOverrides = {}): AdminFeature[] {
  if (role === OWNER_ROLE) return [...ADMIN_FEATURES];
  return ADMIN_FEATURES.filter((f) => overrides[f] ?? FEATURE_ROLES[f].includes(role));
}

/** The changes to store so `role` gets exactly `features` (only what differs from the defaults). */
export function featureOverrides(role: AdminRole, features: readonly AdminFeature[]): FeatureOverrides {
  const out: FeatureOverrides = {};
  for (const f of ADMIN_FEATURES) {
    const want = features.includes(f);
    if (want !== FEATURE_ROLES[f].includes(role)) out[f] = want;
  }
  return out;
}

/** Groups of the Permissions tab, in order. */
export const FEATURE_GROUPS = ['ผู้เล่น', 'ประวัติ', 'สื่อสาร', 'ปรับเกม', 'หน้าตา', 'ระบบ'] as const;

/** Thai name, a line on what it unlocks, and its group, for the Permissions tab. */
export const FEATURE_INFO: Record<AdminFeature, { name: string; desc: string; group: (typeof FEATURE_GROUPS)[number] }> = {
  online: { name: 'ดูผู้เล่นออนไลน์', desc: 'แท็บ "ออนไลน์": ใครเล่นอยู่ แมพ/CH ping FPS GPU และ IP', group: 'ผู้เล่น' },
  charView: { name: 'ค้นหา/ดูตัวละคร', desc: 'ช่องค้นหาตัวละครในแท็บ "ผู้ใช้และตัวละคร" และเปิดดูตัวละคร (เลเวล ทอง โซน)', group: 'ผู้เล่น' },
  charEdit: { name: 'แก้ตัวละคร', desc: 'ตั้งเลเวล/EXP ให้-หักทอง เสกไอเทม ยา หิน (ต้องมี "ค้นหา/ดูตัวละคร" ด้วย)', group: 'ผู้เล่น' },
  customItem: { name: 'เสกไอเทมกำหนดสเตตัสเอง', desc: 'เลือกสเตตัสทีละแถวตอนเสกอุปกรณ์ (ไม่มี = สุ่มแบบของดรอป)', group: 'ผู้เล่น' },
  kick: { name: 'เตะออกจากเกม', desc: 'เตะตัวละครที่ออนไลน์อยู่ออกจากเกม', group: 'ผู้เล่น' },
  teleport: { name: 'ย้ายโซน', desc: 'ย้ายตัวละครไปแคมป์ของโซนที่เลือก', group: 'ผู้เล่น' },
  channelWarp: { name: 'วาร์ปเลือก CH', desc: 'ตอนย้ายโซน เลือก CH ได้ เข้าได้แม้ห้องเต็ม', group: 'ผู้เล่น' },
  cosmetics: { name: 'ให้/ถอนของแต่งตัว', desc: 'ให้หรือถอนของแต่งตัวในหน้าบัญชี', group: 'ผู้เล่น' },
  itemEdit: { name: 'แก้ไอเทมของผู้เล่น', desc: 'ในหน้าบัญชี: แก้ชนิด ความหายาก เลเวล อาชีพ ชื่อ ตีบวก pity สเตตัสทุกบรรทัด จำนวนยา/หิน หรือลบไอเทม ที่สวม/กระเป๋า/คลัง (ต้องมี "ผู้ใช้ทั้งหมด" ด้วย)', group: 'ผู้เล่น' },
  staffTarget: { name: 'จัดการบัญชีทีมงานคนอื่น', desc: 'แบน รีเซ็ตรหัส แก้ตัวละครของบัญชีที่มีสิทธิ์ผู้ดูแล (ไม่มี = ทำได้แค่ผู้เล่นธรรมดาและตัวเอง) · บัญชี owner แตะไม่ได้เสมอ', group: 'ผู้เล่น' },
  users: { name: 'ผู้ใช้ทั้งหมด', desc: 'ตารางบัญชีในแท็บ "ผู้ใช้และตัวละคร": ทุกบัญชี ตัวละคร ทอง คลัง', group: 'ผู้เล่น' },
  resetPassword: { name: 'ตั้งรหัสผ่านชั่วคราว', desc: 'ตั้งรหัสผ่านใหม่ให้บัญชีที่ลืมรหัส', group: 'ผู้เล่น' },
  ban: { name: 'แบนบัญชี', desc: 'แบน/ปลดแบนบัญชี (คนที่ออนไลน์ถูกเตะทันที)', group: 'ผู้เล่น' },
  sessions: { name: 'การเข้าเล่น', desc: 'แท็บ "การเข้าเล่น": เข้า-ออก IP GPU ping/FPS ย้อนหลัง', group: 'ประวัติ' },
  stats: { name: 'สถิติ', desc: 'แท็บ "สถิติ": กราฟคนออนไลน์ สมัครใหม่ เลเวล ping', group: 'ประวัติ' },
  chatLog: { name: 'ประวัติแชท', desc: 'แท็บ "แชท": อ่าน/ค้นหาแชทย้อนหลัง', group: 'ประวัติ' },
  chatDelete: { name: 'ลบแชท', desc: 'ลบข้อความในประวัติแชท', group: 'ประวัติ' },
  tradeLog: { name: 'ประวัติเทรด', desc: 'แท็บ "เทรด": เทรดที่สำเร็จระหว่างผู้เล่น', group: 'ประวัติ' },
  reports: { name: 'รายงานจากผู้เล่น', desc: 'แท็บ "รายงาน": อ่านและเปลี่ยนสถานะ + แจ้งเตือนในเกมเมื่อมีคนรายงานผู้เล่น', group: 'สื่อสาร' },
  reportBan: { name: 'ห้ามส่งรายงาน', desc: 'ห้าม/ปลดห้ามบัญชีส่งรายงาน', group: 'สื่อสาร' },
  broadcast: { name: 'ประกาศ', desc: 'ประกาศถึงทุกคน (แท็บ "ประกาศ") และถึงผู้เล่นคนเดียว (ปุ่ม 📢 ในแท็บ "ออนไลน์")', group: 'สื่อสาร' },
  mail: { name: 'จดหมาย', desc: 'แท็บ "จดหมาย": ส่งจดหมายพร้อมทอง/ไอเทมถึงผู้เล่น ดึงกลับ', group: 'สื่อสาร' },
  backup: { name: 'สำรองข้อมูล', desc: 'ดูรายการและกดสำรองฐานข้อมูล (แท็บ Server)', group: 'ระบบ' },
  shutdownText: { name: 'ข้อความนับถอยหลัง', desc: 'แก้ข้อความเตือนก่อนรีสตาร์ท/ปิด server (แท็บ Server) · ปุ่มรีสตาร์ท/ปิดเป็นของ owner', group: 'ระบบ' },
  orbPreview: { name: 'ทดลองลูกแก้วตีบวก', desc: 'แท็บ "ลูกแก้วตีบวก": ลองหน้าตา ไม่เปลี่ยนอะไรในเกม', group: 'หน้าตา' },
  orbLook: { name: 'บันทึกลูกแก้วทั้งเซิร์ฟ', desc: 'บันทึกหน้าตาลูกแก้วตีบวกที่ทุกคนเห็น', group: 'หน้าตา' },
  cosPreview: { name: 'ทดลองของแต่งตัว', desc: 'แท็บ "ของแต่งตัว": ลองตำแหน่ง/หน้าตาปีก สัตว์ขี่ สัตว์เลี้ยง ออร่า ไม่เปลี่ยนอะไรในเกม', group: 'หน้าตา' },
  balance: { name: 'ปรับสมดุล (อาชีพ, tier)', desc: 'แท็บ "ปรับสมดุล": แก้ค่าสเตตัสอาชีพ ตัวคูณ ตัวตัดฟื้น และตาราง tier T1–T5 ของทั้งเซิร์ฟ มีผลทันที', group: 'ปรับเกม' },
  cosLook: { name: 'บันทึกของแต่งตัวทั้งเซิร์ฟ', desc: 'บันทึกค่าตำแหน่ง/หน้าตาของแต่งตัวที่ทุกคนเห็น (ต้องมี "ทดลองของแต่งตัว" ด้วย)', group: 'หน้าตา' },
  cardView: { name: 'ดูค่าการ์ด', desc: 'แท็บ "การ์ด": ดูผลของการ์ดทุกใบ เรทดรอป ราคา และเพดาน', group: 'ปรับเกม' },
  cardTune: { name: 'แก้ค่าการ์ดทั้งเซิร์ฟ', desc: 'แก้และบันทึกค่าการ์ดที่ใช้ทั้งเซิร์ฟ (ต้องมี "ดูค่าการ์ด" ด้วย)', group: 'ปรับเกม' },
};

/** Shown on the Permissions tab: what no role but owner can ever do. */
export const OWNER_ONLY_TOOLS = ['หน้าจัดการสิทธิ์', 'ประวัติการกระทำของผู้ดูแล', 'รีสตาร์ท/ปิด server', 'ลบบัญชี/ตัวละคร', 'ตั้ง owner (command line เท่านั้น)'];

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
  equipment: Partial<Record<EquipSlot, Item>>;
  bag: (BagEntry | null)[];
}

export interface AdminAccountDetail {
  account: AdminAccountRow;
  characters: AdminCharDetail[];
  stash: { size: number; gold: number; items: (BagEntry | null)[] } | null;
  /** Cosmetic ids the account owns (src/shared/data/cosmetics.ts); null for a guest. */
  cosmetics: string[] | null;
}

export interface BackupRow { name: string; size: number; at: number; kind: string }

// ------------------------------------------------------------ history (play sessions, chat, graphs)

/** Days each kind of history is kept (older rows are deleted every hour). */
export const HISTORY_DAYS = { sessions: 90, chat: 30, samples: 90 };
/** Rows per page of the chat list. */
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

/**
 * The play-session table: sorted on the server over every stored row, one numbered page at a time.
 * `duration` counts a session still playing up to now; rows with no value (unknown length, no ping yet…)
 * always go last, whichever way the table is sorted.
 */
export const SESSION_SORTS = ['joined', 'username', 'char', 'duration', 'ip', 'gpu', 'ping', 'fps'] as const;
export type SessionSort = (typeof SESSION_SORTS)[number];
export const SESSION_PAGE_SIZES = [25, 50, 100] as const;
/** Longest search text (username, character name or IP). */
export const SESSION_SEARCH_MAX = 50;
export interface SessionQuery {
  sort: SessionSort;
  desc: boolean;
  /** 1-based. */
  page: number;
  size: number;
  /** Matches the username, character name or IP (part of it, any case). */
  q: string;
  /** Joined at or after `from` and before `to` (ms); either may be absent. */
  from?: number;
  to?: number;
  accountId?: number;
}
export interface SessionPage {
  rows: PlaySessionRow[];
  total: number;
  /** The page actually returned (past the end → the last page). */
  page: number;
  size: number;
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
 * Each row's tier is where its value falls in the normal range for that row (see rowRanges); above it is T1.
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
    const t = tierOf(stat, level, value, r.lo, r.hi);
    lines.push({ stat, value, tier: t.tier, min: t.min, max: t.max });
  }
  item.name = name;
  item.lines = lines;
  stampTier(item);
  item.stats = {};
  for (const l of lines) item.stats[l.stat] = roundStat(l.stat, (item.stats[l.stat] ?? 0) + l.value);
  return item;
}

/** What the editor shows for row `i` of these stats at this value: its normal range, cap and tier. */
export function adminRowInfo(baseId: string, rarity: Rarity, level: number, stats: StatKey[], i: number, value: number):
  { min: number; max: number; lo: number; hi: number; main: boolean; step: number; top: number; tier: number; tmin: number; tmax: number } | null {
  const r = rowRanges(baseId, rarity, level, stats)?.[i];
  if (!r) return null;
  const stat = stats[i];
  const t = tierOf(stat, level, value, r.lo, r.hi);
  return { min: r.min, max: r.max, lo: r.lo, hi: r.hi, main: r.main, step: statStep(stat), top: roundStat(stat, r.hi * ADMIN_STAT_MULT), tier: t.tier, tmin: t.min, tmax: t.max };
}

// ------------------------------------------------------------ editing an item a player has (itemEdit)

/** Where an item sits on the account sheet: a worn place, a bag slot or a stash slot. */
export type AdminItemPlace = 'equip' | 'bag' | 'stash';
/** Most failed-enhance pity an edit may set (each one is +1% on the next chance). */
export const ADMIN_PITY_MAX = 100;

/**
 * What the page saw in a slot, so the server can tell the slot still holds it (the player may have
 * moved things since the sheet was drawn): gear by its uid, a stack by its kind.
 */
export function entrySig(e: BagEntry): string {
  if (isPotion(e)) return `potion:${e.potion}:${e.size}`;
  if (isStone(e)) return `stone:${e.stone}`;
  return `item:${e.uid}`;
}

/**
 * The item `old` becomes after an edit: kind, rarity, level, class, name, +N, pity and every stat row
 * as the page sent them. Checks every value (like customItem, stats up to ADMIN_STAT_MULT × the normal
 * top, tiers worked out from the values). Keeps the uid. A Thai error instead of an item.
 */
export function editGear(old: Item, body: Record<string, unknown>): Item | string {
  const base = ITEM_BASES.find((b) => b.id === body.baseId);
  if (!base) return 'ไม่มีไอเทมชนิดนี้';
  const rarity = RARITIES.find((r) => r === body.rarity);
  if (!rarity) return 'ระดับความหายากไม่ถูกต้อง';
  const cls = CLASS_IDS.find((k) => k === body.classId);
  if (!cls) return 'อาชีพไม่ถูกต้อง';
  const whole = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  if (!whole(body.level, base.minLevel, MAX_LEVEL)) return `เลเวลไอเทมต้องเป็น ${base.minLevel}–${MAX_LEVEL} (ขั้นต่ำของชนิดนี้ Lv.${base.minLevel})`;
  if (!whole(body.plus, 0, MAX_PLUS)) return `ระดับตีบวกต้องเป็น 0–${MAX_PLUS}`;
  if (!whole(body.pity, 0, ADMIN_PITY_MAX)) return `pity ต้องเป็น 0–${ADMIN_PITY_MAX}`;
  const item = customItem(base.id, rarity, body.level, cls, body.name, body.lines);
  if (typeof item === 'string') return item;
  item.uid = old.uid;
  if (body.plus) item.plus = body.plus;
  if (body.pity) item.pity = body.pity;
  return item;
}

/** One line for the audit log: everything that makes up the entry. */
export function describeEntry(e: BagEntry): string {
  if (isStack(e)) return entryName(e);
  const lines = (e.lines ?? []).map((l) => `${STAT_LABEL[l.stat]} ${l.value} T${l.tier}`).join(', ') || 'ไม่มีสเตตัส';
  return `${e.plus ? `+${e.plus} ` : ''}${e.name} [${RARITY_LABEL[e.rarity]}] Lv.${e.level}${e.cls ? ` (${e.cls})` : ''}${e.pity ? ` pity ${e.pity}` : ''} · ${lines}`;
}

/** The smallest value a chosen stat row may have. */
export { statStep };

// ------------------------------------------------------------ potions and stones

/** What the spawn form may give besides gear: one kind of potion or stone, stacked like a pickup. */
export type AdminStack = PotionStack | StoneStack;

/**
 * The potion or stone the page asked for (`kind` 'potion' with `potion` + `size`, or 'stone' with
 * `stone`), with count 0; a Thai error if any value is wrong.
 */
export function adminStack(body: Record<string, unknown>): AdminStack | string {
  if (body.kind === 'potion') {
    const potion = (['hp', 'mp'] as PotionKind[]).find((k) => k === body.potion);
    if (!potion) return 'ชนิดยาไม่ถูกต้อง';
    const size = POTION_SIZES.find((s) => s === body.size);
    if (!size) return 'ขนาดยาไม่ถูกต้อง';
    return { potion, size, count: 0 };
  }
  if (body.kind === 'stone') {
    const stone = STONE_KINDS.find((k) => k === body.stone);
    if (!stone) return 'ชนิดหินไม่ถูกต้อง';
    return { stone, count: 0 };
  }
  return 'ประเภทไอเทมไม่ถูกต้อง';
}

/** Display name of a potion or stone kind ("ยา HP ใหญ่", "หินตีบวก"). */
export const adminStackName = (s: AdminStack): string => (isPotion(s) ? potionName(s.potion, s.size) : STONE_NAME[s.stone]);

/**
 * Puts up to `n` of this potion/stone into the first `slots` bag slots like a pickup: tops up stacks of the
 * same kind first, then fills empty slots (each slot holds at most a stack's limit). Returns how many went in.
 */
export function addStackToBag(bag: (BagEntry | null)[], slots: number, kind: AdminStack, n: number): number {
  const limit = stackLimit(kind);
  let left = n;
  for (let i = 0; i < slots && left > 0; i++) {
    const e = bag[i];
    if (e && sameStack(e, kind) && isStack(e) && e.count < limit) {
      const add = Math.min(left, limit - e.count);
      e.count += add;
      left -= add;
    }
  }
  for (let i = 0; i < slots && left > 0; i++) {
    if (bag[i]) continue;
    const add = Math.min(left, limit);
    bag[i] = { ...kind, count: add };
    left -= add;
  }
  return n - left;
}

/** GET/POST /api/admin/card-tune: the server-wide card tuning (only what differs from the code defaults). */
export interface AdminCardTune {
  tuning: CardTuning;
  /** May this admin save it (the `cardTune` switch). */
  canEdit: boolean;
}

/** GET/POST /api/admin/balance: the server-wide game balance (only what differs from the code). */
export interface AdminBalance {
  tuning: BalanceTuning;
}

/** GET/POST /api/admin/cos-look: the server-wide cosmetic tuning (only what differs from the code defaults). */
export interface AdminCosLook {
  tuning: CosTuning;
  /** May this admin save it (the `cosLook` switch). */
  canEdit: boolean;
}

/** GET/POST /api/admin/orb-look: the server-wide enhancement orb look and what may be chosen. */
export interface AdminOrbLook {
  look: OrbLook;
  defaults: OrbLook;
  /** May this admin save it (the `orbLook` switch). */
  canEdit: boolean;
  palettes: string[];
  shapes: string[];
  ranges: Record<string, [number, number]>;
}
