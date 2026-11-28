// The players' element chart (owner 2026-11-28, docs/systems/skills.md "ตารางธาตุ"): short Thai phrases for each
// mark and each reaction, built from the live config (`currentBalance().skills.elements`), so a change on /admin shows
// in the chart by itself. Each phrase is one text the English dictionary can match (src/shared/i18n/en/skills.ts).
// The window itself is src/client/elementChart.ts.
import type { Element, ElementConfig, ReactionCfg } from './elementTuning';

/** A number as players read it: at most 2 decimals, no trailing zeros. */
const n = (v: number): string => String(Math.round(v * 100) / 100);

/** What a reaction does, as short phrases in reading order (damage first, then control, then who it hits). */
export function reactionPhrases(rc: ReactionCfg): string[] {
  if (!rc.on) return ['ปิดอยู่ชั่วคราว'];
  const out: string[] = [];
  if (rc.dmg > 0) out.push(`ดาเมจ ${n(rc.dmg)}% ATK`);
  if (rc.dot > 0 && rc.dotSec > 0) out.push(`ดาเมจต่อเนื่อง ${n(rc.dot)}% ATK/วิ นาน ${n(rc.dotSec)} วิ`);
  if (rc.stun > 0) out.push(`สตัน ${n(rc.stun)} วิ`);
  if (rc.slow > 0 && rc.slowSec > 0) out.push(`ช้าลง ${n(rc.slow)}% นาน ${n(rc.slowSec)} วิ`);
  if (rc.kb > 0) out.push(`ผลักออก ${n(rc.kb)} ม.`);
  if (!out.length) return ['ไม่มีผล'];
  out.push(rc.r > 0 ? `โดนทุกตัวในรัศมี ${n(rc.r)} ม.` : 'โดนตัวเดียว');
  if (!rc.boss) out.push('ไม่ใช้กับบอส');
  else if (rc.stun > 0) out.push('บอสโดนสตันแค่ 30%');
  return out;
}

/** What a mark does while it stays on a monster. */
export function markPhrase(cfg: ElementConfig, e: Element): string {
  const v = cfg.mark[e];
  if (!(v > 0)) return 'ไม่มีผลเพิ่ม';
  switch (e) {
    case 'water': return `ช้าลง ${n(v)}%`;
    case 'fire':
    case 'poison': return `ดาเมจต่อเนื่อง ${n(v)}% ATK/วิ`;
    case 'lightning': return `รับดาเมจเพิ่ม ${n(v)}%`;
    case 'wind': return `ผลักออก ${n(v)} ม.`;
  }
}
