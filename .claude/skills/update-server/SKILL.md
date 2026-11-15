---
name: update-server
description: อัปเดต server จริงของ MULTIVERSE บน VPS ให้เป็นโค้ดล่าสุดบน main (ตรวจบนเครื่องบ้าน → ssh ไป VPS: pull → build → รีสตาร์ทผ่าน countdown พร้อมป้าย "มีการอัปเดต") ใช้เมื่อเจ้าของสั่งให้อัปเดต/รีสตาร์ท server หลัง merge PR
disable-model-invocation: true
---

# อัปเดต server จริง (VPS)

server จริงอยู่บน VPS (Hostatom Cloud VPS SSD2 ในไทย, Ubuntu 24.04) รันด้วย systemd unit `multiverse` เป็น user `multiverse` ในโฟลเดอร์ `~/MULTIVERSE` · สั่งงานผ่าน SSH ชื่อ `multiverse-vps` (ตั้งใน `~/.ssh/config` ของเครื่องบ้าน) · รายละเอียด: `docs/systems/server-ops.md` หัวข้อ VPS, `docs/vps-move.md`

ผู้เล่นต้องเห็นป้าย "มีการอัปเดตเซิร์ฟเวอร์ กำลังจะรีสตาร์ทใน …" (โหมด **รีสตาร์ท** ไม่ใช่โหมดปิด) และลิงก์ `play.multiverse-game.com` ไม่เปลี่ยน

ทุกคำสั่งบน VPS: `ssh -o BatchMode=yes multiverse-vps "cd MULTIVERSE && <คำสั่ง>"` (ด้านล่างเขียนแค่ `<คำสั่ง>` ว่า **VPS:**)

**ห้าม:** `kill` / `systemctl kill` / `systemctl restart` server · `npm run build` บน VPS (ใช้ `npx vite build` เฉพาะขั้นที่ 4) · รัน `npm run test` บน VPS (ตรวจบนเครื่องบ้าน) · สร้างบัญชีทดสอบบน server จริง · ใส่ IP ของ VPS ใน repo · ส่ง `tunnel-config.json` / `.cloudflared` / DB ทางแชท

## ขั้นตอน

1. **เช็คสถานะ**
   - เครื่องบ้าน (โฟลเดอร์หลักหรือ worktree บน `main` ล่าสุด): `git fetch` แล้วดู commit ของ `origin/main`
   - ติดต่อ VPS ได้: `ssh -o BatchMode=yes multiverse-vps true` (ถ้าไม่ได้ หยุดและบอกเจ้าของ ห้ามเดา)
   - **VPS:** `git status --short` ต้องว่าง · `git log -1 --oneline` (commit ที่รันอยู่) · `npm run autostart` (สถานะ unit) · `npm run logs -- --lines 20`
2. **ตรวจโค้ดบนเครื่องบ้าน** — `npm run typecheck` และ `npm run test` ของ `origin/main` ต้องผ่านทั้งคู่ ถ้าไม่ผ่านให้หยุดแล้วรายงานเจ้าของ ห้ามรีสตาร์ท
3. **ถ้า `package.json` เปลี่ยน dependency** — สคริปต์ในขั้น 4 จะปิด server เต็ม (ป้ายปิด 120 วิ ไม่ใช่ป้ายอัปเดต) แล้ว `npm ci` → บอกเจ้าของก่อน
4. **deploy** — **VPS:** `tools/deploy.sh deploy <commit ของ origin/main ที่ตรวจในขั้น 2>` (ใช้ timeout ของ Bash ≥ 400 วิ) สคริปต์เดียวกับปุ่ม Deploy บน GitHub (`docs/systems/server-ops.md` หัวข้อ "ปุ่ม Deploy"):
   สำรอง DB (`backups/multiverse-before-deploy-…db`) → pull (ต้องตรงกับ commit ที่ให้) → build ลง `dist-next` แล้วสลับ → รีสตาร์ทนับถอยหลัง 120 วิ (หรือเปิด unit ถ้าไม่ได้เปิด) → รอ server ตอบ
   - `มีคนกำลัง deploy อยู่` (exit 3) = เพื่อนกดปุ่มอยู่ → รอแล้วดู `tools/deploy.sh status` ห้ามสั่งซ้อน
   - `main ล่าสุดคือ … ไม่ใช่ …` (exit 5) = มีคน merge เพิ่ม → กลับไปขั้น 2 กับ commit ใหม่
   - `git status ไม่ว่าง` (exit 4) / build ไม่ผ่าน (exit 6, ถอยโค้ดให้แล้ว) → หยุด รายงานเจ้าของ
   - อยากตั้งชื่อไฟล์สำรองตามเรื่อง (PR เปลี่ยนเซฟ/ตาราง DB): **VPS:** `sqlite3 server/data/multiverse.db "VACUUM INTO 'server/data/backups/multiverse-before-<เรื่อง>-<เวลา>.db'"` ก่อนขั้นนี้
5. **ถ้า server ไม่ขึ้น** — **VPS:** `tools/deploy.sh logs` · port 2567 มีโปรแกรมอื่นใช้ = server ที่ไม่มีตัวคุม → `npm run stop-server` แล้ว `npm run autostart -- -Start` · ไม่ขึ้นกล่องลิงก์ = ดู `cloudflared` ใน log (ตัวคุมเปิดใหม่เองเมื่อหลุด) · ตัวคุมเปิดไม่ขึ้นเลย: `journalctl -u multiverse -n 50 --no-pager`
6. **ยืนยัน** — จากเครื่องบ้าน `curl -s -o /dev/null -w "%{http_code}"` ที่ `https://play.multiverse-game.com/` และ `/admin` ต้องได้ 200
7. **สำรองนอกเครื่อง** — เครื่องบ้าน `npm run pull-backup` (ดึงไฟล์สำรองล่าสุดจาก VPS มาเก็บ) ถ้าล้มไม่ต้องหยุดงาน แต่บอกในรายงาน
8. **รายงาน** — สั้น ๆ: commit ที่รันอยู่บน VPS (`git log -1 --oneline`), ลิงก์ (เปลี่ยนหรือไม่), ผล typecheck/test, สำรอง DB หรือไม่, pull-backup ได้ไฟล์ไหน
