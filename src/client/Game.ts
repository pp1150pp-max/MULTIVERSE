import * as THREE from 'three';
import type { Vec2 } from '../shared/types';
import type { SkillSlot } from '../shared/data/classes';
import { ZONE_1, type SpawnArea, type ZoneDef } from '../shared/data/zones';
import { MONSTERS } from '../shared/data/monsters';
import { expGapMult, expToNext, mitigate, MAX_LEVEL } from '../shared/formulas';
import { itemName } from '../shared/data/enhance';
import { rollItem } from '../shared/data/items';
import { rand, randInt } from '../shared/rng';
import { World } from './world';
import { Input } from './input';
import { Effects } from './effects';
import { Floating } from './floating';
import { Hud } from './hud';
import { Player } from './entities/Player';
import { Monster } from './entities/Monster';
import type { Projectile } from './entities/Projectile';
import { Loot, type LootKind } from './entities/Loot';
import type { Unit } from './entities/Unit';
import { AutoPlay } from './autoplay';
import { SpriteActor } from './SpriteActor';
import { sheets } from './assets';
import { writeSave, type SaveData } from './save';
import { NPC_INFO, NPC_TALK_RANGE, type Npc, type NpcId } from './npcs';

/** Camera sits along this direction from its target: 45° yaw, ~47° pitch. */
const ISO_DIR = new THREE.Vector3(1, 1.45, 1).normalize();
const S = Math.SQRT1_2;
// Screen-space right / up projected onto the ground plane.
const RIGHT = { x: S, z: -S };
const UP = { x: -S, z: -S };

export interface Intent {
  move: Vec2 | null;
  moveTo: Vec2 | null;
  aim: Vec2;
  basic: boolean;
  skills: SkillSlot[];
  dash: boolean;
  potion: 'hp' | 'mp' | null;
}

export interface HitOpts {
  kb?: number;
  stun?: number;
  slow?: number;
  slowT?: number;
  fromX?: number;
  fromZ?: number;
}

interface Spawner { area: SpawnArea; alive: number; queue: number[]; boss: boolean }

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly zone: ZoneDef = ZONE_1;
  readonly world: World;
  readonly input: Input;
  readonly fx: Effects;
  readonly floating: Floating;
  readonly hud: Hud;
  readonly player: Player;
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];
  loots: Loot[] = [];
  time = 0;
  autoPlay = false;
  hovered: Monster | null = null;
  mouseWorld: Vec2 = { x: 0, z: 0 };
  readonly npcs: Npc[] = [];

  private viewSize = 17;
  private readonly camTarget = new THREE.Vector3();
  private shakeT = 0;
  private shakeAmt = 0;
  private readonly spawners: Spawner[] = [];
  private readonly auto = new AutoPlay();
  private timers: { at: number; fn: () => void }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly tmp = new THREE.Vector3();
  private readonly ndc = new THREE.Vector2();
  private saveT = 0;
  private last = 0;
  private lowExpHinted = false;

  constructor(container: HTMLElement, save: SaveData) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color('#16301a');

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 400);
    this.updateProjection();

    this.world = new World(this.scene, this.zone);
    this.input = new Input(this.renderer.domElement);
    this.fx = new Effects(this.scene);
    this.floating = new Floating(document.getElementById('float-layer')!);

    this.player = new Player(this, save);
    this.player.x = this.zone.start.x - 2;
    this.player.z = this.zone.start.z - 2;
    this.player.syncView();
    this.scene.add(this.player.actor.group);
    this.camTarget.set(this.player.x, 0, this.player.z);

    for (const id of Object.keys(NPC_INFO) as NpcId[]) {
      const pos = this.world.npcPos[id];
      const actor = new SpriteActor(sheets[id], 1.95, 0.4);
      actor.group.position.set(pos.x, 0, pos.z);
      actor.face(-1, -1);
      this.scene.add(actor.group);
      this.world.colliders.push({ ...pos, r: 0.45 });
      this.npcs.push({ id, ...NPC_INFO[id], x: pos.x, z: pos.z, actor });
    }

    for (const area of this.zone.spawns) this.spawners.push({ area, alive: 0, queue: [], boss: false });
    this.spawners.push({ area: this.zone.boss, alive: 0, queue: [], boss: true });
    for (const sp of this.spawners) for (let i = 0; i < sp.area.count; i++) this.spawnMonster(sp);

    this.hud = new Hud(this);
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.updateProjection();
    });
    window.addEventListener('beforeunload', () => this.save());
  }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    if (!this.player.metSeeker) this.schedule(0.6, () => this.hud.openDialog());
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

  schedule(delay: number, fn: () => void): void {
    this.timers.push({ at: this.time + delay, fn });
  }

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

  addProjectile(p: Projectile): void {
    this.projectiles.push(p);
  }

  toggleAuto(force?: boolean): void {
    if (!this.zone.allowAutoPlay) {
      this.hud.log('พื้นที่นี้ไม่รองรับ Auto Play', '#ff8a6a');
      return;
    }
    this.autoPlay = force ?? !this.autoPlay;
    this.auto.reset();
    this.hud.log(this.autoPlay ? 'เปิด Auto Play — ขยับหรือโจมตีเองได้ตลอดเวลา' : 'ปิด Auto Play', '#9fd8ff');
  }

  save(): void {
    writeSave(this.player.toSave());
  }

  npcDistance(id: NpcId): number {
    const n = this.npcs.find((x) => x.id === id)!;
    return Math.hypot(this.player.x - n.x, this.player.z - n.z);
  }

  /** Throws a bag item on the ground next to the player. It disappears after a while. */
  dropFromBag(i: number): void {
    const p = this.player;
    const item = p.takeFromBag(i);
    if (!item) return;
    const a = Math.random() * Math.PI * 2;
    this.loots.push(new Loot(this, p.x + Math.cos(a), p.z + Math.sin(a), p.x, p.z, { type: 'item', item }, { dropped: true }));
    this.hud.log(`วาง ${itemName(item)} ลงบนพื้น (เก็บคืนได้ภายใน 60 วินาที)`, '#b9b09a');
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

  // ------------------------------------------------------------ spawning

  private spawnMonster(sp: Spawner): void {
    const def = MONSTERS[sp.area.monster];
    const r = Math.random;
    let x = sp.area.x;
    let z = sp.area.z;
    for (let tries = 0; tries < 12; tries++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * sp.area.radius;
      x = sp.area.x + Math.cos(a) * d;
      z = sp.area.z + Math.sin(a) * d;
      if (!this.world.isBlocked(x, z, def.radius)) break;
    }
    const m = new Monster(def, randInt(r, def.levels[0], def.levels[1]), sp.area, x, z);
    this.monsters.push(m);
    this.scene.add(m.actor.group);
    sp.alive++;
    if (sp.boss && this.time > 1) this.hud.log(`⚠ ${def.name} ปรากฏตัวที่ส่วนลึกของป่า!`, '#ff9a6a');
  }

  // ------------------------------------------------------------ combat

  hitMonster(p: Player, m: Monster, mult: number, opts: HitOpts = {}): void {
    if (!m.alive) return;
    let raw = p.stats.atk * mult * (0.9 + Math.random() * 0.2);
    const crit = Math.random() * 100 < p.stats.crit;
    if (crit) raw *= 1 + p.stats.critDmg / 100;
    const dmg = Math.round(mitigate(raw, m.defense));
    m.hp -= dmg;
    m.actor.flash();
    this.floating.text(m.x, m.topY, m.z, crit ? `${dmg}!` : String(dmg), crit ? 'crit' : 'dmg');
    if (opts.kb && !m.isBoss) m.knockback(opts.fromX ?? p.x, opts.fromZ ?? p.z, opts.kb);
    if (opts.stun) m.stunT = Math.max(m.stunT, m.isBoss ? opts.stun * 0.3 : opts.stun);
    if (opts.slow) {
      m.slowAmt = opts.slow;
      m.slowT = opts.slowT ?? 2;
    }
    m.onHit(this);
    if (m.hp <= 0) this.killMonster(m);
  }

  hitPlayer(m: Monster, mult: number, opts: HitOpts): void {
    const p = this.player;
    if (!p.alive) return;
    if (p.invulnT > 0) {
      this.floating.text(p.x, p.topY, p.z, 'MISS', 'info', 0.6);
      return;
    }
    const dmg = Math.round(mitigate(m.atk * mult * (0.9 + Math.random() * 0.2), p.stats.def));
    p.hp -= dmg;
    p.lastHurt = this.time;
    p.actor.flash();
    p.actor.play('hit');
    this.floating.text(p.x, p.topY, p.z, `-${dmg}`, 'hurt');
    if (opts.stun) p.stunT = Math.max(p.stunT, opts.stun);
    if (opts.kb) p.knockback(opts.fromX ?? m.x, opts.fromZ ?? m.z, opts.kb);
    if (p.hp <= 0) this.killPlayer();
  }

  onBossEnrage(m: Monster): void {
    this.floating.text(m.x, m.topY + 0.6, m.z, 'ENRAGED!', 'crit', 1.6);
    this.hud.log(`${m.def.name} คลั่ง! ความเร็วและการโจมตีเพิ่มขึ้น`, '#ff6a5a');
    this.shake(0.3);
  }

  private killMonster(m: Monster): void {
    m.alive = false;
    m.deadT = 0;
    m.hp = 0;
    const mult = expGapMult(this.player.level, m.level);
    const exp = Math.max(1, Math.round(m.expReward * mult));
    this.floating.text(m.x, m.topY + 0.4, m.z, mult < 1 ? `+${exp} EXP (−${Math.round((1 - mult) * 100)}%)` : `+${exp} EXP`, 'exp', 1.1);
    if (mult < 1 && !this.lowExpHinted) {
      this.lowExpHinted = true;
      this.hud.log('มอนสเตอร์ที่ชื่อเป็นสีเทาเลเวลต่ำกว่าคุณมาก ได้ EXP น้อยลง — ไปล่าตัวที่เลเวลสูงกว่านี้', '#b9b09a');
    }
    this.addExp(exp);
    this.dropLoot(m);
    const sp = this.spawners.find((s) => s.area === m.area);
    if (sp) {
      sp.alive--;
      sp.queue.push(this.time + rand(Math.random, sp.area.respawn[0], sp.area.respawn[1]));
    }
    if (m.isBoss) {
      this.hud.log(`🏆 ปราบ ${m.def.name} สำเร็จ!`, '#ffcf5a');
      this.shake(0.4);
    }
  }

  private killPlayer(): void {
    const p = this.player;
    p.alive = false;
    p.hp = 0;
    if (!p.actor.play('death', { hold: true })) p.actor.setOpacity(0.4);
    this.hud.showDeath();
  }

  respawn(): void {
    const p = this.player;
    const penalty = Math.floor(expToNext(p.level) * 0.1);
    p.exp = Math.max(0, p.exp - penalty);
    p.alive = true;
    p.hp = p.maxHp;
    p.mp = p.stats.maxMp;
    p.stunT = 0;
    p.kbx = p.kbz = 0;
    p.x = this.zone.start.x - 2;
    p.z = this.zone.start.z - 2;
    p.moveTarget = null;
    p.actor.reset();
    p.actor.setOpacity(1);
    p.actor.play('revive');
    p.syncView();
    for (const m of this.monsters) m.calm();
    this.hud.hideDeath();
    this.hud.log(`ฟื้นคืนชีพที่แคมป์ (เสีย EXP ${penalty})`, '#ff9a6a');
    this.save();
  }

  private addExp(n: number): void {
    const p = this.player;
    if (p.level >= MAX_LEVEL) return;
    p.exp += n;
    while (p.level < MAX_LEVEL && p.exp >= expToNext(p.level)) {
      p.exp -= expToNext(p.level);
      p.level++;
      p.recompute();
      p.hp = p.maxHp;
      p.mp = p.stats.maxMp;
      this.fx.levelUp(p.x, p.z);
      this.floating.text(p.x, p.topY + 0.5, p.z, 'LEVEL UP!', 'lvl', 1.8);
      this.hud.log(`✨ เลเวลอัพ! ตอนนี้ Lv.${p.level}`, '#ffd34a');
      this.save();
    }
  }

  private dropLoot(m: Monster): void {
    const d = m.def;
    const r = Math.random;
    const gold = Math.round(randInt(r, d.gold[0], d.gold[1]) * (1 + 0.1 * (m.level - d.levels[0])));
    this.spawnLoot(m, { type: 'gold', amount: gold });
    if (m.isBoss) {
      const n = randInt(r, 2, 3);
      for (let i = 0; i < n; i++) this.spawnLoot(m, { type: 'item', item: rollItem(r, m.level, this.player.cls.id, 1.5) });
      this.spawnLoot(m, { type: 'potion', pot: 'hp' });
      this.spawnLoot(m, { type: 'potion', pot: 'mp' });
      return;
    }
    if (r() < d.itemChance) this.spawnLoot(m, { type: 'item', item: rollItem(r, m.level, this.player.cls.id) });
    if (r() < d.potionChance) this.spawnLoot(m, { type: 'potion', pot: r() < 0.6 ? 'hp' : 'mp' });
  }

  private spawnLoot(m: Monster, kind: LootKind): void {
    const a = Math.random() * Math.PI * 2;
    const dist = 0.5 + Math.random() * (m.isBoss ? 2 : 1);
    const x = m.x + Math.cos(a) * dist;
    const z = m.z + Math.sin(a) * dist;
    this.loots.push(new Loot(this, x, z, m.x, m.z, kind));
  }

  /** Called by Loot when the player touches it. Returns false if it can't be picked up. */
  pickup(l: Loot): boolean {
    const p = this.player;
    const k = l.kind;
    if (k.type === 'gold') {
      p.gold += k.amount;
      this.floating.text(p.x, p.topY, p.z, `+${k.amount} G`, 'gold', 0.7);
    } else if (k.type === 'potion') {
      if (k.pot === 'hp') p.hpPots++;
      else p.mpPots++;
      this.floating.text(p.x, p.topY, p.z, k.pot === 'hp' ? '+ยา HP' : '+ยา MP', k.pot === 'hp' ? 'heal' : 'mana', 0.7);
    } else {
      if (!p.addToBag(k.item)) return false;
      this.hud.logItem(k.item);
      this.hud.markInventory();
    }
    return true;
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
    this.time += dt;
    const i = this.input;
    this.updateMouse();

    if (i.pressed('KeyF')) this.toggleAuto();
    if (i.pressed('KeyI') || i.pressed('KeyB')) this.hud.toggleBag();
    if (i.pressed('KeyH')) this.hud.toggleHelp();
    if (i.pressed('Escape')) this.hud.closePanels();
    if (i.wheel) {
      this.viewSize = Math.max(10, Math.min(28, this.viewSize + i.wheel * 1.2));
      this.updateProjection();
    }

    for (let t = this.timers.length - 1; t >= 0; t--) {
      if (this.time >= this.timers[t].at) {
        const fn = this.timers[t].fn;
        this.timers.splice(t, 1);
        fn();
      }
    }

    const p = this.player;
    if (p.alive) {
      let intent = this.manualIntent();
      if (this.hud.dialogOpen) intent = { ...intent, move: null, moveTo: null, basic: false, skills: [], dash: false };
      else if (this.autoPlay) intent = this.auto.intent(this, intent);
      p.update(dt, intent);
    }

    for (const m of this.monsters) m.update(dt, this);
    this.separateMonsters();
    for (let k = this.monsters.length - 1; k >= 0; k--) {
      const m = this.monsters[k];
      if (!m.alive && m.deadT > 0.9) {
        this.scene.remove(m.actor.group);
        m.actor.dispose();
        this.monsters.splice(k, 1);
      }
    }

    for (const pr of this.projectiles) pr.update(dt);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    for (const l of this.loots) l.update(dt);
    this.loots = this.loots.filter((l) => !l.dead);

    for (const sp of this.spawners) {
      sp.queue.sort((a, b) => a - b);
      while (sp.queue.length && sp.queue[0] <= this.time && sp.alive < sp.area.count) {
        sp.queue.shift();
        this.spawnMonster(sp);
      }
    }

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
    this.floating.npcPrompt(this, near?.x ?? 0, 2.3, near?.z ?? 0, prompt);
    if (near && i.pressed('KeyT')) this.hud.talkTo(near.id);

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

  private separateMonsters(): void {
    const ms = this.monsters;
    const p = this.player;
    for (let a = 0; a < ms.length; a++) {
      const m = ms[a];
      if (!m.alive) continue;
      for (let b = a + 1; b < ms.length; b++) {
        const n = ms[b];
        if (!n.alive) continue;
        const dx = n.x - m.x;
        const dz = n.z - m.z;
        const min = m.radius + n.radius;
        if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
        const d = Math.hypot(dx, dz) || 0.01;
        if (d < min) {
          const push = (min - d) / d / 2;
          m.x -= dx * push;
          m.z -= dz * push;
          n.x += dx * push;
          n.z += dz * push;
        }
      }
      if (p.alive && !p.isDashing) {
        const dx = m.x - p.x;
        const dz = m.z - p.z;
        const min = m.radius + p.radius;
        const d = Math.hypot(dx, dz) || 0.01;
        if (d < min) {
          m.x += (dx / d) * (min - d);
          m.z += (dz / d) * (min - d);
        }
      }
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

export type { Unit };
