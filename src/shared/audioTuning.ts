// Sound effect levels per group (owner 2026-11-22, docs/systems/audio.md): the server-wide switch and loudness of
// each group of sounds, tuned on /admin → ปรับสมดุล → "เสียงเอฟเฟกต์" and saved inside the balance tuning
// (`BalanceTuning.audio`), only what differs from the code. Each player also has their own slider per group
// (src/client/audio/engine.ts); the two multiply.

export const SFX_GROUPS = ['skill', 'boss', 'monster', 'player', 'ui'] as const;
export type SfxGroup = (typeof SFX_GROUPS)[number];

export const SFX_GROUP_NAME: Record<SfxGroup, string> = {
  skill: 'สกิลผู้เล่น',
  boss: 'บอส',
  monster: 'มอน',
  player: 'ตัวละครและไอเทม',
  ui: 'หน้าต่างและปุ่ม',
};

export interface AudioGroup {
  on: boolean;
  /** Loudness multiplier (1 = as made). */
  gain: number;
}

export interface AudioConfig {
  groups: Record<SfxGroup, AudioGroup>;
}

export interface AudioTuning {
  groups?: Partial<Record<SfxGroup, Partial<AudioGroup>>>;
}

export const AUDIO_GAIN_RANGE = [0, 2] as const;

export function codeAudio(): AudioConfig {
  const groups = {} as Record<SfxGroup, AudioGroup>;
  for (const g of SFX_GROUPS) groups[g] = { on: true, gain: 1 };
  return { groups };
}
const CODE = codeAudio();

export function mergeAudio(t: AudioTuning | undefined): AudioConfig {
  const c = codeAudio();
  for (const g of SFX_GROUPS) Object.assign(c.groups[g], t?.groups?.[g]);
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Checks the `audio` part of a balance tuning (see checkBalance): strict = errors, else wrong entries are dropped. */
export function checkAudioTuning(x: unknown, strict: boolean): { tuning: AudioTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าเสียงเอฟเฟกต์ไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'groups');
    if (extra) return { error: `เสียงเอฟเฟกต์: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: AudioTuning = {};
  if (x.groups !== undefined) {
    if (!isObj(x.groups)) {
      if (strict) return { error: 'เสียงเอฟเฟกต์: ค่าหมวดไม่ถูกต้อง' };
    } else {
      for (const [id, v] of Object.entries(x.groups)) {
        if (!(SFX_GROUPS as readonly string[]).includes(id) || !isObj(v)) {
          if (strict) return { error: `เสียงเอฟเฟกต์: ไม่รู้จักหมวด "${id.slice(0, 20)}"` };
          continue;
        }
        const g = id as SfxGroup;
        const name = SFX_GROUP_NAME[g];
        if (strict) {
          const extra = Object.keys(v).find((k) => k !== 'on' && k !== 'gain');
          if (extra) return { error: `เสียง${name}: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
        }
        const o: Partial<AudioGroup> = {};
        if (v.on !== undefined) {
          if (typeof v.on !== 'boolean') {
            if (strict) return { error: `เสียง${name}: เปิด/ปิดไม่ถูกต้อง` };
          } else if (v.on !== CODE.groups[g].on) o.on = v.on;
        }
        if (v.gain !== undefined) {
          const [lo, hi] = AUDIO_GAIN_RANGE;
          const n = v.gain;
          if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) {
            if (strict) return { error: `เสียง${name}: ความดังต้องอยู่ระหว่าง ×${lo}–×${hi}` };
          } else if (round2(n) !== CODE.groups[g].gain) o.gain = round2(n);
        }
        if (Object.keys(o).length) (out.groups ??= {})[g] = o;
      }
    }
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function audioChanges(a: AudioConfig, b: AudioConfig): string[] {
  const out: string[] = [];
  for (const g of SFX_GROUPS) {
    const x = a.groups[g];
    const y = b.groups[g];
    if (x.on !== y.on) out.push(`เสียง${SFX_GROUP_NAME[g]} ${x.on ? 'เปิด' : 'ปิด'} → ${y.on ? 'เปิด' : 'ปิด'}`);
    if (x.gain !== y.gain) out.push(`ความดังเสียง${SFX_GROUP_NAME[g]} ×${x.gain} → ×${y.gain}`);
  }
  return out;
}
