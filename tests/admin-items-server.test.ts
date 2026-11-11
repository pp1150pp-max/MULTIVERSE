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
import { ADMIN_PITY_MAX, entrySig } from '../src/shared/admin';
import { itemNames, roundStat, rowRanges } from '../src/shared/data/items';
import { MAX_PLUS } from '../src/shared/data/enhance';
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
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  ok(cli.status === 0, 'owner1 is owner');
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: 'gm' }, ownerTok)).status === 200, 'gm1 is GM');

  const charId: number = (await api('POST', '/characters', { name: 'Tester', classId: 'sword' }, plainTok)).data.id;
  const ownerChar: number = (await api('POST', '/characters', { name: 'Boss', classId: 'mage' }, ownerTok)).data.id;
  const rows = (await api('GET', '/admin/accounts', undefined, ownerTok)).data.rows;
  const plainId: number = rows.find((r: any) => r.username === 'plain1').accountId;

  // Offline: a rare weapon and a potion into the bag (spawn), then read the sheet like the page does.
  ok((await api('POST', `/admin/characters/${charId}/items`, { baseId: 'weapon_3', rarity: 'rare', level: 12, count: 1 }, ownerTok)).status === 200, 'spawn a weapon');
  ok((await api('POST', `/admin/characters/${charId}/items`, { kind: 'potion', potion: 'hp', size: 's', count: 3 }, ownerTok)).status === 200, 'spawn potions');
  const sheet = async () => (await api('GET', `/admin/accounts/${plainId}`, undefined, ownerTok)).data.characters[0];
  let ch = await sheet();
  const wi = ch.bag.findIndex((e: any) => e && e.baseId === 'weapon_3');
  const pi = ch.bag.findIndex((e: any) => e && e.potion === 'hp');
  ok(wi >= 0 && pi >= 0, `the sheet shows both (bag ${wi}, ${pi})`);
  const weapon = ch.bag[wi];

  const edit = (body: Record<string, unknown>, tok = gmTok) => api('POST', '/admin/items', body, tok);
  const name = itemNames('weapon_3', 'legendary', 'sword')[0];
  const r = rowRanges('weapon_3', 'legendary', 20, ['atk', 'crit'])!;
  const good = {
    place: 'bag', charId, key: wi, sig: entrySig(weapon), op: 'save',
    baseId: 'weapon_3', rarity: 'legendary', level: 20, classId: 'sword', name, plus: 12, pity: 5,
    lines: [{ stat: 'atk', value: roundStat('atk', r[0].hi) }, { stat: 'crit', value: roundStat('crit', r[1].lo) }],
  };

  // ---------------------------------------------------------- who may edit
  ok((await edit(good, plainTok)).status === 403, 'normal player → 403');
  ok((await edit({ ...good, place: 'equip', key: 'weapon', charId: ownerChar, sig: 'x' })).status === 403, 'GM cannot edit the owner\'s items');

  // ---------------------------------------------------------- every value checked
  const bad: [Record<string, unknown>, number, string][] = [
    [{ place: 'pocket' }, 400, 'place'],
    [{ op: 'burn' }, 400, 'op'],
    [{ key: 30 }, 400, 'bag index past the end'],
    [{ key: 1.5 }, 400, 'fractional index'],
    [{ sig: 'item:someone-else' }, 409, 'slot no longer holds what the page saw'],
    [{ key: (wi + 5) % 30 }, 409, 'empty slot'],
    [{ baseId: 'nope' }, 400, 'unknown kind'],
    [{ rarity: 'mythic' }, 400, 'unknown rarity'],
    [{ classId: 'ninja' }, 400, 'unknown class'],
    [{ level: 3 }, 400, 'level under the kind\'s minimum'],
    [{ level: 51 }, 400, 'level over the max'],
    [{ plus: MAX_PLUS + 1 }, 400, 'plus over the max'],
    [{ pity: ADMIN_PITY_MAX + 1 }, 400, 'pity over the max'],
    [{ pity: -1 }, 400, 'negative pity'],
    [{ name: 'Excalibur' }, 400, 'a name the kind cannot have'],
    [{ lines: [{ stat: 'atk', value: r[0].hi * 3 }] }, 400, 'stat over 2× the normal top'],
    [{ lines: [{ stat: 'luck', value: 1 }] }, 400, 'unknown stat'],
    [{ lines: 'atk' }, 400, 'rows not a list'],
  ];
  for (const [patch, status, what] of bad) {
    const res = await edit({ ...good, ...patch });
    ok(res.status === status, `${what} → ${status} (${res.status} ${res.data.error})`);
  }
  ok(JSON.stringify(saved(charId).bag[wi]) === JSON.stringify(weapon), 'refused edits changed nothing');

  // ---------------------------------------------------------- offline edit lands in the save
  const done = await edit(good);
  ok(done.status === 200, `GM edits the weapon (${done.status} ${done.data.error ?? done.data.msg})`);
  const w = saved(charId).bag[wi];
  ok(w.uid === weapon.uid && w.rarity === 'legendary' && w.level === 20 && w.plus === 12 && w.pity === 5 && w.name === name, 'kind, rarity, level, +N, pity, name saved; uid kept');
  ok(w.lines.length === 2 && w.lines[0].stat === 'atk' && w.lines[0].value === roundStat('atk', r[0].hi) && w.lines[0].tier === 1 && w.lines[1].tier === 5 && w.stats.atk === roundStat('atk', r[0].hi),
    `rows saved with their tiers worked out (${JSON.stringify(w.lines)})`);
  ok((await edit(good)).status === 400, 'the same edit again: no change → 400');

  const pot = saved(charId).bag[pi];
  ok((await edit({ place: 'bag', charId, key: pi, sig: entrySig(pot), op: 'save', count: 11 })).status === 400, 'stack count over 10 refused');
  ok((await edit({ place: 'bag', charId, key: pi, sig: entrySig(pot), op: 'save', count: 7 })).status === 200 && saved(charId).bag[pi].count === 7, 'potion count 3 → 7');
  ok((await edit({ place: 'bag', charId, key: pi, sig: entrySig(pot), op: 'delete' })).status === 200 && saved(charId).bag[pi] === null, 'delete the potions');

  // ---------------------------------------------------------- stash (offline, from the save)
  // A copy of the server-made weapon (a real item) with its own uid.
  const extra = { ...saved(charId).bag[wi], uid: 'stash-test-1', plus: 0 };
  {
    const db = new DatabaseSync(DB_FILE);
    db.prepare('INSERT INTO stashes (account_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET data = excluded.data')
      .run(plainId, JSON.stringify({ size: 30, gold: 0, items: [extra, ...Array(29).fill(null)] }), Date.now());
    db.close();
  }
  const sbase = { place: 'stash', accountId: plainId, key: 0, sig: entrySig(extra) };
  ok((await edit({ ...sbase, key: 30, op: 'delete' })).status === 400, 'stash index past its size refused');
  const st = await edit({ ...good, ...sbase, op: 'save', plus: 3 });
  ok(st.status === 200 && savedStash(plainId).items[0].plus === 3 && savedStash(plainId).items[0].uid === extra.uid, `offline stash item edited (${st.data.error ?? ''})`);

  // ---------------------------------------------------------- online: the live character and stash, no message
  const c = joinWorld(plainTok, charId);
  await c.ready;
  await sleep(300);
  const live = await sheet();
  const worn = live.equipment.weapon;
  const atkBefore = c.lastMe().stats.atk;
  const wbase = { place: 'equip', charId, key: 'weapon', sig: entrySig(worn), op: 'save', classId: 'sword', name: worn.name, rarity: worn.rarity, pity: 0, plus: 0 };
  const wr = rowRanges(worn.baseId, worn.rarity, 1, ['atk'])!;
  const armor = itemNames('tunic', worn.rarity, 'sword')[0];
  ok((await edit({ ...wbase, baseId: 'tunic', name: armor, level: 1, lines: [] })).status === 400, 'worn weapon cannot become armour');
  ok((await edit({ ...wbase, baseId: worn.baseId, level: 5, lines: [{ stat: 'atk', value: roundStat('atk', wr[0].hi) }] })).status === 400, 'worn item over the character level refused');
  ok((await edit({ ...wbase, baseId: worn.baseId, classId: 'mage', name: itemNames(worn.baseId, worn.rarity, 'mage')[0], level: 1, lines: [] })).status === 400, 'worn item for another class refused');
  const chats = () => c.msgs.filter((m) => m.t === 'chat').length;
  const chatBefore = chats();
  const we = await edit({ ...wbase, baseId: worn.baseId, level: 1, plus: 9, lines: [{ stat: 'atk', value: roundStat('atk', wr[0].hi * 2) }] });
  ok(we.status === 200, `worn weapon edited online (${we.data.error ?? we.data.msg})`);
  await sleep(500);
  ok(c.last('inv')?.equipment.weapon.plus === 9, 'the player sees +9 at once');
  ok(c.lastMe().stats.atk > atkBefore, `stats recomputed (${atkBefore} → ${c.lastMe().stats.atk})`);
  ok(saved(charId).equipment.weapon.plus === 9, 'saved at once');
  ok(chats() === chatBefore, 'the player gets no message');

  const sItem = savedStash(plainId).items[0];
  ok((await edit({ ...sbase, sig: entrySig(sItem), op: 'delete' })).status === 200, 'delete from the live stash');
  await sleep(500);
  ok(c.last('stash')?.items[0] === null, 'the player sees the stash slot empty');
  ok(savedStash(plainId).items[0] === null, 'stash saved at once');

  // ---------------------------------------------------------- audit
  const audit = (await api('GET', '/admin/audit', undefined, ownerTok)).data as any[];
  const mine = audit.filter((a) => a.action === 'item-edit' || a.action === 'item-delete');
  ok(mine.length === 6 && mine.some((a) => a.action === 'item-edit' && a.details.includes('→') && a.details.includes('+12')), `every item change is in the audit log (${mine.length})`);
  c.ws.close();
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).stack}`);
} finally {
  await stopServer();
}
finish('admin-items-server');
