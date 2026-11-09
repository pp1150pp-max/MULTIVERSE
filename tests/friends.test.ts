// Friends (server/friends.ts): requests that wait in the database (offline players can be asked), accepting,
// asking back, declining, cancelling, removing, the 50-friend and 20-pending caps, the re-request gap,
// guests, characters of one account, blocks (end friendship and requests, stop new requests, neutral
// wording), what the list shows (the character played now or last), and that deleting an account cleans up.
// Uses a throwaway database, a fake host and a fake clock, no server needed.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { FRIEND_GUEST_MSG, Friends, type FriendActor } from '../server/friends';
import { newCharacterData } from '../src/shared/sim/Player';
import { BLOCK_MAX, FRIEND_MAX, FRIEND_PENDING_MAX, FRIEND_REREQUEST_GAP, type FriendChar } from '../src/shared/friends';
import { finish, ok } from './check';

const dir = mkdtempSync(join(tmpdir(), 'multiverse-friends-'));
const db = new Db(join(dir, 'test.db'));
let clock = 1_000_000;
const lines = new Map<number, string[]>();
const changed: number[] = [];
const playing = new Map<number, FriendChar>();
const fr = new Friends(db, {
  playing: (acc) => playing.get(acc) ?? null,
  tell: (acc, text) => lines.set(acc, [...(lines.get(acc) ?? []), text]),
  changed: (acc) => changed.push(acc),
}, () => clock);
const said = (acc: number, part: string) => (lines.get(acc) ?? []).some((t) => t.includes(part));

let n = 0;
/** A member account with one character per name. */
function member(...names: string[]): FriendActor {
  const id = db.createAccount(`user${n++}`, 'x')!;
  for (const name of names) db.createCharacter(id, newCharacterData(name, 'sword'));
  return { accountId: id, guest: false };
}

try {
  const a = member('Alpha', 'AlphaTwo');
  const b = member('Bravo');
  const c = member('Charlie');
  const g = db.createGuest('gx', newCharacterData('Guesty', 'mage'));
  const guest: FriendActor = { accountId: g.accountId, guest: true };

  // ------------------------------------------------ who may ask
  ok(fr.request(guest, 'Bravo') === FRIEND_GUEST_MSG, 'a guest cannot send requests');
  ok(fr.request(a, 'Guesty')?.includes('Guest'), 'a guest cannot be asked');
  ok(fr.request(a, 'AlphaTwo')?.includes('บัญชีตัวเอง'), 'a character of your own account cannot be asked');
  ok(fr.request(a, 'Nobody')?.includes('ไม่พบ'), 'an unknown name is refused');
  for (const bad of [42, null, '', ' ', 'x'.repeat(41)]) ok(fr.request(a, bad) === null && !db.outgoingRequests(a.accountId).length, `bad name ${JSON.stringify(bad)} does nothing`);

  // ------------------------------------------------ a request to an offline player waits; accepting
  ok(fr.request(a, 'bravo') === null, 'any case finds the name (Bravo is offline)');
  ok(db.hasFriendRequest(a.accountId, b.accountId), 'the request is saved');
  ok(said(a.accountId, 'ส่งคำขอ') && said(b.accountId, 'ขอเป็นเพื่อน'), 'both are told');
  ok(fr.request(a, 'Bravo')?.includes('รอคำตอบ'), 'asking twice is refused');
  ok(fr.view(b.accountId).incoming[0]?.acc === a.accountId && fr.view(a.accountId).outgoing[0]?.acc === b.accountId, 'it shows as incoming / outgoing');
  ok(fr.answer(b, a.accountId, true) === null && db.areFriends(a.accountId, b.accountId), 'Bravo accepts: friends');
  ok(!db.hasFriendRequest(a.accountId, b.accountId), 'the request is gone');
  ok(fr.request(a, 'Bravo')?.includes('เป็นเพื่อนกับคุณอยู่แล้ว'), 'asking a friend is refused');
  ok(fr.answer(b, a.accountId, true) === 'คำขอนี้ไม่มีแล้ว', 'accepting a request that is gone is refused');
  for (const bad of ['1', null, 1.5]) ok(fr.answer(b, bad, true) === null, `bad account ${JSON.stringify(bad)} does nothing`);

  // ------------------------------------------------ what the list shows
  let v = fr.view(a.accountId);
  ok(v.friends.length === 1 && !v.friends[0].online && v.friends[0].char?.name === 'Bravo' && v.friends[0].char.lv === 1, 'offline: the last character, its level');
  playing.set(b.accountId, { name: 'Bravo', cls: 'sword', lv: 7, zone: 'forest' });
  v = fr.view(a.accountId);
  ok(v.friends[0].online && v.friends[0].char?.lv === 7 && v.friends[0].char.zone === 'forest', 'online: the live character, level and map');
  playing.delete(b.accountId);
  ok(fr.view(b.accountId).friends[0]?.char?.name !== undefined, 'the friendship shows on both sides');

  // ------------------------------------------------ asking back accepts; declining; cancelling; removing
  clock += 1000;
  ok(fr.request(c, 'Alpha') === null, 'Charlie asks Alpha');
  ok(fr.request(a, 'Charlie') === null && db.areFriends(a.accountId, c.accountId) && !db.outgoingRequests(c.accountId).length, 'asking back accepts at once');
  ok(fr.remove(a, c.accountId) === null && !db.areFriends(a.accountId, c.accountId), 'removing ends it on both sides');
  ok(fr.remove(a, c.accountId) === 'ไม่ได้เป็นเพื่อนกันอยู่', 'removing again is refused');
  clock += FRIEND_REREQUEST_GAP * 1000;
  fr.request(c, 'Alpha');
  ok(fr.answer(a, c.accountId, false) === null && !db.areFriends(a.accountId, c.accountId) && !db.hasFriendRequest(c.accountId, a.accountId), 'declining drops the request');
  ok(fr.request(c, 'Alpha')?.includes('ซ้ำได้อีกใน'), 'the same request again within the gap is refused');
  clock += FRIEND_REREQUEST_GAP * 1000;
  ok(fr.request(c, 'Alpha') === null, 'after the gap it may be sent again');
  ok(fr.cancel(c, a.accountId) === null && !db.hasFriendRequest(c.accountId, a.accountId), 'the sender can cancel it');

  // ------------------------------------------------ blocks
  clock += FRIEND_REREQUEST_GAP * 1000;
  fr.request(c, 'Alpha');
  ok(fr.block(a, 'Bravo') === null && fr.blocks(a.accountId, b.accountId) && !db.areFriends(a.accountId, b.accountId), 'blocking a friend ends the friendship');
  ok(fr.block(a, 'Charlie') === null && !db.hasFriendRequest(c.accountId, a.accountId), 'blocking drops a waiting request');
  ok(!fr.blocks(b.accountId, a.accountId), 'a block is one way');
  clock += FRIEND_REREQUEST_GAP * 1000;
  const r = fr.request(b, 'Alpha');
  ok(r === 'ส่งคำขอเป็นเพื่อนถึง Alpha ไม่ได้' && !db.hasFriendRequest(b.accountId, a.accountId), 'the blocked one cannot ask, and is not told why');
  ok(fr.request(a, 'Bravo')?.includes('ปลดบล็อก'), 'the blocker cannot ask either until unblocking');
  ok(fr.block(a, 'Bravo')?.includes('อยู่แล้ว'), 'blocking twice is refused');
  ok(fr.block(a, 'AlphaTwo')?.includes('บัญชีตัวเอง'), 'cannot block your own account');
  ok(fr.block(guest, 'Bravo') === FRIEND_GUEST_MSG, 'a guest cannot block');
  ok(fr.block(a, 'Guesty') === null && fr.blocks(a.accountId, g.accountId), 'a member may block a guest (whispers)');
  ok(fr.view(a.accountId).blocked.map((x) => x.name).join() === 'Bravo,Charlie,Guesty', 'the block list shows names');
  ok(fr.unblock(a, b.accountId) === null && !fr.blocks(a.accountId, b.accountId), 'unblocking');
  clock += FRIEND_REREQUEST_GAP * 1000;
  ok(fr.request(b, 'Alpha') === null, 'after unblocking the request goes through');

  // ------------------------------------------------ caps
  for (let i = 0; i <= FRIEND_PENDING_MAX; i++) member(`Pend${i}`);
  const d = member('Delta');
  let sent = 0;
  for (let i = 0; i < FRIEND_PENDING_MAX; i++) if (fr.request(d, `Pend${i}`) === null) sent++;
  ok(sent === FRIEND_PENDING_MAX, `${FRIEND_PENDING_MAX} requests may wait at once`);
  ok(fr.request(d, `Pend${FRIEND_PENDING_MAX}`)?.includes(`${FRIEND_PENDING_MAX}`), `request ${FRIEND_PENDING_MAX + 1} waiting at once is refused`);

  const e = member('Echo');
  const pals = Array.from({ length: FRIEND_MAX + 1 }, (_, i) => member(`Pal${i}`));
  for (let i = 0; i < FRIEND_MAX; i++) db.addFriend(e.accountId, pals[i].accountId);
  ok(fr.request(e, `Pal${FRIEND_MAX}`)?.includes(`${FRIEND_MAX}`), `a full list (${FRIEND_MAX}) cannot ask`);
  ok(fr.request(pals[FRIEND_MAX], 'Echo')?.includes('เต็มแล้ว'), 'nobody can ask an account whose list is full');
  db.removeFriend(e.accountId, pals[0].accountId);
  fr.request(pals[FRIEND_MAX], 'Echo');
  db.addFriend(e.accountId, pals[0].accountId);
  ok(fr.answer(e, pals[FRIEND_MAX].accountId, true)?.includes('เต็ม') && !db.areFriends(e.accountId, pals[FRIEND_MAX].accountId), 'the cap is checked again on accepting');

  const f = member('Foxtrot');
  for (let i = 0; i < BLOCK_MAX; i++) db.addBlock(f.accountId, member(`Blk${i}`).accountId);
  ok(fr.block(f, 'Echo')?.includes(`${BLOCK_MAX}`), `block ${BLOCK_MAX + 1} is refused`);

  // ------------------------------------------------ deleting an account cleans up (ON DELETE CASCADE)
  ok(fr.view(a.accountId).incoming.some((x) => x.acc === b.accountId), 'Bravo still asks Alpha');
  db.deleteGuest(g.accountId);
  ok(!fr.blocks(a.accountId, g.accountId) && !fr.view(a.accountId).blocked.some((x) => x.acc === g.accountId), 'a deleted guest leaves the block list');
  ok(changed.includes(a.accountId) && changed.includes(b.accountId), 'changes are pushed to both sides');
} catch (err) {
  ok(false, `test crashed: ${err instanceof Error ? err.stack : err}`);
} finally {
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
finish('friends');
