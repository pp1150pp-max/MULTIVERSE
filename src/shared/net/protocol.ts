// WebSocket messages between the browser and the game server (JSON). The server runs the
// simulation; clients send their input and get snapshots of what is near them plus SimEvents.
import type { SkillSlot } from '../data/classes';
import type { BagEntry, ClassId, Item, PotionKind, PotionSize, Rarity, SlotId, Stats, Vec2 } from '../types';
import type { LootKind } from '../sim/Loot';
import type { SimEvent } from '../sim/types';
import type { AutoSettings, BuybackEntry, LootFilter, PotionSelect, SortKey } from '../sim/Player';
import type { EnhanceResult } from '../data/enhance';
import type { StashData } from '../sim/stash';

export const WS_PATH = '/ws';
/** Server simulation rate and how often it sends snapshots. */
export const TICK_HZ = 30;
export const SNAPSHOT_HZ = 15;
/** Clients send their input this often. */
export const INPUT_HZ = 30;
/** Only things this close to a player are sent to them. */
export const INTEREST_RADIUS = 34;
export const CHAT_MAX = 120;

// ------------------------------------------------------------ client → server

export interface InputMsg {
  t: 'input';
  /** Where the client walked its character. Left out while the client follows the server (dash, knockback). */
  pos?: Vec2;
  /** Counts up with every input message, so the server can say which one its position answers (PrivateSnap.ack). */
  seq?: number;
  move: Vec2 | null;
  aim: Vec2;
  basic: boolean;
  skills: SkillSlot[];
  /** One-shot actions pressed since the last input message. */
  dash: boolean;
  potion: 'hp' | 'mp' | null;
}

export type ActionMsg =
  | { t: 'act'; a: 'respawn' }
  | { t: 'act'; a: 'equip'; i: number }
  | { t: 'act'; a: 'unequip'; slot: SlotId }
  | { t: 'act'; a: 'drop'; i: number }
  | { t: 'act'; a: 'buy'; kind: PotionKind; size: PotionSize; n: number }
  | { t: 'act'; a: 'sort'; key: SortKey; desc: boolean }
  | { t: 'act'; a: 'move'; from: number; to: number }
  /** Auto Play on/off. The server plays it, so it keeps farming while the browser tab is hidden. */
  | { t: 'act'; a: 'auto'; on: boolean }
  | { t: 'act'; a: 'lootFilter'; filter: LootFilter }
  | { t: 'act'; a: 'autoSettings'; settings: AutoSettings }
  | { t: 'act'; a: 'sell'; i: number }
  | { t: 'act'; a: 'buyBack'; i: number; uid: string }
  | { t: 'act'; a: 'sellRarity'; rarity: Rarity }
  | { t: 'act'; a: 'enhance'; uid: string; req: number }
  /** Stash (warehouse keeper). `to` = target slot, or -1 for wherever it fits. */
  | { t: 'act'; a: 'stashPut'; i: number; to: number }
  | { t: 'act'; a: 'stashTake'; i: number; to: number }
  | { t: 'act'; a: 'stashMove'; from: number; to: number }
  | { t: 'act'; a: 'stashSort'; key: SortKey; desc: boolean }
  | { t: 'act'; a: 'stashBuy' }
  /** amount > 0 deposits gold, < 0 withdraws it. */
  | { t: 'act'; a: 'stashGold'; amount: number };

export type ClientMsg =
  | { t: 'join'; token: string; characterId: number }
  | InputMsg
  | ActionMsg
  | { t: 'chat'; text: string };

// ------------------------------------------------------------ server → client

/** Another player (or yourself) as everyone sees them. */
export interface PlayerSnap {
  id: number; name: string; cls: ClassId; lv: number;
  x: number; z: number; fx: number; fz: number; mv: boolean;
  alive: boolean; hp: number; maxHp: number;
  /** Dashing: 'dash' | 'charge', or 0 when not. */
  dash: 'dash' | 'charge' | 0;
}

export interface MonsterSnap {
  id: number; def: string; lv: number;
  x: number; z: number; fx: number; fz: number; mv: boolean;
  alive: boolean; deadT: number; hp: number;
  st: 'idle' | 'chase' | 'return' | 'charge' | 'leap'; wind: boolean; enr: boolean;
  /** Height above the ground while jumping. */
  y: number;
}

export interface ProjectileSnap { id: number; x: number; z: number; vx: number; vz: number; color: string; size: number; art?: 'ice_shard' | 'snowball' }

export interface LootSnap {
  id: number; x: number; z: number; fromX: number; fromZ: number; t: number;
  kind: LootKind; dropped: boolean; owner: number | null; ownerUntil: number;
}

/** Only sent to the player it belongs to. */
export interface PrivateSnap {
  hp: number; mp: number; exp: number; level: number; gold: number;
  potSel: PotionSelect; lootFilter: LootFilter; autoSettings: AutoSettings; stats: Stats;
  cd: Partial<Record<SkillSlot, number>>; potCd: number;
  /** True while the server moves the character (dash, knockback, stun, dead, Auto Play) — follow its position. */
  serverMoves: boolean;
  /** Changes when the server teleports the character (respawn) — jump straight there. */
  epoch: number;
  /** The `seq` of the last input the server had applied when it took this snapshot. */
  ack?: number;
  /** Bag and equipment, only when they changed since the last snapshot. */
  inv?: { equipment: Partial<Record<SlotId, Item>>; bag: (BagEntry | null)[]; buyback?: BuybackEntry[] };
  /** Seconds of play until the buyback list clears. */
  buybackLeft?: number;
  /** The account's stash, only when it changed since the last snapshot. */
  stash?: StashData;
}

export interface SnapshotMsg {
  t: 'snap';
  time: number;
  online: number;
  me: PrivateSnap;
  players: PlayerSnap[];
  monsters: MonsterSnap[];
  projectiles: ProjectileSnap[];
  loots: LootSnap[];
  events: SimEvent[];
}

export type ServerMsg =
  /** `guest`: playing a guest character (no stash, deleted after a day offline). */
  | { t: 'welcome'; you: number; time: number; zone: string; guest?: boolean }
  /** You walked through a portal: you are now `you` in zone `zone`, standing at x/z. Snapshots from that zone follow. */
  | { t: 'zone'; zone: string; you: number; x: number; z: number }
  | SnapshotMsg
  | { t: 'chat'; name: string; text: string }
  | { t: 'enhanced'; req: number; result: EnhanceResult | null; item: Item | null }
  | { t: 'error'; msg: string }
  /** The connection is about to close; `msg` explains why. */
  | { t: 'kick'; msg: string };

/** Rounds coordinates so snapshots stay small. */
export const r2 = (v: number) => Math.round(v * 100) / 100;
