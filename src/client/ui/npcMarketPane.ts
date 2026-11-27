// The market broker inside the NPC talk window (owner 2026-11-27, same layout as the blacksmith and the stash): the
// market window (market.ts, moved in as it is: buy with its filters, list, the box) on the left, the bag on the
// right. A click on a bag item picks it for listing (the old right click). Switch: currentBalance().npcTalk.marketPane
// (off = the old window). Browser only.
import type { Game } from '../Game';
import { marketSellable } from '../../shared/sim/market';
import { NpcHostPane, type HostPaneSpec } from './npcHostPane';

export function npcMarketPane(g: Game, say: (text: string) => void): NpcHostPane {
  const market = () => g.hud.marketWin;
  const spec: HostPaneSpec = {
    kind: 'market',
    hostId: 'market',
    title: 'ตลาดฝากขาย',
    bagTitle: 'กระเป๋าของฉัน',
    views: [['gear', 'กระเป๋า'], ['use', 'ประเภทใช้งาน']],
    hint: (touch) => `${touch ? 'แตะ' : 'คลิก'}ของในกระเป๋า = เลือกมาลงขาย · ยาและของผูกตัวลงขายไม่ได้`,
    designW: 660,
    cell: (e, _view, i) => (marketSellable(e)
      ? { usable: true, on: i === market().picked, tip: 'คลิก: เลือกมาลงขาย' }
      : { usable: false, tip: 'ลงขายในตลาดไม่ได้' }),
    click: (_e, _view, i) => market().bagRightClick(i),
    sig: () => `${market().picked}:${g.backend.marketBox}`,
  };
  return new NpcHostPane(g, say, spec);
}
