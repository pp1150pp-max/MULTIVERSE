// Each boss's own sounds (owner 2026-11-22, docs/systems/audio.md), keyed by the boss effect the server already sends
// for the move (`fx 'effect'`, BossEffect in src/shared/sim/types.ts): its basic hit, ground slam, rage, jump and
// summon. Spells without a picture of their own (the witch's vial, mud hands and hex, the Heart's waves and beams)
// arrive as named sfx instead (sfx.ts). Group: "boss".
import type { BossEffect } from '../../shared/sim/types';
import type { Sound, Voice } from './sfx';

type Make = (s: Voice) => void;
const snd = (gap: number, make: Make, always = false): Sound => ({ gap, group: 'boss', always, make });

const thud = (s: Voice, at = 0, f = 100, vol = 0.6, dur = 0.45): void => {
  s.tone('triangle', f, f * 0.3, dur, vol, at);
  s.noise(900, 80, dur + 0.05, vol * 0.85, at, 0.6, 'lowpass');
};
const growl = (s: Voice, at = 0, f = 110, dur = 0.3, vol = 0.16): void => {
  s.tone('sawtooth', f, f * 0.72, dur, vol, at);
  s.tone('sawtooth', f * 1.03, f * 0.75, dur, vol * 0.8, at);
};
const iceCrack = (s: Voice, at = 0, vol = 0.1): void => {
  [2200, 2600, 3100].forEach((f, i) => s.tone('triangle', f, f * 0.9, 0.25, vol, at + i * 0.03));
  s.noise(6000, 2000, 0.12, 0.3, at, 1.5);
};
const wind = (s: Voice, at = 0, dur = 0.8, vol = 0.3): void => {
  s.noise(400, 2200, dur * 0.5, vol, at, 1.2);
  s.noise(2200, 600, dur * 0.5, vol, at + dur * 0.5, 1.2);
};
const boom = (s: Voice, at = 0, f = 140, vol = 0.6, dur = 0.5): void => {
  s.tone('triangle', f, f * 0.22, dur, vol, at);
  s.noise(1600, 90, dur + 0.1, vol, at, 0.5, 'lowpass');
};

export const BOSS_SOUNDS = {
  // ---------------- Forest Bear
  boss_bear_claw: snd(200, (s) => { s.noise(500, 2400, 0.18, 0.36, 0, 0.9); growl(s, 0, 120, 0.25, 0.12); }),
  boss_bear_slam: snd(300, (s) => { thud(s, 0, 95, 0.7, 0.5); s.noise(2400, 600, 0.2, 0.24, 0.02); }, true),
  boss_bear_roar: snd(800, (s) => {
    s.tone('sawtooth', 90, 170, 0.35, 0.26);
    s.tone('sawtooth', 170, 70, 0.7, 0.26, 0.35);
    s.tone('sawtooth', 94, 72, 1.0, 0.2);
    s.noise(300, 1200, 1.0, 0.3, 0, 0.7, 'lowpass');
  }, true),
  // ---------------- Bog Witch
  boss_witch_swipe: snd(200, (s) => { s.noise(600, 3000, 0.22, 0.3, 0, 0.8); s.tone('triangle', 660, 330, 0.2, 0.08); }),
  boss_witch_slam: snd(300, (s) => {
    thud(s, 0, 110, 0.55, 0.4);
    [0.12, 0.22, 0.34].forEach((d) => s.tone('sine', 240, 520, 0.08, 0.13, d));
  }, true),
  // A cackle.
  boss_witch_frenzy: snd(800, (s) => {
    [700, 900, 760, 980, 820, 1060].forEach((f, i) => s.tone('square', f, f * 0.85, 0.09, 0.08, i * 0.1));
    s.noise(2400, 900, 0.8, 0.14, 0, 0.7);
  }, true),
  // ---------------- Yeti
  boss_yeti_hit: snd(200, (s) => { thud(s, 0, 140, 0.35, 0.25); iceCrack(s, 0.02, 0.07); }),
  boss_yeti_slam: snd(300, (s) => { thud(s, 0, 90, 0.7, 0.5); iceCrack(s, 0.05, 0.11); }, true),
  boss_yeti_snow: snd(400, (s) => { growl(s, 0, 90, 0.4, 0.14); s.noise(1400, 200, 0.7, 0.4, 0, 0.6, 'lowpass'); }, true),
  boss_yeti_blizzard: snd(400, (s) => { wind(s, 0, 1.2, 0.3); s.noise(6000, 3000, 1.0, 0.08, 0.1, 0.8, 'highpass'); }, true),
  // ---------------- Volcano Heart
  boss_heart_impact: snd(120, (s) => { boom(s, 0, 150, 0.5, 0.4); s.noise(400, 1600, 0.3, 0.22, 0.05, 0.8); }),
  boss_heart_blast: snd(800, (s) => {
    boom(s, 0, 120, 0.85, 1.0);
    s.noise(3000, 200, 0.6, 0.5, 0, 0.6);
    s.noise(300, 1400, 1.0, 0.3, 0.2, 0.7);
  }, true),
} satisfies Record<BossEffect, Sound>;
