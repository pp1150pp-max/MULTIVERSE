// Camp NPCs. Shared so the server can check that a player is standing next to the merchant
// or blacksmith before it lets them trade.
export type NpcId = 'seeker' | 'merchant' | 'blacksmith' | 'keeper' | 'broker' | 'stylist' | 'crystal';

/**
 * The NPCs standing in town. Owner 2026-11-16: the stylist is out of town for now and the crystal merchant
 * (cash shop) stands in its spot; its id, info and art stay, so putting 'stylist' back here (and its position
 * in src/shared/sim/terrain.ts) returns it.
 */
export const NPC_IDS: NpcId[] = ['seeker', 'merchant', 'blacksmith', 'keeper', 'broker', 'crystal'];

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
};

/** How close the player must stand to talk to an NPC. */
export const NPC_TALK_RANGE = 3;
/** Shop windows close (and trades are refused) past this distance. */
export const NPC_USE_RANGE = NPC_TALK_RANGE + 2;
