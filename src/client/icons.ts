// Painted icons for the HUD, as HTML to drop into markup. Files live in assets/sprites/icons/.
import { itemArt, starterArt } from '../shared/data/items';
import type { ClassId, EquipSlot, Item, PotionKind, StoneKind } from '../shared/types';
import { drawIcon } from './placeholder';

export const iconImg = (name: string): string =>
  `<img class="gi" src="assets/sprites/icons/${name}.png" alt="" draggable="false">`;

export const skillIcon = (skillId: string): string => iconImg(`skill_${skillId}`);
export const potionIcon = (kind: PotionKind): string => iconImg(`potion_${kind}`);
export const COIN_ICON = iconImg('coin');

const stoneFallback: Partial<Record<StoneKind, string>> = {};
/** Blacksmith stone icon. No painted file yet: falls back to the placeholder gem until icons/stone_*.png exists. */
export const stoneIcon = (kind: StoneKind): string => {
  const alt = (stoneFallback[kind] ??= drawIcon(`stone_${kind}`).toDataURL());
  // A quest key wears its boss key's picture, with a mark that it is bound.
  const file = kind.replace(/^qkey_/, 'key_');
  if (file !== kind) return `<span class="gi-bound">${stoneIcon(file as StoneKind)}</span>`;
  return `<img class="gi" src="assets/sprites/icons/stone_${file}.png" alt="" draggable="false" onerror="this.onerror=null;this.src='${alt}'">`;
};
export const FORGE_ICON = iconImg('npc_forge');

let itemFallback: string | undefined;
/** Item icon. Falls back to the placeholder bag while a new item has no painted file yet. */
export const itemIcon = (item: Item): string => {
  itemFallback ??= drawIcon('bag').toDataURL();
  return iconImg(itemArt(item)).replace('>', ` onerror="this.onerror=null;this.src='${itemFallback}'">`);
};

/** The first item of a slot stands in for an empty equipment slot. */
export const emptySlotIcon = (slot: EquipSlot, cls: ClassId): string => iconImg(starterArt(slot, cls));
