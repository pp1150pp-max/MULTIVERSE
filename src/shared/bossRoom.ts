// Boss rooms: the rules shared by the server (server/bossRooms.ts) and the browser (client/bossRoom.ts).
// A party leader (or a player on their own) puts 1–10 of a boss's keys into its summoner on the map;
// the party is invited, and those who accept go into a copy of the boss's room (a channel) together.

/** Keys one summoning takes at most (owner: 1–10). */
export const ROOM_KEYS_MAX = 10;
/** Seconds party members have to answer the invite (owner: 30). */
export const ROOM_INVITE_SECONDS = 30;
/** Seconds the leader has to press start before the summoning is called off and the keys given back. */
export const ROOM_LOBBY_SECONDS = 60;
/** Seconds after the boss dies before everyone is sent back to town (owner: 90). */
export const ROOM_END_SECONDS = 90;
/** Seconds a group that is all down has to get someone up with a phoenix feather before it has lost (owner: 5). */
export const ROOM_WIPE_SECONDS = 5;

/** How a member answered the invite. */
export type RoomAnswer = 'wait' | 'yes' | 'no';

/** The leader's lobby window (sent on every change, null when it closes). */
export interface RoomLobbyView {
  id: number;
  /** The boss's monster id. */
  boss: string;
  keys: number;
  /** Seconds left before the lobby is called off. */
  left: number;
  members: { name: string; answer: RoomAnswer }[];
}

/** Your boss room, in snapshots while you are in one. */
export interface RoomSnap {
  boss: string;
  keys: number;
  channel: number;
  /** Seconds until everyone is sent back to town (once the boss is dead). */
  leaveIn?: number;
  /** How many more times you may get up here with a phoenix feather. */
  revives: number;
  /** Everyone is down: seconds left to get up before the group has lost. */
  wipeIn?: number;
}

/** The invite line (owner's pick: option ง). */
export const roomInviteText = (leader: string, boss: string, keys: number): string =>
  `หัวตี้ ${leader} เปิดประตูสู่ ${boss} ระดับ ×${keys} ไปด้วยกันไหม?`;

/** "หมี (Mini Boss)" → "หมี". */
export const bossShortName = (nameTh: string): string => nameTh.replace(/\s*\(.*\)/, '');
