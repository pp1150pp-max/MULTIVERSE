// Orb looks in the shop (src/shared/orbItems.ts), first the checks and the cosmetic list, then on the real
// server: "เพิ่มในร้านค้า" (owner + GM) makes a hidden piece that everyone online learns about; it can be given,
// worn once shown, and others see it in the snapshot; renaming / changing / deleting is owner only; a piece an
// account owns can't be deleted; ids are never reused; stale pages get 409. Own server on a free port, throwaway DB.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish, ok } from './check';
import { checkOrbItems, checkOrbName, orbItemLook, registerOrbItems, ORB_ITEM_CODE_BASE } from '../src/shared/orbItems';
import { COSMETICS, cosById, cosByCode, cosFromCodes, cleanCosOwned } from '../src/shared/data/cosmetics';
import { DEFAULT_ORB_LOOK, type OrbLook } from '../src/shared/orbLook';
import { checkCosTuning, cosTuneDefaults } from '../src/shared/cosTuning';
import { checkCosShop } from '../src/shared/cosShop';

// ---------------------------------------------------------------- checks and the cosmetic list
const look: OrbLook = { ...DEFAULT_ORB_LOOK, palette: 'fire', scale: 1.2 };
ok(checkOrbName('  ลูกแก้ว   ไฟ ').name === 'ลูกแก้ว ไฟ', 'name: trimmed, single spaces');
ok(!!checkOrbName('').error && !!checkOrbName('x'.repeat(31)).error && !!checkOrbName('a\nb').error && !!checkOrbName(5).error, 'name: empty / too long / control / not text refused');
ok(checkOrbItems({ next: 3, items: [{ id: 'orb_1', n: 1, name: 'ก', look }] }, true).items?.items.length === 1, 'strict: a good list passes');
ok(!!checkOrbItems({ next: 1, items: [{ id: 'orb_1', n: 1, name: 'ก', look }] }, true).error, 'strict: next must be above every piece');
ok(!!checkOrbItems({ next: 3, items: [{ id: 'orb_2', n: 1, name: 'ก', look }] }, true).error, 'strict: id must match n');
ok(!!checkOrbItems({ next: 3, items: [{ id: 'orb_1', n: 1, name: 'ก', look: { ...look, scale: 99 } }] }, true).error, 'strict: look checked');
const lenient = checkOrbItems({ next: 1, items: [{ id: 'orb_1', n: 1, name: 'ก', look }, { id: 'orb_1', n: 1, name: 'ซ้ำ', look }, { id: 'bad' }] }, false).items!;
ok(lenient.items.length === 1 && lenient.next === 2, `lenient: bad and doubled pieces dropped, next fixed (${JSON.stringify(lenient)})`);

const before = COSMETICS.length;
registerOrbItems([{ id: 'orb_4', n: 4, name: 'ไฟ', look }]);
ok(COSMETICS.length === before + 1 && cosById('orb_4')?.slot === 'orb' && cosByCode(ORB_ITEM_CODE_BASE + 4)?.id === 'orb_4', 'registered: in the cosmetic list by id and code');
ok(orbItemLook('orb_4')?.palette === 'fire' && orbItemLook('wings_angel') === undefined, 'its look is kept');
ok(cosFromCodes([ORB_ITEM_CODE_BASE + 4]).orb === 'orb_4' && JSON.stringify(cleanCosOwned(['orb_4', 'orb_9'])) === '["orb_4"]', 'snapshot codes and owned lists know it');
ok(cosTuneDefaults('orb_4') === undefined && !!checkCosTuning({ orb_4: {} }, true).error, 'not a tuned cosmetic (no wing/mount sliders)');
ok(checkCosShop({ orb_4: { hidden: true, price: 50 } }, true).shop?.orb_4?.price === 50, 'hidden / price works for it');
registerOrbItems([]);
ok(COSMETICS.length === before && !cosById('orb_4') && !cosByCode(ORB_ITEM_CODE_BASE + 4), 'unregistered again');

// ---------------------------------------------------------------- the server
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
  let you = -1;
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'welcome') you = m.you;
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });
  const act = (o: object) => ws.send(JSON.stringify({ t: 'act', ...o }));
  const last = (t: string) => msgs.filter((m) => m.t === t).at(-1);
  const seen = (id = you) => msgs.filter((m) => m.t === 'snap').at(-1)?.players.find((p: any) => p.id === id);
  const lines = () => msgs.filter((m) => m.t === 'chat').map((m) => m.text as string);
  return { ws, ready, act, last, seen, lines, you: () => you };
}

async function account(user: string, name: string, role?: string) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  await api('POST', '/characters', { name, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  if (role) {
    const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', user, role], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
    ok(cli.status === 0, `${user} is ${role} (exit ${cli.status} ${cli.stderr})`);
  }
  return { tok, charId: chars[0].id };
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
  const owner = await account('orbowner', 'Boss', 'owner');
  const gm = await account('orbgm', 'Gemma', 'gm');
  const a = await account('orbplayer', 'Aria');
  const b = await account('orbother', 'Bodo');
  const A = joinWorld(a.tok, a.charId);
  const B = joinWorld(b.tok, b.charId);
  await Promise.all([A.ready, B.ready]);
  ok(Array.isArray(A.last('welcome')?.orbItems) && A.last('welcome').orbItems.length === 0, 'welcome: no orb looks yet');

  // ---- permissions
  ok((await api('GET', '/admin/orb-items', undefined, a.tok)).status === 403, 'a player cannot read the list');
  const gmState = await api('GET', '/admin/orb-items', undefined, gm.tok);
  ok(gmState.status === 200 && gmState.data.canAdd === true && gmState.data.canEdit === false, `GM: may add, not change (${JSON.stringify(gmState.data)})`);
  ok((await api('POST', '/admin/orb-items', { add: { name: 'x', look } }, a.tok)).status === 403, 'a player cannot add');

  // ---- add
  ok((await api('POST', '/admin/orb-items', { add: { name: '', look } }, gm.tok)).status === 400, 'no name → 400');
  ok((await api('POST', '/admin/orb-items', { add: { name: 'x', look: { ...look, palette: 'nope' } } }, gm.tok)).status === 400, 'bad look → 400');
  const add1 = await api('POST', '/admin/orb-items', { add: { name: 'ลูกแก้วไฟ', look } }, gm.tok);
  ok(add1.status === 200 && add1.data.added === 'orb_1', `GM adds orb_1 (${add1.status} ${JSON.stringify(add1.data)})`);
  const add2 = await api('POST', '/admin/orb-items', { add: { name: 'ลูกแก้วน้ำแข็ง', look: { ...look, palette: 'ice' } } }, owner.tok);
  ok(add2.data.added === 'orb_2', 'owner adds orb_2');
  await sleep(300);
  ok(JSON.stringify(A.last('orbItems')?.items.map((i: any) => i.id)) === '["orb_1","orb_2"]', 'everyone online gets the new list');
  ok(['orb_1', 'orb_2'].every((id) => A.last('cosHidden')?.ids.includes(id)), 'new pieces start hidden');
  const shopState = await api('GET', '/admin/cos-shop', undefined, owner.tok);
  ok(shopState.data.orbs.items.length === 2 && shopState.data.shop.orb_1?.hidden === true && shopState.data.shop.orb_1.price === undefined, 'shop tab: listed, hidden, no price');
  ok(!JSON.stringify(A.last('orbItems')).includes('price'), 'no prices sent to players');

  // ---- give, wear
  const accs = await api('GET', '/admin/accounts', undefined, owner.tok);
  const accId = accs.data.rows.find((r: any) => r.username === 'orbplayer').accountId;
  ok((await api('POST', `/admin/accounts/${accId}/cosmetics`, { id: 'orb_1', give: true }, owner.tok)).status === 200, 'a hidden orb look can be given');
  await sleep(200);
  A.act({ a: 'cosWear', slot: 'orb', id: 'orb_1' });
  await sleep(300);
  ok(!A.seen()?.cos && A.lines().some((l) => l.includes('ปิดไว้ชั่วคราว')), 'hidden: cannot be worn');
  const stale = await api('POST', '/admin/cos-shop', { shop: {}, base: {} }, owner.tok);
  ok(stale.status === 409, `showing with a stale page → 409 (${stale.status})`);
  const cur = (await api('GET', '/admin/cos-shop', undefined, owner.tok)).data;
  ok((await api('POST', '/admin/cos-shop', { shop: { orb_2: { hidden: true } }, base: cur.shop }, owner.tok)).status === 200, 'owner shows orb_1');
  await sleep(200);
  A.act({ a: 'cosWear', slot: 'orb', id: 'orb_1' });
  await sleep(400);
  ok(JSON.stringify(A.seen()?.cos) === JSON.stringify([ORB_ITEM_CODE_BASE + 1]), `worn: in the snapshot (${JSON.stringify(A.seen()?.cos)})`);
  ok(JSON.stringify(B.seen(A.you())?.cos) === JSON.stringify([ORB_ITEM_CODE_BASE + 1]), 'another player sees it');
  const C = joinWorld(b.tok, b.charId);
  await C.ready;
  ok(C.last('welcome')?.orbItems?.length === 2, 'a new join gets the list in welcome');

  // ---- change / rename (owner only)
  ok((await api('POST', '/admin/orb-items', { edit: { orb_1: { name: 'x' } } }, gm.tok)).status === 403, 'GM cannot rename');
  const base = (await api('GET', '/admin/orb-items', undefined, owner.tok)).data.orbs;
  const ed = await api('POST', '/admin/orb-items', { edit: { orb_1: { name: 'ไฟลุก', look: { ...look, scale: 1.5 } } }, base }, owner.tok);
  ok(ed.status === 200 && ed.data.orbs.items[0].name === 'ไฟลุก' && ed.data.orbs.items[0].look.scale === 1.5, 'owner renames and changes the look');
  ok((await api('POST', '/admin/orb-items', { edit: { orb_1: { name: 'y' } }, base }, owner.tok)).status === 409, 'stale page → 409');
  ok((await api('POST', '/admin/orb-items', { edit: { orb_1: { name: 'y', colour: 1 } } }, owner.tok)).status === 400, 'unknown field → 400');
  ok((await api('POST', '/admin/orb-items', { edit: { orb_9: { name: 'y' } } }, owner.tok)).status === 404, 'unknown piece → 404');
  await sleep(300);
  ok(C.last('orbItems')?.items[0].name === 'ไฟลุก', 'players get the change');
  const audit = JSON.stringify((await api('GET', '/admin/audit', undefined, owner.tok)).data);
  ok(audit.includes('orb-items') && audit.includes('ไฟลุก'), 'written to the audit log');

  // ---- delete
  const del1 = await api('POST', '/admin/orb-items', { remove: 'orb_1' }, owner.tok);
  ok(del1.status === 409, `owned by an account: cannot delete (${del1.status} ${del1.data.error ?? ''})`);
  ok((await api('POST', '/admin/orb-items', { remove: 'orb_2' }, gm.tok)).status === 403, 'GM cannot delete');
  ok((await api('POST', '/admin/orb-items', { remove: 'orb_2' }, owner.tok)).status === 200, 'owner deletes orb_2 (nobody has it)');
  const add3 = await api('POST', '/admin/orb-items', { add: { name: 'ใหม่', look } }, owner.tok);
  ok(add3.data.added === 'orb_3', `ids are never reused (${add3.data.added})`);
  await sleep(300);
  ok(JSON.stringify(A.last('orbItems')?.items.map((i: any) => i.id)) === '["orb_1","orb_3"]', 'players get the list without the deleted one');

  for (const s of [A, B, C]) s.ws.close(4000);
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
finish('orb-items');
