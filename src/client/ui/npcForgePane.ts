// The blacksmith inside the NPC talk window (owner 2026-11-27, same layout as the merchant's shop): the blacksmith's
// own window (forge.ts, moved in as it is: all its menus, the hammer, Auto, the odds) on the left, and the gear on the
// right with a "สวมอยู่" tab, since worn gear can be worked on too. A click on gear (or a card, in the fusion menu)
// puts it in the forge's slot. Switch: currentBalance().npcTalk.forgePane (off = the old window). Browser only.
import type { Game } from '../Game';
import { isItem, isStone } from '../../shared/types';
import { isCardId } from '../../shared/data/cards';
import { NpcHostPane, type BagView, type HostPaneSpec } from './npcHostPane';

export function npcForgePane(g: Game, say: (text: string) => void): NpcHostPane {
  const forge = () => g.hud.forgeWin;
  /** The forge menu last seen: switching to fusion shows the cards' tab, leaving it goes back to the gear. */
  let lastMode = '';
  const spec: HostPaneSpec = {
    kind: 'forge',
    hostId: 'forge',
    title: 'ช่างตีเหล็ก',
    bagTitle: 'อุปกรณ์ของฉัน',
    views: [['worn', 'สวมอยู่'], ['gear', 'กระเป๋า'], ['use', 'ประเภทใช้งาน']],
    hint: (touch) => `${touch ? 'แตะ' : 'คลิก'}อุปกรณ์ = วางบนแท่นช่างตีเหล็ก · เมนูรวมการ์ด: ${touch ? 'แตะ' : 'คลิก'}การ์ดในแท็บประเภทใช้งาน`,
    designW: 740,
    cell(e) {
      const fusing = forge().fusing;
      const usable = isItem(e) ? !fusing : isStone(e) && isCardId(e.stone) && fusing;
      return {
        usable,
        on: isItem(e) && e.uid === forge().selected,
        tip: usable ? (fusing ? 'คลิก: ใส่ช่องรวมการ์ด' : 'คลิก: วางบนแท่นช่างตีเหล็ก') : fusing ? 'เมนูรวมการ์ดรับเฉพาะการ์ด' : 'ช่างตีเหล็กรับเฉพาะอุปกรณ์สวมใส่',
      };
    },
    click: (e) => forge().forgePlace(e),
    sig: () => `${forge().mode}:${forge().selected}`,
    pickView(view: BagView): BagView {
      const mode = forge().mode;
      if (mode === lastMode) return view;
      const was = lastMode;
      lastMode = mode;
      if (mode === 'fuse') return 'use';
      return was === 'fuse' && view === 'use' ? 'gear' : view;
    },
    onOpen(mode) {
      document.querySelector<HTMLElement>(`#forge-menu [data-mode="${mode}"]`)?.click();
      lastMode = mode;
      return mode === 'fuse' ? 'use' : 'gear';
    },
  };
  return new NpcHostPane(g, say, spec);
}
