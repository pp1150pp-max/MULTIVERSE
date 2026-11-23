// English (owner 2026-11-22, docs/systems/i18n.md): the translator falls back to Thai, fills templates, translates
// names caught inside templates, keeps white space, and the dictionary has no broken keys.
import { ok, finish } from './check';
import { normKey, Translator, hasThai, fill } from '../src/shared/i18n/translator';
import { englishDict } from '../src/shared/i18n/dict';

const tr = new Translator({
  'ปิด': 'Close',
  'หมาป่า': 'Forest Wolf',
  '{0} เข้าร่วมปาร์ตี้': '{0} joined the party',
  'ขาย {0} ได้ {1} G': 'Sold {0} for {1} G',
  'วิ': 's',
  'นักดาบ': 'Swordsman',
  'พายุดาบ': 'Whirlwind',
  '{0}': 'never a template',
});

// Fallback: Thai with no English stays Thai; text with no Thai is never looked up.
ok(tr.translate('ข้อความที่ไม่มีคำแปล') === null, 'no English → null');
ok(tr.tr('ข้อความที่ไม่มีคำแปล') === 'ข้อความที่ไม่มีคำแปล', 'tr() falls back to the Thai');
ok(tr.translate('Hello 123') === null && tr.tr('Hello') === 'Hello', 'non-Thai untouched');

// Exact, with the white space around it kept and inner white space normalised.
ok(tr.translate('ปิด') === 'Close', 'exact');
ok(tr.translate('  ปิด ') === '  Close ', 'leading / trailing spaces kept');

// Templates, and a Thai name caught by one is looked up again.
ok(tr.translate('Bob เข้าร่วมปาร์ตี้') === 'Bob joined the party', 'template with a Latin name');
ok(tr.translate('หมาป่า เข้าร่วมปาร์ตี้') === 'Forest Wolf joined the party', 'value caught by a template is translated too');
ok(tr.translate('ขาย หมาป่า ได้ 1,200 G') === 'Sold Forest Wolf for 1,200 G', 'two placeholders');
ok(tr.translate('anything') === null, 'an all-placeholder key never matches everything');

// Pieces: each Thai run between numbers / Latin on its own.
ok(tr.translate('5 วิ') === '5 s', 'number + unit');
ok(tr.translate('Lv.5 นักดาบ') === 'Lv.5 Swordsman', 'Latin + Thai run');
ok(tr.translate('5 วิ · ข้อความแปลก') === '5 s · ข้อความแปลก', 'partly known: the known run is translated');

// "Name (ชื่อไทย)" → just the name.
ok(tr.translate('Whirlwind (พายุดาบ)') === 'Whirlwind', 'English (Thai) pair collapses');

ok(normKey(' กํา  ข ') === 'กํา ข'.normalize('NFC'), 'normKey: NFC, one space, trimmed');
ok(fill('{name} ได้ {0}', { name: 'A', 0: 5 }) === 'A ได้ 5', 'fill');

// The real dictionary: every key has Thai, no value is empty, no value is still Thai.
const dict = englishDict();
const keys = Object.keys(dict);
ok(keys.length > 2000, `dictionary is filled (${keys.length})`);
const noThaiKey = keys.filter((k) => !hasThai(k));
ok(noThaiKey.length === 0, `every key has Thai (${noThaiKey.slice(0, 3).join(' | ')})`);
const thaiValue = keys.filter((k) => hasThai(dict[k]!) || !dict[k]!.trim());
ok(thaiValue.length === 0, `every value is English (${thaiValue.slice(0, 3).join(' | ')})`);
const real = new Translator(dict);
ok(real.translate('กลับเข้าเกม') === 'Resume', 'real dictionary: a menu button');
ok(real.translate('Bob เข้าร่วมปาร์ตี้') === 'Bob joined the party', 'real dictionary: a server notice');
ok(real.translate('ขาย ดาบเหล็ก ได้ 15 G') === 'Sold ดาบเหล็ก for 15 G', 'real dictionary: unknown item name stays');

// Short templates never swallow an unknown Thai sentence; side-by-side placeholders are cut by what has English.
ok(real.translate('ส่งของเรียบร้อยแล้ว') === null, "'{0}แล้ว' does not swallow an unknown sentence");
const hint = real.translate('คลิกซ้าย: ใช้กับปุ่มด่วน · คลิกขวา: ขายทั้งช่อง · Shift+ลาก: แบ่งกอง');
ok(hint === 'Left-click: set as quick key · Right-click: Sell the stack · Shift+drag: split the stack', `"{0}{1}" cut right (${hint})`);
ok(real.translate('สมชาย เข้าร่วมปาร์ตี้') === 'สมชาย joined the party', 'a Thai player name still fits a template');

finish('i18n');
