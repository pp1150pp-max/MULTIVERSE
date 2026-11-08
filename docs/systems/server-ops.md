# การปิด / รีสตาร์ท server จริง

สรุปสั้นอยู่ใน [CLAUDE.md](../../CLAUDE.md) · ขั้นตอนอัปเดต server แบบเต็มอยู่ใน skill `/update-server` (`.claude/skills/update-server/SKILL.md`)

- **ปิด/รีสตาร์ท server จริงต้องผ่าน countdown เสมอ** (ผู้เล่นเห็นป้ายเตือน 10 วินาที, เข้าเกมใหม่ไม่ได้ระหว่างนั้น, เซฟทุกคนพร้อมคลังก่อนปิด)
  - อัปเดตเกม: `npm run stop-server` → รอจนขึ้น "server ปิดแล้ว" → `npm run online` (build ใหม่แล้วเปิด)
  - **อย่า kill task/หน้าต่างของ `npm run online` ตรง ๆ** บน Windows node จะตายทันทีโดยไม่เตือนและไม่เซฟ (เสียของที่ยังไม่เซฟ ~30 วิ)
  - Ctrl+C ในหน้าต่าง server: กดครั้งเดียวแค่ขึ้นคำเตือนใน console · กดอีกครั้งภายใน 3 วินาที = เริ่มนับถอยหลังปิด server
  - ระหว่างนับถอยหลัง: พิมพ์ `c` + Enter = ยกเลิก (ผู้เล่นเห็น "ยกเลิกการรีสตาร์ท/ยกเลิกการปิด server" และเข้าเกมได้ตามเดิม) · `f` + Enter = ปิดทันที (ยังเซฟทุกคน) · Ctrl+C ระหว่างนับไม่มีผล
  - owner กดได้จากหน้า `/admin` แท็บ Server (รีสตาร์ท / ปิด server / ยกเลิกการนับถอยหลัง) ทุกครั้งลงประวัติ
  - ข้อความบนป้ายนับถอยหลัง (แยกรีสตาร์ท/ปิด) owner แก้ได้ที่แท็บ Server การ์ด "ข้อความเตือนก่อนรีสตาร์ท / ปิด server" ใช้กับทุกวิธี (ปุ่ม admin, `npm run stop-server`, Ctrl+C) · ต้องมี `{เวลา}` (เกมแทนเป็น "10 วินาที" / "1 นาที 30 วินาที") ยาวไม่เกิน 100 ตัว · เกมใส่ ⚠ ข้างหน้าเอง · เก็บในตาราง `settings` (ไม่มีแถว = ค่าเริ่มต้นใน `DEFAULT_SHUTDOWN_TEXT`, `src/shared/net/protocol.ts`) · สิทธิ์ `shutdownText` ใน `FEATURE_ROLES` · ข้อความตอนถูกตัดการเชื่อมต่อ/ยกเลิกยังคงที่ (`shutdownKick`, `shutdownCancelled`)
  - `npm run online` (`server/online-main.ts`) เปิด server ใหม่เองเมื่อ server ออกด้วย exit code 75 (รีสตาร์ท) และถือลิงก์ Cloudflare ไว้เอง รีสตาร์ทแล้วลิงก์ไม่เปลี่ยน
  - `npm run stop-server` คุยกับ server ผ่าน token ในไฟล์ `server/data/control-<port>.json` (สร้างตอน server เปิด) รับเฉพาะจากเครื่องนี้
- `npm run online` ใช้ port 2567 ถ้าขึ้น `EADDRINUSE` แปลว่ามี server ตัวเก่ารันค้างอยู่

## สำรอง / กู้คืน DB

- สำรอง DB: `server/data/backups/` (`VACUUM INTO`) อัตโนมัติวันละครั้งเก็บ 7 ไฟล์, กดเองเก็บ 10, ก่อนลบเก็บ 20 (`BACKUP_KEEP` ใน `server/backup.ts`)
- กู้คืน: `npm run stop-server` → ลบ `multiverse.db-wal` / `multiverse.db-shm` → คัดลอกไฟล์สำรองทับ `server/data/multiverse.db` → `npm run online`
