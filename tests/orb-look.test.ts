// Server-wide enhancement orb look: the checks on what may be saved, the client's palette/shape lists
// matching the shared ones, and the /admin API against a real game server this script starts on a free
// port with a throwaway database (never the real server or server/data): owner only, audit log,
// sent on joining and pushed to everyone online when it changes.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { checkOrbLook, DEFAULT_ORB_LOOK, ORB_LOOK_SETTING, ORB_PALETTE_IDS, ORB_SHAPE_IDS, type OrbLook } from '../src/shared/orbLook';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-orblook-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;

// ---------------------------------------------------------- checks (no server)
ok(checkOrbLook({ ...DEFAULT_ORB_LOOK }).look !== undefined, 'the default look passes the check');
ok(DEFAULT_ORB_LOOK.palette === 'arcane' && DEFAULT_ORB_LOOK.shape === 'sphere' && DEFAULT_ORB_LOOK.scale === 0.8, 'default = the owner\'s pick (arcane, sphere, size 0.8)');
ok(!!checkOrbLook({ ...DEFAULT_ORB_LOOK, scale: 9 }).error, 'a number out of range is refused');
ok(!!checkOrbLook({ ...DEFAULT_ORB_LOOK, glow: Number.NaN }).error, 'NaN is refused');
ok(!!checkOrbLook({ ...DEFAULT_ORB_LOOK, speed: '0.2' }).error, 'a number sent as text is refused');
ok(!!checkOrbLook({ ...DEFAULT_ORB_LOOK, palette: 'gold' }).error, 'an unknown palette is refused');
ok(!!checkOrbLook({ ...DEFAULT_ORB_LOOK, shape: 'cube' }).error, 'an unknown shape is refused');
ok(!!checkOrbLook({ ...DEFAULT_ORB_LOOK, softGlow: 1 }).error, 'softGlow must be true/false');
ok(!!checkOrbLook({ ...DEFAULT_ORB_LOOK, extra: 1 }).error, 'an unknown field is refused');
const { trail: _t, ...noTrail } = DEFAULT_ORB_LOOK;
ok(!!checkOrbLook(noTrail).error, 'a missing field is refused');
ok(!!checkOrbLook(null).error && !!checkOrbLook([]).error, 'not an object is refused');
ok(checkOrbLook({ ...DEFAULT_ORB_LOOK, scale: 1.23456 }).look?.scale === 1.23, 'numbers are rounded to 2 decimals');
// (The browser builds its palette and shape lists from ORB_PALETTE_IDS / ORB_SHAPE_IDS, checked by the type checker.)
ok(new Set(ORB_PALETTE_IDS).size === ORB_PALETTE_IDS.length && new Set(ORB_SHAPE_IDS).size === ORB_SHAPE_IDS.length, 'palette and shape ids are unique');

// ---------------------------------------------------------- against a real server
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

const auditCount = (): number => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const n = (db.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action = 'orb-look'").get() as { n: number }).n;
  db.close();
  return n;
};
const settingRow = (): string | null => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(ORB_LOOK_SETTING) as { value: string } | undefined;
  db.close();
  return r?.value ?? null;
};

async function run(): Promise<void> {
  const port = await freePort();
  const base = `http://localhost:${port}`;
  proc = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE }, stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; ; i++) {
    try {
      await fetch(`${base}/api/me`);
      break;
    } catch {
      if (i > 100) throw new Error('test server did not start');
      await sleep(100);
    }
  }
  const api = async (method: string, path: string, body?: unknown, token?: string) => {
    const r = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
  };
  const joinWorld = (token: string, characterId: number) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`);
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
    return { ws, msgs, ready };
  };

  const tok: Record<string, string> = {};
  const chars: Record<string, number> = {};
  for (const u of ['owner1', 'gm1', 'plain1', 'plain2']) {
    tok[u] = (await api('POST', '/register', { username: u, password: 'secret123' })).data.token;
    chars[u] = (await api('POST', '/characters', { name: `C_${u}`, classId: 'sword' }, tok[u])).data.id;
  }
  spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE } });
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: 'gm' }, tok.owner1)).status === 200, 'gm1 made GM');

  // Who may see / save it.
  const gmGet = await api('GET', '/admin/orb-look', undefined, tok.gm1);
  ok(gmGet.status === 200 && gmGet.data.canEdit === false && gmGet.data.look.scale === DEFAULT_ORB_LOOK.scale, 'GM sees the look (bench) but may not save it');
  ok((await api('GET', '/admin/orb-look', undefined, tok.plain1)).status === 403, 'a player cannot read it from the admin API');
  const changed: OrbLook = { ...DEFAULT_ORB_LOOK, palette: 'fire', shape: 'star', scale: 1.2, bob: 0.2 };
  ok((await api('POST', '/admin/orb-look', { look: changed }, tok.gm1)).status === 403, 'GM cannot save the look');
  ok((await api('POST', '/admin/orb-look', { look: changed }, tok.plain1)).status === 403, 'a player cannot save the look');
  const ownerGet = await api('GET', '/admin/orb-look', undefined, tok.owner1);
  ok(ownerGet.status === 200 && ownerGet.data.canEdit === true, 'the owner may save it');

  // Bad values are refused and change nothing.
  for (const [what, look] of [
    ['palette', { ...changed, palette: 'gold' }],
    ['shape', { ...changed, shape: 'cube' }],
    ['range', { ...changed, radius: 5 }],
    ['extra field', { ...changed, hack: true }],
    ['not an object', 'x'],
  ] as const) {
    ok((await api('POST', '/admin/orb-look', { look }, tok.owner1)).status === 400, `bad ${what} refused`);
  }
  ok(auditCount() === 0 && settingRow() === null, 'refused saves leave no audit row and no setting');

  // Joining gets the look; saving pushes it to everyone online.
  const p1 = joinWorld(tok.plain1, chars.plain1);
  await p1.ready;
  const w1 = p1.msgs.find((m) => m.t === 'welcome');
  ok(w1 && checkOrbLook(w1.orbLook).look?.palette === DEFAULT_ORB_LOOK.palette, 'joining sends the default look in welcome');
  const saved = await api('POST', '/admin/orb-look', { look: changed }, tok.owner1);
  ok(saved.status === 200 && saved.data.look.palette === 'fire' && saved.data.look.scale === 1.2, 'the owner saves a new look');
  await sleep(300);
  const pushed = p1.msgs.filter((m) => m.t === 'orbLook');
  ok(pushed.length === 1 && pushed[0].look.shape === 'star' && pushed[0].look.bob === 0.2, 'a player online gets the new look at once');
  ok(auditCount() === 1, 'the change is in the audit log');
  ok(JSON.parse(settingRow() ?? '{}').palette === 'fire', 'saved in the settings table');
  await api('POST', '/admin/orb-look', { look: changed }, tok.owner1);
  await sleep(200);
  ok(auditCount() === 1 && p1.msgs.filter((m) => m.t === 'orbLook').length === 1, 'saving the same look again logs and sends nothing');
  const p2 = joinWorld(tok.plain2, chars.plain2);
  await p2.ready;
  ok(p2.msgs.find((m) => m.t === 'welcome')?.orbLook?.palette === 'fire', 'a player joining later gets the saved look');

  // Back to the default.
  const reset = await api('POST', '/admin/orb-look', { reset: true }, tok.owner1);
  await sleep(300);
  ok(reset.status === 200 && reset.data.look.palette === DEFAULT_ORB_LOOK.palette && settingRow() === null, 'reset goes back to the default and removes the setting');
  ok(p2.msgs.filter((m) => m.t === 'orbLook').at(-1)?.look.palette === DEFAULT_ORB_LOOK.palette, 'players online get the reset too');
  ok(auditCount() === 2, 'the reset is in the audit log');
  p1.ws.close();
  p2.ws.close();
}

run()
  .catch((e) => ok(false, `crashed: ${(e as Error).stack ?? e}`))
  .finally(async () => {
    proc?.kill();
    await sleep(300);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may still hold the database for a moment; it is in the temp folder anyway.
    }
    finish('orb look');
  });
