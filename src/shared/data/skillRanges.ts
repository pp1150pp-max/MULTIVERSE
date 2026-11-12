/**
 * Skill reach in world units (metres), the one place the numbers live: `sim/skills.ts` uses them to hit
 * and the skill tooltip / ground ring on the client read the same values.
 */

export const SLASH_RANGE = 2.3;
export const BOLT_RANGE = 11;
export const SHOT_RANGE = 12;
export const WHIRLWIND_RADIUS = 3.2;
export const EARTHQUAKE_RADIUS = 4.5;
export const CHARGE_DIST = 7;
export const FIREBALL_RANGE = 12;
export const FIREBALL_EXPLODE = 2.6;
export const FROSTNOVA_RADIUS = 4.5;
export const METEOR_RANGE = 12;
export const METEOR_RADIUS = 3.5;
export const RAPIDFIRE_RANGE = 12;
export const PIERCE_RANGE = 16;
export const HEADSHOT_RANGE = 18;

/**
 * How a skill reaches: `self` hits a circle around the caster, `shot` flies in a line up to `range`
 * (`blast` = explosion radius at the end), `point` lands at the mouse within `range` and hits a circle of `radius`,
 * `dash` moves the caster `range`, `cone` hits an arc in front.
 */
export type SkillReach =
  | { kind: 'self'; radius: number }
  | { kind: 'cone'; range: number }
  | { kind: 'shot'; range: number; blast?: number }
  | { kind: 'point'; range: number; radius: number }
  | { kind: 'dash'; range: number };

export const SKILL_REACH: Record<string, SkillReach> = {
  slash: { kind: 'cone', range: SLASH_RANGE },
  whirlwind: { kind: 'self', radius: WHIRLWIND_RADIUS },
  earthquake: { kind: 'self', radius: EARTHQUAKE_RADIUS },
  charge: { kind: 'dash', range: CHARGE_DIST },
  bolt: { kind: 'shot', range: BOLT_RANGE },
  fireball: { kind: 'shot', range: FIREBALL_RANGE, blast: FIREBALL_EXPLODE },
  frostnova: { kind: 'self', radius: FROSTNOVA_RADIUS },
  meteor: { kind: 'point', range: METEOR_RANGE, radius: METEOR_RADIUS },
  shot: { kind: 'shot', range: SHOT_RANGE },
  rapidfire: { kind: 'shot', range: RAPIDFIRE_RANGE },
  pierce: { kind: 'shot', range: PIERCE_RANGE },
  headshot: { kind: 'shot', range: HEADSHOT_RANGE },
};

/** Radius of the ring to draw on the ground for a skill: its own circle, or how far it reaches. */
export function reachRadius(r: SkillReach): number {
  return r.kind === 'self' ? r.radius : r.range;
}

/** Tooltip line, e.g. "ระยะ 11 ม." or "วงรอบตัว 3.2 ม.". */
export function reachText(r: SkillReach): string {
  const n = (v: number) => String(Math.round(v * 10) / 10);
  switch (r.kind) {
    case 'self': return `วงรอบตัว รัศมี ${n(r.radius)} ม.`;
    case 'cone': return `ระยะ ${n(r.range)} ม. (ด้านหน้า)`;
    case 'shot': return `ระยะ ${n(r.range)} ม.${r.blast ? ` · ระเบิดรัศมี ${n(r.blast)} ม.` : ''}`;
    case 'point': return `ระยะ ${n(r.range)} ม. · วงตกรัศมี ${n(r.radius)} ม.`;
    case 'dash': return `พุ่ง ${n(r.range)} ม.`;
  }
}
