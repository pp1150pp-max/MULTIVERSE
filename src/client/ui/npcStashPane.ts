// The warehouse keeper inside the NPC talk window (owner 2026-11-27, same layout as the merchant's shop and the
// blacksmith): the stash window (stash.ts, moved in as it is: gold in/out, sort, rows to buy, drag inside it) on the
// left, the bag on the right. A click on a bag item stores it, a click on a stash item takes it back (on touch the
// stash keeps its detail sheet). Switch: currentBalance().npcTalk.stashPane (off = the old window). Browser only.
import type { Game } from '../Game';
import { entryName } from '../../shared/data/potions';
import { isBound } from '../../shared/types';
import { isTouchMode } from '../touch/device';
import { NpcHostPane, type HostPaneSpec } from './npcHostPane';

export function npcStashPane(g: Game, say: (text: string) => void): NpcHostPane {
  const spec: HostPaneSpec = {
    kind: 'stash',
    hostId: 'stash',
    title: 'คลังเก็บของ (ใช้ร่วมทั้งบัญชี)',
    bagTitle: 'กระเป๋าของฉัน',
    views: [['gear', 'กระเป๋า'], ['use', 'ประเภทใช้งาน']],
    hint: (touch) => `${touch ? 'แตะ' : 'คลิก'}ของในกระเป๋า = ฝากเข้าคลัง · ${touch ? 'แตะของในคลังเพื่อดู/ย้าย' : 'คลิกของในคลัง = ย้ายเข้ากระเป๋า'}`,
    designW: 560,
    cell: (e) => (isBound(e) ? { usable: false, tip: 'ของผูกตัว ฝากคลังไม่ได้' } : { usable: true, tip: 'คลิก: ฝากเข้าคลัง' }),
    click(e, _view, i) {
      if (isBound(e)) return pane.line('bound');
      g.backend.stashPut(i, -1);
      g.hud.markInventory();
      pane.line('put', entryName(e));
    },
    sig: () => {
      const st = g.player.stash;
      return `${st.size}:${st.gold}:${st.items.map((e) => (e ? entryName(e) : '')).join(',')}`;
    },
  };
  const pane = new NpcHostPane(g, say, spec);
  // A left click on a stash item takes it back (the HUD's own grid handlers keep right click, drag and touch).
  document.getElementById('stash-grid')!.addEventListener('click', (e) => {
    if (!pane.root.contains(e.currentTarget as Node) || isTouchMode()) return;
    if ((e.target as HTMLElement).closest('[data-buyrow]')) return;
    const i = Number((e.target as HTMLElement).closest<HTMLElement>('[data-s]')?.dataset.s ?? -1);
    const it = i >= 0 ? g.player.stash.items[i] : null;
    if (!it) return;
    g.hud.hideTip();
    g.backend.stashTake(i, -1);
    g.hud.markInventory();
    pane.dirty();
    pane.line('take', entryName(it));
  });
  return pane;
}
