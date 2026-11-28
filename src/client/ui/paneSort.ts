// The bag's sort controls inside the grown NPC talk windows (owner 2026-11-28): same choice (key, direction) and same
// action (`sortBag`) as the bag window; the choice lives in the bag window's own controls (#sort-key, #sort-dir), so it
// is shared everywhere. Shown only while currentBalance().npcTalk.paneSort is on. Browser only.
import type { Game } from '../Game';
import type { SortKey } from '../../shared/sim/Player';
import { currentBalance } from '../../shared/balance';
import { $ } from './hudShared';

export interface PaneSort {
  root: HTMLElement;
  /** Shows/hides by the /admin switch and shows the shared choice. Call each frame (cheap). */
  refresh(): void;
}

/** `onSorted` runs after the request (the shop clears its basket: slots moved). */
export function makePaneSort(g: Game, onSorted: () => void): PaneSort {
  const root = document.createElement('div');
  root.className = 'ns-sort';
  root.title = 'เรียงของในกระเป๋า';
  const sel = document.createElement('select');
  sel.innerHTML = $<HTMLSelectElement>('sort-key').innerHTML;
  const dir = document.createElement('button');
  dir.className = 'ns-tab';
  const go = document.createElement('button');
  go.className = 'ns-tab on';
  go.textContent = 'เรียง';
  root.append(sel, dir, go);

  sel.onchange = () => {
    const main = $<HTMLSelectElement>('sort-key');
    main.value = sel.value;
    main.dispatchEvent(new Event('change'));
  };
  dir.onclick = () => { $('sort-dir').click(); refresh(); };
  go.onclick = () => {
    g.backend.sortBag($<HTMLSelectElement>('sort-key').value as SortKey, $('sort-dir').dataset.desc === '1');
    g.hud.hideTip();
    g.hud.markInventory();
    onSorted();
  };

  function refresh(): void {
    const on = currentBalance().npcTalk.paneSort;
    root.classList.toggle('hidden', !on);
    if (!on) return;
    const key = $<HTMLSelectElement>('sort-key').value;
    if (sel.value !== key) sel.value = key;
    const t = $('sort-dir').textContent ?? '';
    if (dir.textContent !== t) dir.textContent = t;
  }
  refresh();
  return { root, refresh };
}
