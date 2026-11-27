// Types shared by the simulation (run by the server) and the browser that shows it.
import type { SkillDef, SkillSlot } from '../data/classes';
import type { Item, Vec2 } from '../types';
import type { CardId } from '../data/cards';

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
  /** Extra crit chance (percentage points) for this hit only (Gunslinger counter shot, lock-on). */
  critBonus?: number;
  /** Lowers the target's attack by this share (0–1) for `weakT` seconds (strongest wins, a recast refreshes). */
  weak?: number;
  weakT?: number;
  /** The skill this hit comes from (passives can check its line); missing = basic attack or other. */
  skill?: SkillDef;
  /** Damage bounced back (the sword's Thorn Armor): a spike turtle doesn't bounce it again (no endless loop). */
  reflected?: boolean;
  /**
   * Whose extra effects (/admin, sim/extraEffects.ts) this hit gives: a skill id or a basic attack id. Missing = `skill`,
   * else the skill running now (Sim.castingSkill). Only picks the extra effects: passives, visuals and debuff circles
   * do not read it.
   */
  src?: string;
  /** This hit gives no extra effects (the ticks of an extra burn, so they don't feed themselves). */
  noExtra?: boolean;
  /** No element mark or reaction from this hit (a reaction's own hits, sim/elements.ts). */
  noElem?: boolean;
}

/** Visual effects the renderer knows how to draw. The client's Effects class implements this. */
export interface FxApi {
  slash(x: number, z: number, angle: number, arc: number, radius: number, color: string): void;
  ring(x: number, z: number, radius: number, color: string, life?: number): void;
  disc(x: number, z: number, radius: number, color: string, life?: number): void;
  /** `by`, `skill`: tagged by Sim.asCaster when a colour is given (the client's three.quarks particles). */
  telegraph(x: number, z: number, radius: number, duration: number, color?: string, by?: number, skill?: string): void;
  lineTelegraph(x: number, z: number, angle: number, length: number, width: number, duration: number): void;
  puff(x: number, y: number, z: number, color: string, life: number, size: number): void;
  /** `by`, `skill`: tagged by Sim.asCaster (the client's three.quarks particles draw some skills' bursts). */
  burst(x: number, y: number, z: number, color: string, n?: number, speed?: number, by?: number, skill?: string): void;
  /** `by` = the player who levelled up (the client follows them and applies its "others" graphics option). */
  levelUp(x: number, z: number, by?: number): void;
  /** A crystal standing on the ground for `duration` seconds (Crystal Spikes: where its spikes come from). */
  crystal(x: number, z: number, duration: number, color: string): void;
  /** `by` = the caster's id (tagged by Sim.asCaster), so the client can draw other players' lighter. */
  meteor(x: number, z: number, duration: number, by?: number): void;
  /**
   * Hand-drawn skill animation. `size` is its half-width in world units. `by` = the caster's id and `hit` = it hit
   * something: the caster's own screen then feels the hit (fxLayer.ts, owner 2026-11-15).
   */
  effect(name: SkillEffect, x: number, z: number, angle: number, size: number, by?: number, hit?: boolean, skill?: string): void;
  /**
   * A lasting area (fire on the ground, a buff circle…): one row of a skill sheet looping for `duration` seconds with a
   * fade in and out and a soft edge, sent once when the skill is cast. `follow` = a player id it stays centred on.
   */
  /** `follow` may come as null over the wire; `skill` = the skill that made it (its standing layer, zoneProps.ts). */
  zone(name: SkillEffect, x: number, z: number, size: number, duration: number, follow?: number | null, skill?: string, by?: number): void;
  /**
   * A paper effect picture (a SHEET_SPECS key such as fx_shell_guard, fx_shock) standing at (x, z) for `life` seconds,
   * `size` its half-width; `follow` = a unit id it stays on (floor 2's monster moves, sim/beachMoves.ts).
   */
  sprite(key: string, x: number, z: number, size: number, life: number, follow?: number | null): void;
  /** A lightning bolt from one spot to another (the shock eel's chain), fading over `life` seconds. */
  bolt(x1: number, z1: number, x2: number, z2: number, life: number): void;
  /**
   * The Gunslinger's Support Drone (owner 2026-11-19): `duration` > 0 = it appears and flies after player `by` for that
   * long; `duration` 0 with an `angle` = it just fired that way (it turns and kicks back). One message per cast / shot.
   */
  drone(by: number, duration: number, angle?: number): void;
  /**
   * The mage's Warp (class passive, owner 2026-11-27): player `by` vanished at (x1, z1) and stands at (x2, z2) now.
   * The client draws a vanishing ring and an appearing ring in the colours of the worn dash cosmetic.
   */
  warp(x1: number, z1: number, x2: number, z2: number, by: number): void;
}

export type SkillEffect = 'slash' | 'whirlwind' | 'charge' | 'quake' | 'explosion' | 'frost' | 'crater' | 'muzzle' | 'impact'
  | 'reticle' | 'headshot_hit' | 'enhance_ok' | 'enhance_fail'
  // Sword skills (2026-11-15, fx/sw_blade, sw_gale, sw_bulwark). `_red` / `_gold` are tinted copies of a row.
  | 'sw_cleave' | 'sw_cleave_red' | 'sw_wave' | 'sw_bigsword' | 'sw_nova'
  | 'sw_streak' | 'sw_windring' | 'sw_xslash' | 'sw_xslash_gold' | 'sw_aura'
  | 'sw_barrier' | 'sw_shout' | 'sw_crack' | 'sw_armorhit'
  // Mage skills (sheets mg_a / mg_b / mg_c, owner 2026-11-15)
  | 'mg_lightning' | 'mg_burst' | 'mg_starhit' | 'mg_firefield' | 'mg_flamewave' | 'mg_poison' | 'mg_ash' | 'mg_decay'
  | 'mg_shock' | 'mg_curse' | 'mg_vortex' | 'mg_empower' | 'mg_shield' | 'mg_timewarp' | 'mg_frostnova'
  // Gunslinger
  | 'gs_aura_crit' | 'gs_aura_rapid' | 'gs_burn' | 'gs_smoke' | 'gs_mine' | 'gs_drone' | 'gs_turret' | 'gs_blast'
  | 'gs_hawkeye' | 'gs_trigger' | 'gs_special'
  // Bosses' skills (owner 2026-11-21, sheets boss_bear / boss_witch / boss_yeti / boss_heart, art_templates/papercraft_fx/BOSS_FX.md)
  | BossEffect;
/** A boss skill's painted effect; the client adds its code effects on top (src/client/bossFx.ts). */
export type BossEffect = 'boss_bear_claw' | 'boss_bear_slam' | 'boss_bear_roar'
  | 'boss_witch_swipe' | 'boss_witch_slam' | 'boss_witch_frenzy'
  | 'boss_yeti_hit' | 'boss_yeti_slam' | 'boss_yeti_snow' | 'boss_yeti_blizzard'
  | 'boss_heart_impact' | 'boss_heart_blast';
export type FxName = keyof FxApi;
/** One-shot sounds with no matching visual event. The client's audio code decides how each one sounds. */
export type SfxName =
  | 'crit' | 'monster_die' | 'boss_die' | 'boss_slam'
  | 'pickup_gold' | 'pickup_item' | 'pickup_potion' | 'drink'
  | 'trade' | 'enhance_ok' | 'enhance_fail'
  | 'headshot_fire'
  // The mage's Warp (class passive, owner 2026-11-27)
  | 'warp'
  // Bosses (owner 2026-11-22, docs/systems/audio.md)
  | 'boss_arrive' | 'boss_appear' | 'witch_cast' | 'witch_vial' | 'witch_grasp' | 'witch_hex'
  | 'heart_meteor' | 'heart_ring' | 'heart_beam' | 'heart_charge' | 'heart_phase';

export type FxEvent = { [K in FxName]: { t: 'fx'; name: K; args: Parameters<FxApi[K]> } }[FxName];

/**
 * Everything the simulation wants shown or told. Entities are referred to by id so the same
 * events can later be sent over the network. `to` = only for that player id (missing = everyone).
 */
export type SimEvent =
  | FxEvent
  /**
   * Floating text. `by` = the player a damage number belongs to (who dealt it, or who took it) for the "only your own
   * numbers" switch; `on` = the unit it's over, so hits on one target can merge into one number. Both optional (old
   * events and non-damage texts have neither).
   */
  | { t: 'text'; x: number; y: number; z: number; text: string; cls: string; life?: number; to?: number; by?: number; on?: number }
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
  /** A card for a player whose bag had no room (Sim.grantCard): the server mails it. */
  | { t: 'cardMail'; to: number; card: CardId }
  | { t: 'announce'; text: string; /** A banner across everyone's screen (with its heading) instead of a chat line. */ banner?: string }
  /** The server switched this player's Auto Play off. */
  | { t: 'autoOff'; to: number; msg: string }
  /** This player walked into a portal. Whoever drives the Sim moves them to that zone. */
  | { t: 'travel'; to: number; zone: string; atCamp?: boolean; spot?: { x: number; z: number } }
  /** This player was moved within the same zone (a return scroll used in the hub): the browser should jump there. */
  | { t: 'warped'; id: number };
