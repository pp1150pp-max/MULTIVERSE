// Daily login (owner 2026-11-12): a monthly calendar per account, the day turns at 00:00 Thai time, the
// first time in the game each day mails that day's reward, a missed day is gone except for 3 free make-ups a
// month (any earlier day of the month), the owner can change each day's reward. Uses a throwaway database
// and a fake clock; nothing here touches server/data.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { Daily } from '../server/daily';
import { Mail } from '../server/mail';
import { cleanDailyOverrides, DAILY_DEFAULT, DAILY_MAKEUPS, daysInMonth, thaiDate } from '../src/shared/daily';
import { finish, ok } from './check';

// ---- Thai calendar days
const at = (iso: string) => Date.parse(iso);
ok(thaiDate(at('2026-11-11T16:59:59Z')).key === '2026-11-11', '23:59:59 Thai time is still the 11th');
ok(thaiDate(at('2026-11-11T17:00:00Z')).key === '2026-11-12', '00:00 Thai time is the 12th');
ok(thaiDate(at('2026-12-31T17:30:00Z')).key === '2027-01-01', 'new year in Thai time');
ok(daysInMonth(2026, 2) === 28 && daysInMonth(2028, 2) === 29 && daysInMonth(2026, 11) === 30, 'month lengths');
ok(DAILY_DEFAULT.length === 31, 'a reward for every day up to 31');

// ---- the owner's table
ok(typeof cleanDailyOverrides({ 32: { stone: 'enhance', count: 1 } }) === 'string', 'day 32 refused');
ok(typeof cleanDailyOverrides({ 1: { stone: 'key_bear', count: 1 } }) === 'string', 'boss keys are not a daily reward');
ok(typeof cleanDailyOverrides({ 1: { stone: 'enhance', count: 11 } }) === 'string', 'more than 10 refused');
{
  const o = cleanDailyOverrides({ 1: { ...DAILY_DEFAULT[0] }, 2: { stone: 'megaphone', count: 3 } });
  ok(typeof o === 'object' && !('1' in o) && o['2']?.stone === 'megaphone', 'same as the code is not stored');
}

const dir = mkdtempSync(join(tmpdir(), 'multiverse-daily-test-'));
try {
  const db = new Db(join(dir, 'test.db'));
  let now = at('2026-11-12T03:00:00Z'); // 10:00 on the 12th, Thai time
  const daily = new Daily(db, () => now);
  const mail = new Mail(db, () => now);
  const a = db.createAccount('alice', 'x')!;
  const b = db.createAccount('bob', 'x')!;
  const unread = (id: number) => mail.unread({ accountId: id, charId: 0 });

  // ---- today's reward, once
  ok(daily.deliver(a), 'first time today: sent');
  ok(!daily.deliver(a), 'second time today: nothing');
  ok(unread(a) === 1, 'one mail in the account box');
  ok(daily.deliver(b) && unread(b) === 1, 'another account gets its own');
  ok(db.mailHistory(50, undefined).length === 1, 'both share one send in the admin history');
  let v = daily.view(a);
  ok(v.year === 2026 && v.month === 11 && v.today === 12 && v.days.length === 30, 'November calendar');
  ok(v.days[11].state === 'got' && v.days[10].state === 'missed' && v.days[12].state === 'future', 'got today, missed yesterday, tomorrow to come');
  ok(v.makeupsLeft === DAILY_MAKEUPS && v.firstWeekday === 0, '3 make-ups; 1 Nov 2026 is a Sunday');

  // ---- the day turns at midnight Thai time
  now = at('2026-11-12T16:59:00Z');
  ok(!daily.deliver(a), '23:59 still the 12th');
  now = at('2026-11-12T17:00:30Z');
  ok(daily.deliver(a) && unread(a) === 2, '00:00 the 13th: a new reward');

  // ---- make-ups
  ok(daily.makeup(a, 13) !== null, 'today can not be made up');
  ok(daily.makeup(a, 20) !== null, 'a day to come can not be made up');
  ok(daily.makeup(a, 0) !== null && daily.makeup(a, '3') !== null, 'bad days refused');
  ok(daily.makeup(a, 12) !== null, 'a day already got can not be made up');
  ok(daily.makeup(a, 1) === null && unread(a) === 3, 'make-up 1: the 1st (before the system existed is fine)');
  ok(daily.makeup(a, 1) !== null, 'the same day twice refused');
  ok(daily.makeup(a, 5) === null && daily.makeup(a, 11) === null, 'make-ups 2 and 3');
  ok(daily.makeup(a, 2) !== null && unread(a) === 5, 'a 4th make-up refused');
  v = daily.view(a);
  ok(v.makeupsLeft === 0 && v.days[0].state === 'madeUp' && v.days[1].state === 'missed', 'calendar shows the make-ups');

  // ---- what the mail holds follows the owner's table
  ok(typeof daily.setOverrides({ 14: { stone: 'megaphone', count: 4 } }) === 'object', 'owner changes the 14th');
  now = at('2026-11-14T01:00:00Z');
  ok(daily.deliver(a), 'the 14th sent');
  const list = mail.handle({ accountId: a, charId: 0, guest: false } as never, { a: 'mailList' }) as { ok: boolean; list: { id: number; title: string }[] };
  const newest = list.list.find((m) => m.title.includes('14'))!;
  const full = mail.handle({ accountId: a, charId: 0, guest: false } as never, { a: 'mailRead', id: newest.id }) as { mail: { body: string } };
  ok(full.mail.body.includes('โทรโข่ง ×4'), `the 14th's mail has the owner's reward (${full.mail.body.split('\n')[0]})`);

  // ---- a new month: make-ups back, last month's days are not this month's
  now = at('2026-12-01T05:00:00Z');
  ok(daily.deliver(a), '1 December sent');
  v = daily.view(a);
  ok(v.month === 12 && v.days.length === 31 && v.makeupsLeft === DAILY_MAKEUPS && v.days[0].state === 'got', 'December: fresh calendar, 3 make-ups');
  ok(daily.makeup(a, 1) !== null, 'nothing earlier in December to make up');
  db.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ---- on the real server: joining gets the calendar popup and the mail; a guest has no calendar
{
  const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const sdir = mkdtempSync(join(tmpdir(), 'multiverse-daily-srv-'));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const PORT = await new Promise<number>((res, rej) => {
    const sv = createServer();
    sv.once('error', rej);
    sv.listen(0, () => {
      const port = (sv.address() as { port: number }).port;
      sv.close(() => res(port));
    });
  });
  const BASE = `http://localhost:${PORT}`;
  const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT), DB_FILE: join(sdir, 'test.db') }, stdio: ['ignore', 'ignore', 'inherit'],
  });
  const api = async (method: string, path: string, body?: unknown, token?: string) => {
    const r = await fetch(`${BASE}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
  };
  const joinWorld = (token: string, characterId: number) => {
    const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
    const msgs: any[] = [];
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
    ws.onmessage = (e) => void msgs.push(JSON.parse(String(e.data)));
    const waitFor = async (pred: (m: any) => boolean): Promise<any> => {
      for (let i = 0; i < 80; i++) {
        const m = msgs.find(pred);
        if (m) return m;
        await sleep(100);
      }
      return undefined;
    };
    return { ws, msgs, waitFor, act: (o: object) => ws.send(JSON.stringify({ t: 'act', ...o })) };
  };
  try {
    for (let i = 0; ; i++) {
      try {
        await fetch(`${BASE}/api/me`);
        break;
      } catch {
        if (i > 100) throw new Error('test server did not start');
        await sleep(100);
      }
    }
    const tok = (await api('POST', '/register', { username: 'daily1', password: 'secret123' })).data.token as string;
    const c = joinWorld(tok, (await api('POST', '/characters', { name: 'Daily', classId: 'sword' }, tok)).data.id);
    const pop = await c.waitFor((m) => m.t === 'daily');
    ok(pop?.view?.popup === true && pop.view.days.length >= 28, 'joining: the calendar pops up');
    ok(pop?.view?.days[pop.view.today - 1].state === 'got', 'today is marked as got');
    const note = await c.waitFor((m) => m.t === 'mailNote' && m.unread >= 1);
    ok(note?.unread === 1, 'the reward is in the mailbox');
    c.msgs.length = 0;
    c.act({ a: 'daily' });
    const again = await c.waitFor((m) => m.t === 'daily');
    ok(again && !again.view.popup, 'the HUD button shows it again without the popup flag');
    const g = await api('POST', '/guest', { name: 'GuestD', classId: 'mage' });
    const gw = joinWorld(g.data.token, g.data.character.id);
    await gw.waitFor((m) => m.t === 'snap');
    gw.act({ a: 'daily' });
    ok(!!(await gw.waitFor((m) => m.t === 'chat' && String(m.text).includes('Guest ไม่มีปฏิทิน'))), 'a guest is told there is no calendar');
    ok(!gw.msgs.some((m) => m.t === 'daily'), 'and gets none');
    c.ws.close();
    gw.ws.close();
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await new Promise((r) => server.once('exit', r));
    }
    rmSync(sdir, { recursive: true, force: true });
  }
}

finish('daily-login');
