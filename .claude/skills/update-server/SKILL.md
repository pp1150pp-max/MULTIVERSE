---
name: update-server
description: อัปเดต server จริงของ MULTIVERSE ให้เป็นโค้ดล่าสุดบน main (pull → ตรวจ → build → รีสตาร์ทผ่าน countdown พร้อมป้าย "มีการอัปเดต") ใช้เมื่อเจ้าของสั่งให้อัปเดต/รีสตาร์ท server หลัง merge PR
disable-model-invocation: true
---

# อัปเดต server จริง

ผู้เล่นต้องเห็นป้าย "มีการอัปเดตเซิร์ฟเวอร์ กำลังจะรีสตาร์ทใน 10 วินาที" (โหมด **รีสตาร์ท** ไม่ใช่โหมดปิด) และลิงก์ Cloudflare ต้องไม่เปลี่ยน
รายละเอียด countdown / สำรอง DB: `docs/systems/server-ops.md`

**ห้าม:** kill task ของ `npm run online` · `npm run build` (ใช้ `npx vite build` เฉพาะขั้นที่ 4) · สร้างบัญชีทดสอบบน server จริง

## ขั้นตอน

1. **เช็คสถานะ** — ต้องอยู่บน `main` ที่ไม่มีงานค้าง (`git status`) แล้ว `git pull --ff-only` · ดูว่ามีอะไรใช้ port 2567 อยู่ไหม (`netstat -ano | grep :2567`) และมี task `npm run online` ของ session นี้หรือ session ก่อนรันอยู่หรือไม่
2. **ตรวจโค้ด** — `npm run typecheck` และ `npm run test` ต้องผ่านทั้งคู่ ถ้าไม่ผ่านให้หยุดแล้วรายงานเจ้าของ ห้ามรีสตาร์ท
3. **ถ้า PR ที่ merge เปลี่ยนรูปแบบเซฟ/ตาราง DB** — สำรอง DB ก่อน (ปุ่มสำรองใน `/admin` หรือ `VACUUM INTO` แบบ read-only ด้วย `node:sqlite` ลง `server/data/backups/`) · ถ้า `package.json` เปลี่ยน dependency ต้อง `npm ci` ซึ่งต้องปิด server เต็ม (โหมดปิด) → บอกเจ้าของก่อนว่าป้ายจะเป็นข้อความปิด ไม่ใช่อัปเดต
4. **build** — `npx vite build` (ทำทันทีก่อนรีสตาร์ท เพราะ `--restart` ไม่ build ให้)
5. **รีสตาร์ท**
   - มี `npm run online` รันอยู่ → `timeout 90 npm run stop-server -- --restart` แล้วรอ output ของ task online ขึ้น "พร้อมแล้ว" ครั้งใหม่
   - ไม่มีอะไรรันอยู่ → เปิด `npm run tunnel` แบบ background (หาลิงก์ trycloudflare ใน output) แล้ว `npm run online` แบบ background รอ "พร้อมแล้ว" · ลิงก์ใหม่ = **บอกเจ้าของให้ส่งลิงก์ใหม่ให้เพื่อน**
6. **ยืนยัน** — `curl -s -o /dev/null -w "%{http_code}"` ที่ `/` และ `/admin` ของลิงก์เพื่อน ต้องได้ 200
7. **รายงาน** — สั้น ๆ: commit ที่รันอยู่ (`git log -1 --oneline`), ลิงก์ (เปลี่ยนหรือไม่), ผล typecheck/test, สำรอง DB หรือไม่
