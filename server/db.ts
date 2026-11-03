// SQLite storage for accounts, login sessions and online characters. One file on disk:
// back it up by copying server/data/multiverse.db while the server is stopped.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CharacterData } from '../src/shared/sim/Player';
import type { CharacterSummary } from '../src/shared/api';
import type { ClassId } from '../src/shared/types';

export interface AccountRow { id: number; username: string; pass_hash: string }
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
    `);
  }

  close(): void {
    this.db.close();
  }

  // ------------------------------------------------------------ accounts

  findAccount(username: string): AccountRow | undefined {
    return this.db.prepare('SELECT id, username, pass_hash FROM accounts WHERE username = ?').get(username) as AccountRow | undefined;
  }

  /** Returns the new account id, or null if the username is taken. */
  createAccount(username: string, passHash: string): number | null {
    if (this.findAccount(username)) return null;
    const r = this.db.prepare('INSERT INTO accounts (username, pass_hash, created_at) VALUES (?, ?, ?)').run(username, passHash, Date.now());
    return Number(r.lastInsertRowid);
  }

  // ------------------------------------------------------------ sessions

  createSession(token: string, accountId: number, expiresAt: number): void {
    this.db.prepare('INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)').run(token, accountId, expiresAt);
  }

  /** The account behind a login token, if the token exists and hasn't expired. */
  sessionAccount(token: string): { id: number; username: string } | undefined {
    return this.db.prepare(`
      SELECT a.id, a.username FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token = ? AND s.expires_at > ?`).get(token, Date.now()) as { id: number; username: string } | undefined;
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

  characterNameTaken(name: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM characters WHERE name = ?').get(name);
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
    return r ? (JSON.parse(r.data) as CharacterData) : undefined;
  }

  saveCharacter(id: number, data: CharacterData): void {
    this.db.prepare('UPDATE characters SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data), Date.now(), id);
  }

  /** Returns false when there is no such character on this account. */
  deleteCharacter(accountId: number, id: number): boolean {
    return this.db.prepare('DELETE FROM characters WHERE id = ? AND account_id = ?').run(id, accountId).changes > 0;
  }
}
