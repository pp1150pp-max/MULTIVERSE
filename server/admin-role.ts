// Gives an account an admin role from the command line (the only way to make an owner):
//
//   npm run admin-role -- <username> owner|gm|none
//
// Uses the same database as `npm run server` (server/data/multiverse.db, or DB_FILE). It is safe to run
// while the server is up: the server reads the role from the database on every admin request.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db } from './db';
import { isAdminRole } from '../src/shared/admin';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DB_FILE = process.env.DB_FILE ?? join(ROOT, 'server', 'data', 'multiverse.db');
const [username, roleArg] = process.argv.slice(2);

if (!username || !(isAdminRole(roleArg) || roleArg === 'none')) {
  console.error('ใช้แบบนี้: npm run admin-role -- <ชื่อผู้ใช้> owner|gm|none');
  process.exit(1);
}

const db = new Db(DB_FILE);
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
