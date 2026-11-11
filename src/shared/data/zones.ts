import { mulberry32 } from '../rng';

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
  /**
   * Split into channels (several copies of the map, CH 1, CH 2, …) so players don't crowd one map
   * (see server/channels.ts, docs/systems/channels.md). The farm maps have it; the hub doesn't yet,
   * but setting it there is all it takes.
   */
  channels?: boolean;
  half: number;
  seed: number;
  start: { x: number; z: number };
  path: [number, number][];
  branches: [number, number][][];
  spawns: SpawnArea[];
  /** The boss itself: only in boss rooms (see BOSS_ROOMS). */
  boss?: SpawnArea;
  /** Where a map's boss summoner stands (the old boss clearing), and which boss it calls. None in the hub or rooms. */
  lair?: Lair;
  /** Set on boss rooms: the map whose summoner leads here. */
  roomOf?: string;
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

/** A map's boss summoner: put keys in it to open the boss's room. */
export interface Lair {
  /** The boss's monster id. */
  boss: string;
  x: number;
  z: number;
}

/** Multipliers on a zone's monsters: `stats` for HP, attack and defense; `speed` for moving and attacking. */
export interface MonsterBoost {
  stats: number;
  /** HP and defense only, on top of `stats` (attack keeps `stats`). Default 1. */
  tough?: number;
  /** HP and defense once more, for ordinary monsters only (not bosses or their minions). Default 1. */
  mobTough?: number;
  speed: number;
  /** Boss rooms: HP and attack once more, for the keys put in (1 = one key). Default 1. */
  keys?: number;
  /** How much faster skill cooldowns run (slam, throw, charge, leap, the Volcano Heart's rests). Default 1. */
  skill?: number;
  /**
   * Every monster attacks any player who comes this close, whatever its own behaviour. Left out for
   * the hub's monsters, which keep their own (see hubLoners).
   */
  aggro?: number;
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
    lair: z.lair && pt(z.lair),
    portals: z.portals.map(pt),
    iceLakes: z.iceLakes?.map(ellipse),
    lavaPools: z.lavaPools?.map(ellipse),
  };
}

/** Boss arena when a zone doesn't set its own: the ring of stones around the clearing. */
export const DEFAULT_ARENA = 11;

/** One kind of monster to scatter over a zone, or a squad (`group` of several) that stands together. */
interface Scatter {
  group: [monster: string, count: number][];
  /** How many singles (or squads). */
  count: number;
  respawn: [number, number];
}

/**
 * Spreads a zone's monsters one by one over the whole map instead of in herds, the kinds in order
 * from the camp to the boss: each gets the next band of the way across, in proportion to its count.
 * Off the roads, clear of the camp, the boss's arena, the lakes and pools, and of each other.
 * Seeded by the zone, so every server and browser gets the same layout.
 */
function scatterZone(z: ZoneDef, list: Scatter[]): ZoneDef {
  const r = mulberry32(z.seed + 7);
  const segs: [number, number, number, number][] = [];
  for (const line of [z.path, ...z.branches]) {
    for (let i = 1; i < line.length; i++) segs.push([...line[i - 1], ...line[i]]);
  }
  const toRoad = (x: number, y: number) => {
    let best = Infinity;
    for (const [ax, az, bx, bz] of segs) {
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - az) * vz) / (vx * vx + vz * vz)));
      best = Math.min(best, Math.hypot(x - ax - vx * t, y - az - vz * t));
    }
    return best;
  };
  const boss = z.lair!;
  const arena = z.arenaRadius ?? DEFAULT_ARENA;
  const pools = [...(z.iceLakes ?? []), ...(z.lavaPools ?? [])];
  // 0 at the camp, 1 at the boss, measured along the diagonal between them.
  const from = z.start.x + z.start.z;
  const progress = (x: number, y: number) => (from - (x + y)) / (from - (boss.x + boss.z));
  const FIRST = 0.08;
  const LAST = 0.87;
  const B = z.half - 11;
  const total = list.reduce((n, s) => n + s.count, 0);
  const placed: { x: number; z: number }[] = [];
  const spawns: SpawnArea[] = [];
  let done = 0;
  for (const s of list) {
    const lo = FIRST + ((LAST - FIRST) * done) / total;
    done += s.count;
    const hi = FIRST + ((LAST - FIRST) * done) / total;
    const squad = s.group.length > 1 || s.group[0][1] > 1;
    const apart = squad ? 9 : 6.5;
    let n = 0;
    for (let tries = 0; tries < 5000 && n < s.count; tries++) {
      const x = -B + r() * 2 * B;
      const y = -B + r() * 2 * B;
      const p = progress(x, y);
      if (p < lo - 0.03 || p > hi + 0.03) continue;
      if (toRoad(x, y) < 3.5) continue;
      if (Math.hypot(x - z.start.x, y - z.start.z) < 14) continue;
      if (Math.hypot(x - boss.x, y - boss.z) < arena + 5) continue;
      if (pools.some((l) => Math.hypot((x - l.x) / (l.rx + 2.5), (y - l.z) / (l.rz + 2.5)) < 1)) continue;
      if (placed.some((o) => Math.hypot(o.x - x, o.z - y) < apart)) continue;
      const at = { x: Math.round(x), z: Math.round(y) };
      placed.push(at);
      for (const [monster, count] of s.group) {
        spawns.push({ monster, ...at, radius: squad ? 3 : 2.5, count, respawn: s.respawn });
      }
      n++;
    }
    if (n < s.count) throw new Error(`${z.id}: room for only ${n} of ${s.count} ${s.group[0][0]}`);
  }
  return { ...z, spawns };
}

export const ZONE_1: ZoneDef = scatterZone({
  id: 'emerald_forest',
  name: 'Emerald Forest',
  nameTh: 'ป่ามรกต',
  subtitle: 'ป่าเริ่มต้นที่เต็มไปด้วยธรรมชาติและสัตว์ป่าน่ารัก ๆ เหมาะสำหรับผู้เล่นใหม่',
  levels: [1, 10],
  theme: 'forest',
  allowAutoPlay: true,
  channels: true,
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
  spawns: [],
  lair: { boss: 'forest_bear', x: -42, z: -42 },
  portals: [{ to: HUB_ID, x: 49.5, z: 49.5, minLevel: 0 }],
}, [
  { group: [['green_slime', 1]], count: 14, respawn: [6, 10] },
  { group: [['wild_rabbit', 1]], count: 8, respawn: [7, 11] },
  { group: [['forest_fox', 1]], count: 9, respawn: [8, 12] },
  { group: [['wild_boar', 1]], count: 8, respawn: [9, 14] },
  { group: [['forest_wolf', 1]], count: 8, respawn: [10, 15] },
]);

// Reached from the hub's right portal, so the camp is on the left.
export const ZONE_2: ZoneDef = rotateZone(1, scatterZone({
  id: 'misty_marsh',
  name: 'Misty Marsh',
  nameTh: 'หนองน้ำหมอก',
  subtitle: 'หนองน้ำที่ปกคลุมด้วยหมอกหนา ต้นไม้ตายยืนเรียงราย และสิ่งมีชีวิตที่ไม่เป็นมิตร',
  levels: [11, 20],
  theme: 'marsh',
  monsterBoost: { stats: 1.3, speed: 1.1 },
  allowAutoPlay: true,
  channels: true,
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
  spawns: [],
  lair: { boss: 'bog_witch', x: -42, z: -42 },
  portals: [{ to: HUB_ID, x: 49.5, z: 49.5, minLevel: 0 }],
}, [
  { group: [['bog_toad', 1]], count: 12, respawn: [7, 11] },
  { group: [['marsh_leech', 1]], count: 8, respawn: [8, 12] },
  { group: [['swamp_serpent', 1]], count: 8, respawn: [9, 13] },
  { group: [['mire_ghoul', 1]], count: 8, respawn: [10, 14] },
  { group: [['will_o_wisp', 1]], count: 8, respawn: [10, 15] },
]));

// Reached from the hub's bottom portal, so the camp is at the top.
export const ZONE_3: ZoneDef = rotateZone(2, scatterZone({
  id: 'frost_reach',
  name: 'Frost Reach',
  nameTh: 'ดินแดนหิมะ',
  subtitle: 'เกาะลอยที่ปกคลุมด้วยน้ำแข็ง สนสูงมีหิมะเกาะ และทะเลสาบเยือกแข็งที่ลื่นจนคุมทิศทางยาก',
  levels: [21, 30],
  theme: 'snow',
  monsterBoost: { stats: 4.5, tough: 0.7, mobTough: 0.75, speed: 1.375, skill: 1.25, aggro: 7 },
  allowAutoPlay: true,
  channels: true,
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
  spawns: [],
  lair: { boss: 'yeti', x: -42, z: -42 },
  portals: [{ to: HUB_ID, x: 49.5, z: 49.5, minLevel: 0 }],
  iceLakes: [
    { x: -32, z: 34, rx: 12, rz: 9 },
    { x: 34, z: -32, rx: 11, rz: 8 },
    { x: 3, z: -7, rx: 5.5, rz: 4 },
  ],
}, [
  { group: [['frost_penguin', 1]], count: 12, respawn: [8, 12] },
  { group: [['tusk_seal', 1]], count: 8, respawn: [10, 14] },
  { group: [['snow_owl', 1]], count: 8, respawn: [10, 14] },
  // Squads of 1 sprite shooting from behind 2 brawlers.
  { group: [['snow_sprite', 1], ['snow_brawler', 2]], count: 3, respawn: [10, 15] },
  { group: [['polar_bear', 1]], count: 4, respawn: [16, 22] },
]));

// Reached from the hub's left portal, so the camp is on the right.
export const ZONE_4: ZoneDef = rotateZone(3, scatterZone({
  id: 'ashen_isle',
  name: 'Ashen Isle',
  nameTh: 'เกาะภูเขาไฟ',
  subtitle: 'เกาะหินดำลอยกลางอวกาศ ลาวาเดือดเป็นบ่อ รอยแยกเรืองแสง ขี้เถ้าลอยไม่หยุด และหัวใจของภูเขาไฟที่ยังเต้นอยู่',
  levels: [31, 40],
  theme: 'volcano',
  monsterBoost: { stats: 7, tough: 0.5, mobTough: 0.7, speed: 1.25, skill: 1.25, aggro: 7 },
  allowAutoPlay: true,
  channels: true,
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
  spawns: [],
  // Lots of room: the fight is all about walking out of the way.
  lair: { boss: 'volcano_heart', x: -36, z: -36 },
  arenaRadius: 16,
  portals: [{ to: HUB_ID, x: 49.5, z: 49.5, minLevel: 0 }],
  lavaPools: [
    { x: 20, z: 8, rx: 4.5, rz: 3 },
    { x: -8, z: 22, rx: 5, rz: 3.5 },
    { x: -34, z: -4, rx: 6, rz: 4 },
  ],
}, [
  { group: [['ember_wisp', 1]], count: 12, respawn: [8, 12] },
  { group: [['salamander', 1]], count: 8, respawn: [10, 14] },
  { group: [['lava_bat', 1]], count: 8, respawn: [10, 14] },
  // A mage casting from behind a knight.
  { group: [['ash_mage', 1], ['ash_knight', 1]], count: 4, respawn: [10, 15] },
  { group: [['magma_golem', 1]], count: 6, respawn: [14, 20] },
]));

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
      // Stronger like at home, but they keep their own temper in town.
      boost: zone.monsterBoost ? { ...zone.monsterBoost, aggro: undefined } : NO_BOOST,
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

/** Each boss's body radius in its room (the Volcano Heart is a rock that never moves). */
const BOSS_RADIUS: Record<string, number> = { forest_bear: 1, bog_witch: 1, yeti: 1, volcano_heart: 0 };
const BOSS_ROOM_NAME: Record<string, [string, string]> = {
  forest_bear: ["Bear's Den", 'รังหมีป่า'],
  bog_witch: ["Bog Witch's Lair", 'กระท่อมแม่มดหนอง'],
  yeti: ["Yeti's Cave", 'ถ้ำเยติ'],
  volcano_heart: ['Heart of the Volcano', 'แกนกลางภูเขาไฟ'],
};

/**
 * A map's boss room: a small island the size of the old boss clearing, drawn with the map's own look,
 * with the boss in the middle. Players come in at one corner, at the edge of the arena; the portal
 * back to town behind them only opens once the boss is dead (Sim.checkPortals). Every group gets its
 * own copy (a channel), run by the server (server/bossRooms.ts).
 */
function bossRoom(field: ZoneDef): ZoneDef {
  const lair = field.lair!;
  // (arenaRadius() is defined further down, after this runs at load time.)
  const arena = field.arenaRadius ?? DEFAULT_ARENA;
  // Players appear just inside the arena's edge, on the camera's side (Sim.spawnAt is 2 in from `start`),
  // and nobody can walk out of the arena (Terrain.isBlocked), so the portal home stands inside it too,
  // a little round the edge from where they come in.
  const inner = arena - 1;
  const s = inner * Math.SQRT1_2 + 2;
  const door = Math.PI / 4 + 0.45;
  const exit = { x: Math.cos(door) * inner, z: Math.sin(door) * inner };
  const [name, nameTh] = BOSS_ROOM_NAME[lair.boss];
  return {
    id: `${field.id}_room`,
    name,
    nameTh,
    subtitle: `ห้องบอสของ${field.nameTh}`,
    levels: field.levels,
    theme: field.theme,
    allowAutoPlay: false,
    // The forest wall around the playable square starts 8 in from the edge (Terrain.bound).
    half: arena + 13,
    seed: field.seed + 500,
    start: { x: s, z: s },
    path: [[exit.x, exit.z], [s - 2, s - 2]],
    branches: [],
    spawns: [],
    boss: { monster: lair.boss, x: 0, z: 0, radius: BOSS_RADIUS[lair.boss] ?? 1, count: 1, respawn: [0, 0] },
    // Leads back to this map, next to its summoner (lairExitSpot). Clicked, never walked into (owner 2026-11-12).
    portals: [{ to: field.id, x: exit.x, z: exit.z, minLevel: 0 }],
    roomOf: field.id,
    arenaRadius: field.arenaRadius,
    bossSolid: lair.boss === 'volcano_heart' ? 1.5 : undefined,
    monsterBoost: field.monsterBoost,
  };
}

/** How far from the summoner someone coming out of its room stands. */
export const LAIR_EXIT_RADIUS = 3;

/**
 * Where someone leaving a boss room comes out (owner 2026-11-12: win or lose): a random spot around the
 * summoner of the room's own map. Null when the zone is not a boss room.
 */
export function lairExitSpot(room: ZoneDef, r: () => number = Math.random): { field: string; x: number; z: number } | null {
  const field = room.roomOf ? ZONES[room.roomOf] : undefined;
  const lair = field?.lair;
  if (!field || !lair) return null;
  const a = r() * Math.PI * 2;
  return { field: field.id, x: lair.x + Math.cos(a) * LAIR_EXIT_RADIUS, z: lair.z + Math.sin(a) * LAIR_EXIT_RADIUS };
}

/** Boss rooms, by the id of the map whose summoner opens them. Not in ZONES: the server makes one Sim per group. */
export const BOSS_ROOMS: Record<string, ZoneDef> = Object.fromEntries(
  [ZONE_1, ZONE_2, ZONE_3, ZONE_4].map((z) => [z.id, bossRoom(z)]),
);
const ROOMS_BY_ID: Record<string, ZoneDef> = Object.fromEntries(Object.values(BOSS_ROOMS).map((r) => [r.id, r]));

/** Unknown or missing zone ids land in the hub. Boss rooms count too (the browser draws them). */
export function zoneById(id: string | undefined): ZoneDef {
  return (id && (ZONES[id] ?? ROOMS_BY_ID[id])) || ZONE_HUB;
}

/** The boss clearing of a map (its summoner) or of a room (its boss): where the ring of stones stands. */
export function lairOf(zone: ZoneDef): { x: number; z: number } | undefined {
  return zone.boss ?? zone.lair;
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
