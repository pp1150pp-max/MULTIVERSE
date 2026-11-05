// Ping tests against a real game server that this script starts by itself on a free port with a
// throwaway database (never the real server or server/data), then stops: pong, junk ignored,
// rate limit, the lag / frame-stall / stalled-connection log lines with their throttle, the GPU
// line and the player's address in the join line.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket as WsClient } from 'ws';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-ping-test-'));
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
let log = '';
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_FILE: join(dir, 'test.db') },
  stdio: ['ignore', 'pipe', 'inherit'],
});
server.stdout!.on('data', (d) => (log += String(d)));

async function stopServer(): Promise<void> {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  rmSync(dir, { recursive: true, force: true });
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
  const pongs: number[] = [];
  /** A new guest in the world, optionally connecting with extra headers (as if through the tunnel). */
  async function joinGuest(name: string, headers: Record<string, string> = {}): Promise<(m: unknown) => void> {
    const g = (await (await fetch(`${BASE}/api/guest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, classId: 'sword' }),
    })).json()) as { token: string; character: { id: number } };
    const ws = new WsClient(`${BASE.replace('http', 'ws')}/ws`, { headers });
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
      ws.on('open', () => ws.send(JSON.stringify({ t: 'join', token: g.token, characterId: g.character.id })));
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw));
        if (m.t === 'pong' && name === 'PingTester') pongs.push(m.id);
        if (m.t === 'snap') {
          clearTimeout(t);
          res();
        }
      });
    });
    sockets.push(ws);
    return (m) => ws.send(JSON.stringify(m));
  }
  const sockets: WsClient[] = [];
  const send = await joinGuest('PingTester');
  ok(/joined as PingTester \(guest\) from (::1|127\.0\.0\.1|::ffff:127\.0\.0\.1) /.test(log), 'join line has the socket address');

  send({ t: 'ping', id: 1 });
  send({ t: 'ping', id: 2 }); // right after: rate limited
  await sleep(300);
  ok(pongs.includes(1), 'ping answered with a pong of the same id');
  ok(!pongs.includes(2), 'a second ping right away is ignored (rate limit)');

  await sleep(400);
  for (const junk of [{ t: 'ping' }, { t: 'ping', id: 'x' }, { t: 'ping', id: -1 }, { t: 'ping', id: 1.5 }]) send(junk);
  await sleep(300);
  ok(pongs.length === 1, 'junk pings get no answer');

  await sleep(400);
  send({ t: 'ping', id: 3, rtt: 1e9 });
  await sleep(300);
  ok(pongs.includes(3) && !/lagging/.test(log), 'an impossible reported round trip is not logged');

  await sleep(400);
  send({ t: 'ping', id: 4, rtt: 420, fps: 59.6, maxFrame: 21 });
  await sleep(300);
  ok(pongs.includes(4), 'still answering after junk');
  ok(/\[ping\] guest:\w+ \(PingTester\): ping 420 ms · 60 fps · max frame 21 ms — lagging \(frames OK: network\)/.test(log),
    'ping over 300 ms with smooth frames is logged at once as network lag');

  await sleep(400);
  send({ t: 'ping', id: 5, rtt: 650, fps: 60, maxFrame: 3000 });
  await sleep(300);
  ok((log.match(/\(PingTester\): ping/g) ?? []).length === 1, 'the warning is throttled per player');

  send({ t: 'client', gpu: 'Google SwiftShader\u0007‮\n[world] fake' });
  send({ t: 'client', gpu: 'second report' });
  await sleep(300);
  ok(/\[client\] guest:\w+ \(PingTester\) GPU: Google SwiftShader\[world\] fake ⚠ SOFTWARE RENDERING/.test(log),
    'GPU logged on one line with control characters removed, software renderer flagged');
  ok(!/second report/.test(log), 'GPU is logged once per session');

  const stall = await joinGuest('StallTester', { 'CF-Connecting-IP': '203.0.113.7' });
  ok(/joined as StallTester \(guest\) from 203\.0\.113\.7 /.test(log), 'join line trusts the tunnel header on local connections');
  stall({ t: 'ping', id: 1, rtt: 450, fps: 12, maxFrame: 2300 });
  await sleep(300);
  ok(/\(StallTester\): ping 450 ms · 12 fps · max frame 2300 ms — browser froze \(device, not network\)/.test(log),
    'a long frame is logged as a device freeze');

  const wait = await joinGuest('WaitTester', { 'X-Forwarded-For': '198.51.100.9, 10.0.0.1' });
  ok(/joined as WaitTester \(guest\) from 198\.51\.100\.9 /.test(log), 'X-Forwarded-For first entry when there is no Cloudflare header');
  wait({ t: 'ping', id: 1, wait: 12_345, fps: 60, maxFrame: 18 });
  await sleep(300);
  ok(/\(WaitTester\): ping — · no pong for 12\.3 s · 60 fps · max frame 18 ms — connection stalled/.test(log),
    'an overdue pong is logged as a stalled connection, not an old round trip');

  send({ t: 'chat', text: 'still here' });
  await sleep(200);
  ok(sockets.every((w) => w.readyState === WsClient.OPEN) && server.exitCode === null, 'connections and server still up');
  for (const w of sockets) w.close();
}

try {
  await run();
} catch (e) {
  ok(false, `test crashed: ${(e as Error).message}`);
} finally {
  await stopServer();
}
finish('ping-server');
