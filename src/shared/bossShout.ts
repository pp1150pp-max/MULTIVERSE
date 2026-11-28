// What a boss shouts over its head as it makes a move (owner 2026-11-28: words instead of the red-orange sound-wave
// picture). One switch and one line per move, set in /admin (Balance tab, card "บอสตะโกน"); an empty line = silent for
// that move. Saved like the rest of the balance: only what differs from the code.

export const SHOUT_MOVES = [
  { id: 'captain.shout', label: 'กัปตันขาไม้: ตะโกนสั่ง (เร่งความเร็ว)', code: 'เร็วเข้า ไอ้พวกทึ่ม!' },
  { id: 'captain.parrot', label: 'กัปตันขาไม้: นกแก้วชี้เป้า เรือปืนเริ่มยิง', code: 'ยิง!' },
  { id: 'captain.crew', label: 'กัปตันขาไม้: เรียกลูกเรือตอนคลั่ง', code: 'ลูกเรือ บุก!' },
  { id: 'captain.anchor', label: 'กัปตันขาไม้: ง้างขว้างสมอ', code: 'มานี่!' },
] as const;
export type ShoutId = (typeof SHOUT_MOVES)[number]['id'];
/** The longest line /admin takes. */
export const SHOUT_LEN = 60;

export interface BossShoutConfig { on: boolean; text: Record<ShoutId, string> }
export interface BossShoutTuning { on?: boolean; text?: Partial<Record<ShoutId, string>> }

export function codeBossShout(): BossShoutConfig {
  return { on: true, text: Object.fromEntries(SHOUT_MOVES.map((m) => [m.id, m.code])) as Record<ShoutId, string> };
}

export function mergeBossShout(t: BossShoutTuning | undefined): BossShoutConfig {
  const c = codeBossShout();
  if (t?.on !== undefined) c.on = t.on;
  Object.assign(c.text, t?.text);
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function checkBossShoutTuning(x: unknown, strict: boolean): { tuning: BossShoutTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  const fail = (msg: string): { error: string } => ({ error: `บอสตะโกน: ${msg}` });
  if (!isObj(x)) return strict ? fail('ค่าไม่ถูกต้อง') : { tuning: undefined };
  const out: BossShoutTuning = {};
  if (typeof x.on === 'boolean') {
    if (!x.on) out.on = false;
  } else if (x.on !== undefined && strict) return fail('สวิตช์ไม่ถูกต้อง');
  if (x.text !== undefined) {
    if (!isObj(x.text)) return strict ? fail('ข้อความไม่ถูกต้อง') : { tuning: out.on === false ? out : undefined };
    const text: Partial<Record<ShoutId, string>> = {};
    for (const [id, raw] of Object.entries(x.text)) {
      const move = SHOUT_MOVES.find((m) => m.id === id);
      const line = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : null;
      if (!move || line === null || line.length > SHOUT_LEN) {
        if (!strict) continue;
        return fail(!move ? `ไม่รู้จักท่า "${id.slice(0, 20)}"` : `${move.label} ต้องเป็นข้อความไม่เกิน ${SHOUT_LEN} ตัวอักษร`);
      }
      if (line !== move.code) text[move.id] = line;
    }
    if (Object.keys(text).length) out.text = text;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function bossShoutChanges(a: BossShoutConfig, b: BossShoutConfig): string[] {
  const out: string[] = [];
  if (a.on !== b.on) out.push(`บอสตะโกน ${a.on ? 'เปิด' : 'ปิด'} → ${b.on ? 'เปิด' : 'ปิด'}`);
  for (const m of SHOUT_MOVES) if (a.text[m.id] !== b.text[m.id]) out.push(`ข้อความ ${m.label}: "${a.text[m.id]}" → "${b.text[m.id]}"`);
  return out;
}
