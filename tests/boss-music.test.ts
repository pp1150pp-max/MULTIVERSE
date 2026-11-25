// Boss room song files (src/shared/audioTuning.ts, /admin → ปรับสมดุล → "เพลงห้องบอส"): every room boss has a
// setting, the code's defaults follow the floors, what may be saved, and which file a room ends up playing.
import { BOSS_SONGS, bossRoomSong, ROOM_BOSSES } from '../src/shared/audioTuning';
import { balanceChanges, checkBalance, codeBalance, mergeBalance } from '../src/shared/balance';
import { BOSS_ROOMS, floorOf } from '../src/shared/data/zones';
import { finish, ok } from './check';

const code = codeBalance().audio.music;
const rooms = Object.values(BOSS_ROOMS);

ok([...ROOM_BOSSES].sort().join() === rooms.map((r) => r.boss!.monster).sort().join(), 'the list of room bosses is exactly the bosses with a room');
ok(rooms.every((r) => code.rooms[r.boss!.monster as (typeof ROOM_BOSSES)[number]] === BOSS_SONGS[floorOf(r) - 1]), 'code: each room plays its floor\'s song');
ok(code.on && code.gain === 0.8, 'code: on, ×0.8');

ok(bossRoomSong(code, 'yeti') === 'boss_gothic_f1' && bossRoomSong(code, 'kraken') === 'boss_gothic_f2', 'a room boss gets its song');
ok(bossRoomSong(code, undefined) === null && bossRoomSong(code, 'forest_wolf') === null, 'not a boss room: no file');
ok(bossRoomSong({ ...code, on: false }, 'yeti') === null, 'switched off: no file');
ok(bossRoomSong({ ...code, rooms: { ...code.rooms, yeti: 'chip' } }, 'yeti') === null, 'a room set to chiptune: no file');

const check = (music: unknown) => checkBalance({ audio: { music } }, true);
const good = check({ on: false, gain: 1.25, rooms: { yeti: 'chip', kraken: 'boss_gothic_f1' } });
ok('tuning' in good && JSON.stringify(good.tuning) === '{"audio":{"music":{"on":false,"gain":1.25,"rooms":{"yeti":"chip","kraken":"boss_gothic_f1"}}}}', 'a good change is accepted');
const whole = checkBalance({ audio: codeBalance().audio }, true);
ok('tuning' in whole && JSON.stringify(whole.tuning) === '{}', 'the code\'s own values (what /admin sends untouched) are not stored');
for (const [bad, what] of [
  [{ on: 1 }, 'switch not a boolean'],
  [{ gain: 2.5 }, 'loudness over ×2'],
  [{ gain: -1 }, 'loudness under ×0'],
  [{ rooms: { forest_wolf: 'chip' } }, 'unknown boss'],
  [{ rooms: { yeti: 'nope' } }, 'unknown song'],
  [{ extra: 1 }, 'unknown key'],
  ['yes', 'not an object'],
] as const) ok('error' in check(bad), `refused: ${what}`);
const loose = checkBalance({ audio: { music: { gain: 99, rooms: { yeti: 'nope', kraken: 'chip' } } } }, false);
ok(JSON.stringify(loose.tuning) === '{"audio":{"music":{"rooms":{"kraken":"chip"}}}}', 'loading old data drops only the wrong entries');

const tuned = mergeBalance({ audio: { music: { rooms: { yeti: 'chip' } } } });
ok(tuned.audio.music.rooms.yeti === 'chip' && tuned.audio.music.rooms.kraken === 'boss_gothic_f2' && tuned.audio.music.gain === 0.8, 'a change lies over the code\'s values');
ok(codeBalance().audio.music.rooms.yeti === 'boss_gothic_f1', 'and leaves the code\'s values alone');
const lines = balanceChanges({}, { audio: { music: { on: false, rooms: { yeti: 'chip' } } } });
ok(lines.includes('เพลงไฟล์ห้องบอส เปิด → ปิด') && lines.includes('เพลงห้องเยติ กอทิก ชั้น 1 → chiptune'), 'the audit log says what changed');

finish('boss-music');
