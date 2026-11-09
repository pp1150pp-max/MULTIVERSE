// Boss keys (Artifacts): one per boss, dropped at 1% by the monsters of its map (also those standing in
// the hub), stacking to 10 like stones, sold for 1,000 G, listed under their own market kind.
import { ok, finish } from './check';
import { BOSS_KEY, KEY_DROP_CHANCE, STONE_DESC, STONE_NAME, STONE_STACK, stoneStackValue } from '../src/shared/data/stones';
import { ZONE_1, ZONE_2, ZONE_3, ZONE_4, ZONE_HUB, type ZoneDef } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { marketKind } from '../src/shared/sim/market';
import { cleanStash } from '../src/shared/sim/stash';
import { newCharacterData } from '../src/shared/sim/Player';
import { BLACKSMITH_STONES, BOSS_KEYS, isBossKey, STONE_KINDS, type BossKey } from '../src/shared/types';

const zones = [ZONE_1, ZONE_2, ZONE_3, ZONE_4];

ok(new Set(zones.map((z) => BOSS_KEY[z.boss!.monster])).size === 4, 'every boss has its own key');
for (const k of BOSS_KEYS) ok(!!STONE_NAME[k] && !!STONE_DESC[k] && isBossKey(k), `${k} has a name and a description`);
ok(BLACKSMITH_STONES.every((k) => !isBossKey(k)) && STONE_KINDS.length === BLACKSMITH_STONES.length + BOSS_KEYS.length, 'keys are not blacksmith stones');
ok(KEY_DROP_CHANCE === 0.01, 'keys drop at 1%');
ok(stoneStackValue({ stone: 'key_bear', count: 3 }) === 3000, 'a key sells for 1,000 G');
ok(marketKind({ stone: 'key_yeti', count: 1 }) === 'artifact' && marketKind({ stone: 'enhance', count: 1 }) === 'stone', 'keys list as Artifacts');

// Stacks of 10, kept apart from other keys.
const sim = new Sim(ZONE_1);
const p = sim.addPlayer(newCharacterData('K', 'sword'));
ok(p.addStones('key_bear', 12) && p.stoneCount('key_bear') === 12, 'picked up 12 keys');
const stacks = p.bag.filter((e) => e && 'stone' in e && e.stone === 'key_bear') as { count: number }[];
ok(stacks.length === 2 && Math.max(...stacks.map((s) => s.count)) === STONE_STACK, 'they stack 10 to a slot');
ok(p.addStones('key_witch', 1) && p.stoneCount('key_bear') === 12, 'another boss key gets its own stack');
const st = cleanStash({ size: 30, items: BOSS_KEYS.map((stone) => ({ stone, count: 4 })) });
ok(BOSS_KEYS.every((k, i) => (st.items[i] as { stone?: string } | null)?.stone === k), 'the stash keeps every key');

/** Kills each monster of the zone many times; returns the keys that dropped, by kind. */
function keysFrom(zone: ZoneDef, rounds: number): { kinds: Map<BossKey, number>; kills: number; bossKeys: number } {
  const s = new Sim(zone);
  for (let i = 0; i < 600 && s.monsters.length < 4; i++) s.step(0.1);
  const drop = (s as unknown as { dropLoot(m: unknown): void }).dropLoot.bind(s);
  const kinds = new Map<BossKey, number>();
  let kills = 0;
  let bossKeys = 0;
  for (let k = 0; k < rounds; k++) {
    for (const m of s.monsters) {
      const before = s.loots.length;
      drop(m);
      if (!m.isBoss) kills++;
      for (const l of s.loots.slice(before)) {
        if (l.kind.type !== 'stone' || !isBossKey(l.kind.stone)) continue;
        kinds.set(l.kind.stone, (kinds.get(l.kind.stone) ?? 0) + 1);
        if (m.isBoss) bossKeys++;
      }
    }
    s.loots = [];
  }
  return { kinds, kills, bossKeys };
}

for (const zone of zones) {
  const own = BOSS_KEY[zone.boss!.monster];
  const { kinds, kills, bossKeys } = keysFrom(zone, 200);
  const n = kinds.get(own) ?? 0;
  const rate = n / kills;
  ok(kinds.size === 1 && n > 0, `${zone.id}: its monsters drop only ${STONE_NAME[own]}`);
  ok(rate > 0.005 && rate < 0.016, `${zone.id}: about 1% (${(rate * 100).toFixed(2)}% of ${kills} kills)`);
  ok(bossKeys === 0, `${zone.id}: the boss itself drops no key`);
}

// The hub's monsters drop the key of the map they come from.
const hub = keysFrom(ZONE_HUB, 200);
ok(BOSS_KEYS.every((k) => (hub.kinds.get(k) ?? 0) > 0), 'hub monsters drop all four keys (each from its own corner)');
finish('boss-keys');
