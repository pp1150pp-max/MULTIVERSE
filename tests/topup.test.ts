// Top-up by PromptPay (docs/systems/topup.md). First the pure parts (src/shared/topup.ts): the Thai QR
// payload against promptpay-qr's published test strings, CRC, amounts, settings checks. Then the real
// server with a throwaway database: closed by default; owner-only settings (GM 403, number masked for GMs
// and in the audit, never in the server's output); a request per package with unique satang; one open
// request per account; guests / wrong packages refused; owner confirm / reject / reverse each once (a
// second click 409), cancelled and expired requests still confirmable, a reverse that would go below 0
// refused; and the close beta refund: once per account, only top-ups confirmed before it was switched on
// and not reversed.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { finish, ok } from './check';
import { bahtText, checkTopup, crc16, pickAmount, promptPayId, promptPayPayload, topupNewError } from '../src/shared/topup';

// ------------------------------------------------------------ pure checks

{
  ok(crc16('123456789') === 0x29b1, 'CRC-16/CCITT-FALSE check value');
  // Expected strings from the promptpay-qr package's own tests (github.com/dtinth/promptpay-qr, index.test.js).
  ok(promptPayPayload('0801234567') === '00020101021129370016A000000677010111011300668012345675802TH530376463046197', 'phone, no amount');
  ok(promptPayPayload('0000000000', 422) === '00020101021229370016A000000677010111011300660000000005802TH530376454044.226304E469', 'phone with amount 4.22');
  ok(promptPayPayload('1111111111111') === '00020101021129370016A000000677010111021311111111111115802TH530376463047B5A', 'national id');
  ok(promptPayPayload('012345678901234') === '00020101021129390016A00000067701011103150123456789012345802TH530376463049781', 'e-wallet');
  const p = promptPayPayload('0899999999', 10037);
  ok(p.includes('5406100.37') && crc16(p.slice(0, -4)).toString(16).toUpperCase().padStart(4, '0') === p.slice(-4), `amount 100.37 and its CRC (${p})`);
  ok(promptPayId('089-999-9999') === '0899999999' && promptPayId('1234') === null && promptPayId('1899999999') === null, 'PromptPay id check');
  ok(bahtText(123405) === '1,234.05', 'baht text');
  const taken = new Set<number>();
  for (let i = 0; i < 99; i++) {
    const a = pickAmount(35, taken);
    ok(a !== null && a > 3500 && a < 3600 && !taken.has(a), `amount ${i + 1} unique`);
    taken.add(a!);
  }
  ok(pickAmount(35, taken) === null, 'all 99 satang taken: none');
  ok(pickAmount(36, taken) !== null, 'another price is free');
  ok(!!checkTopup({ open: true }, true).error, 'cannot open without a number');
  ok(!!checkTopup({ promptpay: '12' }, true).error, 'bad number refused');
  ok(!!checkTopup({ expireHours: 0 }, true).error && !!checkTopup({ colour: 1 }, true).error, 'bad hours / unknown field refused');
  ok(checkTopup({ expireHours: 0, maxPending: 3 }, false).value?.maxPending === 3, 'lenient read keeps the good parts');
  const v = { open: true, notice: '', pending: [], maxPending: 1 };
  const pk = [{ crystals: 100, bonus: 10, baht: 35 }];
  ok(topupNewError(v, pk, { crystals: 100, bonus: 10, baht: 35 }, false) === null, 'a listed package is fine');
  ok(topupNewError(v, pk, { crystals: 100, bonus: 99, baht: 35 }, false) !== null, 'a changed package refused');
  ok(topupNewError(v, pk, { crystals: 100, bonus: 10, baht: 35 }, true) !== null, 'guests refused');
}

// ------------------------------------------------------------ the real server

const NUMBER = '0899999999';
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
let out = '';
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_FILE },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout!.on('data', (d) => (out += String(d)));
server.stderr!.on('data', (d) => (out += String(d)));

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
  let lastAct = 0;
  const act = async (o: object): Promise<{ ok: boolean; msg: string }> => {
    // The server takes one top-up action per 2 s per player.
    const wait = lastAct + 2100 - Date.now();
    if (wait > 0) await sleep(wait);
    lastAct = Date.now();
    const r = ++req;
    ws.send(JSON.stringify({ t: 'act', req: r, ...o }));
    for (let i = 0; i < 50; i++) {
      const m = msgs.find((x) => x.t === 'topupRes' && x.req === r);
      if (m) return m;
      await sleep(40);
    }
    return { ok: false, msg: 'no answer' };
  };
  const last = (t: string) => [...msgs].reverse().find((m) => m.t === t);
  return {
    ws, ready, msgs,
    ask: (p: object) => act({ a: 'topupNew', ...p }),
    cancel: (id: unknown) => act({ a: 'topupCancel', id }),
    view: () => last('topup')?.v ?? msgs.find((m) => m.t === 'welcome')?.topup,
    crystals: () => (last('cashState')?.state ?? msgs.find((m) => m.t === 'welcome')?.cashState)?.crystals,
    close: async () => {
      ws.close();
      await sleep(300);
    },
  };
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
  const role = (user: string, r: string) => {
    const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', user, r], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
    ok(cli.status === 0, `${user} is ${r} (exit ${cli.status} ${cli.stderr})`);
  };
  const ownerTok = await reg('topowner');
  role('topowner', 'owner');
  const gmTok = await reg('topgm');
  role('topgm', 'gm');
  const tokA = await reg('payera');
  const tokB = await reg('payerb');
  await api('POST', '/characters', { name: 'Payer', classId: 'sword' }, tokA);
  await api('POST', '/characters', { name: 'Bayer', classId: 'sword' }, tokB);
  const idA = (await api('GET', '/characters', undefined, tokA)).data[0].id as number;
  const idB = (await api('GET', '/characters', undefined, tokB)).data[0].id as number;
  const g = await api('POST', '/guest', { name: 'Gusto', classId: 'mage' });

  const db = new DatabaseSync(DB_FILE);
  const acc = (u: string) => (db.prepare('SELECT id FROM accounts WHERE username = ?').get(u) as { id: number }).id;
  const crystals = (u: string) => Number((db.prepare('SELECT crystals FROM accounts WHERE username = ?').get(u) as { crystals: number }).crystals);
  const setCrystals = (u: string, n: number) => db.prepare('UPDATE accounts SET crystals = ? WHERE username = ?').run(n, u);

  // A package on the cash shop tab (the shop itself may stay closed).
  const cs = await api('GET', '/admin/cash-shop', undefined, ownerTok);
  const pkg = { crystals: 100, bonus: 10, baht: 35 };
  ok((await api('POST', '/admin/cash-shop', { cfg: { open: false, items: {}, packages: [pkg] }, base: { cfg: cs.data.cfg, cosShop: cs.data.cosShop } }, ownerTok)).status === 200, 'package saved');

  // ---- admin routes
  const t0 = await api('GET', '/admin/topup', undefined, ownerTok);
  ok(t0.status === 200 && t0.data.cfg.open === false && t0.data.isOwner && t0.data.canConfirm, `owner loads the tab, closed (${t0.status})`);
  ok((await api('GET', '/admin/topup', undefined, tokA)).status === 403, 'a player cannot see it');
  const gm0 = await api('GET', '/admin/topup', undefined, gmTok);
  ok(gm0.status === 200 && !gm0.data.isOwner && !gm0.data.canConfirm, 'a GM may look, not confirm');

  const A = joinWorld(tokA, idA);
  const B = joinWorld(tokB, idB);
  const G = joinWorld(g.data.token, g.data.character.id);
  await Promise.all([A.ready, B.ready, G.ready]);
  await sleep(200);
  ok(A.view()?.open === false && A.view().pending.length === 0, 'welcome: top-up closed');
  let r = await A.ask(pkg);
  ok(!r.ok && r.msg.includes('ยังไม่เปิด'), `closed: refused (${r.msg})`);

  // ---- settings: owner only
  const cfg = { ...t0.data.cfg, open: true, promptpay: NUMBER };
  ok((await api('POST', '/admin/topup/settings', { cfg }, gmTok)).status === 403, 'a GM cannot change settings');
  ok((await api('POST', '/admin/topup/settings', { cfg: { ...cfg, promptpay: '' } }, ownerTok)).status === 400, 'open without a number refused');
  const s1 = await api('POST', '/admin/topup/settings', { cfg, base: t0.data.cfg }, ownerTok);
  ok(s1.status === 200 && s1.data.cfg.open && s1.data.cfg.promptpay === NUMBER, `owner opens it (${s1.status} ${s1.data.error ?? ''})`);
  ok((await api('POST', '/admin/topup/settings', { cfg, base: t0.data.cfg }, ownerTok)).status === 409, 'saving from a stale page: 409');
  const gm1 = await api('GET', '/admin/topup', undefined, gmTok);
  ok(gm1.data.cfg.promptpay === '••••9999', `GMs see the number masked (${gm1.data.cfg.promptpay})`);
  const audit = db.prepare("SELECT details FROM admin_audit WHERE action = 'topup-settings'").all() as { details: string }[];
  ok(audit.length === 1 && audit[0].details.includes('••••9999') && !audit.some((x) => x.details.includes('99999999')), 'audit: masked number only');
  await sleep(200);
  ok(A.view()?.open === true && G.view()?.open === false, 'players got it at once (guests stay closed)');

  // ---- requests
  r = await A.ask({ ...pkg, bonus: 50 });
  ok(!r.ok && r.msg.includes('เปลี่ยน'), `a package that isn't on sale refused (${r.msg})`);
  r = await G.ask(pkg);
  ok(!r.ok && r.msg.includes('Guest'), `guest refused (${r.msg})`);
  r = await A.ask(pkg);
  ok(r.ok, `A asks (${r.msg})`);
  await sleep(150);
  const pa = A.view().pending[0];
  ok(pa && pa.amount > 3500 && pa.amount < 3600 && pa.crystals === 100 && pa.bonus === 10, `A has an open request (${JSON.stringify(pa)})`);
  ok(pa.qr.includes('01130066899999999') && pa.qr.includes(`54${String(bahtText(pa.amount).length).padStart(2, '0')}${bahtText(pa.amount)}`) && crc16(pa.qr.slice(0, -4)).toString(16).toUpperCase().padStart(4, '0') === pa.qr.slice(-4), 'its QR: the number, the exact amount, a good CRC');
  r = await A.ask(pkg);
  ok(!r.ok && r.msg.includes('รอยืนยัน'), `a second open request refused (${r.msg})`);
  r = await B.ask(pkg);
  ok(r.ok, `B asks (${r.msg})`);
  await sleep(150);
  const pb = B.view().pending[0];
  ok(pb && pb.amount !== pa.amount, `B's amount differs (${pa.amount} / ${pb?.amount})`);

  // ---- confirm
  ok((await api('POST', `/admin/topup/${pa.id}/confirm`, {}, gmTok)).status === 403, 'a GM cannot confirm');
  ok((await api('POST', `/admin/topup/${pa.id}/confirm`, {}, tokA)).status === 403, 'a player cannot confirm');
  const c1 = await api('POST', `/admin/topup/${pa.id}/confirm`, {}, ownerTok);
  ok(c1.status === 200 && crystals('payera') === 110, `owner confirms: 110 crystals (${c1.status} ${crystals('payera')})`);
  ok((await api('POST', `/admin/topup/${pa.id}/confirm`, {}, ownerTok)).status === 409 && crystals('payera') === 110, 'confirming twice: 409, nothing more');
  ok((await api('POST', `/admin/topup/${pa.id}/reject`, {}, ownerTok)).status === 409, 'rejecting a confirmed one: 409');
  await sleep(200);
  ok(A.crystals() === 110 && A.view().pending.length === 0, 'A sees the crystals and no open request');
  ok(A.msgs.some((m) => m.t === 'chat' && String(m.text).includes('เติมคริสตัลมิติสำเร็จ')), 'A is told');

  // ---- B cancels, but had paid: the owner can still confirm it
  r = await B.cancel(pb.id);
  ok(r.ok, `B cancels (${r.msg})`);
  r = await A.cancel(pb.id);
  ok(!r.ok, 'A cannot cancel B\'s request');
  ok((await api('POST', `/admin/topup/${pb.id}/confirm`, {}, ownerTok)).status === 200 && crystals('payerb') === 110, 'a cancelled request is still confirmable');

  // ---- expired, then rejected
  r = await A.ask(pkg);
  ok(r.ok, `A asks again (${r.msg})`);
  await sleep(150);
  const pa2 = A.view().pending[0];
  db.prepare('UPDATE topups SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, pa2.id);
  const list = await api('GET', '/admin/topup', undefined, ownerTok);
  ok(list.data.rows.find((x: any) => x.id === pa2.id)?.status === 'expired', 'an old open request shows expired');
  ok((await api('POST', `/admin/topup/${pa2.id}/reject`, {}, ownerTok)).status === 200, 'expired: rejected');
  ok((await api('POST', `/admin/topup/${pa2.id}/reject`, {}, ownerTok)).status === 409, 'rejecting twice: 409');
  ok(crystals('payera') === 110, 'reject gives nothing');

  // ---- reverse
  setCrystals('payerb', 50);
  const rv = await api('POST', `/admin/topup/${pb.id}/reverse`, {}, ownerTok);
  ok(rv.status === 409 && crystals('payerb') === 50 && (db.prepare('SELECT status FROM topups WHERE id = ?').get(pb.id) as { status: string }).status === 'confirmed', `reverse with crystals already spent: refused, unchanged (${rv.data.error})`);
  setCrystals('payerb', 110);
  ok((await api('POST', `/admin/topup/${pb.id}/reverse`, {}, ownerTok)).status === 200 && crystals('payerb') === 0, 'reverse takes the crystals back');
  ok((await api('POST', `/admin/topup/${pb.id}/reverse`, {}, ownerTok)).status === 409 && crystals('payerb') === 0, 'reversing twice: 409');
  const acts = (db.prepare("SELECT action FROM admin_audit WHERE action LIKE 'topup-%'").all() as { action: string }[]).map((x) => x.action);
  ok(['topup-confirm', 'topup-reject', 'topup-reverse'].every((x) => acts.includes(x)), `confirm / reject / reverse in the audit (${acts.join(',')})`);

  // ---- close beta refund
  await A.close();
  await B.close();
  ok((await api('POST', '/admin/topup/refund', { on: true }, gmTok)).status === 403, 'a GM cannot switch the refund');
  ok((await api('POST', '/admin/topup/refund', { on: true }, ownerTok)).status === 409, 'refund refused while top-up is open');
  const cur = (await api('GET', '/admin/topup', undefined, ownerTok)).data.cfg;
  ok((await api('POST', '/admin/topup/settings', { cfg: { ...cur, open: false } }, ownerTok)).status === 200, 'owner closes top-up');
  ok((await api('POST', '/admin/topup/refund', { on: true }, ownerTok)).status === 200, 'owner switches the refund on');
  await sleep(20);
  // A top-up confirmed after the switch is not refunded.
  const late = db.prepare(`INSERT INTO topups (account_id, username, char_name, crystals, bonus, baht, amount, status, created_at, expires_at)
    VALUES (?, 'payerb', 'Bayer', 100, 10, 35, 3599, 'pending', ?, ?)`).run(acc('payerb'), Date.now(), Date.now() + 60_000);
  ok((await api('POST', `/admin/topup/${Number(late.lastInsertRowid)}/confirm`, {}, ownerTok)).status === 200 && crystals('payerb') === 110, 'B tops up after the switch');
  // The wipe: crystals to 0 (the topups table stays).
  setCrystals('payera', 0);
  setCrystals('payerb', 0);
  const A2 = joinWorld(tokA, idA);
  const B2 = joinWorld(tokB, idB);
  await Promise.all([A2.ready, B2.ready]);
  await sleep(200);
  ok(crystals('payera') === 110 && A2.crystals() === 110, `A gets 110 back (${crystals('payera')})`);
  ok(crystals('payerb') === 0, `B: reversed one and the one after the switch not refunded (${crystals('payerb')})`);
  await A2.close();
  await B2.close();
  const A3 = joinWorld(tokA, idA);
  await A3.ready;
  await sleep(200);
  ok(crystals('payera') === 110, 'only once per account');
  const rf = db.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action = 'topup-refund'").get() as { n: number };
  ok(Number(rf.n) === 1, 'refund in the audit once');
  await A3.close();
  await G.close();
  ok(!out.includes('899999999'), 'the PromptPay number never in the server output');
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
finish('topup');
