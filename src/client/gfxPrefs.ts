// The players' own graphics window (owner 2026-11-18, docs/systems/skill-fx-layer.md): particle quality, other
// players' particles, screen shake, the hit freeze and whose damage numbers show. Kept in this browser only
// (localStorage); /admin sets the starting quality, the most anyone can pick, and whether the window shows at all
// (fxLayer.gfxMenu / gfxDefault / gfxMax / gfxMid / gfxLow). Window hidden = everyone on /admin's starting values.
import { currentBalance } from '../shared/balance';
import { shaderLevelFor, type ShaderLevel } from '../shared/fxLayerTuning';

/** 3 high (as the server set it), 2 medium, 1 low, 0 off (no three.quarks, no extra-layer particles). */
export type GfxLevel = 0 | 1 | 2 | 3;
/** Other players' particles: 2 full, 1 half, 0 none. */
export type GfxOthers = 0 | 1 | 2;

interface Prefs {
  /** Left out = /admin's starting quality (so a later change there still reaches players who never picked). */
  quality?: GfxLevel;
  others?: GfxOthers;
  shake?: boolean;
  hitstop?: boolean;
  ownNums?: boolean;
  /** Water, wind and light (docs/systems/shaders.md). Left out = /admin's starting level for this kind of screen. */
  shader?: ShaderLevel;
}

const KEY = 'mv.gfx';
let prefs: Prefs = load();

function load(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Prefs;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** Changes the player's choices (only what is given) and keeps them in this browser. */
export function setGfxPrefs(p: Partial<Prefs>): void {
  prefs = { ...prefs, ...p };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // private window / storage off: the choice lasts until the page closes
  }
}

const cfg = () => currentBalance().fxLayer;
const level = (n: number): GfxLevel => Math.max(0, Math.min(3, Math.round(n))) as GfxLevel;
/** The player's choices count only while /admin shows the window. */
const own = (): Prefs => (cfg().gfxMenu ? prefs : {});

/** Whether the graphics window is in the menu. */
export const gfxMenuOn = (): boolean => cfg().gfxMenu;
/** The most a player can pick (/admin). */
export const gfxMax = (): GfxLevel => level(cfg().gfxMax);
/** The quality in use: the player's pick (or /admin's starting one), never above /admin's most. */
export const gfxQuality = (): GfxLevel => Math.min(level(own().quality ?? cfg().gfxDefault), gfxMax()) as GfxLevel;
/** × particles of the quality in use (high 1, medium gfxMid, low gfxLow, off 0). */
export function gfxParticles(): number {
  const q = gfxQuality();
  return q === 3 ? 1 : q === 2 ? cfg().gfxMid : q === 1 ? cfg().gfxLow : 0;
}
/** The other-players setting as chosen (for the window). */
export const gfxOthersPick = (): GfxOthers => own().others ?? 2;
/** × particles of other players' effects, from the player's choice (on top of /admin's quarksOthers). */
export const gfxOthers = (): number => [0, 0.5, 1][gfxOthersPick()];
export const gfxShakeOn = (): boolean => own().shake ?? true;
export const gfxHitstopOn = (): boolean => own().hitstop ?? true;
/** Only my damage numbers: forced on while /admin's ownNumsOnly is on (others' aren't even sent then). */
export const gfxOwnNumsOnly = (): boolean => cfg().ownNumsOnly || (own().ownNums ?? false);

/** A browser drawing the game on the CPU (Game.checkGpu): the shader effects stay off. */
let softwareRender = false;
export function setSoftwareRender(on: boolean): void {
  softwareRender = on;
}
export const isSoftwareRender = (): boolean => softwareRender;
/** Whether the player plays by touch, asked of the game (touch/device.ts isTouchMode). */
let onTouch = (): boolean => false;
export function setTouchProbe(probe: () => boolean): void {
  onTouch = probe;
}
/** Water, wind and light: the level in use (2 high, 1 low, 0 off). */
export const gfxShader = (): ShaderLevel => shaderLevelFor(cfg(), own().shader, onTouch(), softwareRender);
/** The level the water and the cloud sea are drawn with (0 while /admin's water switch is off). */
export const gfxWater = (): ShaderLevel => (cfg().shWater ? gfxShader() : 0);
/** The level the wind is drawn with (0 while /admin's wind switch is off). */
export const gfxWind = (): ShaderLevel => (cfg().shWind ? gfxShader() : 0);
/** The level the light layer and the mist are drawn with (0 while /admin's light switch is off). */
export const gfxPost = (): ShaderLevel => (cfg().shPost ? gfxShader() : 0);
