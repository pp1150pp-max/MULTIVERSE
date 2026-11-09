// The mailbox against a throwaway database: sending to a character / an account / everyone, reading,
// claiming exactly once and all-or-nothing, deleting, expiry, pulling a mail back, and guests.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { Mail, type MailActor } from '../server/mail';
import { Sim } from '../src/shared/sim/Sim';
import { newCharacterData } from '../src/shared/sim/Player';
import { cleanStash } from '../src/shared/sim/stash';
import { HUB_ID, ZONES } from '../src/shared/data/zones';
import { makeItem } from '../src/shared/data/items';
import { isItem, isPotion, type Item } from '../src/shared/types';
import { cleanAttach, MAIL_MS, type MailAttach, type MailCall, type MailReply } from '../src/shared/mail';
import { finish, ok } from './check';

const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
const db = new Db(join(dir, 'mail.db'));
let clock = Date.now();
const mail = new Mail(db, () => clock);
const sim = new Sim(ZONES[HUB_ID]);
const ADMIN = { id: null, name: 'Owner' };

/** A character of an existing account (or a new one) that is "online". */
function actor(name: string, accountId?: number, guest = false): MailActor {
  const data = newCharacterData(name, 'mage');
  data.level = 40;
  let acc = accountId;
  let charId: number;
  if (guest) {
    const g = db.createGuest(`g-${name}`, data);
    acc = g.accountId;
    charId = g.character.id;
  } else {
    acc ??= db.createAccount(`acc-${name}`, 'x')!;
    charId = db.createCharacter(acc, data).id;
  }
  const player = sim.addPlayer(data);
  player.stash = cleanStash(null);
  return { accountId: acc, charId, guest, player, sim };
}
const call = (a: MailActor, c: MailCall): MailReply => mail.handle(a, c);
const list = (a: MailActor) => call(a, { a: 'mailList' }).list!;
const send = (target: object, attach: MailAttach | object | undefined, title = 'หัวข้อ', body = 'เนื้อหา') =>
  mail.send(ADMIN, { target: target as never, title, body, attach });
const free = (a: MailActor) => a.player.bag.filter((e) => !e).length;
const saved = (a: MailActor) => db.loadCharacter(a.accountId, a.charId)!;

const alice = actor('Alice');
const aliceAlt = actor('AliceAlt', alice.accountId);
const bob = actor('Bob');
const guest = actor('Guesty', undefined, true);

// ------------------------------------------------------------ checking what the admin sends
{
  ok(typeof cleanAttach({ gold: 1_000_001 }) === 'string', 'gold over the cap is refused');
  ok(typeof cleanAttach({ items: [{ kind: 'stone', stone: 'enhance', count: 11 }] }) === 'string', 'more than 10 pieces of one line is refused');
  ok(typeof cleanAttach({ items: [{ kind: 'potion', potion: 'hp', size: 'l', count: 6 }, { kind: 'potion', potion: 'mp', size: 'l', count: 5 }] }) === 'string', '10 pieces is the total per mail');
  ok(typeof cleanAttach({ items: [{ kind: 'equip', baseId: 'nope', rarity: 'rare', plus: 0, count: 1 }] }) === 'string', 'unknown gear kind is refused');
  ok(typeof cleanAttach({ items: [{ kind: 'equip', baseId: 'necklace_3', rarity: 'rare', plus: 99, count: 1 }] }) === 'string', 'plus over the max is refused');
  ok(typeof send({ kind: 'char', name: 'Alice' }, { gold: 1.5 }) === 'string', 'a fractional gold amount is refused');
  ok(send({ kind: 'char', name: 'Alice' }, undefined, '') === 'พิมพ์หัวข้อจดหมายก่อน', 'a mail needs a title');
  ok(typeof send({ kind: 'char', name: 'Alice' }, undefined, 'x'.repeat(61)) === 'string', 'a title over 60 characters is refused');
  ok(typeof send({ kind: 'char', name: 'Alice' }, undefined, 't', 'x'.repeat(1001)) === 'string', 'a body over 1000 characters is refused');
  ok(typeof send({ kind: 'char', name: 'Nobody' }, undefined) === 'string', 'unknown character');
  ok(typeof send({ kind: 'char', name: 'Guesty' }, undefined) === 'string', 'a guest character cannot be sent to');
  ok(typeof send({ kind: 'account', username: 'acc-Nobody' }, undefined) === 'string', 'unknown account');
  ok(typeof send({ kind: 'what' }, undefined) === 'string', 'unknown target kind');
  ok(db.mailHistory(10).length === 0, 'a refused send leaves nothing behind');
}

// ------------------------------------------------------------ gear made for one class
{
  const orb = { items: [{ kind: 'equip', baseId: 'orb_1', rarity: 'rare', plus: 0, count: 1 }] };
  ok(typeof send({ kind: 'account', username: 'acc-Alice' }, orb) === 'string', 'one-class gear cannot go to an account');
  ok(typeof send({ kind: 'allChars' }, orb) === 'string' && typeof send({ kind: 'allAccounts' }, orb) === 'string', 'nor to everyone');
  ok(typeof send({ kind: 'char', name: 'Bob' }, { items: [{ kind: 'equip', baseId: 'scabbard_1', rarity: 'rare', plus: 0, count: 1 }] }) === 'string', 'nor to a character of another class (Bob is a mage)');
  const okSend = send({ kind: 'char', name: 'Bob' }, orb);
  ok(typeof okSend !== 'string', 'one-class gear can go to one character of that class');
  ok(typeof send({ kind: 'allChars' }, { items: [{ kind: 'equip', baseId: 'weapon_1', rarity: 'rare', plus: 0, count: 1 }] }) !== 'string', 'gear that exists for every class can go to everyone');
  if (typeof okSend !== 'string') mail.recall(okSend.id);
  mail.recall(1);
  for (const r of db.mailHistory(50)) mail.recall(r.id);
}

// ------------------------------------------------------------ guests
{
  ok(!call(guest, { a: 'mailList' }).ok, 'a guest has no mailbox');
}

// ------------------------------------------------------------ one character: text only
{
  const r = send({ kind: 'char', name: 'alice' }, undefined, 'สวัสดี', 'ข้อความทดสอบ');
  ok(typeof r !== 'string' && r.copies === 1, 'send to one character (name in any case)');
  ok(list(alice).length === 1 && list(alice)[0].title === 'สวัสดี', 'that character sees it');
  ok(list(aliceAlt).length === 0 && list(bob).length === 0, 'its other characters and other accounts do not');
  ok(call(alice, { a: 'mailList' }).unread === 1, 'unread count is 1');
  const id = list(alice)[0].id;
  ok(!call(alice, { a: 'mailDelete', id }).ok, 'cannot delete mail you have not read');
  ok(!call(bob, { a: 'mailRead', id }).ok, "another account cannot read it by guessing its id");
  const read = call(alice, { a: 'mailRead', id });
  ok(read.ok && read.mail?.body === 'ข้อความทดสอบ' && read.unread === 0, 'reading it gives the text and clears the unread count');
  ok(!list(alice)[0].attach, 'text-only mail has no attachment');
  ok(!call(alice, { a: 'mailClaim', id }).ok, 'nothing to claim on text-only mail');
  ok(call(alice, { a: 'mailDelete', id }).ok && list(alice).length === 0, 'read text-only mail can be deleted');
}

// ------------------------------------------------------------ claiming: once only, saved, fresh uids
{
  const gear = send({ kind: 'char', name: 'Alice' }, { gold: 500, items: [
    { kind: 'equip', baseId: 'necklace_3', rarity: 'epic', plus: 2, count: 2 },
    { kind: 'potion', potion: 'hp', size: 'l', count: 3 },
    { kind: 'stone', stone: 'enhance', count: 4 },
  ] }, 'ของขวัญ');
  ok(typeof gear !== 'string', 'send gear, potions and stones');
  const head = list(alice)[0];
  ok(head.attach, 'the list shows it has attachments');
  const goldBefore = alice.player.gold;
  const first = call(alice, { a: 'mailClaim', id: head.id });
  ok(first.ok, `claim works (${first.msg})`);
  const necks = alice.player.bag.filter((e): e is Item => isItem(e) && e.baseId === 'necklace_3');
  ok(necks.length === 2 && necks.every((n) => n.plus === 2 && n.rarity === 'epic'), 'two +2 epic necklaces arrived');
  ok(necks[0].uid !== necks[1].uid, 'each piece has its own uid');
  ok(alice.player.gold === goldBefore + 500, 'gold arrived');
  ok(alice.player.bag.some((e) => isPotion(e) && e.potion === 'hp' && e.size === 'l' && e.count === 3), 'potions arrived');
  ok(alice.player.bag.some((e) => e && 'stone' in e && e.stone === 'enhance' && e.count === 4), 'stones arrived');
  ok(saved(alice).gold === goldBefore + 500 && saved(alice).bag.filter((e) => e && isItem(e) && e.baseId === 'necklace_3').length === 2, 'the character was saved with the claim');
  const again = call(alice, { a: 'mailClaim', id: head.id });
  ok(!again.ok && alice.player.gold === goldBefore + 500 && alice.player.bag.filter((e) => isItem(e) && e.baseId === 'necklace_3').length === 2, 'a second claim gives nothing');
  ok(!call(alice, { a: 'mailClaim', id: -1 }).ok, 'claim all has nothing left to claim');
  ok(!list(alice)[0].attach, 'the list shows it as claimed');
  ok(call(alice, { a: 'mailDelete', id: head.id }).ok, 'claimed mail can be deleted');
}

// ------------------------------------------------------------ all or nothing, and no delete while unclaimed
{
  const a = actor('Packer');
  send({ kind: 'char', name: 'Packer' }, { gold: 100, items: [{ kind: 'equip', baseId: 'necklace_3', rarity: 'rare', plus: 0, count: 3 }] }, 'สามชิ้น');
  const id = list(a)[0].id;
  for (let i = 0; i < a.player.bag.length - 2; i++) a.player.bag[i] = makeItem('ring_jade', 'common', 1, 'mage')!;
  ok(free(a) === 2, 'the bag has 2 free slots');
  const gold = a.player.gold;
  const r = call(a, { a: 'mailClaim', id });
  ok(!r.ok && /3/.test(r.msg ?? ''), `too little room: refused and told how many slots it needs (${r.msg})`);
  ok(free(a) === 2 && a.player.gold === gold && !a.player.bag.some((e) => isItem(e) && e.baseId === 'necklace_3'), 'nothing was given, not even the gold');
  ok(list(a)[0].attach, 'the mail is still claimable');
  ok(!call(a, { a: 'mailDelete', id }).ok && list(a).length === 1, 'cannot delete mail with unclaimed attachments');
  call(a, { a: 'mailRead', id });
  ok(!call(a, { a: 'mailDelete', id }).ok, 'still cannot delete after reading it');
  call(a, { a: 'mailDeleteRead' });
  ok(list(a).length === 1, '"delete all read" keeps it too');
  a.player.bag[0] = null;
  ok(call(a, { a: 'mailClaim', id: -1 }).ok && free(a) === 0, 'with exactly 3 free slots "claim all" takes it');
  ok(call(a, { a: 'mailDeleteRead' }).ok && list(a).length === 0, '"delete all read" now removes it');
}

// ------------------------------------------------------------ stacks count toward the room check
{
  const a = actor('Stacker');
  for (let i = 0; i < a.player.bag.length; i++) a.player.bag[i] = makeItem('ring_jade', 'common', 1, 'mage')!;
  a.player.bag[5] = { potion: 'hp', size: 'l', count: 7 };
  send({ kind: 'char', name: 'Stacker' }, { items: [{ kind: 'potion', potion: 'hp', size: 'l', count: 5 }] });
  ok(!call(a, { a: 'mailClaim', id: -1 }).ok, 'a full bag cannot take potions that overflow the stack (7 + 5 > 10, no empty slot)');
  a.player.bag[5] = { potion: 'hp', size: 'l', count: 5 };
  ok(call(a, { a: 'mailClaim', id: -1 }).ok && (a.player.bag[5] as { count: number }).count === 10, 'potions top up an existing stack when it has room');
}

// ------------------------------------------------------------ a stored mail is not re-checked against today's caps
{
  const a = actor('OldCaps');
  const sendId = db.mailSendInsert({ senderId: null, senderName: 'Owner', target: 't', title: 'เก่า', body: '', attach: JSON.stringify({ gold: 5_000_000, items: [{ kind: 'equip', baseId: 'gone_kind', rarity: 'rare', plus: 0, count: 1 }] }), hasAttach: true, at: clock, expiresAt: clock + MAIL_MS });
  db.mailBoxAdd(sendId, a.accountId, a.charId);
  const g = a.player.gold;
  ok(call(a, { a: 'mailClaim', id: list(a)[0].id }).ok && a.player.gold === g + 5_000_000, 'gold above the old cap still arrives; a removed item kind is skipped');
}

// ------------------------------------------------------------ per account: claimed once, by whichever character
{
  const r = send({ kind: 'account', username: 'acc-Alice' }, { gold: 1000 }, 'ทั้งบัญชี');
  ok(typeof r !== 'string' && r.copies === 1, 'send to one account');
  ok(list(alice).length === 1 && list(aliceAlt).length === 1, 'every character of the account sees it');
  ok(list(bob).length === 0, 'other accounts do not');
  const id = list(alice)[0].id;
  const g = alice.player.gold + aliceAlt.player.gold;
  const results = [call(alice, { a: 'mailClaim', id }), call(aliceAlt, { a: 'mailClaim', id })];
  ok(results.filter((x) => x.ok).length === 1, 'exactly one of the two characters gets it');
  ok(alice.player.gold + aliceAlt.player.gold === g + 1000, 'the gold was given once');
  ok(!list(alice)[0].attach && !list(aliceAlt)[0].attach, 'it shows as claimed for both characters');
}

// ------------------------------------------------------------ everyone
{
  const before = db.mailHistory(100).length;
  const chars = send({ kind: 'allChars' }, { gold: 10 }, 'ทุกตัวละคร');
  const accs = send({ kind: 'allAccounts' }, { gold: 20 }, 'ทุกบัญชี');
  const realAccounts = 5; // Alice, Bob, Packer, Stacker, OldCaps (the guest is excluded)
  ok(typeof chars !== 'string' && chars.copies === 6, `every character gets a copy (Alice's account has 2): ${typeof chars !== 'string' ? chars.copies : chars}`);
  ok(typeof accs !== 'string' && accs.copies === realAccounts, `every account gets one copy, guests excluded: ${typeof accs !== 'string' ? accs.copies : accs}`);
  ok(db.mailHistory(100).length === before + 2, 'two sends were recorded');
  ok(list(alice).some((m) => m.title === 'ทุกตัวละคร') && list(aliceAlt).some((m) => m.title === 'ทุกตัวละคร'), 'both of Alice\'s characters have their own "every character" copy');
  ok(list(alice).filter((m) => m.title === 'ทุกบัญชี').length === 1 && list(aliceAlt).filter((m) => m.title === 'ทุกบัญชี').length === 1, 'the account copy is shared by her characters');
  ok(db.mailInbox(guest.accountId, guest.charId, clock).length === 0, 'the guest got nothing');
  const late = actor('Latecomer');
  ok(list(late).length === 0, 'a character made after the send gets nothing');
  const mine = list(alice).find((m) => m.title === 'ทุกตัวละคร')!;
  const gold = alice.player.gold;
  call(alice, { a: 'mailClaim', id: mine.id });
  ok(alice.player.gold === gold + 10, 'Alice claims her copy');
  ok(list(aliceAlt).find((m) => m.title === 'ทุกตัวละคร')!.attach, "AliceAlt's own copy is still unclaimed");
  const goldAlt = aliceAlt.player.gold;
  call(aliceAlt, { a: 'mailClaim', id: list(aliceAlt).find((m) => m.title === 'ทุกตัวละคร')!.id });
  ok(aliceAlt.player.gold === goldAlt + 10, 'AliceAlt claims hers too (one per character)');
}

// ------------------------------------------------------------ new-mail notices
{
  const n = actor('Noticed');
  ok(mail.takeFresh(n) === 0, 'nothing new yet');
  send({ kind: 'char', name: 'Noticed' }, undefined, 'a');
  send({ kind: 'char', name: 'Noticed' }, undefined, 'b');
  ok(mail.unread(n) === 2, 'two unread');
  ok(mail.takeFresh(n) === 2 && mail.takeFresh(n) === 0, 'two new, told once');
}

// ------------------------------------------------------------ pulling a mail back
{
  const a = actor('Recalled');
  const b = actor('RecalledB');
  const r = send({ kind: 'allChars' }, { gold: 7 }, 'ผิดพลาด');
  if (typeof r === 'string') throw new Error(r);
  const mineA = list(a).find((m) => m.title === 'ผิดพลาด')!;
  call(a, { a: 'mailClaim', id: mineA.id });
  const pulled = mail.recall(r.id);
  ok(typeof pulled === 'number' && pulled > 0, `recall pulls back the copies nobody claimed (${pulled})`);
  ok(!list(b).some((m) => m.title === 'ผิดพลาด'), 'a pulled-back mail disappears');
  ok(list(a).some((m) => m.title === 'ผิดพลาด'), 'the copy already claimed stays');
  const row = db.mailHistory(1)[0];
  ok(row.claimed >= 1 && row.recalled === (pulled as number), 'the history counts claimed and pulled-back copies');
  ok(typeof mail.recall(r.id) === 'string', 'nothing left to pull back the second time');
  ok(!call(b, { a: 'mailRead', id: mineA.id }).ok, 'a pulled-back mail cannot be read');
  // A claim racing a recall can't give anything once the copy is recalled.
  const c = actor('RecalledC');
  const r2 = send({ kind: 'char', name: 'RecalledC' }, { gold: 5 }, 'x');
  if (typeof r2 === 'string') throw new Error(r2);
  const idC = list(c)[0].id;
  mail.recall(r2.id);
  const g = c.player.gold;
  ok(!call(c, { a: 'mailClaim', id: idC }).ok && c.player.gold === g, 'cannot claim a recalled mail');
  ok(!db.mailMarkClaimed(idC, c.charId, clock), 'the database refuses it too (the guard behind the transaction)');
}

// ------------------------------------------------------------ the database guard against a double claim
{
  const a = actor('Racer');
  send({ kind: 'char', name: 'Racer' }, { gold: 3 }, 'r');
  const id = list(a)[0].id;
  ok(db.mailMarkClaimed(id, a.charId, clock) && !db.mailMarkClaimed(id, a.charId, clock), 'the claim mark succeeds once and then never again');
}

// ------------------------------------------------------------ expiry
{
  const a = actor('Expirer');
  send({ kind: 'char', name: 'Expirer' }, { gold: 9 }, 'หมดอายุ');
  const id = list(a)[0].id;
  clock += MAIL_MS - 1000;
  ok(list(a).length === 1, 'still there just before 30 days');
  clock += 2000;
  ok(list(a).length === 0, 'gone after 30 days');
  const g = a.player.gold;
  ok(!call(a, { a: 'mailClaim', id }).ok && a.player.gold === g, 'expired attachments cannot be claimed');
  ok(mail.unread(a) === 0, 'expired mail is not counted as unread');
}

finish('mail');
