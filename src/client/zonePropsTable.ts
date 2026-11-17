// The table of area skills' standing pieces (zoneProps.ts draws them). Kept apart with no DOM or three.js so the tests
// can check it.

/** The standing-layer sheets (public/assets/sprites/fx/<name>.png, art_templates/skills/AOE_PROPS.md). */
export type PropSheet = 'ap_sw_a' | 'ap_sw_b' | 'ap_sw_c' | 'ap_mg_a' | 'ap_mg_b' | 'ap_mg_c' | 'ap_mg_d' | 'ap_mg_e' | 'ap_gs_a';
export const PROP_SHEETS: readonly PropSheet[] = ['ap_sw_a', 'ap_sw_b', 'ap_sw_c', 'ap_mg_a', 'ap_mg_b', 'ap_mg_c', 'ap_mg_d', 'ap_mg_e', 'ap_gs_a'];
/** Rows in each standing-layer sheet. */
export const PROP_SHEET_ROWS = 4;

export interface PropDef {
  sheet: PropSheet;
  row: number;
  /** Height of one piece, in world units (about 1 = a person's waist, 1.8 = a person). */
  h: number;
  /** Pieces per square unit of the area (clamped to 3–18 pieces). */
  density: number;
  /** 'disc' = all over a circle; 'line' = along the cast direction (waves, cones), size long and a third as wide. */
  shape?: 'disc' | 'line';
}

/** Standing pieces by skill id. One-shot skills play them once; lasting zones loop them for as long as they last. */
export const SKILL_PROPS: Record<string, PropDef> = {
  // Sword (sheets ap_sw_a / ap_sw_b / ap_sw_c)
  earthquake: { sheet: 'ap_sw_a', row: 0, h: 1.2, density: 0.25 },
  sw_shockwave: { sheet: 'ap_sw_a', row: 1, h: 1.1, density: 0.6, shape: 'line' },
  sw_cataclysm: { sheet: 'ap_sw_a', row: 2, h: 1.8, density: 0.2 },
  sw_anchor: { sheet: 'ap_sw_a', row: 3, h: 1, density: 1.2 },
  sw_crush: { sheet: 'ap_sw_b', row: 0, h: 1.2, density: 0.5 },
  sw_judgement: { sheet: 'ap_sw_b', row: 1, h: 1.8, density: 0.4 },
  sw_unleash: { sheet: 'ap_sw_b', row: 2, h: 1.6, density: 0.25 },
  sw_bladering: { sheet: 'ap_sw_b', row: 3, h: 1.1, density: 0.3 },
  sw_taunt: { sheet: 'ap_sw_c', row: 0, h: 1.4, density: 0.2 },
  sw_warcry: { sheet: 'ap_sw_c', row: 1, h: 1.4, density: 0.2 },
  sw_unbreakable: { sheet: 'ap_sw_c', row: 2, h: 1.5, density: 0.2 },
  // Mage (sheets ap_mg_a … ap_mg_e)
  frostnova: { sheet: 'ap_mg_a', row: 0, h: 1.3, density: 0.3 },
  meteor: { sheet: 'ap_mg_a', row: 1, h: 1.4, density: 0.4 },
  mg_manaburst: { sheet: 'ap_mg_a', row: 2, h: 1.5, density: 0.4 },
  mg_chargedblast: { sheet: 'ap_mg_a', row: 3, h: 1.8, density: 0.2 },
  mg_flamewave: { sheet: 'ap_mg_b', row: 0, h: 1.4, density: 0.6, shape: 'line' },
  mg_flameground: { sheet: 'ap_mg_b', row: 1, h: 1.1, density: 0.5 },
  mg_firerain: { sheet: 'ap_mg_b', row: 2, h: 1.6, density: 0.4 },
  mg_poisonmist: { sheet: 'ap_mg_b', row: 3, h: 1, density: 0.5 },
  mg_hexseed: { sheet: 'ap_mg_c', row: 0, h: 0.9, density: 0.7 },
  mg_decayring: { sheet: 'ap_mg_c', row: 1, h: 1.2, density: 0.3 },
  mg_decayfield: { sheet: 'ap_mg_c', row: 2, h: 1.2, density: 0.3 },
  mg_cursedash: { sheet: 'ap_mg_c', row: 3, h: 1.1, density: 0.6, shape: 'line' },
  mg_forcewave: { sheet: 'ap_mg_d', row: 0, h: 1.2, density: 0.3 },
  mg_frailcurse: { sheet: 'ap_mg_d', row: 1, h: 1.3, density: 0.4 },
  mg_gravitywell: { sheet: 'ap_mg_d', row: 2, h: 1, density: 0.6 },
  mg_sealveil: { sheet: 'ap_mg_d', row: 3, h: 1.6, density: 0.2 },
  mg_empowerfield: { sheet: 'ap_mg_e', row: 0, h: 1.6, density: 0.2 },
  mg_manashield: { sheet: 'ap_mg_e', row: 1, h: 1.5, density: 0.2 },
  mg_timewarp: { sheet: 'ap_mg_e', row: 2, h: 1.3, density: 0.25 },
  mg_manawell: { sheet: 'ap_mg_e', row: 3, h: 1.6, density: 0.3 },
  // Gunslinger (sheet ap_gs_a)
  gs_smoke: { sheet: 'ap_gs_a', row: 0, h: 1.8, density: 0.4 },
  gs_cluster: { sheet: 'ap_gs_a', row: 1, h: 1.3, density: 0.5 },
  gs_rocketrain: { sheet: 'ap_gs_a', row: 2, h: 1.5, density: 0.3 },
};
