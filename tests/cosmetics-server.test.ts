// Cosmetics on the real server, end to end: nothing owned → wearing is refused; the owner gives one on the
// account sheet (/admin) → the player's list updates live, a mail arrives, wearing works and another player
// sees it in the snapshot; the mount (Z) shows as riding; taking it back takes it off; guests get nothing;
// a player can't use the admin route. Runs its own game server on a free port with a throwaway database.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish, ok } from './check';
import { cosById } from '../src/shared/data/cosmetics';
import { ZONE_HUB } from '../src/shared/data/zones';
import { Terrain } from '../src/shared/sim/terrain';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
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

function joinWorld(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  let you = -1;
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'welcome') you = m.you;
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });
  const act = (o: object) => ws.send(JSON.stringify({ t: 'act', ...o }));
  let seq = 0;
  /** Says the character walked to x/z (the server accepts it only within its walking speed). */
  const walkTo = (x: number, z: number) => ws.send(JSON.stringify({
    t: 'input', pos: { x, z }, seq: ++seq, move: null, aim: { x, z }, basic: false, skills: [], dash: false, potion: null,
  }));
  const mailReply = (req: number) => msgs.find((m) => m.t === 'mail' && m.req === req);
  const snaps = () => msgs.filter((m) => m.t === 'snap');
  /** The latest owned list the server sent (it only sends it when it changes). */
  const owned = () => snaps().filter((s) => s.me.cosOwned).at(-1)?.me.cosOwned as string[] | undefined;
  /** How the latest snapshot shows the player with id `id` (yourself by default). */
  const seen = (id = you) => snaps().at(-1)?.players.find((p: any) => p.id === id);
  const lines = () => msgs.filter((m) => m.t === 'chat').map((m) => m.text as string);
  return { ws, ready, act, walkTo, mailReply, owned, seen, lines, you: () => you };
}

async function account(user: string, name: string) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  await api('POST', '/characters', { name, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, charId: chars[0].id };
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
  const owner = await account('cosowner', 'Boss');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'cosowner', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(cli.status === 0, `cosowner is owner (exit ${cli.status} ${cli.stderr})`);
  const a = await account('cosplayer', 'Aria');
  const b = await account('cosother', 'Bodo');
  const g = await api('POST', '/guest', { name: 'Gusto', classId: 'mage' });

  const A = joinWorld(a.tok, a.charId);
  const B = joinWorld(b.tok, b.charId);
  const G = joinWorld(g.data.token, g.data.character.id);
  await Promise.all([A.ready, B.ready, G.ready]);
  await sleep(300);
  ok(JSON.stringify(A.owned()) === '[]', `owns nothing at first (${JSON.stringify(A.owned())})`);

  // ---- nothing owned: refused
  A.act({ a: 'cosWear', slot: 'wings', id: 'wings_angel' });
  A.act({ a: 'cosWear', slot: 'nope', id: 'wings_angel' });
  await sleep(300);
  ok(!A.seen()?.cos, 'not owned: not worn');
  ok(A.lines().some((l) => l.includes('ยังไม่มี')), 'told it is not owned');

  // ---- the admin route
  const accs = await api('GET', '/admin/accounts', undefined, owner.tok);
  const accId = accs.data.rows.find((r: any) => r.username === 'cosplayer').accountId;
  ok((await api('POST', `/admin/accounts/${accId}/cosmetics`, { id: 'wings_angel', give: true }, a.tok)).status === 403, 'a player cannot give');
  ok((await api('POST', `/admin/accounts/${accId}/cosmetics`, { id: 'nope', give: true }, owner.tok)).status === 400, 'unknown cosmetic → 400');
  const give = await api('POST', `/admin/accounts/${accId}/cosmetics`, { id: 'wings_angel', give: true }, owner.tok);
  ok(give.status === 200, `owner gives wings (${give.status} ${give.data.msg})`);
  ok((await api('POST', `/admin/accounts/${accId}/cosmetics`, { id: 'wings_angel', give: true }, owner.tok)).status === 400, 'giving twice → 400');
  await api('POST', `/admin/accounts/${accId}/cosmetics`, { id: 'mount_wolf', give: true }, owner.tok);
  const detail = await api('GET', `/admin/accounts/${accId}`, undefined, owner.tok);
  ok(JSON.stringify(detail.data.cosmetics) === JSON.stringify(['wings_angel', 'mount_wolf']), `account sheet lists them (${JSON.stringify(detail.data.cosmetics)})`);
  const audit = await api('GET', '/admin/audit', undefined, owner.tok);
  ok(JSON.stringify(audit.data).includes('cosmetic-give'), 'written to the audit log');
  await sleep(300);
  ok(JSON.stringify(A.owned()) === JSON.stringify(['wings_angel', 'mount_wolf']), `the player's list updates live (${JSON.stringify(A.owned())})`);
  A.act({ a: 'mailList', req: 7 });
  await sleep(300);
  const titles = (A.mailReply(7)?.list ?? []).map((m: any) => m.title as string);
  ok(titles.filter((t: string) => t.startsWith('ได้รับ Cosmetics')).length === 2, `a mail for each one given (${JSON.stringify(titles)})`);

  // ---- wearing: everyone sees it
  A.act({ a: 'cosWear', slot: 'wings', id: 'wings_angel' });
  A.act({ a: 'cosWear', slot: 'mount', id: 'mount_wolf' });
  A.act({ a: 'cosWear', slot: 'pet', id: 'pet_cat' });
  await sleep(400);
  const codes = [cosById('wings_angel')!.code, cosById('mount_wolf')!.code];
  ok(JSON.stringify(A.seen()?.cos) === JSON.stringify(codes), `worn: wings + mount, no pet (${JSON.stringify(A.seen()?.cos)})`);
  ok(JSON.stringify(B.seen(A.you())?.cos) === JSON.stringify(codes), 'another player sees it');

  // ---- the mount
  A.act({ a: 'mount' });
  await sleep(300);
  ok(A.seen()?.mnt === 1 && B.seen(A.you())?.mnt === 1, 'riding, and others see it');

  // The server's walking check uses the mount's speed: a step it accepts while riding is too long on foot.
  // (Half a second since the last step: on foot up to 3.5 × 0.5 × 1.4 + 0.3 = 2.75, riding 3.49.)
  const terrain = new Terrain(ZONE_HUB);
  const stepFrom = (x: number, z: number) => {
    for (let a = 0; a < 16; a++) {
      const tx = x + Math.cos((a * Math.PI) / 8) * 3.2;
      const tz = z + Math.sin((a * Math.PI) / 8) * 3.2;
      if (!terrain.isBlocked(tx, tz, 0)) return { x: tx, z: tz };
    }
    throw new Error('no open spot to step to');
  };
  {
    const at = A.seen();
    const to = stepFrom(at.x, at.z);
    await sleep(600);
    A.walkTo(to.x, to.z);
    await sleep(300);
    const now = A.seen();
    ok(Math.hypot(now.x - to.x, now.z - to.z) < 0.2, `riding: a 3.2 step in half a second is accepted (${now.x},${now.z} vs ${to.x.toFixed(2)},${to.z.toFixed(2)})`);
  }
  A.act({ a: 'mount' });
  await sleep(300);
  ok(!A.seen()?.mnt, 'Z again: on foot');
  {
    const at = A.seen();
    const to = stepFrom(at.x, at.z);
    await sleep(600);
    A.walkTo(to.x, to.z);
    await sleep(300);
    const now = A.seen();
    ok(Math.hypot(now.x - at.x, now.z - at.z) < 0.2, `on foot: the same step is refused (${now.x},${now.z})`);
  }
  A.act({ a: 'mount' });
  await sleep(200);

  // ---- taken back: off at once
  const take = await api('POST', `/admin/accounts/${accId}/cosmetics`, { id: 'mount_wolf', give: false }, owner.tok);
  ok(take.status === 200, `owner takes the mount back (${take.status})`);
  await sleep(400);
  ok(JSON.stringify(A.seen()?.cos) === JSON.stringify([codes[0]]) && !A.seen()?.mnt, `taken back: off and on foot (${JSON.stringify(A.seen()?.cos)})`);
  ok(JSON.stringify(A.owned()) === JSON.stringify(['wings_angel']), 'list updated');

  // ---- taking off; saved with the character
  A.act({ a: 'cosWear', slot: 'wings', id: null });
  await sleep(300);
  ok(!A.seen()?.cos, 'taken off');
  A.act({ a: 'cosWear', slot: 'wings', id: 'wings_angel' });
  await sleep(300);
  A.ws.close(4000);
  await sleep(500);
  const A2 = joinWorld(a.tok, a.charId);
  await A2.ready;
  await sleep(300);
  ok(JSON.stringify(A2.seen()?.cos) === JSON.stringify([codes[0]]), 'still worn after logging in again');

  // ---- guests
  G.act({ a: 'cosWear', slot: 'wings', id: 'wings_angel' });
  await sleep(300);
  ok(!G.seen()?.cos && G.lines().some((l) => l.includes('Guest')), 'a guest cannot wear any');
  const gAcc = (await api('GET', '/admin/accounts', undefined, owner.tok)).data.rows.find((r: any) => r.guest).accountId;
  ok((await api('POST', `/admin/accounts/${gAcc}/cosmetics`, { id: 'wings_angel', give: true }, owner.tok)).status === 400, 'cannot give to a guest');

  for (const s of [A2, B, G]) s.ws.close(4000);
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
finish('cosmetics-server');
