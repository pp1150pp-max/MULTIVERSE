// Every sound effect is synthesised, so the game ships no audio files.
import type { SfxName } from '../../shared/sim/types';
import { audioEngine } from './engine';

type SkillSound =
  | 'slash' | 'whirlwind' | 'charge' | 'earthquake'
  | 'bolt' | 'fireball' | 'frostnova' | 'meteor'
  | 'shot' | 'rapidfire' | 'pierce' | 'headshot'
  | 'dash';
type WorldSound = 'explosion' | 'crater' | 'impact' | 'hit' | 'hurt' | 'enrage' | 'level_up' | 'death' | 'revive' | 'portal' | 'ui_click';
export type SoundName = SfxName | SkillSound | WorldSound;

/** Sounds playing at once. Past this, combat sounds are dropped; `always` sounds still play. */
const MAX_VOICES = 24;

interface Sound {
  /** Shortest time between two plays, in ms. Stops Auto Play and area skills from machine-gunning. */
  gap: number;
  always?: boolean;
  make(s: Voice): void;
}

/** One playing sound: a set of envelopes sharing an output, cleaned up when the last one ends. */
class Voice {
  private pending = 0;

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode, private readonly t0: number, private readonly onDone: () => void) {}

  /** A pitched blip gliding from f0 to f1 Hz. */
  tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0): void {
    const t = this.t0 + at;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const env = this.envelope(t, dur, vol);
    o.connect(env);
    this.finish(o, env, t, dur);
  }

  /** A filtered burst of noise whose filter sweeps from f0 to f1 Hz. */
  noise(f0: number, f1: number, dur: number, vol: number, at = 0, q = 1.2, type: BiquadFilterType = 'bandpass'): void {
    const t = this.t0 + at;
    const src = this.ctx.createBufferSource();
    src.buffer = audioEngine.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const env = this.envelope(t, dur, vol);
    src.connect(f);
    f.connect(env);
    this.finish(src, env, t, dur);
  }

  private envelope(t: number, dur: number, vol: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.006, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out);
    return g;
  }

  private finish(src: AudioScheduledSourceNode, env: GainNode, t: number, dur: number): void {
    this.pending++;
    src.onended = () => {
      env.disconnect();
      if (--this.pending === 0) this.onDone();
    };
    src.start(t);
    src.stop(t + dur + 0.01);
  }
}

const SOUNDS: Record<SoundName, Sound> = {
  // ---------------- Sword
  slash: { gap: 60, make: (s) => s.noise(1400, 4200, 0.13, 0.32) },
  whirlwind: {
    gap: 200,
    make: (s) => {
      for (let i = 0; i < 4; i++) s.noise(900 + i * 400, 3800, 0.16, 0.3, i * 0.09);
    },
  },
  charge: {
    gap: 200,
    make: (s) => {
      s.tone('sawtooth', 110, 420, 0.28, 0.14);
      s.noise(500, 2800, 0.34, 0.28);
    },
  },
  earthquake: {
    gap: 200,
    make: (s) => {
      s.tone('triangle', 92, 28, 0.6, 0.65);
      s.noise(420, 70, 0.72, 0.6, 0, 0.7, 'lowpass');
      s.noise(1000, 240, 0.25, 0.22, 0.08);
    },
  },
  // ---------------- Mage
  bolt: {
    gap: 60,
    make: (s) => {
      s.tone('triangle', 620, 1300, 0.12, 0.26);
      s.tone('square', 1240, 2100, 0.08, 0.05);
    },
  },
  fireball: {
    gap: 120,
    make: (s) => {
      s.noise(380, 1500, 0.3, 0.32);
      s.tone('sawtooth', 170, 360, 0.24, 0.1);
    },
  },
  frostnova: {
    gap: 200,
    make: (s) => {
      [1760, 2093, 2637, 3136].forEach((f, i) => s.tone('triangle', f, f * 0.94, 0.42 - i * 0.05, 0.12, i * 0.045));
      s.noise(5200, 1600, 0.5, 0.17, 0, 0.8, 'highpass');
    },
  },
  meteor: {
    gap: 200,
    make: (s) => {
      s.tone('square', 1500, 180, 0.95, 0.055);
      s.noise(2600, 340, 0.95, 0.15);
    },
  },
  // ---------------- Gunslinger
  shot: {
    gap: 60,
    make: (s) => {
      s.noise(3000, 780, 0.09, 0.46, 0, 0.8);
      s.tone('square', 480, 110, 0.07, 0.11);
    },
  },
  rapidfire: {
    gap: 120,
    // One crack per shot, in step with the 0.08 s gap between the six shots.
    make: (s) => {
      for (let i = 0; i < 6; i++) {
        s.noise(3000, 780, 0.08, 0.4, i * 0.08, 0.8);
        s.tone('square', 460, 110, 0.06, 0.09, i * 0.08);
      }
    },
  },
  pierce: {
    gap: 120,
    make: (s) => {
      s.tone('sawtooth', 2100, 210, 0.2, 0.17);
      s.noise(4200, 1100, 0.14, 0.44, 0, 0.8);
    },
  },
  headshot: {
    gap: 200,
    // Taking aim: the hammer cocks, then a thin rising whine while the line shows.
    make: (s) => {
      s.noise(4200, 2600, 0.04, 0.3, 0, 2);
      s.noise(3600, 2200, 0.04, 0.26, 0.09, 2);
      s.tone('sine', 700, 1500, 0.7, 0.05, 0.1);
    },
  },
  dash: { gap: 120, make: (s) => s.noise(700, 2700, 0.2, 0.26, 0, 0.9) },

  // ---------------- Skill impacts
  explosion: {
    gap: 90,
    make: (s) => {
      s.tone('triangle', 150, 38, 0.36, 0.55);
      s.noise(1500, 130, 0.42, 0.55, 0, 0.6, 'lowpass');
    },
  },
  crater: {
    gap: 150,
    always: true,
    make: (s) => {
      s.tone('triangle', 112, 24, 0.75, 0.8);
      s.noise(2100, 72, 0.85, 0.74, 0, 0.5, 'lowpass');
      s.noise(2400, 620, 0.22, 0.26);
    },
  },
  impact: {
    gap: 60,
    make: (s) => {
      s.noise(2500, 700, 0.07, 0.3, 0, 0.8);
      s.tone('square', 260, 95, 0.05, 0.08);
    },
  },

  // ---------------- Combat
  hit: {
    gap: 55,
    make: (s) => {
      s.noise(1700, 480, 0.06, 0.24, 0, 0.9);
      s.tone('square', 230, 110, 0.05, 0.09);
    },
  },
  headshot_fire: {
    gap: 200,
    // The Headshot going off: a deep heavy boom with a sharp crack on top.
    make: (s) => {
      s.noise(2600, 300, 0.35, 0.7, 0, 0.6);
      s.tone('sawtooth', 220, 45, 0.3, 0.2);
      s.noise(5200, 2000, 0.06, 0.4, 0, 1.5);
    },
  },
  crit: {
    gap: 90,
    make: (s) => {
      s.tone('square', 1320, 1760, 0.09, 0.09);
      s.tone('triangle', 2640, 2100, 0.14, 0.13, 0.015);
      s.noise(4400, 1500, 0.08, 0.2);
    },
  },
  hurt: {
    gap: 180,
    always: true,
    make: (s) => {
      s.tone('square', 240, 105, 0.15, 0.18);
      s.noise(800, 240, 0.12, 0.28, 0, 0.8);
    },
  },
  monster_die: {
    gap: 70,
    make: (s) => {
      s.tone('square', 340, 66, 0.26, 0.15);
      s.noise(1000, 170, 0.22, 0.16, 0.02, 0.8);
    },
  },
  boss_die: {
    gap: 800,
    always: true,
    make: (s) => {
      s.tone('sawtooth', 220, 24, 1.5, 0.3);
      s.noise(1800, 58, 1.6, 0.68, 0, 0.5, 'lowpass');
      [523, 659, 784, 1047].forEach((f, i) => s.tone('square', f, f, 0.26, 0.09, 1.0 + i * 0.13));
    },
  },
  boss_slam: {
    gap: 300,
    always: true,
    make: (s) => {
      s.tone('triangle', 88, 30, 0.5, 0.7);
      s.noise(800, 80, 0.5, 0.6, 0, 0.6, 'lowpass');
    },
  },
  enrage: {
    gap: 800,
    always: true,
    make: (s) => {
      s.tone('sawtooth', 75, 240, 0.8, 0.26);
      s.tone('sawtooth', 79, 256, 0.8, 0.22);
      s.noise(280, 1500, 0.8, 0.28);
    },
  },

  // ---------------- Items
  pickup_gold: {
    gap: 45,
    make: (s) => {
      s.tone('square', 1568, 1568, 0.05, 0.075);
      s.tone('square', 2093, 2093, 0.11, 0.075, 0.05);
    },
  },
  pickup_item: {
    gap: 90,
    always: true,
    make: (s) => {
      [659, 880, 1319].forEach((f, i) => s.tone('triangle', f, f, 0.14, 0.2, i * 0.055));
    },
  },
  pickup_potion: {
    gap: 90,
    make: (s) => {
      s.tone('triangle', 560, 1120, 0.09, 0.22);
      s.tone('triangle', 840, 1400, 0.09, 0.16, 0.08);
    },
  },
  drink: {
    gap: 90,
    always: true,
    make: (s) => {
      for (let i = 0; i < 3; i++) s.tone('sine', 300 + i * 80, 720 + i * 120, 0.09, 0.26, i * 0.08);
    },
  },
  trade: {
    gap: 80,
    always: true,
    make: (s) => {
      s.tone('square', 1319, 1319, 0.05, 0.08);
      s.tone('square', 1760, 1760, 0.07, 0.08, 0.05);
      s.tone('square', 2349, 2349, 0.12, 0.08, 0.11);
    },
  },
  enhance_ok: {
    gap: 200,
    always: true,
    make: (s) => {
      s.noise(4600, 2400, 0.07, 0.36, 0, 2);
      [784, 988, 1175, 1568].forEach((f, i) => s.tone('square', f, f, 0.18, 0.09, 0.08 + i * 0.075));
    },
  },
  enhance_fail: {
    gap: 200,
    always: true,
    make: (s) => {
      s.noise(4000, 2200, 0.07, 0.34, 0, 2);
      s.tone('sawtooth', 330, 311, 0.2, 0.13, 0.09);
      s.tone('sawtooth', 247, 165, 0.36, 0.14, 0.27);
    },
  },

  // ---------------- Player and world
  level_up: {
    gap: 300,
    always: true,
    make: (s) => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => s.tone('square', f, f, 0.24, 0.09, i * 0.08));
      s.tone('triangle', 2093, 2093, 0.5, 0.13, 0.4);
    },
  },
  death: {
    gap: 500,
    always: true,
    make: (s) => {
      [440, 370, 311, 220].forEach((f, i) => s.tone('square', f, f * 0.97, 0.32, 0.12, i * 0.2));
      s.tone('triangle', 110, 55, 0.9, 0.3, 0.6);
    },
  },
  revive: {
    gap: 500,
    always: true,
    make: (s) => {
      [392, 523, 659, 784].forEach((f, i) => s.tone('triangle', f, f, 0.4, 0.17, i * 0.1));
      s.noise(2400, 6200, 0.6, 0.1, 0, 0.8, 'highpass');
    },
  },
  portal: {
    gap: 500,
    always: true,
    make: (s) => {
      s.tone('sine', 220, 1200, 0.75, 0.24);
      s.tone('triangle', 330, 1800, 0.75, 0.12, 0.06);
      s.noise(600, 4800, 0.8, 0.14);
    },
  },
  ui_click: { gap: 40, always: true, make: (s) => s.tone('square', 980, 720, 0.035, 0.07) },
};

export const isSoundName = (name: string): name is SoundName => name in SOUNDS;

const lastPlayed = new Map<SoundName, number>();
let voices = 0;

/** Plays a sound now. `gain` scales it (0..1), `pan` places it left/right (-1..1). */
export function playSound(name: SoundName, gain = 1, pan = 0): void {
  const ctx = audioEngine.ctx;
  const bus = audioEngine.sfxBus;
  if (!ctx || !bus || !audioEngine.running || gain <= 0) return;
  const sound = SOUNDS[name];
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < sound.gap) return;
  if (voices >= MAX_VOICES && !sound.always) return;
  lastPlayed.set(name, now);

  const out = ctx.createGain();
  out.gain.value = gain;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  out.connect(panner);
  panner.connect(bus);
  voices++;
  sound.make(new Voice(ctx, out, ctx.currentTime, () => {
    voices--;
    out.disconnect();
    panner.disconnect();
  }));
}
