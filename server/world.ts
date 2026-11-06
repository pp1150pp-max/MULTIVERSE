// The shared online world: one Sim per zone, driven by the input of the players in it. Walking
// through a portal moves a player's session to the other zone's Sim. The server decides all combat,
// loot and EXP; clients only move their own character, and the server checks those moves are possible.
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { clientIp } from './clientIp';
import type { Db } from './db';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES, zoneById } from '../src/shared/data/zones';
import { SORT_KEYS, type LootFilter, type Player } from '../src/shared/sim/Player';
import { POTION_SIZES } from '../src/shared/data/potions';
import { IDLE_INTENT, type Intent, type SimEvent } from '../src/shared/sim/types';
import { AUTO_HINT_COLOR, AutoPlay, type AutoWorld } from '../src/shared/sim/autoplay';
import {
  CHAT_MAX, GPU_NAME_MAX, shutdownKick, type ShutdownMode, INTEREST_RADIUS, PING_MS, isSoftwareRenderer, SNAPSHOT_HZ, TICK_HZ, WS_PATH, r2,
  type ClientMsg, type InputMsg, type ActionMsg, type PrivateSnap, type ServerMsg, type SnapshotMsg,
} from '../src/shared/net/protocol';
import { RARITIES, SLOTS, type SlotId, type Vec2 } from '../src/shared/types';
import type { SkillSlot } from '../src/shared/data/classes';
import { cleanStash, type StashData } from '../src/shared/sim/stash';
import type { AdminOnline, AdminOnlineRow } from '../src/shared/admin';
import { banMessage } from '../src/shared/api';

const AUTOSAVE_MS = 30_000;
const GUEST_STASH_MSG = 'Guest ใช้คลังเก็บของไม่ได้ — สมัครสมาชิกเพื่อใช้คลัง (ตัวละครนี้จะย้ายไปอยู่ในบัญชีใหม่)';
const JOIN_TIMEOUT_MS = 10_000;
const SKILL_KEYS: SkillSlot[] = ['q', 'e', 'r'];

interface Session {
  ws: WebSocket;
  accountId: number;
  username: string;
  /** A guest character: no stash, and the account is deleted after a day offline. */
  guest: boolean;
  charId: number;
  /** The zone this session is playing in. */
  sim: Sim;
  player: Player;
  // Latest input; dash/potion are one-shot until the next tick uses them.
  move: Vec2 | null;
  aim: Vec2;
  basic: boolean;
  skills: SkillSlot[];
  dash: boolean;
  potion: 'hp' | 'mp' | null;
  /** Server-side Auto Play, when the player turned it on. */
  auto: AutoPlay | null;
  /** When the last input message arrived (a hidden browser tab stops sending them). */
  lastInputAt: number;
  /** Position the client reported and the server accepted, applied on the next tick. */
  pendingPos: Vec2 | null;
  lastPosAt: number;
  /** `seq` of the latest input message, echoed back in snapshots. */
  lastSeq: number;
  epoch: number;
  lastInv: string;
  lastStash: string;
  outbox: SimEvent[];
  lastChatAt: number;
  saveDue: number | null;
  /** Where the connection came from, for the owner's log only (never sent to anyone). */
  ip: string;
  /** What the client reported with its pings since the last per-minute log line (see onPing). */
  lastPingAt: number;
  rttSum: number;
  rttCount: number;
  fpsSum: number;
  fpsCount: number;
  maxFrame: number;
  maxWait: number;
  hidden: boolean;
  /** Last immediate lag/stall warning, for its throttle. */
  warnAt: number;
  gpuLogged: boolean;
  /** The latest report, for the admin page (the sums above reset every minute). */
  lastRtt: number | null;
  lastFps: number | null;
  /** The client's GPU name once it sent it. */
  gpu: string | null;
  /** When this connection joined (Date.now()); zone changes keep it, only a new join resets it. */
  joinedAt: number;
  /** Whole-session ping/FPS sums (the ones above reset every minute), and its play_sessions row. */
  totRtt: number;
  totRttN: number;
  totFps: number;
  totFpsN: number;
  playRow: number;
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const vec = (v: unknown): Vec2 | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.x !== 'number' || typeof o.z !== 'number' || !Number.isFinite(o.x) || !Number.isFinite(o.z)) return null;
  return { x: o.x, z: o.z };
};

/** Where an event happens, so far-away effects aren't sent to everyone. */
function eventPos(ev: SimEvent): Vec2 | null {
  if (ev.t === 'text' || ev.t === 'banner' || ev.t === 'sfx') return { x: ev.x, z: ev.z };
  if (ev.t === 'fx') {
    const a = ev.args as unknown[];
    return ev.name === 'puff' || ev.name === 'burst' ? { x: a[0] as number, z: a[2] as number } : { x: a[0] as number, z: a[1] as number };
  }
  return null;
}

/** While the server itself is moving a character, the client's reported position is ignored. */
function serverMoves(p: Player): boolean {
  return !p.alive || p.isDashing || p.stunT > 0 || Math.abs(p.kbx) + Math.abs(p.kbz) > 0.05;
}

/** Input older than this is treated as "let go of everything" so a stalled client doesn't keep walking. */
const INPUT_STALE_MS = 500;
/** The server log lists every online player's average ping this often. */
const PING_LOG_MS = 60_000;
/** A reported ping above this is logged right away, at most once per PING_WARN_EVERY_MS per player. */
const PING_WARN_MS = 300;
const PING_WARN_EVERY_MS = 30_000;
/** Reported round trips outside 0..this are junk and ignored. */
const PING_MAX_MS = 60_000;
/** A frame longer than this (the browser froze) is logged right away, throttled with the ping warning. */
const FRAME_STALL_MS = 1000;
/** Reported frame times and pong waits are cut to this; frame rates to FPS_MAX. */
const STALL_MAX_MS = 10 * 60_000;
const FPS_MAX = 1000;
/** "12.5 s" for long waits, "450 ms" for short ones. */
const fmtMs = (ms: number): string => (ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
/** A number the client sent, or undefined when it's missing or junk; cut to 0..max. */
const clamp = (v: unknown, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : undefined;

export class GameWorld {
  readonly sims = new Map(Object.values(ZONES).map((z) => [z.id, new Sim(z)]));
  private readonly sessions = new Set<Session>();
  private readonly byPlayer = new Map<Player, Session>();
  /**
   * One live stash per account with a character online, shared by all of them (the same object),
   * so nothing can be copied by having two characters open it.
   */
  private readonly stashes = new Map<number, StashData>();
  /** Set while the server counts down to stopping: no new players may join. */
  private closing: ShutdownMode | null = null;
  private last = performance.now();
  private tickN = 0;

  constructor(private readonly db: Db, http: HttpServer) {
    const wss = new WebSocketServer({ server: http, path: WS_PATH, maxPayload: 16 * 1024 });
    wss.on('connection', (ws, req) => this.onConnection(ws, req));
    setInterval(() => this.tick(), 1000 / TICK_HZ);
    setInterval(() => this.saveAll(), AUTOSAVE_MS);
    setInterval(() => this.logPings(), PING_LOG_MS);
  }

  get onlineCount(): number {
    return this.sessions.size;
  }

  // ------------------------------------------------------------ connections

  private send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const ip = clientIp(req);
    let session: Session | null = null;
    const timeout = setTimeout(() => {
      if (!session) ws.close();
    }, JOIN_TIMEOUT_MS);

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      if (!session) {
        if (msg.t !== 'join') return;
        session = this.join(ws, msg.token, msg.characterId, ip);
        clearTimeout(timeout);
        return;
      }
      try {
        if (msg.t === 'input') this.onInput(session, msg);
        else if (msg.t === 'act') this.onAction(session, msg);
        else if (msg.t === 'chat') this.onChat(session, msg.text);
        else if (msg.t === 'ping') this.onPing(session, msg);
        else if (msg.t === 'client') this.onClientInfo(session, msg);
      } catch (e) {
        console.error('[world] bad message from', session.username, e);
      }
    });
    ws.on('close', () => {
      clearTimeout(timeout);
      if (session) this.leave(session);
    });
    ws.on('error', () => ws.close());
  }

  private join(ws: WebSocket, token: unknown, characterId: unknown, ip: string): Session | null {
    const acc = typeof token === 'string' ? this.db.sessionAccount(token) : undefined;
    const charId = num(characterId, -1);
    const data = acc ? this.db.loadCharacter(acc.id, charId) : undefined;
    if (this.closing) {
      this.send(ws, { t: 'kick', msg: `Server กำลัง${this.closing === 'restart' ? 'รีสตาร์ท' : 'ปิด'} — รอสักครู่แล้วเข้าใหม่` });
      ws.close();
      return null;
    }
    const ban = acc && this.db.activeBan(acc.id);
    if (ban) {
      this.send(ws, { t: 'kick', msg: banMessage(ban.until, ban.reason) });
      ws.close();
      return null;
    }
    if (!acc || !data) {
      this.send(ws, { t: 'kick', msg: acc ? 'ไม่พบตัวละครนี้' : 'กรุณาเข้าสู่ระบบใหม่' });
      ws.close();
      return null;
    }
    // One character per account at a time: a new login takes over from the old one.
    for (const s of this.sessions) {
      if (s.accountId === acc.id) {
        this.send(s.ws, { t: 'kick', msg: 'บัญชีนี้เข้าเกมจากที่อื่น' });
        this.leave(s);
        s.ws.close();
      }
    }
    const sim = this.sims.get(zoneById(data.zone).id)!;
    const player = sim.addPlayer(data);
    this.db.touchOnline(acc.id);
    if (acc.guest) {
      // Guests can't use the stash (onAction refuses it); this empty one is never saved.
      player.stash = cleanStash(null);
    } else {
      let stash = this.stashes.get(acc.id);
      if (!stash) {
        stash = this.db.loadStash(acc.id);
        this.stashes.set(acc.id, stash);
      }
      player.stash = stash;
    }
    const s: Session = {
      ws, accountId: acc.id, username: acc.username, guest: acc.guest, charId, sim, player,
      move: null, aim: { x: player.x, z: player.z }, basic: false, skills: [], dash: false, potion: null,
      auto: null, lastInputAt: 0, pendingPos: null, lastPosAt: performance.now(), lastSeq: 0, epoch: 0, lastInv: '', lastStash: '', outbox: [], lastChatAt: 0, saveDue: null,
      ip, lastPingAt: -Infinity, rttSum: 0, rttCount: 0, fpsSum: 0, fpsCount: 0, maxFrame: 0, maxWait: 0,
      hidden: false, warnAt: -Infinity, gpuLogged: false, lastRtt: null, lastFps: null, gpu: null, joinedAt: Date.now(),
      totRtt: 0, totRttN: 0, totFps: 0, totFpsN: 0, playRow: -1,
    };
    try {
      s.playRow = this.db.startPlaySession({ accountId: acc.id, username: acc.username, guest: acc.guest, charId, charName: player.name, ip });
    } catch (e) {
      console.error('[world] recording the play session failed', e);
    }
    this.sessions.add(s);
    this.byPlayer.set(player, s);
    this.send(ws, { t: 'welcome', you: player.id, time: sim.time, zone: sim.zone.id, guest: acc.guest });
    this.broadcastSystem(`${player.name} เข้าสู่โลก`);
    console.log(`[world] ${acc.username} joined as ${player.name}${acc.guest ? ' (guest)' : ''} from ${ip} (${this.sessions.size} online)`);
    return s;
  }

  private leave(s: Session): void {
    if (!this.sessions.has(s)) return;
    this.save(s);
    if (s.playRow >= 0) {
      try {
        this.db.endPlaySession(s.playRow, {
          gpu: s.gpu,
          avgRtt: s.totRttN ? Math.round(s.totRtt / s.totRttN) : null,
          avgFps: s.totFpsN ? Math.round(s.totFps / s.totFpsN) : null,
        });
      } catch (e) {
        console.error('[world] closing the play session failed', e);
      }
    }
    this.sessions.delete(s);
    this.byPlayer.delete(s.player);
    s.sim.removePlayer(s.player);
    // Saved above; drop it from memory once nobody on the account is online.
    if (![...this.sessions].some((o) => o.accountId === s.accountId)) this.stashes.delete(s.accountId);
    this.broadcastSystem(`${s.player.name} ออกจากเกม`);
    console.log(`[world] ${s.username} left (${this.sessions.size} online)`);
  }

  /** Ends the game of whoever plays on this account (saving it first), e.g. before the account changes. */
  kickAccount(accountId: number, msg: string): void {
    for (const s of [...this.sessions]) {
      if (s.accountId !== accountId) continue;
      this.send(s.ws, { t: 'kick', msg });
      this.leave(s);
      s.ws.close();
    }
  }

  /** The live stash of an account with someone online (the saved one may be up to 30 s old). */
  liveStash(accountId: number): StashData | undefined {
    return this.stashes.get(accountId);
  }

  /** An announcement from the admin page: a banner and a chat line for everyone in the world. */
  broadcast(text: string): number {
    for (const s of this.sessions) this.send(s.ws, { t: 'announce', text });
    return this.sessions.size;
  }

  /** play_sessions rows of everyone in the world now, with their GPU and averages so far. */
  openPlayRows(): Map<number, { gpu: string | null; avgRtt: number | null; avgFps: number | null }> {
    return new Map([...this.sessions].map((s) => [s.playRow, {
      gpu: s.gpu,
      avgRtt: s.totRttN ? Math.round(s.totRtt / s.totRttN) : null,
      avgFps: s.totFpsN ? Math.round(s.totFps / s.totFpsN) : null,
    }]));
  }

  /** Who is online right now, for the minute samples behind the admin graphs. */
  sample(): { total: number; zones: Record<string, number>; avgLevel: number | null; avgRtt: number | null } {
    const zones: Record<string, number> = {};
    let lv = 0;
    let rtt = 0;
    let rttN = 0;
    for (const s of this.sessions) {
      zones[s.sim.zone.id] = (zones[s.sim.zone.id] ?? 0) + 1;
      lv += s.player.level;
      if (s.lastRtt !== null) {
        rtt += s.lastRtt;
        rttN++;
      }
    }
    const n = this.sessions.size;
    return { total: n, zones, avgLevel: n ? lv / n : null, avgRtt: rttN ? rtt / rttN : null };
  }

  /** Accounts with a character in the world right now. */
  onlineAccounts(): number[] {
    return [...this.sessions].map((s) => s.accountId);
  }

  // ------------------------------------------------------------ messages

  private onInput(s: Session, m: InputMsg): void {
    const p = s.player;
    s.lastInputAt = performance.now();
    s.move = vec(m.move);
    s.aim = vec(m.aim) ?? s.aim;
    s.basic = m.basic === true;
    s.skills = Array.isArray(m.skills) ? SKILL_KEYS.filter((k) => m.skills.includes(k)) : [];
    if (m.dash === true) s.dash = true;
    if (m.potion === 'hp' || m.potion === 'mp') s.potion = m.potion;

    if (typeof m.seq === 'number' && Number.isSafeInteger(m.seq)) s.lastSeq = m.seq;

    const pos = vec(m.pos);
    const now = performance.now();
    if (!pos || serverMoves(p) || s.auto) {
      s.lastPosAt = now;
      return;
    }
    // Accept the move only if the character could have walked that far since the last one.
    const from = s.pendingPos ?? p;
    const maxStep = p.moveSpeed * Math.min((now - s.lastPosAt) / 1000, 0.5) * 1.4 + 0.3;
    if (Math.hypot(pos.x - from.x, pos.z - from.z) <= maxStep && !s.sim.terrain.isBlocked(pos.x, pos.z, 0)) {
      s.pendingPos = pos;
      s.lastPosAt = now;
    }
  }

  /**
   * Answers a ping so the client can time the round trip, and keeps what it reports for the log:
   * the round trip, how long a pong has been overdue, the frame rate and the longest frame. A slow
   * network shows a long round trip with smooth frames; a frozen browser shows long frames too.
   */
  private onPing(
    s: Session,
    m: { id?: unknown; rtt?: unknown; wait?: unknown; fps?: unknown; maxFrame?: unknown; hidden?: unknown },
  ): void {
    if (!this.sessions.has(s)) return; // A connection already taken over by a new login.
    const now = performance.now();
    const id = m.id;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 0) return;
    if (now - s.lastPingAt < PING_MS / 4) return; // Faster than any real client pings.
    s.lastPingAt = now;
    this.send(s.ws, { t: 'pong', id });

    const rtt = typeof m.rtt === 'number' && m.rtt >= 0 && m.rtt <= PING_MAX_MS ? m.rtt : undefined;
    const wait = clamp(m.wait, STALL_MAX_MS);
    const hidden = m.hidden === true;
    const fps = hidden ? undefined : clamp(m.fps, FPS_MAX);
    const maxFrame = hidden ? undefined : clamp(m.maxFrame, STALL_MAX_MS);
    s.lastRtt = rtt ?? s.lastRtt;
    s.lastFps = hidden ? null : (fps ?? s.lastFps);
    if (rtt !== undefined) {
      s.totRtt += rtt;
      s.totRttN++;
    }
    if (fps !== undefined) {
      s.totFps += fps;
      s.totFpsN++;
    }
    if (rtt !== undefined) {
      s.rttSum += rtt;
      s.rttCount++;
    }
    if (fps !== undefined) {
      s.fpsSum += fps;
      s.fpsCount++;
    }
    s.maxFrame = Math.max(s.maxFrame, maxFrame ?? 0);
    s.maxWait = Math.max(s.maxWait, wait ?? 0);
    if (hidden) s.hidden = true;

    const lagging = rtt !== undefined && rtt > PING_WARN_MS;
    const stalled = (wait ?? 0) > PING_WARN_MS;
    const froze = (maxFrame ?? 0) >= FRAME_STALL_MS;
    if (!(lagging || stalled || froze) || now - s.warnAt < PING_WARN_EVERY_MS) return;
    s.warnAt = now;
    const parts = [rtt !== undefined ? `ping ${fmtMs(rtt)}` : 'ping —'];
    if (wait) parts.push(`no pong for ${fmtMs(wait)}`);
    if (hidden) parts.push('tab hidden');
    else parts.push(`${fps !== undefined ? Math.round(fps) : '—'} fps`, `max frame ${fmtMs(maxFrame ?? 0)}`);
    const why = froze
      ? 'browser froze (device, not network)'
      : hidden
        ? 'lagging (tab hidden, no frame info)'
        : stalled
          ? 'connection stalled (frames OK: network)'
          : 'lagging (frames OK: network)';
    console.log(`[ping] ${s.username} (${s.player.name}): ${parts.join(' · ')} — ${why}`);
  }

  /** The client's GPU name, logged once per session; a software renderer makes the game stutter. */
  private onClientInfo(s: Session, m: { gpu?: unknown }): void {
    if (s.gpuLogged || typeof m.gpu !== 'string') return;
    s.gpuLogged = true;
    const gpu = m.gpu.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, GPU_NAME_MAX) || 'unknown';
    s.gpu = gpu;
    const note = isSoftwareRenderer(gpu) ? ' ⚠ SOFTWARE RENDERING: hardware acceleration is off, expect stutter' : '';
    console.log(`[client] ${s.username} (${s.player.name}) GPU: ${gpu}${note}`);
  }

  /** One log line a minute with each online player's average ping, frame rate and worst stall since the last one. */
  private logPings(): void {
    if (!this.sessions.size) return;
    const parts = [...this.sessions].map((s) => {
      const bits = [s.rttCount ? fmtMs(s.rttSum / s.rttCount) : '—'];
      if (s.fpsCount) bits.push(`${Math.round(s.fpsSum / s.fpsCount)} fps`, `max frame ${fmtMs(s.maxFrame)}`);
      if (s.maxWait) bits.push(`no pong up to ${fmtMs(s.maxWait)}`);
      if (s.hidden) bits.push(s.fpsCount ? 'tab hidden part of the time' : 'tab hidden');
      s.rttSum = s.rttCount = s.fpsSum = s.fpsCount = s.maxFrame = s.maxWait = 0;
      s.hidden = false;
      return `${s.username} (${s.player.name}) ${bits.join(' · ')}`;
    });
    console.log(`[ping] average over the last minute: ${parts.join(', ')}`);
  }

  private onAction(s: Session, m: ActionMsg): void {
    const p = s.player;
    const sim = s.sim;
    const i = num((m as { i?: unknown }).i, -1);
    if (s.guest && typeof m.a === 'string' && m.a.startsWith('stash')) {
      this.send(s.ws, { t: 'chat', name: '', text: GUEST_STASH_MSG });
      return;
    }
    switch (m.a) {
      case 'respawn':
        // Death turns Auto off (the browser does too), so the player doesn't run back to the farm spot.
        // Done here because dead players get no input, and the tab may have been hidden when they died.
        if (!p.alive) s.auto = null;
        sim.respawn(p);
        break;
      case 'equip':
        if (i >= 0 && i < p.bag.length) p.equipFromBag(i);
        break;
      case 'unequip':
        if (SLOTS.includes(m.slot as SlotId)) p.unequip(m.slot);
        break;
      case 'drop':
        if (i >= 0 && i < p.bag.length) sim.dropFromBag(p, i);
        break;
      case 'buy':
        if ((m.kind === 'hp' || m.kind === 'mp') && POTION_SIZES.includes(m.size)) {
          sim.buyPotion(p, m.kind, m.size, Math.max(0, Math.min(99, Math.floor(num(m.n)))));
        }
        break;
      case 'auto':
        s.auto = m.on === true && s.sim.zone.allowAutoPlay ? (s.auto ?? new AutoPlay()) : null;
        s.auto?.start(p.x, p.z);
        s.pendingPos = null;
        break;
      case 'autoSettings':
        // cleanAutoSettings clamps every field, so whatever the client sent is safe.
        sim.setAutoSettings(p, m.settings);
        break;
      case 'lootFilter': {
        const f = m.filter as Partial<LootFilter> | undefined;
        if (!f || !Array.isArray(f.rarities)) break;
        // Sim.setLootFilter runs `pots` through lootPots, which keeps only real sizes.
        sim.setLootFilter(p, { rarities: RARITIES.filter((r) => f.rarities!.includes(r)), potions: f.potions !== false, pots: f.pots });
        break;
      }
      case 'move': {
        const from = num(m.from, -1);
        const to = num(m.to, -1);
        if (Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= 0 && from < p.bag.length && to < p.bag.length) {
          sim.moveInBag(p, from, to);
        }
        break;
      }
      case 'sort':
        if (SORT_KEYS.includes(m.key)) sim.sortBag(p, m.key, m.desc === true);
        break;
      case 'buyBack':
        if (Number.isInteger(i) && i >= 0 && i < p.buyback.length && typeof m.uid === 'string') sim.buyBack(p, i, m.uid);
        break;
      case 'sell':
        if (i >= 0 && i < p.bag.length) sim.sellItem(p, i);
        break;
      case 'sellRarity':
        if (RARITIES.includes(m.rarity)) sim.sellAllOfRarity(p, m.rarity);
        break;
      // Stash: the Sim also checks the player stands by the keeper and is alive, and each slot and amount.
      case 'stashPut':
      case 'stashTake': {
        const to = num(m.to, -2);
        const max = m.a === 'stashPut' ? p.bag.length : p.stash.size;
        const toMax = m.a === 'stashPut' ? p.stash.size : p.bag.length;
        if (!Number.isInteger(i) || i < 0 || i >= max || !Number.isInteger(to) || to < -1 || to >= toMax) break;
        const ok = m.a === 'stashPut' ? sim.stashPut(p, i, to) : sim.stashTake(p, i, to);
        if (ok) this.save(s);
        break;
      }
      case 'stashMove': {
        const from = num(m.from, -1);
        const to = num(m.to, -1);
        const n = p.stash.size;
        if (Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= 0 && from < n && to < n && sim.stashMove(p, from, to)) {
          this.save(s);
        }
        break;
      }
      case 'stashSort':
        if (SORT_KEYS.includes(m.key) && sim.stashSort(p, m.key, m.desc === true)) this.save(s);
        break;
      case 'stashBuy':
        if (sim.stashBuyRow(p)) this.save(s);
        break;
      case 'stashGold': {
        const amount = num(m.amount);
        if (Number.isInteger(amount) && amount !== 0 && Math.abs(amount) <= 1e9 && sim.stashGold(p, amount)) this.save(s);
        break;
      }
      case 'enhance': {
        const out = typeof m.uid === 'string' ? sim.enhance(p, m.uid) : null;
        this.send(s.ws, { t: 'enhanced', req: num(m.req), result: out?.result ?? null, item: out?.item ?? null });
        break;
      }
    }
    s.saveDue ??= performance.now() + 2000;
  }

  private onChat(s: Session, text: unknown): void {
    if (typeof text !== 'string') return;
    const now = performance.now();
    if (now - s.lastChatAt < 600) return;
    const clean = text.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, CHAT_MAX);
    if (!clean) return;
    s.lastChatAt = now;
    for (const o of this.sessions) this.send(o.ws, { t: 'chat', name: s.player.name, text: clean });
    try {
      this.db.logChat({ accountId: s.accountId, username: s.guest ? 'Guest' : s.username, charName: s.player.name, zone: s.sim.zone.id, text: clean });
    } catch (e) {
      console.error('[world] logging chat failed', e);
    }
  }

  private broadcastSystem(text: string): void {
    for (const s of this.sessions) this.send(s.ws, { t: 'chat', name: '', text });
  }

  // ------------------------------------------------------------ simulation

  private intentOf = (p: Player): Intent => {
    const s = this.byPlayer.get(p);
    if (!s) return IDLE_INTENT;
    const fresh = performance.now() - s.lastInputAt < INPUT_STALE_MS;
    let it: Intent = {
      move: fresh ? s.move : null, moveTo: null, aim: s.aim,
      basic: fresh && s.basic, skills: fresh ? s.skills : [],
      dash: s.dash, potion: s.potion, pos: s.pendingPos,
    };
    if (s.auto) {
      const sim = s.sim;
      const world: AutoWorld = { player: p, monsters: sim.monsters, loots: sim.loots, time: sim.time, zone: sim.zone };
      it = s.auto.intent(world, { ...it, move: null, pos: null });
      const hint = s.auto.takeHint();
      if (hint) s.outbox.push({ t: 'log', msg: hint, color: AUTO_HINT_COLOR, to: p.id });
    }
    s.dash = false;
    s.potion = null;
    s.pendingPos = null;
    return it;
  };

  private tick(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const travels: { s: Session; zone: string }[] = [];
    for (const sim of this.sims.values()) {
      sim.step(dt, this.intentOf);
      for (const ev of sim.drainEvents()) {
        if (ev.t === 'save') {
          const s = this.sessionById(sim, ev.to);
          if (s) s.saveDue ??= now + 2000;
          continue;
        }
        if (ev.t === 'stash') continue; // saved by onAction; the snapshot carries the new stash
        if (ev.t === 'travel') {
          const s = this.sessionById(sim, ev.to);
          if (s) travels.push({ s, zone: ev.zone });
          continue;
        }
        if (ev.t === 'revived') {
          const s = this.sessionById(sim, ev.id);
          if (s) s.epoch++;
        }
        const at = eventPos(ev);
        const to = 'to' in ev ? ev.to : undefined;
        for (const s of this.sessions) {
          if (s.sim !== sim) continue;
          if (to !== undefined && to !== s.player.id) continue;
          if (at && Math.hypot(at.x - s.player.x, at.z - s.player.z) > INTEREST_RADIUS + 6) continue;
          s.outbox.push(ev);
        }
      }
    }
    for (const t of travels) this.travel(t.s, t.zone);

    if (++this.tickN % Math.round(TICK_HZ / SNAPSHOT_HZ) === 0) {
      for (const s of this.sessions) this.sendSnapshot(s);
    }
    for (const s of this.sessions) {
      if (s.saveDue !== null && now >= s.saveDue) this.save(s);
    }
  }

  /** Player ids are per zone, so look them up within one Sim. */
  private sessionById(sim: Sim, id: number): Session | undefined {
    for (const s of this.sessions) if (s.sim === sim && s.player.id === id) return s;
    return undefined;
  }

  /** Moves a session's character into another zone's Sim, keeping HP/MP. */
  private travel(s: Session, zoneId: string, atCamp = false): void {
    const dest = this.sims.get(zoneId);
    if (!dest || dest === s.sim || !this.sessions.has(s)) return;
    const old = s.player;
    const from = s.sim;
    from.removePlayer(old);
    this.byPlayer.delete(old);
    const p = dest.addPlayer(old.toData(), atCamp ? undefined : from.zone.id);
    p.hp = Math.min(old.hp, p.maxHp);
    p.mp = Math.min(old.mp, p.stats.maxMp);
    p.cd = { ...old.cd };
    p.potCd = old.potCd;
    p.stash = old.stash;
    s.sim = dest;
    s.player = p;
    this.byPlayer.set(p, s);
    s.move = null;
    s.basic = false;
    s.skills = [];
    // The browser turns Auto off when the zone changes; match it.
    s.auto = null;
    s.pendingPos = null;
    s.lastPosAt = performance.now();
    s.epoch++;
    s.lastInv = '';
    s.lastStash = '';
    s.outbox = [];
    this.send(s.ws, { t: 'zone', zone: dest.zone.id, you: p.id, x: r2(p.x), z: r2(p.z) });
    this.save(s);
    console.log(`[world] ${s.username} → ${dest.zone.name}`);
  }

  private sendSnapshot(s: Session): void {
    const p = s.player;
    const near = (o: { x: number; z: number }) => Math.hypot(o.x - p.x, o.z - p.z) <= INTEREST_RADIUS;
    const inv = JSON.stringify([p.equipment, p.bag, p.buyback]);
    const me: PrivateSnap = {
      hp: r2(p.hp), mp: r2(p.mp), exp: p.exp, level: p.level, gold: p.gold,
      potSel: p.potSel, lootFilter: p.lootFilter, autoSettings: p.autoSettings, stats: p.stats, cd: p.cd, potCd: r2(p.potCd),
      serverMoves: serverMoves(p) || !!s.auto, epoch: s.epoch, ack: s.lastSeq, buybackLeft: Math.round(p.buybackLeft),
    };
    if (inv !== s.lastInv) {
      s.lastInv = inv;
      me.inv = { equipment: p.equipment, bag: p.bag, buyback: p.buyback };
    }
    const stash = JSON.stringify(p.stash);
    if (stash !== s.lastStash) {
      s.lastStash = stash;
      me.stash = p.stash;
    }
    const sim = s.sim;
    const msg: SnapshotMsg = {
      t: 'snap',
      time: r2(sim.time),
      online: this.sessions.size,
      me,
      players: sim.players.filter(near).map((o) => ({
        id: o.id, name: o.name, cls: o.cls.id, lv: o.level,
        x: r2(o.x), z: r2(o.z), fx: r2(o.faceX), fz: r2(o.faceZ), mv: o.moving,
        alive: o.alive, hp: Math.round(o.hp), maxHp: Math.round(o.maxHp), dash: o.isDashing ? o.dashKind : 0,
      })),
      monsters: sim.monsters.filter(near).map((m) => ({
        id: m.id, def: m.def.id, lv: m.level,
        x: r2(m.x), z: r2(m.z), fx: r2(m.faceX), fz: r2(m.faceZ), mv: m.moving,
        alive: m.alive, deadT: r2(m.deadT), hp: Math.round(m.hp),
        st: m.state, wind: m.windupT > 0, enr: m.enraged, y: r2(m.lift),
      })),
      projectiles: sim.projectiles.filter(near).map((pr) => ({
        id: pr.id, x: r2(pr.x), z: r2(pr.z),
        vx: r2(Math.cos(pr.o.angle) * pr.o.speed), vz: r2(Math.sin(pr.o.angle) * pr.o.speed),
        color: pr.o.color, size: pr.o.size, art: pr.o.art,
      })),
      loots: sim.loots.filter(near).map((l) => ({
        id: l.id, x: r2(l.x), z: r2(l.z), fromX: r2(l.fromX), fromZ: r2(l.fromZ), t: r2(l.t),
        kind: l.kind, dropped: l.dropped, owner: l.owner, ownerUntil: r2(l.ownerUntil),
      })),
      events: s.outbox,
    };
    s.outbox = [];
    this.send(s.ws, msg);
  }

  // ------------------------------------------------------------ stopping the server (server/main.ts)

  get closingMode(): ShutdownMode | null {
    return this.closing;
  }

  /** From now on joins are refused; tells everyone the server stops in `seconds`. */
  announceShutdown(mode: ShutdownMode, seconds: number): void {
    this.closing = mode;
    for (const s of this.sessions) this.send(s.ws, { t: 'shutdown', mode, seconds });
  }

  /** The countdown was cancelled: joins are allowed again and everyone is told. */
  cancelShutdown(mode: ShutdownMode): void {
    this.closing = null;
    for (const s of this.sessions) this.send(s.ws, { t: 'shutdownCancel', mode });
  }

  /**
   * Saves every character (with its stash, like a normal logout) and closes every connection with a
   * message saying why. Returns how many were online.
   */
  closeAll(mode: ShutdownMode): number {
    this.closing = mode;
    const all = [...this.sessions];
    for (const s of all) {
      this.send(s.ws, { t: 'kick', msg: shutdownKick(mode) });
      this.leave(s);
      // 1012 = service restart, 1001 = going away.
      s.ws.close(mode === 'restart' ? 1012 : 1001, mode);
    }
    return all.length;
  }

  // ------------------------------------------------------------ admin page (server/admin.ts)

  /** Everyone in the world, with the connection numbers the admin page shows (IP included). */
  adminOnline(): AdminOnline {
    const zones = [...this.sims.values()].map((sim) => ({
      id: sim.zone.id, nameTh: sim.zone.nameTh, count: [...this.sessions].filter((s) => s.sim === sim).length,
    }));
    const players: AdminOnlineRow[] = [...this.sessions].map((s) => ({
      charId: s.charId, accountId: s.accountId, username: s.guest ? 'Guest' : s.username, guest: s.guest,
      name: s.player.name, classId: s.player.cls.id, level: s.player.level, zone: s.sim.zone.id,
      rtt: s.lastRtt === null ? null : Math.round(s.lastRtt),
      fps: s.lastFps === null ? null : Math.round(s.lastFps),
      maxFrame: s.fpsCount ? Math.round(s.maxFrame) : null,
      hidden: s.hidden, gpu: s.gpu, ip: s.ip, playedMs: Date.now() - s.joinedAt,
    }));
    return { zones, players };
  }

  private sessionOfChar(charId: number): Session | undefined {
    for (const s of this.sessions) if (s.charId === charId) return s;
    return undefined;
  }

  /** The live character, if it is in the world: edit this one (the next save would undo a DB edit). */
  livePlayer(charId: number): Player | undefined {
    return this.sessionOfChar(charId)?.player;
  }

  /** Saves an online character right away (after an admin edit) and tells its player in chat. */
  adminChanged(charId: number, msg: string): void {
    const s = this.sessionOfChar(charId);
    if (!s) return;
    this.save(s);
    this.send(s.ws, { t: 'chat', name: '', text: msg });
  }

  /** Ends one character's game (saving it first). Returns false when it isn't online. */
  kickCharacter(charId: number, msg: string): boolean {
    const s = this.sessionOfChar(charId);
    if (!s) return false;
    this.send(s.ws, { t: 'kick', msg });
    this.leave(s);
    s.ws.close();
    return true;
  }

  /** Moves an online character to another zone's camp. Returns false when it isn't online or is there already. */
  teleportCharacter(charId: number, zoneId: string): boolean {
    const s = this.sessionOfChar(charId);
    if (!s || !this.sims.has(zoneId) || s.sim.zone.id === zoneId) return false;
    this.travel(s, zoneId, true);
    return true;
  }

  // ------------------------------------------------------------ saving

  private save(s: Session): void {
    s.saveDue = null;
    try {
      if (s.guest) {
        this.db.saveCharacter(s.charId, s.player.toData());
      } else {
        // Together with the stash, so an item never ends up in both or neither.
        this.db.saveCharacterAndStash(s.charId, s.player.toData(), s.accountId, s.player.stash);
      }
      this.db.touchOnline(s.accountId);
    } catch (e) {
      console.error(`[world] saving ${s.player.name} failed`, e);
    }
  }

  saveAll(): void {
    for (const s of this.sessions) this.save(s);
  }
}
