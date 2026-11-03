# CLAUDE.md — คู่มือสำหรับ Claude ในโปรเจกต์ MULTIVERSE

เกม Action RPG มุมมองไอโซเมตริกบนเว็บ (TypeScript + Three.js + Vite) มีทั้ง Singleplayer และ Multiplayer
ภาพรวมระบบและโครงสร้างโฟลเดอร์อยู่ใน [README.md](README.md) · ขั้นตอน Git อยู่ใน [CONTRIBUTING.md](CONTRIBUTING.md)

## กฎการทำงานกับเจ้าของโปรเจกต์

- **ไม่แน่ใจอะไรให้ถามก่อน อย่าคิดเอาเอง** โดยเฉพาะตัวเลขเกม (ราคา ดรอป ดาเมจ) หน้าตา UI และพฤติกรรมที่ต่างกันระหว่าง SP กับ MP
- ถ้าคำขอเป็นภาษาไทยที่พิมพ์ผิดหรืออ่านได้หลายแบบ ให้ยืนยันความหมายก่อนลงมือ
- ตอบผู้ใช้เป็นภาษาไทย ข้อความในเกมเป็นภาษาไทย ชื่อในโค้ดและคอมเมนต์เป็นภาษาอังกฤษ
- งานใหญ่ให้เสนอแผนและรอตอบตกลงก่อนเริ่ม

## Git

- `main` ถูกล็อก ทุกงานต้องแตก branch (`feature/`, `fix/`, `art/`, `balance/`) แล้วเปิด PR
- CI รัน `npm run build` ต้องผ่านก่อน merge
- อย่า commit `dist/`, `node_modules/`, `server/data/` (ฐานข้อมูล)

## คำสั่ง

```bash
npm run dev        # Singleplayer อย่างเดียว ที่ http://localhost:5173
npm run build      # typecheck (เบราว์เซอร์ + server) แล้ว build ลง dist/
npm run typecheck  # ตรวจ type อย่างเดียว
npm run server     # server สำหรับ Multiplayer ที่ http://localhost:2567 (เสิร์ฟ dist/)
npm run online     # build + server + ลิงก์ Cloudflare ให้เพื่อนเข้า
```

- ยังไม่มีชุดเทสต์อัตโนมัติ ตรวจด้วย `npm run build` และเปิดเกมลองเล่นจริง
- `npm run online` ใช้ port 2567 ถ้าขึ้น `EADDRINUSE` แปลว่ามี server ตัวเก่ารันค้างอยู่
- **ขณะที่ server ของเจ้าของเปิดให้เพื่อนเล่นอยู่ อย่า build ทับ `dist/`** (เพื่อนจะได้โค้ดใหม่ที่ไม่ตรงกับ server) ให้ build ลงโฟลเดอร์อื่นด้วย `npx vite build --outDir <path>`

## สถาปัตยกรรมที่ต้องรู้

- `src/shared/` คือกติกาเกมล้วน ใช้ร่วมกันทั้งเบราว์เซอร์และ server **ห้าม import `three` หรือใช้ `document`/`window`**
  ถ้า Sim อยากให้แสดงอะไร ให้ส่ง `SimEvent` (ดู `src/shared/sim/types.ts`)
- `Sim` (`src/shared/sim/Sim.ts`) คือตัวตัดสินทุกอย่าง: ต่อสู้, ดรอป, EXP, ร้านค้า, ตีบวก
  - Singleplayer: `LocalBackend` รัน Sim ในเบราว์เซอร์
  - Multiplayer: server รัน Sim (`server/world.ts`) ส่วนเบราว์เซอร์ใช้ `OnlineBackend` (`src/client/net/online.ts`) ซึ่งแค่สะท้อน snapshot
- เพิ่ม action ใหม่ของผู้เล่น (ซื้อ, ขาย, เรียงของ ฯลฯ) ต้องแก้ครบ 5 ที่:
  1. เมธอดใน `Sim` หรือ `Player`
  2. `Backend` interface + `LocalBackend` ใน `src/client/backend.ts`
  3. `ActionMsg` ใน `src/shared/net/protocol.ts`
  4. `OnlineBackend` ใน `src/client/net/online.ts`
  5. `onAction` ใน `server/world.ts` — **ตรวจค่าที่ส่งมาจาก client ทุกครั้ง** (อย่าเชื่อ client)
- ข้อมูลตัวละครที่เซฟคือ `CharacterData` (`src/shared/sim/Player.ts`) เก็บใน localStorage (SP) และ SQLite (MP)
  ถ้าเปลี่ยนรูปแบบ ต้องคิดถึงเซฟเก่าเสมอ (ฟิลด์ใหม่ให้เป็น optional หรือมีค่าเริ่มต้น)
- ตัวเลขเกมอยู่ใน `src/shared/data/` เช่น `monsters.ts` (อัตราดรอป), `items.ts`, `enhance.ts`, `potions.ts`

## ระบบที่ตกลงกับเจ้าของไว้แล้ว

- กระเป๋า 30 ช่อง ยาอยู่ในกระเป๋าร่วมกับของสวมใส่ ช่องละไม่เกิน 10 ขวด ขายให้พ่อค้าได้ครึ่งราคา
- ยามี 3 ขนาดต่อชนิด เติมเป็นตัวเลขคงที่ (ไม่ใช่ %) — ดู `src/shared/data/potions.ts`
- ปุ่มยาด่วน (1/2) ใช้ขนาดที่ผู้เล่นเลือก (คลิกยาในกระเป๋า) ถ้าหมดจะใช้ขนาดเล็กสุดที่เหลือ
- Auto Play ปิดเองเมื่อผู้เล่นเดินเอง แต่กดโจมตีหรือสกิลเองได้โดย Auto ยังเปิดอยู่
- Multiplayer: แบ่ง EXP ตามสัดส่วนดาเมจ, คนที่ทำดาเมจมากสุดมีสิทธิ์เก็บของก่อน 10 วินาที
