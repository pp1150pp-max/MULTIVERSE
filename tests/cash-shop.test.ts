// Cash shop (docs/systems/cash-shop.md). First the pure checks (src/shared/cashShop.ts), then the real server
// end to end: closed = look only; the owner opens sales and sets prices in /admin (checked, 409 on a stale
// page, audit); buying takes crystals and mails stones to the account; wrong price / quantity / limits / time
// window / not enough crystals / guests are refused with nothing taken; two characters of one account buying
// at once with crystals for one get one; a cosmetic already owned costs nothing. Runs its own game server on
// a free port with a throwaway database (crystals are set straight in it: there is no way to get them yet).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { finish, ok } from './check';
import { cashBuyError, cashCatalog, checkCashShop, emptyCashShop, CASH_STONE_PRICE } from '../src/shared/cashShop';

// ------------------------------------------------------------ pure checks

{
  const strict = (v: unknown, cos = {}) => checkCashShop(v, true, cos);
  ok(strict({ open: true, items: {}, packages: [] }).value?.open === true, 'a plain set is fine');
  ok(!!strict({ open: 'yes' }).error, 'open must be a boolean');
  ok(!!strict({ items: { 'stone:nope': {} } }).error, 'unknown item refused');
  ok(!!strict({ items: { 'stone:enhance': { price: 0 } } }).error, 'price 0 refused');
  ok(!!strict({ items: { 'stone:enhance': { sale: 100 } } }).error, 'sale not below the full price refused');
  ok(strict({ items: { 'stone:enhance': { sale: 99 } } }).value?.items['stone:enhance']?.sale === 99, 'sale below the full price kept');
  ok(!!strict({ items: { 'cos:wings_angel': { price: 50 } } }).error, 'a cosmetic price is not set here');
  ok(!!strict({ items: { 'cos:wings_angel': { sale: 50 } } }).error, 'no sale on an unpriced cosmetic');
  ok(strict({ items: { 'cos:wings_angel': { sale: 50 } } }, { wings_angel: { price: 60 } }).value?.items['cos:wings_angel']?.sale === 50, 'sale on a priced cosmetic');
  ok(!!strict({ items: { 'stone:enhance': { start: Date.UTC(2027, 0, 2), end: Date.UTC(2027, 0, 1) } } }).error, 'end before start refused');
  ok(!!strict({ items: { 'stone:enhance': { limit: 0 } } }).error, 'limit 0 refused');
  ok(!!strict({ items: { 'stone:enhance': { badge: 'cheap' } } }).error, 'unknown badge refused');
  ok(!!strict({ packages: [{ crystals: 0, bonus: 0, baht: 35 }] }).error, 'bad package refused');
  ok(!!strict({ items: { 'stone:enhance': { colour: 1 } } }).error, 'unknown field refused');
  ok(strict({ items: { 'stone:enhance': { price: CASH_STONE_PRICE.enhance } } }).value?.items['stone:enhance'] === undefined, 'the code price is not stored');
  const lenient = checkCashShop({ open: true, items: { 'stone:enhance': { price: -5, limit: 3 }, 'stone:nope': {} } }, false, {});
  ok(lenient.value?.open === true && lenient.value.items['stone:enhance']?.limit === 3 && lenient.value.items['stone:enhance']?.price === undefined, 'lenient read drops only the bad parts');

  const now = Date.UTC(2026, 10, 15);
  const cfg = checkCashShop({ open: true, items: {
    'stone:protect': { off: true }, 'stone:enhance': { end: now - 1 }, 'stone:megaphone': { start: now + 60_000 }, 'stone:exp_scroll': { sale: 40, featured: true },
  } }, true, {}).value!;
  const cat = cashCatalog(cfg, { wings_angel: { price: 100 }, wings_bat: { price: 100, hidden: true } }, now);
  const ids = cat.items.map((i) => i.id);
  ok(!ids.includes('stone:protect') && !ids.includes('stone:enhance'), 'switched-off and ended items left out');
  ok(cat.items.find((i) => i.id === 'stone:megaphone')?.start === now + 60_000, 'an item starting later is listed with its start');
  ok(ids.includes('cos:wings_angel') && !ids.includes('cos:wings_bat') && !ids.includes('cos:mount_wolf'), 'only shown, priced cosmetics');
  const exp = cat.items.find((i) => i.id === 'stone:exp_scroll')!;
  ok(exp.price === 50 && exp.now === 40 && exp.featured, 'sale price and featured');
  ok(cat.items.find((i) => i.id === 'cos:wings_angel')?.limit === 1, 'a cosmetic is once per account');
  const st = { crystals: 100, bought: {} };
  ok(cashBuyError(cat, 'stone:exp_scroll', 2, 40, st, [], false, now) === null, 'buyable');
  ok(cashBuyError(cat, 'stone:exp_scroll', 3, 40, st, [], false, now) !== null, 'not enough crystals');
  ok(cashBuyError(cat, 'stone:exp_scroll', 1, 50, st, [], false, now) !== null, 'old price refused');
  ok(cashBuyError(cat, 'stone:megaphone', 1, 30, st, [], false, now) !== null, 'not started yet');
  ok(cashBuyError(cat, 'cos:wings_angel', 1, 100, st, ['wings_angel'], false, now) !== null, 'owned cosmetic refused');
  ok(cashBuyError(cat, 'cos:wings_angel', 2, 100, { crystals: 500, bought: {} }, [], false, now) !== null, 'two of a cosmetic refused');
  ok(cashBuyError(cashCatalog(emptyCashShop(), {}, now), 'stone:exp_scroll', 1, 50, st, [], false, now) === 'แคชช็อปยังไม่เปิดขาย', 'closed by default');
  ok(cashBuyError(cat, 'stone:exp_scroll', 1, 40, st, [], true, now) !== null, 'guests refused');
}

// ------------------------------------------------------------ the real server

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PORT = await new Promise<number>((res, rej) => {
  const s = createServer();
  s.once('error', rej);
  s.listen(0, () => {
    const port = (s.address() as { port: number }).port;
    s.close(() => res(port));
  });
});
const BASE = `http://localhost:${PORT}`;
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_FILE },
  stdio: ['ignore', 'ignore', 'inherit'],
});

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
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });
  let req = 0;
  /** Sends a purchase and waits for its answer. */
  const buy = async (id: unknown, qty: unknown, price: unknown): Promise<{ ok: boolean; msg: string }> => {
    const r = ++req;
    ws.send(JSON.stringify({ t: 'act', a: 'cashBuy', req: r, id, qty, price }));
    for (let i = 0; i < 50; i++) {
      const m = msgs.find((x) => x.t === 'cashBuy' && x.req === r);
      if (m) return m;
      await sleep(40);
    }
    return { ok: false, msg: 'no answer' };
  };
  const mail = async (o: object): Promise<any> => {
    const r = 1000 + ++req;
    ws.send(JSON.stringify({ t: 'act', req: r, ...o }));
    for (let i = 0; i < 50; i++) {
      const m = msgs.find((x) => x.t === 'mail' && x.req === r);
      if (m) return m;
      await sleep(40);
    }
    return null;
  };
  const welcome = () => msgs.find((m) => m.t === 'welcome');
  const cat = () => msgs.filter((m) => m.t === 'cash').at(-1)?.cat ?? welcome()?.cash;
  const state = () => msgs.filter((m) => m.t === 'cashState').at(-1)?.state ?? welcome()?.cashState;
  return { ws, ready, buy, mail, welcome, cat, state, msgs };
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
  const reg = async (user: string) => (await api('POST', '/register', { username: user, password: 'secret123' })).data.token as string;
  const ownerTok = await reg('cashowner');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'cashowner', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  ok(cli.status === 0, `cashowner is owner (exit ${cli.status} ${cli.stderr})`);
  const tok = await reg('cashbuyer');
  await api('POST', '/characters', { name: 'Alpha', classId: 'sword' }, tok);
  await api('POST', '/characters', { name: 'Bravo', classId: 'mage' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  const g = await api('POST', '/guest', { name: 'Gusto', classId: 'mage' });

  const db = new DatabaseSync(DB_FILE);
  const accId = (db.prepare("SELECT id FROM accounts WHERE username = 'cashbuyer'").get() as { id: number }).id;
  const setCrystals = (n: number) => db.prepare('UPDATE accounts SET crystals = ? WHERE id = ?').run(n, accId);
  const crystals = () => Number((db.prepare('SELECT crystals FROM accounts WHERE id = ?').get(accId) as { crystals: number }).crystals);
  ok(crystals() === 0, 'a new account starts with 0 crystals');
  setCrystals(250);

  // ---- admin route: owner sees it, a player doesn't
  const adm = await api('GET', '/admin/cash-shop', undefined, ownerTok);
  ok(adm.status === 200 && adm.data.cfg.open === false && adm.data.canEdit === true, `owner loads the tab, closed at first (${adm.status})`);
  ok((await api('GET', '/admin/cash-shop', undefined, tok)).status === 403, 'a player cannot');

  const A = joinWorld(tok, chars.find((c) => c.name === 'Alpha')!.id);
  const B = joinWorld(tok, chars.find((c) => c.name === 'Bravo')!.id);
  const G = joinWorld(g.data.token, g.data.character.id);
  await Promise.all([A.ready, B.ready, G.ready]);
  await sleep(200);
  ok(A.cat()?.open === false && A.cat().items.some((i: any) => i.id === 'stone:enhance' && i.now === 100), 'welcome: closed catalogue with the code prices');
  ok(A.state()?.crystals === 250, `welcome: the account's crystals (${A.state()?.crystals})`);
  ok(!A.cat().items.some((i: any) => i.kind === 'cos'), 'no cosmetic sold before it has a price');

  // ---- closed: look only
  let r = await A.buy('stone:enhance', 1, 100);
  ok(!r.ok && r.msg.includes('ยังไม่เปิดขาย') && crystals() === 250, `closed: refused, nothing taken (${r.msg})`);

  // ---- the owner opens it
  const cfg = { open: true, items: { 'stone:enhance': { sale: 90, limit: 3, badge: 'hot' } }, packages: [{ crystals: 100, bonus: 10, baht: 35 }] };
  const base = { cfg: adm.data.cfg, cosShop: adm.data.cosShop };
  ok((await api('POST', '/admin/cash-shop', { cfg: { ...cfg, items: { 'stone:enhance': { sale: 200 } } }, base }, ownerTok)).status === 400, 'a sale above the price refused');
  ok((await api('POST', '/admin/cash-shop', { cfg, base }, tok)).status === 403, 'a player cannot save');
  const saved = await api('POST', '/admin/cash-shop', { cfg, cosPrices: { wings_angel: 120 }, base }, ownerTok);
  ok(saved.status === 200 && saved.data.cfg.open === true && saved.data.cosShop.wings_angel?.price === 120, `owner saves (${saved.status} ${saved.data.error ?? ''})`);
  ok((await api('POST', '/admin/cash-shop', { cfg, base }, ownerTok)).status === 409, 'saving from a stale page: 409');
  await sleep(200);
  ok(A.cat()?.open === true && B.cat()?.open === true && G.cat()?.open === true, 'everyone got the new catalogue');
  ok(A.cat().items.some((i: any) => i.id === 'cos:wings_angel' && i.now === 120), 'the priced cosmetic is on sale');
  ok(A.cat().packages.length === 1, 'packages sent');
  const audit = db.prepare("SELECT action, details FROM admin_audit WHERE action IN ('cash-shop', 'cos-shop')").all() as { action: string; details: string }[];
  ok(audit.some((x) => x.action === 'cash-shop' && x.details.includes('เปิดขาย')) && audit.some((x) => x.action === 'cos-shop'), 'saved in the audit log');

  // ---- buying stones
  await sleep(320);
  r = await A.buy('stone:enhance', 2, 100);
  ok(!r.ok && r.msg.includes('ราคาเปลี่ยน') && crystals() === 250, `old price refused (${r.msg})`);
  for (const [qty, why] of [[0, 'zero'], [11, 'eleven'], [1.5, 'a fraction'], ['2', 'a string']] as const) {
    await sleep(320);
    r = await A.buy('stone:enhance', qty, 90);
    ok(!r.ok && crystals() === 250, `quantity ${why} refused (${r.msg})`);
  }
  await sleep(320);
  r = await A.buy('stone:nope', 1, 1);
  ok(!r.ok, `unknown item refused (${r.msg})`);
  r = await A.buy('stone:enhance', 2, 90);
  ok(!r.ok && r.msg.includes('เร็วเกินไป'), `too fast refused (${r.msg})`);
  await sleep(320);
  r = await A.buy('stone:enhance', 2, 90);
  ok(r.ok && crystals() === 70, `bought 2 at 90 (${r.msg}, ${crystals()} left)`);
  await sleep(200);
  ok(A.state()?.crystals === 70 && B.state()?.crystals === 70 && A.state()?.bought['stone:enhance'] === 2, 'both characters of the account got the new crystals and count');
  const list = await B.mail({ a: 'mailList' });
  const m = list?.list?.find((x: any) => x.from === 'แคชช็อป');
  ok(!!m && m.attach, 'the stones are mailed to the account (any of its characters sees it)');
  await sleep(320);
  r = await A.buy('stone:enhance', 2, 90);
  ok(!r.ok && r.msg.includes('อีก 1') && crystals() === 70, `per-account limit (${r.msg})`);
  r = await G.buy('stone:enhance', 1, 90);
  ok(!r.ok && r.msg.includes('Guest'), `guest refused (${r.msg})`);

  // ---- cosmetics: two characters at once with crystals for one
  await sleep(320);
  r = await A.buy('cos:wings_angel', 1, 120);
  ok(!r.ok && r.msg.includes('ไม่พอ') && crystals() === 70, `not enough crystals (${r.msg})`);
  setCrystals(120);
  await sleep(320);
  const [ra, rb] = await Promise.all([A.buy('cos:wings_angel', 1, 120), B.buy('cos:wings_angel', 1, 120)]);
  ok([ra, rb].filter((x) => x.ok).length === 1 && crystals() === 0, `exactly one of two buys at once (${ra.msg} / ${rb.msg}, ${crystals()} left)`);
  const owned = db.prepare("SELECT COUNT(*) AS n FROM account_cosmetics WHERE account_id = ? AND cosmetic_id = 'wings_angel'").get(accId) as { n: number };
  ok(Number(owned.n) === 1, 'the account owns it once');
  setCrystals(500);
  await sleep(320);
  r = await A.buy('cos:wings_angel', 1, 120);
  ok(!r.ok && r.msg.includes('ชิ้นนี้แล้ว') && crystals() === 500, `already owned: nothing taken (${r.msg})`);

  // ---- time window
  const now = Date.now();
  const st2 = (await api('GET', '/admin/cash-shop', undefined, ownerTok)).data;
  const timed = { ...cfg, items: { ...cfg.items, 'stone:protect': { start: now + 3_600_000 }, 'stone:reroll_stat': { end: now + 1000 } } };
  ok((await api('POST', '/admin/cash-shop', { cfg: timed, base: { cfg: st2.cfg, cosShop: st2.cosShop } }, ownerTok)).status === 200, 'owner sets sale windows');
  await sleep(320);
  r = await A.buy('stone:protect', 1, 150);
  ok(!r.ok && r.msg.includes('ยังไม่เริ่ม'), `not started refused (${r.msg})`);
  await sleep(1100);
  r = await A.buy('stone:reroll_stat', 1, 80);
  ok(!r.ok && crystals() === 500, `ended refused (${r.msg})`);

  const hist = (await api('GET', '/admin/cash-shop', undefined, ownerTok)).data.recent as any[];
  ok(hist.length === 2 && hist.some((p) => p.item === 'stone:enhance' && p.qty === 2 && p.price === 90 && p.username === 'cashbuyer'), `purchase history (${hist.length})`);

  // ---- claiming the mail gives unbound stones
  const claim = await A.mail({ a: 'mailClaim', id: m.id });
  ok(claim?.ok, `claimed (${claim?.msg})`);
  for (const s of [A, B, G]) s.ws.close();
  await sleep(500);
  const data = JSON.parse((db.prepare("SELECT data FROM characters WHERE name = 'Alpha'").get() as { data: string }).data);
  const stack = (data.bag as any[]).find((e) => e && e.stone === 'enhance');
  ok(stack?.count === 2 && !stack.bound, `2 unbound enhance stones in the bag (${JSON.stringify(stack)})`);
  db.close();
}

try {
  await run();
} catch (e) {
  ok(false, `test crashed: ${e instanceof Error ? e.message : e}`);
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  rmSync(dir, { recursive: true, force: true });
}
finish('cash-shop');
