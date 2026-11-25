// Item sets (owner 2026-11-19, docs/systems/items-and-forge.md "เซ็ตไอเทม"): every worn place counts (both rings),
// at most 9, steps 3/6/9 in the code; the /admin switch and steps are saved only when they differ from the code.
// The first part marks two floor-1 kinds as "pirate" itself; the floor-2 pieces (data/items.ts SET_ROWS) and the
// bonuses (owner 2026-11-24: steps add up, flat, all 13 stats, 0 in the code) are tested on the beach set below.
import fs from 'node:fs';
import { applyBalance, balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import '../src/shared/data/zones';
import { ITEM_ART, ITEM_BASES, itemSet, makeItem, rollItem } from '../src/shared/data/items';
import { CODE_SET_STEPS, SET_IDS, setBonusStats, setInfo, setPieces, type SetConfig } from '../src/shared/data/sets';
import { mulberry32 } from '../src/shared/rng';
import { Sim } from '../src/shared/sim/Sim';
import { BOSS_ROOMS, ZONE_1, ZONES } from '../src/shared/data/zones';
import { EQUIP_SLOTS, type EquipSlot, type Item } from '../src/shared/types';
import { finish, ok } from './check';

const mark = (id: string) => { (ITEM_BASES.find((b) => b.id === id) as { set?: string }).set = 'pirate'; };
mark('ring_copper');
mark('cap');

const ring = () => makeItem('ring_copper', 'common', 1, 'sword')!;
const cap = makeItem('cap', 'common', 1, 'sword')!;
const plain = makeItem('sandals', 'common', 1, 'sword')!;
ok(itemSet(cap) === 'pirate', 'set comes from the item kind');
ok(itemSet(plain) === null, 'other kinds are in no set');

const eq: Partial<Record<EquipSlot, Item>> = { helmet: cap, ring: ring(), ring2: ring(), boots: plain };
ok(setPieces(eq, 'pirate') === 3, 'both rings count: helmet + 2 rings = 3');
ok(setPieces(eq, 'beach') === 0, 'another set counts 0');
const full: Partial<Record<EquipSlot, Item>> = {};
for (const s of EQUIP_SLOTS) full[s] = s === 'ring' || s === 'ring2' ? ring() : cap;
ok(setPieces(full, 'pirate') === 9, 'ten worn places still count at most 9');

const code = mergeBalance({});
ok(JSON.stringify(code.sets.steps.pirate) === JSON.stringify(CODE_SET_STEPS), 'code steps 3/6/9');
const info = setInfo(cap, eq, code.sets);
ok(info?.name === 'ชุดโจรสลัด' && info.pieces === 3, 'set line: ชุดโจรสลัด (3/9)');
ok(setInfo(plain, eq, code.sets) === null, 'no set line on other items');
ok(setInfo(cap, eq, mergeBalance({ sets: { on: false } }).sets) === null, 'switched off: no set line');

ok(JSON.stringify(checkBalance({ sets: code.sets }, true).tuning) === '{}', 'code values are not saved');
ok(checkBalance({ sets: { on: false } }, true).tuning?.sets?.on === false, 'off is kept');
const t = checkBalance({ sets: { steps: { pirate: [2, 4, 9] } } }, true).tuning;
ok(JSON.stringify(t?.sets) === '{"steps":{"pirate":[2,4,9]}}', 'changed steps are kept');
ok('error' in checkBalance({ sets: { steps: { pirate: [4, 4, 9] } } }, true), 'steps must go up');
ok('error' in checkBalance({ sets: { steps: { pirate: [3, 6, 10] } } }, true), 'steps at most 9');
ok('error' in checkBalance({ sets: { steps: { nope: [3, 6, 9] } } }, true), 'unknown set refused');
ok(checkBalance({ sets: { steps: { pirate: [9, 1, 2] } } }, false).tuning?.sets === undefined, 'a bad saved value is dropped when loading');
const audit = balanceChanges({}, { sets: { on: false, steps: { beach: [2, 4, 9] } } });
ok(audit.includes('เซ็ตไอเทม เปิด → ปิด') && audit.includes('ชุดชาวหาด ขั้นโบนัส 3/6/9 → 2/4/9 ชิ้น'), 'the audit names it');

// ---------------------------------------------------------------- the floor-2 pieces
const PARTS = ['weapon', 'scabbard', 'orb', 'pouch', 'helmet', 'necklace', 'armor', 'gloves', 'belt', 'boots', 'ring'];
const LEVEL = { beach: 41, pirate: 51, ghost_sailor: 61, sea_king: 71 } as const;
for (const id of SET_IDS) {
  const kinds = ITEM_BASES.filter((b) => b.set === id && b.id.startsWith(`${id}_`));
  ok(kinds.length === 11 && PARTS.every((p) => kinds.some((b) => b.id === `${id}_${p}`)), `${id}: 11 kinds <set>_<part>`);
  ok(kinds.every((b) => b.minLevel === LEVEL[id]), `${id}: every piece from Lv${LEVEL[id]}`);
  const w = kinds.find((b) => b.slot === 'weapon')!;
  ok(!!(w.names.sword && w.names.mage && w.names.gunslinger) && kinds.filter((b) => b.slot !== 'weapon' && b.slot !== 'offhand').every((b) => b.names.any),
    `${id}: weapon named per class, the 7 shared pieces one name`);
  ok(['sword', 'mage', 'gunslinger'].every((c) => kinds.some((b) => b.slot === 'offhand' && b.names[c as 'sword'])), `${id}: an off-hand for each class`);
}
const art = ITEM_ART.filter((a) => SET_IDS.some((id) => a.startsWith(`item_${id}_`)));
ok(art.length === 4 * 14 - 4 && [...art, ...SET_IDS.map((id) => `set_${id}`)].every((a) => fs.existsSync(`public/assets/sprites/icons/${a}.png`)),
  'every set picture and badge is in public/assets/sprites/icons');
const beachW = ITEM_BASES.find((b) => b.id === 'beach_weapon')!;
ok(beachW.main.atk === 38 && ITEM_BASES.find((b) => b.id === 'sea_king_weapon')!.main.atk === 62, 'weapon ATK 38 … 62 (floor 1 +8 per map)');

// Drops: the beach drops only its set; outside a map band (the mystery box) only sets whose map is in the game.
const rr = mulberry32(7);
const beachDrops = new Set<string>();
for (let i = 0; i < 3000; i++) beachDrops.add(itemSet(rollItem(rr, 46, 'gunslinger', 0, [41, 50])) ?? 'none');
ok(beachDrops.size === 1 && beachDrops.has('beach'), 'the beach drops only the beach set');
let sea = 0;
let pirate = 0;
let ghost = 0;
for (let i = 0; i < 5000; i++) {
  const id = rollItem(rr, 80, 'mage').baseId;
  if (id.startsWith('ghost_sailor_')) ghost++;
  if (id.startsWith('sea_king_')) sea++;
  if (id.startsWith('pirate_')) pirate++;
}
ok(ghost > 0, 'ghost-sailor pieces can come now that the graveyard is in the game');
ok(sea > 0, 'sea-king pieces can come now that the maelstrom is in the game');
ok(pirate > 0, 'pirate pieces can come now that the cove is in the game');

// Real Sims: the beach's monsters and the crab in its room drop only beach pieces.
for (const zone of [ZONES.shipwreck_beach, BOSS_ROOMS.shipwreck_beach]) {
  const sim = new Sim(zone, { bossDelay: 0 });
  for (let i = 0; i < 600 && sim.monsters.length < 4; i++) sim.step(0.1);
  for (let k = 0; k < 60; k++) for (const m of sim.monsters) (sim as unknown as { dropLoot(m: unknown): void }).dropLoot(m);
  const items = sim.loots.flatMap((l) => (l.kind.type === 'item' ? [l.kind.item] : []));
  ok(sim.monsters.length > 0 && items.length > 0 && items.every((it) => itemSet(it) === 'beach'), `${zone.id}: ${items.length} drops, all beach pieces`);
}

// ---------------------------------------------------------------- set bonuses
const piece = (part: string) => makeItem(`beach_${part}`, 'common', 41, 'sword')!;
const wear = (n: number): Partial<Record<EquipSlot, Item>> => {
  const places: [EquipSlot, string][] = [['weapon', 'weapon'], ['offhand', 'scabbard'], ['helmet', 'helmet'], ['necklace', 'necklace'], ['armor', 'armor'],
    ['gloves', 'gloves'], ['belt', 'belt'], ['boots', 'boots'], ['ring', 'ring'], ['ring2', 'ring']];
  const eq: Partial<Record<EquipSlot, Item>> = {};
  for (const [place, part] of places.slice(0, n)) eq[place] = piece(part);
  return eq;
};
ok(setPieces(wear(10), 'beach') === 9 && setPieces(wear(9), 'beach') === 9, 'both beach rings count, at most 9');
const zero = mergeBalance({}).sets;
ok(JSON.stringify(setBonusStats(wear(10), zero)) === '{}', 'code: every bonus 0, nothing added');
const tuned = (t: object): SetConfig => mergeBalance({ sets: checkBalance({ sets: t }, true).tuning?.sets }).sets;
const bc = tuned({ bonus: { beach: [{ atk: 10 }, { atk: 20, maxHp: 300 }, { cdr: 5 }] } });
const at = (n: number, c = bc) => JSON.stringify(setBonusStats(wear(n), c));
ok(at(2) === '{}', '2 pieces: no bonus');
ok(at(3) === '{"atk":10}', '3 pieces: step 1');
ok(at(6) === '{"atk":30,"maxHp":300}', '6 pieces: step 1 + step 2 (they add up)');
ok(at(9) === '{"atk":30,"maxHp":300,"cdr":5}', '9 pieces: all three steps');
ok(at(9, tuned({ on: false, bonus: { beach: [{ atk: 10 }, {}, {}] } })) === '{}', 'sets switched off: no bonus');
ok(at(2, tuned({ steps: { beach: [2, 4, 9] }, bonus: { beach: [{ atk: 10 }, {}, {}] } })) === '{"atk":10}', 'steps changed in /admin move the thresholds');
const mixed = { ...wear(3), boots: makeItem('pirate_boots', 'common', 51, 'sword')!, belt: makeItem('pirate_belt', 'common', 51, 'sword')! };
const two = tuned({ bonus: { beach: [{ atk: 10 }, {}, {}], pirate: [{ def: 7 }, {}, {}] } });
ok(setPieces(mixed, 'beach') === 3 && setPieces(mixed, 'pirate') === 2 && JSON.stringify(setBonusStats(mixed, two)) === '{"atk":10}', 'sets count apart: 3 beach + 2 pirate = only the beach bonus');

// Saving: zeros are not kept, wrong values refused, the audit names it.
ok(JSON.stringify(checkBalance({ sets: { bonus: { beach: [{ atk: 0 }, {}, {}] } } }, true).tuning) === '{}', 'all-zero bonus is not saved');
ok(JSON.stringify(checkBalance({ sets: { bonus: { beach: [{}, { def: 4 }, {}] } } }, true).tuning?.sets) === '{"bonus":{"beach":[{},{"def":4},{}]}}', 'a bonus is kept per step');
ok('error' in checkBalance({ sets: { bonus: { beach: [{ atk: -1 }, {}, {}] } } }, true), 'negative refused');
ok('error' in checkBalance({ sets: { bonus: { beach: [{ luck: 5 }, {}, {}] } } }, true), 'unknown stat refused');
ok('error' in checkBalance({ sets: { bonus: { beach: [{ atk: 5 }] } } }, true), 'must have 3 steps');
const audit2 = balanceChanges({}, { sets: { bonus: { beach: [{}, { atk: 12 }, {}] } } });
ok(audit2.includes('ชุดชาวหาด โบนัสขั้น 2 พลังโจมตี 0 → 12'), 'the audit names a bonus change');
const tip = setInfo(piece('helmet'), wear(6), bc)!;
ok(tip.set === 'beach' && tip.pieces === 6 && tip.bonus[1].maxHp === 300, 'the tooltip gets the set, pieces and each step\'s bonus');

// In a real player: exactly the number set, after the class multipliers, and back off when taken off.
applyBalance({});
const sim = new Sim(ZONE_1);
const p = sim.addPlayer({ name: 'Setter', classId: 'mage', level: 45, exp: 0, gold: 0, equipment: wear(6), bag: [] });
p.recompute();
const before = p.stats.atk;
applyBalance({ sets: checkBalance({ sets: { bonus: { beach: [{ atk: 10 }, { atk: 5 }, {}] } } }, true).tuning?.sets });
p.recompute();
ok(Math.abs(p.stats.atk - before - 15) < 1e-9, 'a player with 6 pieces gets exactly +15 ATK (10 + 5)');
delete p.equipment.weapon;
delete p.equipment.offhand;
delete p.equipment.helmet;
p.recompute();
const three = p.stats.atk;
delete p.equipment.necklace;
p.recompute();
ok(three - p.stats.atk > 10 - 1e-9, 'fewer than 3 pieces: the bonus goes');
applyBalance({});

finish('item-sets');
