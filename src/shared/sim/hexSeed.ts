// Hex Seed (mage line 2, owner 2026-11-20, docs/systems/skills-mage.md): a seed on one monster stores the damage its
// caster deals that monster. The host dies first: the seed bursts around it (stored + the skill's own damage) and jumps
// to every living monster near it with part of what it stored. Time runs out first: it bursts on the host alone.
// Seeds live in the Sim (a channel or room change leaves them in the old world) and are resolved once per step, so a
// chain of deaths goes one step at a time: no recursion and no runaway.
import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import type { SkillDef } from '../data/classes';

export const HEX_SEED_ID = 'mg_hexseed';

/** One seed on one monster. Its numbers are the cast's (rank, /admin) and pass to the seeds it jumps to. */
export interface HexSeed {
  by: Player;
  m: Monster;
  /** HP the caster has taken off the host since the seed went in (plus what it carried in). */
  stored: number;
  until: number;
  sk: SkillDef;
  /** The skill's own damage (× ATK) added to every burst, as cast (rank and passive). */
  base: number;
  life: number;
  burst: number;
  jump: number;
  /** Share (0–1) of the stored damage each jumped seed starts with. */
  carry: number;
  maxSeeds: number;
  /** One burst never hits harder than this × the caster's ATK. */
  cap: number;
  /** Share (0–1) of the stored damage a burst uses when the host or the target is a boss. */
  bossShare: number;
}

export type HexSeedCast = Omit<HexSeed, 'by' | 'm' | 'stored' | 'until'>;

const seedsOf = (sim: Sim, p: Player): number => sim.hexSeeds.reduce((n, s) => n + (s.by === p ? 1 : 0), 0);
const hasSeed = (sim: Sim, p: Player, m: Monster): boolean => sim.hexSeeds.some((s) => s.by === p && s.m === m);

/** Puts a seed in `m` unless it already carries one of `p`'s or `p` has the most seeds out. */
function plant(sim: Sim, p: Player, m: Monster, stored: number, c: HexSeedCast): boolean {
  if (!m.alive || m.untargetable || hasSeed(sim, p, m) || seedsOf(sim, p) >= c.maxSeeds) return false;
  const until = sim.time + c.life;
  sim.hexSeeds.push({ ...c, by: p, m, stored, until });
  // The monster's magic circle shows the seed while it is in (Monster.hasStatus reads dotUntil).
  m.dotUntil = Math.max(m.dotUntil, until);
  m.debuffSkill = HEX_SEED_ID;
  sim.fx('effect', 'mg_curse', m.x, m.z, 0, 1);
  return true;
}

/** The cast: a seed in the monster nearest the mouse within `radius` that has none of the caster's yet. */
export function castHexSeed(sim: Sim, p: Player, x: number, z: number, radius: number, c: HexSeedCast): boolean {
  if (seedsOf(sim, p) >= c.maxSeeds) return false;
  let best: Monster | null = null;
  let bd = Infinity;
  for (const m of sim.monsters) {
    if (!m.alive || m.untargetable || hasSeed(sim, p, m)) continue;
    const d = Math.hypot(m.x - x, m.z - z) - m.radius;
    if (d <= radius && d < bd) {
      bd = d;
      best = m;
    }
  }
  return !!best && plant(sim, p, best, 0, c);
}

/** Sim.hitMonster: the caster's own damage on a host goes into its seed (never the seed's own bursts). */
export function noteHexHit(sim: Sim, p: Player, m: Monster, dealt: number, skill: string | null | undefined): void {
  if (skill === HEX_SEED_ID || dealt <= 0) return;
  for (const s of sim.hexSeeds) if (s.by === p && s.m === m) s.stored += dealt;
}

/** The burst on one monster: stored (a boss's share when host or target is a boss) + the skill's damage, capped. */
function hit(sim: Sim, s: HexSeed, t: Monster, hostBoss: boolean): void {
  const atk = s.by.stats.atk;
  const stored = atk > 0 ? (s.stored * (hostBoss || t.isBoss ? s.bossShare : 1)) / atk : 0;
  const mult = Math.min(s.cap, stored + s.base);
  sim.hitMonster(s.by, t, mult, { maxMult: s.cap, skill: s.sk });
}

/** Once per Sim step: drop the seeds whose caster or host is gone, burst the ones whose host died or time ran out. */
export function tickHexSeeds(sim: Sim): void {
  if (!sim.hexSeeds.length) return;
  const due: { s: HexSeed; died: boolean }[] = [];
  sim.hexSeeds = sim.hexSeeds.filter((s) => {
    const p = s.by;
    // The caster died or left this world, or the host left the field (despawned, a boss that jumped away): no burst.
    if (!p.alive || !sim.players.includes(p) || s.m.gone || !sim.monsters.includes(s.m)) return false;
    if (!s.m.alive) {
      due.push({ s, died: true });
      return false;
    }
    if (sim.time >= s.until) {
      due.push({ s, died: false });
      return false;
    }
    return true;
  });
  for (const { s, died } of due) sim.asCaster(s.by, () => burst(sim, s, died), HEX_SEED_ID);
}

function burst(sim: Sim, s: HexSeed, died: boolean): void {
  const host = s.m;
  const hostBoss = host.isBoss;
  if (!died) {
    // Time ran out with the host alive: it alone takes the burst, and nothing jumps.
    sim.fx('effect', 'explosion', host.x, host.z, 0, 1.4);
    hit(sim, s, host, hostBoss);
    return;
  }
  sim.fx('effect', 'explosion', host.x, host.z, 0, s.burst);
  for (const t of [...sim.monsters]) {
    if (t.alive && Math.hypot(t.x - host.x, t.z - host.z) <= s.burst + t.radius) hit(sim, s, t, hostBoss);
  }
  // Seeds jump to the living monsters near the host (the burst may have just killed some: they get none), each with
  // `carry` of what this one stored, while the caster has fewer than `maxSeeds` out.
  const carried = s.stored * s.carry;
  // (plant overwrites the caster, host, store and timer it copies from `s`.)
  for (const t of sim.monsters) {
    if (t === host || !t.alive || Math.hypot(t.x - host.x, t.z - host.z) > s.jump + t.radius) continue;
    if (seedsOf(sim, s.by) >= s.maxSeeds) break;
    plant(sim, s.by, t, carried, s);
  }
}

/** A player leaving the world takes their seeds with them (Sim.removePlayer). */
export function dropHexSeeds(sim: Sim, p: Player): void {
  if (sim.hexSeeds.length) sim.hexSeeds = sim.hexSeeds.filter((s) => s.by !== p);
}
