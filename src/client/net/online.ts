// Multiplayer: a mirror of the server's world. The server simulates everything; this keeps local
// copies of nearby players, monsters, projectiles and loot (real shared classes, so the views, HUD
// and Auto Play work unchanged), smooths their movement between snapshots, and walks your own
// character immediately so controls feel instant. The server checks every reported position.
import { Terrain } from '../../shared/sim/terrain';
import { Player, type AutoSettings, type CharacterData, type LootFilter, type SortKey } from '../../shared/sim/Player';
import { Monster } from '../../shared/sim/Monster';
import { Loot } from '../../shared/sim/Loot';
import type { Sim } from '../../shared/sim/Sim';
import type { Intent, SimEvent } from '../../shared/sim/types';
import { MONSTERS } from '../../shared/data/monsters';
import { zoneById, type SpawnArea, type ZoneDef } from '../../shared/data/zones';
import type { NpcId } from '../../shared/data/npcs';
import type { EquipSlot, Item, PotionKind, PotionSize, Rarity, Vec2 } from '../../shared/types';
import type { SkillSlot } from '../../shared/data/classes';
import { INPUT_HZ, PING_MS, WS_PATH, type ClientMsg, type ServerMsg, type ShutdownMode, type SnapshotMsg } from '../../shared/net/protocol';
import type { Backend, EnhanceOutcome, ProjectileLike } from '../backend';
import type { RerollKind } from '../../shared/data/reroll';
import type { Hazard } from '../../shared/sim/volcanoHeart';
import type { MarketCall, MarketReply } from '../../shared/sim/market';

/** Mirrors never run game logic, so they don't need a simulation behind them. */
const NO_SIM = null as unknown as Sim;
const NO_AREA: SpawnArea = { monster: '', x: 0, z: 0, radius: 1, count: 1, respawn: [0, 0] };
/** Remote things jump instead of gliding when they are this far off (teleports, respawns). */
const SNAP_DIST = 5;
/**
 * Our own character is moved onto the server's position when they disagree by this much. Compared with
 * where we were when we sent the input the server answered (PrivateSnap.ack), not where we are now,
 * so lag alone never triggers it. A little slack: the server may walk on for a few ticks between inputs.
 */
const CORRECT_DIST = 2.5;
/** Without an ack (older server), the gap to our current position also includes a round trip of walking. */
const CORRECT_DIST_NO_ACK = 3;
/** Positions we sent and the server hasn't answered yet; older ones are dropped (about 3 s). */
const SENT_KEEP = 90;
/** After the server stops moving us, we glide onto its position until this close, or for at most SETTLE_MAX seconds. */
const SETTLE_DIST = 0.15;
const SETTLE_MAX = 0.5;
/** A ping with no pong after this long no longer holds back the next one (its pong still counts if it comes). */
const PING_GIVE_UP_MS = 10_000;
/** Unanswered pings remembered at most (the oldest is dropped). */
const PING_KEEP = 8;
/**
 * Events still applied while the tab is hidden (the server keeps playing Auto). Everything else is a
 * notification nobody saw — dropped so it doesn't all pop at once when the player comes back.
 */
const HIDDEN_KEEP = new Set<SimEvent['t']>(['inventory', 'stash', 'died', 'revived', 'save', 'travel', 'autoOff']);

interface MirrorProjectile extends ProjectileLike {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}${WS_PATH}`;
}

/** Opens the connection, joins with the chosen character and resolves once the first snapshot arrives. */
export function connectOnline(token: string, characterId: number): Promise<OnlineBackend> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl());
    let you = -1;
    let zone = '';
    let guest = false;
    let settled = false;
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(msg));
      ws.close();
    };
    const timer = setTimeout(() => fail('server ไม่ตอบกลับ ลองใหม่อีกครั้ง'), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId } satisfies ClientMsg));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string) as ServerMsg;
      if (m.t === 'kick') return fail(m.msg);
      if (m.t === 'welcome') {
        you = m.you;
        zone = m.zone;
        guest = m.guest === true;
      }
      if (m.t === 'snap' && you >= 0 && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(new OnlineBackend(ws, you, zone, m, guest));
      }
    };
    ws.onerror = () => fail('เชื่อมต่อ server ไม่ได้');
    ws.onclose = () => fail('การเชื่อมต่อถูกปิด');
  });
}

export class OnlineBackend implements Backend {
  readonly online = true;
  readonly guest: boolean;
  zone: ZoneDef;
  terrain: Terrain;
  me: Player;
  players: Player[] = [];
  monsters: Monster[] = [];
  projectiles: MirrorProjectile[] = [];
  loots: Loot[] = [];
  onlineCount = 1;
  /** Hooks for the game screen. */
  onChat: ((name: string, text: string) => void) | null = null;
  onDisconnect: ((msg: string) => void) | null = null;
  /** An announcement from the server's owner. */
  onAnnounce: ((text: string, from: string, direct: boolean) => void) | null = null;
  /**
   * The server stops or restarts in `seconds` (sent once a second); null = cancelled. `text` is the
   * line to show, with the time filled in by the server (the owner's wording); absent = the default.
   */
  onShutdown: ((mode: ShutdownMode, seconds: number | null, text?: string) => void) | null = null;

  private readonly playerMap = new Map<number, Player>();
  private readonly monsterMap = new Map<number, Monster>();
  private readonly projMap = new Map<number, MirrorProjectile>();
  private readonly lootMap = new Map<number, Loot>();
  /** Latest server position of each remote entity; mirrors glide toward it. */
  private readonly targets = new Map<object, Vec2>();
  private events: SimEvent[] = [];
  hazards: readonly Hazard[] = [];
  /** From the last snapshot, counted down locally in between (see bossRespawnIn). */
  private bossIn: number | null = null;
  private bossInAt = 0;

  get bossRespawnIn(): number | null {
    return this.bossIn === null ? null : Math.max(0, this.bossIn - (performance.now() - this.bossInAt) / 1000);
  }
  private serverTime = 0;
  private serverTimeAt = performance.now();
  private serverMoves = false;
  /**
   * The server just stopped moving us (end of a dash, knockback, Auto): we glide the rest of the way
   * to where it put us before walking again, so we start from exactly its position.
   */
  private settling = false;
  private settleT = 0;
  private epoch = 0;
  private faceLockT = 0;
  private sendT = 0;
  private seq = 0;
  /** Where we said we were in each input message still waiting for its snapshot. */
  private sent: { seq: number; x: number; z: number }[] = [];
  private pendingDash = false;
  private filterPending = false;
  private autoSetPending = false;
  private pendingPotion: 'hp' | 'mp' | null = null;
  private enhanceReq = 0;
  private marketReq = 0;
  private readonly marketWait = new Map<number, (r: MarketReply) => void>();
  marketBox = 0;
  /** Something of yours sold or expired at the market. */
  onMarketNote: ((text: string, sub?: string) => void) | null = null;
  private readonly enhanceWait = new Map<number, (o: EnhanceOutcome) => void>();
  private readonly rerollWait = new Map<number, (item: Item | null) => void>();
  private kickMsg = '';
  /** Last measured round trip (ms), shown on the HUD. */
  private rtt: number | null = null;
  /** The worst round trip measured since the last ping, reported with the next one (each only once). */
  private freshRtt: number | null = null;
  /** Pings still waiting for their pong: id → when it was sent. */
  private readonly pingsOut = new Map<number, number>();
  private pingId = 0;
  private lastPingAt = -Infinity;
  private readonly pingTimer: ReturnType<typeof setInterval>;
  /** Frames drawn since the last ping, the longest one (ms), and whether the tab was hidden meanwhile. */
  private frames = 0;
  private maxFrame = 0;
  private lastFrameAt = 0;
  private statsFrom = performance.now();
  private wasHidden = document.hidden;
  private readonly onVisibility = () => {
    // The game loop stops in a background tab; that gap isn't a frame.
    this.lastFrameAt = 0;
    if (document.hidden) this.wasHidden = true;
  };

  constructor(private readonly ws: WebSocket, private myId: number, zoneId: string, first: SnapshotMsg, guest: boolean) {
    this.guest = guest;
    this.zone = zoneById(zoneId);
    this.terrain = new Terrain(this.zone);
    const mine = first.players.find((p) => p.id === myId)!;
    const data: CharacterData = {
      name: mine.name, classId: mine.cls, level: first.me.level, exp: first.me.exp, gold: first.me.gold,
      potSel: first.me.potSel, lootFilter: first.me.lootFilter, autoSettings: first.me.autoSettings,
      equipment: first.me.inv?.equipment ?? {}, bag: first.me.inv?.bag ?? [], zone: this.zone.id,
      buyback: first.me.inv?.buyback, buybackLeft: first.me.buybackLeft,
    };
    this.me = new Player(myId, NO_SIM, data);
    this.me.x = mine.x;
    this.me.z = mine.z;
    this.playerMap.set(myId, this.me);
    this.epoch = first.me.epoch;
    this.applySnapshot(first);
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as ServerMsg);
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.onDisconnect?.(this.kickMsg || 'หลุดการเชื่อมต่อจาก server');
    };
    // A timer rather than the frame loop, so it keeps measuring (for the server's lag log) in a hidden tab.
    // The first one waits PING_MS: right now the game is still being built, which would delay the pong.
    this.pingTimer = setInterval(() => this.sendPing(), PING_MS);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get time(): number {
    return this.serverTime + (performance.now() - this.serverTimeAt) / 1000;
  }

  private send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Round trip to the server in ms, or null when disconnected or not measured yet. */
  get ping(): number | null {
    if (this.ws.readyState !== WebSocket.OPEN) return null;
    // A pong that is overdue already says the connection is at least this slow.
    return this.rtt === null ? null : Math.round(Math.max(this.rtt, this.pingWaiting()));
  }

  /** How long the oldest unanswered ping has waited (ms), 0 if none. */
  private pingWaiting(): number {
    const oldest = this.pingsOut.values().next();
    return oldest.done ? 0 : performance.now() - oldest.value;
  }

  /** Called by the game loop once per drawn frame, for the frame rate and stalls sent with each ping. */
  drewFrame(now: number): void {
    if (this.lastFrameAt) this.maxFrame = Math.max(this.maxFrame, now - this.lastFrameAt);
    this.lastFrameAt = now;
    this.frames++;
  }

  /** The WebGL renderer name, sent once for the server log. */
  reportGpu(name: string): void {
    this.send({ t: 'client', gpu: name });
  }

  private sendPing(): void {
    // Only one ping in flight, so a stall shows up as one long round trip rather than a pile of pings.
    // After PING_GIVE_UP_MS (e.g. the server dropped it as too fast) another goes out, but the old
    // one stays remembered: its late pong still counts, and the wait is reported meanwhile.
    const wait = this.pingWaiting();
    if (wait > 0 && wait < PING_GIVE_UP_MS) return;
    const now = performance.now();
    // After the browser froze, timer calls it missed can come in a burst; the server would drop a
    // ping right behind the last one (rate limit) and we'd wait PING_GIVE_UP_MS for nothing.
    if (now - this.lastPingAt < PING_MS / 2) return;
    this.lastPingAt = now;
    const secs = (now - this.statsFrom) / 1000;
    const hidden = this.wasHidden || document.hidden;
    const id = ++this.pingId;
    this.pingsOut.set(id, now);
    if (this.pingsOut.size > PING_KEEP) this.pingsOut.delete(this.pingsOut.keys().next().value!);
    this.send({
      t: 'ping', id,
      rtt: this.freshRtt ?? undefined,
      wait: wait > 0 ? Math.round(wait) : undefined,
      fps: hidden || secs <= 0 ? undefined : Math.round((this.frames / secs) * 10) / 10,
      maxFrame: hidden ? undefined : Math.round(this.maxFrame),
      hidden: hidden || undefined,
    });
    this.freshRtt = null;
    this.frames = 0;
    this.maxFrame = 0;
    this.statsFrom = now;
    this.wasHidden = document.hidden;
  }

  close(): void {
    clearInterval(this.pingTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.onDisconnect = null;
    this.ws.close();
  }

  // ------------------------------------------------------------ incoming

  private onMessage(m: ServerMsg): void {
    switch (m.t) {
      case 'snap':
        this.applySnapshot(m);
        break;
      case 'chat':
        this.onChat?.(m.name, m.text);
        break;
      case 'enhanced': {
        const done = this.enhanceWait.get(m.req);
        this.enhanceWait.delete(m.req);
        done?.(m.result && m.item ? { result: m.result, item: m.item } : null);
        break;
      }
      case 'rerolled': {
        const done = this.rerollWait.get(m.req);
        this.rerollWait.delete(m.req);
        done?.(m.item);
        break;
      }
      case 'market': {
        const done = this.marketWait.get(m.req);
        this.marketWait.delete(m.req);
        const { t: _t, req: _r, ...reply } = m;
        done?.(reply);
        break;
      }
      case 'marketNote':
        this.onMarketNote?.(m.text, m.sub);
        break;
      case 'marketBox':
        this.marketBox = m.n;
        break;
      case 'kick':
        this.kickMsg = m.msg;
        break;
      case 'shutdown':
        this.onShutdown?.(m.mode, m.seconds, m.text);
        break;
      case 'announce':
        this.onAnnounce?.(m.text, m.from, m.direct);
        break;
      case 'shutdownCancel':
        this.onShutdown?.(m.mode, null);
        break;
      case 'pong': {
        const at = this.pingsOut.get(m.id);
        if (at === undefined) break;
        this.rtt = Math.round(performance.now() - at);
        this.freshRtt = Math.max(this.freshRtt ?? 0, this.rtt);
        // Pongs come back in order: any older ping still out was dropped by the server.
        for (const id of [...this.pingsOut.keys()]) if (id <= m.id) this.pingsOut.delete(id);
        break;
      }
      case 'zone':
        this.changeZone(m.zone, m.you, m.x, m.z);
        break;
    }
  }

  /** The server moved us through a portal. Everything we mirrored belongs to the old zone. */
  private changeZone(zoneId: string, you: number, x: number, z: number): void {
    const old = this.me;
    this.zone = zoneById(zoneId);
    this.terrain = new Terrain(this.zone);
    this.playerMap.clear();
    this.monsterMap.clear();
    this.projMap.clear();
    this.lootMap.clear();
    this.targets.clear();
    this.players = [];
    this.monsters = [];
    this.projectiles = [];
    this.loots = [];
    // The server gave us a new id in the new zone, so the mirror is a new Player too.
    const me = new Player(you, NO_SIM, { ...old.toData(), zone: this.zone.id });
    me.hp = old.hp;
    me.mp = old.mp;
    me.stats = old.stats;
    me.cd = old.cd;
    me.recast = old.recast;
    me.potCd = old.potCd;
    me.x = x;
    me.z = z;
    me.face(-x, -z);
    this.me = me;
    this.myId = you;
    this.sent = [];
    this.settling = false;
    this.playerMap.set(you, me);
    this.players = [me];
    this.faceLockT = 0;
  }

  private glide(o: object, x: number, z: number, cur: { x: number; z: number }): void {
    if (Math.hypot(cur.x - x, cur.z - z) > SNAP_DIST) {
      cur.x = x;
      cur.z = z;
    }
    this.targets.set(o, { x, z });
  }

  private applySnapshot(s: SnapshotMsg): void {
    this.serverTime = s.time;
    this.serverTimeAt = performance.now();
    this.onlineCount = s.online;
    this.hazards = s.hazards ?? [];
    this.bossIn = s.bossIn ?? null;
    this.bossInAt = performance.now();
    if (!document.hidden) this.events.push(...s.events);
    else {
      for (const ev of s.events) {
        // A new item still has to refresh the bag, just without its pop-up line.
        if (ev.t === 'item') this.events.push({ t: 'inventory', to: ev.to });
        else if (HIDDEN_KEEP.has(ev.t)) this.events.push(ev);
      }
    }

    // ---- players
    const seenP = new Set<number>();
    for (const ps of s.players) {
      seenP.add(ps.id);
      let p = this.playerMap.get(ps.id);
      if (!p) {
        p = new Player(ps.id, NO_SIM, {
          name: ps.name, classId: ps.cls, level: ps.lv, exp: 0, gold: 0, equipment: {}, bag: [],
        });
        p.x = ps.x;
        p.z = ps.z;
        this.playerMap.set(ps.id, p);
      }
      p.alive = ps.alive;
      p.dashT = ps.dash ? 1 : 0;
      p.aura = ps.aura ?? 0;
      if (ps.dash) p.dashKind = ps.dash;
      if (p === this.me) {
        this.applyMine(s, ps.x, ps.z, ps.fx, ps.fz, ps.mv);
        continue;
      }
      this.glide(p, ps.x, ps.z, p);
      p.level = ps.lv;
      p.hp = ps.hp;
      p.stats.maxHp = ps.maxHp;
      p.faceX = ps.fx;
      p.faceZ = ps.fz;
      p.moving = ps.mv;
    }
    for (const [id, p] of this.playerMap) {
      if (p !== this.me && !seenP.has(id)) {
        this.playerMap.delete(id);
        this.targets.delete(p);
      }
    }
    this.players = [...this.playerMap.values()];

    // ---- monsters
    const seenM = new Set<number>();
    for (const ms of s.monsters) {
      seenM.add(ms.id);
      let m = this.monsterMap.get(ms.id);
      if (!m) {
        const def = MONSTERS[ms.def];
        if (!def) continue;
        // The zone's boost too, so the HP bar's maximum matches the server's.
        m = new Monster(ms.id, def, ms.lv, NO_AREA, ms.x, ms.z, this.zone.monsterBoost);
        this.monsterMap.set(ms.id, m);
      }
      this.glide(m, ms.x, ms.z, m);
      m.faceX = ms.fx;
      m.faceZ = ms.fz;
      m.moving = ms.mv;
      m.alive = ms.alive;
      m.deadT = ms.deadT;
      m.hp = ms.hp;
      m.state = ms.st;
      m.windupT = ms.wind ? 1 : 0;
      m.enraged = ms.enr;
      m.lift = ms.y;
    }
    for (const [id, m] of this.monsterMap) {
      if (!seenM.has(id)) {
        this.monsterMap.delete(id);
        this.targets.delete(m);
      }
    }
    this.monsters = [...this.monsterMap.values()];

    // ---- projectiles (they fly straight, so keep them moving between snapshots)
    const seenPr = new Set<number>();
    for (const ps of s.projectiles) {
      seenPr.add(ps.id);
      const pr = this.projMap.get(ps.id);
      if (pr) {
        pr.x = ps.x;
        pr.z = ps.z;
      } else {
        this.projMap.set(ps.id, { id: ps.id, x: ps.x, z: ps.z, vx: ps.vx, vz: ps.vz, o: { color: ps.color, size: ps.size, art: ps.art } });
      }
    }
    for (const id of this.projMap.keys()) if (!seenPr.has(id)) this.projMap.delete(id);
    this.projectiles = [...this.projMap.values()];

    // ---- loot
    const seenL = new Set<number>();
    for (const ls of s.loots) {
      seenL.add(ls.id);
      let l = this.lootMap.get(ls.id);
      if (!l) {
        l = new Loot(ls.id, ls.x, ls.z, ls.fromX, ls.fromZ, ls.kind, { dropped: ls.dropped, owner: ls.owner ?? undefined, ownerUntil: ls.ownerUntil });
        this.lootMap.set(ls.id, l);
      }
      this.glide(l, ls.x, ls.z, l);
      l.t = ls.t;
      l.owner = ls.owner;
      l.ownerUntil = ls.ownerUntil;
    }
    for (const [id, l] of this.lootMap) {
      if (!seenL.has(id)) {
        this.lootMap.delete(id);
        this.targets.delete(l);
      }
    }
    this.loots = [...this.lootMap.values()];
  }

  /** Our own character: stats come from the server, position mostly from us. */
  private applyMine(s: SnapshotMsg, x: number, z: number, fx: number, fz: number, mv: boolean): void {
    const me = this.me;
    const pv = s.me;
    me.hp = pv.hp;
    me.mp = pv.mp;
    me.exp = pv.exp;
    me.level = pv.level;
    me.gold = pv.gold;
    me.potSel = { ...pv.potSel };
    if (!this.filterPending) me.lootFilter = pv.lootFilter;
    if (!this.autoSetPending && pv.autoSettings) me.autoSettings = pv.autoSettings;
    me.stats = pv.stats;
    me.cd = { ...pv.cd };
    me.recast = { ...pv.recast };
    me.potCd = pv.potCd;
    if (typeof pv.buybackLeft === 'number') me.buybackLeft = pv.buybackLeft;
    if (pv.inv) {
      me.equipment = pv.inv.equipment;
      me.bag = pv.inv.bag;
      me.buyback = pv.inv.buyback ?? [];
      this.events.push({ t: 'inventory', to: me.id });
    }
    if (pv.stash) {
      me.stash = pv.stash;
      this.events.push({ t: 'stash', to: me.id });
    }
    this.serverMoves = pv.serverMoves;
    if (pv.epoch !== this.epoch) {
      // Respawned (or otherwise teleported) by the server: jump there.
      this.epoch = pv.epoch;
      me.x = x;
      me.z = z;
      me.moveTarget = null;
      this.targets.delete(me);
      this.sent = [];
      this.settling = false;
    } else if (this.serverMoves || this.settling) {
      // The positions we sent meanwhile weren't ours to report, so they can't be compared with.
      this.glide(me, x, z, me);
      me.faceX = fx;
      me.faceZ = fz;
      me.moving = mv;
      this.sent = [];
      if (this.serverMoves) {
        this.settling = true;
        this.settleT = SETTLE_MAX;
      }
    } else {
      this.targets.delete(me);
      this.reconcile(pv.ack, x, z);
    }
  }

  /** Finishes the glide onto the position the server left us at, then hands walking back to us. */
  private settle(dt: number): void {
    const me = this.me;
    const t = this.targets.get(me);
    this.settleT -= dt;
    if (t && Math.hypot(t.x - me.x, t.z - me.z) > SETTLE_DIST && this.settleT > 0) return;
    if (t) {
      me.x = t.x;
      me.z = t.z;
    }
    this.targets.delete(me);
    this.settling = false;
  }

  /**
   * Checks the server's position against where we were when we sent the input it answers. The
   * server is a round trip behind us, so comparing with our current position would pull us back
   * whenever the connection lags (and the reports sent from there were then refused as too far).
   */
  private reconcile(ack: number | undefined, x: number, z: number): void {
    const me = this.me;
    if (ack === undefined) {
      if (Math.hypot(me.x - x, me.z - z) > CORRECT_DIST_NO_ACK) {
        me.x = x;
        me.z = z;
        me.moveTarget = null;
      }
      return;
    }
    while (this.sent.length && this.sent[0].seq < ack) this.sent.shift();
    const at = this.sent[0];
    if (!at || at.seq !== ack) return; // Nothing to compare with (just sent nothing, or it's too old).
    const dx = x - at.x;
    const dz = z - at.z;
    if (Math.hypot(dx, dz) <= CORRECT_DIST) return;
    // The server refused part of our walk: shift us by what it refused, keeping the walking done since.
    me.x += dx;
    me.z += dz;
    this.terrain.resolve(me);
    for (const s of this.sent) {
      s.x += dx;
      s.z += dz;
    }
  }

  // ------------------------------------------------------------ per frame

  frame(dt: number, it: Intent): SimEvent[] {
    // Smooth remote movement toward the latest snapshot.
    const k = 1 - Math.exp(-dt * 14);
    for (const [o, t] of this.targets) {
      const e = o as { x: number; z: number };
      e.x += (t.x - e.x) * k;
      e.z += (t.z - e.z) * k;
    }
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.z += pr.vz * dt;
    }
    for (const m of this.monsters) if (!m.alive) m.deadT += dt;
    for (const l of this.loots) l.t += dt;
    const me = this.me;
    for (const key of Object.keys(me.cd) as SkillSlot[]) me.cd[key] = Math.max(0, (me.cd[key] ?? 0) - dt);
    for (const key of Object.keys(me.recast) as SkillSlot[]) me.recast[key] = Math.max(0, (me.recast[key] ?? 0) - dt);
    me.potCd -= dt;

    if (this.settling && !this.serverMoves) this.settle(dt);
    const moveDir = this.walk(dt, it);

    if (it.dash) this.pendingDash = true;
    if (it.potion) this.pendingPotion = it.potion;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / INPUT_HZ;
      const seq = ++this.seq;
      // While the server moves us we only follow it, so there's no position of ours to report.
      const ours = !this.serverMoves && !this.settling;
      if (ours) {
        this.sent.push({ seq, x: me.x, z: me.z });
        if (this.sent.length > SENT_KEEP) this.sent.shift();
      }
      this.send({
        t: 'input', pos: ours ? { x: me.x, z: me.z } : undefined, seq, move: moveDir, aim: it.aim, basic: it.basic, skills: it.skills,
        dash: this.pendingDash, potion: this.pendingPotion,
      });
      this.pendingDash = false;
      this.pendingPotion = null;
    }

    const out = this.events;
    this.events = [];
    return out;
  }

  /** Walks our character right away (the same rules as the simulation). Returns the walk direction. */
  private walk(dt: number, it: Intent): Vec2 | null {
    const me = this.me;
    this.faceLockT -= dt;
    if (!me.alive || this.serverMoves || this.settling) return null;
    if (it.move) me.moveTarget = null;
    if (it.moveTo) me.moveTarget = { ...it.moveTo };
    let mx = 0;
    let mz = 0;
    let remaining = Infinity;
    if (it.move) {
      mx = it.move.x;
      mz = it.move.z;
    } else if (me.moveTarget) {
      const dx = me.moveTarget.x - me.x;
      const dz = me.moveTarget.z - me.z;
      remaining = Math.hypot(dx, dz);
      if (remaining < 0.15) me.moveTarget = null;
      else {
        mx = dx / remaining;
        mz = dz / remaining;
      }
    }
    const walking = mx !== 0 || mz !== 0;
    const moving = me.walkStep(mx, mz, remaining, dt, this.terrain);
    if (it.basic || it.skills.length) {
      this.faceLockT = 0.25;
    }
    if (this.faceLockT > 0) me.face(it.aim.x - me.x, it.aim.z - me.z);
    else if (walking) me.face(mx, mz);
    me.moving = moving;
    return walking ? { x: mx, z: mz } : null;
  }

  // ------------------------------------------------------------ actions (the server decides)

  respawn(): void { this.send({ t: 'act', a: 'respawn' }); }
  equip(i: number, slot?: EquipSlot): void { this.send({ t: 'act', a: 'equip', i, slot }); }
  unequip(slot: EquipSlot): void { this.send({ t: 'act', a: 'unequip', slot }); }
  drop(i: number): void { this.send({ t: 'act', a: 'drop', i }); }
  buyPotion(kind: PotionKind, size: PotionSize, n: number): void { this.send({ t: 'act', a: 'buy', kind, size, n }); }
  sortBag(key: SortKey, desc: boolean): void { this.send({ t: 'act', a: 'sort', key, desc }); }
  moveInBag(from: number, to: number): void { this.send({ t: 'act', a: 'move', from, to }); }
  setAuto(on: boolean): void { this.send({ t: 'act', a: 'auto', on }); }
  setLootFilter(filter: LootFilter): void {
    // Show the change right away; snapshots sent before the server saw it would otherwise flip it back.
    this.me.lootFilter = filter;
    this.filterPending = true;
    setTimeout(() => (this.filterPending = false), 800);
    this.send({ t: 'act', a: 'lootFilter', filter });
  }
  setAutoSettings(settings: AutoSettings): void {
    this.me.autoSettings = settings;
    this.autoSetPending = true;
    setTimeout(() => (this.autoSetPending = false), 800);
    this.send({ t: 'act', a: 'autoSettings', settings });
  }
  sell(i: number): void { this.send({ t: 'act', a: 'sell', i }); }
  buyBack(i: number, uid: string): void { this.send({ t: 'act', a: 'buyBack', i, uid }); }
  sellAllOfRarity(rarity: Rarity): void { this.send({ t: 'act', a: 'sellRarity', rarity }); }
  stashPut(i: number, to: number): void { this.send({ t: 'act', a: 'stashPut', i, to }); }
  stashTake(i: number, to: number): void { this.send({ t: 'act', a: 'stashTake', i, to }); }
  stashMove(from: number, to: number): void { this.send({ t: 'act', a: 'stashMove', from, to }); }
  stashSort(key: SortKey, desc: boolean): void { this.send({ t: 'act', a: 'stashSort', key, desc }); }
  stashBuyRow(): void { this.send({ t: 'act', a: 'stashBuy' }); }
  stashGold(amount: number): void { this.send({ t: 'act', a: 'stashGold', amount }); }

  enhance(uid: string, protect: boolean): Promise<EnhanceOutcome> {
    const req = ++this.enhanceReq;
    this.send({ t: 'act', a: 'enhance', uid, protect, req });
    return new Promise((resolve) => {
      this.enhanceWait.set(req, resolve);
      setTimeout(() => {
        if (this.enhanceWait.delete(req)) resolve(null);
      }, 5000);
    });
  }

  reroll(uid: string, kind: RerollKind): Promise<Item | null> {
    const req = ++this.enhanceReq;
    this.send({ t: 'act', a: 'reroll', uid, kind, req });
    return new Promise((resolve) => {
      this.rerollWait.set(req, resolve);
      setTimeout(() => {
        if (this.rerollWait.delete(req)) resolve(null);
      }, 5000);
    });
  }

  market(call: MarketCall): Promise<MarketReply> {
    const req = ++this.marketReq;
    this.send({ t: 'act', req, ...call });
    return new Promise((resolve) => {
      this.marketWait.set(req, resolve);
      setTimeout(() => {
        if (this.marketWait.delete(req)) resolve({ ok: false, msg: 'ตลาดไม่ตอบ ลองใหม่อีกครั้ง' });
      }, 8000);
    });
  }

  chat(text: string): void { this.send({ t: 'chat', text }); }

  npcDistance(id: NpcId): number {
    const n = this.terrain.npcPos[id];
    return n ? Math.hypot(this.me.x - n.x, this.me.z - n.z) : Infinity;
  }
}
