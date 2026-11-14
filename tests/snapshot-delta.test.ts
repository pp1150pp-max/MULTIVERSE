// Snapshot delta: fields that hardly ever change (PrivateSnap's potSel/lootFilter/autoSettings/stats/
// skills/quests…, other players' and monsters' look bundles) go out only when the browser does not
// have them yet. Checks: the first snapshot is whole, later ones leave them out, a change goes once,
// everything again after a zone / channel change and a reconnect, someone back in view gets their bundle,
// a change while snapshots are being skipped (slow link) still arrives, an old tab (no `delta: 1`) and
// the /admin switch turned off get whole snapshots.
// Runs its own game server on a free port with a throwaway database (never the real one).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PING_MS } from '../src/shared/net/protocol';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-delta-test-'));
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

const STATIC_ME = ['potSel', 'lootFilter', 'autoSettings', 'stats', 'skills'];

function joinWorld(token: string, characterId: number, delta: boolean) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId, ...(delta ? { delta: 1 } : {}) }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });
  const snaps = () => msgs.filter((m) => m.t === 'snap');
  /** Snapshots that came after message number `from` (an index into msgs). */
  const snapsFrom = (from: number) => msgs.slice(from).filter((m) => m.t === 'snap');
  const act = (o: object) => ws.send(JSON.stringify({ t: 'act', ...o }));
  const ping = (id: number) => ws.send(JSON.stringify({ t: 'ping', id }));
  const closed = new Promise<void>((r) => ws.addEventListener('close', () => r()));
  return { ws, msgs, ready, snaps, snapsFrom, act, ping, closed };
}

async function account(user: string, name: string) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  await api('POST', '/characters', { name, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: chars.find((c) => c.name === name)!.id };
}

const hasAllMe = (s: any) => STATIC_ME.every((k) => s.me[k] !== undefined);
const hasNoMe = (s: any) => STATIC_ME.every((k) => s.me[k] === undefined);
const allLooks = (s: any) => s.players.every((p: any) => typeof p.name === 'string' && typeof p.cls === 'string')
  && s.monsters.every((m: any) => typeof m.def === 'string');
const noLooks = (s: any) => s.players.every((p: any) => p.name === undefined) && s.monsters.every((m: any) => m.def === undefined);

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
  const owner = await account('dlowner', 'Owna');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'dlowner', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(cli.status === 0, 'dlowner is owner');
  const a = await account('dlpia', 'Pia');
  const b = await account('dlquin', 'Quin');
  const c = await account('dlrex', 'Rex');
  const warp = (charId: number, body: object) => api('POST', `/admin/characters/${charId}/teleport`, body, owner.tok);

  // ---- admin: the switch starts on, staff only
  const st0 = await api('GET', '/admin/snap-delta', undefined, owner.tok);
  ok(st0.status === 200 && st0.data.on === true, `/admin/snap-delta: on by default (${st0.status} ${JSON.stringify(st0.data)})`);
  ok((await api('GET', '/admin/snap-delta', undefined, a.tok)).status === 403, 'a player cannot read the switch');
  ok((await api('POST', '/admin/snap-delta', { on: false }, a.tok)).status === 403, 'a player cannot turn it off');
  ok((await api('POST', '/admin/snap-delta', { on: 'x' }, owner.tok)).status === 400, 'a bad value is refused');

  const P = joinWorld(a.tok, a.id, true);
  const Q = joinWorld(b.tok, b.id, true);
  const R = joinWorld(c.tok, c.id, false);
  await Promise.all([P.ready, Q.ready, R.ready]);
  await sleep(800);

  // ---- first snapshot whole, later ones without the statics
  const ps = P.snaps();
  ok(hasAllMe(ps[0]) && allLooks(ps[0]) && ps[0].players.length >= 1, 'the first snapshot carries every static field and every look');
  const later = ps.slice(-5);
  const others = later.at(-1).players.length;
  ok(later.every(hasNoMe), `later snapshots leave out potSel/lootFilter/autoSettings/stats/skills (${JSON.stringify(Object.keys(later.at(-1).me))})`);
  ok(later.every(noLooks) && others >= 1, `later snapshots leave out looks of everyone still in view (${others} players, ${later.at(-1).monsters.length} monsters)`);
  ok(later.at(-1).players.every((p: any) => typeof p.x === 'number' && typeof p.hp === 'number'), 'positions and HP still in every snapshot');
  const qSeen = later.at(-1).players.length >= 3;
  ok(qSeen, `Pia sees Quin and Rex nearby in the hub (${later.at(-1).players.length} players)`);

  // ---- old tab: always whole
  ok(R.snaps().slice(-5).every((s) => hasAllMe(s) && allLooks(s)), 'a client without delta: 1 gets whole snapshots');

  // ---- a change goes once
  const before = P.msgs.length;
  P.act({ a: 'lootFilter', filter: { rarities: ['rare', 'epic'], potions: false } });
  await sleep(700);
  const afterChange = P.snapsFrom(before);
  const withFilter = afterChange.filter((s) => s.me.lootFilter);
  ok(withFilter.length === 1 && withFilter[0].me.lootFilter.potions === false,
    `the changed lootFilter comes in exactly one snapshot (${withFilter.length}), the rest still left out`);
  ok(afterChange.filter((s) => s.me.stats).length === 1, 'after an action every PrivateSnap field goes once (an echo), then stays out');

  // ---- an action the server leaves as it was (same filter again) still gets its echo
  const same = P.msgs.length;
  P.act({ a: 'lootFilter', filter: { rarities: ['rare', 'epic'], potions: false } });
  await sleep(700);
  const echo = P.snapsFrom(same).filter((s) => s.me.lootFilter);
  ok(echo.length === 1 && echo[0].me.lootFilter.rarities.join() === 'rare,epic', `an unchanged (or refused) change still gets one echo (${echo.length})`);

  // ---- someone back in view gets their look again
  await warp(b.id, { zone: 'emerald_forest' });
  await sleep(500);
  const qId = () => Q.msgs.filter((m) => m.t === 'zone').at(-1)?.you;
  const gone = P.snaps().at(-1).players.every((p: any) => p.name !== 'Quin' && p.id !== qId());
  ok(gone, 'Quin left the hub: out of Pia\'s snapshots');
  const back = P.msgs.length;
  await warp(b.id, { zone: 'nexus_city' });
  await sleep(600);
  const qBack = Q.msgs.filter((m) => m.t === 'zone').at(-1)?.you;
  const firstSeen = P.snapsFrom(back).map((s) => s.players.find((p: any) => p.id === qBack)).filter(Boolean);
  ok(firstSeen.length >= 2 && firstSeen[0].name === 'Quin' && firstSeen.slice(1).every((p: any) => p.name === undefined),
    `back in view: the first snapshot with Quin has the look bundle, the next ones do not (${firstSeen.length} seen)`);

  // ---- zone change: everything again
  const zoneAt = P.msgs.length;
  await warp(a.id, { zone: 'emerald_forest' });
  await sleep(600);
  const zi = P.msgs.findIndex((m, i) => i >= zoneAt && m.t === 'zone');
  const afterZone = P.snapsFrom(zi);
  ok(zi > 0 && afterZone.length >= 3 && hasAllMe(afterZone[0]) && allLooks(afterZone[0]) && afterZone[0].monsters.length > 0,
    `the first snapshot after a zone change is whole (${afterZone[0]?.monsters.length} monsters)`);
  ok(afterZone.slice(1).every((s) => hasNoMe(s) && noLooks(s)), 'and the ones after it leave the statics out again');

  // ---- channel switch: everything again

  const chAt = P.msgs.length;
  P.act({ a: 'chSwitch', ch: 2 });
  await sleep(600);
  const ci = P.msgs.findIndex((m, i) => i >= chAt && m.t === 'zone');
  const afterCh = ci > 0 ? P.snapsFrom(ci) : [];
  ok(ci > 0 && afterCh.length >= 2 && hasAllMe(afterCh[0]) && allLooks(afterCh[0]) && afterCh.slice(1).every(hasNoMe),
    `after a channel switch the first snapshot is whole again (${ci > 0 ? 'switched' : 'no zone message'})`);

  // ---- a slow link: snapshots skipped, a change in the meantime still arrives
  P.ping(1);
  await sleep(300);
  // No more pings: once PONG_LATE_MS has passed the server sends one snapshot a second.
  await sleep(PING_MS + 1500 + 400);
  const slowAt = P.msgs.length;
  P.act({ a: 'autoSettings', settings: { hpPct: 33, mpPct: 22 } });
  await sleep(2300);
  const slow = P.snapsFrom(slowAt);
  ok(slow.length >= 1 && slow.length <= 4, `behind: about one snapshot a second (${slow.length} in 2.3 s)`);
  ok(slow.some((s) => s.me.autoSettings), 'the autoSettings change made while snapshots were skipped still arrives');
  P.ping(2);
  await sleep(400);

  // ---- reconnect: whole again
  P.ws.close();
  await P.closed;
  await sleep(300);
  const P2 = joinWorld(a.tok, a.id, true);
  await P2.ready;
  await sleep(500);
  const p2 = P2.snaps();
  ok(hasAllMe(p2[0]) && allLooks(p2[0]) && p2.slice(-3).every(hasNoMe), 'after a reconnect: the first snapshot is whole, then delta again');

  // ---- the switch off: whole snapshots; back on: whole once, then delta
  const off = await api('POST', '/admin/snap-delta', { on: false }, owner.tok);
  ok(off.status === 200 && off.data.on === false && off.data.clients.delta >= 2 && off.data.clients.full >= 1,
    `turned off (${JSON.stringify(off.data.clients)})`);
  await sleep(500);
  ok(P2.snaps().slice(-4).every((s) => hasAllMe(s) && allLooks(s)), 'switched off: every snapshot whole');
  const onAt = P2.msgs.length;
  const on = await api('POST', '/admin/snap-delta', { on: true }, owner.tok);
  await sleep(500);
  const afterOn = P2.snapsFrom(onAt);
  ok(on.data.on === true && hasAllMe(afterOn[0]) && afterOn.slice(-3).every(hasNoMe), 'switched back on: whole once, then delta');
  await sleep(500);
  const stats = (await api('GET', '/admin/snap-delta', undefined, owner.tok)).data.stats;
  ok(stats.deltaSnaps > 0 && stats.savedBytes > 0 && stats.sentBytes > 0 && stats.lookResends > 0 && stats.meResends > 0,
    `the counters count (${JSON.stringify(stats)})`);
  const audit = await api('GET', '/admin/audit', undefined, owner.tok);
  ok(audit.data.filter((r: any) => r.action === 'snap-delta').length === 2, 'both switches are in the audit log');

  P2.ws.close();
  Q.ws.close();
  R.ws.close();
}

try {
  await run();
} catch (e) {
  ok(false, `test crashed: ${(e as Error).stack}`);
} finally {
  server.kill();
  await new Promise((r) => server.once('exit', r));
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the database file a moment.
  }
}
finish('snapshot-delta');
