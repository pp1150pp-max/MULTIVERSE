// npm run autostart [-- -Install | -Uninstall | -Start | -Status]: starts the live server + friends' link
// by itself when the machine boots, and starts it again when it dies.
//   Windows: Task Scheduler task 'MULTIVERSE server' (tools/autostart.ps1, unchanged; this only passes the
//            arguments on).
//   Linux (the VPS): systemd unit 'multiverse' (tools/multiverse.service).
//     -Install    write + enable the unit (root: sudo node tools/autostart.mjs -Install), not started
//     -Uninstall  disable + remove it (refused while it runs: npm run stop-server first)
//     -Start      start it now (sudo, allowed without a password by tools/vps-setup.sh)
//     (none)      status
// Never stop it with kill or systemctl kill: always npm run stop-server (countdown + save).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const has = (name) => args.some((a) => a.toLowerCase() === `-${name}` || a.toLowerCase() === `--${name}`);

if (process.platform === 'win32') {
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(ROOT, 'tools', 'autostart.ps1'), ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const UNIT = 'multiverse';
const UNIT_FILE = `/etc/systemd/system/${UNIT}.service`;
const isRoot = process.getuid?.() === 0;
const run = (cmd, a, opts = {}) => spawnSync(cmd, a, { stdio: 'inherit', ...opts }).status ?? 1;
/** systemctl as root: directly when root, else through sudo without a password prompt (sudoers from vps-setup.sh). */
const systemctl = (...a) => (isRoot ? run('systemctl', a) : run('sudo', ['-n', 'systemctl', ...a]));
const active = () => spawnSync('systemctl', ['is-active', '--quiet', UNIT]).status === 0;

if (has('install')) {
  if (!isRoot) {
    console.error('ต้องรันด้วย root: sudo node tools/autostart.mjs -Install');
    process.exit(1);
  }
  if (ROOT.includes('/.claude/worktrees/')) {
    console.error(`ไม่ลง: ${ROOT} เป็น worktree (ถูกลบทีหลัง) ให้รันจากโฟลเดอร์หลักที่ server จริงรัน`);
    process.exit(1);
  }
  // The service runs as whoever owns the checkout (multiverse on the VPS), never as root.
  const uid = statSync(ROOT).uid;
  const user = execFileSync('id', ['-nu', String(uid)], { encoding: 'utf8' }).trim();
  if (uid === 0) {
    console.error(`ไม่ลง: ${ROOT} เป็นของ root — server ต้องไม่รันด้วย root (chown ให้ user multiverse ก่อน)`);
    process.exit(1);
  }
  const node = process.execPath;
  const text = readFileSync(join(ROOT, 'tools', 'multiverse.service'), 'utf8')
    .replaceAll('@ROOT@', ROOT)
    .replaceAll('@USER@', user)
    .replaceAll('@NODEDIR@', dirname(node))
    .replaceAll('@NODE@', node);
  writeFileSync(UNIT_FILE, text);
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) console.log(`⚠ ${ROOT}/dist ยังไม่มี build — รัน npx vite build (ด้วย user ${user}) ก่อนเปิด`);
  if (run('systemctl', ['daemon-reload']) || run('systemctl', ['enable', UNIT])) process.exit(1);
  console.log(`\nลงแล้ว: '${UNIT}' เปิดเองตอนบูต รันด้วย user ${user}`);
  console.log(`  โฟลเดอร์: ${ROOT}`);
  console.log(`  node:     ${node}`);
  console.log('  ยังไม่ได้เปิดตอนนี้ — เปิดด้วย: npm run autostart -- -Start');
  process.exit(0);
}

if (has('uninstall')) {
  if (!isRoot) {
    console.error('ต้องรันด้วย root: sudo node tools/autostart.mjs -Uninstall');
    process.exit(1);
  }
  if (active()) {
    console.error(`'${UNIT}' ยังเปิดอยู่ — ปิดด้วย npm run stop-server (ด้วย user ที่รัน server) ก่อน แล้วค่อยลบ`);
    process.exit(1);
  }
  run('systemctl', ['disable', UNIT]);
  rmSync(UNIT_FILE, { force: true });
  run('systemctl', ['daemon-reload']);
  console.log(`ลบ '${UNIT}' แล้ว (ไม่เปิดเองตอนบูตอีก)`);
  process.exit(0);
}

if (has('start')) {
  if (!existsSync(UNIT_FILE)) {
    console.error(`ยังไม่ได้ลง '${UNIT}' — sudo node tools/autostart.mjs -Install`);
    process.exit(1);
  }
  if (active()) {
    console.log(`'${UNIT}' เปิดอยู่แล้ว (ตัวคุมเปิด server ใหม่เองหลังรีสตาร์ท) — ดู npm run logs`);
    process.exit(0);
  }
  const code = systemctl('start', UNIT);
  if (code) console.error('เปิดไม่ได้ — ถ้าขึ้นว่าต้องใช้รหัสผ่าน: ลง sudoers ใน tools/vps-setup.sh หรือรันเองด้วย root');
  else console.log(`เปิด '${UNIT}' แล้ว — ดู npm run logs จนขึ้น "พร้อมแล้ว"`);
  process.exit(code);
}

// Status (default, also -Status)
if (!existsSync(UNIT_FILE)) {
  console.log(`ยังไม่ได้ลง '${UNIT}' (sudo node tools/autostart.mjs -Install)`);
  process.exit(0);
}
const enabled = spawnSync('systemctl', ['is-enabled', UNIT], { encoding: 'utf8' }).stdout.trim();
console.log(`'${UNIT}': เปิดเองตอนบูต = ${enabled} · ตอนนี้ = ${active() ? 'เปิดอยู่' : 'ไม่ได้เปิด'}`);
run('systemctl', ['status', UNIT, '--no-pager', '--lines', '5']);
process.exit(0);
