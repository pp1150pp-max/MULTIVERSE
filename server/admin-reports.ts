// Reports tab of the admin page: bug reports / feedback from players (written by server/reports.ts).
//   GET  /api/admin/reports?topic=&status=&before=   newest first, `reports` switch
//   POST /api/admin/reports/status  { id, status }   `reports` switch
//   POST /api/admin/reports/ban     { accountId, banned }  `reportBan` switch: may / may not send reports
// Every change goes to admin_audit.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import { HttpError, readJson, send } from './http';
import { log, requireAdmin } from './admin';
import { ADMIN_NO_RIGHTS, canUse, type AdminFeature } from '../src/shared/admin';
import { isReportStatus, isReportTopic, REPORT_ADMIN_PAGE, REPORT_STATUS_LABEL } from '../src/shared/reports';

/** Handles the report routes; returns false for any other path. */
export async function reportsAdminApi(req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db): Promise<boolean> {
  if (!path.startsWith('/api/admin/reports')) return false;
  const need = (f: AdminFeature) => {
    const a = requireAdmin(req, db);
    if (!canUse(a.role, f)) throw new HttpError(403, ADMIN_NO_RIGHTS);
    return a;
  };

  if (method === 'GET' && path === '/api/admin/reports') {
    need('reports');
    const p = new URL(req.url ?? '/', 'http://localhost').searchParams;
    const topic = p.get('topic') ?? '';
    const status = p.get('status') ?? '';
    if (topic && !isReportTopic(topic)) throw new HttpError(400, 'หัวข้อไม่ถูกต้อง');
    if (status && !isReportStatus(status)) throw new HttpError(400, 'สถานะไม่ถูกต้อง');
    const before = Number(p.get('before'));
    send(res, 200, db.listReports(REPORT_ADMIN_PAGE, Number.isSafeInteger(before) && before > 0 ? before : undefined, topic || undefined, status || undefined));
    return true;
  }

  if (method === 'POST' && path === '/api/admin/reports/status') {
    const a = need('reports');
    const body = await readJson(req);
    if (typeof body.id !== 'number' || !Number.isSafeInteger(body.id)) throw new HttpError(400, 'รหัสรายงานไม่ถูกต้อง');
    if (!isReportStatus(body.status)) throw new HttpError(400, 'สถานะไม่ถูกต้อง');
    const done = db.setReportStatus(body.id, body.status);
    if (!done) throw new HttpError(404, 'ไม่พบรายงานนี้');
    log(db, a, 'report-status', `#${body.id}`, `${REPORT_STATUS_LABEL[done.old as keyof typeof REPORT_STATUS_LABEL] ?? done.old} → ${REPORT_STATUS_LABEL[body.status]}`);
    send(res, 200, { ok: true });
    return true;
  }

  if (method === 'POST' && path === '/api/admin/reports/ban') {
    const a = need('reportBan');
    const body = await readJson(req);
    if (typeof body.accountId !== 'number' || !Number.isSafeInteger(body.accountId) || typeof body.banned !== 'boolean') {
      throw new HttpError(400, 'ข้อมูลไม่ถูกต้อง');
    }
    const acc = db.accountName(body.accountId);
    if (!acc || acc.guest) throw new HttpError(404, 'ไม่พบบัญชีนี้');
    db.setReportBan(body.accountId, body.banned, a.acc.username);
    log(db, a, body.banned ? 'report-ban' : 'report-unban', acc.username, body.banned ? 'ห้ามส่งรายงาน' : 'ให้ส่งรายงานได้อีก');
    send(res, 200, { ok: true });
    return true;
  }
  return false;
}
