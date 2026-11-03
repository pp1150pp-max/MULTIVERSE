// Camp NPCs. Kept apart from Game.ts so the HUD can import these without a circular import.
import type { SpriteActor } from './SpriteActor';

export type NpcId = 'seeker' | 'merchant' | 'blacksmith';
export interface Npc { id: NpcId; name: string; action: string; x: number; z: number; actor: SpriteActor }

export const NPC_INFO: Record<NpcId, { name: string; action: string }> = {
  seeker: { name: 'The Seeker', action: 'คุย' },
  merchant: { name: 'พ่อค้า', action: 'ซื้อ/ขายของ' },
  blacksmith: { name: 'ช่างตีเหล็ก', action: 'ตีบวกอาวุธ' },
};

/** How close the player must stand to talk to an NPC. */
export const NPC_TALK_RANGE = 3;
