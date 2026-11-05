// Where the game world comes from. Singleplayer runs the simulation right here (LocalBackend);
// multiplayer mirrors what the server sends (OnlineBackend in net/online.ts). Game, HUD and views
// only talk to this interface, so both modes look and play the same.
import { Sim } from '../shared/sim/Sim';
import type { Terrain } from '../shared/sim/terrain';
import type { Player, AutoSettings, CharacterData, LootFilter, SortKey } from '../shared/sim/Player';
import type { Monster } from '../shared/sim/Monster';
import type { Loot } from '../shared/sim/Loot';
import { IDLE_INTENT, type Intent, type SimEvent } from '../shared/sim/types';
import { zoneById, type ZoneDef } from '../shared/data/zones';
import type { NpcId } from '../shared/data/npcs';
import type { EnhanceResult } from '../shared/data/enhance';
import type { Item, PotionKind, PotionSize, Rarity, SlotId } from '../shared/types';
import { loadStash, writeStash } from './save';

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
  buyPotion(kind: PotionKind, size: PotionSize, n: number): void;
  sortBag(key: SortKey, desc: boolean): void;
  /** Drag & drop between two bag slots (swap, or merge the same potion). */
  moveInBag(from: number, to: number): void;
  /** Online the server runs Auto Play; singleplayer runs it in Game, so this does nothing there. */
  setAuto(on: boolean): void;
  setLootFilter(f: LootFilter): void;
  setAutoSettings(s: AutoSettings): void;
  sell(bagIndex: number): void;
  /** Buy back entry `i` of the merchant's buyback list (`uid` guards against a list that just changed). */
  buyBack(i: number, uid: string): void;
  sellAllOfRarity(rarity: Rarity): void;
  enhance(uid: string): Promise<EnhanceOutcome>;
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

export class LocalBackend implements Backend {
  readonly online = false;
  readonly onlineCount = 1;
  me: Player;
  private sim: Sim;

  constructor(zone: ZoneDef, data: CharacterData) {
    this.sim = new Sim(zone);
    this.me = this.sim.addPlayer(data);
    // Singleplayer keeps one stash per browser, apart from the character save.
    this.me.stash = loadStash();
  }

  get zone(): ZoneDef { return this.sim.zone; }
  get terrain(): Terrain { return this.sim.terrain; }
  get players(): readonly Player[] { return this.sim.players; }
  get monsters(): readonly Monster[] { return this.sim.monsters; }
  get projectiles(): readonly ProjectileLike[] { return this.sim.projectiles; }
  get loots(): readonly Loot[] { return this.sim.loots; }
  get time(): number { return this.sim.time; }

  frame(dt: number, intent: Intent): SimEvent[] {
    this.sim.step(dt, (p) => (p === this.me ? intent : IDLE_INTENT));
    const events = this.sim.drainEvents();
    const travel = events.find((e) => e.t === 'travel' && e.to === this.me.id);
    if (travel?.t === 'travel') this.travel(travel.zone);
    return events;
  }

  /** Starts a fresh simulation of the destination zone with this character in it. */
  private travel(zoneId: string): void {
    const old = this.me;
    const from = this.sim.zone.id;
    this.sim = new Sim(zoneById(zoneId));
    this.me = this.sim.addPlayer(old.toData(), from);
    this.me.hp = Math.min(old.hp, this.me.maxHp);
    this.me.mp = Math.min(old.mp, this.me.stats.maxMp);
    this.me.cd = { ...old.cd };
    this.me.potCd = old.potCd;
    this.me.stash = old.stash;
  }

  respawn(): void { this.sim.respawn(this.me); }
  equip(i: number): void { this.me.equipFromBag(i); }
  unequip(slot: SlotId): void { this.me.unequip(slot); }
  drop(i: number): void { this.sim.dropFromBag(this.me, i); }
  buyPotion(kind: PotionKind, size: PotionSize, n: number): void { this.sim.buyPotion(this.me, kind, size, n); }
  sortBag(key: SortKey, desc: boolean): void { this.sim.sortBag(this.me, key, desc); }
  moveInBag(from: number, to: number): void { this.sim.moveInBag(this.me, from, to); }
  setAuto(): void { /* Game runs Auto Play itself */ }
  setLootFilter(f: LootFilter): void { this.sim.setLootFilter(this.me, f); }
  setAutoSettings(s: AutoSettings): void { this.sim.setAutoSettings(this.me, s); }
  sell(i: number): void { this.sim.sellItem(this.me, i); }
  buyBack(i: number, uid: string): void { this.sim.buyBack(this.me, i, uid); }
  sellAllOfRarity(rarity: Rarity): void { this.sim.sellAllOfRarity(this.me, rarity); }
  enhance(uid: string): Promise<EnhanceOutcome> { return Promise.resolve(this.sim.enhance(this.me, uid)); }
  chat(): void { /* nobody to talk to */ }
  npcDistance(id: NpcId): number { return this.sim.npcDistance(this.me, id); }

  stashPut(i: number, to: number): void { this.stashed(this.sim.stashPut(this.me, i, to)); }
  stashTake(i: number, to: number): void { this.stashed(this.sim.stashTake(this.me, i, to)); }
  stashMove(from: number, to: number): void { this.stashed(this.sim.stashMove(this.me, from, to)); }
  stashSort(key: SortKey, desc: boolean): void { this.stashed(this.sim.stashSort(this.me, key, desc)); }
  stashBuyRow(): void { this.stashed(this.sim.stashBuyRow(this.me)); }
  stashGold(amount: number): void { this.stashed(this.sim.stashGold(this.me, amount)); }

  /** Saves the stash straight away (the character follows on the Sim's save event this frame). */
  private stashed(changed: boolean): void {
    if (changed) writeStash(this.me.stash);
  }
}
