// The second set of sounds (owner 2026-11-22, docs/systems/audio.md): footsteps, windows, drops by rarity, monsters
// swinging at us and spotting us, notices (chat, mail, invites, quests), map ambience, the boss countdown, cash shop
// buys and opening mystery boxes. All synthesised, like sfx.ts.
import type { SfxGroup } from '../../shared/audioTuning';
import type { Sound, Voice } from './sfx';

type Make = (s: Voice) => void;
const snd = (group: SfxGroup, gap: number, make: Make, always = false): Sound => ({ gap, group, always, make });
const notes = (s: Voice, fs: number[], step: number, type: OscillatorType, vol: number, dur: number, at = 0): void =>
  fs.forEach((f, i) => s.tone(type, f, f, dur, vol, at + i * step));

export const EXTRA_SOUNDS = {
  // ---------------- Footsteps (our own character only), by the ground of the map
  step_grass: snd('player', 120, (s) => s.noise(1400, 700, 0.07, 0.1, 0, 0.8)),
  step_mud: snd('player', 120, (s) => { s.noise(600, 250, 0.1, 0.12, 0, 1); s.tone('sine', 180, 320, 0.05, 0.04, 0.03); }),
  step_snow: snd('player', 120, (s) => s.noise(3200, 1800, 0.1, 0.1, 0, 1.5)),
  step_stone: snd('player', 120, (s) => { s.noise(2600, 1200, 0.04, 0.12, 0, 2); s.tone('triangle', 160, 110, 0.04, 0.05); }),
  step_ash: snd('player', 120, (s) => { s.noise(2000, 900, 0.06, 0.1, 0, 1.2); s.noise(4000, 3000, 0.03, 0.04, 0.03, 3); }),

  // ---------------- Windows
  ui_open: snd('ui', 80, (s) => { s.noise(1800, 4200, 0.08, 0.1, 0, 0.9); s.tone('triangle', 660, 880, 0.07, 0.06, 0.02); }),
  ui_close: snd('ui', 80, (s) => { s.noise(4200, 1600, 0.07, 0.09, 0, 0.9); s.tone('triangle', 740, 520, 0.06, 0.05, 0.01); }),

  // ---------------- Things dropping on the ground, by rarity
  drop_gold: snd('player', 90, (s) => { s.tone('square', 2349, 2349, 0.04, 0.04); s.tone('square', 2794, 2794, 0.06, 0.04, 0.04); }),
  drop_item: snd('player', 90, (s) => { s.tone('triangle', 300, 180, 0.08, 0.14); s.noise(1500, 600, 0.06, 0.12, 0, 1); }),
  drop_rare: snd('player', 150, (s) => { s.tone('triangle', 300, 180, 0.08, 0.14); notes(s, [1047, 1319], 0.07, 'triangle', 0.12, 0.25, 0.05); }, true),
  drop_epic: snd('player', 200, (s) => {
    s.tone('triangle', 260, 150, 0.1, 0.16);
    notes(s, [880, 1109, 1319, 1760], 0.07, 'triangle', 0.13, 0.35, 0.05);
    s.noise(6000, 3000, 0.5, 0.06, 0.1, 0.8, 'highpass');
  }, true),
  drop_legend: snd('player', 300, (s) => {
    s.tone('triangle', 220, 110, 0.15, 0.2);
    notes(s, [784, 988, 1175, 1568, 1976], 0.08, 'square', 0.07, 0.4, 0.05);
    notes(s, [392, 494, 587], 0, 'triangle', 0.1, 1.0, 0.45);
    s.noise(7000, 3500, 0.9, 0.07, 0.2, 0.8, 'highpass');
  }, true),

  // ---------------- Monsters
  mob_swing: snd('monster', 140, (s) => s.noise(500, 1900, 0.12, 0.16, 0, 0.9)),
  mob_alert: snd('monster', 350, (s) => { s.tone('sawtooth', 220, 330, 0.09, 0.07); s.tone('sawtooth', 330, 260, 0.1, 0.06, 0.09); }),

  // ---------------- Notices
  notify_chat: snd('ui', 400, (s) => s.tone('sine', 1320, 1320, 0.07, 0.07)),
  notify_whisper: snd('ui', 400, (s) => { s.tone('sine', 1047, 1047, 0.07, 0.08); s.tone('sine', 1568, 1568, 0.1, 0.08, 0.08); }),
  notify_mail: snd('ui', 500, (s) => notes(s, [880, 1175, 1568], 0.08, 'triangle', 0.1, 0.2), true),
  notify_invite: snd('ui', 500, (s) => { notes(s, [784, 988], 0.1, 'square', 0.06, 0.12); notes(s, [784, 988], 0.1, 'square', 0.06, 0.12, 0.3); }, true),
  quest_done: snd('ui', 500, (s) => { notes(s, [523, 659, 784, 1047], 0.09, 'square', 0.07, 0.22); s.tone('triangle', 1319, 1319, 0.4, 0.1, 0.36); }, true),

  // ---------------- Boss room countdown, cash shop, mystery box
  boss_tick: snd('boss', 300, (s) => { s.tone('square', 880, 880, 0.06, 0.08); s.tone('triangle', 110, 70, 0.15, 0.25); }, true),
  cash_buy: snd('player', 300, (s) => { notes(s, [1319, 1760, 2093, 2637], 0.05, 'square', 0.06, 0.14); s.noise(7000, 4000, 0.3, 0.06, 0.1, 0.8, 'highpass'); }, true),
  box_open: snd('player', 300, (s) => {
    s.noise(800, 300, 0.12, 0.2, 0, 0.9);
    s.tone('triangle', 200, 140, 0.1, 0.16);
    notes(s, [659, 784, 1047, 1319], 0.06, 'triangle', 0.1, 0.3, 0.12);
  }, true),

  // ---------------- Map ambience (a few at random while standing in the map)
  amb_bird: snd('ambient', 600, (s) => {
    const f = 2400 + Math.random() * 1400;
    for (let i = 0; i < 3; i++) s.tone('sine', f, f * 1.25, 0.06, 0.05, i * 0.11);
  }),
  amb_leaves: snd('ambient', 600, (s) => s.noise(1800, 3400, 1.6, 0.04, 0, 0.6)),
  amb_frog: snd('ambient', 600, (s) => { s.tone('square', 160, 120, 0.1, 0.05); s.tone('square', 150, 115, 0.12, 0.05, 0.16); }),
  amb_bubble: snd('ambient', 600, (s) => { for (let i = 0; i < 3; i++) s.tone('sine', 260 + i * 60, 520 + i * 90, 0.06, 0.05, i * 0.13); }),
  amb_wind: snd('ambient', 1500, (s) => { s.noise(300, 900, 1.5, 0.07, 0, 1.4); s.noise(900, 400, 1.5, 0.07, 1.5, 1.4); }),
  amb_ice: snd('ambient', 600, (s) => s.tone('triangle', 3136, 2960, 0.3, 0.03)),
  amb_lava: snd('ambient', 600, (s) => { s.tone('sine', 120, 240, 0.12, 0.08); s.noise(400, 150, 0.4, 0.07, 0.05, 0.8, 'lowpass'); }),
  amb_rumble: snd('ambient', 1500, (s) => s.noise(140, 60, 2.2, 0.12, 0, 0.6, 'lowpass')),
  amb_bell: snd('ambient', 1500, (s) => { s.tone('triangle', 784, 780, 1.4, 0.04); s.tone('sine', 1568, 1560, 1.0, 0.02); }),
  amb_chatter: snd('ambient', 1500, (s) => { for (let i = 0; i < 4; i++) s.noise(700 + Math.random() * 500, 900, 0.12, 0.025, i * 0.18, 3); }),
} satisfies Record<string, Sound>;

/** Each map look's ambience: which sounds, and seconds between two of them (min, max). */
export const AMBIENCE: Record<string, { sounds: (keyof typeof EXTRA_SOUNDS)[]; every: [number, number] }> = {
  forest: { sounds: ['amb_bird', 'amb_bird', 'amb_leaves'], every: [2.5, 6] },
  marsh: { sounds: ['amb_frog', 'amb_frog', 'amb_bubble'], every: [2, 5] },
  snow: { sounds: ['amb_wind', 'amb_ice'], every: [3, 7] },
  volcano: { sounds: ['amb_lava', 'amb_lava', 'amb_rumble'], every: [2, 5] },
  town: { sounds: ['amb_chatter', 'amb_bird', 'amb_bell'], every: [4, 9] },
};

/** Footstep sound by map look. */
export const STEP_OF: Record<string, keyof typeof EXTRA_SOUNDS> = {
  forest: 'step_grass', marsh: 'step_mud', snow: 'step_snow', volcano: 'step_ash', town: 'step_stone',
};
