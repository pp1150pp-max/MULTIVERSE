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

// Sheets without their own moves here only attack.
ok(steps('kraken_tentacle_sea', 'grab', 1) === null && steps('ghost_sailor', 'dive', 1) === null, 'other sheets only attack');

// Floor 2 field monsters going under (graveMoves.ts phase, maelstromMoves.ts dive): their own pictures, held on the third.
for (const [sheet, name] of [['ghost_sailor', 'fade'], ['shark_knight', 'dive']] as const) {
  const s = steps(sheet, name, 0.4);
  ok(!!s && s.every((x) => meta[sheet].moves![Math.floor(x.col / 4)] === name), `${sheet}: ${name} plays its own pictures`);
  ok(at(sheet, name, 0.4, 0) === `${name}:0` && at(sheet, name, 0.4, 0.5) === `${name}:2` && at(sheet, name, 0.4, 0.6) === null,
    `${sheet}: ${name} goes under in the Sim's time`);
}

// The Kraken (owner 2026-11-28 pictures): every move it sends finds its own pictures; its arms coil and hold a grab.
for (const name of ['arm_slam', 'arm_cut', 'ink', 'dive']) {
  const s = steps('kraken', name, 0.6);
  ok(!!s && s.every((x) => meta.kraken.moves![Math.floor(x.col / 4)] === name), `kraken: ${name} plays its own pictures`);
}
const grab = steps('kraken_arm', 'grab', 4);
ok(!!grab && grab.every((x) => meta.kraken_arm.moves![Math.floor(x.col / 4)] === 'grab') && Math.abs(grab.reduce((a, x) => a + x.secs, 0) - 4.15) < 1e-6,
  'kraken_arm: a grab coils, then holds the coil for as long as it drags');
ok(steps('kraken_arm', 'attack', 0.9)!.every((x) => meta.kraken_arm.moves![Math.floor(x.col / 4)] === 'slam_tentacle'), 'kraken_arm: its slam is its second move');
ok(moveSteps('giant_crab', undefined, 'cannon', 1) === null && steps('giant_crab', 'toString', 1) === null, 'no names, no move');

finish('paper-moves');
