// Posts a "มีอะไรใหม่" note from the command line (docs/systems/news.md). The /ship skill runs it on the VPS after a deploy:
//
//   npm run add-news -- --json -            { "title": "...", "lines": ["...", "..."], "key": "abc1234" } read from stdin
//   npm run add-news -- --title "..." --items-file notes.txt [--key abc1234]      one line per row; `-` = stdin
//
// Why stdin: nothing may be written inside ~/MULTIVERSE on the VPS (tools/deploy.sh refuses a dirty tree), and Thai text
// survives a pipe far better than ssh quoting. `--key` makes a repeat harmless (a note with that key exists = nothing added).
// Same checks as the /admin tab (cleanNews). Writes the same database as `npm run server` (server/data/multiverse.db, or DB_FILE);
// safe while the server runs (WAL + busy timeout), which notices the change within a few seconds and tells the players online.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db } from './db';
import { cleanNews } from '../src/shared/news';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DB_FILE = process.env.DB_FILE ?? join(ROOT, 'server', 'data', 'multiverse.db');

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const read = (path: string): string => readFileSync(path === '-' ? 0 : path, 'utf8');

let title: unknown = opt('title');
let lines: unknown;
let key: unknown = opt('key');
const jsonFile = opt('json');
const itemsFile = opt('items-file');
if (jsonFile) {
  try {
    const o = JSON.parse(read(jsonFile)) as { title?: unknown; lines?: unknown; items?: unknown; key?: unknown };
    title = o.title;
    lines = o.lines ?? o.items;
    key = o.key ?? key;
  } catch (e) {
    fail(`อ่าน JSON ไม่ได้: ${(e as Error).message}`);
  }
} else if (itemsFile) {
  lines = read(itemsFile).split(/\r?\n/);
} else {
  fail('ใช้แบบนี้: npm run add-news -- --json -  (JSON { title, lines[], key? } ทาง stdin)\n   หรือ: npm run add-news -- --title "หัวข้อ" --items-file <ไฟล์|-> [--key รหัส]');
}
if (key !== undefined && (typeof key !== 'string' || !/^[\w.-]{1,64}$/.test(key))) fail('--key ใช้ได้เฉพาะ a-z 0-9 _ . - ไม่เกิน 64 ตัว');

const c = cleanNews(title, lines);
if ('error' in c) fail(`ลงประกาศไม่ได้: ${c.error}`);

const db = new Db(DB_FILE);
try {
  const id = db.newsAdd(c.title, c.lines, 'command line', (key as string | undefined) ?? null);
  if (id === null) {
    console.log(`ข้าม: มีประกาศรหัส ${String(key)} อยู่แล้ว (ไม่ลงซ้ำ)  (${DB_FILE})`);
  } else {
    db.audit(null, 'command line', 'news-add', `#${id}`, `${c.title} · ${c.lines.length} บรรทัด${key ? ` · ${String(key)}` : ''}`);
    console.log(`ลงประกาศ #${id} แล้ว: ${c.title} (${c.lines.length} บรรทัด)  (${DB_FILE})`);
  }
} finally {
  db.close();
}
