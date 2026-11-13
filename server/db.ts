// SQLite storage for accounts, login sessions and online characters. One file on disk:
// back it up by copying server/data/multiverse.db while the server is stopped.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { upgradeCharacter, type CharacterData } from '../src/shared/sim/Player';
import { GUEST_TTL_HOURS, type CharacterSummary } from '../src/shared/api';
import type { ClassId } from '../src/shared/types';
import { checkShutdownText, DEFAULT_SHUTDOWN_TEXT, type ShutdownMode } from '../src/shared/net/protocol';
import { cleanStash, type StashData } from '../src/shared/sim/stash';
import { cleanCosOwned } from '../src/shared/data/cosmetics';
import { checkCosTuning, COS_TUNING_SETTING, type CosTuning } from '../src/shared/cosTuning';
import { checkCosShop, COS_SHOP_SETTING, type CosShop } from '../src/shared/cosShop';
import { checkOrbItems, ORB_ITEMS_SETTING, registerOrbItems, type OrbItems } from '../src/shared/orbItems';
import { CARD_TUNING_SETTING, checkCardTuning, type CardTuning } from '../src/shared/cardTuning';
import { BALANCE_SETTING, checkBalance, type BalanceTuning } from '../src/shared/balance';
import { checkOrbLook, DEFAULT_ORB_LOOK, ORB_LOOK_SETTING, sameOrbLook, type OrbLook } from '../src/shared/orbLook';
import { MARKET_HISTORY_DAYS, type MarketQuery } from '../src/shared/sim/market';
import { MAIL_HISTORY_DAYS } from '../src/shared/mail';
import type { TradeLogRow } from '../src/shared/trade';
import type { AdminReportRow } from '../src/shared/reports';
import type { FriendChar } from '../src/shared/friends';
import { ADMIN_FEATURES, BUILTIN_ROLE_NAME, BUILTIN_ROLES, isAdminFeature, OWNER_ROLE, roleFeatures, type AdminFeature, type AdminRole, type AuditRow, type FeatureOverrides, type RoleDef, type ChatLogRow, type PlaySessionRow, type RoleRow, type SessionQuery, type SessionSort } from '../src/shared/admin';

/** A play session's username as the admin page shows it. */
const GUEST_AS_GUEST = "(CASE WHEN guest = 1 THEN 'Guest' ELSE username END)";

/**
 * The SQL each play-session sort key orders by. Only these fixed strings (plus server-made integers) ever
 * reach the query; nothing typed by the client does. A session still playing counts up to `now`.
 */
function sessionSortSql(sort: SessionSort, openIds: number[], now: number): string {
  const open = openIds.filter(Number.isSafeInteger).join(',');
  switch (sort) {
    case 'joined': return 'joined_at';
    case 'username': return `${GUEST_AS_GUEST} COLLATE NOCASE`;
    case 'char': return 'char_name COLLATE NOCASE';
    case 'duration':
      return `CASE WHEN left_at IS NOT NULL THEN left_at - joined_at${open ? ` WHEN id IN (${open}) THEN ${Math.floor(now)} - joined_at` : ''} END`;
    case 'ip': return 'ip';
    case 'gpu': return 'gpu COLLATE NOCASE';
    case 'ping': return 'avg_rtt';
    case 'fps': return 'avg_fps';
  }
}

/** Settings rows holding the countdown texts. */
export const SHUTDOWN_TEXT_KEY: Record<ShutdownMode, string> = { restart: 'shutdown_text_restart', shutdown: 'shutdown_text_shutdown' };

/** One side of a finished trade, as the log stores it. */
export interface TradeLogSide { charId: number; accountId: number; name: string; items: string[]; gold: number; tax: number }

export interface AccountRow { id: number; username: string; pass_hash: string }

const MAIL_SELECT = `SELECT b.id, b.send_id, b.read_at, b.claimed_at, s.sender_name, s.title, s.body, s.attach, s.has_attach, s.created_at, s.expires_at
  FROM mail_box b JOIN mail_sends s ON s.id = b.send_id`;

/** One mail as a character sees it (a box row joined to its send). */
export interface MailDbRow {
  id: number; send_id: number; read_at: number | null; claimed_at: number | null; sender_name: string; title: string; body: string;
  attach: string; has_attach: number; created_at: number; expires_at: number;
}

/** A mail_sends row with its copy counts. */
export interface MailSendDbRow {
  id: number; created_at: number; sender_name: string; target: string; title: string; body: string; attach: string;
  recipients: number; read: number; claimed: number; recalled: number;
}

/** A market_listings row as stored. */
export interface MarketDbRow {
  id: number; seller_account: number; seller_char: number; seller_name: string; entry: string; uid: string | null;
  name: string; kind: string; rarity: string | null; level: number; plus: number; cls: string | null; count: number;
  price: number; fee: number; created_at: number; expires_at: number; status: 'active' | 'sold' | 'expired' | 'cancelled';
  buyer_account: number | null; buyer_name: string | null; sold_at: number | null; tax: number | null;
  claimed_at: number | null; notified_at: number | null;
}

/** A new listing for Db.marketInsert. */
export interface MarketInsert {
  sellerAccount: number; sellerChar: number; sellerName: string;
  /** The bag entry as JSON. */
  entry: string; uid: string | null; name: string; kind: string; rarity: string | null; level: number; plus: number;
  cls: string | null; count: number; price: number; fee: number; createdAt: number; expiresAt: number;
  stats: Partial<Record<string, number>>;
}
/** The account behind a login token. Guests are temporary accounts that can't log in with a password. */
export interface SessionAccount { id: number; username: string; guest: boolean }

/** Guests nobody has played for this long are deleted, character and all. */
export const GUEST_TTL_MS = GUEST_TTL_HOURS * 60 * 60 * 1000;
/** A character found by the admin search, with its account. */
export interface AdminCharacterRow { id: number; accountId: number; username: string; guest: boolean; name: string; data: CharacterData }
interface CharacterRow { id: number; account_id: number; name: string; class_id: string; data: string }

export class Db {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        pass_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        class_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS characters_by_account ON characters(account_id);
      CREATE TABLE IF NOT EXISTS stashes (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      -- One row per play session (join → leave), for the admin page. Kept PLAY_SESSION_DAYS.
      CREATE TABLE IF NOT EXISTS play_sessions (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        guest INTEGER NOT NULL DEFAULT 0,
        char_id INTEGER NOT NULL,
        char_name TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        left_at INTEGER,
        ip TEXT NOT NULL,
        gpu TEXT,
        avg_rtt REAL,
        avg_fps REAL
      );
      CREATE INDEX IF NOT EXISTS play_sessions_by_account ON play_sessions(account_id, joined_at);
      CREATE INDEX IF NOT EXISTS play_sessions_by_time ON play_sessions(joined_at);
      -- Chat messages, searchable on the admin page. Kept CHAT_LOG_DAYS.
      CREATE TABLE IF NOT EXISTS chat_log (
        id INTEGER PRIMARY KEY,
        at INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        char_name TEXT NOT NULL,
        zone TEXT NOT NULL,
        text TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS chat_log_by_time ON chat_log(at);
      -- Who was online, once a minute, for the admin page's graphs. Kept SAMPLE_DAYS.
      CREATE TABLE IF NOT EXISTS online_samples (
        at INTEGER PRIMARY KEY,
        total INTEGER NOT NULL,
        zones TEXT NOT NULL,
        avg_level REAL,
        avg_rtt REAL
      );
      -- Server-wide settings the owner changes on the admin page (key → value). No row = the default.
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      -- Consignment market (market broker), see server/market.ts: one row per listing, kept as history
      -- after it is collected. status: 'active' | 'sold' | 'expired' | 'cancelled'. A finished listing
      -- whose claimed_at is NULL waits in the seller's claim box (the gold if sold, else the item).
      CREATE TABLE IF NOT EXISTS market_listings (
        id INTEGER PRIMARY KEY,
        seller_account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        seller_char INTEGER NOT NULL,
        seller_name TEXT NOT NULL,
        entry TEXT NOT NULL,
        uid TEXT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        rarity TEXT,
        level INTEGER NOT NULL DEFAULT 0,
        plus INTEGER NOT NULL DEFAULT 0,
        cls TEXT,
        count INTEGER NOT NULL DEFAULT 1,
        price INTEGER NOT NULL,
        fee INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        buyer_account INTEGER,
        buyer_name TEXT,
        sold_at INTEGER,
        tax INTEGER,
        claimed_at INTEGER,
        notified_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS market_active ON market_listings(status, kind, price);
      CREATE INDEX IF NOT EXISTS market_expiry ON market_listings(status, expires_at);
      CREATE INDEX IF NOT EXISTS market_seller ON market_listings(seller_account, status);
      -- The same item can't be up twice.
      CREATE UNIQUE INDEX IF NOT EXISTS market_uid_active ON market_listings(uid) WHERE status = 'active';
      -- Each listed item's stat totals (enhancement included), for searching by stat.
      CREATE TABLE IF NOT EXISTS market_listing_stats (
        listing_id INTEGER NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
        stat TEXT NOT NULL,
        value REAL NOT NULL,
        PRIMARY KEY (listing_id, stat)
      );
      CREATE INDEX IF NOT EXISTS market_stat_value ON market_listing_stats(stat, value);
      -- Mailbox (see server/mail.ts): one row per send, and one box row per recipient copy.
      -- char_id NULL = the copy belongs to the account (any of its characters may read it; claimed once).
      CREATE TABLE IF NOT EXISTS mail_sends (
        id INTEGER PRIMARY KEY,
        sender_id INTEGER,
        sender_name TEXT NOT NULL,
        target TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        attach TEXT NOT NULL,
        has_attach INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mail_box (
        id INTEGER PRIMARY KEY,
        send_id INTEGER NOT NULL REFERENCES mail_sends(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        char_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
        read_at INTEGER,
        claimed_at INTEGER,
        claimed_char INTEGER,
        deleted_at INTEGER,
        recalled_at INTEGER,
        notified_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS mail_box_account ON mail_box(account_id, deleted_at);
      CREATE INDEX IF NOT EXISTS mail_box_send ON mail_box(send_id);
      -- Daily login (see server/daily.ts): one row per account and Thai calendar day it got (makeup 1 = a make-up),
      -- and the mail send each delivery day / reward reuses, so the admin mail history gets a few rows a day, not one per account.
      CREATE TABLE IF NOT EXISTS daily_claims (
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        makeup INTEGER NOT NULL,
        at INTEGER NOT NULL,
        PRIMARY KEY (account_id, day)
      );
      CREATE TABLE IF NOT EXISTS daily_mail (
        key TEXT PRIMARY KEY,
        send_id INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trade_log (
        id INTEGER PRIMARY KEY,
        at INTEGER NOT NULL,
        zone TEXT NOT NULL,
        a_char INTEGER NOT NULL,
        a_account INTEGER NOT NULL,
        a_name TEXT NOT NULL,
        b_char INTEGER NOT NULL,
        b_account INTEGER NOT NULL,
        b_name TEXT NOT NULL,
        a_items TEXT NOT NULL,
        b_items TEXT NOT NULL,
        a_gold INTEGER NOT NULL,
        b_gold INTEGER NOT NULL,
        a_tax INTEGER NOT NULL,
        b_tax INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS trade_log_at ON trade_log(at);
      CREATE TABLE IF NOT EXISTS admin_audit (
        id INTEGER PRIMARY KEY,
        at INTEGER NOT NULL,
        admin_id INTEGER,
        admin_name TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        details TEXT NOT NULL
      );
      -- Friends (server/friends.ts) belong to accounts. One row per pair, the smaller id first.
      CREATE TABLE IF NOT EXISTS friends (
        acc_lo INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        acc_hi INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        since INTEGER NOT NULL,
        PRIMARY KEY (acc_lo, acc_hi),
        CHECK (acc_lo < acc_hi)
      );
      CREATE INDEX IF NOT EXISTS friends_hi ON friends(acc_hi);
      CREATE TABLE IF NOT EXISTS friend_requests (
        from_acc INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        to_acc INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        at INTEGER NOT NULL,
        PRIMARY KEY (from_acc, to_acc)
      );
      CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests(to_acc);
      CREATE TABLE IF NOT EXISTS blocks (
        blocker INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        blocked INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        at INTEGER NOT NULL,
        PRIMARY KEY (blocker, blocked)
      );
      CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks(blocked);
      -- Bug reports / feedback (server/reports.ts). Only accepted reports are stored, so the anti-spam counts read this table.
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY,
        at INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        char_name TEXT NOT NULL,
        topic TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        zone TEXT NOT NULL,
        channel INTEGER,
        x REAL NOT NULL,
        z REAL NOT NULL,
        level INTEGER NOT NULL,
        rtt INTEGER,
        fps INTEGER,
        ip TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS reports_account ON reports(account_id, at);
      CREATE INDEX IF NOT EXISTS reports_ip ON reports(ip, at);
      CREATE INDEX IF NOT EXISTS reports_at ON reports(at);
      CREATE TABLE IF NOT EXISTS report_bans (
        account_id INTEGER PRIMARY KEY,
        at INTEGER NOT NULL,
        by_name TEXT NOT NULL
      );
      -- Cosmetics an account owns (src/shared/data/cosmetics.ts), given by an admin. What each character
      -- wears is in its CharacterData.cosmetics.
      CREATE TABLE IF NOT EXISTS account_cosmetics (
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        cosmetic_id TEXT NOT NULL,
        granted_at INTEGER NOT NULL,
        granted_by TEXT NOT NULL,
        PRIMARY KEY (account_id, cosmetic_id)
      );
    `);
    // Columns added after the first release: add them to databases made before that.
    const cols = (this.db.prepare('PRAGMA table_info(accounts)').all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes('is_guest')) this.db.exec('ALTER TABLE accounts ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0');
    if (!cols.includes('last_online')) this.db.exec('ALTER TABLE accounts ADD COLUMN last_online INTEGER');
    // NULL = a normal player; 'owner' / 'gm' / a role in admin_roles may use the admin page (see server/admin.ts).
    if (!cols.includes('admin_role')) this.db.exec('ALTER TABLE accounts ADD COLUMN admin_role TEXT');
    // Ban end time (BAN_FOREVER = permanent) and why; NULL = not banned.
    if (!cols.includes('ban_until')) this.db.exec('ALTER TABLE accounts ADD COLUMN ban_until INTEGER');
    if (!cols.includes('ban_reason')) this.db.exec('ALTER TABLE accounts ADD COLUMN ban_reason TEXT');
    // Admin roles the owner changed or added on the Permissions tab. 'gm' gets a row only once changed;
    // 'owner' never has one. `features` = JSON of only what differs from FEATURE_ROLES (feature → on/off).
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        features TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
    `);
    // The orb looks made in /admin are cosmetics too: put them in the list before anything reads owned or
    // worn cosmetics, hidden pieces or prices (those drop ids they don't know).
    registerOrbItems(this.orbItems().items);
  }

  close(): void {
    this.db.close();
  }

  // ------------------------------------------------------------ settings

  getSetting(key: string): string | null {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return r ? r.value : null;
  }

  /** null deletes the row (back to the default). */
  setSetting(key: string, value: string | null): void {
    if (value === null) this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    else this.db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(key, value, Date.now());
  }

  /** The countdown texts players see before a restart / shutdown (owner's wording, else the default). */
  /** The server-wide enhancement orb look (DEFAULT_ORB_LOOK until the owner saves one). */
  orbLook(): OrbLook {
    const v = this.getSetting(ORB_LOOK_SETTING);
    if (v === null) return { ...DEFAULT_ORB_LOOK };
    try {
      // Checked again so a hand-edited row can never send a broken look.
      return checkOrbLook(JSON.parse(v)).look ?? { ...DEFAULT_ORB_LOOK };
    } catch {
      return { ...DEFAULT_ORB_LOOK };
    }
  }

  /** Saves the server-wide orb look (the default itself is stored as no row). */
  setOrbLook(look: OrbLook): void {
    this.setSetting(ORB_LOOK_SETTING, sameOrbLook(look, DEFAULT_ORB_LOOK) ? null : JSON.stringify(look));
  }

  /** The server-wide cosmetic tuning: only the changes from the code defaults ({} until the owner saves some). */
  cosTuning(): CosTuning {
    const v = this.getSetting(COS_TUNING_SETTING);
    if (v === null) return {};
    try {
      // Checked again, leniently: a cosmetic or field the code no longer knows is dropped, the rest kept.
      return checkCosTuning(JSON.parse(v), false).tuning ?? {};
    } catch {
      return {};
    }
  }

  /** Saves the server-wide cosmetic tuning (already clean; nothing changed is stored as no row). */
  setCosTuning(t: CosTuning): void {
    this.setSetting(COS_TUNING_SETTING, Object.keys(t).length ? JSON.stringify(t) : null);
  }

  /** Per-cosmetic shop settings (hidden, diamond price): only what differs from the code ({} = all shown, no prices). */
  cosShop(): CosShop {
    const v = this.getSetting(COS_SHOP_SETTING);
    if (v === null) return {};
    try {
      // Checked again, leniently: a cosmetic the code no longer knows is dropped, the rest kept.
      return checkCosShop(JSON.parse(v), false).shop ?? {};
    } catch {
      return {};
    }
  }

  /** Saves the shop settings (already clean; nothing set is stored as no row). */
  setCosShop(shop: CosShop): void {
    this.setSetting(COS_SHOP_SETTING, Object.keys(shop).length ? JSON.stringify(shop) : null);
  }

  /** The orb looks made in /admin (src/shared/orbItems.ts); none until someone adds one. */
  orbItems(): OrbItems {
    const v = this.getSetting(ORB_ITEMS_SETTING);
    if (v === null) return { next: 1, items: [] };
    try {
      // Checked again, leniently: a broken piece is dropped, the rest kept.
      return checkOrbItems(JSON.parse(v), false).items ?? { next: 1, items: [] };
    } catch {
      return { next: 1, items: [] };
    }
  }

  /** Saves the orb looks (already clean) and puts them into the cosmetic list. */
  setOrbItems(items: OrbItems): void {
    this.setSetting(ORB_ITEMS_SETTING, items.items.length || items.next > 1 ? JSON.stringify(items) : null);
    registerOrbItems(items.items);
  }

  /** The server-wide card tuning: only the changes from the code defaults ({} until the owner saves some). */
  cardTuning(): CardTuning {
    const v = this.getSetting(CARD_TUNING_SETTING);
    if (v === null) return {};
    try {
      // Checked again, leniently: a card or number the code no longer knows is dropped, the rest kept.
      return checkCardTuning(JSON.parse(v), false).tuning ?? {};
    } catch {
      return {};
    }
  }

  /** The server-wide game balance: only the changes from the code ({} until someone saves some). */
  balance(): BalanceTuning {
    const v = this.getSetting(BALANCE_SETTING);
    if (v === null) return {};
    try {
      // Checked again, leniently: anything the code no longer accepts is dropped, the rest kept.
      return checkBalance(JSON.parse(v), false).tuning ?? {};
    } catch {
      return {};
    }
  }

  /** Saves the server-wide card tuning (already clean; nothing changed is stored as no row). */
  setCardTuning(t: CardTuning): void {
    this.setSetting(CARD_TUNING_SETTING, t.cards || t.nums ? JSON.stringify(t) : null);
  }

  /** Saves the server-wide game balance (already clean; no changes is stored as no row). */
  setBalance(t: BalanceTuning): void {
    this.setSetting(BALANCE_SETTING, Object.keys(t).length ? JSON.stringify(t) : null);
  }

  /**
   * Rewrites every saved item, in one transaction (the item stat multipliers): characters, stashes and market
   * listings of every status (the claim box too), whose searchable stats are redone. `fix` gets a row's JSON
   * and returns the new JSON, or null when nothing changed; `stats` gives a listing entry's searchable stats.
   * Returns how many rows changed.
   */
  rewriteSavedItems(fix: (json: string) => string | null, stats: (entry: string) => Record<string, number>): { characters: number; stashes: number; listings: number } {
    return this.transaction(() => {
      const out = { characters: 0, stashes: 0, listings: 0 };
      const setChar = this.db.prepare('UPDATE characters SET data = ? WHERE id = ?');
      for (const r of this.db.prepare('SELECT id, data FROM characters').all() as { id: number; data: string }[]) {
        const n = fix(r.data);
        if (n !== null) { setChar.run(n, r.id); out.characters++; }
      }
      const setStash = this.db.prepare('UPDATE stashes SET data = ? WHERE account_id = ?');
      for (const r of this.db.prepare('SELECT account_id, data FROM stashes').all() as { account_id: number; data: string }[]) {
        const n = fix(r.data);
        if (n !== null) { setStash.run(n, r.account_id); out.stashes++; }
      }
      const setEntry = this.db.prepare('UPDATE market_listings SET entry = ? WHERE id = ?');
      const clearStats = this.db.prepare('DELETE FROM market_listing_stats WHERE listing_id = ?');
      const putStat = this.db.prepare('INSERT INTO market_listing_stats (listing_id, stat, value) VALUES (?, ?, ?)');
      for (const r of this.db.prepare('SELECT id, entry FROM market_listings').all() as { id: number; entry: string }[]) {
        const n = fix(r.entry);
        if (n === null) continue;
        setEntry.run(n, r.id);
        clearStats.run(r.id);
        for (const [stat, value] of Object.entries(stats(n))) if (value) putStat.run(r.id, stat, value);
        out.listings++;
      }
      return out;
    });
  }

  shutdownTexts(): Record<ShutdownMode, string> {
    const get = (mode: ShutdownMode): string => {
      const v = this.getSetting(SHUTDOWN_TEXT_KEY[mode]);
      // Checked again so a hand-edited row can never break the countdown.
      return v !== null && !checkShutdownText(v).error ? v : DEFAULT_SHUTDOWN_TEXT[mode];
    };
    return { restart: get('restart'), shutdown: get('shutdown') };
  }

  // ------------------------------------------------------------ accounts

  /** A real (non-guest) account by name. */
  findAccount(username: string): AccountRow | undefined {
    return this.db.prepare('SELECT id, username, pass_hash FROM accounts WHERE username = ? AND is_guest = 0').get(username) as AccountRow | undefined;
  }

  private usernameTaken(username: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM accounts WHERE username = ?').get(username);
  }

  /** Returns the new account id, or null if the username is taken. */
  createAccount(username: string, passHash: string): number | null {
    if (this.usernameTaken(username)) return null;
    const r = this.db.prepare('INSERT INTO accounts (username, pass_hash, created_at) VALUES (?, ?, ?)').run(username, passHash, Date.now());
    return Number(r.lastInsertRowid);
  }

  // ------------------------------------------------------------ guests

  /**
   * Makes a guest: a temporary account (with a name nobody can type at the login form, and no
   * password) holding one new character.
   */
  createGuest(guestKey: string, data: CharacterData): { accountId: number; character: CharacterSummary } {
    this.db.exec('BEGIN');
    try {
      const now = Date.now();
      const r = this.db.prepare('INSERT INTO accounts (username, pass_hash, created_at, is_guest, last_online) VALUES (?, ?, ?, 1, ?)')
        .run(`guest:${guestKey}`, '', now, now);
      const accountId = Number(r.lastInsertRowid);
      const character = this.createCharacter(accountId, data);
      this.db.exec('COMMIT');
      return { accountId, character };
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  /**
   * Turns a guest into a real account — same account id, so its character comes along — and ends
   * the guest's login tokens. Returns false if it isn't a guest (any more) or the username is taken.
   */
  upgradeGuest(accountId: number, username: string, passHash: string): boolean {
    if (this.usernameTaken(username)) return false;
    this.db.exec('BEGIN');
    try {
      const n = this.db.prepare('UPDATE accounts SET username = ?, pass_hash = ?, is_guest = 0, last_online = NULL WHERE id = ? AND is_guest = 1')
        .run(username, passHash, accountId).changes;
      if (n) this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(accountId);
      this.db.exec('COMMIT');
      return n > 0;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  /** Deletes a guest with its character and login tokens (does nothing to a real account). */
  deleteGuest(accountId: number): void {
    this.db.prepare('DELETE FROM accounts WHERE id = ? AND is_guest = 1').run(accountId);
  }

  /**
   * Remembers that the account is playing right now: a guest's expiry counts from the last time this
   * was set, and the admin page shows it as "last online".
   */
  touchOnline(accountId: number, now = Date.now()): void {
    this.db.prepare('UPDATE accounts SET last_online = ? WHERE id = ?').run(now, accountId);
  }

  /** Deletes guests not online for GUEST_TTL_MS, never one listed in `online`. Returns how many went. */
  deleteStaleGuests(online: Iterable<number>, now = Date.now()): number {
    const keep = new Set(online);
    const rows = this.db.prepare('SELECT id FROM accounts WHERE is_guest = 1 AND COALESCE(last_online, created_at) < ?')
      .all(now - GUEST_TTL_MS) as { id: number }[];
    let n = 0;
    for (const r of rows) {
      if (keep.has(r.id)) continue;
      this.deleteGuest(r.id);
      n++;
    }
    return n;
  }

  // ------------------------------------------------------------ sessions

  createSession(token: string, accountId: number, expiresAt: number): void {
    this.db.prepare('INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)').run(token, accountId, expiresAt);
  }

  /** The account behind a login token, if the token exists and hasn't expired. */
  sessionAccount(token: string): SessionAccount | undefined {
    const r = this.db.prepare(`
      SELECT a.id, a.username, a.is_guest FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token = ? AND s.expires_at > ?`).get(token, Date.now()) as { id: number; username: string; is_guest: number } | undefined;
    return r && { id: r.id, username: r.username, guest: r.is_guest === 1 };
  }

  deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  deleteExpiredSessions(): void {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  }

  // ------------------------------------------------------------ characters

  private summary(r: CharacterRow): CharacterSummary {
    const d = JSON.parse(r.data) as CharacterData;
    return { id: r.id, name: r.name, classId: r.class_id as ClassId, level: d.level };
  }

  listCharacters(accountId: number): CharacterSummary[] {
    const rows = this.db.prepare('SELECT * FROM characters WHERE account_id = ? ORDER BY id').all(accountId) as unknown as CharacterRow[];
    return rows.map((r) => this.summary(r));
  }

  countCharacters(accountId: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM characters WHERE account_id = ?').get(accountId) as { n: number }).n;
  }

  characterNameTaken(name: string, exceptAccount = -1): boolean {
    return !!this.db.prepare('SELECT 1 FROM characters WHERE name = ? AND account_id != ?').get(name, exceptAccount);
  }

  createCharacter(accountId: number, data: CharacterData): CharacterSummary {
    const now = Date.now();
    const r = this.db.prepare('INSERT INTO characters (account_id, name, class_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(accountId, data.name, data.classId, JSON.stringify(data), now, now);
    return { id: Number(r.lastInsertRowid), name: data.name, classId: data.classId, level: data.level };
  }

  /** Full saved state of a character, only if it belongs to this account. */
  loadCharacter(accountId: number, id: number): CharacterData | undefined {
    const r = this.db.prepare('SELECT data FROM characters WHERE id = ? AND account_id = ?').get(id, accountId) as { data: string } | undefined;
    return r ? upgradeCharacter(JSON.parse(r.data) as CharacterData) : undefined;
  }

  // ------------------------------------------------------------ cosmetics (owned per account)

  /** Cosmetic ids the account owns (known ones only, catalogue order). */
  cosmeticsOwned(accountId: number): string[] {
    const rows = this.db.prepare('SELECT cosmetic_id FROM account_cosmetics WHERE account_id = ?').all(accountId) as { cosmetic_id: string }[];
    return cleanCosOwned(rows.map((r) => r.cosmetic_id));
  }

  /** Gives a cosmetic; false when the account already has it. */
  grantCosmetic(accountId: number, cosmeticId: string, by: string): boolean {
    const r = this.db.prepare('INSERT OR IGNORE INTO account_cosmetics (account_id, cosmetic_id, granted_at, granted_by) VALUES (?, ?, ?, ?)')
      .run(accountId, cosmeticId, Date.now(), by);
    return Number(r.changes) > 0;
  }

  /** How many accounts own a cosmetic. */
  cosmeticOwners(cosmeticId: string): number {
    const r = this.db.prepare('SELECT COUNT(*) AS n FROM account_cosmetics WHERE cosmetic_id = ?').get(cosmeticId) as { n: number };
    return Number(r.n);
  }

  /** Takes a cosmetic back; false when the account didn't have it. */
  revokeCosmetic(accountId: number, cosmeticId: string): boolean {
    const r = this.db.prepare('DELETE FROM account_cosmetics WHERE account_id = ? AND cosmetic_id = ?').run(accountId, cosmeticId);
    return Number(r.changes) > 0;
  }

  // ------------------------------------------------------------ stash (one per account)

  /** The account's stash; accounts without one yet get a new empty stash. */
  loadStash(accountId: number): StashData {
    const r = this.db.prepare('SELECT data FROM stashes WHERE account_id = ?').get(accountId) as { data: string } | undefined;
    return cleanStash(r ? JSON.parse(r.data) : null);
  }

  /**
   * Saves a character and its account's stash together, in one transaction, so an item moved between
   * the two can never end up in both (or neither) after a crash.
   */
  saveCharacterAndStash(charId: number, data: CharacterData, accountId: number, stash: StashData): void {
    this.transaction(() => this.writeCharacterAndStash(charId, data, accountId, stash));
  }

  /** Saves only the stash (an admin edit while nobody on the account is online). */
  saveStash(accountId: number, stash: StashData): void {
    this.db.prepare(`INSERT INTO stashes (account_id, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
      .run(accountId, JSON.stringify(stash), Date.now());
  }

  /** The two writes of saveCharacterAndStash, for a transaction that does more (the market). */
  writeCharacterAndStash(charId: number, data: CharacterData, accountId: number, stash: StashData): void {
    this.saveCharacter(charId, data);
    this.db.prepare(`INSERT INTO stashes (account_id, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
      .run(accountId, JSON.stringify(stash), Date.now());
  }

  // ------------------------------------------------------------ friends and blocks (server/friends.ts holds the rules)

  /** The account's most recently saved character (the one played last), or null when it has none. */
  lastCharacter(accountId: number): FriendChar | null {
    const r = this.db.prepare(`SELECT name, class_id, json_extract(data, '$.level') AS lv, json_extract(data, '$.zone') AS zone
      FROM characters WHERE account_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`).get(accountId) as
      { name: string; class_id: string; lv: number | null; zone: string | null } | undefined;
    return r ? { name: r.name, cls: r.class_id as ClassId, lv: Number(r.lv) || 1, zone: r.zone ?? '' } : null;
  }

  friendIds(accountId: number): number[] {
    return (this.db.prepare('SELECT acc_hi AS id FROM friends WHERE acc_lo = ? UNION SELECT acc_lo FROM friends WHERE acc_hi = ?')
      .all(accountId, accountId) as { id: number }[]).map((r) => r.id);
  }

  areFriends(a: number, b: number): boolean {
    return !!this.db.prepare('SELECT 1 FROM friends WHERE acc_lo = ? AND acc_hi = ?').get(Math.min(a, b), Math.max(a, b));
  }

  addFriend(a: number, b: number): void {
    this.db.prepare('INSERT OR IGNORE INTO friends (acc_lo, acc_hi, since) VALUES (?, ?, ?)').run(Math.min(a, b), Math.max(a, b), Date.now());
  }

  /** Returns false when they weren't friends. */
  removeFriend(a: number, b: number): boolean {
    return this.db.prepare('DELETE FROM friends WHERE acc_lo = ? AND acc_hi = ?').run(Math.min(a, b), Math.max(a, b)).changes > 0;
  }

  hasFriendRequest(from: number, to: number): boolean {
    return !!this.db.prepare('SELECT 1 FROM friend_requests WHERE from_acc = ? AND to_acc = ?').get(from, to);
  }

  addFriendRequest(from: number, to: number): void {
    this.db.prepare('INSERT OR IGNORE INTO friend_requests (from_acc, to_acc, at) VALUES (?, ?, ?)').run(from, to, Date.now());
  }

  /** Returns false when there was no such request. */
  removeFriendRequest(from: number, to: number): boolean {
    return this.db.prepare('DELETE FROM friend_requests WHERE from_acc = ? AND to_acc = ?').run(from, to).changes > 0;
  }

  /** Accounts that asked this one (oldest first). */
  incomingRequests(accountId: number): number[] {
    return (this.db.prepare('SELECT from_acc AS id FROM friend_requests WHERE to_acc = ? ORDER BY at, from_acc').all(accountId) as { id: number }[]).map((r) => r.id);
  }

  /** Accounts this one asked (oldest first). */
  outgoingRequests(accountId: number): number[] {
    return (this.db.prepare('SELECT to_acc AS id FROM friend_requests WHERE from_acc = ? ORDER BY at, to_acc').all(accountId) as { id: number }[]).map((r) => r.id);
  }

  /** Whether `blocker` blocked `blocked`. */
  isBlocked(blocker: number, blocked: number): boolean {
    return !!this.db.prepare('SELECT 1 FROM blocks WHERE blocker = ? AND blocked = ?').get(blocker, blocked);
  }

  /** Accounts this one blocked (oldest first). */
  blockedIds(accountId: number): number[] {
    return (this.db.prepare('SELECT blocked AS id FROM blocks WHERE blocker = ? ORDER BY at, blocked').all(accountId) as { id: number }[]).map((r) => r.id);
  }

  /** Blocks `blocked`, ending a friendship and any request between the two, in one transaction. */
  addBlock(blocker: number, blocked: number): void {
    this.transaction(() => {
      this.removeFriend(blocker, blocked);
      this.removeFriendRequest(blocker, blocked);
      this.removeFriendRequest(blocked, blocker);
      this.db.prepare('INSERT OR IGNORE INTO blocks (blocker, blocked, at) VALUES (?, ?, ?)').run(blocker, blocked, Date.now());
    });
  }

  /** Returns false when it wasn't blocked. */
  removeBlock(blocker: number, blocked: number): boolean {
    return this.db.prepare('DELETE FROM blocks WHERE blocker = ? AND blocked = ?').run(blocker, blocked).changes > 0;
  }

  /** How many transaction() calls are running (inner ones are savepoints). */
  private txDepth = 0;

  /**
   * Runs `fn` in one transaction: everything it wrote is kept, or (if it throws) none of it. Called
   * inside another transaction it is a savepoint: a throw undoes only this part, and nothing is on
   * disk until the outermost one commits (World.saveAll saves everyone with one commit).
   */
  transaction<T>(fn: () => T): T {
    const sp = this.txDepth ? `sp${this.txDepth}` : null;
    this.db.exec(sp ? `SAVEPOINT ${sp}` : 'BEGIN');
    this.txDepth++;
    try {
      const out = fn();
      this.db.exec(sp ? `RELEASE ${sp}` : 'COMMIT');
      return out;
    } catch (e) {
      if (sp) {
        this.db.exec(`ROLLBACK TO ${sp}`);
        this.db.exec(`RELEASE ${sp}`);
      } else this.db.exec('ROLLBACK');
      throw e;
    } finally {
      this.txDepth--;
    }
  }

  saveCharacter(id: number, data: CharacterData): void {
    this.db.prepare('UPDATE characters SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data), Date.now(), id);
  }

  /** Returns false when there is no such character on this account. */
  deleteCharacter(accountId: number, id: number): boolean {
    return this.db.prepare('DELETE FROM characters WHERE id = ? AND account_id = ?').run(id, accountId).changes > 0;
  }

  // ------------------------------------------------------------ admin

  /** Whether this role exists: owner, gm, or one the owner added on the Permissions tab. */
  isRole(role: unknown): role is AdminRole {
    if (typeof role !== 'string' || !role) return false;
    if (BUILTIN_ROLES.includes(role)) return true;
    return !!this.db.prepare('SELECT 1 FROM admin_roles WHERE id = ?').get(role);
  }

  /** The account's admin role, or null for normal players (and guests, who never get one). */
  adminRole(accountId: number): AdminRole | null {
    const r = this.db.prepare('SELECT admin_role FROM accounts WHERE id = ? AND is_guest = 0').get(accountId) as { admin_role: string | null } | undefined;
    return r && this.isRole(r.admin_role) ? r.admin_role : null;
  }

  private roleRow(role: AdminRole): { name: string; features: string; created_at: number } | undefined {
    if (role === OWNER_ROLE) return undefined;
    return this.db.prepare('SELECT name, features, created_at FROM admin_roles WHERE id = ?').get(role) as { name: string; features: string; created_at: number } | undefined;
  }

  /** What the owner changed from the defaults for this role (unknown or broken entries are skipped). */
  roleOverrides(role: AdminRole): FeatureOverrides {
    const row = this.roleRow(role);
    if (!row) return {};
    let raw: unknown;
    try {
      raw = JSON.parse(row.features);
    } catch {
      return {};
    }
    const out: FeatureOverrides = {};
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) if (isAdminFeature(k) && typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  /** The tools this role may use right now (read on every admin call, so changes apply at once). */
  roleFeatures(role: AdminRole): AdminFeature[] {
    return roleFeatures(role, this.roleOverrides(role));
  }

  /** A role's display name ("Owner", "GM", or what the owner named it). */
  roleName(role: AdminRole): string {
    return this.roleRow(role)?.name ?? BUILTIN_ROLE_NAME[role] ?? role;
  }

  /** How many real accounts hold this role. */
  roleMembers(role: AdminRole): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE admin_role = ? AND is_guest = 0').get(role) as { n: number }).n;
  }

  /** Every role: owner, gm, then the added ones in the order they were made. */
  roleDefs(): RoleDef[] {
    const custom = (this.db.prepare('SELECT id FROM admin_roles ORDER BY created_at, id').all() as { id: string }[])
      .map((r) => r.id).filter((id) => !BUILTIN_ROLES.includes(id));
    return [...BUILTIN_ROLES, ...custom].map((id) => ({
      id,
      name: this.roleName(id),
      features: id === OWNER_ROLE ? [...ADMIN_FEATURES] : this.roleFeatures(id),
      builtin: BUILTIN_ROLES.includes(id),
      members: this.roleMembers(id),
    }));
  }

  /** Adds a role or changes its name / tools (never 'owner'; the caller checks every value). */
  saveRole(role: AdminRole, name: string, overrides: FeatureOverrides): void {
    if (role === OWNER_ROLE) throw new Error('owner role is not stored');
    this.db.prepare(`INSERT INTO admin_roles (id, name, features, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, features = excluded.features`).run(role, name, JSON.stringify(overrides), Date.now());
  }

  /** Removes an added role (the caller makes sure no account holds it). */
  deleteRole(role: AdminRole): boolean {
    if (BUILTIN_ROLES.includes(role)) return false;
    return this.db.prepare('DELETE FROM admin_roles WHERE id = ?').run(role).changes > 0;
  }

  /** Sets (or with null, removes) a real account's admin role. Returns false when there is no such account. */
  setAdminRole(accountId: number, role: AdminRole | null): boolean {
    return this.db.prepare('UPDATE accounts SET admin_role = ? WHERE id = ? AND is_guest = 0').run(role, accountId).changes > 0;
  }

  /** Every account with an admin role. */
  listAdmins(): RoleRow[] {
    const rows = this.db.prepare("SELECT id, username, admin_role FROM accounts WHERE admin_role IS NOT NULL AND is_guest = 0 ORDER BY CASE admin_role WHEN 'owner' THEN 0 WHEN 'gm' THEN 1 ELSE 2 END, admin_role, username")
      .all() as { id: number; username: string; admin_role: string }[];
    const known = new Set(this.roleDefs().map((r) => r.id));
    return rows.filter((r) => known.has(r.admin_role)).map((r) => ({ accountId: r.id, username: r.username, role: r.admin_role }));
  }

  /** Real accounts or guests by id, for showing names. */
  accountName(accountId: number): { username: string; guest: boolean } | undefined {
    const r = this.db.prepare('SELECT username, is_guest FROM accounts WHERE id = ?').get(accountId) as { username: string; is_guest: number } | undefined;
    return r && { username: r.username, guest: r.is_guest === 1 };
  }

  /** Characters whose name contains `q` (case-insensitive), with their account. */
  searchCharacters(q: string, limit: number): AdminCharacterRow[] {
    // `!` escapes LIKE's wildcards, so a typed % or _ matches itself.
    const like = `%${q.replace(/[!%_]/g, (c) => '!' + c)}%`;
    const rows = this.db.prepare(`
      SELECT c.id, c.account_id, c.name, c.data, a.username, a.is_guest FROM characters c JOIN accounts a ON a.id = c.account_id
      WHERE c.name LIKE ? ESCAPE '!' ORDER BY c.name LIMIT ?`).all(like, limit) as {
      id: number; account_id: number; name: string; data: string; username: string; is_guest: number;
    }[];
    return rows.map((r) => this.adminRow(r));
  }

  /** One character by id, with its account. */
  adminCharacter(id: number): AdminCharacterRow | undefined {
    const r = this.db.prepare(`
      SELECT c.id, c.account_id, c.name, c.data, a.username, a.is_guest FROM characters c JOIN accounts a ON a.id = c.account_id
      WHERE c.id = ?`).get(id) as { id: number; account_id: number; name: string; data: string; username: string; is_guest: number } | undefined;
    return r && this.adminRow(r);
  }

  private adminRow(r: { id: number; account_id: number; name: string; data: string; username: string; is_guest: number }): AdminCharacterRow {
    return { id: r.id, accountId: r.account_id, username: r.username, guest: r.is_guest === 1, name: r.name, data: upgradeCharacter(JSON.parse(r.data) as CharacterData) };
  }

  /** Every account with what the "ผู้ใช้ทั้งหมด" table needs (gold and levels read from the saves). */
  adminAccounts(): {
    id: number; username: string; guest: boolean; role: string | null; createdAt: number; lastOnline: number | null;
    banUntil: number | null; banReason: string | null; stashSize: number | null; stashGold: number;
    chars: { id: number; name: string; level: number; gold: number }[];
  }[] {
    const accs = this.db.prepare(`SELECT a.id, a.username, a.is_guest, a.admin_role, a.created_at, a.last_online, a.ban_until, a.ban_reason,
        json_extract(s.data, '$.size') AS stash_size, json_extract(s.data, '$.gold') AS stash_gold
      FROM accounts a LEFT JOIN stashes s ON s.account_id = a.id ORDER BY a.id`).all() as {
      id: number; username: string; is_guest: number; admin_role: string | null; created_at: number; last_online: number | null;
      ban_until: number | null; ban_reason: string | null; stash_size: number | null; stash_gold: number | null;
    }[];
    const chars = this.db.prepare(`SELECT id, account_id, name, json_extract(data, '$.level') AS level, json_extract(data, '$.gold') AS gold
      FROM characters ORDER BY id`).all() as { id: number; account_id: number; name: string; level: number; gold: number }[];
    const by = new Map<number, { id: number; name: string; level: number; gold: number }[]>();
    for (const c of chars) {
      const list = by.get(c.account_id) ?? [];
      list.push({ id: c.id, name: c.name, level: Number(c.level) || 1, gold: Number(c.gold) || 0 });
      by.set(c.account_id, list);
    }
    return accs.map((a) => ({
      id: a.id, username: a.username, guest: a.is_guest === 1, role: a.admin_role, createdAt: a.created_at, lastOnline: a.last_online,
      banUntil: a.ban_until, banReason: a.ban_reason, stashSize: a.stash_size, stashGold: Number(a.stash_gold) || 0,
      chars: by.get(a.id) ?? [],
    }));
  }

  /** The account's characters with their full saves. */
  characterSaves(accountId: number): { id: number; data: CharacterData }[] {
    const rows = this.db.prepare('SELECT id, data FROM characters WHERE account_id = ? ORDER BY id').all(accountId) as { id: number; data: string }[];
    return rows.map((r) => ({ id: r.id, data: upgradeCharacter(JSON.parse(r.data) as CharacterData) }));
  }

  /** The account's stash if it has one saved (null for guests and accounts that never opened it). */
  savedStash(accountId: number): StashData | null {
    const r = this.db.prepare('SELECT data FROM stashes WHERE account_id = ?').get(accountId) as { data: string } | undefined;
    return r ? cleanStash(JSON.parse(r.data)) : null;
  }

  /** An active ban (end time in the future), or undefined. */
  activeBan(accountId: number, now = Date.now()): { until: number; reason: string } | undefined {
    const r = this.db.prepare('SELECT ban_until, ban_reason FROM accounts WHERE id = ? AND ban_until > ?').get(accountId, now) as
      { ban_until: number; ban_reason: string | null } | undefined;
    return r && { until: r.ban_until, reason: r.ban_reason ?? '' };
  }

  /** Bans (or with until = null, unbans) an account; a ban also ends its logins. */
  setBan(accountId: number, until: number | null, reason: string | null): void {
    this.db.prepare('UPDATE accounts SET ban_until = ?, ban_reason = ? WHERE id = ?').run(until, reason, accountId);
    if (until !== null) this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(accountId);
  }

  /** New password hash for a real account; its logins end (everyone must log in again). */
  setPassword(accountId: number, passHash: string): boolean {
    const n = this.db.prepare('UPDATE accounts SET pass_hash = ? WHERE id = ? AND is_guest = 0').run(passHash, accountId).changes;
    if (n) this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(accountId);
    return n > 0;
  }

  /** Deletes an account with its characters, stash and logins. */
  deleteAccount(accountId: number): boolean {
    return this.db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId).changes > 0;
  }

  /** Deletes one character by id (admin). */
  deleteCharacterById(id: number): boolean {
    return this.db.prepare('DELETE FROM characters WHERE id = ?').run(id).changes > 0;
  }

  // ------------------------------------------------------------ consignment market (see server/market.ts)

  /** Adds a listing (and its searchable stats); returns its id. Call inside the transaction that also saves the seller. */
  marketInsert(l: MarketInsert): number {
    const id = Number(this.db.prepare(`INSERT INTO market_listings (seller_account, seller_char, seller_name, entry, uid, name, kind,
      rarity, level, plus, cls, count, price, fee, created_at, expires_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`).run(
      l.sellerAccount, l.sellerChar, l.sellerName, l.entry, l.uid, l.name, l.kind,
      l.rarity, l.level, l.plus, l.cls, l.count, l.price, l.fee, l.createdAt, l.expiresAt,
    ).lastInsertRowid);
    const put = this.db.prepare('INSERT INTO market_listing_stats (listing_id, stat, value) VALUES (?, ?, ?)');
    for (const [stat, value] of Object.entries(l.stats)) if (value) put.run(id, stat, value);
    return id;
  }

  /** Listings this account has up right now (they count against its slots until sold, cancelled or expired). */
  marketActiveCount(accountId: number): number {
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM market_listings WHERE seller_account = ? AND status = 'active'").get(accountId) as { n: number };
    return Number(r.n);
  }

  /** Whether this item (uid) is up for sale already. */
  marketUidListed(uid: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM market_listings WHERE uid = ? AND status = 'active'").get(uid);
  }

  marketGet(id: number): MarketDbRow | undefined {
    return this.db.prepare('SELECT * FROM market_listings WHERE id = ?').get(id) as MarketDbRow | undefined;
  }

  /** One page of listings for sale that match the search (cleaned by cleanQuery first). */
  marketSearch(q: MarketQuery, now: number, pageSize: number): { rows: MarketDbRow[]; total: number } {
    const where = ["l.status = 'active'", 'l.expires_at > ?'];
    const args: (string | number)[] = [now];
    if (q.kind) where.push('l.kind = ?'), args.push(q.kind);
    if (q.cls) where.push('(l.cls IS NULL OR l.cls = ?)'), args.push(q.cls);
    if (q.rarities?.length) where.push(`l.rarity IN (${q.rarities.map(() => '?').join(', ')})`), args.push(...q.rarities);
    if (q.name) where.push("l.name LIKE ? ESCAPE '\\'"), args.push(`%${q.name.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
    // Stones have no level: the level range only narrows gear.
    if (q.lvMin) where.push("(l.kind IN ('stone', 'consumable') OR l.level >= ?)"), args.push(q.lvMin);
    if (q.lvMax) where.push("(l.kind IN ('stone', 'consumable') OR l.level <= ?)"), args.push(q.lvMax);
    if (q.plusMin) where.push('l.plus >= ?'), args.push(q.plusMin);
    if (q.priceMax) where.push('l.price <= ?'), args.push(q.priceMax);
    for (const f of q.stats ?? []) {
      where.push('EXISTS (SELECT 1 FROM market_listing_stats s WHERE s.listing_id = l.id AND s.stat = ? AND s.value >= ?)');
      args.push(f.stat, f.min);
    }
    const sql = where.join(' AND ');
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS n FROM market_listings l WHERE ${sql}`).get(...args) as { n: number }).n);
    const orderArgs: string[] = [];
    let order: string;
    switch (q.sort) {
      case 'priceDesc': order = 'l.price DESC, l.id DESC'; break;
      case 'newest': order = 'l.created_at DESC, l.id DESC'; break;
      case 'level': order = 'l.level DESC, l.price ASC, l.id ASC'; break;
      case 'ending': order = 'l.expires_at ASC, l.id ASC'; break;
      case 'stat':
        order = '(SELECT s.value FROM market_listing_stats s WHERE s.listing_id = l.id AND s.stat = ?) DESC, l.price ASC, l.id ASC';
        orderArgs.push(q.stats![0].stat);
        break;
      default: order = 'l.price ASC, l.id ASC';
    }
    const rows = this.db.prepare(`SELECT l.* FROM market_listings l WHERE ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...args, ...orderArgs, pageSize, (q.page ?? 0) * pageSize) as unknown as MarketDbRow[];
    return { rows, total };
  }

  /**
   * Price hints for listing something: the cheapest unit price now for sale, and the average unit price of
   * the last (up to 5) sales, for listings with this name and kind. A null = none. Unit = price / count (stones).
   */
  marketPriceRef(name: string, kind: string, now: number): { lowest: number | null; sold: number | null; soldN: number } {
    const low = this.db.prepare(`SELECT MIN(CAST(price AS REAL) / count) AS u FROM market_listings
      WHERE name = ? AND kind = ? AND status = 'active' AND expires_at > ?`).get(name, kind, now) as { u: number | null };
    const sold = this.db.prepare(`SELECT price, count FROM market_listings WHERE name = ? AND kind = ? AND status = 'sold'
      ORDER BY sold_at DESC LIMIT 5`).all(name, kind) as unknown as { price: number; count: number }[];
    const avg = sold.length ? sold.reduce((n, r) => n + r.price / Math.max(1, r.count), 0) / sold.length : null;
    return { lowest: low.u === null ? null : Math.ceil(low.u), sold: avg === null ? null : Math.round(avg), soldN: sold.length };
  }

  /**
   * Marks a listing sold, only if it is still for sale (not sold to someone a moment ago, cancelled or
   * expired). False = it wasn't, and nothing changed.
   */
  marketMarkSold(id: number, buyerAccount: number, buyerName: string, now: number, tax: number): boolean {
    return this.db.prepare(`UPDATE market_listings SET status = 'sold', buyer_account = ?, buyer_name = ?, sold_at = ?, tax = ?
      WHERE id = ? AND status = 'active' AND expires_at > ?`).run(buyerAccount, buyerName, now, tax, id, now).changes === 1;
  }

  /** Takes the account's own listing off sale (it goes to the claim box). False = not its listing, or no longer up. */
  marketCancel(id: number, accountId: number): boolean {
    return this.db.prepare("UPDATE market_listings SET status = 'cancelled' WHERE id = ? AND seller_account = ? AND status = 'active'")
      .run(id, accountId).changes === 1;
  }

  /** Ends every listing whose time is up; returns them (to tell their sellers). */
  marketExpire(now: number): MarketDbRow[] {
    return this.transaction(() => {
      const rows = this.db.prepare("SELECT * FROM market_listings WHERE status = 'active' AND expires_at <= ?").all(now) as unknown as MarketDbRow[];
      if (rows.length) this.db.prepare("UPDATE market_listings SET status = 'expired' WHERE status = 'active' AND expires_at <= ?").run(now);
      return rows.map((r) => ({ ...r, status: 'expired' }));
    });
  }

  /** The account's listings still up, and the finished ones waiting in its claim box (oldest first). */
  marketMine(accountId: number): { active: MarketDbRow[]; box: MarketDbRow[] } {
    const active = this.db.prepare("SELECT * FROM market_listings WHERE seller_account = ? AND status = 'active' ORDER BY created_at")
      .all(accountId) as unknown as MarketDbRow[];
    return { active, box: this.marketBox(accountId) };
  }

  marketBox(accountId: number): MarketDbRow[] {
    return this.db.prepare(`SELECT * FROM market_listings WHERE seller_account = ? AND status <> 'active' AND claimed_at IS NULL
      ORDER BY COALESCE(sold_at, expires_at), id`).all(accountId) as unknown as MarketDbRow[];
  }

  marketBoxCount(accountId: number): number {
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM market_listings WHERE seller_account = ? AND status <> 'active' AND claimed_at IS NULL")
      .get(accountId) as { n: number };
    return Number(r.n);
  }

  /** Marks a claim box row collected, only once. False = already collected (or not this account's). */
  marketMarkClaimed(id: number, accountId: number, now: number): boolean {
    return this.db.prepare(`UPDATE market_listings SET claimed_at = ?
      WHERE id = ? AND seller_account = ? AND status <> 'active' AND claimed_at IS NULL`).run(now, id, accountId).changes === 1;
  }

  /** Sold or expired listings the seller hasn't been told about yet. */
  marketUnnotified(accountId: number): MarketDbRow[] {
    return this.db.prepare(`SELECT * FROM market_listings WHERE seller_account = ? AND status IN ('sold', 'expired') AND notified_at IS NULL`)
      .all(accountId) as unknown as MarketDbRow[];
  }

  marketSetNotified(ids: readonly number[], now: number): void {
    const upd = this.db.prepare('UPDATE market_listings SET notified_at = ? WHERE id = ?');
    for (const id of ids) upd.run(now, id);
  }

  // ------------------------------------------------------------ daily login (server/daily.ts)

  /** Marks a day as got; false when this account already has it (so a race can't deliver twice). */
  dailyClaim(accountId: number, day: string, makeup: boolean, at: number): boolean {
    return Number(this.db.prepare('INSERT OR IGNORE INTO daily_claims (account_id, day, makeup, at) VALUES (?, ?, ?, ?)')
      .run(accountId, day, makeup ? 1 : 0, at).changes) === 1;
  }

  /** The days this account got in one month ('YYYY-MM'): day of the month → was it a make-up. */
  dailyMonth(accountId: number, month: string): Map<number, boolean> {
    const rows = this.db.prepare("SELECT day, makeup FROM daily_claims WHERE account_id = ? AND day LIKE ? || '-%'").all(accountId, month) as { day: string; makeup: number }[];
    return new Map(rows.map((r) => [Number(r.day.slice(8)), r.makeup === 1]));
  }

  /** The mail send kept for this key, if it still exists. */
  dailyMailSend(key: string): number | undefined {
    const r = this.db.prepare('SELECT d.send_id AS id FROM daily_mail d JOIN mail_sends s ON s.id = d.send_id WHERE d.key = ?').get(key) as { id: number } | undefined;
    return r?.id;
  }

  dailyMailKeep(key: string, sendId: number): void {
    this.db.prepare('INSERT OR REPLACE INTO daily_mail (key, send_id) VALUES (?, ?)').run(key, sendId);
  }

  // ------------------------------------------------------------ mailbox (server/mail.ts)

  /** Adds a send (its box rows come from mailBoxAdd / mailBoxFanout in the same transaction); returns its id. */
  mailSendInsert(s: { senderId: number | null; senderName: string; target: string; title: string; body: string; attach: string; hasAttach: boolean; at: number; expiresAt: number }): number {
    const r = this.db.prepare(`INSERT INTO mail_sends (sender_id, sender_name, target, title, body, attach, has_attach, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(s.senderId, s.senderName, s.target, s.title, s.body, s.attach, s.hasAttach ? 1 : 0, s.at, s.expiresAt);
    return Number(r.lastInsertRowid);
  }

  mailBoxAdd(sendId: number, accountId: number, charId: number | null): void {
    this.db.prepare('INSERT INTO mail_box (send_id, account_id, char_id) VALUES (?, ?, ?)').run(sendId, accountId, charId);
  }

  /** One copy per existing character ('chars') or per existing account ('accounts'), guests never; returns the count. */
  mailBoxFanout(sendId: number, kind: 'chars' | 'accounts'): number {
    const r = kind === 'chars'
      ? this.db.prepare(`INSERT INTO mail_box (send_id, account_id, char_id) SELECT ?, c.account_id, c.id FROM characters c
          JOIN accounts a ON a.id = c.account_id WHERE a.is_guest = 0`).run(sendId)
      : this.db.prepare('INSERT INTO mail_box (send_id, account_id, char_id) SELECT ?, id, NULL FROM accounts WHERE is_guest = 0').run(sendId);
    return Number(r.changes);
  }

  /** A character by exact name (any case), with its account. */
  characterByName(name: string): { id: number; accountId: number; name: string; guest: boolean } | undefined {
    const r = this.db.prepare(`SELECT c.id, c.account_id, c.name, a.is_guest FROM characters c JOIN accounts a ON a.id = c.account_id
      WHERE c.name = ? COLLATE NOCASE LIMIT 1`).get(name) as { id: number; account_id: number; name: string; is_guest: number } | undefined;
    return r && { id: r.id, accountId: r.account_id, name: r.name, guest: r.is_guest === 1 };
  }

  /** Mail one character can see: its own copies and its account's, not deleted, recalled or expired. Newest first. */
  mailInbox(accountId: number, charId: number, now: number): MailDbRow[] {
    return this.db.prepare(`${MAIL_SELECT} WHERE b.account_id = ? AND (b.char_id IS NULL OR b.char_id = ?) AND b.deleted_at IS NULL
      AND b.recalled_at IS NULL AND s.expires_at > ? ORDER BY s.created_at DESC, b.id DESC`).all(accountId, charId, now) as unknown as MailDbRow[];
  }

  mailGet(id: number, accountId: number, charId: number, now: number): MailDbRow | undefined {
    return this.db.prepare(`${MAIL_SELECT} WHERE b.id = ? AND b.account_id = ? AND (b.char_id IS NULL OR b.char_id = ?) AND b.deleted_at IS NULL
      AND b.recalled_at IS NULL AND s.expires_at > ?`).get(id, accountId, charId, now) as unknown as MailDbRow | undefined;
  }

  mailMarkRead(id: number, now: number): void {
    this.db.prepare('UPDATE mail_box SET read_at = ? WHERE id = ? AND read_at IS NULL').run(now, id);
  }

  /**
   * Marks the copy claimed, only if it still can be (not claimed, deleted, recalled or expired).
   * False = it can't: the caller must not give anything. Call inside the transaction that saves the character.
   */
  mailMarkClaimed(id: number, charId: number, now: number): boolean {
    return Number(this.db.prepare(`UPDATE mail_box SET claimed_at = ?, claimed_char = ?, read_at = COALESCE(read_at, ?)
      WHERE id = ? AND claimed_at IS NULL AND deleted_at IS NULL AND recalled_at IS NULL
      AND (SELECT expires_at FROM mail_sends WHERE id = send_id) > ?`).run(now, charId, now, id, now).changes) === 1;
  }

  /** Deletes a copy once it is read, unless it still has unclaimed attachments. */
  mailDelete(id: number, accountId: number, charId: number, now: number): boolean {
    return Number(this.db.prepare(`UPDATE mail_box SET deleted_at = ? WHERE id = ? AND account_id = ? AND (char_id IS NULL OR char_id = ?)
      AND deleted_at IS NULL AND read_at IS NOT NULL AND (claimed_at IS NOT NULL OR (SELECT has_attach FROM mail_sends WHERE id = send_id) = 0)`)
      .run(now, id, accountId, charId).changes) === 1;
  }

  /** Deletes every read copy with nothing left to claim; returns how many. */
  mailDeleteRead(accountId: number, charId: number, now: number): number {
    return Number(this.db.prepare(`UPDATE mail_box SET deleted_at = ? WHERE account_id = ? AND (char_id IS NULL OR char_id = ?)
      AND deleted_at IS NULL AND recalled_at IS NULL AND read_at IS NOT NULL
      AND (claimed_at IS NOT NULL OR (SELECT has_attach FROM mail_sends WHERE id = send_id) = 0)`).run(now, accountId, charId).changes);
  }

  mailUnread(accountId: number, charId: number, now: number): number {
    return (this.db.prepare(`SELECT COUNT(*) AS n FROM mail_box b JOIN mail_sends s ON s.id = b.send_id WHERE b.account_id = ?
      AND (b.char_id IS NULL OR b.char_id = ?) AND b.deleted_at IS NULL AND b.recalled_at IS NULL AND b.read_at IS NULL AND s.expires_at > ?`)
      .get(accountId, charId, now) as { n: number }).n;
  }

  /** Marks every unread mail of this character / account as read (attachments stay unclaimed); returns how many. */
  mailMarkAllRead(accountId: number, charId: number, now: number): number {
    return Number(this.db.prepare(`UPDATE mail_box SET read_at = ? WHERE account_id = ? AND (char_id IS NULL OR char_id = ?)
      AND deleted_at IS NULL AND recalled_at IS NULL AND read_at IS NULL
      AND (SELECT expires_at FROM mail_sends WHERE id = send_id) > ?`).run(now, accountId, charId, now).changes);
  }

  /** Marks this character's new mail as announced; returns how many were new. */
  mailTakeFresh(accountId: number, charId: number, now: number): number {
    return Number(this.db.prepare(`UPDATE mail_box SET notified_at = ? WHERE account_id = ? AND (char_id IS NULL OR char_id = ?) AND notified_at IS NULL
      AND deleted_at IS NULL AND recalled_at IS NULL AND (SELECT expires_at FROM mail_sends WHERE id = send_id) > ?`).run(now, accountId, charId, now).changes);
  }

  /** Pulls back every copy of a send that nobody has claimed; returns how many. */
  mailRecall(sendId: number, now: number): number {
    return Number(this.db.prepare('UPDATE mail_box SET recalled_at = ? WHERE send_id = ? AND claimed_at IS NULL AND recalled_at IS NULL')
      .run(now, sendId).changes);
  }

  /** Sends, newest first, with how many copies there are and how many were read / claimed / pulled back. */
  mailHistory(limit: number, before?: number): MailSendDbRow[] {
    return this.db.prepare(`SELECT s.id, s.created_at, s.sender_name, s.target, s.title, s.body, s.attach,
        (SELECT COUNT(*) FROM mail_box WHERE send_id = s.id) AS recipients,
        (SELECT COUNT(*) FROM mail_box WHERE send_id = s.id AND read_at IS NOT NULL) AS read,
        (SELECT COUNT(*) FROM mail_box WHERE send_id = s.id AND claimed_at IS NOT NULL) AS claimed,
        (SELECT COUNT(*) FROM mail_box WHERE send_id = s.id AND recalled_at IS NOT NULL) AS recalled
      FROM mail_sends s WHERE s.id < ? ORDER BY s.id DESC LIMIT ?`).all(before ?? Number.MAX_SAFE_INTEGER, limit) as unknown as MailSendDbRow[];
  }

  mailSend(id: number): MailSendDbRow | undefined {
    const r = this.mailHistory(1, id + 1)[0];
    return r?.id === id ? r : undefined;
  }

  /** Who got a send and what they did with it (the first `limit` copies). */
  mailRecipients(sendId: number, limit: number): { account: string; char: string | null; read: boolean; claimed: boolean; recalled: boolean }[] {
    const rows = this.db.prepare(`SELECT a.username, c.name, b.read_at, b.claimed_at, b.recalled_at FROM mail_box b
      JOIN accounts a ON a.id = b.account_id LEFT JOIN characters c ON c.id = b.char_id WHERE b.send_id = ? ORDER BY b.id LIMIT ?`)
      .all(sendId, limit) as { username: string; name: string | null; read_at: number | null; claimed_at: number | null; recalled_at: number | null }[];
    return rows.map((r) => ({ account: r.username, char: r.name, read: r.read_at !== null, claimed: r.claimed_at !== null, recalled: r.recalled_at !== null }));
  }

  /** A consistent copy of the whole database, made while the server runs (SQLite VACUUM INTO). */
  backupTo(file: string): void {
    this.db.prepare('VACUUM INTO ?').run(file);
  }

  // ------------------------------------------------------------ play sessions, chat log, samples

  /** A new play session; returns its row id (closed by endPlaySession). */
  startPlaySession(r: { accountId: number; username: string; guest: boolean; charId: number; charName: string; ip: string }, at = Date.now()): number {
    return Number(this.db.prepare(`INSERT INTO play_sessions (account_id, username, guest, char_id, char_name, joined_at, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(r.accountId, r.username, r.guest ? 1 : 0, r.charId, r.charName, at, r.ip).lastInsertRowid);
  }

  endPlaySession(id: number, r: { gpu: string | null; avgRtt: number | null; avgFps: number | null }, at = Date.now()): void {
    this.db.prepare('UPDATE play_sessions SET left_at = ?, gpu = ?, avg_rtt = ?, avg_fps = ? WHERE id = ?').run(at, r.gpu, r.avgRtt, r.avgFps, id);
  }

  /**
   * One page of play sessions plus how many match. `q` is checked by the caller; `openIds` are the rows
   * still playing (their length counts up to `now`). Sort columns come only from SESSION_SORT_SQL.
   */
  playSessions(q: SessionQuery, openIds: number[], now = Date.now()): { rows: PlaySessionRow[]; total: number; page: number } {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (q.accountId !== undefined) where.push('account_id = ?'), args.push(q.accountId);
    if (q.from !== undefined) where.push('joined_at >= ?'), args.push(q.from);
    if (q.to !== undefined) where.push('joined_at < ?'), args.push(q.to);
    if (q.q) {
      const like = `%${q.q.replace(/[!%_]/g, (c) => '!' + c)}%`;
      // Guests are shown (and found) as "Guest", not by their hidden username.
      where.push(`(${GUEST_AS_GUEST} LIKE ? ESCAPE '!' OR char_name LIKE ? ESCAPE '!' OR ip LIKE ? ESCAPE '!')`);
      args.push(like, like, like);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS n FROM play_sessions ${w}`).get(...args) as { n: number }).n);
    const page = Math.max(1, Math.min(q.page, Math.ceil(total / q.size)));
    const key = sessionSortSql(q.sort, openIds, now);
    const dir = q.desc ? 'DESC' : 'ASC';
    // Empty values last in both directions; ties keep the newest first.
    const rows = this.db.prepare(`SELECT *, (${key}) AS sort_key FROM play_sessions ${w}
      ORDER BY sort_key IS NULL, sort_key ${dir}, id DESC LIMIT ? OFFSET ?`)
      .all(...args, q.size, (page - 1) * q.size) as {
      id: number; account_id: number; username: string; guest: number; char_id: number; char_name: string; joined_at: number;
      left_at: number | null; ip: string; gpu: string | null; avg_rtt: number | null; avg_fps: number | null;
    }[];
    return { total, page, rows: rows.map((r) => ({
      id: r.id, accountId: r.account_id, username: r.guest ? 'Guest' : r.username, guest: r.guest === 1, charId: r.char_id, charName: r.char_name,
      joinedAt: r.joined_at, leftAt: r.left_at, ip: r.ip, gpu: r.gpu, avgRtt: r.avg_rtt, avgFps: r.avg_fps, online: false,
    })) };
  }

  logChat(r: { accountId: number; username: string; charName: string; zone: string; text: string }, at = Date.now()): void {
    this.db.prepare('INSERT INTO chat_log (at, account_id, username, char_name, zone, text) VALUES (?, ?, ?, ?, ?, ?)')
      .run(at, r.accountId, r.username, r.charName, r.zone, r.text);
  }

  /** Newest first; `q` matches the text, the username or the character name. */
  chatLog(limit: number, q: string, before?: number): ChatLogRow[] {
    const like = `%${q.replace(/[!%_]/g, (c) => '!' + c)}%`;
    const rows = this.db.prepare(`SELECT * FROM chat_log WHERE id < ?
      AND (? = '' OR text LIKE ? ESCAPE '!' OR username LIKE ? ESCAPE '!' OR char_name LIKE ? ESCAPE '!')
      ORDER BY id DESC LIMIT ?`).all(before ?? Number.MAX_SAFE_INTEGER, q, like, like, like, limit) as {
      id: number; at: number; account_id: number; username: string; char_name: string; zone: string; text: string;
    }[];
    return rows.map((r) => ({ id: r.id, at: r.at, accountId: r.account_id, username: r.username, charName: r.char_name, zone: r.zone, text: r.text }));
  }

  chatMessage(id: number): ChatLogRow | undefined {
    return this.chatLog(1, '', id + 1).find((r) => r.id === id);
  }

  deleteChat(id: number): boolean {
    return this.db.prepare('DELETE FROM chat_log WHERE id = ?').run(id).changes > 0;
  }

  addSample(r: { total: number; zones: Record<string, number>; avgLevel: number | null; avgRtt: number | null }, at = Date.now()): void {
    this.db.prepare('INSERT OR REPLACE INTO online_samples (at, total, zones, avg_level, avg_rtt) VALUES (?, ?, ?, ?, ?)')
      .run(at, r.total, JSON.stringify(r.zones), r.avgLevel, r.avgRtt);
  }

  samples(from: number): { at: number; total: number; avgLevel: number | null; avgRtt: number | null }[] {
    return (this.db.prepare('SELECT at, total, avg_level, avg_rtt FROM online_samples WHERE at >= ? ORDER BY at').all(from) as {
      at: number; total: number; avg_level: number | null; avg_rtt: number | null;
    }[]).map((r) => ({ at: r.at, total: r.total, avgLevel: r.avg_level, avgRtt: r.avg_rtt }));
  }

  /** Real accounts' sign-up times since `from` (for the sign-ups per day graph). */
  signupTimes(from: number): number[] {
    return (this.db.prepare('SELECT created_at FROM accounts WHERE is_guest = 0 AND created_at >= ?').all(from) as { created_at: number }[])
      .map((r) => r.created_at);
  }

  /** Average level of every saved character right now. */
  averageLevel(): number | null {
    const r = this.db.prepare("SELECT AVG(json_extract(data, '$.level')) AS v FROM characters").get() as { v: number | null };
    return r.v;
  }

  /** Deletes history older than the given ages; returns how many rows went. */
  pruneHistory(now: number, days: { sessions: number; chat: number; samples: number }): number {
    const day = 24 * 60 * 60 * 1000;
    return Number(this.db.prepare('DELETE FROM play_sessions WHERE joined_at < ?').run(now - days.sessions * day).changes)
      + Number(this.db.prepare('DELETE FROM chat_log WHERE at < ?').run(now - days.chat * day).changes)
      + Number(this.db.prepare('DELETE FROM online_samples WHERE at < ?').run(now - days.samples * day).changes)
      // Market history: listings collected long enough ago (never one still up or waiting in a claim box).
      + Number(this.db.prepare('DELETE FROM market_listings WHERE claimed_at IS NOT NULL AND claimed_at < ?')
        .run(now - MARKET_HISTORY_DAYS * day).changes)
      // Mail sent long ago (it expired 30 days after sending); the history keeps 60 days, copies go with it.
      + Number(this.db.prepare('DELETE FROM mail_sends WHERE created_at < ?').run(now - MAIL_HISTORY_DAYS * day).changes);
  }

  /**
   * Records one finished trade (call inside the transaction that saves both characters). `*_items` are JSON
   * lists of text lines; `a_gold` is what A sent (B got it minus `a_tax`), and the same the other way.
   */
  tradeLogInsert(r: { at: number; zone: string; a: TradeLogSide; b: TradeLogSide }): number {
    return Number(this.db.prepare(`INSERT INTO trade_log (at, zone, a_char, a_account, a_name, b_char, b_account, b_name,
      a_items, b_items, a_gold, b_gold, a_tax, b_tax) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      r.at, r.zone, r.a.charId, r.a.accountId, r.a.name, r.b.charId, r.b.accountId, r.b.name,
      JSON.stringify(r.a.items), JSON.stringify(r.b.items), r.a.gold, r.b.gold, r.a.tax, r.b.tax,
    ).lastInsertRowid);
  }

  /** The newest trades first; `q` = part of either player's name. */
  tradeLog(limit: number, before?: number, q?: string): TradeLogRow[] {
    const like = q ? `%${q.replace(/[!%_]/g, (c) => `!${c}`)}%` : null;
    const rows = this.db.prepare(`SELECT * FROM trade_log WHERE id < ?
      ${like ? "AND (a_name LIKE ? ESCAPE '!' OR b_name LIKE ? ESCAPE '!')" : ''} ORDER BY id DESC LIMIT ?`)
      .all(...(like ? [before ?? Number.MAX_SAFE_INTEGER, like, like, limit] : [before ?? Number.MAX_SAFE_INTEGER, limit])) as {
      id: number; at: number; zone: string; a_char: number; a_name: string; b_char: number; b_name: string;
      a_items: string; b_items: string; a_gold: number; b_gold: number; a_tax: number; b_tax: number;
    }[];
    const lines = (json: string): string[] => {
      try {
        const v = JSON.parse(json);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
      } catch {
        return [];
      }
    };
    return rows.map((r) => ({
      id: r.id, at: r.at, zone: r.zone,
      a: { charId: r.a_char, name: r.a_name, items: lines(r.a_items), gold: r.a_gold, tax: r.a_tax },
      b: { charId: r.b_char, name: r.b_name, items: lines(r.b_items), gold: r.b_gold, tax: r.b_tax },
    }));
  }

  // ------------------------------------------------------------ bug reports (server/reports.ts)

  insertReport(r: Omit<AdminReportRow, 'id' | 'status' | 'banned'>): number {
    const res = this.db.prepare(`INSERT INTO reports (at, account_id, username, char_name, topic, text, zone, channel, x, z, level, rtt, fps, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(r.at, r.accountId, r.username, r.charName, r.topic, r.text, r.zone, r.channel, r.x, r.z, r.level, r.rtt, r.fps, r.ip);
    return Number(res.lastInsertRowid);
  }

  /** The account's reports since `since` (newest first): time and text, for the cooldown, daily cap and duplicate checks. */
  reportsOfAccountSince(accountId: number, since: number): { at: number; text: string }[] {
    return this.db.prepare('SELECT at, text FROM reports WHERE account_id = ? AND at > ? ORDER BY at DESC').all(accountId, since) as { at: number; text: string }[];
  }

  reportCountByIpSince(ip: string, since: number): number {
    return Number((this.db.prepare('SELECT COUNT(*) AS n FROM reports WHERE ip = ? AND at > ?').get(ip, since) as { n: number }).n);
  }

  reportCountSince(since: number): number {
    return Number((this.db.prepare('SELECT COUNT(*) AS n FROM reports WHERE at > ?').get(since) as { n: number }).n);
  }

  isReportBanned(accountId: number): boolean {
    return !!this.db.prepare('SELECT 1 FROM report_bans WHERE account_id = ?').get(accountId);
  }

  setReportBan(accountId: number, banned: boolean, byName: string, at = Date.now()): void {
    if (banned) this.db.prepare('INSERT OR REPLACE INTO report_bans (account_id, at, by_name) VALUES (?, ?, ?)').run(accountId, at, byName);
    else this.db.prepare('DELETE FROM report_bans WHERE account_id = ?').run(accountId);
  }

  /** Reports newest first, optionally of one topic / status, starting below id `before`. */
  listReports(limit: number, before: number | undefined, topic: string | undefined, status: string | undefined): AdminReportRow[] {
    const rows = this.db.prepare(`SELECT r.*, EXISTS (SELECT 1 FROM report_bans b WHERE b.account_id = r.account_id) AS banned FROM reports r
      WHERE r.id < ? AND (? IS NULL OR r.topic = ?) AND (? IS NULL OR r.status = ?) ORDER BY r.id DESC LIMIT ?`)
      .all(before ?? Number.MAX_SAFE_INTEGER, topic ?? null, topic ?? null, status ?? null, status ?? null, limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id), at: Number(r.at), accountId: Number(r.account_id), username: String(r.username), charName: String(r.char_name),
      topic: r.topic as AdminReportRow['topic'], text: String(r.text), status: r.status as AdminReportRow['status'], zone: String(r.zone),
      channel: r.channel === null ? null : Number(r.channel), x: Number(r.x), z: Number(r.z), level: Number(r.level),
      rtt: r.rtt === null ? null : Number(r.rtt), fps: r.fps === null ? null : Number(r.fps), ip: String(r.ip), banned: !!r.banned,
    }));
  }

  /** Returns the report's account id and old status, or undefined if there is no such report. */
  setReportStatus(id: number, status: string): { accountId: number; old: string } | undefined {
    const r = this.db.prepare('SELECT account_id, status FROM reports WHERE id = ?').get(id) as { account_id: number; status: string } | undefined;
    if (!r) return undefined;
    this.db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id);
    return { accountId: r.account_id, old: r.status };
  }

  /** Records one admin action. */
  audit(adminId: number | null, adminName: string, action: string, target: string, details: string, at = Date.now()): void {
    this.db.prepare('INSERT INTO admin_audit (at, admin_id, admin_name, action, target, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(at, adminId, adminName, action, target, details);
  }

  /** The newest audit rows first. */
  auditLog(limit: number, before?: number): AuditRow[] {
    const rows = this.db.prepare(`SELECT id, at, admin_name, action, target, details FROM admin_audit
      WHERE id < ? ORDER BY id DESC LIMIT ?`).all(before ?? Number.MAX_SAFE_INTEGER, limit) as {
      id: number; at: number; admin_name: string; action: string; target: string; details: string;
    }[];
    return rows.map((r) => ({ id: r.id, at: r.at, admin: r.admin_name, action: r.action, target: r.target, details: r.details }));
  }
}
