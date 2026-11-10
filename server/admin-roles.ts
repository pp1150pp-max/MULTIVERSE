// The Permissions tab (owner only): which admin role may use which tool, adding / renaming / deleting
// roles, and giving a role to an account. Every value from the page is checked here; every change goes
// to admin_audit. 'owner' always has every tool and can't be changed, given or taken from here.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import { HttpError, readJson, send, str } from './http';
import { log, requireAdmin } from './admin';
import { checkUsername } from '../src/shared/api';
import {
  CUSTOM_ROLES_MAX, FEATURE_INFO, featureOverrides, isAdminFeature, OWNER_ROLE, RESERVED_ROLE_IDS, ROLE_ID_RE, ROLE_NAME_MAX,
  type AdminFeature, type RoleDefsResponse,
} from '../src/shared/admin';

const defs = (db: Db): RoleDefsResponse => ({ roles: db.roleDefs(), admins: db.listAdmins() });

/** A role's display name from the page: no control characters, 1–ROLE_NAME_MAX long. */
function roleName(v: unknown): string {
  const name = str(v).replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!name || [...name].length > ROLE_NAME_MAX) throw new HttpError(400, `ชื่อ role ต้องยาว 1–${ROLE_NAME_MAX} ตัวอักษร`);
  return name;
}

/** The tool list from the page: an array of known tools, no repeats. */
function featureList(v: unknown): AdminFeature[] {
  if (!Array.isArray(v)) throw new HttpError(400, 'รายการเครื่องมือไม่ถูกต้อง');
  const out: AdminFeature[] = [];
  for (const f of v) {
    if (!isAdminFeature(f)) throw new HttpError(400, 'มีเครื่องมือที่ไม่รู้จัก');
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

const toolNames = (fs: readonly AdminFeature[]): string => fs.map((f) => FEATURE_INFO[f].name).join(', ') || 'ไม่มี';

/** Handles the role routes; returns false for any other path. */
export async function rolesAdminApi(req: IncomingMessage, res: ServerResponse, path: string, method: string, _url: URL, db: Db): Promise<boolean> {
  // ---------------------------------------------------------- who holds a role
  if (method === 'GET' && path === '/api/admin/roles') {
    requireAdmin(req, db, 'owner');
    send(res, 200, db.listAdmins());
    return true;
  }

  if (method === 'POST' && path === '/api/admin/roles') {
    const a = requireAdmin(req, db, 'owner');
    const body = await readJson(req);
    const username = str(body.username).trim();
    if (checkUsername(username)) throw new HttpError(400, 'ชื่อผู้ใช้ไม่ถูกต้อง');
    // Owners are made from the command line only, so the page can't lock the owner out or add one.
    if (body.role === OWNER_ROLE) throw new HttpError(400, 'ตั้ง owner ได้จาก command line เท่านั้น');
    const role = body.role === null ? null : db.isRole(body.role) ? body.role : undefined;
    if (role === undefined) throw new HttpError(400, 'ไม่มี role นี้');
    const acc = db.findAccount(username);
    if (!acc) throw new HttpError(404, 'ไม่พบบัญชีนี้ (Guest รับสิทธิ์ไม่ได้)');
    const before = db.adminRole(acc.id);
    if (before === OWNER_ROLE) throw new HttpError(400, 'เปลี่ยนสิทธิ์ของ owner จากหน้านี้ไม่ได้');
    db.setAdminRole(acc.id, role);
    const name = (r: string | null) => (r ? db.roleName(r) : 'ผู้เล่นธรรมดา');
    log(db, a, role ? 'grant' : 'revoke', acc.username, `${name(before)} → ${name(role)}`);
    send(res, 200, db.listAdmins());
    return true;
  }

  // ---------------------------------------------------------- the roles themselves
  if (method === 'GET' && path === '/api/admin/role-defs') {
    requireAdmin(req, db, 'owner');
    send(res, 200, defs(db));
    return true;
  }

  // Add a role (`create: true`) or change one's name and tools. Answers every role again.
  if (method === 'POST' && path === '/api/admin/role-defs') {
    const a = requireAdmin(req, db, 'owner');
    const body = await readJson(req);
    const id = str(body.id).trim();
    if (id === OWNER_ROLE) throw new HttpError(400, 'owner ใช้ได้ทุกอย่างเสมอ แก้ไม่ได้');
    const name = roleName(body.name);
    const features = featureList(body.features);
    const create = body.create === true;
    const all = db.roleDefs();
    if (create) {
      if (!ROLE_ID_RE.test(id)) throw new HttpError(400, 'รหัส role ใช้ a–z 0–9 _ ขึ้นต้นด้วยตัวอักษร ยาว 2–20 ตัว');
      if (RESERVED_ROLE_IDS.includes(id) || all.some((r) => r.id === id)) throw new HttpError(409, `มี role รหัส "${id}" แล้ว หรือใช้รหัสนี้ไม่ได้`);
      if (all.filter((r) => !r.builtin).length >= CUSTOM_ROLES_MAX) throw new HttpError(400, `สร้าง role ได้ไม่เกิน ${CUSTOM_ROLES_MAX} อัน`);
    } else if (!all.some((r) => r.id === id)) {
      throw new HttpError(404, 'ไม่มี role นี้');
    }
    if (all.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, `มี role ชื่อ "${name}" แล้ว`);
    const old = all.find((r) => r.id === id);
    db.saveRole(id, name, featureOverrides(id, features));
    const now = db.roleFeatures(id);
    if (!old) {
      log(db, a, 'role-create', id, `ชื่อ "${name}" · เครื่องมือ: ${toolNames(now)}`);
    } else {
      const added = now.filter((f) => !old.features.includes(f));
      const removed = old.features.filter((f) => !now.includes(f));
      const parts: string[] = [];
      if (old.name !== name) parts.push(`ชื่อ "${old.name}" → "${name}"`);
      if (added.length) parts.push(`เพิ่ม: ${toolNames(added)}`);
      if (removed.length) parts.push(`เอาออก: ${toolNames(removed)}`);
      if (parts.length) log(db, a, 'role-edit', id, parts.join(' · '));
    }
    send(res, 200, defs(db));
    return true;
  }

  const del = /^\/api\/admin\/role-defs\/([a-z0-9_]{1,20})$/.exec(path);
  if (method === 'DELETE' && del) {
    const a = requireAdmin(req, db, 'owner');
    const id = del[1];
    const role = db.roleDefs().find((r) => r.id === id);
    if (!role) throw new HttpError(404, 'ไม่มี role นี้');
    if (role.builtin) throw new HttpError(400, `ลบ role ${role.name} ไม่ได้ (มากับระบบ)`);
    // Owner's choice (2026-11-10): a role still held by someone can't be deleted.
    if (role.members > 0) throw new HttpError(409, `ยังมี ${role.members} บัญชีใช้ role นี้ เปลี่ยน role ของบัญชีเหล่านั้นก่อน`);
    db.deleteRole(id);
    log(db, a, 'role-delete', id, `ลบ role "${role.name}"`);
    send(res, 200, defs(db));
    return true;
  }

  return false;
}
