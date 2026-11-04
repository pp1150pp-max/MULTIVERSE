// WebSocket messages between the browser and the game server (JSON). The server runs the
// simulation; clients send their input and get snapshots of what is near them plus SimEvents.
import type { SkillSlot } from '../data/classes';
import type { BagEntry, ClassId, Item, PotionKind, PotionSize, Rarity, SlotId, Stats, Vec2 } from '../types';
import type { LootKind } from '../sim/Loot';
import type { SimEvent } from '../sim/types';
import type { LootFilter, PotionSelect, SortKey } from '../sim/Player';
import type { EnhanceResult } from '../data/enhance';

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
  /** Where the client walked its character (ignored while the server is moving it — dash, knockback). */
  pos: Vec2;
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
  /** Auto Play on/off. The server plays it, so it keeps farming while the browser tab is hidden. */
  | { t: 'act'; a: 'auto'; on: boolean }
  | { t: 'act'; a: 'lootFilter'; filter: LootFilter }
  | { t: 'act'; a: 'sell'; i: number }
  | { t: 'act'; a: 'sellRarity'; rarity: Rarity }
  | { t: 'act'; a: 'enhance'; uid: string; req: number };

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
  st: 'idle' | 'chase' | 'return' | 'charge'; wind: boolean; enr: boolean;
}

export interface ProjectileSnap { id: number; x: number; z: number; vx: number; vz: number; color: string; size: number }

export interface LootSnap {
  id: number; x: number; z: number; fromX: number; fromZ: number; t: number;
  kind: LootKind; dropped: boolean; owner: number | null; ownerUntil: number;
}

/** Only sent to the player it belongs to. */
export interface PrivateSnap {
  hp: number; mp: number; exp: number; level: number; gold: number;
  potSel: PotionSelect; lootFilter: LootFilter; stats: Stats;
  cd: Partial<Record<SkillSlot, number>>; potCd: number;
  /** True while the server moves the character (dash, knockback, stun, dead, Auto Play) — follow its position. */
  serverMoves: boolean;
  /** Changes when the server teleports the character (respawn) — jump straight there. */
  epoch: number;
  /** Bag and equipment, only when they changed since the last snapshot. */
  inv?: { equipment: Partial<Record<SlotId, Item>>; bag: (BagEntry | null)[] };
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
  | { t: 'welcome'; you: number; time: number; zone: string }
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
