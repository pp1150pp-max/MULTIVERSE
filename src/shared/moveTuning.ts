// Numbers of floor 2's new monster and boss moves (plan 5, owner 2026-11-20), tunable in /admin (Balance tab, card
// "ท่ามอนชั้น 2"). One flat table: each map's PR adds its group. Saved like the rest of the balance: only what differs
// from the code, every change in admin_audit. Read through currentBalance().moves (see mv in sim/beachMoves.ts).

export interface MoveParam {
  /** `<group>.<name>`, the key saved in BalanceTuning.moves. */
  key: string;
  label: string;
  code: number;
  min: number;
  max: number;
  step: number;
  /** Shown after the number in /admin (วิ, ×ATK, %, …). */
  unit?: string;
}
export interface MoveGroup { id: string; title: string; params: MoveParam[] }

const p = (key: string, label: string, code: number, min: number, max: number, step: number, unit?: string): MoveParam =>
  ({ key, label, code, min, max, step, unit });

/** Every group, in /admin order. Shipwreck Beach (map 1): owner's numbers of 2026-11-20; Smugglers' Cove (map 2) after it. */
export const MOVE_GROUPS: MoveGroup[] = [
  {
    id: 'shell', title: 'ปูเสฉวน: หดกระดอง', params: [
      p('shell.hide', 'หดอยู่นาน', 1.5, 0.2, 10, 0.1, 'วิ'),
      p('shell.cut', 'ลดดาเมจที่รับตอนหด', 0.7, 0, 1, 0.05, '×'),
      p('shell.cd', 'คูลดาวน์', 8, 1, 60, 0.5, 'วิ'),
      p('shell.counter', 'ตีสวนตอนออก', 1.5, 0, 10, 0.1, '×ATK'),
    ],
  },
  {
    id: 'steal', title: 'นกนางนวล: ขโมยทอง', params: [
      p('steal.share', 'ขโมยส่วนของทองที่มี', 0.01, 0, 0.5, 0.005, '×'),
      p('steal.max', 'ขโมยได้สูงสุดต่อครั้ง', 500, 0, 1000000, 10, 'G'),
      p('steal.flee', 'บินหนี (ตีตกในเวลานี้ = ได้ทองคืน)', 8, 1, 60, 0.5, 'วิ'),
      p('steal.fleeSpeed', 'ความเร็วตอนบินหนี', 1.5, 0.5, 5, 0.1, '×'),
    ],
  },
  {
    id: 'chain', title: 'ปลาไหลไฟฟ้า: ไฟฟ้าโซ่', params: [
      p('chain.cd', 'คูลดาวน์', 6, 1, 60, 0.5, 'วิ'),
      p('chain.warn', 'เตือนก่อนช็อต', 0.8, 0.1, 5, 0.1, 'วิ'),
      p('chain.range', 'ระยะช็อตคนแรก', 7, 1, 20, 0.5),
      p('chain.jumps', 'กระโดดต่ออีก (คน)', 2, 0, 10, 1, 'คน'),
      p('chain.jumpRange', 'ระยะกระโดดต่อ', 4, 1, 15, 0.5),
      p('chain.mult', 'ดาเมจคนแรก', 1, 0, 10, 0.1, '×ATK'),
      p('chain.falloff', 'ดาเมจลดต่อทอด', 0.7, 0, 1, 0.05, '×'),
    ],
  },
  {
    id: 'thorns', title: 'เต่าหลังหนาม: สะท้อนดาเมจ', params: [
      p('thorns.range', 'ระยะที่โดนสะท้อน', 2.5, 0.5, 10, 0.1),
      p('thorns.share', 'สะท้อนส่วนของดาเมจที่ทำ', 0.2, 0, 2, 0.05, '×'),
    ],
  },
  {
    id: 'crab', title: 'ปูยักษ์กระดองปืนใหญ่ (บอส)', params: [
      p('crab.hpMult', 'ตัวคูณ HP บอส', 1, 0.1, 10, 0.05, '×'),
      p('crab.atkMult', 'ตัวคูณ ATK บอส', 1, 0.1, 10, 0.05, '×'),
      p('crab.cannonCd', 'ปืนใหญ่: คูลดาวน์', 6, 1, 60, 0.5, 'วิ'),
      p('crab.cannonShells', 'ปืนใหญ่: จำนวนลูก', 3, 1, 20, 1, 'ลูก'),
      p('crab.cannonRadius', 'ปืนใหญ่: รัศมีวง', 2.2, 0.5, 8, 0.1),
      p('crab.cannonWarn', 'ปืนใหญ่: เตือนก่อนตก', 1.2, 0.2, 5, 0.1, 'วิ'),
      p('crab.cannonMult', 'ปืนใหญ่: ดาเมจ', 1.5, 0, 20, 0.1, '×ATK'),
      p('crab.clawCd', 'ก้ามหนีบ: คูลดาวน์', 10, 1, 60, 0.5, 'วิ'),
      p('crab.clawRange', 'ก้ามหนีบ: ระยะ', 3, 0.5, 10, 0.1),
      p('crab.clawWindup', 'ก้ามหนีบ: ง้าง', 0.7, 0.1, 5, 0.1, 'วิ'),
      p('crab.clawHold', 'ก้ามหนีบ: จับไว้', 0.8, 0, 5, 0.1, 'วิ'),
      p('crab.clawFling', 'ก้ามหนีบ: เหวี่ยงไกล', 10, 0, 30, 0.5, 'หน่วย'),
      p('crab.clawMult', 'ก้ามหนีบ: ดาเมจ', 1.2, 0, 20, 0.1, '×ATK'),
      p('crab.clawStun', 'ก้ามหนีบ: มึนตอนตก', 0.5, 0, 5, 0.1, 'วิ'),
      p('crab.sideCd', 'เดินข้าง: คูลดาวน์', 7, 1, 60, 0.5, 'วิ'),
      p('crab.sideDist', 'เดินข้าง: ระยะ', 5, 1, 15, 0.5, 'หน่วย'),
      p('crab.lowHp', 'เลือดน้อยเมื่อต่ำกว่า', 0.3, 0, 1, 0.05, '×HP'),
      p('crab.shellSec', 'เลือดน้อย: หดกระดองนาน', 4, 0.5, 20, 0.5, 'วิ'),
      p('crab.shellCut', 'เลือดน้อย: ลดดาเมจที่รับ', 0.8, 0, 1, 0.05, '×'),
      p('crab.barrageShells', 'ระดมยิง: ลูกทั่วลาน', 12, 0, 60, 1, 'ลูก'),
      p('crab.barrageEvery', 'ระดมยิง: ซ้ำทุก', 20, 3, 120, 1, 'วิ'),
    ],
  },
  // Smugglers' Cove (map 2): owner's numbers of 2026-11-24 (plan 5.2, sim/coveMoves.ts and sim/peglegCaptain.ts).
  {
    id: 'chainball', title: 'นักโทษในเรือ: ลูกตุ้มเหล็ก', params: [
      p('chainball.slow', 'ความเร็วตอนล่ามโซ่', 0.65, 0.1, 2, 0.05, '×'),
      p('chainball.at', 'หลุดโซ่เมื่อ HP เหลือ', 0.8, 0.05, 1, 0.05, '×HP'),
      p('chainball.mult', 'ลูกตุ้มที่โยน: ดาเมจ', 1.6, 0, 20, 0.1, '×ATK'),
      p('chainball.free', 'ความเร็วหลังหลุดโซ่', 2.2, 0.5, 5, 0.1, '×'),
    ],
  },
  {
    id: 'combo', title: 'โจรสลัดดาบโค้ง: คอมโบ 3 ฟัน', params: [
      p('combo.gap', 'เว้นระหว่างฟัน', 0.3, 0.1, 2, 0.05, 'วิ'),
      p('combo.mult1', 'ฟันที่ 1', 1, 0, 10, 0.1, '×ATK'),
      p('combo.mult2', 'ฟันที่ 2', 1, 0, 10, 0.1, '×ATK'),
      p('combo.mult3', 'ฟันที่ 3 (พุ่ง)', 1.5, 0, 10, 0.1, '×ATK'),
      p('combo.lunge', 'ฟันที่ 3: ระยะพุ่ง', 2.5, 0, 8, 0.5, 'หน่วย'),
    ],
  },
  {
    id: 'spread', title: 'มือปืนลูกซอง: ยิงกระจาย', params: [
      p('spread.pellets', 'จำนวนลูกต่อนัด', 5, 1, 15, 1, 'ลูก'),
      p('spread.angle', 'มุมกระจาย', 50, 0, 180, 5, '°'),
      p('spread.mult', 'ดาเมจต่อลูก', 0.5, 0, 10, 0.05, '×ATK'),
      p('spread.range', 'ระยะ', 8, 2, 20, 0.5),
    ],
  },
  {
    id: 'keg', title: 'นักโทษถังดินปืน: ระเบิดตอนตาย', params: [
      p('keg.run', 'วิ่งได้นานสุด', 6, 0.5, 30, 0.5, 'วิ'),
      p('keg.speed', 'ความเร็วตอนวิ่ง', 1.6, 0.5, 5, 0.1, '×'),
      p('keg.near', 'จุดชนวนเมื่อเข้าใกล้', 1.5, 0.5, 6, 0.1),
      p('keg.warn', 'เตือนก่อนระเบิด', 0.5, 0.1, 5, 0.1, 'วิ'),
      p('keg.radius', 'รัศมีระเบิด', 2.5, 0.5, 8, 0.1),
      p('keg.mult', 'ดาเมจระเบิด', 2.5, 0, 20, 0.1, '×ATK'),
    ],
  },
  {
    id: 'captain', title: 'กัปตันขาไม้ (บอส)', params: [
      p('captain.hpMult', 'ตัวคูณ HP บอส', 1, 0.1, 10, 0.05, '×'),
      p('captain.atkMult', 'ตัวคูณ ATK บอส', 1, 0.1, 10, 0.05, '×'),
      p('captain.anchorCd', 'ทอดสมอ: คูลดาวน์', 9, 1, 60, 0.5, 'วิ'),
      p('captain.anchorRange', 'ทอดสมอ: ระยะ', 10, 2, 20, 0.5),
      p('captain.anchorWindup', 'ทอดสมอ: ง้าง', 0.8, 0.1, 5, 0.1, 'วิ'),
      p('captain.anchorMult', 'ทอดสมอ: ดาเมจ', 1.4, 0, 20, 0.1, '×ATK'),
      p('captain.anchorPull', 'ทอดสมอ: ดึงมาหยุดห่างบอส', 2.5, 0, 10, 0.5, 'หน่วย'),
      p('captain.parrotCd', 'นกแก้วชี้เป้า: คูลดาวน์', 12, 2, 60, 0.5, 'วิ'),
      p('captain.parrotPerch', 'นกแก้วชี้เป้า: เกาะเป้านาน', 5, 1, 30, 0.5, 'วิ'),
      p('captain.parrotShots', 'นกแก้วชี้เป้า: เรือยิง (นัด)', 3, 1, 20, 1, 'นัด'),
      p('captain.parrotRadius', 'นกแก้วชี้เป้า: รัศมีวง', 2.2, 0.5, 8, 0.1),
      p('captain.parrotWarn', 'นกแก้วชี้เป้า: เตือนก่อนตก', 1.2, 0.2, 5, 0.1, 'วิ'),
      p('captain.parrotMult', 'นกแก้วชี้เป้า: ดาเมจ', 1.6, 0, 20, 0.1, '×ATK'),
      p('captain.parrotHp', 'นกแก้ว: HP (×จำนวนกุญแจ)', 15000, 1, 10000000, 100),
      p('captain.parrotDown', 'นกแก้ว: ตีตกแล้วหายไป', 8, 1, 60, 0.5, 'วิ'),
      p('captain.shoutCd', 'ตะโกนสั่ง: คูลดาวน์', 18, 2, 120, 1, 'วิ'),
      p('captain.shoutSpeed', 'ตะโกนสั่ง: เร็วขึ้น', 0.4, 0, 3, 0.05, '×'),
      p('captain.shoutSec', 'ตะโกนสั่ง: นาน', 6, 0.5, 30, 0.5, 'วิ'),
      p('captain.shoutRange', 'ตะโกนสั่ง: รัศมีลูกน้อง', 12, 1, 40, 1),
    ],
  },
];

export const MOVE_PARAMS: Record<string, MoveParam> = Object.fromEntries(MOVE_GROUPS.flatMap((g) => g.params.map((q) => [q.key, q])));

/** Every move number in use, by key. */
export type MoveConfig = Record<string, number>;
/** What is saved: only the numbers that differ from the code. */
export type MoveTuning = Record<string, number>;

export function codeMoves(): MoveConfig {
  return Object.fromEntries(Object.values(MOVE_PARAMS).map((q) => [q.key, q.code]));
}

export function mergeMoves(t: MoveTuning | undefined): MoveConfig {
  const c = codeMoves();
  for (const [k, v] of Object.entries(t ?? {})) if (k in c) c[k] = v;
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Checks the `moves` part of a balance tuning: strict = errors for anything wrong, else wrong numbers are dropped.
 * Numbers equal to the code are left out. Returns the clean tuning (undefined = nothing differs) or a Thai error.
 */
export function checkMoveTuning(x: unknown, strict: boolean): { tuning: MoveTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าท่ามอนชั้น 2 ไม่ถูกต้อง' } : { tuning: undefined };
  const out: MoveTuning = {};
  for (const [k, v] of Object.entries(x)) {
    const q = MOVE_PARAMS[k];
    if (!q) {
      if (strict) return { error: `ท่ามอนชั้น 2: ไม่รู้จัก "${k.slice(0, 30)}"` };
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v) || v < q.min || v > q.max || (q.step >= 1 && !Number.isInteger(v))) {
      if (strict) return { error: `${q.label} ต้องเป็นตัวเลข ${q.min}–${q.max}` };
      continue;
    }
    if (v !== q.code) out[k] = v;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function moveChanges(a: MoveConfig, b: MoveConfig): string[] {
  const out: string[] = [];
  for (const g of MOVE_GROUPS) {
    for (const q of g.params) {
      if (a[q.key] !== b[q.key]) out.push(`${g.title} ${q.label} ${a[q.key]} → ${b[q.key]}`);
    }
  }
  return out;
}
