// Painted icons for the HUD, as HTML to drop into markup. Files live in assets/sprites/icons/.
import { itemArt, starterArt } from '../shared/data/items';
import type { ClassId, EquipSlot, Item, PotionKind, PotionSize, StoneKind } from '../shared/types';
import { CLASSES, CLASS_IDS } from '../shared/data/classes';
import { drawIcon } from './placeholder';
import { CRIT_BURST, GLYPH_SHEET } from './floating';
import { imgUrl } from './img';

export const iconImg = (name: string): string =>
  `<img class="gi" src="${imgUrl(`assets/sprites/icons/${name}.png`)}" alt="" draggable="false">`;

export const skillIcon = (skillId: string): string => iconImg(`skill_${skillId}`);
/** Potion icon: with a size, that bottle shape (small vial, medium flask, large ornate flask). */
export const potionIcon = (kind: PotionKind, size?: PotionSize): string => iconImg(size ? `potion_${kind}_${size}` : `potion_${kind}`);
export const COIN_ICON = iconImg('coin');

const missingStone = new Set<string>();
(window as unknown as { __stoneMissing: (k: string) => void }).__stoneMissing = (k) => void missingStone.add(k);
const stoneFallback: Partial<Record<StoneKind, string>> = {};
/** Blacksmith stone icon. No painted file yet: falls back to the placeholder gem until icons/stone_*.png exists. */
export const stoneIcon = (kind: StoneKind): string => {
  const alt = (stoneFallback[kind] ??= drawIcon(`stone_${kind}`).toDataURL());
  // A quest key wears its boss key's picture, with a mark that it is bound.
  const file = kind.replace(/^qkey_/, 'key_');
  if (file !== kind) return `<span class="gi-bound">${stoneIcon(file as StoneKind)}</span>`;
  // A file known to be missing goes straight to the placeholder: retrying the 404 on every bag redraw made the icon blink.
  if (missingStone.has(file)) return `<img class="gi" src="${alt}" alt="" draggable="false">`;
  return `<img class="gi" src="${imgUrl(`assets/sprites/icons/stone_${file}.png`)}" alt="" draggable="false" onerror="this.onerror=null;this.src='${alt}';window.__stoneMissing('${file}')">`;
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

/** Every /assets/ picture the stylesheets use (HUD bars, orbs, frames…), read from the loaded CSS. */
function cssImageUrls(): string[] {
  const urls = new Set<string>();
  for (const sheet of document.styleSheets) {
    try {
      // A rule's cssText includes any rules nested in it (@media), so the top level covers them all.
      for (const r of sheet.cssRules) for (const m of r.cssText.matchAll(/url\(["']?(\/assets\/[^"')]+)["']?\)/g)) urls.add(m[1]);
    } catch {
      // A stylesheet from another origin (fonts) can't be read; it holds no game pictures.
    }
  }
  return [...urls];
}

/**
 * Downloads the HUD's pictures (CSS art, skill/potion/coin icons, damage digits) before the world
 * shows, so nothing pops in blank on the first entry. Failures count as done: the HUD has fallbacks.
 */
export function preloadHudImages(onProgress: (fraction: number) => void): Promise<void> {
  const icons = ['coin', 'npc_forge', 'potion_hp', 'potion_mp', ...(['hp', 'mp'] as const).flatMap((k) => (['s', 'm', 'l'] as const).map((s) => `potion_${k}_${s}`)), ...CLASS_IDS.flatMap((c) => CLASSES[c].skills.map((s) => `skill_${s.id}`))];
  const urls = [...cssImageUrls(), ...icons.map((n) => imgUrl(`assets/sprites/icons/${n}.png`)), GLYPH_SHEET, CRIT_BURST];
  let done = 0;
  onProgress(0);
  return Promise.all(urls.map((url) => new Promise<void>((ok) => {
    const img = new Image();
    img.onload = img.onerror = () => {
      onProgress(++done / urls.length);
      ok();
    };
    img.src = url;
  }))).then(() => undefined);
}
