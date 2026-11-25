// Floor 2, map 4: Kraken Maelstrom (docs/plans/FLOOR2_PLAN.md 2, 5.4, 6, owner 2026-11-24). The map and its pier, the whirlpool nobody
// can walk into, the boss room with its own whirlpool, the Kraken Eye key and the navigator's key quest, the Lv80 gate, the four new
// monster moves (dive, bubble, wave, tentacle), the Kraken's moves (arms then head, ink, suction) and their /admin numbers.
// On real Sims, no server.
import { finish, ok } from './check';
import { BOSS_ROOMS, ROOM_WHIRLPOOL, ZONES, ZONE_HARBOR, ZONE_HUB, floorOf, hubOf, whirlpoolAt } from '../src/shared/data/zones';
import { HARBOR_ID } from '../src/shared/data/harbor';
import { MONSTERS } from '../src/shared/data/monsters';
import { BOSS_KEY, BOSS_QUEST_KEY, STONE_DESC, STONE_NAME } from '../src/shared/data/stones';
import { blockingGate } from '../src/shared/data/bossGates';
import { itemSet } from '../src/shared/data/items';
import { applyBalance, checkBalance, mergeBalance } from '../src/shared/balance';
import { codeMoves } from '../src/shared/moveTuning';
import { MapRegistry } from '../src/shared/mapRegistry';
import { validateMap } from '../src/shared/mapSchema';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import type { Player } from '../src/shared/sim/Player';
import { mv } from '../src/shared/sim/beachMoves';
import { suctionSpeed } from '../src/shared/sim/kraken';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';

const TICK = 1 / 30;
const SEA = ZONES.kraken_maelstrom;
const ROOM = BOSS_ROOMS.kraken_maelstrom;
const hero = (extra: Record<string, unknown> = {}) => ({ name: 'H', classId: 'sword' as const, level: 78, exp: 0, gold: 0, equipment: {}, bag: [], ...extra });
const run = (sim: Sim, secs: number, intent: (p: Player) => Intent = () => IDLE_INTENT) => {
  for (let n = 0; n < Math.round(secs / TICK); n++) sim.step(TICK, intent);
};
function tough(sim: Sim, x: number, z: number, extra: Record<string, unknown> = {}): Player {
  const p = sim.addPlayer(hero(extra));
  p.stats.maxHp = 1e9;
  p.hp = 1e9;
  p.stats.def = 0;
  p.stats.hpRegen = 0;
  p.stats.crit = 0;
  p.x = x;
  p.z = z;
  return p;
}
/** A sim of the maelstrom with only one monster of `kind` left, at (x, z) (its home spot moved there too). */
function alone(kind: string, x = 40, z = 40): { sim: Sim; m: Monster } {
  const sim = new Sim(SEA);
  const m = sim.monsters.find((q) => q.def.id === kind)!;
  sim.monsters = [m];
  m.x = m.area.x = x;
  m.z = m.area.z = z;
  return { sim, m };
}
function chase(m: Monster, p: Player): void {
  m.target = p;
  m.state = 'chase';
  m.aggroT = 30;
}
const walkTo = (x: number, z: number) => (p: Player): Intent => {
  const dx = x - p.x;
  const dz = z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  return { ...IDLE_INTENT, move: { x: dx / d, z: dz / d } };
};

// ---- the map, its pier, its whirlpool and its room
{
  ok(!!SEA && floorOf(SEA) === 2 && hubOf(SEA).id === HARBOR_ID, 'kraken_maelstrom is on floor 2, its town is the harbour');
  ok(SEA.levels[0] === 71 && SEA.levels[1] === 80 && SEA.theme === 'kraken', 'Lv71–80, kraken theme');
  ok(SEA.portals.length === 1 && SEA.portals[0].to === HARBOR_ID, 'one portal, back to the harbour');
  ok(SEA.start.x < 0 && SEA.start.z < 0, 'reached from the bottom pier: the camp is at the top (like Frost Reach)');
  ok(SEA.lair?.boss === 'kraken' && ROOM?.boss?.monster === 'kraken' && floorOf(ROOM) === 2, 'its summoner opens the kraken\'s room, on floor 2');
  const w = SEA.whirlpools?.[0];
  ok(!!w && w.x === 0 && w.z === 0 && w.r * 2 >= SEA.half * 0.8, `a whirlpool in the middle, about half the map across (r ${w?.r})`);
  ok(ROOM.whirlpools?.[0]?.r === ROOM_WHIRLPOOL, 'the boss room has its own whirlpool in the middle (owner 2026-11-24)');
  for (const id of ['kraken_maelstrom', 'kraken_maelstrom_room']) {
    const map = MapRegistry.get(id)!;
    const issues = validateMap(map, { propKeys: new Set(map.props.map((p) => p.key)), baseline: MapRegistry.bundled(id) }).filter((i) => i.severity === 'error');
    ok(!!map && issues.length === 0, `${id}.json passes validateMap (${issues.map((i) => i.message).join('; ')})`);
    // A room file may hold no water (validateMap): the room's whirlpool is in code (bossRoom), like its boss and arena.
    ok(map.water.some((x) => x.kind === 'whirlpool') === !id.endsWith('_room'), `${id}.json: whirlpool ${id.endsWith('_room') ? 'in code' : 'in the file'}`);
  }
  const kinds = [...new Set(SEA.spawns.map((s) => s.monster))];
  ok(kinds.join() === 'shark_knight,seahorse_soldier,ghost_pirate_king,kraken_tentacle', `four kinds (${kinds.join()})`);
  const away = (k: string) => {
    const s = SEA.spawns.filter((q) => q.monster === k);
    return s.reduce((n, q) => n + Math.hypot(q.x - SEA.start.x, q.z - SEA.start.z), 0) / s.length;
  };
  const far = ['shark_knight', 'seahorse_soldier', 'ghost_pirate_king'].map(away);
  ok(far.every((d, i) => i === 0 || d > far[i - 1]), `the walking kinds get farther from the camp (${far.map(Math.round).join(' < ')})`);
  const rim = SEA.spawns.filter((s) => s.monster === 'kraken_tentacle');
  ok(rim.length === 10 && rim.every((s) => s.radius === 0 && Math.abs(Math.hypot(s.x - w!.x, s.z - w!.z) - w!.r) < 2), '10 tentacles round the whirlpool\'s rim');
  ok(SEA.spawns.filter((s) => s.monster !== 'kraken_tentacle').every((s) => Math.hypot(s.x, s.z) > w!.r + 5), 'the others are well off the rim');
  const sim = new Sim(SEA);
  ok(sim.monsters.every((m) => m.level >= 71 && m.level <= 79), 'its monsters are Lv71–79');
  ok(sim.monsters.filter((m) => m.def.id === 'kraken_tentacle').every((m) => m.level >= 77), 'the tentacles are Lv77–79');
  ok(sim.terrain.props.some((p) => p.key === 'summoner_kraken'), 'the kraken\'s summoner stands on the map');
  ok(['storm_rock_0', 'wreck_0', 'coral_0', 'kraken_flag', 'storm_lamp'].every((k) => sim.terrain.props.some((p) => p.key === k)), 'storm rocks, wrecks, coral, kraken flags and lamps');
  ok(sim.terrain.props.filter((p) => p.key.startsWith('rim_')).length > 30, 'foam waves round the whirlpool\'s rim');
  ok(sim.terrain.props.every((p) => p.key.startsWith('rim_') || Math.hypot(p.x, p.z) > w!.r + 1), 'nothing else stands in the whirlpool');
  const rs = new Sim(ROOM);
  ok(rs.terrain.props.some((p) => p.key === 'room_kraken_coral') && rs.terrain.props.every((p) => !/^room_kraken_(rune_stone|tree)$/.test(p.key)), 'the room uses the maelstrom\'s own kit');
  ok(!whirlpoolAt(ROOM, ROOM.start.x, ROOM.start.z, 2), 'players come into the room well clear of its whirlpool');

  const harbor = new Sim(ZONE_HARBOR);
  const p = harbor.addPlayer(hero({ unlocks: ['floor2'] }));
  const pier = ZONE_HARBOR.portals.find((pt) => pt.to === SEA.id)!;
  ok(pier.x > 0 && pier.z > 0, 'its pier is the bottom one (+x, +z)');
  p.x = pier.x - 6;
  p.z = pier.z;
  run(harbor, 0.1);
  p.x = pier.x;
  p.z = pier.z;
  harbor.drainEvents();
  run(harbor, 0.2);
  ok(harbor.drainEvents().some((e) => e.t === 'travel' && e.zone === SEA.id), 'the harbour pier takes you to the maelstrom');
  ok(ZONE_HARBOR.portals.every((pt) => !pt.soonName || !!ZONES[pt.to]), 'every harbour pier is open now (the last map is in)');
}

// ---- nobody walks into the whirlpool
{
  const sim = new Sim(SEA);
  sim.monsters = [];
  const p = tough(sim, 40, 0);
  run(sim, 8, walkTo(0, 0));
  const r = SEA.whirlpools![0].r;
  ok(Math.hypot(p.x, p.z) >= r + p.radius - 0.01, `walking at the middle stops at the rim (${Math.hypot(p.x, p.z).toFixed(2)} ≥ ${r})`);
  p.knockback(p.x + 1, p.z, 40);
  run(sim, 1);
  ok(Math.hypot(p.x, p.z) >= r + p.radius - 0.01, 'a knockback into it stops at the rim too');
  ok(sim.terrain.isBlocked(0, 0, 0) && sim.terrain.isBlocked(r - 1, 0, 0) && !sim.terrain.isBlocked(r + 3, 0, 0.4), 'its inside is blocked, its rim is not');
}

// ---- key, quest key, gate, set drops
{
  ok(BOSS_KEY.kraken === 'key_kraken' && STONE_NAME.key_kraken === 'ตาคราเคน', 'its key is the Kraken Eye');
  ok(BOSS_QUEST_KEY.kraken === 'qkey_kraken' && STONE_DESC.qkey_kraken.includes('นักเดินเรือ'), 'its quest key comes from the navigator');
  const before = ['cannon_crab', 'pegleg_captain', 'ghost_captain'];
  ok(!!blockingGate(80, before) && !blockingGate(80, [...before, 'kraken']), 'the Lv80 gate now blocks until the kraken is beaten');
  const harbor = new Sim(ZONE_HARBOR);
  const hub = new Sim(ZONE_HUB);
  ok(harbor.questOffers(harbor.addPlayer(hero({ level: 75 }))).includes('kraken'), 'the navigator offers the kraken key quest');
  ok(!hub.questOffers(hub.addPlayer(hero({ level: 75 }))).includes('kraken'), 'The Seeker does not');
  const sim = new Sim(SEA);
  for (let k = 0; k < 40; k++) for (const m of sim.monsters) (sim as unknown as { dropLoot(m: unknown): void }).dropLoot(m);
  const items = sim.loots.flatMap((l) => (l.kind.type === 'item' ? [l.kind.item] : []));
  ok(items.length > 0 && items.every((it) => itemSet(it) === 'sea_king'), `${items.length} drops, all sea-king pieces`);
  ok(sim.loots.every((l) => !whirlpoolAt(SEA, l.x, l.z)), 'no drop lands in the whirlpool');
}

// ---- tentacle: never moves, slams a line at whoever comes near
{
  const sim = new Sim(SEA);
  const m = sim.monsters.find((q) => q.def.id === 'kraken_tentacle')!;
  sim.monsters = [m];
  const x0 = m.x;
  const z0 = m.z;
  const out = Math.atan2(m.z, m.x);
  const p = tough(sim, m.x + Math.cos(out) * 4, m.z + Math.sin(out) * 4);
  let hurt = false;
  let warned = false;
  sim.drainEvents();
  for (let i = 0; i < 200 && !hurt; i++) {
    run(sim, TICK);
    if (sim.drainEvents().some((e) => e.t === 'fx' && e.name === 'lineTelegraph')) warned = true;
    if (p.hp < 1e9) hurt = true;
  }
  ok(warned && hurt, 'it marks a line and slams whoever stands on it');
  for (let i = 0; i < 20; i++) sim.hitMonster(p, m, 0.01, { kb: 20 });
  run(sim, 2);
  ok(m.x === x0 && m.z === z0, 'knockback, hits and time never move it');
  const far = tough(sim, m.x + Math.cos(out) * 20, m.z + Math.sin(out) * 20);
  p.alive = false;
  far.hp = 1e9;
  run(sim, 4);
  ok(far.hp === 1e9, 'out of its reach nothing happens');
  // Shot at from beyond its reach (a mage, a gunslinger): it doesn't heal while being hit.
  m.hp = m.maxHp * 0.5;
  let rose = false;
  for (let i = 0; i < 9 * 30; i++) {
    const before = m.hp;
    if (i % 15 === 0) sim.hitMonster(far, m, 0.0001);
    run(sim, TICK);
    if (m.hp > before + 1e-6) rose = true;
  }
  ok(!rose, 'hit from out of its reach, it never heals');
  run(sim, 8);
  ok(m.hp === m.maxHp, 'left alone a while, it heals back up');
}

// ---- shark knight: dives (can't be hit) and bursts up under its target
{
  const { sim, m } = alone('shark_knight');
  const p = tough(sim, 46, 40);
  chase(m, p);
  m.sea = { cd: 0, t: 0, kind: null, angle: 0, x: 0, z: 0 };
  let under = false;
  for (let i = 0; i < 60 && !under; i++) {
    run(sim, TICK);
    under = m.fade && m.untargetable;
  }
  ok(under, 'it dives under the ground and can\'t be hit');
  const hp0 = m.hp;
  sim.hitMonster(p, m, 100);
  ok(m.hp === hp0, 'hits pass over it');
  let up = false;
  for (let i = 0; i < 150 && !(up && p.hp < 1e9); i++) {
    run(sim, TICK);
    if (!m.fade) up = true;
  }
  ok(up && p.hp < 1e9 && Math.hypot(p.x - m.x, p.z - m.z) < 4, 'it bursts up under its target and hits');
}

// ---- seahorse soldier: its bubble traps whoever it hits
{
  const { sim, m } = alone('seahorse_soldier');
  const p = tough(sim, 46, 40);
  chase(m, p);
  let trapped = false;
  for (let i = 0; i < 300 && !trapped; i++) {
    run(sim, TICK);
    p.x = m.x + 6;
    p.z = m.z;
    trapped = p.stunT > 0;
  }
  ok(trapped && p.stunT <= mv('bubble.sec') + 1e-6, 'its bubble holds the player (a stun, so no dash)');
}

// ---- ghost pirate king: a wave of power along a line
{
  const { sim, m } = alone('ghost_pirate_king');
  const p = tough(sim, 47, 40);
  chase(m, p);
  m.sea = { cd: 0, t: 0, kind: null, angle: 0, x: 0, z: 0 };
  let wave = false;
  for (let i = 0; i < 60 && !wave; i++) {
    run(sim, TICK);
    wave = m.sea?.kind === 'wave';
  }
  ok(wave, 'it winds up a wave at a target 7 away');
  run(sim, mv('wave.warn') + 0.2);
  ok(p.hp < 1e9, 'the wave hits along the line');
}

// ---- the Kraken: arms first, then its head; ink; suction
{
  const sim = new Sim(ROOM, { bossDelay: 0 });
  run(sim, 0.2);
  const k = sim.monsters.find((m) => m.isBoss)!;
  const p = tough(sim, ROOM.start.x - 3, ROOM.start.z - 3);
  run(sim, 2.5);
  ok(k.x === 0 && k.z === 0 && k.untargetable, 'it lies under the whirlpool and can\'t be hit while its arms are up');
  const arms = sim.monsters.filter((m) => m.def.id === 'kraken_arm' && m.alive);
  ok(arms.length === mv('kraken.arms'), `${arms.length} arms rose round the rim`);
  ok(arms.every((a) => Math.abs(Math.hypot(a.x, a.z) - ROOM_WHIRLPOOL) < 2 && a.summoned), 'on the rim, as summons (no rewards)');
  ok(arms.every((a) => Math.abs(a.maxHp - Math.round(k.maxHp * mv('kraken.armHp'))) <= 1), 'each with a share of its HP (/admin)');
  const hp0 = k.hp;
  sim.hitMonster(p, k, 100);
  ok(k.hp === hp0, 'hits pass by while it is under');
  for (const a of arms) sim.hitMonster(p, a, 1e6);
  run(sim, 0.2);
  ok(!k.untargetable && k.kraken?.headUp === true, 'every arm cut: its head comes up');
  sim.hitMonster(p, k, 5);
  ok(k.hp < hp0, 'and it can be hit');
  ok(k.x === 0 && k.z === 0, 'it still has not moved');
  run(sim, mv('kraken.headSec') + 0.5);
  ok(k.untargetable && k.kraken?.headUp === false, 'it sinks again when its time is up');
  run(sim, 3);
  ok(sim.monsters.filter((m) => m.def.id === 'kraken_arm' && m.alive).length === mv('kraken.arms'), 'and its arms grow back');

  // ink and suction come round on their own
  let ink = false;
  let suck = false;
  let pulled = 0;
  const d0 = () => Math.hypot(p.x, p.z);
  for (let i = 0; i < 40 * 30 && !(ink && suck && pulled > 1); i++) {
    const before = d0();
    run(sim, TICK);
    if (sim.hazards.some((h) => h.k === 'ink')) ink = true;
    if (suctionSpeed(sim.hazards, sim.time) > 0) {
      suck = true;
      pulled += before - d0();
    }
    p.hp = 1e9;
  }
  ok(ink, 'it spits ink: an ink hazard on the player hit');
  ok(suck && pulled > 1, `the whirlpool pulls players towards it (${pulled.toFixed(2)})`);
  ok(d0() >= ROOM_WHIRLPOOL + p.radius - 0.01, 'and never into it');

  // dead: arms and hazards go with it
  k.kraken!['phase' as never] = 'head' as never;
  k.noHit = false;
  k.fade = false;
  sim.hitMonster(p, k, 1e9);
  run(sim, 0.2);
  ok(!k.alive && sim.cleared && sim.hazards.length === 0, 'dead: the room is cleared, no ink or suction left');
  ok(!sim.monsters.some((m) => m.summoned && m.alive), 'its arms sink with it');
}

// ---- the kraken's room drop (10 keys) lands round the rim, none in the whirlpool
{
  const sim = new Sim(ROOM, { bossDelay: 0, keys: 10 });
  run(sim, 0.2);
  const k = sim.monsters.find((m) => m.isBoss)!;
  const p = tough(sim, ROOM.start.x, ROOM.start.z);
  k.noHit = false;
  k.fade = false;
  sim.hitMonster(p, k, 1e12);
  const inside = sim.loots.filter((l) => whirlpoolAt(ROOM, l.x, l.z));
  ok(!k.alive && sim.loots.length > 40 && inside.length === 0, `${sim.loots.length} pieces dropped, ${inside.length} in the whirlpool`);
}

// ---- /admin numbers
{
  const code = codeMoves();
  ok(code['kraken.arms'] === 4 && code['kraken.headSec'] === 12 && code['kraken.inkSec'] === 3 && code['kraken.suckSec'] === 3, 'the kraken\'s numbers have their code values');
  ok(code['dive.mult'] === 1.8 && code['bubble.sec'] === 1.2 && code['wave.len'] === 10 && code['tentacle.len'] === 7 && code['tentacle.warn'] === 0.9, 'the maelstrom monsters\' too');
  const b = mergeBalance({});
  b.moves['kraken.hpMult'] = 2;
  b.moves['kraken.inkCd'] = 20;
  const c = checkBalance(b, true);
  ok('tuning' in c && c.tuning?.moves?.['kraken.inkCd'] === 20 && Object.keys(c.tuning?.moves ?? {}).length === 2, 'saved: only what differs');
  if ('tuning' in c && c.tuning) applyBalance(c.tuning);
  const sim = new Sim(ROOM);
  const k = sim.monsters.find((m) => m.isBoss)!;
  ok(Math.abs(k.maxHp / (MONSTERS.kraken.hp * 7 * 0.5) - 2) < 0.01, `the kraken's HP ×2 from /admin (${k.maxHp})`);
  applyBalance({});
}

finish('floor2-map4');
