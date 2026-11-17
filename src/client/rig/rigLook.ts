// Which picture each bone of the sword rig shows, for a view, an armour and a sword (the pairing of items to
// pictures is src/shared/rigLookTuning.ts). No three.js here: the preview tool uses it too.
import { RIG_ARMORS, RIG_WEAPONS, type RigArmor, type RigWeapon } from '../../shared/rigLookTuning';
import type { RigViewName } from './rigMath';

export type { RigArmor, RigWeapon };

/** Pieces an armour replaces (the head and the cape stay). */
const ARMOR_PARTS = new Set([
  'torso', 'hips', 'upper_arm_l', 'upper_arm_r', 'forearm_l', 'forearm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r',
]);

/** Folder of the pieces under public/assets/sprites/. */
export const RIG_DIR = 'player/sword_rig';

/** The picture (path under RIG_DIR, no extension) a bone's part shows. The `sword` part is the chosen sword. */
export function rigPartPath(view: RigViewName, part: string, armor: RigArmor, weapon: RigWeapon): string {
  if (part === 'sword') return `weapons/${weapon}`;
  if (armor !== 'dark' && ARMOR_PARTS.has(part)) return `${view}_${armor}/${part}`;
  return `${view}/${part}`;
}

/** Every picture the rig may show (to load them all up front). */
export function allRigParts(parts: Iterable<string>): string[] {
  const out = new Set<string>();
  const list = [...parts];
  for (const view of ['front', 'back'] as const) {
    for (const part of list) for (const a of RIG_ARMORS) for (const w of RIG_WEAPONS) out.add(rigPartPath(view, part, a, w));
  }
  return [...out];
}
