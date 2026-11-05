// Owns the AudioContext, the mixer and the saved volume settings. Browsers only allow sound after a
// user gesture, so the context is created on the first click or key press.

export interface AudioSettings {
  /** 0..1 */
  music: number;
  /** 0..1 */
  sfx: number;
  muted: boolean;
}

const KEY = 'multiverse-audio-v1';
const DEFAULTS: AudioSettings = { music: 0.5, sfx: 0.7, muted: false };
/** Keeps the music under the effects when both sliders sit at the same position. */
const MUSIC_HEADROOM = 0.6;
const CLICKABLE = 'button, .class-card, .char-slot, .cell';

const unit = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;

function loadSettings(): AudioSettings {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AudioSettings>;
    return { music: unit(d.music, DEFAULTS.music), sfx: unit(d.sfx, DEFAULTS.sfx), muted: d.muted === true };
  } catch {
    return { ...DEFAULTS };
  }
}

class AudioEngine {
  ctx: AudioContext | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  readonly settings: AudioSettings = loadSettings();
  /** Handles UI clicks; set by whoever owns the sound table. */
  onUiClick: (() => void) | null = null;

  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private started = false;

  /** Call once at boot. Nothing audible happens until the player's first gesture. */
  init(): void {
    if (this.started) return;
    this.started = true;
    const wake = () => this.wake();
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.ctx?.suspend();
      else void this.ctx?.resume();
    });
    document.addEventListener('click', (e) => {
      if ((e.target as HTMLElement | null)?.closest?.(CLICKABLE)) this.onUiClick?.();
    }, true);
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** One second of white noise, shared by every noise voice. */
  get noise(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  /** Changes settings, applies them right away and remembers them. */
  set(change: Partial<AudioSettings>): void {
    Object.assign(this.settings, change);
    this.applyLevels();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      // Storage blocked or full: the settings still apply for this session.
    }
  }

  private wake(): void {
    if (!this.ctx) this.build();
    if (this.ctx!.state !== 'running' && !document.hidden) void this.ctx!.resume();
  }

  private build(): void {
    const ctx = new AudioContext();
    this.ctx = ctx;
    // Many hits landing together would clip without a limiter.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 12;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(limiter);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.applyLevels();
  }

  private applyLevels(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = this.settings;
    // Squared so the sliders feel even to the ear.
    this.master!.gain.setTargetAtTime(s.muted ? 0 : 1, ctx.currentTime, 0.015);
    this.musicBus!.gain.setTargetAtTime(s.music * s.music * MUSIC_HEADROOM, ctx.currentTime, 0.015);
    this.sfxBus!.gain.setTargetAtTime(s.sfx * s.sfx, ctx.currentTime, 0.015);
  }
}

export const audioEngine = new AudioEngine();
