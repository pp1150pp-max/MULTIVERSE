// Server-wide numbers of the skill effects' extra layer (owner 2026-11-15, docs/systems/skill-fx-layer.md): the glow,
// ground light and particles the game draws over a skill's hand-drawn frames, and the feel of a hit on the caster's
// own screen (screen shake, a short freeze, bigger crit numbers), and how many damage numbers show (owner 2026-11-17:
// cap, merging hits on one target, only your own) and how bullets move between snapshots (2026-11-18). Each effect's own recipe is in src/client/fxLayer.ts;
// these multiply all of them. Tuned on /admin → ปรับสมดุล → "เอฟเฟกต์สกิล (ชั้นเสริม)", saved inside the balance
// tuning (`BalanceTuning.fxLayer`), only what differs from the code.

import { CLASSES } from './data/classes';

export interface FxLayerConfig extends Record<QuarksKey, boolean> {
  /** The whole extra layer on or off. */
  enabled: boolean;
  /** Debuff icons over monsters' HP bars and their effects on the body (src/client/debuffFx.ts). */
  debuffs: boolean;
  /** Gold light around a player untouchable after a phoenix revive (off = the character blinks, src/client/views.ts). */
  guardGlow: boolean;
  /** Our own skill buffs as icons under our HP and MP bars, with a clock wipe for the time left (src/client/floating.ts). */
  buffIcons: boolean;
  /** The same icons in a row over the skill bar (owner 2026-11-19). */
  barBuffIcons: boolean;
  /** × the glow around the frames. */
  glow: number;
  /** × the light on the ground. */
  ground: number;
  /** × the number of particles. */
  particles: number;
  /** × the screen shake of a hit. */
  shake: number;
  /** Freeze of a full-weight hit (weight 1), in milliseconds. */
  hitstopMs: number;
  /** × the size of crit numbers. */
  crit: number;
  /** Most damage/text numbers on screen at once; past it the oldest goes (owner 2026-11-17, was 120 in code). */
  maxNums: number;
  /** Hits on the same target within `mergeSec` show as one number (summed); crits merge only with crits. */
  mergeNums: boolean;
  /** The merge window, in seconds. */
  mergeSec: number;
  /** Damage numbers only of your own hits and of hits on you (others' are not even sent). */
  ownNumsOnly: boolean;
  /** Bullets fly on smoothly between snapshots instead of snapping back to the server's (older) spot (owner 2026-11-18). */
  smoothShots: boolean;
  /** The Gunslinger's Support Drone is one drone flying after its owner (owner 2026-11-19); off = a picture drawn again at the shoulder each shot. */
  droneFollow: boolean;
  /** How fast the drone catches up with its owner (per second, higher = tighter) and × its distance from the owner. */
  droneSpeed: number;
  droneDist: number;
  /** Magic circles on the ground under debuffed monsters, buffed players and area skills (src/client/magicCircles.ts). */
  circles: boolean;
  /** Lasting area skills shown as a magic circle only, instead of their painted area and standing pieces. */
  zoneCircles: boolean;
  /** × the magic circles' brightness. */
  circleGlow: number;
  /**
   * How high the sword's slash picture lies (world units, 0 = on the ground). On the ground it showed below the feet
   * swinging down and behind the body swinging up, so the reach looked longer downward (owner 2026-11-21).
   */
  slashLift: number;
  /** How far behind a dead player its crater lies (world units), so the lying body shows in its middle (owner 2026-11-23). */
  craterBack: number;
  /**
   * The hub town's brick floor (owner 2026-11-23): width of its ragged edge into each zone's ground (0 = straight cut)
   * and the radius of its corners, where the gates are (world units). Used when a map is built.
   */
  townEdge: number;
  townRound: number;
  /** Trial (owner 2026-11-18): skill particles drawn with three.quarks (src/client/quarksFx.ts), so far the Meteor only. */
  quarks: boolean;
  /** three.quarks: × particles of other players' effects (your own are always full). */
  quarksOthers: number;
  /** three.quarks: × particles on touch screens (phones, tablets), on top of everything else. */
  quarksTouch: number;
  /** three.quarks: past this many particles on screen, other players' new effects are skipped (your own never are). */
  quarksCap: number;
  /** Paper art (owner 2026-11-18): × the size of a title set's name frame and of its chat bubble. */
  paperPlate: number;
  paperBubble: number;
  /**
   * Name frames and chat bubbles (owner 2026-11-22): the widest they grow before a name is cut with … / a message wraps
   * (screen px, plain ones too), and the paper frames' inner padding (px, top-bottom and left-right).
   */
  plateMaxW: number;
  bubbleMaxW: number;
  platePadY: number;
  platePadX: number;
  /** Players' name plates (and the chat bubbles over them): screen px raised above the head (owner 2026-11-24; 0 = as before). */
  plateLift: number;
  bubblePadY: number;
  bubblePadX: number;
  /** Paper aura footprint length, × the aura's own step size (cosmetics tab). */
  paperFoot: number;
  /** Paper enhancement orbs: grey from which a part takes the accent colour (band, star), and the darkest shading. */
  paperOrbLight: number;
  paperOrbShade: number;
  /** Item slots (every .cell): × corner rounding, × the +N / Lv label inset, × the picture size (owner 2026-11-23). */
  slotCorner: number;
  slotInset: number;
  slotIcon: number;
  /**
   * The enhancement aura under the feet (+7/+10/+13/+15, src/client/views.ts, owner 2026-11-23: it flickered at +15).
   * Smooth = its stepped glow picture is filtered smoothly instead of as hard pixels, so it no longer shimmers while
   * it breathes. It breathes in size (± share) and brightness (± share) at `enhAuraSpeed` (radians a second).
   */
  enhAuraSmooth: boolean;
  enhAuraPulse: number;
  enhAuraBreath: number;
  enhAuraSpeed: number;
  /** × the brightness of its ground glow (1.4 = as bright as it gets). */
  enhAuraGlow: number;
  /**
   * Its rising sparks (+10 and up): × brightness, × how many a second (0 = off), and the seconds one takes to light up
   * (0 = at once, which popped).
   */
  enhSparkGlow: number;
  enhSparkRate: number;
  enhSparkFadeIn: number;
  /**
   * Enhancement orbs: the light is drawn over its orb (off = behind it). At the very same depth the two fought over
   * every pixel and the light blinked on and off, worst at +13/+15 (src/client/orbs.ts, owner 2026-11-23).
   */
  enhOrbGlowFront: boolean;
  /**
   * How much the light of an orb behind the character fades out (0 = not at all, 1 = gone, the code value: owner 2026-11-23). While running, the moving
   * outline of the body cuts that light differently every frame (owner 2026-11-23: the orbs flicker while running).
   */
  enhOrbBackFade: number;
  /** Each skill's extra effects drawn in code over its painted frames (src/client/skillExtras.ts), and × their strength. */
  extras: boolean;
  extrasK: number;
  /** Bosses' skills (owner 2026-11-21): their painted effects (sheets boss_*), and the code effects on top, × strength (src/client/bossFx.ts). */
  bossFx: boolean;
  bossExtras: boolean;
  bossExtrasK: number;
  /** Per skill (or circle fallback key, CIRCLE_FALLBACKS): only what differs from on / ×1 (owner 2026-11-18). */
  skills: Record<string, SkillFxTune>;
  /** The players' own graphics window (owner 2026-11-18, src/client/gfxPrefs.ts): shown in the in-game menu. */
  gfxMenu: boolean;
  /** Players can move game actions to their own keys (เมนู → ตั้งค่า → ตั้งค่าปุ่ม, src/client/keybinds.ts). Off = the code's keys. */
  keyRebind: boolean;
  /** The in-game settings page with side tabs (owner 2026-11-26, src/client/sysmenu.ts); off = the old button list and separate graphics / sound / key windows. */
  settingsTabs: boolean;
  /** HP/MP orbs hug the skill bar on wide screens (owner 2026-11-18); off = the screen's bottom corners. */
  orbsNearBar: boolean;
  /** Particle quality a player starts on (3 high, 2 medium, 1 low, 0 off), and the most anyone can pick. */
  gfxDefault: number;
  gfxMax: number;
  /** × particles of "medium" and "low". */
  gfxMid: number;
  gfxLow: number;
  /**
   * Level-up effects worn as cosmetics (owner 2026-11-25, src/client/levelUpFx.ts): on = each player's worn style
   * (not worn = the old gold column), off = the old gold column for everyone. Each style's look is its cosmetic
   * tuning (cosTuning.ts `levelup`); the look settings that were here (luColor1/2, luSize, luSec, luGround,
   * luSparks, luArrows, luText) moved to the cyan piece (server/db.ts migrateLevelUpLook).
   */
  luNew: boolean;
  /**
   * Dash effects worn as cosmetics (owner 2026-11-26, src/client/dashFx.ts): on = each player's worn style on
   * the dash button (not worn = the old dash), off = the old dash for everyone. Looks: cosTuning.ts `dash`.
   */
  dashNew: boolean;
  /**
   * Shader effects (docs/systems/shaders.md, owner 2026-11-26): `shader` off = everyone sees the game as it was before
   * them; `shWater` = the water group (floor 2's cloud sea, the harbour's water, the pools, the whirlpools); `shPost` =
   * the light group (corner shade, each map's tone and sun shafts, the mist's ribbons); `shShafts` = the sun shafts;
   * `shWind` = the wind (trees, plants, grass and the harbour's ships, src/client/wind.ts).
   */
  shader: boolean;
  shWater: boolean;
  shPost: boolean;
  shShafts: boolean;
  shWind: boolean;
  /** The level (2 high, 1 low, 0 off) a player starts on, on a computer and on a touch screen, and the most anyone can pick. */
  shaderDefault: number;
  shaderTouchDefault: number;
  shaderMax: number;
  /** × how fast the cloud sea drifts, the harbour water flows, and the strength of its waves and of its foam and sparkles. */
  cloudDrift: number;
  waterSpeed: number;
  waterWave: number;
  waterFoam: number;
  /** × the lava pools' churn and glow, and the whirlpools' spiral twist and light bands. */
  lavaWave: number;
  whirlTwist: number;
  whirlGlow: number;
  /**
   * The harbour town's water pours off its rim in a torn paper waterfall (owner 2026-11-27, src/client/harborFalls.ts),
   * at every graphics level; off = the water just ends, as before. `harborFallDepth`: how far it falls. Used when the map
   * is built (the next time a player enters it).
   */
  harborFalls: boolean;
  harborFallDepth: number;
  /**
   * How high the harbour's platforms are drawn over the water (owner 2026-11-27): a wooden side, posts and a shadow
   * under their near edges, at every graphics level; 0 = flat as before. Used when the map is built.
   */
  harborDeckHeight: number;
  /** How much darker the screen's corners get, and × the whole light layer's strength inside a boss room. */
  vignette: number;
  bossRoomPostK: number;
  /** × the sun shafts' strength and the speed they breathe and slide, and their slant (degrees from upright). */
  shaftK: number;
  shaftSpeed: number;
  shaftAngle: number;
  /** × how strongly the mist streams in ribbons (high level). Each map's tone, mist and shafts: sceneGrade.ts. */
  mistFlow: number;
  /**
   * × the wind's strength and speed, and where it blows on screen in degrees (0 right, 90 down, 180 left, 270 up);
   * then × how far trees and plants lean, the grass leans, and the ships rock.
   */
  windK: number;
  windSpeed: number;
  windDir: number;
  swayTree: number;
  swayGrass: number;
  swayShip: number;
}

/** One skill's magic circle and code effects, as set on /admin. Missing = on / ×1. */
export interface SkillFxTune {
  circle?: boolean;
  /** × the circle's size, turning speed and brightness. */
  size?: number;
  speed?: number;
  bright?: number;
  /** Its code effects on/off and × their strength. */
  extra?: boolean;
  extraK?: number;
}
export const SKILL_FX_RANGE = { size: [0.3, 3], speed: [0, 4], bright: [0, 3], extraK: [0, 3] } as const;
/** Circles shown when the skill is not known (src/client/circleDesigns.ts FALLBACK). */
export const CIRCLE_FALLBACKS = ['buff_attack', 'buff_guard', 'buff_speed', 'debuff_stun', 'debuff_dot', 'debuff_slow', 'debuff_weak', 'debuff_armor', 'debuff_mark', 'zone'] as const;
const SKILL_FX_KEYS = new Set<string>([...Object.values(CLASSES).flatMap((c) => c.skills.map((s) => s.id)), ...CIRCLE_FALLBACKS]);

/**
 * Skills drawn with three.quarks (owner 2026-11-18), each with its own switch `qk_<id>` (on in code: the main
 * `quarks` switch is what turns the trial on). The client's recipes are in src/client/quarksFx.ts.
 */
export const QUARKS_SKILLS = {
  meteor: 'อุกกาบาต', fireball: 'ลูกไฟ', mg_starfall: 'ดาวตก', frostnova: 'วงน้ำแข็ง', mg_firerain: 'ฝนเพลิง',
  sw_judgement: 'ดาบพิพากษา', whirlwind: 'พายุดาบ', earthquake: 'ปฐพีแยก', sw_unleash: 'ปลดปล่อยพลัง',
  gs_rocketrain: 'ฝนจรวด', gs_explosive: 'กระสุนระเบิด', headshot: 'ยิงหัว', gs_cluster: 'ระเบิดลูกปราย',
  // every class's dash is one skill id: one switch (the Swordsman's is drawn first, the others with their classes)
  dash: 'แดช',
  // Swordsman, the rest (owner 2026-11-19)
  slash: 'ฟัน', sw_heavyslash: 'ฟันหนัก', sw_sunder: 'ฟันทำลายเกราะ', sw_swordwave: 'คลื่นดาบ', sw_execute: 'ประหาร',
  sw_flurry: 'คมดาบต่อเนื่อง', sw_bladering: 'วงแหวนคมดาบ', sw_crush: 'ทุบทำลาย',
  charge: 'พุ่งชน', sw_triple: 'คอมโบสามจังหวะ', sw_backstep: 'ถอยฟัน', sw_hunt: 'ไล่ล่า', sw_spindodge: 'หมุนตัวหลบ',
  sw_bladedance: 'ระบำดาบ', sw_shadowstep: 'ก้าวเงา', sw_overdrive: 'เร่งเครื่อง', sw_shadowswap: 'เงาสลับร่าง', sw_thousandcuts: 'พันคมดาบ',
  sw_armorbash: 'กระแทกเกราะ', sw_taunt: 'ยั่วยุ', sw_guard: 'ตั้งรับ', sw_shockwave: 'คลื่นสั่นสะเทือน', sw_thorns: 'เกราะสะท้อน',
  // Mage, the rest (owner 2026-11-19; the dash is the one `dash` above)
  bolt: 'ลูกเวท', mg_arcanelance: 'หอกอาร์เคน', mg_chainlightning: 'สายฟ้าฟาด', mg_manaburst: 'ระเบิดมานา', mg_flamewave: 'คลื่นเพลิง',
  mg_volatileorb: 'ลูกแก้วระเบิด', mg_crystalrain: 'ฝนผลึก', mg_chargedblast: 'เวทชาร์จ',
  mg_flameground: 'พื้นเพลิง', mg_poisonmist: 'หมอกพิษอาคม', mg_searingmark: 'ตราเผาผลาญ', mg_decayring: 'วงแหวนสลาย', mg_thunderstorm: 'พายุสายฟ้า',
  mg_crystalspikes: 'หนามผลึก', mg_cursedash: 'เถ้าถ่านคำสาป', mg_hexseed: 'เมล็ดเวทระเบิด', mg_decayfield: 'สนามเสื่อมสลาย',
  mg_forcewave: 'คลื่นผลัก', mg_frailcurse: 'คำสาปเปราะบาง', mg_icecage: 'กรงน้ำแข็ง', mg_gravitywell: 'หลุมแรงโน้มถ่วง', mg_sealveil: 'ม่านผนึกเวท',
  mg_empowerfield: 'สนามเร่งอาคม', mg_manashield: 'โล่มานาหมู่', mg_timewarp: 'บิดเบือนเวลา', mg_manawell: 'วงคืนพลัง',
  // Gunslinger, the rest (owner 2026-11-19; the dash is the one `dash` above)
  shot: 'ยิงเร็ว', pierce: 'กระสุนเจาะเกราะ', gs_deadeye: 'เล็งจุดตาย', gs_aimedshot: 'ยิงประณีต', gs_ricochet: 'กระสุนสะท้อน', gs_counter: 'ยิงสวนกลับ',
  gs_weakspot: 'เจาะจุดอ่อน', gs_finisher: 'ยิงปิดฉาก', gs_lockon: 'ล็อกเป้า', gs_sniperfocus: 'โฟกัสสไนเปอร์',
  rapidfire: 'ยิงรัว', gs_hotrounds: 'กระสุนร้อน', gs_quickreload: 'รีโหลดฉับไว', gs_doubletap: 'ยิงสองนัด', gs_shockrounds: 'กระสุนช็อต',
  gs_stackfire: 'ยิงย้ำเป้า', gs_splitshot: 'กระสุนแยก', gs_piercerounds: 'กระสุนทะลวง', gs_overdrive: 'โอเวอร์ไดรฟ์', gs_bulletstorm: 'พายุลูกกระสุน',
  gs_incendiary: 'กระสุนเพลิง', gs_mine: 'กับระเบิด', gs_smoke: 'ระเบิดควัน', gs_railgun: 'กระสุนรางแม่เหล็ก', gs_drone: 'โดรนสนับสนุน',
  gs_seeker: 'จรวดติดตาม', gs_turret: 'ป้อมปืนพกพา',
  sw_anchor: 'ปักหลัก', sw_warcry: 'ปลุกใจนักรบ', sw_cataclysm: 'ปฐพีถล่ม', sw_unbreakable: 'ราชันย์ไม่ล้ม',
} as const;
export type QuarksSkill = keyof typeof QUARKS_SKILLS;
export type QuarksKey = `qk_${QuarksSkill}`;
export const QUARKS_SKILL_IDS = Object.keys(QUARKS_SKILLS) as QuarksSkill[];
export const quarksKey = (s: QuarksSkill): QuarksKey => `qk_${s}`;
const QUARKS_KEYS = QUARKS_SKILL_IDS.map(quarksKey);

export type FxLayerTuning = Partial<FxLayerConfig>;

export const FX_LAYER_RANGE = {
  glow: [0, 3],
  ground: [0, 3],
  particles: [0, 3],
  shake: [0, 3],
  hitstopMs: [0, 120],
  crit: [0.5, 2],
  maxNums: [10, 200],
  mergeSec: [0, 1],
  circleGlow: [0, 3],
  slashLift: [0, 2],
  craterBack: [0, 3],
  townEdge: [0, 6],
  townRound: [0, 12],
  quarksOthers: [0, 1],
  quarksTouch: [0, 1],
  quarksCap: [0, 10000],
  gfxDefault: [0, 3],
  gfxMax: [0, 3],
  gfxMid: [0, 1],
  gfxLow: [0, 1],
  paperPlate: [0.5, 2],
  paperBubble: [0.5, 2],
  plateMaxW: [80, 400],
  bubbleMaxW: [120, 600],
  platePadY: [0, 20],
  platePadX: [0, 40],
  plateLift: [-40, 150],
  bubblePadY: [0, 30],
  bubblePadX: [0, 40],
  paperFoot: [0.3, 4],
  slotCorner: [0, 3],
  slotInset: [0, 3],
  slotIcon: [0.5, 1.2],
  paperOrbLight: [0.8, 1],
  paperOrbShade: [0, 1],
  enhAuraPulse: [0, 0.3],
  enhAuraBreath: [0, 0.5],
  enhAuraSpeed: [0, 10],
  enhAuraGlow: [0, 1.4],
  enhSparkGlow: [0, 1.2],
  enhSparkRate: [0, 3],
  enhSparkFadeIn: [0, 0.6],
  enhOrbBackFade: [0, 1],
  extrasK: [0, 3],
  bossExtrasK: [0, 3],
  droneSpeed: [1, 20],
  droneDist: [0.3, 3],
  shaderDefault: [0, 2],
  shaderTouchDefault: [0, 2],
  shaderMax: [0, 2],
  cloudDrift: [0, 4],
  waterSpeed: [0, 3],
  waterWave: [0, 3],
  waterFoam: [0, 2],
  lavaWave: [0, 3],
  whirlTwist: [0, 3],
  whirlGlow: [0, 3],
  harborFallDepth: [2, 12],
  harborDeckHeight: [0, 2],
  vignette: [0, 0.6],
  bossRoomPostK: [0, 1],
  shaftK: [0, 3],
  shaftSpeed: [0, 4],
  shaftAngle: [-60, 60],
  mistFlow: [0, 2],
  windK: [0, 3],
  windSpeed: [0, 3],
  windDir: [0, 360],
  swayTree: [0, 3],
  swayGrass: [0, 3],
  swayShip: [0, 3],
} as const satisfies Record<string, readonly [number, number]>;
export type FxLayerNum = keyof typeof FX_LAYER_RANGE;
export const FX_LAYER_NUMS = Object.keys(FX_LAYER_RANGE) as FxLayerNum[];
export const FX_LAYER_NAME: Record<FxLayerNum, string> = {
  glow: '× แสงเรือง',
  ground: '× แสงบนพื้น',
  particles: '× อนุภาค',
  shake: '× จอสั่น',
  hitstopMs: 'ภาพค้างตอนโดน (ms)',
  crit: '× ขนาดตัวเลขคริ',
  maxNums: 'ตัวเลขบนจอสูงสุด',
  mergeSec: 'รวมเลขที่โดนในช่วง (วิ)',
  circleGlow: '× ความสว่างวงเวท',
  slashLift: 'ความสูงภาพคมดาบตอนฟัน (0 = บนพื้น)',
  craterBack: 'หลุมใต้ศพ: เลื่อนไปข้างหลังตัว (ให้ตัวอยู่กลางหลุม)',
  townEdge: 'เมืองกลาง: ความกว้างขอบพื้นอิฐที่กลืนกับพื้นโซน (0 = ตัดตรง)',
  townRound: 'เมืองกลาง: ความโค้งมุมพื้นอิฐ (ตรงประตู)',
  quarksOthers: 'three.quarks: × อนุภาคของคนอื่น',
  quarksTouch: 'three.quarks: × อนุภาคบนจอสัมผัส (มือถือ)',
  quarksCap: 'three.quarks: อนุภาคบนจอสูงสุด (เกินแล้วตัดของคนอื่น)',
  gfxDefault: 'เมนูกราฟิก: คุณภาพเริ่มต้น (3 สูง 2 กลาง 1 ต่ำ 0 ปิด)',
  gfxMax: 'เมนูกราฟิก: คุณภาพสูงสุดที่เลือกได้',
  gfxMid: 'เมนูกราฟิก: × อนุภาคของ "กลาง"',
  gfxLow: 'เมนูกราฟิก: × อนุภาคของ "ต่ำ"',
  paperPlate: '× ขนาดกรอบชื่อ',
  paperBubble: '× ขนาดฟองแชท',
  plateMaxW: 'กรอบชื่อกว้างสุด (px เกินแล้วย่อชื่อด้วย …)',
  bubbleMaxW: 'ฟองแชทกว้างสุด (px เกินแล้วขึ้นบรรทัดใหม่)',
  platePadY: 'กรอบชื่อ: ขอบในบน-ล่าง (px)',
  platePadX: 'กรอบชื่อ: ขอบในซ้าย-ขวา (px)',
  plateLift: 'ป้ายชื่อผู้เล่น: ยกสูงขึ้น (px)',
  bubblePadY: 'ฟองแชท: ขอบในบน-ล่าง (px)',
  bubblePadX: 'ฟองแชท: ขอบในซ้าย-ขวา (px)',
  slotCorner: 'ช่องไอเทม: × ความโค้งมุม',
  slotInset: 'ช่องไอเทม: × ระยะป้าย +N / Lv จากขอบ',
  slotIcon: 'ช่องไอเทม: × ขนาดภาพไอเทม',
  paperFoot: 'ขนาดรอยเท้าออร่า (× ขนาดรอยเท้าของชิ้น)',
  paperOrbLight: 'ลูกแก้ว: ส่วนที่ขาวกว่านี้เป็นสีเน้น',
  paperOrbShade: 'ลูกแก้ว: ความสว่างส่วนมืดสุด',
  enhAuraPulse: 'ออร่าตีบวก: หดขยาย ± (สัดส่วนขนาด, 0 = ไม่หดขยาย)',
  enhAuraBreath: 'ออร่าตีบวก: สว่างหรี่ ± (สัดส่วนความสว่าง, 0 = คงที่)',
  enhAuraSpeed: 'ออร่าตีบวก: ความเร็วหายใจ (ยิ่งมากยิ่งเร็ว)',
  enhAuraGlow: 'ออร่าตีบวก: × ความสว่างแสงบนพื้น',
  enhSparkGlow: 'ประกายออร่าตีบวก: × ความสว่าง',
  enhSparkRate: 'ประกายออร่าตีบวก: × จำนวนต่อวิ (0 = ปิด)',
  enhSparkFadeIn: 'ประกายออร่าตีบวก: เวลาค่อย ๆ สว่าง (วิ, 0 = สว่างทันที)',
  enhOrbBackFade: 'แสงลูกแก้วที่อยู่หลังตัวจางลง (0 = ไม่จาง, 1 = หายหมด)',
  extrasK: '× ความแรงเอฟเฟกต์โค้ดของสกิล',
  bossExtrasK: '× ความแรงเอฟเฟกต์โค้ดของสกิลบอส',
  droneSpeed: 'โดรน: ความเร็วตามตัว (ต่อวิ ยิ่งมากยิ่งติด)',
  droneDist: 'โดรน: × ระยะห่างจากตัวละคร',
  shaderDefault: 'น้ำ ลม และแสง: ระดับเริ่มต้นบนคอม (2 สูง 1 ต่ำ 0 ปิด)',
  shaderTouchDefault: 'น้ำ ลม และแสง: ระดับเริ่มต้นบนจอสัมผัส',
  shaderMax: 'น้ำ ลม และแสง: ระดับสูงสุดที่เลือกได้',
  cloudDrift: '× ความเร็วทะเลเมฆ',
  waterSpeed: '× ความเร็วน้ำท่าเรือ',
  waterWave: '× แรงคลื่นน้ำท่าเรือและบ่อน้ำ',
  waterFoam: '× ฟองและประกายน้ำท่าเรือ',
  lavaWave: '× การไหลและเรืองของลาวา',
  whirlTwist: '× เกลียวบิดของน้ำวน',
  whirlGlow: '× แถบสว่างของน้ำวน',
  harborFallDepth: 'ท่าเรือ: ความยาวม่านน้ำตกขอบเมือง',
  harborDeckHeight: 'ท่าเรือ: ความสูงแพไม้เหนือน้ำ (0 = แบนแบบเดิม)',
  vignette: 'ขอบมืดที่มุมจอ (0 = ไม่มี)',
  bossRoomPostK: '× ขอบมืดและแสงในห้องบอส',
  shaftK: '× ความแรงลำแสงแดด',
  shaftSpeed: '× ความเร็วลำแสงแดด',
  shaftAngle: 'ความเอียงลำแสงแดด (องศาจากแนวตั้ง)',
  mistFlow: '× หมอกไหลเป็นริ้ว',
  windK: '× ความแรงลม',
  windSpeed: '× ความเร็วลม',
  windDir: 'ทิศลมบนจอ (องศา: 0 ขวา 90 ลง 180 ซ้าย 270 ขึ้น)',
  swayTree: '× ต้นไม้และพุ่มไหว',
  swayGrass: '× หญ้าไหว',
  swayShip: '× เรือโคลง (1 = ±0.5°)',
};

const BASE_BOOLS = ['enabled', 'debuffs', 'guardGlow', 'buffIcons', 'barBuffIcons', 'mergeNums', 'ownNumsOnly', 'smoothShots', 'droneFollow', 'circles', 'zoneCircles', 'quarks', 'gfxMenu', 'keyRebind', 'settingsTabs', 'orbsNearBar', 'extras', 'bossFx', 'bossExtras', 'enhAuraSmooth', 'enhOrbGlowFront', 'luNew', 'dashNew', 'shader', 'shWater', 'harborFalls', 'shPost', 'shShafts', 'shWind'] as const;
type FxLayerBool = (typeof BASE_BOOLS)[number] | QuarksKey;
const FX_LAYER_BOOLS: readonly FxLayerBool[] = [...BASE_BOOLS, ...QUARKS_KEYS];
const FX_LAYER_BOOL_NAME: Record<FxLayerBool, string> = {
  enabled: 'เอฟเฟกต์สกิล (ชั้นเสริม)',
  debuffs: 'ดีบัฟบนตัวมอน (ไอคอน + เอฟเฟกต์)',
  guardGlow: 'แสงทองรอบตัวตอนอมตะหลังชุบ (ปิด = กะพริบ)',
  buffIcons: 'ไอคอนบัพสกิลใต้หลอด HP/MP ของตัวเอง',
  barBuffIcons: 'ไอคอนบัพสกิลเหนือกรอบสกิล',
  mergeNums: 'รวมเลขดาเมจที่โดนพร้อมกัน',
  ownNumsOnly: 'เห็นเฉพาะเลขดาเมจของตัวเอง',
  smoothShots: 'กระสุนบินลื่น (ไม่ดึงกลับตาม server)',
  droneFollow: 'โดรนบินตามลื่น (ปิด = วาดภาพโดรนใหม่ที่ไหล่ทุกนัดแบบเดิม)',
  circles: 'วงเวทบนพื้น (บัฟ ดีบัฟ สกิลวงกว้าง)',
  zoneCircles: 'สกิลวงกว้างเป็นวงเวทอย่างเดียว (แทนภาพพื้นที่)',
  quarks: 'อนุภาค three.quarks (ทดลอง)',
  gfxMenu: 'เมนูกราฟิกของผู้เล่น',
  keyRebind: 'ให้ผู้เล่นตั้งปุ่มเอง (เมนู › ตั้งค่า › ตั้งค่าปุ่ม)',
  settingsTabs: 'หน้าต่างตั้งค่าแบบแท็บ (ปิด = ปุ่มเรียง + หน้าต่างกราฟิก/เสียง/ปุ่มแยกแบบเดิม)',
  orbsNearBar: 'ลูกแก้ว HP/MP ชิดแถบสกิล (ปิด = มุมจอ)',
  ...(Object.fromEntries(QUARKS_SKILL_IDS.map((s) => [quarksKey(s), `three.quarks: ${QUARKS_SKILLS[s]}`])) as Record<QuarksKey, string>),
  extras: 'เอฟเฟกต์โค้ดของสกิล (ทับภาพเดิม)',
  bossFx: 'ภาพเอฟเฟกต์สกิลบอส (ปิด = ภาพแบบเดิม ท่าตีตอนร่ายยังเล่น)',
  bossExtras: 'เอฟเฟกต์โค้ดของสกิลบอส (ทับภาพ)',
  enhAuraSmooth: 'ออร่าตีบวกขอบนุ่ม (ปิด = ขอบพิกเซลแบบเดิม กะพริบตอนหดขยาย)',
  enhOrbGlowFront: 'แสงลูกแก้วตีบวกอยู่หน้าลูก (ปิด = หลังลูก)',
  luNew: 'เอฟเฟกต์เลเวลอัปของแต่งตัว (ปิด = เสาแสงสีทองแบบเดิมทุกคน)',
  dashNew: 'เอฟเฟกต์แดชของแต่งตัว (ปิด = แดชแบบเดิมทุกคน)',
  shader: 'เอฟเฟกต์น้ำ ลม และแสง (shader) (ปิด = ทุกคนเห็นภาพแบบเดิม)',
  shWater: 'น้ำและทะเลเมฆขยับ (shader)',
  harborFalls: 'ท่าเรือ: น้ำตกขอบเมืองลงทะเลเมฆ (ปิด = ขอบน้ำตัดแบบเดิม)',
  shPost: 'แสงทั้งจอ: ขอบมืด โทนสีแมพ ลำแสง หมอกไหล (shader)',
  shShafts: 'ลำแสงแดด (shader)',
  shWind: 'ลม: ต้นไม้ หญ้า ไหว และเรือโคลง (shader)',
};


/** The code's own numbers (a fresh copy). */
export function codeFxLayer(): FxLayerConfig {
  return {
    enabled: true, debuffs: true, guardGlow: true, buffIcons: true, barBuffIcons: true, glow: 1, ground: 1, particles: 1, shake: 1, hitstopMs: 60, crit: 1,
    maxNums: 40, mergeNums: true, mergeSec: 0.15, ownNumsOnly: false, smoothShots: true, droneFollow: true, droneSpeed: 7, droneDist: 1, circles: true, zoneCircles: true, circleGlow: 1, slashLift: 0.9, craterBack: 1, townEdge: 1.2, townRound: 3, quarks: false, quarksOthers: 0.5, quarksTouch: 0.5, quarksCap: 3000,
    paperPlate: 1, paperBubble: 1, plateMaxW: 200, bubbleMaxW: 220, platePadY: 3, platePadX: 14, plateLift: 0, bubblePadY: 7, bubblePadX: 18, paperFoot: 1.6, slotCorner: 1, slotInset: 1, slotIcon: 1, paperOrbLight: 0.95, paperOrbShade: 0.15,
    enhAuraSmooth: true, enhAuraPulse: 0.08, enhAuraBreath: 0, enhAuraSpeed: 3, enhAuraGlow: 1, enhSparkGlow: 1, enhSparkRate: 1, enhSparkFadeIn: 0.3, enhOrbGlowFront: true, enhOrbBackFade: 1,
    gfxMenu: true, keyRebind: true, settingsTabs: true, orbsNearBar: true, gfxDefault: 3, gfxMax: 3, gfxMid: 0.6, gfxLow: 0.3,
    ...(Object.fromEntries(QUARKS_KEYS.map((k) => [k, true])) as Record<QuarksKey, boolean>),
    extras: true, extrasK: 1, bossFx: true, bossExtras: true, bossExtrasK: 1, skills: {},
    luNew: true,
    dashNew: true,
    shader: true, shWater: true, shaderDefault: 2, shaderTouchDefault: 1, shaderMax: 2,
    cloudDrift: 1, waterSpeed: 1, waterWave: 1, waterFoam: 1, lavaWave: 1, whirlTwist: 1, whirlGlow: 1,
    harborFalls: true, harborFallDepth: 5, harborDeckHeight: 1.3,
    shPost: true, shShafts: true, vignette: 0.22, bossRoomPostK: 0.5, shaftK: 1.7, shaftSpeed: 1, shaftAngle: 28, mistFlow: 0.5,
    shWind: true, windK: 1, windSpeed: 1, windDir: 0, swayTree: 1, swayGrass: 1, swayShip: 1,
  };
}
const CODE = codeFxLayer();
/** Settings that are whole numbers. */
const WHOLE = new Set<FxLayerNum>(['maxNums', 'quarksCap', 'gfxDefault', 'gfxMax', 'shaderDefault', 'shaderTouchDefault', 'shaderMax']);

/** The shader effects' level: 2 high, 1 low, 0 off (the picture as it was before them). */
export type ShaderLevel = 0 | 1 | 2;

/**
 * The level in use (docs/systems/shaders.md): the player's own pick (left out = the server's starting one for a computer
 * or a touch screen), never above the server's most. Off for everyone while `shader` is off, and for a browser drawing
 * on the CPU.
 */
export function shaderLevelFor(cfg: FxLayerConfig, pick: unknown, touch: boolean, software: boolean): ShaderLevel {
  if (!cfg.shader || software) return 0;
  const start = touch ? cfg.shaderTouchDefault : cfg.shaderDefault;
  const want = typeof pick === 'number' && Number.isFinite(pick) ? pick : start;
  return Math.max(0, Math.min(2, Math.round(want), Math.round(cfg.shaderMax))) as ShaderLevel;
}

export function mergeFxLayer(t: FxLayerTuning | undefined): FxLayerConfig {
  const c = codeFxLayer();
  if (!t) return c;
  for (const k of FX_LAYER_BOOLS) if (t[k] !== undefined) c[k] = t[k]!;
  for (const k of FX_LAYER_NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  if (t.skills) c.skills = { ...t.skills };
  return c;
}

/** Checks the per-skill part: known keys only, numbers in range, entries equal to the code's left out. */
function checkSkillFx(x: unknown, strict: boolean): { skills: Record<string, SkillFxTune> | undefined } | { error: string } {
  if (x === undefined) return { skills: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าวงเวท/เอฟเฟกต์รายสกิลไม่ถูกต้อง' } : { skills: undefined };
  const out: Record<string, SkillFxTune> = {};
  for (const [id, v] of Object.entries(x)) {
    if (!SKILL_FX_KEYS.has(id) || !isObj(v)) {
      if (strict) return { error: `ไม่รู้จักสกิล "${id.slice(0, 30)}"` };
      continue;
    }
    const t: SkillFxTune = {};
    for (const k of ['circle', 'extra'] as const) {
      if (v[k] === undefined) continue;
      if (typeof v[k] !== 'boolean') { if (strict) return { error: `${id}: เปิด/ปิดไม่ถูกต้อง` }; continue; }
      if (v[k] === false) t[k] = false;
    }
    for (const k of Object.keys(SKILL_FX_RANGE) as (keyof typeof SKILL_FX_RANGE)[]) {
      const n = v[k];
      if (n === undefined) continue;
      const [lo, hi] = SKILL_FX_RANGE[k];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) {
        if (strict) return { error: `${id}: ค่า ${k} ต้องอยู่ระหว่าง ${lo}–${hi}` };
        continue;
      }
      if (round3(n) !== 1) t[k] = round3(n);
    }
    for (const k of Object.keys(v)) if (strict && !['circle', 'extra', ...Object.keys(SKILL_FX_RANGE)].includes(k)) return { error: `${id}: ไม่รู้จักค่า "${k.slice(0, 20)}"` };
    if (Object.keys(t).length) out[id] = t;
  }
  return { skills: Object.keys(out).length ? out : undefined };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Checks the `fxLayer` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else wrong
 * entries are dropped. Values equal to the code are left out. Returns the clean tuning (undefined = nothing differs).
 */
export function checkFxLayerTuning(x: unknown, strict: boolean): { tuning: FxLayerTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าเอฟเฟกต์สกิลไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'skills' && !(FX_LAYER_BOOLS as readonly string[]).includes(k) && !(FX_LAYER_NUMS as string[]).includes(k));
    if (extra) return { error: `เอฟเฟกต์สกิล: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: FxLayerTuning = {};
  for (const k of FX_LAYER_BOOLS) {
    const v = x[k];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') {
      if (strict) return { error: `เปิด/ปิด ${FX_LAYER_BOOL_NAME[k]} ไม่ถูกต้อง` };
    } else if (v !== CODE[k]) out[k] = v;
  }
  for (const k of FX_LAYER_NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = FX_LAYER_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `เอฟเฟกต์สกิล "${FX_LAYER_NAME[k]}" ต้องอยู่ระหว่าง ${lo}–${hi}` };
      continue;
    }
    const n = WHOLE.has(k) ? Math.round(v) : round3(v);
    if (n !== CODE[k]) out[k] = n;
  }
  const sk = checkSkillFx(x.skills, strict);
  if ('error' in sk) return sk;
  if (sk.skills) out.skills = sk.skills;
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function fxLayerChanges(a: FxLayerConfig, b: FxLayerConfig): string[] {
  const out: string[] = [];
  for (const k of FX_LAYER_BOOLS) if (a[k] !== b[k]) out.push(`${FX_LAYER_BOOL_NAME[k]} ${a[k] ? 'เปิด' : 'ปิด'} → ${b[k] ? 'เปิด' : 'ปิด'}`);
  for (const k of FX_LAYER_NUMS) if (a[k] !== b[k]) out.push(`เอฟเฟกต์สกิล ${FX_LAYER_NAME[k]} ${a[k]} → ${b[k]}`);
  for (const id of new Set([...Object.keys(a.skills), ...Object.keys(b.skills)])) {
    const x = JSON.stringify(a.skills[id] ?? {}), y = JSON.stringify(b.skills[id] ?? {});
    if (x !== y) out.push(`วงเวท/เอฟเฟกต์ ${id} ${x} → ${y}`);
  }
  return out;
}
