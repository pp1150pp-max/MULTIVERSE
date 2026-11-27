// Pets pick up loot (owner 2026-11-27, docs/systems/pet-loot.md). A player wearing a pet cosmetic that may collect
// (BalanceConfig.petLoot, /admin) gets one drop fetched every `interval` seconds:
// - Auto on: anything Auto itself may take (autoMayTake: the Auto circle around its anchor, the 10 s priority, the loot
//   filter, the "others' loot" option, the player's Auto looting switch, a full bag = skipped), nearest to the player first;
// - Auto off: drops whose loot owner is this player (the monsters it got the loot of), within `handRadius` of the player,
//   following the loot filter and the bag; party drops of other members are not taken.
// The Sim decides it; the browser only draws the drop flying to the player (fx 'petLoot').
import type { Sim } from './Sim';
import type { Player } from './Player';
import { LOOT_POP_TIME, type Loot } from './Loot';
import { autoMayTake, autoRadius } from './autoplay';
import { currentBalance } from '../balance';
import { petCollects } from '../petLootTuning';

/** A drop must have landed (and sat a moment, as for walking over it) before a pet takes it. */
const PET_MIN_AGE = LOOT_POP_TIME + 0.15;

/** The drop the pet of `p` would take now, or null. */
export function petLootPick(sim: Sim, p: Player): Loot | null {
  const cfg = currentBalance();
  const pc = cfg.petLoot;
  if (!p.alive || !petCollects(pc, p.cosmetics.pet)) return null;
  let check: ((l: Loot) => boolean) | null = null;
  if (p.autoOn) {
    if (!pc.auto || !p.autoSettings.loot) return null;
    const anchor = p.autoAnchor ?? p;
    const R = autoRadius(p);
    const others = p.autoSettings.othersLoot && cfg.auto.allow.othersLoot;
    check = (l) => autoMayTake(p, l, sim.time, sim.zone, anchor, R, others);
  } else {
    if (!pc.hand) return null;
    const R = pc.handRadius;
    check = (l) => l.owner === p.id && !l.dead && !l.dropped && Math.hypot(l.x - p.x, l.z - p.z) <= R
      && l.canTake(p, sim.time) && p.wantsLoot(l.kind, false) && p.canFit(l.kind);
  }
  let best: Loot | null = null;
  let bd = Infinity;
  for (const l of sim.loots) {
    if (l.t < PET_MIN_AGE || !check(l)) continue;
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

/** Called once per Sim step, before the drops update: every player's pet fetches at most one drop per interval. */
export function tickPetLoot(sim: Sim, dt: number): void {
  const pc = currentBalance().petLoot;
  for (const p of sim.players) {
    if (p.petLootCd > 0) p.petLootCd -= dt;
    if (!pc.on || p.petLootCd > 0) continue;
    const l = petLootPick(sim, p);
    if (!l) continue;
    const { x, z } = l;
    // pickup() fails only when the bag has no room after all: skip silently (no "bag full" text from the pet).
    if (!sim.pickup(p, l)) continue;
    l.dead = true;
    p.petLootCd = pc.interval;
    sim.fx('petLoot', x, z, p.id, l.kind.type);
  }
}
