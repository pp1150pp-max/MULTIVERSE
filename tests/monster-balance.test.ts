// Ordinary monsters' multipliers in the /admin "ปรับสมดุล" tab (src/shared/balance.ts, owner 2026-11-12): by level
// band and per kind, multiplied together; never bosses or the minions a boss calls; checks on what may be saved;
// new and existing monsters (HP keeps its share); and the /admin API against a real game server this script starts
// on a free port with a throwaway database (never the real server or server/data).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { applyBalance, balanceChanges, checkBalance, monsterMults, NO_MONSTER_MULT, TUNABLE_MONSTERS } from '../src/shared/balance';
import { MONSTERS } from '../src/shared/data/monsters';
import { NO_BOOST, ZONE_1, type SpawnArea } from '../src/shared/data/zones';
import { Monster } from '../src/shared/sim/Monster';
import { Sim } from '../src/shared/sim/Sim';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-monster-balance-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const AREA: SpawnArea = { monster: 'wild_boar', x: 0, z: 0, radius: 1, count: 1, respawn: [5, 5] } as SpawnArea;
const mk = (id: string, lv?: number) => new Monster(1, MONSTERS[id], lv ?? MONSTERS[id].levels[0], AREA, 0, 0, NO_BOOST);

// ---------------------------------------------------------- which kinds, and the checks on what may be saved
{
  const ids = TUNABLE_MONSTERS.map((d) => d.id);
  ok(!ids.some((id) => MONSTERS[id].behavior === 'boss'), 'no boss in the tunable list');
  ok(ids.includes('yeti_minion'), 'the summon-only yeti minion is in the list');
  ok(ids.includes('forest_wolf') && ids.includes('polar_bear'), 'field wolves and the polar bear are');
  ok(ids.every((id, i) => i === 0 || MONSTERS[ids[i - 1]].levels[0] <= MONSTERS[id].levels[0]), 'listed by level');

  const t = checkBalance({ monsters: { bands: { '1-10': { hp: 2, atk: 1 } }, types: { wild_boar: { speed: 0.5, exp: 1 } } } }, true).tuning;
  ok(JSON.stringify(t) === '{"monsters":{"bands":{"1-10":{"hp":2}},"types":{"wild_boar":{"speed":0.5}}}}', '×1 entries are not stored');
  ok(JSON.stringify(checkBalance({ monsters: { bands: { '1-10': { hp: 1 } } } }, true).tuning) === '{}', 'all ×1 stores nothing');
  for (const [what, v] of [
    ['over ×10', { bands: { '1-10': { hp: 11 } } }],
    ['under ×0.1', { types: { wild_boar: { atk: 0.05 } } }],
    ['zero', { types: { wild_boar: { gold: 0 } } }],
    ['unknown stat', { types: { wild_boar: { luck: 2 } } }],
    ['unknown band', { bands: { '51-60': { hp: 2 } } }],
    ['unknown monster', { types: { dragon: { hp: 2 } } }],
    ['a boss', { types: { yeti: { hp: 2 } } }],
    ['unknown part', { kinds: {} }],
    ['text', { types: { wild_boar: { hp: '2' } } }],
    ['not an object', 'x'],
  ] as const) {
    ok(checkBalance({ monsters: v }, true).error !== undefined, `refused: ${what}`);
  }
  // Read back from the database: bad entries dropped, the rest kept.
  const loose = checkBalance({ monsters: { bands: { '1-10': { hp: 50, atk: 2 } }, types: { yeti: { hp: 2 }, wild_boar: { def: 3 } } } }, false).tuning;
  ok(JSON.stringify(loose) === '{"monsters":{"bands":{"1-10":{"atk":2}},"types":{"wild_boar":{"def":3}}}}', 'from the database: bad entries dropped, the rest kept');
  ok(balanceChanges({}, t!).includes('มอน Lv1–10 HP ×1 → ×2') && balanceChanges({}, t!).includes('หมูป่า วิ่งเร็ว ×1 → ×0.5'), 'audit text names band, kind, stat and ×before → ×after');
}

// ---------------------------------------------------------- what the multipliers do (no server)
{
  const boar0 = mk('wild_boar', 6);
  const witch0 = mk('bog_witch');
  const ghoul0 = mk('mire_ghoul');
  applyBalance({ monsters: { bands: { '1-10': { hp: 2, atk: 3, exp: 1.5, gold: 2 }, '11-20': { hp: 4 } }, types: { wild_boar: { hp: 1.5, range: 2, atkSpeed: 2 } } } });
  const m = monsterMults(MONSTERS.wild_boar);
  ok(m.hp === 3 && m.atk === 3 && m.range === 2 && m.atkSpeed === 2 && m.def === 1, 'band × kind multiply together (HP 2 × 1.5 = 3)');
  ok(monsterMults(MONSTERS.green_slime).hp === 2 && monsterMults(MONSTERS.green_slime).range === 1, 'other kinds of the band get the band only');
  ok(monsterMults(MONSTERS.forest_bear) === NO_MONSTER_MULT && monsterMults(MONSTERS.bog_witch) === NO_MONSTER_MULT, 'bosses ×1');

  // A new monster.
  const boar = mk('wild_boar', 6);
  ok(Math.abs(boar.maxHp - boar0.maxHp * 3) <= 2 && boar.hp === boar.maxHp, `new boar: HP ×3 and full (${boar0.maxHp} → ${boar.maxHp})`);
  ok(near(boar.atk, boar0.atk * 3) && near(boar.defense, boar0.defense) && Math.abs(boar.expReward - boar0.expReward * 1.5) <= 1, 'new boar: ATK ×3, DEF as in code, EXP ×1.5');
  ok(boar.mult.gold === 2 && boar.mult.range === 2 && boar.mult.atkSpeed === 2, 'gold, range and attack speed multipliers carried by the monster');
  const witch = mk('bog_witch');
  ok(witch.maxHp === witch0.maxHp && witch.atk === witch0.atk, 'a boss keeps the code numbers');

  // A minion called by a boss gets its kind's multipliers, like the field monster, and stays at full HP.
  const wolf = mk('forest_wolf');
  ok(wolf.maxHp > 0 && wolf.mult.hp === 2, 'a field wolf gets its band');
  const minion = mk('forest_wolf');
  minion.markSummoned();
  ok(minion.mult.hp === 2 && minion.hp === minion.maxHp && minion.maxHp === wolf.maxHp, 'a wolf the bear calls gets the same multipliers as the field wolf, full HP');
  const yeti = mk('yeti_minion');
  const yetiBase = yeti.maxHp;
  yeti.markSummoned();
  ok(yeti.mult.hp === 1 && yeti.maxHp === yetiBase, 'yeti minion at ×1 while its band and kind are untuned');
  applyBalance({ monsters: { bands: { '21-30': { atk: 2 } }, types: { yeti_minion: { hp: 3 } } } });
  yeti.retune();
  ok(yeti.mult.atk === 2 && yeti.mult.hp === 3 && yeti.maxHp === yetiBase * 3, 'yeti minion: band Lv21–30 × its own kind, existing minion retuned');
  applyBalance({ monsters: { bands: { '1-10': { hp: 2, atk: 3, exp: 1.5, gold: 2 }, '11-20': { hp: 4 } }, types: { wild_boar: { hp: 1.5, range: 2, atkSpeed: 2 } } } });

  // An existing monster when the multipliers change: HP keeps its share.
  ghoul0.hp = ghoul0.maxHp / 4;
  const ghoulMax0 = ghoul0.maxHp;
  ghoul0.retune();
  ok(ghoul0.maxHp === ghoulMax0 * 4 && near(ghoul0.hp, ghoul0.maxHp / 4), `existing ghoul: max HP ×4, still a quarter left (${ghoul0.hp}/${ghoul0.maxHp})`);
  applyBalance({});
  ghoul0.retune();
  ok(ghoul0.maxHp === ghoulMax0 && near(ghoul0.hp, ghoulMax0 / 4), 'back to the code: the same share again');

  // In a whole Sim: every monster out, and the gold of a kill.
  const sim = new Sim(ZONE_1);
  const counts = sim.monsters.map((x) => x.maxHp);
  applyBalance({ monsters: { bands: { '1-10': { hp: 2 } } } });
  for (const x of sim.monsters) x.retune();
  ok(sim.monsters.length > 0 && sim.monsters.every((x, i) => x.isBoss || Math.abs(x.maxHp - counts[i] * 2) <= 1), 'every monster out on the map took the band multiplier');
  applyBalance({});
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
const dbRead = <T>(f: (db: DatabaseSync) => T): T => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  try {
    return f(db);
  } finally {
    db.close();
  }
};
const audits = (): string[] => dbRead((db) => (db.prepare("SELECT details FROM admin_audit WHERE action = 'balance' ORDER BY id").all() as { details: string }[]).map((r) => r.details));

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
    chars[u] = (await api('POST', '/characters', { name: `C_${u}`, classId: 'sword' }, tok[u])).data.id;
  }
  spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE } });

  // A player in the forest, to see the monsters' HP in the snapshots.
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
  const warp = await api('POST', `/admin/characters/${chars.plain1}/teleport`, { zone: 'emerald_forest' }, tok.owner1);
  await sleep(600);
  ok(warp.status === 200, `player warped into the forest (${warp.status})`);
  const snapMons = (): Map<number, { def: string; hp: number; mhp: number }> =>
    new Map((msgs.filter((m) => m.t === 'snap').at(-1)?.monsters ?? []).filter((m: any) => m.alive).map((m: any) => [m.id, m]));
  const before = snapMons();
  ok(before.size > 0, `monsters near the player (${before.size})`);

  // Bad values: 400 and nothing changes.
  for (const [what, monsters] of [
    ['×20', { bands: { '1-10': { hp: 20 } } }],
    ['a boss', { types: { forest_bear: { hp: 2 } } }],
    ['unknown stat', { types: { wild_boar: { luck: 2 } } }],
  ] as const) {
    ok((await api('POST', '/admin/balance', { tuning: { monsters } }, tok.owner1)).status === 400, `server refuses ${what}`);
  }
  ok(audits().length === 0, 'refused saves leave no audit row');

  const saved = await api('POST', '/admin/balance', { tuning: { monsters: { bands: { '1-10': { hp: 2 } } } } }, tok.owner1);
  await sleep(600);
  ok(saved.status === 200 && saved.data.tuning.monsters?.bands?.['1-10']?.hp === 2, 'owner saves Lv1–10 HP ×2');
  ok(msgs.some((m) => m.t === 'balance' && m.tuning.monsters?.bands?.['1-10']?.hp === 2), 'browsers get the new multipliers');
  const after = snapMons();
  const same = [...before].filter(([id]) => after.has(id));
  ok(same.length > 0 && same.every(([id, m]) => {
    const n = after.get(id)!;
    return n.mhp === m.mhp * 2 && Math.abs(n.hp / n.mhp - m.hp / m.mhp) < 0.01;
  }), `monsters already out: max HP ×2 at once, same share of HP (${same.length} checked)`);
  ok(audits().at(-1)?.includes('มอน Lv1–10 HP ×1 → ×2') === true, 'the save is in the audit log as ×before → ×after');

  const reset = await api('POST', '/admin/balance', { reset: true }, tok.owner1);
  await sleep(600);
  const back = snapMons();
  const again = same.filter(([id]) => back.has(id));
  ok(reset.status === 200 && reset.data.tuning.monsters === undefined, 'reset removes the monster multipliers');
  ok(again.every(([id, m]) => back.get(id)!.mhp === m.mhp), 'monsters back to the code HP');
  ok(audits().length === 2, 'the reset is in the audit log');
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
    finish('monster-balance');
  });
