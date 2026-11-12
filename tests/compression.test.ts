// WebSocket compression (permessage-deflate): a client that offers it gets snapshots compressed,
// far fewer bytes on the wire than the JSON inside; a client that does not still plays, uncompressed.
// Prints the bytes a second each way. Runs its own game server on a free port with a throwaway database.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
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

interface Measured {
  extensions: string;
  snaps: number;
  /** JSON bytes of the snapshots received. */
  json: number;
  /** Bytes that came in on the socket meanwhile (frames, compressed or not). */
  wire: number;
}

/** Joins as the character, waits for the first snapshot, then counts for `ms`. */
async function measure(token: string, characterId: number, deflate: boolean, ms: number): Promise<Measured> {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`, { perMessageDeflate: deflate });
  let snaps = 0;
  let json = 0;
  let counting = false;
  let first!: () => void;
  const gotFirst = new Promise<void>((r) => (first = r));
  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', token, characterId })));
  ws.on('message', (data: Buffer) => {
    const m = JSON.parse(data.toString());
    if (m.t !== 'snap') return;
    first();
    if (!counting) return;
    snaps++;
    json += data.length;
  });
  await Promise.race([gotFirst, sleep(5000)]);
  // Let the first snapshots (inventory, stash) pass, then count steady play.
  await sleep(500);
  const sock = (ws as unknown as { _socket: { bytesRead: number } })._socket;
  const from = sock.bytesRead;
  counting = true;
  await sleep(ms);
  counting = false;
  const wire = sock.bytesRead - from;
  const extensions = String((ws as unknown as { extensions: string }).extensions ?? '');
  ws.close();
  await new Promise((r) => ws.once('close', r));
  await sleep(300);
  return { extensions, snaps, json, wire };
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
  const r = await fetch(`${BASE}/api/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ทดสอบบีบอัด', classId: 'sword' }),
  });
  const g = (await r.json()) as any;
  ok(r.status === 201 && g.token, `create guest (${r.status})`);

  const MS = 3000;
  const z = await measure(g.token, g.character.id, true, MS);
  ok(z.extensions.includes('permessage-deflate'), `compression negotiated (${z.extensions || 'none'})`);
  ok(z.snaps > 20, `snapshots arrive compressed (${z.snaps} in ${MS / 1000} s)`);
  ok(z.wire < z.json * 0.5, `compressed: ${z.json} B of JSON took ${z.wire} B on the wire (${Math.round((100 * z.wire) / Math.max(1, z.json))}%)`);

  const plain = await measure(g.token, g.character.id, false, MS);
  ok(!plain.extensions.includes('permessage-deflate'), 'a client without compression is not given it');
  ok(plain.snaps > 20, `snapshots still arrive uncompressed (${plain.snaps} in ${MS / 1000} s)`);
  ok(plain.wire >= plain.json, `uncompressed: ${plain.json} B of JSON took ${plain.wire} B on the wire`);
  const perSec = (b: number) => Math.round(b / (MS / 1000));
  console.log(`      town, 1 player: ${perSec(plain.wire)} B/s uncompressed → ${perSec(z.wire)} B/s compressed`);
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
finish('compression');
