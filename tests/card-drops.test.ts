// Card drops (card plan PR 5, owner 2026-11-25): a farm monster rolls its card per kill, a boss in its room per key
// (the Peg-Leg Captain also the parrot's), floor 2 only with floor2Drop on, straight into the top damage dealer's
// bag (full: a cardMail event), the drop scroll counts while dropBoost is on, legendary cards are announced.
import { cardAnnounced, rollCardDrops } from '../src/shared/cardDrops';
import { applyCardTuning } from '../src/shared/cardTuning';
import { BOSS_ROOMS, ZONES, type ZoneDef } from '../src/shared/data/zones';
import type { Monster } from '../src/shared/sim/Monster';
import type { Player } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import type { SimEvent } from '../src/shared/sim/types';
import { finish, ok } from './check';

const hero = { name: 'A', classId: 'sword' as const, level: 80, exp: 0, gold: 0, equipment: {}, bag: [] };
const TICK = 1 / 30;
const ALL = { dropMonster: 100, dropBoss: 100, dropBossExtra: 100 };

/** A Sim on `zone` with one player who did all the damage to the first monster `id`; kills it (loot only). */
function kill(zone: ZoneDef, id: string, keys = 1, setup?: (p: Player) => void) {
  const sim = new Sim(zone, { keys, bossDelay: 0 });
  const p = sim.addPlayer(hero);
  sim.step(TICK);
  const m = sim.monsters.find((x) => x.def.id === id) as Monster | undefined;
  if (!m) throw new Error(`no ${id} in ${zone.id}`);
  setup?.(p);
  m.damageBy.set(p.id, 100);
  sim.drainEvents();
  (sim as unknown as { dropLoot(m: Monster): void }).dropLoot(m);
  const events = sim.drainEvents() as SimEvent[];
  return { sim, p, m, events };
}
const zoneWith = (id: string) => Object.values(ZONES).find((z) => !z.roomOf && new Sim(z).monsters.some((m) => m.def.id === id))!;
const roomOf = (boss: string) => Object.values(BOSS_ROOMS).find((z) => new Sim(z, { bossDelay: 0 }).monsters.some((m) => m.isBoss && m.def.id === boss))!;

// ---------------------------------------------------------------- the pure roll
applyCardTuning({});
ok(rollCardDrops('forest_wolf', false, 1, 1, () => 0.00009).length === 1 && rollCardDrops('forest_wolf', false, 1, 1, () => 0.0001).length === 0, 'monster: 0.01% per kill in code');
ok(rollCardDrops('pegleg_captain', true, 5, 1, () => 0).length === 0, 'floor 2 does not drop while floor2Drop is 0 (code)');
applyCardTuning({ nums: { floor2Drop: 1 } });
const cap = rollCardDrops('pegleg_captain', true, 3, 1, () => 0);
ok(cap.filter((c) => c === 'card_pegleg_captain').length === 3 && cap.filter((c) => c === 'card_parrot').length === 3, 'captain: own card and the parrot\'s, each once per key');
ok(rollCardDrops('parrot', false, 1, 1, () => 0).length === 0, 'the parrot card never rolls for a "parrot" monster');
ok(rollCardDrops('forest_bear', true, 2, 1, () => 0.0009).length === 2 && rollCardDrops('forest_bear', true, 2, 1, () => 0.001).length === 0, 'boss: 0.1% per key');
ok(rollCardDrops('forest_wolf', false, 1, 2, () => 0.00019).length === 1, 'drop scroll x2 counts (dropBoost on in code)');
applyCardTuning({ nums: { dropBoost: 0 } });
ok(rollCardDrops('forest_wolf', false, 1, 2, () => 0.00019).length === 0, 'dropBoost 0: the scroll does not count');
applyCardTuning({});
ok(cardAnnounced('legendary') && !cardAnnounced('epic') && !cardAnnounced('rare'), 'announced: legendary only (code)');
applyCardTuning({ nums: { announceFrom: 0 } });
ok(!cardAnnounced('legendary'), 'announceFrom 0: nothing announced');
applyCardTuning({ nums: { announceFrom: 1 } });
ok(cardAnnounced('rare'), 'announceFrom 1: every card announced');

// ---------------------------------------------------------------- in the Sim
applyCardTuning({ nums: ALL });
{
  const z = zoneWith('forest_wolf');
  const { p, sim, events } = kill(z, 'forest_wolf');
  ok(p.stoneCount('card_forest_wolf') === 1, 'farm monster at 100%: the card is in the killer\'s bag');
  ok(!sim.loots.some((l) => l.kind.type === 'stone' && l.kind.stone.startsWith('card_')), 'no card on the floor');
  ok(!events.some((e) => e.t === 'announce'), 'a rare card is not announced');
}
{
  const z = zoneWith('shotgunner');
  ok(kill(z, 'shotgunner').p.stoneCount('card_shotgunner') === 0, 'floor 2 farm monster: nothing while floor2Drop is 0');
  applyCardTuning({ nums: { ...ALL, floor2Drop: 1 } });
  ok(kill(z, 'shotgunner').p.stoneCount('card_shotgunner') === 1, 'floor 2 farm monster: drops with floor2Drop 1');
}
{
  const room = roomOf('pegleg_captain');
  const { p, events } = kill(room, 'pegleg_captain', 2);
  ok(p.stoneCount('card_pegleg_captain') === 2 && p.stoneCount('card_parrot') === 2, 'Peg-Leg Captain with 2 keys: 2 captain + 2 parrot cards');
  ok(events.filter((e) => e.t === 'announce' && e.banner).length === 2, 'the 2 legendary captain cards are announced as banners (the epic parrots not)');
}
{
  // Full bag: the card goes by mail (the server handles cardMail).
  const z = zoneWith('forest_wolf');
  const { p, events } = kill(z, 'forest_wolf', 1, (pl) => {
    while (pl.addStones('enhance', 10)) { /* fill the use tab */ }
  });
  ok(p.stoneCount('card_forest_wolf') === 0 && events.some((e) => e.t === 'cardMail' && e.to === p.id && e.card === 'card_forest_wolf'), 'full bag: a cardMail event instead');
}
{
  // Nobody hit it: no card.
  const z = zoneWith('forest_wolf');
  const sim = new Sim(z);
  const p = sim.addPlayer(hero);
  sim.step(TICK);
  const m = sim.monsters.find((x) => x.def.id === 'forest_wolf')!;
  (sim as unknown as { dropLoot(m: Monster): void }).dropLoot(m);
  ok(p.stoneCount('card_forest_wolf') === 0, 'no damage dealer: no card');
}
applyCardTuning({});
finish('card-drops');
