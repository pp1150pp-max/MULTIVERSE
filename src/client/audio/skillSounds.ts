// Every player skill's own cast sound (owner 2026-11-22, docs/systems/audio.md), keyed by skill id: GameAudio plays the
// one named by the cast's `anim` event. Built from a few shared pieces (blade swish, thud, clang, fire, ice, zap, shot...)
// with each skill's own mix, pitch and timing. All synthesised, like sfx.ts. Group: "skill".
import type { Sound, Voice } from './sfx';

type Make = (s: Voice) => void;
const snd = (gap: number, make: Make): Sound => ({ gap, group: 'skill', make });

// ---------------------------------------------------------------- pieces
/** A blade cutting the air; `hi` is the top of the sweep. */
const swish = (s: Voice, at = 0, hi = 4200, dur = 0.13, vol = 0.3): void => s.noise(hi * 0.33, hi, dur, vol, at);
/** A heavy blow on the ground. */
const thud = (s: Voice, at = 0, f = 110, vol = 0.5, dur = 0.35): void => {
  s.tone('triangle', f, f * 0.3, dur, vol, at);
  s.noise(900, 90, dur + 0.05, vol * 0.8, at, 0.6, 'lowpass');
};
/** Metal ringing. */
const clang = (s: Voice, at = 0, f = 1800, vol = 0.1): void => {
  s.tone('square', f, f * 0.96, 0.18, vol, at);
  s.tone('triangle', f * 1.5, f * 1.45, 0.28, vol * 0.9, at);
  s.noise(5000, 2500, 0.05, 0.24, at, 2);
};
/** Notes one after another. */
const notes = (s: Voice, fs: number[], step = 0.07, type: OscillatorType = 'triangle', vol = 0.12, dur = 0.22, at = 0): void =>
  fs.forEach((f, i) => s.tone(type, f, f, dur, vol, at + i * step));
const whoosh = (s: Voice, at = 0, f0 = 500, f1 = 2600, dur = 0.25, vol = 0.26): void => s.noise(f0, f1, dur, vol, at, 0.9);
const fire = (s: Voice, at = 0, dur = 0.35, vol = 0.3): void => {
  s.noise(300, 1400, dur, vol, at, 0.8);
  s.tone('sawtooth', 140, 300, dur * 0.8, 0.08, at);
};
const ice = (s: Voice, at = 0, base = 1760, vol = 0.1): void => {
  [1, 1.19, 1.5, 1.78].forEach((m, i) => s.tone('triangle', base * m, base * m * 0.94, 0.35 - i * 0.04, vol, at + i * 0.04));
  s.noise(5200, 1600, 0.4, 0.14, at, 0.8, 'highpass');
};
const zap = (s: Voice, at = 0, vol = 0.22): void => {
  for (let i = 0; i < 3; i++) s.noise(6000, 1800, 0.05, vol, at + i * 0.035, 3);
  s.tone('square', 1400, 180, 0.16, 0.07, at);
};
/** Poison: a hiss with bubbles. */
const hiss = (s: Voice, at = 0, dur = 0.5, vol = 0.2): void => {
  s.noise(2400, 1100, dur, vol, at, 0.7);
  [0.05, 0.17, 0.29].forEach((d) => s.tone('sine', 320, 620, 0.07, 0.11, at + d));
};
const arcane = (s: Voice, at = 0, f0 = 520, f1 = 1200, dur = 0.2, vol = 0.2): void => {
  s.tone('triangle', f0, f1, dur, vol, at);
  s.tone('sine', f0 * 2, f1 * 2, dur * 0.8, vol * 0.3, at);
};
/** Dark magic: a falling hum and a breath. */
const dark = (s: Voice, at = 0, dur = 0.45, vol = 0.18): void => {
  s.tone('sine', 380, 90, dur, vol, at);
  s.noise(3000, 600, dur, 0.1, at, 0.8, 'highpass');
};
const shot = (s: Voice, at = 0, pitch = 1, vol = 0.42): void => {
  s.noise(3000 * pitch, 780 * pitch, 0.09, vol, at, 0.8);
  s.tone('square', 480 * pitch, 110 * pitch, 0.07, 0.1, at);
};
/** A gun's mechanism (cocking, a magazine, a switch). */
const click = (s: Voice, at = 0, f = 4200, vol = 0.28): void => s.noise(f, f * 0.6, 0.035, vol, at, 2.5);
const beep = (s: Voice, at = 0, f = 1800, vol = 0.07): void => s.tone('square', f, f, 0.06, vol, at);
const boom = (s: Voice, at = 0, f = 150, vol = 0.5): void => {
  s.tone('triangle', f, f * 0.25, 0.4, vol, at);
  s.noise(1500, 130, 0.45, vol, at, 0.6, 'lowpass');
};
/** A rising buff fanfare. */
const buff = (s: Voice, fs: number[], type: OscillatorType = 'square', vol = 0.07): void => notes(s, fs, 0.07, type, vol, 0.2);
/** A war cry: a rough voice-like sweep. */
const shout = (s: Voice, at = 0, vol = 0.14): void => {
  s.tone('sawtooth', 150, 240, 0.4, vol, at);
  s.tone('square', 300, 380, 0.35, vol * 0.4, at);
  s.noise(900, 1600, 0.35, 0.12, at, 1);
};
const rocket = (s: Voice, at = 0, vol = 0.24): void => {
  s.noise(400, 2600, 0.5, vol, at, 0.7);
  s.tone('sawtooth', 120, 320, 0.45, 0.06, at);
};

// ---------------------------------------------------------------- sword
const SWORD = {
  sw_heavyslash: snd(200, (s) => { s.noise(700, 3000, 0.2, 0.36); thud(s, 0.06, 130, 0.28, 0.25); }),
  sw_sunder: snd(200, (s) => { swish(s, 0, 3600, 0.15, 0.32); clang(s, 0.07, 1300, 0.09); }),
  sw_swordwave: snd(200, (s) => { swish(s, 0, 4600); whoosh(s, 0.05, 900, 4200, 0.45, 0.24); }),
  sw_execute: snd(200, (s) => { swish(s, 0, 3800); swish(s, 0.12, 3000, 0.16, 0.36); thud(s, 0.15, 100, 0.3, 0.3); }),
  sw_flurry: snd(200, (s) => { for (let i = 0; i < 5; i++) swish(s, i * 0.06, 3200 + i * 300, 0.1, 0.24); }),
  sw_bladering: snd(200, (s) => { for (let i = 0; i < 6; i++) swish(s, i * 0.05, 3000 + (i % 2) * 1200, 0.12, 0.22); clang(s, 0.3, 2200, 0.06); }),
  sw_crush: snd(200, (s) => { swish(s, 0, 2400, 0.14, 0.26); thud(s, 0.1, 120, 0.6, 0.45); s.noise(3000, 900, 0.12, 0.2, 0.1, 1); }),
  sw_unleash: snd(300, (s) => { s.tone('sawtooth', 90, 420, 0.55, 0.12); s.noise(300, 2400, 0.55, 0.18, 0, 0.8); boom(s, 0.55, 160, 0.45); }),
  sw_judgement: snd(300, (s) => { notes(s, [1047, 1319, 1568], 0.06, 'triangle', 0.08, 0.3); whoosh(s, 0.1, 3000, 400, 0.35, 0.22); boom(s, 0.4, 130, 0.6); }),
  sw_triple: snd(150, (s) => { swish(s, 0, 3600); swish(s, 0.15, 4000); swish(s, 0.3, 3000, 0.18, 0.38); }),
  sw_backstep: snd(200, (s) => { whoosh(s, 0, 2200, 700, 0.22, 0.24); swish(s, 0.06, 4000); }),
  sw_hunt: snd(200, (s) => { whoosh(s, 0, 500, 3000, 0.25, 0.26); swish(s, 0.18, 4200, 0.13, 0.32); }),
  sw_spindodge: snd(200, (s) => { whoosh(s, 0, 700, 3200, 0.3, 0.24); swish(s, 0.08, 3600, 0.12, 0.22); swish(s, 0.18, 4000, 0.12, 0.22); }),
  sw_bladedance: snd(200, (s) => { for (let i = 0; i < 6; i++) swish(s, i * 0.07, [3400, 4400, 3800][i % 3], 0.11, 0.24); }),
  sw_shadowstep: snd(200, (s) => { dark(s, 0, 0.3, 0.16); swish(s, 0.12, 4400, 0.13, 0.32); }),
  sw_overdrive: snd(300, (s) => { buff(s, [262, 330, 392, 523], 'sawtooth', 0.06); s.noise(200, 900, 0.5, 0.16, 0, 0.7, 'lowpass'); }),
  sw_shadowswap: snd(200, (s) => { dark(s, 0, 0.4, 0.18); whoosh(s, 0.1, 3000, 600, 0.3, 0.2); }),
  sw_thousandcuts: snd(300, (s) => { dark(s, 0, 0.3, 0.12); for (let i = 0; i < 10; i++) swish(s, 0.05 + i * 0.05, 3200 + (i % 3) * 600, 0.08, 0.2); }),
  sw_armorbash: snd(200, (s) => { clang(s, 0, 900, 0.12); thud(s, 0.02, 120, 0.35, 0.25); }),
  sw_taunt: snd(300, (s) => { shout(s, 0, 0.15); clang(s, 0.05, 1100, 0.05); }),
  sw_guard: snd(300, (s) => { clang(s, 0, 1000, 0.12); notes(s, [196, 262], 0.08, 'triangle', 0.12, 0.35, 0.05); }),
  sw_shockwave: snd(200, (s) => { thud(s, 0, 100, 0.5, 0.4); whoosh(s, 0.05, 300, 1800, 0.4, 0.24); }),
  sw_thorns: snd(300, (s) => { clang(s, 0, 2400, 0.08); for (let i = 0; i < 3; i++) click(s, 0.08 + i * 0.05, 5200, 0.22); }),
  sw_anchor: snd(300, (s) => { thud(s, 0, 75, 0.6, 0.5); clang(s, 0.05, 700, 0.08); }),
  sw_warcry: snd(300, (s) => { shout(s, 0, 0.16); buff(s, [262, 392, 523], 'square', 0.06); }),
  sw_cataclysm: snd(300, (s) => { [0, 0.22, 0.44].forEach((d, i) => thud(s, d, 100 - i * 15, 0.55, 0.45)); s.noise(1200, 200, 0.3, 0.2, 0.05); }),
  sw_unbreakable: snd(300, (s) => { clang(s, 0, 800, 0.1); buff(s, [196, 262, 330, 392], 'triangle', 0.12); s.tone('sine', 60, 60, 0.8, 0.2); }),
};

// ---------------------------------------------------------------- mage
const MAGE = {
  mg_arcanelance: snd(150, (s) => { arcane(s, 0, 600, 1800, 0.18, 0.22); whoosh(s, 0, 2000, 6000, 0.22, 0.18); }),
  mg_chainlightning: snd(150, (s) => { zap(s, 0, 0.24); zap(s, 0.1, 0.16); }),
  mg_manaburst: snd(150, (s) => { s.tone('triangle', 1200, 300, 0.3, 0.2); s.noise(2000, 300, 0.35, 0.3, 0, 0.8); }),
  mg_flamewave: snd(200, (s) => { fire(s, 0, 0.55, 0.34); whoosh(s, 0, 300, 1200, 0.5, 0.18); }),
  mg_volatileorb: snd(200, (s) => { arcane(s, 0, 300, 600, 0.6, 0.12); s.tone('sine', 140, 180, 0.6, 0.14); }),
  mg_crystalrain: snd(200, (s) => { for (let i = 0; i < 5; i++) ice(s, i * 0.09, 2400 - i * 180, 0.06); }),
  mg_chargedblast: snd(300, (s) => { s.tone('sine', 200, 1200, 0.8, 0.14); s.noise(400, 3000, 0.8, 0.12, 0, 0.8); }),
  mg_starfall: snd(300, (s) => { notes(s, [2093, 1760, 1568, 1319, 1175], 0.08, 'triangle', 0.08, 0.3); s.noise(6000, 3000, 0.6, 0.08, 0, 0.8, 'highpass'); }),
  mg_flameground: snd(200, (s) => { fire(s, 0, 0.5, 0.3); for (let i = 0; i < 4; i++) click(s, 0.1 + i * 0.08, 3000, 0.14); }),
  mg_poisonmist: snd(200, (s) => hiss(s, 0, 0.6, 0.22)),
  mg_searingmark: snd(200, (s) => { arcane(s, 0, 700, 1400, 0.16, 0.18); fire(s, 0.05, 0.2, 0.18); }),
  mg_decayring: snd(200, (s) => { dark(s, 0, 0.6, 0.16); hiss(s, 0.1, 0.4, 0.12); }),
  mg_thunderstorm: snd(300, (s) => { s.noise(300, 90, 0.8, 0.3, 0, 0.6, 'lowpass'); zap(s, 0.2, 0.18); }),
  mg_crystalspikes: snd(200, (s) => { ice(s, 0, 1400, 0.1); for (let i = 0; i < 3; i++) click(s, 0.05 + i * 0.06, 5000, 0.2); }),
  mg_cursedash: snd(200, (s) => { s.noise(400, 1800, 0.45, 0.3, 0, 0.7); dark(s, 0, 0.4, 0.12); }),
  mg_hexseed: snd(200, (s) => { dark(s, 0, 0.35, 0.16); s.tone('triangle', 900, 300, 0.12, 0.14, 0.15); }),
  mg_firerain: snd(300, (s) => { fire(s, 0, 0.8, 0.3); s.noise(200, 80, 0.8, 0.3, 0, 0.6, 'lowpass'); }),
  mg_decayfield: snd(300, (s) => { dark(s, 0, 0.8, 0.2); hiss(s, 0.1, 0.7, 0.14); s.tone('sine', 55, 50, 0.9, 0.2); }),
  mg_forcewave: snd(200, (s) => { thud(s, 0, 140, 0.35, 0.3); whoosh(s, 0, 400, 3000, 0.4, 0.3); }),
  mg_frailcurse: snd(200, (s) => { notes(s, [622, 523, 440], 0.09, 'triangle', 0.1, 0.3); dark(s, 0, 0.4, 0.12); }),
  mg_icecage: snd(200, (s) => { ice(s, 0, 1600, 0.1); clang(s, 0.05, 1100, 0.06); }),
  mg_gravitywell: snd(300, (s) => { s.tone('sine', 900, 60, 0.9, 0.2); s.noise(1200, 120, 0.9, 0.2, 0, 0.7, 'lowpass'); }),
  mg_sealveil: snd(300, (s) => { notes(s, [784, 988, 1175], 0.05, 'sine', 0.1, 0.4); s.noise(6000, 2500, 0.5, 0.1, 0, 0.8, 'highpass'); }),
  mg_empowerfield: snd(300, (s) => buff(s, [392, 523, 659, 784], 'triangle', 0.12)),
  mg_manashield: snd(300, (s) => { notes(s, [523, 784, 1047], 0.06, 'sine', 0.12, 0.45); s.noise(5000, 2000, 0.4, 0.08, 0, 0.8, 'highpass'); }),
  mg_timewarp: snd(300, (s) => { s.tone('sine', 900, 200, 0.4, 0.16); s.tone('sine', 200, 900, 0.4, 0.16, 0.4); for (let i = 0; i < 4; i++) click(s, i * 0.2, 3000, 0.16); }),
  mg_manawell: snd(300, (s) => { notes(s, [523, 659, 784, 1047], 0.09, 'sine', 0.12, 0.4); [0.1, 0.3].forEach((d) => s.tone('sine', 400, 800, 0.08, 0.1, d)); }),
};

// ---------------------------------------------------------------- gunslinger
const GUN = {
  gs_deadeye: snd(150, (s) => { click(s, 0); shot(s, 0.05, 1.1, 0.38); }),
  gs_aimedshot: snd(200, (s) => { click(s, 0); click(s, 0.08, 3400); s.tone('sine', 800, 1400, 0.3, 0.04, 0.1); shot(s, 0.35, 0.8, 0.5); }),
  gs_ricochet: snd(150, (s) => { shot(s, 0); s.tone('sine', 2600, 1700, 0.18, 0.08, 0.1); }),
  gs_counter: snd(200, (s) => { whoosh(s, 0, 2000, 600, 0.2, 0.22); shot(s, 0.15, 1, 0.42); }),
  gs_weakspot: snd(150, (s) => { click(s, 0, 5000); shot(s, 0.04, 1.2, 0.4); }),
  gs_finisher: snd(200, (s) => { shot(s, 0, 0.75, 0.5); boom(s, 0.02, 120, 0.25); }),
  gs_lockon: snd(200, (s) => { beep(s, 0, 1800); beep(s, 0.1, 1800); beep(s, 0.2, 2400); }),
  gs_sniperfocus: snd(300, (s) => { click(s, 0); s.tone('sine', 700, 1500, 0.5, 0.05, 0.05); beep(s, 0.4, 2200, 0.05); }),
  gs_hotrounds: snd(300, (s) => { click(s, 0); click(s, 0.1, 3200); fire(s, 0.12, 0.3, 0.18); }),
  gs_quickreload: snd(300, (s) => { click(s, 0, 3000); click(s, 0.12, 4400); click(s, 0.22, 3600, 0.34); }),
  gs_doubletap: snd(150, (s) => { shot(s, 0); shot(s, 0.09, 1.05); }),
  gs_shockrounds: snd(300, (s) => { click(s, 0); zap(s, 0.08, 0.16); }),
  gs_stackfire: snd(300, (s) => { click(s, 0); buff(s, [659, 880, 1175], 'square', 0.06); }),
  gs_splitshot: snd(300, (s) => { click(s, 0); [0.08, 0.12, 0.16].forEach((d, i) => s.tone('sine', 2400 + i * 300, 1800, 0.1, 0.06, d)); }),
  gs_piercerounds: snd(300, (s) => { click(s, 0); clang(s, 0.08, 2000, 0.07); }),
  gs_overdrive: snd(300, (s) => { buff(s, [330, 440, 554, 659], 'sawtooth', 0.05); for (let i = 0; i < 3; i++) click(s, i * 0.07, 4000, 0.2); }),
  gs_bulletstorm: snd(300, (s) => { for (let i = 0; i < 6; i++) shot(s, i * 0.06, 1 + (i % 2) * 0.08, 0.32); }),
  gs_explosive: snd(150, (s) => { shot(s, 0, 0.85, 0.45); s.tone('triangle', 200, 120, 0.12, 0.15, 0.02); }),
  gs_incendiary: snd(150, (s) => { shot(s, 0, 0.95); fire(s, 0.03, 0.3, 0.2); }),
  gs_mine: snd(150, (s) => { click(s, 0, 2600, 0.3); beep(s, 0.1, 1500); beep(s, 0.22, 1500); }),
  gs_smoke: snd(200, (s) => { s.tone('triangle', 200, 120, 0.1, 0.2); s.noise(3000, 900, 0.9, 0.22, 0.05, 0.6); }),
  gs_railgun: snd(300, (s) => { s.tone('sawtooth', 300, 2400, 0.45, 0.06); s.noise(6000, 900, 0.2, 0.5, 0.45, 0.8); s.tone('square', 900, 90, 0.25, 0.12, 0.45); }),
  gs_drone: snd(300, (s) => { s.tone('sawtooth', 220, 240, 0.6, 0.05); s.tone('sawtooth', 226, 236, 0.6, 0.04); beep(s, 0.3, 2000); }),
  gs_seeker: snd(200, (s) => { click(s, 0); rocket(s, 0.03); }),
  gs_cluster: snd(200, (s) => { s.tone('triangle', 260, 130, 0.12, 0.3); s.noise(1500, 500, 0.12, 0.3, 0, 0.8); }),
  gs_rocketrain: snd(300, (s) => { for (let i = 0; i < 4; i++) rocket(s, i * 0.1, 0.18); }),
  gs_turret: snd(300, (s) => { clang(s, 0, 700, 0.08); click(s, 0.1); click(s, 0.18, 3400); beep(s, 0.3, 2200); }),
};

export const SKILL_SOUNDS = { ...SWORD, ...MAGE, ...GUN } satisfies Record<string, Sound>;

/** Skills landing, by the effect the server sends ("effect" fx): lightning striking, arcane bursts, stars, blasts. */
export const IMPACT_SOUNDS = {
  hit_zap: snd(70, (s) => zap(s, 0, 0.2)),
  hit_arcane: snd(90, (s) => { s.tone('triangle', 900, 260, 0.22, 0.16); s.noise(2200, 400, 0.25, 0.26, 0, 0.8); }),
  hit_star: snd(70, (s) => { s.tone('triangle', 2093, 1568, 0.18, 0.08); s.noise(3000, 600, 0.2, 0.2, 0, 0.8); }),
  hit_clang: snd(90, (s) => clang(s, 0, 1300, 0.08)),
  hit_curse: snd(150, (s) => dark(s, 0, 0.3, 0.14)),
} satisfies Record<string, Sound>;

/** Effect name → impact sound (the older explosion / crater / impact sounds are in sfx.ts). */
export const IMPACT_OF: Record<string, keyof typeof IMPACT_SOUNDS | 'explosion' | 'crater' | 'impact'> = {
  explosion: 'explosion', crater: 'crater', impact: 'impact',
  mg_lightning: 'hit_zap', mg_burst: 'hit_arcane', mg_starhit: 'hit_star', gs_blast: 'explosion',
  sw_armorhit: 'hit_clang', mg_curse: 'hit_curse',
};
