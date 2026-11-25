// Monster cards as bag items (card-system PR 1): a card is a stone kind that stacks 10 per slot, sorts after the other
// stones, survives the stash and the mail, sells at its rarity's price from the card tuning, and the server's admin /
// mail checks take real cards only. Runs on the shared rules, no server (tests/admin-server.test.ts spawns over HTTP).
import { adminStack } from '../src/shared/admin';
import { applyCardTuning, checkCardTuning } from '../src/shared/cardTuning';
import { CARD_DEFAULTS, CARD_IDS, cardName, type CardId } from '../src/shared/data/cards';
import { STONE_COLOR, STONE_NAME, stoneSellPrice, stoneStackMax, stoneUnit } from '../src/shared/data/stones';
import { ZONES } from '../src/shared/data/zones';
import { cleanAttach, rollAttach } from '../src/shared/mail';
import { isPriorityLoot } from '../src/shared/sim/Loot';
import { marketKind } from '../src/shared/sim/market';
import { newCharacterData, sortEntries } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { cleanStash } from '../src/shared/sim/stash';
import { isStoneKind, RARITY_COLOR, STONE_KINDS, type BagEntry, type StoneStack } from '../src/shared/types';
import { finish, ok } from './check';

const WOLF: CardId = 'card_forest_wolf';
const cards = (list: readonly (BagEntry | null)[], id: CardId) =>
  list.filter((e): e is StoneStack => !!e && 'stone' in e && e.stone === id).map((e) => e.count);

// ---------------------------------------------------------- kinds, names, prices
ok(CARD_IDS.every((id) => isStoneKind(id)), `all ${CARD_IDS.length} cards are stone kinds`);
ok(!CARD_IDS.some((id) => (STONE_KINDS as string[]).includes(id)), 'cards are not in the fixed STONE_KINDS list');
ok(!isStoneKind('card_not_a_monster') && !isStoneKind('card_'), 'made-up card ids are not stone kinds');
ok(CARD_IDS.every((id) => STONE_NAME[id] === cardName(id) && stoneStackMax(id) === 10 && stoneUnit(id) === 'ใบ'), 'every card: its name, 10 per slot, unit ใบ');
ok(stoneUnit('card_ghost_monkey') === 'ใบ', 'card_ghost_monkey (has "key_" in it) is still counted in ใบ');
ok(CARD_DEFAULTS.every((d) => STONE_COLOR[d.id] === RARITY_COLOR[d.rarity]), 'card colour = its rarity colour');
ok(stoneSellPrice(WOLF) === 2000 && stoneSellPrice('card_forest_bear') === 10000 && stoneSellPrice('card_bog_witch') === 50000, 'sell prices: rare 2,000 · epic 10,000 · legendary 50,000 G');
applyCardTuning(checkCardTuning({ nums: { sell_rare: 1234 } }, true).tuning!);
ok(stoneSellPrice(WOLF) === 1234, 'the sell price follows the card tuning from /admin');
applyCardTuning({});
ok(isPriorityLoot({ type: 'stone', stone: WOLF, count: 1 }), 'Auto picks cards up first (isPriorityLoot)');
ok(marketKind({ stone: WOLF, count: 1 }) === 'card', 'cards list on the market in their own "การ์ด" category');

// ---------------------------------------------------------- stacking and sorting in the bag
const sim = new Sim(Object.values(ZONES)[0]);
const data = newCharacterData('T', 'sword');
data.level = 30;
const p = sim.addPlayer(data);
ok(p.addStones(WOLF, 25), 'add 25 wolf cards');
ok(cards(p.bag, WOLF).sort((a, b) => b - a).join(',') === '10,10,5', `25 cards = 10 + 10 + 5 (${cards(p.bag, WOLF)})`);
ok(p.addStones('card_kraken', 1) && p.addStones('enhance', 1), 'add a kraken card and a stone');
const sorted = sortEntries(p.bag, 'rarity', true);
ok(cards(sorted, WOLF).join(',') === '10,10,5', 'sorting keeps every card');
const order = sorted.filter((e): e is StoneStack => !!e && 'stone' in e).map((e) => e.stone);
ok(order.indexOf('enhance') < order.indexOf(WOLF) && order.indexOf(WOLF) < order.indexOf('card_kraken'), `cards after stones, in table order (${order.join(' ')})`);

// ---------------------------------------------------------- stash: put in, saved, loaded back
const stand = (id: string) => {
  const near = (sim as unknown as { near(p: unknown, id: string): boolean }).near.bind(sim);
  for (let x = -80; x <= 80; x++) for (let z = -80; z <= 80; z++) {
    p.x = x;
    p.z = z;
    if (near(p, id)) return true;
  }
  return false;
};
ok(stand('keeper'), 'standing at the warehouse keeper');
const slot = p.bag.findIndex((e) => !!e && 'stone' in e && e.stone === WOLF && e.count === 10);
ok(sim.stashPut(p, slot, -1), 'a stack of 10 cards goes into the stash');
const loaded = cleanStash(JSON.parse(JSON.stringify(p.stash)));
ok(cards(loaded.items, WOLF).join(',') === '10', 'the stash saved and loaded back still has the 10 cards');
ok(cleanStash({ size: 30, items: [{ stone: 'card_made_up', count: 3 }] }).items[0] === null, 'a made-up card in a stash save is dropped');

// ---------------------------------------------------------- merchant sells at the card price
ok(stand('merchant'), 'standing at the merchant');
const gold = p.gold;
const kraken = p.bag.findIndex((e) => !!e && 'stone' in e && e.stone === 'card_kraken');
ok(sim.sellItem(p, kraken) === 50000 && p.gold === gold + 50000, 'the merchant buys a legendary card for 50,000 G');

// ---------------------------------------------------------- admin spawning and mail: real cards only
ok(typeof adminStack({ kind: 'stone', stone: WOLF }) !== 'string', 'admin may spawn a real card');
ok(adminStack({ kind: 'stone', stone: 'card_not_a_monster' }) === 'ชนิดหินไม่ถูกต้อง', 'admin spawning a made-up card is refused');
const att = cleanAttach({ gold: 0, items: [{ kind: 'stone', stone: WOLF, count: 3 }] });
ok(typeof att !== 'string' && rollAttach(att, 'sword', 30).some((e) => 'stone' in e && e.stone === WOLF && e.count === 3), 'a card can be attached to mail and claimed');
ok(typeof cleanAttach({ gold: 0, items: [{ kind: 'stone', stone: 'card_not_a_monster', count: 1 }] }) === 'string', 'mail with a made-up card is refused');

finish('card-items');
