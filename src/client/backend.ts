// Where the game world comes from: the server runs the simulation, and OnlineBackend (net/online.ts)
// mirrors what it sends. Game, HUD and views only talk to this interface.
import type { Terrain } from '../shared/sim/terrain';
import type { Player, AutoSettings, LootFilter, SortKey } from '../shared/sim/Player';
import type { Monster } from '../shared/sim/Monster';
import type { Loot } from '../shared/sim/Loot';
import type { Intent, SimEvent } from '../shared/sim/types';
import type { ZoneDef } from '../shared/data/zones';
import type { Hazard } from '../shared/sim/volcanoHeart';
import type { NpcId } from '../shared/data/npcs';
import type { EnhanceResult } from '../shared/data/enhance';
import type { EquipSlot, Item, PotionKind, PotionSize, Rarity } from '../shared/types';

/** What a projectile view needs; the local simulation's Projectile fits this too. */
export interface ProjectileLike {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly o: { readonly color: string; readonly size: number; readonly art?: 'ice_shard' | 'snowball' | 'ember_bolt' };
}

export type EnhanceOutcome = { result: EnhanceResult; item: Item } | null;

export interface Backend {
  readonly online: boolean;
  /** Playing a guest character: no stash, deleted after a day offline. */
  readonly guest: boolean;
  readonly zone: ZoneDef;
  readonly terrain: Terrain;
  /** The character this browser controls. */
  readonly me: Player;
  readonly players: readonly Player[];
  readonly monsters: readonly Monster[];
  readonly projectiles: readonly ProjectileLike[];
  readonly loots: readonly Loot[];
  /** Boss ground attacks going on right now. */
  readonly hazards: readonly Hazard[];
  /** Simulation clock (seconds). */
  readonly time: number;
  /** Players in the world right now. */
  readonly onlineCount: number;
  /** Round trip to the server in ms, or null when disconnected or not measured yet. */
  readonly ping: number | null;
  /** Online only: the game loop drew a frame (frame rate and stalls go to the server's lag log). */
  drewFrame?(now: number): void;
  /** Online only: the WebGL renderer (GPU) name, sent once for the server log. */
  reportGpu?(name: string): void;

  /** Advances one frame with this player's input and returns what should be shown. */
  frame(dt: number, intent: Intent): SimEvent[];
  /** Leave the world on purpose (no "disconnected" message). */
  close(): void;

  respawn(): void;
  equip(bagIndex: number, slot?: EquipSlot): void;
  unequip(slot: EquipSlot): void;
  drop(bagIndex: number): void;
  buyPotion(kind: PotionKind, size: PotionSize, n: number): void;
  sortBag(key: SortKey, desc: boolean): void;
  /** Drag & drop between two bag slots (swap, or merge the same potion). */
  moveInBag(from: number, to: number): void;
  /** The server runs Auto Play, so it keeps going in a hidden tab. */
  setAuto(on: boolean): void;
  setLootFilter(f: LootFilter): void;
  setAutoSettings(s: AutoSettings): void;
  sell(bagIndex: number): void;
  /** Buy back entry `i` of the merchant's buyback list (`uid` guards against a list that just changed). */
  buyBack(i: number, uid: string): void;
  sellAllOfRarity(rarity: Rarity): void;
  /** `protect` = use a protection stone if a fail would drop the level. */
  enhance(uid: string, protect: boolean): Promise<EnhanceOutcome>;
  chat(text: string): void;
  npcDistance(id: NpcId): number;

  // Stash (warehouse keeper). The stash itself is `me.stash`. `to` = target slot, or -1 for wherever it fits.
  stashPut(bagIndex: number, to: number): void;
  stashTake(stashIndex: number, to: number): void;
  stashMove(from: number, to: number): void;
  stashSort(key: SortKey, desc: boolean): void;
  stashBuyRow(): void;
  /** amount > 0 deposits gold, < 0 withdraws it. */
  stashGold(amount: number): void;
}
