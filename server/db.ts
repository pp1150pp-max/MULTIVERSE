// SQLite storage for accounts, login sessions and online characters. One file on disk:
// back it up by copying server/data/multiverse.db while the server is stopped.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { upgradeCharacter, type CharacterData } from '../src/shared/sim/Player';
import { GUEST_TTL_HOURS, type CharacterSummary } from '../src/shared/api';
import type { ClassId } from '../src/shared/types';
import { cleanStash, type StashData } from '../src/shared/sim/stash';
import { isAdminRole, type AdminRole, type AuditRow, type ChatLogRow, type PlaySessionRow, type RoleRow } from '../src/shared/admin';

export interface AccountRow { id: number; username: string; pass_hash: string }
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
      CREATE TABLE IF NOT EXISTS admin_audit (
        id INTEGER PRIMARY KEY,
        at INTEGER NOT NULL,
        admin_id INTEGER,
        admin_name TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        details TEXT NOT NULL
      );
    `);
    // Columns added after the first release: add them to databases made before that.
    const cols = (this.db.prepare('PRAGMA table_info(accounts)').all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes('is_guest')) this.db.exec('ALTER TABLE accounts ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0');
    if (!cols.includes('last_online')) this.db.exec('ALTER TABLE accounts ADD COLUMN last_online INTEGER');
    // NULL = a normal player; 'owner' / 'gm' may use the admin page (see server/admin.ts).
    if (!cols.includes('admin_role')) this.db.exec('ALTER TABLE accounts ADD COLUMN admin_role TEXT');
    // Ban end time (BAN_FOREVER = permanent) and why; NULL = not banned.
    if (!cols.includes('ban_until')) this.db.exec('ALTER TABLE accounts ADD COLUMN ban_until INTEGER');
    if (!cols.includes('ban_reason')) this.db.exec('ALTER TABLE accounts ADD COLUMN ban_reason TEXT');
  }

  close(): void {
    this.db.close();
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
    this.db.exec('BEGIN');
    try {
      this.saveCharacter(charId, data);
      this.db.prepare(`INSERT INTO stashes (account_id, data, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
        .run(accountId, JSON.stringify(stash), Date.now());
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
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

  /** The account's admin role, or null for normal players (and guests, who never get one). */
  adminRole(accountId: number): AdminRole | null {
    const r = this.db.prepare('SELECT admin_role FROM accounts WHERE id = ? AND is_guest = 0').get(accountId) as { admin_role: string | null } | undefined;
    return r && isAdminRole(r.admin_role) ? r.admin_role : null;
  }

  /** Sets (or with null, removes) a real account's admin role. Returns false when there is no such account. */
  setAdminRole(accountId: number, role: AdminRole | null): boolean {
    return this.db.prepare('UPDATE accounts SET admin_role = ? WHERE id = ? AND is_guest = 0').run(role, accountId).changes > 0;
  }

  /** Every account with an admin role. */
  listAdmins(): RoleRow[] {
    const rows = this.db.prepare("SELECT id, username, admin_role FROM accounts WHERE admin_role IS NOT NULL AND is_guest = 0 ORDER BY admin_role DESC, username")
      .all() as { id: number; username: string; admin_role: string }[];
    return rows.filter((r) => isAdminRole(r.admin_role)).map((r) => ({ accountId: r.id, username: r.username, role: r.admin_role as AdminRole }));
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

  /** Newest first; optionally one account's, or only those before row `before`. */
  playSessions(limit: number, accountId?: number, before?: number): PlaySessionRow[] {
    const rows = this.db.prepare(`SELECT * FROM play_sessions WHERE id < ? AND (? IS NULL OR account_id = ?) ORDER BY id DESC LIMIT ?`)
      .all(before ?? Number.MAX_SAFE_INTEGER, accountId ?? null, accountId ?? null, limit) as {
      id: number; account_id: number; username: string; guest: number; char_id: number; char_name: string; joined_at: number;
      left_at: number | null; ip: string; gpu: string | null; avg_rtt: number | null; avg_fps: number | null;
    }[];
    return rows.map((r) => ({
      id: r.id, accountId: r.account_id, username: r.guest ? 'Guest' : r.username, guest: r.guest === 1, charId: r.char_id, charName: r.char_name,
      joinedAt: r.joined_at, leftAt: r.left_at, ip: r.ip, gpu: r.gpu, avgRtt: r.avg_rtt, avgFps: r.avg_fps, online: false,
    }));
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
      + Number(this.db.prepare('DELETE FROM online_samples WHERE at < ?').run(now - days.samples * day).changes);
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
