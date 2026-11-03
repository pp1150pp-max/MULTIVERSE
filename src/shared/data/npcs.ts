// Camp NPCs. Shared so the server can check that a player is standing next to the merchant
// or blacksmith before it lets them trade.
export type NpcId = 'seeker' | 'merchant' | 'blacksmith';

export const NPC_IDS: NpcId[] = ['seeker', 'merchant', 'blacksmith'];

export const NPC_INFO: Record<NpcId, { name: string; action: string }> = {
  seeker: { name: 'The Seeker', action: 'คุย' },
  merchant: { name: 'พ่อค้า', action: 'ซื้อ/ขายของ' },
  blacksmith: { name: 'ช่างตีเหล็ก', action: 'ตีบวกอาวุธ' },
};

/** How close the player must stand to talk to an NPC. */
export const NPC_TALK_RANGE = 3;
/** Shop windows close (and trades are refused) past this distance. */
export const NPC_USE_RANGE = NPC_TALK_RANGE + 2;
