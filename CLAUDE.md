# CLAUDE.md — คู่มือสำหรับ Claude ในโปรเจกต์ MULTIVERSE

เกม Action RPG มุมมองไอโซเมตริกบนเว็บ (TypeScript + Three.js + Vite) ทุกคนเล่นบน server เดียวกัน (เล่นแบบ Guest หรือเข้าสู่ระบบ)
ภาพรวมระบบและโครงสร้างโฟลเดอร์อยู่ใน [README.md](README.md) · ขั้นตอน Git อยู่ใน [CONTRIBUTING.md](CONTRIBUTING.md)

## กฎการทำงานกับเจ้าของโปรเจกต์

- **ไม่แน่ใจอะไรให้ถามก่อน อย่าคิดเอาเอง** โดยเฉพาะตัวเลขเกม (ราคา ดรอป ดาเมจ) หน้าตา UI และพฤติกรรมที่ต่างกันระหว่าง SP กับ MP
- ถ้าคำขอเป็นภาษาไทยที่พิมพ์ผิดหรืออ่านได้หลายแบบ ให้ยืนยันความหมายก่อนลงมือ
- ตอบผู้ใช้เป็นภาษาไทย ข้อความในเกมเป็นภาษาไทย ชื่อในโค้ดและคอมเมนต์เป็นภาษาอังกฤษ
- งานใหญ่ให้เสนอแผนและรอตอบตกลงก่อนเริ่ม
- **ก่อนแก้ระบบใด ให้อ่านไฟล์ใน `docs/systems/` ของระบบนั้นก่อน** (ตารางท้ายไฟล์นี้) มีกติกาที่ตกลงกับเจ้าของไว้แล้ว ห้ามเปลี่ยนโดยไม่ถาม
- เมื่อเจ้าของตกลงกติกาใหม่ ให้เขียนลงไฟล์ระบบนั้นใน `docs/systems/` ไม่ใช่ใน CLAUDE.md (ที่นี่เก็บแค่สรุปบรรทัดเดียว)

## Git

- `main` ถูกล็อก ทุกงานต้องแตก branch (`feature/`, `fix/`, `art/`, `balance/`) แล้วเปิด PR
- CI รัน `npm run build` ต้องผ่านก่อน merge
- อย่า commit `dist/`, `node_modules/`, `server/data/` (ฐานข้อมูล)

## คำสั่ง

```bash
npm run dev        # เกม http://localhost:5173 + game server สำหรับทดสอบ (port 2568, DB server/data/dev.db) แก้โค้ด server แล้วรีสตาร์ทเอง
npm run build      # typecheck (เบราว์เซอร์ + server) แล้ว build ลง dist/
npm run typecheck  # ตรวจ type อย่างเดียว (เบราว์เซอร์ + server + tests)
npm run test       # เทสต์อัตโนมัติใน tests/ (เปิด server ทดสอบเองบน port ว่าง + DB ชั่วคราว แล้วปิดเอง)
npm run server     # server ตัวจริงที่ http://localhost:2567 (เสิร์ฟ dist/, DB server/data/multiverse.db)
npm run online     # build + server + ลิงก์ Cloudflare ให้เพื่อนเข้า (ถ้า npm run tunnel เปิดอยู่ จะใช้ลิงก์ของมัน)
npm run tunnel     # ลิงก์ให้เพื่อนอย่างเดียว เปิดค้างไว้ → รีสตาร์ท server แล้วลิงก์ไม่เปลี่ยน
npm run stop-server              # ปิด server (port 2567) แบบเตือนผู้เล่น 10 วิ + เซฟทุกคน แล้วรอจนปิดเสร็จ
npm run stop-server -- --restart # เหมือนกัน แต่ npm run online เปิด server ใหม่เอง (โค้ดที่ build ไว้แล้ว ไม่ build ใหม่)
```

## Server จริง (ห้ามพลาด)

- **ปิด/รีสตาร์ท server จริงต้องผ่าน countdown เสมอ** (`npm run stop-server` หรือปุ่มใน `/admin`) **อย่า kill task/หน้าต่างของ `npm run online` ตรง ๆ** (ไม่เตือน ไม่เซฟ)
  - อัปเดต server หลัง merge: ใช้ skill `/update-server` · merge ทุก PR ที่พร้อมแล้วขึ้น server ในคำสั่งเดียว: `/ship` · รายละเอียด countdown, Ctrl+C, ข้อความเตือน, สำรอง/กู้คืน DB: [docs/systems/server-ops.md](docs/systems/server-ops.md)
- **ขณะที่ server ของเจ้าของเปิดให้เพื่อนเล่นอยู่ อย่า build ทับ `dist/`** (`npm run build` ก็เขียนลง `dist/`) ให้ใช้ `npm run typecheck` และ `npx vite build --outDir <โฟลเดอร์อื่น>` แทน · เช็คว่ามีโปรแกรมใช้ port 2567 อยู่หรือไม่
- ทดสอบสร้างบัญชี/Guest ให้ทำกับ server ของ `npm run dev` (port 2568, DB `server/data/dev.db`) เท่านั้น อย่าสร้างบน server ตัวจริง (port 2567) · Vite ส่งต่อ `/api` และ WebSocket `/ws` ให้ (`vite.config.ts`)

## เทสต์

- **ตรวจงานด้วย `npm run typecheck` เป็นหลัก** (+ `npm run test` เมื่อแก้ server/บัญชี, สคริปต์ Sim แบบไม่เปิดเกมสำหรับ logic เกม) งาน UI ที่ typecheck ตรวจไม่ได้ให้อ่านหน้าเป็นข้อความ (`read_page`, console) ก่อน
- **จะแคปหน้าจอต้องถามเจ้าของก่อนทุกครั้ง** (ใช้ token มาก) · ตอนจบงานบอกว่าตรวจอะไรด้วยวิธีไหน
- agent ประจำโปรเจกต์ (`.claude/agents/`): `explorer` (Haiku, ค้นโค้ดแบบอ่านอย่างเดียว) · `ui-fixer` (Sonnet, แก้ UI เล็ก ๆ ที่ชัดเจนแล้ว ไม่ commit)
- เทสต์อัตโนมัติมีเฉพาะระบบ Guest/บัญชี (`tests/`) ที่เหลือตรวจด้วย `npm run build` และเปิดเกมลองเล่นจริง
- เพิ่มเทสต์ใหม่: ไฟล์ `tests/*.test.ts` ใช้ `ok()`/`finish()` จาก `tests/check.ts` แล้วเพิ่มเข้าสคริปต์ `test` ใน `package.json`
- เทสต์ห้ามแตะ `server/data/` หรือ server จริง ให้ใช้ DB ชั่วคราวแบบ `tests/guest-server.test.ts`

## สถาปัตยกรรมที่ต้องรู้

- `src/shared/` คือกติกาเกมล้วน ใช้ร่วมกันทั้งเบราว์เซอร์และ server **ห้าม import `three` หรือใช้ `document`/`window`**
  ถ้า Sim อยากให้แสดงอะไร ให้ส่ง `SimEvent` (ดู `src/shared/sim/types.ts`)
- `Sim` (`src/shared/sim/Sim.ts`) คือตัวตัดสินทุกอย่าง: ต่อสู้, ดรอป, EXP, ร้านค้า, ตีบวก
  - server รัน Sim (`server/world.ts`) ส่วนเบราว์เซอร์ใช้ `OnlineBackend` (`src/client/net/online.ts`) ซึ่งแค่สะท้อน snapshot (ไม่มีโหมด Singleplayer แล้ว)
- เพิ่ม action ใหม่ของผู้เล่น (ซื้อ, ขาย, เรียงของ ฯลฯ) ต้องแก้ครบ 5 ที่:
  1. เมธอดใน `Sim` หรือ `Player`
  2. `Backend` interface ใน `src/client/backend.ts`
  3. `ActionMsg` ใน `src/shared/net/protocol.ts`
  4. `OnlineBackend` ใน `src/client/net/online.ts`
  5. `onAction` ใน `server/world.ts` — **ตรวจค่าที่ส่งมาจาก client ทุกครั้ง** (อย่าเชื่อ client)
- ข้อมูลตัวละครที่เซฟคือ `CharacterData` (`src/shared/sim/Player.ts`) เก็บใน SQLite บน server (`server/db.ts`)
  ถ้าเปลี่ยนรูปแบบ ต้องคิดถึงเซฟเก่าเสมอ (ฟิลด์ใหม่ให้เป็น optional หรือมีค่าเริ่มต้น)
- ตัวเลขเกมอยู่ใน `src/shared/data/` เช่น `monsters.ts` (อัตราดรอป), `items.ts`, `enhance.ts`, `potions.ts`, `reroll.ts`
- **ภาพในเกมขึ้นเว็บเป็น WebP** (โหลดเร็วขึ้น โดยเฉพาะบนมือถือ): ภาพใหม่ใน `public/assets/sprites/` ยังใส่เป็น PNG ตามเดิม ตอน build จะแปลงเอง (`tools/vite-sprites-webp.ts`: q90 + smart subsample, alpha คงเดิม, cache ใน `node_modules/.cache/`) แล้วลบ PNG ออกจาก build · `npm run dev` ยังใช้ PNG
  - path ภาพที่เขียนใน TS ต้องผ่าน `imgUrl()` (`src/client/img.ts`) หรือโหลดผ่าน `loadTexture`/`loadImage` ใน `src/client/assets.ts` ถ้าลืม ภาพจะหายเฉพาะตอน build (ตอน dev ยังเห็นปกติ)
  - ใน `index.html` และ CSS เขียน `assets/sprites/….png` ได้เลย plugin เปลี่ยนเป็น `.webp` ให้ · ไฟล์ที่เป็น `.webp` อยู่แล้ว (การ์ด, ภาพหน้าโหลด) build ไม่แตะ

## ระบบที่ตกลงกับเจ้าของไว้แล้ว (รายละเอียดอยู่ในไฟล์ของแต่ละระบบ)

| ระบบ | สรุป | รายละเอียด |
|---|---|---|
| กระเป๋า ยา ไอเทม ช่างตีเหล็ก | กระเป๋า 30 ช่อง ยาช่องละ 10 · tier T1–T5 แบบ PoE2 · ช่างตีเหล็ก 3 เมนู (ตีบวก/สุ่มค่า/สุ่มสเตตัส) จ่ายทอง · ลูกแก้วตีบวก 1 ลูกต่อของที่สวม +7 ขึ้นไป หน้าตาทั้งเซิร์ฟแก้ได้เฉพาะเจ้าของใน /admin | [items-and-forge.md](docs/systems/items-and-forge.md) |
| เมือง แมพ ภาพ หน้าต่าง EXP | EXP โค้งชันขึ้น Lv20+ · Auto ได้ EXP 50% · ประตูบอสที่ Lv 10/20/30/40 · เมืองศูนย์กลาง `nexus_city` เป็น safe zone + ประตู 4 มุม · Auto Play รันบน server · ภาพ 16-bit isometric · หน้าต่างลากได้ไม่จำตำแหน่ง · EXP แบ่งตามดาเมจ | [world-and-ui.md](docs/systems/world-and-ui.md) |
| คลัง และตลาดฝากขาย | คลังร่วมทั้งบัญชี 30–90 ช่อง · ตลาด 5%+5% 48 ชม. กล่องรับของที่ NPC · Guest ใช้ไม่ได้ | [stash-and-market.md](docs/systems/stash-and-market.md) |
| Login, Guest, /admin | ปุ่ม Guest Login ปิดอยู่ · Guest ลบเมื่อไม่ออนไลน์ 24 ชม. · role owner/gm + role ที่ owner สร้างเอง (แท็บ "สิทธิ์" ติ๊กเครื่องมือต่อ role, DB เก็บเฉพาะที่ต่างจาก `FEATURE_ROLES`, ลบ role ที่มีคนใช้ไม่ได้) · หน้าบัญชีแสดงไอเทมเป็นตารางช่อง กดดู/แก้ได้ทุกอย่าง (สวิตช์ `itemEdit`) · `admin_audit` | [accounts-and-admin.md](docs/systems/accounts-and-admin.md) |
| ปาร์ตี้ | สูงสุด 3 ตัว (บัญชีละ 1) ไม่ใช่ Guest · หัวหน้าชวน/เตะ · หลุดได้ 60 วิ · ไม่เซฟ · ของดรอปแชร์ทั้งปาร์ตี้ · EXP เก็บ 50% แบ่ง 50% ให้คนแมพเดียวกันที่ไม่ต่ำกว่า 5 เลเวล | [party.md](docs/systems/party.md) |
| เทรดระหว่างผู้เล่น | ไม่ใช่ Guest แมพเดียวกัน บัญชีเดียวกันเทรดกันเองไม่ได้ · 8 ช่อง+ทอง · ยืนยันทั้งคู่แล้วนับ 3 วิ แก้ข้อเสนอ = ยืนยันถูกรีเซ็ตทั้งคู่ · ภาษีทองผู้ส่ง 3% (ผู้รับได้ 97%) · แลกใน transaction เดียว · ตาย/หลุด/เปลี่ยนแมพ = ยกเลิก · ประวัติใน /admin | [trade.md](docs/systems/trade.md) |
| กล่องจดหมาย | owner ส่งถึงตัวละคร/บัญชี/ทุกตัวละคร/ทุกบัญชี (Guest ไม่ได้) พร้อมของแนบ ≤ 10 ชิ้น · รับ all-or-nothing ครั้งเดียว · ลบไม่ได้ถ้ายังมีของแนบ · หมดอายุ 30 วัน · ดึงกลับได้เฉพาะสำเนาที่ยังไม่รับ | [mail.md](docs/systems/mail.md) |
| เพื่อน บล็อก กระซิบ | ผูกกับบัญชี เก็บใน DB · ไม่ใช่ Guest · สูงสุด 50 · คำขอค้างได้แม้ออฟไลน์ · บล็อกกันคำขอเพื่อน/กระซิบ/ชวนตี้/ขอเทรด · กระซิบหาใครก็ได้ที่ออนไลน์ (Guest ด้วย) | [friends.md](docs/systems/friends.md) |
| ห้องบอสและกุญแจ | บอสอยู่ในห้องแยก (channel ละกลุ่ม) ใส่กุญแจ 1–10 อันที่แท่นเรียกบอส · HP/ดาเมจ/รางวัล ×จำนวนกุญแจ · หัวตี้เชิญ 30 วิ กดเริ่ม/ยกเลิก (ยกเลิก = คืนกุญแจ) · บอสเกิดหลังนับถอยหลัง 5 วิ · ฆ่าแล้ว 90 วิ หรือแพ้ ออกไปที่แท่นเรียกบอส · ประตูออกต้องคลิก/กดปุ่ม · กุญแจดรอป 0.3% · เควส The Seeker ล่า 30 ตัวได้กุญแจผูกตัว ×1 ไม่หายจนฆ่าบอส · ขนนกฟีนิกซ์ 1,000 G ชุบที่เดิม HP ครึ่ง 3×กุญแจ ครั้ง · ล้มหมดทีมมีเวลาชุบ 5 วิ · แม่มดหนองมีสกิล ขวดยาพิษ (โดนแน่ แอ่งช้า 30%) มือโคลน (5 มือ/คน) คำสาปคางคก (ตามตัว 2 วิ แล้วกะพริบ 0.5 วิ) | [boss-rooms.md](docs/systems/boss-rooms.md) |
| แชนแนล (CH) | เฉพาะ 4 แมพฟาร์ม (ค่าต่อแมพ `ZoneDef.channels`) · CH 1–10 โชว์ในรายการเสมอ ห้องว่างไม่มี Sim เปิดเมื่อมีคนเข้า (ย้ายเอง/GM วาร์ปได้) คนสุดท้ายออกกลับเป็นห้องว่าง · ห้องละ 20 ลูกตี้ตามหัวตี้ได้ 22 · ระบบจัดห้องที่เปิดอยู่คนน้อยสุด เต็มหมดค่อยเปิดห้องใหม่ (เกิน 10 หายเมื่อว่าง) · ย้ายเองต้องพ้นการต่อสู้ 10 วิ · หลุดกลับใน 60 วิ = แมพ/CH/จุดเดิม · ปาร์ตี้/เทรด = ห้องเดียวกัน · GM วาร์ปเลือก CH ได้ | [channels.md](docs/systems/channels.md) |
| แจ้งปัญหา / ข้อเสนอแนะ | ปุ่มในเมนูระบบ (ไม่ใช่ Guest) · 10–500 ตัวอักษร · 1 ครั้ง/60 วิ, 5/วัน/บัญชี, 15/วัน/IP, 60/ชม. ทั้งเซิร์ฟ, ห้ามข้อความซ้ำใน 24 ชม. · server ใส่แมพ/ตำแหน่ง/เลเวล/ping เอง · เฉพาะ "รายงานผู้เล่น" แจ้ง owner/GM ออนไลน์ทันที · แท็บ "รายงาน" ใน /admin + ห้ามรายงานต่อบัญชี | [reports.md](docs/systems/reports.md) |
| ของแต่งตัว | ค่าการวาง/หน้าตาแยกรายชิ้น (ปีก สัตว์ขี่ สัตว์เลี้ยง ออร่า) · แท็บ "ของแต่งตัว" ใน /admin ทดลอง owner+GM บันทึกทั้งเซิร์ฟเฉพาะ owner · เก็บเฉพาะค่าที่ต่างจากโค้ด | [cosmetics.md](docs/systems/cosmetics.md) |
| ปรับสมดุล | แท็บใน /admin (สวิตช์ `balance` owner+GM) ปรับค่าอาชีพ/ตัวคูณ/ตัวตัดฟื้น/ตาราง tier (กลาง + แยกต่อสเตตัส/ช่วงเลเวล) · ตัวคูณค่าสเตตัสบนไอเทม (ทดลองก่อน คอนเฟิร์มเฉพาะ owner คูณของทุกชิ้นจริง สำรอง DB ก่อน `mulK` กันซ้ำ) · เก็บเฉพาะค่าที่ต่างจากโค้ด · มีผลทันที · ลง audit · โอกาส tier ไม่ย้ายช่วง · ของเก่าค่าเดิม ป้าย tier คำนวณใหม่ (`tierK`) | [balance.md](docs/systems/balance.md) |
| ปิด/รีสตาร์ท server, สำรอง DB | countdown เสมอ · exit code 75 = รีสตาร์ท · backup `VACUUM INTO` | [server-ops.md](docs/systems/server-ops.md) |
