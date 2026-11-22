// "มีอะไรใหม่" rules without a server: the cleaner every writer uses, the Thai date, the DB layer, and where the menu button goes.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { cleanNews, newsDate, NEWS_LINE_MAX, NEWS_LINES_MAX, NEWS_SHOW, NEWS_TITLE_MAX } from '../src/shared/news';
import { codeMenuLayout, mergeMenuLayout } from '../src/shared/menuLayout';
import { finish, ok } from './check';

const good = cleanNews('  หัวข้อ \n ยาว ', ['  a   b ', '', 'c\u0000d']);
ok('title' in good && good.title === 'หัวข้อ ยาว' && good.lines.join('|') === 'a b|c d', 'control characters and extra spaces are cleaned, blank lines dropped');
ok('error' in cleanNews('x'.repeat(NEWS_TITLE_MAX + 1), ['a']), 'title over the cap is refused');
ok('title' in cleanNews('x'.repeat(NEWS_TITLE_MAX), ['a'.repeat(NEWS_LINE_MAX)]), 'exactly at the caps is fine');
ok('error' in cleanNews('t', Array.from({ length: NEWS_LINES_MAX + 1 }, () => 'a')), 'too many lines refused');
ok('error' in cleanNews(5, ['a']) && 'error' in cleanNews('t', 'a') && 'error' in cleanNews('t', [1]) && 'error' in cleanNews('t', []), 'wrong types and empty lists refused');
const when = newsDate(Date.UTC(2026, 10, 22, 7, 30));
ok(/2569/.test(when) && /14:30/.test(when), `Thai time and Buddhist year (${when})`);

const dir = mkdtempSync(join(tmpdir(), 'multiverse-news-db-'));
const db = new Db(join(dir, 't.db'));
try {
  ok(db.newsRev() === '0' && db.newsVisible().length === 0, 'starts empty');
  const a = db.newsAdd('A', ['1'], 'x', 'k1', 1000)!;
  ok(db.newsRev() === '1', 'adding bumps the revision');
  ok(db.newsAdd('A2', ['1'], 'x', 'k1') === null && db.newsRev() === '1', 'a repeated key adds nothing and does not bump');
  for (let i = 0; i < 6; i++) db.newsAdd(`N${i}`, ['x'], 'x', null, 2000 + i);
  const vis = db.newsVisible();
  ok(vis.length === NEWS_SHOW && vis[0].title === 'N5' && vis.every((n) => n.id !== a), 'newest first, capped, the oldest is not shown');
  db.newsEdit(vis[0].id, { hidden: true });
  ok(db.newsVisible()[0].title === 'N4' && db.newsAll().find((n) => n.id === vis[0].id)?.hidden === true, 'hidden is left out for players, kept for admin');
  ok(db.newsDelete(a) && !db.newsDelete(a), 'delete once');
  ok(JSON.stringify(db.newsSwitches()) === '{"button":true,"autopop":false}', 'switch defaults');
  db.setNewsSwitches({ button: false, autopop: true });
  ok(JSON.stringify(db.newsSwitches()) === '{"button":false,"autopop":true}', 'switches saved');
  db.setNewsSwitches({ button: true, autopop: false });
  ok(db.getSetting('news_switches') === null, 'values equal to the code store nothing');
} finally {
  db.close();
  rmSync(dir, { recursive: true, force: true });
}

// The button: in the code's menu, and added to a menu the owner saved before it existed.
ok(codeMenuLayout().menu.includes('news'), 'the code menu has the button');
ok(mergeMenuLayout({ menu: ['bag', 'settings'] }).menu.join() === 'bag,news,settings', 'a saved menu without it gets it just before ตั้งค่า');
ok(mergeMenuLayout({ menu: ['bag', 'news', 'settings'] }).menu.join() === 'bag,news,settings', 'not added twice');
ok(mergeMenuLayout({ menu: ['bag', 'settings'], top: ['auto', 'news', 'menu'] }).menu.includes('news') === false, 'moved to the top row: not also added to the menu window');
ok(mergeMenuLayout(undefined).menu.filter((i) => i === 'news').length === 1, 'no saved layout: once');

finish('news');
