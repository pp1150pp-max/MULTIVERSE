// Where the game world comes from. Singleplayer runs the simulation right here (LocalBackend);
// multiplayer mirrors what the server sends (OnlineBackend in net/online.ts). Game, HUD and views
// only talk to this interface, so both modes look and play the same.
import { Sim } from '../shared/sim/Sim';
import type { Terrain } from '../shared/sim/terrain';
import type { Player, CharacterData } from '../shared/sim/Player';
import type { Monster } from '../shared/sim/Monster';
import type { Loot } from '../shared/sim/Loot';
import { IDLE_INTENT, type Intent, type SimEvent } from '../shared/sim/types';
import type { ZoneDef } from '../shared/data/zones';
import type { NpcId } from '../shared/data/npcs';
import type { EnhanceResult } from '../shared/data/enhance';
import type { Item, SlotId } from '../shared/types';

/** What a projectile view needs; the local simulation's Projectile fits this too. */
export interface ProjectileLike {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly o: { readonly color: string; readonly size: number };
}

export type EnhanceOutcome = { result: EnhanceResult; item: Item } | null;

export interface Backend {
  readonly online: boolean;
  readonly zone: ZoneDef;
  readonly terrain: Terrain;
  /** The character this browser controls. */
  readonly me: Player;
  readonly players: readonly Player[];
  readonly monsters: readonly Monster[];
  readonly projectiles: readonly ProjectileLike[];
  readonly loots: readonly Loot[];
  /** Simulation clock (seconds). */
  readonly time: number;
  /** Players in the world right now. */
  readonly onlineCount: number;

  /** Advances one frame with this player's input and returns what should be shown. */
  frame(dt: number, intent: Intent): SimEvent[];

  respawn(): void;
  equip(bagIndex: number): void;
  unequip(slot: SlotId): void;
  drop(bagIndex: number): void;
  buyPotion(kind: 'hp' | 'mp', n: number): void;
  sell(bagIndex: number): void;
  sellAllCommon(): void;
  enhance(uid: string): Promise<EnhanceOutcome>;
  chat(text: string): void;
  npcDistance(id: NpcId): number;
}

export class LocalBackend implements Backend {
  readonly online = false;
  readonly onlineCount = 1;
  readonly me: Player;
  private readonly sim: Sim;

  constructor(readonly zone: ZoneDef, data: CharacterData) {
    this.sim = new Sim(zone);
    this.me = this.sim.addPlayer(data);
  }

  get terrain(): Terrain { return this.sim.terrain; }
  get players(): readonly Player[] { return this.sim.players; }
  get monsters(): readonly Monster[] { return this.sim.monsters; }
  get projectiles(): readonly ProjectileLike[] { return this.sim.projectiles; }
  get loots(): readonly Loot[] { return this.sim.loots; }
  get time(): number { return this.sim.time; }

  frame(dt: number, intent: Intent): SimEvent[] {
    this.sim.step(dt, (p) => (p === this.me ? intent : IDLE_INTENT));
    return this.sim.drainEvents();
  }

  respawn(): void { this.sim.respawn(this.me); }
  equip(i: number): void { this.me.equipFromBag(i); }
  unequip(slot: SlotId): void { this.me.unequip(slot); }
  drop(i: number): void { this.sim.dropFromBag(this.me, i); }
  buyPotion(kind: 'hp' | 'mp', n: number): void { this.sim.buyPotion(this.me, kind, n); }
  sell(i: number): void { this.sim.sellItem(this.me, i); }
  sellAllCommon(): void { this.sim.sellAllCommon(this.me); }
  enhance(uid: string): Promise<EnhanceOutcome> { return Promise.resolve(this.sim.enhance(this.me, uid)); }
  chat(): void { /* nobody to talk to */ }
  npcDistance(id: NpcId): number { return this.sim.npcDistance(this.me, id); }
}
