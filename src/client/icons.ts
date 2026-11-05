// Painted icons for the HUD, as HTML to drop into markup. Files live in assets/sprites/icons/.
import { itemArt, starterArt } from '../shared/data/items';
import type { ClassId, Item, PotionKind, SlotId } from '../shared/types';

export const iconImg = (name: string): string =>
  `<img class="gi" src="assets/sprites/icons/${name}.png" alt="" draggable="false">`;

export const skillIcon = (skillId: string): string => iconImg(`skill_${skillId}`);
export const potionIcon = (kind: PotionKind): string => iconImg(`potion_${kind}`);
export const COIN_ICON = iconImg('coin');
export const FORGE_ICON = iconImg('npc_forge');

export const itemIcon = (item: Item): string => iconImg(itemArt(item));

/** The first item of a slot stands in for an empty equipment slot. */
export const emptySlotIcon = (slot: SlotId, cls: ClassId): string => iconImg(starterArt(slot, cls));
