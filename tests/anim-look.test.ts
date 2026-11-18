// Server-wide per-facing animation fixes (the /admin "ท่าตัวละคร" bench, src/shared/animTuning.ts): the checks on
// what may be saved, and the /admin API against a real game server this script starts on a free port with a throwaway
// database (never the real server or server/data): GM may read but not save, owner saves (audit log), sent on joining
// and pushed to everyone online when it changes, nothing saved = the code as is.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ANIM_TUNING_SETTING, animTuningChanges, checkAnimTuning, screenDirOf } from '../src/shared/animTuning';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-animlook-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;

// ---------------------------------------------------------- checks (no server)
const S = Math.SQRT1_2;
// AnimatedActor.face(dx, dz): sx = (dx - dz)·S (screen right), sy = (-dx - dz)·S (negative = toward the camera).
const dirOfWorld = (dx: number, dz: number) => screenDirOf((dx - dz) * S, (-dx - dz) * S);
ok(dirOfWorld(1, 1) === 's' && dirOfWorld(-1, -1) === 'n' && dirOfWorld(1, -1) === 'e' && dirOfWorld(-1, 1) === 'w', 'straight facings on screen');
ok(dirOfWorld(1, 0) === 'se' && dirOfWorld(0, 1) === 'sw' && dirOfWorld(0, -1) === 'ne' && dirOfWorld(-1, 0) === 'nw', 'diagonal facings on screen');

const good = checkAnimTuning({ 'sword.old.run': { n: { rate: 0.72, row: 'up', flip: false, x: 0.1, y: -0.05, scale: 1.1 } }, 'sword.rig.run': { s: { rate: 0.8 } } }, true);
ok(JSON.stringify(good.tuning) === '{"sword.old.run":{"n":{"row":"up","flip":false,"rate":0.72,"x":0.1,"y":-0.05,"scale":1.1}},"sword.rig.run":{"s":{"rate":0.8}}}', `a good tuning is kept in a fixed order (${JSON.stringify(good.tuning)})`);
ok(JSON.stringify(checkAnimTuning({ 'mage.paper.idle': { e: { rate: 1, x: 0, scale: 1 } } }, true).tuning) === '{}', 'values equal to the code are not stored');
ok(checkAnimTuning({ 'mage.old.run': { e: { rate: 1.23456 } } }, true).tuning?.['mage.old.run']?.e?.rate === 1.23, 'numbers are rounded to 2 decimals');
for (const [what, v] of [
  ['rate out of range', { 'sword.old.run': { n: { rate: 5 } } }],
  ['rate as text', { 'sword.old.run': { n: { rate: '1' } } }],
  ['unknown row', { 'sword.old.run': { n: { row: 'left' } } }],
  ['flip not true/false', { 'sword.old.run': { n: { flip: 1 } } }],
  ['unknown field', { 'sword.old.run': { n: { hack: 1 } } }],
  ['unknown facing', { 'sword.old.run': { up: { rate: 1.2 } } }],
  ['unknown class', { 'ninja.old.run': { n: { rate: 1.2 } } }],
  ['unknown art', { 'sword.gold.run': { n: { rate: 1.2 } } }],
  ['unknown animation', { 'sword.old.fly': { n: { rate: 1.2 } } }],
  ['rig of another class', { 'mage.rig.run': { n: { rate: 1.2 } } }],
  ['rig nudged (only speed)', { 'sword.rig.run': { n: { x: 0.2 } } }],
  ['not an object', 'x'],
] as const) ok(!!checkAnimTuning(v, true).error, `${what} refused`);
ok(JSON.stringify(checkAnimTuning({ 'ninja.old.run': { n: { rate: 2 } }, 'sword.old.run': { n: { rate: 9, x: 0.2 }, up: {} } }, false).tuning) === '{"sword.old.run":{"n":{"x":0.2}}}', 'read back leniently: unknown and bad entries dropped, the rest kept');
ok(animTuningChanges({}, { 'sword.old.run': { n: { rate: 0.72, flip: true } } }) === 'นักดาบ ภาพเดิม วิ่ง ↑: พลิก อัตโนมัติ → พลิก, ความเร็ว ×1 → ×0.72', `audit text (${animTuningChanges({}, { 'sword.old.run': { n: { rate: 0.72, flip: true } } })})`);

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
const auditOf = (): string[] => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const rows = db.prepare("SELECT details FROM admin_audit WHERE action = 'anim-look' ORDER BY id").all() as { details: string }[];
  db.close();
  return rows.map((r) => r.details);
};
const settingRow = (): string | null => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(ANIM_TUNING_SETTING) as { value: string } | undefined;
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
  for (const u of ['owner1', 'gm1', 'plain1']) {
    tok[u] = (await api('POST', '/register', { username: u, password: 'secret123' })).data.token;
    chars[u] = (await api('POST', '/characters', { name: `C_${u}`, classId: 'sword' }, tok[u])).data.id;
  }
  spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE } });
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: 'gm' }, tok.owner1)).status === 200, 'gm1 made GM');

  const gmGet = await api('GET', '/admin/anim-look', undefined, tok.gm1);
  ok(gmGet.status === 200 && gmGet.data.canEdit === false && JSON.stringify(gmGet.data.tuning) === '{}', 'GM sees the bench (nothing saved yet) but may not save');
  ok((await api('GET', '/admin/anim-look', undefined, tok.plain1)).status === 403, 'a player cannot read it from the admin API');
  const changed = { 'sword.old.run': { n: { rate: 0.72 }, s: { rate: 0.72 } }, 'mage.paper.run_attack': { e: { flip: false, x: 0.05 } } };
  ok((await api('POST', '/admin/anim-look', { tuning: changed }, tok.gm1)).status === 403, 'GM cannot save');
  ok((await api('POST', '/admin/anim-look', { reset: true }, tok.gm1)).status === 403, 'GM cannot reset either');
  ok((await api('POST', '/admin/anim-look', { tuning: changed }, tok.plain1)).status === 403, 'a player cannot save');
  ok((await api('GET', '/admin/anim-look', undefined, tok.owner1)).data.canEdit === true, 'the owner may save');
  ok((await api('POST', '/admin/anim-look', { tuning: { 'sword.old.run': { n: { rate: 50 } } } }, tok.owner1)).status === 400, 'a bad value is refused');
  ok(auditOf().length === 0 && settingRow() === null, 'refused saves leave no audit row and no setting');

  const p1 = joinWorld(tok.plain1, chars.plain1);
  await p1.ready;
  ok(JSON.stringify(p1.msgs.find((m) => m.t === 'welcome')?.animTuning) === '{}', 'joining sends the (empty) tuning in welcome');
  const saved = await api('POST', '/admin/anim-look', { tuning: changed }, tok.owner1);
  ok(saved.status === 200 && saved.data.tuning['sword.old.run']?.n?.rate === 0.72, 'the owner saves');
  await sleep(300);
  const pushed = p1.msgs.filter((m) => m.t === 'animTuning');
  ok(pushed.length === 1 && pushed[0].tuning['mage.paper.run_attack']?.e?.flip === false, 'a player online gets it at once');
  ok(auditOf().length === 1 && /นักดาบ ภาพเดิม วิ่ง ↑: ความเร็ว ×1 → ×0\.72/.test(auditOf()[0]), `the change is in the audit log in Thai (${auditOf()[0]})`);
  ok(JSON.parse(settingRow() ?? '{}')['sword.old.run']?.s?.rate === 0.72, 'saved in the settings table');
  await api('POST', '/admin/anim-look', { tuning: changed }, tok.owner1);
  await sleep(200);
  ok(auditOf().length === 1 && p1.msgs.filter((m) => m.t === 'animTuning').length === 1, 'saving the same again logs and sends nothing');
  ok((await api('POST', '/admin/anim-look', { reset: true }, tok.owner1)).status === 200 && settingRow() === null, 'reset removes the setting (back to the code)');
  await sleep(200);
  ok(auditOf().length === 2 && /^คืนค่าเริ่มต้น: /.test(auditOf()[1]) && JSON.stringify(p1.msgs.filter((m) => m.t === 'animTuning').at(-1)?.tuning) === '{}', 'the reset is logged and sent');
  p1.ws.close();
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
    finish('anim look');
  });
