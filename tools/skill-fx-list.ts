// Lists the pictures every active skill plays (cast for real on a headless Sim): effect names, flying shot colours and
// plain shapes. Used to write docs/art/skill-fx-all.md. Run: npx tsx tools/skill-fx-list.ts > out.json
import { CLASSES, CLASS_IDS, isLearnable } from '../src/shared/data/classes';
import { ZONE_1 } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { castSkill } from '../src/shared/sim/skills';

const out: Record<string, { cls: string; id: string; name: string; kind: string; line: number; tier: number; effects: string[]; shots: string[]; shapes: string[] }[]> = {};
for (const cls of CLASS_IDS) {
  out[cls] = [];
  for (const s of CLASSES[cls].skills.filter(isLearnable)) {
    const sim = new Sim(ZONE_1);
    for (let i = 0; i < 400 && sim.monsters.filter((m) => m.alive && !m.isBoss).length < 4; i++) sim.step(0.1);
    const mobs = sim.monsters.filter((m) => m.alive && !m.isBoss).slice(0, 4);
    const p = sim.addPlayer({ ...newCharacterData('T', cls), level: 40 });
    const base = mobs[0];
    p.x = base.x - 3;
    p.z = base.z;
    mobs.forEach((m, i) => { m.x = base.x + (i % 2) * 0.6; m.z = base.z + (i > 1 ? 0.6 : 0); m.hp = 1e9; });
    sim.drainEvents();
    const effects = new Set<string>();
    const shots = new Set<string>();
    const shapes = new Set<string>();
    if (s.kind !== 'passive') {
      castSkill(sim, p, s, { x: base.x, z: base.z }, 1);
      for (let t = 0; t < 6; t += 0.05) {
        for (const pr of sim.projectiles) if (pr.owner === p) shots.add(pr.o.color);
        sim.step(0.05);
        // Buff skills change basic attacks: shoot a few too.
        if (t > 0.5 && t < 3 && Math.round(t * 20) % 10 === 0) p.basicAttack?.(sim, { x: base.x, z: base.z });
      }
    }
    for (const ev of sim.drainEvents()) {
      if (ev.t !== 'fx' || ('to' in ev && ev.to !== undefined && ev.to !== p.id)) continue;
      if (ev.name === 'effect') effects.add(ev.args[0] as string);
      else shapes.add(ev.name);
    }
    out[cls].push({ cls, id: s.id, name: s.nameTh, kind: s.kind, line: s.line, tier: s.tier, effects: [...effects], shots: [...shots], shapes: [...shapes] });
  }
}
console.log(JSON.stringify(out, null, 1));
