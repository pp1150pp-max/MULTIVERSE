// Parties: the EXP split (both owner examples), loot priority for the whole party, the registry's rules
// (guest, one character per account, full, invite timers, the 60 s grace) with a fake clock, and the
// real server end to end. Runs its own game server on a free port with a throwaway database.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish, ok } from './check';
import { splitExp } from '../src/shared/party';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES } from '../src/shared/data/zones';
import { Loot } from '../src/shared/sim/Loot';
import { Parties, type PartyChar, type PartyEvents } from '../server/party';

const hero = (name: string, level: number) => ({ name, classId: 'sword' as const, level, exp: 0, gold: 0, equipment: {}, bag: [] });

// ---------------------------------------------------------------- EXP split (pure)
{
  let r = splitExp(100, 30, [29, 5]);
  ok(r.keep === 50 && r.shares[0] === 50 && r.shares[1] === 0, `owner example 1: Lv30/29/5 → 50/50/0 (${r.keep}/${r.shares})`);
  r = splitExp(100, 30, [29, 28]);
  ok(r.keep === 50 && r.shares[0] === 25 && r.shares[1] === 25, `owner example 2: Lv30/29/28 → 50/25/25 (${r.keep}/${r.shares})`);
  r = splitExp(100, 30, [5, 10]);
  ok(r.keep === 100 && r.shares.every((s) => s === 0), 'nobody eligible: the earner keeps 100%');
  r = splitExp(100, 10, [40]);
  ok(r.keep === 50 && r.shares[0] === 50, 'higher-level members are eligible');
  r = splitExp(101, 30, [29, 28]);
  ok(r.keep === 51 && r.shares[0] === 25 && r.shares[1] === 25, 'odd amounts: shares rounded down, the rest stays with the earner');
  ok(splitExp(100, 30, [25]).shares[0] === 50 && splitExp(100, 30, [24]).shares[0] === 0, 'exactly 5 levels below shares, 6 does not');
}

// ---------------------------------------------------------------- EXP in the Sim
/** A Sim with a monster that gives `exp` at the given level, and players by level (party 1 unless null). */
function expSim(levels: (number | null)[][]) {
  const sim = new Sim(ZONES.emerald_forest);
  const m = sim.monsters.find((x) => !x.isBoss)!;
  m.level = 30;
  (m as { expReward: number }).expReward = 100;
  const ps = levels.map(([lv, party], i) => {
    const p = sim.addPlayer(hero(`P${i}`, lv!));
    p.partyId = party;
    p.exp = 0;
    return p;
  });
  return { sim, m, ps };
}
const kill = (sim: Sim, m: { damageBy: Map<number, number> }, killerId: number) => {
  m.damageBy.clear();
  m.damageBy.set(killerId, 100);
  (sim as unknown as { shareExp(m: unknown): void }).shareExp(m);
};
{
  const { sim, m, ps } = expSim([[30, 1], [29, 1], [5, 1]]);
  kill(sim, m, ps[0].id);
  ok(ps[0].exp === 50 && ps[1].exp === 50 && ps[2].exp === 0, `Sim example 1: ${ps.map((p) => p.exp)}`);
}
{
  const { sim, m, ps } = expSim([[30, 1], [29, 1], [28, 1]]);
  kill(sim, m, ps[0].id);
  ok(ps[0].exp === 50 && ps[1].exp === 25 && ps[2].exp === 25, `Sim example 2: ${ps.map((p) => p.exp)}`);
}
{
  const { sim, m, ps } = expSim([[30, 1], [29, 1], [29, 2], [29, null]]);
  ps[1].alive = false;
  kill(sim, m, ps[0].id);
  ok(ps[0].exp === 100 && ps[1].exp === 0, `a dead member gets nothing; alone the earner keeps it all (${ps[0].exp}/${ps[1].exp})`);
  ok(ps[2].exp === 0 && ps[3].exp === 0, 'other parties and players outside parties get nothing');
}
{
  // A member on another map is in another Sim, so never shares.
  const { sim, m, ps } = expSim([[30, 1]]);
  const other = new Sim(ZONES.misty_marsh).addPlayer(hero('Far', 30));
  other.partyId = 1;
  kill(sim, m, ps[0].id);
  ok(ps[0].exp === 100 && other.exp === 0, 'a member on another map gets nothing');
}

// ---------------------------------------------------------------- loot priority
{
  const l = new Loot(1, 0, 0, 0, 0, { type: 'gold', amount: 5 }, { owner: 7, ownerParty: 3, ownerUntil: 10 });
  ok(l.canTake({ id: 7, partyId: 3 }, 1), 'the owner may take it');
  ok(l.canTake({ id: 8, partyId: 3 }, 1), 'a party member may take it during the priority time');
  ok(!l.canTake({ id: 9, partyId: 4 }, 1) && !l.canTake({ id: 9, partyId: null }, 1), 'others may not');
  ok(l.canTake({ id: 9, partyId: null }, 10), 'anyone once the priority ends');
  // dropLoot gives the top damage dealer's party the priority.
  const { sim, m, ps } = expSim([[30, 5], [30, 5], [30, null]]);
  m.damageBy.clear();
  m.damageBy.set(ps[0].id, 100);
  (sim as unknown as { dropLoot(m: unknown): void }).dropLoot(m);
  const gold = sim.loots.find((x) => x.kind.type === 'gold')!;
  ok(gold?.owner === ps[0].id && gold.ownerParty === 5, 'drops (gold included) carry the owner and their party');
  ok(gold.canTake(ps[1], sim.time) && !gold.canTake(ps[2], sim.time), 'the party member may pick it up, the outsider may not');
}

// ---------------------------------------------------------------- registry rules (fake clock)
{
  let now = 0;
  const said: { to: number; text: string }[] = [];
  const invites: { to: number; party: number }[] = [];
  const gone: number[] = [];
  const ev: PartyEvents = {
    notice: (ids, text) => ids.forEach((to) => said.push({ to, text })),
    moved: () => undefined,
    invited: (to, party) => invites.push({ to, party }),
    inviteGone: (to) => gone.push(to),
    tell: (to, text) => said.push({ to, text }),
  };
  const P = new Parties(ev, () => now);
  const ch = (charId: number, accountId: number, guest = false): PartyChar => ({ charId, accountId, name: `C${charId}`, cls: 'sword', level: 10, guest });
  const A = ch(1, 100);
  const A2 = ch(2, 100); // same account as A
  const B = ch(3, 200);
  const C = ch(4, 300);
  const D = ch(5, 400);
  const G = ch(6, 500, true);

  ok(P.create(G) !== null, 'a guest cannot create a party');
  ok(P.invite(A, G, false) !== null && !P.of(A.charId), 'a guest cannot be invited (and no party is made for it)');
  ok(P.invite(A, A2, false)?.includes('บัญชีเดียวกัน') === true, 'a second character of the same account is refused');
  ok(P.invite(A, B, true)?.includes('ปิดการรับ') === true, 'blocked invites are refused');
  ok(P.invite(A, B, false) === null && P.of(A.charId)?.members[0].charId === A.charId, 'inviting with no party makes one, led by the inviter');
  const pid = P.of(A.charId)!.id;
  ok(P.invite(A, B, false) !== null, 'the same person cannot be re-invited within 10 s');
  ok(P.answer(B, pid, true) === null && P.of(B.charId)?.id === pid, 'B accepts and joins');
  ok(said.some((s) => s.text === 'C3 เข้าร่วมปาร์ตี้'), 'join notice to the members');
  ok(P.invite(B, C, false)?.includes('หัวหน้า') === true, 'only the leader can invite');
  ok(P.kick(B, A.charId)?.includes('หัวหน้า') === true, 'only the leader can kick');

  // Someone in another party must leave it first.
  P.create(D);
  ok(P.invite(A, D, false)?.includes('ต้องออกจากปาร์ตี้เดิมก่อน') === true, 'inviting someone in a party says they must leave theirs first');
  P.leave(D.charId);

  // Invite expiry: 30 s, then it counts as declined.
  ok(P.invite(A, C, false) === null, 'invite C');
  now = 29_000;
  P.tick();
  ok(!gone.includes(C.charId), 'still open after 29 s');
  now = 30_000;
  P.tick();
  ok(gone.includes(C.charId) && said.some((s) => s.to === A.charId && s.text.includes('หมดเวลา')), 'expires after 30 s and the inviter is told');
  ok(P.answer(C, pid, true) !== null && !P.of(C.charId), 'an expired invite cannot be accepted');
  now = 40_000;
  ok(P.invite(A, C, false) === null && P.answer(C, pid, true) === null, 'after 10 s C can be invited again and joins');
  ok(P.of(A.charId)!.members.length === 3, 'party of 3');
  ok(P.invite(A, D, false)?.includes('เต็ม') === true, 'a 4th is refused: the party is full');

  // Disconnect: 60 s grace.
  P.offline(B.charId, { level: 10, maxHp: 100, maxMp: 50, zone: 'nexus_city' });
  ok(P.member(B.charId)?.online === false, 'a dropped member shows offline');
  now = 99_000;
  P.tick();
  ok(P.online(B.charId) === pid, 'back within 60 s: still in the party');
  P.offline(B.charId, { level: 10, maxHp: 100, maxMp: 50, zone: 'nexus_city' });
  now = 158_000;
  P.tick();
  ok(!!P.of(B.charId), 'still in at 59 s offline');
  now = 159_000;
  P.tick();
  ok(!P.of(B.charId) && P.online(B.charId) === null, 'out after 60 s offline');

  // Leader leaves: the next member leads. Left with one member: disbanded.
  P.leave(A.charId);
  ok(P.of(C.charId) === undefined && !P.of(A.charId), 'party of 2 → leader leaves → only one left, so it is disbanded');
  // Leader change with 3.
  P.invite(C, A, false);
  P.answer(A, P.of(C.charId)!.id, true);
  now = 200_000;
  P.invite(C, B, false);
  P.answer(B, P.of(C.charId)!.id, true);
  P.leave(C.charId);
  ok(P.of(A.charId)?.members[0].charId === A.charId && said.some((s) => s.text === 'C1 เป็นหัวหน้าปาร์ตี้คนใหม่'), 'leader leaves → the next member leads, members told');
  ok(P.kick(A, B.charId) === null && !P.of(B.charId) && !P.of(A.charId), 'kick → one left → disbanded');
  ok(said.some((s) => s.to === B.charId && s.text === 'คุณถูกเตะออกจากปาร์ตี้'), 'the kicked member is told');
}

// ---------------------------------------------------------------- the real server
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
  const act = (o: object) => ws.send(JSON.stringify({ t: 'act', ...o }));
  const party = () => msgs.filter((m) => m.t === 'snap').at(-1)?.party;
  const lines = () => msgs.filter((m) => m.t === 'chat').map((m) => m.text as string);
  return { ws, msgs, ready, act, party, lines };
}

async function account(user: string, ...names: string[]) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  for (const n of names) await api('POST', '/characters', { name: n, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: (n: string) => chars.find((c) => c.name === n)!.id };
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
  const a = await account('partya', 'Aria', 'AriaAlt');
  const b = await account('partyb', 'Bodo');
  const c = await account('partyc', 'Cleo');
  const g = await api('POST', '/guest', { name: 'Gusto', classId: 'mage' });

  const A = joinWorld(a.tok, a.id('Aria'));
  const A2 = joinWorld(a.tok, a.id('AriaAlt'));
  const B = joinWorld(b.tok, b.id('Bodo'));
  const C = joinWorld(c.tok, c.id('Cleo'));
  const G = joinWorld(g.data.token, g.data.character.id);
  await Promise.all([A.ready, A2.ready, B.ready, C.ready, G.ready]);

  // Search: online non-guests matching part of the name, not yourself.
  A.act({ a: 'partySearch', q: 'o', req: 1 });
  await sleep(300);
  const found = A.msgs.find((m) => m.t === 'partyFound' && m.req === 1)?.list.map((f: any) => f.name) ?? [];
  ok(found.includes('Bodo') && found.includes('Cleo') && !found.includes('Gusto') && !found.includes('Aria'), `search finds online non-guests (${found})`);

  // Guests: no party actions, not invitable.
  G.act({ a: 'partyCreate' });
  A.act({ a: 'partyInvite', name: 'Gusto' });
  await sleep(300);
  ok(G.lines().some((t) => t.includes('Guest ใช้ระบบปาร์ตี้ไม่ได้')) && !G.party(), 'a guest cannot create a party');
  ok(!G.msgs.some((m) => m.t === 'partyInvite'), 'a guest is never invited');

  // A invites B, B accepts.
  A.act({ a: 'partyInvite', name: 'Bodo' });
  await sleep(300);
  const inv = B.msgs.find((m) => m.t === 'partyInvite');
  ok(inv?.from === 'Aria' && inv.seconds === 30, 'B gets the invite popup (30 s)');
  B.act({ a: 'partyAnswer', party: inv.party, yes: true });
  await sleep(300);
  ok(A.party()?.members.length === 2 && B.party()?.id === A.party()?.id, 'both see the party of 2');
  ok(A.party()?.members[0].leader && A.party()?.members[0].name === 'Aria', 'Aria leads');

  // One character per account.
  A.act({ a: 'partyInvite', name: 'AriaAlt' });
  await sleep(300);
  ok(A.lines().some((t) => t.includes('บัญชีเดียวกัน')) && !A2.msgs.some((m) => m.t === 'partyInvite'), 'same-account character refused');

  // Party chat reaches members only.
  B.ws.send(JSON.stringify({ t: 'chat', text: 'hi team', ch: 'party' }));
  await sleep(700);
  ok(A.msgs.some((m) => m.t === 'chat' && m.ch === 'party' && m.text === 'hi team'), 'party chat reaches the party');
  ok(!C.msgs.some((m) => m.t === 'chat' && m.text === 'hi team'), 'and nobody else');

  // Connection lost: B stays (offline) and comes back into the party.
  B.ws.close();
  await sleep(400);
  const off = A.party()?.members.find((m: any) => m.name === 'Bodo');
  ok(off && off.online === false, 'a dropped member stays, shown offline');
  const B2 = joinWorld(b.tok, b.id('Bodo'));
  await B2.ready;
  await sleep(300);
  ok(B2.party()?.id === A.party()?.id && A.party()?.members.find((m: any) => m.name === 'Bodo')?.online === true, 'back within 60 s: still in the party');

  // Leaving on purpose (close code 4000) leaves at once: party of 2 → disbanded.
  B2.ws.close(4000, 'quit');
  await sleep(400);
  ok(!A.party(), 'quitting leaves at once; with one left the party is disbanded');

  for (const s of [A, A2, B2, C, G]) s.ws.close(4000);
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
finish('party');
