// Direct game connection (server/direct.ts, src/client/net/route.ts): the browser's choice of road and its
// safety checks; the server's direct port (off by default, refused before the upgrade when off / wrong page /
// too many from one address, only /ws answered, the real address from Caddy's X-Forwarded-For and never the
// CF-* headers, `direct` in place of the Cloudflare data center); the admin card (owner+GM switch, hostname
// owner only, audit) and switching off dropping the direct players.
// Runs its own game server on free ports with a throwaway database (never the real one).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { checkDirectUrl, DIRECT_BACKOFF_MS, routeOrder, tunnelUrl } from '../src/client/net/route';
import { checkDirectHost, directOriginOk } from '../server/direct';
import { finish, ok } from './check';

// ---------------------------------------------------------------- the browser's choice (no server)
{
  const page = 'play.multiverse-game.com';
  ok(checkDirectUrl('wss://ws.multiverse-game.com/ws', page, 'https:') === 'wss://ws.multiverse-game.com/ws', 'a sibling wss host is accepted');
  ok(checkDirectUrl('wss://ws.multiverse-game.com/ws', 'multiverse-game.com', 'https:') !== null, 'a page on the parent domain is accepted');
  ok(checkDirectUrl('wss://ws.evil.com/ws', page, 'https:') === null, 'another domain is refused (the login token goes there)');
  ok(checkDirectUrl('wss://ws.multiverse-game.com.evil.com/ws', page, 'https:') === null, 'a look-alike domain is refused');
  ok(checkDirectUrl('ws://ws.multiverse-game.com/ws', page, 'https:') === null, 'plain ws:// is refused');
  ok(checkDirectUrl('wss://ws.multiverse-game.com/ws', page, 'http:') === null, 'never from an http page');
  ok(checkDirectUrl('wss://ws.multiverse-game.com:8443/ws', page, 'https:') === null, 'a port is refused');
  ok(checkDirectUrl('wss://ws.multiverse-game.com/other', page, 'https:') === null, 'another path is refused');
  ok(checkDirectUrl('wss://a:b@ws.multiverse-game.com/ws', page, 'https:') === null, 'credentials are refused');
  ok(checkDirectUrl(null, page, 'https:') === null && checkDirectUrl(42, page, 'https:') === null, 'no answer = tunnel only');
  ok(checkDirectUrl('wss://multiverse-game.com/ws', 'x.com', 'https:') === null, 'a two-label host is refused');
  const tunnel = tunnelUrl({ protocol: 'https:', host: page });
  ok(tunnel === 'wss://play.multiverse-game.com/ws', `tunnel road is /ws on the page host (${tunnel})`);
  ok(tunnelUrl({ protocol: 'http:', host: 'localhost:5173' }) === 'ws://localhost:5173/ws', 'ws:// on an http page');
  const d = 'wss://ws.multiverse-game.com/ws';
  ok(routeOrder(d, tunnel, 1000, -Infinity).join() === `${d},${tunnel}`, 'direct first, then the tunnel');
  ok(routeOrder(null, tunnel, 1000, -Infinity).join() === tunnel, 'no direct offered = tunnel only');
  ok(routeOrder(d, tunnel, 1000 + DIRECT_BACKOFF_MS - 1, 1000).join() === tunnel, 'direct failed lately = tunnel only');
  ok(routeOrder(d, tunnel, 1000 + DIRECT_BACKOFF_MS, 1000)[0] === d, 'direct is tried again after the back-off');

  ok(checkDirectHost('ws.multiverse-game.com') === null, 'hostname check: a good name');
  ok(checkDirectHost('multiverse-game.com') !== null, 'hostname check: needs a subdomain');
  ok(checkDirectHost('WS.multiverse-game.com') !== null && checkDirectHost('ws.multi verse.com') !== null && checkDirectHost('ws..com.x') !== null, 'hostname check: lowercase letters, digits and - only');
  ok(directOriginOk('https://play.multiverse-game.com', 'ws.multiverse-game.com'), 'origin: our page');
  ok(!directOriginOk('https://evil.com', 'ws.multiverse-game.com'), 'origin: another site');
  ok(!directOriginOk(undefined, 'ws.multiverse-game.com'), 'origin: none');
}

// ---------------------------------------------------------------- the server
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-direct-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise<number>((res, rej) => {
  const s = createServer();
  s.once('error', rej);
  s.listen(0, () => {
    const port = (s.address() as { port: number }).port;
    s.close(() => res(port));
  });
});
const PORT = await freePort();
const DPORT = await freePort();
const BASE = `http://localhost:${PORT}`;
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_FILE, DIRECT_WS_PORT: String(DPORT) },
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

async function account(user: string, name: string) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  await api('POST', '/characters', { name, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: chars.find((c) => c.name === name)!.id };
}

const role = (user: string, r: string) => spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', user, r], {
  cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
}).status === 0;

const GOOD_ORIGIN = 'https://play.multiverse-game.com';

/** Opens a socket to the direct port as Caddy would pass it on: resolves 'open' or the refusal's HTTP status. */
function tryDirect(headers: Record<string, string>): Promise<{ ws: WebSocket; result: 'open' | number }> {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${DPORT}/ws`, { headers });
    ws.once('open', () => res({ ws, result: 'open' }));
    ws.once('unexpected-response', (_req, r) => {
      res({ ws, result: r.statusCode ?? 0 });
      r.resume();
      ws.terminate();
    });
    ws.once('error', () => res({ ws, result: -1 }));
  });
}

/** Joins the game over an open socket; resolves on the first snapshot. */
function joinGame(ws: WebSocket, token: string, characterId: number): Promise<void> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.on('message', (raw) => {
      if (JSON.parse(String(raw)).t === 'snap') {
        clearTimeout(t);
        res();
      }
    });
    ws.send(JSON.stringify({ t: 'join', token, characterId, delta: 1 }));
  });
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
  const owner = await account('dwowner', 'Dwo');
  ok(role('dwowner', 'owner'), 'dwowner is owner');
  const gm = await account('dwgm', 'Dwg');
  ok(role('dwgm', 'gm'), 'dwgm is gm');
  const p = await account('dwplayer', 'Dwp');

  // ---- off by default
  ok((await api('GET', '/net-route')).data.direct === null, 'net-route: no direct road by default');
  const st0 = await api('GET', '/admin/direct-ws', undefined, owner.tok);
  ok(st0.status === 200 && st0.data.on === false && st0.data.available === true && st0.data.port === DPORT && st0.data.host === 'ws.multiverse-game.com', `admin card: off, port up, default host (${JSON.stringify(st0.data)})`);
  ok(st0.data.canEditHost === true, 'owner may edit the hostname');
  ok((await api('GET', '/admin/direct-ws', undefined, p.tok)).status === 403, 'a player cannot see the card');
  const off = await tryDirect({ Origin: GOOD_ORIGIN });
  ok(off.result === 403, `switch off: direct refused before the upgrade (${off.result})`);

  // ---- the direct port answers nothing but /ws
  const plain = await fetch(`http://127.0.0.1:${DPORT}/api/me`);
  ok(plain.status === 404, `direct port: /api is not served (${plain.status})`);
  ok((await fetch(`http://127.0.0.1:${DPORT}/admin`)).status === 404, 'direct port: /admin is not served');

  // ---- GM: switch yes, hostname no
  const gmCard = await api('GET', '/admin/direct-ws', undefined, gm.tok);
  ok(gmCard.status === 200 && gmCard.data.canEditHost === false, 'GM sees the card, cannot edit the hostname');
  ok((await api('POST', '/admin/direct-ws', { on: true, ipMax: 40, host: 'ws.evil-example.com' }, gm.tok)).status === 403, 'GM changing the hostname → 403');
  ok((await api('GET', '/admin/direct-ws', undefined, owner.tok)).data.on === false, '…and nothing changed');
  ok((await api('POST', '/admin/direct-ws', { on: true, ipMax: 0 }, owner.tok)).status === 400, 'cap 0 refused');
  ok((await api('POST', '/admin/direct-ws', { on: true, ipMax: 40, host: 'bad host' }, owner.tok)).status === 400, 'a bad hostname refused');
  ok((await api('POST', '/admin/direct-ws', { on: 'yes', ipMax: 40 }, owner.tok)).status === 400, 'a bad switch value refused');
  const on = await api('POST', '/admin/direct-ws', { on: true, ipMax: 40 }, gm.tok);
  ok(on.status === 200 && on.data.on === true, 'GM switches it on');
  ok((await api('GET', '/net-route')).data.direct === 'wss://ws.multiverse-game.com/ws', 'net-route now offers the direct road');

  // ---- refusals while on
  ok((await tryDirect({ Origin: 'https://evil.com' })).result === 403, 'another site\'s page is refused');
  ok((await tryDirect({})).result === 403, 'no Origin is refused');

  // ---- a direct player: real address from Caddy, CF headers ignored, "direct" in place of the data center
  const d = await tryDirect({ Origin: GOOD_ORIGIN, 'X-Forwarded-For': '6.6.6.6, 203.0.113.9', 'CF-Connecting-IP': '6.6.6.6', 'CF-Ray': 'abc-BKK' });
  ok(d.result === 'open', `our page connects directly (${d.result})`);
  await joinGame(d.ws, p.tok, p.id);
  const row = ((await api('GET', '/admin/online', undefined, owner.tok)).data.players as any[]).find((r) => r.name === 'Dwp');
  ok(row?.ip === '203.0.113.9', `address = Caddy's (last X-Forwarded-For), not the CF header (${row?.ip})`);
  ok(row?.edge === 'direct', `edge = direct (${row?.edge})`);
  const st1 = (await api('GET', '/admin/direct-ws', undefined, owner.tok)).data;
  ok(st1.clients.direct === 1, `card counts 1 direct player (${JSON.stringify(st1.clients)})`);

  // ---- the cap per address
  ok((await api('POST', '/admin/direct-ws', { on: true, ipMax: 1 }, owner.tok)).status === 200, 'cap set to 1');
  const second = await tryDirect({ Origin: GOOD_ORIGIN, 'X-Forwarded-For': '203.0.113.9' });
  ok(second.result === 429, `a second direct connection from the same address is refused (${second.result})`);
  const other = await tryDirect({ Origin: GOOD_ORIGIN, 'X-Forwarded-For': '198.51.100.7' });
  ok(other.result === 'open', 'another address still connects');
  other.ws.close();

  // ---- the hostname (owner): moving it drops the direct players too
  const moved = await api('POST', '/admin/direct-ws', { on: true, ipMax: 40, host: 'game.multiverse-game.com' }, owner.tok);
  ok(moved.status === 200 && moved.data.host === 'game.multiverse-game.com', 'owner changes the hostname');
  const closed = await new Promise<number>((res) => {
    if (d.ws.readyState === WebSocket.CLOSED) return res(-1);
    d.ws.once('close', (code) => res(code));
  });
  ok(closed === 4100, `the direct player was dropped to reconnect (close ${closed})`);
  ok((await api('GET', '/net-route')).data.direct === 'wss://game.multiverse-game.com/ws', 'net-route follows the new hostname');

  // ---- switching off drops direct players and stops offering the road
  const d2 = await tryDirect({ Origin: GOOD_ORIGIN, 'X-Forwarded-For': '203.0.113.10' });
  await joinGame(d2.ws, p.tok, p.id);
  const gone = new Promise<number>((res) => d2.ws.once('close', (code) => res(code)));
  ok((await api('POST', '/admin/direct-ws', { on: false, ipMax: 40, host: 'ws.multiverse-game.com' }, owner.tok)).data.on === false, 'switched off');
  ok((await gone) === 4100, 'switching off drops the direct player (close 4100, not a kick)');
  ok((await api('GET', '/net-route')).data.direct === null, 'net-route: tunnel only again');
  const st2 = (await api('GET', '/admin/direct-ws', undefined, owner.tok)).data;
  ok(st2.refused.off >= 1 && st2.refused.origin >= 2 && st2.refused.perIp >= 1, `refusals counted (${JSON.stringify(st2.refused)})`);

  const audit = await api('GET', '/admin/audit', undefined, owner.tok);
  const rows = (audit.data.rows ?? audit.data) as any[];
  ok(Array.isArray(rows) && rows.filter((r) => r.action === 'direct-ws').length >= 4, 'every change is in the audit log');
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
finish('direct-ws');
