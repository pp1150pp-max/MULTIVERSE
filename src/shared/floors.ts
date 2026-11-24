// Floors of the world and the way between them (docs/plans/FLOOR2_PLAN.md 4.2, 4.3).
// Pure rules shared by the Sim (portals) and the server (where a login lands).
import { currentBalance, type Balance } from './balance';
import { floorOf, hubOf, ZONE_HUB, zoneById, type ZoneDef } from './data/zones';

/** The unlock (Player.unlocks) that opens the way up to this floor: set by The Seeker's quest. */
export function floorUnlock(floor: number): string {
  return `floor${floor}`;
}

/** A saved unlock list, cleaned: strings only, no repeats. Missing or broken = none. */
export function cleanUnlocks(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];
}

/**
 * Why a portal that needs `requires` stays shut for this player, or null when it lets them through.
 * Two /admin switches (owner 2026-11-19): floorGateOpen off = shut to everyone; floorGateQuest off = no
 * unlock needed (the portal's minLevel still holds, checked by the caller).
 */
export function portalLock(
  unlocks: readonly string[],
  requires: string | undefined,
  b: Pick<Balance, 'floorGateOpen' | 'floorGateQuest'> = currentBalance(),
): 'closed' | 'quest' | null {
  if (!requires) return null;
  if (!b.floorGateOpen) return 'closed';
  if (b.floorGateQuest && !unlocks.includes(requires)) return 'quest';
  return null;
}

/**
 * Where a fresh login lands (owner 2026-11-19, plan 12.3): the town of the floor the character logged
 * out on, or floor 1's when the way up to that floor is shut for them now.
 */
export function loginHub(
  data: { zone?: string; unlocks?: unknown },
  b: Pick<Balance, 'floorGateOpen' | 'floorGateQuest'> = currentBalance(),
): ZoneDef {
  const hub = hubOf(zoneById(data.zone));
  const floor = floorOf(hub);
  if (floor > 1 && portalLock(cleanUnlocks(data.unlocks), floorUnlock(floor), b)) return ZONE_HUB;
  return hub;
}
