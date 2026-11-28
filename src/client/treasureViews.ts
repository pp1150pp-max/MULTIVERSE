// Treasure chests and shrines on the farm maps (docs/systems/chests-shrines.md). The owner's pictures (art_templates/chests_shrines/,
// cut by tools/cut_chests_shrines.cjs into sprites/paper/treasure/) stand up facing the camera; a picture that failed to load falls
// back to the shapes drawn in code: a little wooden box with a gold band, a stone pillar with a floating orb in its buff's colour.
// A chest is drawn where the server says it stands (Backend.chests, hidden when not listed) and shows open while we are opening it;
// a shrine cooling down for us is dimmed.
import * as THREE from 'three';
import type { MapChest, MapShrine, ShrineKind } from '../shared/mapSchema';
import { treasureTex } from './assets';

/** How tall the pictures stand (world units): a chest about knee-high, a shrine about a hero's height. */
const CHEST_H = 1.25;
const SHRINE_H = 2.9;

const ORB_COLOR: Record<ShrineKind, string> = { atk: '#ff6a5a', speed: '#6aff9a', exp: '#ffd24a', random: '#f070c0' };
const CHEST_AURA = '#ffd24a';
/** Sparks rising round each one. */
const SPARKS = 8;

/** A soft white dot (the ground light and the sparks), made once. */
let glowTex: THREE.Texture | null = null;
function softDot(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** The aura round one chest or shrine: a light on the ground, a dashed ring turning, sparks rising (owner 2026-11-27). */
interface Aura { group: THREE.Group; disc: THREE.MeshBasicMaterial; ring: THREE.Group; ringMat: THREE.MeshBasicMaterial; sparks: { s: THREE.Sprite; m: THREE.SpriteMaterial; a: number; r: number; v: number; o: number }[]; h: number }

export class TreasureViews {
  readonly group = new THREE.Group();
  private readonly chests = new Map<string, THREE.Group>();
  private readonly orbs: { id: string; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; glow: THREE.MeshBasicMaterial; y: number }[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];
  /** Chests drawn from the pictures: the closed and the open one, swapped while we are opening it. */
  private readonly chestSprites = new Map<string, { closed: THREE.SpriteMaterial; open: THREE.SpriteMaterial | null; sprite: THREE.Sprite }>();
  private readonly shrineSprites: { id: string; mat: THREE.SpriteMaterial; sprite: THREE.Sprite }[] = [];
  private readonly chestAuras = new Map<string, Aura>();
  private readonly shrineAuras = new Map<string, Aura>();

  /** The aura at (x, z): `r` wide on the ground, sparks rising `h` high. */
  private aura(x: number, z: number, color: string, r: number, h: number): Aura {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const add = (m: THREE.Material) => { this.mats.push(m); return m; };
    const disc = add(new THREE.MeshBasicMaterial({ map: softDot(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })) as THREE.MeshBasicMaterial;
    const dg = new THREE.PlaneGeometry(r * 2.4, r * 2.4).rotateX(-Math.PI / 2);
    this.geos.push(dg);
    const dm = new THREE.Mesh(dg, disc);
    dm.position.y = 0.04;
    dm.renderOrder = -3;
    group.add(dm);
    const ringMat = add(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })) as THREE.MeshBasicMaterial;
    const ring = new THREE.Group();
    ring.position.y = 0.05;
    for (let i = 0; i < 8; i++) {
      const g = new THREE.RingGeometry(r * 0.92, r, 16, 1, (i / 8) * Math.PI * 2, Math.PI / 6).rotateX(-Math.PI / 2);
      this.geos.push(g);
      ring.add(new THREE.Mesh(g, ringMat));
    }
    group.add(ring);
    const sparks: Aura['sparks'] = [];
    for (let i = 0; i < SPARKS; i++) {
      const m = add(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })) as THREE.SpriteMaterial;
      const s = new THREE.Sprite(m);
      s.scale.setScalar(0.18);
      group.add(s);
      sparks.push({ s, m, a: (i / SPARKS) * Math.PI * 2, r: r * (0.35 + ((i * 37) % 10) / 16), v: 0.5 + ((i * 53) % 10) / 20, o: i / SPARKS });
    }
    this.group.add(group);
    return { group, disc, ring, ringMat, sparks, h };
  }

  /** A picture standing on the ground at (x, z), `h` tall (its width from the picture's shape). */
  private standee(tex: THREE.Texture, x: number, z: number, h: number): { mat: THREE.SpriteMaterial; sprite: THREE.Sprite } {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    this.mats.push(mat);
    const sprite = new THREE.Sprite(mat);
    const img = tex.image as { width: number; height: number };
    sprite.center.set(0.5, 0.04);
    sprite.scale.set((h * img.width) / img.height, h, 1);
    sprite.position.set(x, 0, z);
    this.group.add(sprite);
    return { mat, sprite };
  }

  constructor(chests: readonly MapChest[], shrines: readonly MapShrine[]) {
    const mat = (color: string, opts: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial => {
      const m = new THREE.MeshBasicMaterial({ color, ...opts });
      this.mats.push(m);
      return m;
    };
    const geo = <G extends THREE.BufferGeometry>(g: G): G => {
      this.geos.push(g);
      return g;
    };
    const wood = mat('#8a5a2b');
    const woodDark = mat('#5e3a1a');
    const gold = mat('#f2c230');
    const stone = mat('#9a9488');
    const stoneDark = mat('#6f6a60');
    for (const c of chests) {
      const closed = treasureTex.chest_closed;
      if (closed) {
        const s = this.standee(closed, c.x, c.z, CHEST_H);
        const openTex = treasureTex.chest_open;
        let open: THREE.SpriteMaterial | null = null;
        if (openTex) {
          open = new THREE.SpriteMaterial({ map: openTex, transparent: true, depthWrite: false });
          this.mats.push(open);
        }
        this.chestSprites.set(c.id, { closed: s.mat, open, sprite: s.sprite });
        this.chestAuras.set(c.id, this.aura(c.x, c.z, CHEST_AURA, 1.1, 1.8));
        continue;
      }
      this.chestAuras.set(c.id, this.aura(c.x, c.z, CHEST_AURA, 1.1, 1.8));
      const g = new THREE.Group();
      const body = new THREE.Mesh(geo(new THREE.BoxGeometry(1.1, 0.55, 0.75)), wood);
      body.position.y = 0.28;
      const lid = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.375, 0.375, 1.1, 12, 1, false, 0, Math.PI)), woodDark);
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.55;
      const band = new THREE.Mesh(geo(new THREE.BoxGeometry(0.14, 0.62, 0.78)), gold);
      band.position.y = 0.31;
      const lock = new THREE.Mesh(geo(new THREE.BoxGeometry(0.18, 0.2, 0.06)), gold);
      lock.position.set(0, 0.45, 0.4);
      g.add(body, lid, band, lock);
      g.position.set(c.x, 0, c.z);
      g.rotation.y = Math.PI / 4;
      this.group.add(g);
      this.chests.set(c.id, g);
    }
    for (const s of shrines) {
      const pic = treasureTex[`shrine_${s.buff}`];
      if (pic) {
        const st = this.standee(pic, s.x, s.z, SHRINE_H);
        this.shrineSprites.push({ id: s.id, mat: st.mat, sprite: st.sprite });
        this.shrineAuras.set(s.id, this.aura(s.x, s.z, ORB_COLOR[s.buff] ?? ORB_COLOR.random, 1.5, 3.4));
        continue;
      }
      this.shrineAuras.set(s.id, this.aura(s.x, s.z, ORB_COLOR[s.buff] ?? ORB_COLOR.random, 1.5, 3.4));
      const base = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.9, 1, 0.3, 8)), stoneDark);
      base.position.set(s.x, 0.15, s.z);
      const pillar = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.32, 0.42, 1.6, 6)), stone);
      pillar.position.set(s.x, 1.1, s.z);
      const cap = new THREE.Mesh(geo(new THREE.BoxGeometry(1, 0.16, 1)), stoneDark);
      cap.position.set(s.x, 1.98, s.z);
      const orbMat = mat(ORB_COLOR[s.buff] ?? ORB_COLOR.random);
      const orb = new THREE.Mesh(geo(new THREE.SphereGeometry(0.28, 16, 12)), orbMat);
      const glowMat = mat(ORB_COLOR[s.buff] ?? ORB_COLOR.random, { transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Mesh(geo(new THREE.SphereGeometry(0.5, 16, 12)), glowMat);
      orb.add(glow);
      orb.position.set(s.x, 2.5, s.z);
      this.group.add(base, pillar, cap, orb);
      this.orbs.push({ id: s.id, mesh: orb, mat: orbMat, glow: glowMat, y: 2.5 });
    }
  }

  /**
   * Stands each chest of `here` at its spot and hides the rest, opens the lid of the one we are opening (`opening`, '' = none) and
   * dims shrines cooling down for us (`cooling(id)`). `on` = the /admin switches.
   */
  update(t: number, here: readonly MapChest[], cooling: (id: string) => boolean, on: { chests: boolean; shrines: boolean; aura?: boolean }, opening = ''): void {
    const auraOn = on.aura !== false;
    const shown = new Set<string>();
    for (const c of here) {
      shown.add(c.id);
      this.chestAuras.get(c.id)?.group.position.set(c.x, 0, c.z);
      this.chestSprites.get(c.id)?.sprite.position.set(c.x, 0, c.z);
      this.chests.get(c.id)?.position.set(c.x, 0, c.z);
    }
    let i = 0;
    for (const [id, a] of this.chestAuras) this.tickAura(a, t, i++, auraOn && on.chests && shown.has(id), id === opening ? 1.8 : 1);
    for (const [id, a] of this.shrineAuras) this.tickAura(a, t, i++, auraOn && on.shrines, cooling(id) ? 0.2 : 1);
    for (const [id, g] of this.chests) g.visible = on.chests && shown.has(id);
    for (const [id, c] of this.chestSprites) {
      c.sprite.visible = on.chests && shown.has(id);
      const mat = id === opening && c.open ? c.open : c.closed;
      if (c.sprite.material !== mat) {
        // The open picture is another shape: keep the height, take its width.
        const img = mat.map!.image as { width: number; height: number };
        c.sprite.material = mat;
        c.sprite.scale.set((CHEST_H * img.width) / img.height, CHEST_H, 1);
      }
    }
    for (const s of this.shrineSprites) {
      s.sprite.visible = on.shrines;
      s.mat.opacity = cooling(s.id) ? 0.5 : 1;
    }
    this.orbs.forEach((o, i) => {
      const cool = cooling(o.id);
      o.mesh.visible = on.shrines;
      o.mesh.position.y = o.y + Math.sin(t * 2 + i) * 0.08;
      o.mat.opacity = cool ? 0.35 : 1;
      o.mat.transparent = cool;
      o.glow.opacity = cool ? 0.05 : 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(t * 3 + i));
    });
  }

  /** Pulses the ground light, turns the ring and lifts the sparks; `k` = brightness (dim while cooling, bright while opening). */
  private tickAura(a: Aura, t: number, i: number, show: boolean, k: number): void {
    a.group.visible = show;
    if (!show) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + i);
    a.disc.opacity = Math.min(1, (0.35 + 0.25 * pulse) * k);
    a.ringMat.opacity = Math.min(1, (0.45 + 0.3 * pulse) * k);
    a.ring.rotation.y = t * 0.6 + i;
    for (const p of a.sparks) {
      const f = (t * p.v * 0.35 + p.o) % 1;
      const ang = p.a + t * 0.4;
      p.s.position.set(Math.cos(ang) * p.r * (1 - f * 0.4), 0.15 + f * a.h, Math.sin(ang) * p.r * (1 - f * 0.4));
      p.m.opacity = Math.min(1, Math.sin(f * Math.PI) * k);
    }
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
