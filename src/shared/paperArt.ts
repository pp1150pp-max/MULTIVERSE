// Papercraft re-art trial (owner 2026-11-17, art_templates/papercraft_maps/PROMPTS.md): one server-wide switch,
// set on /admin → Server, picks whether every player's game loads the map pictures from sprites/paper/ or the old ones.
// The pictures only change on screen: prop names, sizes and collisions are the same either way.

/** The settings row that holds the switch ('1' = paper; missing = the old art). */
export const PAPER_MAPS_SETTING = 'paper_maps';

/** Asked by the game before it loads its pictures (no login needed). */
export const LOOK_PATH = '/api/look';

export interface PublicLook {
  paperMaps: boolean;
}
