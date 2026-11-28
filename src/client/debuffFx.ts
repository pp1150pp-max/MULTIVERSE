// What a monster's debuffs look like (owner 2026-11-15): a row of small icons over its HP bar, and an effect on its
// body for each: stars circling the head (stun), frost at the feet (slow), grey shards falling off (armor break), a dark
// red glow (attack down), embers rising (burning / poison) and a red reticle over the head (your mark). Switch both
// off on /admin.
import { ELEMENTS, MARK_NAME } from '../shared/elementTuning';
import { elementIconUrl } from './elementBadge';
import * as THREE from 'three';
import { DEBUFFS, DEBUFF_BIT, DEBUFF_NAME, type Debuff } from '../shared/sim/debuffs';
import type { Monster } from '../shared/sim/Monster';
import { currentBalance } from '../shared/balance';
import type { Effects } from './effects';
import { fxTex } from './assets';
import { imgUrl } from './img';

/** The icon of a debuff as an image URL (the owner's papercraft badges, tools/cut_codex17.cjs). */
export const debuffIcon = (d: Debuff): string => imgUrl(`/assets/sprites/ui/debuff_${d}.png`);

/** The icons row of a nameplate, redrawn only when the mask changes. */
export function debuffIconsHtml(mask: number, elem = 0): string {
  // The element mark first: the owner's papercraft icon (art_templates/ui/ELEMENT_ICONS.md).
  const e = ELEMENTS[elem - 1];
  const mark = e ? `<img class="pelem" src="${elementIconUrl(e)}" title="${MARK_NAME[e]}" alt="" draggable="false">` : '';
  return mark + DEBUFFS.filter((d) => mask & DEBUFF_BIT[d])
    .map((d) => `<img src="${debuffIcon(d)}" title="${DEBUFF_NAME[d]}" alt="" draggable="false">`).join('');
}

export const debuffsOn = (): boolean => currentBalance().fxLayer.debuffs;

/** The body effects of one monster's debuffs. */
export class DebuffFx {
  private t = 0;
  private dropT = 0;
  private emberT = 0;
  private readonly stars: THREE.Sprite[] = [];
  private reticle: THREE.Mesh | null = null;
  private glow: THREE.Sprite | null = null;

  constructor(private readonly group: THREE.Group) {}

  update(dt: number, m: Monster, fx: Effects): void {
    const mask = m.alive && debuffsOn() ? m.debuffs : 0;
    this.t += dt;
    const head = m.def.height * 0.95;

    // Stun: three stars circling the head.
    const stun = (mask & DEBUFF_BIT.stun) !== 0;
    if (stun && !this.stars.length) {
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTex.glow, color: '#ffe066', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        s.scale.setScalar(0.32);
        this.group.add(s);
        this.stars.push(s);
      }
    } else if (!stun && this.stars.length) {
      for (const s of this.stars.splice(0)) {
        s.removeFromParent();
        s.material.dispose();
      }
    }
    this.stars.forEach((s, i) => {
      const a = this.t * 4 + (i * Math.PI * 2) / 3;
      s.position.set(Math.cos(a) * 0.45, head + 0.1 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.45);
    });

    // Your mark: a red reticle turning over the head.
    const mark = (mask & DEBUFF_BIT.mark) !== 0;
    if (mark && !this.reticle) {
      const mat = new THREE.MeshBasicMaterial({ map: fxTex.ring, color: '#ff4a4a', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
      this.reticle = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7).rotateX(-Math.PI / 2), mat);
      this.group.add(this.reticle);
    } else if (!mark && this.reticle) {
      this.reticle.removeFromParent();
      this.reticle.geometry.dispose();
      (this.reticle.material as THREE.Material).dispose();
      this.reticle = null;
    }
    if (this.reticle) {
      this.reticle.position.y = head + 0.45;
      this.reticle.rotation.y = this.t * 2;
    }

    // Attack down: a dark red glow around the body.
    const weak = (mask & DEBUFF_BIT.weak) !== 0;
    if (weak && !this.glow) {
      this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTex.glow, color: '#a01818', transparent: true, depthWrite: false, opacity: 0.5 }));
      this.glow.scale.setScalar(m.def.height * 1.3);
      this.group.add(this.glow);
    } else if (!weak && this.glow) {
      this.glow.removeFromParent();
      this.glow.material.dispose();
      this.glow = null;
    }
    if (this.glow) {
      this.glow.position.y = m.def.height * 0.45;
      this.glow.material.opacity = 0.35 + 0.15 * Math.sin(this.t * 4);
    }

    // Slow: frost puffs at the feet; armor break: grey bits falling off; burning / poison: embers rising.
    this.dropT -= dt;
    if (this.dropT <= 0 && mask & (DEBUFF_BIT.slow | DEBUFF_BIT.armor)) {
      this.dropT = 0.35;
      const r = m.def.radius;
      if (mask & DEBUFF_BIT.slow) fx.puff(m.x + (Math.random() - 0.5) * r, 0.15, m.z + (Math.random() - 0.5) * r, '#9fd8ff', 0.6, 0.6);
      if (mask & DEBUFF_BIT.armor) fx.burst(m.x, m.def.height * 0.6, m.z, '#a8a8b8', 2, 1.5);
    }
    this.emberT -= dt;
    if (this.emberT <= 0 && mask & DEBUFF_BIT.dot) {
      this.emberT = 0.18;
      const r = m.def.radius * 0.8;
      fx.puff(m.x + (Math.random() - 0.5) * r, m.def.height * (0.3 + Math.random() * 0.5), m.z + (Math.random() - 0.5) * r, '#ff8a3a', 0.5, 0.3);
    }
  }

  dispose(): void {
    for (const s of this.stars.splice(0)) s.material.dispose();
    this.reticle?.geometry.dispose();
    (this.reticle?.material as THREE.Material | undefined)?.dispose();
    this.glow?.material.dispose();
  }
}
