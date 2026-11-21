// Bosses' skill effects (owner 2026-11-21): the server sends one painted effect per skill (sheets boss_bear,
// boss_witch, boss_yeti, boss_heart, see Effects.effect), and here the code effects drawn on top of it: shock rings,
// ground cracks, smoke, embers, snow (the same pieces as the players' skills, skillExtras.ts). The red warnings are
// left as they were. Switches: /admin → ปรับสมดุล → วงเวทและเอฟเฟกต์โค้ดรายสกิล → สกิลบอส
// (fxLayer.bossFx, bossExtras, bossExtrasK).
import { currentBalance } from '../shared/balance';
import type { BossEffect } from '../shared/sim/types';
import type { Element } from './circleDesigns';
import type { Effects } from './effects';
import { playExtras, type Extra } from './skillExtras';

interface BossFxDef {
  el: Element;
  extras: Extra[];
  /** A melee hit: the server sends the boss's own spot and facing, `size` its reach; the picture goes in front. */
  melee?: boolean;
}

const BOSS_FX: Record<BossEffect, BossFxDef> = {
  boss_bear_claw: { el: 'blood', extras: ['streak', 'burst'], melee: true },
  boss_bear_slam: { el: 'earth', extras: ['cracks', 'shock', 'smoke'] },
  boss_bear_roar: { el: 'blood', extras: ['shock', 'flash'] },
  boss_witch_swipe: { el: 'poison', extras: ['streak', 'sparkle'], melee: true },
  boss_witch_slam: { el: 'poison', extras: ['shock', 'smoke'] },
  boss_witch_frenzy: { el: 'poison', extras: ['smoke', 'embers', 'shock'] },
  boss_yeti_hit: { el: 'ice', extras: ['sparkle', 'snow'], melee: true },
  boss_yeti_slam: { el: 'ice', extras: ['cracks', 'shock', 'snow'] },
  boss_yeti_snow: { el: 'ice', extras: ['snow', 'shock'] },
  boss_yeti_blizzard: { el: 'ice', extras: ['snow', 'sparkle'] },
  boss_heart_impact: { el: 'fire', extras: ['flash', 'embers', 'smoke'] },
  boss_heart_blast: { el: 'fire', extras: ['flash', 'shock', 'cracks', 'embers', 'smoke'] },
};

export const isBossEffect = (name: string): name is BossEffect => name in BOSS_FX;

/** The painted boss effects are on (off = the old look: plain slash for a hit, nothing extra for the rest). */
export const bossFxOn = (): boolean => currentBalance().fxLayer.bossFx;

/** Where a boss effect's picture goes: in front of the boss for a hit, else where the server put it. */
export function bossFxSpot(name: BossEffect, x: number, z: number, angle: number, size: number): { x: number; z: number; size: number } {
  if (!BOSS_FX[name].melee) return { x, z, size };
  return { x: x + Math.cos(angle) * size * 0.7, z: z + Math.sin(angle) * size * 0.7, size: Math.max(1, size * 0.8) };
}

export const isBossMelee = (name: BossEffect): boolean => !!BOSS_FX[name].melee;

/** The code effects over a boss effect (once per effect), at its picture's spot. */
export function playBossExtras(fx: Effects, name: BossEffect, x: number, z: number, angle: number, size: number): void {
  const fl = currentBalance().fxLayer;
  if (!fl.enabled || !fl.bossExtras || fl.bossExtrasK <= 0) return;
  const def = BOSS_FX[name];
  playExtras(fx, def.extras, def.el, fl.bossExtrasK, x, z, angle, size);
}
