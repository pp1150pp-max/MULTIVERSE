// npm run logs [-- --lines N] [--follow]: the end of the newest server/data/logs/online-*.log
// (npm run online / always-on). --follow keeps printing new lines (Ctrl+C to quit).
import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { latestLog, logDir } from './logfile';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = logDir(ROOT);
const li = process.argv.indexOf('--lines');
const LINES = li >= 0 ? Math.max(1, Number(process.argv[li + 1]) || 60) : 60;
const FOLLOW = process.argv.includes('--follow') || process.argv.includes('-f');

let file = latestLog(dir);
if (!file) {
  console.log(`ยังไม่มี log ใน ${dir}`);
  if (!FOLLOW) process.exit(0);
} else {
  console.log(`== ${file}`);
  const lines = readFileSync(file, 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  console.log(lines.slice(-LINES).join('\n'));
}
if (!FOLLOW) process.exit(0);

let pos = file ? statSync(file).size : 0;
setInterval(() => {
  const newest = latestLog(dir);
  if (newest && newest !== file) {
    file = newest;
    pos = 0;
    console.log(`== ${file}`);
  }
  if (!file) return;
  const size = statSync(file).size;
  if (size <= pos) return;
  const fd = openSync(file, 'r');
  const buf = Buffer.alloc(size - pos);
  readSync(fd, buf, 0, buf.length, pos);
  closeSync(fd);
  pos = size;
  process.stdout.write(buf.toString('utf8'));
}, 1000);
