// The quest states the tracker and the ! / ? over The Seeker read (src/shared/quests.ts).
import { ok, finish } from './check';
import { questRows, seekerMark, type QuestHolder } from '../src/shared/quests';
import { ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { QUEST_KILLS } from '../src/shared/data/stones';
import type { StoneKind } from '../src/shared/types';

const holder = (level: number, keys: StoneKind[] = []): QuestHolder => ({
  level, quests: {}, bossKills: [], stoneCount: (k) => keys.filter((x) => x === k).length,
});
const state = (p: QuestHolder, boss: string) => questRows(p).find((r) => r.boss === boss)?.state;

const p = holder(5);
ok(questRows(p).length === 4, 'one row per boss');
ok(state(p, 'forest_bear') === 'offer', 'Lv.5: the bear is offered');
ok(state(p, 'yeti') === 'locked', 'Lv.5: the yeti is locked');
ok(seekerMark(questRows(p)) === '!', 'something to take: !');

p.quests.forest_bear = 12;
ok(state(p, 'forest_bear') === 'going' && questRows(p)[0].kills === 12, 'taken: going 12');
ok(seekerMark(questRows(p)) === '', 'nothing left to take or hand in: no mark');

p.quests.forest_bear = QUEST_KILLS;
ok(state(p, 'forest_bear') === 'ready', 'kills done: ready');
ok(seekerMark(questRows(p)) === '?', 'one to hand in: ?');

const both = holder(15);
both.quests.forest_bear = QUEST_KILLS;
ok(state(both, 'bog_witch') === 'offer' && seekerMark(questRows(both)) === '?', '? wins over !');

ok(state(holder(5, ['qkey_bear']), 'forest_bear') === 'holding', 'key in the bag: holding');
const beaten = holder(5);
beaten.bossKills.push('forest_bear');
ok(state(beaten, 'forest_bear') === 'done', 'boss beaten: done');

// Sim.questOffers reads the same rules.
const hub = new Sim(ZONE_HUB);
const real = hub.addPlayer({ ...newCharacterData('Q', 'sword'), level: 5 });
ok(hub.questOffers(real).join() === questRows(real).filter((r) => r.state === 'offer').map((r) => r.boss).join(), 'Sim offers = offer rows');

finish('quest-marks');
