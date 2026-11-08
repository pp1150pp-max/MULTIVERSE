// WebSocket messages between the browser and the game server (JSON). The server runs the
// simulation; clients send their input and get snapshots of what is near them plus SimEvents.
import type { SkillSlot } from '../data/classes';
import type { BagEntry, ClassId, EquipSlot, Item, PotionKind, PotionSize, Rarity, Stats, Vec2 } from '../types';
import type { LootKind } from '../sim/Loot';
import type { SimEvent } from '../sim/types';
import type { AutoSettings, BuybackEntry, LootFilter, PotionSelect, SortKey } from '../sim/Player';
import type { EnhanceResult } from '../data/enhance';
import type { RerollKind } from '../data/reroll';
import type { StashData } from '../sim/stash';
import type { Hazard } from '../sim/volcanoHeart';
import type { MarketCall, MarketReply } from '../sim/market';

export const WS_PATH = '/ws';
/** Server simulation rate and how often it sends snapshots. */
export const TICK_HZ = 30;
export const SNAPSHOT_HZ = 15;
/** Clients send their input this often. */
export const INPUT_HZ = 30;
/** Only things this close to a player are sent to them. */
export const INTEREST_RADIUS = 34;
export const CHAT_MAX = 120;
/** Clients measure their round trip with a ping this often; the server ignores pings arriving faster than a quarter of it. */
export const PING_MS = 2000;
/** Longest GPU name a client may report (longer ones are cut). */
export const GPU_NAME_MAX = 200;

/** True for WebGL renderers that draw on the CPU: hardware acceleration is off or the GPU is blocklisted. */
export function isSoftwareRenderer(name: string): boolean {
  return /swiftshader|llvmpipe|softpipe|microsoft basic render|software/i.test(name);
}

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
  | { t: 'act'; a: 'equip'; i: number; slot?: EquipSlot }
  | { t: 'act'; a: 'unequip'; slot: EquipSlot }
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
  /** `protect` = use a protection stone if a fail would drop the level. */
  | { t: 'act'; a: 'enhance'; uid: string; protect?: boolean; req: number }
  /** Blacksmith reroll (see Sim.reroll); answered with `rerolled`. */
  | { t: 'act'; a: 'reroll'; uid: string; kind: RerollKind; req: number }
  /** Stash (warehouse keeper). `to` = target slot, or -1 for wherever it fits. */
  | { t: 'act'; a: 'stashPut'; i: number; to: number }
  | { t: 'act'; a: 'stashTake'; i: number; to: number }
  | { t: 'act'; a: 'stashMove'; from: number; to: number }
  | { t: 'act'; a: 'stashSort'; key: SortKey; desc: boolean }
  | { t: 'act'; a: 'stashBuy' }
  /** amount > 0 deposits gold, < 0 withdraws it. */
  | { t: 'act'; a: 'stashGold'; amount: number }
  /** Market broker (consignment market). The server answers each with a `market` message of the same `req`. */
  | ({ t: 'act'; req: number } & MarketCall);

export type ClientMsg =
  | { t: 'join'; token: string; characterId: number }
  | InputMsg
  | ActionMsg
  | { t: 'chat'; text: string }
  /**
   * Answered at once with a pong of the same id. The rest is for the server's lag log, about the time
   * since the previous ping: `rtt` the round trip measured then (ms, each one reported once),
   * `wait` how long the oldest still unanswered ping has waited (ms), `fps` frames drawn per second,
   * `maxFrame` the longest frame (ms) and `hidden` whether the tab was in the background (no frames).
   */
  | { t: 'ping'; id: number; rtt?: number; wait?: number; fps?: number; maxFrame?: number; hidden?: boolean }
  /** Sent once after joining: the WebGL renderer (GPU) name, for the server log. */
  | { t: 'client'; gpu: string };

// ------------------------------------------------------------ server → client

/** Another player (or yourself) as everyone sees them. */
export interface PlayerSnap {
  id: number; name: string; cls: ClassId; lv: number;
  x: number; z: number; fx: number; fz: number; mv: boolean;
  alive: boolean; hp: number; maxHp: number;
  /** Dashing: 'dash' | 'charge', or 0 when not. */
  dash: 'dash' | 'charge' | 0;
  /** Enhancement aura tier 1–4 (missing = none). */
  aura?: number;
}

export interface MonsterSnap {
  id: number; def: string; lv: number;
  x: number; z: number; fx: number; fz: number; mv: boolean;
  alive: boolean; deadT: number; hp: number;
  /** Bosses only: max HP, which grows with the number of players fighting it. */
  mhp?: number;
  st: 'idle' | 'chase' | 'return' | 'charge' | 'leap'; wind: boolean; enr: boolean;
  /** Height above the ground while jumping. */
  y: number;
}

export interface ProjectileSnap { id: number; x: number; z: number; vx: number; vz: number; color: string; size: number; art?: 'ice_shard' | 'snowball' | 'ember_bolt' }

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
  inv?: { equipment: Partial<Record<EquipSlot, Item>>; bag: (BagEntry | null)[]; buyback?: BuybackEntry[] };
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
  /** Boss ground attacks in progress (left out when there are none). */
  hazards?: Hazard[];
  /** Seconds until the zone's boss comes back (left out while it is alive). */
  bossIn?: number;
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
  /** The rerolled item, or null when the server refused. */
  | { t: 'rerolled'; req: number; item: Item | null }
  /** The answer to a market action with this `req`. */
  | ({ t: 'market'; req: number } & MarketReply)
  /** Something of yours sold or expired at the market (a banner and a chat line). */
  | { t: 'marketNote'; text: string; sub?: string }
  /** How many listings wait in your claim box at the market broker (sent on joining and when it changes). */
  | { t: 'marketBox'; n: number }
  | { t: 'error'; msg: string }
  | { t: 'pong'; id: number }
  /** The connection is about to close; `msg` explains why. */
  | { t: 'kick'; msg: string }
  /** The server stops (or restarts) in `seconds`; sent once a second during the countdown. */
  | { t: 'shutdown'; mode: ShutdownMode; seconds: number; text?: string }
  /** An announcement from the server's owner (admin page): shown as a banner and a chat line. */
  | { t: 'announce'; text: string; from: string; direct: boolean }
  /** The countdown was cancelled: the server stays up. */
  | { t: 'shutdownCancel'; mode: ShutdownMode };

/** How the server is going away: `restart` comes back by itself (under npm run online), `shutdown` doesn't. */
export type ShutdownMode = 'restart' | 'shutdown';
/** Seconds players are warned before the server stops. */
export const SHUTDOWN_SECONDS = 10;
/** Exit code that asks npm run online (server/online-main.ts) to start the server again. */
export const RESTART_EXIT_CODE = 75;

/** Stands for the time left in the countdown text the owner sets on the admin page. */
export const SHUTDOWN_TIME_TOKEN = '{เวลา}';
/** Longest countdown text the owner may set (characters, before the time is filled in). */
export const SHUTDOWN_TEXT_MAX = 100;
/** Countdown texts until the owner sets their own (admin page, Server tab). */
export const DEFAULT_SHUTDOWN_TEXT: Record<ShutdownMode, string> = {
  restart: `มีการอัปเดตเซิร์ฟเวอร์ กำลังจะรีสตาร์ทใน ${SHUTDOWN_TIME_TOKEN}`,
  shutdown: `เซิร์ฟเวอร์กำลังจะปิดใน ${SHUTDOWN_TIME_TOKEN}`,
};

/** "10 วินาที", "1 นาที 30 วินาที", "2 นาที". */
export function countdownTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!m) return `${r} วินาที`;
  return r ? `${m} นาที ${r} วินาที` : `${m} นาที`;
}

/**
 * Checks a countdown text the owner typed: control characters and line breaks become spaces, it is
 * trimmed, and it must hold SHUTDOWN_TIME_TOKEN and be at most SHUTDOWN_TEXT_MAX long. The same check
 * runs on the admin page (preview) and on the server (which decides). Shown with textContent only.
 */
export function checkShutdownText(raw: unknown): { text: string; error: null } | { text: string; error: string } {
  const text = (typeof raw === 'string' ? raw : '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/ {2,}/g, ' ').trim();
  if (!text) return { text, error: 'พิมพ์ข้อความก่อน' };
  if (text.length > SHUTDOWN_TEXT_MAX) return { text, error: `ข้อความยาวได้ไม่เกิน ${SHUTDOWN_TEXT_MAX} ตัว` };
  if (!text.includes(SHUTDOWN_TIME_TOKEN)) return { text, error: `ต้องมี ${SHUTDOWN_TIME_TOKEN} ในข้อความ (เกมจะแทนด้วยเวลาที่เหลือ)` };
  return { text, error: null };
}

/** The countdown line players see: ⚠ + the text (`template`, else the default) with the time filled in. */
export function shutdownWarning(mode: ShutdownMode, seconds: number, template?: string): string {
  return `⚠ ${(template ?? DEFAULT_SHUTDOWN_TEXT[mode]).split(SHUTDOWN_TIME_TOKEN).join(countdownTime(seconds))}`;
}
export function shutdownCancelled(mode: ShutdownMode): string {
  return mode === 'restart' ? 'ยกเลิกการรีสตาร์ท' : 'ยกเลิกการปิด server';
}
/** Shown when the connection closes because of it. */
export function shutdownKick(mode: ShutdownMode): string {
  return mode === 'restart' ? 'Server กำลังรีสตาร์ท — รอสักครู่แล้วรีเฟรชหน้า' : 'Server ปิดแล้ว';
}

/** Rounds coordinates so snapshots stay small. */
export const r2 = (v: number) => Math.round(v * 100) / 100;
