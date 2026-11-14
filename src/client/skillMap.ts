// Where each star of the skill window's constellation sits (skillWindow.ts): no DOM here, so tests can check that
// no two stars overlap for any class.
import type { SkillDef } from '../shared/data/classes';
import { unlockLevel } from '../shared/skillBook';

// ---------------------------------------------------------------- layout (pixels on the map)
/** Direction of each line's arm, in degrees (0 = right, 90 = down): upper left, upper right, down. */
const ARM_ANGLE = [-150, -30, 90];
/** Distance of the first star from the centre, between stars along an arm, and the zig-zag to each side. */
const ARM_START = 72;
const ARM_STEP = 34;
const ARM_ZIG = 17;
/** How far an ultimate sits off the side of its arm. */
const ULT_SIDE = 74;
/** Passives circle the centre at these angles, this far out. */
const PASSIVE_ANGLE = [-90, 30, 150];
const PASSIVE_R = 46;
/** Star sizes: normal, ultimate, passive. */
export const SIZE = { normal: 40, ult: 52, passive: 34 } as const;
/** Empty space around the stars. */
export const PAD = 34;

export interface Pt { x: number; y: number }
export interface Star extends Pt { sk: SkillDef; size: number; from: Pt }

/** A point `d` along line `line`'s arm and `side` to its right (centre at 0,0). */
function onArm(line: number, d: number, side: number): Pt {
  const a = ((ARM_ANGLE[line] ?? 90) * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  return { x: dx * d - dy * side, y: dy * d + dx * side };
}
/** Where the normal skill of this tier sits on its arm (tier 0 nearest the centre, zig-zagging). */
const normalAt = (line: number, tier: number): Pt => onArm(line, ARM_START + tier * ARM_STEP, (tier % 2 ? 1 : -1) * ARM_ZIG);

/** Where ultimate j of a line sits: off the arm between normal tiers 1+2j and 2+2j, sides taking turns. */
const ultAt = (line: number, j: number): Pt => onArm(line, ARM_START + (1.5 + 2 * j) * ARM_STEP, (j % 2 ? 1 : -1) * ULT_SIDE);

/** Every skill's star, with the point its line comes from, around a centre at 0,0. */
/** A segment of the constellation's outline (drawn faintly under the stars, so empty places show the shape). */
export interface Seg { from: Pt; to: Pt; line: number }

export function constellation(skills: readonly SkillDef[]): { stars: Star[]; labels: Pt[]; outline: Seg[]; spots: Pt[] } {
  const stars: Star[] = [];
  const passives = skills.filter((s) => s.kind === 'passive').sort((a, b) => unlockLevel(a) - unlockLevel(b));
  for (const sk of skills) {
    if (sk.kind === 'normal' && sk.line !== undefined) {
      const t = sk.tier ?? 0;
      const from = t === 0 ? onArm(sk.line, 22, 0) : normalAt(sk.line, t - 1);
      stars.push({ ...normalAt(sk.line, t), sk, size: SIZE.normal, from });
    } else if (sk.kind === 'ult' && sk.line !== undefined) {
      // Ultimate j opens between normal tiers 1+2j and 2+2j: it hangs off the arm there, sides taking turns.
      const j = sk.tier ?? 0;
      stars.push({ ...ultAt(sk.line, j), sk, size: SIZE.ult, from: normalAt(sk.line, 1 + 2 * j) });
    }
  }
  passives.forEach((sk, i) => {
    const a = ((PASSIVE_ANGLE[i % 3] + 20 * Math.floor(i / 3)) * Math.PI) / 180;
    const r = PASSIVE_R + 34 * Math.floor(i / 3);
    stars.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, sk, size: SIZE.passive, from: { x: 0, y: 0 } });
  });
  // Each line's name sits past the far end of its arm.
  const labels = ARM_ANGLE.map((_, i) => onArm(i, ARM_START + 7 * ARM_STEP + 44, 0));
  // The outline of every arm (8 normal places and 2 ultimates), and a small dot on each place no skill takes yet.
  const outline: Seg[] = [];
  const spots: Pt[] = [];
  const near = (p: Pt) => stars.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 1);
  ARM_ANGLE.forEach((_, line) => {
    let prev = onArm(line, 22, 0);
    for (let t = 0; t < 8; t++) {
      const p = normalAt(line, t);
      outline.push({ from: prev, to: p, line });
      if (!near(p)) spots.push(p);
      prev = p;
    }
    for (let j = 0; j < 2; j++) {
      const p = ultAt(line, j);
      outline.push({ from: normalAt(line, 1 + 2 * j), to: p, line });
      if (!near(p)) spots.push(p);
    }
  });
  return { stars, labels, outline, spots };
}

