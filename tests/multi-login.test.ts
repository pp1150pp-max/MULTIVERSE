// One account playing several characters at once: both stay in the world, logging in with the same
// character again takes over from the old connection only, and a character in play can't be deleted.
// Runs its own game server on a free port with a throwaway database (never the real one).
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  return { ws, msgs, ready, isClosed: () => closed, kick: () => msgs.find((m) => m.t === 'kick')?.msg as string | undefined };
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
  const reg = await api('POST', '/register', { username: 'multi1', password: 'secret123' });
  ok(reg.status === 201 && reg.data.token, `register (${reg.status})`);
  const tok = reg.data.token as string;
  ok((await api('POST', '/characters', { name: 'Alpha', classId: 'sword' }, tok)).status === 201, 'character A');
  ok((await api('POST', '/characters', { name: 'Bravo', classId: 'mage' }, tok)).status === 201, 'character B');
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  const a = chars.find((c) => c.name === 'Alpha')!.id;
  const b = chars.find((c) => c.name === 'Bravo')!.id;

  // Both characters of the account at once.
  const ca = joinWorld(tok, a);
  await ca.ready;
  const cb = joinWorld(tok, b);
  await cb.ready;
  await sleep(500);
  ok(!ca.isClosed() && !ca.kick(), 'A stays in when B of the same account joins');
  ok(!cb.isClosed(), 'B is in too');
  const names = (cb.msgs.filter((m) => m.t === 'snap').at(-1)?.players ?? []).map((p: any) => p.name);
  ok(names.includes('Alpha') && names.includes('Bravo'), `both are in the world (${names.join(', ')})`);
  const stats = await api('GET', '/me', undefined, tok);
  ok(stats.status === 200, 'account still fine');

  // A character in play can't be deleted (its next save would bring it back).
  ok((await api('DELETE', `/characters/${b}`, undefined, tok)).status === 409, 'deleting a character in play refused');

  // The same character again: only its old connection is kicked.
  const ca2 = joinWorld(tok, a);
  await ca2.ready;
  await sleep(500);
  ok(ca.isClosed() && ca.kick() === 'ตัวละครนี้เข้าเกมจากที่อื่น', `old A kicked (${ca.kick()})`);
  ok(!cb.isClosed() && !cb.kick(), 'B not kicked by A logging in again');
  ok(!ca2.isClosed(), 'new A is in');

  // Once B left, it can be deleted.
  cb.ws.close();
  await sleep(500);
  ok((await api('DELETE', `/characters/${b}`, undefined, tok)).status === 200, 'deleting after leaving works');
  ca2.ws.close();
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
finish('multi-login');
