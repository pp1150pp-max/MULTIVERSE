// Bug reports / feedback (docs/systems/reports.md). Part 1 drives Reports on a throwaway database with a fake
// clock (cooldown, daily caps, duplicates, bad input, guests, bans). Part 2 starts a real game server on a free
// port with another throwaway database: the WebSocket action, the live notice and the admin routes.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db } from '../server/db';
import { Reports, type ReportSender } from '../server/reports';
import { REPORT_COOLDOWN_MS, REPORT_DAY_MS, REPORT_HOUR_MS, REPORT_MAX, REPORT_PER_DAY, REPORT_PER_HOUR_ALL, REPORT_PER_IP_DAY } from '../src/shared/reports';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-reports-test-'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- part 1: the rules
{
  const db = new Db(join(dir, 'rules.db'));
  let t = 1_000_000_000_000;
  const reports = new Reports(db, () => t);
  const who = (accountId: number, ip = '1.1.1.1', over: Partial<ReportSender> = {}): ReportSender => ({
    accountId, guest: false, username: `user${accountId}`, charName: `Char${accountId}`, ip, zone: 'nexus_city', channel: null,
    x: 1.234, z: -5.678, level: 12, rtt: 40.4, fps: 59.6, ...over,
  });
  const text = (n: number) => `ข้อความทดสอบรายงานหมายเลข ${n}`;

  const first = reports.submit(who(1), 'bug', text(1));
  ok(first.ok && first.stored?.topic === 'bug' && first.cooldownMs === REPORT_COOLDOWN_MS, 'a good report is stored');
  const row = db.listReports(10, undefined, undefined, undefined)[0];
  ok(row.zone === 'nexus_city' && row.x === 1.2 && row.z === -5.7 && row.level === 12 && row.rtt === 40 && row.fps === 60 && row.status === 'new',
    'the server attached the context');

  const soon = reports.submit(who(1), 'bug', text(2));
  ok(!soon.ok && soon.cooldownMs !== undefined && soon.cooldownMs > 0, 'a second report within 60 s is refused with the time left');
  t += REPORT_COOLDOWN_MS - 1;
  ok(!reports.submit(who(1), 'bug', text(2)).ok, 'still refused 1 ms before the cooldown ends');
  t += 1;
  ok(reports.submit(who(1), 'bug', text(2)).ok, 'allowed again when the cooldown ends');

  // Duplicates (same account, any spacing / case) within 24 h.
  t += REPORT_COOLDOWN_MS;
  const dup = reports.submit(who(1), 'idea', `  ${text(1).toUpperCase()}  `);
  ok(!dup.ok && dup.msg.includes('ส่งข้อความนี้ไปแล้ว'), 'the same text again (spaces / case changed) is refused');
  ok(reports.submit(who(2), 'bug', text(1)).ok, 'another account may send that text');

  // Daily cap: account 1 has sent 2; send up to the cap.
  for (let n = 3; n <= REPORT_PER_DAY; n++) {
    t += REPORT_COOLDOWN_MS;
    ok(reports.submit(who(1), 'other', text(n)).ok, `report ${n} of the day is accepted`);
  }
  t += REPORT_COOLDOWN_MS;
  const capped = reports.submit(who(1), 'other', text(99));
  ok(!capped.ok && capped.msg.includes(String(REPORT_PER_DAY)), `report ${REPORT_PER_DAY + 1} within 24 h is refused`);
  t += REPORT_DAY_MS;
  ok(reports.submit(who(1), 'other', text(99)).ok, 'the cap lifts after 24 h');
  ok(reports.submit(who(1), 'other', text(1)).ok === false, 'a cooldown still applies right after');

  // Per-IP cap: many accounts behind one address.
  t += REPORT_DAY_MS;
  let accepted = 0;
  for (let a = 100; a < 100 + REPORT_PER_IP_DAY + 3; a++) if (reports.submit(who(a, '9.9.9.9'), 'bug', text(a)).ok) accepted++;
  ok(accepted === REPORT_PER_IP_DAY, `one IP gets at most ${REPORT_PER_IP_DAY} reports a day (got ${accepted})`);
  ok(reports.submit(who(500, '8.8.8.8'), 'bug', text(500)).ok, 'another IP is not affected');

  // Global hourly cap.
  t += REPORT_DAY_MS;
  accepted = 0;
  for (let a = 1000; a < 1000 + REPORT_PER_HOUR_ALL + 5; a++) if (reports.submit(who(a, `10.0.${a >> 8}.${a & 255}`), 'bug', text(a)).ok) accepted++;
  ok(accepted === REPORT_PER_HOUR_ALL, `the whole server takes at most ${REPORT_PER_HOUR_ALL} reports an hour (got ${accepted})`);
  t += REPORT_HOUR_MS + 1;
  ok(reports.submit(who(5000), 'bug', text(5000)).ok, 'the hourly cap lifts after an hour');

  // Guests, bans, bad input.
  t += REPORT_DAY_MS;
  ok(!reports.submit(who(7, '2.2.2.2', { guest: true }), 'bug', text(7)).ok, 'a guest cannot send');
  db.setReportBan(8, true, 'owner1');
  const banned = reports.submit(who(8, '2.2.2.3'), 'bug', text(8));
  ok(!banned.ok && banned.msg.includes('ห้าม'), 'a banned account is refused');
  db.setReportBan(8, false, 'owner1');
  ok(reports.submit(who(8, '2.2.2.3'), 'bug', text(8)).ok, 'an unbanned account can send again');
  ok(!reports.submit(who(9, '2.2.2.4'), 'hack', text(9)).ok, 'an unknown topic is refused');
  ok(!reports.submit(who(9, '2.2.2.4'), undefined, text(9)).ok && !reports.submit(who(9, '2.2.2.4'), { x: 1 }, text(9)).ok, 'a topic that is not a string is refused');
  ok(!reports.submit(who(9, '2.2.2.4'), 'bug', 'สั้นไป').ok, 'text under 10 characters is refused');
  ok(!reports.submit(who(9, '2.2.2.4'), 'bug', '   \u0000\u0007 ​      ').ok, 'only control characters / spaces is refused');
  ok(!reports.submit(who(9, '2.2.2.4'), 'bug', 'ก'.repeat(REPORT_MAX + 1)).ok, 'text over 500 characters is refused');
  ok(!reports.submit(who(9, '2.2.2.4'), 'bug', 12345 as unknown).ok && !reports.submit(who(9, '2.2.2.4'), 'bug', null).ok, 'text that is not a string is refused');
  ok(reports.submit(who(9, '2.2.2.4'), 'bug', 'ก'.repeat(REPORT_MAX)).ok, 'exactly 500 characters is accepted');
  const dirty = reports.submit(who(10, '2.2.2.5'), 'bug', 'ข้อความ\u0000ที่\u0007มี​อักขระ\r\nแปลก ๆ');
  const stored = db.listReports(1, undefined, undefined, undefined)[0];
  ok(dirty.ok && stored.text === 'ข้อความที่มีอักขระ\nแปลก ๆ', 'control characters are stripped before saving');
  ok(db.listReports(100, undefined, 'player', undefined).every((r) => r.topic === 'player'), 'the list can be filtered by topic');
  db.close();
}

// ---------------------------------------------------------------- part 2: the real server
const DB_FILE = join(dir, 'test.db');
function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once('error', rej);
    s.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => res(port));
    });
  });
}
const PORT = await freePort();
const BASE = `http://localhost:${PORT}`;
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_FILE, STATS_SAMPLE_MS: '1000' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

async function stopServer(): Promise<void> {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  rmSync(dir, { recursive: true, force: true });
}

async function api(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
}

function joinWorld(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'snap' || m.t === 'kick') {
        clearTimeout(t);
        res();
      }
    };
  });
  let req = 0;
  const report = async (topic: unknown, text: unknown): Promise<any> => {
    const id = ++req + 7000;
    ws.send(JSON.stringify({ t: 'act', a: 'reportSend', req: id, topic, text }));
    for (let i = 0; i < 100; i++) {
      const m = msgs.find((x) => x.t === 'report' && x.req === id);
      if (m) return m;
      await sleep(50);
    }
    throw new Error('report request timed out');
  };
  const waitFor = async (pred: (m: any) => boolean): Promise<any> => {
    for (let i = 0; i < 60; i++) {
      const m = msgs.find(pred);
      if (m) return m;
      await sleep(100);
    }
    return undefined;
  };
  return { ws, msgs, ready, report, waitFor };
}

async function run(): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await fetch(`${BASE}/api/me`);
      break;
    } catch {
      if (i > 100) throw new Error('test server did not start');
      await sleep(100);
    }
  }
  const account = async (username: string) => (await api('POST', '/register', { username, password: 'secret123' })).data.token as string;
  const ownerTok = await account('owner1');
  const gmTok = await account('gm1');
  const plainTok = await account('plain1');
  const cli = (user: string, role: string) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', user, role], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  ok(cli('owner1', 'owner').status === 0 && cli('gm1', 'gm').status === 0, 'roles set');

  const ownerChar = await api('POST', '/characters', { name: 'Boss', classId: 'mage' }, ownerTok);
  const gmChar = await api('POST', '/characters', { name: 'Helper', classId: 'mage' }, gmTok);
  const plainChar = await api('POST', '/characters', { name: 'Player', classId: 'mage' }, plainTok);
  const owner = joinWorld(ownerTok, ownerChar.data.id);
  const gm = joinWorld(gmTok, gmChar.data.id);
  const plain = joinWorld(plainTok, plainChar.data.id);
  await Promise.all([owner.ready, gm.ready, plain.ready]);

  // A guest in the world.
  const g = await api('POST', '/guest', { name: 'GuestRep', classId: 'mage' });
  const guest = joinWorld(g.data.token, g.data.character.id);
  await guest.ready;
  const gr = await guest.report('bug', 'ข้อความจาก Guest ที่ต้องถูกปฏิเสธ');
  ok(gr.ok === false && gr.msg.includes('Guest'), 'a guest over the WebSocket is refused');

  const bad = await plain.report('nope', 'ข้อความทดสอบหัวข้อที่ไม่มีจริง');
  ok(bad.ok === false, 'a bad topic over the WebSocket is refused');
  const sent = await plain.report('player', 'ผู้เล่นชื่อ Cheater ใช้โปรโกงในแมพนี้');
  ok(sent.ok === true && sent.cooldownMs === REPORT_COOLDOWN_MS, 'a player report is accepted over the WebSocket');
  const again = await plain.report('bug', 'รายงานที่สองที่ส่งเร็วเกินไปหลังจากอันแรก');
  ok(again.ok === false && again.cooldownMs > 0, 'the cooldown applies over the WebSocket');

  const noticeOwner = await owner.waitFor((m) => m.t === 'chat' && String(m.text).includes('รายงานผู้เล่น'));
  const noticeGm = await gm.waitFor((m) => m.t === 'chat' && String(m.text).includes('รายงานผู้เล่น'));
  ok(noticeOwner && noticeGm, 'a "report a player" report notifies the owner and the GM online');
  ok(!plain.msgs.some((m) => m.t === 'chat' && String(m.text).includes('รายงานผู้เล่น #')), 'normal players get no notice');

  // Admin routes.
  ok((await api('GET', '/admin/reports', undefined, plainTok)).status === 403, 'a normal player cannot read reports');
  ok((await api('GET', '/admin/reports')).status === 401, 'not logged in → 401');
  const list = await api('GET', '/admin/reports', undefined, gmTok);
  ok(list.status === 200 && list.data.length === 1 && list.data[0].username === 'plain1' && list.data[0].charName === 'Player', 'a GM reads the list');
  ok((await api('GET', '/admin/reports?topic=bug', undefined, ownerTok)).data.length === 0, 'the topic filter works');
  ok((await api('GET', '/admin/reports?topic=player&status=new', undefined, ownerTok)).data.length === 1, 'topic + status filter match');
  ok((await api('GET', '/admin/reports?topic=zzz', undefined, ownerTok)).status === 400, 'a bad filter is a 400');
  const id = list.data[0].id;
  ok((await api('POST', '/admin/reports/status', { id, status: 'seen' }, gmTok)).status === 200, 'a GM sets the status');
  ok((await api('POST', '/admin/reports/status', { id, status: 'weird' }, gmTok)).status === 400, 'a bad status is a 400');
  ok((await api('POST', '/admin/reports/status', { id: 9999, status: 'done' }, gmTok)).status === 404, 'an unknown report is a 404');
  ok((await api('GET', '/admin/reports?status=seen', undefined, ownerTok)).data.length === 1, 'the status change was saved');

  ok((await api('POST', '/admin/reports/ban', { accountId: list.data[0].accountId, banned: true }, gmTok)).status === 403, 'a GM cannot ban from reporting');
  ok((await api('GET', '/admin/me', undefined, gmTok)).data.features.includes('reports'), 'the GM has the reports feature');
  ok(!(await api('GET', '/admin/me', undefined, gmTok)).data.features.includes('reportBan'), 'the GM has no reportBan feature');
  ok((await api('POST', '/admin/reports/ban', { accountId: list.data[0].accountId, banned: 'yes' }, ownerTok)).status === 400, 'a bad ban body is a 400');
  ok((await api('POST', '/admin/reports/ban', { accountId: list.data[0].accountId, banned: true }, ownerTok)).status === 200, 'the owner bans the account from reporting');
  ok((await api('GET', '/admin/reports', undefined, ownerTok)).data[0].banned === true, 'the list shows the ban');
  const refused = await plain.report('idea', 'ข้อเสนอแนะใหม่ที่ควรถูกปฏิเสธเพราะโดนห้าม');
  ok(refused.ok === false && refused.msg.includes('ห้าม'), 'a banned account is refused over the WebSocket');
  ok((await api('POST', '/admin/reports/ban', { accountId: list.data[0].accountId, banned: false }, ownerTok)).status === 200, 'the owner lifts the ban');

  const audit = await api('GET', '/admin/audit', undefined, ownerTok);
  const actions = (audit.data as { action: string }[]).map((r) => r.action);
  ok(actions.includes('report-status') && actions.includes('report-ban') && actions.includes('report-unban'), 'status and ban changes are in the audit log');

  for (const c of [owner, gm, plain, guest]) c.ws.close();
}

try {
  await run();
} catch (e) {
  console.error(e);
  ok(false, `test crashed: ${(e as Error).message}`);
}
await stopServer();
finish('reports');
