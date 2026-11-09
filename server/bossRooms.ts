// Boss rooms: summoning, the party lobby, and the rooms themselves. Bosses no longer stand on the maps;
// each map has a summoner where they stood. A player puts 1–10 of that boss's keys in (they are gone at
// once); on their own they go straight in, a party leader's members are invited first (30 s to answer)
// and the leader starts or calls it off (the keys come back then). Everyone who accepted goes into a
// fresh copy of the boss's room (a channel: one Sim per group), with the boss's HP, attack and rewards
// times the keys. After the kill there are 90 s to pick things up (the portal home opens), then everyone
// is sent to town; a group that all lie dead at once has lost and is sent to town too.
//
// Everything is in memory (a restart sends everyone to town anyway and gives open lobbies' keys back).
// Keyed on character ids, because a player's id inside a Sim changes whenever they change zone.
import { Sim } from '../src/shared/sim/Sim';
import type { Player } from '../src/shared/sim/Player';
import { BOSS_ROOMS, ZONES } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { BOSS_KEY, STONE_NAME } from '../src/shared/data/stones';
import { SUMMONER_RANGE } from '../src/shared/sim/terrain';
import type { BossKey } from '../src/shared/types';
import {
  bossShortName, ROOM_END_SECONDS, ROOM_INVITE_SECONDS, ROOM_KEYS_MAX, ROOM_LOBBY_SECONDS,
  type RoomAnswer, type RoomLobbyView, type RoomSnap,
} from '../src/shared/bossRoom';

/** A character in the world, as far as boss rooms care. `player` / `sim` are the live ones. */
export interface RoomActor {
  charId: number;
  name: string;
  player: Player;
  sim: Sim;
}

/** What the world does for the boss rooms. */
export interface RoomHost {
  actor(charId: number): RoomActor | undefined;
  /** This character's party: its leader and every member (online or not). */
  party(charId: number): { leader: number; members: { charId: number; name: string }[] } | undefined;
  tell(charId: number, text: string): void;
  invite(charId: number, id: number, from: string, boss: string, keys: number, seconds: number): void;
  inviteGone(charId: number, id: number): void;
  lobby(charId: number, view: RoomLobbyView | null): void;
  /** Moves these characters into the room's Sim (all of them at its entrance). */
  enter(charIds: number[], sim: Sim): void;
  /** Sends this player from its room back to town: the living walk out, the dead wake up there. */
  toTown(sim: Sim, player: Player): void;
  /** Gives keys back: into the bag if there is room (and the character is online), else by mail. */
  refund(charId: number, key: BossKey, n: number): void;
  save(charId: number): void;
}

interface Lobby {
  id: number;
  leader: number;
  leaderName: string;
  /** The map whose summoner was used. */
  field: string;
  boss: string;
  key: BossKey;
  keys: number;
  answers: Map<number, { name: string; answer: RoomAnswer }>;
  /** When (ms) unanswered invites count as "no", and when the lobby is called off. */
  inviteUntil: number;
  until: number;
}

export interface Run {
  sim: Sim;
  boss: string;
  keys: number;
  channel: number;
  /** When (ms) everyone is sent to town, once the boss is dead. */
  endAt: number | null;
}

export class BossRooms {
  private readonly lobbies = new Map<number, Lobby>();
  private readonly runs = new Map<Sim, Run>();
  private nextId = 1;

  constructor(private readonly host: RoomHost, private readonly now: () => number = () => Date.now()) {}

  /** Every room's Sim, for the world to step. */
  sims(): Sim[] {
    return [...this.runs.keys()];
  }

  run(sim: Sim): Run | undefined {
    return this.runs.get(sim);
  }

  /** What a player in this Sim sees of its room (undefined outside rooms). */
  snap(sim: Sim): RoomSnap | undefined {
    const r = this.runs.get(sim);
    if (!r) return undefined;
    const snap: RoomSnap = { boss: r.boss, keys: r.keys, channel: r.channel };
    if (r.endAt !== null) snap.leaveIn = Math.max(0, Math.ceil((r.endAt - this.now()) / 1000));
    return snap;
  }

  /** How many groups are in each room right now (for the admin page). */
  counts(): Map<string, number> {
    const out = new Map<string, number>();
    for (const r of this.runs.values()) out.set(r.sim.zone.id, (out.get(r.sim.zone.id) ?? 0) + 1);
    return out;
  }

  private lobbyOf(charId: number): Lobby | undefined {
    for (const l of this.lobbies.values()) if (l.leader === charId) return l;
    return undefined;
  }

  private inRoom(charId: number): boolean {
    const a = this.host.actor(charId);
    return !!a && this.runs.has(a.sim);
  }

  // ------------------------------------------------------------ actions (checked here; the world checks the types)

  /** Puts `keys` keys into the summoner the player stands next to. Returns a Thai error, or null. */
  open(charId: number, keys: unknown): string | null {
    const a = this.host.actor(charId);
    if (!a) return null;
    const p = a.player;
    const lair = a.sim.zone.lair;
    if (!p.alive) return 'ตายอยู่ ใส่กุญแจไม่ได้';
    if (!lair || Math.hypot(p.x - lair.x, p.z - lair.z) > SUMMONER_RANGE + 0.5) return 'ต้องยืนข้างแท่นเรียกบอสก่อน';
    if (typeof keys !== 'number' || !Number.isInteger(keys) || keys < 1 || keys > ROOM_KEYS_MAX) return `ใส่กุญแจได้ครั้งละ 1–${ROOM_KEYS_MAX} อัน`;
    if (this.lobbyOf(charId)) return 'คุณเปิดประตูห้องบอสค้างอยู่แล้ว — เริ่มหรือยกเลิกก่อน';
    const party = this.host.party(charId);
    if (party && party.leader !== charId) return 'ในปาร์ตี้ เฉพาะหัวตี้เท่านั้นที่ใส่กุญแจได้';
    const key = BOSS_KEY[lair.boss];
    const bossName = bossShortName(MONSTERS[lair.boss].nameTh);
    if (!key) return null;
    if (p.stoneCount(key) < keys) return `${STONE_NAME[key]}ไม่พอ (มี ${p.stoneCount(key)} อัน)`;
    // Gone at once (owner); given back only if the summoning is called off.
    p.takeStones(key, keys);
    this.host.save(charId);
    const field = a.sim.zone.id;
    const others = (party?.members ?? []).filter((m) => m.charId !== charId && this.host.actor(m.charId) && !this.inRoom(m.charId));
    if (!others.length) {
      this.startRun(field, lair.boss, keys, [charId]);
      return null;
    }
    const t = this.now();
    const lobby: Lobby = {
      id: this.nextId++, leader: charId, leaderName: a.name, field, boss: lair.boss, key, keys,
      answers: new Map(others.map((m) => [m.charId, { name: m.name, answer: 'wait' as RoomAnswer }])),
      inviteUntil: t + ROOM_INVITE_SECONDS * 1000, until: t + ROOM_LOBBY_SECONDS * 1000,
    };
    this.lobbies.set(lobby.id, lobby);
    for (const m of others) this.host.invite(m.charId, lobby.id, a.name, bossName, keys, ROOM_INVITE_SECONDS);
    this.host.tell(charId, `ใส่${STONE_NAME[key]} ×${keys} แล้ว — รอสมาชิกตอบรับ แล้วกดเริ่ม`);
    this.sendLobby(lobby);
    return null;
  }

  answer(charId: number, id: unknown, yes: unknown): string | null {
    const l = typeof id === 'number' ? this.lobbies.get(id) : undefined;
    const me = l?.answers.get(charId);
    if (!l || !me || typeof yes !== 'boolean') return null;
    this.host.inviteGone(charId, l.id);
    if (me.answer !== 'wait') return null;
    me.answer = yes ? 'yes' : 'no';
    this.host.tell(l.leader, `${me.name} ${yes ? 'ตอบรับ' : 'ปฏิเสธ'}การตีบอส`);
    this.sendLobby(l);
    return null;
  }

  start(charId: number): string | null {
    const l = this.lobbyOf(charId);
    if (!l) return null;
    const leader = this.host.actor(charId);
    if (!leader?.player.alive) return 'ตายอยู่ เริ่มไม่ได้';
    const party = this.host.party(charId);
    const going = [charId];
    for (const [id, m] of l.answers) {
      const a = this.host.actor(id);
      const still = party?.members.some((x) => x.charId === id);
      if (m.answer === 'yes' && a && a.player.alive && still && !this.inRoom(id)) going.push(id);
    }
    this.close(l, null);
    this.startRun(l.field, l.boss, l.keys, going);
    return null;
  }

  /** The leader called it off: the keys go back. */
  cancel(charId: number): string | null {
    const l = this.lobbyOf(charId);
    if (l) this.close(l, 'ยกเลิกการตีบอสแล้ว — คืนกุญแจให้หัวตี้');
    return null;
  }

  // ------------------------------------------------------------ the world tells us

  /** The character left the game or its party: its own lobby is called off, an invite to it counts as "no". */
  gone(charId: number): void {
    const own = this.lobbyOf(charId);
    if (own) this.close(own, `${own.leaderName} ออกจากปาร์ตี้หรือออกจากเกม — ยกเลิกการตีบอส คืนกุญแจแล้ว`);
    for (const l of this.lobbies.values()) {
      const m = l.answers.get(charId);
      if (!m || m.answer === 'no') continue;
      this.host.inviteGone(charId, l.id);
      m.answer = 'no';
      this.sendLobby(l);
    }
  }

  /** The server is stopping: every open lobby's keys go back now (before the characters are saved). */
  closeAll(): void {
    for (const l of [...this.lobbies.values()]) this.close(l, 'เซิร์ฟเวอร์กำลังปิด — คืนกุญแจแล้ว');
  }

  // ------------------------------------------------------------ time

  tick(): void {
    const t = this.now();
    for (const l of [...this.lobbies.values()]) {
      if (t >= l.until) {
        this.close(l, 'หัวตี้ไม่ได้กดเริ่มภายในเวลา — ยกเลิกการตีบอส คืนกุญแจแล้ว');
        continue;
      }
      if (t >= l.inviteUntil) {
        let changed = false;
        for (const [id, m] of l.answers) {
          if (m.answer !== 'wait') continue;
          m.answer = 'no';
          this.host.inviteGone(id, l.id);
          changed = true;
        }
        if (changed) this.sendLobby(l);
      }
    }
    for (const r of [...this.runs.values()]) this.tickRun(r, t);
  }

  private tickRun(r: Run, t: number): void {
    const sim = r.sim;
    if (!sim.players.length) {
      this.runs.delete(sim);
      return;
    }
    if (sim.cleared && r.endAt === null) {
      r.endAt = t + ROOM_END_SECONDS * 1000;
      for (const p of sim.players) {
        sim.log(`ปราบบอสสำเร็จ! เก็บของได้ ${ROOM_END_SECONDS} วินาทีก่อนกลับเมือง — ประตูออกเปิดแล้ว`, '#ffcf5a', p.id);
      }
    }
    // Everyone down at once (owner): the group has lost.
    const lost = !sim.cleared && sim.players.every((p) => !p.alive);
    if (lost) for (const p of sim.players) sim.log('ทีมพ่ายแพ้ — ทุกคนล้มลง กลับเมือง', '#ff6a5a', p.id);
    if (lost || (r.endAt !== null && t >= r.endAt)) {
      for (const p of [...sim.players]) this.host.toTown(sim, p);
    }
  }

  // ------------------------------------------------------------ helpers

  private startRun(field: string, boss: string, keys: number, charIds: number[]): void {
    const room = BOSS_ROOMS[field];
    if (!room) return;
    const used = new Set([...this.runs.values()].filter((r) => r.sim.zone.id === room.id).map((r) => r.channel));
    let channel = 1;
    while (used.has(channel)) channel++;
    const sim = new Sim(room, { keys });
    this.runs.set(sim, { sim, boss, keys, channel, endAt: null });
    this.host.enter(charIds, sim);
    const bossName = bossShortName(MONSTERS[boss].nameTh);
    for (const id of charIds) this.host.tell(id, `เข้าสู่${room.nameTh} — ${bossName} ระดับ ×${keys} (ห้อง ${channel})`);
    console.log(`[rooms] ${room.id} #${channel} x${keys}: ${charIds.length} player(s) (${ZONES[field]?.name ?? field})`);
  }

  /** Ends a lobby: `why` set = called off (the keys go back to the leader, everyone is told). */
  private close(l: Lobby, why: string | null): void {
    this.lobbies.delete(l.id);
    for (const [id, m] of l.answers) {
      if (m.answer === 'wait') this.host.inviteGone(id, l.id);
      if (why && m.answer === 'yes') this.host.tell(id, why);
    }
    this.host.lobby(l.leader, null);
    if (why) {
      this.host.refund(l.leader, l.key, l.keys);
      this.host.tell(l.leader, why);
    }
  }

  private sendLobby(l: Lobby): void {
    this.host.lobby(l.leader, {
      id: l.id, boss: l.boss, keys: l.keys, left: Math.max(0, Math.ceil((l.until - this.now()) / 1000)),
      members: [...l.answers.values()].map((m) => ({ name: m.name, answer: m.answer })),
    });
  }
}
