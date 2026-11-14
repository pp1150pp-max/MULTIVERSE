// Tutorial quests (owner 2026-11-14): one chain shop → stash → enhance → reroll → market, each step given by
// the NPC of that system, counted only when the action really happened, 1,000 G on taking a step (and bound
// reroll stones for the reroll step), a bound mailed reward on handing in, once per account. Also the
// bound stacks those rewards make, the /admin reward tuning and the DB row. Real Sims and a throwaway DB.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ok, finish } from './check';
import { ZONE_HUB } from '../src/shared/data/zones';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData, sortEntries, type Player } from '../src/shared/sim/Player';
import { ITEM_BASES, makeItem } from '../src/shared/data/items';
import type { NpcId } from '../src/shared/data/npcs';
import {
  TUT_ACCEPT_GOLD, TUT_STEPS, checkTutorialTuning, cleanTutorial, codeTutorial, mergeTutorial, tutMark, tutRows, tutTurnInReward,
  type TutorialData,
} from '../src/shared/tutorial';
import { applyBalance, checkBalance, codeBalance, currentBalance } from '../src/shared/balance';
import { putAll, rollAttach } from '../src/shared/mail';
import { isBound, isPotion, isStone, sameStack, type Item, type PotionStack } from '../src/shared/types';
import { Db } from '../server/db';

const hub = new Sim(ZONE_HUB);
const at = (p: Player, id: NpcId) => {
  const n = hub.terrain.npcPos[id]!;
  p.x = n.x + 1;
  p.z = n.z + 1;
};
const state = (p: Player, step: string) => tutRows(p.tut, p.name).find((r) => r.step === step)!.state;
const mark = (p: Player, id: NpcId) => tutMark(tutRows(p.tut, p.name), id);
const gear = (): Item => makeItem(ITEM_BASES.find((b) => b.slot === 'weapon' && (b.names.any || b.names.sword) && b.minLevel <= 5)!.id, 'rare', 5, 'sword')!;

// One account: two characters sharing one live tutorial object (as the server does).
const acc: TutorialData = { done: [] };
const p = hub.addPlayer({ ...newCharacterData('Newbie', 'sword'), gold: 5000 });
const alt = hub.addPlayer({ ...newCharacterData('Alt', 'mage'), gold: 5000 });
p.tut = acc;
alt.tut = acc;

// ---- the start: only the merchant has a !
ok(tutRows(acc, p.name).map((r) => r.state).join() === 'offer,locked,locked,locked,locked', 'only the first step is offered');
ok(mark(p, 'merchant') === '!' && mark(p, 'keeper') === '' && mark(p, 'blacksmith') === '' && mark(p, 'broker') === '', '! over the merchant only');

// ---- shop: taken only at the merchant, gives 1,000 G, counts only real buys/sells after taking it
p.x = 9999;
ok(!hub.tutAccept(p, 'shop'), 'only beside the merchant');
at(p, 'keeper');
ok(!hub.tutAccept(p, 'stash'), 'a later step is locked');
at(p, 'merchant');
hub.buyPotion(p, 'hp', 's', 1);
const g0 = p.gold;
ok(hub.tutAccept(p, 'shop') && p.gold === g0 + TUT_ACCEPT_GOLD, `taken, +${TUT_ACCEPT_GOLD} G`);
ok(acc.cur?.got.length === 0, 'a buy before taking it does not count');
ok(!hub.tutAccept(p, 'shop') && p.gold === g0 + TUT_ACCEPT_GOLD, 'not taken twice (no second gold)');
ok(state(alt, 'shop') === 'busy' && !hub.tutAccept(alt, 'shop'), 'another character of the account sees it busy and cannot take it');
ok(mark(p, 'merchant') === '', 'no mark while under way');
ok(!hub.tutTurnIn(p, 'shop'), 'nothing to hand in yet');
hub.buyPotion(p, 'mp', 's', 1);
hub.buyReturnScroll(p, 1);
ok(state(p, 'shop') === 'going', 'still going before selling');
hub.tutTask(alt, 'sell');
ok(!acc.cur!.got.includes('sell'), "another character's sell does not count");
const sellAt = p.bag.findIndex((e) => e && isPotion(e));
hub.sellItem(p, sellAt);
ok(state(p, 'shop') === 'ready' && mark(p, 'merchant') === '?', 'ready: ? over the merchant');

// ---- handing in: reward from the tuning, every item bound; the step is done for the whole account
const got = hub.tutTurnIn(p, 'shop');
ok(!!got && acc.done.includes('shop') && !acc.cur, 'handed in');
ok(!!got && got.reward.items.length === 2 && got.reward.items.every((it) => it.kind !== 'equip' && it.bound === true), 'the shop reward: two potion lines, bound');
got?.undo();
ok(!acc.done.includes('shop') && acc.cur?.step === 'shop', 'undo (mail failed) puts it back');
ok(!!hub.tutTurnIn(p, 'shop'), 'and it can be handed in again then');
ok(!hub.tutTurnIn(p, 'shop'), 'not twice');
ok(state(alt, 'shop') === 'done' && state(alt, 'stash') === 'offer', 'the alt sees it done; the next step is offered to both');
ok(mark(p, 'keeper') === '!', '! moves to the keeper');

// ---- stash: put an item and gold in
at(p, 'keeper');
ok(hub.tutAccept(p, 'stash'), 'stash step taken');
hub.stashGold(p, 100);
const it = gear();
p.addToBag(it);
hub.stashPut(p, p.bag.indexOf(it));
ok(state(p, 'stash') === 'ready', 'item + gold put away: ready');
ok(hub.tutTurnIn(p, 'stash')?.reward.gold === 3000, 'the stash step gives 3,000 G (code)');

// ---- enhance: one try counts, success or not
at(p, 'blacksmith');
ok(hub.tutAccept(p, 'enhance'), 'enhance step taken');
const sword = gear();
p.addToBag(sword);
p.forgeAt = -1e9;
ok(!!hub.enhance(p, sword.uid, false) && state(p, 'enhance') === 'ready', 'one enhance: ready');
const enh = hub.tutTurnIn(p, 'enhance');
ok(enh?.reward.items.length === 1 && enh.reward.items[0].kind === 'stone' && enh.reward.items[0].stone === 'protect', 'a protection stone');

// ---- reroll: bound stones into the bag on taking it (refused with a full bag), then both rerolls
const saved = [...p.bag];
for (let i = 0; i < p.bag.length; i++) p.bag[i] ??= gear();
const goldFull = p.gold;
ok(!hub.tutAccept(p, 'reroll') && p.gold === goldFull && !acc.cur, 'a full bag: not taken, no gold');
p.bag.splice(0, p.bag.length, ...saved);
ok(hub.tutAccept(p, 'reroll'), 'reroll step taken');
const bound = p.bag.filter((e) => isStone(e) && e.bound);
ok(bound.length === 2 && p.stoneCount('reroll_values') === 1 && p.stoneCount('reroll_stat') === 1, 'one bound stone of each kind in the bag');
p.forgeAt = -1e9;
ok(!!hub.reroll(p, sword.uid, 'values'), 'reroll values (uses the bound stone)');
ok(state(p, 'reroll') === 'going', 'one of two: still going');
p.forgeAt = -1e9;
ok(!!hub.reroll(p, sword.uid, 'stat') && state(p, 'reroll') === 'ready', 'and stat: ready');
ok(p.stoneCount('reroll_values') === 0 && p.stoneCount('reroll_stat') === 0, 'the given stones were used');
ok(!!hub.tutTurnIn(p, 'reroll'), 'reroll handed in');

// ---- market: the server counts a listing (server/world.ts), the last step adds the chain's reward
at(p, 'broker');
ok(hub.tutAccept(p, 'market'), 'market step taken');
ok(hub.tutTask(p, 'marketList') && !hub.tutTask(p, 'marketList'), 'a listing counts once');
const last = hub.tutTurnIn(p, 'market');
const code = codeTutorial();
ok(last?.reward.gold === code.market.gold + code.final.gold, 'last step: its reward plus the final 10,000 G');
ok(!!last && last.reward.items.some((x) => x.kind === 'stone' && x.stone === 'exp_scroll') && last.reward.items.some((x) => x.kind === 'stone' && x.stone === 'drop_scroll'), 'EXP and drop scrolls');
ok(TUT_STEPS.every((s) => state(alt, s) === 'done') && (['merchant', 'keeper', 'blacksmith', 'broker'] as NpcId[]).every((n) => mark(alt, n) === ''), 'all done for the account: no marks for the alt either');

// ---- bound stacks: never merge with bought ones, stay in the bag
{
  const q = hub.addPlayer(newCharacterData('Binder', 'sword'));
  q.bag.fill(null);
  const entries = rollAttach(tutTurnInReward('shop', codeTutorial()), 'sword', 1);
  ok(putAll(q.bag, entries) && q.bag.filter((e) => isPotion(e) && e.bound).length === 2, 'the claimed shop reward: two bound potion stacks');
  ok(q.addPotions('hp', 's', 3) && q.bag.filter((e) => isPotion(e) && e.potion === 'hp' && e.size === 's').length === 2, 'bought potions go to their own stack');
  ok(q.potionCount('hp', 's') === 13, 'both count for drinking');
  const b = q.bag.find((e): e is PotionStack => isPotion(e) && !!e.bound)!;
  ok(isBound(b) && !sameStack(b, { potion: b.potion, size: b.size, count: 1 }), 'isBound, and does not merge with an unbound stack');
  const sorted = sortEntries(q.bag, 'rarity', false);
  ok(sorted.filter((e) => isPotion(e) && e.bound).length === 2 && sorted.filter((e) => isPotion(e) && !e.bound).length === 1, 'sorting keeps bound and unbound apart');
  at(q, 'merchant');
  const gold = q.gold;
  ok(hub.sellItem(q, q.bag.indexOf(b)) === 0 && q.gold === gold, 'a bound stack cannot be sold');
}

// ---- save rows: garbage never breaks a login
ok(JSON.stringify(cleanTutorial(null)) === '{"done":[]}', 'no row: nothing done');
ok(JSON.stringify(cleanTutorial({ done: ['shop', 'shop', 'x'], cur: { step: 'stash', by: 'A', got: ['stashGold', 'sell'] } })) === '{"done":["shop"],"cur":{"step":"stash","by":"A","got":["stashGold"]}}', 'unknown steps/tasks dropped');
ok(!cleanTutorial({ done: ['shop'], cur: { step: 'shop', by: 'A', got: [] } }).cur, 'a done step cannot be under way');

// ---- /admin reward tuning (inside the balance tuning)
ok(JSON.stringify(checkTutorialTuning(codeTutorial(), true)) === '{}', 'equal to the code: nothing stored');
const more = { ...codeTutorial(), stash: { gold: 5000, items: [{ kind: 'stone', stone: 'protect', count: 2 }] } };
const c = checkTutorialTuning(more, true);
ok('tuning' in c && JSON.stringify(c.tuning) === JSON.stringify({ stash: more.stash }), 'only the changed reward is stored');
ok('error' in checkTutorialTuning({ stash: { gold: -1, items: [] } }, true), 'negative gold refused');
ok('error' in checkTutorialTuning({ stash: { gold: 0, items: [{ kind: 'stone', stone: 'qkey_bear', count: 1 }] } }, true), 'quest keys refused');
ok('error' in checkTutorialTuning({ nope: {} }, true), 'unknown key refused (strict)');
ok(mergeTutorial(c && 'tuning' in c ? c.tuning : undefined).stash.gold === 5000, 'merged on top of the code');
const bal = checkBalance({ ...codeBalance(), tutorial: more }, true);
ok('tuning' in bal && bal.tuning?.tutorial?.stash?.gold === 5000, 'saved through the balance tuning');
applyBalance(('tuning' in bal && bal.tuning) || {});
ok(currentBalance().tutorial.stash.gold === 5000 && (tutTurnInReward('stash', currentBalance().tutorial).items[0] as { bound?: true }).bound === true, 'the game uses it; items still given bound');
applyBalance({});

// ---- the DB row: saved per account; a step held by a deleted character is dropped
{
  const dir = mkdtempSync(join(tmpdir(), 'multiverse-tut-'));
  const db = new Db(join(dir, 't.db'));
  const id = db.createAccount('tutor', 'scrypt$aa$bb')!;
  const ch = db.createCharacter(id, newCharacterData('TutorA', 'sword'));
  ok(JSON.stringify(db.loadTutorial(id)) === '{"done":[]}', 'a new account: nothing done');
  db.saveTutorial(id, { done: ['shop'], cur: { step: 'stash', by: 'TutorA', got: ['stashGold'] } });
  ok(db.loadTutorial(id).cur?.got.join() === 'stashGold', 'saved and read back');
  db.deleteCharacter(id, ch.id);
  const t = db.loadTutorial(id);
  ok(!t.cur && t.done.join() === 'shop', 'its character deleted: the step under way is dropped, done stays');
  db.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the file; it is in the temp folder.
  }
}

finish('tutorial quests');
