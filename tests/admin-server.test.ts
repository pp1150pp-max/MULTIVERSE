// Admin API tests against a real game server that this script starts by itself on a free port with a
// throwaway database (never the real server or server/data), then stops: roles and 403s, GM can't
// grant roles, caps, online edits surviving the next save, offline edits, kick/teleport, audit log.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ADMIN_GOLD_MAX, ADMIN_ITEMS_MAX, BROADCAST_EVERY_MS, FEATURE_ROLES, HISTORY_DAYS } from '../src/shared/admin';
import { Db } from '../server/db';
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
  let closed = false;
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
  await sleep(1100);
  const played = async () => (await api('GET', '/admin/online', undefined, gmTok)).data.players.find((p: any) => p.charId === charId)?.playedMs as number;
  const beforeTp = await played();
  ok(beforeTp >= 1000 && beforeTp < 60_000, `online list shows time played this session (${beforeTp} ms)`);
  const tp = await edit('teleport', { zone: 'misty_marsh' });
  await sleep(300);
  ok(tp.status === 200 && c2.msgs.some((x) => x.t === 'zone' && x.zone === 'misty_marsh'), 'teleport online moves the player');
  ok((await played()) >= beforeTp, 'a zone change keeps counting the time played');
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

  // ---------------------------------------------------------- owner tools: who may use them
  const plainId = (await api('GET', '/admin/accounts', undefined, ownerTok)).data.rows.find((r: any) => r.username === 'plain1').accountId;
  const ownerId = (await api('GET', '/admin/accounts', undefined, ownerTok)).data.rows.find((r: any) => r.username === 'owner1').accountId;
  ok((await api('GET', '/admin/me', undefined, ownerTok)).data.features.length === Object.keys(FEATURE_ROLES).length, 'owner has every owner tool');
  ok(JSON.stringify((await api('GET', '/admin/me', undefined, gmTok)).data.features) === '["broadcast"]', 'GM has only the broadcast tool (FEATURE_ROLES)');
  const gmDenied: [string, string, unknown?][] = [
    ['GET', '/admin/accounts'], ['GET', `/admin/accounts/${plainId}`], ['POST', `/admin/accounts/${plainId}/password`],
    ['POST', `/admin/accounts/${plainId}/ban`, { duration: '1h', reason: 'x' }], ['POST', `/admin/accounts/${plainId}/unban`],
    ['GET', '/admin/backups'], ['POST', '/admin/backups'],
    ['DELETE', `/admin/accounts/${plainId}`, { confirm: 'plain1' }], ['DELETE', `/admin/characters/${charId}`, { confirm: 'Tester' }],
    ['GET', '/admin/sessions'], ['GET', `/admin/sessions?account=${plainId}`], ['GET', '/admin/stats'], ['GET', '/admin/chat'], ['DELETE', '/admin/chat/1'],
  ];
  for (const [m, path, body] of gmDenied) ok((await api(m, path, body, gmTok)).status === 403, `GM denied: ${m} ${path}`);
  ok((await api('GET', '/admin/accounts', undefined, plainTok)).status === 403, 'player denied: account list');

  // ---------------------------------------------------------- every account + details
  const accs = await api('GET', '/admin/accounts', undefined, ownerTok);
  const prow = accs.data.rows.find((r: any) => r.accountId === plainId);
  ok(accs.status === 200 && accs.data.summary.accounts === 3 && accs.data.summary.characters === 3 && accs.data.summary.guests === 1 && accs.data.summary.signupsToday === 3,
    `summary numbers (${JSON.stringify(accs.data.summary)})`);
  ok(prow && prow.characters === 1 && prow.names[0] === 'Tester' && prow.maxLevel === MAX_LEVEL && !prow.guest && prow.role === null && prow.lastOnline > 0,
    'account row: characters, max level, last online');
  const det = await api('GET', `/admin/accounts/${plainId}`, undefined, ownerTok);
  ok(det.status === 200 && det.data.characters[0].bag.length === 30 && det.data.characters[0].bag.filter(Boolean).length === 30 && det.data.characters[0].equipment.weapon,
    'account details: bag and equipment');

  // ---------------------------------------------------------- broadcast
  const b1 = joinWorld(plainTok, charId);
  await b1.ready;
  const bc = await api('POST', '/admin/broadcast', { text: 'ทดสอบประกาศ' }, ownerTok);
  await sleep(300);
  ok(bc.status === 200 && b1.msgs.some((m) => m.t === 'announce' && m.text === 'ทดสอบประกาศ'), 'broadcast delivered to players');
  ok((await api('POST', '/admin/broadcast', { text: 'x'.repeat(201) }, ownerTok)).status === 400, 'broadcast over the length cap refused');
  ok((await api('POST', '/admin/broadcast', { text: '   ' }, ownerTok)).status === 400, 'empty broadcast refused');
  ok((await api('POST', '/admin/broadcast', { text: 'hi' }, plainTok)).status === 403, 'player cannot broadcast');

  // GM: to one player (only they get it), rate limit, then to everyone.
  const g1 = joinWorld(gmTok, own.data.id);
  await g1.ready;
  const toOne = await api('POST', '/admin/broadcast', { text: '<b>ถึงคุณคนเดียว</b>', to: charId }, gmTok);
  await sleep(300);
  const got = b1.msgs.find((m) => m.t === 'announce' && m.direct);
  ok(toOne.status === 200 && got && got.text === '<b>ถึงคุณคนเดียว</b>' && got.from === 'GM gm1', `GM sends to one player, with the sender's name (${JSON.stringify(got)})`);
  ok(!g1.msgs.some((m) => m.t === 'announce'), 'nobody else gets a message to one player');
  const tooSoon = await api('POST', '/admin/broadcast', { text: 'ทุกคน' }, gmTok);
  ok(tooSoon.status === 429, `second announcement within 3 s refused (${tooSoon.data.error})`);
  await sleep(BROADCAST_EVERY_MS + 100);
  ok((await api('POST', '/admin/broadcast', { text: 'x', to: 999999 }, gmTok)).status === 400, 'player not online → 400');
  await sleep(BROADCAST_EVERY_MS + 100);
  const toAll = await api('POST', '/admin/broadcast', { text: 'ทุกคนฟังทางนี้' }, gmTok);
  await sleep(300);
  ok(toAll.status === 200 && [b1, g1].every((c) => c.msgs.some((m) => m.t === 'announce' && !m.direct && m.text === 'ทุกคนฟังทางนี้' && m.from === 'GM gm1')),
    'GM sends to everyone');
  g1.ws.close();
  const bcLog = new DatabaseSync(DB_FILE, { readOnly: true });
  const bcRows = bcLog.prepare("SELECT admin_name, target, details FROM admin_audit WHERE action = 'broadcast'").all() as any[];
  bcLog.close();
  ok(bcRows.some((r) => r.admin_name === 'gm1' && r.target.startsWith('Tester') && r.details === '<b>ถึงคุณคนเดียว</b>')
    && bcRows.some((r) => r.admin_name === 'gm1' && r.target === 'ทุกคน'), 'announcements logged with sender, target and text');

  // ---------------------------------------------------------- history: this play session and its chat are recorded
  b1.send({ t: 'client', gpu: 'Test GPU 9000' });
  for (let k = 0; k < 3; k++) {
    b1.send({ t: 'ping', id: 1000 + k, rtt: 50 + k * 10, fps: 60, maxFrame: 20, wait: 0 });
    await sleep(800);
  }
  b1.send({ t: 'chat', text: 'สวัสดีทุกคน hello' });
  await sleep(700);
  b1.send({ t: 'chat', text: 'ข้อความที่สอง' });
  await sleep(300);
  const live = await api('GET', `/admin/sessions?account=${plainId}`, undefined, ownerTok);
  ok(live.status === 200 && live.data[0]?.online === true && live.data[0].charName === 'Tester' && live.data[0].leftAt === null, 'play session recorded while playing');

  // ---------------------------------------------------------- reset password
  const rp = await api('POST', `/admin/accounts/${plainId}/password`, undefined, ownerTok);
  await sleep(300);
  ok(rp.status === 200 && typeof rp.data.password === 'string' && rp.data.password.length >= 6, 'temporary password returned once');
  ok(b1.isClosed(), 'player kicked after a password reset');
  ok((await api('POST', '/login', { username: 'plain1', password: 'secret123' })).status === 401, 'old password no longer works');
  const relog = await api('POST', '/login', { username: 'plain1', password: rp.data.password });
  ok(relog.status === 200, 'temporary password logs in');
  const plainTok2: string = relog.data.token;
  const done = (await api('GET', `/admin/sessions?account=${plainId}`, undefined, ownerTok)).data[0];
  ok(done && !done.online && done.leftAt >= done.joinedAt && done.gpu === 'Test GPU 9000' && done.avgRtt === 60 && done.avgFps === 60 && typeof done.ip === 'string',
    `play session closed with GPU, average ping and FPS (${JSON.stringify(done)})`);
  const allSessions = await api('GET', '/admin/sessions', undefined, ownerTok);
  ok(allSessions.status === 200 && allSessions.data.length >= 3, `recent sessions list (${allSessions.data.length})`);
  const chats = await api('GET', '/admin/chat?q=hello', undefined, ownerTok);
  ok(chats.status === 200 && chats.data.length === 1 && chats.data[0].charName === 'Tester' && chats.data[0].username === 'plain1' && chats.data[0].zone,
    'chat recorded and searchable by text');
  ok((await api('GET', '/admin/chat?q=Tester', undefined, ownerTok)).data.length === 2, 'chat searchable by character name');
  ok((await api('GET', '/admin/chat?q=%25', undefined, ownerTok)).data.length === 0, 'a typed % is not a wildcard in chat search');
  const delChat = await api('DELETE', `/admin/chat/${chats.data[0].id}`, undefined, ownerTok);
  ok(delChat.status === 200 && (await api('GET', '/admin/chat?q=hello', undefined, ownerTok)).data.length === 0, 'owner deletes a chat message');
  ok((await api('DELETE', `/admin/chat/${chats.data[0].id}`, undefined, ownerTok)).status === 404, 'deleting it again → 404');
  const st = await api('GET', '/admin/stats?range=24h', undefined, ownerTok);
  ok(st.status === 200 && st.data.online.length >= 1 && st.data.since > 0 && st.data.signups.length >= 30 && st.data.signups.some((p: any) => p.v === 3),
    `stats: minute samples and sign-ups per day (${st.data.online.length} points)`);
  ok(st.data.avgPing.length >= 1 && st.data.avgLevel.length >= 1, 'stats: average ping and level from the samples');
  const guestAcc = accs.data.rows.find((r: any) => r.guest);
  ok((await api('POST', `/admin/accounts/${guestAcc.accountId}/password`, undefined, ownerTok)).status === 400, 'guest has no password to reset');
  ok((await api('POST', `/admin/accounts/${ownerId}/password`, undefined, ownerTok)).status === 200, 'owner may reset their own password');

  // ---------------------------------------------------------- ban / unban
  const ownerLogin = await api('GET', '/admin/me', undefined, ownerTok);
  ok(ownerLogin.status === 401, 'own password reset ended the owner\'s login too');
  // Log the owner back in through the DB (the temp password went to the page).
  const tdb = new DatabaseSync(DB_FILE);
  tdb.prepare('INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)').run('owner-test-token', ownerId, Date.now() + 3600e3);
  const ot = 'owner-test-token';
  const b2 = joinWorld(plainTok2, charId);
  await b2.ready;
  ok((await api('POST', `/admin/accounts/${ownerId}/ban`, { duration: '1h', reason: 'x' }, ot)).status === 400, 'cannot ban yourself');
  ok((await api('POST', `/admin/accounts/${plainId}/ban`, { duration: '2h', reason: 'x' }, ot)).status === 400, 'unknown ban length refused');
  ok((await api('POST', `/admin/accounts/${plainId}/ban`, { duration: '1h', reason: '' }, ot)).status === 400, 'ban without a reason refused');
  const ban = await api('POST', `/admin/accounts/${plainId}/ban`, { duration: '1d', reason: 'สแปมแชท' }, ot);
  await sleep(300);
  ok(ban.status === 200 && ban.data.account.bannedUntil > Date.now(), 'owner bans for a day');
  const bk = b2.msgs.find((m) => m.t === 'kick');
  ok(b2.isClosed() && bk && bk.msg.includes('ถูกระงับ') && bk.msg.includes('สแปมแชท'), `online player kicked with the reason (${bk?.msg})`);
  const banLogin = await api('POST', '/login', { username: 'plain1', password: rp.data.password });
  ok(banLogin.status === 403 && banLogin.data.error.includes('สแปมแชท') && banLogin.data.error.includes('ถึง'), `banned login refused (${banLogin.data.error})`);
  ok((await api('POST', '/login', { username: 'plain1', password: 'wrong-one' })).status === 401, 'wrong password still says wrong password (ban not revealed)');
  tdb.prepare('INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)').run('banned-token', plainId, Date.now() + 3600e3);
  const b3 = joinWorld('banned-token', charId);
  await b3.ready;
  ok(b3.msgs.some((m) => m.t === 'kick' && m.msg.includes('ถูกระงับ')) && !b3.msgs.some((m) => m.t === 'snap'), 'banned account cannot join the world');
  const unban = await api('POST', `/admin/accounts/${plainId}/unban`, undefined, ot);
  ok(unban.status === 200 && unban.data.account.bannedUntil === null, 'unban');
  ok((await api('POST', '/login', { username: 'plain1', password: rp.data.password })).status === 200, 'login works again after unban');
  ok((await api('POST', `/admin/accounts/${plainId}/ban`, { duration: 'perm', reason: 'ถาวร' }, ot)).status === 200, 'permanent ban');
  const permLogin = await api('POST', '/login', { username: 'plain1', password: rp.data.password });
  ok(permLogin.status === 403 && permLogin.data.error.includes('ถาวร'), 'permanent ban message');
  await api('POST', `/admin/accounts/${plainId}/unban`, undefined, ot);

  // ---------------------------------------------------------- backups
  const bdir = join(dir, 'backups');
  const list0 = await api('GET', '/admin/backups', undefined, ot);
  ok(list0.status === 200 && list0.data.some((b: any) => b.kind === 'daily' && b.size > 0), 'daily backup made at start');
  for (let k = 0; k < 11; k++) await api('POST', '/admin/backups', undefined, ot);
  const files = readdirSync(bdir);
  ok(files.filter((f) => f.endsWith('-manual.db')).length === 10, `manual backups rotated to 10 (${files.length} files)`);
  const copy = new DatabaseSync(join(bdir, files.find((f) => f.endsWith('-manual.db'))!), { readOnly: true });
  ok((copy.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n >= 3, 'a backup is a working database');
  copy.close();

  // ---------------------------------------------------------- delete
  ok((await api('DELETE', `/admin/accounts/${ownerId}`, { confirm: 'owner1' }, ot)).status === 400, 'cannot delete the owner account');
  const vTok = (await api('POST', '/register', { username: 'victim1', password: 'secret123' })).data.token;
  const vChar = (await api('POST', '/characters', { name: 'Victim', classId: 'mage' }, vTok)).data.id;
  const vId = (await api('GET', '/admin/accounts', undefined, ot)).data.rows.find((r: any) => r.username === 'victim1').accountId;
  const v = joinWorld(vTok, vChar);
  await v.ready;
  ok((await api('DELETE', `/admin/accounts/${vId}`, { confirm: 'victim' }, ot)).status === 400, 'delete needs the exact name typed');
  const before = readdirSync(bdir).filter((f) => f.endsWith('-before-delete.db')).length;
  const del = await api('DELETE', `/admin/accounts/${vId}`, { confirm: 'Victim1' }, ot);
  await sleep(300);
  ok(del.status === 200 && v.isClosed(), 'owner deletes an account; the online player is kicked first');
  ok(readdirSync(bdir).filter((f) => f.endsWith('-before-delete.db')).length === before + 1, 'backup made before the delete');
  ok(!tdb.prepare('SELECT 1 FROM accounts WHERE id = ?').get(vId) && !tdb.prepare('SELECT 1 FROM characters WHERE id = ?').get(vChar), 'account and characters gone');
  const backupHasVictim = new DatabaseSync(join(bdir, readdirSync(bdir).filter((f) => f.endsWith('-before-delete.db')).sort().at(-1)!), { readOnly: true });
  ok(!!backupHasVictim.prepare("SELECT 1 FROM accounts WHERE username = 'victim1'").get(), 'the backup still has the deleted account');
  backupHasVictim.close();
  ok((await api('DELETE', `/admin/characters/${charId}`, { confirm: 'nope' }, ot)).status === 400, 'character delete needs its name');
  ok((await api('DELETE', `/admin/characters/${charId}`, { confirm: 'tester' }, ot)).status === 200 && !tdb.prepare('SELECT 1 FROM characters WHERE id = ?').get(charId),
    'owner deletes a character');
  const tools = tdb.prepare("SELECT action, details FROM admin_audit WHERE action IN ('broadcast','password','ban','unban','backup','delete-account','delete-character','chat-delete')").all() as any[];
  ok(['broadcast', 'password', 'ban', 'unban', 'backup', 'delete-account', 'delete-character', 'chat-delete'].every((a) => tools.some((t) => t.action === a)), 'every owner tool is in the audit log');
  // Old history is deleted by its age.
  tdb.prepare('INSERT INTO chat_log (at, account_id, username, char_name, zone, text) VALUES (?, 1, ?, ?, ?, ?)').run(Date.now() - 31 * 864e5, 'old', 'Old', 'emerald_forest', 'old message');
  tdb.prepare('INSERT INTO play_sessions (account_id, username, char_id, char_name, joined_at, ip) VALUES (1, ?, 1, ?, ?, ?)').run('old', 'Old', Date.now() - 91 * 864e5, '1.2.3.4');
  ok(!tools.some((t) => t.details.includes(rp.data.password)), 'the temporary password is never logged');
  tdb.close();

  // ---------------------------------------------------------- revoke
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: null }, 'owner-test-token')).status === 200, 'owner revokes GM');
  ok((await api('GET', '/admin/online', undefined, gmTok)).status === 403, 'revoked GM → 403 right away');
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).stack}`);
} finally {
  // Retention, on the same database (server stopped): only the rows planted above are old enough.
  try {
    const dbx = new Db(DB_FILE);
    const gone = dbx.pruneHistory(Date.now(), HISTORY_DAYS);
    ok(gone === 2 && dbx.chatLog(10, 'old message').length === 0, `old chat (> ${HISTORY_DAYS.chat} d) and sessions (> ${HISTORY_DAYS.sessions} d) deleted (${gone})`);
    ok(dbx.chatLog(10, 'ข้อความที่สอง').length === 1, 'recent chat kept');
    dbx.close();
  } catch (e) {
    ok(false, `retention check crashed: ${(e as Error).message}`);
  }
  await stopServer();
}
finish('admin-server');
