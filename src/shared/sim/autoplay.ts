import type { Intent } from './types';
import type { Monster } from './Monster';
import { AUTO_PX_PER_UNIT, type AutoSkill, type Player } from './Player';
import { isPriorityLoot, type Loot } from './Loot';
import { MONSTERS } from '../data/monsters';
import { inBossArena, inSafeArea, lavaAt, whirlpoolAt, type ZoneDef } from '../data/zones';
import { currentBalance } from '../balance';
import { SKILL_REACH } from '../data/skillRanges';
import { skillReach, skillValues } from '../skillBook';
import type { AutoConfig, AutoOutAction } from '../autoTuning';

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

/** Tuned basic-attack reach ÷ its code reach (1 when untuned), for Auto's standing distance. */
function basicReachScale(p: Player): number {
  const sk = p.skill('basic');
  if (!sk) return 1;
  const now = skillReach(sk);
  const code = SKILL_REACH[sk.id];
  const r = (x: typeof now) => (x && x.kind !== 'self' ? x.range : 0);
  return r(now) > 0 && r(code) > 0 ? r(now) / r(code) : 1;
}
/** A drop counts as "got closer" (resetting the give-up timer) only when Auto is this much nearer than before. */
const LOOT_PROGRESS = 0.25;
/** Monsters farther than this are never targeted (nor hold up "fight first" looting). */
const TARGET_REACH = 24;
/** Thai reasons for the "out of supplies" options. */
const OUT_WHY = { noHp: 'ยา HP หมด', noMp: 'ยา MP หมด', bagFull: 'กระเป๋าเต็ม' } as const;
/** Seconds with nothing to fight before Auto tells the player: quickly when no monster lives in the circle at all,
 *  later when it is only waiting for respawns. Then at most one message per IDLE_HINT_EVERY. */
const IDLE_HINT_EMPTY = 3;
const IDLE_HINT_WAITING = 15;
const IDLE_HINT_EVERY = 30;
/** Waiting at the Auto start spot: counts as arrived within HOME_ARRIVE, walks back only past HOME_LEAVE (no jitter);
 *  gives up walking home after HOME_STUCK_SEC without getting closer. */
const HOME_ARRIVE = 1;
const HOME_LEAVE = 2.5;
const HOME_STUCK_SEC = 3;
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
  /** When Auto last asked for a skill: the next waits `autoSettings.skillGap` seconds (owner 2026-11-22). */
  private lastSkillAt = -Infinity;
  private roam: { x: number; z: number } | null = null;
  /** Centre of the farming circle: where Auto was switched on. */
  private anchor: { x: number; z: number } | null = null;
  /** Waiting at the anchor (see homePoint). */
  private homeArrived = false;
  private homeProgress: { bestD: number; since: number } | null = null;

  private idleSince: number | null = null;
  private hintAt = -Infinity;
  private hint: string | null = null;
  private levelHintAt = -Infinity;
  /** The drop Auto walks to, its nearest distance so far and since when it hasn't got closer (give-up timer). */
  private chase: { id: number; bestD: number; since: number } | null = null;
  /** Drops Auto gave up on (couldn't reach or pick up): ignored from now on. */
  private gaveUp = new Set<number>();
  /** Auto wants to be switched off (out of supplies, or reading the return scroll): the message why. */
  private stopMsg: string | null = null;

  /** Auto was just switched on here. */
  start(x: number, z: number): void {
    this.anchor = { x, z };
    this.idleSince = null;
    this.hintAt = -Infinity;
    this.levelHintAt = -Infinity;
    this.reset();
  }

  /**
   * Auto switched itself off (out of potions / full bag, per the player's options): the message for the player,
   * once. Whoever runs the bot turns it off when this is set (the intent may carry `recall` to start the scroll).
   */
  takeStop(): string | null {
    const m = this.stopMsg;
    this.stopMsg = null;
    return m;
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
    this.chase = null;
    this.homeArrived = false;
    this.homeProgress = null;
  }

  /** A monster after this player right now (not one walking back home). */
  private static attacking(m: Monster, p: Player): boolean {
    return m.alive && !m.untargetable && !m.isBoss && m.isHostile && m.state !== 'return' && m.target?.id === p.id;
  }

  /**
   * HP potions gone, MP potions gone or the bag full, with the player's option for it not "fight on":
   * stops Auto (stopMsg), or reads the return scroll once nothing attacks. True = this frame is handled.
   */
  private outOfSupplies(p: Player, cfg: AutoConfig, attacked: boolean, out: Intent): boolean {
    const set = p.autoSettings;
    const checks: [keyof typeof OUT_WHY, boolean, AutoOutAction][] = [
      ['noHp', p.potionCount('hp') <= 0, set.noHp],
      ['noMp', p.potionCount('mp') <= 0, set.noMp],
      ['bagFull', !p.hasBagSpace(), set.bagFull],
    ];
    for (const [k, hit, chosen] of checks) {
      if (!hit || chosen === 'fight') continue;
      const action = chosen === 'scroll' && !cfg.allow.scroll ? 'stop' : chosen;
      const why = OUT_WHY[k];
      if (action === 'stop') {
        this.stopMsg = `ปิด Auto Play — ${why}`;
        return true;
      }
      if (p.stoneCount('return_scroll') < 1) {
        this.stopMsg = `ปิด Auto Play — ${why} และไม่มีม้วนคัมภีร์กลับเมือง`;
        return true;
      }
      // Being hit breaks the cast: fight off whatever attacks first, then read the scroll.
      if (attacked) return false;
      this.stopMsg = `ปิด Auto Play — ${why} ใช้ม้วนคัมภีร์กลับเมือง`;
      out.recall = true;
      out.moveTo = null;
      out.basic = false;
      out.skills = [];
      return true;
    }
    return false;
  }

  /**
   * The drop to walk to now, or null, by the player's loot order and options. A drop Auto walks to without
   * getting closer for `giveUpSec` (stuck on something, or the server won't hand it over) is skipped for good.
   */
  private pickLoot(g: AutoWorld, cfg: AutoConfig, attackers: number): Loot | null {
    const p = g.player;
    const set = p.autoSettings;
    if (!set.loot) {
      this.chase = null;
      return null;
    }
    const order = set.lootOrder === 'loot' && !cfg.allow.lootFirst ? 'balanced' : set.lootOrder;
    // Stones, boxes, cards (Loot.isPriorityLoot) come first, mid-fight too, whatever the order (owner 2026-11-25).
    if (cfg.priorityLoot) {
      const first = this.nearestLoot(g, cfg, cfg.priorityDist > 0 ? cfg.priorityDist : Infinity, true);
      if (first) return first;
    }
    // Fight first: nothing is picked up while anything attacks.
    if (order === 'fight' && attackers > 0) {
      this.chase = null;
      return null;
    }
    const dist = (a: { x: number; z: number }) => Math.hypot(a.x - p.x, a.z - p.z);
    let maxD = Infinity;
    // Balanced (the old way): drops close by even mid-fight; anything in the circle once nothing is near.
    if (order === 'balanced' && g.monsters.some((m) => m.isHostile && dist(m) < cfg.threatDist)) maxD = cfg.nearDist;
    return this.nearestLoot(g, cfg, maxD, false);
  }

  /**
   * The nearest drop within `maxD` that Auto may take (in its circle, filter, bag room, own-loot option), following the
   * give-up rule; `priority` = only Loot.isPriorityLoot kinds. Null when there is none.
   */
  private nearestLoot(g: AutoWorld, cfg: AutoConfig, maxD: number, priority: boolean): Loot | null {
    const p = g.player;
    const othersLoot = p.autoSettings.othersLoot && cfg.allow.othersLoot;
    const dist = (a: { x: number; z: number }) => Math.hypot(a.x - p.x, a.z - p.z);
    const R = this.radius(p);
    if (this.gaveUp.size > 50) {
      const live = new Set(g.loots.map((l) => l.id));
      for (const id of this.gaveUp) if (!live.has(id)) this.gaveUp.delete(id);
    }
    for (;;) {
      let best: Loot | null = null;
      let bd = maxD;
      for (const l of g.loots) {
        if (priority && !isPriorityLoot(l.kind)) continue;
        if (this.gaveUp.has(l.id) || this.fromAnchor(l) > R + 0.5 || inBossArena(g.zone, l.x, l.z) || lavaAt(g.zone, l.x, l.z)) continue;
        // Loot that doesn't fit in the bag (or the loot filter skips) is ignored, so a full bag just keeps fighting.
        if (l.dead || l.dropped || !l.canTake(p, g.time) || !p.wantsLoot(l.kind, false) || !p.canFit(l.kind)) continue;
        // Own drops only: this player's or the party's, and those nobody owns.
        if (!othersLoot && l.owner !== null && l.owner !== p.id && !(p.partyId !== null && l.ownerParty === p.partyId)) continue;
        const d = dist(l);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      if (!best) {
        // An empty priority scan leaves the chase alone: the ordinary scan right after decides.
        if (!priority) this.chase = null;
        return null;
      }
      if (!this.chase || this.chase.id !== best.id) this.chase = { id: best.id, bestD: bd, since: g.time };
      else if (bd < this.chase.bestD - LOOT_PROGRESS) {
        this.chase.bestD = bd;
        this.chase.since = g.time;
      } else if (g.time - this.chase.since > cfg.giveUpSec) {
        this.gaveUp.add(best.id);
        this.chase = null;
        continue;
      }
      return best;
    }
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

    const cfg = currentBalance().auto;
    // Same reach as pickTarget, so one chasing from too far to fight doesn't hold up the looting.
    const attackers = g.monsters.filter((m) => AutoPlay.attacking(m, p) && dist(m) <= TARGET_REACH).length;
    if (this.outOfSupplies(p, cfg, attackers > 0, out)) return out;

    const loot = this.pickLoot(g, cfg, attackers);
    if (loot) {
      out.moveTo = { x: loot.x, z: loot.z };
      return out;
    }

    const t = this.target;
    const strayed = !!t && !t.isHostile && this.fromAnchor(t) > R + 3;
    // Switch at once when the target is a kind the player now skips, or (target mode "attacker") something
    // attacks the player while Auto goes for another monster.
    const skipped = !!t && cfg.allow.skip && set.skip.includes(t.def.id) && !AutoPlay.attacking(t, p);
    const ambushed = !!t && set.target === 'attacker' && attackers > 0 && !AutoPlay.attacking(t, p);
    if (!t || !t.alive || dist(t) > 22 || t.state === 'return' || strayed || skipped || ambushed || g.time > this.retargetAt) {
      this.target = this.pickTarget(g, cfg);
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
    this.homeProgress = null;
    this.noteLevelGap(g, target);

    const d = dist(target);
    // The basic attack's reach is tuned on /admin (owner 2026-11-20): Auto stands at the same share of it as in code.
    const range = (RANGE[p.cls.id] ?? 2) * basicReachScale(p);
    out.aim = { x: target.x, z: target.z };
    if (d > range) {
      out.moveTo = { x: target.x, z: target.z };
      if (p.cls.id === 'sword' && d > 4 && d < 7) this.tryCast(g, out, 'r');
      return out;
    }
    // In reach: stop. The walk target set above is the monster's spot and would carry ranged classes into its face.
    out.moveTo = { x: p.x, z: p.z };
    // Skills only (owner 2026-11-22): no basic attack. When a skill is ready but doesn't reach from here, step in.
    out.basic = !set.skillsOnly;
    this.castByOrder(g, out);
    if (set.skillsOnly && !out.skills.length && set.order.some((s) => this.usable(p, s) && !this.inReach(g, s))) {
      out.moveTo = { x: target.x, z: target.z };
    }
    return out;
  }

  /** Whether Auto may cast this skill now: switched on in the settings, off cooldown, enough MP, and it reaches (inReach). */
  private ready(g: AutoWorld, slot: AutoSkill): boolean {
    const p = g.player;
    return this.usable(p, slot) && g.time - this.lastSkillAt >= p.autoSettings.skillGap && this.inReach(g, slot);
  }

  /** Switched on in the settings, off cooldown and enough MP (reach and the gap between skills not counted). */
  private usable(p: Player, slot: AutoSkill): boolean {
    const sk = p.skill(slot);
    return !!sk && p.autoSettings.skills[slot] && p.skillReady(sk) && p.mp >= p.skillMp(sk) + 5;
  }

  /**
   * Auto casts a skill only when it would reach (owner 2026-11-19 for the mage's circles, every class and kind
   * 2026-11-20): before, any skill went as soon as the basic attack reached, so a short skill whiffed on a monster
   * standing at basic range. Same hit rules as the skill itself (sim/skills.ts: its tuned reach + the monster's own
   * size), less the `aoeMargin` safety distance (owner 2026-11-20: it used to be added, so a Flame Wave went with the
   * monster up to 0.5 m beyond its cone and missed):
   * - circle around the player: any monster inside it;
   * - cone / dash: the target within its range;
   * - shot: the target within its range (+ the blast at the end);
   * - landing circle: the target within its cast range + the circle.
   * Skills with no reach, and circles that do no damage (buffs, auras), cast as before. Switch `aoeGuard` off = old way.
   */
  private inReach(g: AutoWorld, slot: AutoSkill): boolean {
    const p = g.player;
    const sk = p.skill(slot);
    const cfg = currentBalance().auto;
    if (!sk || !cfg.aoeGuard) return true;
    const reach = skillReach(sk);
    if (!reach) return true;
    const margin = cfg.aoeMargin;
    if (reach.kind === 'self') {
      if (skillValues(sk).dmg <= 0) return true;
      return g.monsters.some((m) => m.alive && Math.hypot(m.x - p.x, m.z - p.z) + margin <= reach.radius + m.radius);
    }
    // A skill aimed at the target needs one.
    const t = this.target;
    if (!t || !t.alive) return false;
    const far = Math.hypot(t.x - p.x, t.z - p.z) - t.radius + margin;
    switch (reach.kind) {
      case 'cone':
      case 'dash': return far <= reach.range;
      case 'shot': return far <= reach.range + (reach.blast ?? 0);
      case 'point': return far <= reach.range + reach.radius;
    }
  }

  private tryCast(g: AutoWorld, out: Intent, slot: AutoSkill): void {
    if (!out.skills.length && this.ready(g, slot)) {
      out.skills.push(slot);
      this.lastSkillAt = g.time;
    }
  }

  /**
   * In reach of the target: cast one skill, the highest in the player's order that is switched on and ready
   * (so when the first is cooling down, or would not reach the target, the next one goes).
   * Nothing extra when the player cast one by hand this frame.
   */
  private castByOrder(g: AutoWorld, out: Intent): void {
    if (out.skills.length) {
      this.lastSkillAt = g.time;
      return;
    }
    const slot = g.player.autoSettings.order.find((s) => this.ready(g, s));
    if (slot) {
      out.skills.push(slot);
      this.lastSkillAt = g.time;
    }
  }

  /**
   * The monster to fight. Target mode "attacker": those after the player first (then other hostile ones a
   * little ahead, as before), nearest among them; "near": just the nearest. Kinds the player skips are left
   * alone unless they attack the player.
   */
  private pickTarget(g: AutoWorld, cfg: AutoConfig): Monster | null {
    const p = g.player;
    const set = p.autoSettings;
    const skip = cfg.allow.skip ? set.skip : [];
    let best: Monster | null = null;
    let bs = Infinity;
    for (const m of g.monsters) {
      if (!m.alive || m.untargetable || m.isBoss || m.state === 'return' || inBossArena(g.zone, m.x, m.z)) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d > TARGET_REACH) continue;
      const attacking = AutoPlay.attacking(m, p);
      if (!attacking && skip.includes(m.def.id)) continue;
      // Only inside the circle, except monsters already attacking the player.
      if (this.fromAnchor(m) > this.radius(p) && !(m.isHostile && d < 4.5) && !attacking) continue;
      const score = set.target === 'near' ? d : d - (attacking ? 1000 : m.isHostile ? 10 : 0);
      if (score < bs) {
        bs = score;
        best = m;
      }
    }
    return best;
  }

  /**
   * Nothing to fight (owner 2026-11-19): go back to the spot where Auto was switched on and stand still there.
   * A spot that can't be used (boss arena, lava) or that Auto can't get closer to (no progress for HOME_STUCK_SEC,
   * e.g. a wall) means waiting where it is. Once within HOME_ARRIVE it stands still, so it never jitters.
   */
  private homePoint(g: AutoWorld): { x: number; z: number } {
    const p = g.player;
    const home = this.anchor ?? { x: p.x, z: p.z };
    const here = { x: p.x, z: p.z };
    const d = Math.hypot(home.x - p.x, home.z - p.z);
    if (inBossArena(g.zone, home.x, home.z) || lavaAt(g.zone, home.x, home.z) || whirlpoolAt(g.zone, home.x, home.z, 1)) return here;
    if (d <= (this.homeArrived ? HOME_LEAVE : HOME_ARRIVE)) {
      this.homeArrived = true;
      this.homeProgress = null;
      return here;
    }
    this.homeArrived = false;
    if (!this.homeProgress || d < this.homeProgress.bestD - 0.25) this.homeProgress = { bestD: d, since: g.time };
    else if (g.time - this.homeProgress.since > HOME_STUCK_SEC) return here;
    return home;
  }

  /** Nothing to fight: walk somewhere else inside the circle, preferring spawn spots for this level. */
  private roamPoint(g: AutoWorld): { x: number; z: number } {
    if (currentBalance().auto.homeWait) return this.homePoint(g);
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
    if (inBossArena(g.zone, x, z) || lavaAt(g.zone, x, z) || whirlpoolAt(g.zone, x, z, 1)) return { x: p.x, z: p.z };
    this.roam = { x, z };
    return this.roam;
  }
}
