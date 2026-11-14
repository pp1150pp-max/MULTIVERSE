// Skill MP cost grows with the player's level (owner 2026-11-13): mp in code × (1 + k × (level − 1)), k = the
// class's "% per level" from the /admin "ปรับสมดุล" tab (3% in code), rounded to the nearest whole MP.
// Checks on what may be saved, the real cost when casting on a Sim, and the /admin API against a real game
// server this script starts on a free port with a throwaway database (never the real server or server/data).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { applyBalance, balanceChanges, checkBalance, mergeBalance, skillMpCost } from '../src/shared/balance';
import { CLASSES, CLASS_IDS, MP_COST_PER_LEVEL } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { IDLE_INTENT } from '../src/shared/sim/types';
import { finish, ok } from './check';
import { oldSkills } from './skills';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-mp-cost-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;

// ---------------------------------------------------------- the formula and the checks on what may be saved
{
  ok(MP_COST_PER_LEVEL === 3 && CLASS_IDS.every((id) => mergeBalance({}).classes[id].mpCostPerLevel === 3), '3% per level for every class in code');
  const fireball = CLASSES.mage.skills.find((s) => s.id === 'fireball')!;
  ok(fireball.mp === 10, 'fireball costs 10 in code');
  const at = (lv: number) => skillMpCost(fireball.mp, 'mage', lv);
  ok(at(1) === 10 && at(20) === 16 && at(40) === 22 && at(50) === 25, `fireball Lv1 10 → Lv20 16 → Lv40 22 → Lv50 25 (${at(1)}/${at(20)}/${at(40)}/${at(50)})`);
  ok(skillMpCost(0, 'mage', 50) === 0, 'free skills (basic attack, dash) stay free');

  const t = checkBalance({ classes: { mage: { mpCostPerLevel: 4 }, sword: { mpCostPerLevel: 3 } } }, true).tuning;
  ok(JSON.stringify(t) === '{"classes":{"mage":{"mpCostPerLevel":4}}}', 'only the value that differs from the code is stored');
  ok(skillMpCost(10, 'mage', 40, mergeBalance(t!)) === 26, 'mage at 4%: fireball Lv40 = 10 × 2.56 → 26');
  ok(JSON.stringify(checkBalance({ classes: { gunslinger: { mpCostPerLevel: 0 } } }, true).tuning) === '{"classes":{"gunslinger":{"mpCostPerLevel":0}}}', '0% (cost as in code at every level) may be saved');
  for (const [what, v] of [['21%', 21], ['-1%', -1], ['text', '3'], ['not a number', null]] as const) {
    ok(checkBalance({ classes: { mage: { mpCostPerLevel: v } } }, true).error !== undefined, `refused: ${what}`);
  }
  // Read back from the database (and in browsers): a good value is kept, a bad one dropped.
  ok(JSON.stringify(checkBalance({ classes: { mage: { mpCostPerLevel: 5 }, sword: { mpCostPerLevel: 50 } } }, false).tuning) === '{"classes":{"mage":{"mpCostPerLevel":5}}}', 'not strict: good value kept, bad one dropped');
  ok(balanceChanges({}, t!) === 'MP สกิล/เลเวล นักเวท 3% → 4%', `audit text (${balanceChanges({}, t!)})`);
}

// ---------------------------------------------------------- casting on a real Sim (no server)
{
  const sim = new Sim(ZONE_1);
  for (let i = 0; i < 300 && !sim.monsters.some((m) => m.alive && !m.isBoss); i++) sim.step(0.1);
  const mob = sim.monsters.find((m) => m.alive && !m.isBoss)!;
  const p = sim.addPlayer({ name: 'M', classId: 'mage', level: 40, exp: 0, gold: 0, equipment: {}, bag: [], skills: oldSkills('mage') });
  /** MP spent casting fireball once at the monster, starting from `mp` (a very short step, so regen hardly counts). */
  const cast = (mp: number): number => {
    p.x = mob.x + 2;
    p.z = mob.z;
    p.mp = mp;
    p.cd = {};
    sim.step(0.01, (x) => (x === p ? { ...IDLE_INTENT, aim: { x: mob.x, z: mob.z }, skills: ['q'] } : IDLE_INTENT));
    return mp - p.mp;
  };
  ok(!sim.inSafe(p), 'the test player stands outside any safe zone');
  ok(p.skillMp(p.skill('q')!) === 22, 'Player.skillMp: Lv40 fireball 22');
  const spent = cast(300);
  ok(Math.abs(spent - 22) < 0.5 && (p.cd.fireball ?? 0) > 0, `Lv40 mage casts fireball for 22 MP (${spent.toFixed(2)})`);
  const short = cast(21);
  ok(short <= 0 && (p.cd.fireball ?? 0) <= 0, `21 MP is not enough at Lv40: no cast (${short.toFixed(2)})`);
  applyBalance({ classes: { mage: { mpCostPerLevel: 0 } } });
  ok(Math.abs(cast(300) - 10) < 0.5, '0% per level: back to the code cost (10) at once');
  applyBalance({});
  p.level = 1;
  ok(p.skillMp(p.skill('q')!) === 10, 'Lv1: the code cost');
}

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
const audits = (): string[] => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  try {
    return (db.prepare("SELECT details FROM admin_audit WHERE action = 'balance' ORDER BY id").all() as { details: string }[]).map((r) => r.details);
  } finally {
    db.close();
  }
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
  const tok: Record<string, string> = {};
  const chars: Record<string, number> = {};
  for (const u of ['owner1', 'plain1']) {
    tok[u] = (await api('POST', '/register', { username: u, password: 'secret123' })).data.token;
    chars[u] = (await api('POST', '/characters', { name: `C_${u}`, classId: 'mage' }, tok[u])).data.id;
  }
  spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE } });

  // A player in the game, to see the 'balance' message browsers get.
  const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token: tok.plain1, characterId: chars.plain1 }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });

  for (const [what, v] of [['21%', 21], ['-1%', -1], ['text', '4']] as const) {
    ok((await api('POST', '/admin/balance', { tuning: { classes: { mage: { mpCostPerLevel: v } } } }, tok.owner1)).status === 400, `server refuses ${what}`);
  }
  ok((await api('POST', '/admin/balance', { tuning: { classes: { mage: { mpCostPerLevel: 4 } } } }, tok.plain1)).status !== 200, 'a plain player cannot save');
  ok(audits().length === 0, 'refused saves leave no audit row');

  const saved = await api('POST', '/admin/balance', { tuning: { classes: { mage: { mpCostPerLevel: 4 } } } }, tok.owner1);
  await sleep(400);
  ok(saved.status === 200 && saved.data.tuning.classes?.mage?.mpCostPerLevel === 4, 'owner saves mage 4% per level');
  ok((await api('GET', '/admin/balance', undefined, tok.owner1)).data.tuning.classes?.mage?.mpCostPerLevel === 4, 'read back from the server');
  const msg = msgs.filter((m) => m.t === 'balance').at(-1);
  ok(msg?.tuning.classes?.mage?.mpCostPerLevel === 4, 'browsers get the new value at once');
  ok(checkBalance(msg?.tuning, false).tuning?.classes?.mage?.mpCostPerLevel === 4, 'the browser keeps it after its own check');
  ok(audits().at(-1)?.includes('MP สกิล/เลเวล นักเวท 3% → 4%') === true, `audit: ${audits().at(-1)}`);

  const reset = await api('POST', '/admin/balance', { reset: true }, tok.owner1);
  await sleep(400);
  ok(reset.status === 200 && reset.data.tuning.classes === undefined, 'reset goes back to the code (3%)');
  ok(msgs.filter((m) => m.t === 'balance').at(-1)?.tuning.classes === undefined, 'browsers told about the reset');
  ok(audits().length === 2 && audits()[1].includes('MP สกิล/เลเวล นักเวท 4% → 3%'), `the reset is in the audit log (${audits()[1]})`);
  ws.close();
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
    finish('mp-cost');
  });
