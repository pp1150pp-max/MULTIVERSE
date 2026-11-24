/** Small helpers shared by the HUD (hud.ts) and the windows split out of it (ui/*.ts). Must not import hud.ts. */
import { POTION_SIZES, POTION_SIZE_LABEL } from '../../shared/data/potions';
import { STONE_COLOR } from '../../shared/data/stones';
import { lootPots, type LootFilter } from '../../shared/sim/Player';
import { isPotion, isStone, RARITY_COLOR, STAT_LABEL, type BagEntry, type PotionKind, type StatLine } from '../../shared/types';
import { potionIcon } from '../icons';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const fmtNum = (v: number) => String(Math.round(v * 10) / 10);

export const POTION_COLOR: Record<PotionKind, string> = { hp: '#e8323c', mp: '#3a7bff' };

/** One row of the shared tick-box table (CSS `.chk-grid`): row title on the left, ticks in equal columns. `title` '' = no title column. */
export function chkRow(title: string, labelsHtml: string): string {
  return `<div class="chk-row${title ? '' : ' no-head'}">${title ? `<span class="chk-head">${title}</span>` : ''}<div class="chk-opts">${labelsHtml}</div></div>`;
}

/** Six checkboxes: HP small/medium/large, MP small/medium/large (two rows of the tick-box table). */
export function potToggles(): string {
  return (['hp', 'mp'] as const).map((k) =>
    chkRow(`ยา ${k.toUpperCase()}`,
      POTION_SIZES.map((sz) => `<label><input type="checkbox" data-pot="${k}" data-size="${sz}">${POTION_SIZE_LABEL[sz]}</label>`).join('')),
  ).join('');
}

export function readPots(box: HTMLElement): LootFilter['pots'] {
  const pick = (k: 'hp' | 'mp') =>
    POTION_SIZES.filter((sz) => box.querySelector<HTMLInputElement>(`[data-pot="${k}"][data-size="${sz}"]`)?.checked);
  return { hp: pick('hp'), mp: pick('mp') };
}

export function syncPots(box: HTMLElement, f: LootFilter): void {
  const pots = lootPots(f);
  for (const cb of box.querySelectorAll<HTMLInputElement>('[data-pot]')) {
    cb.checked = pots[cb.dataset.pot as 'hp' | 'mp'].includes(cb.dataset.size as 's' | 'm' | 'l');
  }
}

/** HP and MP potions carried, with their icons (bag and merchant windows). */
export function potionTotals(p: { potionCount(kind: PotionKind): number }): string {
  return `${potionIcon('hp')} ${p.potionCount('hp')} &nbsp; ${potionIcon('mp')} ${p.potionCount('mp')}`;
}

/** One line as the blacksmith shows it: value, stat, tier and the tier's range. */
export function lineHtml(l: StatLine): string {
  return `+${fmtNum(l.value)} ${STAT_LABEL[l.stat]} <span class="tier t${l.tier}">T${l.tier}: ${fmtNum(l.min)}–${fmtNum(l.max)}</span>`;
}

export function entryColor(e: BagEntry): string {
  return isPotion(e) ? POTION_COLOR[e.potion] : isStone(e) ? STONE_COLOR[e.stone] : RARITY_COLOR[e.rarity];
}
