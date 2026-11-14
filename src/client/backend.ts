// Where the game world comes from: the server runs the simulation, and OnlineBackend (net/online.ts)
// mirrors what it sends. Game, HUD and views only talk to this interface.
import type { Terrain } from '../shared/sim/terrain';
import type { CosSlot } from '../shared/data/cosmetics';
import type { WearSlot } from '../shared/data/classes';
import type { Player, AutoSettings, LootFilter, SortKey } from '../shared/sim/Player';
import type { Monster } from '../shared/sim/Monster';
import type { Loot } from '../shared/sim/Loot';
import type { Intent, SimEvent } from '../shared/sim/types';
import type { ZoneDef } from '../shared/data/zones';
import type { Hazard } from '../shared/sim/volcanoHeart';
import type { NpcId } from '../shared/data/npcs';
import type { EnhanceResult } from '../shared/data/enhance';
import type { TutStep } from '../shared/tutorial';
import type { RerollKind } from '../shared/data/reroll';
import type { BuffScroll, EquipSlot, Item, PotionKind, PotionSize, Rarity } from '../shared/types';
import type { MarketCall, MarketReply } from '../shared/sim/market';
import type { MailCall, MailReply } from '../shared/mail';
import type { ReportReply } from '../shared/reports';
import type { RoomSnap } from '../shared/bossRoom';
import type { PartyFound, PartySnap } from '../shared/party';
import type { FriendsView } from '../shared/friends';
import type { ChannelsView } from '../shared/channels';

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
  /** The channel of that zone you are in (1 on a map without channels). */
  readonly channel: number;
  /** Goes up on every move to another map or channel (a channel switch keeps the same `zone`). */
  readonly zoneSeq: number;
  readonly terrain: Terrain;
  /** The character this browser controls. */
  readonly me: Player;
  readonly players: readonly Player[];
  readonly monsters: readonly Monster[];
  readonly projectiles: readonly ProjectileLike[];
  readonly loots: readonly Loot[];
  /** Boss ground attacks going on right now. */
  readonly hazards: readonly Hazard[];
  /** The boss room you are in (null elsewhere); `leaveIn` counts down locally once the boss is dead. */
  readonly room: RoomSnap | null;
  /** Simulation clock (seconds). */
  readonly time: number;
  /** Players in your map and channel right now, you included. */
  readonly hereCount: number;
  /** Players in the whole server; null unless you are owner or GM. */
  readonly onlineCount: number | null;
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
  /** Rest at the fountain or a campfire the player is next to (the server checks). */
  rest(): void;
  /** Pick up a drop the player clicked and walked to, even one the loot filter skips (the server checks). */
  pickup(lootId: number): void;
  equip(bagIndex: number, slot?: EquipSlot): void;
  unequip(slot: EquipSlot): void;
  drop(bagIndex: number): void;
  buyPotion(kind: PotionKind, size: PotionSize, n: number): void;
  buyReturnScroll(n: number): void;
  /** Starts casting a return scroll (sent with the next input). */
  useReturnScroll(): void;
  /** Uses one EXP or drop scroll from the bag (the server checks). */
  useBuffScroll(kind: BuffScroll): void;
  /** Announces `text` to everyone with a megaphone from the bag (the server checks). */
  useMegaphone(text: string): void;
  /** Asks for this month's daily login calendar (answered through onDaily). */
  dailyOpen(): void;
  /** Makes up an earlier missed day of this month (the server checks). */
  dailyMakeup(day: number): void;
  sortBag(key: SortKey, desc: boolean): void;
  /** Drag & drop between two bag slots (swap, or merge the same potion). */
  moveInBag(from: number, to: number): void;
  /** The server runs Auto Play, so it keeps going in a hidden tab. */
  setAuto(on: boolean): void;
  setLootFilter(f: LootFilter): void;
  setAutoSettings(s: AutoSettings): void;
  /** Skill window: learn a skill or its next rank (one point), take one point back, wear a learned skill (null = take off). */
  learnSkill(id: string): void;
  refundSkill(id: string): void;
  wearSkill(slot: WearSlot, id: string | null): void;
  /** `n` = sell only that many from a potion/stone stack (omitted = the whole slot). */
  sell(bagIndex: number, n?: number): void;
  /** Shift+drag: move `n` of a stack in bag slot `from` onto bag slot `to`. */
  splitInBag(from: number, to: number, n: number): void;
  /** Shift+drag touching the stash: move `n` of a stack from slot `i` of one list onto slot `j` of the other (or the same). */
  stashSplit(from: 'bag' | 'stash', i: number, to: 'bag' | 'stash', j: number, n: number): void;
  /** Buy back entry `i` of the merchant's buyback list (`uid` guards against a list that just changed). */
  buyBack(i: number, uid: string): void;
  sellAllOfRarity(rarity: Rarity): void;
  /** `protect` = use a protection stone if a fail would drop the level. */
  enhance(uid: string, protect: boolean): Promise<EnhanceOutcome>;
  /** Blacksmith reroll of worn or bag gear; resolves with the changed item, or null if refused. */
  reroll(uid: string, kind: RerollKind): Promise<Item | null>;
  /** `party` = to the party only. */
  chat(text: string, party?: boolean): void;
  /** A whisper: only the online character named `to` sees it (the server echoes it back). */
  whisper(to: string, text: string): void;
  npcDistance(id: NpcId): number;

  // Cosmetics (src/shared/data/cosmetics.ts). What you wear is `me.cosmetics`, riding `me.mounted`.
  /** Cosmetic ids your account owns (always none for a guest). */
  readonly cosOwned: readonly string[];
  /** Wear an owned cosmetic in its slot, or take the slot off (`id` null). */
  cosWear(slot: CosSlot, id: string | null): void;
  /** Get on the worn mount, or off it. */
  toggleMount(): void;

  // Stash (warehouse keeper). The stash itself is `me.stash`. `to` = target slot, or -1 for wherever it fits.
  stashPut(bagIndex: number, to: number): void;
  stashTake(stashIndex: number, to: number): void;
  stashMove(from: number, to: number): void;
  stashSort(key: SortKey, desc: boolean): void;
  stashBuyRow(): void;
  /** amount > 0 deposits gold, < 0 withdraws it. */
  stashGold(amount: number): void;

  /** Market broker: one request and the server's answer (ok false with no msg = too fast, try again). */
  market(call: MarketCall): Promise<MarketReply>;
  /** Listings waiting in this account's claim box at the market broker. */
  readonly marketBox: number;
  /** Mailbox: one request and the server's answer. */
  mail(call: MailCall): Promise<MailReply>;
  /** Bug report / feedback: the server checks everything and answers (see server/reports.ts). */
  report(topic: string, text: string): Promise<ReportReply>;
  /** Unread mail (the icon's badge). */
  readonly mailUnread: number;

  // Party (the server checks every rule; see server/party.ts).
  /** Your party as of the last snapshot, or null when you are in none. */
  readonly party: PartySnap | null;
  partyCreate(): void;
  partyInvite(name: string): void;
  partyAnswer(party: number, yes: boolean): void;
  partyLeave(): void;
  partyKick(charId: number): void;
  /** Online, non-guest characters whose name holds `q` (empty list if the server didn't answer). */
  partySearch(q: string): Promise<PartyFound[]>;
  /** The "don't accept party invites" setting. */
  setPartyBlock(on: boolean): void;

  // Trade (the server checks every rule; see server/trade.ts). Answers come back as hooks on the backend.
  tradeRequest(name: string): void;
  tradeAnswer(from: number, yes: boolean): void;
  /** Offer bag slot `slot` (a part `n` of a potion/stone stack, or all of it). */
  tradeAdd(slot: number, n?: number): void;
  tradeRemove(slot: number): void;
  tradeGold(amount: number): void;
  /** Confirm the offer as shown (`ver` from the TradeView). */
  tradeConfirm(ver: number): void;
  tradeCancel(): void;
  /** The "don't accept trade requests" setting. */
  setTradeBlock(on: boolean): void;

  // Friends (the server checks every rule; see server/friends.ts). The view comes back as a hook on the backend.
  /** The friends window's last state from the server (null until it came, and always for guests). */
  readonly friends: FriendsView | null;
  /** Ask the account playing this character to be friends. */
  friendRequest(name: string): void;
  friendAnswer(acc: number, yes: boolean): void;
  friendCancel(acc: number): void;
  friendRemove(acc: number): void;
  /** Block the account playing this character. */
  friendBlock(name: string): void;
  friendUnblock(acc: number): void;
  /** Ask for a fresh view (opening the window). */
  friendList(): void;

  // Channels (the server checks every rule; see server/channels.ts). The list comes back as a hook on the backend.
  /** Ask for the channel window's list (answered through `onChannels`). */
  chList(): void;
  /** Switch to channel `ch` of this map (out of combat for CH_SWITCH_CALM seconds, room in it). */
  chSwitch(ch: number): void;
  /** Go to the channel of this friend / party member (online, same map). */
  chJoin(name: string): void;
  onChannels: ((view: ChannelsView) => void) | null;

  // Boss rooms (the server checks every rule; see server/bossRooms.ts).
  /** Put this many keys into the summoner you stand next to (`quest`: the bound quest key, ×1). */
  roomOpen(keys: number, quest?: boolean): void;
  /** The Seeker's key quests (the server checks you stand by him). */
  questAccept(boss: string): void;
  questTurnIn(boss: string): void;
  /** The Seeker's gear quests by quest id (src/shared/gearQuests.ts; the server checks you stand by him). */
  gearAccept(id: string): void;
  gearTurnIn(id: string): void;
  /** Tutorial quests: take / hand in a step at its NPC (the server checks the distance and the state). */
  tutAccept(step: TutStep): void;
  tutTurnIn(step: TutStep): void;
  buyPhoenix(n: number): void;
  /** Dead in a boss room: get up here for one phoenix feather. */
  roomRevive(): void;
  /** Leave a boss room through its portal (the boss dead, standing near it). Comes out by the summoner. */
  roomLeave(): void;
  roomAnswer(id: number, yes: boolean): void;
  roomStart(): void;
  roomCancel(): void;
}
