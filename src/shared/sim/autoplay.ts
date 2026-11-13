import type { Intent } from './types';
import type { Monster } from './Monster';
import { AUTO_PX_PER_UNIT, type AutoSkill, type Player } from './Player';
import type { Loot } from './Loot';
import { MONSTERS } from '../data/monsters';
import { inBossArena, inSafeArea, lavaAt, type ZoneDef } from '../data/zones';
import { currentBalance } from '../balance';
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
/** A drop counts as "got closer" (resetting the give-up timer) only when Auto is this much nearer than before. */
const LOOT_PROGRESS = 0.25;
/** Thai reasons for the "out of supplies" options. */
const OUT_WHY = { noHp: 'ยา HP หมด', noMp: 'ยา MP หมด', bagFull: 'กระเป๋าเต็ม' } as const;
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
  }

  /** A monster after this player right now (not one walking back home). */
  private static attacking(m: Monster, p: Player): boolean {
    return m.alive && !m.isBoss && m.isHostile && m.state !== 'return' && m.target?.id === p.id;
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
    // Fight first: nothing is picked up while anything attacks.
    if (order === 'fight' && attackers > 0) {
      this.chase = null;
      return null;
    }
    const othersLoot = set.othersLoot && cfg.allow.othersLoot;
    const dist = (a: { x: number; z: number }) => Math.hypot(a.x - p.x, a.z - p.z);
    let maxD = Infinity;
    // Balanced (the old way): drops close by even mid-fight; anything in the circle once nothing is near.
    if (order === 'balanced' && g.monsters.some((m) => m.isHostile && dist(m) < cfg.threatDist)) maxD = cfg.nearDist;
    const R = this.radius(p);
    if (this.gaveUp.size > 50) {
      const live = new Set(g.loots.map((l) => l.id));
      for (const id of this.gaveUp) if (!live.has(id)) this.gaveUp.delete(id);
    }
    for (;;) {
      let best: Loot | null = null;
      let bd = maxD;
      for (const l of g.loots) {
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
        this.chase = null;
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
    const attackers = g.monsters.filter((m) => AutoPlay.attacking(m, p)).length;
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
    this.noteLevelGap(g, target);

    const d = dist(target);
    const range = RANGE[p.cls.id] ?? 2;
    out.aim = { x: target.x, z: target.z };
    if (d > range) {
      out.moveTo = { x: target.x, z: target.z };
      if (p.cls.id === 'sword' && d > 4 && d < 7) this.tryCast(g, out, 'r');
      return out;
    }
    // In reach: stop. The walk target set above is the monster's spot and would carry ranged classes into its face.
    out.moveTo = { x: p.x, z: p.z };
    out.basic = true;
    this.castByOrder(p, out);
    return out;
  }

  /** Whether Auto may cast this skill now: switched on in the settings, off cooldown, and enough MP. */
  private ready(p: Player, slot: AutoSkill): boolean {
    const sk = p.skill(slot);
    return !!sk && p.autoSettings.skills[slot] && (p.cd[slot] ?? 0) <= 0 && p.mp >= p.skillMp(sk) + 5;
  }

  private tryCast(g: AutoWorld, out: Intent, slot: AutoSkill): void {
    if (this.ready(g.player, slot) && !out.skills.includes(slot)) out.skills.push(slot);
  }

  /**
   * In reach of the target: cast one skill, the highest in the player's order that is switched on and ready
   * (so when the first is cooling down, the next one goes). Nothing extra when the player cast one by hand this frame.
   */
  private castByOrder(p: Player, out: Intent): void {
    if (out.skills.length) return;
    const slot = p.autoSettings.order.find((s) => this.ready(p, s));
    if (slot) out.skills.push(slot);
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
      if (!m.alive || m.isBoss || m.state === 'return' || inBossArena(g.zone, m.x, m.z)) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d > 24) continue;
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
