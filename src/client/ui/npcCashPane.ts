// The crystal merchant inside the NPC talk window (owner 2026-11-28): the cash shop window (cashShop.ts, moved in as
// it is) takes the whole width under the medallion and the speech bubble; nothing is picked from the bag. Opened from
// the NPC and from the top icon alike (anywhere: then the window stays open away from the NPC too).
// Switch: currentBalance().npcTalk.cashPane (off = the old window). Browser only.
import type { Game } from '../Game';
import { NpcHostPane, type HostPaneSpec } from './npcHostPane';
import { cashCatalogNow } from '../cashData';

export function npcCashPane(g: Game, say: (text: string) => void): NpcHostPane {
  const spec: HostPaneSpec = {
    kind: 'cash',
    hostId: 'cash-win',
    title: 'แคชช็อป',
    bagTitle: '',
    views: [],
    hint: () => '',
    designW: 800,
    // The new layout (/admin แคชช็อป "หน้าต่างแบบใหม่"): the shop fills the panel and only its item list scrolls.
    fill: () => !cashCatalogNow().oldLayout,
    cell: () => ({ usable: false, tip: '' }),
    click: () => undefined,
    sig: () => '',
  };
  return new NpcHostPane(g, say, spec);
}
