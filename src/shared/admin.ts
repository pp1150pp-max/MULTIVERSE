// Admin page (/admin): roles, limits and the shapes of the /api/admin requests, shared by the page
// and the server. The server checks the role and every value on each call; the page is only a view.
import type { ClassId, Rarity, SlotId } from './types';

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

export interface AdminMe { username: string; role: AdminRole }

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
