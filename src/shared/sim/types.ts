// Types shared by the simulation and whoever drives it (the browser in singleplayer, the server online).
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
}

export const IDLE_INTENT: Intent = { move: null, moveTo: null, aim: { x: 0, z: 0 }, basic: false, skills: [], dash: false, potion: null };

export interface HitOpts {
  kb?: number;
  stun?: number;
  slow?: number;
  slowT?: number;
  fromX?: number;
  fromZ?: number;
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
}
export type FxName = keyof FxApi;
export type FxEvent = { [K in FxName]: { t: 'fx'; name: K; args: Parameters<FxApi[K]> } }[FxName];

/**
 * Everything the simulation wants shown or told. Entities are referred to by id so the same
 * events can later be sent over the network. `to` = only for that player id (missing = everyone).
 */
export type SimEvent =
  | FxEvent
  | { t: 'text'; x: number; y: number; z: number; text: string; cls: string; life?: number; to?: number }
  | { t: 'shake'; amount: number }
  | { t: 'log'; msg: string; color?: string; to?: number }
  | { t: 'flash'; id: number }
  /** One-shot animation. `fallback` = play the attack animation if the actor lacks `name`. */
  | { t: 'anim'; id: number; name: string; duration?: number; fallback?: 'attack' }
  | { t: 'item'; to: number; item: Item }
  | { t: 'inventory'; to: number }
  | { t: 'died'; id: number }
  | { t: 'revived'; id: number }
  /** Something worth saving right away happened to this player (level up, trade, …). */
  | { t: 'save'; to: number };
