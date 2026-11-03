import type { Game } from './Game';
import type { Intent } from '../shared/sim/types';
import type { Monster } from '../shared/sim/Monster';
import { MONSTERS } from '../shared/data/monsters';
import type { SkillSlot } from '../shared/data/classes';

const RANGE: Record<string, number> = { sword: 1.9, mage: 8.5, gunslinger: 9 };

/**
 * Open-world farming bot. Manual input always wins for that frame,
 * so the player can steer or fight at any time while Auto stays on.
 * Bosses are skipped on purpose — those are meant to be fought by hand.
 */
export class AutoPlay {
  private target: Monster | null = null;
  private retargetAt = 0;
  private roam: { x: number; z: number } | null = null;

  reset(): void {
    this.target = null;
    this.roam = null;
  }

  intent(g: Game, manual: Intent): Intent {
    const p = g.player;
    if (manual.move || manual.moveTo || manual.basic) {
      this.reset();
      return manual;
    }
    const out: Intent = { ...manual, skills: [...manual.skills] };
    const dist = (a: { x: number; z: number }) => Math.hypot(a.x - p.x, a.z - p.z);

    if (!out.potion && p.potCd <= 0) {
      if (p.hp < p.maxHp * 0.45 && p.hpPots > 0) out.potion = 'hp';
      else if (p.mp < p.stats.maxMp * 0.15 && p.mpPots > 0) out.potion = 'mp';
    }

    const threatened = g.monsters.some((m) => m.isHostile && dist(m) < 3.5);
    if (!threatened) {
      let best = null as { x: number; z: number } | null;
      let bd = 9;
      for (const l of g.loots) {
        if (l.dead || l.dropped || (l.kind.type === 'item' && !p.hasBagSpace())) continue;
        const d = dist(l);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      if (best) {
        out.moveTo = { x: best.x, z: best.z };
        return out;
      }
    }

    const t = this.target;
    if (!t || !t.alive || dist(t) > 22 || t.state === 'return' || g.time > this.retargetAt) {
      this.target = this.pickTarget(g);
      this.retargetAt = g.time + 4;
    }
    const target = this.target;
    if (!target) {
      out.moveTo = this.roamPoint(g);
      return out;
    }
    this.roam = null;

    const d = dist(target);
    const range = RANGE[p.cls.id] ?? 2;
    out.aim = { x: target.x, z: target.z };
    if (d > range) {
      out.moveTo = { x: target.x, z: target.z };
      if (p.cls.id === 'sword' && d > 4 && d < 7) this.tryCast(g, out, 'e');
      return out;
    }
    out.basic = true;
    const near = g.monsters.filter((m) => m.alive && Math.hypot(m.x - p.x, m.z - p.z) < 4.5).length;
    const nearTarget = g.monsters.filter((m) => m.alive && Math.hypot(m.x - target.x, m.z - target.z) < 3.5).length;
    switch (p.cls.id) {
      case 'sword':
        if (near >= 2) this.tryCast(g, out, 'q');
        if (near >= 3 || target.hp > 250) this.tryCast(g, out, 'r');
        break;
      case 'mage':
        this.tryCast(g, out, 'q');
        if (near >= 2) this.tryCast(g, out, 'e');
        if (nearTarget >= 3 || target.hp > 250) this.tryCast(g, out, 'r');
        break;
      case 'gunslinger':
        if (d < 6) this.tryCast(g, out, 'q');
        this.tryCast(g, out, 'e');
        if (nearTarget >= 3 || target.hp > 250) this.tryCast(g, out, 'r');
        break;
    }
    return out;
  }

  private tryCast(g: Game, out: Intent, slot: SkillSlot): void {
    const p = g.player;
    const sk = p.skill(slot);
    if (sk && (p.cd[slot] ?? 0) <= 0 && p.mp >= sk.mp + 5 && !out.skills.includes(slot)) out.skills.push(slot);
  }

  private pickTarget(g: Game): Monster | null {
    const p = g.player;
    let best: Monster | null = null;
    let bs = Infinity;
    for (const m of g.monsters) {
      if (!m.alive || m.isBoss || m.state === 'return') continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d > 24) continue;
      if (m.level > p.level + 3 && !m.isHostile) continue;
      const score = d - (m.isHostile ? 10 : 0);
      if (score < bs) {
        bs = score;
        best = m;
      }
    }
    return best;
  }

  /** Walk toward the best farming spot for the current level. */
  private roamPoint(g: Game): { x: number; z: number } {
    const p = g.player;
    if (this.roam && Math.hypot(this.roam.x - p.x, this.roam.z - p.z) > 1) return this.roam;
    const areas = g.zone.spawns.filter((s) => MONSTERS[s.monster].levels[0] <= p.level + 1);
    const pool = areas.length ? areas : g.zone.spawns;
    const top = Math.max(...pool.map((s) => MONSTERS[s.monster].levels[0]));
    const choices = pool.filter((s) => MONSTERS[s.monster].levels[0] === top);
    const a = choices[Math.floor(Math.random() * choices.length)];
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * a.radius * 0.6;
    this.roam = { x: a.x + Math.cos(ang) * r, z: a.z + Math.sin(ang) * r };
    return this.roam;
  }
}
