# แผน: NPC ตลาดฝากขาย (ผู้เล่นซื้อขายกันเอง)

สถานะ: **ทำแล้ว** ใน branch `feature/market` · อิงโค้ด `origin/main` หลัง PR #88 (เมืองศูนย์กลางมิติ)
ตัวเลขยืนยันกับเจ้าของแล้ว (หัวข้อ 11)

## 1. ภาพรวม

- NPC ใหม่ `broker` ("นายหน้าตลาด" ชื่อรอยืนยัน) ยืนในเขตเมือง `nexus_city` ข้างพ่อค้า
- ผู้เล่นฝากของไว้กับ NPC พร้อมตั้งราคา ผู้เล่นคนอื่นค้นหาและซื้อได้ตลอดเวลา แม้ผู้ขายจะออฟไลน์
- **ข้อมูลตลาดอยู่ใน DB เท่านั้น** ไม่อยู่ใน `CharacterData` หรือคลัง เงินที่ขายได้และของที่หมดเวลา/ยกเลิก
  เข้า **"กล่องรับของ"** ที่ NPC ผู้ขายมากดรับเองทีหลัง → server ไม่ต้องแก้ตัวละครของคนที่ออฟไลน์อยู่เลย
- ต้องคุยกับ NPC ในระยะ `NPC_USE_RANGE` เหมือนพ่อค้า/คลัง (server ตรวจ) ตายแล้วใช้ไม่ได้

## 2. การลงขาย

| หัวข้อ | ค่าที่แนะนำ |
|---|---|
| ของที่ลงขายได้ | อุปกรณ์ทุกชิ้น (รวมที่ตีบวกแล้ว) และหินตีบวก/หินกันแตก · **ยาลงขายไม่ได้** (ซื้อจากพ่อค้าได้อยู่แล้ว) |
| ลงจากไหน | จากกระเป๋าเท่านั้น (ของที่สวมอยู่ต้องถอดก่อน) |
| ขายทั้ง stack | หินขายทั้งกองในช่องนั้น ซื้อทีละกอง ไม่แบ่งซื้อ |
| ราคา | 1 – 100,000,000 G จำนวนเต็ม ตั้งครั้งเดียว แก้ไม่ได้ (ยกเลิกแล้วลงใหม่) |
| ช่องลงขาย | **20 ช่องต่อบัญชี** (นับรวมทุกตัวละคร) ✅ |
| ระยะเวลา | **48 ชม.** แล้วหมดอายุ → ของเข้ากล่องรับของ |
| ค่าลงขาย | **5% ของราคา** (ไม่มีขั้นต่ำ) จ่ายตอนลง ไม่คืนแม้ยกเลิกหรือหมดเวลา ✅ |
| ภาษีเมื่อขายได้ | **5%** หักจากเงินที่ผู้ขายได้รับ ✅ (รวมกันแล้วผู้ขายได้จริง 90% ของราคา) |
| Guest | ดูได้ แต่ **ลงขายและซื้อไม่ได้** (เหมือนคลัง ขึ้นข้อความชวนสมัคร) ✅ — เหตุผลดูหัวข้อ 2.1 |

### 2.1 ทำไมแนะนำให้ Guest ซื้อขายไม่ได้

1. **Guest ถูกลบเองหลังออฟไลน์ 24 ชม.** ของที่ฝากขายและเงินในกล่องรับของจะหายไปพร้อมบัญชี ผู้เล่นเสียของโดยไม่รู้ตัว
2. **สร้างได้ฟรีไม่ต้องสมัคร** (5 ตัวต่อ IP ต่อชั่วโมง) ใช้เป็นตัวปลอมได้ง่าย เช่น ฟาร์มด้วย Guest หลายตัวแล้วเทของ/ทองเข้าตัวหลักผ่านตลาด หรือลงของปั่นราคาแล้วทิ้งบัญชี จับคนทำยากเพราะไม่มีบัญชีจริง
3. **ใช้กติกาเดียวกับคลัง** ที่ Guest ใช้ไม่ได้อยู่แล้ว ผู้เล่นเข้าใจง่าย และเป็นแรงจูงใจให้สมัครสมาชิก

ทางเลือก: **Guest ซื้อได้แต่ขายไม่ได้** — ข้อ 1–2 เบาลงมากเพราะของไหลเข้า Guest อย่างเดียว ความเสี่ยงที่เหลือคือใช้ตลาดโอนทองจาก Guest เข้าตัวหลัก (Guest ซื้อของถูก ๆ ราคาแพง) แต่เสียค่าธรรมเนียม 10% ทุกครั้งจึงไม่คุ้ม

## 3. ค้นหา / กรอง / ซื้อ

- กรอง: ชื่อ (พิมพ์บางส่วน), ประเภทช่อง (อาวุธ/อาวุธรอง/หมวก/สร้อย/เกราะ/ถุงมือ/เข็มขัด/รองเท้า/แหวน/หิน),
  ระดับความหายาก, อาชีพที่ใส่ได้, ช่วงเลเวลไอเทม, +ขั้นต่ำ, ช่วงราคา, "ใส่ได้เท่านั้น" (อาชีพ+เลเวลตัวเรา)
- เรียง: ราคาน้อย→มาก (ค่าเริ่มต้น), มาก→น้อย, ใหม่สุด, เลเวลไอเทม, ใกล้หมดเวลา
- หน้าละ 20 รายการ server ทำ query ด้วย prepared statement จำกัดการค้นหา 1 ครั้ง / 0.25 วิ ต่อคน (คำสั่งอื่น 0.1 วิ)
- ซื้อ: กล่องยืนยัน (ชื่อของ + ราคา) → server ตรวจทอง ช่องว่างในกระเป๋า และไม่ใช่ของบัญชีตัวเอง
- **แจ้งเตือนเมื่อขายได้** ✅ (เจ้าของขอเพิ่ม):
  - ผู้ขายออนไลน์อยู่ (ทุกตัวละครในบัญชีที่ออนไลน์): ป้ายแจ้งเตือนกลางจอแบบเดียวกับประกาศ "💰 ขาย X ได้ Y G — รับเงินที่นายหน้าตลาด" + บรรทัดในแชท + เสียง `trade`
  - ผู้ขายออฟไลน์: ตอนเข้าเกมครั้งถัดไป ขึ้นสรุปครั้งเดียว "ระหว่างที่ไม่อยู่ ขายได้ N ชิ้น รวม Y G · ของหมดเวลารอรับ M ชิ้น"
  - ป้าย "!" บนหัว NPC และตัวเลขบนแท็บกล่องรับของ เมื่อมีของ/เงินรอรับ (เฉพาะคนนั้นเห็น)
  - ของหมดเวลาแจ้งแบบเดียวกันแต่ข้อความสั้นกว่า
  - ติดตาม "แจ้งแล้วหรือยัง" ด้วยคอลัมน์ `notified_at` ในตาราง (กันแจ้งซ้ำหลังรีสตาร์ท)

## 4. กล่องรับของ (เงินที่ขายได้, ของหมดเวลา, ของที่ยกเลิก)

- ยกเลิกการขายได้ตลอดถ้ายังไม่มีคนซื้อ (ค่าลงขายไม่คืน) → ของเข้ากล่องรับของทันที
- หมดเวลา: server ตรวจทุก 60 วิ (และตอนเปิด server) เปลี่ยนสถานะเป็น `expired`
- กดรับทีละรายการหรือ "รับทั้งหมด": เงินเข้ากระเป๋าตัวที่กดรับ, ของเข้ากระเป๋า (เต็มแล้ว = ค้างในกล่อง ไม่หาย)
- กล่องเป็นของ **บัญชี** ตัวไหนในบัญชีก็รับได้ · ไม่มีวันหมดอายุ
- ผู้ขายออฟไลน์: ไม่มีอะไรต้องทำ ทุกอย่างรออยู่ใน DB

## 5. ตาราง DB (`server/db.ts`, สร้างด้วย `CREATE TABLE IF NOT EXISTS` เหมือนตารางอื่น)

```sql
CREATE TABLE IF NOT EXISTS market_listings (
  id INTEGER PRIMARY KEY,
  seller_account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  seller_char INTEGER NOT NULL,          -- ไว้แสดงชื่อ/ประวัติ (ตัวละครถูกลบได้ ของยังเป็นของบัญชี)
  seller_name TEXT NOT NULL,
  entry TEXT NOT NULL,                   -- BagEntry เป็น JSON (Item หรือ StoneStack) เหมือนในคลัง
  uid TEXT,                              -- Item.uid (null สำหรับหิน) กันของชิ้นเดียวกันลงซ้ำ
  -- คอลัมน์สำหรับค้นหา คัดลอกจาก entry ตอนลง
  name TEXT NOT NULL, kind TEXT NOT NULL,          -- slot ของไอเทม หรือ 'stone'
  rarity TEXT, level INTEGER, plus INTEGER NOT NULL DEFAULT 0, cls TEXT, count INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL, fee INTEGER NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  status TEXT NOT NULL,                  -- 'active' | 'sold' | 'expired' | 'cancelled'
  buyer_account INTEGER, buyer_name TEXT, sold_at INTEGER, tax INTEGER,
  claimed_at INTEGER,                    -- ผู้ขายรับเงิน (sold) หรือรับของคืน (expired/cancelled) แล้ว
  notified_at INTEGER                    -- แจ้งผู้ขายแล้ว (ขายได้/หมดเวลา)
);
CREATE INDEX IF NOT EXISTS market_active ON market_listings(status, kind, rarity, price);
CREATE INDEX IF NOT EXISTS market_expiry ON market_listings(status, expires_at);
CREATE INDEX IF NOT EXISTS market_seller ON market_listings(seller_account, status);
CREATE UNIQUE INDEX IF NOT EXISTS market_uid_active ON market_listings(uid) WHERE status = 'active';
```

- สเตตัสของไอเทม (สำหรับค้นหาตามสเตตัส) แยกเป็นตารางลูก 1 แถวต่อสเตตัส ใส่ตอนลงขาย ไม่เปลี่ยนอีก:

```sql
CREATE TABLE IF NOT EXISTS market_listing_stats (
  listing_id INTEGER NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  stat TEXT NOT NULL,           -- StatKey
  value REAL NOT NULL,          -- ค่ารวมของสเตตัสนั้นจาก Item.stats (รวมผลตีบวกถ้ามี)
  PRIMARY KEY (listing_id, stat)
);
CREATE INDEX IF NOT EXISTS market_stat_value ON market_listing_stats(stat, value);
```

  ตัวกรองสเตตัสแต่ละแถว = `AND EXISTS (SELECT 1 FROM market_listing_stats s WHERE s.listing_id = l.id AND s.stat = ? AND s.value >= ?)`
  server ตรวจว่า `stat` อยู่ใน `STAT_KEYS` และมีไม่เกิน 3 แถวก่อนสร้าง query
- กล่องรับของ = แถวของบัญชีที่ `status IN ('sold','expired','cancelled') AND claimed_at IS NULL` ไม่ต้องมีตารางที่สอง
- แถวที่รับแล้วเก็บไว้ 30 วันเป็นประวัติ (หน้า admin + แท็บประวัติ) แล้วลบตอนล้างประวัติรายชั่วโมงที่มีอยู่แล้ว
- ลบบัญชี (owner) → แถวของบัญชีนั้นถูกลบตาม (ของที่ลงขายหายไปด้วย เหมือนคลัง)

## 6. ความปลอดภัย (server authoritative, กันของซ้ำ)

หลักการ: **ทุกการย้ายของ/ทองระหว่างตัวละครกับตลาด = DB transaction เดียว ที่เซฟตัวละครด้วย**
(ตัวละครปกติเซฟทุก 30 วิ ถ้าแค่ insert listing แล้ว server ล่มก่อนเซฟ ของจะอยู่ทั้งในตลาดและในเซฟเก่า = ของซ้ำ)

- **ลงขาย**: ตรวจใน `Sim` (ใกล้ NPC, ช่องกระเป๋าถูก, เป็นของที่ขายได้, ทองพอค่าลงขาย, ช่องลงขายบัญชียังไม่เต็ม)
  → เอาของออกจากกระเป๋า + หักค่าลงขายในหน่วยความจำ → `BEGIN; INSERT listing; save character (+คลัง); COMMIT`
  → ถ้า DB error ให้คืนของ/ทองในหน่วยความจำ
- **ซื้อ**: ตรวจทอง/ช่องว่าง → `BEGIN; UPDATE market_listings SET status='sold', ... WHERE id=? AND status='active' AND expires_at > now`
  → ถ้า `changes !== 1` = ROLLBACK + "มีคนซื้อไปแล้ว/หมดเวลา" → ไม่งั้นหักทอง ใส่ของ เซฟตัวผู้ซื้อ COMMIT
  - Node + `node:sqlite` ทำงานแบบ synchronous ทีละข้อความ คนสองคนกดซื้อพร้อมกันจึงไม่แทรกกัน
    ส่วน `WHERE status='active'` คือกันชั้นที่สอง (เช่นหลายตัวละครในบัญชีเดียวกัน หรือหมดเวลาพอดี)
  - client ส่ง `price` ที่เห็นมาด้วย server ปฏิเสธถ้าไม่ตรง (กันซื้อผิดชิ้นตอนรายการเปลี่ยน)
- **ยกเลิก / หมดเวลา**: แค่เปลี่ยนสถานะ ไม่แตะตัวละคร
- **รับของ/เงิน**: `UPDATE ... SET claimed_at=now WHERE id=? AND seller_account=? AND claimed_at IS NULL` + ใส่ของ/ทอง + เซฟตัวละคร ใน transaction เดียว
- ไม่ให้ซื้อของบัญชีตัวเอง (กันปั่นราคา) · ตรวจค่าทุกตัวจาก client (`Number.isInteger`, ช่วง, ความยาวข้อความค้นหา ≤ 30)
- ทุกการซื้อขายลง log (ตาราง listings เป็นประวัติอยู่แล้ว) GM/owner ดูได้ในหน้า `/admin` (เฟสถัดไป)

## 7. ข้อความ network (`src/shared/net/protocol.ts`) — แก้ครบ 5 ที่ตาม CLAUDE.md

client → server (`ActionMsg`, มี `req` ไว้จับคู่คำตอบแบบ `enhance`):

```ts
| { t: 'act'; a: 'mktSearch'; req: number; q: MarketQuery }         // ชื่อ ช่อง rarity[] อาชีพ lv +N ราคา stats[{stat,min}] (≤3) sort page
| { t: 'act'; a: 'mktMine'; req: number }                           // ของที่ลงขาย + กล่องรับของ
| { t: 'act'; a: 'mktList'; req: number; i: number; price: number } // ช่องกระเป๋า + ราคา
| { t: 'act'; a: 'mktCancel'; req: number; id: number }
| { t: 'act'; a: 'mktBuy'; req: number; id: number; price: number }
| { t: 'act'; a: 'mktClaim'; req: number; id: number }              // id = -1 คือรับทั้งหมด
```

server → client:

```ts
| { t: 'market'; req: number; ok: boolean; msg?: string; now?: number;   // now = นาฬิกา server ไว้คำนวณเวลาที่เหลือ
    page?: { rows: MarketRow[]; total: number; page: number };
    mine?: { active: MarketRow[]; box: MarketRow[]; slotsUsed: number } }
| { t: 'marketNote'; text: string; sub?: string }   // ขายได้/หมดเวลา: แจ้งทุกตัวในบัญชีที่ออนไลน์ (ออฟไลน์ = สรุปตอนเข้าเกม)
| { t: 'marketBox'; n: number }                     // จำนวนที่รอในกล่องรับของ (ป้าย "!" บนหัว NPC)
```

กระเป๋า/ทองที่เปลี่ยนไปถึง client ทาง snapshot เดิม (`PrivateSnap.inv`, `gold`) ไม่ต้องส่งซ้ำ

ไฟล์ที่แก้: `src/shared/data/npcs.ts` (+`broker`), `src/shared/sim/market.ts` (ใหม่: ค่าคงที่, `MarketQuery`, `MarketRow`, ตรวจของที่ขายได้, คำนวณค่าธรรมเนียม),
`src/shared/sim/terrain.ts` (ตำแหน่ง NPC + แผงร้าน), `server/db.ts`, `server/market.ts` (ใหม่: query + transaction), `server/world.ts`,
`src/client/backend.ts`, `src/client/net/online.ts`, `src/client/hud.ts` + `index.html` (หน้าต่าง), `src/client/assets.ts`, `mapIconNames.ts`, `fullmap.ts`,
`tests/market.test.ts` (ใหม่: ลง-ซื้อ-รับเงิน, ซื้อพร้อมกัน 2 คน, หมดเวลา, Guest ถูกปฏิเสธ)

## 8. UI หน้าต่าง "ตลาดกลาง"

ลากได้ที่แถบหัว (`dragwindow.ts`) ปิดเองเมื่อเดินออกนอกระยะ เปิดคู่กับกระเป๋าแบบคลัง 3 แท็บ:

1. **ซื้อ** (เจ้าของขอให้หาง่าย แบ่งหมวด/อาชีพเป็นตัวกรอง):
   - **แถบหมวดด้านซ้าย** (เลือกได้ 1): ทั้งหมด · อาวุธ · อาวุธรอง · หมวก · สร้อย · เกราะ · ถุงมือ · เข็มขัด · รองเท้า · แหวน · หินตีบวก แต่ละหมวดมีไอคอนช่องอุปกรณ์เดิม และตัวเลขจำนวนที่วางขาย
   - **อาชีพ** (ปุ่มเลือก 1): ทุกอาชีพ · นักดาบ · จอมเวท · มือปืน — ของที่ใส่ได้ทุกอาชีพ (สร้อย แหวน ฯลฯ) แสดงในทุกตัวเลือก
   - **ความหายาก** (เลือกได้หลายอัน สีตาม `RARITY_COLOR`): ธรรมดา · ดี · หายาก · มหากาพย์ · ตำนาน
   - **สเตตัสที่ต้องการ** ✅ (เจ้าของขอ): เพิ่มได้สูงสุด 3 แถว แต่ละแถว = เลือกสเตตัส (ทั้ง 10 ตัวใน `STAT_KEYS`: HP สูงสุด, MP สูงสุด, พลังโจมตี, พลังป้องกัน, คริ %, ดาเมจคริ %, ความเร็วโจมตี %, ความเร็วเคลื่อนที่ %, ฟื้น HP, ฟื้น MP) + "อย่างน้อย N" (เว้นว่าง = แค่มีสเตตัสนั้น) ไอเทมต้องมีครบทุกแถว · เรียง "ค่าสเตตัสที่กรอง มาก→น้อย" ได้
   - **ช่องค้นหาชื่อ**, **เลเวลไอเทม** ต่ำสุด–สูงสุด, **+ขั้นต่ำ**, **ราคาสูงสุด**, ติ๊ก **"ใส่ได้เท่านั้น"** (ตรงอาชีพและเลเวลตัวเรา)
   - **เรียง**: ราคาน้อย→มาก (ค่าเริ่มต้น) · มาก→น้อย · ลงใหม่สุด · เลเวลไอเทม · ใกล้หมดเวลา
   - **แต่ละแถวเห็นไอเทมและสเตตัสทันที** ✅: ไอคอนไอเทมจริง (กรอบสีตาม rarity) | ชื่อ +N, Lv, ผู้ขาย และบรรทัดล่างเป็นสเตตัสทุกบรรทัด (หลัก + เสริม) พร้อม tier (T1–T5 จาก `Item.lines`) สเตตัสที่ตรงกับตัวกรองเป็นสีเขียว | ราคา | เวลาที่เหลือ | ปุ่มซื้อ
   - ไอเทมเก่าที่ไม่มี `lines` แสดงจาก `stats` แบบไม่มี tier · หินแสดงจำนวนแทนสเตตัส
   - ตาราง: ชี้แล้วขึ้น tooltip เดิม (เทียบกับที่สวมอยู่), ซื้อ → กล่องยืนยัน, หน้าละ 20 พร้อมปุ่มเปลี่ยนหน้า, ปุ่ม "ล้างตัวกรอง"
   - ตัวกรองจำค่าไว้ระหว่างปิด/เปิดหน้าต่างในการเล่นครั้งนั้น · server กรองและแบ่งหน้าเอง (ไม่ส่งทั้งตลาดมาที่ client)
   - Guest เปิดแท็บนี้ดูได้ แต่ปุ่มซื้อขึ้นข้อความชวนสมัคร
2. **ลงขาย** — ช่องลงขาย x/10, ลากของจากกระเป๋ามาวาง (หรือคลิกขวา) → กล่องตั้งราคา แสดงค่าลงขาย ภาษี และเงินที่จะได้จริง, รายการที่ลงอยู่พร้อมปุ่มยกเลิก
3. **กล่องรับของ** — รายการเงิน/ของรอรับ, ปุ่มรับ, "รับทั้งหมด", ตัวเลขรอรับบนแท็บ

ข้อความในเกมเป็นภาษาไทยทั้งหมด

## 9. ภาพที่ต้องใช้ (ผู้ใช้เจนใน ChatGPT เซฟไว้ที่ `art_templates/market/raw/`)

| ภาพ | ไฟล์ในเกม | ถ้ายังไม่มี |
|---|---|---|
| ตัว NPC 3 มุม (หน้า/ข้างซ้าย/หลัง) | `public/assets/sprites/npc/broker.png` | วาด placeholder แบบผู้ดูแลคลัง |
| แผงตลาดฝากขาย (prop ข้าง NPC) | `public/assets/sprites/props/town_market.png` | ยืม `town_stall` |
| ไอคอนบนหัว NPC 128×128 | `icons/npc_market.png` | ยืม `npc_shop` |
| ไอคอนบนแผนที่ | `icons/map_market.png` | ยืม `map_merchant` |

Prompt อยู่ในไฟล์ `art_templates/market/PROMPTS.md` (สำเนาด้านล่าง)

### Prompt 1: NPC (แนบภาพ Gunslinger หรือใช้แชทเดิม)

```
Now one NPC character for the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger: same chibi proportions about 3 heads tall, same face construction, dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels. Generate an image: ONE row of 3 views of the SAME character from left to right: (1) front view facing the viewer, (2) side view facing LEFT, (3) back view. Identical size, colors and design across the 3 views, boots on the same baseline, generous empty space, nothing touching or overlapping. The character is the Market Broker who sells other adventurers' goods: a slim sharp-eyed middle-aged trader with neat dark hair tied back and a thin curled mustache, a long deep-teal coat with gold buttons and gold trim, a cream scarf, a small round monocle on one eye, holding an open ledger book in one hand and a quill pen in the other, a ring of small brass claim tags hanging from the belt. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on the character.
```

### Prompt 2: แผงตลาด + ไอคอน (แชทเดิม)

```
Same exact style. Generate an image: exactly 3 separate objects in a 3 columns x 1 row grid, generous empty space, nothing touching or overlapping. (1) In 2D isometric 3/4 view from above at about 35 degrees, light from the upper left, matching the ruined-city props (weathered sandstone, salvaged wood, moss, faded gold and old blue): a consignment market booth rebuilt from salvaged planks, a deep-teal cloth awning, a wooden board on the front covered with many small pinned paper notes and hanging brass claim tags, a counter with a few wrapped bundles and a small locked chest. (2) A square icon, bold and readable when small: an open ledger book with a gold coin and a small brass tag on top. (3) A small round map marker icon, bold simple shapes: a gold coin in front of a hanging price tag. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

(ทางเลือก: ผู้ดูแลคลัง `keeper.png` ก็ยังไม่มีภาพจริง ใส่เป็นแถวที่ 2 ใน Prompt 1 ได้)

## 10. ลำดับงาน (หลังได้คำตอบ)

1. branch `feature/market` จาก `origin/main`
2. shared: `npcs.ts`, `market.ts`, ตำแหน่ง NPC → typecheck
3. server: ตาราง + `server/market.ts` + `world.ts` + ตัวหมดเวลา → เทสต์ `tests/market.test.ts`
4. client: backend/online + หน้าต่าง 3 แท็บ + placeholder ภาพ
5. ลองเล่นด้วย `npm run dev` 2 ตัวละคร (ลง/ซื้อ/ยกเลิก/หมดเวลาแบบย่อเวลา/ผู้ขายออฟไลน์)
6. `npm run typecheck` + `npx vite build --outDir <scratch>` → PR (assignee ioilLnwza) → หลัง merge เพิ่มการ์ดคันบัง
7. ภาพจริง: เมื่อผู้ใช้เซฟไฟล์ดิบแล้ว ตัดเข้าเกมเป็น PR `art/market`

## 11. คำถามที่ต้องตัดสินใจ (ค่าที่แนะนำอยู่ในวงเล็บ)

คำตอบจากเจ้าของ (2026-11-07):
- ✅ ช่องลงขาย 20 ต่อบัญชี
- ✅ ค่าลงขาย 5% (จ่ายก่อน) + ภาษีหลังขาย 5%
- ✅ เงิน/ของรอในกล่องรับของที่ NPC + เพิ่มแจ้งเตือนเมื่อขายได้ (หัวข้อ 3)
- ✅ ใช้ภาพชั่วคราวก่อน
- ✅ ข้ออื่นใช้ค่าที่แนะนำ: "นายหน้าตลาด" ข้างพ่อค้า · อุปกรณ์ + หิน ไม่รวมยา ของตีบวกขายได้ · 48 ชม. · ราคา 1 – 100,000,000 G แก้ไม่ได้ · ซื้อของบัญชีตัวเองไม่ได้

- ✅ Guest ห้ามซื้อขาย (ดูได้อย่างเดียว)
- ✅ หน้าซื้อมีตัวกรองตามหมวด อาชีพ และอื่น ๆ (หัวข้อ 8)
- ✅ แต่ละแถวแสดงไอคอนไอเทม + สเตตัสหลักและเสริม และค้นหาตามสเตตัสได้ เช่น คริ, HP, MP (หัวข้อ 5, 8)

- ✅ ค่าลงขายไม่มีขั้นต่ำ
- ✅ รูปในตลาดเป็นรูปอาวุธ/อุปกรณ์จริงชุดเดียวกับในกระเป๋า
