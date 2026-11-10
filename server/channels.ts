// Channels of the open maps: every zone has one Sim per channel (CH 1, CH 2, …). A zone without
// channels (ZoneDef.channels unset, e.g. the hub for now) simply always has just CH 1. This decides
// where someone entering a map goes, opens a channel when all are full, closes empty ones (never CH 1),
// remembers where a dropped connection was for CH_RECONNECT_MS, and checks a manual channel switch.
// It knows nothing of sessions or sockets (server/world.ts does), so tests can drive it with plain Sims.
// Rules agreed with the owner: docs/systems/channels.md.
import { Sim } from '../src/shared/sim/Sim';
import type { ZoneDef } from '../src/shared/data/zones';
import { CH_PARTY_CAP, CH_RECONNECT_MS, CH_SOLO_CAP, CH_SWITCH_CALM, hasChannels, type ChannelRow } from '../src/shared/channels';

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

  constructor(
    zones: ZoneDef[],
    /** Wall clock in ms (tests pass a fake one). */
    private readonly now: () => number = Date.now,
    private readonly makeSim: (zone: ZoneDef) => Sim = (zone) => new Sim(zone),
  ) {
    for (const zone of zones) {
      this.byZone.set(zone.id, []);
      this.open(zone, 1);
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
    return this.byZone.has(zoneId);
  }

  /** Players in a channel (Auto Play counts like anyone). */
  count(c: Channel): number {
    return c.sim.players.length;
  }

  /** Each channel of a zone with its number of players, for the channel window and /admin. */
  list(zoneId: string): ChannelRow[] {
    return this.channels(zoneId).map((c) => ({ ch: c.ch, n: this.count(c) }));
  }

  /**
   * The channel someone entering this zone goes to:
   *   1. a party member whose leader is on this map: the leader's channel, while it has fewer than CH_PARTY_CAP;
   *   2. `prefer` (the channel number they were last in), if this map has it and it has fewer than CH_SOLO_CAP;
   *   3. the lowest-numbered channel with fewer than CH_SOLO_CAP;
   *   4. all full: a new channel (the lowest free number).
   * A zone without channels always gives its only one. Undefined only for an unknown zone.
   */
  place(zoneId: string, opts: PlaceOpts = {}): Channel | undefined {
    const list = this.byZone.get(zoneId);
    if (!list?.length) return undefined;
    const zone = list[0].zone;
    if (!hasChannels(zone)) return list[0];
    const lead = opts.leader && this.bySim.get(opts.leader);
    if (lead && lead.zone === zone && this.count(lead) < CH_PARTY_CAP) return lead;
    const pref = opts.prefer !== undefined ? list.find((c) => c.ch === opts.prefer) : undefined;
    if (pref && this.count(pref) < CH_SOLO_CAP) return pref;
    return list.find((c) => this.count(c) < CH_SOLO_CAP) ?? this.open(zone);
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
    if (!to || to.zone !== from.zone) return 'ไม่มีแชนแนลนี้ในแมพนี้';
    if (to === from) return `คุณอยู่ CH ${to.ch} อยู่แล้ว`;
    if (!alive) return 'ย้ายแชนแนลตอนตายไม่ได้';
    if (calmLeft > 0) return `ยังอยู่ในการต่อสู้ — ย้ายแชนแนลได้อีกใน ${Math.ceil(calmLeft)} วินาที`;
    if (this.count(to) >= cap) return `CH ${to.ch} เต็มแล้ว`;
    return null;
  }

  /**
   * Closes channels nobody is in, except CH 1 of each map and one that a dropped player may come back
   * to. Players are never moved to merge channels. Returns the channels closed (for the log).
   */
  sweep(): Channel[] {
    const t = this.now();
    for (const [id, d] of this.drops) if (t >= d.until) this.drops.delete(id);
    const held = new Set([...this.drops.values()].map((d) => `${d.zone}|${d.ch}`));
    const closed: Channel[] = [];
    for (const [zoneId, list] of this.byZone) {
      for (const c of [...list]) {
        if (c.ch === 1 || this.count(c) > 0 || held.has(`${zoneId}|${c.ch}`)) continue;
        list.splice(list.indexOf(c), 1);
        this.bySim.delete(c.sim);
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

  /** Opens channel `ch` of a zone (default: the lowest number not in use). */
  private open(zone: ZoneDef, ch?: number): Channel {
    const list = this.byZone.get(zone.id)!;
    let n = ch ?? 1;
    if (ch === undefined) while (list.some((c) => c.ch === n)) n++;
    const c: Channel = { zone, ch: n, sim: this.makeSim(zone) };
    list.push(c);
    list.sort((a, b) => a.ch - b.ch);
    this.bySim.set(c.sim, c);
    return c;
  }
}
