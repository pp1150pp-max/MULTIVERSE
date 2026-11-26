// The floor 2 bosses' sprite moves (src/client/paperMoves.ts): every Sim event they send finds its pictures on the sheet,
// in time with the Sim.
import { readFileSync } from 'node:fs';
import { moveSteps, stepColumn, type Step } from '../src/client/paperMoves';
import { ok, finish } from './check';

const meta = JSON.parse(readFileSync(new URL('../public/assets/sprites/paper/monsters/meta.json', import.meta.url), 'utf8')) as
  Record<string, { moves?: string[] }>;
const steps = (sheet: string, name: string, d: number): Step[] | null => moveSteps(sheet, meta[sheet]?.moves, name, d);
/** The picture `t` seconds into a move, as "move:frame" (null = over). */
const at = (sheet: string, name: string, d: number, t: number): string | null => {
  const col = stepColumn(steps(sheet, name, d)!, t);
  return col < 0 ? null : `${meta[sheet].moves![Math.floor(col / 4)]}:${col % 4}`;
};
const total = (s: Step[]) => s.reduce((a, b) => a + b.secs, 0);

for (const [sheet, names] of [
  ['giant_crab', ['attack', 'claw', 'claw_hold', 'claw_fling', 'cannon', 'shell']],
  ['peg_captain', ['attack', 'anchor', 'shout']],
  ['ghost_captain', ['attack', 'slash', 'bell', 'vanish']],
] as const) {
  for (const name of names) ok(steps(sheet, name, 1)?.every((s) => s.col >= 0 && s.secs >= 0), `${sheet} plays ${name}`);
}

// A plain hit: as before, the second move, struck as the wind-up ends.
ok(at('peg_captain', 'attack', 0.5, 0.4) === 'anchor:0' && at('peg_captain', 'attack', 0.5, 0.5) === 'anchor:1', 'a hit strikes as its wind-up ends');
ok(at('peg_captain', 'attack', 0.5, 0.84) === null, 'and is over after the last frame');

ok(at('giant_crab', 'cannon', 0.5, 0.1) === 'cannon:0' && at('giant_crab', 'cannon', 0.5, 0.5) === 'cannon:2', 'the cannon recoils as it fires');
ok(at('peg_captain', 'shout', 0.6, 0.6) === 'shout:2', 'the captain roars as the shout lands');
ok(at('ghost_captain', 'bell', 0.8, 0.8) === 'bell:2', 'the bell is shaken as the sailors rise');
ok(at('ghost_captain', 'vanish', 0.8, 0.7) === 'vanish:2', 'faded until he is back');
ok(at('ghost_captain', 'slash', 0.5, 0) === 'vanish:3' && at('ghost_captain', 'slash', 0.5, 0.3) === 'slash:0'
  && at('ghost_captain', 'slash', 0.5, 0.5) === 'slash:1', 'back from the warp: rises, raises the sabre, cuts');
ok(at('giant_crab', 'claw_hold', 0.8, 0.5) === 'claw:2' && at('giant_crab', 'claw_fling', 0.4, 0.1) === 'claw:3', 'holds high, then flings');

// The barrage: into the shell, cannon shots over and over, a peek at the end, exactly the Sim's time (any /admin length).
ok(at('giant_crab', 'shell', 4, 0.5) === 'shell:2' && at('giant_crab', 'shell', 4, 0.75) === 'cannon:0'
  && at('giant_crab', 'shell', 4, 1.55) === 'cannon:0' && at('giant_crab', 'shell', 4, 3.6) === 'shell:3', 'duck, volleys, peek');
for (const d of [0.5, 1.2, 4, 20]) {
  const s = steps('giant_crab', 'shell', d)!;
  ok(Math.abs(total(s) - d) < 1e-6 && s.every((x) => x.secs >= 0), `the hide lasts ${d}s`);
}

// Only these three sheets: the other floor 2 monsters' extra moves stay unplayed.
ok(steps('kraken', 'ink', 1) === null && steps('ghost_sailor', 'fade', 1) === null, 'other sheets only attack');
ok(moveSteps('giant_crab', undefined, 'cannon', 1) === null && steps('giant_crab', 'toString', 1) === null, 'no names, no move');

finish('paper-moves');
