// Channels: several copies (CH 1, CH 2, …) of a busy map, so players don't crowd one. Numbers and
// helpers shared by the server (which decides, server/channels.ts) and the browser (which shows them).
// Rules agreed with the owner: docs/systems/channels.md.
import type { ZoneDef } from './data/zones';

/** A channel takes up to this many players who come alone (or are placed automatically). */
export const CH_SOLO_CAP = 20;
/** A party member following their leader into the leader's channel may go up to this (party max is 3). */
export const CH_PARTY_CAP = 22;
/** Seconds out of combat (no hit taken, no attack or skill) before a player may switch channel. */
export const CH_SWITCH_CALM = 10;
/** A dropped connection back within this many ms returns to the same map, channel and spot. */
export const CH_RECONNECT_MS = 60_000;

/** Whether this map is split into channels (a per-zone setting: `ZoneDef.channels`). */
export const hasChannels = (zone: ZoneDef): boolean => zone.channels === true;

/** "ป่ามรกต · CH 2", or just the name for a map without channels. */
export const placeLabel = (zone: ZoneDef, ch: number): string => (hasChannels(zone) ? `${zone.nameTh} · CH ${ch}` : zone.nameTh);

/** One channel in the channel window: its number and how many players are in it. */
export interface ChannelRow {
  ch: number;
  n: number;
}

/** What the server answers when the channel window asks: the map you are on, your channel and every channel of it. */
export interface ChannelsView {
  zone: string;
  ch: number;
  list: ChannelRow[];
  /** Seconds until you may switch (0 = now). */
  wait: number;
}
