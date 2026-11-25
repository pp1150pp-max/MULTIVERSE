// Sound effect levels per group (owner 2026-11-22, docs/systems/audio.md): the server-wide switch and loudness of
// each group of sounds, tuned on /admin → ปรับสมดุล → "เสียงเอฟเฟกต์" and saved inside the balance tuning
// (`BalanceTuning.audio`), only what differs from the code. Each player also has their own slider per group
// (src/client/audio/engine.ts); the two multiply.

export const SFX_GROUPS = ['skill', 'boss', 'monster', 'player', 'ui', 'ambient'] as const;
export type SfxGroup = (typeof SFX_GROUPS)[number];

export const SFX_GROUP_NAME: Record<SfxGroup, string> = {
  skill: 'สกิลผู้เล่น',
  boss: 'บอส',
  monster: 'มอน',
  player: 'ตัวละครและไอเทม',
  ui: 'หน้าต่างและการแจ้งเตือน',
  ambient: 'บรรยากาศแมพ',
};

export interface AudioGroup {
  on: boolean;
  /** Loudness multiplier (1 = as made). */
  gain: number;
}

// Boss room music from files (owner 2026-11-25): a looping track instead of the chiptune while you are in
// the room, /admin → ปรับสมดุล → "เพลงห้องบอส". The files are public/assets/music/<song>.mp3; a missing file
// leaves the room on the chiptune. Prompts and conversion: art_templates/music/BOSS_GOTHIC.md.

export const BOSS_SONGS = ['boss_gothic_f1', 'boss_gothic_f2'] as const;
export type BossSong = (typeof BOSS_SONGS)[number];
export const BOSS_SONG_NAME: Record<BossSong, string> = {
  boss_gothic_f1: 'กอทิก ชั้น 1',
  boss_gothic_f2: 'กอทิก ชั้น 2',
};
/** What a room plays: a song file, or the boss's own chiptune. */
export type RoomSong = BossSong | 'chip';

/** The bosses with a room of their own (the monster ids of the maps' lairs). */
export const ROOM_BOSSES = ['forest_bear', 'bog_witch', 'yeti', 'volcano_heart', 'cannon_crab', 'pegleg_captain', 'ghost_captain', 'kraken'] as const;
export type RoomBoss = (typeof ROOM_BOSSES)[number];
export const ROOM_BOSS_NAME: Record<RoomBoss, string> = {
  forest_bear: 'หมีป่า',
  bog_witch: 'แม่มดหนอง',
  yeti: 'เยติ',
  volcano_heart: 'หัวใจภูเขาไฟ',
  cannon_crab: 'ปูยักษ์กระดองปืนใหญ่',
  pegleg_captain: 'กัปตันขาไม้',
  ghost_captain: 'กัปตันผีเรือคนตาย',
  kraken: 'คราเคน',
};

export interface BossMusic {
  on: boolean;
  /** Loudness of the song files next to the chiptune (1 = as converted). */
  gain: number;
  rooms: Record<RoomBoss, RoomSong>;
}

export interface BossMusicTuning {
  on?: boolean;
  gain?: number;
  rooms?: Partial<Record<RoomBoss, RoomSong>>;
}

export interface AudioConfig {
  groups: Record<SfxGroup, AudioGroup>;
  music: BossMusic;
}

export interface AudioTuning {
  groups?: Partial<Record<SfxGroup, Partial<AudioGroup>>>;
  music?: BossMusicTuning;
}

export const AUDIO_GAIN_RANGE = [0, 2] as const;
export const CODE_BOSS_MUSIC_GAIN = 0.8;

function codeBossMusic(): BossMusic {
  const floor2: readonly RoomBoss[] = ['cannon_crab', 'pegleg_captain', 'ghost_captain', 'kraken'];
  const rooms = {} as Record<RoomBoss, RoomSong>;
  for (const b of ROOM_BOSSES) rooms[b] = floor2.includes(b) ? 'boss_gothic_f2' : 'boss_gothic_f1';
  return { on: true, gain: CODE_BOSS_MUSIC_GAIN, rooms };
}

/** The song file a boss's room plays under this config, or null for the chiptune (also: not a room boss). */
export function bossRoomSong(m: BossMusic, boss: string | undefined): BossSong | null {
  if (!m.on || !boss || !(ROOM_BOSSES as readonly string[]).includes(boss)) return null;
  const song = m.rooms[boss as RoomBoss];
  return song === 'chip' ? null : song;
}

export function codeAudio(): AudioConfig {
  const groups = {} as Record<SfxGroup, AudioGroup>;
  for (const g of SFX_GROUPS) groups[g] = { on: true, gain: 1 };
  return { groups, music: codeBossMusic() };
}
const CODE = codeAudio();

export function mergeAudio(t: AudioTuning | undefined): AudioConfig {
  const c = codeAudio();
  for (const g of SFX_GROUPS) Object.assign(c.groups[g], t?.groups?.[g]);
  const { rooms, ...music } = t?.music ?? {};
  Object.assign(c.music, music);
  Object.assign(c.music.rooms, rooms);
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Checks the `audio` part of a balance tuning (see checkBalance): strict = errors, else wrong entries are dropped. */
export function checkAudioTuning(x: unknown, strict: boolean): { tuning: AudioTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าเสียงเอฟเฟกต์ไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'groups' && k !== 'music');
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
  if (x.music !== undefined) {
    const c = checkBossMusic(x.music, strict);
    if ('error' in c) return c;
    if (c.tuning) out.music = c.tuning;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

function checkBossMusic(v: unknown, strict: boolean): { tuning: BossMusicTuning | undefined } | { error: string } {
  if (!isObj(v)) return strict ? { error: 'เพลงห้องบอส: ค่าไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(v).find((k) => k !== 'on' && k !== 'gain' && k !== 'rooms');
    if (extra) return { error: `เพลงห้องบอส: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const o: BossMusicTuning = {};
  if (v.on !== undefined) {
    if (typeof v.on !== 'boolean') {
      if (strict) return { error: 'เพลงห้องบอส: เปิด/ปิดไม่ถูกต้อง' };
    } else if (v.on !== CODE.music.on) o.on = v.on;
  }
  if (v.gain !== undefined) {
    const [lo, hi] = AUDIO_GAIN_RANGE;
    const n = v.gain;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) {
      if (strict) return { error: `เพลงห้องบอส: ความดังต้องอยู่ระหว่าง ×${lo}–×${hi}` };
    } else if (round2(n) !== CODE.music.gain) o.gain = round2(n);
  }
  if (v.rooms !== undefined) {
    if (!isObj(v.rooms)) {
      if (strict) return { error: 'เพลงห้องบอส: ค่าห้องไม่ถูกต้อง' };
    } else {
      for (const [id, song] of Object.entries(v.rooms)) {
        if (!(ROOM_BOSSES as readonly string[]).includes(id)) {
          if (strict) return { error: `เพลงห้องบอส: ไม่รู้จักบอส "${id.slice(0, 20)}"` };
          continue;
        }
        const b = id as RoomBoss;
        if (song !== 'chip' && !(BOSS_SONGS as readonly unknown[]).includes(song)) {
          if (strict) return { error: `เพลงห้อง${ROOM_BOSS_NAME[b]}: ไม่รู้จักเพลง` };
        } else if (song !== CODE.music.rooms[b]) (o.rooms ??= {})[b] = song as RoomSong;
      }
    }
  }
  return { tuning: Object.keys(o).length ? o : undefined };
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
  const m = a.music;
  const n = b.music;
  if (m.on !== n.on) out.push(`เพลงไฟล์ห้องบอส ${m.on ? 'เปิด' : 'ปิด'} → ${n.on ? 'เปิด' : 'ปิด'}`);
  if (m.gain !== n.gain) out.push(`ความดังเพลงไฟล์ห้องบอส ×${m.gain} → ×${n.gain}`);
  const song = (s: RoomSong) => (s === 'chip' ? 'chiptune' : BOSS_SONG_NAME[s]);
  for (const id of ROOM_BOSSES) {
    if (m.rooms[id] !== n.rooms[id]) out.push(`เพลงห้อง${ROOM_BOSS_NAME[id]} ${song(m.rooms[id])} → ${song(n.rooms[id])}`);
  }
  return out;
}
