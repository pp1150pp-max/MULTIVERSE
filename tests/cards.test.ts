// Card data (docs/plans/card-system.md sections 5 and 12): floor 2's cards, the 13th effect, per-floor fusion pools,
// the floor 2 drop switch and the papercraft pictures.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_DEFAULTS, CARD_FX, CARD_FX_MAX, CARD_RARITIES, cardArt, cardFrame, cardFusePool, cardsOfMonster } from '../src/shared/data/cards';
import { applyCardTuning, cardDropsOpen, checkCardTuning } from '../src/shared/cardTuning';
import { MONSTERS } from '../src/shared/data/monsters';
import { finish, ok } from './check';

const floor1 = CARD_DEFAULTS.filter((d) => d.floor === 1);
const floor2 = CARD_DEFAULTS.filter((d) => d.floor === 2);
ok(floor1.length === 26, `floor 1 has 26 cards (${floor1.length})`);
ok(floor2.length === 21, `floor 2 has 20 monster cards + the parrot (${floor2.length})`);
ok(new Set(CARD_DEFAULTS.map((d) => d.id)).size === CARD_DEFAULTS.length, 'card ids are unique');
ok(CARD_DEFAULTS.every((d) => MONSTERS[d.monster] && (!d.dropFrom || MONSTERS[d.dropFrom])), 'every card monster (and dropFrom boss) exists');
ok(CARD_DEFAULTS.every((d) => { const n = Object.keys(d.fx).length; return n >= 1 && n <= CARD_FX_MAX; }), `every card has 1–${CARD_FX_MAX} effects`);
ok(CARD_DEFAULTS.every((d) => Object.keys(d.fx).every((f) => CARD_FX.includes(f as never))), 'every effect is a known kind');
ok(CARD_FX.length === 13 && CARD_FX.includes('normalAtkPct'), 'the 13th effect is normal attack damage %');
ok(CARD_DEFAULTS.filter((d) => d.fx.normalAtkPct).map((d) => d.monster).sort().join() === 'cutlass_pirate,shotgunner', 'normal attack damage % is on the cutlass pirate and the shotgunner');

// The parrot: epic, rolled when the Peg-Leg Captain dies (it never dies itself).
const parrot = CARD_DEFAULTS.find((d) => d.id === 'card_parrot');
ok(parrot?.rarity === 'epic' && parrot.dropFrom === 'pegleg_captain', 'the parrot card is epic and drops from the Peg-Leg Captain');
ok(cardsOfMonster('pegleg_captain').map((d) => d.id).sort().join() === 'card_parrot,card_pegleg_captain', 'killing the captain rolls his card and the parrot card');
ok(cardsOfMonster('parrot').length === 0, 'the parrot itself rolls no card');
ok(cardsOfMonster('kraken_tentacle').length === 1, 'the kraken tentacle drops its card');

// Fusion pools are per floor.
for (const r of CARD_RARITIES) for (const f of [1, 2] as const) {
  const pool = cardFusePool(r, f);
  ok(pool.every((id) => CARD_DEFAULTS.find((d) => d.id === id)!.floor === f && CARD_DEFAULTS.find((d) => d.id === id)!.rarity === r), `fusion pool ${r} floor ${f} holds only that floor and rarity (${pool.length})`);
}

// Floor 2 drops follow the /admin switch.
applyCardTuning({});
ok(cardDropsOpen('card_green_slime') && !cardDropsOpen('card_kraken'), 'switch off (code default): floor 1 drops, floor 2 does not');
const on = checkCardTuning({ nums: { floor2Drop: 1 } }, true);
ok(on.tuning?.nums?.floor2Drop === 1, 'the switch can be saved');
applyCardTuning(on.tuning!);
ok(cardDropsOpen('card_kraken') && cardDropsOpen('card_parrot'), 'switch on: floor 2 drops');
applyCardTuning({});
ok(checkCardTuning({ cards: { card_shotgunner: { fx: { normalAtkPct: 10 } } } }, true).tuning?.cards?.card_shotgunner?.fx?.normalAtkPct === 10, 'normal attack damage % can be set on /admin');

// Pictures.
const pub = join(import.meta.dirname, '..', 'public');
const missing = CARD_DEFAULTS.filter((d) => !existsSync(join(pub, cardArt(d.id)))).map((d) => d.id);
ok(missing.length === 0, `every card has its papercraft picture${missing.length ? ` (missing ${missing.join(', ')})` : ''}`);
ok(CARD_RARITIES.every((r) => existsSync(join(pub, cardFrame(r)))), 'every rarity has its papercraft frame');

finish('cards');
