// Element pictures in the browser (owner 2026-11-27, src/shared/elementTuning.ts): the papercraft icons cut by
// tools/cut_element_icons.cjs from art_templates/ui/raw/element_icons.png, for the skill tooltips and the mark over a
// monster's HP bar (src/client/debuffFx.ts).
import { currentBalance } from '../shared/balance';
import { ELEMENT_COLOR, ELEMENT_NAME, skillElement, type Element } from '../shared/elementTuning';
import { imgUrl } from './img';

export const elementIconUrl = (e: Element): string => imgUrl(`assets/sprites/ui/element_${e}.png`);

/** A skill's element as a small badge (icon + name) for its tooltip and the skill window; empty when none or switched off. */
export function elementBadge(skillId: string): string {
  const cfg = currentBalance().skills.elements;
  if (!cfg.on) return '';
  const e = skillElement(cfg, skillId);
  if (e === 'none') return '';
  return `<span class="el-badge" style="color:${ELEMENT_COLOR[e]}"><img src="${elementIconUrl(e)}" alt="" draggable="false">ธาตุ${ELEMENT_NAME[e]}</span>`;
}
