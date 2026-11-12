// npm run stop-server [-- --restart] [--seconds N]: stops the running server gracefully — players get the
// 10-second warning, everyone is saved, then the server exits — and waits until it has exited.
// With --restart, npm run online starts it again on the same build (no rebuild).
// Works on Windows too, where killing the npm task would stop node without any warning or save.
import { readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlFilePath, STOP_PATH, TOKEN_HEADER, type ControlFile } from './control';
import { SHUTDOWN_SECONDS } from '../src/shared/net/protocol';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 2567);
const DB_FILE = process.env.DB_FILE ?? join(ROOT, 'server', 'data', 'multiverse.db');
const RESTART = process.argv.includes('--restart');
/** --seconds N (or --seconds=N): a longer countdown, e.g. 120 to warn players two minutes ahead. */
const secArg = process.argv.findIndex((a) => a === '--seconds' || a.startsWith('--seconds='));
const SECONDS = secArg < 0 ? undefined : (process.argv[secArg].split('=')[1] ?? process.argv[secArg + 1]);
const FILE = controlFilePath(DB_FILE, PORT);

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

let ctl: ControlFile;
try {
  ctl = JSON.parse(readFileSync(FILE, 'utf8')) as ControlFile;
} catch {
  console.log(`ไม่พบ server ที่เปิดอยู่ (port ${PORT}) — ไม่มีอะไรต้องปิด`);
  process.exit(0);
}
if (!alive(ctl.pid)) {
  rmSync(FILE, { force: true });
  console.log(`server (port ${PORT}) ไม่ได้เปิดอยู่แล้ว`);
  process.exit(0);
}

let res: Response;
try {
  res = await fetch(`http://127.0.0.1:${PORT}${STOP_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [TOKEN_HEADER]: ctl.token },
    body: JSON.stringify({ mode: RESTART ? 'restart' : 'shutdown', seconds: SECONDS }),
  });
} catch {
  console.error(`ติดต่อ server (port ${PORT}, pid ${ctl.pid}) ไม่ได้ — ถ้าค้างจริงให้ปิดหน้าต่างของมันเอง`);
  process.exit(1);
}
const data = (await res.json().catch(() => ({}))) as { seconds?: number; error?: string; note?: string };
if (!res.ok) {
  console.error(`server ไม่ยอมปิด: ${data.error ?? res.status}`);
  process.exit(1);
}
const secs = data.seconds ?? SHUTDOWN_SECONDS;
console.log(data.note ?? `แจ้งผู้เล่นแล้ว — server จะ${RESTART ? 'รีสตาร์ท' : 'ปิด'}ใน ${secs} วินาที (เซฟทุกคนก่อนปิด)`);

// Wait for that process to end (a restart starts a new one with another pid).
const until = Date.now() + (secs + 30) * 1000;
let polls = 0;
while (alive(ctl.pid)) {
  // Every second: still counting down? (it can be cancelled from the server window or the admin page)
  if (++polls % 4 === 0) {
    const st = await fetch(`http://127.0.0.1:${PORT}${STOP_PATH}`, { headers: { [TOKEN_HEADER]: ctl.token } })
      .then((r) => (r.ok ? (r.json() as Promise<{ mode: string | null }>) : null))
      .catch(() => null);
    if (st && st.mode === null) {
      console.log('ยกเลิกการปิดแล้ว — server ยังเปิดอยู่');
      process.exit(1);
    }
  }
  if (Date.now() > until) {
    console.error(`server (pid ${ctl.pid}) ยังไม่ปิดหลังรอ ${secs + 30} วินาที`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 250));
}
console.log(RESTART ? 'server ปิดแล้ว — npm run online กำลังเปิดใหม่' : 'server ปิดแล้ว');
