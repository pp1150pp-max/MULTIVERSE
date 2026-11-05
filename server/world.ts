// The shared online world: one Sim per zone, driven by the input of the players in it. Walking
// through a portal moves a player's session to the other zone's Sim. The server decides all combat,
// loot and EXP; clients only move their own character, and the server checks those moves are possible.
import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { Db } from './db';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES, zoneById } from '../src/shared/data/zones';
import { SORT_KEYS, type LootFilter, type Player } from '../src/shared/sim/Player';
import { POTION_SIZES } from '../src/shared/data/potions';
import { IDLE_INTENT, type Intent, type SimEvent } from '../src/shared/sim/types';
import { AUTO_HINT_COLOR, AutoPlay, type AutoWorld } from '../src/shared/sim/autoplay';
import {
  CHAT_MAX, INTEREST_RADIUS, SNAPSHOT_HZ, TICK_HZ, WS_PATH, r2,
  type ClientMsg, type InputMsg, type ActionMsg, type PrivateSnap, type ServerMsg, type SnapshotMsg,
} from '../src/shared/net/protocol';
import { RARITIES, SLOTS, type SlotId, type Vec2 } from '../src/shared/types';
import type { SkillSlot } from '../src/shared/data/classes';

const AUTOSAVE_MS = 30_000;
const JOIN_TIMEOUT_MS = 10_000;
const SKILL_KEYS: SkillSlot[] = ['q', 'e', 'r'];

interface Session {
  ws: WebSocket;
  accountId: number;
  username: string;
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
  epoch: number;
  lastInv: string;
  outbox: SimEvent[];
  lastChatAt: number;
  saveDue: number | null;
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

export class GameWorld {
  readonly sims = new Map(Object.values(ZONES).map((z) => [z.id, new Sim(z)]));
  private readonly sessions = new Set<Session>();
  private readonly byPlayer = new Map<Player, Session>();
  private last = performance.now();
  private tickN = 0;

  constructor(private readonly db: Db, http: HttpServer) {
    const wss = new WebSocketServer({ server: http, path: WS_PATH, maxPayload: 16 * 1024 });
    wss.on('connection', (ws) => this.onConnection(ws));
    setInterval(() => this.tick(), 1000 / TICK_HZ);
    setInterval(() => this.saveAll(), AUTOSAVE_MS);
  }

  get onlineCount(): number {
    return this.sessions.size;
  }

  // ------------------------------------------------------------ connections

  private send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private onConnection(ws: WebSocket): void {
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
        session = this.join(ws, msg.token, msg.characterId);
        clearTimeout(timeout);
        return;
      }
      try {
        if (msg.t === 'input') this.onInput(session, msg);
        else if (msg.t === 'act') this.onAction(session, msg);
        else if (msg.t === 'chat') this.onChat(session, msg.text);
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

  private join(ws: WebSocket, token: unknown, characterId: unknown): Session | null {
    const acc = typeof token === 'string' ? this.db.sessionAccount(token) : undefined;
    const charId = num(characterId, -1);
    const data = acc ? this.db.loadCharacter(acc.id, charId) : undefined;
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
    const s: Session = {
      ws, accountId: acc.id, username: acc.username, charId, sim, player,
      move: null, aim: { x: player.x, z: player.z }, basic: false, skills: [], dash: false, potion: null,
      auto: null, lastInputAt: 0, pendingPos: null, lastPosAt: performance.now(), epoch: 0, lastInv: '', outbox: [], lastChatAt: 0, saveDue: null,
    };
    this.sessions.add(s);
    this.byPlayer.set(player, s);
    this.send(ws, { t: 'welcome', you: player.id, time: sim.time, zone: sim.zone.id });
    this.broadcastSystem(`${player.name} เข้าสู่โลก`);
    console.log(`[world] ${acc.username} joined as ${player.name} (${this.sessions.size} online)`);
    return s;
  }

  private leave(s: Session): void {
    if (!this.sessions.has(s)) return;
    this.save(s);
    this.sessions.delete(s);
    this.byPlayer.delete(s.player);
    s.sim.removePlayer(s.player);
    this.broadcastSystem(`${s.player.name} ออกจากเกม`);
    console.log(`[world] ${s.username} left (${this.sessions.size} online)`);
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

  private onAction(s: Session, m: ActionMsg): void {
    const p = s.player;
    const sim = s.sim;
    const i = num((m as { i?: unknown }).i, -1);
    switch (m.a) {
      case 'respawn':
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
  private travel(s: Session, zoneId: string): void {
    const dest = this.sims.get(zoneId);
    if (!dest || dest === s.sim || !this.sessions.has(s)) return;
    const old = s.player;
    const from = s.sim;
    from.removePlayer(old);
    this.byPlayer.delete(old);
    const p = dest.addPlayer(old.toData(), from.zone.id);
    p.hp = Math.min(old.hp, p.maxHp);
    p.mp = Math.min(old.mp, p.stats.maxMp);
    p.cd = { ...old.cd };
    p.potCd = old.potCd;
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
      serverMoves: serverMoves(p) || !!s.auto, epoch: s.epoch, buybackLeft: Math.round(p.buybackLeft),
    };
    if (inv !== s.lastInv) {
      s.lastInv = inv;
      me.inv = { equipment: p.equipment, bag: p.bag, buyback: p.buyback };
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

  // ------------------------------------------------------------ saving

  private save(s: Session): void {
    s.saveDue = null;
    try {
      this.db.saveCharacter(s.charId, s.player.toData());
    } catch (e) {
      console.error(`[world] saving ${s.player.name} failed`, e);
    }
  }

  saveAll(): void {
    for (const s of this.sessions) this.save(s);
  }
}
