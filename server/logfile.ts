// Log files for npm run online / always-on: server/data/logs/online-YYYY-MM-DD.log, one per day, each
// line stamped with the time. Files older than LOG_KEEP_DAYS are deleted. Read them with npm run logs.
import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const LOG_KEEP_DAYS = 30;
const NAME_RE = /^online-(\d{4})-(\d{2})-(\d{2})\.log$/;

const pad = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function logDir(root: string): string {
  return join(root, 'server', 'data', 'logs');
}

/** The newest log file, if any. */
export function latestLog(dir: string): string | null {
  try {
    const names = readdirSync(dir).filter((n) => NAME_RE.test(n)).sort();
    return names.length ? join(dir, names[names.length - 1]) : null;
  } catch {
    return null;
  }
}

export class LogFile {
  private today = '';
  private partial = '';

  constructor(private readonly dir: string, private readonly echo: boolean) {
    mkdirSync(dir, { recursive: true });
  }

  /** Text as it comes out of a process (may hold several lines, or half of one). */
  write(chunk: string): void {
    const text = this.partial + chunk.replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    this.partial = lines.pop() ?? '';
    for (const l of lines) this.line(l);
  }

  line(text: string): void {
    const now = new Date();
    const d = day(now);
    if (d !== this.today) {
      this.today = d;
      this.prune(now);
    }
    if (this.echo) process.stdout.write(`${text}\n`);
    try {
      appendFileSync(join(this.dir, `online-${d}.log`), `${time(now)} ${text}\n`);
    } catch {
      /* disk full or locked: keep running, the server matters more than its log */
    }
  }

  private prune(now: Date): void {
    const cutoff = now.getTime() - LOG_KEEP_DAYS * 24 * 60 * 60 * 1000;
    try {
      for (const n of readdirSync(this.dir)) {
        const m = NAME_RE.exec(n);
        if (m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() < cutoff) rmSync(join(this.dir, n), { force: true });
      }
    } catch {
      /* ignore */
    }
  }
}
