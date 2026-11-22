// "เติมเงิน" tab of the admin page (src/admin/topup.ts, docs/systems/topup.md): PromptPay top-up requests.
// Confirm / reject / reverse = the `topupConfirm` switch; the settings (PromptPay number, on/off, expiry,
// notice) and the close beta refund are owner-only for good. Everything goes into the audit, with the
// PromptPay number masked; players online get the change at once.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import type { GameWorld } from './world';
import { HttpError, readJson, send } from './http';
import { log, requireAdmin, requireFeature, type Admin } from './admin';
import { ReverseShort } from './topup';
import { OWNER_ROLE } from '../src/shared/admin';
import { bahtText, checkTopup, maskPromptPay, topupChanges, type AdminTopup, type TopupRow } from '../src/shared/topup';

/** Requests listed on the tab. */
const LIST = 300;

function state(db: Db, world: GameWorld, a: Admin): AdminTopup {
  db.topupExpire(Date.now());
  const cfg = world.topup.cfg();
  const isOwner = a.role === OWNER_ROLE;
  return {
    cfg: isOwner ? cfg : { ...cfg, promptpay: maskPromptPay(cfg.promptpay) },
    isOwner, canConfirm: a.features.includes('topupConfirm'),
    rows: db.topupList(LIST), refund: world.topup.refundCfg(), refunded: db.topupRefundStats(), totals: db.topupTotals(),
  };
}

const what = (r: TopupRow) => `#${r.id} ยอด ${bahtText(r.amount)} บาท · ${r.crystals.toLocaleString('en-US')}+${r.bonus.toLocaleString('en-US')} คริสตัล (${r.charName})`;

/** Handles the top-up routes; returns false for any other path. */
export async function topupAdminApi(
  req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db, world: GameWorld,
): Promise<boolean> {
  if (!path.startsWith('/api/admin/topup')) return false;
  if (method === 'GET' && path === '/api/admin/topup') {
    send(res, 200, state(db, world, requireFeature(req, db, 'topup')));
    return true;
  }
  if (method !== 'POST') return false;

  if (path === '/api/admin/topup/settings') {
    const a = requireAdmin(req, db, OWNER_ROLE);
    const body = await readJson(req);
    const before = world.topup.cfg();
    // `base` = what the page loaded: refuse if someone saved since (else this would undo it).
    if (body.base !== undefined && JSON.stringify(checkTopup(body.base, false).value) !== JSON.stringify(before)) {
      throw new HttpError(409, 'ค่าของเซิร์ฟเปลี่ยนไปแล้วหลังโหลดหน้านี้ กดโหลดใหม่ก่อน');
    }
    const c = checkTopup(body.cfg, true);
    if (!c.value) throw new HttpError(400, c.error);
    const changes = topupChanges(before, c.value);
    if (changes) {
      world.topup.setCfg(c.value);
      log(db, a, 'topup-settings', 'เติมเงิน', changes);
      world.topupAll();
    }
    send(res, 200, state(db, world, a));
    return true;
  }

  if (path === '/api/admin/topup/refund') {
    const a = requireAdmin(req, db, OWNER_ROLE);
    const body = await readJson(req);
    if (typeof body.on !== 'boolean') throw new HttpError(400, 'ค่า on ต้องเป็น true/false');
    const was = world.topup.refundCfg();
    // Top-up open while the refund starts = a top-up confirmed in between could pay twice (crystals now + refund).
    if (body.on && !was && world.topup.cfg().open) throw new HttpError(409, 'ปิดการเติมก่อนเปิดคืนเพชร (กันรายการที่ยืนยันระหว่างนี้ได้เพชรซ้ำ)');
    if (body.on !== !!was) {
      world.topup.setRefund(body.on, a.acc.username);
      log(db, a, 'topup-refund-switch', 'คืนเพชร close beta', body.on ? 'เปิด: บัญชีที่เข้าเกมครั้งถัดไปได้คริสตัลคืน (ครั้งเดียวต่อบัญชี)' : 'ปิด');
    }
    send(res, 200, state(db, world, a));
    return true;
  }

  const m = /^\/api\/admin\/topup\/(\d{1,12})\/(confirm|reject|reverse)$/.exec(path);
  if (!m) return false;
  const a = requireFeature(req, db, 'topupConfirm');
  const id = Number(m[1]);
  const op = m[2] as 'confirm' | 'reject' | 'reverse';
  let r;
  try {
    r = op === 'confirm' ? world.topup.confirm(id, a.acc.username) : op === 'reject' ? world.topup.reject(id, a.acc.username) : world.topup.reverse(id, a.acc.username);
  } catch (e) {
    if (e instanceof ReverseShort) throw new HttpError(409, e.message);
    throw e;
  }
  if (!r.ok) throw new HttpError(409, r.msg);
  const row = r.row;
  const n = (row.crystals + row.bonus).toLocaleString('en-US');
  log(db, a, `topup-${op}`, row.username, what(row));
  if (op !== 'reject') world.crystalsChanged(row.accountId);
  world.topupChanged(row.accountId, op === 'confirm'
    ? `เติมคริสตัลมิติสำเร็จ +${n} (ยอด ${bahtText(row.amount)} บาท) ขอบคุณที่สนับสนุนเกม`
    : op === 'reject' ? `คำขอเติม ${bahtText(row.amount)} บาท ถูกปฏิเสธ ถ้าโอนแล้วติดต่อทีมงาน`
    : `รายการเติม ${bahtText(row.amount)} บาท ถูกย้อน (−${n} คริสตัลมิติ) ติดต่อทีมงานถ้าสงสัย`);
  send(res, 200, state(db, world, a));
  return true;
}
