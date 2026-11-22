// "จัดหน้าจอเกม" (src/shared/hudLayout.ts, /admin tab): what may be saved (parts that keep the menu / moving reachable can't
// be hidden, windows can't be hidden, ranges), the CSS it makes, and the /admin API against a real game server on a free port
// with a throwaway database: a player can't read it, GM can draft and publish, the draft is not live until published, publish
// reaches players online, the balance tab and the menu-layout tab leave the published layout alone, reset = the code.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { checkHudLayoutTuning, codeHudLayout, HUD_PARTS, hudLayoutCss } from '../src/shared/hudLayout';
import { codeMenuLayout } from '../src/shared/menuLayout';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-hudlayout-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;

// ---------------------------------------------------------- checks (no server)
const code = codeHudLayout();
ok(JSON.stringify(mergeBalance({}).hudLayout) === JSON.stringify(code), 'the balance carries the code layout (nothing moved)');
ok(new Set(HUD_PARTS.map((p) => p.id)).size === HUD_PARTS.length, 'part ids are unique');
ok(HUD_PARTS.every((p) => p.box.desktop || p.box.touch), 'every part is on some screen');
const moved = { desktop: { 'minimap-wrap': { x: -10, y: 5, s: 1.2 }, log: { hide: true }, inventory: { x: -20 } }, touch: { 'tc-stick': { s: 1.3 } } };
const t = checkBalance({ hudLayout: moved }, true).tuning!;
ok(JSON.stringify(t.hudLayout) === JSON.stringify(moved), 'a moved / resized / hidden layout is stored as it is');
ok(JSON.stringify(mergeBalance(t).hudLayout) === JSON.stringify(moved), 'and merged back');
ok(JSON.stringify(checkBalance({ hudLayout: { desktop: { log: { x: 0, s: 1 } } } }, true).tuning) === '{}', 'values equal to the code are not stored');
for (const [what, v] of [
  ['hiding the top icon row (เมนู/AUTO)', { desktop: { 'hud-iconrow': { hide: true } } }],
  ['hiding the touch menu button', { touch: { 'tc-menu': { hide: true } } }],
  ['hiding the stick', { touch: { 'tc-stick': { hide: true } } }],
  ['hiding a window', { desktop: { inventory: { hide: true } } }],
  ['a touch-only part on desktop', { desktop: { 'tc-pad': { x: 1 } } }],
  ['a desktop-only part on touch', { touch: { 'hud-iconrow': { x: 1 } } }],
  ['scale too small', { desktop: { log: { s: 0.2 } } }],
  ['scale too big', { desktop: { log: { s: 3 } } }],
  ['moved off the screen', { desktop: { log: { x: 150 } } }],
  ['unknown part', { desktop: { nope: { x: 1 } } }],
  ['unknown device', { tv: {} }],
  ['unknown value', { desktop: { log: { z: 1 } } }],
] as const) ok('error' in checkHudLayoutTuning(v, true), `${what} refused`);
ok(checkBalance({ hudLayout: { desktop: { 'hud-iconrow': { hide: true }, log: { x: 5 } } } }, false).tuning?.hudLayout?.desktop?.['hud-iconrow'] === undefined, 'read back leniently: a bad part is dropped');
ok(/จัดหน้าจอเกม/.test(balanceChanges({}, t)), 'the audit names it');
const css = hudLayoutCss(mergeBalance(t).hudLayout);
ok(css.includes('body:not(.touch-ui) #minimap-wrap { translate: -10vw 5vh; scale: 1.2; transform-origin: top right; }'), 'CSS: move + scale on mouse screens');
ok(css.includes('body:not(.touch-ui) #log { display: none !important; }'), 'CSS: hidden');
ok(css.includes('body.touch-ui #tc-stick { scale: 1.3;'), 'CSS: touch screens on their own');
ok(hudLayoutCss(code) === '', 'CSS: nothing for the code layout');

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
const auditOf = (): { action: string; details: string }[] => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const rows = db.prepare("SELECT action, details FROM admin_audit WHERE action LIKE 'hud-%' ORDER BY id").all() as { action: string; details: string }[];
  db.close();
  return rows;
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

  ok((await api('GET', '/admin/hud-layout', undefined, tok.plain1)).status === 403, 'a player cannot read it');
  ok((await api('POST', '/admin/hud-layout', { draft: moved }, tok.plain1)).status === 403, 'a player cannot save');
  const g0 = await api('GET', '/admin/hud-layout', undefined, tok.gm1);
  ok(g0.status === 200 && g0.data.canEdit === true && g0.data.draft === null && JSON.stringify(g0.data.published) === JSON.stringify(code), 'GM may edit; no draft, code layout published');
  ok((await api('POST', '/admin/hud-layout', { draft: { desktop: { 'hud-iconrow': { hide: true } } } }, tok.gm1)).status === 400, 'hiding the icon row is refused by the server');
  ok((await api('POST', '/admin/hud-layout', { publish: true }, tok.gm1)).status === 400, 'nothing to publish without a draft');

  const p1 = joinWorld(tok.plain1, chars.plain1);
  await p1.ready;
  const d = await api('POST', '/admin/hud-layout', { draft: moved }, tok.gm1);
  ok(d.status === 200 && JSON.stringify(d.data.draft) === JSON.stringify(moved) && d.data.draftBy === 'gm1', 'GM saves a draft');
  ok(JSON.stringify(d.data.published) === JSON.stringify(code), 'a draft is not live');
  await sleep(300);
  ok(!p1.msgs.some((m) => m.t === 'balance'), 'players get nothing for a draft');
  ok(auditOf().length === 1 && auditOf()[0].action === 'hud-draft', 'the draft is in the audit log');

  const pub = await api('POST', '/admin/hud-layout', { publish: true }, tok.gm1);
  ok(pub.status === 200 && pub.data.draft === null && JSON.stringify(pub.data.published) === JSON.stringify(moved), 'publish makes it live and clears the draft');
  await sleep(300);
  const pushed = p1.msgs.filter((m) => m.t === 'balance');
  ok(pushed.length === 1 && JSON.stringify(pushed[0].tuning.hudLayout) === JSON.stringify(moved), 'a player online gets it at once');
  ok(auditOf().at(-1)?.action === 'hud-publish' && /จัดหน้าจอเกม/.test(auditOf().at(-1)!.details), 'publish is in the audit log in Thai');

  // The other saves of the balance tuning must keep it.
  const gmBal = await api('POST', '/admin/balance', { tuning: { hpRegenMult: 1.5, hudLayout: { desktop: { log: { x: 3 } } } } }, tok.gm1);
  ok(gmBal.status === 200 && JSON.stringify(gmBal.data.tuning.hudLayout) === JSON.stringify(moved), 'a balance save does not change the HUD layout');
  ok(JSON.stringify((await api('POST', '/admin/balance', { reset: true }, tok.owner1)).data.tuning.hudLayout) === JSON.stringify(moved), 'the balance reset keeps it');
  const menu = { ...codeMenuLayout(), top: ['auto', 'bag', 'menu'] };
  ok((await api('POST', '/admin/menu-layout', { layout: menu }, tok.owner1)).status === 200, 'menu layout saved');
  ok(JSON.stringify((await api('GET', '/admin/hud-layout', undefined, tok.gm1)).data.published) === JSON.stringify(moved), 'the menu-layout save keeps the HUD layout');

  const p2 = joinWorld(tok.owner1, chars.owner1);
  await p2.ready;
  ok(JSON.stringify(p2.msgs.find((m) => m.t === 'welcome')?.balance?.hudLayout) === JSON.stringify(moved), 'joining sends the layout in welcome');

  await api('POST', '/admin/hud-layout', { draft: { desktop: { log: { x: 4 } } } }, tok.gm1);
  const disc = await api('POST', '/admin/hud-layout', { discard: true }, tok.gm1);
  ok(disc.status === 200 && disc.data.draft === null && JSON.stringify(disc.data.published) === JSON.stringify(moved), 'discard drops the draft only');

  const reset = await api('POST', '/admin/hud-layout', { reset: true }, tok.gm1);
  ok(reset.status === 200 && JSON.stringify(reset.data.published) === JSON.stringify(code), 'reset = the code layout');
  ok(auditOf().at(-1)?.action === 'hud-reset', 'the reset is logged');
  await sleep(200);
  ok(p1.msgs.filter((m) => m.t === 'balance').at(-1)?.tuning?.hudLayout === undefined, 'and sent (no layout left in the tuning)');
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
    finish('hud layout');
  });
