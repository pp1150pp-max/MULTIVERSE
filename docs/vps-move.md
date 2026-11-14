# ย้าย server จริงไป VPS (Vultr กรุงเทพ 2 vCPU / 4 GB, Ubuntu 24.04)

เจ้าของเลือก 2026-11-14 · เหตุ: ไม่อยากเปิดคอมที่บ้านทิ้งไว้ · ผล load test: เครื่องขนาดนี้รับได้ราว 100 คน ([load-test-2026-11-13.md](load-test-2026-11-13.md))
การทำงานของ server บน Linux: [systems/server-ops.md](systems/server-ops.md) หัวข้อ "VPS (Linux)"

ไฟล์ที่เกี่ยว: `tools/vps-setup.sh` (ติดตั้งเครื่องใหม่) · `tools/multiverse.service` (systemd) · `tools/autostart.mjs` (`npm run autostart` ทั้ง Windows/Linux) · `server/pull-backup-main.ts` (`npm run pull-backup`)

**ห้ามตลอดทุกขั้น:** เปิด tunnel `multiverse` สองเครื่องพร้อมกัน · ส่ง `tunnel-config.json` / `.cloudflared` / DB ทางแชทหรือขึ้น GitHub (ใช้ scp เท่านั้น) · kill server หรือกด End ที่ task · สร้างบัญชีทดสอบบน server จริง

---

## A. เช็คลิสต์ที่เจ้าของทำเอง (ก่อนวันย้าย)

- [ ] **สร้าง SSH key** บนเครื่องบ้าน (ถ้ายังไม่มี) ใน PowerShell: `ssh-keygen -t ed25519` (กด Enter ตามค่าเริ่มต้น ใส่ passphrase หรือไม่ก็ได้) → ได้ `C:\Users\<คุณ>\.ssh\id_ed25519.pub`
- [ ] **สมัคร Vultr + ใส่วิธีจ่ายเงิน** (เจ้าของทำเอง)
- [ ] **ใส่ SSH key ใน Vultr:** Account → SSH Keys → Add → วางเนื้อหาไฟล์ `id_ed25519.pub` (ไฟล์ `.pub` เท่านั้น ห้ามไฟล์ที่ไม่มี .pub)
- [ ] **สร้างเครื่อง:** Deploy → Cloud Compute (Shared CPU) → Location **Bangkok** → Image **Ubuntu 24.04 LTS x64** → Plan **2 vCPU / 4 GB** → ติ๊ก SSH key ที่ใส่ไว้ → (ไม่ต้องเปิด IPv6/Backups ถ้าไม่ต้องการ) → Deploy
- [ ] จด **IP ของเครื่อง** (หน้า Overview) ไว้ใช้เอง (ไม่ต้องใส่ใน repo)
- [ ] **ตั้งชื่อย่อ SSH** — เพิ่มลงไฟล์ `C:\Users\<คุณ>\.ssh\config` (สร้างใหม่ถ้าไม่มี):
  ```
  Host multiverse-vps
    HostName <IP ของ VPS>
    User multiverse

  Host multiverse-vps-root
    HostName <IP ของ VPS>
    User root
  ```
- [ ] **ต่อครั้งแรกด้วยมือ** เพื่อยอมรับ host key: `ssh multiverse-vps-root` → พิมพ์ `yes` → ออกด้วย `exit`
- [ ] **ติดตั้งเครื่อง** (จากโฟลเดอร์เกม `C:\Users\Pencilvester\Desktop\game_1`):
  ```
  scp tools/vps-setup.sh multiverse-vps-root:
  ssh multiverse-vps-root bash vps-setup.sh
  ```
  ใช้เวลาราว 5–10 นาที จบแล้วขึ้น "เสร็จ" (รันซ้ำได้ ถ้าพังกลางทาง)
- [ ] **เช็คว่า Claude สั่งได้โดยไม่ถามรหัส** ทั้งจาก PowerShell และ Git Bash: `ssh -o BatchMode=yes multiverse-vps true` ต้องไม่มี error (ถ้าตั้ง passphrase ไว้ ต้องเปิด ssh-agent: `Get-Service ssh-agent | Set-Service -StartupType Automatic; Start-Service ssh-agent; ssh-add`)
- [ ] (ทางเลือก ไม่บังคับ) ตั้ง Firewall Group ของ Vultr ให้เปิดแค่ port 22 อีกชั้น (ufw บนเครื่องเปิดแค่ SSH อยู่แล้ว)

หมายเหตุ: หลังติดตั้ง ล็อกอิน SSH ด้วยรหัสผ่านถูกปิด (key เท่านั้น) ถ้าทำ key หาย ยังเข้าได้ทาง *View Console* ในหน้า Vultr ด้วยรหัส root ที่ Vultr ให้

## B. ซ้อมบน VPS (ก่อนวันจริง ไม่แตะ server ที่บ้าน)

ยังไม่คัด `tunnel-config.json` → ตัวคุมบน VPS เปิด **quick tunnel** (ลิงก์ `*.trycloudflare.com` สุ่ม คนละ tunnel กับ `multiverse` จึงไม่ชนกับที่บ้าน) · DB ว่างที่ server สร้างเอง · ได้ลองทาง systemd + cloudflared จริงทั้งหมด

1. `ssh multiverse-vps` แล้ว `cd MULTIVERSE && npm run autostart` → "เปิดเองตอนบูต = enabled · ตอนนี้ = ไม่ได้เปิด"
2. `npm run autostart -- -Start` แล้ว `npm run logs -- --follow` จนขึ้น "พร้อมแล้ว" และกล่องลิงก์ trycloudflare (Ctrl+C ออกจากการดู log ไม่ปิด server)
3. เครื่องบ้าน: `curl -s -o /dev/null -w "%{http_code}" <ลิงก์>/` และ `<ลิงก์>/admin` ต้องได้ 200 · port เกมต้องไม่เปิดออกนอก: `curl -m 5 http://<IP ของ VPS>:2567/` ต้อง timeout/ต่อไม่ได้ · (ห้ามสร้างบัญชีจริงที่นี่ ถ้าลองเล่นใช้ Guest ข้อมูลถูกล้างในข้อ 7)
4. รีสตาร์ท: `npm run stop-server -- --restart` → log "รีสตาร์ท server" แล้ว "พร้อมแล้ว" ลิงก์ไม่เปลี่ยน
5. systemd หยุด: `sudo systemctl stop multiverse` → log ต้องมีนับถอยหลัง + `saved and disconnected` แล้ว `npm run autostart` = ไม่ได้เปิด · เปิดใหม่ `npm run autostart -- -Start`
6. รีบูต: `ssh multiverse-vps-root reboot` → รอ 1–2 นาที → `npm run logs` ต้องเห็น server เปิดเองหลังบูต (ลิงก์ trycloudflare ใหม่) และก่อนดับมีนับถอยหลัง/เซฟ
7. ปิดและล้างของซ้อม: `npm run stop-server` แล้ว
   `rm -f server/data/multiverse.db server/data/multiverse.db-wal server/data/multiverse.db-shm server/data/control-*.json server/data/tunnel.json && rm -rf server/data/backups server/data/logs`
   (unit ยัง enabled อยู่: ถ้า VPS รีบูตก่อนวันจริงจะเปิด quick tunnel + DB ว่างอีก ไม่เป็นไร ปิดด้วย `npm run stop-server` แล้วล้างใหม่)

## C. วันย้าย (เลือกช่วงคนน้อย บอกผู้เล่นล่วงหน้า)

ที่บ้าน = PowerShell ในโฟลเดอร์หลัก `C:\Users\Pencilvester\Desktop\game_1` · VPS = `ssh multiverse-vps` แล้ว `cd MULTIVERSE`

1. **VPS: โค้ดตรงกับที่บ้าน** — `git pull --ff-only && npx vite build` แล้ว `git log -1 --oneline` ต้องตรงกับที่บ้าน
2. **บ้าน: ปิดผ่าน countdown** — `npm run stop-server -- --seconds 120` → รอจนขึ้น "server ปิดแล้ว" (ตัวคุม always-on จบเองพร้อม tunnel)
3. **บ้าน: ปิดไม่ให้กลับมาเปิดเอง** — `npm run autostart -- -Uninstall` (ลบ task `MULTIVERSE server` ไม่ใช่แค่หยุด) · เช็ค: `npm run autostart` ต้องขึ้นว่าไม่มี task · port 2567 ว่าง (`netstat -ano | findstr :2567` ไม่มีบรรทัด LISTENING) · ไม่มี cloudflared ค้าง (`tasklist | findstr cloudflared` ว่าง ถ้ามีหน้าต่าง `npm run tunnel` ให้ Ctrl+C)
4. **บ้าน: กันเปิด tunnel ถาวรโดยไม่ตั้งใจ** — เปลี่ยนชื่อ `server\data\tunnel-config.json` เป็น `tunnel-config.json.moved-to-vps` *หลัง* คัดในข้อ 6
5. **บ้าน: เตรียมไฟล์ DB** (server ปิดแล้ว ไฟล์ไม่ถูกเขียน) — ต้องไม่มี `server\data\multiverse.db-wal` (หรือขนาด 0) ถ้ามีและไม่ว่าง แปลว่า server ยังไม่ปิดสนิท หยุดแล้วเช็คข้อ 2–3 ใหม่ ·
   `Copy-Item server\data\multiverse.db server\dataackups\multiverse-move-to-vps.db` · **เก็บ `multiverse.db` เดิมที่บ้านไว้ห้ามลบ** (ทางถอยสุดท้าย)
6. **คัดไฟล์ไป VPS ผ่าน scp เท่านั้น:**
   ```
   scp server/data/backups/multiverse-move-to-vps.db multiverse-vps:MULTIVERSE/server/data/multiverse.db
   scp server/data/tunnel-config.json multiverse-vps:MULTIVERSE/server/data/
   scp $env:USERPROFILE\.cloudflared\cert.pem $env:USERPROFILE\.cloudflared\<tunnel-id>.json multiverse-vps:.cloudflared/
   ```
   (`<tunnel-id>.json` = ไฟล์ credentials ใน `.cloudflared` ที่บ้าน · **ห้ามคัด** `tunnel.json`, `control-*.json` · ต้องไม่มี `multiverse.db-wal`/`-shm` ค้างบน VPS ก่อนคัด)
7. **ตรวจว่าไฟล์ตรงกัน:** บ้าน `Get-FileHash server/data/backups/multiverse-move-to-vps.db` (SHA256) เทียบกับ VPS `sha256sum server/data/multiverse.db` · VPS: `sqlite3 server/data/multiverse.db "PRAGMA integrity_check; SELECT COUNT(*) FROM accounts;"` ต้องได้ `ok` และจำนวนบัญชีเท่าที่บ้าน · `chmod 600 server/data/tunnel-config.json ~/.cloudflared/*`
8. **VPS: เปิด** — `npm run autostart -- -Start` แล้ว `npm run logs -- --follow` จนขึ้น "พร้อมแล้ว" และกล่องลิงก์ `https://play.multiverse-game.com` (Ctrl+C ออกจากการดู log ไม่ปิด server)
9. **เช็ค:**
   - `curl -s -o /dev/null -w "%{http_code}" https://play.multiverse-game.com/` และ `/admin` ต้องได้ **200** ทั้งคู่
   - connector เดียว: `cloudflared tunnel info multiverse` (บน VPS) ต้องเห็น connector เดียว และ origin IP เป็นของ VPS (หรือดูในหน้า Cloudflare Zero Trust → Networks → Tunnels)
   - ล็อกอินบัญชีของเจ้าของในเกม เห็นตัวละคร/ของเดิม
   - ทดสอบ systemd หยุด/เปิด (ผู้เล่นจะเห็นนับถอยหลัง 10 วิ ทำตอนยังไม่มีคน): `sudo systemctl stop multiverse` → ต้องเห็น log นับถอยหลัง + "saved and disconnected" → `npm run autostart -- -Start`
   - (ทางเลือก) `sudo reboot` จาก `ssh multiverse-vps-root` แล้วรอ 1–2 นาที ลิงก์กลับมาเอง
10. **บ้าน: merge PR ที่ 2** (skill `/update-server`, `/ship` และเอกสาร เปลี่ยนเป็นสั่ง VPS ทาง SSH)
11. **เก็บสำรองนอก VPS เป็นประจำ:** บนเครื่องบ้าน `npm run pull-backup` (ดึงไฟล์สำรองล่าสุดมาไว้ที่ `C:\Users\<คุณ>\MULTIVERSE-backups`) ทำทุกครั้งที่เปิดคอม หรือให้ Claude ทำตอน `/ship`

## D. ย้ายกลับมาเครื่องบ้าน (ถ้า VPS มีปัญหา)

1. **VPS: ปิดผ่าน countdown** — `npm run stop-server -- --seconds 120` → "server ปิดแล้ว"
2. **VPS: ปิดไม่ให้เปิดเอง** — `ssh multiverse-vps-root "systemctl disable multiverse"` (หรือ `sudo node tools/autostart.mjs -Uninstall` ด้วย root) · เช็ค `npm run autostart` = disabled + ไม่ได้เปิด · `pgrep cloudflared` ต้องว่าง
3. **เอา DB ล่าสุดจาก VPS** (ไม่ใช่ไฟล์ก่อนย้าย เพราะผู้เล่นเล่นต่อบน VPS แล้ว):
   VPS: `sqlite3 server/data/multiverse.db "PRAGMA integrity_check; VACUUM INTO 'server/data/backups/multiverse-move-home.db';"`
   บ้าน: `scp multiverse-vps:MULTIVERSE/server/data/backups/multiverse-move-home.db server/data/backups/` → เทียบ SHA256 เหมือน C7
4. **บ้าน: วาง DB** — ย้าย `server\data\multiverse.db` เดิมไปเป็น `multiverse-before-move-home.db` · ลบ `multiverse.db-wal`/`-shm` ถ้ามี · คัด `multiverse-move-home.db` เป็น `server\data\multiverse.db`
5. **บ้าน: คืนลิงก์** — เปลี่ยนชื่อ `tunnel-config.json.moved-to-vps` กลับเป็น `tunnel-config.json` (credentials ใน `.cloudflared` ที่บ้านยังอยู่)
6. **บ้าน: เปิด** — `git checkout main && git pull --ff-only && npx vite build` → `npm run autostart -- -Install` (ขอสิทธิ์ admin) → `npm run autostart -- -Start` → `npm run logs` จนขึ้น "พร้อมแล้ว" → เช็ค `/` และ `/admin` = 200 + connector เดียว
7. revert PR ที่ 2 (skill กลับมาสั่งเครื่องบ้าน)
