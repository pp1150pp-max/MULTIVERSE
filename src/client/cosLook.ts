// What a character looks like wearing its cosmetics, including the shop's try-on: the cosmetics window
// puts pieces on your own character for a look (only you see it, the server never hears of it) and takes
// them off when it closes.
import type { Player } from '../shared/sim/Player';
import { cosById, type CosmeticDef, type CosSlot, type CosWorn } from '../shared/data/cosmetics';
import { inSafeArea, type ZoneDef } from '../shared/data/zones';
import { currentBalance } from '../shared/balance';

let tryOn: CosWorn | null = null;
/** Your own character (set by the game each frame it draws). */
let me: Player | null = null;

export function setLookOwner(p: Player | null): void {
  me = p;
}

/** Puts pieces on your own character for a look (null = back to what you really wear). */
export function setTryOn(worn: CosWorn | null): void {
  tryOn = worn && Object.keys(worn).length ? { ...worn } : null;
}

/** Shown when a try-on is refused or taken off outside a town. */
export const TRY_ON_TOWN_MSG = 'ลองสวมได้เฉพาะในเมือง';

/** Why trying on isn't allowed where `p` stands (owner 2026-11-25: town / safe area only, Balance.tryOnTownOnly), or null. */
export function tryOnBlocked(zone: ZoneDef, p: { x: number; z: number }): string | null {
  return currentBalance().tryOnTownOnly && !inSafeArea(zone, p.x, p.z) ? TRY_ON_TOWN_MSG : null;
}

export function tryingOn(): CosWorn | null {
  return tryOn;
}

/** The cosmetic a character shows in a slot (yours with the try-on on top), or undefined. */
export function shownCos(p: Player, slot: CosSlot): CosmeticDef | undefined {
  if (p === me && tryOn && slot in tryOn) return cosById(tryOn[slot]);
  return cosById(p.cosmetics[slot]);
}

/** Shown sitting on the mount: really riding, or trying a mount on in the shop. */
export function shownRiding(p: Player): boolean {
  if (p === me && tryOn?.mount) return true;
  return p.mounted && !!shownCos(p, 'mount');
}
