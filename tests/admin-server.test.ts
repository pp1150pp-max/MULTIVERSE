// Admin API tests against a real game server that this script starts by itself on a free port with a
// throwaway database (never the real server or server/data), then stops: roles and 403s, GM can't
// grant roles, caps, online edits surviving the next save, offline edits, kick/teleport, audit log.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ADMIN_GOLD_MAX, ADMIN_ITEMS_MAX } from '../src/shared/admin';
import { MAX_LEVEL } from '../src/shared/formulas';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-admin-test-'));
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
  let closed = false;
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
  ws.onclose = () => (closed = true);
  const lastMe = () => msgs.filter((m) => m.t === 'snap').at(-1)?.me;
  return { ws, msgs, ready, lastMe, isClosed: () => closed, send: (m: unknown) => ws.send(JSON.stringify(m)) };
}

/** The saved character straight from the database. */
function saved(charId: number): any {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const r = db.prepare('SELECT data FROM characters WHERE id = ?').get(charId) as { data: string };
  db.close();
  return JSON.parse(r.data);
}

async function account(username: string) {
  const r = await api('POST', '/register', { username, password: 'secret123' });
  return r.data.token as string;
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

  const ownerTok = await account('owner1');
  const gmTok = await account('gm1');
  const plainTok = await account('plain1');

  // ---------------------------------------------------------- nobody is an admin yet
  ok((await api('GET', '/admin/me')).status === 401, 'no token → 401');
  ok((await api('GET', '/admin/me', undefined, plainTok)).status === 403, 'normal player → 403 on /admin/me');
  ok((await api('GET', '/admin/online', undefined, plainTok)).status === 403, 'normal player → 403 on the online list');
  ok((await api('GET', '/admin/characters?q=a', undefined, plainTok)).status === 403, 'normal player → 403 on search');
  ok((await api('POST', '/admin/characters/1/gold', { delta: 5 }, plainTok)).status === 403, 'normal player → 403 on an edit');
  ok((await api('POST', '/admin/roles', { username: 'plain1', role: 'gm' }, plainTok)).status === 403, 'normal player → 403 on granting');
  const g = await api('POST', '/guest', { name: 'GuestX', classId: 'mage' });
  ok((await api('GET', '/admin/me', undefined, g.data.token)).status === 403, 'guest → 403');

  // ---------------------------------------------------------- owner from the command line
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(cli.status === 0, `admin-role script makes owner1 owner (exit ${cli.status} ${cli.stderr})`);
  const bad = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'nobody', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(bad.status !== 0, 'admin-role script refuses an unknown account');
  const me = await api('GET', '/admin/me', undefined, ownerTok);
  ok(me.status === 200 && me.data.role === 'owner', `owner1 is owner (${me.status} ${me.data.role})`);

  // ---------------------------------------------------------- roles
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: 'owner' }, ownerTok)).status === 400, 'page cannot grant owner');
  ok((await api('POST', '/admin/roles', { username: 'owner1', role: null }, ownerTok)).status === 400, 'page cannot revoke an owner');
  ok((await api('POST', '/admin/roles', { username: 'nobody', role: 'gm' }, ownerTok)).status === 404, 'unknown account → 404');
  const grant = await api('POST', '/admin/roles', { username: 'GM1', role: 'gm' }, ownerTok);
  ok(grant.status === 200 && grant.data.some((r: any) => r.username === 'gm1' && r.role === 'gm'), 'owner grants GM (any letter case)');
  ok((await api('GET', '/admin/me', undefined, gmTok)).data.role === 'gm', 'gm1 is GM');
  ok((await api('POST', '/admin/roles', { username: 'plain1', role: 'gm' }, gmTok)).status === 403, 'GM cannot grant roles');
  ok((await api('GET', '/admin/roles', undefined, gmTok)).status === 403, 'GM cannot list roles');
  ok((await api('GET', '/admin/audit', undefined, gmTok)).status === 403, 'GM cannot read the audit log');

  // ---------------------------------------------------------- a character online
  const made = await api('POST', '/characters', { name: 'Tester', classId: 'sword' }, plainTok);
  const charId: number = made.data.id;
  const c = joinWorld(plainTok, charId);
  await c.ready;
  await sleep(300);
  const online = await api('GET', '/admin/online', undefined, gmTok);
  const row = online.data.players?.find((p: any) => p.charId === charId);
  ok(online.status === 200 && row && row.username === 'plain1' && typeof row.ip === 'string', 'online list shows the player with IP');
  ok(online.data.zones.find((z: any) => z.id === 'emerald_forest')?.count === 1, 'online count per zone');
  const found = await api('GET', '/admin/characters?q=test', undefined, gmTok);
  ok(found.data.length === 1 && found.data[0].online === true, 'search finds the character (online)');
  ok((await api('GET', '/admin/characters?q=%25', undefined, gmTok)).data.length === 0, 'a typed % is not a wildcard');

  // ---------------------------------------------------------- caps and bad input
  const edit = (what: string, body: unknown, tok = gmTok, id = charId) => api('POST', `/admin/characters/${id}/${what}`, body, tok);
  ok((await edit('gold', { delta: ADMIN_GOLD_MAX + 1 })).status === 400, 'gold over the cap refused');
  ok((await edit('gold', { delta: -ADMIN_GOLD_MAX - 1 })).status === 400, 'taking gold over the cap refused');
  ok((await edit('gold', { delta: '100' })).status === 400, 'gold as text refused');
  ok((await edit('gold', { delta: 1.5 })).status === 400, 'fractional gold refused');
  ok((await edit('level', { level: MAX_LEVEL + 1 })).status === 400, 'level over the max refused');
  ok((await edit('level', { level: 0 })).status === 400, 'level 0 refused');
  ok((await edit('level', { level: 5, exp: 1e9 })).status === 400, 'EXP past the level refused');
  ok((await edit('items', { baseId: 'weapon_1', rarity: 'rare', count: ADMIN_ITEMS_MAX + 1 })).status === 400, 'too many items refused');
  ok((await edit('items', { baseId: 'nope', rarity: 'rare' })).status === 400, 'unknown item refused');
  ok((await edit('items', { baseId: 'weapon_1', rarity: 'mythic' })).status === 400, 'unknown rarity refused');
  ok((await edit('items', { baseId: 'cap', rarity: 'rare', plus: 3 })).status === 400, 'plus on a helmet refused');
  ok((await edit('items', { baseId: 'weapon_1', rarity: 'rare', plus: 11 })).status === 400, 'plus over the max refused');
  ok((await edit('teleport', { zone: 'nowhere' })).status === 400, 'unknown zone refused');
  ok((await edit('gold', { delta: 5 }, gmTok, 999999)).status === 404, 'unknown character → 404');
  ok(c.lastMe().gold === 0, 'nothing changed by refused edits');

  // ---------------------------------------------------------- online edits go to the live character
  const lv = await edit('level', { level: 20, exp: 100 });
  ok(lv.status === 200 && lv.data.char.level === 20, `set level 20 online (${lv.status} ${lv.data.error ?? ''})`);
  const gold = await edit('gold', { delta: ADMIN_GOLD_MAX });
  ok(gold.status === 200 && gold.data.char.gold === ADMIN_GOLD_MAX, 'give gold at the cap');
  const items = await edit('items', { baseId: 'weapon_7', rarity: 'legendary', plus: 7, count: 2 });
  ok(items.status === 200 && items.data.char.bagFree === 30 - 2 - 2, `spawn 2 items (${items.data.msg})`);
  await sleep(400);
  const m = c.lastMe();
  ok(m.level === 20 && m.exp === 100 && m.gold === ADMIN_GOLD_MAX, 'the player sees the new level and gold');
  ok(m.stats.maxHp > 100, `stats recomputed for the new level (maxHp ${m.stats.maxHp})`);
  const bagNow = c.msgs.filter((x) => x.t === 'snap' && x.me.inv).at(-1)?.me.inv.bag ?? [];
  const spawned = bagNow.filter((e: any) => e?.baseId === 'weapon_7');
  ok(spawned.length === 2 && spawned.every((e: any) => e.plus === 7 && e.rarity === 'legendary' && e.level === 20 && e.cls === 'sword' && e.lines?.length),
    'spawned items are real items (+7, legendary, Lv.20, class, stat lines)');
  ok(c.msgs.some((x) => x.t === 'chat' && x.name === '' && x.text === 'GM ปรับเลเวลเป็น 20'), 'the player gets the Thai GM message');
  // The game's own next save (here: sorting the bag) must keep the edit.
  c.send({ t: 'act', a: 'sort', key: 'rarity', desc: true });
  await sleep(2600);
  let d = saved(charId);
  ok(d.level === 20 && d.gold === ADMIN_GOLD_MAX && d.bag.filter((e: any) => e?.baseId === 'weapon_7').length === 2,
    'online edit survives the next save');

  // ---------------------------------------------------------- kick, then offline edits
  const kick = await edit('kick', {});
  await sleep(300);
  ok(kick.status === 200 && c.isClosed() && c.msgs.some((x) => x.t === 'kick'), 'kick closes the game with a message');
  d = saved(charId);
  ok(d.level === 20 && d.gold === ADMIN_GOLD_MAX, 'still saved after the kick');
  ok((await edit('kick', {})).status === 400, 'kicking an offline character → 400');

  const take = await edit('gold', { delta: -ADMIN_GOLD_MAX });
  ok(take.status === 200 && saved(charId).gold === 0, 'take gold offline');
  ok((await edit('level', { level: MAX_LEVEL, exp: 5 })).status === 200 && saved(charId).level === MAX_LEVEL && saved(charId).exp === 0,
    'offline level to max (EXP 0 at max)');
  ok((await edit('teleport', { zone: 'frost_reach' })).status === 200 && saved(charId).zone === 'frost_reach', 'teleport offline');
  ok((await edit('teleport', { zone: 'frost_reach' })).status === 400, 'teleport to the same zone refused');
  // 30 slots: 2 potion stacks + 2 items used, 26 free.
  for (let k = 0; k < 2; k++) await edit('items', { baseId: 'cap', rarity: 'common', count: ADMIN_ITEMS_MAX });
  const part = await edit('items', { baseId: 'cap', rarity: 'common', count: ADMIN_ITEMS_MAX });
  ok(part.status === 200 && part.data.msg.includes('6/10') && part.data.msg.includes('กระเป๋าเต็ม'), `partly fits: ${part.data.msg}`);
  const full = await edit('items', { baseId: 'cap', rarity: 'common', count: 1 });
  ok(full.status === 400 && full.data.error === 'กระเป๋าเต็ม', 'full bag → "กระเป๋าเต็ม"');
  ok(saved(charId).bag.filter(Boolean).length === 30, 'bag has exactly 30 entries');

  // ---------------------------------------------------------- back online: lands in the new zone
  const c2 = joinWorld(plainTok, charId);
  await c2.ready;
  ok(c2.msgs.find((x) => x.t === 'welcome')?.zone === 'frost_reach', 'joins in the teleported zone');
  const tp = await edit('teleport', { zone: 'misty_marsh' });
  await sleep(300);
  ok(tp.status === 200 && c2.msgs.some((x) => x.t === 'zone' && x.zone === 'misty_marsh'), 'teleport online moves the player');
  c2.ws.close();

  // ---------------------------------------------------------- GM editing their own character
  const own = await api('POST', '/characters', { name: 'GmChar', classId: 'mage' }, gmTok);
  ok((await edit('level', { level: 25 }, gmTok, own.data.id)).status === 200, 'GM can edit their own character');

  // ---------------------------------------------------------- audit log
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const rows = db.prepare('SELECT * FROM admin_audit ORDER BY id').all() as any[];
  db.close();
  ok(rows.some((r) => r.admin_name === 'command line' && r.action === 'grant' && r.target === 'owner1'), 'audit: owner made from the command line');
  ok(rows.some((r) => r.admin_name === 'owner1' && r.action === 'grant' && r.target === 'gm1'), 'audit: owner granted GM');
  ok(rows.some((r) => r.admin_name === 'gm1' && r.action === 'gold' && r.target.includes('Tester') && r.details.includes(String(ADMIN_GOLD_MAX))),
    'audit: gold edit with who, target and details');
  ok(rows.some((r) => r.action === 'kick') && rows.some((r) => r.action === 'items') && rows.some((r) => r.action === 'teleport'), 'audit: kick, items, teleport');
  ok(rows.every((r) => r.at > 0), 'audit rows have a time');
  ok(!rows.some((r) => r.details.includes('999999')), 'refused edits are not logged');
  const log = await api('GET', '/admin/audit', undefined, ownerTok);
  ok(log.status === 200 && log.data.length === rows.length && log.data[0].id === rows.at(-1).id, 'owner reads the audit log, newest first');

  // ---------------------------------------------------------- revoke
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: null }, ownerTok)).status === 200, 'owner revokes GM');
  ok((await api('GET', '/admin/online', undefined, gmTok)).status === 403, 'revoked GM → 403 right away');
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).stack}`);
} finally {
  await stopServer();
}
finish('admin-server');
