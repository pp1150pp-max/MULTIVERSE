export interface SpawnArea {
  monster: string;
  x: number;
  z: number;
  radius: number;
  count: number;
  /** Seconds before a dead monster comes back, [min, max]. */
  respawn: [number, number];
  /** Overrides the zone's monsterBoost for this area (the hub's monsters keep their home zone's). */
  boost?: MonsterBoost;
}

/** The town in the middle that every zone's portal leads back to. */
export const HUB_ID = 'nexus_city';

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
export type ZoneTheme = 'forest' | 'marsh' | 'snow' | 'volcano';

/** An ellipse of lava: walkable, but it burns whoever stands in it. */
export interface LavaPool {
  x: number;
  z: number;
  rx: number;
  rz: number;
}

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
  /** None in the hub. */
  boss?: SpawnArea;
  portals: PortalDef[];
  /** Square where nobody can fight and monsters can't go (server enforced): the hub's walled town. */
  safe?: SafeArea;
  /** The camp NPCs stand around `start` (only the hub has them). */
  npcs?: boolean;
  /**
   * Draws each quarter of the map with another zone's theme, blended where they meet.
   * Order: [x<0 z<0 (top of the screen), x≥0 z<0 (right), x<0 z≥0 (left), x≥0 z≥0 (bottom)].
   */
  quadrants?: [ZoneTheme, ZoneTheme, ZoneTheme, ZoneTheme];
  /** Frozen lakes: walkable, but players slide on them. */
  iceLakes?: IceLake[];
  /** Burning pools. See LAVA_BURN. */
  lavaPools?: LavaPool[];
  /** Size of the boss's arena, marked by the ring of stones (default DEFAULT_ARENA). Auto Play stays out of it. */
  arenaRadius?: number;
  /** The boss can't be walked through (for one that never moves). */
  bossSolid?: number;
  /** Makes every monster here (bosses and summons too) stronger than its MonsterDef; none = as defined. */
  monsterBoost?: MonsterBoost;
}

/** Multipliers on a zone's monsters: `stats` for HP, attack and defense; `speed` for moving and attacking. */
export interface MonsterBoost {
  stats: number;
  speed: number;
}
export const NO_BOOST: MonsterBoost = { stats: 1, speed: 1 };

/** A square (on screen, a diamond) around (x, z), `half` across from the middle to each side. */
export interface SafeArea {
  x: number;
  z: number;
  half: number;
}

/**
 * Turns a zone's layout a quarter turn at a time around its centre, so its camp (and portal back
 * to the hub) sits on the side opposite the hub portal that leads here: walk into the hub's top
 * portal and you come out at the bottom of the forest, and so on.
 */
function rotateZone(turns: 0 | 1 | 2 | 3, z: ZoneDef): ZoneDef {
  const r = (x: number, y: number): [number, number] => {
    let p: [number, number] = [x, y];
    for (let i = 0; i < turns; i++) p = [-p[1], p[0]];
    return p;
  };
  const pt = <T extends { x: number; z: number }>(o: T): T => {
    const [x, y] = r(o.x, o.z);
    return { ...o, x, z: y };
  };
  const ellipse = <T extends { x: number; z: number; rx: number; rz: number }>(o: T): T =>
    turns % 2 ? { ...pt(o), rx: o.rz, rz: o.rx } : pt(o);
  return {
    ...z,
    start: pt(z.start),
    path: z.path.map(([x, y]) => r(x, y)),
    branches: z.branches.map((b) => b.map(([x, y]) => r(x, y))),
    spawns: z.spawns.map(pt),
    boss: z.boss && pt(z.boss),
    portals: z.portals.map(pt),
    iceLakes: z.iceLakes?.map(ellipse),
    lavaPools: z.lavaPools?.map(ellipse),
  };
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
  portals: [{ to: HUB_ID, x: 49.5, z: 49.5, minLevel: 0 }],
};

// Reached from the hub's right portal, so the camp is on the left.
export const ZONE_2: ZoneDef = rotateZone(1, {
  id: 'misty_marsh',
  name: 'Misty Marsh',
  nameTh: 'หนองน้ำหมอก',
  subtitle: 'หนองน้ำที่ปกคลุมด้วยหมอกหนา ต้นไม้ตายยืนเรียงราย และสิ่งมีชีวิตที่ไม่เป็นมิตร',
  levels: [11, 20],
  theme: 'marsh',
  monsterBoost: { stats: 1.3, speed: 1.1 },
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
  portals: [{ to: HUB_ID, x: 49.5, z: 49.5, minLevel: 0 }],
});

// Reached from the hub's bottom portal, so the camp is at the top.
export const ZONE_3: ZoneDef = rotateZone(2, {
  id: 'frost_reach',
  name: 'Frost Reach',
  nameTh: 'ดินแดนหิมะ',
  subtitle: 'เกาะลอยที่ปกคลุมด้วยน้ำแข็ง สนสูงมีหิมะเกาะ และทะเลสาบเยือกแข็งที่ลื่นจนคุมทิศทางยาก',
  levels: [21, 30],
  theme: 'snow',
  monsterBoost: { stats: 1.5, speed: 1.1 },
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
    // Three groups, each 1 sprite shooting from behind 2 brawlers.
    { monster: 'snow_sprite', x: -20, z: 18, radius: 3, count: 1, respawn: [10, 15] },
    { monster: 'snow_brawler', x: -20, z: 18, radius: 3, count: 2, respawn: [10, 15] },
    { monster: 'snow_sprite', x: -11, z: 23, radius: 3, count: 1, respawn: [10, 15] },
    { monster: 'snow_brawler', x: -11, z: 23, radius: 3, count: 2, respawn: [10, 15] },
    { monster: 'snow_sprite', x: -27, z: 10, radius: 3, count: 1, respawn: [10, 15] },
    { monster: 'snow_brawler', x: -27, z: 10, radius: 3, count: 2, respawn: [10, 15] },
    { monster: 'polar_bear', x: -4, z: -24, radius: 9, count: 4, respawn: [16, 22] },
  ],
  boss: { monster: 'yeti', x: -42, z: -42, radius: 1, count: 1, respawn: [150, 150] },
  portals: [{ to: HUB_ID, x: 49.5, z: 49.5, minLevel: 0 }],
  iceLakes: [
    { x: -32, z: 34, rx: 12, rz: 9 },
    { x: 34, z: -32, rx: 11, rz: 8 },
    { x: 3, z: -7, rx: 5.5, rz: 4 },
  ],
});

// Reached from the hub's left portal, so the camp is on the right.
export const ZONE_4: ZoneDef = rotateZone(3, {
  id: 'ashen_isle',
  name: 'Ashen Isle',
  nameTh: 'เกาะภูเขาไฟ',
  subtitle: 'เกาะหินดำลอยกลางอวกาศ ลาวาเดือดเป็นบ่อ รอยแยกเรืองแสง ขี้เถ้าลอยไม่หยุด และหัวใจของภูเขาไฟที่ยังเต้นอยู่',
  levels: [31, 40],
  theme: 'volcano',
  allowAutoPlay: true,
  half: 64,
  seed: 20261107,
  start: { x: 44, z: 44 },
  path: [[52, 52], [44, 44], [34, 28], [22, 22], [10, 10], [-2, 6], [-12, -6], [-20, -14], [-26, -26], [-36, -36]],
  branches: [
    [[34, 28], [42, 10]],
    [[22, 22], [6, 36]],
    [[10, 10], [22, -8]],
    [[-2, 6], [-22, 16]],
    [[-12, -6], [0, -26]],
  ],
  spawns: [
    { monster: 'ember_wisp', x: 32, z: 32, radius: 7, count: 7, respawn: [8, 12] },
    { monster: 'ember_wisp', x: 42, z: 10, radius: 6, count: 5, respawn: [8, 12] },
    { monster: 'salamander', x: 6, z: 36, radius: 8, count: 8, respawn: [10, 14] },
    { monster: 'lava_bat', x: 22, z: -8, radius: 9, count: 8, respawn: [10, 14] },
    { monster: 'magma_golem', x: 0, z: -26, radius: 9, count: 6, respawn: [14, 20] },
    { monster: 'ash_mage', x: -22, z: 16, radius: 8, count: 4, respawn: [10, 15] },
    { monster: 'ash_knight', x: -22, z: 16, radius: 8, count: 4, respawn: [10, 15] },
  ],
  // Lots of room: the fight is all about walking out of the way.
  boss: { monster: 'volcano_heart', x: -36, z: -36, radius: 0, count: 1, respawn: [180, 180] },
  arenaRadius: 16,
  bossSolid: 1.5,
  portals: [{ to: HUB_ID, x: 49.5, z: 49.5, minLevel: 0 }],
  lavaPools: [
    { x: 20, z: 8, rx: 4.5, rz: 3 },
    { x: -8, z: 22, rx: 5, rz: 3.5 },
    { x: -34, z: -4, rx: 6, rz: 4 },
  ],
});

/** Where the hub's portals sit: one per corner, this far out on each axis. */
const HUB_PORTAL = 54.5;
/**
 * Single monsters in front of each hub portal, as (distance from the centre along the road, distance
 * to the side of it). Monster 1 and 2 of that zone take turns, 8 and 7, at least 8.5 apart, clear of
 * the town's corners (25) and of the portal itself (at ~77).
 */
const HUB_LONERS: [number, number][] = [
  [31, 18.5], [31, 6.5], [31, -19], [37, -10], [37, 12.5], [44.5, -16], [44.5, -5.5], [46, 17],
  [47.5, 8], [55, -10], [56.5, 14], [56.5, 5], [61, -16], [65.5, 5], [65.5, -5.5],
];

function hubLoners(zone: ZoneDef, sx: number, sz: number): SpawnArea[] {
  const kinds: SpawnArea[] = [];
  for (const sp of zone.spawns) if (!kinds.some((k) => k.monster === sp.monster)) kinds.push(sp);
  // Along the road toward this corner, and across it.
  const ux = sx * Math.SQRT1_2;
  const uz = sz * Math.SQRT1_2;
  return HUB_LONERS.map(([along, side], i) => {
    const kind = kinds[i % 2];
    return {
      monster: kind.monster,
      x: ux * along - uz * side,
      z: uz * along + ux * side,
      radius: 1,
      count: 1,
      respawn: kind.respawn,
      boost: zone.monsterBoost ?? NO_BOOST,
    };
  });
}

/** Corners of the hub, in the order of ZoneDef.quadrants, and the zone each one's portal leads to. */
const HUB_CORNERS: [number, number, ZoneDef][] = [
  [-1, -1, ZONE_1],
  [1, -1, ZONE_2],
  [-1, 1, ZONE_4],
  [1, 1, ZONE_3],
];

export const ZONE_HUB: ZoneDef = {
  id: HUB_ID,
  name: 'Nexus City',
  nameTh: 'เมืองศูนย์กลางมิติ',
  subtitle: 'เมืองกลางเกาะที่เชื่อมสี่ดินแดนเข้าด้วยกัน ปลอดภัยจากมอนสเตอร์ และมีประตูมิติทั้งสี่มุม',
  levels: [1, 40],
  theme: 'forest',
  quadrants: ['forest', 'marsh', 'volcano', 'snow'],
  allowAutoPlay: true,
  half: 69,
  seed: 20261108,
  start: { x: 0, z: 0 },
  safe: { x: 0, z: 0, half: 17.6 },
  npcs: true,
  // Top portal to bottom portal, with a bend or two so it isn't a ruler line.
  // Straight out through the gatehouse on each corner of the town, then on to that corner's portal.
  path: [[-58, -58], [-40, -38], [-26, -26], [0, 0], [26, 26], [38, 40], [58, 58]],
  branches: [
    [[0, 0], [26, -26], [38, -40], [58, -58]],
    [[0, 0], [-26, 26], [-40, 38], [-58, 58]],
  ],
  spawns: HUB_CORNERS.flatMap(([sx, sz, zone]) => hubLoners(zone, sx, sz)),
  portals: HUB_CORNERS.map(([sx, sz, zone]) => ({ to: zone.id, x: sx * HUB_PORTAL, z: sz * HUB_PORTAL, minLevel: 0 })),
};

export const ZONES: Record<string, ZoneDef> = {
  [ZONE_HUB.id]: ZONE_HUB,
  [ZONE_1.id]: ZONE_1,
  [ZONE_2.id]: ZONE_2,
  [ZONE_3.id]: ZONE_3,
  [ZONE_4.id]: ZONE_4,
};

/** Unknown or missing zone ids land in the hub. */
export function zoneById(id: string | undefined): ZoneDef {
  return (id && ZONES[id]) || ZONE_HUB;
}

export function inSafeArea(zone: ZoneDef, x: number, z: number): boolean {
  const s = zone.safe;
  return !!s && Math.abs(x - s.x) < s.half && Math.abs(z - s.z) < s.half;
}

/**
 * Which theme draws the ground and props at (x, z): the zone's own, or in the hub the quarter's.
 * `jitter` wobbles the borders between quarters so they blend instead of meeting on a ruler line.
 */
export function themeAt(zone: ZoneDef, x: number, z: number, jitter = 0): ZoneTheme {
  const q = zone.quadrants;
  if (!q) return zone.theme;
  const wx = x + jitter * Math.sin(z * 0.21 + Math.sin(z * 0.057) * 3);
  const wz = z + jitter * Math.sin(x * 0.19 + Math.sin(x * 0.061) * 3);
  return q[(wx >= 0 ? 1 : 0) + (wz >= 0 ? 2 : 0)];
}

/** Boss arena when a zone doesn't set its own: the ring of stones around the clearing. */
export const DEFAULT_ARENA = 11;
export const arenaRadius = (zone: ZoneDef): number => zone.arenaRadius ?? DEFAULT_ARENA;
/** The bare ground around the boss reaches a little past its arena. */
export const clearingRadius = (zone: ZoneDef): number => arenaRadius(zone) + 2;

export function inBossArena(zone: ZoneDef, x: number, z: number): boolean {
  return !!zone.boss && Math.hypot(x - zone.boss.x, z - zone.boss.z) <= arenaRadius(zone);
}

export function lavaAt(zone: ZoneDef, x: number, z: number): LavaPool | null {
  return zone.lavaPools?.find((l) => Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz) < 1) ?? null;
}

/** Lava: this share of max HP, every LAVA_TICK seconds while standing in it. Ignores defense. */
export const LAVA_BURN = 0.03;
export const LAVA_TICK = 0.5;
