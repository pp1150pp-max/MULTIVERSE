// Original chiptune tracks, sequenced live with Web Audio: a pulse lead, a triangle bass, a soft arpeggio
// and noise drums. Each line below is one bar of eight steps: a note, `-` to hold it, `.` for silence.
// Boss rooms may loop a song file instead (songFiles.ts); both go through the same fade and music slider.
import type { BossSong } from '../../shared/audioTuning';
import { currentBalance } from '../../shared/balance';
import { audioEngine } from './engine';
import { songFiles } from './songFiles';

export type TrackId = 'forest' | 'marsh' | 'snow' | 'volcano' | 'town' | 'boss'
  | 'boss_bear' | 'boss_witch' | 'boss_yeti' | 'boss_heart';

/** Chord symbol → bass root, bass fifth, then three arpeggio notes. */
const CHORDS: Record<string, [string, string, string, string, string]> = {
  G: ['G2', 'D3', 'G4', 'B4', 'D5'],
  Em: ['E2', 'B2', 'E4', 'G4', 'B4'],
  C: ['C3', 'G2', 'E4', 'G4', 'C5'],
  D: ['D3', 'A2', 'D4', 'F#4', 'A4'],
  Am: ['A2', 'E3', 'E4', 'A4', 'C5'],
  Dm: ['D3', 'A2', 'D4', 'F4', 'A4'],
  Bb: ['A#2', 'F3', 'D4', 'F4', 'A#4'],
  F: ['F2', 'C3', 'C4', 'F4', 'A4'],
  Gm: ['G2', 'D3', 'D4', 'G4', 'A#4'],
  A: ['A2', 'E3', 'C#4', 'E4', 'A4'],
  E: ['E2', 'B2', 'E4', 'G#4', 'B4'],
  B: ['B2', 'F#3', 'D#4', 'F#4', 'B4'],
  Cm: ['C3', 'G2', 'C4', 'D#4', 'G4'],
  Fm: ['F2', 'C3', 'C4', 'F4', 'G#4'],
  Ab: ['G#2', 'D#3', 'C4', 'D#4', 'G#4'],
};

interface TrackDef {
  bpm: number;
  lead: string[];
  chords: string[];
  /** One bar of bass steps: `1` = root, `5` = fifth, `8` = root an octave up. */
  bass: string;
  /** One bar of arpeggio steps: `1` to `3` pick a chord note. */
  arp: string;
  /** One bar of drums: k = kick, s = snare, h = hat. */
  drums: string;
  leadVol: number;
  bassVol: number;
  arpVol: number;
  drumVol: number;
}

const TRACKS: Record<TrackId, TrackDef> = {
  // Bright and unhurried, in G major.
  forest: {
    bpm: 92,
    lead: [
      'G4 - B4 D5 - B4 A4 -', 'E4 - G4 B4 - A4 G4 -', 'C5 - B4 A4 - G4 E4 G4', 'A4 - - - . . D4 -',
      'G4 - B4 D5 - E5 D5 -', 'B4 - A4 G4 - E4 D4 -', 'E4 G4 A4 B4 - A4 G4 E4', 'G4 - - - . . . .',
      'E5 - D5 B4 - D5 E5 -', 'G5 - E5 D5 - B4 A4 -', 'C5 - D5 E5 - D5 C5 A4', 'B4 - - - G4 - - -',
      'E5 - D5 B4 - A4 B4 -', 'C5 - E5 G5 - E5 D5 -', 'C5 B4 A4 G4 - A4 B4 -', 'G4 - - - . . . .',
    ],
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'G', 'Em', 'G', 'C', 'G', 'Em', 'C', 'D', 'G'],
    bass: '1 - . 5 1 - 5 -',
    arp: '1 2 3 2 1 2 3 2',
    drums: 'k . h . . . h .',
    leadVol: 0.13, bassVol: 0.2, arpVol: 0.035, drumVol: 0.07,
  },
  // Slow and uneasy, in D minor.
  marsh: {
    bpm: 72,
    lead: [
      'D5 - - - F5 - E5 -', 'D5 - A4 - - - . .', 'A#4 - - A4 G4 - A4 -', 'E4 - - - . . . .',
      'D5 - F5 - A5 - G5 F5', 'C5 - - A4 F4 - . .', 'G4 - A#4 - D5 - C5 A#4', 'A4 - - - C#5 - E5 -',
      'F5 - D5 - A#4 - D5 -', 'C5 - A4 - F4 - A4 -', 'D5 - A#4 - G4 - A#4 -', 'A4 - - - F4 - - -',
      'F5 - G5 - F5 - D5 -', 'E5 - C5 - A4 - C5 -', 'C#5 - E5 - A4 - - -', 'D5 - - - . . . .',
    ],
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'F', 'Gm', 'A', 'Bb', 'F', 'Gm', 'Dm', 'Bb', 'F', 'A', 'Dm'],
    bass: '1 - - - 5 - - -',
    arp: '1 . 3 . 2 . 3 .',
    drums: 'k . . . . . h .',
    leadVol: 0.11, bassVol: 0.22, arpVol: 0.04, drumVol: 0.06,
  },
  // Quiet and glassy, in A minor: sparse notes over a soft ringing arpeggio.
  snow: {
    bpm: 80,
    lead: [
      'E5 - - D5 C5 - B4 -', 'A4 - - - E4 - . .', 'F4 - A4 - C5 - B4 A4', 'G4 - - - . . . .',
      'C5 - E5 - G5 - E5 D5', 'C5 - G4 - - - . .', 'D5 - E5 F5 - E5 D5 -', 'B4 - - - G#4 - B4 -',
      'A4 - C5 - E5 - A5 -', 'G5 - E5 - C5 - . .', 'F5 - E5 D5 - C5 D5 -', 'E5 - - - . . . .',
      'A5 - G5 - E5 - D5 -', 'C5 - D5 - E5 - C5 -', 'B4 - A4 - G#4 - B4 -', 'A4 - - - . . . .',
    ],
    chords: ['Am', 'Am', 'F', 'G', 'C', 'C', 'Dm', 'E', 'Am', 'C', 'F', 'C', 'F', 'C', 'E', 'Am'],
    bass: '1 - - - 5 - - -',
    arp: '3 . 2 . 3 1 2 .',
    drums: '. . h . . . h .',
    leadVol: 0.11, bassVol: 0.18, arpVol: 0.045, drumVol: 0.04,
  },
  // Heavy and restless, in D minor: low stabs under a slow, smouldering tune.
  volcano: {
    bpm: 104,
    lead: [
      'D5 - - F5 E5 - D5 -', 'A4 - - - C5 - A4 -', 'A#4 - D5 - F5 - E5 D5', 'E5 - - - A4 - . .',
      'F5 - E5 D5 - C5 D5 -', 'A4 - - - . . A4 C5', 'D5 - F5 - A5 - G5 F5', 'E5 - C#5 - A4 - . .',
      'A5 - G5 F5 - E5 F5 -', 'D5 - - - F5 - D5 -', 'A#4 - C5 D5 - E5 F5 -', 'G5 - E5 - C5 - . .',
      'F5 - D5 - A#4 - D5 -', 'C5 - A4 - - - C5 -', 'E5 - C#5 - A4 - C#5 E5', 'D5 - - - . . . .',
    ],
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'F', 'Gm', 'A', 'Dm', 'Dm', 'Bb', 'C', 'Bb', 'F', 'A', 'Dm'],
    bass: '1 . 1 . 1 8 5 .',
    arp: '1 . 2 . 3 . 2 .',
    drums: 'k . h . k k h .',
    leadVol: 0.11, bassVol: 0.24, arpVol: 0.035, drumVol: 0.1,
  },
  // Fast and driving, in A minor.
  // The hub city (owner 2026-11-22): warm and easy-going, in F major.
  town: {
    bpm: 84,
    lead: [
      'F4 - A4 C5 - A4 G4 -', 'E4 - G4 C5 - - . .', 'D5 - C5 A4 - F4 A4 -', 'A#4 - - - G4 - . .',
      'A4 - C5 F5 - E5 D5 -', 'C5 - A4 F4 - G4 A4 -', 'A#4 - A4 G4 - E4 G4 -', 'F4 - - - . . . .',
    ],
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'Am', 'Gm', 'F'],
    bass: '1 - 5 - 1 - 5 -',
    arp: '1 3 2 3 1 3 2 3',
    drums: 'k . h . s . h .',
    leadVol: 0.11, bassVol: 0.18, arpVol: 0.03, drumVol: 0.05,
  },
  // Each room boss's own fight (owner 2026-11-22): it speeds up when the boss rages or the Heart changes phase.
  // Forest Bear: heavy and stomping, in E minor.
  boss_bear: {
    bpm: 140,
    lead: [
      'E5 - E5 G5 - E5 D5 B4', 'E5 - - B4 - G4 A4 B4', 'C5 - C5 E5 - G5 E5 C5', 'D5 - F#5 - A5 - F#5 D5',
      'E5 G5 B5 G5 - E5 G5 -', 'B5 - A5 G5 - F#5 E5 -', 'C5 - E5 G5 - A5 G5 E5', 'D#5 - F#5 - B5 - - -',
    ],
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'],
    bass: '1 1 5 1 8 1 5 1',
    arp: '1 2 3 2 1 2 3 2',
    drums: 'k . s k k . s .',
    leadVol: 0.12, bassVol: 0.24, arpVol: 0.03, drumVol: 0.15,
  },
  // Bog Witch: eerie and lurching, in D minor.
  boss_witch: {
    bpm: 128,
    lead: [
      'D5 - F5 - A5 - G#5 -', 'A5 - - - F5 - D5 -', 'A#4 - D5 - F5 - E5 D5', 'C#5 - E5 - A5 - - -',
      'D5 F5 A5 D6 - C6 A#5 A5', 'G5 - A#5 - D5 - G5 -', 'E5 - C#5 - A4 - C#5 E5', 'D5 - - - . . . .',
    ],
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'A', 'Dm'],
    bass: '1 - 5 - 1 5 8 5',
    arp: '3 1 2 1 3 1 2 1',
    drums: 'k . h s . k h s',
    leadVol: 0.12, bassVol: 0.22, arpVol: 0.035, drumVol: 0.12,
  },
  // Yeti: cold and driving, in A minor.
  boss_yeti: {
    bpm: 146,
    lead: [
      'A5 - E5 A5 - C6 B5 A5', 'F5 - A5 C6 - A5 F5 -', 'G5 - E5 C5 - E5 G5 -', 'G5 - B5 D6 - B5 G5 -',
      'A5 C6 A5 E5 - A5 E5 C5', 'F5 A5 F5 C5 - F5 A5 C6', 'B5 - G#5 E5 - G#5 B5 -', 'E6 - - - B5 - G#5 -',
    ],
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'E', 'E'],
    bass: '1 8 1 8 5 8 1 8',
    arp: '1 2 3 2 1 2 3 2',
    drums: 'k h s h k h s s',
    leadVol: 0.12, bassVol: 0.22, arpVol: 0.03, drumVol: 0.13,
  },
  // Volcano Heart: fast and burning, in C minor.
  boss_heart: {
    bpm: 160,
    lead: [
      'C5 - D#5 G5 - D#5 C5 G4', 'C5 D#5 G5 C6 - G5 D#5 -', 'G#5 - G5 F5 - D#5 F5 -', 'A#5 - G#5 G5 - F5 D#5 -',
      'C6 - G5 D#5 C5 - D#5 G5', 'F5 - G#5 C6 - G#5 F5 -', 'G5 - B5 D6 - B5 G5 F5', 'D#5 - D5 - B4 - G4 -',
    ],
    chords: ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Fm', 'G', 'G'],
    bass: '1 1 8 1 1 8 5 8',
    arp: '1 2 3 2 1 2 3 2',
    drums: 'k k s h k k s k',
    leadVol: 0.12, bassVol: 0.24, arpVol: 0.03, drumVol: 0.15,
  },
  // Field bosses and anything without a track of its own.
  boss: {
    bpm: 152,
    lead: [
      'A4 - A4 C5 - A4 E5 -', 'D5 C5 B4 A4 - G4 A4 -', 'F5 - E5 D5 - C5 D5 -', 'D5 - B4 G4 - B4 D5 -',
      'A5 - G5 E5 - C5 E5 -', 'A5 G5 E5 C5 - A4 C5 -', 'F5 - A5 F5 D5 - F5 -', 'E5 - G#5 - B5 - G#5 E5',
    ],
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'Dm', 'E'],
    bass: '1 8 1 8 1 8 5 8',
    arp: '3 2 1 2 3 2 1 2',
    drums: 'k h s h k k s h',
    leadVol: 0.13, bassVol: 0.22, arpVol: 0.03, drumVol: 0.13,
  },
};

const NOTE = /^([A-G])(#?)(\d)$/;
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midi(note: string): number {
  const m = NOTE.exec(note);
  if (!m) throw new Error(`Bad note in music data: ${note}`);
  return SEMI[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12;
}

const hz = (n: number): number => 440 * 2 ** ((n - 69) / 12);

interface Note { step: number; midi: number; len: number }
interface Compiled { def: TrackDef; total: number; lead: Note[]; bass: Note[]; arp: Note[]; drums: string[] }

function parseLine(tokens: string[], offset: number, into: Note[]): void {
  tokens.forEach((tok, i) => {
    if (tok === '-') {
      if (into.length && into[into.length - 1].step + into[into.length - 1].len === offset + i) into[into.length - 1].len++;
    } else if (tok !== '.') into.push({ step: offset + i, midi: midi(tok), len: 1 });
  });
}

function compile(def: TrackDef): Compiled {
  const lead: Note[] = [];
  const bass: Note[] = [];
  const arp: Note[] = [];
  const drums: string[] = [];
  def.lead.forEach((bar, b) => parseLine(bar.split(' '), b * 8, lead));
  def.chords.forEach((name, b) => {
    const [root, fifth, a, c, e] = CHORDS[name];
    const up = (n: string) => n.replace(/\d/, (d) => String(Number(d) + 1));
    const bassMap: Record<string, string> = { 1: root, 5: fifth, 8: up(root), '-': '-', '.': '.' };
    parseLine(def.bass.split(' ').map((t) => bassMap[t]), b * 8, bass);
    const arpMap: Record<string, string> = { 1: a, 2: c, 3: e, '-': '-', '.': '.' };
    parseLine(def.arp.split(' ').map((t) => arpMap[t]), b * 8, arp);
    drums.push(...def.drums.split(' '));
  });
  return { def, total: def.lead.length * 8, lead, bass, arp, drums };
}

const COMPILED = Object.fromEntries((Object.keys(TRACKS) as TrackId[]).map((id) => [id, compile(TRACKS[id])])) as Record<TrackId, Compiled>;

const FADE_OUT = 0.9;
/** Longest we stay on the old track while a song file loads, before the wanted chiptune plays meanwhile. */
const SONG_WAIT_MS = 3000;
const LOOK_AHEAD = 0.4;
const TICK_MS = 100;

/** A 25% pulse wave, the classic chiptune lead. */
function pulseWave(ctx: AudioContext): PeriodicWave {
  const n = 16;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 1; i < n; i++) im[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * 0.25);
  return ctx.createPeriodicWave(re, im);
}

class MusicPlayer {
  private wanted: TrackId | null = null;
  private song: BossSong | null = null;
  private songAsked = 0;
  private tempo = 1;
  private playing: TrackId | BossSong | null = null;
  /** The looping song file and its /admin loudness, while one is playing. */
  private file: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private out: GainNode | null = null;
  private pulse: PeriodicWave | null = null;
  private step = 0;
  private nextT = 0;
  private timer: number | null = null;

  /**
   * Fades to this track. It starts as soon as sound is allowed.
   * `tempo` speeds the track up (1 = as written), e.g. when a boss rages. `song` is a file to loop instead:
   * `id` still plays if that file can't be had. Tempo never touches a file.
   */
  play(id: TrackId, tempo = 1, song: BossSong | null = null): void {
    if (song !== this.song) this.songAsked = Date.now();
    this.song = song;
    this.wanted = id;
    this.tempo = tempo;
    this.timer ??= window.setInterval(() => this.tick(), TICK_MS);
  }

  /** Which track is sounding now, for tests and debugging. */
  get current(): TrackId | BossSong | null {
    return this.playing;
  }

  private tick(): void {
    const ctx = audioEngine.ctx;
    if (!ctx || !audioEngine.running || !this.wanted) return;
    const buffer = songFiles.get(ctx, this.song);
    let next: TrackId | BossSong = buffer ? this.song! : this.wanted;
    // Still loading: stay on what is playing for a moment, rather than flash another chiptune first.
    if (this.playing && songFiles.loading(this.song) && Date.now() - this.songAsked < SONG_WAIT_MS) next = this.playing;
    if (this.playing !== next) this.begin(ctx, next, buffer);
    if (this.file) {
      this.file.gain.gain.setTargetAtTime(currentBalance().audio.music.gain, ctx.currentTime, 0.05);
      return;
    }
    const track = COMPILED[this.playing as TrackId];
    const stepDur = 60 / (track.def.bpm * this.tempo) / 2;
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + LOOK_AHEAD) {
      this.schedule(ctx, track, this.step, this.nextT, stepDur);
      this.step = (this.step + 1) % track.total;
      this.nextT += stepDur;
    }
  }

  private begin(ctx: AudioContext, id: TrackId | BossSong, buffer: AudioBuffer | null): void {
    const old = this.out;
    if (old) {
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
      old.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT);
      // A song stops by the audio clock, so it also ends right if the tab is hidden mid-fade.
      this.file?.src.stop(ctx.currentTime + FADE_OUT);
      window.setTimeout(() => old.disconnect(), (FADE_OUT + LOOK_AHEAD + 0.5) * 1000);
    }
    const out = ctx.createGain();
    const t = ctx.currentTime + (old ? FADE_OUT * 0.5 : 0);
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(1, t + 0.6);
    out.connect(audioEngine.musicBus!);
    this.out = out;
    this.playing = id;
    this.step = 0;
    this.nextT = t;
    this.pulse ??= pulseWave(ctx);
    this.file = null;
    if (id in COMPILED) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = currentBalance().audio.music.gain;
    src.connect(gain);
    gain.connect(out);
    src.start(t);
    this.file = { src, gain };
  }

  private schedule(ctx: AudioContext, track: Compiled, step: number, t: number, stepDur: number): void {
    const d = track.def;
    for (const n of track.lead) if (n.step === step) this.note(ctx, 'pulse', n, t, stepDur, d.leadVol);
    for (const n of track.bass) if (n.step === step) this.note(ctx, 'triangle', n, t, stepDur, d.bassVol);
    for (const n of track.arp) if (n.step === step) this.note(ctx, 'square', n, t, stepDur, d.arpVol);
    const hit = track.drums[step];
    if (hit !== '.') this.drum(ctx, hit, t, d.drumVol);
  }

  private note(ctx: AudioContext, type: 'pulse' | OscillatorType, n: Note, t: number, stepDur: number, vol: number): void {
    const dur = n.len * stepDur * 0.92;
    const o = ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(this.pulse!);
    else o.type = type;
    o.frequency.value = hz(n.midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.startNode(o, g, t, dur);
  }

  private drum(ctx: AudioContext, kind: string, t: number, vol: number): void {
    const g = ctx.createGain();
    if (kind === 'k') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.1);
      g.gain.setValueAtTime(vol * 2.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      this.startNode(o, g, t, 0.13);
      return;
    }
    const dur = kind === 's' ? 0.11 : 0.035;
    const src = ctx.createBufferSource();
    src.buffer = audioEngine.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = kind === 's' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 's' ? 1900 : 7000;
    src.connect(f);
    g.gain.setValueAtTime(kind === 's' ? vol * 1.7 : vol * 0.65, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g);
    g.connect(this.out!);
    src.onended = () => g.disconnect();
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.01);
  }

  private startNode(o: OscillatorNode, g: GainNode, t: number, dur: number): void {
    o.connect(g);
    g.connect(this.out!);
    o.onended = () => g.disconnect();
    o.start(t);
    o.stop(t + dur + 0.01);
  }
}

export const music = new MusicPlayer();
