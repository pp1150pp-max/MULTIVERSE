// The Seeker's gear quests: from each farm map's first level, weapon → armour → jewellery in a row. Each
// asks for 20 monsters of that map and gives that part's gear for the player's class, at their level kept
// inside the map's range, green on maps 1–2 and blue on 3–4; a full bag keeps the quest open. Real Sims, no server.
import { ok, finish } from './check';
import { ZONES, ZONE_1, ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { itemClass } from '../src/shared/data/items';
import { GEAR_KILLS, GEAR_SLOTS, gearMaps, gearReward, gearRows } from '../src/shared/gearQuests';
import { questRows, seekerMark } from '../src/shared/quests';
import type { Item } from '../src/shared/types';
import type { Monster } from '../src/shared/sim/Monster';

const hero = (name: string, level: number, cls: 'sword' | 'mage' | 'gunslinger' = 'sword') => ({ ...newCharacterData(name, cls), level });
const priv = (s: Sim) => s as unknown as { killMonster(m: Monster): void };

const hub = new Sim(ZONE_HUB);
const seeker = hub.terrain.npcPos.seeker!;
const atSeeker = (p: Player) => {
  p.x = seeker.x + 1;
  p.z = seeker.z + 1;
};
const offers = (p: Player) => gearRows(p).filter((r) => r.state === 'offer').map((r) => r.id);

// ---- the maps and what each offers
ok(gearMaps().map((m) => m.levels[0]).join() === '1,11,21,31', 'four farm maps, from Lv.1/11/21/31');
const fresh = hub.addPlayer(hero('Fresh', 1));
ok(offers(fresh).join() === 'emerald_forest:weapon', `Lv.1: only the forest weapon (${offers(fresh).join()})`);
ok(seekerMark([...questRows(fresh), ...gearRows(fresh)]) === '!', 'the ! over The Seeker');
const high = hub.addPlayer(hero('High', 35));
ok(offers(high).length === 4 && offers(high).every((id) => id.endsWith(':weapon')), `Lv.35: every map's weapon quest, the old ones too (${offers(high).join()})`);

// ---- taking one
const p = hub.addPlayer(hero('Quester', 5));
p.x = seeker.x + 20;
ok(!hub.gearAccept(p, 'emerald_forest:weapon'), 'only beside The Seeker');
atSeeker(p);
ok(!hub.gearAccept(p, 'emerald_forest:armor'), 'armour waits for the weapon');
ok(!hub.gearAccept(p, 'misty_marsh:weapon'), 'a map above the level is locked');
ok(!hub.gearAccept(p, 'nowhere:weapon'), 'an unknown id is refused');
ok(hub.gearAccept(p, 'emerald_forest:weapon') && p.gearQuests['emerald_forest:weapon'] === 0, 'taken');
ok(!hub.gearAccept(p, 'emerald_forest:weapon'), 'not taken twice');
ok(!hub.gearTurnIn(p, 'emerald_forest:weapon'), 'nothing to hand in yet');

// ---- killing: the map's monsters count, others don't, stops at GEAR_KILLS
{
  const field = new Sim(ZONE_1);
  const q = field.addPlayer(p.toData());
  ok(q.gearQuests['emerald_forest:weapon'] === 0, 'the quest survives a save');
  const mobs = field.monsters.filter((m) => !m.isBoss);
  const snowMob = hub.monsters.find((x) => ZONES.frost_reach.spawns.some((s) => s.monster === x.def.id))!;
  snowMob.damageBy.set(p.id, 3);
  priv(hub).killMonster(snowMob);
  ok(p.gearQuests['emerald_forest:weapon'] === 0, "another map's monster does not count");
  for (let i = 0; i < GEAR_KILLS + 5; i++) {
    const x = mobs[i % mobs.length];
    x.alive = true;
    x.damageBy.set(q.id, 1);
    priv(field).killMonster(x);
  }
  ok(q.gearQuests['emerald_forest:weapon'] === GEAR_KILLS, `stops at ${GEAR_KILLS}`);
  p.gearQuests = q.gearQuests;
}
ok(seekerMark([...questRows(p), ...gearRows(p)]) === '?', 'the ? over The Seeker');

// ---- handing in
{
  p.bag = p.bag.map((_, i) => (i === 0 ? null : { stone: 'enhance' as const, count: 10 }));
  ok(!hub.gearTurnIn(p, 'emerald_forest:weapon') && p.gearQuests['emerald_forest:weapon'] === GEAR_KILLS, 'one free slot is not enough for two pieces');
  p.bag = p.bag.map(() => null);
  ok(hub.gearTurnIn(p, 'emerald_forest:weapon'), 'handed in');
  const got = p.bag.filter((e): e is Item => !!e && 'uid' in e);
  ok(got.map((it) => it.slot).sort().join() === 'offhand,weapon', `weapon + off-hand (${got.map((it) => it.slot).join()})`);
  ok(got.every((it) => it.rarity === 'uncommon' && it.level === 5), 'green, at the player level');
  ok(got.every((it) => itemClass(it) === null || itemClass(it) === 'sword'), 'made for the class');
  ok(got.every((it) => p.canEquip(it)), 'wearable at once');
  ok(p.gearDone.includes('emerald_forest:weapon') && p.gearQuests['emerald_forest:weapon'] === undefined, 'marked done');
  ok(offers(p).join() === 'emerald_forest:armor', 'the armour quest opens next');
  const data = JSON.parse(JSON.stringify(p.toData()));
  ok(hub.addPlayer(data).gearDone.includes('emerald_forest:weapon'), 'done survives a save');
}

// ---- what each part and map gives
{
  const [forest, marsh, snow, volcano] = gearMaps();
  for (const part of ['weapon', 'armor', 'jewel'] as const) {
    for (const cls of ['sword', 'mage', 'gunslinger'] as const) {
      const items = gearReward(snow, part, cls, 25);
      ok(items.length === GEAR_SLOTS[part].length, `${part} for ${cls}: every piece (${items.length})`);
    }
  }
  ok(gearReward(marsh, 'armor', 'mage', 15).every((it) => it.rarity === 'uncommon'), 'map 2: green');
  ok(gearReward(snow, 'jewel', 'mage', 25).every((it) => it.rarity === 'rare'), 'map 3: blue');
  ok(gearReward(volcano, 'weapon', 'gunslinger', 31).every((it) => it.rarity === 'rare'), 'map 4: blue');
  const late = gearReward(forest, 'weapon', 'mage', 35);
  ok(late.every((it) => it.level === 10), 'a Lv.35 player gets the forest gear at the forest top level');
  const w = gearReward(forest, 'weapon', 'sword', 7).find((it) => it.slot === 'weapon')!;
  ok(w.baseId === 'weapon_2', `the best forest weapon the level reaches (${w.baseId})`);
  ok(gearReward(volcano, 'weapon', 'mage', 40).find((it) => it.slot === 'weapon')!.baseId === 'weapon_9', 'volcano Lv.40: its top weapon');
}

// ---- old saves
{
  const old = hub.addPlayer({ ...hero('Old', 12), gearQuests: undefined, gearDone: undefined });
  ok(Object.keys(old.gearQuests).length === 0 && old.gearDone.length === 0, 'a save without the fields loads empty');
  const junk = hub.addPlayer({ ...hero('Junk', 12), gearQuests: { 'x:y': 3, 'emerald_forest:armor': 999 } as Record<string, number>, gearDone: ['bad', 'emerald_forest:weapon'] });
  ok(junk.gearQuests['emerald_forest:armor'] === GEAR_KILLS && !('x:y' in junk.gearQuests), 'unknown ids dropped, counts clamped');
  ok(junk.gearDone.join() === 'emerald_forest:weapon', 'unknown done ids dropped');
}

finish('gear quests');
