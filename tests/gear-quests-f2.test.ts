// Floor 2's gear quests (owner 2026-11-26): the navigator of the dimensions in the harbour gives them, from
// Lv41/51/61/71, weapon → armour → jewellery per map, 40 monsters each, blue set pieces of the map in all nine
// places. The /admin card "เควสอุปกรณ์" (BalanceTuning.gear): per floor a switch and the kills, per map the rarity.
// Real Sims, no server.
import { ok, finish } from './check';
import { ZONES, ZONE_HARBOR, ZONE_HUB, floorOf } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { itemSet } from '../src/shared/data/items';
import { GEAR_SLOTS, gearKills, gearMaps, gearRarity, gearReward, gearRows } from '../src/shared/gearQuests';
import { codeGear, GEAR_KILLS_MAX } from '../src/shared/gearTuning';
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import type { Item } from '../src/shared/types';
import type { Monster } from '../src/shared/sim/Monster';

const hero = (name: string, level: number, cls: 'sword' | 'mage' | 'gunslinger' = 'sword') => ({ ...newCharacterData(name, cls), level });
const priv = (s: Sim) => s as unknown as { killMonster(m: Monster): void };
const offers = (p: Player) => gearRows(p).filter((r) => r.state === 'offer').map((r) => r.id);

// ---- the maps
const f2 = gearMaps().filter((m) => floorOf(m) === 2);
ok(f2.map((m) => m.levels[0]).join() === '41,51,61,71', `four floor-2 maps, from Lv.41/51/61/71 (${f2.map((m) => m.levels[0]).join()})`);
const [beach, cove, grave, maelstrom] = f2;
ok(f2.every((m) => gearKills(m) === 40), 'floor 2 asks for 40');
ok(f2.every((m) => gearRarity(m) === 'rare'), 'floor 2 gives blue on every map');
ok(gearRarity(ZONES.emerald_forest) === 'uncommon' && gearRarity(gearMaps()[3]) === 'rare', 'floor 1 unchanged (green, blue)');

// ---- the navigator gives them, The Seeker doesn't
const harbor = new Sim(ZONE_HARBOR);
const hub = new Sim(ZONE_HUB);
const nav = harbor.terrain.npcPos.seeker!;
const at = (p: Player, s: { x: number; z: number }) => {
  p.x = s.x + 1;
  p.z = s.z + 1;
};
const low = harbor.addPlayer(hero('Low', 40));
at(low, nav);
ok(!offers(low).some((id) => id.startsWith(`${beach.id}:`)) && !harbor.gearAccept(low, `${beach.id}:weapon`), 'Lv.40: not yet');
const p = harbor.addPlayer(hero('Sailor', 45));
at(p, nav);
ok(offers(p).filter((id) => floorOf(ZONES[id.split(':')[0]]) === 2).join() === `${beach.id}:weapon`, `Lv.45: the beach weapon (${offers(p).join()})`);
{
  const h = hub.addPlayer(hero('Seeker', 45));
  at(h, hub.terrain.npcPos.seeker!);
  ok(!hub.gearAccept(h, `${beach.id}:weapon`), 'The Seeker does not give floor 2 gear quests');
}
ok(!harbor.gearAccept(p, 'emerald_forest:weapon'), 'the navigator does not give floor 1 ones');
ok(harbor.gearAccept(p, `${beach.id}:weapon`) && p.gearQuests[`${beach.id}:weapon`] === 0, 'taken from the navigator');

// ---- 40 kills on the beach
{
  const field = new Sim(beach);
  const q = field.addPlayer(p.toData());
  const mobs = field.monsters.filter((m) => !m.isBoss);
  ok(mobs.length > 0, 'the beach has monsters');
  for (let i = 0; i < 45; i++) {
    const x = mobs[i % mobs.length];
    x.alive = true;
    x.damageBy.set(q.id, 1);
    priv(field).killMonster(x);
  }
  ok(q.gearQuests[`${beach.id}:weapon`] === 40, `stops at 40 (${q.gearQuests[`${beach.id}:weapon`]})`);
  p.gearQuests = q.gearQuests;
}

// ---- handing in: blue beach set pieces
{
  p.bag = p.bag.map(() => null);
  ok(harbor.gearTurnIn(p, `${beach.id}:weapon`), 'handed in to the navigator');
  const got = p.bag.filter((e): e is Item => !!e && 'uid' in e);
  ok(got.map((it) => it.slot).sort().join() === 'offhand,weapon', `weapon + off-hand (${got.map((it) => it.slot).join()})`);
  ok(got.every((it) => it.rarity === 'rare' && itemSet(it) === 'beach' && it.level === 45), 'blue beach set pieces at the player level');
  ok(got.every((it) => p.canEquip(it)), 'wearable at once');
  ok(offers(p).includes(`${beach.id}:armor`), 'the armour quest opens next');
}
const sets = { [beach.id]: 'beach', [cove.id]: 'pirate', [grave.id]: 'ghost_sailor', [maelstrom.id]: 'sea_king' } as const;
for (const map of f2) {
  for (const cls of ['sword', 'mage', 'gunslinger'] as const) {
    const all = (['weapon', 'armor', 'jewel'] as const).flatMap((part) => {
      const items = gearReward(map, part, cls, map.levels[0]);
      ok(items.length === GEAR_SLOTS[part].length, `${map.id} ${part} for ${cls}: every piece (${items.length}/${GEAR_SLOTS[part].length})`);
      return items;
    });
    ok(all.length === 10 && all.every((it) => itemSet(it) === sets[map.id] && it.rarity === 'rare'), `${map.id} for ${cls}: the map's set, all nine places`);
  }
}

// ---- /admin
{
  ok(checkBalance({ gear: { floors: { 2: { kills: 40, on: true } }, rarity: { [beach.id]: 'rare' } } }, true).tuning?.gear === undefined, 'code values are not saved');
  ok(!!checkBalance({ gear: { floors: { 2: { kills: 0 } } } }, true).error, 'kills 0 refused');
  ok(!!checkBalance({ gear: { floors: { 2: { kills: GEAR_KILLS_MAX + 1 } } } }, true).error, 'kills above the max refused');
  ok(!!checkBalance({ gear: { rarity: { [beach.id]: 'gold' } } }, true).error, 'an unknown rarity refused');
  ok(!!checkBalance({ gear: { floors: { 9: { kills: 5 } } } }, true).error, 'an unknown floor refused');
  ok(!!checkBalance({ gear: { what: 1 } }, true).error, 'an unknown key refused');
  const t = checkBalance({ gear: { floors: { 2: { kills: 30 } }, rarity: { [cove.id]: 'epic' } } }, true).tuning!;
  ok(JSON.stringify(t.gear) === JSON.stringify({ floors: { 2: { kills: 30 } }, rarity: { [cove.id]: 'epic' } }), 'only what differs is kept');
  ok(balanceChanges({}, t).includes('เควสอุปกรณ์ชั้น 2 ล่า 40 → 30'), 'audit line');
  applyBalance(t);
  ok(gearKills(beach) === 30 && gearKills(ZONES.emerald_forest) === 20 && gearRarity(cove) === 'epic', 'takes effect at once, floor 1 untouched');
  const r = harbor.addPlayer(hero('Over', 45));
  r.gearQuests[`${beach.id}:weapon`] = 35;
  ok(gearRows(r).find((x) => x.id === `${beach.id}:weapon`)?.state === 'ready', 'lowering the count: 35 of 30 is ready');
  applyBalance(checkBalance({ gear: { floors: { 2: { on: false } } } }, true).tuning!);
  ok(!gearRows(r).some((x) => floorOf(x.map) === 2) && gearRows(r).some((x) => floorOf(x.map) === 1), 'switched off: floor 2 gone, floor 1 still there');
  at(r, nav);
  ok(!harbor.gearTurnIn(r, `${beach.id}:weapon`), 'switched off: not handed in');
  const back = harbor.addPlayer(JSON.parse(JSON.stringify(r.toData())));
  ok(back.gearQuests[`${beach.id}:weapon`] === 35, 'switched off: saved progress kept');
  applyBalance(t);
  at(back, nav);
  ok(harbor.gearTurnIn(back, `${beach.id}:weapon`), 'switched on again: hand it in');
  applyBalance({});
  ok(JSON.stringify(mergeBalance({}).gear) === JSON.stringify(codeGear()), 'reset = code');
}

finish('floor 2 gear quests');
