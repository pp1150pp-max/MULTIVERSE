// Daily login (owner 2026-11-12): a monthly calendar per account, the day turns at 00:00 Thai time, the
// first time in the game each day mails that day's reward, a missed day is gone except for 3 free make-ups a
// month (any earlier day of the month), the owner can change each day's reward. Milestone bonuses (owner
// 2026-11-29): 7, 15 and 30 days got in one month. Uses a throwaway database and a fake clock; nothing here
// touches server/data.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { Daily } from '../server/daily';
import { Mail } from '../server/mail';
import {
  BONUS_DEFAULT, cleanBonus, cleanDailyOverrides, DAILY_BONUS_SETTING, DAILY_DEFAULT, DAILY_MAKEUPS, dayKey, daysInMonth, thaiDate,
  type BonusConfig,
} from '../src/shared/daily';
import { rollAttach, type MailAttach } from '../src/shared/mail';
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

  // ---- milestone bonuses: 7, 15 and 30 days got in one month
  const day = (month: string, d: number) => at(`${month}-${String(d).padStart(2, '0')}T05:00:00Z`);
  /** Logs `id` in on these days; returns every tier mailed, with the day it came. */
  const login = (id: number, month: string, from: number, to: number) => {
    const got: string[] = [];
    for (let d = from; d <= to; d++) {
      now = day(month, d);
      daily.deliver(id);
      for (const tier of daily.bonus(id)) got.push(`${tier}@${d}`);
    }
    return got.join(' ');
  };
  const bonusMails = (id: number) => (mail.handle({ accountId: id, charId: 0, guest: false } as never, { a: 'mailList' }) as { list: { id: number; title: string }[] })
    .list.filter((m) => m.title.startsWith('โบนัส'));
  const attachOf = (id: number, title: string) => {
    const m = bonusMails(id).find((x) => x.title === title)!;
    return (mail.handle({ accountId: id, charId: 0, guest: false } as never, { a: 'mailRead', id: m.id }) as { mail: { gifts: MailAttach } }).mail.gifts;
  };
  const things = (a: MailAttach) => a.items.map((x) => `${x.kind === 'stone' ? x.stone : x.kind}x${x.count}`).join(',');

  const c = db.createAccount('carol', 'x')!;
  ok(login(c, '2027-01', 1, 6) === '' && bonusMails(c).length === 0, '6 days: no bonus yet');
  ok(login(c, '2027-01', 7, 7) === '7@7', '7th day: the 7-day bonus');
  ok(daily.bonus(c).length === 0 && bonusMails(c).length === 1, 'asked again: nothing more');
  const first = attachOf(c, 'โบนัสล็อกอินสะสมครบ 7 วัน');
  ok(things(first) === 'exp_scrollx1,drop_scrollx1,mystery_boxx1', `7 days holds 1+1+1 (${things(first)})`);
  ok(rollAttach(first, 'sword', 10).length === 3, 'all three can be collected into a bag');
  ok(login(c, '2027-01', 8, 31) === '15@15 30@30', 'then 15 and 30, once each');
  ok(things(attachOf(c, 'โบนัสล็อกอินสะสมครบ 30 วัน')) === 'exp_scrollx3,drop_scrollx3,mystery_boxx5', '30 days holds 3+3+5');
  let bv = daily.view(c);
  ok(bv.count === 31 && bv.bonus.length === 3 && bv.bonus.every((x) => x.got), 'the window shows all three got');
  ok(login(c, '2027-02', 1, 6) === '' && daily.view(c).bonus.every((x) => !x.got), 'a new month starts over');
  ok(login(c, '2027-02', 7, 28) === '7@7 15@15 30@28', 'February: the last tier is every day of the month');
  ok(daily.view(c).bonus[2].need === 28, 'and the window says 28');

  // make-ups count, missed days don't reset
  const d = db.createAccount('dave', 'x')!;
  ok(login(d, '2027-03', 10, 10) + login(d, '2027-03', 20, 22) === '', '4 days, with gaps');
  ok(daily.makeup(d, 1) === null && daily.makeup(d, 2) === null && daily.bonus(d).length === 0, '6 with two make-ups');
  ok(daily.makeup(d, 3) === null && daily.bonus(d).join() === '7' && daily.bonus(d).length === 0, 'the third make-up reaches 7');

  // the owner's settings
  ok(typeof cleanBonus(BONUS_DEFAULT) === 'object', 'the code default is valid');
  const edit = (f: (c: BonusConfig) => void) => {
    const x = JSON.parse(JSON.stringify(BONUS_DEFAULT)) as BonusConfig;
    f(x);
    return x;
  };
  ok([edit((x) => (x.tiers[0].exp_scroll = 11)), edit((x) => (x.tiers[0].mystery_box = 101)), edit((x) => (x.tiers[0].drop_scroll = -1)),
    edit((x) => (x.tiers[0].drop_scroll = 1.5)), edit((x) => x.tiers.pop()), edit((x) => (x.on = 1 as never)), null, {}]
    .every((x) => typeof cleanBonus(x) === 'string'), 'bad settings refused');
  const e = db.createAccount('erin', 'x')!;
  ok(typeof daily.setBonus(edit((x) => (x.on = false))) === 'object', 'bonus switched off');
  ok(login(e, '2027-04', 1, 15) === '' && daily.view(e).bonus.length === 0, 'off: nothing sent, nothing shown');
  daily.setBonus(edit((x) => {
    x.tiers[0] = { on: true, exp_scroll: 0, drop_scroll: 0, mystery_box: 100 };
    x.tiers[1].on = false;
  }));
  ok(daily.bonus(e).join() === '7', 'switched on later in the month: the reached tier still arrives, the off one not');
  ok(things(attachOf(e, 'โบนัสล็อกอินสะสมครบ 7 วัน')) === 'mystery_boxx100', 'with the owner\'s amounts (0 = left out)');
  ok(daily.view(e).bonus.map((x) => x.tier).join() === '7,30', 'the off tier is not shown');
  daily.setBonus(edit((x) => (x.tiers[1] = { on: true, exp_scroll: 0, drop_scroll: 0, mystery_box: 0 })));
  ok(daily.bonus(e).length === 0, 'an all-zero tier is not used up');
  daily.setBonus(BONUS_DEFAULT);
  ok(db.getSetting(DAILY_BONUS_SETTING) === null || db.getSetting(DAILY_BONUS_SETTING) === undefined, 'the code default is not stored');
  ok(daily.bonus(e).join() === '15', 'and arrives once it gives something');
  db.setSetting(DAILY_BONUS_SETTING, 'broken');
  ok(daily.bonusConfig().on === false, 'a broken stored value gives nothing');
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
  // An account that has 6 other days of this month already: joining today reaches the 7-day bonus.
  const seeded = new Db(join(sdir, 'test.db'));
  const veteran = seeded.createAccount('veteran', 'x')!;
  seeded.close();
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
    // ---- the bonus, end to end
    const t = thaiDate(Date.now());
    const tok2 = (await api('POST', '/register', { username: 'daily2', password: 'secret123' })).data.token as string;
    const hero = (await api('POST', '/characters', { name: 'Bonus', classId: 'sword' }, tok2)).data.id as number;
    const sql = new Db(join(sdir, 'test.db'));
    const id2 = (sql as unknown as { db: { prepare(q: string): { get(): { id: number } } } }).db.prepare("SELECT id FROM accounts WHERE username = 'daily2'").get().id;
    for (const d of [1, 2, 3, 4, 5, 6, 7].filter((x) => x !== t.day).slice(0, 6)) sql.dailyClaim(id2, dayKey(t.year, t.month, d), false, Date.now());
    ok(veteran !== id2, 'separate accounts');
    sql.close();
    const w2 = joinWorld(tok2, hero);
    const bpop = await w2.waitFor((m) => m.t === 'daily');
    ok(bpop?.view?.popup === true && bpop.view.won?.join() === '7' && bpop.view.count === 7, `joining on the 7th day: bonus popup (${bpop?.view?.won})`);
    ok(!!(await w2.waitFor((m) => m.t === 'mailNote' && m.unread === 2)), "today's reward and the bonus are in the mailbox");
    w2.ws.close();

    // ---- /admin: only a role with the daily tool may change the bonus
    const off = { ...BONUS_DEFAULT, on: false };
    ok((await api('POST', '/admin/daily-bonus', { bonus: off }, tok2)).status >= 400, 'a player can not change the bonus');
    const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'daily1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE: join(sdir, 'test.db') } });
    ok(cli.status === 0, 'daily1 made owner');
    const saved = await api('POST', '/admin/daily-bonus', { bonus: off }, tok);
    ok(saved.status === 200 && saved.data.bonus.on === false, `the owner switches the bonus off (${saved.status})`);
    ok((await api('GET', '/admin/daily', undefined, tok)).data.bonus.on === false, 'and reads it back');
    ok((await api('POST', '/admin/daily-bonus', { bonus: { on: true } }, tok)).status === 400, 'a bad setting is refused');

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
