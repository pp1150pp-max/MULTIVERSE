// Server-wide cosmetic tuning (the /admin "ของแต่งตัว" bench): the checks on what may be saved, and the
// /admin API against a real game server this script starts on a free port with a throwaway database
// (never the real server or server/data): GM may read but not save, owner saves (audit log), sent on
// joining and pushed to everyone online when it changes, an old database with nothing saved = code defaults.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { checkCosTuning, COS_TUNE_FIELDS, COS_TUNING_SETTING, cosTuneDefaults, cosTuneOf, cosTuningChanges, TUNED_SLOTS } from '../src/shared/cosTuning';
import { COSMETICS } from '../src/shared/data/cosmetics';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-coslook-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;

// ---------------------------------------------------------- checks (no server)
for (const c of COSMETICS) {
  const d = cosTuneDefaults(c.id);
  if (c.slot === 'title') {
    ok(d === undefined, `${c.id}: a title set has no tuning`);
    continue;
  }
  const fields = COS_TUNE_FIELDS[c.slot];
  ok(!!d && Object.keys(fields).every((k) => k in d) && Object.keys(d).every((k) => k in fields), `${c.id}: defaults cover every field`);
  for (const [k, f] of Object.entries(fields)) {
    const v = d![k];
    ok(f.kind === 'bool' ? typeof v === 'boolean' : typeof v === 'number' && v >= f.min && v <= f.max, `${c.id}.${k}: default ${v} fits its range`);
  }
}
ok(TUNED_SLOTS.length === 4, 'wings, mounts, pets and auras are tuned');
ok(cosTuneDefaults('wings_angel')?.lift === 0.8 && cosTuneDefaults('wings_angel')?.back === 0.22, 'wings start where #195 put them (lift 0.8, back 0.22)');
ok(cosTuneDefaults('mount_hoverboard')?.board === true && cosTuneDefaults('mount_wolf')?.seat === 0.5, 'mount defaults kept (board, seat)');
ok(cosTuneDefaults('pet_dragon')?.fly === true && cosTuneDefaults('pet_cat')?.fly === false, 'pet flying defaults kept');
ok(JSON.stringify(checkCosTuning({ wings_angel: { lift: 0.8 } }, true).tuning) === '{}', 'a value equal to the code default is not stored');
ok(checkCosTuning({ wings_angel: { lift: 1.23456 } }, true).tuning?.wings_angel?.lift === 1.23, 'numbers are rounded to 2 decimals');
ok(!!checkCosTuning({ wings_angel: { lift: 9 } }, true).error, 'out of range is refused');
ok(!!checkCosTuning({ wings_angel: { lift: '1' } }, true).error, 'a number sent as text is refused');
ok(!!checkCosTuning({ pet_cat: { fly: 1 } }, true).error, 'an on/off field must be true/false');
ok(!!checkCosTuning({ wings_angel: { seat: 1 } }, true).error, 'a field of another slot is refused');
ok(!!checkCosTuning({ wings_nope: { lift: 1 } }, true).error, 'an unknown cosmetic is refused');
ok(!!checkCosTuning({ title_gold: {} }, true).error, 'a title set cannot be tuned');
ok(!!checkCosTuning([], true).error && !!checkCosTuning(null, true).error, 'not an object is refused');
const lenient = checkCosTuning({ wings_nope: { lift: 1 }, wings_bat: { lift: 9, back: 0.3, gone: 1 } }, false).tuning;
ok(JSON.stringify(lenient) === '{"wings_bat":{"back":0.3}}', 'read back leniently: unknown and bad entries dropped, the rest kept');
ok(cosTuneOf({ wings_bat: { back: 0.3 } }, 'wings_bat')?.lift === 0.8, 'changes go on top of the code defaults');
ok(cosTuningChanges({}, { wings_bat: { back: 0.3 } }) === 'wings_bat.back 0.22 → 0.3', 'audit text lists what changed');

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
  const n = (db.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action = 'cos-look'").get() as { n: number }).n;
  db.close();
  return n;
};
const settingRow = (): string | null => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(COS_TUNING_SETTING) as { value: string } | undefined;
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

  // Who may see / save it. A fresh database has nothing saved: the code defaults.
  const gmGet = await api('GET', '/admin/cos-look', undefined, tok.gm1);
  ok(gmGet.status === 200 && gmGet.data.canEdit === false && JSON.stringify(gmGet.data.tuning) === '{}', 'GM sees the tuning (bench, nothing saved yet) but may not save it');
  ok((await api('GET', '/admin/cos-look', undefined, tok.plain1)).status === 403, 'a player cannot read it from the admin API');
  const changed = { wings_angel: { lift: 1.1, back: 0.3 }, mount_wolf: { seat: 0.6 }, pet_cat: { fly: true, float: 1 }, aura_star: { size: 3 } };
  ok((await api('POST', '/admin/cos-look', { tuning: changed }, tok.gm1)).status === 403, 'GM cannot save the tuning');
  ok((await api('POST', '/admin/cos-look', { tuning: changed }, tok.plain1)).status === 403, 'a player cannot save the tuning');
  ok((await api('POST', '/admin/cos-look', { reset: true }, tok.gm1)).status === 403, 'GM cannot reset it either');
  const ownerGet = await api('GET', '/admin/cos-look', undefined, tok.owner1);
  ok(ownerGet.status === 200 && ownerGet.data.canEdit === true, 'the owner may save it');

  // Bad values are refused and change nothing.
  for (const [what, tuning] of [
    ['unknown cosmetic', { wings_nope: { lift: 1 } }],
    ['range', { wings_angel: { lift: 50 } }],
    ['extra field', { wings_angel: { hack: 1 } }],
    ['title set', { title_gold: { size: 1 } }],
    ['not an object', 'x'],
  ] as const) {
    ok((await api('POST', '/admin/cos-look', { tuning }, tok.owner1)).status === 400, `bad ${what} refused`);
  }
  ok(auditCount() === 0 && settingRow() === null, 'refused saves leave no audit row and no setting');

  // Joining gets the tuning; saving pushes it to everyone online.
  const p1 = joinWorld(tok.plain1, chars.plain1);
  await p1.ready;
  const w1 = p1.msgs.find((m) => m.t === 'welcome');
  ok(w1 && JSON.stringify(w1.cosTuning) === '{}', 'joining sends the (empty) tuning in welcome');
  const saved = await api('POST', '/admin/cos-look', { tuning: changed }, tok.owner1);
  ok(saved.status === 200 && saved.data.tuning.wings_angel?.lift === 1.1 && saved.data.tuning.pet_cat?.fly === true, 'the owner saves new tuning');
  await sleep(300);
  const pushed = p1.msgs.filter((m) => m.t === 'cosTuning');
  ok(pushed.length === 1 && pushed[0].tuning.mount_wolf?.seat === 0.6, 'a player online gets the new tuning at once');
  ok(auditCount() === 1, 'the change is in the audit log');
  ok(JSON.parse(settingRow() ?? '{}').aura_star?.size === 3, 'saved in the settings table');
  await api('POST', '/admin/cos-look', { tuning: changed }, tok.owner1);
  await sleep(200);
  ok(auditCount() === 1 && p1.msgs.filter((m) => m.t === 'cosTuning').length === 1, 'saving the same tuning again logs and sends nothing');
  const p2 = joinWorld(tok.plain2, chars.plain2);
  await p2.ready;
  ok(p2.msgs.find((m) => m.t === 'welcome')?.cosTuning?.wings_angel?.back === 0.3, 'a player joining later gets the saved tuning');

  // Back to the code defaults.
  const reset = await api('POST', '/admin/cos-look', { reset: true }, tok.owner1);
  await sleep(300);
  ok(reset.status === 200 && JSON.stringify(reset.data.tuning) === '{}' && settingRow() === null, 'reset goes back to the code defaults and removes the setting');
  ok(JSON.stringify(p2.msgs.filter((m) => m.t === 'cosTuning').at(-1)?.tuning) === '{}', 'players online get the reset too');
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
    finish('cos look');
  });
