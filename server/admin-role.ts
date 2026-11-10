// Gives an account an admin role from the command line (the only way to make an owner):
//
//   npm run admin-role -- <username> owner|gm|none|<a role added on the /admin Permissions tab>
//
// Uses the same database as `npm run server` (server/data/multiverse.db, or DB_FILE). It is safe to run
// while the server is up: the server reads the role from the database on every admin request.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db } from './db';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DB_FILE = process.env.DB_FILE ?? join(ROOT, 'server', 'data', 'multiverse.db');
const [username, roleArg] = process.argv.slice(2);

if (!username || !roleArg) {
  console.error('ใช้แบบนี้: npm run admin-role -- <ชื่อผู้ใช้> owner|gm|none|<รหัส role ที่สร้างในหน้า /admin>');
  process.exit(1);
}

const db = new Db(DB_FILE);
if (roleArg !== 'none' && !db.isRole(roleArg)) {
  console.error(`ไม่มี role "${roleArg}" ใน ${DB_FILE} (มี: ${db.roleDefs().map((r) => r.id).join(', ')}, none)`);
  db.close();
  process.exit(1);
}
const acc = db.findAccount(username);
if (!acc) {
  console.error(`ไม่พบบัญชี "${username}" ใน ${DB_FILE} (Guest รับสิทธิ์ไม่ได้)`);
  db.close();
  process.exit(1);
}
const role = roleArg === 'none' ? null : roleArg;
const before = db.adminRole(acc.id);
db.setAdminRole(acc.id, role);
db.audit(null, 'command line', role ? 'grant' : 'revoke', acc.username, `${before ?? 'none'} → ${role ?? 'none'}`);
db.close();
console.log(`${acc.username}: ${before ?? 'none'} → ${role ?? 'none'}  (${DB_FILE})`);
