import type { Sim } from './Sim';
import type { Player } from './Player';
import { BLACKSMITH_STONES, isBossKey, isBuffScroll, isCardStone, isQuestKey, type Item, type PotionKind, type PotionSize, type StoneKind } from '../types';
import type { LootCat } from '../autoTuning';

export type LootKind =
  | { type: 'gold'; amount: number }
  | { type: 'item'; item: Item }
  /** `count` > 1 when a player throws a whole stack on the ground. */
  | { type: 'potion'; pot: PotionKind; size: PotionSize; count: number }
  /** Blacksmith stones (boss drops, or a stack a player threw away). */
  | { type: 'stone'; stone: StoneKind; count: number };

/** The pickup filter category of a drop (owner 2026-11-28); null for gold, which is always picked up. */
export function lootCat(kind: LootKind): LootCat | null {
  switch (kind.type) {
    case 'gold':
      return null;
    case 'item':
      return 'gear';
    case 'potion':
      return 'potion';
    case 'stone':
      return stoneCat(kind.stone);
    default: {
      const unsorted: never = kind;
      return unsorted ? 'other' : null;
    }
  }
}

/** Which pickup category a stone-stack kind belongs to. */
export function stoneCat(k: StoneKind): LootCat {
  if (isCardStone(k)) return 'card';
  if ((BLACKSMITH_STONES as StoneKind[]).includes(k)) return 'stone';
  if (isBossKey(k) || isQuestKey(k)) return 'key';
  if (k === 'return_scroll' || isBuffScroll(k)) return 'scroll';
  if (k === 'mystery_box') return 'box';
  return 'other';
}

/**
 * Drops Auto fetches first, even mid-fight and whatever the loot order (owner 2026-11-25): stones, the mystery box, keys,
 * scrolls, cards and anything else stacked like a stone, but not gold (it drops from nearly every
 * monster). A new loot kind fails the typecheck here until it is sorted into one side (AutoConfig.priorityLoot switches it off).
 * Categories the player unticked in the pickup filter are still skipped (autoMayTake → Player.wantsLoot).
 */
export function isPriorityLoot(kind: LootKind): boolean {
  switch (kind.type) {
    case 'gold':
    case 'item':
    case 'potion':
      return false;
    case 'stone':
      return true;
    default: {
      const unsorted: never = kind;
      return !!unsorted;
    }
  }
}

/** Seconds of the pop-out arc when loot drops; it can't be picked up before it lands. */
export const LOOT_POP_TIME = 0.35;
/** Items the player throws on the ground vanish after this many seconds. */
export const DROPPED_LIFE = 60;
/** Monster drops nobody picks up vanish after this many seconds, so they don't pile up on the server. */
export const DROP_LIFE = 30;
/** The player who did the most damage may pick up a monster's drops alone for this long. */
export const LOOT_PRIORITY_TIME = 10;

export class Loot {
  dead = false;
  /** Seconds since it dropped (the renderer uses it for the pop arc and blinking). */
  t = 0;
  /** Thrown away by a player: auto play ignores it, and it can't be picked up until that player steps away. */
  readonly dropped: boolean;
  private armed: boolean;
  private blockedMsgT = 0;
  /** Player id with pickup priority until `ownerUntil` (simulation time), or null for anyone. */
  owner: number | null;
  /** The owner's party when it dropped: its members on this map share the priority (null = none). */
  ownerParty: number | null;
  ownerUntil: number;
  /** Stays on the ground until the boss room closes (boss drops there). */
  readonly forever: boolean;

  constructor(
    readonly id: number,
    public x: number,
    public z: number,
    readonly fromX: number,
    readonly fromZ: number,
    readonly kind: LootKind,
    opts: { dropped?: boolean; owner?: number; ownerParty?: number | null; ownerUntil?: number; forever?: boolean } = {},
  ) {
    this.forever = !!opts.forever;
    this.dropped = !!opts.dropped;
    this.armed = !this.dropped;
    this.owner = opts.owner ?? null;
    this.ownerParty = opts.ownerParty ?? null;
    this.ownerUntil = opts.ownerUntil ?? 0;
  }

  /** Seconds it stays on the ground before vanishing. */
  get life(): number {
    return this.forever ? Infinity : this.dropped ? DROPPED_LIFE : DROP_LIFE;
  }

  /** Whether this player may pick it up right now: the owner, anyone in the owner's party, or anyone once priority ends. */
  canTake(p: { id: number; partyId: number | null }, time: number): boolean {
    return this.owner === null || this.owner === p.id || (p.partyId !== null && p.partyId === this.ownerParty) || time >= this.ownerUntil;
  }

  update(dt: number, sim: Sim): void {
    this.t += dt;
    this.blockedMsgT -= dt;
    if (this.t > this.life) {
      this.dead = true;
      return;
    }
    if (this.t <= LOOT_POP_TIME + 0.15) return;

    // Goes to the nearest player with room for it; a full bag neither pulls it in nor blocks others.
    let p: Player | null = null;
    let d = Infinity;
    let full: Player | null = null;
    let fd = Infinity;
    for (const pl of sim.players) {
      if (!pl.alive || !this.canTake(pl, sim.time) || !pl.wantsLoot(this.kind, this.dropped)) continue;
      const pd = Math.hypot(pl.x - this.x, pl.z - this.z);
      if (!pl.canFit(this.kind)) {
        if (pd < fd) {
          fd = pd;
          full = pl;
        }
      } else if (pd < d) {
        d = pd;
        p = pl;
      }
    }
    if (!this.armed) {
      if (Math.min(d, fd) > 1.6) this.armed = true;
      return;
    }
    if (full && fd < 0.8 && fd < d && this.blockedMsgT <= 0) {
      sim.text(full.x, full.topY, full.z, this.kind.type === 'item' ? 'กระเป๋าเต็ม' : 'ช่องประเภทใช้งานเต็ม', 'info', undefined, full.id);
      this.blockedMsgT = 2;
    }
    if (!p) return;
    const magnet = this.kind.type === 'item' ? 0 : 2.5;
    if (d < magnet && d > 0.01) {
      const step = Math.min(d, 10 * dt);
      this.x += ((p.x - this.x) / d) * step;
      this.z += ((p.z - this.z) / d) * step;
    }
    if (d < 0.8) {
      if (sim.pickup(p, this)) this.dead = true;
      else if (this.blockedMsgT <= 0) {
        sim.text(p.x, p.topY, p.z, this.kind.type === 'item' ? 'กระเป๋าเต็ม' : 'ช่องประเภทใช้งานเต็ม', 'info', undefined, p.id);
        this.blockedMsgT = 2;
      }
    }
  }
}
