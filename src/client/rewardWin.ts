// F: the "ได้รับรางวัลแล้ว!" window (owner 2026-11-26, docs/systems/world-and-ui.md "หน้าต่างคุย NPC"): pops up when a
// quest is handed in, with the rewards as icons. Any click closes it. Also the reward icon row used by the quest card (D).
import type { MailAttach } from '../shared/mail';
import { describeAttach } from '../shared/mail';
import { isStoneKind } from '../shared/types';
import { COIN_ICON, potionIcon, stoneIcon } from './icons';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** A row of reward icons (gold, then each line) with the count in the corner and the full name as the tooltip. */
export function rewardIcons(a: MailAttach): HTMLElement {
  const row = el('div', 'qc-rewards');
  const names = describeAttach(a);
  let n = 0;
  const cell = (html: string, count: string): void => {
    const c = el('div', 'qc-reward');
    c.innerHTML = html; // our own icon markup only (icons.ts), never admin text
    c.append(el('span', 'qc-n', count));
    c.title = names[n++] ?? '';
    row.append(c);
  };
  if (a.gold) cell(COIN_ICON, a.gold.toLocaleString());
  for (const x of a.items) {
    const icon = x.kind === 'potion' ? potionIcon(x.potion, x.size)
      : x.kind === 'stone' && isStoneKind(x.stone) ? stoneIcon(x.stone)
      : '<span class="qc-gold">⚔</span>';
    cell(icon, `×${x.count}`);
  }
  return row;
}

export class RewardWin {
  private readonly win: HTMLElement;

  constructor() {
    this.win = el('div', 'panel hidden');
    this.win.id = 'reward-win';
    this.win.onclick = () => this.close();
    document.getElementById('hud')!.append(this.win);
  }

  show(title: string, sub: string, a: MailAttach): void {
    this.win.replaceChildren(
      el('div', 'rw-title', title),
      el('div', 'rw-sub', sub),
      rewardIcons(a),
      el('div', 'rw-hint', 'คลิกที่ใดก็ได้เพื่อปิดหน้าต่าง'),
    );
    this.win.classList.remove('hidden');
  }

  close(): void {
    this.win.classList.add('hidden');
  }
}
