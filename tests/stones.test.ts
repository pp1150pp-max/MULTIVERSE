// Blacksmith stones: each reroll needs its own stone on top of the gold. Runs on the shared rules, no server.
import { makeItem } from '../src/shared/data/items';
import { REROLL_KINDS, rerollCost } from '../src/shared/data/reroll';
import { REROLL_STONE, STONE_NAME } from '../src/shared/data/stones';
import { ZONES } from '../src/shared/data/zones';
import { newCharacterData, type Player } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { cleanStash } from '../src/shared/sim/stash';
import { STONE_KINDS, type Item } from '../src/shared/types';
import { finish, ok } from './check';

for (const k of STONE_KINDS) ok(!!STONE_NAME[k], `stone ${k} has a name`);
ok(new Set(Object.values(REROLL_STONE)).size === REROLL_KINDS.length, 'each reroll uses a different stone');

const sim = new Sim(Object.values(ZONES)[0]);
const data = newCharacterData('T', 'sword');
data.level = 30;
data.gold = 10_000_000;
const item = makeItem('weapon_3', 'epic', 30, 'sword')!;
data.bag = [item];
const p = sim.addPlayer(data);
const near = (sim as unknown as { near(p: Player, id: string): boolean }).near.bind(sim);
outer: for (let x = -80; x <= 80; x++) for (let z = -80; z <= 80; z++) {
  p.x = x;
  p.z = z;
  if (near(p, 'blacksmith')) break outer;
}
ok(near(p, 'blacksmith'), 'standing at the blacksmith');

for (const kind of REROLL_KINDS) {
  p.forgeAt = -Infinity; // skip the 1 s blacksmith cooldown (FORGE_CD) between kinds
  const stone = REROLL_STONE[kind];
  const gold = p.gold;
  ok(sim.reroll(p, item.uid, kind) === null && p.gold === gold, `${kind}: refused without ${stone}, no gold taken`);
  p.addStones(stone, 2);
  const other = REROLL_STONE[kind === 'values' ? 'stat' : 'values'];
  const otherBefore = p.stoneCount(other);
  ok(sim.reroll(p, item.uid, kind) !== null, `${kind}: works with the stone`);
  ok(p.stoneCount(stone) === 1, `${kind}: used one stone`);
  ok(p.gold === gold - rerollCost(item, kind), `${kind}: still costs the gold`);
  ok(p.stoneCount(other) === otherBefore, `${kind}: the other reroll stone is untouched`);
}

// New stones survive the stash like the old ones
const st = cleanStash({ size: 30, items: STONE_KINDS.map((stone) => ({ stone, count: 3 })) });
ok(STONE_KINDS.every((k, i) => (st.items[i] as { stone?: string } | null)?.stone === k), 'stash keeps every stone kind');
ok((p.bag.find((x) => (x as Item | null)?.uid === item.uid) as Item | undefined) === item, 'the item stays in the bag');

finish('stones');
