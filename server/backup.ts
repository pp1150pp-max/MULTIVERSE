// Database backups in server/data/backups/: a daily one (the last BACKUP_KEEP.daily kept), one when the
// owner presses "สำรองตอนนี้", and one before every account/character delete. Made with SQLite's
// VACUUM INTO, which writes a consistent copy while the server keeps running.
//
// To restore one: stop the server (npm run stop-server), copy the backup over the database file
// (e.g. server/data/multiverse.db; delete multiverse.db-wal and multiverse.db-shm next to it first),
// then start the server again.
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import type { Db } from './db';
import type { BackupRow } from '../src/shared/admin';

export type BackupKind = 'daily' | 'manual' | 'before-delete' | 'before-item-mult';
/** How many of each kind are kept; older ones are deleted when a new one is made. */
export const BACKUP_KEEP: Record<BackupKind, number> = { daily: 7, manual: 10, 'before-delete': 20, 'before-item-mult': 10 };
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_MS = 60 * 60 * 1000;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`;
}

export class Backups {
  readonly dir: string;
  /** Backups of this database start with its name (dev.db and multiverse.db can share the folder). */
  private readonly prefix: string;

  constructor(private readonly db: Db, dbFile: string) {
    this.dir = join(dirname(dbFile), 'backups');
    this.prefix = basename(dbFile, extname(dbFile));
  }

  make(kind: BackupKind): BackupRow {
    mkdirSync(this.dir, { recursive: true });
    const name = `${this.prefix}-${stamp(new Date())}-${kind}.db`;
    this.db.backupTo(join(this.dir, name));
    console.log(`[backup] ${kind}: ${name}`);
    this.rotate(kind);
    return this.list().find((b) => b.name === name)!;
  }

  /** This database's backups, newest first. */
  list(): BackupRow[] {
    let names: string[];
    try {
      names = readdirSync(this.dir);
    } catch {
      return [];
    }
    const esc = this.prefix.replace(/[.*+?^$(){}|[\]\\]/g, (c) => `\\${c}`);
    const re = new RegExp(`^${esc}-\\d{8}-\\d{6}-\\d{3}-([a-z-]+)\\.db$`);
    const rows: BackupRow[] = [];
    for (const name of names) {
      const m = re.exec(name);
      if (!m) continue;
      try {
        const st = statSync(join(this.dir, name));
        rows.push({ name, size: st.size, at: st.mtimeMs, kind: m[1] });
      } catch {
        // deleted meanwhile
      }
    }
    return rows.sort((a, b) => b.name.localeCompare(a.name));
  }

  private rotate(kind: BackupKind): void {
    for (const old of this.list().filter((b) => b.kind === kind).slice(BACKUP_KEEP[kind])) {
      rmSync(join(this.dir, old.name), { force: true });
    }
  }

  /** Makes a daily backup now if the newest is a day old (or there is none), then checks every hour. */
  startDaily(): void {
    const check = () => {
      const last = this.list().find((b) => b.kind === 'daily');
      if (last && Date.now() - last.at < DAY_MS) return;
      try {
        this.make('daily');
      } catch (e) {
        console.error('[backup] daily backup failed', e);
      }
    };
    check();
    setInterval(check, CHECK_MS).unref();
  }
}
