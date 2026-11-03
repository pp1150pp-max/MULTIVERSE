export interface SpawnArea {
  monster: string;
  x: number;
  z: number;
  radius: number;
  count: number;
  /** Seconds before a dead monster comes back, [min, max]. */
  respawn: [number, number];
}

export interface ZoneDef {
  id: string;
  name: string;
  nameTh: string;
  subtitle: string;
  levels: [number, number];
  /** Open world allows Auto Play; rare-loot dungeons will set this false. */
  allowAutoPlay: boolean;
  half: number;
  seed: number;
  start: { x: number; z: number };
  path: [number, number][];
  branches: [number, number][][];
  spawns: SpawnArea[];
  boss: SpawnArea;
}

export const ZONE_1: ZoneDef = {
  id: 'emerald_forest',
  name: 'Emerald Forest',
  nameTh: 'ป่ามรกต',
  subtitle: 'ป่าเริ่มต้นที่เต็มไปด้วยธรรมชาติและสัตว์ป่าน่ารัก ๆ เหมาะสำหรับผู้เล่นใหม่',
  levels: [1, 10],
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
};
