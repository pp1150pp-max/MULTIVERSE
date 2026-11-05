export interface SpawnArea {
  monster: string;
  x: number;
  z: number;
  radius: number;
  count: number;
  /** Seconds before a dead monster comes back, [min, max]. */
  respawn: [number, number];
}

/** Walking into it moves the player to another zone. */
export interface PortalDef {
  to: string;
  x: number;
  z: number;
  /** Players below this level are turned away. */
  minLevel: number;
}

/** An ellipse of slippery ice. */
export interface IceLake {
  x: number;
  z: number;
  rx: number;
  rz: number;
}

/** Which prop set and ground palette a zone is drawn with. */
export type ZoneTheme = 'forest' | 'marsh' | 'snow';

export interface ZoneDef {
  id: string;
  name: string;
  nameTh: string;
  subtitle: string;
  levels: [number, number];
  theme: ZoneTheme;
  /** Open world allows Auto Play; rare-loot dungeons will set this false. */
  allowAutoPlay: boolean;
  half: number;
  seed: number;
  start: { x: number; z: number };
  path: [number, number][];
  branches: [number, number][][];
  spawns: SpawnArea[];
  boss: SpawnArea;
  portals: PortalDef[];
  /** Frozen lakes: walkable, but players slide on them. */
  iceLakes?: IceLake[];
}

export const ZONE_1: ZoneDef = {
  id: 'emerald_forest',
  name: 'Emerald Forest',
  nameTh: 'ป่ามรกต',
  subtitle: 'ป่าเริ่มต้นที่เต็มไปด้วยธรรมชาติและสัตว์ป่าน่ารัก ๆ เหมาะสำหรับผู้เล่นใหม่',
  levels: [1, 10],
  theme: 'forest',
  allowAutoPlay: true,
  half: 64,
  seed: 20261027,
  start: { x: 44, z: 44 },
  path: [[52, 52], [44, 44], [28, 30], [16, 20], [4, 8], [-8, 0], [-16, -14], [-24, -26], [-36, -36], [-44, -44]],
  branches: [
    [[28, 30], [34, 20]],
    [[16, 20], [8, 30], [18, 40]],
    [[-8, 0], [-24, 8]],
    [[-16, -14], [-8, -24]],
    [[-24, -26], [-36, -22], [-46, -20]],
  ],
  spawns: [
    { monster: 'green_slime', x: 34, z: 22, radius: 8, count: 9, respawn: [6, 10] },
    { monster: 'green_slime', x: 20, z: 38, radius: 6, count: 5, respawn: [6, 10] },
    { monster: 'wild_rabbit', x: 10, z: 28, radius: 8, count: 8, respawn: [7, 11] },
    { monster: 'forest_fox', x: -2, z: 10, radius: 9, count: 9, respawn: [8, 12] },
    { monster: 'wild_boar', x: -24, z: 8, radius: 9, count: 8, respawn: [9, 14] },
    { monster: 'forest_wolf', x: -10, z: -24, radius: 9, count: 8, respawn: [10, 15] },
  ],
  boss: { monster: 'forest_bear', x: -42, z: -42, radius: 1, count: 1, respawn: [90, 90] },
  // At the end of a side path before the bear's clearing, so arriving back here doesn't start a boss fight.
  portals: [{ to: 'misty_marsh', x: -46, z: -20, minLevel: 10 }],
};

export const ZONE_2: ZoneDef = {
  id: 'misty_marsh',
  name: 'Misty Marsh',
  nameTh: 'หนองน้ำหมอก',
  subtitle: 'หนองน้ำที่ปกคลุมด้วยหมอกหนา ต้นไม้ตายยืนเรียงราย และสิ่งมีชีวิตที่ไม่เป็นมิตร',
  levels: [11, 20],
  theme: 'marsh',
  allowAutoPlay: true,
  half: 64,
  seed: 20261103,
  start: { x: 44, z: 44 },
  path: [[52, 52], [44, 44], [36, 26], [24, 18], [10, 20], [-4, 10], [-10, -6], [-22, -14], [-30, -30], [-42, -42]],
  branches: [
    [[36, 26], [20, 6]],
    [[24, 18], [12, 32]],
    [[10, 20], [-6, 24]],
    [[-10, -6], [-24, 0]],
    [[-22, -14], [-12, -26]],
    [[-22, -14], [-34, -16], [-46, -18]],
  ],
  spawns: [
    { monster: 'bog_toad', x: 32, z: 32, radius: 7, count: 7, respawn: [7, 11] },
    { monster: 'bog_toad', x: 20, z: 6, radius: 6, count: 5, respawn: [7, 11] },
    { monster: 'marsh_leech', x: 12, z: 32, radius: 8, count: 8, respawn: [8, 12] },
    { monster: 'swamp_serpent', x: -6, z: 24, radius: 8, count: 8, respawn: [9, 13] },
    { monster: 'mire_ghoul', x: -24, z: 0, radius: 9, count: 8, respawn: [10, 14] },
    { monster: 'will_o_wisp', x: -12, z: -26, radius: 9, count: 8, respawn: [10, 15] },
  ],
  boss: { monster: 'bog_witch', x: -42, z: -42, radius: 1, count: 1, respawn: [120, 120] },
  // Back to the forest, just outside the camp. The way on is at the end of a side path before
  // the witch's clearing, like the forest's.
  portals: [
    { to: 'emerald_forest', x: 49.5, z: 49.5, minLevel: 0 },
    { to: 'frost_reach', x: -46, z: -18, minLevel: 20 },
  ],
};

export const ZONE_3: ZoneDef = {
  id: 'frost_reach',
  name: 'Frost Reach',
  nameTh: 'ดินแดนหิมะ',
  subtitle: 'เกาะลอยที่ปกคลุมด้วยน้ำแข็ง สนสูงมีหิมะเกาะ และทะเลสาบเยือกแข็งที่ลื่นจนคุมทิศทางยาก',
  levels: [21, 30],
  theme: 'snow',
  allowAutoPlay: true,
  half: 64,
  seed: 20261105,
  start: { x: 44, z: 44 },
  path: [[52, 52], [44, 44], [34, 30], [22, 26], [12, 12], [-2, 8], [-14, -6], [-26, -18], [-32, -32], [-42, -42]],
  branches: [
    [[34, 30], [40, 12]],
    [[22, 26], [6, 34]],
    [[12, 12], [20, -6]],
    [[-2, 8], [-20, 18]],
    [[-14, -6], [-4, -24]],
  ],
  spawns: [
    { monster: 'frost_penguin', x: 32, z: 32, radius: 7, count: 7, respawn: [8, 12] },
    { monster: 'frost_penguin', x: 40, z: 12, radius: 6, count: 5, respawn: [8, 12] },
    { monster: 'tusk_seal', x: 6, z: 34, radius: 8, count: 8, respawn: [10, 14] },
    { monster: 'snow_owl', x: 20, z: -6, radius: 9, count: 8, respawn: [10, 14] },
    { monster: 'snow_sprite', x: -20, z: 18, radius: 8, count: 8, respawn: [10, 15] },
    { monster: 'polar_bear', x: -4, z: -24, radius: 9, count: 4, respawn: [16, 22] },
  ],
  boss: { monster: 'yeti', x: -42, z: -42, radius: 1, count: 1, respawn: [150, 150] },
  portals: [{ to: 'misty_marsh', x: 49.5, z: 49.5, minLevel: 0 }],
  iceLakes: [
    { x: -32, z: 34, rx: 12, rz: 9 },
    { x: 34, z: -32, rx: 11, rz: 8 },
    { x: 3, z: -7, rx: 5.5, rz: 4 },
  ],
};

export const ZONES: Record<string, ZoneDef> = {
  [ZONE_1.id]: ZONE_1,
  [ZONE_2.id]: ZONE_2,
  [ZONE_3.id]: ZONE_3,
};

/** Saved characters from before zones existed have no zone id; they start in the forest. */
export function zoneById(id: string | undefined): ZoneDef {
  return (id && ZONES[id]) || ZONE_1;
}
