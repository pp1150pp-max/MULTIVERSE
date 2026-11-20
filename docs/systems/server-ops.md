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
  - `npm run stop-server` คุยกับ server ผ่าน token ในไฟล์ `server/data/control-<port>.json` (สร้างตอน server เปิด) รับเฉพาะจากเครื่องนี้ · เช็คว่า server ยังเปิดอยู่จาก pid ในไฟล์: Windows ตอบ EPERM สำหรับ server ที่รันจาก Task Scheduler (คนละ session) = ยังเปิดอยู่ · ESRCH เท่านั้นที่ถือว่าดับแล้วและลบไฟล์ (2026-11-13: เคยถือ EPERM เป็นดับ ลบไฟล์ของ server ที่ยังรันอยู่ทิ้ง ทำให้สั่งปิดไม่ได้จนกว่าจะรีสตาร์ทด้วยปุ่มใน /admin)
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

## VPS (Linux) — ที่อยู่ของ server จริง (Hostatom Cloud VPS SSD2 ในไทย 2 vCPU / 4 GB, Ubuntu 24.04, เช่า 2026-11-15)

แผนวันย้าย เช็คลิสต์ และวิธีย้ายกลับ: [../vps-move.md](../vps-move.md) · หัวข้อ Windows / Task Scheduler ด้านบนใช้กับเครื่องบ้านตอนย้ายกลับ

- สั่งงานจากเครื่องบ้าน: `ssh -o BatchMode=yes multiverse-vps "cd MULTIVERSE && <คำสั่ง>"` (ชื่อ SSH ใน `~/.ssh/config` ของเครื่องบ้าน) · อัปเดตเกม: VPS `git pull --ff-only && npx vite build` → `npm run stop-server -- --restart` (skill `/update-server`) · ตรวจ typecheck/test บนเครื่องบ้าน ไม่รันบน VPS
- **ห้าม** `kill` / `systemctl kill` / `systemctl restart` (restart = ปิดแบบโหมดปิดแล้วเปิดใหม่ ผู้เล่นเห็นป้ายปิด ไม่ใช่ป้ายอัปเดต) · ปิดเต็ม: `npm run stop-server` · เปิด: `npm run autostart -- -Start`

- ติดตั้งเครื่องใหม่: `tools/vps-setup.sh` (root, รันซ้ำได้): Node รุ่นเดียวกับเครื่องบ้าน (`NODE_VERSION`, ตอนนี้ 24.22.1 ตรวจ SHA256), git, cloudflared (apt ของ Cloudflare), swap 2 GB, timezone Asia/Bangkok, ufw เปิดแค่ SSH, SSH ใช้ key เท่านั้น, user `multiverse` (เป็นเจ้าของโค้ดใน `/home/multiverse/MULTIVERSE` รัน server และเป็น user ที่ SSH เข้ามาสั่งงาน) · sudo ได้แค่ `systemctl start/stop/status multiverse`
- **systemd unit `multiverse`** (`tools/multiverse.service`) แทน Task Scheduler: รัน `server/online-main.ts --always-on` ตัวเดียวกับ Windows (exit 75 = ตัวคุมเปิดใหม่เอง, exit 0 = ปิดจริง unit ไม่เปิดใหม่, ล่ม = ตัวคุมเปิดใหม่, ตัวคุมตายเอง = systemd เปิดใหม่ใน 10 วิ) · เปิดเองตอนบูต · `systemctl stop` / รีบูตเครื่อง รัน `stop-server` ก่อน (ExecStop) = นับถอยหลัง + เซฟทุกคนขณะลิงก์ยังอยู่ · ไม่สำเร็จค่อย SIGTERM (server ก็นับถอยหลัง) แล้ว SIGKILL หลัง 120 วิ
- server ฟังที่ `127.0.0.1` บน VPS (env `MULTIVERSE_HOST` ใน unit; ไม่ตั้ง = `0.0.0.0` แบบเครื่องบ้าน) · cloudflared ต่อ `http://127.0.0.1:2567` · cloudflared แยก process group ทุก OS (Ctrl+C / systemd ไม่ตัดลิงก์ระหว่างนับถอยหลัง) · `tunnel.json` ค้างหลังรีบูต: Linux ตรวจ `/proc/<pid>/comm` ว่าเป็น cloudflared จริง
- คำสั่งเดิมใช้ได้ทั้งสองเครื่อง: `npm run autostart` (Windows → `tools/autostart.ps1` เหมือนเดิม · Linux → systemctl: สถานะ / `-Start` / `-Install` และ `-Uninstall` ต้อง root: `sudo node tools/autostart.mjs -Install`) · `npm run stop-server` · `npm run logs` (ไฟล์ log เดิมใน `server/data/logs/`, ถ้าตัวคุมเปิดไม่ขึ้นเลยดู `journalctl -u multiverse`)
- `stop-server` อ่านไฟล์ control ไม่ได้เพราะสิทธิ์ (รันผิด user) = error exit 1 (ไม่ใช่ "ไม่มีอะไรต้องปิด" แบบเดิม)
- **สำรองนอกเครื่อง:** `npm run pull-backup` บนเครื่องบ้าน ดึงไฟล์สำรองล่าสุดที่เก่ากว่า 1 นาที (ทุกชื่อ `multiverse-*.db` รวม `multiverse-before-…` ที่ deploy ทำ)จาก `server/data/backups/` บน VPS ผ่าน scp → `<home>/MULTIVERSE-backups` (นอก repo, เปลี่ยนด้วย `BACKUP_PULL_DIR`) ตรวจ SHA-256 + `quick_check` เก็บ 30 ไฟล์ (`--keep N`) · ไม่ดึง `multiverse.db` ที่กำลังใช้ · ใช้ชื่อ SSH `multiverse-vps` จาก `~/.ssh/config` (`VPS_SSH`) ไม่เขียน IP ใน repo สาธารณะ
- ซ้อมบน VPS จริงผ่านแล้ว 2026-11-15 (vps-move.md หัวข้อ B: ลิงก์ 200, port 2567 ปิดจากข้างนอก, restart/`systemctl stop`/รีบูต มีนับถอยหลัง+เซฟ และเปิดเองหลังบูต) แล้วล้างข้อมูลซ้อม

## ปุ่ม Deploy: ให้เพื่อนเอาโค้ดขึ้น server จริงได้ยามฉุกเฉิน (เจ้าของเลือก 2026-11-15)

ใช้ได้เมื่อ server จริงอยู่บน VPS แล้ว · เจ้าของยังเป็นหลัก (`/ship`, `/update-server`) ปุ่มนี้ไว้ตอนเจ้าของไม่ได้เปิดคอมหรือไม่ว่าง

- **กด:** GitHub → Actions → **Deploy** → Run workflow (branch `main`) → action `deploy` (หรือ `status` / `logs` ดูอย่างเดียว) · กดได้ทุกคนที่มีสิทธิ์ write ใน repo (ตอนนี้ เจ้าของ + ioilLnwza)
- **ทำอะไร** (`.github/workflows/deploy.yml`): typecheck + test ของ main ก่อน ไม่ผ่าน = ไม่ขึ้น → SSH ไป VPS รัน `tools/deploy.sh deploy <commit ที่ตรวจแล้ว>`: สำรอง DB (`backups/multiverse-before-deploy-…db` เก็บ 10) → pull → build ลง `dist-next` แล้วสลับ (build พัง = ถอยโค้ดกลับ เว็บไม่พัง) → รีสตาร์ทนับถอยหลัง 120 วิ ป้าย "อัปเดต" (dependency เปลี่ยน = ป้ายปิด 120 วิ + `npm ci` · นับเฉพาะ `package-lock.json` หรือช่อง dependencies/devDependencies/overrides/engines ใน `package.json` ไม่นับสคริปต์ เช่นเพิ่มเทสต์ 2026-11-17) → รอ server ตอบ → เช็คลิงก์ `/` และ `/admin` = 200
- **ปลอดภัย:** key ของ GitHub ล็อกใน `authorized_keys` ของ user `multiverse` ให้รันได้แค่ `tools/deploy.sh` (`command="…",restrict`) เข้า shell / อ่าน DB / ไฟล์ tunnel ไม่ได้ · main ต้องตรงกับ commit ที่ตรวจแล้ว (มีคน merge เพิ่มระหว่างตรวจ = หยุด) · ทีละคน (`flock` คนที่สองถูกปฏิเสธ) · โค้ดบน VPS ถูกแก้ด้วยมือ = หยุด · หมายเหตุ: ใครที่ merge เข้า main ได้ก็แก้ `deploy.sh` ได้ จึงให้สิทธิ์ write เฉพาะคนที่ไว้ใจเอาโค้ดขึ้น server
- เจ้าของสั่งเองผ่าน SSH ก็ใช้สคริปต์เดียวกัน: `ssh multiverse-vps "cd MULTIVERSE && tools/deploy.sh deploy <commit>"` (skill `/update-server`)
- **ตั้งครั้งเดียว (เจ้าของ):** key อยู่ที่เครื่องบ้าน `~/.ssh/multiverse_github_deploy` (public half ลงใน VPS แล้ว) · ใส่ secret 3 ตัวด้วย `gh` ใน PowerShell:
  `gh secret set VPS_HOST --body "<IP ของ VPS>"` ·
  `ssh-keyscan -t ed25519 <IP ของ VPS> | gh secret set VPS_KNOWN_HOSTS` ·
  `Get-Content -Raw $env:USERPROFILE\.ssh\multiverse_github_deploy | gh secret set VPS_DEPLOY_KEY`
  แล้วกด Deploy → `status` ดูว่าใช้ได้ · ยกเลิกสิทธิ์: ลบบรรทัด `github-deploy` ใน `~/.ssh/authorized_keys` บน VPS (หรือลบ secret)

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
- ผู้เล่นที่เข้าผ่าน Cloudflare tunnel: log ตอนเข้าเกมบอก `via Cloudflare <เมือง>` และบรรทัด `[ping] average…` มี `via <เมือง>` (รหัส 3 ตัวท้าย CF-Ray เช่น BKK = กรุงเทพ, SIN = สิงคโปร์) แท็บผู้เล่นออนไลน์ใน /admin โชว์ต่อท้าย IP · ใช้ดูว่าใครปิงสูงเพราะเส้นทางอ้อมต่างประเทศ (ไม่มีค่าให้ปรับ แค่แสดง)
- เกณฑ์ข้าม snapshot เมื่อคิวค้าง: 16 KB สำหรับคนที่บีบอัด (ws นับข้อความที่รอบีบด้วยขนาดเต็ม) (64 KB สำหรับคนที่ไม่บีบ) ส่วนกติกา "ไม่ได้ตอบ pong ทัน → 1 snapshot/วิ" เหมือนเดิม
- ทางที่ยังไม่ได้ทำ (เจ้าของยังไม่เลือก): ลดความถี่เร็วขึ้นตาม ping ที่ client รายงาน · ส่งค่าคงที่เฉพาะตอนเปลี่ยน: ทำแล้ว (หัวข้อถัดไป)

## เน็ตช้า: ส่งค่าที่แทบไม่เปลี่ยนเฉพาะตอนเปลี่ยน — snapshot delta (เจ้าของเลือก 2026-11-14)

- ค่าที่ส่งเฉพาะตอนเปลี่ยน (เทียบ JSON ต่อผู้เล่นแต่ละคน แบบเดียวกับกระเป๋า/คลัง):
  - ของตัวเอง (`PrivateSnap`): `potSel` `lootFilter` `autoSettings` `stats` `skills` `bossKills` `quests` `gearQuests` `gearDone`
  - ผู้เล่นคนอื่น (และตัวเองในรายการ `players`): ก้อนหน้าตา = ชื่อ คลาส เลเวล HP สูงสุด ออร่า ลูกแก้ว ของแต่งตัว สัตว์ขี่ คางคก ส่งทั้งก้อนเมื่อเพิ่งเข้าระยะมองเห็นหรือค่าใดในก้อนเปลี่ยน (`name` ไม่มา = ใช้ของเดิม)
  - มอนสเตอร์: ก้อน = ชนิด เลเวล HP สูงสุด (`def` ไม่มา = ใช้ของเดิม)
  - ตำแหน่ง HP/MP คูลดาวน์ บัฟ ฯลฯ ยังส่งทุก snapshot เหมือนเดิม
- กันค่าตกหล่น:
  - เข้าเกม เชื่อมต่อใหม่ เปลี่ยนแมพ/CH (`travel` ล้างที่จำไว้) และเปิดสวิตช์กลับ ได้ค่าครบเสมอ
  - server จำว่าส่งอะไรไปแล้วเฉพาะ snapshot ที่ส่งออกจริง snapshot ที่ถูกข้ามตอนเน็ตช้าไม่นับ ค่าที่เปลี่ยนช่วงนั้นจึงไปกับ snapshot ถัดไปที่ส่งจริง
  - ตัวที่ออกนอกระยะจะถูกลืม กลับเข้ามาได้ก้อนใหม่
- แท็บเก่าที่เปิดค้างไว้ก่อนอัปเดตยังได้ snapshot เต็ม: client ใหม่ส่ง `delta: 1` ตอน `join` ถ้าไม่ส่งมา server ส่งเต็มทุกครั้ง
- client: `lootFilter`/`autoSettings` ที่ server ส่งมาระหว่าง 800 ms หลังผู้เล่นแก้เอง จะถูกเก็บไว้ แล้วใส่ให้เมื่อพ้นช่วงรอ เพราะอาจเป็นสำเนาเดียวที่ได้
- ผลวัด (server ทดสอบ ในเมือง บอท 4 ตัวเดิน มอน ~5 ตัว): JSON ต่อ snapshot ~2,300 → ~1,240 byte (−46%) · เน็ตจริงหลังบีบอัด ~116 → ~98 byte (−16%) · ในแมพฟาร์มที่คน/มอนเยอะ สัดส่วนน่าจะต่ำกว่านี้ · **ไม่ได้ลด ping** (ping มาจากเน็ตของผู้เล่นเอง ขาออกมีแค่ไม่กี่ kbit/s อยู่แล้ว) แต่ลดงานบีบอัดของ server
- /admin แท็บ Server การ์ด "ลดขนาด snapshot" (สิทธิ์ `netDelta` owner+GM): สวิตช์เปิด/ปิดทั้งเซิร์ฟ มีผลทันที (เก็บใน settings `snap_delta` = `'0'` เมื่อปิด ค่าเริ่มต้นเปิด) ลง `admin_audit` · ตัวนับนับตั้งแต่ server เปิดหรือกดสวิตช์ครั้งล่าสุด: จำนวน snapshot, JSON ที่ส่ง/ที่ประหยัดได้ (ก่อนบีบอัด), จำนวนครั้งที่ส่งค่าของตัวเอง/ก้อนหน้าตาใหม่, ผู้เล่นออนไลน์ที่รองรับ/แท็บเก่า · ปิดไว้ = ส่งเต็มแบบเดิม ใช้ถ้าสงสัยว่าภาพในเกมเพี้ยน
- เทสต์: `tests/snapshot-delta.test.ts`

## เน็ตช้า: ต่อตรงไปที่ VPS ไม่ผ่าน Cloudflare — "ต่อตรง (ลดปิง)" (เจ้าของเลือก 2026-11-20)

- ปัญหา: ผ่าน Cloudflare tunnel ผู้เล่นไทยได้ 68–110 ms (BKK) บางครั้งโดนส่งไป SIN 150–330 ms ทั้งที่ VPS อยู่ไทย
- ทางแก้: เฉพาะการเชื่อมต่อตอนเล่น (WebSocket `/ws`) ต่อตรงไปที่ VPS ผ่านชื่อแยก `ws.multiverse-game.com` (A record แบบ **DNS only / เมฆสีเทา**) ส่วนหน้าเว็บ, `/api`, login, /admin ยังผ่าน Cloudflare เหมือนเดิม
- **เจ้าของยอมรับ (2026-11-20): IP ของ VPS เปิดเผยถาวร** (อยู่ในประวัติ DNS ลบ record ทีหลังก็ซ่อนคืนไม่ได้) · สวิตช์ใน /admin พาผู้เล่นกลับไปทาง Cloudflare ได้ทันที แต่ไม่ได้กัน DDoS ที่ยิง IP ตรง ๆ
- ค่าเริ่มต้นในโค้ด **ปิด** · การยืนยันตัวไม่ใช้ cookie (token ส่งในข้อความ `join`) จึงต่อข้ามชื่อได้
- **VPS:** Caddy รับ TLS (Let's Encrypt ต่ออายุเอง) ที่ 443 ส่งต่อเฉพาะ `/ws` ไปที่ `127.0.0.1:2569` (port ต่อตรงของ server: env `DIRECT_WS_PORT` ค่าเริ่มต้น 2569 เฉพาะเมื่อ server ใช้ port 2567, 0 = ไม่เปิด) path อื่นตอบ 404 · ตั้งด้วย `tools/vps-direct-setup.sh` (root, รันซ้ำได้, ไม่แตะเกม) ใช้ `tools/Caddyfile.direct` · ufw เปิด 80 (ขอ/ต่ออายุใบรับรอง) + 443
- **ปลอดภัย:**
  - port ต่อตรงเป็นตัวฟังแยก: รู้ว่า "ต่อตรง" จากที่ที่เข้ามา ไม่ใช่จาก header · บนทางนี้ไม่เชื่อ `CF-*` เลย IP = รายการสุดท้ายของ `X-Forwarded-For` ที่ Caddy ใส่เอง (`server/direct.ts`)
  - ปฏิเสธก่อน upgrade (เบราว์เซอร์ถอยไปทาง Cloudflare ทันที): สวิตช์ปิด (403), หน้าเว็บ (Origin) ไม่ใช่โดเมนเดียวกับ hostname (403), IP เดียวต่อตรงเกินเพดาน (429)
  - เบราว์เซอร์ส่ง token ไปเฉพาะ `wss://<ชื่อ>/ws` ที่เป็นชื่อย่อยของโดเมนเดียวกับหน้าเว็บ บนหน้า https เท่านั้น (`src/client/net/route.ts`) · ชื่อ hostname แก้ได้เฉพาะ owner
- **เบราว์เซอร์** (`src/client/net/route.ts`): ก่อนต่อทุกครั้ง (รวมต่อใหม่) ถาม `GET /api/net-route` (ผ่าน Cloudflare) → ได้ URL ต่อตรงหรือ null · ลองต่อตรงก่อน ไม่เปิดใน 2.5 วิ / error / หลุดก่อนเข้าเกม = ใช้ `/ws` ผ่าน Cloudflare และไม่ลองต่อตรงอีก 10 นาทีในแท็บนั้น · โดนเตะ (`kick`) ไม่ถอย (เหมือนเดิม) · console บอก `[net] connected direct / through Cloudflare`
- **/admin แท็บ Server การ์ด "ต่อตรง (ลดปิง)"** (สิทธิ์ `directWs` owner+GM): สวิตช์เปิด/ปิด, เพดานต่อ IP (ค่าในโค้ด 40, 1–500 · ร้านเน็ตใช้ IP เดียวกันหลายคน), hostname (เฉพาะ owner) · settings เก็บเฉพาะที่ต่าง (`direct_ws`, `direct_ws_host`, `direct_ws_ip_max`) · ลง `admin_audit` (`direct-ws`) · ปิดหรือเปลี่ยนชื่อ = ตัดคนที่ต่อตรงอยู่ด้วย close 4100 (ไม่ใช่เตะ) เบราว์เซอร์ต่อใหม่เองภายในไม่กี่วิ (Auto ฟาร์มต่อระหว่างนั้นตามกติกาหลุด) · ตัวนับ: คนต่อตรง/ผ่าน Cloudflare ตอนนี้, ที่ถูกปฏิเสธแยกสาเหตุ · ถ้า server ไม่มี port ต่อตรง การ์ดบอก
- **log:** ตอนเข้าเกม `from <IP> direct (past Cloudflare)` · `[ping] average…` มี `via direct` (เทียบกับ `via BKK`/`via SIN` ก่อนเปิด) · แท็บผู้เล่นออนไลน์โชว์ `direct` ต่อท้าย IP
- **ขั้นตอนเปิดครั้งแรก (ทีละขั้น ตามที่เจ้าของอนุญาต):**
  1. merge + deploy (สวิตช์ยังปิด ไม่มีอะไรเปลี่ยนสำหรับผู้เล่น) → การ์ดใน /admin ต้องบอก port 2569
  2. เจ้าของ: Cloudflare → DNS → Add record: Type `A`, Name `ws`, IPv4 = IP ของ VPS, Proxy status **DNS only** (เมฆสีเทา)
  3. root บน VPS: `bash ~multiverse/MULTIVERSE/tools/vps-direct-setup.sh` → รอ "certificate obtained" ใน `journalctl -u caddy` · `curl -sI https://ws.multiverse-game.com/` ได้ 404
  4. เปิดสวิตช์ใน /admin → ดู `[ping] average…` เทียบก่อน/หลัง (และต้องไม่มี `no compression`)
  - ถ้า Hostatom มี firewall ภายนอกของเขาเอง ต้องเปิด 80/443 ที่นั่นด้วย
- **ฉุกเฉิน (โดนยิง/มีปัญหา):** ปิดสวิตช์ใน /admin (ทุกคนกลับไปผ่าน Cloudflare) แล้ว root: `bash ~multiverse/MULTIVERSE/tools/vps-direct-setup.sh off` (ปิด 80/443 + หยุด Caddy) · เปิดคืน: `… on` · ถามผู้ให้บริการ VPS เรื่องกัน DDoS
- เทสต์: `tests/direct-ws.test.ts`

## log สาเหตุที่หลุด (2026-11-17)

ทุกครั้งที่ออกจากโลก `[world] user (ชื่อตัวละคร) left: <สาเหตุ>` (ดูด้วย `npm run logs`) · ใช้ดูว่าหลุดแบบไหนบ่อย:
- `quit (left the game)` = กดออกเอง · `page closed (tab closed / reload)` = ปิดแท็บ/เบราว์เซอร์/รีโหลด (ออกทันที Auto ไม่ฟาร์มต่อ) · `kicked (…)` = GM เตะ/แบน/บัญชีเปลี่ยน · `server restart/stop` = ปิด server
- `takeover (logged in again)` = เข้าตัวเดิมจากที่อื่น/แท็บใหม่ · `taken back after farming N offline with Auto` = กลับมาเอาตัวที่ฟาร์มอยู่คืน
- `drop (close 1006 …, last ping N s ago, tab hidden)` = เน็ตหลุด: close code (1006 = ขาดโดยไม่บอกลา เช่น เน็ตเปลี่ยน มือถือปิดจอ), ping ล่าสุดกี่วิก่อนหลุด, แท็บซ่อนอยู่หรือไม่ (จาก ping ล่าสุด)
- `dropped (…) — Auto keeps farming up to 30 min` = หลุดแต่ Auto ฟาร์มต่อ · `Auto away ended: time up / Auto stopped / died / switched off in /admin / in a boss room, after N` = ฟาร์มจบ
- เข้าใหม่เองหลังหลุด: บรรทัด `joined … — reconnected: browser saw close 1006, cut off 4 s, try 2, tab hidden 3 min before the drop` (เบราว์เซอร์รายงานเองตอนต่อใหม่ ใช้แยก "มือถือปิดจอ" กับ "เน็ตหลุดขณะเล่น") · `browser closed it (no pong)` = เบราว์เซอร์เห็น socket ค้างเลยปิดเอง · `back at the same spot · Auto on` = ได้ที่เดิม/Auto ต่อ
- เทสต์: `tests/auto-away-server.test.ts` (ใช้ `AUTO_AWAY_TEST_MS` ย่อเวลาเฉพาะเทสต์)

## วัดภาระ server: log `[perf]` และสคริปต์บอท (2026-11-13)

- server พิมพ์ `[perf]` 1 บรรทัด/นาทีเมื่อมีคนออนไลน์ (`server/perf.ts`): จำนวนออนไลน์ (+ "N away with Auto" = หลุดแต่ Auto ฟาร์มต่อ), เวลาต่อรอบเกม (แยก sim/event/snapshot/เซฟ), รอบ/วิ, เวลาเซฟทุกคน, ความหน่วง event loop, % ยุ่ง, CPU, RAM, เน็ตขาออกจริงหลังบีบอัด · `PERF_LOG_MS` เปลี่ยนความถี่ · `PERF_JSON=1` เพิ่มบรรทัด `[perf-json]`
- สคริปต์บอท `tools/load-test.ts` เปิด server ทดสอบเอง (port สุ่ม + DB ชั่วคราว) ไม่อยู่ใน `npm run test` · ผลวัดครั้งแรกและคำแนะนำเช่า server: [../load-test-2026-11-13.md](../load-test-2026-11-13.md)
