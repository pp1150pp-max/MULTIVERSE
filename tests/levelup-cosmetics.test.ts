// Level-up effects as cosmetics (owner 2026-11-25, docs/systems/cosmetics.md "เอฟเฟกต์เลเวลอัป"): the six pieces,
// their snapshot codes, their per-piece look values, and moving the balance tab's old look onto the cyan piece.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { COSMETICS, COS_SLOTS, cosById, cosCodes, cosFromCodes } from '../src/shared/data/cosmetics';
import { checkCosTuning, colorHex, colorNum, cosTuneDefaults, cosTuningChanges, levelUpFromOldBalance, OLD_LEVELUP_PIECE } from '../src/shared/cosTuning';
import { BALANCE_SETTING, checkBalance } from '../src/shared/balance';
import { checkCosShop, mayPutOnCos } from '../src/shared/cosShop';
import { LEVELUP_STYLE, levelUpLookOf } from '../src/client/levelUpFx';
import { finish, ok } from './check';

// ---- the pieces
const pieces = COSMETICS.filter((c) => c.slot === 'levelup');
ok(pieces.length === 6, `six level-up pieces (${pieces.length})`);
ok(COS_SLOTS[COS_SLOTS.length - 1] === 'levelup' && COS_SLOTS.indexOf('orb') === 5, 'the new slot is last: older slots keep their codes');
ok(cosById('wings_angel')?.code === 1 && cosById('title_gold')?.code === 69, 'older codes unchanged');
ok(pieces.map((c) => c.code).join(',') === '97,98,99,100,101,102', `codes 97–102 (${pieces.map((c) => c.code)})`);
ok(new Set(COSMETICS.map((c) => c.code)).size === COSMETICS.length, 'every code unique');
ok(pieces.every((c) => c.name.startsWith('เลเวลอัป: ')), 'names start with "เลเวลอัป: "');
ok(new Set(pieces.map((c) => LEVELUP_STYLE[c.id])).size === 6, 'each piece has its own drawing');
const worn = { wings: 'wings_bat', levelup: 'levelup_thunder' };
ok(JSON.stringify(cosFromCodes(cosCodes(worn))) === JSON.stringify(worn), 'worn level-up piece goes through the snapshot codes');

// ---- look values
const cyan = cosTuneDefaults('levelup_cyan')!;
ok(cyan.color1 === 0x4dfff0 && cyan.color2 === 0x2a9fe0 && cyan.size === 1 && cyan.sec === 2.2 && cyan.main === true && cyan.text === true, 'cyan keeps #485 code look');
ok(pieces.every((c) => cosTuneDefaults(c.id)!.color1 === colorNum(c.color)), 'each piece starts in its own colours');
ok(colorHex(0x4dfff0) === '#4dfff0' && colorNum('#4DFFF0') === 0x4dfff0 && colorNum('red') === undefined, 'colour helpers');
const good = checkCosTuning({ levelup_fire: { color1: 0xff0000, size: 1.5, sparks: false } }, true);
ok(!!good.tuning && JSON.stringify(good.tuning) === '{"levelup_fire":{"color1":16711680,"size":1.5,"sparks":false}}', `strict check keeps good values (${JSON.stringify(good)})`);
ok(!!checkCosTuning({ levelup_fire: { color1: '#ff0000' } }, true).error, 'a colour must be a number (as stored)');
ok(!!checkCosTuning({ levelup_fire: { color1: 0x1000000 } }, true).error, 'a colour out of range is refused');
ok(!!checkCosTuning({ levelup_fire: { sec: 99 } }, true).error, 'time out of range is refused');
ok(!!checkCosTuning({ levelup_fire: { shift: 0.2 } }, true).error, 'no placement fields on a level-up piece');
ok(JSON.stringify(checkCosTuning({ levelup_fire: { color1: colorNum('#ffb03a') } }, true).tuning) === '{}', 'its own default colour is not stored');
ok(cosTuningChanges({}, { levelup_star: { color2: 0x112233 } }) === 'levelup_star.color2 #ff9f1a → #112233', `audit shows colours as #rrggbb (${cosTuningChanges({}, { levelup_star: { color2: 0x112233 } })})`);
const look = levelUpLookOf(checkCosTuning({ levelup_leaf: { color1: 0x00ff00, main: false } }, true).tuning!.levelup_leaf);
ok(look.color1 === '#00ff00' && !look.main && look.ground && look.sec === 2.2, 'the effect reads the piece\'s values');

// ---- shop and wearing rules (shared with every cosmetic)
ok(JSON.stringify(checkCosShop({ levelup_star: { price: 300 } }, true).shop) === '{"levelup_star":{"price":300}}', 'a level-up piece can be priced');
ok(mayPutOnCos('levelup_fire', undefined, new Set()) && !mayPutOnCos('levelup_fire', undefined, new Set(['levelup_fire'])), 'hidden pieces cannot be put on');

// ---- the old balance-tab look
const fromOld = levelUpFromOldBalance({ luColor1: '#ff0000', luSize: 1.5, luArrows: false, luSec: 'x', glow: 2 });
ok(JSON.stringify(fromOld) === '{"color1":16711680,"size":1.5,"main":false}', `old keys mapped, bad ones dropped (${JSON.stringify(fromOld)})`);
ok('error' in checkBalance({ fxLayer: { luColor1: '#ff0000' } }, true), 'the balance tab no longer takes the look');
ok(checkBalance({ fxLayer: { luNew: false } }, true).tuning?.fxLayer?.luNew === false, 'the on/off switch stays on the balance tab');

const dir = mkdtempSync(join(tmpdir(), 'multiverse-levelup-'));
const file = join(dir, 't.db');
try {
  let db = new Db(file);
  ok(!db.migrateLevelUpLook(), 'nothing saved: nothing to move');
  db.setSetting(BALANCE_SETTING, JSON.stringify({ hpRegenMult: 0.5, fxLayer: { luColor1: '#ff0000', luSize: 1.5, luArrows: false, luNew: false, glow: 1.5 } }));
  db.setCosTuning({ wings_bat: { h: 2 } });
  db.close();
  db = new Db(file); // opening moves it
  ok(JSON.stringify(db.cosTuning()[OLD_LEVELUP_PIECE]) === '{"color1":16711680,"size":1.5,"main":false}', `moved onto the cyan piece (${JSON.stringify(db.cosTuning())})`);
  ok(JSON.stringify(db.cosTuning().wings_bat) === '{"h":2}', 'other pieces untouched');
  const raw = JSON.parse(db.getSetting(BALANCE_SETTING)!);
  ok(JSON.stringify(raw) === '{"hpRegenMult":0.5,"fxLayer":{"luNew":false,"glow":1.5}}', `old keys taken out of the balance, the rest kept (${JSON.stringify(raw)})`);
  ok(db.balance().fxLayer?.luNew === false && db.balance().fxLayer?.glow === 1.5, 'the balance still reads');
  // the owner later puts the cyan piece back to the code look: opening again must not bring the old look back
  db.setCosTuning({ wings_bat: { h: 2 } });
  db.close();
  db = new Db(file);
  ok(!db.migrateLevelUpLook() && db.cosTuning()[OLD_LEVELUP_PIECE] === undefined, 'runs once: a later reset stays reset');
  // only old keys in fxLayer: the whole fxLayer (and the row, if nothing else) goes
  db.setSetting(BALANCE_SETTING, JSON.stringify({ fxLayer: { luText: false } }));
  ok(db.migrateLevelUpLook() && db.getSetting(BALANCE_SETTING) === null, 'nothing left: the balance row is removed');
  ok(db.cosTuning()[OLD_LEVELUP_PIECE]?.text === false, 'the title switch moved too');
  db.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

finish('levelup-cosmetics');
