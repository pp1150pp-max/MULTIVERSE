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
import { MAX_PLUS } from '../src/shared/data/enhance';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-admin-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** What gm may use when the owner changed nothing (FEATURE_ROLES). */
const GM_DEFAULT = (Object.keys(FEATURE_ROLES) as (keyof typeof FEATURE_ROLES)[]).filter((f) => FEATURE_ROLES[f].includes('gm')) as string[];

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
  ok(online.data.zones.find((z: any) => z.id === 'nexus_city')?.count === 1, 'online count per zone (everyone starts in the hub)');
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
  ok((await edit('items', { baseId: 'weapon_1', rarity: 'rare', plus: MAX_PLUS + 1 })).status === 400, 'plus over the max refused');
  ok((await edit('teleport', { zone: 'nowhere' })).status === 400, 'unknown zone refused');
  // Potions and stones: every field checked.
  const badStacks: [unknown, string][] = [
    [{ kind: 'gem', count: 1 }, 'ประเภทไอเทมไม่ถูกต้อง'],
    [{ kind: 'potion', potion: 'sp', size: 's', count: 1 }, 'ชนิดยาไม่ถูกต้อง'],
    [{ kind: 'potion', potion: 'hp', size: 'xl', count: 1 }, 'ขนาดยาไม่ถูกต้อง'],
    [{ kind: 'potion', potion: 'hp', count: 1 }, 'ขนาดยาไม่ถูกต้อง'],
    [{ kind: 'stone', stone: 'gold', count: 1 }, 'ชนิดหินไม่ถูกต้อง'],
    [{ kind: 'stone', stone: 'enhance', count: 0 }, 'จำนวนชิ้น'],
    [{ kind: 'stone', stone: 'enhance', count: ADMIN_ITEMS_MAX + 1 }, 'จำนวนชิ้น'],
    [{ kind: 'potion', potion: 'mp', size: 'l', count: 2.5 }, 'จำนวนชิ้น'],
    [{ kind: 'potion', potion: 'mp', size: 'l', count: '3' }, 'จำนวนชิ้น'],
  ];
  for (const [body, err] of badStacks) {
    const r = await edit('items', body);
    ok(r.status === 400 && String(r.data.error).startsWith(err), `bad potion/stone refused: ${JSON.stringify(body)} (${r.status} ${r.data.error})`);
  }
  ok((await edit('gold', { delta: 5 }, gmTok, 999999)).status === 404, 'unknown character → 404');
  ok(c.lastMe().gold === 0, 'nothing changed by refused edits');

  // ---------------------------------------------------------- online edits go to the live character
  const lv = await edit('level', { level: 20, exp: 100 });
  ok(lv.status === 200 && lv.data.char.level === 20, `set level 20 online (${lv.status} ${lv.data.error ?? ''})`);
  const gold = await edit('gold', { delta: ADMIN_GOLD_MAX });
  ok(gold.status === 200 && gold.data.char.gold === ADMIN_GOLD_MAX, 'give gold at the cap');
  const items = await edit('items', { baseId: 'weapon_5', rarity: 'legendary', plus: 7, count: 2 });
  ok(items.status === 200 && items.data.char.bagFree === 30 - 2 - 2, `spawn 2 items (${items.data.msg})`);
  await sleep(400);
  const m = c.lastMe();
  ok(m.level === 20 && m.exp === 100 && m.gold === ADMIN_GOLD_MAX, 'the player sees the new level and gold');
  ok(m.stats.maxHp > 100, `stats recomputed for the new level (maxHp ${m.stats.maxHp})`);
  const bagNow = c.msgs.filter((x) => x.t === 'snap' && x.me.inv).at(-1)?.me.inv.bag ?? [];
  const spawned = bagNow.filter((e: any) => e?.baseId === 'weapon_5');
  ok(spawned.length === 2 && spawned.every((e: any) => e.plus === 7 && e.rarity === 'legendary' && e.level === 20 && e.cls === 'sword' && e.lines?.length),
    'spawned items are real items (+7, legendary, Lv.20, class, stat lines)');
  ok(c.msgs.some((x) => x.t === 'chat' && x.name === '' && x.text === 'GM ปรับเลเวลเป็น 20'), 'the player gets the Thai GM message');
  // The game's own next save (here: sorting the bag) must keep the edit.
  c.send({ t: 'act', a: 'sort', key: 'rarity', desc: true });
  await sleep(2600);
  let d = saved(charId);
  ok(d.level === 20 && d.gold === ADMIN_GOLD_MAX && d.bag.filter((e: any) => e?.baseId === 'weapon_5').length === 2,
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
  const short = await edit('gold', { delta: -5 });
  ok(short.status === 400 && short.data.error === 'ทองไม่พอ (มี 0 G)', `taking more gold than there is refused (${short.data.error})`);
  // Item level below the item type's own minimum (weapon_2 starts at Lv.5) is raised to it.
  const low = await edit('items', { baseId: 'weapon_2', rarity: 'common', count: 1, level: 1 });
  const lowItem = saved(charId).bag.find((e: any) => e?.baseId === 'weapon_2');
  ok(low.status === 200 && low.data.msg.includes('ปรับเลเวลไอเทมเป็น Lv.5 (ขั้นต่ำของชนิดนี้)') && lowItem?.level === 5,
    `item level raised to the type's minimum (${low.data.msg}, Lv.${lowItem?.level})`);
  ok((await edit('level', { level: MAX_LEVEL, exp: 5 })).status === 200 && saved(charId).level === MAX_LEVEL && saved(charId).exp === 0,
    'offline level to max (EXP 0 at max)');
  ok((await edit('teleport', { zone: 'frost_reach' })).status === 400, 'teleport offline refused (they log in to the hub anyway)');
  // 30 slots: 2 potion stacks + 3 items used, 25 free.
  for (let k = 0; k < 2; k++) await edit('items', { baseId: 'cap', rarity: 'common', count: ADMIN_ITEMS_MAX });
  const part = await edit('items', { baseId: 'cap', rarity: 'common', count: ADMIN_ITEMS_MAX });
  ok(part.status === 200 && part.data.msg.includes('5/10') && part.data.msg.includes('กระเป๋าเต็ม'), `partly fits: ${part.data.msg}`);
  const full = await edit('items', { baseId: 'cap', rarity: 'common', count: 1 });
  ok(full.status === 400 && full.data.error === 'กระเป๋าเต็ม', 'full bag → "กระเป๋าเต็ม"');
  ok(saved(charId).bag.filter(Boolean).length === 30, 'bag has exactly 30 entries');
  // Full bag, but the starting stack of 5 small HP potions has room for 5 more (owner, offline).
  const potPart = await edit('items', { kind: 'potion', potion: 'hp', size: 's', count: ADMIN_ITEMS_MAX }, ownerTok);
  const hpStack = saved(charId).bag.filter((e: any) => e?.potion === 'hp' && e.size === 's');
  ok(potPart.status === 200 && potPart.data.msg === 'ใส่ได้ 5/10 ชิ้น — กระเป๋าเต็ม (ยา HP เล็ก)' && hpStack.length === 1 && hpStack[0].count === 10,
    `potions top up the stack, the rest refused (${potPart.data.msg})`);
  const potFull = await edit('items', { kind: 'potion', potion: 'hp', size: 's', count: 1 }, ownerTok);
  ok(potFull.status === 400 && potFull.data.error === 'กระเป๋าเต็ม', 'potion into a full bag (stack full too) → "กระเป๋าเต็ม"');
  const stoneFull = await edit('items', { kind: 'stone', stone: 'protect', count: 1 }, ownerTok);
  ok(stoneFull.status === 400 && stoneFull.data.error === 'กระเป๋าเต็ม', 'stone into a full bag → "กระเป๋าเต็ม"');
  ok(saved(charId).bag.filter(Boolean).length === 30 && !saved(charId).bag.some((e: any) => e?.stone), 'refused stacks changed nothing');

  // ---------------------------------------------------------- back online: always in the hub
  const c2 = joinWorld(plainTok, charId);
  await c2.ready;
  ok(c2.msgs.find((x) => x.t === 'welcome')?.zone === 'nexus_city', 'joins in the hub');
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
  // Potions and stones online (GM and owner), stacked like a pickup and kept by the game's next save.
  const gc = joinWorld(gmTok, own.data.id);
  await gc.ready;
  await sleep(300);
  const gmPot = await edit('items', { kind: 'potion', potion: 'mp', size: 'm', count: ADMIN_ITEMS_MAX }, gmTok, own.data.id);
  ok(gmPot.status === 200 && gmPot.data.msg === 'เสกให้ 10 ชิ้น: ยา MP กลาง', `GM spawns 10 potions online (${gmPot.data.msg ?? gmPot.data.error})`);
  const gmStone = await edit('items', { kind: 'stone', stone: 'protect', count: 3 }, gmTok, own.data.id);
  ok(gmStone.status === 200 && gmStone.data.msg === 'เสกให้ 3 ชิ้น: หินกันระดับลด', `GM spawns 3 stones online (${gmStone.data.msg ?? gmStone.data.error})`);
  const ownStone = await edit('items', { kind: 'stone', stone: 'protect', count: ADMIN_ITEMS_MAX }, ownerTok, own.data.id);
  ok(ownStone.status === 200 && ownStone.data.char.bagFree === 30 - 2 - 1 - 2, `owner spawns 10 stones: 3+10 = a full stack + 3 (${ownStone.data.char.bagFree} free)`);
  ok((await edit('items', { kind: 'stone', stone: 'enhance', count: 2 }, ownerTok, own.data.id)).status === 200, 'owner spawns enhance stones');
  await sleep(400);
  const gBag = gc.msgs.filter((x) => x.t === 'snap' && x.me.inv).at(-1)?.me.inv.bag ?? [];
  const counts = (pred: (e: any) => boolean) => gBag.filter((e: any) => e && pred(e)).map((e: any) => e.count).sort((a: number, b: number) => b - a).join(',');
  ok(counts((e) => e.potion === 'mp' && e.size === 'm') === '10' && counts((e) => e.stone === 'protect') === '10,3' && counts((e) => e.stone === 'enhance') === '2',
    `the player sees the stacks (mp m ${counts((e) => e.potion === 'mp' && e.size === 'm')}, protect ${counts((e) => e.stone === 'protect')})`);
  ok(gc.msgs.some((x) => x.t === 'chat' && x.name === '' && x.text === 'GM มอบ หินกันระดับลด × 3'), 'the player gets the Thai GM message for stones');
  gc.send({ t: 'act', a: 'sort', key: 'rarity', desc: true });
  await sleep(2600);
  const gSaved = saved(own.data.id).bag.filter(Boolean);
  ok(gSaved.filter((e: any) => e.stone === 'protect').reduce((n: number, e: any) => n + e.count, 0) === 13
    && gSaved.some((e: any) => e.potion === 'mp' && e.size === 'm' && e.count === 10), 'spawned potions/stones survive the next save');
  gc.ws.close();
  await sleep(300);

  // ---------------------------------------------------------- GM scope: not the owner's, not another GM's
  const SCOPE = 'GM แก้ไขตัวละครของ owner หรือ GM คนอื่นไม่ได้';
  const ownerChar: number = (await api('POST', '/characters', { name: 'OwnerChar', classId: 'sword' }, ownerTok)).data.id;
  const gm2Tok = await account('gm2');
  await api('POST', '/admin/roles', { username: 'gm2', role: 'gm' }, ownerTok);
  const gm2Char: number = (await api('POST', '/characters', { name: 'GmTwo', classId: 'gunslinger' }, gm2Tok)).data.id;
  const tries: [string, unknown][] = [
    ['level', { level: 10 }], ['gold', { delta: 100 }], ['items', { baseId: 'cap', rarity: 'common', count: 1 }],
    ['items', { kind: 'potion', potion: 'hp', size: 'l', count: 1 }], ['items', { kind: 'stone', stone: 'enhance', count: 1 }],
    ['teleport', { zone: 'misty_marsh' }], ['kick', {}],
  ];
  for (const [what, body] of tries) {
    const o = await edit(what, body, gmTok, ownerChar);
    ok(o.status === 403 && o.data.error === SCOPE, `GM ${what} on the owner's character → 403 (${o.status} ${o.data.error})`);
    const g2 = await edit(what, body, gmTok, gm2Char);
    ok(g2.status === 403 && g2.data.error === SCOPE, `GM ${what} on another GM's character → 403 (${g2.status})`);
  }
  ok(saved(ownerChar).level === 1 && saved(ownerChar).gold === 0 && saved(gm2Char).level === 1, 'refused GM edits changed nothing');
  ok((await edit('level', { level: 10 }, ownerTok, gm2Char)).status === 200 && saved(gm2Char).level === 10, "owner can still edit a GM's character");
  ok((await edit('gold', { delta: 100 }, ownerTok, ownerChar)).status === 200, 'owner can edit their own character');

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
  ok(!rows.some((r) => r.action === 'gold' && r.details.startsWith('0 → 0')), 'no "0 → 0" gold row for a refused take');
  ok(rows.some((r) => r.action === 'items' && r.details.includes('ขั้นต่ำของชนิดนี้')), 'audit: item level raise is noted');
  ok(rows.some((r) => r.admin_name === 'owner1' && r.action === 'items' && r.details === 'ยา HP เล็ก × 5 (ขอ 10, กระเป๋าเต็ม)'), 'audit: potion spawn, partly fitting');
  ok(rows.some((r) => r.admin_name === 'gm1' && r.action === 'items' && r.target.includes('GmChar') && r.details === 'หินกันระดับลด × 3'), 'audit: GM stone spawn');
  ok(!rows.some((r) => r.target.includes('OwnerChar') && r.admin_name === 'gm1'), "refused GM edits on the owner's character are not logged");
  const log = await api('GET', '/admin/audit', undefined, ownerTok);
  ok(log.status === 200 && log.data.length === rows.length && log.data[0].id === rows.at(-1).id, 'owner reads the audit log, newest first');

  // ---------------------------------------------------------- owner tools: who may use them
  const plainId = (await api('GET', '/admin/accounts', undefined, ownerTok)).data.rows.find((r: any) => r.username === 'plain1').accountId;
  const ownerId = (await api('GET', '/admin/accounts', undefined, ownerTok)).data.rows.find((r: any) => r.username === 'owner1').accountId;
  ok((await api('GET', '/admin/me', undefined, ownerTok)).data.features.length === Object.keys(FEATURE_ROLES).length, 'owner has every owner tool');
  ok(JSON.stringify((await api('GET', '/admin/me', undefined, gmTok)).data.features) === JSON.stringify(GM_DEFAULT), 'GM has only its FEATURE_ROLES tools (the base tools, broadcast, orb bench, channel warp, reports, cosmetics bench, card view, balance tab)');
  ok(GM_DEFAULT.join() === 'online,charView,charEdit,kick,teleport,broadcast,orbPreview,channelWarp,reports,cosPreview,cardView,balance,itemEdit', `GM defaults: the base tools plus what the owner gave GMs since (card view, balance and item edit 2026-11-11) (${GM_DEFAULT.join()})`);
  const trades = await api('GET', '/admin/trades', undefined, ownerTok);
  ok(trades.status === 200 && Array.isArray(trades.data) && (await api('GET', '/admin/trades?q=x%25', undefined, ownerTok)).status === 200, 'owner reads the trade log (and a search with odd characters is fine)');
  const gmDenied: [string, string, unknown?][] = [
    ['GET', '/admin/accounts'], ['GET', `/admin/accounts/${plainId}`], ['POST', `/admin/accounts/${plainId}/password`],
    ['POST', `/admin/accounts/${plainId}/ban`, { duration: '1h', reason: 'x' }], ['POST', `/admin/accounts/${plainId}/unban`],
    ['GET', '/admin/backups'], ['POST', '/admin/backups'],
    ['DELETE', `/admin/accounts/${plainId}`, { confirm: 'plain1' }], ['DELETE', `/admin/characters/${charId}`, { confirm: 'Tester' }],
    ['GET', '/admin/trades'], ['GET', '/admin/sessions'], ['GET', `/admin/sessions?account=${plainId}`], ['GET', '/admin/stats'], ['GET', '/admin/chat'], ['DELETE', '/admin/chat/1'],
  ];
  for (const [m, path, body] of gmDenied) ok((await api(m, path, body, gmTok)).status === 403, `GM denied: ${m} ${path}`);
  ok((await api('GET', '/admin/accounts', undefined, plainTok)).status === 403, 'player denied: account list');

  // ---------------------------------------------------------- every account + details
  const accs = await api('GET', '/admin/accounts', undefined, ownerTok);
  const prow = accs.data.rows.find((r: any) => r.accountId === plainId);
  ok(accs.status === 200 && accs.data.summary.accounts === 4 && accs.data.summary.characters === 5 && accs.data.summary.guests === 1 && accs.data.summary.signupsToday === 4,
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
  ok(live.status === 200 && live.data.rows[0]?.online === true && live.data.rows[0].charName === 'Tester' && live.data.rows[0].leftAt === null, 'play session recorded while playing');

  // ---------------------------------------------------------- play-session data table: sort, pages, search, dates
  const now0 = Date.now();
  const fakeAt = (i: number) => now0 - 5 * 864e5 + i * 60000;
  {
    const fdb = new DatabaseSync(DB_FILE);
    const ins = fdb.prepare(`INSERT INTO play_sessions (account_id, username, guest, char_id, char_name, joined_at, left_at, ip, gpu, avg_rtt, avg_fps)
      VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`);
    // 60 rows: newer ones played shorter; the newest has no end (server stopped), some lack GPU / ping.
    for (let i = 0; i < 60; i++) {
      ins.run(900000 + (i % 3), `fk-user${i}`, 900000 + i, `FkChar${i}`, fakeAt(i), i === 59 ? null : fakeAt(i) + (60 - i) * 60000,
        `10.9.0.${i}`, i % 10 === 0 ? null : `GPU ${i % 5}`, i % 7 === 0 ? null : i, 30 + i);
    }
    // plain1: one unknown-length session long ago and one that lasted half a second.
    ins.run(plainId, 'plain1', 1, 'Tester', now0 - 30 * 864e5, null, '127.0.0.9', null, null, null);
    ins.run(plainId, 'plain1', 1, 'Tester', now0 - 864e5, now0 - 864e5 + 500, '127.0.0.8', null, null, null);
    fdb.close();
  }
  const sp = async (qs: string, tok = ownerTok) => api('GET', `/admin/sessions?${qs}`, undefined, tok);
  const chars = (r: any) => r.data.rows.map((x: any) => x.charName);
  const p1 = await sp('q=fk-');
  ok(p1.status === 200 && p1.data.total === 60 && p1.data.rows.length === 25 && p1.data.page === 1 && chars(p1)[0] === 'FkChar59' && chars(p1)[24] === 'FkChar35',
    `default: newest first, 25 a page (${p1.data.total}, ${chars(p1)[0]})`);
  const p3 = await sp('q=fk-&page=3');
  ok(p3.data.rows.length === 10 && chars(p3)[9] === 'FkChar0', 'page 3 holds the last 10');
  ok((await sp('q=fk-&page=99')).data.page === 3, 'a page past the end → the last page');
  const big = await sp('q=fk-&size=50&dir=asc&sort=joined');
  ok(big.data.rows.length === 50 && chars(big)[0] === 'FkChar0' && big.data.size === 50, 'size 50, oldest first');
  ok((await sp('q=fk-&size=100')).data.rows.length === 60, 'size 100');
  const durAsc = await sp('q=fk-&sort=duration&dir=asc&size=100');
  const durDesc = await sp('q=fk-&sort=duration&dir=desc&size=100');
  ok(chars(durAsc)[0] === 'FkChar58' && chars(durAsc)[59] === 'FkChar59' && chars(durDesc)[0] === 'FkChar0' && chars(durDesc)[59] === 'FkChar59',
    'sort by length both ways; unknown length always last');
  const pingDesc = await sp('q=fk-&sort=ping&dir=desc&size=100');
  ok(pingDesc.data.rows[0].avgRtt === 59 && pingDesc.data.rows.slice(-9).every((r: any) => r.avgRtt === null) && pingDesc.data.rows[50].avgRtt !== null,
    'sort by ping; no ping last');
  const gpuAsc = await sp('q=fk-&sort=gpu&dir=asc&size=100');
  ok(gpuAsc.data.rows[0].gpu === 'GPU 0' && gpuAsc.data.rows.at(-1).gpu === null, 'sort by GPU; no GPU last');
  ok((await sp('q=fk-&sort=username&dir=asc')).data.rows[0].username === 'fk-user0' && (await sp('q=fk-&sort=fps&dir=desc')).data.rows[0].avgFps === 89
    && (await sp('q=fk-&sort=ip&dir=desc')).data.rows[0].ip === '10.9.0.9' && chars(await sp('q=fk-&sort=char&dir=desc'))[0] === 'FkChar9',
    'sort by username, FPS, IP, character');
  const mine = await sp(`account=${plainId}&sort=duration&dir=asc&size=100`);
  const mineDesc = await sp(`account=${plainId}&sort=duration&dir=desc&size=100`);
  const at = (r: any, pred: (x: any) => boolean) => r.data.rows.findIndex(pred);
  ok(mine.data.rows.every((r: any) => r.accountId === plainId) && mine.data.rows.at(-1).ip === '127.0.0.9' && mineDesc.data.rows.at(-1).ip === '127.0.0.9'
    && at(mine, (r) => r.ip === '127.0.0.8') < at(mine, (r) => r.online) && at(mineDesc, (r) => r.online) < at(mineDesc, (r) => r.ip === '127.0.0.8'),
    'one account; a session still playing counts up to now');
  ok((await sp('q=FkChar5&size=100')).data.total === 11 && (await sp('q=fkchar5')).data.total === 11, 'search by character name, any case');
  ok((await sp('q=10.9.0.4')).data.total === 11 && (await sp('q=fk-user1')).data.total === 11, 'search by IP and by username');
  ok((await sp('q=%25')).data.total === 0 && (await sp('q=fk_user')).data.total === 0 && (await sp('q=fk-%25')).data.total === 0, 'typed % and _ are not wildcards');
  ok((await sp(`q=fk-&from=${fakeAt(10)}&to=${fakeAt(20)}`)).data.total === 10 && (await sp(`q=fk-&from=${fakeAt(50)}`)).data.total === 10
    && (await sp(`q=fk-&to=${fakeAt(5)}`)).data.total === 5, 'date range: from (inclusive) and to (exclusive)');
  ok((await sp('account=900000&q=fk-')).data.total === 20, 'account filter plus search');
  const badSession = [
    'sort=id', 'sort=joined_at', 'sort=duration;DROP TABLE play_sessions', 'dir=up', 'page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=1e3',
    'size=10', 'size=1000', 'size=25.0', 'sort=', `q=${'x'.repeat(51)}`, 'from=abc', 'from=-5', `from=${Date.now() + 10 * 864e5}`,
    `from=${fakeAt(20)}&to=${fakeAt(10)}`, `from=${fakeAt(10)}&to=${fakeAt(10)}`, 'account=0', 'account=-3', 'account=x',
  ];
  for (const qs of badSession) ok((await sp(qs)).status === 400, `bad session query refused: ${qs}`);
  ok((await sp('q=fk-')).data.total === 60, 'table still there after the odd queries');
  ok((await sp('q=fk-&sort=ip', gmTok)).status === 403 && (await sp('q=fk-', plainTok)).status === 403, 'GM (no sessions right) and players refused');

  // ---------------------------------------------------------- reset password
  const rp = await api('POST', `/admin/accounts/${plainId}/password`, undefined, ownerTok);
  await sleep(300);
  ok(rp.status === 200 && typeof rp.data.password === 'string' && rp.data.password.length >= 6, 'temporary password returned once');
  ok(b1.isClosed(), 'player kicked after a password reset');
  ok((await api('POST', '/login', { username: 'plain1', password: 'secret123' })).status === 401, 'old password no longer works');
  const relog = await api('POST', '/login', { username: 'plain1', password: rp.data.password });
  ok(relog.status === 200, 'temporary password logs in');
  const plainTok2: string = relog.data.token;
  const done = (await api('GET', `/admin/sessions?account=${plainId}`, undefined, ownerTok)).data.rows[0];
  ok(done && !done.online && done.leftAt >= done.joinedAt && done.gpu === 'Test GPU 9000' && done.avgRtt === 60 && done.avgFps === 60 && typeof done.ip === 'string',
    `play session closed with GPU, average ping and FPS (${JSON.stringify(done)})`);
  const allSessions = await api('GET', '/admin/sessions', undefined, ownerTok);
  ok(allSessions.status === 200 && allSessions.data.total >= 3 && allSessions.data.rows.length === Math.min(25, allSessions.data.total) && allSessions.data.size === 25,
    `recent sessions list (${allSessions.data.total})`);
  const chats = await api('GET', '/admin/chat?q=hello', undefined, ownerTok);
  ok(chats.status === 200 && chats.data.length === 1 && chats.data[0].charName === 'Tester' && chats.data[0].username === 'plain1' && chats.data[0].zone,
    'chat recorded and searchable by text');
  ok((await api('GET', '/admin/chat?q=Tester', undefined, ownerTok)).data.length === 2, 'chat searchable by character name');
  ok((await api('GET', '/admin/chat?q=%25', undefined, ownerTok)).data.length === 0, 'a typed % is not a wildcard in chat search');
  const delChat = await api('DELETE', `/admin/chat/${chats.data[0].id}`, undefined, ownerTok);
  ok(delChat.status === 200 && (await api('GET', '/admin/chat?q=hello', undefined, ownerTok)).data.length === 0, 'owner deletes a chat message');
  ok((await api('DELETE', `/admin/chat/${chats.data[0].id}`, undefined, ownerTok)).status === 404, 'deleting it again → 404');
  const st = await api('GET', '/admin/stats?range=24h', undefined, ownerTok);
  ok(st.status === 200 && st.data.online.length >= 1 && st.data.since > 0 && st.data.signups.length >= 30 && st.data.signups.some((p: any) => p.v === 4),
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

  // ---------------------------------------------------------- Permissions tab: custom roles, no escalation
  {
    const defs = await api('GET', '/admin/role-defs', undefined, ot);
    const gmDef = defs.data.roles?.find((r: any) => r.id === 'gm');
    ok(defs.status === 200 && defs.data.roles[0].id === 'owner' && defs.data.roles[0].features.length === Object.keys(FEATURE_ROLES).length && gmDef?.builtin,
      'owner lists the roles: owner (everything) and gm');
    ok(JSON.stringify(gmDef.features) === JSON.stringify(GM_DEFAULT), 'with nothing changed, gm has exactly the FEATURE_ROLES defaults');
    for (const [m, body] of [['GET', undefined], ['POST', { id: 'gm', name: 'GM', features: Object.keys(FEATURE_ROLES) }], ['POST', { id: 'hax', name: 'Hax', features: ['users'], create: true }]] as const) {
      ok((await api(m, '/admin/role-defs', body, gmTok)).status === 403, `GM cannot ${m} role-defs (no self-grant)`);
    }
    ok((await api('DELETE', '/admin/role-defs/gm', undefined, gmTok)).status === 403, 'GM cannot delete roles');
    const make = (body: unknown) => api('POST', '/admin/role-defs', body, ot);
    ok((await make({ id: 'owner', name: 'x', features: [] })).status === 400, 'owner role cannot be edited');
    ok((await make({ id: 'Tester!', name: 'x', features: [], create: true })).status === 400, 'bad role id → 400');
    ok((await make({ id: 'gm', name: 'GM2', features: [], create: true })).status === 409, 'gm cannot be created again');
    ok((await make({ id: 'none', name: 'None', features: [], create: true })).status === 409, 'reserved id → 409');
    ok((await make({ id: 'tester', name: 'ผู้ทดสอบ', features: ['online', 'deleteEverything'], create: true })).status === 400, 'unknown tool → 400');
    ok((await make({ id: 'tester', name: 'x'.repeat(21), features: [], create: true })).status === 400, 'name too long → 400');
    ok((await make({ id: 'tester', name: 'gm', features: [], create: true })).status === 409, 'name already used by another role → 409');
    ok((await make({ id: 'nosuch', name: 'No', features: [] })).status === 404, 'editing a role that does not exist → 404');
    const made = await make({ id: 'tester', name: 'ผู้ทดสอบ', features: ['online', 'reports'], create: true });
    ok(made.status === 200 && made.data.roles.some((r: any) => r.id === 'tester' && r.name === 'ผู้ทดสอบ' && !r.builtin && JSON.stringify(r.features) === '["online","reports"]'),
      `owner creates the tester role (${made.status} ${made.data.error ?? ''})`);

    const testerTok = await account('tester1');
    const testerChar: number = (await api('POST', '/characters', { name: 'QaChar', classId: 'mage' }, testerTok)).data.id;
    const victimTok = await account('plain9');
    const victimId = (await api('GET', '/admin/accounts', undefined, ot)).data.rows.find((r: any) => r.username === 'plain9').accountId;
    const testerId = (await api('GET', '/admin/accounts', undefined, ot)).data.rows.find((r: any) => r.username === 'tester1').accountId;
    ok((await api('POST', '/admin/roles', { username: 'tester1', role: 'nosuch' }, ot)).status === 400, 'cannot give a role that does not exist');
    const give = await api('POST', '/admin/roles', { username: 'tester1', role: 'tester' }, ot);
    ok(give.status === 200 && give.data.some((r: any) => r.username === 'tester1' && r.role === 'tester'), 'owner gives tester1 the tester role');
    const tme = await api('GET', '/admin/me', undefined, testerTok);
    ok(tme.status === 200 && tme.data.role === 'tester' && tme.data.roleName === 'ผู้ทดสอบ' && JSON.stringify(tme.data.features) === '["online","reports"]' && tme.data.roleNames.tester === 'ผู้ทดสอบ',
      `tester1 signs in to /admin with only its tools (${JSON.stringify(tme.data)})`);
    ok((await api('GET', '/admin/online', undefined, testerTok)).status === 200, 'tester sees the online list');
    ok((await api('GET', '/admin/reports', undefined, testerTok)).status === 200, 'tester reads reports');
    const testerDenied: [string, string, unknown?][] = [
      ['GET', '/admin/characters?q=a'], ['GET', `/admin/characters/${testerChar}`], ['POST', `/admin/characters/${testerChar}/gold`, { delta: 5 }],
      ['POST', `/admin/characters/${testerChar}/level`, { level: 50 }], ['POST', `/admin/characters/${testerChar}/kick`, {}],
      ['POST', `/admin/characters/${testerChar}/teleport`, { zone: 'nexus_city' }], ['GET', '/admin/accounts'], ['POST', '/admin/broadcast', { text: 'x' }],
      ['GET', '/admin/role-defs'], ['POST', '/admin/role-defs', { id: 'tester', name: 'ผู้ทดสอบ', features: Object.keys(FEATURE_ROLES) }],
      ['POST', '/admin/roles', { username: 'tester1', role: 'gm' }], ['GET', '/admin/audit'], ['GET', '/admin/server'],
    ];
    for (const [m, path, body] of testerDenied) ok((await api(m, path, body, testerTok)).status === 403, `tester denied: ${m} ${path}`);
    ok(saved(testerChar).level === 1 && saved(testerChar).gold === 0, 'refused tester edits changed nothing');

    // Changes apply on the next call (no re-login), and go to the audit log.
    const edited = await make({ id: 'tester', name: 'QA', features: ['online', 'reports', 'charView', 'charEdit', 'users', 'ban'] });
    ok(edited.status === 200 && (await api('GET', '/admin/me', undefined, testerTok)).data.roleName === 'QA', 'owner renames the role');
    ok((await api('POST', `/admin/characters/${testerChar}/level`, { level: 5 }, testerTok)).status === 200 && saved(testerChar).level === 5, 'new tools work at once (tester edits its own character)');
    // Staff accounts are off limits without staffTarget; the owner's always.
    const SCOPE2 = 'GM แก้ไขตัวละครของ owner หรือ GM คนอื่นไม่ได้';
    const gmCharId: number = own.data.id;
    const te = await api('POST', `/admin/characters/${gmCharId}/gold`, { delta: 5 }, testerTok);
    ok(te.status === 403 && te.data.error === SCOPE2, `tester cannot edit a GM's character without staffTarget (${te.status})`);
    ok((await api('POST', `/admin/accounts/${testerId - 0}/ban`, { duration: '1h', reason: 'x' }, gmTok)).status === 403, 'GM cannot ban a tester');
    ok((await api('POST', `/admin/characters/${testerChar}/gold`, { delta: 5 }, gmTok)).status === 403, "GM cannot edit a tester's character (staff, no staffTarget)");
    const gmAcc = (await api('GET', '/admin/accounts', undefined, ot)).data.rows.find((r: any) => r.username === 'gm1').accountId;
    ok((await api('POST', `/admin/accounts/${gmAcc}/ban`, { duration: '1h', reason: 'x' }, testerTok)).status === 403, 'tester with ban cannot ban a GM');
    const vb = await api('POST', `/admin/accounts/${victimId}/ban`, { duration: '1h', reason: 'x' }, testerTok);
    ok(vb.status === 200, `tester with ban bans a normal player (${vb.status} ${vb.data.error ?? ''})`);
    void victimTok;
    await make({ id: 'tester', name: 'QA', features: ['online', 'reports', 'charView', 'charEdit', 'users', 'ban', 'staffTarget'] });
    ok((await api('POST', `/admin/characters/${gmCharId}/gold`, { delta: 5 }, testerTok)).status === 200, "with staffTarget the tester may edit a GM's character");
    ok((await api('POST', `/admin/characters/${ownerChar}/gold`, { delta: 5 }, testerTok)).status === 403, "even with staffTarget never the owner's character");
    ok((await api('POST', `/admin/accounts/${ownerId}/ban`, { duration: '1h', reason: 'x' }, testerTok)).status === 400, 'even with staffTarget never ban the owner');

    // gm can be changed and put back; it can't be deleted.
    ok((await make({ id: 'gm', name: 'GM', features: [...GM_DEFAULT, 'mail'] })).status === 200 && (await api('POST', '/admin/mail', {}, gmTok)).status !== 403, 'owner opens mail to GMs');
    await make({ id: 'gm', name: 'GM', features: GM_DEFAULT });
    ok(JSON.stringify((await api('GET', '/admin/me', undefined, gmTok)).data.features) === JSON.stringify(GM_DEFAULT), 'gm back to its defaults');
    const gmRow = tdb.prepare("SELECT features FROM admin_roles WHERE id = 'gm'").get() as { features: string } | undefined;
    ok(gmRow?.features === '{}', `only changes are stored, so later tools keep their defaults (${gmRow?.features})`);
    ok((await api('DELETE', '/admin/role-defs/gm', undefined, ot)).status === 400, 'gm cannot be deleted');

    // Deleting a role someone holds is refused (owner 2026-11-10); empty it first.
    ok((await api('DELETE', '/admin/role-defs/tester', undefined, ot)).status === 409, 'role in use cannot be deleted');
    ok((await api('POST', '/admin/roles', { username: 'tester1', role: null }, ot)).status === 200, 'owner takes the role back');
    ok((await api('GET', '/admin/online', undefined, testerTok)).status === 403, 'no role → 403 at once');
    const gone = await api('DELETE', '/admin/role-defs/tester', undefined, ot);
    ok(gone.status === 200 && !gone.data.roles.some((r: any) => r.id === 'tester'), 'empty role deleted');
    const cliBad = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'tester1', 'tester'], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
    ok(cliBad.status !== 0, 'admin-role script refuses a role that does not exist');

    const roleLog = tdb.prepare("SELECT action, target, details FROM admin_audit WHERE action LIKE 'role-%' OR (action IN ('grant','revoke') AND target = 'tester1')").all() as any[];
    ok(roleLog.some((r) => r.action === 'role-create' && r.target === 'tester' && r.details.includes('ผู้ทดสอบ'))
      && roleLog.some((r) => r.action === 'role-edit' && r.target === 'tester' && r.details.includes('"ผู้ทดสอบ" → "QA"'))
      && roleLog.some((r) => r.action === 'role-edit' && r.target === 'gm' && r.details.includes('จดหมาย'))
      && roleLog.some((r) => r.action === 'role-delete' && r.target === 'tester')
      && roleLog.some((r) => r.action === 'grant' && r.details.includes('ผู้ทดสอบ'))
      && roleLog.some((r) => r.action === 'revoke'), `every role change is in the audit log (${roleLog.length} rows)`);
  }
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
