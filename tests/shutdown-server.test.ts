// Graceful stop/restart tests against real game servers that this script starts by itself on free
// ports with a throwaway database (never the real server or server/data), then stops:
// the countdown is broadcast, joins are refused meanwhile, everyone is saved before the exit,
// only the owner may trigger it from the admin page, and npm run stop-server works.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { RESTART_EXIT_CODE, shutdownCancelled, shutdownKick } from '../src/shared/net/protocol';
import { controlFilePath, CTRL_C_WINDOW_MS, DoublePress, STOP_PATH, TOKEN_HEADER } from '../server/control';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-shutdown-test-'));
const DB_FILE = join(dir, 'test.db');
const COUNTDOWN = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const running: ChildProcess[] = [];

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

async function startServer(supervised: boolean) {
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const proc = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DB_FILE, SHUTDOWN_SECONDS: String(COUNTDOWN), MULTIVERSE_SUPERVISED: supervised ? '1' : '' },
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  running.push(proc);
  const exited = new Promise<number | null>((r) => proc.once('exit', (code) => r(code)));
  for (let i = 0; ; i++) {
    try {
      await fetch(`${base}/api/me`);
      break;
    } catch {
      if (i > 100) throw new Error('test server did not start');
      await sleep(100);
    }
  }
  const api = async (method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) => {
    const r = await fetch(`${base}${path.startsWith('/api') ? '' : '/api'}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
  };
  const joinWorld = (token: string, characterId: number) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`);
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
    return { ws, msgs, ready, isClosed: () => closed, send: (m: unknown) => ws.send(JSON.stringify(m)) };
  };
  return { port, proc, exited, api, joinWorld };
}

const saved = (charId: number): any => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const r = db.prepare('SELECT data FROM characters WHERE id = ?').get(charId) as { data: string };
  db.close();
  return JSON.parse(r.data);
};

async function run(): Promise<void> {
  // ---------------------------------------------------------- server A: started like npm run online
  const A = await startServer(true);
  const tok: Record<string, string> = {};
  const chars: Record<string, number> = {};
  for (const u of ['owner1', 'gm1', 'plain1', 'plain2', 'late1']) {
    tok[u] = (await A.api('POST', '/register', { username: u, password: 'secret123' })).data.token;
    chars[u] = (await A.api('POST', '/characters', { name: `C_${u}`, classId: 'sword' }, tok[u])).data.id;
  }
  spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE } });
  ok((await A.api('POST', '/admin/roles', { username: 'gm1', role: 'gm' }, tok.owner1)).status === 200, 'gm1 made GM');

  // Only the owner may stop the server.
  ok((await A.api('POST', '/admin/server', { mode: 'restart' }, tok.gm1)).status === 403, 'GM cannot restart the server');
  ok((await A.api('POST', '/admin/server', { mode: 'shutdown' }, tok.gm1)).status === 403, 'GM cannot shut the server down');
  ok((await A.api('GET', '/admin/server', undefined, tok.gm1)).status === 403, 'GM cannot see the server panel');
  ok((await A.api('POST', '/admin/server', { mode: 'shutdown' }, tok.plain1)).status === 403, 'player cannot shut the server down');
  ok((await A.api('POST', '/admin/server', { mode: 'nope' }, tok.owner1)).status === 400, 'unknown mode refused');
  // The script endpoint needs the token from the control file.
  ok((await A.api('POST', STOP_PATH, { mode: 'shutdown' })).status === 403, 'stop endpoint without token → 403');
  ok((await A.api('POST', STOP_PATH, { mode: 'shutdown' }, undefined, { [TOKEN_HEADER]: 'x'.repeat(64) })).status === 403, 'stop endpoint with a wrong token → 403');
  ok(existsSync(controlFilePath(DB_FILE, A.port)), 'control file written next to the database');
  const st = await A.api('GET', '/admin/server', undefined, tok.owner1);
  ok(st.status === 200 && st.data.supervised === true && st.data.stopping === null, 'owner sees the server panel');

  const p1 = A.joinWorld(tok.plain1, chars.plain1);
  const p2 = A.joinWorld(tok.plain2, chars.plain2);
  await Promise.all([p1.ready, p2.ready]);
  ok(p1.msgs.some((m) => m.t === 'snap') && p2.msgs.some((m) => m.t === 'snap'), 'two players in the world');

  // ---------------------------------------------------------- owner restarts from the admin page
  const restart = await A.api('POST', '/admin/server', { mode: 'restart' }, tok.owner1);
  ok(restart.status === 200 && restart.data.stopping === 'restart', `owner starts a restart (${restart.status} ${restart.data.error ?? ''})`);
  ok((await A.api('POST', '/admin/server', { mode: 'shutdown' }, tok.owner1)).status === 409, 'a second stop during the countdown is refused');
  await sleep(600);
  const late = A.joinWorld(tok.late1, chars.late1);
  await late.ready;
  await sleep(200);
  const lateKick = late.msgs.find((m) => m.t === 'kick');
  ok(lateKick && String(lateKick.msg).includes('รีสตาร์ท') && !late.msgs.some((m) => m.t === 'snap') && late.isClosed(),
    `joining during the countdown is refused (${lateKick?.msg})`);
  // A change that would only be saved 2 s later (the normal delay): the exit must save it anyway.
  await sleep(COUNTDOWN * 1000 - 1500);
  p1.send({ t: 'act', a: 'lootFilter', filter: { rarities: ['legendary'], potions: false } });

  const code = await A.exited;
  ok(code === RESTART_EXIT_CODE, `server exits with the restart code (${code})`);
  for (const [name, p] of [['plain1', p1], ['plain2', p2]] as const) {
    const counts = p.msgs.filter((m) => m.t === 'shutdown').map((m) => `${m.mode}:${m.seconds}`);
    ok(counts.join(',') === ['restart:3', 'restart:2', 'restart:1'].join(','), `${name} got the countdown every second (${counts.join(',')})`);
    const kick = p.msgs.find((m) => m.t === 'kick');
    ok(kick?.msg === shutdownKick('restart') && p.isClosed(), `${name} disconnected with "${kick?.msg}"`);
  }
  ok(JSON.stringify(saved(chars.plain1).lootFilter?.rarities) === '["legendary"]', 'last change saved before the exit');
  ok(!existsSync(controlFilePath(DB_FILE, A.port)), 'control file removed on exit');
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const audit = db.prepare("SELECT * FROM admin_audit WHERE action = 'server'").all() as any[];
  db.close();
  ok(audit.length === 1 && audit[0].admin_name === 'owner1' && audit[0].details === 'รีสตาร์ท', 'restart written to the audit log');

  // ---------------------------------------------------------- server B: plain npm run server, stopped by the script
  const B = await startServer(false);
  const ownerB = (await B.api('POST', '/login', { username: 'owner1', password: 'secret123' })).data.token;
  const nr = await B.api('POST', '/admin/server', { mode: 'restart' }, ownerB);
  ok(nr.status === 409, 'restart refused when nothing would start the server again');
  const q = B.joinWorld(tok.plain1, chars.plain1);
  await q.ready;
  q.send({ t: 'act', a: 'lootFilter', filter: { rarities: ['epic', 'legendary'], potions: true } });
  const t0 = Date.now();
  // Not spawnSync: this process must keep reading the player's messages meanwhile.
  const script = await new Promise<{ status: number | null; stderr: string }>((done) => {
    const c = spawn(process.execPath, ['--import', 'tsx', 'server/stop-main.ts'], {
      cwd: ROOT, env: { ...process.env, PORT: String(B.port), DB_FILE }, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    c.stderr!.on('data', (d) => (stderr += d));
    c.on('exit', (status) => done({ status, stderr }));
  });
  await sleep(300);
  const waited = Date.now() - t0;
  ok(script.status === 0, `stop-server script succeeds (${script.status} ${script.stderr})`);
  ok(waited >= (COUNTDOWN - 0.5) * 1000, `stop-server waits for the countdown (${waited} ms)`);
  ok((await B.exited) === 0, 'server exits normally after a shutdown');
  ok(q.msgs.filter((m) => m.t === 'shutdown' && m.mode === 'shutdown').length === COUNTDOWN,
    `players got the shutdown countdown (${q.msgs.map((m) => m.t).filter((t) => t !== 'snap').join(',')})`);
  ok(q.msgs.find((m) => m.t === 'kick')?.msg === shutdownKick('shutdown'), `disconnect says "${shutdownKick('shutdown')}"`);
  ok(JSON.stringify(saved(chars.plain1).lootFilter?.rarities) === '["epic","legendary"]', 'player saved by the script shutdown');
  const again = spawnSync(process.execPath, ['--import', 'tsx', 'server/stop-main.ts'], {
    cwd: ROOT, env: { ...process.env, PORT: String(B.port), DB_FILE }, encoding: 'utf8',
  });
  ok(again.status === 0 && again.stdout.includes('ไม่พบ server'), 'stop-server with no server running says so');

  // ---------------------------------------------------------- Ctrl+C needs two presses
  const cc = new DoublePress(CTRL_C_WINDOW_MS);
  ok(cc.press(0) === false, 'first Ctrl+C only warns');
  ok(cc.press(CTRL_C_WINDOW_MS - 1) === true, 'second Ctrl+C within the window starts stopping');
  ok(cc.press(CTRL_C_WINDOW_MS + 100) === false, 'the count starts over after a stop');
  ok(cc.press(CTRL_C_WINDOW_MS * 3) === false, 'a press long after the last one only warns again');

  // ---------------------------------------------------------- server C: cancel (admin page and typed c), force (typed f)
  const C = await startServer(true);
  const ownerC = (await C.api('POST', '/login', { username: 'owner1', password: 'secret123' })).data.token;
  const gmC = (await C.api('POST', '/login', { username: 'gm1', password: 'secret123' })).data.token;
  const w = C.joinWorld(tok.plain1, chars.plain1);
  await w.ready;
  if (process.platform !== 'win32') {
    // A real single SIGINT (Windows can't send one to another process): nothing happens.
    C.proc.kill('SIGINT');
    await sleep(1200);
    ok(C.proc.exitCode === null && !w.msgs.some((m) => m.t === 'shutdown'), 'one SIGINT does nothing');
  } else {
    console.log('(skip) real single-SIGINT check: Windows cannot send SIGINT to another process');
  }
  ok((await C.api('POST', '/admin/server', { mode: 'cancel' }, ownerC)).status === 409, 'cancel with no countdown → 409');
  ok((await C.api('POST', '/admin/server', { mode: 'restart' }, ownerC)).status === 200, 'owner starts a restart');
  await sleep(500);
  ok((await C.api('POST', '/admin/server', { mode: 'cancel' }, gmC)).status === 403, 'GM cannot cancel');
  const blocked = C.joinWorld(tok.plain2, chars.plain2);
  await blocked.ready;
  ok(blocked.msgs.some((m) => m.t === 'kick'), 'join refused before the cancel');
  const cancel = await C.api('POST', '/admin/server', { mode: 'cancel' }, ownerC);
  ok(cancel.status === 200 && cancel.data.stopping === null, 'owner cancels from the admin page');
  await sleep(300);
  ok(w.msgs.some((m) => m.t === 'shutdownCancel' && m.mode === 'restart'), `player told "${shutdownCancelled('restart')}"`);
  const after = C.joinWorld(tok.plain2, chars.plain2);
  await after.ready;
  ok(after.msgs.some((m) => m.t === 'snap'), 'joins allowed again after the cancel');
  await sleep(COUNTDOWN * 1000 + 500);
  ok(C.proc.exitCode === null && !w.isClosed(), 'server keeps running after the cancel');
  const dbc = new DatabaseSync(DB_FILE, { readOnly: true });
  ok(!!dbc.prepare("SELECT 1 FROM admin_audit WHERE action = 'server' AND details = ?").get(shutdownCancelled('restart')), 'cancel written to the audit log');
  dbc.close();

  // Typed c + Enter in the server window cancels too.
  ok((await C.api('POST', '/admin/server', { mode: 'shutdown' }, ownerC)).status === 200, 'owner starts a shutdown');
  await sleep(400);
  C.proc.stdin!.write('c\n');
  await sleep(400);
  ok(w.msgs.some((m) => m.t === 'shutdownCancel' && m.mode === 'shutdown'), `typed c cancels: "${shutdownCancelled('shutdown')}"`);
  ok(C.proc.exitCode === null, 'still running after typed c');

  // Typed f + Enter during a countdown: save everyone and stop now.
  w.send({ t: 'act', a: 'lootFilter', filter: { rarities: ['rare'], potions: true } });
  ok((await C.api('POST', '/admin/server', { mode: 'restart' }, ownerC)).status === 200, 'owner starts another restart');
  await sleep(300);
  const tf = Date.now();
  C.proc.stdin!.write('f\n');
  const fcode = await C.exited;
  ok(fcode === RESTART_EXIT_CODE && Date.now() - tf < 1500, `typed f stops right away (${Date.now() - tf} ms, code ${fcode})`);
  ok(w.msgs.find((m) => m.t === 'kick')?.msg === shutdownKick('restart'), 'players told why on force stop');
  ok(JSON.stringify(saved(chars.plain1).lootFilter?.rarities) === '["rare"]', 'everyone saved on force stop');
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).stack}`);
} finally {
  for (const p of running) {
    if (p.exitCode === null && p.signalCode === null) {
      p.kill();
      await new Promise((r) => p.once('exit', r));
    }
  }
  rmSync(dir, { recursive: true, force: true });
}
finish('shutdown-server');
