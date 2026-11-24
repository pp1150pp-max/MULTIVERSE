// Floor 2, map 3: Ghost Ship Graveyard (docs/plans/FLOOR2_PLAN.md 2, 5.3, 6, owner 2026-11-24). The map and its pier, the boss
// room, the Ghost Ship Bell key and the navigator's key quest, the Lv70 gate, the four new monster moves (curse, phase, song,
// split), the Ghost Captain's moves (fog, bell, warp) and their /admin numbers. On real Sims, no server.
import { finish, ok } from './check';
import { BOSS_ROOMS, ZONES, ZONE_HARBOR, ZONE_HUB, floorOf, hubOf } from '../src/shared/data/zones';
import { HARBOR_ID } from '../src/shared/data/harbor';
import { MONSTERS } from '../src/shared/data/monsters';
import { BOSS_KEY, BOSS_QUEST_KEY, STONE_DESC, STONE_NAME } from '../src/shared/data/stones';
import { blockingGate } from '../src/shared/data/bossGates';
import { itemSet } from '../src/shared/data/items';
import { applyBalance, checkBalance, mergeBalance } from '../src/shared/balance';
import { codeMoves } from '../src/shared/moveTuning';
import { Sim } from '../src/shared/sim/Sim';
import type { Monster } from '../src/shared/sim/Monster';
import type { Player } from '../src/shared/sim/Player';
import { mv } from '../src/shared/sim/beachMoves';
import { IDLE_INTENT, type Intent } from '../src/shared/sim/types';

const TICK = 1 / 30;
const GRAVE = ZONES.ghost_ship_graveyard;
const ROOM = BOSS_ROOMS.ghost_ship_graveyard;
const hero = (extra: Record<string, unknown> = {}) => ({ name: 'H', classId: 'sword' as const, level: 68, exp: 0, gold: 0, equipment: {}, bag: [], ...extra });
const run = (sim: Sim, secs: number, intent: (p: Player) => Intent = () => IDLE_INTENT) => {
  for (let n = 0; n < Math.round(secs / TICK); n++) sim.step(TICK, intent);
};
/** A sturdy player with no defense (damage easy to read), at (x, z). */
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
/** A sim of the graveyard with only one monster of `kind` left, standing at (x, z) (its home spot moved there too). */
function alone(kind: string, x = 0, z = 0): { sim: Sim; m: Monster } {
  const sim = new Sim(GRAVE);
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
/** The boss room with the captain fighting `p`. */
function room(px = 5): { sim: Sim; cap: Monster; p: Player } {
  const sim = new Sim(ROOM);
  const cap = sim.monsters.find((m) => m.isBoss)!;
  const p = tough(sim, cap.x + px, cap.z);
  chase(cap, p);
  return { sim, cap, p };
}

// ---- the map, its pier and its room
{
  ok(!!GRAVE && floorOf(GRAVE) === 2 && hubOf(GRAVE).id === HARBOR_ID, 'ghost_ship_graveyard is on floor 2, its town is the harbour');
  ok(GRAVE.levels[0] === 61 && GRAVE.levels[1] === 70 && GRAVE.theme === 'grave', 'Lv61–70, grave theme');
  ok(GRAVE.portals.length === 1 && GRAVE.portals[0].to === HARBOR_ID, 'one portal, back to the harbour');
  ok(GRAVE.start.x > 0 && GRAVE.start.z < 0, 'reached from the left pier: the camp is on the right (like Ashen Isle)');
  ok(GRAVE.lair?.boss === 'ghost_captain' && !!ROOM && ROOM.boss?.monster === 'ghost_captain' && floorOf(ROOM) === 2, 'its summoner opens the ghost captain\'s room, on floor 2');
  const kinds = [...new Set(GRAVE.spawns.map((s) => s.monster))];
  ok(kinds.join() === 'ghost_monkey,ghost_sailor,ghost_siren,barnacle_crew', `four kinds, camp to boss (${kinds.join()})`);
  const away = (k: string) => {
    const s = GRAVE.spawns.filter((q) => q.monster === k);
    return s.reduce((n, q) => n + Math.hypot(q.x - GRAVE.start.x, q.z - GRAVE.start.z), 0) / s.length;
  };
  const far = kinds.map(away);
  ok(far.every((d, i) => i === 0 || d > far[i - 1]), `each kind farther from the camp than the last (${far.map(Math.round).join(' < ')})`);
  const sim = new Sim(GRAVE);
  ok(sim.monsters.length >= GRAVE.spawns.length && sim.monsters.every((m) => m.level >= 61 && m.level <= 69), 'its monsters are Lv61–69');
  ok(sim.terrain.props.some((p) => p.key === 'summoner_ghost'), 'the ghost captain\'s summoner stands on the map');
  ok(['ghost_mast', 'bell_mast', 'wreck_small', 'candles', 'green_lantern'].every((k) => sim.terrain.props.some((p) => p.key === k)),
    'broken masts, the bell mast, wrecks, candles and ghost lanterns: a ghost-ship graveyard');
  const rs = new Sim(ROOM);
  ok(rs.terrain.props.some((p) => p.key === 'room_grave_figurehead') && rs.terrain.props.every((p) => !/^room_grave_(rune_stone|tree)$/.test(p.key)),
    'the room uses the graveyard\'s own kit pieces');
  // The harbour's left pier is open now, and the graveyard's portal leads back.
  const harbor = new Sim(ZONE_HARBOR);
  const p = harbor.addPlayer(hero({ unlocks: ['floor2'] }));
  const pier = ZONE_HARBOR.portals.find((pt) => pt.to === GRAVE.id)!;
  ok(pier.x < 0 && pier.z > 0, 'its pier is the left one (−x, +z)');
  p.x = pier.x + 6;
  p.z = pier.z;
  run(harbor, 0.1);
  p.x = pier.x;
  p.z = pier.z;
  harbor.drainEvents();
  run(harbor, 0.2);
  ok(harbor.drainEvents().some((e) => e.t === 'travel' && e.zone === GRAVE.id), 'the harbour pier takes you to the graveyard');
  const grave = new Sim(GRAVE);
  const q = grave.addPlayer(hero({ unlocks: ['floor2'] }));
  const back = GRAVE.portals[0];
  q.x = back.x - 6;
  q.z = back.z;
  run(grave, 0.1);
  q.x = back.x;
  q.z = back.z;
  grave.drainEvents();
  run(grave, 0.2);
  ok(grave.drainEvents().some((e) => e.t === 'travel' && e.zone === HARBOR_ID), 'the graveyard\'s portal takes you back to the harbour');
}

// ---- key, quest key, gate, set drops
{
  ok(BOSS_KEY.ghost_captain === 'key_ghost' && STONE_NAME.key_ghost === 'ระฆังเรือผี', 'its key is the Ghost Ship Bell');
  ok(BOSS_QUEST_KEY.ghost_captain === 'qkey_ghost' && STONE_DESC.qkey_ghost.includes('นักเดินเรือ'), 'its quest key comes from the navigator');
  ok(!!blockingGate(70, ['cannon_crab', 'pegleg_captain']) && !blockingGate(70, ['cannon_crab', 'pegleg_captain', 'ghost_captain']), 'the Lv70 gate now blocks until the ghost captain is beaten');
  const harbor = new Sim(ZONE_HARBOR);
  const hub = new Sim(ZONE_HUB);
  ok(harbor.questOffers(harbor.addPlayer(hero({ level: 65 }))).includes('ghost_captain'), 'the navigator offers the ghost captain key quest');
  ok(!hub.questOffers(hub.addPlayer(hero({ level: 65 }))).includes('ghost_captain'), 'The Seeker does not');
  for (const zone of [GRAVE, ROOM]) {
    const sim = new Sim(zone, { bossDelay: 0 });
    for (let i = 0; i < 600 && sim.monsters.length < 4; i++) sim.step(0.1);
    const real = sim.monsters.filter((m) => !m.summoned);
    for (let k = 0; k < 60; k++) for (const m of real) (sim as unknown as { dropLoot(m: unknown): void }).dropLoot(m);
    const items = sim.loots.flatMap((l) => (l.kind.type === 'item' ? [l.kind.item] : []));
    ok(items.length > 0 && items.every((it) => itemSet(it) === 'ghost_sailor'), `${zone.id}: ${items.length} drops, all ghost-sailor pieces`);
  }
}

// ---- ghost sailor monkey: its skull leaves a curse ring that slows
{
  const { sim, m } = alone('ghost_monkey');
  const p = tough(sim, 5, 0);
  chase(m, p);
  let ring = false;
  for (let i = 0; i < 300 && !ring; i++) {
    run(sim, 1 / 30);
    p.x = m.x + 5;
    p.z = m.z;
    ring = sim.hazards.some((h) => h.k === 'curse');
  }
  ok(ring, 'its thrown skull leaves a curse ring');
  const h = sim.hazards.find((x) => x.k === 'curse')!;
  ok(sim.hazards.length === 1 || sim.hazards.every((x) => x.k === 'curse'), 'only curse rings in the field');
  sim.monsters = [];
  p.x = h.x;
  p.z = h.z;
  run(sim, 0.1);
  ok(p.slowT > 0 && Math.abs(p.slowAmt - mv('curse.slow')) < 1e-9, `standing in it: slowed ${Math.round(p.slowAmt * 100)}%`);
  run(sim, mv('curse.sec') + 0.5);
  ok(!sim.hazards.some((x) => x.k === 'curse'), 'the ring goes when its time is up');
}

// ---- ghost sailor: fades out (can't be hit), comes back beside its target and strikes; walks through props
{
  const { sim, m } = alone('ghost_sailor');
  const p = tough(sim, 6, 0);
  chase(m, p);
  (m as unknown as { ghost: { cd: number } | null }).ghost = { cd: 0, t: 0, kind: null } as never;
  let faded = false;
  for (let i = 0; i < 60 && !faded; i++) {
    run(sim, 1 / 30);
    faded = m.fade;
  }
  ok(faded && m.untargetable, 'it fades out and can\'t be hit');
  const hp0 = m.hp;
  sim.hitMonster(p, m, 100);
  ok(m.hp === hp0, 'hits pass through it');
  let back = false;
  let hurt = false;
  for (let i = 0; i < 120 && !(back && hurt); i++) {
    run(sim, 1 / 30);
    if (!m.fade) back = true;
    if (p.hp < 1e9) hurt = true;
  }
  ok(back && Math.hypot(p.x - m.x, p.z - m.z) < 3, 'it comes back beside its target');
  ok(hurt, 'and strikes');
  // Through props: a prop right on its way doesn't stop it.
  const { sim: s2, m: g } = alone('ghost_sailor', 0, 0);
  const t = s2.terrain as unknown as { colliders: { x: number; z: number; r: number }[] };
  t.colliders.push({ x: 0, z: 0, r: 2 });
  s2.terrain.resolve(g, true);
  ok(Math.hypot(g.x, g.z) < 0.01, 'props don\'t push it (they still push others)');
  const other = { x: 0.1, z: 0, radius: 0.5 };
  s2.terrain.resolve(other);
  ok(Math.hypot(other.x, other.z) > 2, 'other monsters are still pushed out of props');
}

// ---- ghost siren: the song makes players walk to her; a dash breaks it
{
  const { sim, m } = alone('ghost_siren');
  const p = tough(sim, 4, 0);
  chase(m, p);
  for (let i = 0; i < 300 && p.charmT <= 0; i++) {
    run(sim, 1 / 30);
    // Out of her melee reach, inside her song.
    p.x = m.x + 4;
    p.z = m.z;
  }
  ok(p.charmT > 0 && p.charmBy === m, 'her song charms the player');
  const d0 = Math.hypot(p.x - m.x, p.z - m.z);
  // Walking away: the song still pulls them toward her.
  run(sim, 0.4, (q) => (q === p ? { ...IDLE_INTENT, move: { x: 1, z: 0 } } : IDLE_INTENT));
  ok(Math.hypot(p.x - m.x, p.z - m.z) < d0 - 0.3, 'charmed, they walk to her whatever they press');
  // A dash breaks it.
  p.cd.dash = 0;
  run(sim, TICK, (q) => (q === p ? { ...IDLE_INTENT, dash: true, move: { x: 1, z: 0 } } : IDLE_INTENT));
  run(sim, 0.1);
  ok(p.charmT === 0 && p.charmBy === null, 'a dash breaks the song');
}

// ---- barnacle ghost crew: breaks into small ones, which give nothing
{
  const { sim, m } = alone('barnacle_crew');
  const p = tough(sim, 3, 0);
  const exp0 = p.exp + p.level * 1e9;
  m.hp = 1;
  sim.hitMonster(p, m, 5);
  const exp1 = p.exp + p.level * 1e9;
  ok(!m.alive && exp1 > exp0, 'killed: its EXP is given');
  const small = sim.monsters.filter((q) => q.alive && q.def.id === 'barnacle_small');
  ok(small.length === mv('split.count') && small.every((s) => s.summoned && s.level === m.level), `it breaks into ${small.length} small barnacle ghosts of its level`);
  for (const s of small) {
    s.hp = 1;
    sim.hitMonster(p, s, 5);
  }
  ok(small.every((s) => !s.alive) && p.exp + p.level * 1e9 === exp1, 'the small ones give no EXP');
  ok(!sim.monsters.some((q) => q.alive && q.def.id === 'barnacle_small'), 'and don\'t split again');
}

// ---- the Ghost Captain
{
  ok(MONSTERS.ghost_captain.brain === 'ghost_captain' && MONSTERS.ghost_captain.levels[0] === 70, 'the ghost captain is the Lv70 boss with his own moves');
}
{
  // The bell: ghost sailors rise, never more alive than the card says.
  const { sim, cap } = room(5);
  let crew = 0;
  for (let i = 0; i < 1200; i++) {
    run(sim, 0.05);
    cap.hp = cap.maxHp;
    crew = Math.max(crew, sim.monsters.filter((m) => m.alive && m.summoned && m.def.id === 'ghost_sailor').length);
  }
  ok(crew > 0 && crew <= mv('ghost.bellMax'), `his bell calls ghost sailors (${crew}, at most ${mv('ghost.bellMax')})`);
}
{
  // The fog: a 'fog' hazard over the arena with the card's sight, then it lifts.
  const { sim, cap } = room(5);
  let fog = false;
  for (let i = 0; i < 600 && !fog; i++) {
    run(sim, 0.05);
    fog = sim.hazards.some((h) => h.k === 'fog');
  }
  const h = sim.hazards.find((x) => x.k === 'fog');
  ok(fog && h?.k === 'fog' && h.r === mv('ghost.fogSight'), `ghost fog: each player sees ${mv('ghost.fogSight')} around them`);
  run(sim, mv('ghost.fogSec') + 1.5);
  ok(!sim.hazards.some((x) => x.k === 'fog') && cap.ghostCaptain!.fogging === false, 'and it lifts');
}
{
  // The warp: gone (can't be hit), back behind the target, a slash around him.
  const { sim, cap, p } = room(6);
  p.faceX = 1;
  p.faceZ = 0;
  let hidden = false;
  for (let i = 0; i < 300 && !hidden; i++) {
    run(sim, 1 / 30);
    p.x = cap.x + 6;
    p.z = cap.z;
    hidden = cap.fade && cap.untargetable;
  }
  ok(hidden, 'he fades out and can\'t be hit');
  p.faceX = 1;
  p.faceZ = 0;
  for (let i = 0; i < 60 && cap.fade; i++) run(sim, 1 / 30);
  ok(!cap.fade && cap.x < p.x && Math.hypot(p.x - cap.x, p.z - cap.z) < 3, 'he comes back behind his target');
  const before = p.hp;
  run(sim, mv('ghost.warpWindup') + 0.3);
  ok(p.hp < before, 'and slashes');
}
{
  // Dead: the fog lifts, his crew fades with him, the room is cleared.
  const { sim, cap, p } = room(5);
  for (let i = 0; i < 600 && !sim.monsters.some((m) => m.summoned && m.alive); i++) {
    run(sim, 0.05);
    cap.hp = cap.maxHp;
  }
  cap.hp = 1;
  cap.noHit = false;
  cap.fade = false;
  sim.hitMonster(p, cap, 5);
  ok(!cap.alive && sim.cleared && sim.hazards.length === 0, 'dead: the room is cleared and the fog is gone');
  ok(!sim.monsters.some((m) => m.summoned && m.alive), 'his crew fades with him');
}

// ---- /admin numbers
{
  const code = codeMoves();
  ok(code['ghost.bellCd'] === 16 && code['ghost.warpMult'] === 2.2 && code['song.sec'] === 1.5 && code['split.count'] === 2, 'every graveyard move number has its code value');
  const b = mergeBalance({});
  b.moves['ghost.hpMult'] = 2;
  b.moves['ghost.fogCd'] = 30;
  const c = checkBalance(b, true);
  ok('tuning' in c && c.tuning?.moves?.['ghost.fogCd'] === 30 && Object.keys(c.tuning?.moves ?? {}).length === 2, 'saved: only what differs');
  if ('tuning' in c && c.tuning) applyBalance(c.tuning);
  const sim = new Sim(ROOM);
  const cap = sim.monsters.find((m) => m.isBoss)!;
  ok(Math.abs(cap.maxHp / (MONSTERS.ghost_captain.hp * 7 * 0.5) - 2) < 0.01, `the ghost captain's HP ×2 from /admin (${cap.maxHp})`);
  applyBalance({});
}

finish('floor2-map3');
