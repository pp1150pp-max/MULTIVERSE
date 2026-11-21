// Whole-set spawn (POST /api/admin/characters/:id/itemset, tool spawnSet). Based on admin-items-server.test.ts.
// Item edits from the admin account sheet (POST /api/admin/items, tool itemEdit) against a real game
// server this script starts on a free port with a throwaway database, then stops: who may edit, every
// value checked, the slot must still hold what the page saw, offline edits land in the save, online
// edits in the live character / stash (saved at once, no message to the player), and the audit log.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ADMIN_SET_SIZE } from '../src/shared/admin';
import { rowRanges, tierRanges } from '../src/shared/data/items';
import { PLUS_CAP } from '../src/shared/data/enhance';
import { MAX_LEVEL } from '../src/shared/formulas';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-admin-items-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  env: { ...process.env, PORT: String(PORT), DB_FILE },
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
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });
  const last = (k: 'inv' | 'stash') => msgs.filter((m) => m.t === 'snap' && m.me?.[k]).at(-1)?.me[k];
  const lastMe = () => msgs.filter((m) => m.t === 'snap').at(-1)?.me;
  return { ws, msgs, ready, last, lastMe };
}

function sql<T>(q: string, ...args: (string | number)[]): T {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const r = db.prepare(q).get(...args) as T;
  db.close();
  return r;
}
const saved = (charId: number): any => JSON.parse(sql<{ data: string }>('SELECT data FROM characters WHERE id = ?', charId).data);
const savedStash = (accountId: number): any => JSON.parse(sql<{ data: string }>('SELECT data FROM stashes WHERE account_id = ?', accountId).data);

async function account(username: string) {
  const r = await api('POST', '/register', { username, password: 'secret123' });
  return r.data.token as string;
}

async function run(): Promise<void> {
  for (let i = 0; ; i++) {
    try { await fetch(`${BASE}/api/me`); break; } catch { if (i > 100) throw new Error('test server did not start'); await sleep(100); }
  }
  const ownerTok = await account('owner1');
  const gmTok = await account('gm1');
  const plainTok = await account('plain1');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  ok(cli.status === 0, 'owner1 is owner');
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: 'gm' }, ownerTok)).status === 200, 'gm1 is GM');
  const charId: number = (await api('POST', '/characters', { name: 'Tester', classId: 'sword' }, plainTok)).data.id;
  const set = (body: Record<string, unknown>, tok = gmTok) => api('POST', `/admin/characters/${charId}/itemset`, body, tok);
  const good = { rarity: 'legendary', tier: 2, level: 40, plus: 5 };
  const bag = (): any[] => JSON.parse(sql<{ data: string }>('SELECT data FROM characters WHERE id = ?', charId).data).bag;

  ok((await set(good, plainTok)).status === 403, 'normal player → 403');
  const bad: [Record<string, unknown>, string][] = [
    [{ rarity: 'mythic' }, 'rarity'], [{ tier: 0 }, 'tier 0'], [{ tier: 6 }, 'tier 6'], [{ tier: 1.5 }, 'fractional tier'],
    [{ level: 0 }, 'level 0'], [{ level: MAX_LEVEL + 1 }, 'level over max'], [{ plus: PLUS_CAP + 1 }, 'plus over cap'],
    [{ plus: -1 }, 'negative plus'], [{ classId: 'ninja' }, 'class'], [{ level: '40' }, 'level as text'],
  ];
  for (const [patch, what] of bad) {
    const res = await set({ ...good, ...patch });
    ok(res.status === 400, `${what} → 400 (${res.status})`);
  }
  const start = bag().filter(Boolean);
  const startUids = new Set(start.map((e: any) => e.uid ?? e.potion ?? e.stone));
  ok(start.length < 6, `refused requests spawned nothing (bag ${start.length})`);

  const done = await set(good);
  ok(done.status === 200, `GM spawns a set (${done.status} ${done.data.error ?? ''})`);
  const items = bag().filter((e: any) => e && e.baseId && !startUids.has(e.uid));
  ok(items.length <= ADMIN_SET_SIZE && items.length >= 8, `set size (${items.length})`);
  ok(new Set(items.map((i: any) => i.slot ?? i.baseId)).size >= 8, 'many different slots');
  ok(items.every((i: any) => i.rarity === 'legendary' && i.level === 40 && i.plus === 5), 'rarity, level, +N applied');
  let tierOk = true;
  for (const i of items) {
    for (const l of i.lines ?? []) {
      const r = rowRanges(i.baseId, i.rarity, i.level, (i.lines as any[]).map((x) => x.stat))!;
      const idx = (i.lines as any[]).indexOf(l);
      const t = tierRanges(l.stat, i.level, r[idx].lo, r[idx].hi)[1];
      if (l.tier !== 2 || l.value < t.min || l.value > t.max) tierOk = false;
    }
  }
  ok(tierOk, 'every stat row is in tier T2');

  // Bag nearly full: nothing is spawned.
  const full = await set({ ...good, level: 1, tier: 5, plus: 0 }); // 30 - 10 = 20 free: fits
  ok(full.status === 200, 'second set fits');
  await set(good);
  const third = await set(good);
  ok(third.status === 400 && /ว่าง/.test(third.data.error), `bag too full → 400 (${third.data.error})`);
  const n = bag().filter(Boolean).length;
  await set(good);
  ok(bag().filter(Boolean).length === n, 'refused set added nothing');

  const audit = (await api('GET', '/admin/audit', undefined, ownerTok)).data as any[];
  ok(audit.some((a) => a.action === 'items' && a.details.includes('เซต')), 'set is in the audit log');
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).stack}`);
} finally {
  await stopServer();
}
finish('admin-spawn-set');
