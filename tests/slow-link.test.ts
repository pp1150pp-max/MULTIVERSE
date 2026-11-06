// A client that falls behind (stops answering pongs) gets about one snapshot a second instead of
// SNAPSHOT_HZ, so data does not pile up on a slow link; once it answers again the full rate is back.
// Runs its own game server on a free port with a throwaway database (never the real one).
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PING_MS, SNAPSHOT_HZ } from '../src/shared/net/protocol';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
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
  env: { ...process.env, PORT: String(PORT), DB_FILE: join(dir, 'test.db') },
  stdio: ['ignore', 'ignore', 'inherit'],
});

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
  const r = await fetch(`${BASE}/api/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ทดสอบเน็ตช้า', classId: 'mage' }),
  });
  const g = (await r.json()) as any;
  ok(r.status === 201 && g.token, `create guest (${r.status})`);

  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  let snaps = 0;
  let pongs = 0;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token: g.token, characterId: g.character.id }));
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.t === 'snap') snaps++;
    if (m.t === 'pong') pongs++;
  };
  let pingId = 0;
  const ping = () => ws.send(JSON.stringify({ t: 'ping', id: ++pingId }));
  /** Snapshots received per second over `ms`, pinging every PING_MS meanwhile if asked. */
  async function rate(ms: number, keepPinging: boolean): Promise<number> {
    const timer = keepPinging ? setInterval(ping, PING_MS) : null;
    const from = snaps;
    await sleep(ms);
    if (timer) clearInterval(timer);
    return ((snaps - from) * 1000) / ms;
  }

  await sleep(1000);
  ok(snaps > 0, 'joined and getting snapshots');
  ping();
  const normal = await rate(3000, true);
  ok(normal > SNAPSHOT_HZ / 2, `full rate while answering (${normal.toFixed(1)}/s)`);

  // Stop answering: after PONG_LATE_MS the server should slow down to ~1 a second.
  await sleep(PING_MS + 2000);
  const slow = await rate(4000, false);
  ok(slow > 0.5 && slow <= 1.5, `about one snapshot a second while behind (${slow.toFixed(1)}/s)`);

  // Answer again: the full rate is back right away.
  ping();
  await sleep(300);
  const back = await rate(2000, true);
  ok(back > normal * 0.8, `full rate again after answering (${back.toFixed(1)}/s)`);
  ok(pongs >= 3, `pongs keep coming (${pongs})`);
  ws.close();
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
finish('slow-link');
