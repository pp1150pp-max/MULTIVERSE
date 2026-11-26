// Card sockets (card plan PR 2–4, owner 2026-11-25/26): drilling at the blacksmith (once, gold + a drill stone, odds
// from the card tuning), socketing a card from the bag into drilled gear anywhere (its tuned group only), taking it out
// (the card breaks), save cleaning, bulk sell skipping drilled gear, the admin item edit keeping sockets, and the card
// effects on stats (% before the class multipliers, cdr / pierce added to the item mods, caps). Shared rules, no server.
import { editGear } from '../src/shared/admin';
import { cardFxTotal, cleanSockets, drillCost, MAX_SOCKETS, rollSockets, socketBlock } from '../src/shared/cardSockets';
import { applyCardTuning, cardNum, cardTuningChanges, checkCardTuning, currentCardTuning, tunedFusePool } from '../src/shared/cardTuning';
import { STONE_COLOR, stoneSellPrice } from '../src/shared/data/stones';
import { RARITY_COLOR } from '../src/shared/types';
import { type CardId } from '../src/shared/data/cards';
import { ITEM_BASES, makeItem, upgradeItem } from '../src/shared/data/items';
import { ZONES } from '../src/shared/data/zones';
import { newCharacterData } from '../src/shared/sim/Player';
import { isBulkSellable, Sim } from '../src/shared/sim/Sim';
import type { Item, SlotId } from '../src/shared/types';
import { finish, ok } from './check';

const WOLF: CardId = 'card_forest_wolf'; // weapon group: ATK +2% · lifesteal +0.5%
const BOAR: CardId = 'card_wild_boar'; // armor group: DEF +2% · damage taken −1%
const OWL: CardId = 'card_snow_owl'; // accessory group: MP +4% · cdr +3%
const gear = (slot: SlotId, rarity: Item['rarity'] = 'rare'): Item => {
  const b = ITEM_BASES.find((x) => x.slot === slot && (x.names.any || x.names.sword) && x.minLevel <= 30)!;
  return makeItem(b.id, rarity, 30, 'sword')!;
};
const tune = (v: unknown) => applyCardTuning(checkCardTuning(v, true).tuning!);

// ---------------------------------------------------------- save cleaning (old saves load as "not drilled")
{
  const old = gear('weapon');
  delete old.sockets;
  cleanSockets(old);
  ok(old.sockets === undefined && old.cards === undefined, 'an old item stays not drilled');
  const bad = { ...gear('weapon'), sockets: 7, cards: [WOLF] } as Item;
  cleanSockets(bad);
  ok(bad.sockets === undefined && bad.cards === undefined, 'a socket count out of range is dropped (not drilled)');
  const odd = { ...gear('weapon'), sockets: 2, cards: ['card_made_up', WOLF, WOLF] } as unknown as Item;
  upgradeItem(odd);
  ok(odd.sockets === 2 && JSON.stringify(odd.cards) === JSON.stringify([null, WOLF]), `unknown card emptied, cut to the socket count (${JSON.stringify(odd.cards)})`);
  const empty = { ...gear('weapon'), sockets: 1, cards: [null] } as Item;
  cleanSockets(empty);
  ok(empty.sockets === 1 && empty.cards === undefined, 'all-empty cards are left out');
}

// ---------------------------------------------------------- drill odds and cost from the card tuning
tune({ nums: { drill0: 0, drill1: 0, drill2: 100 } });
ok([0, 0, 0, 0, 0].every(() => rollSockets(Math.random) === 2), 'drill2 = 100% always gives 2 sockets');
tune({ nums: { drill0: 100, drill1: 0, drill2: 0 } });
ok(rollSockets(Math.random) === 0, 'drill0 = 100% always gives none');
applyCardTuning({});
const legend = { ...gear('weapon', 'legendary'), level: 40 };
ok(drillCost(legend) === 6375, `cost: (15 + 40×6) × 5 × 5 = 6,375 G (${drillCost(legend)})`);
tune({ nums: { drillCostMult: 2 } });
ok(drillCost(legend) === 2550, 'cost follows drillCostMult');
applyCardTuning({});

// ---------------------------------------------------------- the Sim: drill, socket, unsocket
const sim = new Sim(Object.values(ZONES)[0]);
const data = newCharacterData('T', 'sword');
data.level = 30;
const p = sim.addPlayer(data);
p.gold = 1_000_000;
const stand = (id: string) => {
  const near = (sim as unknown as { near(p: unknown, id: string): boolean }).near.bind(sim);
  for (let x = -80; x <= 80; x++) for (let z = -80; z <= 80; z++) {
    p.x = x;
    p.z = z;
    if (near(p, id)) return true;
  }
  return false;
};
const sword = gear('weapon');
p.bag[5] = sword;
// Away from the blacksmith: refused.
p.x = 9999;
p.addStones('drill', 3);
ok(sim.drill(p, sword.uid) === null, 'drilling away from the blacksmith is refused');
ok(stand('blacksmith'), 'standing at the blacksmith');
const forge = () => (p.forgeAt = -999);
tune({ nums: { drill0: 0, drill1: 0, drill2: 100 } });
let gold = p.gold;
forge();
const drilled = sim.drill(p, sword.uid);
ok(drilled?.sockets === 2 && p.stoneCount('drill') === 2 && p.gold === gold - drillCost(sword), 'drilled: 2 sockets, 1 stone and the gold taken');
forge();
ok(sim.drill(p, sword.uid) === null && p.stoneCount('drill') === 2, 'the same item can never be drilled again');
forge();
ok(sim.drill(p, 'no-such-uid') === null, 'an unknown uid is refused');
const poor = gear('helmet');
p.bag[6] = poor;
p.takeStones('drill', 2);
forge();
ok(sim.drill(p, poor.uid) === null && poor.sockets === undefined, 'no drill stone: refused');
applyCardTuning({});
ok(isBulkSellable(sword, sword.rarity) === false && isBulkSellable(poor, poor.rarity) === true, 'bulk sell skips drilled gear only');

// Socketing (anywhere: move away from the blacksmith first).
p.x = 9999;
ok(socketBlock(BOAR, sword) !== '', 'an armor card does not fit a weapon');
ok(!sim.socketCard(p, sword.uid, WOLF), 'no wolf card in the bag: refused');
p.addStones(WOLF, 3);
p.addStones(BOAR, 1);
ok(!sim.socketCard(p, sword.uid, BOAR) && p.stoneCount(BOAR) === 1, 'wrong group: refused, card kept');
ok(!sim.socketCard(p, poor.uid, BOAR), 'not drilled: refused');
ok(!sim.socketCard(p, sword.uid, 'card_made_up'), 'a made-up card id: refused');
ok(sim.socketCard(p, sword.uid, WOLF) && sim.socketCard(p, sword.uid, WOLF), 'two wolf cards go into the two sockets (same card twice is fine)');
ok(JSON.stringify(sword.cards) === JSON.stringify([WOLF, WOLF]) && p.stoneCount(WOLF) === 1, 'both sockets hold a wolf, 2 cards used');
ok(!sim.socketCard(p, sword.uid, WOLF) && p.stoneCount(WOLF) === 1, 'no empty socket: refused');
tune({ cards: { card_wild_boar: { group: 'weapon' } } });
ok(socketBlock(BOAR, gear('weapon')) === 'อุปกรณ์ยังไม่ได้เจาะรู (เจาะได้ที่ช่างตีเหล็ก)' && socketBlock(BOAR, { ...gear('weapon'), sockets: 1 }) === '', 'the group follows the card tuning');
applyCardTuning({});

// Unsocketing: the card breaks.
ok(!sim.unsocketCard(p, sword.uid, 5) && !sim.unsocketCard(p, sword.uid, 'x'), 'a bad socket index is refused');
ok(sim.unsocketCard(p, sword.uid, 0) && JSON.stringify(sword.cards) === JSON.stringify([null, WOLF]) && p.stoneCount(WOLF) === 1, 'socket 0 emptied, the card is gone (not back in the bag)');
ok(!sim.unsocketCard(p, sword.uid, 0), 'an empty socket has nothing to take out');

// ---------------------------------------------------------- effects on stats
{
  const q = sim.addPlayer({ ...newCharacterData('E', 'sword'), level: 30 });
  q.equipment.weapon = { ...gear('weapon'), sockets: 0 };
  q.recompute();
  const atk0 = q.stats.atk;
  const def0 = q.stats.def;
  const cdr0 = q.stats.cdr;
  q.equipment.weapon = { ...gear('weapon'), uid: q.equipment.weapon!.uid, lines: q.equipment.weapon!.lines, stats: q.equipment.weapon!.stats, sockets: 2, cards: [WOLF, WOLF] };
  q.recompute();
  ok(Math.abs(q.stats.atk / atk0 - 1.04) < 1e-9, `two wolf cards: ATK ×1.04 (${(q.stats.atk / atk0).toFixed(4)})`);
  ok(q.cardFx.lifesteal === 1 && q.stats.def === def0, 'lifesteal 0.5 + 0.5 = 1%, DEF unchanged');
  q.equipment.necklace = { ...gear('necklace'), sockets: 2, cards: [OWL, OWL] };
  q.recompute();
  const neckCdr = q.equipment.necklace.stats.cdr ?? 0;
  ok(Math.abs(q.stats.cdr - (cdr0 + neckCdr + 6)) < 1e-9, `owl cdr 3 + 3 adds to the item cdr mod (${q.stats.cdr})`);
  tune({ nums: { cap_cdr: 4 } });
  q.recompute();
  ok(q.cardFx.cdr === 4 && Math.abs(q.stats.cdr - (cdr0 + neckCdr + 4)) < 1e-9, 'the card part stops at its cap (cap_cdr 4)');
  tune({ cards: { card_forest_wolf: { fx: { atkPct: 10 } } } });
  q.equipment.necklace = undefined; // its own lines may add ATK
  q.recompute();
  ok(Math.abs(q.stats.atk / atk0 - 1.2) < 1e-9 && q.cardFx.lifesteal === 0, 'tuning a card changes socketed cards at once');
  applyCardTuning({});
  q.equipment.weapon = undefined;
  q.equipment.necklace = undefined;
  q.recompute();
  ok(Object.values(q.cardFx).every((v) => v === 0), 'no cards worn: no effects');
}
ok(Object.values(cardFxTotal([sword])).some((v) => v > 0), 'cardFxTotal reads the bag item too (used for previews)');

// ---------------------------------------------------------- the card % also raises the item-set bonus (owner 2026-11-26)
{
  const q = sim.addPlayer({ ...newCharacterData('S', 'sword'), level: 30 });
  const plain = { ...gear('weapon'), sockets: 0 };
  q.equipment.weapon = plain;
  q.recompute();
  const before = q.stats.atk;
  q.equipment.weapon = { ...plain, sockets: 2, cards: [WOLF, WOLF] };
  q.recompute();
  // No set worn: the whole total is ×1.04 (class multiplier applied after the card %, so the ratio stays 1.04).
  ok(Math.abs(q.stats.atk / before - 1.04) < 1e-9, 'card ATK% on the whole total');
}

// ---------------------------------------------------------- rarity tuning per card (owner 2026-11-26)
{
  ok(typeof checkCardTuning({ cards: { [WOLF]: { rarity: 'mythic' } } }, true).error === 'string', 'an unknown rarity is refused');
  tune({ cards: { [WOLF]: { rarity: 'legendary' } } });
  ok(stoneSellPrice(WOLF) === cardNum('sell_legendary') && STONE_COLOR[WOLF] === RARITY_COLOR.legendary, 'a tuned rarity changes the sell price and colour');
  ok(tunedFusePool('legendary', 1).includes(WOLF) && !tunedFusePool('rare', 1).includes(WOLF), 'the fusion pool follows the tuned rarity');
  ok(cardTuningChanges({}, currentCardTuning(), (id) => id).includes('ระดับ'), 'the audit line names the rarity change');
  ok(JSON.stringify(checkCardTuning({ cards: { [WOLF]: { rarity: 'rare' } } }, true).tuning) === '{}', 'the code rarity is not stored');
  applyCardTuning({});
}

// ---------------------------------------------------------- effects in combat (damage taken, lifesteal)
{
  const farm = Object.values(ZONES).find((z) => !z.safe && !z.roomOf && (z.spawns?.length ?? 0) > 0)!;
  const fs = new Sim(farm);
  for (let i = 0; i < 200 && !fs.monsters.length; i++) fs.step(0.1);
  const m = fs.monsters.find((x) => !x.isBoss);
  ok(!!m, `a monster on ${farm.id} to test with`);
  if (m) {
    const q = fs.addPlayer({ ...newCharacterData('C', 'sword'), level: 30 });
    q.x = m.x + 1;
    q.z = m.z;
    const rnd = Math.random;
    Math.random = () => 0.5;
    const taken = (): number => {
      q.hp = 1e9;
      q.invulnT = 0;
      q.shield = 0;
      fs.hitPlayer(m, q, 300, {});
      return 1e9 - q.hp;
    };
    const base = taken();
    q.equipment.armor = { ...gear('armor'), sockets: 2, cards: [BOAR, BOAR] };
    q.recompute();
    const withCards = taken();
    // Boar DEF +2% also cuts the hit a little: the card cut alone is ≥ 2%.
    ok(withCards < base && withCards <= Math.round(base * 0.98), `two boar cards cut damage taken (${base} → ${withCards})`);
    q.equipment.armor = undefined;
    q.equipment.weapon = { ...q.equipment.weapon!, sockets: 2, cards: [WOLF, WOLF] };
    q.recompute();
    q.hp = 1;
    m.hp = 1e9;
    fs.hitMonster(q, m, 50, {});
    ok(q.hp > 1, `wolf lifesteal heals on a hit (${q.hp - 1} HP)`);
    Math.random = rnd;
  }
}

// ---------------------------------------------------------- admin edit keeps sockets, checks cards
{
  const it = { ...gear('weapon'), sockets: 1, cards: [WOLF] } as Item;
  const body = { baseId: it.baseId, rarity: it.rarity, level: it.level, classId: 'sword', name: it.name, plus: 0, pity: 0, lines: it.lines!.map((l) => ({ stat: l.stat, value: l.value })) };
  const kept = editGear(it, body);
  ok(typeof kept !== 'string' && kept.sockets === 1 && kept.cards?.[0] === WOLF, 'an edit without socket fields keeps them');
  const set = editGear(it, { ...body, sockets: 2, cards: [null, WOLF] });
  ok(typeof set !== 'string' && set.sockets === 2 && JSON.stringify(set.cards) === JSON.stringify([null, WOLF]), 'admin sets 2 sockets with a card in the second');
  ok(typeof editGear(it, { ...body, sockets: 1, cards: [BOAR] }) === 'string', 'admin: a card of the wrong group is refused');
  ok(typeof editGear(it, { ...body, sockets: MAX_SOCKETS + 1 }) === 'string', 'admin: too many sockets is refused');
  const undrilled = editGear(it, { ...body, sockets: -1 });
  ok(typeof undrilled !== 'string' && undrilled.sockets === undefined && undrilled.cards === undefined, 'admin: -1 = not drilled');
}

finish('card-sockets');
