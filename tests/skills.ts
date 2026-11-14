// Test helper: the old three skills of a class (the ones on the skill_q / skill_e / skill_r animations) learned at
// `rank` and worn on Q/E/R, as a save's skill book. Since the skill system (owner 2026-11-14) a new character has
// nothing learned, so tests that cast skills give their characters this.
import { CLASSES, LOADOUT_SLOTS } from '../src/shared/data/classes';
import type { SkillBook } from '../src/shared/skillBook';
import type { ClassId } from '../src/shared/types';

export function oldSkills(cls: ClassId, rank = 1): SkillBook {
  const book: SkillBook = { ranks: {}, worn: {} };
  for (const slot of LOADOUT_SLOTS) {
    const sk = CLASSES[cls].skills.find((s) => s.anim === slot)!;
    book.ranks[sk.id] = rank;
    book.worn[slot] = sk.id;
  }
  return book;
}
