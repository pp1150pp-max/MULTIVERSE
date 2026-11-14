// The skill window's constellation (owner 2026-11-14): every class's stars, and a full set of 30 skills + 3 passives
// as the class sessions will add (8 normal + 2 ultimates per line), never overlap and each line comes from somewhere.
import { ok, finish } from './check';
import { CLASSES, type SkillDef } from '../src/shared/data/classes';
import { constellation, type Star } from '../src/client/skillMap';

function overlaps(stars: Star[]): string[] {
  const bad: string[] = [];
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i], b = stars[j];
      // At least 4 px between the edges of two stars.
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.size + b.size) / 2 + 4) bad.push(`${a.sk.id}/${b.sk.id}`);
    }
  }
  return bad;
}

for (const cls of Object.values(CLASSES)) {
  const { stars } = constellation(cls.skills);
  ok(stars.length === cls.skills.filter((s) => s.kind !== 'basic' && s.kind !== 'dash').length, `${cls.id}: a star for every learnable skill`);
  ok(overlaps(stars).length === 0, `${cls.id}: no stars overlap (${overlaps(stars).join(', ')})`);
}

// A full class as planned: 3 lines × (8 normal + 2 ultimates) + 3 passives.
const full: SkillDef[] = [];
const base = { name: '', nameTh: '', desc: '', dmg: 1, mp: 0, cooldown: 1 };
for (let line = 0; line < 3; line++) {
  for (let tier = 0; tier < 8; tier++) full.push({ ...base, id: `n${line}${tier}`, kind: 'normal', line, tier });
  for (let tier = 0; tier < 2; tier++) full.push({ ...base, id: `u${line}${tier}`, kind: 'ult', line, tier });
}
for (let tier = 0; tier < 3; tier++) full.push({ ...base, id: `p${tier}`, kind: 'passive', tier });
{
  const { stars, labels } = constellation(full);
  ok(stars.length === 33, 'full class: 33 stars');
  const bad = overlaps(stars);
  ok(bad.length === 0, `full class: no stars overlap (${bad.slice(0, 5).join(', ')})`);
  // Line names stay clear of every star.
  const hit = labels.filter((l) => stars.some((s) => Math.hypot(l.x - s.x, l.y - s.y) < s.size / 2 + 14));
  ok(hit.length === 0, 'full class: line names clear of the stars');
}

finish('skill-map');
