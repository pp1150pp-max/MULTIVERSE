// Minigame "รอดมอนเป็นระลอก" (owner 2026-11-21): its settings in the balance tuning, a map's settings, and a run in the Sim
// (countdown, waves growing and getting stronger, gold per wave, the win bonus, no loot, getting up by the door).
import { balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { cleanCustomDef, emptyMap, zoneFromCustom } from '../src/shared/customZones';
import { MONSTERS } from '../src/shared/data/monsters';
import { Sim } from '../src/shared/sim/Sim';
import { codeWaves, waveCount, waveStats } from '../src/shared/waveGame';
import { validateMap } from '../src/shared/mapSchema';
import { finish, ok } from './check';

// ---------------------------------------------------------- settings
const code = codeWaves();
ok(code.on && code.waves === 10 && code.base === 5 && code.grow === 2 && code.statUp === 10 && code.countdown === 10 && code.rest === 5
  && code.goldPerWave === 100 && code.bonusGold === 2000 && code.dailyLimit === 0, 'code values = what the owner agreed');
ok(JSON.stringify(mergeBalance({}).waves) === JSON.stringify(code), 'nothing saved: the code values');
ok(JSON.stringify(checkBalance({ waves: { waves: 10, on: true } }, true).tuning) === '{}', 'code values are not stored');
ok(checkBalance({ waves: { waves: 3 } }, true).tuning?.waves?.waves === 3, 'a changed value is stored');
ok('error' in checkBalance({ waves: { waves: 0 } }, true) && 'error' in checkBalance({ waves: { nope: 1 } }, true) && 'error' in checkBalance({ waves: { on: 1 } }, true), 'out of range / unknown / not a switch: refused');
ok(balanceChanges({}, { waves: { on: false, bonusGold: 5 } }).includes('มินิเกมรอดมอนเป็นระลอก เปิด → ปิด'), 'the audit names the change');
ok(waveCount(code, 1) === 5 && waveCount(code, 10) === 23 && Math.abs(waveStats(code, 3) - 1.2) < 1e-9, 'wave 1 = 5, +2 each, +10% each');

// ---------------------------------------------------------- a map's settings
const base = { nameTh: 'ทดสอบ', name: '', floor: 1, levels: [1, 10], safe: false, channels: true, autoPlay: true };
const slime = 'green_slime';
ok('error' in cleanCustomDef({ ...base, minigame: 'chess' }, 'c_x'), 'an unknown minigame is refused');
const boss = Object.values(MONSTERS).find((m) => m.behavior === 'boss')!.id;
ok('error' in cleanCustomDef({ ...base, minigame: 'waves', waveMonsters: [boss] }, 'c_x'), 'a boss cannot be a wave monster');
const c = cleanCustomDef({ ...base, minigame: 'waves', waveMonsters: [slime, slime] }, 'c_x');
ok('def' in c && c.def.minigame === 'waves' && c.def.waveMonsters?.join() === slime, 'waves with its monsters (duplicates dropped)');
const map = emptyMap('c_x', 1, 'forest', 40);
map.waveSpots = [{ x: 10, z: 0, radius: 3 }, { x: -10, z: 0, radius: 3 }];
ok(validateMap(map, { propKeys: [] }).filter((i) => i.severity === 'error').length === 0, 'wave spots pass the check');
ok(validateMap({ ...map, waveSpots: [{ x: 999, z: 0, radius: 3 }] }, { propKeys: [] }).some((i) => i.kind === 'wave' && i.code === 'out_of_bounds'), 'a wave spot off the map is an error');
const zone = zoneFromCustom((c as { def: never }).def, map);
ok(zone.waves?.spots.length === 2 && zone.allowAutoPlay === false && !zone.channels, 'a minigame map: wave spots, no Auto, no channels');

// ---------------------------------------------------------- a run
const cfg = { ...code, waves: 2, base: 2, grow: 1, countdown: 1, rest: 1, goldPerWave: 10, bonusGold: 50, bonusExp: 5 };
const exit = { field: 'nexus_city', x: 3, z: 4 };
const sim = new Sim(zone, { waves: cfg, exit });
const p = sim.addPlayer({ name: 'W', classId: 'sword', level: 1, exp: 0, gold: 0, equipment: {}, bag: [] });
p.stats.maxHp = p.hp = 1e9;
const TICK = 1 / 30;
const run = (sec: number) => { for (let t = 0; t < sec; t += TICK) sim.step(TICK); };
ok(sim.monsters.length === 0 && sim.waveRun?.wave === 0, 'counting down: no monsters yet');
run(1.2);
const w1 = sim.monsters.filter((m) => m.alive);
ok(sim.waveRun?.wave === 1 && w1.length === 2 && w1.every((m) => zone.waves!.spots.some((s) => Math.hypot(m.x - s.x, m.z - s.z) <= s.radius + 0.01)), 'wave 1: 2 monsters on the wave spots');
const lootBefore = sim.loots.length;
for (const m of w1) (sim as unknown as { killMonster(m: unknown): void }).killMonster(m);
ok(sim.loots.length === lootBefore, 'wave monsters drop nothing');
run(0.2);
ok(p.gold === 10 && sim.waveRun?.nextAt !== null, 'wave 1 cleared: 10 G, a rest before the next');
run(1.2);
const w2 = sim.monsters.filter((m) => m.alive);
ok(sim.waveRun?.wave === 2 && w2.length === 3, 'wave 2: one more monster');
/** The wave boost a monster was made with: its raw HP over what its level alone gives (Monster: hp × (1 + 0.18 × levels up)). */
const boostOf = (m: unknown): number => { const x = m as { rawHp: number; level: number; def: { hp: number; levels: [number, number] } }; return x.rawHp / (x.def.hp * (1 + 0.18 * (x.level - x.def.levels[0]))); };
ok(w1.every((m) => Math.abs(boostOf(m) - 1) < 1e-6) && w2.every((m) => Math.abs(boostOf(m) - 1.1) < 1e-6), 'and 10% stronger');
for (const m of w2) (sim as unknown as { killMonster(m: unknown): void }).killMonster(m);
run(0.2);
ok(sim.waveRun?.won === true && p.gold === 10 + 20 + 50, `the last wave: 20 G + the 50 G bonus (${p.gold})`);
run(3);
ok(sim.monsters.filter((m) => m.alive).length === 0, 'nothing comes after the win');

// Getting up in a run: by the door, and phoenix revives are allowed.
const sim2 = new Sim(zone, { waves: cfg, exit });
const q = sim2.addPlayer({ name: 'V', classId: 'sword', level: 1, exp: 0, gold: 0, equipment: {}, bag: [] });
ok(sim2.revivesLeft(q) === 3, 'three feather revives in a run');
q.alive = false;
const evs = (sim2 as unknown as { events: { t: string }[] }).events;
evs.length = 0;
sim2.respawn(q);
const tr = evs.find((e) => e.t === 'travel') as { zone: string; spot?: { x: number; z: number } } | undefined;
ok(tr?.zone === 'nexus_city' && tr.spot?.x === 3 && tr.spot?.z === 4, 'getting up takes you out by the door');
ok(sim2.leaveRoom(q) === null, 'the leave button works at any time');

finish('wave-game');
