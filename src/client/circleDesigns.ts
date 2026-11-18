// One magic circle per skill (owner 2026-11-18): every skill has its own design, drawn in code on a canvas. A design is
// an element (its two colours), a middle picture (motif), and the ring style, rune style and spokes, which come from
// the skill's id so no two skills match. The outer part (rings, runes, spokes) and the inner part (motif) are drawn
// on two pictures that turn at their own speeds. No three.js here: the /admin preview draws the same pictures.

export type Element =
  | 'fire' | 'ice' | 'poison' | 'lightning' | 'arcane' | 'mana' | 'dark' | 'void' | 'time' | 'earth' | 'wind'
  | 'holy' | 'blood' | 'steel' | 'tech' | 'shadow';

export const ELEMENT_COLOR: Record<Element, [string, string]> = {
  fire: ['#ff7a2a', '#ffd04a'],
  ice: ['#7fd8ff', '#e8faff'],
  poison: ['#7dff4a', '#d8ff8a'],
  lightning: ['#a8d0ff', '#fff59a'],
  arcane: ['#a68cff', '#e8d8ff'],
  mana: ['#4fb8ff', '#c8f0ff'],
  dark: ['#c05aff', '#ff7ae0'],
  void: ['#9a5cff', '#ffd25a'],
  time: ['#ffd25a', '#7fe0ff'],
  earth: ['#d8a060', '#ffe0a0'],
  wind: ['#8fe8d8', '#e8fff8'],
  holy: ['#ffd25a', '#fff6c8'],
  blood: ['#ff4a5a', '#ffb8a0'],
  steel: ['#c8d4ff', '#ffffff'],
  tech: ['#ff9a40', '#ffe8a0'],
  shadow: ['#8a6cff', '#c8d0ff'],
};

export const MOTIFS = [
  'star5', 'star6', 'star7', 'star8', 'triangle', 'square', 'pentagon', 'hexagon', 'octagon', 'snowflake', 'flame',
  'eye', 'gear', 'crosshair', 'sword', 'swords', 'shield', 'bolt', 'moon', 'sun', 'spiral', 'drop', 'hourglass',
  'chevrons', 'target', 'skull', 'crown', 'diamond', 'claw', 'wave', 'arrow', 'atom', 'lotus', 'cross', 'propeller',
  'bullet', 'rocket', 'meteor', 'cloud', 'hand', 'chain',
] as const;
export type Motif = (typeof MOTIFS)[number];

export const RUNE_STYLES = ['glyphs', 'ticks', 'dots', 'chevrons', 'triangles', 'squares', 'crosses', 'arcs'] as const;
export type RuneStyle = (typeof RUNE_STYLES)[number];
/** Ring sets: 0 two rings · 1 three thin · 2 thick + dashed · 3 two rings with a dotted one between. */
export const RING_STYLES = 4;
const SPOKES = [0, 4, 6, 8, 12] as const;

export interface CircleDesign {
  key: string;
  color: string;
  color2: string;
  motif: Motif;
  rings: number;
  runes: RuneStyle;
  runeCount: number;
  spokes: number;
  /** Outer part's turn speed (rad/s, sign = direction) and the inner part's, as a multiple of it. */
  spin: number;
  inner: number;
  /** 0–1: how much it breathes in brightness. */
  pulse: number;
}

/** Every skill: [element, motif]. Ring/rune/spoke styles come from the id (made unique below). */
const SKILLS: Record<string, [Element, Motif]> = {
  // Basic attacks
  slash: ['steel', 'claw'], shot: ['tech', 'bullet'], bolt: ['arcane', 'atom'],
  // Mage
  fireball: ['fire', 'flame'], mg_arcanelance: ['arcane', 'arrow'], mg_chainlightning: ['lightning', 'chain'],
  mg_manaburst: ['mana', 'star8'], mg_flamewave: ['fire', 'wave'], mg_volatileorb: ['arcane', 'sun'],
  mg_crystalrain: ['ice', 'diamond'], mg_chargedblast: ['lightning', 'target'], meteor: ['fire', 'meteor'],
  mg_starfall: ['holy', 'star5'], mg_flameground: ['fire', 'hexagon'], mg_poisonmist: ['poison', 'cloud'],
  mg_searingmark: ['fire', 'eye'], mg_decayring: ['poison', 'skull'], mg_thunderstorm: ['lightning', 'bolt'],
  mg_crystalspikes: ['ice', 'triangle'], mg_cursedash: ['dark', 'moon'], mg_hexseed: ['dark', 'star6'],
  mg_firerain: ['fire', 'star7'], mg_decayfield: ['poison', 'pentagon'], frostnova: ['ice', 'snowflake'],
  mg_forcewave: ['wind', 'chevrons'], mg_frailcurse: ['dark', 'hand'], mg_icecage: ['ice', 'square'],
  mg_gravitywell: ['void', 'spiral'], mg_sealveil: ['arcane', 'octagon'], mg_empowerfield: ['holy', 'crown'],
  mg_manashield: ['mana', 'shield'], mg_timewarp: ['time', 'hourglass'], mg_manawell: ['mana', 'drop'],
  mg_elementmastery: ['arcane', 'lotus'], mg_manasource: ['mana', 'sun'], mg_arcanepower: ['arcane', 'star7'],
  // Swordsman
  whirlwind: ['wind', 'spiral'], sw_heavyslash: ['steel', 'sword'], sw_sunder: ['earth', 'claw'],
  sw_swordwave: ['wind', 'wave'], sw_execute: ['blood', 'skull'], sw_flurry: ['steel', 'star8'],
  sw_bladering: ['steel', 'gear'], sw_crush: ['earth', 'square'], sw_unleash: ['holy', 'sun'],
  sw_judgement: ['holy', 'sword'], charge: ['earth', 'arrow'], sw_triple: ['steel', 'triangle'],
  sw_backstep: ['wind', 'chevrons'], sw_hunt: ['blood', 'eye'], sw_spindodge: ['wind', 'propeller'],
  sw_bladedance: ['steel', 'lotus'], sw_shadowstep: ['shadow', 'moon'], sw_overdrive: ['blood', 'flame'],
  sw_shadowswap: ['shadow', 'hourglass'], sw_thousandcuts: ['steel', 'star6'], earthquake: ['earth', 'pentagon'],
  sw_armorbash: ['steel', 'shield'], sw_taunt: ['blood', 'crown'], sw_guard: ['holy', 'shield'],
  sw_shockwave: ['earth', 'target'], sw_thorns: ['blood', 'star5'], sw_anchor: ['earth', 'cross'],
  sw_warcry: ['blood', 'chevrons'], sw_cataclysm: ['earth', 'meteor'], sw_unbreakable: ['holy', 'hexagon'],
  sw_duelist: ['steel', 'swords'], sw_lightfeet: ['wind', 'arrow'], sw_ironhide: ['steel', 'octagon'],
  // Gunslinger
  pierce: ['tech', 'arrow'], gs_deadeye: ['blood', 'crosshair'], gs_aimedshot: ['steel', 'crosshair'],
  gs_ricochet: ['tech', 'triangle'], gs_counter: ['tech', 'shield'], gs_weakspot: ['blood', 'target'],
  gs_finisher: ['blood', 'bullet'], gs_lockon: ['tech', 'target'], headshot: ['blood', 'skull'],
  gs_sniperfocus: ['steel', 'eye'], rapidfire: ['tech', 'chevrons'], gs_hotrounds: ['fire', 'bullet'],
  gs_quickreload: ['tech', 'gear'], gs_doubletap: ['tech', 'swords'], gs_shockrounds: ['lightning', 'bullet'],
  gs_stackfire: ['fire', 'square'], gs_splitshot: ['tech', 'star6'], gs_piercerounds: ['steel', 'bullet'],
  gs_overdrive: ['tech', 'flame'], gs_bulletstorm: ['tech', 'star8'], gs_explosive: ['fire', 'sun'],
  gs_incendiary: ['fire', 'drop'], gs_mine: ['tech', 'hexagon'], gs_smoke: ['shadow', 'cloud'],
  gs_railgun: ['lightning', 'arrow'], gs_drone: ['tech', 'propeller'], gs_seeker: ['tech', 'rocket'],
  gs_cluster: ['fire', 'star5'], gs_rocketrain: ['fire', 'rocket'], gs_turret: ['steel', 'gear'],
  gs_hawkeye: ['wind', 'eye'], gs_triggerfinger: ['tech', 'hand'], gs_specialammo: ['tech', 'diamond'],
};

/** Circles shown without a known skill: by kind of buff/debuff, or an area effect's class. */
const FALLBACK: Record<string, [Element, Motif]> = {
  buff_attack: ['blood', 'swords'], buff_guard: ['holy', 'shield'], buff_speed: ['wind', 'chevrons'],
  debuff_stun: ['lightning', 'star5'], debuff_dot: ['fire', 'flame'], debuff_slow: ['ice', 'snowflake'],
  debuff_weak: ['dark', 'moon'], debuff_armor: ['steel', 'cross'], debuff_mark: ['blood', 'crosshair'],
  zone: ['arcane', 'star5'],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildDesigns(): Map<string, CircleDesign> {
  const out = new Map<string, CircleDesign>();
  const used = new Set<string>();
  for (const [key, [el, motif]] of [...Object.entries(SKILLS), ...Object.entries(FALLBACK)]) {
    const h = hash(key);
    let rings = h % RING_STYLES;
    let runes = (h >>> 3) % RUNE_STYLES.length;
    let spokes = (h >>> 7) % SPOKES.length;
    // No two designs alike: step the styles until this mix is free.
    for (let n = 0; used.has(`${el}|${motif}|${rings}|${runes}|${spokes}`) && n < 200; n++) {
      runes = (runes + 1) % RUNE_STYLES.length;
      if (runes === 0) rings = (rings + 1) % RING_STYLES;
      if (n % 9 === 8) spokes = (spokes + 1) % SPOKES.length;
    }
    used.add(`${el}|${motif}|${rings}|${runes}|${spokes}`);
    const [color, color2] = ELEMENT_COLOR[el];
    const dir = (h >>> 11) & 1 ? 1 : -1;
    out.set(key, {
      key, color, color2, motif, rings, runes: RUNE_STYLES[runes], runeCount: 12 + ((h >>> 13) % 4) * 4, spokes: SPOKES[spokes],
      spin: dir * (0.35 + ((h >>> 15) % 6) * 0.1),
      inner: (h >>> 19) & 1 ? -1.3 : 0.6,
      pulse: 0.1 + ((h >>> 21) % 4) * 0.06,
    });
  }
  return out;
}

const DESIGNS = buildDesigns();

/** The design of a skill (or a fallback key: buff_attack, debuff_stun, zone, …), or undefined. */
export const circleDesign = (key: string | null | undefined): CircleDesign | undefined => (key ? DESIGNS.get(key) : undefined);
export const skillCircleIds = (): string[] => Object.keys(SKILLS);

// ------------------------------------------------------------ drawing

type G = CanvasRenderingContext2D;

function ring(g: G, C: number, r: number, w: number, dash?: number[]): void {
  g.lineWidth = w;
  g.setLineDash(dash ?? []);
  g.beginPath();
  g.arc(C, C, r, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
}

function poly(g: G, C: number, r: number, n: number, step = 1, rot = -Math.PI / 2): void {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = rot + (i * step * Math.PI * 2) / n;
    const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.stroke();
}

function rune(g: G, style: RuneStyle, i: number, s: number): void {
  g.beginPath();
  switch (style) {
    case 'glyphs':
      g.moveTo(0, -s); g.lineTo(0, s);
      if (i % 3 === 0) { g.moveTo(-s * 0.7, -s * 0.3); g.lineTo(s * 0.7, s * 0.3); }
      if (i % 3 === 1) { g.moveTo(0, -s); g.lineTo(s * 0.7, -s * 0.2); g.moveTo(0, 0); g.lineTo(-s * 0.7, s * 0.5); }
      if (i % 3 === 2) { g.moveTo(-s * 0.6, -s); g.lineTo(s * 0.6, s); }
      g.stroke();
      return;
    case 'ticks':
      g.moveTo(0, -s * (i % 2 ? 0.5 : 1)); g.lineTo(0, s * (i % 2 ? 0.5 : 1));
      g.stroke();
      return;
    case 'dots':
      g.arc(0, 0, s * (i % 2 ? 0.3 : 0.5), 0, Math.PI * 2);
      g.fill();
      return;
    case 'chevrons':
      g.moveTo(-s * 0.7, -s * 0.4); g.lineTo(0, s * 0.5); g.lineTo(s * 0.7, -s * 0.4);
      g.stroke();
      return;
    case 'triangles':
      g.moveTo(0, -s * 0.7); g.lineTo(s * 0.6, s * 0.5); g.lineTo(-s * 0.6, s * 0.5); g.closePath();
      if (i % 2) g.fill(); else g.stroke();
      return;
    case 'squares':
      g.rect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9);
      if (i % 3 === 0) g.fill(); else g.stroke();
      return;
    case 'crosses':
      g.moveTo(-s * 0.6, 0); g.lineTo(s * 0.6, 0); g.moveTo(0, -s * 0.8); g.lineTo(0, s * 0.8);
      g.stroke();
      return;
    case 'arcs':
      g.arc(0, s * 0.3, s * 0.7, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
  }
}

/** Rings, runes and spokes: the outer, turning part. White on transparent. */
export function drawOuter(g: G, N: number, d: CircleDesign): void {
  const C = N / 2;
  g.clearRect(0, 0, N, N);
  g.strokeStyle = g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = N / 50;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const u = N / 512;
  switch (d.rings) {
    case 0: ring(g, C, N * 0.47, 7 * u); ring(g, C, N * 0.4, 4 * u); break;
    case 1: ring(g, C, N * 0.47, 4 * u); ring(g, C, N * 0.445, 2 * u); ring(g, C, N * 0.4, 4 * u); break;
    case 2: ring(g, C, N * 0.47, 9 * u); ring(g, C, N * 0.405, 3 * u, [14 * u, 10 * u]); break;
    default:
      ring(g, C, N * 0.47, 5 * u); ring(g, C, N * 0.4, 5 * u);
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        g.beginPath();
        g.arc(C + Math.cos(a) * N * 0.385, C + Math.sin(a) * N * 0.385, 2.2 * u, 0, Math.PI * 2);
        g.fill();
      }
  }
  g.lineWidth = 4 * u;
  for (let i = 0; i < d.runeCount; i++) {
    const a = (i / d.runeCount) * Math.PI * 2;
    g.save();
    g.translate(C + Math.cos(a) * N * 0.435, C + Math.sin(a) * N * 0.435);
    g.rotate(a + Math.PI / 2);
    rune(g, d.runes, i, N * 0.022);
    g.restore();
  }
  if (d.spokes) {
    g.lineWidth = 3 * u;
    g.beginPath();
    for (let i = 0; i < d.spokes; i++) {
      const a = (i / d.spokes) * Math.PI * 2 + Math.PI / d.spokes;
      g.moveTo(C + Math.cos(a) * N * 0.33, C + Math.sin(a) * N * 0.33);
      g.lineTo(C + Math.cos(a) * N * 0.385, C + Math.sin(a) * N * 0.385);
    }
    g.stroke();
  }
}

/** The inner ring and the skill's picture: the inner part, turning its own way. */
export function drawInner(g: G, N: number, d: CircleDesign): void {
  const C = N / 2;
  g.clearRect(0, 0, N, N);
  g.strokeStyle = g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = N / 50;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const u = N / 512;
  ring(g, C, N * 0.32, 3 * u);
  g.lineWidth = 5 * u;
  motif(g, C, N * 0.28, u, d.motif);
}

function motif(g: G, C: number, R: number, u: number, m: Motif): void {
  const P = (x: number, y: number): [number, number] => [C + x * R, C + y * R];
  const path = (pts: [number, number][], close = false): void => {
    g.beginPath();
    pts.forEach(([x, y], i) => { const [px, py] = P(x, y); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    if (close) g.closePath();
    g.stroke();
  };
  const circle = (x: number, y: number, r: number, fill = false): void => {
    const [px, py] = P(x, y);
    g.beginPath();
    g.arc(px, py, r * R, 0, Math.PI * 2);
    if (fill) g.fill(); else g.stroke();
  };
  switch (m) {
    case 'star5': poly(g, C, R, 5, 2); break;
    case 'star6': poly(g, C, R, 3); poly(g, C, R, 3, 1, Math.PI / 2); break;
    case 'star7': poly(g, C, R, 7, 3); break;
    case 'star8': poly(g, C, R, 8, 3); break;
    case 'triangle': poly(g, C, R, 3); poly(g, C, R * 0.5, 3, 1, Math.PI / 2); break;
    case 'square': poly(g, C, R * 0.95, 4, 1, -Math.PI / 4); poly(g, C, R * 0.95, 4, 1, 0); break;
    case 'pentagon': poly(g, C, R, 5); poly(g, C, R * 0.55, 5, 1, Math.PI / 2); break;
    case 'hexagon': poly(g, C, R, 6); poly(g, C, R * 0.6, 6, 1, 0); break;
    case 'octagon': poly(g, C, R, 8); poly(g, C, R * 0.7, 4, 1, -Math.PI / 4); break;
    case 'snowflake':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        path([[0, 0], [c, s]]);
        for (const k of [0.5, 0.75]) {
          const bx = c * k, by = s * k;
          path([[bx + Math.cos(a + 0.7) * 0.22, by + Math.sin(a + 0.7) * 0.22], [bx, by], [bx + Math.cos(a - 0.7) * 0.22, by + Math.sin(a - 0.7) * 0.22]]);
        }
      }
      break;
    case 'flame': {
      g.beginPath();
      const [sx, sy] = P(0, 0.8);
      g.moveTo(sx, sy);
      g.bezierCurveTo(...P(-0.75, 0.6), ...P(-0.55, -0.2), ...P(-0.1, -0.9));
      g.bezierCurveTo(...P(0, -0.4), ...P(0.25, -0.5), ...P(0.3, -0.75));
      g.bezierCurveTo(...P(0.75, -0.2), ...P(0.75, 0.6), sx, sy);
      g.stroke();
      g.beginPath();
      g.moveTo(...P(0, 0.6));
      g.bezierCurveTo(...P(-0.35, 0.45), ...P(-0.25, 0), ...P(0, -0.3));
      g.bezierCurveTo(...P(0.3, 0.05), ...P(0.35, 0.45), ...P(0, 0.6));
      g.stroke();
      break;
    }
    case 'eye':
      g.beginPath();
      g.moveTo(...P(-0.95, 0));
      g.quadraticCurveTo(...P(0, -0.85), ...P(0.95, 0));
      g.quadraticCurveTo(...P(0, 0.85), ...P(-0.95, 0));
      g.stroke();
      circle(0, 0, 0.32);
      circle(0, 0, 0.12, true);
      break;
    case 'gear':
      circle(0, 0, 0.55);
      circle(0, 0, 0.2);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const w = 0.12;
        path([[Math.cos(a - w) * 0.55, Math.sin(a - w) * 0.55], [Math.cos(a - w * 0.6) * 0.85, Math.sin(a - w * 0.6) * 0.85],
          [Math.cos(a + w * 0.6) * 0.85, Math.sin(a + w * 0.6) * 0.85], [Math.cos(a + w) * 0.55, Math.sin(a + w) * 0.55]]);
      }
      break;
    case 'crosshair':
      circle(0, 0, 0.7);
      for (const [x, y] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) path([[x * 0.35, y * 0.35], [x, y]]);
      circle(0, 0, 0.08, true);
      break;
    case 'sword':
      path([[0, -1], [0.12, -0.75], [0.12, 0.45], [-0.12, 0.45], [-0.12, -0.75]], true);
      path([[-0.45, 0.45], [0.45, 0.45]]);
      path([[0, 0.45], [0, 0.85]]);
      circle(0, 0.92, 0.07, true);
      break;
    case 'swords':
      for (const s of [1, -1]) {
        const k = (x: number, y: number): [number, number] => [(x * 0.71 - y * 0.71 * s), (x * 0.71 * s + y * 0.71)];
        path([k(0, -1), k(0.1, -0.78), k(0.1, 0.45), k(-0.1, 0.45), k(-0.1, -0.78)], true);
        path([k(-0.35, 0.45), k(0.35, 0.45)]);
        path([k(0, 0.45), k(0, 0.8)]);
      }
      break;
    case 'shield':
      path([[0, -0.9], [0.75, -0.6], [0.65, 0.25], [0, 0.95], [-0.65, 0.25], [-0.75, -0.6]], true);
      path([[0, -0.6], [0.45, -0.4], [0.38, 0.15], [0, 0.6], [-0.38, 0.15], [-0.45, -0.4]], true);
      break;
    case 'bolt':
      path([[0.15, -1], [-0.4, 0.1], [0, 0.1], [-0.2, 1], [0.45, -0.2], [0.05, -0.2], [0.35, -1]], true);
      break;
    case 'moon':
      g.beginPath();
      g.arc(C, C, R * 0.85, Math.PI * 0.3, Math.PI * 1.7);
      g.arc(C + R * 0.35, C, R * 0.7, Math.PI * 1.62, Math.PI * 0.38, true);
      g.closePath();
      g.stroke();
      circle(0.45, -0.35, 0.06, true);
      circle(0.6, 0.15, 0.05, true);
      break;
    case 'sun':
      circle(0, 0, 0.42);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const l = i % 2 ? 0.8 : 1;
        path([[Math.cos(a) * 0.55, Math.sin(a) * 0.55], [Math.cos(a) * l, Math.sin(a) * l]]);
      }
      break;
    case 'spiral': {
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const a = t * Math.PI * 6;
        const [x, y] = P(Math.cos(a) * t * 0.95, Math.sin(a) * t * 0.95);
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
      break;
    }
    case 'drop':
      g.beginPath();
      g.moveTo(...P(0, -0.95));
      g.bezierCurveTo(...P(0.3, -0.45), ...P(0.65, 0), ...P(0.6, 0.35));
      g.arc(C, C + R * 0.35, R * 0.6, 0, Math.PI);
      g.bezierCurveTo(...P(-0.65, 0), ...P(-0.3, -0.45), ...P(0, -0.95));
      g.stroke();
      circle(-0.2, 0.3, 0.12, true);
      break;
    case 'hourglass':
      path([[-0.6, -0.9], [0.6, -0.9], [0, 0], [0.6, 0.9], [-0.6, 0.9], [0, 0]], true);
      path([[-0.7, -0.9], [0.7, -0.9]]);
      path([[-0.7, 0.9], [0.7, 0.9]]);
      break;
    case 'chevrons':
      for (const y of [-0.55, 0, 0.55]) path([[-0.7, y + 0.35], [0, y - 0.3], [0.7, y + 0.35]]);
      break;
    case 'target':
      circle(0, 0, 0.9); circle(0, 0, 0.6); circle(0, 0, 0.3); circle(0, 0, 0.08, true);
      break;
    case 'skull':
      g.beginPath();
      g.arc(C, C - R * 0.15, R * 0.6, Math.PI * 0.8, Math.PI * 2.2);
      g.lineTo(...P(0.35, 0.75));
      g.lineTo(...P(-0.35, 0.75));
      g.closePath();
      g.stroke();
      circle(-0.25, -0.1, 0.15, true);
      circle(0.25, -0.1, 0.15, true);
      path([[0, 0.15], [-0.08, 0.3], [0.08, 0.3]], true);
      for (const x of [-0.18, 0, 0.18]) path([[x, 0.5], [x, 0.75]]);
      break;
    case 'crown':
      path([[-0.8, 0.5], [-0.8, -0.45], [-0.4, 0], [0, -0.75], [0.4, 0], [0.8, -0.45], [0.8, 0.5]], true);
      path([[-0.8, 0.25], [0.8, 0.25]]);
      for (const [x, y] of [[-0.8, -0.45], [0, -0.75], [0.8, -0.45]]) circle(x, y - 0.1, 0.08, true);
      break;
    case 'diamond':
      path([[0, -1], [0.6, -0.25], [0, 1], [-0.6, -0.25]], true);
      path([[-0.6, -0.25], [0.6, -0.25]]);
      path([[0, -1], [-0.2, -0.25], [0, 1], [0.2, -0.25], [0, -1]]);
      break;
    case 'claw':
      for (const dx of [-0.45, 0, 0.45]) {
        g.beginPath();
        g.moveTo(...P(dx - 0.3, -0.85));
        g.quadraticCurveTo(...P(dx + 0.35, -0.1), ...P(dx - 0.1, 0.9));
        g.stroke();
      }
      break;
    case 'wave':
      for (const y of [-0.5, 0, 0.5]) {
        g.beginPath();
        for (let i = 0; i <= 40; i++) {
          const x = -0.9 + (i / 40) * 1.8;
          const [px, py] = P(x, y + Math.sin(x * 5) * 0.15);
          if (i) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.stroke();
      }
      break;
    case 'arrow':
      path([[0, -1], [0.45, -0.45], [0.15, -0.45], [0.15, 0.9], [-0.15, 0.9], [-0.15, -0.45], [-0.45, -0.45]], true);
      break;
    case 'atom':
      for (const r of [0, Math.PI / 3, -Math.PI / 3]) {
        g.save();
        g.translate(C, C);
        g.rotate(r);
        g.beginPath();
        g.ellipse(0, 0, R * 0.95, R * 0.32, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      circle(0, 0, 0.12, true);
      break;
    case 'lotus':
      for (let i = 0; i < 8; i++) {
        g.save();
        g.translate(C, C);
        g.rotate((i / 8) * Math.PI * 2);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(R * 0.35, -R * 0.5, 0, -R);
        g.quadraticCurveTo(-R * 0.35, -R * 0.5, 0, 0);
        g.stroke();
        g.restore();
      }
      break;
    case 'cross':
      path([[-0.25, -0.95], [0.25, -0.95], [0.25, -0.25], [0.95, -0.25], [0.95, 0.25], [0.25, 0.25], [0.25, 0.95],
        [-0.25, 0.95], [-0.25, 0.25], [-0.95, 0.25], [-0.95, -0.25], [-0.25, -0.25]], true);
      break;
    case 'propeller':
      circle(0, 0, 0.15);
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(C, C);
        g.rotate((i / 4) * Math.PI * 2);
        g.beginPath();
        g.ellipse(R * 0.55, 0, R * 0.4, R * 0.15, 0.3, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      break;
    case 'bullet':
      g.beginPath();
      g.moveTo(...P(-0.25, 0.8));
      g.lineTo(...P(-0.25, -0.3));
      g.quadraticCurveTo(...P(-0.25, -0.95), ...P(0, -0.95));
      g.quadraticCurveTo(...P(0.25, -0.95), ...P(0.25, -0.3));
      g.lineTo(...P(0.25, 0.8));
      g.closePath();
      g.stroke();
      path([[-0.32, 0.4], [0.32, 0.4]]);
      path([[-0.32, 0.8], [0.32, 0.8]]);
      break;
    case 'rocket':
      path([[0, -1], [0.25, -0.55], [0.25, 0.45], [-0.25, 0.45], [-0.25, -0.55]], true);
      path([[0.25, 0.1], [0.55, 0.6], [0.25, 0.45]]);
      path([[-0.25, 0.1], [-0.55, 0.6], [-0.25, 0.45]]);
      path([[-0.12, 0.6], [0, 0.95], [0.12, 0.6]]);
      circle(0, -0.3, 0.1);
      break;
    case 'meteor':
      circle(0.3, 0.3, 0.4);
      for (const k of [-0.25, 0, 0.25]) path([[0.0 + k, 0.0 - k], [-0.85 + k, -0.85 - k]]);
      break;
    case 'cloud':
      for (const [x, y, r] of [[-0.45, 0.15, 0.35], [0, -0.15, 0.45], [0.45, 0.15, 0.35], [0, 0.35, 0.3]] as const) circle(x, y, r);
      for (const x of [-0.4, 0, 0.4]) circle(x, 0.85, 0.06, true);
      break;
    case 'hand':
      path([[-0.45, 0.9], [-0.45, -0.1], [-0.6, -0.4], [-0.45, -0.5], [-0.25, -0.2], [-0.25, -0.85], [-0.08, -0.85],
        [-0.08, -0.3], [-0.08, -0.95], [0.1, -0.95], [0.1, -0.3], [0.1, -0.85], [0.28, -0.85], [0.28, -0.25],
        [0.28, -0.7], [0.45, -0.7], [0.45, 0.9]], true);
      circle(-0.02, 0.35, 0.15);
      break;
    case 'chain':
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(C + (i - 1.5) * R * 0.5, C + (i - 1.5) * R * 0.5);
        g.rotate(Math.PI / 4 + (i % 2 ? Math.PI / 2 : 0));
        g.beginPath();
        g.ellipse(0, 0, R * 0.32, R * 0.16, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      break;
  }
}
