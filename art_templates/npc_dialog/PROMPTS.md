# หน้าต่างคุย NPC ใหม่: prompt สำหรับเจนใน ChatGPT

เจ้าของขอเมื่อ 2026-11-26: หน้าต่างคุย NPC ใหม่ทั้งหมด แนวเดียวกับภาพตัวอย่างแบบ A/C
(รูป NPC ครึ่งตัวใหญ่ซ้าย · กล่องบทพูดล่างมีป้ายชื่อ · ปุ่มคำตอบมีไอคอนอยู่เหนือกล่องบทพูดฝั่งขวา)
และ **ฉากหลังเป็นภาพสถานที่ของ NPC ตัวนั้น** (ช่างตีเหล็ก = ในโรงตีเหล็ก, พ่อค้า = แผงร้าน ฯลฯ)
สไตล์ **กระดาษตัดแปะ (papercraft) เท่านั้น** เหมือนทั้งเกม

ลำดับงาน:
1. **ข้อ 0 ภาพตัวอย่างก่อน** (ภาพเดียว ช่างตีเหล็ก) ให้เจ้าของดูว่าหน้าตาโอเคไหม
2. ตกลงหน้าตาแล้วค่อยเจนชิ้นจริงข้อ 1–3 ที่เกมใช้ได้ (ฉากหลัง, รูปครึ่งตัว, ไอคอน)

## วิธีเจน

- **เปิดแชทใหม่** เจนทุกข้อต่อกันในแชทนั้น สไตล์จะได้ตรงกัน
- **แนบภาพ NPC กระดาษในเกมของตัวนั้นทุกครั้ง** เป็นแบบหน้าตาและชุด:
  `public/assets/sprites/paper/npc/<ไฟล์>.png` (แผ่น 3 แถว × 4 เฟรม แถวบน = หันหน้า)
- ภาพแรกของแชทขึ้นต้นด้วย:
  `The attached sheet shows a townsperson from my papercraft game. Use EXACTLY this papercraft style for everything in this chat.`
- เซฟไฟล์ดิบที่ `art_templates/npc_dialog/raw/<ชื่อไฟล์>.png`

### ข้อความสไตล์กลาง (ใส่ต้นทุก prompt)

```
Style: papercraft diorama. Everything is built from layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers, flat paper pieces joined like paper puppets, warm soft light from the upper left. NOT pixel art, NOT 3D render, NOT anime painting.
```

---

## 0. ภาพตัวอย่าง (ดูหน้าตาก่อน) → `mockup_blacksmith.png`

แนบ `public/assets/sprites/paper/npc/blacksmith.png`

```
<ข้อความสไตล์กลาง>
Generate a WIDE image (16:9): a mock-up screenshot of a fantasy action RPG "talk to NPC" window, everything in papercraft.
- Background: the inside of the blacksmith's forge filling the whole picture, made of layered paper: a glowing orange paper fire in a stone forge, an anvil, hammers and tongs on the wall, a water barrel, shelves of swords and armour, warm orange light. Slightly darker and softer than the foreground so the window stays readable.
- Left side: a LARGE waist-up portrait of the blacksmith from the attached sheet (same person, beard, apron, gloves, hammer), facing slightly to the right toward the text, taking about one third of the width and the full height of the lower two thirds, his body overlapping the left end of the dialogue box.
- Bottom: a wide dialogue box across the lower quarter of the picture, made of dark brown card with a thin gold paper trim and small paper rivets at the corners. On its top-left edge, overlapping the portrait, a gold paper name plate ribbon. A small gold arrow in its bottom-right corner.
- Right side, ABOVE the dialogue box: a vertical stack of 5 answer buttons, each a dark card strip with a thin gold trim and a small square paper icon at its left end: a hammer on an anvil, two dice, a glowing star stone, a coin pouch, a red X. The first button is highlighted with a brighter gold border and a small gold pointer arrow at its left.
- Keep the name plate, the dialogue box and the buttons EMPTY of text (plain card), so the game can write Thai text on them.
No other text, no logo, no watermark.
```

**เจ้าของดูภาพแล้วบอกผม:** ชอบ/ไม่ชอบอะไร (ขนาดรูป ตำแหน่งปุ่ม สีกล่อง ฉากหลังมืดไป/สว่างไป) ผมจะปรับ prompt ข้อ 1–3 ตาม

---

## 1. ฉากหลังของ NPC แต่ละตัว → `bg_<ชื่อ>.png` (6 ภาพ)

แนบภาพ NPC ตัวนั้นด้วย (ให้ของในฉากเข้ากับชุดและสีของเขา) แต่ **ในภาพต้องไม่มีคน**

```
<ข้อความสไตล์กลาง>
Generate a WIDE image (16:9): a papercraft diorama scene used as the background behind a dialogue window. NO people, NO characters, NO animals in the picture. Strong depth with several paper layers, the interesting things on the RIGHT half and the left third calmer (a portrait will stand there), the bottom quarter simple (a text box will cover it). Soft, slightly muted colours so text on top stays readable. No text, no letters, no signs with writing, no logo, no frame.
The place: <บรรทัดของ NPC ตัวนั้นจากตาราง>
```

| ไฟล์ | NPC | แนบภาพ | บรรทัดสถานที่ |
|---|---|---|---|
| `bg_seeker.png` | The Seeker | `seeker.png` | `a quiet stone shrine at the edge of town at dusk: an old stone archway with a glowing rune circle, hanging paper lanterns, a worn map pinned to a wooden board, a path leading into a misty forest, the first stars in a deep blue sky.` |
| `bg_merchant.png` | พ่อค้า | `merchant.png` | `a busy travelling merchant's stall: a green striped paper awning, wooden crates of red and blue potion bottles, sacks of goods, hanging pots and pouches, a wooden counter with a small scale and coins, a sunny town square behind.` |
| `bg_blacksmith.png` | ช่างตีเหล็ก | `blacksmith.png` | `the inside of a blacksmith's forge: a glowing orange fire in a stone forge, an anvil, hammers and tongs on the wall, a water barrel, shelves of swords and armour, sparks, warm orange light.` |
| `bg_keeper.png` | ผู้ดูแลคลัง | `keeper.png` | `the inside of a cosy town warehouse: tall wooden shelves of labelled-less boxes and chests, a big iron-bound treasure chest, a ladder, hanging keys on hooks, a small desk with an oil lamp, warm lamplight.` |
| `bg_broker.png` | นายหน้าตลาด | `broker.png` | `a market broker's office by the market: a dark wooden desk with open ledger books, a quill and an ink pot, a brass balance scale, stacks of coins, pinned notices without writing, a window showing colourful market stalls outside.` |
| `bg_crystal.png` | พ่อค้าคริสตัล | `crystal_merchant.png` | `a mysterious crystal shop at night: a deep navy room with silver paper stars hanging from the ceiling, glowing blue crystals on velvet stands and in glass cases, a crystal ball on a small table, soft blue magical light.` |

---

## 2. รูป NPC ครึ่งตัว → `portrait_<ชื่อ>.png` (6 ภาพ)

แนบภาพ NPC ตัวนั้น · เจนทีละภาพ

```
<ข้อความสไตล์กลาง>
Generate a TALL image (3:4): a large waist-up portrait of EXACTLY the papercraft person in the attached sheet (same face, hair, outfit, colours and props), redrawn bigger and more detailed but still papercraft. Body turned slightly to the RIGHT, looking toward the right, a friendly expression that fits the person, both shoulders inside the picture, cut off at the waist by the bottom edge, the top of the head close to the top edge. <บรรทัดท่า> 
Background ONE perfectly flat solid colour: <สีพื้นจากตาราง>. No shadow on the background, no ground, no frame, no text.
```

| ไฟล์ | NPC | บรรทัดท่า | สีพื้น |
|---|---|---|---|
| `portrait_seeker.png` | The Seeker | `Holding the wooden staff with the glowing lantern, the face in the hood's shadow with two small glowing eyes.` | `magenta (#FF00FF); do not use pink, magenta or purple on the person` |
| `portrait_merchant.png` | พ่อค้า | `One hand raised in a cheerful greeting, the big backpack visible behind his shoulders.` | `magenta (#FF00FF); do not use pink, magenta or purple on the person` |
| `portrait_blacksmith.png` | ช่างตีเหล็ก | `Arms crossed over the leather apron, the hammer tucked under one arm, a proud grin.` | `magenta (#FF00FF); do not use pink, magenta or purple on the person` |
| `portrait_keeper.png` | ผู้ดูแลคลัง | `Holding up the big iron ring of keys, a kind smile behind the round glasses.` | `magenta (#FF00FF); do not use pink, magenta or purple on the person` |
| `portrait_broker.png` | นายหน้าตลาด | `Holding the open ledger and the quill, one eyebrow raised, a sly smile.` | `magenta (#FF00FF); do not use pink, magenta or purple on the person` |
| `portrait_crystal.png` | พ่อค้าคริสตัล | `Holding up the glowing blue crystal near the face, a mysterious smile.` | `pure bright green (#00FF00); do not use bright green on the person` |

---

## 3. ไอคอนปุ่มคำตอบ → `answer_icons.png` (แผ่นเดียว 16 ไอคอน)

ไม่ต้องแนบภาพ NPC (แนบภาพ NPC ตัวไหนก็ได้ 1 ภาพเป็นแบบสไตล์)

```
<ข้อความสไตล์กลาง>
Generate a SQUARE image (1:1): a sheet of 16 small papercraft icons in a strict grid of 4 rows x 4 columns, every icon the same size, centred in its own cell with clear empty space around it, nothing touching. Each icon is a simple, bold object made of a few layered paper pieces with a thin dark outline, readable when shown very small (32 pixels).
Row 1: a hammer on an anvil; two dice; a glowing star-shaped rune stone; a playing card with a round hole punched in it.
Row 2: a leather coin pouch; a stack of gold coins with a small arrow; a wooden treasure chest; a brass balance scale.
Row 3: a wrapped parcel box with string; a glowing blue crystal; a rolled paper scroll with a quill; a paper scroll with a green check mark.
Row 4: a speech bubble; an old golden key; an open book; a red X made of two paper strips.
Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on the icons. No text, no numbers, no grid lines.
```

ไอคอนใช้กับปุ่มไหน (ผมเป็นคนจับคู่ในเกม):

| ไอคอน | ปุ่ม |
|---|---|
| ค้อนบนทั่ง | ตีบวก |
| ลูกเต๋า | สุ่มค่า |
| หินรูนดาว | สุ่มสเตตัส |
| การ์ดเจาะรู | เจาะรู/เสียบการ์ด (รอระบบการ์ด) |
| ถุงเงิน | ซื้อของ |
| เหรียญ + ลูกศร | ขายของ |
| หีบสมบัติ | เปิดคลัง |
| ตาชั่ง | ตลาดฝากขาย |
| กล่องพัสดุ | กล่องรับของ (ตลาด) |
| คริสตัลฟ้า | แคชช็อป |
| ม้วนกระดาษ + ขนนก | รับเควส |
| ม้วนกระดาษ + ติ๊ก | ส่งเควส |
| ฟองคำพูด | พูดคุย |
| กุญแจทอง | เควสกุญแจบอส (The Seeker) |
| หนังสือเปิด | เรื่องราว |
| X แดง | ลาก่อน |

---

## สำหรับผม: ใส่เข้าเกม

- ตัดพื้นสีออก ย่อ: ฉากหลัง 1280×720, รูปครึ่งตัวสูง 720, ไอคอน 64×64 ต่อช่อง
- วางที่ `public/assets/sprites/ui/npc_dialog/` (PNG, build แปลง WebP เอง) โหลดผ่าน `imgUrl()`
- ระหว่างยังไม่มีภาพ: ฉากหลังใช้สีไล่ระดับของ NPC, รูปใช้ sprite กระดาษเดิมขยาย, ไอคอนใช้ไอคอนชั่วคราว
