// WebSocket messages between the browser and the game server (JSON). The server runs the
// simulation; clients send their input and get snapshots of what is near them plus SimEvents.
import type { SkillSlot } from '../data/classes';
import type { BagEntry, BuffScroll, ClassId, EquipSlot, Item, PotionKind, PotionSize, Rarity, Stats, Vec2 } from '../types';
import type { LootKind } from '../sim/Loot';
import type { SimEvent } from '../sim/types';
import type { AutoSettings, Buffs, BuybackEntry, LootFilter, PotionSelect, SortKey } from '../sim/Player';
import type { EnhanceResult } from '../data/enhance';
import type { RerollKind } from '../data/reroll';
import type { OrbLook } from '../orbLook';
import type { CosTuning } from '../cosTuning';
import type { BalanceTuning } from '../balance';
import type { StashData } from '../sim/stash';
import type { Hazard } from '../sim/volcanoHeart';
import type { MarketCall, MarketReply } from '../sim/market';
import type { MailCall, MailReply } from '../mail';
import type { ReportCall, ReportReply } from '../reports';
import type { PartyFound, PartySnap } from '../party';
import type { TradeView } from '../trade';
import type { FriendsView } from '../friends';
import type { RoomLobbyView, RoomSnap } from '../bossRoom';
import type { ChannelsView } from '../channels';
import type { CosSlot } from '../data/cosmetics';

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
  /** Start casting a return scroll. */
  recall?: boolean;
}

export type ActionMsg =
  | { t: 'act'; a: 'respawn' }
  | { t: 'act'; a: 'rest' }
  | { t: 'act'; a: 'pickup'; id: number }
  | { t: 'act'; a: 'equip'; i: number; slot?: EquipSlot }
  | { t: 'act'; a: 'unequip'; slot: EquipSlot }
  | { t: 'act'; a: 'drop'; i: number }
  | { t: 'act'; a: 'buy'; kind: PotionKind; size: PotionSize; n: number }
  /** Buy `n` return scrolls from the merchant. */
  | { t: 'act'; a: 'buyScroll'; n: number }
  /** Uses one EXP or drop scroll from the bag (Sim.useBuffScroll). */
  | { t: 'act'; a: 'useBuff'; stone: BuffScroll }
  /** Announces `text` to the whole server with a megaphone from the bag (server checks length, Guest and the cooldown). */
  | { t: 'act'; a: 'megaphone'; text: string }
  | { t: 'act'; a: 'sort'; key: SortKey; desc: boolean }
  | { t: 'act'; a: 'move'; from: number; to: number }
  /** Auto Play on/off. The server plays it, so it keeps farming while the browser tab is hidden. */
  | { t: 'act'; a: 'auto'; on: boolean }
  | { t: 'act'; a: 'lootFilter'; filter: LootFilter }
  | { t: 'act'; a: 'autoSettings'; settings: AutoSettings }
  /** `n` = sell only that many from a potion/stone stack (omitted = the whole slot). */
  | { t: 'act'; a: 'sell'; i: number; n?: number }
  /** Shift+drag in the bag: move `n` of the stack in `from` onto slot `to` (empty or the same stack). */
  | { t: 'act'; a: 'split'; from: number; to: number; n: number }
  /** Shift+drag touching the stash: `from`/`to` name the list ('bag' or 'stash'), `i`/`j` the slots. */
  | { t: 'act'; a: 'stashSplit'; from: 'bag' | 'stash'; i: number; to: 'bag' | 'stash'; j: number; n: number }
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
  | ({ t: 'act'; req: number } & MarketCall)
  /** Mailbox (server/mail.ts). Answered with a `mail` message of the same `req`. */
  | ({ t: 'act'; req: number } & MailCall)
  /** Bug report / feedback (server/reports.ts). Answered with a `report` message of the same `req`. */
  | ({ t: 'act'; req: number } & ReportCall)
  // Party (server/party.ts). Members are named by character id, the target of an invite by character name.
  | { t: 'act'; a: 'partyCreate' }
  | { t: 'act'; a: 'partyInvite'; name: string }
  | { t: 'act'; a: 'partyAnswer'; party: number; yes: boolean }
  | { t: 'act'; a: 'partyLeave' }
  | { t: 'act'; a: 'partyKick'; charId: number }
  /** Online, non-guest characters whose name holds `q`; answered with `partyFound` of the same `req`. */
  | { t: 'act'; a: 'partySearch'; q: string; req: number }
  /** The "don't accept party invites" setting (kept by the browser, sent on joining and when changed). */
  | { t: 'act'; a: 'partyBlock'; on: boolean }
  // Trade (server/trade.ts). A request names the target by character name, an answer the asker by character id.
  | { t: 'act'; a: 'tradeRequest'; name: string }
  | { t: 'act'; a: 'tradeAnswer'; from: number; yes: boolean }
  /** Offers bag slot `slot`; `n` = only that many of a potion/stone stack (omitted = all of it). */
  | { t: 'act'; a: 'tradeAdd'; slot: number; n?: number }
  | { t: 'act'; a: 'tradeRemove'; slot: number }
  | { t: 'act'; a: 'tradeGold'; amount: number }
  /** `ver` = the `ver` of the TradeView the player was looking at. */
  | { t: 'act'; a: 'tradeConfirm'; ver: number }
  | { t: 'act'; a: 'tradeCancel' }
  /** The "don't accept trade requests" setting (kept by the browser, sent on joining and when changed). */
  | { t: 'act'; a: 'tradeBlock'; on: boolean }
  // Friends (server/friends.ts), saved per account. A request or a block names a character, everything else the account id.
  | { t: 'act'; a: 'friendRequest'; name: string }
  | { t: 'act'; a: 'friendAnswer'; acc: number; yes: boolean }
  | { t: 'act'; a: 'friendCancel'; acc: number }
  | { t: 'act'; a: 'friendRemove'; acc: number }
  | { t: 'act'; a: 'friendBlock'; name: string }
  | { t: 'act'; a: 'friendUnblock'; acc: number }
  /** Asks for a fresh `friends` view (opening the window). */
  | { t: 'act'; a: 'friendList' }
  // Channels (server/channels.ts): ask for the channel window's list, switch to channel `ch` of this map,
  // or go to the channel of the friend / party member named `name` (same map only).
  | { t: 'act'; a: 'chList' }
  | { t: 'act'; a: 'chSwitch'; ch: number }
  | { t: 'act'; a: 'chJoin'; name: string }
  // Boss rooms (server/bossRooms.ts): put `keys` keys into the summoner you stand next to, answer an invite, start or call off.
  /** `quest`: use the bound quest key instead (×1, not used up; `keys` is ignored). */
  | { t: 'act'; a: 'roomOpen'; keys: number; quest?: boolean }
  // The Seeker's key quests (Sim.questAccept / questTurnIn): `boss` is the boss's monster id.
  | { t: 'act'; a: 'questAccept'; boss: string }
  | { t: 'act'; a: 'questTurnIn'; boss: string }
  // The Seeker's gear quests (Sim.gearAccept / gearTurnIn): `id` is a gear quest id (src/shared/gearQuests.ts).
  | { t: 'act'; a: 'gearAccept'; id: string }
  | { t: 'act'; a: 'gearTurnIn'; id: string }
  /** Buy `n` phoenix feathers from the merchant. */
  | { t: 'act'; a: 'buyPhoenix'; n: number }
  /** Dead in a boss room: get up where you fell, for one phoenix feather. */
  | { t: 'act'; a: 'roomRevive' }
  | { t: 'act'; a: 'roomLeave' }
  | { t: 'act'; a: 'roomAnswer'; id: number; yes: boolean }
  | { t: 'act'; a: 'roomStart' }
  | { t: 'act'; a: 'roomCancel' }
  /** Cosmetics (src/shared/data/cosmetics.ts): wear an owned one in its slot, or take it off (`id` null). */
  | { t: 'act'; a: 'cosWear'; slot: CosSlot; id: string | null }
  /** Get on the worn mount, or off it. */
  | { t: 'act'; a: 'mount' };

/** Close code the browser uses when the player leaves on purpose (leaves the party at once, no grace time). */
export const WS_CLOSE_QUIT = 4000;

export type ClientMsg =
  | { t: 'join'; token: string; characterId: number }
  | InputMsg
  | ActionMsg
  /** `ch: 'party'` = to the party only; `ch: 'whisper'` = only to the online character named `to`. */
  | { t: 'chat'; text: string; ch?: 'party' | 'whisper'; to?: string }
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
  /** Enhancement orbs, one per worn item at +7 or higher: `slot index * 16 + plus` (see orbCodes). Missing = none. */
  orbs?: number[];
  /** Cosmetics worn, as codes (see cosCodes). Missing = none. */
  cos?: number[];
  /** 1 while riding the worn mount. Missing = on foot. */
  mnt?: 1;
  /** Cursed into a toad by the Bog Witch (missing = not). */
  toad?: 1;
}

export interface MonsterSnap {
  id: number; def: string; lv: number;
  x: number; z: number; fx: number; fz: number; mv: boolean;
  alive: boolean; deadT: number; hp: number;
  /** Max HP as the server has it (zone boosts, the hub's visitors from other maps, boss HP per player). */
  mhp?: number;
  st: 'idle' | 'chase' | 'return' | 'charge' | 'leap'; wind: boolean; enr: boolean;
  /** Height above the ground while jumping. */
  y: number;
}

export interface ProjectileSnap { id: number; x: number; z: number; vx: number; vz: number; color: string; size: number; art?: 'ice_shard' | 'snowball' | 'ember_bolt' }

export interface LootSnap {
  id: number; x: number; z: number; fromX: number; fromZ: number; t: number;
  kind: LootKind; dropped: boolean; owner: number | null; ownerUntil: number;
  /** The owner's party, whose members share the first pick (left out when none). */
  party?: number;
  /** A boss room's drop: stays until the room closes, so it never blinks out. */
  forever?: boolean;
}

/** Only sent to the player it belongs to. */
export interface PrivateSnap {
  hp: number; mp: number; exp: number; level: number; gold: number;
  potSel: PotionSelect; lootFilter: LootFilter; autoSettings: AutoSettings; stats: Stats;
  /** Gate bosses this character has killed (BOSS_GATES). */
  bossKills?: string[];
  /** The Seeker's key quests taken: boss id → kills so far. */
  quests?: Record<string, number>;
  /** The Seeker's gear quests taken (quest id → kills so far) and handed in. */
  gearQuests?: Record<string, number>;
  gearDone?: string[];
  cd:Partial<Record<SkillSlot, number>>; potCd: number; restCd: number;
  /** Seconds left on a return-scroll cast (left out when not casting). */
  castT?: number;
  /** Buff scrolls running: seconds of play left on each (left out when none). */
  buffs?: Buffs;
  /** Share of move speed taken away by a slow right now (missing = none). */
  slow?: number;
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
  /** Cosmetic ids the account owns, only when it changed since the last snapshot (guests: always none). */
  cosOwned?: string[];
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
  /** The boss room you are in (left out elsewhere). */
  room?: RoomSnap;
  /** Your party, every member wherever they are (left out when you are in none). */
  party?: PartySnap;
  events: SimEvent[];
}

export type ServerMsg =
  /** `guest`: playing a guest character (no stash, deleted after a day offline). */
  /** `ch`: the channel of that zone (1 when it has none). */
  | { t: 'welcome'; you: number; time: number; zone: string; ch?: number; guest?: boolean; orbLook?: OrbLook; cosTuning?: CosTuning; balance?: BalanceTuning }
  /** The owner changed the server-wide enhancement orb look (src/shared/orbLook.ts). */
  | { t: 'orbLook'; look: OrbLook }
  /** An admin changed the server-wide game balance (src/shared/balance.ts). */
  | { t: 'balance'; tuning: BalanceTuning }
  /** The owner changed the server-wide cosmetic tuning (src/shared/cosTuning.ts). */
  | { t: 'cosTuning'; tuning: CosTuning }
  /**
   * You walked through a portal (or switched channel): you are now `you` in zone `zone`, channel `ch`,
   * standing at x/z. Snapshots from there follow.
   */
  | { t: 'zone'; zone: string; ch?: number; you: number; x: number; z: number }
  /** The channel window's list (answer to `chList`). */
  | { t: 'channels'; view: ChannelsView }
  | SnapshotMsg
  /**
   * `ch: 'party'` = party chat, or (empty name) a party notice. `ch: 'whisper'` = a whisper from `name`;
   * with `to`, it is your own whisper to `to`, echoed back.
   */
  | { t: 'chat'; name: string; text: string; ch?: 'party' | 'whisper'; to?: string }
  /** Your friends window (sent on joining, on `friendList`, and whenever any of it changes). */
  | { t: 'friends'; view: FriendsView }
  /** Someone invites you to their party; answer within `seconds`. */
  | { t: 'partyInvite'; party: number; from: string; seconds: number }
  /** That invite can't be answered any more (answered, expired, or the party ended). */
  | { t: 'partyInviteGone'; party: number }
  | { t: 'partyFound'; req: number; list: PartyFound[] }
  /** Someone asks you to trade; answer within `seconds`. `from` is their character id. */
  | { t: 'tradeRequest'; from: number; name: string; seconds: number }
  | { t: 'tradeRequestGone'; from: number }
  /** Your party leader opened a boss room; answer within `seconds`. */
  | { t: 'roomInvite'; id: number; from: string; boss: string; keys: number; seconds: number }
  /** That invite can't be answered any more (started, called off, or timed out). */
  | { t: 'roomInviteGone'; id: number }
  /** The leader's lobby window: its state, or null when it closes. */
  | { t: 'roomLobby'; view: RoomLobbyView | null }
  /** The trade window's state (sent on every change). */
  | { t: 'trade'; view: TradeView }
  /** The trade ended: `ok` = it went through. Closes the window. */
  | { t: 'tradeEnd'; ok: boolean; msg: string }
  | { t: 'enhanced'; req: number; result: EnhanceResult | null; item: Item | null }
  /** The rerolled item, or null when the server refused. */
  | { t: 'rerolled'; req: number; item: Item | null }
  /** The answer to a market action with this `req`. */
  | ({ t: 'market'; req: number } & MarketReply)
  /** Something of yours sold or expired at the market (a banner and a chat line). */
  | { t: 'marketNote'; text: string; sub?: string }
  /** How many listings wait in your claim box at the market broker (sent on joining and when it changes). */
  | { t: 'marketBox'; n: number }
  | ({ t: 'mail'; req: number } & MailReply)
  /** Your unread mail count (badge), sent on joining and when mail arrives; `fresh` = mail you haven't been told about (a chat line and a sound). */
  | { t: 'mailNote'; unread: number; fresh: number }
  | ({ t: 'report'; req: number } & ReportReply)
  | { t: 'error'; msg: string }
  | { t: 'pong'; id: number }
  /** The connection is about to close; `msg` explains why. */
  | { t: 'kick'; msg: string }
  /** The server stops (or restarts) in `seconds`; sent once a second during the countdown. */
  | { t: 'shutdown'; mode: ShutdownMode; seconds: number; text?: string }
  /** An announcement from the server's owner (admin page): shown as a banner and a chat line. */
  | { t: 'announce'; text: string; from: string; direct: boolean; megaphone?: boolean }
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
