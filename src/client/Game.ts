import * as THREE from 'three';
import type { Vec2 } from '../shared/types';
import type { ZoneDef } from '../shared/data/zones';
import { NPC_IDS, NPC_INFO, NPC_TALK_RANGE, type NpcId } from '../shared/data/npcs';
import type { Player } from '../shared/sim/Player';
import type { Monster } from '../shared/sim/Monster';
import type { Loot } from '../shared/sim/Loot';
import { IDLE_INTENT, type Intent, type SimEvent } from '../shared/sim/types';
import type { Backend, ProjectileLike } from './backend';
import { ISO_DIR, World } from './world';
import { Input } from './input';
import { Effects } from './effects';
import { Floating } from './floating';
import { Hud } from './hud';
import { initDraggableWindows } from './dragwindow';
import { AutoRing } from './autoRing';
import { AUTO_PX_PER_UNIT } from '../shared/sim/Player';
import { SpriteActor } from './SpriteActor';
import { sheets } from './assets';
import { GameAudio } from './audio/gameAudio';
import { findPath } from './pathfind';
import { SystemMenu } from './sysmenu';
import { LootView, MonsterView, PlayerView, ProjectileView, ViewSet } from './views';
import { isSoftwareRenderer } from '../shared/net/protocol';

const S = Math.SQRT1_2;
// Screen-space right / up projected onto the ground plane.
const RIGHT = { x: S, z: -S };
const UP = { x: -S, z: -S };

export type { Intent };

export interface Npc { id: NpcId; name: string; action: string; icon: string; role: string; x: number; z: number; actor: SpriteActor }

/**
 * Draws the world and handles input, camera and HUD. The world itself comes from the server
 * through a Backend; all game rules live in src/shared and run there.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  /** The zone currently drawn. Rebuilt when the backend moves us through a portal. */
  zone: ZoneDef;
  world: World;
  readonly input: Input;
  readonly fx: Effects;
  readonly floating: Floating;
  readonly hud: Hud;
  readonly sysMenu: SystemMenu;
  npcs: Npc[] = [];
  /** The Seeker's intro is shown only when you talk to him. */
  metSeeker = true;
  autoPlay = false;
  /** Waypoints left from a click on the full map (empty = not walking anywhere). */
  mapRoute: Vec2[] = [];
  /** Stuck check for the map walk: closest distance to the next waypoint and when it last got closer. */
  private routeBest = Infinity;
  private routeBestAt = 0;
  /** Where Auto was switched on: the centre of its farming circle (the server keeps its own copy). */
  private autoAnchor: { x: number; z: number } | null = null;
  private autoRing!: AutoRing;
  hovered: Monster | null = null;
  mouseWorld: Vec2 = { x: 0, z: 0 };

  private viewSize = 17;
  private readonly camTarget = new THREE.Vector3();
  private shakeT = 0;
  private shakeAmt = 0;
  private readonly sound = new GameAudio();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly tmp = new THREE.Vector3();
  private readonly ndc = new THREE.Vector2();
  private readonly playerViews: ViewSet<Player, PlayerView>;
  private readonly monsterViews: ViewSet<Monster, MonsterView>;
  private readonly projectileViews: ViewSet<ProjectileLike, ProjectileView>;
  private readonly lootViews: ViewSet<Loot, LootView>;
  private last = 0;

  constructor(container: HTMLElement, readonly backend: Backend) {
    this.zone = backend.zone;
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.prepend(this.renderer.domElement);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 400);
    this.updateProjection();

    this.world = new World(this.scene, backend.terrain);
    this.world.bakeMap(this.renderer);
    this.input = new Input(this.renderer.domElement);
    this.fx = new Effects(this.scene);
    this.autoRing = new AutoRing(this.scene);
    this.floating = new Floating(document.getElementById('float-layer')!);

    this.camTarget.set(this.player.x, 0, this.player.z);

    this.playerViews = new ViewSet((p) => new PlayerView(p, this.scene));
    this.monsterViews = new ViewSet((m) => new MonsterView(m, this.scene));
    this.projectileViews = new ViewSet((pr) => new ProjectileView(pr, this.scene, this.fx));
    this.lootViews = new ViewSet((l) => new LootView(l, this.scene, this.fx));
    this.syncViews();
    this.placeNpcs();

    this.hud = new Hud(this);
    this.sysMenu = new SystemMenu(this);
    initDraggableWindows(document.getElementById('hud')!);
    this.checkGpu();
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.updateProjection();
    });
  }

  /** Our character. Always read it from here (the backend owns it). */
  get player(): Player { return this.backend.me; }
  get monsters(): readonly Monster[] { return this.backend.monsters; }
  get loots(): readonly Loot[] { return this.backend.loots; }
  get time(): number { return this.backend.time; }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    this.backend.drewFrame?.(now);
    requestAnimationFrame(this.loop);
  };

  /** Tells the server which GPU draws the game, and the player when it's drawn on the CPU (very slow). */
  private checkGpu(): void {
    const gl = this.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    this.backend.reportGpu?.(name);
    if (isSoftwareRenderer(name)) {
      this.hud.chatLine('', '⚠ เบราว์เซอร์กำลังวาดเกมด้วย CPU ไม่ได้ใช้การ์ดจอ เกมจึงกระตุก — เปิด "ใช้การเร่งกราฟิกเมื่อพร้อมใช้งาน" (Use graphics acceleration when available) ในการตั้งค่าเบราว์เซอร์ › ระบบ แล้วปิด-เปิดเบราว์เซอร์ใหม่', 60_000);
    }
  }

  // ------------------------------------------------------------ helpers

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeT = 0.3;
  }

  toScreen(x: number, y: number, z: number): { sx: number; sy: number; on: boolean } {
    this.tmp.set(x, y, z).project(this.camera);
    const sx = ((this.tmp.x + 1) / 2) * window.innerWidth;
    const sy = ((1 - this.tmp.y) / 2) * window.innerHeight;
    const on = sx > -80 && sx < window.innerWidth + 80 && sy > -80 && sy < window.innerHeight + 80;
    return { sx, sy, on };
  }

  toggleAuto(force?: boolean, offMsg = 'ปิด Auto Play'): void {
    if (!this.zone.allowAutoPlay) {
      this.hud.log('พื้นที่นี้ไม่รองรับ Auto Play', '#ff8a6a');
      return;
    }
    this.autoPlay = force ?? !this.autoPlay;
    if (this.autoPlay) this.autoAnchor = { x: this.player.x, z: this.player.z };
    this.backend.setAuto(this.autoPlay);
    this.hud.log(this.autoPlay ? 'เปิด Auto Play — โจมตีเองได้ตลอด · เดินเองเมื่อไหร่ Auto จะปิด' : offMsg, '#9fd8ff');
  }

  respawn(): void {
    // Also checked here in case the death event arrived while the tab was hidden.
    if (this.autoPlay) this.toggleAuto(false, 'ปิด Auto Play — ตัวละครตาย');
    this.backend.respawn();
  }

  npcDistance(id: NpcId): number {
    return this.backend.npcDistance(id);
  }

  /** Walk to a point picked on the full map, around trees and rocks. False if there is no way there. */
  walkTo(x: number, z: number): boolean {
    const p = this.player;
    if (!p.alive) return false;
    const route = findPath(this.backend.terrain, { x: p.x, z: p.z }, { x, z });
    if (!route) {
      this.hud.log('ไปจุดนั้นไม่ได้', '#ff8a6a');
      return false;
    }
    if (this.autoPlay) this.toggleAuto(false, 'ปิด Auto Play — เดินตามแผนที่');
    this.mapRoute = route;
    this.routeBest = Infinity;
    this.routeBestAt = performance.now();
    const end = route[route.length - 1];
    this.fx.marker(end.x, end.z);
    return true;
  }

  /** Feeds the next map-walk waypoint into the intent, and drops the route when done or stuck. */
  private followRoute(intent: Intent): Intent {
    const p = this.player;
    if (intent.move || intent.moveTo) {
      this.mapRoute = []; // walking by hand takes over
      return intent;
    }
    while (this.mapRoute.length) {
      const next = this.mapRoute[0];
      const d = Math.hypot(next.x - p.x, next.z - p.z);
      if (d > (this.mapRoute.length > 1 ? 0.6 : 0.2)) {
        const now = performance.now();
        if (d < this.routeBest - 0.2) {
          this.routeBest = d;
          this.routeBestAt = now;
        } else if (now - this.routeBestAt > 2000) {
          this.mapRoute = [];
          this.hud.log('ทางถูกขวาง — หยุดเดิน', '#ff8a6a');
          return intent;
        }
        return { ...intent, moveTo: { x: next.x, z: next.z } };
      }
      this.mapRoute.shift();
      this.routeBest = Infinity;
      this.routeBestAt = performance.now();
    }
    return intent;
  }

  dropFromBag(i: number): void {
    this.backend.drop(i);
  }

  private placeNpcs(): void {
    for (const n of this.npcs) {
      this.scene.remove(n.actor.group);
      n.actor.dispose();
    }
    this.npcs = [];
    for (const id of NPC_IDS) {
      const pos = this.backend.terrain.npcPos[id];
      const actor = new SpriteActor(sheets[id], 1.95, 0.4);
      actor.group.position.set(pos.x, 0, pos.z);
      actor.face(-1, -1);
      this.scene.add(actor.group);
      this.npcs.push({ id, ...NPC_INFO[id], x: pos.x, z: pos.z, actor });
    }
  }

  /** The backend moved us to another zone: redraw the map, camp and everything in it. */
  private changeZone(): void {
    this.mapRoute = [];
    this.world.dispose();
    this.zone = this.backend.zone;
    this.world = new World(this.scene, this.backend.terrain);
    this.world.bakeMap(this.renderer);
    this.placeNpcs();
    this.syncViews();
    this.camTarget.set(this.player.x, 0, this.player.z);
    this.autoPlay = false;
    this.hovered = null;
    this.hud.onZoneChanged();
  }

  private updateProjection(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const h = this.viewSize / 2;
    this.camera.left = -h * aspect;
    this.camera.right = h * aspect;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ simulation → screen

  private syncViews(): void {
    this.playerViews.sync(this.backend.players);
    this.monsterViews.sync(this.backend.monsters);
    this.projectileViews.sync(this.backend.projectiles);
    this.lootViews.sync(this.backend.loots);
  }

  private viewById(id: number): PlayerView | MonsterView | undefined {
    for (const v of this.playerViews.values()) if (v.p.id === id) return v;
    for (const v of this.monsterViews.values()) if (v.m.id === id) return v;
    return undefined;
  }

  private handleEvent(ev: SimEvent): void {
    const me = this.player.id;
    if ('to' in ev && ev.to !== undefined && ev.to !== me) return;
    this.sound.onEvent(ev, this.backend);
    switch (ev.t) {
      case 'fx':
        (this.fx[ev.name] as (...a: unknown[]) => void).apply(this.fx, ev.args as unknown[]);
        break;
      case 'text':
        this.floating.text(ev.x, ev.y, ev.z, ev.text, ev.cls, ev.life);
        break;
      case 'shake':
        this.shake(ev.amount);
        break;
      case 'log':
        this.hud.log(ev.msg, ev.color);
        break;
      case 'banner':
        this.hud.banner(ev.text, ev.sub, ev.color);
        break;
      case 'flash':
        this.viewById(ev.id)?.actor.flash();
        break;
      case 'anim': {
        const v = this.viewById(ev.id);
        if (v instanceof PlayerView) v.onAnim(ev);
        break;
      }
      case 'item':
        this.hud.logItem(ev.item);
        this.hud.markInventory();
        break;
      case 'inventory':
      case 'stash':
        this.hud.markInventory();
        break;
      case 'died': {
        const v = this.viewById(ev.id);
        if (v instanceof PlayerView) v.onDied();
        if (ev.id === me) {
          this.hud.showDeath();
          // Otherwise Auto walks straight back to the farm spot after respawning.
          if (this.autoPlay) this.toggleAuto(false, 'ปิด Auto Play — ตัวละครตาย');
        }
        break;
      }
      case 'revived': {
        const v = this.viewById(ev.id);
        if (v instanceof PlayerView) v.onRevived();
        if (ev.id === me) this.hud.hideDeath();
        break;
      }
    }
  }

  // ------------------------------------------------------------ frame

  private manualIntent(): Intent {
    const i = this.input;
    let mx = 0;
    let my = 0;
    if (i.down('KeyW') || i.down('ArrowUp')) my += 1;
    if (i.down('KeyS') || i.down('ArrowDown')) my -= 1;
    if (i.down('KeyD') || i.down('ArrowRight')) mx += 1;
    if (i.down('KeyA') || i.down('ArrowLeft')) mx -= 1;
    let move: Vec2 | null = null;
    if (mx || my) {
      const x = RIGHT.x * mx + UP.x * my;
      const z = RIGHT.z * mx + UP.z * my;
      const l = Math.hypot(x, z);
      move = { x: x / l, z: z / l };
    }
    let moveTo: Vec2 | null = null;
    if (i.rmb) {
      moveTo = { ...this.mouseWorld };
      if (i.rmbPressed) this.fx.marker(moveTo.x, moveTo.z);
    }
    const h = this.hovered;
    const skills = (['q', 'e', 'r'] as const).filter((k) => i.down(`Key${k.toUpperCase()}`));
    return {
      move,
      moveTo,
      aim: h ? { x: h.x, z: h.z } : { ...this.mouseWorld },
      basic: i.lmb,
      skills,
      dash: i.pressed('Space'),
      potion: i.pressed('Digit1') ? 'hp' : i.pressed('Digit2') ? 'mp' : null,
    };
  }

  private updateMouse(): void {
    this.ndc.set((this.input.mouseX / window.innerWidth) * 2 - 1, -(this.input.mouseY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (this.raycaster.ray.intersectPlane(this.ground, this.tmp)) this.mouseWorld = { x: this.tmp.x, z: this.tmp.z };

    const pxPerUnit = window.innerHeight / this.viewSize;
    let best: Monster | null = null;
    let bd = Infinity;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const s = this.toScreen(m.x, m.def.height * 0.3, m.z);
      const d = Math.hypot(s.sx - this.input.mouseX, s.sy - this.input.mouseY);
      const r = Math.max(18, m.def.height * 0.4 * pxPerUnit);
      if (d < r && d < bd) {
        bd = d;
        best = m;
      }
    }
    this.hovered = best;
    document.body.classList.toggle('cursor-attack', !!best);
  }

  private update(dt: number): void {
    const i = this.input;
    this.updateMouse();

    if (i.pressed('KeyF')) this.toggleAuto();
    if (i.pressed('KeyI') || i.pressed('KeyB')) this.hud.toggleBag();
    if (i.pressed('KeyH')) this.hud.toggleHelp();
    if (i.pressed('KeyM')) this.hud.toggleMap();
    if (i.pressed('Escape')) this.sysMenu.onEscape();
    if (i.pressed('Enter')) this.hud.openChat();
    if (i.wheel) {
      this.viewSize = Math.max(10, Math.min(28, this.viewSize + i.wheel * 1.2));
      this.updateProjection();
    }

    const p = this.player;
    let intent = IDLE_INTENT;
    if (!p.alive) this.mapRoute = [];
    if (p.alive) {
      intent = this.manualIntent();
      if (this.mapRoute.length) intent = this.followRoute(intent);
      if (this.hud.dialogOpen) intent = { ...intent, move: null, moveTo: null, basic: false, skills: [], dash: false };
      // The server plays Auto (so it keeps going in a hidden tab); here it only gets our manual input.
      else if (this.autoPlay && !this.mapRoute.length && (intent.move || intent.moveTo)) this.toggleAuto(false, 'ปิด Auto Play — เดินเอง');
    }
    this.sysMenu.update(dt, intent.basic || intent.skills.length > 0, !!(intent.move || intent.moveTo || intent.dash));
    const events = this.backend.frame(dt, intent);
    if (this.backend.zone !== this.zone) this.changeZone();
    this.sound.update(dt, this.backend);

    this.syncViews();
    for (const ev of events) this.handleEvent(ev);
    for (const v of this.playerViews.values()) v.update(dt, this.fx);
    for (const v of this.monsterViews.values()) v.update(dt);
    for (const v of this.projectileViews.values()) v.update();
    for (const v of this.lootViews.values()) v.update();

    // Camp NPCs: face the player, show a talk prompt for the nearest one in range.
    let near: Npc | null = null;
    let nearD = NPC_TALK_RANGE;
    for (const n of this.npcs) {
      n.actor.face(p.x - n.x, p.z - n.z);
      n.actor.update(dt, false);
      const d = Math.hypot(p.x - n.x, p.z - n.z);
      if (p.alive && d < nearD) {
        nearD = d;
        near = n;
      }
    }
    const prompt = near && !this.hud.dialogOpen ? `${near.name} — กด T เพื่อ${near.action}` : null;
    this.floating.npcBadges(this, this.npcs);
    this.floating.npcPrompt(this, near?.x ?? 0, 3.7, near?.z ?? 0, prompt);
    if (near && i.pressed('KeyT')) this.hud.talkTo(near.id);

    // Farming circle: while Auto runs (around where it started) and while the settings window is open
    // (around the player if Auto is off), following the number as it is typed.
    const preview = this.hud.autoRangePreview();
    if (this.autoPlay || preview !== null) {
      const c = this.autoPlay && this.autoAnchor ? this.autoAnchor : p;
      this.autoRing.show(c.x, c.z, (preview ?? p.autoSettings.range) / AUTO_PX_PER_UNIT);
    } else this.autoRing.hide();

    this.fx.update(dt);
    this.world.update(dt, p.x, p.z);
    this.updateCamera(dt);
    this.floating.update(dt, this);
    this.hud.update(dt);
  }

  private updateCamera(dt: number): void {
    const p = this.player;
    const k = 1 - Math.exp(-dt * 8);
    this.camTarget.x += (p.x - this.camTarget.x) * k;
    this.camTarget.z += (p.z - this.camTarget.z) * k;
    let sx = 0;
    let sz = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmt * (this.shakeT / 0.3);
      sx = (Math.random() - 0.5) * a;
      sz = (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmt = 0;
    }
    this.camera.position.set(this.camTarget.x + sx, 0, this.camTarget.z + sz).addScaledVector(ISO_DIR, 80);
    this.camera.lookAt(this.camTarget.x + sx, 0, this.camTarget.z + sz);
    this.camera.updateMatrixWorld();
  }
}
