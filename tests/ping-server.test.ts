// Ping tests against a real game server that this script starts by itself on a free port with a
// throwaway database (never the real server or server/data), then stops: pong, junk ignored,
// rate limit, and the "lagging" log line with its throttle.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  const g = (await (await fetch(`${BASE}/api/guest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'PingTester', classId: 'sword' }),
  })).json()) as { token: string; character: { id: number } };

  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const pongs: number[] = [];
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token: g.token, characterId: g.character.id }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.t === 'pong') pongs.push(m.id);
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });
  const send = (m: unknown) => ws.send(JSON.stringify(m));

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
  send({ t: 'ping', id: 4, rtt: 420 });
  await sleep(300);
  ok(pongs.includes(4), 'still answering after junk');
  ok(/\[ping\] guest:\w+ \(PingTester\): 420 ms — lagging/.test(log), 'ping over 300 ms is logged at once with the player');

  await sleep(400);
  send({ t: 'ping', id: 5, rtt: 650 });
  await sleep(300);
  ok((log.match(/lagging/g) ?? []).length === 1, 'the lagging line is throttled per player');

  send({ t: 'chat', text: 'still here' });
  await sleep(200);
  ok(ws.readyState === WebSocket.OPEN && server.exitCode === null, 'connection and server still up');
  ws.close();
}

try {
  await run();
} catch (e) {
  ok(false, `test crashed: ${(e as Error).message}`);
} finally {
  await stopServer();
}
finish('ping-server');
