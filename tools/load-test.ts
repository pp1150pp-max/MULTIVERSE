// Load test: how many players the game server takes before it lags.
//
//   node --import tsx tools/load-test.ts --scenario spread --steps 10,25,50,100 --hold 60 --auto 0.5
//
// Starts its own game server on a free port with a throwaway database (never the real server, never
// server/data), then fills it with bots that connect over WebSocket the way a browser does (guest
// login, permessage-deflate, input 30×/s, a ping every 2 s) and play: walk, fight monsters with
// basic attacks and skills, some with Auto Play on (which runs on the server). Bots live in separate
// worker processes (--workers) so their own work does not slow the server.
//
// Scenarios (where the bots are):
//   hub     everyone in the town (nexus_city) walking around: no channels, everyone sees everyone
//   one     everyone in the first farm map (the server opens a CH per 20 players by itself)
//   spread  round robin over the four farm maps (+ --hub share of them stay in town)
// --auto 0..1  share of the farm bots with Auto Play on (the rest fight by hand)
// --prof       runs the server with --cpu-prof (a .cpuprofile lands in --out's folder)
// --out file   writes the results as JSON as well
//
// Each step adds bots up to the next count, waits for them to settle, then keeps the server's
// `[perf-json]` lines (server/perf.ts, one per PERF_LOG_MS) for --hold seconds.
// Not part of npm run test (it takes minutes and is meant to be pushed until it breaks).
import { fork, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createInterface } from 'node:readline';
import WebSocket from 'ws';
import type { PerfReport } from '../server/perf';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FARMS = ['emerald_forest', 'misty_marsh', 'frost_reach', 'ashen_isle'];
const FARM_LEVEL: Record<string, number> = { emerald_forest: 10, misty_marsh: 20, frost_reach: 30, ashen_isle: 40 };
const CLASSES = ['sword', 'mage', 'gunslinger'] as const;
const RANGE: Record<string, number> = { sword: 1.8, mage: 8, gunslinger: 8.5 };

/** One bot as the orchestrator hands it to a worker. */
interface BotSpec { n: number; token: string; charId: number; cls: string; zone: string; auto: boolean }
/** Worker → orchestrator. */
type FromWorker =
  | { t: 'joined'; n: number }
  | { t: 'rewarp'; n: number }
  | { t: 'stats'; s: WorkerStats };
interface WorkerStats { bots: number; rtts: number[]; snaps: number; bytes: number; maxGap: number; gaps250: number; busy: number; secs: number }

// ====================================================================== worker (bots)

if (process.argv.includes('--worker')) {
  const base = process.env.LT_BASE!;
  const bots: Bot[] = [];
  let elu = performance.eventLoopUtilization();
  let from = performance.now();
  const say = (m: FromWorker) => process.send!(m);

  class Bot {
    ws: WebSocket;
    you = -1;
    zone = '';
    x = 0;
    z = 0;
    alive = true;
    deadAt = 0;
    seq = 0;
    inZoneAt = 0;
    autoSent = false;
    lastSnapAt = 0;
    wander = { x: 0, z: 0, until: 0 };
    pingId = 0;
    pingOut: { id: number; at: number } | null = null;
    freshRtt: number | null = null;
    lastPingAt = 0;
    rewarpAt = performance.now(); // the orchestrator warps it right after joining
    snaps = 0;
    rtts: number[] = [];
    maxGap = 0;
    gaps250 = 0;
    bytesAt = 0;
    target: { x: number; z: number } | null = null;
    constructor(readonly spec: BotSpec) {
      this.ws = new WebSocket(`${base.replace('http', 'ws')}/ws`, { perMessageDeflate: true });
      this.ws.on('open', () => this.send({ t: 'join', token: spec.token, characterId: spec.charId }));
      this.ws.on('message', (raw) => this.onMsg(JSON.parse(raw.toString())));
      this.ws.on('error', () => {});
    }
    send(m: unknown) {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    }
    onMsg(m: any) {
      const now = performance.now();
      if (m.t === 'welcome') {
        this.you = m.you;
        this.zone = m.zone;
      } else if (m.t === 'zone') {
        this.you = m.you;
        this.zone = m.zone;
        this.x = m.x;
        this.z = m.z;
        this.autoSent = false;
        this.inZoneAt = now;
      } else if (m.t === 'pong') {
        if (this.pingOut && this.pingOut.id === m.id) {
          const rtt = now - this.pingOut.at;
          this.rtts.push(rtt);
          this.freshRtt = rtt;
          this.pingOut = null;
        }
      } else if (m.t === 'snap') {
        if (this.lastSnapAt) {
          const gap = now - this.lastSnapAt;
          this.maxGap = Math.max(this.maxGap, gap);
          if (gap > 250) this.gaps250++;
        } else say({ t: 'joined', n: this.spec.n });
        this.lastSnapAt = now;
        this.snaps++;
        const me = m.players.find((p: any) => p.id === this.you);
        if (me) {
          this.x = me.x;
          this.z = me.z;
          if (this.alive && !me.alive) this.deadAt = now;
          this.alive = me.alive;
        }
        let best: any = null;
        let bd = Infinity;
        for (const mo of m.monsters) {
          if (!mo.alive) continue;
          const d = Math.hypot(mo.x - this.x, mo.z - this.z);
          if (d < bd) (bd = d), (best = mo);
        }
        this.target = best && bd < 30 ? { x: best.x, z: best.z } : null;
      }
    }
    /** 30×/s, like the browser's input loop. */
    step(now: number) {
      if (this.you < 0 || this.ws.readyState !== WebSocket.OPEN) return;
      // Ping every 2 s, one in flight (online.ts sendPing).
      if (!this.pingOut && now - this.lastPingAt >= 2000) {
        this.lastPingAt = now;
        const id = ++this.pingId;
        this.pingOut = { id, at: now };
        this.send({ t: 'ping', id, rtt: this.freshRtt ?? undefined, fps: 60, maxFrame: 20 });
        this.freshRtt = null;
      } else if (this.pingOut && now - this.pingOut.at > 10_000) this.pingOut = null;
      if (!this.alive) {
        if (now - this.deadAt > 3000) {
          this.send({ t: 'act', a: 'respawn' });
          this.deadAt = now;
        }
        return;
      }
      const want = this.spec.zone;
      if (this.zone !== want && now - this.rewarpAt > 5000) {
        this.rewarpAt = now;
        say({ t: 'rewarp', n: this.spec.n });
      }
      let move: { x: number; z: number } | null = null;
      let aim = { x: this.x + 1, z: this.z };
      let basic = false;
      const skills: string[] = [];
      if (this.zone === 'nexus_city') {
        // Stroll around the town square.
        if (now > this.wander.until) {
          const tx = (Math.random() - 0.5) * 30;
          const tz = (Math.random() - 0.5) * 30;
          this.wander = { x: tx, z: tz, until: now + 3000 + Math.random() * 5000 };
        }
        const dx = this.wander.x - this.x;
        const dz = this.wander.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d > 1) move = { x: dx / d, z: dz / d };
      } else if (now - this.inZoneAt < 4000) {
        // Out of the camp (the safe spot by the portal) towards the middle of the map.
        const d = Math.hypot(this.x, this.z) || 1;
        move = { x: -this.x / d, z: -this.z / d };
      } else if (this.spec.auto) {
        if (!this.autoSent) {
          this.autoSent = true;
          this.send({ t: 'act', a: 'auto', on: true });
        }
      } else if (this.target) {
        const dx = this.target.x - this.x;
        const dz = this.target.z - this.z;
        const d = Math.hypot(dx, dz) || 1;
        aim = { x: this.target.x, z: this.target.z };
        if (d > RANGE[this.spec.cls]) move = { x: dx / d, z: dz / d };
        else {
          basic = true;
          const r = Math.random();
          if (r < 0.03) skills.push('q');
          else if (r < 0.05) skills.push('e');
          else if (r < 0.06) skills.push('r');
        }
      } else {
        const d = Math.hypot(this.x, this.z) || 1;
        move = { x: -this.x / d, z: -this.z / d };
      }
      this.send({
        t: 'input', seq: ++this.seq, move, aim, basic, skills,
        dash: false, potion: Math.random() < 0.003 ? 'hp' : null,
      });
    }
  }

  setInterval(() => {
    const now = performance.now();
    for (const b of bots) b.step(now);
  }, 1000 / 30);

  process.on('message', (m: any) => {
    if (m.t === 'add') bots.push(new Bot(m.spec));
    else if (m.t === 'stats') {
      const now = performance.now();
      const s: WorkerStats = { bots: bots.length, rtts: [], snaps: 0, bytes: 0, maxGap: 0, gaps250: 0, busy: performance.eventLoopUtilization(elu).utilization, secs: (now - from) / 1000 };
      for (const b of bots) {
        s.rtts.push(...b.rtts);
        s.snaps += b.snaps;
        const read = (b.ws as unknown as { _socket?: { bytesRead?: number } })._socket?.bytesRead ?? b.bytesAt;
        s.bytes += read - b.bytesAt;
        b.bytesAt = read;
        s.maxGap = Math.max(s.maxGap, b.maxGap);
        s.gaps250 += b.gaps250;
        b.rtts = [];
        b.snaps = 0;
        b.maxGap = 0;
        b.gaps250 = 0;
      }
      elu = performance.eventLoopUtilization();
      from = now;
      say({ t: 'stats', s });
    } else if (m.t === 'quit') {
      for (const b of bots) b.ws.close(4000);
      setTimeout(() => process.exit(0), 300);
    }
  });
}

// ====================================================================== orchestrator

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

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

const pct = (a: number[], p: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

async function main(): Promise<void> {
  const scenario = arg('scenario', 'spread');
  const steps = arg('steps', '10,25,50').split(',').map(Number);
  const hold = Number(arg('hold', '60'));
  const autoShare = Number(arg('auto', '0'));
  const hubShare = Number(arg('hub', '0'));
  const nWorkers = Number(arg('workers', '4'));
  const perfMs = Number(arg('perf-ms', '5000'));
  const out = arg('out', '');
  const prof = process.argv.includes('--prof');

  const dir = mkdtempSync(join(tmpdir(), 'multiverse-load-'));
  const DB_FILE = join(dir, 'load.db');
  const PORT = await freePort();
  const BASE = `http://localhost:${PORT}`;
  const profDir = out ? join(dirname(resolve(out)), 'cpuprofile') : join(dir, 'prof');
  if (prof) mkdirSync(profDir, { recursive: true });
  const server: ChildProcess = spawn(process.execPath, [...(prof ? ['--cpu-prof', `--cpu-prof-dir=${profDir}`] : []), '--import', 'tsx', 'server/main.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_FILE, PERF_LOG_MS: String(perfMs), PERF_JSON: '1', SHUTDOWN_SECONDS: '1' },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const perfLines: PerfReport[] = [];
  createInterface({ input: server.stdout! }).on('line', (line) => {
    if (line.startsWith('[perf-json] ')) perfLines.push(JSON.parse(line.slice(12)));
    else if (line.includes('(no compression)')) console.log('  ! a bot joined without compression');
  });

  const api = async (method: string, path: string, body?: unknown, token?: string, ip?: string) => {
    const r = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(ip ? { 'X-Forwarded-For': ip } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
  };
  for (let i = 0; ; i++) {
    try {
      await fetch(`${BASE}/api/me`);
      break;
    } catch {
      if (i > 200) throw new Error('server did not start');
      await sleep(100);
    }
  }
  // An owner account for the GM tools (level, warp) — in the throwaway database only.
  const reg = await api('POST', '/register', { username: 'loadowner', password: 'secret123' });
  const ownerTok: string = reg.data.token;
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'loadowner', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  if (cli.status !== 0) throw new Error(`admin-role failed: ${cli.stderr}`);

  const workers: ChildProcess[] = [];
  const statsWaiters: ((s: WorkerStats) => void)[][] = [];
  const specs: BotSpec[] = [];
  let joined = 0;
  let warpFails = 0;
  const warp = async (b: BotSpec) => {
    if (b.zone === 'nexus_city') return;
    const r = await api('POST', `/admin/characters/${b.charId}/teleport`, { zone: b.zone }, ownerTok);
    if (r.status !== 200 && warpFails++ < 5) console.log(`  ! warp Bot${b.n} → ${b.zone}: ${r.status} ${JSON.stringify(r.data)}`);
  };
  for (let w = 0; w < nWorkers; w++) {
    const child = fork(fileURLToPath(import.meta.url), ['--worker'], { execArgv: ['--import', 'tsx'], env: { ...process.env, LT_BASE: BASE }, cwd: ROOT });
    statsWaiters.push([]);
    child.on('message', (m: FromWorker) => {
      if (m.t === 'joined') {
        joined++;
        void warp(specs[m.n]);
      } else if (m.t === 'rewarp') void warp(specs[m.n]);
      else if (m.t === 'stats') statsWaiters[w].shift()?.(m.s);
    });
    workers.push(child);
  }
  const workerStats = () => Promise.all(workers.map((c, w) => new Promise<WorkerStats>((res) => {
    statsWaiters[w].push(res);
    c.send({ t: 'stats' });
  })));

  const zoneFor = (n: number): string => {
    if (scenario === 'hub') return 'nexus_city';
    if (scenario === 'one') return FARMS[0];
    // Spread evenly: --hub 0.2 = every fifth bot stays in town, the rest go round the four farm maps.
    const hubBefore = Math.floor(n * hubShare);
    if (Math.floor((n + 1) * hubShare) > hubBefore) return 'nexus_city';
    return FARMS[(n - hubBefore) % FARMS.length];
  };

  const results: any[] = [];
  console.log(`scenario ${scenario}, auto ${autoShare * 100}%${hubShare ? `, hub ${hubShare * 100}%` : ''}, hold ${hold} s, ${nWorkers} bot workers, server port ${PORT}`);
  // A step with 0 bots first: the idle server (Windows timers jitter on their own).
  for (const target of [0, ...steps]) {
    const t0 = performance.now();
    while (specs.length < target) {
      const n = specs.length;
      const cls = CLASSES[n % CLASSES.length];
      const zone = zoneFor(n);
      const ip = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
      const g = await api('POST', '/guest', { name: `Bot${n}`, classId: cls }, undefined, ip);
      if (g.status !== 201) throw new Error(`guest ${n}: ${g.status} ${JSON.stringify(g.data)}`);
      const charId = g.data.character.id;
      if (zone !== 'nexus_city') await api('POST', `/admin/characters/${charId}/level`, { level: FARM_LEVEL[zone] }, ownerTok);
      // Auto share counted per farm bot, spread evenly (0.5 = every other one).
      const farmIdx = specs.filter((s) => s.zone !== 'nexus_city').length;
      const auto = zone !== 'nexus_city' && Math.floor((farmIdx + 1) * autoShare) > Math.floor(farmIdx * autoShare);
      const spec: BotSpec = { n, token: g.data.token, charId, cls, zone, auto };
      specs.push(spec);
      workers[n % nWorkers].send({ t: 'add', spec });
      await sleep(150); // ~6 joins a second
    }
    while (joined < target && performance.now() - t0 < 120_000) await sleep(200);
    // Settle: walk out of the camps, Auto on, the first autosave.
    await sleep(target ? 10_000 : 2000);
    perfLines.length = 0;
    await workerStats();
    await sleep(hold * 1000);
    const ws = await workerStats();
    const perf = perfLines.slice();
    const rtts = ws.flatMap((s) => s.rtts);
    const secs = avg(ws.map((s) => s.secs));
    const row = {
      bots: target,
      online: perf.at(-1)?.online ?? 0,
      sims: perf.at(-1)?.sims ?? 0,
      tickAvg: r1(avg(perf.map((p) => p.tickAvg))),
      tickP99: r1(Math.max(0, ...perf.map((p) => p.tickP99))),
      tickMax: r1(Math.max(0, ...perf.map((p) => p.tickMax))),
      sim: r1(avg(perf.map((p) => p.parts.sim))),
      events: r1(avg(perf.map((p) => p.parts.events))),
      snap: r1(avg(perf.map((p) => p.parts.snap))),
      save: r1(avg(perf.map((p) => p.parts.save))),
      autosaveMax: r1(Math.max(0, ...perf.map((p) => p.autosaveMax))),
      ticksPerSec: r1(avg(perf.map((p) => p.ticksPerSec))),
      lagP99: r1(Math.max(0, ...perf.map((p) => p.lagP99))),
      lagMax: r1(Math.max(0, ...perf.map((p) => p.lagMax))),
      busy: Math.round(avg(perf.map((p) => p.busy)) * 100),
      cpu: r1(avg(perf.map((p) => p.cpu))),
      rssMb: Math.max(0, ...perf.map((p) => p.rssMb)),
      wireKbps: Math.round(avg(perf.map((p) => p.wireKbps))),
      jsonKbps: Math.round(avg(perf.map((p) => p.jsonKbps))),
      skipped: perf.reduce((n, p) => n + p.snapsSkipped, 0),
      pingP50: Math.round(pct(rtts, 0.5)),
      pingP95: Math.round(pct(rtts, 0.95)),
      pingMax: Math.round(Math.max(0, ...rtts)),
      snapsPerBot: target ? r1(ws.reduce((n, s) => n + s.snaps, 0) / target / secs) : 0,
      maxSnapGap: Math.round(Math.max(0, ...ws.map((s) => s.maxGap))),
      gaps250: ws.reduce((n, s) => n + s.gaps250, 0),
      botBusyMax: Math.round(Math.max(0, ...ws.map((s) => s.busy)) * 100),
      recvKbpsPerBot: target ? Math.round((ws.reduce((n, s) => n + s.bytes, 0) * 8) / 1000 / secs / target) : 0,
    };
    results.push(row);
    console.log(
      `${String(target).padStart(4)} bots (${row.online} on, ${row.sims} sims): tick avg ${row.tickAvg} p99 ${row.tickP99} max ${row.tickMax} ms` +
        ` [sim ${row.sim} ev ${row.events} snap ${row.snap} save ${row.save}] autosave ${row.autosaveMax} ms · ${row.ticksPerSec} t/s` +
        ` · lag p99 ${row.lagP99} max ${row.lagMax} · busy ${row.busy}% cpu ${row.cpu}% · ${row.rssMb} MB` +
        ` · out ${row.wireKbps} kbps (json ${row.jsonKbps}) · ping p50 ${row.pingP50} p95 ${row.pingP95} max ${row.pingMax}` +
        ` · ${row.snapsPerBot} snap/s/bot gap max ${row.maxSnapGap} (${row.gaps250} >250ms) · ${row.recvKbpsPerBot} kbps/bot · bot workers busy ≤${row.botBusyMax}%`,
    );
    if (out) writeFileSync(out, JSON.stringify({ scenario, autoShare, hubShare, hold, results }, null, 2));
  }

  for (const c of workers) c.send({ t: 'quit' });
  await sleep(800);
  // The owner's stop (countdown cut to 1 s by SHUTDOWN_SECONDS): the server saves and exits normally,
  // which also writes its CPU profile (a kill on Windows would not).
  const exited = new Promise((r) => server.once('exit', r));
  await api('POST', '/admin/server', { mode: 'shutdown', seconds: 10 }, ownerTok);
  await Promise.race([exited, sleep(15_000)]);
  if (server.exitCode === null) server.kill();
  rmSync(dir, { recursive: true, force: true });
}

if (!process.argv.includes('--worker')) await main();
