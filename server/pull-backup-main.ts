// npm run pull-backup [-- --keep N]: run on the home PC. Copies the newest finished DB backup from the VPS
// (server/data/backups/ there, made by the server every 6 hours) to this PC, so a copy survives if the VPS is
// lost. Never copies the live multiverse.db (it is being written). Checks the copy (SHA-256 against the
// VPS, then SQLite quick_check) and keeps the newest N copies (default 30).
//
// SSH: an alias in ~/.ssh/config (the VPS address is not written in this public repo):
//   Host multiverse-vps
//     HostName <VPS IP>
//     User multiverse
// env: VPS_SSH (default multiverse-vps), VPS_DIR (default MULTIVERSE, from the user's home),
//      BACKUP_PULL_DIR (default <home>/MULTIVERSE-backups, outside the project so git never sees it).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const HOST = process.env.VPS_SSH ?? 'multiverse-vps';
const REMOTE_DIR = process.env.VPS_DIR ?? 'MULTIVERSE';
const LOCAL_DIR = process.env.BACKUP_PULL_DIR ?? join(homedir(), 'MULTIVERSE-backups');
const ki = process.argv.indexOf('--keep');
const KEEP = ki >= 0 ? Math.max(1, Number(process.argv[ki + 1]) || 30) : 30;
/** Live DB backups only (multiverse-<stamp>-<kind>.db), never dev.db's. */
const NAME_RE = /^multiverse-\d{8}-\d{6}-\d{3}-[a-z-]+\.db$/;
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15'];

const ssh = (cmd: string): string => execFileSync('ssh', [...SSH_OPTS, HOST, cmd], { encoding: 'utf8' }).trim();

let name: string;
try {
  // Newest backup that is at least a minute old (VACUUM INTO writes the file in place: a younger one may
  // still be being written).
  name = ssh(`cd ${REMOTE_DIR}/server/data/backups && find . -maxdepth 1 -name 'multiverse-*.db' -mmin +1 -printf '%T@ %f\\n' | sort -nr | head -1 | cut -d' ' -f2`);
} catch (e) {
  console.error(`ติดต่อ VPS (${HOST}) ไม่ได้: ${(e as Error).message.split('\n')[0]}`);
  console.error('  เช็ค ~/.ssh/config (Host multiverse-vps) และลอง: ssh -o BatchMode=yes multiverse-vps true');
  process.exit(1);
}
if (!NAME_RE.test(name)) {
  console.error(`ไม่พบไฟล์สำรองบน VPS (ได้ "${name}") — server สำรองเองทุก 6 ชม. หรือกดสำรองใน /admin`);
  process.exit(1);
}

mkdirSync(LOCAL_DIR, { recursive: true });
const dest = join(LOCAL_DIR, name);
if (existsSync(dest)) {
  console.log(`มีแล้ว: ${dest} (ยังไม่มีไฟล์สำรองใหม่บน VPS)`);
} else {
  const tmp = `${dest}.part`;
  rmSync(tmp, { force: true });
  console.log(`ดึง ${name} จาก ${HOST} …`);
  execFileSync('scp', [...SSH_OPTS, '-q', `${HOST}:${REMOTE_DIR}/server/data/backups/${name}`, tmp], { stdio: 'inherit' });
  const remoteSum = ssh(`sha256sum ${REMOTE_DIR}/server/data/backups/${name}`).split(/\s+/)[0];
  const localSum = createHash('sha256').update(readFileSync(tmp)).digest('hex');
  if (remoteSum !== localSum) {
    rmSync(tmp, { force: true });
    console.error('⚠ ไฟล์ที่ได้ไม่ตรงกับบน VPS (SHA-256 ต่างกัน) — ลบทิ้งแล้ว ลองใหม่');
    process.exit(1);
  }
  const db = new DatabaseSync(tmp, { readOnly: true });
  const check = (db.prepare('PRAGMA quick_check').get() as { quick_check: string }).quick_check;
  db.close();
  if (check !== 'ok') {
    rmSync(tmp, { force: true });
    console.error(`⚠ ไฟล์สำรองเสีย (quick_check: ${check}) — ลบทิ้งแล้ว`);
    process.exit(1);
  }
  renameSync(tmp, dest);
  console.log(`เก็บแล้ว: ${dest} (SHA-256 ตรง, quick_check ok)`);
}

const old = readdirSync(LOCAL_DIR).filter((n) => NAME_RE.test(n)).sort().reverse().slice(KEEP);
for (const n of old) rmSync(join(LOCAL_DIR, n), { force: true });
if (old.length) console.log(`ลบสำเนาเก่า ${old.length} ไฟล์ (เก็บล่าสุด ${KEEP})`);
