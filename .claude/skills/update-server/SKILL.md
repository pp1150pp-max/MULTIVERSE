---
name: update-server
description: อัปเดต server จริงของ MULTIVERSE บน VPS ให้เป็นโค้ดล่าสุดบน main (ตรวจบนเครื่องบ้าน → ssh ไป VPS: pull → build → รีสตาร์ทผ่าน countdown พร้อมป้าย "มีการอัปเดต") ใช้เมื่อเจ้าของสั่งให้อัปเดต/รีสตาร์ท server หลัง merge PR
disable-model-invocation: true
---

# อัปเดต server จริง (VPS)

server จริงอยู่บน VPS (Vultr กรุงเทพ, Ubuntu) รันด้วย systemd unit `multiverse` เป็น user `multiverse` ในโฟลเดอร์ `~/MULTIVERSE` · สั่งงานผ่าน SSH ชื่อ `multiverse-vps` (ตั้งใน `~/.ssh/config` ของเครื่องบ้าน) · รายละเอียด: `docs/systems/server-ops.md` หัวข้อ VPS, `docs/vps-move.md`

ผู้เล่นต้องเห็นป้าย "มีการอัปเดตเซิร์ฟเวอร์ กำลังจะรีสตาร์ทใน …" (โหมด **รีสตาร์ท** ไม่ใช่โหมดปิด) และลิงก์ `play.multiverse-game.com` ไม่เปลี่ยน

ทุกคำสั่งบน VPS: `ssh -o BatchMode=yes multiverse-vps "cd MULTIVERSE && <คำสั่ง>"` (ด้านล่างเขียนแค่ `<คำสั่ง>` ว่า **VPS:**)

**ห้าม:** `kill` / `systemctl kill` / `systemctl restart` server · `npm run build` บน VPS (ใช้ `npx vite build` เฉพาะขั้นที่ 4) · รัน `npm run test` บน VPS (ตรวจบนเครื่องบ้าน) · สร้างบัญชีทดสอบบน server จริง · ใส่ IP ของ VPS ใน repo · ส่ง `tunnel-config.json` / `.cloudflared` / DB ทางแชท

## ขั้นตอน

1. **เช็คสถานะ**
   - เครื่องบ้าน (โฟลเดอร์หลักหรือ worktree บน `main` ล่าสุด): `git fetch` แล้วดู commit ของ `origin/main`
   - ติดต่อ VPS ได้: `ssh -o BatchMode=yes multiverse-vps true` (ถ้าไม่ได้ หยุดและบอกเจ้าของ ห้ามเดา)
   - **VPS:** `git status --short` ต้องว่าง · `git log -1 --oneline` (commit ที่รันอยู่) · `npm run autostart` (สถานะ unit) · `npm run logs -- --lines 20`
2. **ตรวจโค้ดบนเครื่องบ้าน** — `npm run typecheck` และ `npm run test` ของ `origin/main` ต้องผ่านทั้งคู่ ถ้าไม่ผ่านให้หยุดแล้วรายงานเจ้าของ ห้ามรีสตาร์ท
3. **ถ้า PR ที่ merge เปลี่ยนรูปแบบเซฟ/ตาราง DB** — สำรองก่อน: **VPS:** `sqlite3 server/data/multiverse.db "VACUUM INTO 'server/data/backups/multiverse-before-<เรื่อง>-<เวลา>.db'"` (หรือปุ่มสำรองใน `/admin`) · ถ้า `package.json` เปลี่ยน dependency ต้อง `npm ci` ซึ่งต้องปิด server เต็ม (โหมดปิด) → บอกเจ้าของก่อนว่าป้ายจะเป็นข้อความปิด ไม่ใช่อัปเดต แล้วทำ: `npm run stop-server` → `git pull --ff-only` → `npm ci` → `npx vite build` → `npm run autostart -- -Start`
4. **pull + build** — **VPS:** `git pull --ff-only && npx vite build` (ทำทันทีก่อนรีสตาร์ท เพราะ `--restart` ไม่ build ให้) · ถ้า pull ไม่ fast-forward หยุดถามเจ้าของ
5. **รีสตาร์ท**
   - unit เปิดอยู่ → **VPS:** `npm run stop-server -- --restart --seconds 120` (คำสั่งรอจน server เก่าปิด ใช้ timeout ของ Bash ≥ 200 วิ) แล้ว **VPS:** `npm run logs -- --lines 40` จนขึ้น "รีสตาร์ท server" ตามด้วย "พร้อมแล้ว" ครั้งใหม่
   - unit ไม่ได้เปิด (`npm run autostart` = ไม่ได้เปิด) → **VPS:** `npm run autostart -- -Start` แล้วดู log จนขึ้น "พร้อมแล้ว" และกล่องลิงก์
   - unit เปิดอยู่แต่ log บอกว่า port 2567 มีโปรแกรมอื่นใช้ = server ที่ไม่มีตัวคุม → **VPS:** `npm run stop-server` ก่อน แล้ว `-Start`
   - ถ้าใน log ไม่ขึ้นกล่องลิงก์ ให้ดู `cloudflared` ใน log (ตัวคุมเปิด cloudflared ใหม่เองเมื่อหลุด) · ตัวคุมเปิดไม่ขึ้นเลย: **VPS:** `journalctl -u multiverse -n 50 --no-pager`
6. **ยืนยัน** — จากเครื่องบ้าน `curl -s -o /dev/null -w "%{http_code}"` ที่ `https://play.multiverse-game.com/` และ `/admin` ต้องได้ 200
7. **สำรองนอกเครื่อง** — เครื่องบ้าน `npm run pull-backup` (ดึงไฟล์สำรองล่าสุดจาก VPS มาเก็บ) ถ้าล้มไม่ต้องหยุดงาน แต่บอกในรายงาน
8. **รายงาน** — สั้น ๆ: commit ที่รันอยู่บน VPS (`git log -1 --oneline`), ลิงก์ (เปลี่ยนหรือไม่), ผล typecheck/test, สำรอง DB หรือไม่, pull-backup ได้ไฟล์ไหน
