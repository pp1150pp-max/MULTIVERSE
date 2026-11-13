---
name: update-server
description: อัปเดต server จริงของ MULTIVERSE ให้เป็นโค้ดล่าสุดบน main (pull → ตรวจ → build → รีสตาร์ทผ่าน countdown พร้อมป้าย "มีการอัปเดต") ใช้เมื่อเจ้าของสั่งให้อัปเดต/รีสตาร์ท server หลัง merge PR
disable-model-invocation: true
---

# อัปเดต server จริง

ผู้เล่นต้องเห็นป้าย "มีการอัปเดตเซิร์ฟเวอร์ กำลังจะรีสตาร์ทใน 10 วินาที" (โหมด **รีสตาร์ท** ไม่ใช่โหมดปิด) และลิงก์ Cloudflare ต้องไม่เปลี่ยน
รายละเอียด countdown / สำรอง DB: `docs/systems/server-ops.md`

**ห้าม:** kill task ของ `npm run online` หรือกด "End" ที่ task `MULTIVERSE server` ใน Task Scheduler · `npm run build` (ใช้ `npx vite build` เฉพาะขั้นที่ 4) · สร้างบัญชีทดสอบบน server จริง

## ขั้นตอน

1. **เช็คสถานะ** — ต้องอยู่บน `main` ที่ไม่มีงานค้าง (`git status`) แล้ว `git pull --ff-only` · ดูว่ามีอะไรใช้ port 2567 อยู่ไหม (`netstat -ano | grep :2567`) · ปกติ server จริงรันจาก Task Scheduler `MULTIVERSE server` (`npm run always-on` ไม่มีหน้าต่าง) ดูด้วย `npm run autostart` (สถานะ task) และ `npm run logs` (log ท้ายไฟล์ `server/data/logs/online-*.log`) · อาจเป็นหน้าต่าง cmd `npm run online` แบบเดิมก็ได้ ทั้งสองแบบรีสตาร์ทด้วยวิธีเดียวกัน
2. **ตรวจโค้ด** — `npm run typecheck` และ `npm run test` ต้องผ่านทั้งคู่ ถ้าไม่ผ่านให้หยุดแล้วรายงานเจ้าของ ห้ามรีสตาร์ท
3. **ถ้า PR ที่ merge เปลี่ยนรูปแบบเซฟ/ตาราง DB** — สำรอง DB ก่อน (ปุ่มสำรองใน `/admin` หรือ `VACUUM INTO` แบบ read-only ด้วย `node:sqlite` ลง `server/data/backups/`) · ถ้า `package.json` เปลี่ยน dependency ต้อง `npm ci` ซึ่งต้องปิด server เต็ม (โหมดปิด) → บอกเจ้าของก่อนว่าป้ายจะเป็นข้อความปิด ไม่ใช่อัปเดต
4. **build** — `npx vite build` (ทำทันทีก่อนรีสตาร์ท เพราะ `--restart` ไม่ build ให้)
5. **รีสตาร์ท**
   - server เปิดอยู่ (always-on หรือ `npm run online`) → `npm run stop-server -- --restart --seconds 120` (ถ้าครอบ `timeout` ต้องนานกว่าเวลานับ เช่น `timeout 200`) แล้วดู `npm run logs` จนขึ้น "รีสตาร์ท server" ตามด้วย "พร้อมแล้ว" ครั้งใหม่
   - ไม่มีอะไรรันอยู่ (port 2567 ว่าง) → `npm run autostart -- -Start` (เปิด task, ไม่ build) แล้วดู `npm run logs` จนขึ้น "พร้อมแล้ว" และลิงก์ · **ห้ามเปิด server จริงในแท็บ Terminal ของแอปหรือ task background ของ session** (แท็บหาย = server ดับ) · ถ้า task ยังไม่ได้ลงทะเบียน ให้เปิดหน้าต่างแยกด้วย `Start-Process` (`npm run tunnel` + `npm run online`) และบอกเจ้าของ
   - `npm run autostart` ขึ้น task จบแล้ว แต่ port 2567 ยังมี server = server ที่ไม่มีตัวคุม (มีคนกด End ที่ task) → `npm run stop-server` ก่อน แล้ว `-Start`
   - ลิงก์เป็นลิงก์ถาวร (`play.multiverse-game.com`) ไม่เปลี่ยน · ถ้าใน log ไม่ขึ้นกล่องลิงก์ ให้ดู `cloudflared` ใน log (ตัวคุมเปิด cloudflared ใหม่เองเมื่อหลุด)
6. **ยืนยัน** — `curl -s -o /dev/null -w "%{http_code}"` ที่ `/` และ `/admin` ของลิงก์เพื่อน ต้องได้ 200
7. **รายงาน** — สั้น ๆ: commit ที่รันอยู่ (`git log -1 --oneline`), ลิงก์ (เปลี่ยนหรือไม่), ผล typecheck/test, สำรอง DB หรือไม่
