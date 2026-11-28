// The sword's class passive ฟันทะลวง (Dash Slash, owner 2026-11-28, docs/systems/skills.md "พาสซีฟประจำอาชีพ"): the plain
// dash slashes every monster it passes once (80% ATK + 30% slow 1.5 s, bosses too), never through a wall, not in a safe
// area, not monsters that can't be hit, still one dash with its cooldown and invulnerability, and the /admin numbers.
// A real Sim, no server.
import { ok, finish } from './check';
import { applyBalance, balanceChanges, checkBalance, currentBalance } from '../src/shared/balance';
import { cleanSkillBook } from '../src/shared/skillBook';
import { ZONE_1 } from '../src/shared/data/zones';
import { MONSTERS } from '../src/shared/data/monsters';
import { Sim } from '../src/shared/sim/Sim';
import { Monster } from '../src/shared/sim/Monster';
import { DASH_DIST, newCharacterData, type Player } from '../src/shared/sim/Player';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';
import type { BoxCollider } from '../src/shared/sim/terrain';
import type { ClassId } from '../src/shared/types';
import type { ZoneDef } from '../src/shared/data/zones';

const TICK = 1 / 30;
let nextId = 9100;

/** A spot with nothing solid within 7 m, away from the town's safe area. */
function open(sim: Sim, r: number): { x: number; z: number } {
  const t = sim.terrain;
  for (let x = -60; x <= 60; x += 3) {
    for (let z = -60; z <= 60; z += 3) {
      let clear = true;
      for (let a = 0; a < 16 && clear; a++) {
        for (let d = 0; d <= 7 && clear; d += 0.5) {
          if (t.isBlocked(x + Math.cos((a / 16) * Math.PI * 2) * d, z + Math.sin((a / 16) * Math.PI * 2) * d, r)) clear = false;
        }
      }
      if (clear && !sim.inSafe({ x, z })) return { x, z };
    }
  }
  throw new Error('no open spot');
}

function field(cls: ClassId, zone: ZoneDef = ZONE_1, level = 40): { sim: Sim; p: Player } {
  const sim = new Sim(zone);
  sim.monsters.length = 0;
  const p = sim.addPlayer({ ...newCharacterData('Tester', cls), level });
  p.skillBook = cleanSkillBook(cls, {});
  p.stats.maxHp = p.hp = 1e9;
  p.stats.crit = 0;
  const spot = open(sim, p.radius);
  p.x = spot.x;
  p.z = spot.z;
  return { sim, p };
}

/** A monster at (dx, dz) from the player, with lots of HP and standing still. */
function mob(sim: Sim, p: Player, dx: number, dz: number, boss = false): Monster {
  // its home right here, so it never walks back home (and heals) during the test
  const area = { ...ZONE_1.spawns[0], x: p.x, z: p.z, radius: 30 };
  const m = new Monster(nextId++, boss ? MONSTERS.forest_bear : MONSTERS.forest_wolf, p.level, area, p.x + dx, p.z + dz);
  start.set(m, m.hp);
  sim.monsters.push(m);
  return m;
}

const step = (sim: Sim, it: Partial<Intent>) => sim.step(TICK, () => ({ ...IDLE_INTENT, aim: { x: 1e4, z: 0 }, ...it }));
const wait = (sim: Sim, sec: number) => { for (let i = 0; i < Math.round(sec / TICK); i++) step(sim, {}); };
const dash = (sim: Sim) => { step(sim, { dash: true }); wait(sim, 0.4); };
const start = new Map<Monster, number>();
const lost = (m: Monster) => start.get(m)! - m.hp;

try {
  applyBalance({});
  const cfg = () => currentBalance().skills.classPassive.slash;

  // ---------------------------------------------------------- hits all on the way, once each
  {
    const { sim, p } = field('sword');
    ok(p.slashOn(), 'a sword has Dash Slash at Lv 40');
    ok(!field('mage').p.slashOn() && !field('gunslinger').p.slashOn(), 'only the sword has Dash Slash');
    const on = [mob(sim, p, 1.2, 0.3), mob(sim, p, 2.6, -0.6), mob(sim, p, 4, 0.2)];
    const boss = mob(sim, p, 3.3, 0.9, true);
    const off = [mob(sim, p, 2.5, 3.5), mob(sim, p, -2, 0), mob(sim, p, DASH_DIST + 3, 0)];
    sim.drainEvents();
    const x0 = p.x;
    step(sim, { dash: true });
    ok(p.invulnT > 0, 'the dash is still invulnerable');
    wait(sim, 0.4);
    ok(p.x - x0 > DASH_DIST - 0.3 && p.x - x0 < DASH_DIST + 0.7, `still one plain dash of ${DASH_DIST} m (${(p.x - x0).toFixed(2)})`);
    const atk = p.stats.atk;
    for (const m of on) ok(lost(m) > 0, `monster on the path hit (${lost(m).toFixed(0)})`);
    // 80% ATK ±10%, through the monster's defense (formulas.ts mitigate)
    const want = (m: Monster) => (atk * 0.8 * 60) / (60 + m.defense);
    for (const m of on) ok(lost(m) >= want(m) * 0.9 - 1 && lost(m) <= want(m) * 1.1 + 1, `80% ATK ±10% after defense (${lost(m).toFixed(0)}, want ~${want(m).toFixed(0)})`);
    ok(lost(boss) > 0, 'the boss on the path is hit too');
    for (const m of [...on, boss]) ok(Math.abs(m.slowAmt - 0.3) < 1e-9 && m.slowT > 1, `slowed 30% (${m.slowAmt}, ${m.slowT.toFixed(2)} s left)`);
    for (const m of off) ok(lost(m) === 0, 'monster off the path not hit');
    const hits = [...on, boss].map(lost);
    const ev = sim.drainEvents();
    const fx = ev.filter((e) => e.t === 'fx' && e.name === 'dashSlash');
    ok(fx.length === 1, 'one dashSlash message per dash');
    const args = fx[0]?.t === 'fx' && fx[0].name === 'dashSlash' ? fx[0].args : null;
    ok(!!args && args[4] === p.id && args[5].length === 8, `it names the player and the 4 hit spots (${args?.[5].length})`);
    ok(ev.filter((e) => e.t === 'sfx' && e.name === 'dashslash').length === 1, 'one slash sound');
    // still more dashing in the same spot: never twice in one dash (each dash is its own)
    wait(sim, 0.1);
    ok([...on, boss].every((m, i) => lost(m) === hits[i]), 'nothing more after the dash ended');
    ok((p.cd.dash ?? 0) > 0, 'the dash cooldown runs as before');
    step(sim, { dash: true });
    ok(!p.isDashing, 'no second dash while on cooldown');
  }

  // ---------------------------------------------------------- a fast dash in big ticks still hits once
  {
    const { sim, p } = field('sword');
    const m = mob(sim, p, 2.4, 0);
    sim.step(0.05, () => ({ ...IDLE_INTENT, aim: { x: 1e4, z: 0 }, dash: true }));
    for (let i = 0; i < 6; i++) sim.step(0.05, () => ({ ...IDLE_INTENT, aim: { x: 1e4, z: 0 } }));
    const one = lost(m);
    ok(one > 0 && one < ((p.stats.atk * 0.8 * 60) / (60 + m.defense)) * 1.1 + 1, `hit once with 0.05 s ticks (${one.toFixed(0)})`);
  }

  // ---------------------------------------------------------- no hit through a wall
  {
    const { sim, p } = field('sword');
    // a thin wall across the path 1.5 m ahead, a monster right behind it
    (sim.terrain as unknown as { boxes: BoxCollider[] }).boxes.push({ x: p.x + 1.5, z: p.z, w: 0.3, d: 6, rot: 0 });
    const behind = mob(sim, p, 2.5, 0);
    const far = mob(sim, p, 4, 0);
    const x0 = p.x;
    dash(sim);
    ok(p.x < x0 + 1.5, `the wall stops the dash (${(p.x - x0).toFixed(2)} m)`);
    ok(lost(behind) === 0 && lost(far) === 0, 'monsters behind the wall not hit');
    // a monster just beside the path but behind a wall along it
    const s2 = field('sword');
    (s2.sim.terrain as unknown as { boxes: BoxCollider[] }).boxes.push({ x: s2.p.x + 2.5, z: s2.p.z + 0.9, w: 6, d: 0.2, rot: 0 });
    const side = mob(s2.sim, s2.p, 2.5, 1.5);
    dash(s2.sim);
    ok(lost(side) === 0, 'a monster on the far side of a wall beside the path not hit');
  }

  // ---------------------------------------------------------- not in a safe area, not untargetable monsters
  {
    const s0 = field('sword');
    const zone: ZoneDef = { ...ZONE_1, safe: { x: s0.p.x, z: s0.p.z, half: 20 } };
    const sim = new Sim(zone);
    sim.monsters.length = 0;
    const p = sim.addPlayer({ ...newCharacterData('Tester', 'sword'), level: 40 });
    p.x = s0.p.x;
    p.z = s0.p.z;
    ok(sim.inSafe(p), 'standing in the safe area');
    const m = mob(sim, p, 2, 0);
    dash(sim);
    ok(lost(m) === 0, 'no slash in a safe area');

    const t = field('sword');
    const hidden = mob(t.sim, t.p, 2, 0);
    hidden.noHit = true;
    const seen = mob(t.sim, t.p, 3, 0);
    dash(t.sim);
    ok(lost(hidden) === 0 && lost(seen) > 0, 'a monster that cannot be hit (dug in, invisible, a barrel) not hit');
  }

  // ---------------------------------------------------------- /admin: off, level, numbers
  {
    applyBalance({ skills: { classPassive: { slash: { on: false } } } });
    const { sim, p } = field('sword');
    ok(!p.slashOn(), 'switched off: no Dash Slash');
    const m = mob(sim, p, 2, 0);
    dash(sim);
    ok(lost(m) === 0, 'switched off: a plain dash');
    applyBalance({ skills: { classPassive: { slash: { level: 50 } } } });
    ok(!field('sword', ZONE_1, 40).p.slashOn() && field('sword', ZONE_1, 50).p.slashOn(), 'unlock level honoured');
    applyBalance({ skills: { classPassive: { slash: { dmg: 2, slow: 0.5, slowT: 3, width: 6 } } } });
    const f = field('sword');
    const wide = mob(f.sim, f.p, 2.5, 2.6);
    dash(f.sim);
    ok(lost(wide) > ((f.p.stats.atk * 2 * 60) / (60 + wide.defense)) * 0.9 - 1 && Math.abs(wide.slowAmt - 0.5) < 1e-9 && wide.slowT > 2.5, 'damage, slow, time and width follow /admin');
    applyBalance({});
    ok(cfg().dmg === 0.8 && cfg().slow === 0.3 && cfg().slowT === 1.5 && cfg().width === 2.4 && cfg().on && cfg().level === 1, 'code values');

    const good = checkBalance({ skills: { classPassive: { slash: { dmg: 1, slow: 0.3, width: 3 } } } }, true);
    ok(!('error' in good), 'a good tuning passes');
    if (!('error' in good)) {
      ok(JSON.stringify(good.tuning.skills?.classPassive) === JSON.stringify({ slash: { dmg: 1, width: 3 } }), `only what differs is kept (${JSON.stringify(good.tuning.skills?.classPassive)})`);
    }
    for (const bad of [{ slash: { dmg: -1 } }, { slash: { slow: 0.95 } }, { slash: { slowT: 99 } }, { slash: { width: 0 } }, { slash: { level: 1.5 } }, { slash: { x: 1 } }]) {
      ok('error' in checkBalance({ skills: { classPassive: bad } }, true), `refused: ${JSON.stringify(bad)}`);
    }
    const t = checkBalance({ skills: { classPassive: { slash: { dmg: 1.2, on: false } } } }, true);
    const lines = 'error' in t ? '' : balanceChanges({}, t.tuning);
    ok(/ฟันทะลวง.*0\.8 → 1\.2/.test(lines) && /ฟันทะลวง เปิด → ปิด/.test(lines), `audit lines (${lines})`);
  }
} catch (e) {
  ok(false, `threw: ${(e as Error).stack}`);
}
finish('class-slash');
