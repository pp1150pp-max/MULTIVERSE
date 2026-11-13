# การปิด / รีสตาร์ท server จริง

สรุปสั้นอยู่ใน [CLAUDE.md](../../CLAUDE.md) · ขั้นตอนอัปเดต server แบบเต็มอยู่ใน skill `/update-server` (`.claude/skills/update-server/SKILL.md`)

- **ปิด/รีสตาร์ท server จริงต้องผ่าน countdown เสมอ** (ผู้เล่นเห็นป้ายเตือน 10 วินาที หรือนานกว่าที่เลือก, เข้าเกมใหม่ไม่ได้ระหว่างนั้น, เซฟทุกคนพร้อมคลังก่อนปิด)
  - **ความยาวนับถอยหลัง** (เจ้าของตกลง 2026-11-12): ค่าเริ่มต้น 10 วิ เลือกได้ 10 วิ–10 นาที (จำนวนเต็มวินาที) · `/admin` แท็บ Server มีช่องเลือก 10 วิ / 1 / 2 / 5 นาที · `npm run stop-server -- --restart --seconds 120` (ถ้าครอบด้วย `timeout` ต้องนานกว่าเวลานับ) · Ctrl+C ใช้ 10 วิเสมอ · ลง audit พร้อมเวลานับ · ข้อความเริ่มต้นของรีสตาร์ท: "มีการอัปเดต server จะ Restart ในอีก {เวลา}"
  - อัปเดตเกม: `npx vite build` → `npm run stop-server -- --restart` (ตัวคุมเปิดใหม่เอง ดู "always-on" ด้านล่าง) · ถ้าต้องปิดเต็ม (เช่น `npm ci`): `npm run stop-server` → รอจนขึ้น "server ปิดแล้ว" → `npm run autostart -- -Start` (หรือ `npm run online` ในหน้าต่าง ถ้ายังไม่ได้ลง task)
  - **อย่า kill task/หน้าต่างของ `npm run online` ตรง ๆ** บน Windows node จะตายทันทีโดยไม่เตือนและไม่เซฟ (เสียของที่ยังไม่เซฟ ~30 วิ)
  - Ctrl+C ในหน้าต่าง server: กดครั้งเดียวแค่ขึ้นคำเตือนใน console · กดอีกครั้งภายใน 3 วินาที = เริ่มนับถอยหลังปิด server
  - ระหว่างนับถอยหลัง: พิมพ์ `c` + Enter = ยกเลิก (ผู้เล่นเห็น "ยกเลิกการรีสตาร์ท/ยกเลิกการปิด server" และเข้าเกมได้ตามเดิม) · `f` + Enter = ปิดทันที (ยังเซฟทุกคน) · Ctrl+C ระหว่างนับไม่มีผล
  - owner กดได้จากหน้า `/admin` แท็บ Server (รีสตาร์ท / ปิด server / ยกเลิกการนับถอยหลัง) ทุกครั้งลงประวัติ
  - ข้อความบนป้ายนับถอยหลัง (แยกรีสตาร์ท/ปิด) owner แก้ได้ที่แท็บ Server การ์ด "ข้อความเตือนก่อนรีสตาร์ท / ปิด server" ใช้กับทุกวิธี (ปุ่ม admin, `npm run stop-server`, Ctrl+C) · ต้องมี `{เวลา}` (เกมแทนเป็น "10 วินาที" / "1 นาที 30 วินาที") ยาวไม่เกิน 100 ตัว · เกมใส่ ⚠ ข้างหน้าเอง · เก็บในตาราง `settings` (ไม่มีแถว = ค่าเริ่มต้นใน `DEFAULT_SHUTDOWN_TEXT`, `src/shared/net/protocol.ts`) · สิทธิ์ `shutdownText` ใน `FEATURE_ROLES` · ข้อความตอนถูกตัดการเชื่อมต่อ/ยกเลิกยังคงที่ (`shutdownKick`, `shutdownCancelled`)
  - `npm run online` (`server/online-main.ts`) เปิด server ใหม่เองเมื่อ server ออกด้วย exit code 75 (รีสตาร์ท) และถือลิงก์ Cloudflare ไว้เอง รีสตาร์ทแล้วลิงก์ไม่เปลี่ยน
  - `npm run stop-server` คุยกับ server ผ่าน token ในไฟล์ `server/data/control-<port>.json` (สร้างตอน server เปิด) รับเฉพาะจากเครื่องนี้
- `npm run online` ใช้ port 2567 ถ้าขึ้น `EADDRINUSE` แปลว่ามี server ตัวเก่ารันค้างอยู่

## เปิดเองตอนบูต + ล่มแล้วเปิดใหม่ (always-on, เจ้าของเลือก 2026-11-13)

เหตุ: 13 พ.ย. 2026 เครื่องรีสตาร์ทเอง และแท็บ Terminal ของแอป Claude หายพา server ดับ (ผู้เล่นเห็น 502 ไม่มีนับถอยหลัง/เซฟ)

- **Task Scheduler ตอนเครื่องบูต** ชื่อ task `MULTIVERSE server` (เจ้าของเลือกแบบบูต ไม่ใช่แบบล็อกอิน) รันในนามผู้ใช้ Windows ของเจ้าของแบบ S4U = ไม่ต้องมีใครล็อกอิน ไม่เก็บรหัสผ่าน ไม่มีหน้าต่าง · หน่วง 30 วิหลังบูต · ไม่มีเวลาจำกัด (ค่าเริ่มต้นของ Windows ตัดที่ 3 วันโดยไม่เซฟ) · priority ปกติ · เปิดได้ทีละตัว
  - task รัน `npm run always-on` = `server/online-main.ts --always-on` ในโฟลเดอร์หลัก (ไม่ build ใช้ `dist/` ที่ build ไว้)
  - ลงทะเบียน/ลบ ต้องสิทธิ์ admin 1 ครั้ง (สคริปต์ขอเอง): `npm run autostart -- -Install` / `-Uninstall` · ดูสถานะ `npm run autostart` · เปิดตอนนี้ `npm run autostart -- -Start` (ถ้า Windows ไม่ให้ผู้ใช้ธรรมดาสั่ง task ที่ลงด้วย admin จะเด้งขอสิทธิ์ admin บนจอเจ้าของ) · **`-Install` รันจากโฟลเดอร์หลัก `C:\Users\Pencilvester\Desktop\game_1` เท่านั้น** (สคริปต์ปฏิเสธ worktree เพราะ worktree ถูกลบทีหลัง)
  - โฟลเดอร์และ path ของ `node.exe` ถูกจำตอน `-Install` (ย้ายโฟลเดอร์/ลง Node ใหม่ ให้ `-Install` ซ้ำ)
  - **ห้ามกด "End" ที่ task ใน Task Scheduler** ตัวคุมจะตายทันที (server แยก process จึงยังรันต่อ แต่ไม่มีใครคุมแล้ว) ปิดด้วย `npm run stop-server` เสมอ
- **ตัวคุม (`server/online-main.ts`) ทั้ง `npm run online` และ always-on** ตัดสินจาก exit code ของ server:
  - `0` (stop-server โหมดปิด, ปุ่มปิดใน /admin, Ctrl+C 2 ครั้ง) = ปิดจริง ปิด tunnel ด้วย แล้วตัวคุมจบ (task จบ) · เปิดใหม่: `npm run autostart -- -Start` หรือรีบูต
  - `75` (รีสตาร์ท) = เปิดใหม่ทันทีด้วยโค้ดที่ build ไว้
  - อื่น ๆ (ล่ม) = เปิดใหม่หลังรอ 5 → 10 → 30 วิ → 1 → 2 → 5 นาที (นับต่อเมื่อล่มติดกัน รันได้ 10 นาทีแล้วนับใหม่)
  - cloudflared ตายก็เปิดใหม่ด้วยช่วงรอแบบเดียวกัน · ถ้ามีหน้าต่าง `npm run tunnel` เปิดอยู่จะใช้ลิงก์ของมันและเฝ้าดู ถ้าปิดไปจะเปิดลิงก์เอง
  - เปิดได้ทีละตัว: จับ port ล็อก `127.0.0.1:<PORT+10000>` (12567) ตัวที่สองบอกว่าเปิดอยู่แล้วแล้วจบ
  - ถ้า port 2567 มีโปรแกรมอื่นใช้อยู่ (เช่น server ที่ค้างหลังกด End) ตัวคุมไม่เปิดซ้ำและไม่รอยึด เพราะจะทำให้ stop-server ไม่ปิดจริง → `npm run stop-server` ตัวนั้นก่อนแล้ว `-Start`
  - `tunnel.json` ค้างหลังรีบูต: ตรวจว่า pid นั้นเป็น `cloudflared` จริง (Windows เอา pid ไปใช้ซ้ำได้)
  - always-on แยก server เป็น process อิสระ (`detached`) เพราะบน Windows ลูกที่ไม่แยกจะตายทันทีตามตัวคุมโดยไม่เซฟ · `npm run online` ในหน้าต่างไม่แยก (Ctrl+C / พิมพ์ c f ต้องถึง server)
- **log:** `server/data/logs/online-YYYY-MM-DD.log` วันละไฟล์ ทุกบรรทัดมีเวลา เก็บ 30 วัน (`LOG_KEEP_DAYS` ใน `server/logfile.ts`) · ดู: `npm run logs` (60 บรรทัดท้าย) · `npm run logs -- --follow` (ดูต่อเรื่อย ๆ) · `--lines N`
- **กันเครื่องรีสตาร์ทเองตอนกลางวัน (เจ้าของตั้งเอง ไม่ใช่โค้ด):** Settings → Update & Security → Windows Update → *Change active hours* (ได้สูงสุด 18 ชม. เช่น 08:00–02:00) · *Pause updates* ช่วงที่มีคนเล่นเยอะ · Windows 10 Pro: `gpedit.msc` → Computer Configuration → Administrative Templates → Windows Components → Windows Update → *No auto-restart with logged on users for scheduled automatic updates installations* = Enabled (ใช้ได้เมื่อมีคนล็อกอินค้างไว้) · ถ้ายังรีสตาร์ทเอง task จะเปิด server ให้ใหม่ แต่ผู้เล่นหลุดโดยไม่มีนับถอยหลัง (เซฟอัตโนมัติล่าสุดยังอยู่)

## สำรอง / กู้คืน DB

- สำรอง DB: `server/data/backups/` (`VACUUM INTO`) อัตโนมัติทุก 6 ชม. เก็บ 28 ไฟล์ = 7 วัน (เจ้าของเลือก 2026-11-13, ชนิดไฟล์ยังชื่อ `daily` ให้ไฟล์เก่าหมุนรวมกัน), กดเองเก็บ 10, ก่อนลบเก็บ 20 (`BACKUP_KEEP`/`AUTO_MS` ใน `server/backup.ts`) · server นับจากไฟล์ล่าสุด รีสตาร์ทบ่อยก็ไม่สำรองถี่ขึ้น
- กู้คืน: `npm run stop-server` → ลบ `multiverse.db-wal` / `multiverse.db-shm` → คัดลอกไฟล์สำรองทับ `server/data/multiverse.db` → `npm run autostart -- -Start` (หรือ `npm run online`)

## ลิงก์ถาวรให้เพื่อน (named tunnel + โดเมนของเจ้าของ)

ค่าเริ่มต้น `npm run tunnel` / `npm run online` ใช้ quick tunnel (`*.trycloudflare.com` เปลี่ยนทุกครั้งที่ tunnel เริ่มใหม่) ถ้ามีไฟล์ตั้งค่าด้านล่าง (หรือ env `TUNNEL_NAME` + `TUNNEL_HOSTNAME`) จะใช้ named tunnel แทนโดยอัตโนมัติ และแสดง `https://<hostname>` เป็นลิงก์ให้เพื่อน ถ้าไม่มี = quick tunnel เดิม (โค้ดอยู่ใน `server/tunnel.ts`)

### ตั้งครั้งแรก (เจ้าของทำเอง · ใช้ cloudflared ตัวเดียวกับที่เกมหาเจอ)

1. โดเมนต้องอยู่บน Cloudflare (ซื้อที่ Cloudflare Registrar หรือที่อื่นแล้วเปลี่ยน nameserver มาที่ Cloudflare แพ็กเกจฟรี)
2. ล็อกอิน (เปิดเบราว์เซอร์ เลือกโดเมน): `cloudflared tunnel login` → ได้ `%USERPROFILE%\.cloudflared\cert.pem`
3. สร้าง tunnel: `cloudflared tunnel create multiverse` → ได้ไฟล์ credentials `.json` ใน `%USERPROFILE%\.cloudflared\` (**ห้าม commit / ห้ามส่งใคร**)
4. ผูกชื่อลิงก์: `cloudflared tunnel route dns multiverse play.<โดเมน>` (หรือโดเมนหลักตรง ๆ)
   แล้วเช็คที่ Cloudflare → DNS → Records ว่าแถว CNAME ของชื่อนั้นเป็น **Proxied** (เมฆสีส้ม) ถ้าเป็น DNS only จะเข้าไม่ได้ (timeout) · Error 1033 = DNS ถูกแล้วแต่ cloudflared ยังไม่ได้รัน
5. สร้าง `server/data/tunnel-config.json` (git-ignored ผ่าน `server/data/`):
   ```json
   { "name": "multiverse", "hostname": "play.<โดเมน>" }
   ```
   server ส่งต่อ `http://localhost:2567` ให้เอง (`--url`) รวม WebSocket `/ws` ไม่ต้องเขียน config.yml

### ใช้งานประจำ

เหมือนเดิม: `npm run tunnel` ค้างไว้ + `npm run online` (หรือ online อย่างเดียว) ลิงก์ที่ขึ้นเป็นลิงก์ถาวรเสมอ

### สลับจาก quick tunnel บน server จริง

ทำหลังตั้งค่าครบและ merge แล้ว: ปิด tunnel เดิม (หน้าต่าง `npm run tunnel` กด Ctrl+C) → เปิด `npm run tunnel` ใหม่ (ไม่ต้องแตะ server) → เพื่อนใช้ลิงก์ถาวรใหม่ แล้วเลิกใช้ลิงก์ trycloudflare

## เน็ตช้า: บีบอัดข้อมูล WebSocket (เจ้าของเลือก 2026-11-12)

- server เปิด permessage-deflate (`WS_DEFLATE` ใน `server/world.ts`) เบราว์เซอร์ตกลงกันเองตอนเชื่อมต่อ ไม่ต้องแก้ client · ข้อความ < 256 byte (pong) ไม่บีบ
- วัดแบบ headless ในแมพฟาร์ม: 8 คน ~510 → ~20 kbps ต่อคน, 20 คน ~920 → ~32 kbps · ในเมือง 1 คน (server ทดสอบจริง) 17 KB/s → ~0.4 KB/s
- ถ้าเชื่อมต่อไม่ได้บีบอัด (เบราว์เซอร์/proxy/tunnel ไม่ส่งต่อ) ยังเล่นได้แบบเดิม และ log จะบอก: ตอนเข้าเกม `(no compression)` และในบรรทัด `[ping] average…` มีคำว่า `no compression`
- เกณฑ์ข้าม snapshot เมื่อคิวค้าง: 16 KB สำหรับคนที่บีบอัด (ws นับข้อความที่รอบีบด้วยขนาดเต็ม) (64 KB สำหรับคนที่ไม่บีบ) ส่วนกติกา "ไม่ได้ตอบ pong ทัน → 1 snapshot/วิ" เหมือนเดิม
- ทางที่ยังไม่ได้ทำ (เจ้าของยังไม่เลือก): ส่งค่าคงที่เฉพาะตอนเปลี่ยน (~8% เพิ่ม), ลดความถี่เร็วขึ้นตาม ping ที่ client รายงาน

## วัดภาระ server: log `[perf]` และสคริปต์บอท (2026-11-13)

- server พิมพ์ `[perf]` 1 บรรทัด/นาทีเมื่อมีคนออนไลน์ (`server/perf.ts`): เวลาต่อรอบเกม (แยก sim/event/snapshot/เซฟ), รอบ/วิ, เวลาเซฟทุกคน, ความหน่วง event loop, % ยุ่ง, CPU, RAM, เน็ตขาออกจริงหลังบีบอัด · `PERF_LOG_MS` เปลี่ยนความถี่ · `PERF_JSON=1` เพิ่มบรรทัด `[perf-json]`
- สคริปต์บอท `tools/load-test.ts` เปิด server ทดสอบเอง (port สุ่ม + DB ชั่วคราว) ไม่อยู่ใน `npm run test` · ผลวัดครั้งแรกและคำแนะนำเช่า server: [../load-test-2026-11-13.md](../load-test-2026-11-13.md)
