import type { Intent } from './types';
import type { Monster } from './Monster';
import { AUTO_PX_PER_UNIT, type Player } from './Player';
import type { Loot } from './Loot';
import { MONSTERS } from '../data/monsters';
import type { SkillSlot } from '../data/classes';
import { inBossArena, inSafeArea, lavaAt, type ZoneDef } from '../data/zones';

/** What the bot needs to see. The server builds one per player. */
export interface AutoWorld {
  readonly player: Player;
  readonly monsters: readonly Monster[];
  readonly loots: readonly Loot[];
  readonly time: number;
  readonly zone: ZoneDef;
}

/**
 * Bosses are fought by hand, on every map: Auto can't run inside a boss's arena, nor while a boss is
 * after this player. Whoever runs the bot switches it off when this says so.
 */
/** Why Auto can't run where the player stands (a boss fight or the town), or null when it can. */
export function autoBlocked(zone: ZoneDef, monsters: readonly Monster[], p: { x: number; z: number; id: number }): string | null {
  if (inSafeArea(zone, p.x, p.z)) return AUTO_TOWN_MSG;
  if (inBossArena(zone, p.x, p.z) || monsters.some((m) => m.isBoss && m.alive && m.isHostile && m.target?.id === p.id)) return AUTO_BOSS_MSG;
  return null;
}

/** Message shown when Auto is refused or stopped because of a boss. */
export const AUTO_BOSS_MSG = 'ปิด Auto Play — บอสต้องสู้เอง ใช้ Auto ในลานบอสไม่ได้';
/** Message shown when Auto is refused or stopped in the town. */
export const AUTO_TOWN_MSG = 'ใช้ Auto Play ในเมืองไม่ได้ — ออกไปนอกเมืองก่อน';

const RANGE: Record<string, number> = { sword: 1.9, mage: 8.5, gunslinger: 9 };
/** Loot within this distance is fetched even while monsters attack; up to LOOT_FAR when it's calm. */
const LOOT_NEAR = 5;
const LOOT_FAR = 9;
/** Seconds with nothing to fight before Auto tells the player: quickly when no monster lives in the circle at all,
 *  later when it is only waiting for respawns. Then at most one message per IDLE_HINT_EVERY. */
const IDLE_HINT_EMPTY = 3;
const IDLE_HINT_WAITING = 15;
const IDLE_HINT_EVERY = 30;
export const AUTO_HINT_COLOR = '#ffb36a';
/** Auto fights monsters of any level; one this many levels above the player gets a warning. */
export const AUTO_LEVEL_WARN = 10;

/**
 * Open-world farming bot. The server runs it, so it keeps farming while the tab is hidden. Walking by hand turns it off (Game.update); manual attacks
 * and skills just win for that frame while Auto stays on.
 * Bosses are skipped on purpose — those are meant to be fought by hand.
 * It stays inside a circle (the player's Auto range setting) around where Auto was switched on.
 */
export class AutoPlay {
  private target: Monster | null = null;
  private retargetAt = 0;
  private roam: { x: number; z: number } | null = null;
  /** Centre of the farming circle: where Auto was switched on. */
  private anchor: { x: number; z: number } | null = null;

  private idleSince: number | null = null;
  private hintAt = -Infinity;
  private hint: string | null = null;
  private levelHintAt = -Infinity;

  /** Auto was just switched on here. */
  start(x: number, z: number): void {
    this.anchor = { x, z };
    this.idleSince = null;
    this.hintAt = -Infinity;
    this.levelHintAt = -Infinity;
    this.reset();
  }

  /** A message for the player (nothing to fight in the circle), once; whoever runs the bot shows it. */
  takeHint(): string | null {
    const h = this.hint;
    this.hint = null;
    return h;
  }

  /** Called every frame Auto has no monster to fight. */
  private noteIdle(g: AutoWorld): void {
    this.idleSince ??= g.time;
    if (g.time - this.hintAt < IDLE_HINT_EVERY) return;
    const a = this.anchor ?? g.player;
    const R = this.radius(g.player);
    const hasArea = g.zone.spawns.some((s) => Math.hypot(s.x - a.x, s.z - a.z) < R + s.radius);
    if (g.time - this.idleSince < (hasArea ? IDLE_HINT_WAITING : IDLE_HINT_EMPTY)) return;
    this.hintAt = g.time;
    this.hint = hasArea
      ? 'Auto: ยังไม่มีมอนให้ตีในระยะฟาร์ม — รอมอนเกิด หรือเพิ่มระยะที่ปุ่ม ⚙'
      : 'Auto: ไม่มีมอนในระยะฟาร์ม — เพิ่มระยะที่ปุ่ม ⚙ หรือไปเปิด Auto ใกล้ๆ มอน';
  }

  /** Auto fights monsters of any level, but warns (now and then) when one is far above the player. */
  private noteLevelGap(g: AutoWorld, m: Monster): void {
    if (m.level - g.player.level < AUTO_LEVEL_WARN || g.time - this.levelHintAt < IDLE_HINT_EVERY) return;
    this.levelHintAt = g.time;
    this.hint = `Auto: ระวัง! ${m.def.nameTh} Lv.${m.level} สูงกว่าคุณ ${m.level - g.player.level} เลเวล — อาจตายได้`;
  }

  reset(): void {
    this.target = null;
    this.roam = null;
  }

  /** The farming circle's radius in world units. */
  private radius(p: Player): number {
    return p.autoSettings.range / AUTO_PX_PER_UNIT;
  }

  private fromAnchor(a: { x: number; z: number }): number {
    return this.anchor ? Math.hypot(a.x - this.anchor.x, a.z - this.anchor.z) : 0;
  }

  intent(g: AutoWorld, manual: Intent): Intent {
    const p = g.player;
    if (manual.move || manual.moveTo || manual.basic) {
      this.reset();
      return manual;
    }
    const out: Intent = { ...manual, skills: [...manual.skills] };
    const dist = (a: { x: number; z: number }) => Math.hypot(a.x - p.x, a.z - p.z);
    const set = p.autoSettings;
    this.anchor ??= { x: p.x, z: p.z };
    const R = this.radius(p);

    if (!out.potion && p.potCd <= 0) {
      // Count what the potions being drunk will still restore, so Auto doesn't chug while they work.
      if (p.hp + p.potionPending('hp') < p.maxHp * (set.hpPct / 100) && p.potionCount('hp') > 0) out.potion = 'hp';
      else if (p.mp + p.potionPending('mp') < p.stats.maxMp * (set.mpPct / 100) && p.potionCount('mp') > 0) out.potion = 'mp';
    }

    // Standing in lava comes before everything else: walk straight out of the pool.
    const pool = lavaAt(g.zone, p.x, p.z);
    if (pool) {
      const dx = p.x - pool.x;
      const dz = p.z - pool.z;
      const d = Math.hypot(dx, dz) || 1;
      const out2 = Math.max(pool.rx, pool.rz) + 1.5;
      out.moveTo = { x: pool.x + (dx / d) * out2, z: pool.z + (dz / d) * out2 };
      return out;
    }

    // Loot close by is picked up even mid-fight; farther loot only when nothing is attacking.
    // Loot that doesn't fit in the bag (or the loot filter skips) is ignored, so a full bag just keeps fighting.
    const threatened = g.monsters.some((m) => m.isHostile && dist(m) < 3.5);
    let best = null as { x: number; z: number } | null;
    let bd = threatened ? LOOT_NEAR : LOOT_FAR;
    for (const l of set.loot ? g.loots : []) {
      if (this.fromAnchor(l) > R + 0.5 || inBossArena(g.zone, l.x, l.z) || lavaAt(g.zone, l.x, l.z)) continue;
      if (l.dead || l.dropped || !l.canTake(p.id, g.time) || !p.wantsLoot(l.kind, false) || !p.canFit(l.kind)) continue;
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

    const t = this.target;
    const strayed = !!t && !t.isHostile && this.fromAnchor(t) > R + 3;
    if (!t || !t.alive || dist(t) > 22 || t.state === 'return' || strayed || g.time > this.retargetAt) {
      this.target = this.pickTarget(g);
      this.retargetAt = g.time + 4;
    }
    const target = this.target;
    if (!target) {
      this.noteIdle(g);
      out.moveTo = this.roamPoint(g);
      return out;
    }
    this.idleSince = null;
    this.roam = null;
    this.noteLevelGap(g, target);

    const d = dist(target);
    const range = RANGE[p.cls.id] ?? 2;
    out.aim = { x: target.x, z: target.z };
    if (d > range) {
      out.moveTo = { x: target.x, z: target.z };
      if (p.cls.id === 'sword' && d > 4 && d < 7) this.tryCast(g, out, 'r');
      return out;
    }
    out.basic = true;
    const near = g.monsters.filter((m) => m.alive && Math.hypot(m.x - p.x, m.z - p.z) < 4.5).length;
    const nearTarget = g.monsters.filter((m) => m.alive && Math.hypot(m.x - target.x, m.z - target.z) < 3.5).length;
    switch (p.cls.id) {
      case 'sword':
        if (near >= 2) this.tryCast(g, out, 'q');
        // Parry only when several monsters are already swinging at us.
        if (g.monsters.filter((m) => m.isHostile && Math.hypot(m.x - p.x, m.z - p.z) < 3).length >= 2) this.tryCast(g, out, 'e');
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

  private tryCast(g: AutoWorld, out: Intent, slot: SkillSlot): void {
    const p = g.player;
    const sk = p.skill(slot);
    if ((slot === 'q' || slot === 'e' || slot === 'r') && !p.autoSettings.skills[slot]) return;
    // Auto never takes the second cast (sword Charge): it could carry the player out of the fight.
    if ((p.recast[slot] ?? 0) > 0) return;
    if (sk && (p.cd[slot] ?? 0) <= 0 && p.mp >= sk.mp + 5 && !out.skills.includes(slot)) out.skills.push(slot);
  }

  private pickTarget(g: AutoWorld): Monster | null {
    const p = g.player;
    let best: Monster | null = null;
    let bs = Infinity;
    for (const m of g.monsters) {
      if (!m.alive || m.isBoss || m.state === 'return' || inBossArena(g.zone, m.x, m.z)) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d > 24) continue;
      // Only inside the circle, except monsters already attacking the player.
      if (this.fromAnchor(m) > this.radius(p) && !(m.isHostile && d < 4.5)) continue;
      const score = d - (m.isHostile ? 10 : 0);
      if (score < bs) {
        bs = score;
        best = m;
      }
    }
    return best;
  }

  /** Nothing to fight: walk somewhere else inside the circle, preferring spawn spots for this level. */
  private roamPoint(g: AutoWorld): { x: number; z: number } {
    const p = g.player;
    const anchor = this.anchor ?? { x: p.x, z: p.z };
    const R = this.radius(p);
    if (this.roam && Math.hypot(this.roam.x - p.x, this.roam.z - p.z) > 1) return this.roam;
    const inCircle = g.zone.spawns.filter((s) => Math.hypot(s.x - anchor.x, s.z - anchor.z) < R + s.radius);
    const fit = inCircle.filter((s) => MONSTERS[s.monster].levels[0] <= p.level + 1);
    const pool = fit.length ? fit : inCircle;
    let x: number;
    let z: number;
    const ang = Math.random() * Math.PI * 2;
    if (pool.length) {
      const top = Math.max(...pool.map((s) => MONSTERS[s.monster].levels[0]));
      const choices = pool.filter((s) => MONSTERS[s.monster].levels[0] === top);
      const a = choices[Math.floor(Math.random() * choices.length)];
      const r = Math.random() * a.radius * 0.6;
      x = a.x + Math.cos(ang) * r;
      z = a.z + Math.sin(ang) * r;
    } else {
      const r = Math.sqrt(Math.random()) * R * 0.7;
      x = anchor.x + Math.cos(ang) * r;
      z = anchor.z + Math.sin(ang) * r;
    }
    // Pull the point back inside the circle.
    const dx = x - anchor.x;
    const dz = z - anchor.z;
    const d = Math.hypot(dx, dz);
    if (d > R * 0.9) {
      x = anchor.x + (dx / d) * R * 0.9;
      z = anchor.z + (dz / d) * R * 0.9;
    }
    // Never wander into a boss's arena or a pool: wait where it is instead.
    if (inBossArena(g.zone, x, z) || lavaAt(g.zone, x, z)) return { x: p.x, z: p.z };
    this.roam = { x, z };
    return this.roam;
  }
}
