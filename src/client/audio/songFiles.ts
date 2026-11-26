// Fetches and decodes the boss room song files (public/assets/music/<song>.mp3). A decoded song is large
// (tens of MB), so only the one being asked for is kept.
import type { BossSong } from '../../shared/audioTuning';

/** A file that wasn't there (or wouldn't decode) is tried again after this long. */
const RETRY_MS = 60_000;

export const songUrl = (song: BossSong): string => `assets/music/${song}.mp3`;

class SongFiles {
  private wanted: BossSong | null = null;
  private held: { song: BossSong; buffer: AudioBuffer } | null = null;
  private pending = new Set<BossSong>();
  private failedAt = new Map<BossSong, number>();

  /** The decoded song once it is ready, else null (starting the load). Call every tick; null drops the held one. */
  get(ctx: AudioContext, song: BossSong | null): AudioBuffer | null {
    this.wanted = song;
    if (this.held && this.held.song !== song) this.held = null;
    if (!song) return null;
    if (this.held) return this.held.buffer;
    if (!this.pending.has(song) && Date.now() - (this.failedAt.get(song) ?? -Infinity) >= RETRY_MS) void this.load(ctx, song);
    return null;
  }

  loading(song: BossSong | null): boolean {
    return !!song && this.pending.has(song);
  }

  private async load(ctx: AudioContext, song: BossSong): Promise<void> {
    this.pending.add(song);
    try {
      const res = await fetch(songUrl(song));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // `npm run dev` answers a missing file with a web page: that fails to decode, same as no file.
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      if (this.wanted === song) this.held = { song, buffer };
      this.failedAt.delete(song);
    } catch {
      this.failedAt.set(song, Date.now());
    } finally {
      this.pending.delete(song);
    }
  }
}

export const songFiles = new SongFiles();
