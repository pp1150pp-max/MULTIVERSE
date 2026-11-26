// Class passives (owner 2026-11-27, docs/systems/skills.md "พาสซีฟประจำอาชีพ"): one per class, always on once the
// character reaches its level, in a slot of its own at the centre of the skill map. Not a learnable skill: no points,
// no ranks, not in ClassDef.skills, and the three worn passives are untouched.
//   gunslinger — ยิงแล้ววิ่ง (Hit and Run): the basic attack never holds the player still (attackRootTuning.ts)
//   mage       — ก้าวมิติ (Warp): the dash vanishes and appears at its end at once, 2 charges (Player.warpDash)
//   sword      — still being designed: a locked slot
// Numbers are tuned on /admin → ระบบสกิล → "พาสซีฟประจำอาชีพ" (classPassiveTuning.ts). No imports of the balance here (no cycle).
import type { ClassId } from './types';
import type { ClassPassiveConfig } from './classPassiveTuning';

export type ClassPassiveId = 'cp_hitrun' | 'cp_warp';

export interface ClassPassiveDef {
  id: ClassPassiveId;
  nameTh: string;
  name: string;
  desc: string;
}

/** Each class's passive (null = still being designed, shown locked). */
export const CLASS_PASSIVES: Readonly<Record<ClassId, ClassPassiveDef | null>> = {
  gunslinger: {
    id: 'cp_hitrun', nameTh: 'ยิงแล้ววิ่ง', name: 'Hit and Run',
    desc: 'เดินและวิ่งได้ขณะตีธรรมดา ไม่หยุดกับที่ตอนยิง (สกิลยังหยุดตามปกติ)',
  },
  mage: {
    id: 'cp_warp', nameTh: 'ก้าวมิติ', name: 'Warp',
    desc: 'กดแดชแล้วหายตัวไปโผล่ปลายทางทันทีแทนการพุ่ง ระยะเท่าแดช ทะลุกำแพงไม่ได้ เก็บได้หลายครั้ง คืนทีละครั้งตามคูลดาวน์แดช',
  },
  sword: null,
};

/** Shown for a class whose passive is still being designed. */
export const CLASS_PASSIVE_TBD = { nameTh: 'พาสซีฟประจำอาชีพ', desc: 'ยังอยู่ระหว่างออกแบบ' } as const;

/** Which passive of the config belongs to a class (none for the sword yet). */
export const passiveKey = (cls: ClassId): 'hitrun' | 'warp' | null => (cls === 'gunslinger' ? 'hitrun' : cls === 'mage' ? 'warp' : null);

/** Whether a character of class `cls` at `level` has its class passive working now. */
export function classPassiveOn(cfg: ClassPassiveConfig, cls: ClassId, level: number, which: 'hitrun' | 'warp'): boolean {
  if (passiveKey(cls) !== which) return false;
  const o = cfg[which];
  return o.on && level >= o.level;
}

