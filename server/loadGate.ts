// Waiting for everyone to load before a boss room's / wave run's countdown starts (owner 2026-11-24). The countdown used
// to start when the server opened the room, so players still on the loading screen saw it begin a few seconds short.
// Now the Sim holds it (Sim.waiting) until everyone sent in says their map is up (`zoneReady`), or has left, or the
// longest wait (/admin `roomLoadWait`) is up — whichever comes first. The browser's word only speeds things up: the
// time limit is always the server's.
import type { Sim } from '../src/shared/sim/Sim';
import type { LoadWait } from '../src/shared/bossRoom';

export class LoadGate {
  /** Characters the countdown waits for, and those that said they are loaded. */
  private readonly expect = new Set<number>();
  private readonly ready = new Set<number>();

  constructor(
    private readonly sim: Sim,
    /** When (ms) the countdown starts anyway. */
    private readonly until: number,
    /** Where a character is now (undefined offline): one no longer in this Sim is not waited for. */
    private readonly where: (charId: number) => Sim | undefined,
  ) {}

  /** Wait for this character too (one sent in, or a party member joining while it still waits). */
  add(charId: number): void {
    this.expect.add(charId);
  }

  /** The browser says the map is up. Only counts for someone this gate waits for. */
  loaded(charId: number): void {
    if (this.expect.has(charId)) this.ready.add(charId);
  }

  /** Still waited for: expected, still in this Sim, and not loaded yet. */
  private pending(): number[] {
    return [...this.expect].filter((id) => !this.ready.has(id) && this.where(id) === this.sim);
  }

  /** Starts the countdown when nobody is left to wait for or the time is up. Returns true once it has (the gate is done). */
  check(now: number): boolean {
    if (!this.sim.waiting) return true;
    if (now >= this.until || !this.pending().length) {
      this.sim.startCountdown();
      return true;
    }
    return false;
  }

  /** What the players see meanwhile: how many of those still here have loaded. */
  view(): LoadWait {
    const here = [...this.expect].filter((id) => this.where(id) === this.sim);
    return { ready: here.filter((id) => this.ready.has(id)).length, total: here.length };
  }
}
