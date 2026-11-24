// Camp NPCs. Shared so the server can check that a player is standing next to the merchant
// or blacksmith before it lets them trade.
export type NpcId = 'seeker' | 'merchant' | 'blacksmith' | 'keeper' | 'broker' | 'stylist' | 'crystal' | 'navigator';

/**
 * The NPCs standing in town. Owner 2026-11-16: the stylist is out of town for now and the crystal merchant
 * (cash shop) stands in its spot; its id, info and art stay, so putting 'stylist' back here (and its position
 * in src/shared/sim/terrain.ts) returns it.
 */
export const NPC_IDS: NpcId[] = ['seeker', 'merchant', 'blacksmith', 'keeper', 'broker', 'crystal', 'navigator'];

/** icon + role are the badge floating over each NPC's head, so players can tell them apart. */
export const NPC_INFO: Record<NpcId, { name: string; action: string; icon: string; role: string }> = {
  seeker: { name: 'The Seeker', action: 'คุย', icon: 'npc_talk', role: 'คุย / เนื้อเรื่อง' },
  merchant: { name: 'พ่อค้า', action: 'ซื้อ/ขายของ', icon: 'npc_shop', role: 'ร้านค้า' },
  blacksmith: { name: 'ช่างตีเหล็ก', action: 'ตีบวกอุปกรณ์', icon: 'npc_forge', role: 'ตีบวก' },
  keeper: { name: 'ผู้ดูแลคลัง', action: 'เปิดคลังเก็บของ', icon: 'npc_stash', role: 'คลังเก็บของ' },
  broker: { name: 'นายหน้าตลาด', action: 'เปิดตลาดฝากขาย', icon: 'npc_market', role: 'ตลาดฝากขาย' },
  // Cosmetics shop (src/client/cosmetics.ts). Borrows the merchant's badge icon until its own is painted.
  stylist: { name: 'ช่างแต่งตัว', action: 'เปิดร้านแต่งตัว', icon: 'npc_shop', role: 'ร้านแต่งตัว' },
  // Cash shop (src/client/cashShop.ts, owner 2026-11-15). Stands in the stylist's spot; the stylist is out of town for now.
  crystal: { name: 'พ่อค้าคริสตัล', action: 'เปิดแคชช็อป', icon: 'npc_cash', role: 'แคชช็อป' },
  // Floor 2's guide (owner 2026-11-19): in nexus_city, seen only by whoever has beaten the Volcano Heart; gives the
  // quest that opens the way up and takes them to the harbour (src/shared/floors.ts). In the harbour the same man is
  // its quest giver, standing in The Seeker's role (HARBOR_NPC).
  navigator: { name: 'นักเดินเรือแห่งมิติ', action: 'คุย', icon: 'npc_talk', role: 'ทางขึ้นชั้น 2' },
};

/** What an NPC looks like and is called: its NPC_INFO, the sprite sheet (client SHEET_SPECS key) and a portrait. */
export interface NpcLook { name: string; action: string; icon: string; role: string; sheet: string; portrait?: string }

/**
 * The harbour's six (plan 3, owner 2026-11-19: the draft names): the same jobs and the same systems as floor 1's
 * (one stash per account, one market for the whole server), only their own names and pictures. Icons stay floor 1's.
 * Portraits: sprites/paper/ui/npc/<name>.png (tools/cut_papercraft.cjs floor2_hub).
 */
const HARBOR_NPC: Partial<Record<NpcId, Pick<NpcLook, 'name' | 'sheet' | 'portrait'> & { role?: string }>> = {
  merchant: { name: 'แม่ค้าเสบียงเรือ', sheet: 'hb_supply_merchant', portrait: 'supply_merchant' },
  keeper: { name: 'ผู้ดูแลโกดังท่าเรือ', sheet: 'hb_dock_keeper', portrait: 'dock_keeper' },
  blacksmith: { name: 'ช่างเหล็กอู่ต่อเรือ', sheet: 'hb_shipwright', portrait: 'shipwright' },
  broker: { name: 'นายหน้าท่าเรือ', sheet: 'hb_harbor_broker', portrait: 'harbor_broker' },
  seeker: { name: 'นักเดินเรือแห่งมิติ', sheet: 'navigator', portrait: 'navigator', role: 'คุย / เควส' },
  crystal: { name: 'พ่อค้าของเถื่อน', sheet: 'hb_smuggler_npc', portrait: 'smuggler' },
};

/** An NPC as it stands in this town (`town` = ZoneDef.town). */
export function npcLook(id: NpcId, town?: 'harbor'): NpcLook {
  const base: NpcLook = { ...NPC_INFO[id], sheet: id, portrait: id === 'navigator' ? 'navigator' : undefined };
  const over = town === 'harbor' ? HARBOR_NPC[id] : undefined;
  return over ? { ...base, ...over } : base;
}

/** How close the player must stand to talk to an NPC. */
export const NPC_TALK_RANGE = 3;
/** Shop windows close (and trades are refused) past this distance. */
export const NPC_USE_RANGE = NPC_TALK_RANGE + 2;
