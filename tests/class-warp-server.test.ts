// The mage's Warp on the real server (owner 2026-11-27, docs/systems/skills.md "พาสซีฟประจำอาชีพ"): the dash button puts the
// character at the dash's end at once and the browser is told to jump there (`me.epoch` changes). The positions the browser
// sent before that snapshot reached it (from where it no longer is) carry the old epoch and are refused, so the character is
// not pulled back. A browser that sends no epoch (an older one) is checked by distance only, as before. Runs its own game
// server on a free port with a throwaway database.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-cwarp-test-'));
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

async function account(user: string, name: string) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  await api('POST', '/characters', { name, classId: 'mage' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number }[];
  return { tok, id: chars[0]?.id };
}

function joinWorld(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', token, characterId })));
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      msgs.push(m);
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    });
  });
  const you = () => msgs.filter((m) => m.t === 'welcome' || m.t === 'zone').at(-1)?.you;
  const last = () => msgs.filter((m) => m.t === 'snap').at(-1);
  const pos = () => ({ ...(last()?.players.find((p: any) => p.id === you()) as { x: number; z: number }) });
  const epoch = () => msgs.filter((m) => m.t === 'snap' && m.me).at(-1)?.me.epoch as number;
  let seq = 0;
  const input = (at: { x: number; z: number }, o: { dash?: boolean; epoch?: number | null } = {}) =>
    ws.send(JSON.stringify({
      t: 'input', pos: at, seq: ++seq, move: o.dash ? { x: 1, z: 0 } : null, aim: { x: at.x + 10, z: at.z }, basic: false, skills: [], dash: !!o.dash, potion: null,
      ...(o.epoch === null ? {} : { epoch: o.epoch ?? epoch() }),
    }));
  return { ws, ready, pos, epoch, input };
}

/** Warps east, then sends where the browser still thought it was (2 m along) for a while; where does it end up? */
async function tryOnce(C: ReturnType<typeof joinWorld>, sendEpoch: boolean): Promise<{ moved: number; pulled: number; epochChanged: boolean }> {
  const here = C.pos();
  for (let i = 0; i < 4; i++) {
    C.input(here);
    await sleep(60);
  }
  await sleep(200);
  const start = C.pos();
  const e0 = C.epoch();
  C.input(start, { dash: true });
  await sleep(250);
  // The browser hasn't seen the warp yet: it walked 2 m east and reports that, with the epoch it knows.
  const stale = { x: start.x + 2, z: start.z };
  for (let i = 0; i < 5; i++) {
    C.input(stale, { epoch: sendEpoch ? e0 : null });
    await sleep(60);
  }
  await sleep(300);
  const end = C.pos();
  return { moved: Math.hypot(end.x - start.x, end.z - start.z), pulled: Math.hypot(end.x - stale.x, end.z - stale.z), epochChanged: C.epoch() !== e0 };
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
  const a = await account('cwarp1', 'Wanda');
  const C = joinWorld(a.tok, a.id);
  await C.ready;
  await sleep(400);

  const r = await tryOnce(C, true);
  ok(r.epochChanged, 'the warp bumps the epoch (the browser jumps there)');
  ok(r.moved > 3, `the mage stands further along after the warp (${r.moved.toFixed(2)} m)`);
  ok(r.pulled > 0.5, `the positions sent from before the warp are refused: not pulled back (${r.pulled.toFixed(2)} m from the stale spot)`);

  // Wait for the warps to come back, then the same from an older browser that sends no epoch.
  await sleep(5500);
  const old = await tryOnce(C, false);
  ok(old.epochChanged && old.pulled < 0.6, `without an epoch the old distance check alone applies (stale spot taken: ${old.pulled.toFixed(2)} m, moved ${old.moved.toFixed(2)} m)`);
  C.ws.close();
}

try {
  await run();
} catch (e) {
  ok(false, `test crashed: ${(e as Error).stack}`);
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  rmSync(dir, { recursive: true, force: true });
}
finish('class-warp-server');
