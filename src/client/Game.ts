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
import { AUTO_HINT_COLOR, AutoPlay } from '../shared/sim/autoplay';
import { AutoRing } from './autoRing';
import { AUTO_PX_PER_UNIT } from '../shared/sim/Player';
import { SpriteActor } from './SpriteActor';
import { sheets } from './assets';
import { LootView, MonsterView, PlayerView, ProjectileView, ViewSet } from './views';

const S = Math.SQRT1_2;
// Screen-space right / up projected onto the ground plane.
const RIGHT = { x: S, z: -S };
const UP = { x: -S, z: -S };

export type { Intent };

export interface Npc { id: NpcId; name: string; action: string; icon: string; role: string; x: number; z: number; actor: SpriteActor }

/** Saving for singleplayer; online characters are saved by the server. */
export interface LocalPersist {
  metSeeker: boolean;
  save(game: Game): void;
}

/**
 * Draws the world and handles input, camera and HUD. The world itself comes from a Backend:
 * a local simulation (singleplayer) or the server (multiplayer). All game rules live in src/shared.
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
  npcs: Npc[] = [];
  metSeeker: boolean;
  autoPlay = false;
  /** Where Auto was switched on: the centre of its farming circle (the server keeps its own copy online). */
  private autoAnchor: { x: number; z: number } | null = null;
  private autoRing!: AutoRing;
  hovered: Monster | null = null;
  mouseWorld: Vec2 = { x: 0, z: 0 };

  private viewSize = 17;
  private readonly camTarget = new THREE.Vector3();
  private shakeT = 0;
  private shakeAmt = 0;
  private readonly auto = new AutoPlay();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly tmp = new THREE.Vector3();
  private readonly ndc = new THREE.Vector2();
  private readonly playerViews: ViewSet<Player, PlayerView>;
  private readonly monsterViews: ViewSet<Monster, MonsterView>;
  private readonly projectileViews: ViewSet<ProjectileLike, ProjectileView>;
  private readonly lootViews: ViewSet<Loot, LootView>;
  private saveT = 0;
  private last = 0;

  constructor(container: HTMLElement, readonly backend: Backend, private readonly persist: LocalPersist | null) {
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
    this.input = new Input(this.renderer.domElement);
    this.fx = new Effects(this.scene);
    this.autoRing = new AutoRing(this.scene);
    this.floating = new Floating(document.getElementById('float-layer')!);

    // Online, the Seeker's intro is only shown when you talk to him.
    this.metSeeker = persist?.metSeeker ?? true;
    this.camTarget.set(this.player.x, 0, this.player.z);

    this.playerViews = new ViewSet((p) => new PlayerView(p, this.scene));
    this.monsterViews = new ViewSet((m) => new MonsterView(m, this.scene));
    this.projectileViews = new ViewSet((pr) => new ProjectileView(pr, this.scene, this.fx));
    this.lootViews = new ViewSet((l) => new LootView(l, this.scene, this.fx));
    this.syncViews();
    this.placeNpcs();

    this.hud = new Hud(this);
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.updateProjection();
    });
    window.addEventListener('beforeunload', () => this.save());
  }

  /** Our character. A new object after changing zones in singleplayer, so always read it from here. */
  get player(): Player { return this.backend.me; }
  get monsters(): readonly Monster[] { return this.backend.monsters; }
  get loots(): readonly Loot[] { return this.backend.loots; }
  get time(): number { return this.backend.time; }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    if (!this.metSeeker) setTimeout(() => this.hud.openDialog(), 600);
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  };

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
    if (this.autoPlay) {
      this.auto.start(this.player.x, this.player.z);
      this.autoAnchor = { x: this.player.x, z: this.player.z };
    }
    else this.auto.reset();
    this.backend.setAuto(this.autoPlay);
    this.hud.log(this.autoPlay ? 'เปิด Auto Play — โจมตีเองได้ตลอด · เดินเองเมื่อไหร่ Auto จะปิด' : offMsg, '#9fd8ff');
  }

  save(): void {
    this.persist?.save(this);
  }

  respawn(): void {
    this.backend.respawn();
  }

  npcDistance(id: NpcId): number {
    return this.backend.npcDistance(id);
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
    this.world.dispose();
    this.zone = this.backend.zone;
    this.world = new World(this.scene, this.backend.terrain);
    this.placeNpcs();
    this.syncViews();
    this.camTarget.set(this.player.x, 0, this.player.z);
    this.autoPlay = false;
    this.auto.reset();
    this.hovered = null;
    this.hud.onZoneChanged();
    this.save();
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
        this.hud.markInventory();
        break;
      case 'died': {
        const v = this.viewById(ev.id);
        if (v instanceof PlayerView) v.onDied();
        if (ev.id === me) this.hud.showDeath();
        break;
      }
      case 'revived': {
        const v = this.viewById(ev.id);
        if (v instanceof PlayerView) v.onRevived();
        if (ev.id === me) this.hud.hideDeath();
        break;
      }
      case 'save':
        this.save();
        break;
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
    if (i.pressed('Escape')) this.hud.closePanels();
    if (i.pressed('Enter') && this.backend.online) this.hud.openChat();
    if (i.wheel) {
      this.viewSize = Math.max(10, Math.min(28, this.viewSize + i.wheel * 1.2));
      this.updateProjection();
    }

    const p = this.player;
    let intent = IDLE_INTENT;
    if (p.alive) {
      intent = this.manualIntent();
      if (this.hud.dialogOpen) intent = { ...intent, move: null, moveTo: null, basic: false, skills: [], dash: false };
      else if (this.autoPlay && (intent.move || intent.moveTo)) this.toggleAuto(false, 'ปิด Auto Play — เดินเอง');
      // Online the server plays Auto (so it keeps going in a hidden tab); here it only gets our manual input.
      else if (this.autoPlay && !this.backend.online) {
        intent = this.auto.intent(this, intent);
        const hint = this.auto.takeHint();
        if (hint) this.hud.log(hint, AUTO_HINT_COLOR);
      }
    }
    const events = this.backend.frame(dt, intent);
    if (this.backend.zone !== this.zone) this.changeZone();

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

    this.saveT += dt;
    if (this.saveT > 15) {
      this.saveT = 0;
      this.save();
    }
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
