// Channels of the open maps: every zone has one Sim per channel (CH 1, CH 2, …). A zone without
// channels (hasChannels false: ZoneDef.channels unset, or the hub with its /admin switch off) has just CH 1
// (the hub keeps it open). This decides
// where someone entering a map goes, opens a channel when all are full, closes empty ones,
// remembers where a dropped connection was for CH_RECONNECT_MS, and checks a manual channel switch.
// It knows nothing of sessions or sockets (server/world.ts does), so tests can drive it with plain Sims.
// Rules agreed with the owner: docs/systems/channels.md.
import { Sim } from '../src/shared/sim/Sim';
import type { ZoneDef } from '../src/shared/data/zones';
import { CH_PARTY_CAP, CH_RECONNECT_MS, CH_RESERVED, CH_SOLO_CAP, CH_SWITCH_CALM, hasChannels, type ChannelRow } from '../src/shared/channels';

/**
 * When a player last fought (a hit taken, an attack or a skill), in wall-clock ms, for the
 * CH_SWITCH_CALM rule. Fed each tick with the player's latest lastHurt / lastAttack; those are Sim
 * times and start over in every new Sim, so moving tells it the new Player's value and the wall-clock
 * time carries over (hit, then walk through a portal, still has to wait).
 */
export class FightClock {
  private at = -Infinity;

  constructor(private mark: number) {}

  /** The player's latest lastHurt / lastAttack this tick; a newer one means it is fighting now. */
  seen(mark: number, now: number): void {
    if (mark <= this.mark) return;
    this.mark = mark;
    this.at = now;
  }

  /** Now another Player in another Sim (map or channel): start from its value. */
  moved(mark: number): void {
    this.mark = mark;
  }

  /** Seconds still to stay out of combat before a channel switch (0 = may switch now). */
  calmLeft(now: number): number {
    return Math.max(0, CH_SWITCH_CALM - (now - this.at) / 1000);
  }
}

/**
 * One copy of a map. Only its number for now; a channel with its own properties later (a bonus
 * channel, say) gets them here.
 */
export interface Channel {
  zone: ZoneDef;
  ch: number;
  sim: Sim;
}

/** Where a character's connection dropped (in memory only), to put it back there within CH_RECONNECT_MS. */
interface DropNote {
  zone: string;
  ch: number;
  x: number;
  z: number;
  until: number;
}

export interface PlaceOpts {
  /** The party leader's Sim: a member goes to the leader's channel when it is on this map (up to CH_PARTY_CAP). */
  leader?: Sim;
  /** A channel number to try first (the last one this player was in), if that channel exists and has room. */
  prefer?: number;
}

export class Channels {
  private readonly byZone = new Map<string, Channel[]>();
  private readonly bySim = new Map<Sim, Channel>();
  private readonly drops = new Map<number, DropNote>();
  /**
   * Treasure chests opened, by `<zone>:<ch>` (Sim.chestGone): kept here, not in the Sim, so a channel that closes when empty and opens
   * again does not refill every chest (docs/systems/chests-shrines.md).
   */
  private readonly chestStore = new Map<string, Map<string, number>>();
  /** Where those chests stand (Sim.chestSpots), kept the same way: an empty channel opened again has them where they were. */
  private readonly chestSpotStore = new Map<string, Sim['chestSpots']>();

  constructor(
    private readonly zones: ZoneDef[],
    /** Wall clock in ms (tests pass a fake one). */
    private readonly now: () => number = Date.now,
    private readonly makeSim: (zone: ZoneDef) => Sim = (zone) => new Sim(zone),
    /**
     * The zone as it is now (a published map layout changes ZONES while channels run). A channel keeps the ZoneDef it
     * was opened with; every channel opened afterwards takes this one. Default: the zone as given.
     */
    private readonly fresh: (zone: ZoneDef) => ZoneDef = (zone) => zone,
    /**
     * A zone that was not there at start (a map made in the editor and published later): looked up on first use. Such a zone
     * without channels does not keep its one channel open like the hub: it closes when empty and opens again on the next visit.
     */
    private readonly find: (zoneId: string) => ZoneDef | undefined = () => undefined,
  ) {
    for (const zone of zones) {
      this.byZone.set(zone.id, []);
      // A map with channels starts with none running (CH 1–10 are reserved slots, see list()); one without (the hub switched off) has its one.
      if (!hasChannels(zone)) this.open(zone, 1);
    }
  }

  /** Every channel's Sim, of every zone. */
  sims(): Sim[] {
    return [...this.bySim.keys()];
  }

  /** The channel this Sim is (undefined for a boss room or anything else not made here). */
  of(sim: Sim): Channel | undefined {
    return this.bySim.get(sim);
  }

  /** The channels of a zone, lowest number first (empty for a zone that isn't here). */
  channels(zoneId: string): Channel[] {
    return this.byZone.get(zoneId) ?? [];
  }

  get(zoneId: string, ch: number): Channel | undefined {
    return this.channels(zoneId).find((c) => c.ch === ch);
  }

  has(zoneId: string): boolean {
    return this.known(zoneId);
  }

  /** Is this a zone here (registering a late one, see `find`)? */
  private known(zoneId: string): boolean {
    if (this.byZone.has(zoneId)) return true;
    if (!this.find(zoneId)) return false;
    this.byZone.set(zoneId, []);
    return true;
  }

  /** A zone taken out of the game (hidden or deleted in the editor): its channels go. Move its players out first. */
  dropZone(zoneId: string): void {
    for (const c of [...(this.byZone.get(zoneId) ?? [])]) this.close(c);
    this.byZone.delete(zoneId);
    for (const [id, d] of this.drops) if (d.zone === zoneId) this.drops.delete(id);
  }

  /** Players in a channel (Auto Play counts like anyone). */
  count(c: Channel): number {
    return c.sim.players.length;
  }

  /** Each channel of a zone with its number of players, for the channel window and /admin. */
  list(zoneId: string): ChannelRow[] {
    const open = this.channels(zoneId);
    const zone = open[0]?.zone ?? this.zoneOf(zoneId);
    if (!zone || !hasChannels(zone)) return open.map((c) => ({ ch: c.ch, n: this.count(c) }));
    // CH 1–CH_RESERVED always show (no Sim behind a free one: 0 players); above that only the open ones.
    const rows: ChannelRow[] = [];
    for (let ch = 1; ch <= CH_RESERVED; ch++) rows.push({ ch, n: open.find((c) => c.ch === ch) ? this.count(open.find((c) => c.ch === ch)!) : 0 });
    for (const c of open) if (c.ch > CH_RESERVED) rows.push({ ch: c.ch, n: this.count(c) });
    return rows;
  }

  /**
   * The open channel `ch` of a zone, opening it (a fresh Sim, monsters respawned) when it is one of the
   * reserved CH 1–CH_RESERVED that nobody is in. Undefined for a number that is neither. Whoever calls
   * this must put a player in it, or call release().
   */
  ensure(zoneId: string, ch: number): Channel | undefined {
    const open = this.get(zoneId, ch);
    if (open) return open;
    if (!this.known(zoneId)) return undefined;
    const zone = this.zoneOf(zoneId);
    if (!zone || !hasChannels(zone) || !Number.isSafeInteger(ch) || ch < 1 || ch > CH_RESERVED) return undefined;
    return this.open(zone, ch);
  }

  /** Closes a channel opened by ensure() that ended up with nobody (a refused switch), unless it is held for a dropped player. */
  release(c: Channel): void {
    if (this.count(c) === 0 && !this.heldKeys().has(`${c.zone.id}|${c.ch}`)) this.close(c);
  }

  /**
   * The channel someone entering this zone goes to:
   *   1. a party member whose leader is on this map: the leader's channel, while it has fewer than CH_PARTY_CAP;
   *   2. `prefer` (the channel number they were last in), if this map has it and it has fewer than CH_SOLO_CAP;
   *   3. the open channel with the fewest players (below CH_SOLO_CAP; a tie: the lower number);
   *   4. none open, or all full: a new channel (the lowest free number).
   * A zone without channels always gives CH 1; on a farm map with no channel running, CH 1 opens. Undefined only for an unknown zone.
   */
  place(zoneId: string, opts: PlaceOpts = {}): Channel | undefined {
    if (!this.known(zoneId)) return undefined;
    const list = this.byZone.get(zoneId)!;
    const zone = this.zoneOf(zoneId);
    if (!zone) return undefined;
    // One room: CH 1. (The hub switched off while people were in its CH 2+: they stay there until they leave; newcomers go to CH 1.)
    if (!hasChannels(zone)) return list.find((c) => c.ch === 1) ?? this.open(zone, 1);
    const lead = opts.leader && this.bySim.get(opts.leader);
    if (lead && lead.zone.id === zone.id && this.count(lead) < CH_PARTY_CAP) return lead;
    const pref = opts.prefer !== undefined ? list.find((c) => c.ch === opts.prefer) : undefined;
    if (pref && this.count(pref) < CH_SOLO_CAP) return pref;
    let best: Channel | undefined;
    for (const c of list) if (this.count(c) < CH_SOLO_CAP && (!best || this.count(c) < this.count(best))) best = c;
    return best ?? this.open(zone);
  }

  /** How many players this channel takes from someone joining it (a member going to their leader: CH_PARTY_CAP). */
  capFor(target: Channel, leader?: Sim): number {
    return leader === target.sim ? CH_PARTY_CAP : CH_SOLO_CAP;
  }

  /**
   * Why a player may not move from channel `from` to `to` (null = they may). `calmLeft` is how many
   * seconds they still have to stay out of combat; `cap` comes from capFor.
   */
  switchError(alive: boolean, from: Channel | undefined, to: Channel | undefined, cap: number, calmLeft: number): string | null {
    if (!from || !hasChannels(from.zone)) return 'แมพนี้ไม่มีแชนแนล';
    if (!to || to.zone.id !== from.zone.id) return 'ไม่มีแชนแนลนี้ในแมพนี้';
    if (to === from) return `คุณอยู่ CH ${to.ch} อยู่แล้ว`;
    if (!alive) return 'ย้ายแชนแนลตอนตายไม่ได้';
    if (calmLeft > 0) return `ยังอยู่ในการต่อสู้ — ย้ายแชนแนลได้อีกใน ${Math.ceil(calmLeft)} วินาที`;
    if (this.count(to) >= cap) return `CH ${to.ch} เต็มแล้ว`;
    return null;
  }

  /**
   * Closes channels nobody is in (a reserved CH 1–10 goes back to a free slot), except one that a
   * dropped player may come back to and the hub's CH 1 while the hub is one room (its switch off; on, it closes like a farm map's). Players are never moved to merge channels. Returns the channels closed (for the log).
   */
  sweep(): Channel[] {
    const t = this.now();
    for (const [id, d] of this.drops) if (t >= d.until) this.drops.delete(id);
    const held = this.heldKeys();
    const closed: Channel[] = [];
    for (const [zoneId, list] of this.byZone) {
      for (const c of [...list]) {
        if (this.count(c) > 0 || held.has(`${zoneId}|${c.ch}`)) continue;
        if (c.ch === 1 && !hasChannels(c.zone) && this.zones.some((z) => z.id === zoneId)) {
          // The hub's only channel stays, but an empty one made before a map was published is made again with the new layout.
          if (this.fresh(c.zone) !== c.zone) {
            this.close(c);
            this.open(c.zone, c.ch);
          }
          continue;
        }
        this.close(c);
        closed.push(c);
      }
    }
    return closed;
  }

  // ------------------------------------------------------------ dropped connections

  /** A character's connection dropped while standing here: keep the spot (and the channel open) for CH_RECONNECT_MS. */
  dropped(charId: number, sim: Sim, x: number, z: number): void {
    const c = this.bySim.get(sim);
    if (!c) return;
    this.drops.set(charId, { zone: c.zone.id, ch: c.ch, x, z, until: this.now() + CH_RECONNECT_MS });
  }

  /** It left on purpose (or was kicked): it starts in the hub next time like everyone. */
  forget(charId: number): void {
    this.drops.delete(charId);
  }

  /**
   * A character joining again: where its dropped connection was, if that was less than CH_RECONNECT_MS
   * ago and the channel still has fewer than CH_PARTY_CAP players (else the lowest channel with room on
   * that map). Undefined = start in the hub as usual. Used once.
   */
  returning(charId: number): { channel: Channel; x: number; z: number } | undefined {
    const d = this.drops.get(charId);
    this.drops.delete(charId);
    if (!d || this.now() >= d.until) return undefined;
    const same = this.get(d.zone, d.ch);
    if (same && this.count(same) < CH_PARTY_CAP) return { channel: same, x: d.x, z: d.z };
    const other = this.place(d.zone, { prefer: d.ch });
    return other && { channel: other, x: d.x, z: d.z };
  }

  // ------------------------------------------------------------ helpers

  private zoneOf(zoneId: string): ZoneDef | undefined {
    return this.byZone.get(zoneId)?.[0]?.zone ?? this.zones.find((z) => z.id === zoneId) ?? this.find(zoneId);
  }

  private heldKeys(): Set<string> {
    return new Set([...this.drops.values()].map((d) => `${d.zone}|${d.ch}`));
  }

  private close(c: Channel): void {
    const list = this.byZone.get(c.zone.id)!;
    list.splice(list.indexOf(c), 1);
    this.bySim.delete(c.sim);
  }

  /** Opens channel `ch` of a zone (default: the lowest number not in use). */
  private open(oldZone: ZoneDef, ch?: number): Channel {
    const zone = this.fresh(oldZone);
    const list = this.byZone.get(zone.id)!;
    let n = ch ?? 1;
    if (ch === undefined) while (list.some((c) => c.ch === n)) n++;
    const c: Channel = { zone, ch: n, sim: this.makeSim(zone) };
    // Chests count in wall-clock seconds, the same for every channel and across a channel closing and opening again.
    const key = `${zone.id}:${n}`;
    let gone = this.chestStore.get(key);
    if (!gone) this.chestStore.set(key, (gone = new Map()));
    c.sim.chestGone = gone;
    let spots = this.chestSpotStore.get(key);
    if (!spots) this.chestSpotStore.set(key, (spots = new Map()));
    c.sim.chestSpots = spots;
    c.sim.chestClock = () => this.now() / 1000;
    list.push(c);
    list.sort((a, b) => a.ch - b.ch);
    this.bySim.set(c.sim, c);
    return c;
  }
}
