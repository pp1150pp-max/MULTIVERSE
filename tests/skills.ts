// Test helper: the old three skills of a class (the ones on the skill_q / skill_e / skill_r animations before the
// class skill PRs) learned at `rank` and worn on Q/E/R, as a save's skill book. Since the skill system (owner
// 2026-11-14) a new character has nothing learned, so tests that cast skills give their characters this.
// Named by id: each class now has many skills on the same animation row.
import { LOADOUT_SLOTS } from '../src/shared/data/classes';
import type { SkillBook } from '../src/shared/skillBook';
import type { ClassId } from '../src/shared/types';

const OLD: Record<ClassId, [string, string, string]> = {
  sword: ['whirlwind', 'earthquake', 'charge'],
  mage: ['fireball', 'frostnova', 'meteor'],
  gunslinger: ['rapidfire', 'pierce', 'headshot'],
};

export function oldSkills(cls: ClassId, rank = 1): SkillBook {
  const book: SkillBook = { ranks: {}, worn: {} };
  LOADOUT_SLOTS.forEach((slot, i) => {
    const id = OLD[cls][i];
    book.ranks[id] = rank;
    book.worn[slot] = id;
  });
  return book;
}
