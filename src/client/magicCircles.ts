// Magic circles on the ground (owner 2026-11-18): under a monster with a debuff, under a player with a skill buff,
// and over a lasting area skill. One white picture drawn once in code (a double ring, runes around it and a
// five-pointed star), tinted per kind, turning slowly and breathing. Switch and brightness: /admin → ปรับสมดุล →
// เอฟเฟกต์สกิล (fxLayer.circles, circleGlow).
import * as THREE from 'three';
import { currentBalance } from '../shared/balance';
import { BUFF_BIT, DEBUFF_BIT } from '../shared/sim/debuffs';

/** Debuff colours, in the order a circle picks one when a monster has several. */
const DEBUFF_COLOR: [number, string][] = [
  [DEBUFF_BIT.stun, '#ffe066'], [DEBUFF_BIT.dot, '#ff8a3a'], [DEBUFF_BIT.slow, '#5ce0ff'],
  [DEBUFF_BIT.weak, '#b080ff'], [DEBUFF_BIT.armor, '#c8d0e0'], [DEBUFF_BIT.mark, '#ff4a5a'],
];
const BUFF_COLOR: [number, string][] = [[BUFF_BIT.attack, '#ff7a40'], [BUFF_BIT.guard, '#ffd25a'], [BUFF_BIT.speed, '#5cffb0']];
/** Area skills: by the effect's class sheet. */
const ZONE_COLOR: [string, string][] = [['mg_', '#a68cff'], ['sw_', '#ffd25a'], ['gs_', '#ff9a40']];
const ZONE_DEFAULT = '#7fe0ff';

export const circlesOn = (): boolean => currentBalance().fxLayer.circles && currentBalance().fxLayer.enabled;
const glow = (): number => currentBalance().fxLayer.circleGlow;

let tex: THREE.CanvasTexture | null = null;
let geo: THREE.PlaneGeometry | null = null;

/** The circle picture: white on transparent, 512 px. */
function circleTexture(): THREE.CanvasTexture {
  if (tex) return tex;
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const C = N / 2;
  g.strokeStyle = g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 10;
  const ring = (r: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };
  ring(N * 0.47, 7);
  ring(N * 0.4, 4);
  ring(N * 0.3, 3);
  // Runes between the outer rings: small angular marks, each a little different.
  g.lineWidth = 4;
  const RUNES = 16;
  for (let i = 0; i < RUNES; i++) {
    const a = (i / RUNES) * Math.PI * 2;
    g.save();
    g.translate(C + Math.cos(a) * N * 0.435, C + Math.sin(a) * N * 0.435);
    g.rotate(a + Math.PI / 2);
    const s = N * 0.022;
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(0, s);
    if (i % 3 === 0) { g.moveTo(-s * 0.7, -s * 0.3); g.lineTo(s * 0.7, s * 0.3); }
    if (i % 3 === 1) { g.moveTo(0, -s); g.lineTo(s * 0.7, -s * 0.2); g.moveTo(0, 0); g.lineTo(-s * 0.7, s * 0.5); }
    if (i % 3 === 2) { g.moveTo(-s * 0.6, -s); g.lineTo(s * 0.6, s); }
    g.stroke();
    g.restore();
  }
  // The star inside the inner ring.
  g.lineWidth = 5;
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * (Math.PI * 2)) / 5;
    const x = C + Math.cos(a) * N * 0.3, y = C + Math.sin(a) * N * 0.3;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  // Dots on the star's points.
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    g.beginPath();
    g.arc(C + Math.cos(a) * N * 0.3, C + Math.sin(a) * N * 0.3, 7, 0, Math.PI * 2);
    g.fill();
  }
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A circle lying on the ground, centred on its group's origin. */
export class MagicCircle {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private t = Math.random() * 10;
  /** 0..1, eases in and out as it turns on and off. */
  private shown = 0;
  private want = false;

  constructor(parent: THREE.Object3D, private size: number) {
    geo ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({
      map: circleTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.y = 0.035;
    this.mesh.renderOrder = -1;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  /** Turns it on in `color` (null = off). */
  set(color: string | null): void {
    this.want = color !== null && circlesOn();
    if (color) this.mat.color.set(color);
  }

  update(dt: number): void {
    this.t += dt;
    this.shown = Math.max(0, Math.min(1, this.shown + (this.want ? dt : -dt) * 5));
    this.mesh.visible = this.shown > 0;
    if (!this.mesh.visible) return;
    const breathe = 0.85 + 0.15 * Math.sin(this.t * 3);
    this.mat.opacity = Math.min(1, 0.75 * glow()) * this.shown * breathe;
    const s = this.size * (0.85 + 0.15 * this.shown);
    this.mesh.scale.set(s, 1, s);
    this.mesh.rotation.y = this.t * 0.6;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mat.dispose();
  }
}

export const debuffColor = (mask: number): string | null => DEBUFF_COLOR.find(([b]) => mask & b)?.[1] ?? null;
export const buffColor = (mask: number): string | null => BUFF_COLOR.find(([b]) => mask & b)?.[1] ?? null;
export const zoneColor = (name: string): string => ZONE_COLOR.find(([p]) => name.startsWith(p))?.[1] ?? ZONE_DEFAULT;
