// Types shared by the simulation (run by the server) and the browser that shows it.
import type { SkillSlot } from '../data/classes';
import type { Item, Vec2 } from '../types';

/** What a player wants to do this frame. Built from keyboard/mouse or by Auto Play. */
export interface Intent {
  move: Vec2 | null;
  moveTo: Vec2 | null;
  aim: Vec2;
  basic: boolean;
  skills: SkillSlot[];
  dash: boolean;
  potion: 'hp' | 'mp' | null;
  /** One-shot: start casting a return scroll (G key, or a click on the scroll in the bag). */
  recall?: boolean;
  /**
   * Online only: where the client walked its character this frame. The server checks the
   * distance is possible before passing it on; the simulation then uses it instead of `move`/`moveTo`.
   */
  pos?: Vec2 | null;
}

export const IDLE_INTENT: Intent = { move: null, moveTo: null, aim: { x: 0, z: 0 }, basic: false, skills: [], dash: false, potion: null };

export interface HitOpts {
  kb?: number;
  stun?: number;
  slow?: number;
  slowT?: number;
  fromX?: number;
  fromZ?: number;
  /** Extra damage: this share of the player's max HP, added after defense (defense does not lower it). */
  maxHpShare?: number;
  /** Always a critical hit. */
  forceCrit?: boolean;
  /** Cap on the final multiplier after the crit bonus (e.g. 5 = never more than 500% ATK). */
  maxMult?: number;
  /** Lowers the target's defense by this share (0–1) for `armorBreakT` seconds, for every attacker. */
  armorBreak?: number;
  armorBreakT?: number;
  /** Extra crit chance (percentage points) for this hit only. */
  critBonus?: number;
}

/** Visual effects the renderer knows how to draw. The client's Effects class implements this. */
export interface FxApi {
  slash(x: number, z: number, angle: number, arc: number, radius: number, color: string): void;
  ring(x: number, z: number, radius: number, color: string, life?: number): void;
  disc(x: number, z: number, radius: number, color: string, life?: number): void;
  telegraph(x: number, z: number, radius: number, duration: number, color?: string): void;
  lineTelegraph(x: number, z: number, angle: number, length: number, width: number, duration: number): void;
  puff(x: number, y: number, z: number, color: string, life: number, size: number): void;
  burst(x: number, y: number, z: number, color: string, n?: number, speed?: number): void;
  levelUp(x: number, z: number): void;
  meteor(x: number, z: number, duration: number): void;
  /** Hand-drawn skill animation. `size` is its half-width in world units. */
  effect(name: SkillEffect, x: number, z: number, angle: number, size: number): void;
}

export type SkillEffect = 'slash' | 'whirlwind' | 'charge' | 'quake' | 'explosion' | 'frost' | 'crater' | 'muzzle' | 'impact'
  | 'reticle' | 'headshot_hit' | 'enhance_ok' | 'enhance_fail';
export type FxName = keyof FxApi;
/** One-shot sounds with no matching visual event. The client's audio code decides how each one sounds. */
export type SfxName =
  | 'crit' | 'monster_die' | 'boss_die' | 'boss_slam'
  | 'pickup_gold' | 'pickup_item' | 'pickup_potion' | 'drink'
  | 'trade' | 'enhance_ok' | 'enhance_fail'
  | 'headshot_fire';

export type FxEvent = { [K in FxName]: { t: 'fx'; name: K; args: Parameters<FxApi[K]> } }[FxName];

/**
 * Everything the simulation wants shown or told. Entities are referred to by id so the same
 * events can later be sent over the network. `to` = only for that player id (missing = everyone).
 */
export type SimEvent =
  | FxEvent
  | { t: 'text'; x: number; y: number; z: number; text: string; cls: string; life?: number; to?: number }
  /** Screen shake: for one player (`to`), or for players near (x, z). Never the whole zone. */
  | { t: 'shake'; amount: number; to?: number; x?: number; z?: number }
  | { t: 'sfx'; name: SfxName; x: number; z: number; to?: number }
  | { t: 'log'; msg: string; color?: string; to?: number }
  /** Big text across the middle of the screen, for players near x/z (boss phase change). */
  | { t: 'banner'; text: string; sub?: string; color?: string; x: number; z: number }
  /** The zone's boss came back: told to everyone in the zone, wherever they are. */
  | { t: 'bossSpawn'; name: string }
  | { t: 'flash'; id: number }
  /** One-shot animation. `fallback` = play the attack animation if the actor lacks `name`. */
  /** `skill` = the skill cast (its sound), since many skills share one class animation row. */
  | { t: 'anim'; id: number; name: string; duration?: number; fallback?: 'attack'; skill?: string }
  | { t: 'item'; to: number; item: Item }
  | { t: 'inventory'; to: number }
  | { t: 'died'; id: number }
  | { t: 'revived'; id: number }
  /** Something worth saving right away happened to this player (level up, trade, …). */
  | { t: 'save'; to: number }
  /** The player's stash changed (save it, and refresh the stash window). */
  | { t: 'stash'; to: number }
  /** A system line for every player on the server, in every zone (a +10 or higher enhancement). */
  | { t: 'announce'; text: string }
  /** The server switched this player's Auto Play off. */
  | { t: 'autoOff'; to: number; msg: string }
  /** This player walked into a portal. Whoever drives the Sim moves them to that zone. */
  | { t: 'travel'; to: number; zone: string; atCamp?: boolean; spot?: { x: number; z: number } }
  /** This player was moved within the same zone (a return scroll used in the hub): the browser should jump there. */
  | { t: 'warped'; id: number };
