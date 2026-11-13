// Server load numbers for the log: how long each game tick takes (and on what), how late the event
// loop runs, CPU and memory of this process, and how much data goes out. One `[perf]` line a minute
// while anyone is online (PERF_LOG_MS changes the interval, for load tests; PERF_JSON=1 adds a
// machine-readable `[perf-json]` line). Everything here is cheap: a few performance.now() calls a tick.
import { monitorEventLoopDelay, performance, type EventLoopUtilization } from 'node:perf_hooks';

export const PERF_LOG_MS = Math.max(1000, Number(process.env.PERF_LOG_MS) || 60_000);
const PERF_JSON = process.env.PERF_JSON === '1';

/** Parts of a tick timed separately (ms). */
export type TickPart = 'sim' | 'events' | 'snap' | 'save';
const PARTS: TickPart[] = ['sim', 'events', 'snap', 'save'];

/** What one report says (also the `[perf-json]` line). */
export interface PerfReport {
  /** Seconds the report covers. */
  secs: number;
  online: number;
  sims: number;
  monsters: number;
  ticksPerSec: number;
  tickAvg: number;
  tickP99: number;
  tickMax: number;
  /** Average ms per tick spent in each part. */
  parts: Record<TickPart, number>;
  /** Longest autosave of everyone (ms; runs outside the tick). */
  autosaveMax: number;
  /** Event-loop delay (ms): how late timers fire. */
  lagP50: number;
  lagP99: number;
  lagMax: number;
  /** Share of the time the main thread was busy (0–1). */
  busy: number;
  /** CPU of the whole process (main thread + zlib/sqlite threads) as % of one core. */
  cpu: number;
  rssMb: number;
  heapMb: number;
  /** Messages and their JSON size (before compression), per second. */
  msgsPerSec: number;
  jsonKbps: number;
  /** Bytes that actually left on the players' connections (after compression), kbit/s. */
  wireKbps: number;
  snapsSkipped: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export class Perf {
  private readonly lag = monitorEventLoopDelay({ resolution: 10 });
  private elu: EventLoopUtilization = performance.eventLoopUtilization();
  private cpu = process.cpuUsage();
  private from = performance.now();
  private ticks: number[] = [];
  private readonly partSum: Record<TickPart, number> = { sim: 0, events: 0, snap: 0, save: 0 };
  private autosaveMax = 0;
  private msgs = 0;
  private jsonBytes = 0;
  skipped = 0;

  constructor() {
    this.lag.enable();
  }

  tick(ms: number): void {
    this.ticks.push(ms);
  }

  part(p: TickPart, ms: number): void {
    this.partSum[p] += ms;
  }

  autosave(ms: number): void {
    this.autosaveMax = Math.max(this.autosaveMax, ms);
  }

  sent(jsonLength: number): void {
    this.msgs++;
    this.jsonBytes += jsonLength;
  }

  /** The numbers since the last report, then starts over. `wireBytes` = bytes written to players' sockets meanwhile. */
  report(online: number, sims: number, monsters: number, wireBytes: number): PerfReport {
    const now = performance.now();
    const secs = Math.max(0.001, (now - this.from) / 1000);
    const elu = performance.eventLoopUtilization(this.elu);
    const cpu = process.cpuUsage(this.cpu);
    const mem = process.memoryUsage();
    const sorted = [...this.ticks].sort((a, b) => a - b);
    const n = sorted.length;
    const parts = {} as Record<TickPart, number>;
    for (const p of PARTS) parts[p] = n ? r1((this.partSum[p] / n) * 100) / 100 : 0;
    const out: PerfReport = {
      secs: r1(secs), online, sims, monsters,
      ticksPerSec: r1(n / secs),
      tickAvg: n ? Math.round((sorted.reduce((a, b) => a + b, 0) / n) * 100) / 100 : 0,
      tickP99: n ? r1(sorted[Math.min(n - 1, Math.floor(n * 0.99))]) : 0,
      tickMax: n ? r1(sorted[n - 1]) : 0,
      parts,
      autosaveMax: r1(this.autosaveMax),
      lagP50: r1(this.lag.percentile(50) / 1e6),
      lagP99: r1(this.lag.percentile(99) / 1e6),
      lagMax: r1(this.lag.max / 1e6),
      busy: Math.round(elu.utilization * 1000) / 1000,
      cpu: r1(((cpu.user + cpu.system) / 1000 / (secs * 1000)) * 100),
      rssMb: Math.round(mem.rss / 1048576),
      heapMb: Math.round(mem.heapUsed / 1048576),
      msgsPerSec: Math.round(this.msgs / secs),
      jsonKbps: Math.round((this.jsonBytes * 8) / 1000 / secs),
      wireKbps: Math.round((wireBytes * 8) / 1000 / secs),
      snapsSkipped: this.skipped,
    };
    this.from = now;
    this.elu = performance.eventLoopUtilization();
    this.cpu = process.cpuUsage();
    this.lag.reset();
    this.ticks = [];
    for (const p of PARTS) this.partSum[p] = 0;
    this.autosaveMax = 0;
    this.msgs = 0;
    this.jsonBytes = 0;
    this.skipped = 0;
    return out;
  }

  /** Logs a report as one readable line (and the JSON line with PERF_JSON=1). */
  static log(r: PerfReport): void {
    const kb = (k: number) => (k >= 1000 ? `${r1(k / 1000)} Mbit/s` : `${k} kbit/s`);
    console.log(
      `[perf] ${r.online} online · ${r.sims} maps/CH · ${r.monsters} monsters · tick avg ${r.tickAvg} ms p99 ${r.tickP99} max ${r.tickMax}` +
        ` (sim ${r.parts.sim} · events ${r.parts.events} · snapshots ${r.parts.snap} · saves ${r.parts.save}) · ${r.ticksPerSec} ticks/s` +
        ` · autosave max ${r.autosaveMax} ms · loop lag p99 ${r.lagP99} ms max ${r.lagMax} · busy ${Math.round(r.busy * 100)}% · CPU ${r.cpu}%` +
        ` · RAM ${r.rssMb} MB · out ${kb(r.wireKbps)} (JSON ${kb(r.jsonKbps)}, ${r.msgsPerSec} msg/s)${r.snapsSkipped ? ` · ${r.snapsSkipped} snapshots skipped` : ''}`,
    );
    if (PERF_JSON) console.log(`[perf-json] ${JSON.stringify(r)}`);
  }
}
