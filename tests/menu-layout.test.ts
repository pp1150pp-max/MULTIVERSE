// The in-game menu / top icon row layout (src/shared/menuLayout.ts, /admin "จัดเมนูเกม"): what may be saved (the menu
// and settings buttons can never go missing or leave the end), and the /admin API against a real game server this
// script starts on a free port with a throwaway database: GM may read but not save, owner saves (audit log), pushed to
// players online and sent on joining, the balance tab's own save leaves it alone, nothing saved = the code as is.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { codeMenuLayout, checkMenuLayoutTuning } from '../src/shared/menuLayout';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-menulayout-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;

// ---------------------------------------------------------- checks (no server)
const code = codeMenuLayout();
ok(code.menu.at(-1) === 'settings', 'code: ตั้งค่า is the last button of the menu window');
ok(code.top.at(-1) === 'menu' && code.top.includes('auto'), 'code: เมนู is last in the top row, AUTO is there');
ok(JSON.stringify(mergeBalance({}).menuLayout) === JSON.stringify(code), 'the balance carries the code layout');
ok(JSON.stringify(checkBalance({ menuLayout: code }, true).tuning) === '{}', 'the code layout is not stored');
const moved = { menu: ['mail', 'bag', 'settings'], top: ['auto', 'trade', 'menu'] };
const t = checkBalance({ menuLayout: moved }, true).tuning!;
ok(JSON.stringify(t) === JSON.stringify({ menuLayout: moved }), 'a moved / hidden layout is stored whole');
ok(JSON.stringify(mergeBalance(t).menuLayout) === JSON.stringify(moved), 'and merged back as it is');
ok(JSON.stringify(checkBalance({ menuLayout: { top: ['auto', 'trade', 'menu'] } }, true).tuning) === '{"menuLayout":{"top":["auto","trade","menu"]}}', 'one list alone is fine, the other stays the code');
for (const [what, v] of [
  ['ตั้งค่า missing', { menu: ['bag'] }],
  ['ตั้งค่า not last', { menu: ['settings', 'bag'] }],
  ['เมนู missing', { top: ['auto', 'bag'] }],
  ['เมนู not last', { top: ['menu', 'auto'] }],
  ['AUTO missing', { top: ['bag', 'menu'] }],
  ['AUTO in the menu window', { menu: ['auto', 'settings'] }],
  ['เมนู in the menu window', { menu: ['menu', 'settings'] }],
  ['ตั้งค่า in the top row', { top: ['auto', 'settings', 'menu'] }],
  ['เต็มจอ in the top row', { top: ['auto', 'fullscreen', 'menu'] }],
  ['unknown button', { menu: ['nope', 'settings'] }],
  ['duplicate in a list', { menu: ['bag', 'bag', 'settings'] }],
  ['not a list', { menu: 'bag' }],
  ['unknown key', { side: [] }],
] as const) ok('error' in checkMenuLayoutTuning(v, true), `${what} refused`);
ok(checkBalance({ menuLayout: { menu: ['bag'] } }, false).tuning?.menuLayout === undefined, 'read back leniently: a bad list is dropped');
ok(/จัดเมนูเกม/.test(balanceChanges({}, t)), 'the audit names it');

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
  const rows = db.prepare("SELECT details FROM admin_audit WHERE action = 'menu-layout' ORDER BY id").all() as { details: string }[];
  db.close();
  return rows.map((r) => r.details);
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
      const tm = setTimeout(() => rej(new Error('join timed out')), 10_000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data));
        msgs.push(m);
        if (m.t === 'snap') {
          clearTimeout(tm);
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

  const gmGet = await api('GET', '/admin/menu-layout', undefined, tok.gm1);
  ok(gmGet.status === 200 && gmGet.data.canEdit === false && JSON.stringify(gmGet.data.layout) === JSON.stringify(code), 'GM sees the code layout but may not save');
  ok((await api('GET', '/admin/menu-layout', undefined, tok.plain1)).status === 403, 'a player cannot read it from the admin API');
  ok((await api('POST', '/admin/menu-layout', { layout: moved }, tok.gm1)).status === 403, 'GM cannot save');
  ok((await api('POST', '/admin/menu-layout', { reset: true }, tok.gm1)).status === 403, 'GM cannot reset either');
  ok((await api('POST', '/admin/menu-layout', { layout: moved }, tok.plain1)).status === 403, 'a player cannot save');
  ok((await api('POST', '/admin/menu-layout', { layout: { menu: ['bag'] } }, tok.owner1)).status === 400, 'a menu without ตั้งค่า is refused');
  ok((await api('POST', '/admin/menu-layout', { layout: { menu: ['settings', 'bag'] } }, tok.owner1)).status === 400, 'ตั้งค่า not last is refused');
  ok((await api('POST', '/admin/menu-layout', { layout: { top: ['auto', 'bag'] } }, tok.owner1)).status === 400, 'a top row without เมนู is refused');
  ok(auditOf().length === 0, 'refused saves leave no audit row');

  const p1 = joinWorld(tok.plain1, chars.plain1);
  await p1.ready;
  const saved = await api('POST', '/admin/menu-layout', { layout: moved }, tok.owner1);
  ok(saved.status === 200 && JSON.stringify(saved.data.layout) === JSON.stringify(moved), 'the owner saves');
  await sleep(300);
  const pushed = p1.msgs.filter((m) => m.t === 'balance');
  ok(pushed.length === 1 && JSON.stringify(pushed[0].tuning.menuLayout) === JSON.stringify(moved), 'a player online gets it at once');
  ok(auditOf().length === 1 && /จัดเมนูเกม/.test(auditOf()[0]), `the change is in the audit log in Thai (${auditOf()[0]})`);

  // The balance tab (GM or owner) saves its own numbers and must not undo / change the layout.
  const bal = (await api('GET', '/admin/balance', undefined, tok.gm1)).data.tuning;
  ok(JSON.stringify(bal.menuLayout) === JSON.stringify(moved), 'the balance carries the saved layout');
  const gmBal = await api('POST', '/admin/balance', { tuning: { hpRegenMult: 1.5, menuLayout: { menu: ['bag', 'settings'] } } }, tok.gm1);
  ok(gmBal.status === 200 && gmBal.data.tuning.hpRegenMult === 1.5 && JSON.stringify(gmBal.data.tuning.menuLayout) === JSON.stringify(moved), 'a GM balance save does not change the layout');
  const ownBal = await api('POST', '/admin/balance', { reset: true }, tok.owner1);
  ok(ownBal.status === 200 && JSON.stringify(ownBal.data.tuning) === JSON.stringify({ menuLayout: moved }), 'the balance reset keeps the layout');

  const p2 = joinWorld(tok.owner1, chars.owner1);
  await p2.ready;
  ok(JSON.stringify(p2.msgs.find((m) => m.t === 'welcome')?.balance?.menuLayout) === JSON.stringify(moved), 'joining sends the layout in welcome');

  await api('POST', '/admin/menu-layout', { layout: moved }, tok.owner1);
  ok(auditOf().length === 1, 'saving the same again logs nothing');
  const reset = await api('POST', '/admin/menu-layout', { reset: true }, tok.owner1);
  ok(reset.status === 200 && JSON.stringify(reset.data.layout) === JSON.stringify(code), 'reset = the code layout');
  await sleep(200);
  ok(auditOf().length === 2 && /^คืนค่าในโค้ด: /.test(auditOf()[1]), 'the reset is logged');
  ok(p1.msgs.filter((m) => m.t === 'balance').at(-1)?.tuning?.menuLayout === undefined, 'and sent (no layout left in the tuning)');
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
    finish('menu layout');
  });
