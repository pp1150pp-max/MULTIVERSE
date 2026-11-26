// Which pictures a paper monster sheet shows for a Sim 'anim' event, and for how long (SpriteActor plays them). A sheet has
// 4 columns per move, in the order of its meta.json `moves` (walk first); sheets without names have walk and attack only.
// No three / DOM here: tests/paper-moves.test.ts runs it.

/** One picture of a move: its sheet column and how long it shows. */
export interface Step { col: number; secs: number }

/** Columns per move. */
const FRAMES = 4;
/** A strike's frames after its wind-up: each shown this long. */
const STRIKE_SECS = 0.11;
/** The crab ducking into its shell (normal, pulling in, hidden), and peeking out before the barrage ends. */
const DUCK = [0.15, 0.15, 0.4];
const PEEK_SECS = 0.5;
/** One cannon shot of the barrage loop: crouch, brace, recoil, settle. */
const VOLLEY = [0.25, 0.15, 0.2, 0.2];
/** Held a little past the Sim's time, so a late event does not flash the walk frame in between. */
const TAIL = 0.15;

type Pic = (move: string, frame: number, secs: number) => Step;
type Timeline = (pic: Pic, duration: number) => Step[];

/** The first picture while it winds up, then the other three quickly, the strike as the wind-up ends. */
const strike = (move: string): Timeline => (pic, d) => [pic(move, 0, d), ...[1, 2, 3].map((f) => pic(move, f, STRIKE_SECS))];

/** Two pictures over the wind-up, then the third as the Sim acts, and the fourth. */
const release = (move: string, act: number, after: number): Timeline => (pic, d) =>
  [pic(move, 0, d / 2), pic(move, 1, d / 2), pic(move, 2, act), pic(move, 3, after)];

/** The crab's low-HP hide: into the shell, cannon shots over and over while the barrage falls, a peek out at the end. */
const shellBarrage: Timeline = (pic, d) => {
  // A hide too short for it all (/admin) shortens the duck and the peek alike.
  const k = Math.min(1, d / (DUCK[0] + DUCK[1] + DUCK[2] + PEEK_SECS));
  const steps = DUCK.map((s, f) => pic('shell', f, s * k));
  const peek = PEEK_SECS * k;
  let left = d - peek - (DUCK[0] + DUCK[1] + DUCK[2]) * k;
  for (let i = 0; left > 1e-6; i++) {
    const secs = Math.min(VOLLEY[i % FRAMES], left);
    steps.push(pic('cannon', i % FRAMES, secs));
    left -= secs;
  }
  steps.push(pic('shell', 3, peek));
  return steps;
};

/**
 * The floor 2 bosses' own moves, by paper sheet name then Sim event name (sim/cannonCrab.ts, peglegCaptain.ts,
 * ghostCaptain.ts). Other sheets only play 'attack', their second move.
 */
const BOSS_MOVES: Record<string, Record<string, Timeline>> = {
  giant_crab: {
    // Wind-up, then the claw shuts; a grab is followed by claw_hold (lifted high) and claw_fling (thrown aside).
    claw: strike('claw'),
    claw_hold: (pic, d) => [pic('claw', 1, Math.min(STRIKE_SECS, d)), pic('claw', 2, Math.max(0, d - STRIKE_SECS) + TAIL)],
    claw_fling: (pic, d) => [pic('claw', 3, d)],
    cannon: release('cannon', 0.2, 0.2),
    shell: shellBarrage,
  },
  peg_captain: {
    anchor: strike('anchor'),
    shout: release('shout', 0.35, 0.2),
  },
  ghost_captain: {
    // The slash only follows a warp: he rises behind his target (vanish's last picture), then raises the sabre.
    slash: (pic, d) => {
      const rise = Math.min(0.2, d * 0.4);
      return [pic('vanish', 3, rise), pic('slash', 0, d - rise), ...[1, 2, 3].map((f) => pic('slash', f, STRIKE_SECS))];
    },
    bell: release('bell', 0.35, 0.2),
    // Fading away over the time he is gone; the slash event takes over when he is back.
    vanish: (pic, d) => {
      const each = Math.min(0.2, d / 3);
      return [pic('vanish', 0, each), pic('vanish', 1, each), pic('vanish', 2, d - 2 * each + TAIL)];
    },
  },
};

/**
 * The pictures for event `name` on `sheet` lasting `duration` seconds (a wind-up, a hold), or null when the sheet does not
 * play it. `moves` = the sheet's meta.json names, absent on sheets that only have walk and attack.
 */
export function moveSteps(sheet: string, moves: readonly string[] | undefined, name: string, duration: number): Step[] | null {
  const d = Math.max(0, duration);
  if (name === 'attack') return strike('')((_, f, secs) => ({ col: FRAMES + f, secs }), d);
  const own = BOSS_MOVES[sheet];
  if (!moves || !own || !Object.hasOwn(own, name)) return null;
  let missing = false;
  const steps = own[name]((move, f, secs) => {
    const i = moves.indexOf(move);
    if (i < 0) missing = true;
    return { col: i * FRAMES + f, secs };
  }, d);
  return missing ? null : steps;
}

/** The column to show `t` seconds in, or -1 once the steps are over. */
export function stepColumn(steps: readonly Step[], t: number): number {
  let end = 0;
  for (const s of steps) {
    end += s.secs;
    if (t < end) return s.col;
  }
  return -1;
}
