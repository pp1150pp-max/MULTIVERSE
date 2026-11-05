// Database tests for guests: an old database (before guests) still works, guests expire after a
// day offline, and a guest turns into a real account on sign-up. Uses a throwaway database file.
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db, GUEST_TTL_MS } from '../server/db';
import { newCharacterData } from '../src/shared/sim/Player';
import { finish, ok } from './check';

const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
const file = join(dir, 'old.db');

// ------------------------------------------------------------ a database made before guests existed

const old = new DatabaseSync(file);
old.exec(`
  CREATE TABLE accounts (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, pass_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE sessions (token TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
  CREATE TABLE characters (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, name TEXT NOT NULL UNIQUE COLLATE NOCASE, class_id TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
`);
old.prepare('INSERT INTO accounts (username, pass_hash, created_at) VALUES (?, ?, ?)').run('oldie', 'scrypt$aa$bb', 1);
old.prepare('INSERT INTO characters (account_id, name, class_id, data, created_at, updated_at) VALUES (1, ?, ?, ?, 1, 1)')
  .run('OldHero', 'sword', JSON.stringify(newCharacterData('OldHero', 'sword')));
old.prepare('INSERT INTO sessions VALUES (?, 1, ?)').run('tok-old', Date.now() + 1e9);
old.close();

const db = new Db(file);
ok(db.findAccount('oldie')?.id === 1, 'old database: account still found by login');
ok(db.sessionAccount('tok-old')?.guest === false, 'old database: login token works, not a guest');
ok(db.listCharacters(1).length === 1, 'old database: character still listed');
ok(db.deleteStaleGuests([], Date.now() + 365 * 86400e3) === 0 && db.findAccount('oldie'), 'cleanup never touches real accounts');

// ------------------------------------------------------------ expiry

const now = Date.now();
const g1 = db.createGuest('g1', newCharacterData('Guest1', 'mage'));
const g2 = db.createGuest('g2', newCharacterData('Guest2', 'gunslinger'));
const g3 = db.createGuest('g3', newCharacterData('Guest3', 'sword'));
db.createSession('tok-g1', g1.accountId, now + 1e9);
ok(db.sessionAccount('tok-g1')?.guest === true, 'guest token reports a guest');
ok(!db.findAccount('guest:g1'), 'a guest cannot be found by the login form');
ok(db.deleteStaleGuests([], now + GUEST_TTL_MS - 60_000) === 0, 'nobody deleted before 24 h');
db.touchOnline(g2.accountId, now + 10 * 3600e3); // g2 played again 10 h later
const removed = db.deleteStaleGuests([g3.accountId], now + GUEST_TTL_MS + 60_000);
ok(removed === 1, `after 24 h exactly one guest deleted (got ${removed})`);
ok(db.listCharacters(g1.accountId).length === 0 && !db.sessionAccount('tok-g1'), 'expired guest: character and token gone');
ok(!db.characterNameTaken('Guest1'), 'expired guest name is free again');
ok(db.listCharacters(g2.accountId).length === 1, 'guest online more recently is kept');
ok(db.listCharacters(g3.accountId).length === 1, 'guest online right now is kept even if stale');

// ------------------------------------------------------------ guest -> account

ok(!db.upgradeGuest(g2.accountId, 'oldie', 'x'), 'sign-up refuses a taken username');
ok(db.upgradeGuest(g2.accountId, 'newbie', 'scrypt$x$y'), 'guest becomes account newbie');
ok(db.findAccount('newbie')?.id === g2.accountId, 'newbie is a real account with the same id');
ok(db.listCharacters(g2.accountId)[0]?.name === 'Guest2', 'character moved along');
ok(db.deleteStaleGuests([], now + 999 * GUEST_TTL_MS) === 1 && db.findAccount('newbie'), 'upgraded account survives cleanup');
ok(!db.upgradeGuest(1, 'hijack', 'x'), 'a real account cannot be "upgraded"');

db.close();
rmSync(dir, { recursive: true, force: true });
finish('guest-db');
