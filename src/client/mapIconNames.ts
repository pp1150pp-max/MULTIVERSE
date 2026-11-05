/** Markers for the maps. Each needs a file at assets/sprites/icons/map_<name>.png. */
export const MAP_ICONS = ['player', 'ally', 'camp', 'merchant', 'blacksmith', 'seeker', 'portal', 'boss', 'flag', 'fight'] as const;
export type MapIcon = (typeof MAP_ICONS)[number];
