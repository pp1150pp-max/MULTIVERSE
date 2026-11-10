// Mail tab of the admin page: send a mail (to a character, an account, every character or every account,
// optionally with attachments), see what was sent and who read / claimed it, and pull a mail back.
// The rules and every value check live in server/mail.ts; this only checks the role and records the audit.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import type { GameWorld } from './world';
import { HttpError, readJson, send } from './http';
import { log, requireAdmin, type Admin } from './admin';
import { ADMIN_NO_RIGHTS } from '../src/shared/admin';
import { describeAttach, cleanAttach, type MailTargetReq } from '../src/shared/mail';

/** Sends listed per page of the history, and copies listed in one send's detail. */
const HISTORY_PAGE = 30;
const RECIPIENTS_MAX = 200;

function requireMail(req: IncomingMessage, db: Db): Admin {
  const a = requireAdmin(req, db);
  if (!a.features.includes('mail')) throw new HttpError(403, ADMIN_NO_RIGHTS);
  return a;
}

/** Handles the mail routes; returns false for any other path. */
export async function mailAdminApi(
  req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db, world: GameWorld,
): Promise<boolean> {
  if (method === 'POST' && path === '/api/admin/mail') {
    const a = requireMail(req, db);
    const body = await readJson(req);
    const target = (typeof body.target === 'object' && body.target ? body.target : {}) as MailTargetReq;
    const r = world.mail.send({ id: a.acc.id, name: a.acc.username }, { target, title: body.title, body: body.body, attach: body.attach });
    if (typeof r === 'string') throw new HttpError(400, r);
    const att = cleanAttach(body.attach);
    const lines = typeof att === 'string' ? [] : describeAttach(att);
    log(db, a, 'mail', `${r.label} (ส่ง ${r.copies} ฉบับ, #${r.id})`, `${String(body.title).trim().slice(0, 60)}${lines.length ? ` · แนบ: ${lines.join(', ')}` : ' · ไม่มีของแนบ'}`);
    world.mailArrived();
    send(res, 200, { msg: `ส่งจดหมายถึง${r.label}แล้ว (${r.copies.toLocaleString()} ฉบับ)`, id: r.id });
    return true;
  }

  if (method === 'GET' && path === '/api/admin/mail') {
    requireMail(req, db);
    const before = Number(new URL(req.url ?? '/', 'http://localhost').searchParams.get('before'));
    send(res, 200, world.mail.history(HISTORY_PAGE, Number.isSafeInteger(before) && before > 0 ? before : undefined));
    return true;
  }

  const one = /^\/api\/admin\/mail\/(\d{1,12})\/(recipients|recall)$/.exec(path);
  if (one) {
    const id = Number(one[1]);
    if (method === 'GET' && one[2] === 'recipients') {
      requireMail(req, db);
      send(res, 200, world.mail.recipients(id, RECIPIENTS_MAX));
      return true;
    }
    if (method === 'POST' && one[2] === 'recall') {
      const a = requireMail(req, db);
      const sent = db.mailSend(id);
      const r = world.mail.recall(id);
      if (typeof r === 'string') throw new HttpError(400, r);
      log(db, a, 'mailRecall', `#${id} ${sent?.target ?? ''}`, `ดึงกลับ ${r} ฉบับ · ${sent?.title ?? ''}`);
      world.mailArrived(true);
      send(res, 200, { msg: `ดึงจดหมายกลับ ${r.toLocaleString()} ฉบับแล้ว` });
      return true;
    }
  }
  return false;
}
