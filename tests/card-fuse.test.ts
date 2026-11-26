// Card fusion (card plan 6.1 and 12.3 no. 2, owner 2026-11-25/26): 3 cards of one rarity and one floor give 1 random
// card of that rarity and floor, mixed floors refused, floor 2 only while floor2Drop is on, fuseOn_/fuseCost_ per
// rarity, never announced. Also the floor 2 bits that ride on other code: the kraken tentacle's card and the 13th
// effect "ดาเมจโจมตีปกติ %" on a Gunslinger's basic shot. Shared rules, no server.
import { cardFloor, fuseBlock, fuseInfo, rollFuse } from '../src/shared/cardFuse';
import { rollCardDrops } from '../src/shared/cardDrops';
import { applyCardTuning, checkCardTuning } from '../src/shared/cardTuning';
import { CARD_DEFAULTS, type CardId } from '../src/shared/data/cards';
import { ZONES } from '../src/shared/data/zones';
import type { Monster } from '../src/shared/sim/Monster';
import { newCharacterData } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { finish, ok } from './check';

const tune = (v: unknown) => applyCardTuning(checkCardTuning(v, true).tuning!);
const WOLF: CardId = 'card_forest_wolf';
const FOX: CardId = 'card_forest_fox';
const EEL: CardId = 'card_shock_eel'; // floor 2 rare
const WITCH: CardId = 'card_bog_witch'; // floor 1 legendary
const BEAR: CardId = 'card_forest_bear'; // floor 1 epic
const lots = () => 99;

// ---------------------------------------------------------------- the pure rules
applyCardTuning({});
ok(fuseBlock([WOLF, WOLF, FOX], lots, 1e9) === '', 'three floor 1 rares (repeats allowed) fuse');
ok(fuseBlock([WOLF, FOX], lots, 1e9) !== '', 'two cards: refused');
ok(fuseBlock([WOLF, FOX, 'card_made_up'], lots, 1e9) !== '', 'an unknown card: refused');
ok(fuseBlock([WOLF, FOX, WITCH], lots, 1e9).includes('ระดับ'), 'mixed rarity: refused');
ok(fuseBlock([BEAR, BEAR, BEAR], lots, 1e9) !== '', 'epic fusion is off in code (fuseOn_epic 0)');
tune({ nums: { floor2Drop: 1 } });
ok(fuseBlock([WOLF, FOX, EEL], lots, 1e9).includes('ชั้น'), 'mixed floors: refused (owner 2026-11-26)');
applyCardTuning({});
ok(fuseBlock([EEL, EEL, EEL], lots, 1e9).includes('ชั้น 2'), 'floor 2 fusion is off while floor2Drop is 0 (owner 2026-11-26)');
tune({ nums: { floor2Drop: 1 } });
ok(fuseBlock([EEL, EEL, EEL], lots, 1e9) === '', 'floor 2 fuses once floor2Drop is on');
applyCardTuning({});
ok(fuseBlock([WOLF, WOLF, WOLF], (id) => (id === WOLF ? 2 : 0), 1e9).includes('ไม่พอ'), '3 of one card needs 3 in the bag');
ok(fuseBlock([WOLF, FOX, FOX], lots, 4999).includes('ทอง'), 'rare fusion costs 5,000 G (code)');
ok(fuseBlock([WOLF, FOX, FOX], lots, 5000) === '', '... and 5,000 G is enough');
tune({ nums: { fuseOn_rare: 0 } });
ok(fuseBlock([WOLF, FOX, FOX], lots, 1e9) !== '', 'fuseOn_rare 0: refused');
applyCardTuning({});

const info = fuseInfo([WOLF, FOX, FOX])!;
const f1rare = CARD_DEFAULTS.filter((d) => d.floor === 1 && d.rarity === 'rare').map((d) => d.id);
ok(info.rarity === 'rare' && info.floor === 1 && info.cost === 5000, 'info: rare, floor 1, 5,000 G');
ok(info.pool.length === f1rare.length && info.pool.every((id) => cardFloor(id) === 1), `pool: every floor 1 rare card (${info.pool.length})`);
const l1 = fuseInfo([WITCH, WITCH, WITCH])!;
ok(l1.pool.length === 3 && !l1.pool.some((id) => cardFloor(id) === 2), 'floor 1 legendary pool: witch, yeti, volcano heart only');
const l2 = fuseInfo(['card_kraken', 'card_kraken', 'card_kraken'])!;
ok(l2.pool.length === 4 && l2.pool.every((id) => cardFloor(id) === 2), 'floor 2 legendary pool: its 4 bosses only');
ok(rollFuse(info.pool, () => 0) === info.pool[0] && rollFuse(info.pool, () => 0.9999) === info.pool[info.pool.length - 1], 'roll covers the whole pool');
// A card tuned to another rarity moves pools.
tune({ cards: { [FOX]: { rarity: 'legendary' } } });
ok(fuseInfo([WITCH, WITCH, WITCH])!.pool.includes(FOX) && !fuseInfo([WOLF, WOLF, WOLF])!.pool.includes(FOX), 'a card tuned to legendary fuses with the legendaries');
applyCardTuning({});

// ---------------------------------------------------------------- Sim.fuseCards
const sim = new Sim(Object.values(ZONES)[0]);
const p = sim.addPlayer({ ...newCharacterData('F', 'sword'), level: 30 });
p.gold = 100_000;
const near = (sim as unknown as { near(p: unknown, id: string): boolean }).near.bind(sim);
const stand = () => {
  for (let x = -80; x <= 80; x++) for (let z = -80; z <= 80; z++) {
    p.x = x;
    p.z = z;
    if (near(p, 'blacksmith')) return true;
  }
  return false;
};
p.addStones(WOLF, 2);
p.addStones(FOX, 1);
p.x = 9999;
ok(sim.fuseCards(p, [WOLF, WOLF, FOX]) === null && p.stoneCount(WOLF) === 2, 'away from the blacksmith: refused, nothing taken');
ok(stand(), 'standing at the blacksmith');
p.forgeAt = -999;
ok(sim.fuseCards(p, 'nope') === null && sim.fuseCards(p, [WOLF, WOLF]) === null, 'bad input: refused');
sim.drainEvents();
const got = sim.fuseCards(p, [WOLF, WOLF, FOX]);
ok(!!got && f1rare.includes(got), `fused into a floor 1 rare (${got})`);
const total = (id: CardId) => p.stoneCount(id);
ok(total(WOLF) + total(FOX) === (got === WOLF || got === FOX ? 1 : 0) && total(got!) >= 1, 'the 3 cards are gone, the new one is in the bag');
ok(p.gold === 95_000, 'paid 5,000 G');
ok(!sim.drainEvents().some((e) => e.t === 'announce'), 'never announced');
// No room for the new card: refused, the 3 cards back.
{
  const q = sim.addPlayer({ ...newCharacterData('G', 'sword'), level: 30 });
  q.x = p.x;
  q.z = p.z;
  q.gold = 100_000;
  q.addStones(WOLF, 10);
  while (q.addStones('enhance', 10)) { /* fill the use tab */ }
  q.forgeAt = -999;
  // Taking 3 wolves from a stack of 10 frees no slot, and the roll (Math.random 0 = the first rare, a slime) has no room.
  const rnd = Math.random;
  Math.random = () => 0;
  const r = sim.fuseCards(q, [WOLF, WOLF, WOLF]);
  Math.random = rnd;
  ok(r === null && q.stoneCount(WOLF) === 10 && q.gold === 100_000, 'full use tab: refused, the 3 cards put back, no gold taken');
}

// ---------------------------------------------------------------- floor 2 bits
tune({ nums: { floor2Drop: 1, drop_rare: 100 } });
ok(rollCardDrops('kraken_tentacle', false, 1, 1, () => 0).includes('card_kraken_tentacle'), 'the kraken tentacle drops its card (owner 12.3 no. 5)');
applyCardTuning({});
{
  // The 13th effect: a Gunslinger's basic shot hits harder, a skill doesn't.
  const s = new Sim(Object.values(ZONES).find((z) => !z.roomOf && new Sim(z).monsters.some((x) => !x.isBoss))!);
  const g = s.addPlayer({ ...newCharacterData('S', 'gunslinger'), level: 30 });
  s.step(1 / 30);
  const m = s.monsters.find((x) => !x.isBoss) as Monster;
  const hit = (src: string) => {
    m.hp = 1e9;
    const rnd = Math.random;
    Math.random = () => 0.99; // no crit, middle-ish roll
    s.hitMonster(g, m, 1, { src });
    Math.random = rnd;
    return 1e9 - m.hp;
  };
  m.level = g.level;
  g.x = m.x;
  g.z = m.z;
  const base = hit('shot');
  (g.cardFx as { normalAtkPct: number }).normalAtkPct = 100;
  const shot = hit('shot');
  const skill = hit(g.cls.skills.find((x) => x.kind !== 'basic')!.id);
  ok(shot > base * 1.5, `normal attack % doubles the basic shot (${base} → ${shot})`);
  ok(Math.abs(skill - base) <= 1, `... but not a skill (${skill})`);
}

// ---------------------------------------------------------------- the shine by rarity (owner 2026-11-26)
{
  const old = checkCardTuning({ nums: { viewShinePct: 30 } }, false).tuning!;
  ok(old.nums?.viewShinePct_rare === 30 && old.nums?.viewShinePct_epic === 30 && old.nums?.viewShinePct_legendary === 30, 'an old viewShinePct moves to all 3 rarities');
  ok(checkCardTuning({ nums: { viewShinePct: 30 } }, true).error !== undefined, 'the old key is refused from the browser');
  ok(checkCardTuning({ nums: { viewShinePct_epic: 0, viewSparkle: 0, viewRays: 0, viewIdle: 0 } }, true).tuning?.nums?.viewShinePct_epic === 0, 'the new look numbers save');
}

finish('card-fuse');
