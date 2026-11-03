// Multiplayer: a mirror of the server's world. The server simulates everything; this keeps local
// copies of nearby players, monsters, projectiles and loot (real shared classes, so the views, HUD
// and Auto Play work unchanged), smooths their movement between snapshots, and walks your own
// character immediately so controls feel instant. The server checks every reported position.
import { Terrain } from '../../shared/sim/terrain';
import { Player, type CharacterData, type SortKey } from '../../shared/sim/Player';
import { Monster } from '../../shared/sim/Monster';
import { Loot } from '../../shared/sim/Loot';
import type { Sim } from '../../shared/sim/Sim';
import type { Intent, SimEvent } from '../../shared/sim/types';
import { MONSTERS } from '../../shared/data/monsters';
import { ZONE_1, type SpawnArea } from '../../shared/data/zones';
import type { NpcId } from '../../shared/data/npcs';
import type { PotionKind, PotionSize, Rarity, SlotId, Vec2 } from '../../shared/types';
import type { SkillSlot } from '../../shared/data/classes';
import { INPUT_HZ, WS_PATH, type ClientMsg, type ServerMsg, type SnapshotMsg } from '../../shared/net/protocol';
import type { Backend, EnhanceOutcome, ProjectileLike } from '../backend';

/** Mirrors never run game logic, so they don't need a simulation behind them. */
const NO_SIM = null as unknown as Sim;
const NO_AREA: SpawnArea = { monster: '', x: 0, z: 0, radius: 1, count: 1, respawn: [0, 0] };
/** Remote things jump instead of gliding when they are this far off (teleports, respawns). */
const SNAP_DIST = 5;
/** Our own character is pulled back to the server's position if it drifts this far (a rejected move). */
const CORRECT_DIST = 3;

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
      if (m.t === 'welcome') you = m.you;
      if (m.t === 'snap' && you >= 0 && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(new OnlineBackend(ws, you, m));
      }
    };
    ws.onerror = () => fail('เชื่อมต่อ server ไม่ได้');
    ws.onclose = () => fail('การเชื่อมต่อถูกปิด');
  });
}

export class OnlineBackend implements Backend {
  readonly online = true;
  readonly zone = ZONE_1;
  readonly terrain = new Terrain(ZONE_1);
  readonly me: Player;
  players: Player[] = [];
  monsters: Monster[] = [];
  projectiles: MirrorProjectile[] = [];
  loots: Loot[] = [];
  onlineCount = 1;
  /** Hooks for the game screen. */
  onChat: ((name: string, text: string) => void) | null = null;
  onDisconnect: ((msg: string) => void) | null = null;

  private readonly playerMap = new Map<number, Player>();
  private readonly monsterMap = new Map<number, Monster>();
  private readonly projMap = new Map<number, MirrorProjectile>();
  private readonly lootMap = new Map<number, Loot>();
  /** Latest server position of each remote entity; mirrors glide toward it. */
  private readonly targets = new Map<object, Vec2>();
  private events: SimEvent[] = [];
  private serverTime = 0;
  private serverTimeAt = performance.now();
  private serverMoves = false;
  private epoch = 0;
  private faceLockT = 0;
  private sendT = 0;
  private pendingDash = false;
  private pendingPotion: 'hp' | 'mp' | null = null;
  private enhanceReq = 0;
  private readonly enhanceWait = new Map<number, (o: EnhanceOutcome) => void>();
  private kickMsg = '';

  constructor(private readonly ws: WebSocket, private readonly myId: number, first: SnapshotMsg) {
    const mine = first.players.find((p) => p.id === myId)!;
    const data: CharacterData = {
      name: mine.name, classId: mine.cls, level: first.me.level, exp: first.me.exp, gold: first.me.gold,
      potSel: first.me.potSel,
      equipment: first.me.inv?.equipment ?? {}, bag: first.me.inv?.bag ?? [],
    };
    this.me = new Player(myId, NO_SIM, data);
    this.me.x = mine.x;
    this.me.z = mine.z;
    this.playerMap.set(myId, this.me);
    this.epoch = first.me.epoch;
    this.applySnapshot(first);
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as ServerMsg);
    ws.onclose = () => this.onDisconnect?.(this.kickMsg || 'หลุดการเชื่อมต่อจาก server');
  }

  get time(): number {
    return this.serverTime + (performance.now() - this.serverTimeAt) / 1000;
  }

  private send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
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
      case 'kick':
        this.kickMsg = m.msg;
        break;
    }
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
    this.events.push(...s.events);

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
        m = new Monster(ms.id, def, ms.lv, NO_AREA, ms.x, ms.z);
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
        this.projMap.set(ps.id, { id: ps.id, x: ps.x, z: ps.z, vx: ps.vx, vz: ps.vz, o: { color: ps.color, size: ps.size } });
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
    me.stats = pv.stats;
    me.cd = { ...pv.cd };
    me.potCd = pv.potCd;
    if (pv.inv) {
      me.equipment = pv.inv.equipment;
      me.bag = pv.inv.bag;
      this.events.push({ t: 'inventory', to: me.id });
    }
    this.serverMoves = pv.serverMoves;
    if (pv.epoch !== this.epoch) {
      // Respawned (or otherwise teleported) by the server: jump there.
      this.epoch = pv.epoch;
      me.x = x;
      me.z = z;
      me.moveTarget = null;
      this.targets.delete(me);
    } else if (this.serverMoves) {
      this.glide(me, x, z, me);
      me.faceX = fx;
      me.faceZ = fz;
      me.moving = mv;
    } else {
      this.targets.delete(me);
      if (Math.hypot(me.x - x, me.z - z) > CORRECT_DIST) {
        me.x = x;
        me.z = z;
        me.moveTarget = null;
      }
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
    me.potCd -= dt;

    const moveDir = this.walk(dt, it);

    if (it.dash) this.pendingDash = true;
    if (it.potion) this.pendingPotion = it.potion;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / INPUT_HZ;
      this.send({
        t: 'input', pos: { x: me.x, z: me.z }, move: moveDir, aim: it.aim, basic: it.basic, skills: it.skills,
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
    if (!me.alive || this.serverMoves) return null;
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
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const step = Math.min(me.moveSpeed * dt, remaining);
      me.x += mx * step;
      me.z += mz * step;
      this.terrain.resolve(me);
    }
    if (it.basic || it.skills.length) {
      this.faceLockT = 0.25;
    }
    if (this.faceLockT > 0) me.face(it.aim.x - me.x, it.aim.z - me.z);
    else if (moving) me.face(mx, mz);
    me.moving = moving;
    return moving ? { x: mx, z: mz } : null;
  }

  // ------------------------------------------------------------ actions (the server decides)

  respawn(): void { this.send({ t: 'act', a: 'respawn' }); }
  equip(i: number): void { this.send({ t: 'act', a: 'equip', i }); }
  unequip(slot: SlotId): void { this.send({ t: 'act', a: 'unequip', slot }); }
  drop(i: number): void { this.send({ t: 'act', a: 'drop', i }); }
  buyPotion(kind: PotionKind, size: PotionSize, n: number): void { this.send({ t: 'act', a: 'buy', kind, size, n }); }
  sortBag(key: SortKey, desc: boolean): void { this.send({ t: 'act', a: 'sort', key, desc }); }
  setAuto(on: boolean): void { this.send({ t: 'act', a: 'auto', on }); }
  sell(i: number): void { this.send({ t: 'act', a: 'sell', i }); }
  sellAllOfRarity(rarity: Rarity): void { this.send({ t: 'act', a: 'sellRarity', rarity }); }

  enhance(uid: string): Promise<EnhanceOutcome> {
    const req = ++this.enhanceReq;
    this.send({ t: 'act', a: 'enhance', uid, req });
    return new Promise((resolve) => {
      this.enhanceWait.set(req, resolve);
      setTimeout(() => {
        if (this.enhanceWait.delete(req)) resolve(null);
      }, 5000);
    });
  }

  chat(text: string): void { this.send({ t: 'chat', text }); }

  npcDistance(id: NpcId): number {
    const n = this.terrain.npcPos[id];
    return Math.hypot(this.me.x - n.x, this.me.z - n.z);
  }
}
