// Card album (card plan section 14, owner 2026-11-25): pages by farm map, 2 steps (rares / every card with the boss),
// the agreed bonus numbers, registering uses the card up and adds the bonus, never twice, the /admin switch, the
// database rows, and the top-row button for a layout saved before the album existed.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { ALBUM_PAGES, albumBonus, albumStep, cleanAlbum } from '../src/shared/cardAlbum';
import { applyCardTuning } from '../src/shared/cardTuning';
import { CARD_NUM_FIELDS, type CardId } from '../src/shared/data/cards';
import { ZONES } from '../src/shared/data/zones';
import { codeMenuLayout, mergeMenuLayout } from '../src/shared/menuLayout';
import { newCharacterData } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { finish, ok } from './check';

const page = (k: string) => ALBUM_PAGES.find((p) => p.key === k)!;

// ---------------------------------------------------------------- pages
applyCardTuning({});
ok(ALBUM_PAGES.length === 8, '8 pages: 4 maps on each floor');
ok(page('f1m1').normal.length === 5 && page('f1m1').boss.join() === 'card_forest_bear', 'forest: 5 rare cards, the bear for step 2');
ok(page('f2m2').boss.includes('card_parrot') && page('f2m2').boss.includes('card_pegleg_captain'), 'Smugglers\' Cove step 2 needs the captain and the parrot');
ok(page('f2m4').normal.includes('card_kraken_tentacle'), 'the kraken tentacle is a rare card of its map');
ok(ALBUM_PAGES.reduce((n, p) => n + p.normal.length + p.boss.length, 0) === 47, 'every one of the 47 cards is on a page');

// ---------------------------------------------------------------- steps and bonus (owner's numbers)
const f1 = page('f1m1');
ok(albumStep(f1, f1.normal.slice(1)) === 0 && albumStep(f1, f1.normal) === 1 && albumStep(f1, [...f1.normal, ...f1.boss]) === 2, 'steps: 0 / 1 (rares) / 2 (all)');
ok(albumStep(f1, f1.boss) === 0, 'the boss card alone reaches nothing');
const b1 = albumBonus(f1.normal);
ok(b1.hpPct === 2 && b1.atkPct === 0, 'forest step 1: HP +2%');
const b2 = albumBonus([...f1.normal, ...f1.boss]);
ok(b2.hpPct === 2 && b2.atkPct === 2, 'forest step 2: + ATK +2% (both steps count)');
const beach = page('f2m1');
const bb = albumBonus([...beach.normal, ...beach.boss]);
ok(bb.hpPct === 4 && bb.atkPct === 4, 'floor 2 map 1: twice the forest\'s');
const all = albumBonus(ALBUM_PAGES.flatMap((p) => [...p.normal, ...p.boss]));
ok(all.hpPct === 3 * (2 + 3 + 4) && all.mpPct === 9 && all.defPct === 6 && all.atkPct === 3 * (2 + 2 + 3), `the whole album: ${JSON.stringify(all)}`);
ok(CARD_NUM_FIELDS.filter((f) => f.key.startsWith('album_')).length === 64 && CARD_NUM_FIELDS.some((f) => f.key === 'albumOn'), '/admin: 64 bonus numbers + the switch');
applyCardTuning({ nums: { album_f1m1_1_hpPct: 5 } });
ok(albumBonus(f1.normal).hpPct === 5, 'an /admin number is used');
applyCardTuning({ nums: { albumOn: 0 } });
ok(albumBonus([...f1.normal, ...f1.boss]).hpPct === 0, 'switched off: no bonus');
applyCardTuning({});
ok(cleanAlbum(['card_yeti', 'nope', 'card_green_slime', 'card_yeti']).join() === 'card_green_slime,card_yeti', 'stored album cleaned: known ids, once, card order');

// ---------------------------------------------------------------- registering in the Sim
{
  const sim = new Sim(ZONES.emerald_forest);
  const p = sim.addPlayer({ name: 'A', classId: 'sword', level: 30, exp: 0, gold: 0, equipment: {}, bag: [] });
  for (const c of f1.normal) p.addStones(c, 1);
  p.addStones('card_wild_boar', 1);
  const hp0 = p.stats.maxHp;
  ok(!sim.albumRegister(p, 'card_yeti'), 'a card not in the bag can not be registered');
  ok(sim.albumRegister(p, 'card_wild_boar') && p.stoneCount('card_wild_boar') === 1 && p.album.includes('card_wild_boar'), 'registering uses one card up');
  ok(!sim.albumRegister(p, 'card_wild_boar') && p.stoneCount('card_wild_boar') === 1, 'never twice');
  for (const c of f1.normal) if (c !== 'card_wild_boar') sim.albumRegister(p, c);
  ok(p.stats.maxHp === Math.round(hp0 * 1.02), `step 1 reached: max HP +2% (${hp0} → ${p.stats.maxHp})`);
  applyCardTuning({ nums: { albumOn: 0 } });
  p.addStones('card_forest_bear', 1);
  ok(!sim.albumRegister(p, 'card_forest_bear') && p.stoneCount('card_forest_bear') === 1, 'switched off: can not register');
  applyCardTuning({});
}

// ---------------------------------------------------------------- database
{
  const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
  const db = new Db(join(dir, 'a.db'));
  const acc = db.createGuest('x', newCharacterData('AlbumHero', 'sword')).accountId;
  ok(db.loadAlbum(acc).length === 0, 'a new account has an empty album');
  db.addAlbumCard(acc, 'card_yeti' as CardId);
  db.addAlbumCard(acc, 'card_green_slime' as CardId);
  ok(db.loadAlbum(acc).join() === 'card_green_slime,card_yeti', 'rows saved and read back in card order');
  let threw = false;
  try {
    db.addAlbumCard(acc, 'card_yeti' as CardId);
  } catch {
    threw = true;
  }
  ok(threw, 'the same card twice is refused by the database');
  db.close?.();
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- the top-row button
ok(codeMenuLayout().top.slice(-2).join() === 'album,menu', 'code layout: อัลบั้ม just before เมนู in the top row');
const saved = mergeMenuLayout({ top: ['auto', 'bag', 'menu'], menu: ['bag', 'settings'] });
ok(saved.top.join() === 'auto,bag,album,menu' && !saved.menu.includes('album'), 'a layout saved before: the album goes into the top row');
const hidden = mergeMenuLayout({ top: ['auto', 'menu'], menu: ['album', 'settings'] });
ok(!hidden.top.includes('album'), 'an owner who moved it to the menu keeps it there');

finish('card-album');
