// Minigame "รอดมอนเป็นระลอก" on the server (owner 2026-11-21, src/shared/waveGame.ts): walking through a door into a map whose
// settings pick this minigame does not put the player into a channel of it but into a run of its own — a fresh Sim of that map, one
// per group (a party on the same map goes in together; a member who comes later joins the party's run). The Sim plays the waves;
// this side counts runs per day, sees a win or a wipe through, and sends everyone back out by the door they came in.
// Everything is in memory: a restart sends everyone to town, like the boss rooms (the daily count starts again too).
import { Sim } from '../src/shared/sim/Sim';
import type { Player } from '../src/shared/sim/Player';
import type { ZoneDef } from '../src/shared/data/zones';
import { currentBalance } from '../src/shared/balance';
import type { WaveSnap } from '../src/shared/waveGame';
import { LoadGate } from './loadGate';

export interface WaveExit { field: string; x: number; z: number }

interface Run {
  sim: Sim;
  zoneId: string;
  channel: number;
  exit: WaveExit;
  /** The party (by its id) this run belongs to, so members who come later join it. */
  partyId: number | null;
  /** When (ms) everyone is sent out after the win. */
  endAt: number | null;
  /** Everyone is down: when (ms) the group has lost unless someone gets up. */
  wipeAt: number | null;
  /** Waiting for everyone to load before the countdown to wave 1 starts (null once it has, server/loadGate.ts). */
  gate: LoadGate | null;
}

/** Thai calendar day (UTC+7), for the per-day limit. */
const thaiDay = (t: number): string => new Date(t + 7 * 3600_000).toISOString().slice(0, 10);

export class WaveRooms {
  private readonly runs = new Map<Sim, Run>();
  private readonly daily = new Map<number, { day: string; n: number }>();

  constructor(
    /** Sends a player out of its run: the dead get up by the door (Sim.respawn), the living walk out there. */
    private readonly out: (sim: Sim, p: Player, exit: WaveExit) => void,
    private readonly now: () => number = () => Date.now(),
    /** Where a character is now (undefined offline), for the load wait. */
    private readonly where: (charId: number) => Sim | undefined = () => undefined,
  ) {}

  sims(): Sim[] {
    return [...this.runs.keys()];
  }

  has(sim: Sim): boolean {
    return this.runs.has(sim);
  }

  /** How many runs of each map are on (the admin page). */
  counts(): Map<string, number> {
    const out = new Map<string, number>();
    for (const r of this.runs.values()) out.set(r.zoneId, (out.get(r.zoneId) ?? 0) + 1);
    return out;
  }

  /** A party's run of this map still being played, to join. */
  partyRun(zoneId: string, partyId: number | null): Sim | undefined {
    if (partyId === null) return undefined;
    for (const r of this.runs.values()) if (r.zoneId === zoneId && r.partyId === partyId && !r.sim.waveRun?.won && r.sim.players.length) return r.sim;
    return undefined;
  }

  /** Runs this character has left today (Infinity with no limit). */
  runsLeft(charId: number): number {
    const limit = currentBalance().waves.dailyLimit;
    if (limit <= 0) return Infinity;
    const d = this.daily.get(charId);
    return d && d.day === thaiDay(this.now()) ? Math.max(0, limit - d.n) : limit;
  }

  private count(charId: number): void {
    const day = thaiDay(this.now());
    const d = this.daily.get(charId);
    this.daily.set(charId, d && d.day === day ? { day, n: d.n + 1 } : { day, n: 1 });
  }

  /**
   * Opens a run of this map for these characters (they are counted for the day); the caller moves them in. The countdown to
   * wave 1 waits for them to load the map (or /admin roomLoadWait), checked from the next tick on.
   */
  open(zone: ZoneDef, charIds: number[], exit: WaveExit, partyId: number | null): { sim: Sim; channel: number } {
    const used = new Set([...this.runs.values()].filter((r) => r.zoneId === zone.id).map((r) => r.channel));
    let channel = 1;
    while (used.has(channel)) channel++;
    const bal = currentBalance();
    const sim = new Sim(zone, { waves: bal.waves, exit, hold: true });
    let gate: LoadGate | null = null;
    if (sim.waiting) {
      gate = new LoadGate(sim, this.now() + bal.roomLoadWait * 1000, this.where);
      for (const id of charIds) gate.add(id);
    }
    this.runs.set(sim, { sim, zoneId: zone.id, channel, exit, partyId, endAt: null, wipeAt: null, gate });
    for (const id of charIds) this.count(id);
    console.log(`[waves] ${zone.id} #${channel}: ${charIds.length} player(s)`);
    return { sim, channel };
  }

  /** A late party member joins a run: counted for the day too, and waited for if the countdown has not started. */
  joined(charId: number, sim?: Sim): void {
    this.count(charId);
    const r = sim && this.runs.get(sim);
    r?.gate?.add(charId);
  }

  /** The browser has the map up after a zone change (`zoneReady`): only counts if this character's run waits for it. */
  loaded(charId: number): void {
    const sim = this.where(charId);
    const r = sim && this.runs.get(sim);
    if (r?.gate) {
      r.gate.loaded(charId);
      if (r.gate.check(this.now())) r.gate = null;
    }
  }

  snap(sim: Sim, p: Player): WaveSnap | undefined {
    const r = this.runs.get(sim);
    const w = sim.waveRun;
    if (!r || !w) return undefined;
    const t = this.now();
    const snap: WaveSnap = { wave: w.wave, of: w.cfg.waves, left: sim.waveLeft(), revives: sim.revivesLeft(p) };
    if (w.nextAt !== null) snap.nextIn = Math.max(0, w.nextAt - sim.time);
    if (r.gate && sim.waiting) snap.wait = r.gate.view();
    if (r.endAt !== null) snap.wonIn = Math.max(0, Math.ceil((r.endAt - t) / 1000));
    if (r.wipeAt !== null) snap.wipeIn = Math.max(0, (r.wipeAt - t) / 1000);
    return snap;
  }

  tick(): void {
    const t = this.now();
    for (const r of [...this.runs.values()]) {
      const sim = r.sim;
      if (!sim.players.length) {
        this.runs.delete(sim);
        continue;
      }
      if (r.gate?.check(t)) r.gate = null;
      const won = !!sim.waveRun?.won;
      if (won && r.endAt === null) {
        const sec = currentBalance().waves.endSec;
        r.endAt = t + sec * 1000;
        for (const p of sim.players) sim.log(`ออกจากมินิเกมใน ${sec} วินาที (กดปุ่มออกก่อนได้)`, '#ffcf5a', p.id);
      }
      const down = !won && sim.players.every((p) => !p.alive);
      if (!down) r.wipeAt = null;
      else if (r.wipeAt === null) {
        const sec = currentBalance().roomWipeSec;
        r.wipeAt = t + sec * 1000;
        for (const p of sim.players) sim.log(`ทุกคนล้มหมด! ใช้ขนนกฟีนิกซ์ภายใน ${sec} วินาที ไม่อย่างนั้นทีมจะแพ้`, '#ff6a5a', p.id);
      }
      const lost = down && r.wipeAt !== null && t >= r.wipeAt;
      if (lost) {
        const w = sim.waveRun;
        for (const p of sim.players) sim.log(`ทีมพ่ายแพ้ที่ระลอก ${w?.wave ?? 0} — ออกไปหน้าประตู (ได้ทองของระลอกที่ผ่านแล้ว)`, '#ff6a5a', p.id);
      }
      if (lost || (r.endAt !== null && t >= r.endAt)) for (const p of [...sim.players]) this.out(sim, p, r.exit);
    }
  }
}
