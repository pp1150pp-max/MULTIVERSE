// Server-wide cosmetic tuning (the /admin "ของแต่งตัว" bench): the checks on what may be saved, and the
// /admin API against a real game server this script starts on a free port with a throwaway database
// (never the real server or server/data): GM may read but not save, owner saves (audit log), sent on
// joining and pushed to everyone online when it changes, an old database with nothing saved = code defaults.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { pasteCosTuning, savePartOf, axisHiddenInDir, checkCosTuning, COS_AXES, COS_TUNE_FIELDS, viewDirOf, viewOffKey, COS_TUNING_SETTING, cosTuneDefaults, cosTuneOf, cosTuningChanges, TUNED_SLOTS } from '../src/shared/cosTuning';
import { COSMETICS } from '../src/shared/data/cosmetics';
import { checkCosShop, COS_SHOP_SETTING, cosHiddenIds, cosPrice, cosShopChanges, mayPutOnCos } from '../src/shared/cosShop';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-coslook-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let proc: ChildProcess | null = null;

// ---------------------------------------------------------- checks (no server)
for (const c of COSMETICS) {
  const d = cosTuneDefaults(c.id);
  if (c.slot === 'title') {
    ok(d === undefined, `${c.id}: a title set has no tuning`);
    continue;
  }
  const fields = COS_TUNE_FIELDS[c.slot];
  ok(!!d && Object.keys(fields).every((k) => k in d) && Object.keys(d).every((k) => k in fields), `${c.id}: defaults cover every field`);
  for (const [k, f] of Object.entries(fields)) {
    const v = d![k];
    ok(f.kind === 'bool' ? typeof v === 'boolean' : typeof v === 'number' && v >= f.min && v <= f.max, `${c.id}.${k}: default ${v} fits its range`);
  }
}
ok(TUNED_SLOTS.length === 4, 'wings, mounts, pets and auras are tuned');
ok(cosTuneDefaults('wings_angel')?.h === 1.625 && cosTuneDefaults('wings_angel')?.root === 0.6 && cosTuneDefaults('wings_angel')?.backStand === 1.35 && cosTuneDefaults('wings_angel')?.backSeat === 1 && cosTuneDefaults('wings_angel')?.overBack === true && cosTuneDefaults('wings_angel')?.back === 0.22, 'wings start where #197/#200 put them (size 1.625, roots 60% up on the middle of the back, back 0.22)');
ok(cosTuneDefaults('mount_wolf')?.seat === 0.5 && cosTuneDefaults('mount_wolf')?.cutFrontDiag === true && cosTuneDefaults('mount_wolf')?.cutSide === true && cosTuneDefaults('mount_wolf')?.cutBackDiag === true && cosTuneDefaults('mount_wolf')?.under === false, 'mount defaults kept (seat, cut in two on the front/back diagonal and the side)');
ok(cosTuneDefaults('mount_hoverboard') === undefined && cosTuneDefaults('mount_tortoise') === undefined, 'removed mounts (#200) have no tuning');
ok(JSON.stringify(checkCosTuning({ mount_tortoise: { h: 2 }, mount_wolf: { seat: 0.6 } }, false).tuning) === '{"mount_wolf":{"seat":0.6}}', 'saved tuning of a removed mount is ignored on read');
ok(!!checkCosTuning({ mount_hoverboard: { h: 1 } }, true).error, 'a removed mount cannot be saved');
ok(cosTuneDefaults('pet_dragon')?.fly === true && cosTuneDefaults('pet_cat')?.fly === false, 'pet flying defaults kept');
ok(JSON.stringify(checkCosTuning({ wings_angel: { root: 0.6 } }, true).tuning) === '{}', 'a value equal to the code default is not stored');
ok(checkCosTuning({ wings_angel: { backStand: 1.23456 } }, true).tuning?.wings_angel?.backStand === 1.235, 'numbers are rounded to 3 decimals');
ok(!!checkCosTuning({ wings_angel: { backStand: 9 } }, true).error, 'out of range is refused');
ok(!!checkCosTuning({ wings_angel: { backStand: '1' } }, true).error, 'a number sent as text is refused');
ok(!!checkCosTuning({ pet_cat: { fly: 1 } }, true).error, 'an on/off field must be true/false');
ok(!!checkCosTuning({ wings_angel: { seat: 1 } }, true).error, 'a field of another slot is refused');
ok(!!checkCosTuning({ wings_nope: { root: 1 } }, true).error, 'an unknown cosmetic is refused');
ok(!!checkCosTuning({ title_gold: {} }, true).error, 'a title set cannot be tuned');
ok(!!checkCosTuning([], true).error && !!checkCosTuning(null, true).error, 'not an object is refused');
const lenient = checkCosTuning({ wings_nope: { lift: 1 }, wings_bat: { backStand: 9, back: 0.3, lift: 1 } }, false).tuning;
ok(JSON.stringify(lenient) === '{"wings_bat":{"back":0.3}}', 'read back leniently: unknown and bad entries dropped, the rest kept');
ok(cosTuneOf({ wings_bat: { back: 0.3 } }, 'wings_bat')?.backStand === 1.35, 'changes go on top of the code defaults');
ok(cosTuningChanges({}, { wings_bat: { back: 0.3 } }) === 'wings_bat.back 0.22 → 0.3', 'audit text lists what changed');

// X/Y/Z axes: every axis reads a real field, old saves (old keys only) read unchanged, view offsets start at 0.
for (const slot of TUNED_SLOTS) {
  for (const s of COS_AXES[slot]) ok(COS_TUNE_FIELDS[slot][s.key]?.kind === 'num', `${slot}: axis ${s.axis} reads field ${s.key}`);
}
ok(COS_AXES.aura.every((s) => s.axis === 'x'), 'an aura has only the X axis');
ok(axisHiddenInDir('z', 'front') && axisHiddenInDir('z', 'back') && !axisHiddenInDir('z', 'frontLeft') && !axisHiddenInDir('z', 'backRight') && axisHiddenInDir('x', 'left') && axisHiddenInDir('x', 'right') && !axisHiddenInDir('x', 'frontRight'), 'Z hidden straight front/back, X hidden left/right, diagonals show all');
ok(viewDirOf(0, true) === 'front' && viewDirOf(1, false) === 'frontLeft' && viewDirOf(1, true) === 'frontRight' && viewDirOf(2, false) === 'left' && viewDirOf(2, true) === 'right' && viewDirOf(3, false) === 'backLeft' && viewDirOf(3, true) === 'backRight' && viewDirOf(4, true) === 'back', 'the 8 facings from a sheet row and a screen side');
ok(cosTuneDefaults('wings_angel')?.[viewOffKey('y', 'backLeft')] === 0 && cosTuneDefaults('mount_wolf')?.z === 0, 'view offsets and the mount Z start at 0');
ok(cosTuneOf({ wings_bat: { shift: 0.2, back: 0.3 } }, 'wings_bat')?.dx_at_left === 0, 'an old save (old keys) reads with zero view offsets, positions unchanged');
ok(checkCosTuning({ wings_angel: { dy_at_front: 0.1 } }, true).tuning?.wings_angel?.dy_at_front === 0.1, 'a view offset can be saved');
ok(!!checkCosTuning({ aura_star: { dz_at_front: 0.1 } }, true).error, 'an aura has no Z offset');

// Saving one piece's part: only that piece and only the picked fields change, the rest stays as last saved.
{
  const saved = { wings_angel: { dy_at_back: 0.2 }, wings_bat: { backStand: 1.5 } };
  const cur = { ...cosTuneDefaults('wings_angel')!, dy_at_front: 0.3, dy_back: 0.9, dx_at_left: 0.1, backStand: 1.6 };
  const front = savePartOf(saved, 'wings_angel', cur, (k) => /^d[xyz]_at_front$/.test(k));
  ok(JSON.stringify(front) === JSON.stringify({ wings_angel: { dy_at_front: 0.3, dy_at_back: 0.2 }, wings_bat: { backStand: 1.5 } }), 'saving the front view saves only the front offsets of that piece');
  const base = savePartOf(saved, 'wings_angel', cur, (k) => !/^d[xyz]_/.test(k));
  ok(JSON.stringify(base) === JSON.stringify({ wings_angel: { backStand: 1.6, dy_at_back: 0.2 }, wings_bat: { backStand: 1.5 } }), 'saving the base values leaves every view offset as saved');
  ok(savePartOf({ wings_angel: { dy_at_front: 0.3 } }, 'wings_angel', cosTuneDefaults('wings_angel')!, (k) => /^d[xyz]_at_front$/.test(k)).wings_angel === undefined, 'a part set back to the default is no longer stored');
}

// Old saves had offsets per group (front / side / back): copied to every facing the group covered.
{
  const old = checkCosTuning({ wings_angel: { dy_front: 0.3, dx_side: 0.2, dz_back: -0.1 } }, false).tuning?.wings_angel!;
  ok(old.dy_at_front === 0.3 && old.dy_at_frontLeft === 0.3 && old.dy_at_frontRight === 0.3 && old.dy_at_back === undefined, 'old front offsets go to the front and both front diagonals');
  ok(old.dx_at_left === 0.2 && old.dx_at_right === 0.2, 'old side offsets go to left and right');
  ok(old.dz_at_back === -0.1 && old.dz_at_backLeft === -0.1 && old.dz_at_backRight === -0.1 && Object.keys(old).length === 8, 'old back offsets go to the back and both back diagonals');
  ok(checkCosTuning({ wings_angel: { dy_front: 0.3, dy_at_frontLeft: 0.5 } }, true).tuning?.wings_angel?.dy_at_frontLeft === 0.5, 'a facing saved on its own wins over the old group value');
}

// Shop settings (the "จัดการของแต่งตัว" tab): hidden / diamond price per piece, overrides only.
{
  const good = checkCosShop({ pet_cat: { price: 500 }, wings_bat: { hidden: true }, title_gold: { hidden: true, price: 1_000_000 }, aura_star: { hidden: false } }, true);
  ok(JSON.stringify(good.shop) === '{"wings_bat":{"hidden":true},"pet_cat":{"price":500},"title_gold":{"hidden":true,"price":1000000}}', `shop: kept in catalogue order, shown + no price not stored, titles too (${JSON.stringify(good.shop)})`);
  for (const [what, v] of [
    ['price 0', { pet_cat: { price: 0 } }], ['price not whole', { pet_cat: { price: 1.5 } }], ['price too big', { pet_cat: { price: 1_000_001 } }],
    ['price as text', { pet_cat: { price: '5' } }], ['hidden not true/false', { pet_cat: { hidden: 1 } }], ['extra field', { pet_cat: { sale: true } }],
    ['unknown cosmetic', { pet_nope: { hidden: true } }], ['removed mount', { mount_tortoise: { hidden: true } }], ['not an object', []],
  ] as const) ok(!!checkCosShop(v, true).error, `shop: ${what} refused`);
  ok(JSON.stringify(checkCosShop({ pet_nope: { hidden: true }, pet_cat: { price: -1, hidden: true } }, false).shop) === '{"pet_cat":{"hidden":true}}', 'shop read back leniently: unknown and bad entries dropped, the rest kept');
  ok(JSON.stringify(checkCosShop({ pet_cat: { price: null } }, true).shop) === '{}', 'shop: an empty price = no price');
  ok(JSON.stringify(cosHiddenIds(good.shop!)) === '["wings_bat","title_gold"]' && cosPrice(good.shop!, 'pet_cat') === 500 && cosPrice(good.shop!, 'wings_bat') === undefined, 'hidden ids and price lookups');
  ok(cosShopChanges({ pet_cat: { price: 500 } }, { pet_cat: { price: 600, hidden: true } }) === 'pet_cat: ซ่อน ราคา 500 → 600 เพชร', `shop audit text (${cosShopChanges({ pet_cat: { price: 500 } }, { pet_cat: { price: 600, hidden: true } })})`);
  const hid = new Set(['wings_bat']);
  ok(!mayPutOnCos('wings_bat', undefined, hid) && !mayPutOnCos('wings_bat', 'wings_angel', hid), 'a hidden piece cannot be put on');
  ok(mayPutOnCos('wings_bat', 'wings_bat', hid) && mayPutOnCos('wings_angel', 'wings_bat', hid), 'the hidden piece already worn stays; a shown one can be put on');
}

// Pasting bench text onto the saved tuning: named pieces get exactly the text's values, others stay.
{
  const saved = { wings_angel: { back: 0.3 }, mount_wolf: { seat: 0.6 }, pet_cat: { float: 1 } };
  const oldCopy = pasteCosTuning(saved, { wings_angel: { backStand: 1.4 }, aura_star: { size: 3 } });
  ok(JSON.stringify(oldCopy.tuning) === JSON.stringify({ wings_angel: { backStand: 1.4 }, mount_wolf: { seat: 0.6 }, pet_cat: { float: 1 }, aura_star: { size: 3 } }) && oldCopy.ids?.join() === 'wings_angel,aura_star', `old copy format (changed pieces only): those pieces replaced, the rest kept (${JSON.stringify(oldCopy.tuning)})`);
  const newCopy = pasteCosTuning(saved, { wings_angel: { back: 0.3 }, mount_wolf: {}, pet_cat: { float: 1 } });
  ok(JSON.stringify(newCopy.tuning) === JSON.stringify({ wings_angel: { back: 0.3 }, pet_cat: { float: 1 } }), 'new copy format: a piece named with {} goes back to the code defaults');
  const only = pasteCosTuning(saved, { wings_angel: { back: 0.5 }, mount_wolf: {} }, ['mount_wolf']);
  ok(JSON.stringify(only.tuning) === JSON.stringify({ wings_angel: { back: 0.3 }, pet_cat: { float: 1 } }) && only.ids?.join() === 'mount_wolf', 'only the ticked pieces are pasted');
  ok(!!pasteCosTuning(saved, { wings_angel: { backStand: 9 } }).error && !!pasteCosTuning(saved, { title_gold: {} }).error && !!pasteCosTuning(saved, 'x').error, 'pasting bad text is refused (range, title set, not an object)');
  ok(pasteCosTuning({}, { wings_angel: { dy_front: 0.3 } }).tuning?.wings_angel?.dy_at_frontLeft === 0.3, 'an old copy with the 3-group offsets pastes as the 8 facings');
  const full = pasteCosTuning(saved, { wings_angel: { ...cosTuneDefaults('wings_angel')!, backStand: 1.5 }, mount_wolf: { ...cosTuneDefaults('mount_wolf')!, seat: 0.7 } });
  ok(JSON.stringify(full.tuning) === JSON.stringify({ wings_angel: { backStand: 1.5 }, mount_wolf: { seat: 0.7 }, pet_cat: { float: 1 } }), `the management tab sends every value of a changed piece: only what differs from the code is stored (${JSON.stringify(full.tuning)})`);
}

// ---------------------------------------------------------- against a real server
function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once('error', rej);
    s.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => res(port));
    });
  });
}

const auditCount = (): number => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const n = (db.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action = 'cos-look'").get() as { n: number }).n;
  db.close();
  return n;
};
const settingRow = (key = COS_TUNING_SETTING): string | null => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  db.close();
  return r?.value ?? null;
};
const auditOf = (action: string): string[] => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const rows = db.prepare('SELECT details FROM admin_audit WHERE action = ? ORDER BY id').all(action) as { details: string }[];
  db.close();
  return rows.map((r) => r.details);
};

async function run(): Promise<void> {
  const port = await freePort();
  const base = `http://localhost:${port}`;
  proc = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE }, stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; ; i++) {
    try {
      await fetch(`${base}/api/me`);
      break;
    } catch {
      if (i > 100) throw new Error('test server did not start');
      await sleep(100);
    }
  }
  const api = async (method: string, path: string, body?: unknown, token?: string) => {
    const r = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
  };
  const joinWorld = (token: string, characterId: number) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`);
    const msgs: any[] = [];
    const ready = new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data));
        msgs.push(m);
        if (m.t === 'snap') {
          clearTimeout(t);
          res();
        }
      };
    });
    return { ws, msgs, ready };
  };

  const tok: Record<string, string> = {};
  const chars: Record<string, number> = {};
  for (const u of ['owner1', 'gm1', 'plain1', 'plain2']) {
    tok[u] = (await api('POST', '/register', { username: u, password: 'secret123' })).data.token;
    chars[u] = (await api('POST', '/characters', { name: `C_${u}`, classId: 'sword' }, tok[u])).data.id;
  }
  spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE } });
  ok((await api('POST', '/admin/roles', { username: 'gm1', role: 'gm' }, tok.owner1)).status === 200, 'gm1 made GM');

  // Who may see / save it. A fresh database has nothing saved: the code defaults.
  const gmGet = await api('GET', '/admin/cos-look', undefined, tok.gm1);
  ok(gmGet.status === 200 && gmGet.data.canEdit === false && JSON.stringify(gmGet.data.tuning) === '{}', 'GM sees the tuning (bench, nothing saved yet) but may not save it');
  ok((await api('GET', '/admin/cos-look', undefined, tok.plain1)).status === 403, 'a player cannot read it from the admin API');
  const changed = { wings_angel: { backStand: 1.4, back: 0.3 }, mount_wolf: { seat: 0.6 }, pet_cat: { fly: true, float: 1 }, aura_star: { size: 3 } };
  ok((await api('POST', '/admin/cos-look', { tuning: changed }, tok.gm1)).status === 403, 'GM cannot save the tuning');
  ok((await api('POST', '/admin/cos-look', { tuning: changed }, tok.plain1)).status === 403, 'a player cannot save the tuning');
  ok((await api('POST', '/admin/cos-look', { reset: true }, tok.gm1)).status === 403, 'GM cannot reset it either');
  const ownerGet = await api('GET', '/admin/cos-look', undefined, tok.owner1);
  ok(ownerGet.status === 200 && ownerGet.data.canEdit === true, 'the owner may save it');

  // Bad values are refused and change nothing.
  for (const [what, tuning] of [
    ['unknown cosmetic', { wings_nope: { root: 1 } }],
    ['range', { wings_angel: { backStand: 50 } }],
    ['extra field', { wings_angel: { hack: 1 } }],
    ['title set', { title_gold: { size: 1 } }],
    ['not an object', 'x'],
  ] as const) {
    ok((await api('POST', '/admin/cos-look', { tuning }, tok.owner1)).status === 400, `bad ${what} refused`);
  }
  ok(auditCount() === 0 && settingRow() === null, 'refused saves leave no audit row and no setting');

  // Joining gets the tuning; saving pushes it to everyone online.
  const p1 = joinWorld(tok.plain1, chars.plain1);
  await p1.ready;
  const w1 = p1.msgs.find((m) => m.t === 'welcome');
  ok(w1 && JSON.stringify(w1.cosTuning) === '{}', 'joining sends the (empty) tuning in welcome');
  const saved = await api('POST', '/admin/cos-look', { tuning: changed }, tok.owner1);
  ok(saved.status === 200 && saved.data.tuning.wings_angel?.backStand === 1.4 && saved.data.tuning.pet_cat?.fly === true, 'the owner saves new tuning');
  await sleep(300);
  const pushed = p1.msgs.filter((m) => m.t === 'cosTuning');
  ok(pushed.length === 1 && pushed[0].tuning.mount_wolf?.seat === 0.6, 'a player online gets the new tuning at once');
  ok(auditCount() === 1, 'the change is in the audit log');
  ok(JSON.parse(settingRow() ?? '{}').aura_star?.size === 3, 'saved in the settings table');
  await api('POST', '/admin/cos-look', { tuning: changed }, tok.owner1);
  await sleep(200);
  ok(auditCount() === 1 && p1.msgs.filter((m) => m.t === 'cosTuning').length === 1, 'saving the same tuning again logs and sends nothing');
  const p2 = joinWorld(tok.plain2, chars.plain2);
  await p2.ready;
  ok(p2.msgs.find((m) => m.t === 'welcome')?.cosTuning?.wings_angel?.back === 0.3, 'a player joining later gets the saved tuning');

  // Back to the code defaults.
  const reset = await api('POST', '/admin/cos-look', { reset: true }, tok.owner1);
  await sleep(300);
  ok(reset.status === 200 && JSON.stringify(reset.data.tuning) === '{}' && settingRow() === null, 'reset goes back to the code defaults and removes the setting');
  ok(JSON.stringify(p2.msgs.filter((m) => m.t === 'cosTuning').at(-1)?.tuning) === '{}', 'players online get the reset too');
  ok(auditCount() === 2, 'the reset is in the audit log');

  // ---- paste bench text for many pieces (the "จัดการของแต่งตัว" tab), merged on the server
  await api('POST', '/admin/cos-look', { tuning: { wings_angel: { back: 0.3 }, mount_wolf: { seat: 0.6 } } }, tok.owner1);
  const pasteBase = (await api('GET', '/admin/cos-look', undefined, tok.owner1)).data.tuning;
  const paste = { wings_angel: { backStand: 1.4 }, mount_wolf: {}, pet_cat: { float: 1 }, aura_star: { size: 3 } };
  ok((await api('POST', '/admin/cos-look', { paste, base: pasteBase }, tok.gm1)).status === 403, 'GM cannot save a paste');
  ok((await api('POST', '/admin/cos-look', { paste: { wings_angel: { backStand: 99 } }, base: pasteBase }, tok.owner1)).status === 400, 'a bad paste is refused');
  const n0 = auditCount();
  const pasted = await api('POST', '/admin/cos-look', { paste, only: ['wings_angel', 'mount_wolf', 'pet_cat'], base: pasteBase }, tok.owner1);
  ok(pasted.status === 200 && JSON.stringify(pasted.data.tuning) === JSON.stringify({ wings_angel: { backStand: 1.4 }, pet_cat: { float: 1 } }), `paste: ticked pieces replaced, the {} one back to the code, the unticked one untouched (${JSON.stringify(pasted.data.tuning)})`);
  ok(auditCount() === n0 + 1 && /^วางค่า: .*wings_angel\.backStand 1\.35 → 1\.4/.test(auditOf('cos-look').at(-1) ?? ''), `paste written to the audit log (${auditOf('cos-look').at(-1)})`);
  ok(JSON.parse(settingRow() ?? '{}').pet_cat?.float === 1, 'paste saved in the same cos_tuning setting');
  await sleep(300);
  ok(p2.msgs.filter((m) => m.t === 'cosTuning').at(-1)?.tuning?.pet_cat?.float === 1, 'players online get the pasted values');
  const stale = await api('POST', '/admin/cos-look', { paste, base: pasteBase }, tok.owner1);
  ok(stale.status === 409 && auditCount() === n0 + 1, 'a paste previewed on values saved over since is refused (409), nothing changes');

  // ---- hidden / price (the "จัดการของแต่งตัว" tab)
  const gmShop = await api('GET', '/admin/cos-shop', undefined, tok.gm1);
  ok(gmShop.status === 200 && gmShop.data.canEdit === false && gmShop.data.canPaste === false && JSON.stringify(gmShop.data.shop) === '{}', 'GM sees the shop settings (nothing saved: all shown, no prices) but may not save');
  ok((await api('GET', '/admin/cos-shop', undefined, tok.plain1)).status === 403, 'a player cannot read the shop settings');
  const shop = { wings_bat: { hidden: true }, pet_cat: { price: 500 } };
  ok((await api('POST', '/admin/cos-shop', { shop }, tok.gm1)).status === 403, 'GM cannot save the shop settings');
  ok((await api('POST', '/admin/cos-shop', { shop: { pet_cat: { price: 0 } } }, tok.owner1)).status === 400, 'a bad price is refused');
  ok((await api('POST', '/admin/cos-shop', { shop: { pet_nope: { hidden: true } } }, tok.owner1)).status === 400, 'an unknown cosmetic is refused');
  ok(settingRow(COS_SHOP_SETTING) === null && auditOf('cos-shop').length === 0, 'refused shop saves leave no setting and no audit row');
  const ownShop = await api('POST', '/admin/cos-shop', { shop }, tok.owner1);
  ok(ownShop.status === 200 && ownShop.data.canEdit === true && ownShop.data.shop.pet_cat?.price === 500, 'the owner saves hidden + price');
  ok(JSON.parse(settingRow(COS_SHOP_SETTING) ?? '{}').wings_bat?.hidden === true, 'saved in the settings table (cos_shop)');
  ok(auditOf('cos-shop').length === 1 && auditOf('cos-shop')[0].includes('wings_bat: ซ่อน') && auditOf('cos-shop')[0].includes('pet_cat: ราคา — → 500 เพชร'), `shop change in the audit log (${auditOf('cos-shop')[0]})`);
  await sleep(300);
  const hid = p2.msgs.filter((m) => m.t === 'cosHidden');
  ok(hid.length === 1 && JSON.stringify(hid[0].ids) === '["wings_bat"]', 'players online get the hidden list at once');
  ok(!JSON.stringify(p2.msgs.filter((m) => m.t !== 'snap')).includes('"price"'), 'prices are never sent to players');
  await api('POST', '/admin/cos-shop', { shop: { wings_bat: { hidden: true }, pet_cat: { price: 600 } } }, tok.owner1);
  await sleep(200);
  ok(auditOf('cos-shop').length === 2 && p2.msgs.filter((m) => m.t === 'cosHidden').length === 1, 'a price-only change is logged but sends nothing to players');
  p1.ws.close();
  await sleep(200);
  const p3 = joinWorld(tok.plain1, chars.plain1);
  await p3.ready;
  ok(JSON.stringify(p3.msgs.find((m) => m.t === 'welcome')?.cosHidden) === '["wings_bat"]', 'joining later gets the hidden list in welcome');
  p3.ws.close();
  p2.ws.close();
}

run()
  .catch((e) => ok(false, `crashed: ${(e as Error).stack ?? e}`))
  .finally(async () => {
    proc?.kill();
    await sleep(300);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may still hold the database for a moment; it is in the temp folder anyway.
    }
    finish('cos look');
  });
