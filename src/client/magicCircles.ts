// Magic circles on the ground (owner 2026-11-18): under a monster with a debuff, under a player with a skill buff,
// and over a lasting area skill. Each skill has its own design (circleDesigns.ts: one circle per skill, owner
// 2026-11-18), drawn once in code as two white pictures (rings and runes outside, the skill's picture inside) tinted
// in the skill's colours and turning their own ways. Switches and numbers: /admin → ปรับสมดุล → เอฟเฟกต์สกิล
// (fxLayer.circles, circleGlow, and per skill fxLayer.skills: circle on/off, × size, × speed, × brightness).
import * as THREE from 'three';
import { currentBalance } from '../shared/balance';
import { BUFF_BIT, DEBUFF_BIT } from '../shared/sim/debuffs';
import { circleDesign, drawInner, drawOuter, type CircleDesign } from './circleDesigns';

export const circlesOn = (): boolean => currentBalance().fxLayer.circles && currentBalance().fxLayer.enabled;
/** Lasting area skills drawn as a magic circle instead of their painted area and standing pieces (owner 2026-11-18). */
export const zoneAsCircle = (): boolean => circlesOn() && currentBalance().fxLayer.zoneCircles;
const glow = (): number => currentBalance().fxLayer.circleGlow;

/** A skill's own circle numbers from /admin (missing = the code's: on, ×1). */
function tune(key: string): { on: boolean; size: number; speed: number; bright: number } {
  const t = currentBalance().fxLayer.skills[key];
  return { on: t?.circle ?? true, size: t?.size ?? 1, speed: t?.speed ?? 1, bright: t?.bright ?? 1 };
}

const TEX_PX = 512;
const textures = new Map<string, THREE.CanvasTexture>();

function designTexture(d: CircleDesign, part: 'outer' | 'inner'): THREE.CanvasTexture {
  const id = `${d.key}:${part}`;
  let t = textures.get(id);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = TEX_PX;
    const g = c.getContext('2d')!;
    (part === 'outer' ? drawOuter : drawInner)(g, TEX_PX, d);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.set(id, t);
  }
  return t;
}

let geo: THREE.PlaneGeometry | null = null;

let disc: THREE.CanvasTexture | null = null;
/** A soft disc, bright at the rim and faint in the middle: the inside of an area skill's circle. */
function discTexture(): THREE.CanvasTexture {
  if (disc) return disc;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  disc = new THREE.CanvasTexture(c);
  return disc;
}

const additive = (map: THREE.Texture | null): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });

/** A circle lying on the ground, centred on its group's origin. */
export class MagicCircle {
  readonly mesh: THREE.Group;
  private readonly outer: THREE.Mesh;
  private readonly inner: THREE.Mesh;
  private readonly outerMat: THREE.MeshBasicMaterial;
  private readonly innerMat: THREE.MeshBasicMaterial;
  private t = Math.random() * 10;
  private spinO = Math.random() * 6;
  private spinI = Math.random() * 6;
  /** 0..1, eases in and out as it turns on and off. */
  private shown = 0;
  private want = false;
  private design: CircleDesign | null = null;
  /** An area skill's soft filled disc inside the circle (bold circles only). */
  private fillMat: THREE.MeshBasicMaterial | null = null;

  /** `bold`: an area skill's circle, brighter and with a soft filled disc inside, as it stands alone. */
  constructor(parent: THREE.Object3D, private size: number, private readonly bold = false) {
    geo ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Group();
    this.mesh.position.y = 0.035;
    this.mesh.visible = false;
    this.outerMat = additive(null);
    this.innerMat = additive(null);
    this.outer = new THREE.Mesh(geo, this.outerMat);
    this.inner = new THREE.Mesh(geo, this.innerMat);
    this.inner.position.y = 0.002;
    this.outer.renderOrder = this.inner.renderOrder = -1;
    this.mesh.add(this.outer, this.inner);
    if (bold) {
      this.fillMat = additive(discTexture());
      const fill = new THREE.Mesh(geo, this.fillMat);
      fill.position.y = -0.005;
      fill.renderOrder = -2;
      this.mesh.add(fill);
    }
    parent.add(this.mesh);
  }

  /** Turns it on with the design of `key` (a skill id or a fallback key, see circleDesigns.ts); null = off. */
  set(key: string | null): void {
    const d = circleDesign(key) ?? null;
    this.want = !!d && circlesOn() && tune(d.key).on;
    if (!d || d === this.design) return;
    this.design = d;
    this.outerMat.map = designTexture(d, 'outer');
    this.innerMat.map = designTexture(d, 'inner');
    this.outerMat.color.set(d.color);
    this.innerMat.color.set(d.color2);
    this.fillMat?.color.set(d.color);
    this.outerMat.needsUpdate = this.innerMat.needsUpdate = true;
  }

  update(dt: number): void {
    this.t += dt;
    this.shown = Math.max(0, Math.min(1, this.shown + (this.want ? dt : -dt) * 5));
    const d = this.design;
    this.mesh.visible = this.shown > 0 && !!d;
    if (!this.mesh.visible || !d) return;
    const k = tune(d.key);
    const breathe = 1 - d.pulse + d.pulse * Math.sin(this.t * 3);
    const a = Math.min(1, (this.bold ? 1 : 0.75) * glow() * k.bright) * this.shown * breathe;
    this.outerMat.opacity = a;
    this.innerMat.opacity = a;
    if (this.fillMat) this.fillMat.opacity = Math.min(0.35, 0.22 * glow() * k.bright) * this.shown;
    const s = this.size * k.size * (0.85 + 0.15 * this.shown);
    this.mesh.scale.set(s, 1, s);
    this.spinO += dt * d.spin * k.speed;
    this.spinI += dt * d.spin * d.inner * k.speed;
    this.outer.rotation.y = this.spinO;
    this.inner.rotation.y = this.spinI;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.outerMat.dispose();
    this.innerMat.dispose();
    this.fillMat?.dispose();
  }
}

/** Debuff kinds in the order a circle picks one when a monster has several (no known skill). */
const DEBUFF_ORDER: [number, string][] = [
  [DEBUFF_BIT.stun, 'debuff_stun'], [DEBUFF_BIT.dot, 'debuff_dot'], [DEBUFF_BIT.slow, 'debuff_slow'],
  [DEBUFF_BIT.weak, 'debuff_weak'], [DEBUFF_BIT.armor, 'debuff_armor'], [DEBUFF_BIT.mark, 'debuff_mark'],
];
const BUFF_ORDER: [number, string][] = [[BUFF_BIT.attack, 'buff_attack'], [BUFF_BIT.guard, 'buff_guard'], [BUFF_BIT.speed, 'buff_speed']];

/** A debuffed monster's circle: the skill that debuffed it, else its kind of debuff; null = none. */
export function debuffCircle(mask: number, skill: string): string | null {
  if (!mask) return null;
  if (circleDesign(skill)) return skill;
  return DEBUFF_ORDER.find(([b]) => mask & b)?.[1] ?? null;
}
/** A buffed player's circle: the skill that buffed it, else its kind of buff; null = none. */
export function buffCircle(mask: number, skill: string): string | null {
  if (!mask) return null;
  if (circleDesign(skill)) return skill;
  return BUFF_ORDER.find(([b]) => mask & b)?.[1] ?? null;
}
/** A lasting area's circle: its skill's, else the plain area one. */
export const zoneCircle = (skill: string | null | undefined): string => (circleDesign(skill) ? skill! : 'zone');
