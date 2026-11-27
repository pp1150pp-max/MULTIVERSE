// The element of a skill as a small badge for tooltips and the skill window (owner 2026-11-27, src/shared/elementTuning.ts).
import { currentBalance } from '../shared/balance';
import { ELEMENT_COLOR, ELEMENT_ICON, ELEMENT_NAME, skillElement } from '../shared/elementTuning';

export function elementBadge(skillId: string): string {
  const cfg = currentBalance().skills.elements;
  if (!cfg.on) return '';
  const e = skillElement(cfg, skillId);
  if (e === 'none') return '';
  return `<span class="el-badge" style="color:${ELEMENT_COLOR[e]}">${ELEMENT_ICON[e]} ธาตุ${ELEMENT_NAME[e]}</span>`;
}
