// The players' element chart (owner 2026-11-28, docs/systems/skills.md "ตารางธาตุ"): a 5×5 grid over the skill
// window's map, opened by its "ตารางธาตุ" button or by clicking an element badge. Each cell is the reaction of its row
// and column (the two element icons side by side); clicking one shows what it does below the grid. Every number comes
// from the live config (`currentBalance().skills.elements`), so /admin changes show by themselves. The skill window
// (src/client/skillWindow.ts) draws it and passes its clicks on.
import { currentBalance } from '../shared/balance';
import { ELEMENT_COLOR, ELEMENT_NAME, ELEMENTS, MARK_NAME, REACTION_NAME, reactionOf, type Element, type ReactionId } from '../shared/elementTuning';
import { markPhrase, reactionPhrases } from '../shared/elementChart';
import { elementIconUrl } from './elementBadge';

const icon = (e: Element, cls = 'ec-ico'): string => `<img class="${cls}" src="${elementIconUrl(e)}" alt="${ELEMENT_NAME[e]}" draggable="false">`;
const phrases = (list: string[]): string => list.map((s) => `<span>${s}</span>`).join('');

/** The chart's HTML. `sel` = the reaction picked (its details show), `hi` = an element to light up (row and column). */
export function elementChartHtml(sel: ReactionId | null, hi: Element | null): string {
  const cfg = currentBalance().skills.elements;
  const head = ELEMENTS.map((e) => `<div class="ec-h${e === hi ? ' hi' : ''}" style="--ec:${ELEMENT_COLOR[e]}">${icon(e)}<span>${ELEMENT_NAME[e]}</span></div>`).join('');
  let rows = '';
  for (const a of ELEMENTS) {
    rows += `<div class="ec-h${a === hi ? ' hi' : ''}" style="--ec:${ELEMENT_COLOR[a]}">${icon(a)}<span>${ELEMENT_NAME[a]}</span></div>`;
    for (const b of ELEMENTS) {
      const rid = reactionOf(a, b);
      const lit = hi && (a === hi || b === hi) ? ' hi' : '';
      if (!rid) {
        rows += `<div class="ec-c same${lit}" title="ธาตุเดียวกัน = ต่อเวลาป้าย"><span class="ec-pair">${icon(a)}</span><span class="ec-n">ต่อเวลาป้าย</span></div>`;
        continue;
      }
      const off = cfg.reactions[rid].on ? '' : ' off';
      rows += `<button class="ec-c${lit}${off}${rid === sel ? ' sel' : ''}" data-elrx="${rid}"><span class="ec-pair">${icon(a)}${icon(b)}</span><span class="ec-n">${REACTION_NAME[rid]}</span></button>`;
    }
  }
  let detail: string;
  if (sel) {
    const [a, b] = sel.split('+') as [Element, Element];
    detail = `<div class="ec-dhead"><span class="ec-pair">${icon(a, 'ec-big')}${icon(b, 'ec-big')}</span><span><b>${REACTION_NAME[sel]}</b><br>` +
      `<span class="ec-sub">${ELEMENT_NAME[a]} + ${ELEMENT_NAME[b]}</span></span></div>` +
      `<div class="ec-fx">${phrases(reactionPhrases(cfg.reactions[sel]))}</div>`;
  } else detail = '<div class="ec-empty">กดช่องในตารางเพื่อดูว่าปฏิกิริยานั้นทำอะไร</div>';
  const marks = ELEMENTS.map((e) => `<div class="ec-mark" style="--ec:${ELEMENT_COLOR[e]}">${icon(e)}<span><b>${MARK_NAME[e]}</b><span>${markPhrase(cfg, e)}</span></span></div>`).join('');
  return `<div class="ec-top"><b>ตารางธาตุ</b><button class="ec-close" data-elchart-close>✕ กลับไปผังสกิล</button></div>` +
    `<div class="ec-rule"><span>ตีด้วยสกิลธาตุหนึ่ง = มอนติดป้ายธาตุนั้น ${cfgSec(cfg.markSec)} วิ</span><span>ตีด้วยอีกธาตุตอนป้ายยังอยู่ = เกิดปฏิกิริยา</span></div>` +
    `<div class="ec-grid"><div class="ec-corner"></div>${head}${rows}</div>` +
    `<div class="ec-detail">${detail}</div>` +
    `<div class="ec-mtitle">ป้ายธาตุ (ผลระหว่างที่ป้ายอยู่)</div><div class="ec-marks">${marks}</div>`;
}

const cfgSec = (v: number): string => String(Math.round(v * 100) / 100);
