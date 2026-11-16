# แคชช็อป: แบบหน้าตาและ prompt ภาพ (ส่งต่อให้ Codex เจนภาพ)

อัปเดต 2026-11-15 · branch `feature/cash-shop` · หน้าต่างในเกม `src/client/cashShop.ts` · CSS `src/style.css` (หัวข้อ "Cash shop")

ไฟล์นี้มี 2 ส่วน
1. **แบบหน้าตา (ภาษาไทย):** ปัญหาของหน้าตาตอนนี้ แนวทางใหม่ ผังหน้าต่าง และรายการภาพที่ต้องใช้
2. **งานของ Codex (ภาษาอังกฤษ):** กติกาการเจน และ prompt ทีละภาพที่ copy ไปใช้ได้ทันที

ภาพหน้าตาปัจจุบันไว้เทียบอยู่ที่ `art_templates/cashshop/raw/ref/` (`current_cosmetics_tab.jpg`, `current_buy_window.jpg`)

---

## ส่วนที่ 1 · แบบหน้าตา

### ที่ดูไม่สวยตอนนี้

- หน้าต่างใช้กรอบ CSS ทั่วไป ไม่มีกรอบเหล็กบรอนซ์แบบหน้าต่างกระเป๋า เลยดูไม่เข้ากับ UI อื่นในเกม
- การ์ดสินค้าเป็นสีทองไล่สีจาก CSS สว่างและแบนเกินไป ตัดกับ UI เหล็กมืดของเกม
- แถบราคาเป็นสีเหลืองสด ไอคอนคริสตัลเป็นรูปหกเหลี่ยม CSS ไม่มีรายละเอียด
- แท็บ เมนูซ้าย ปุ่ม และป้ายมุมเป็นปุ่ม HTML ธรรมดา ไม่มีภาพ
- ไม่มีอะไรบอกว่าร้านนี้พิเศษ (เป็นร้านเงินเติม) ดูเหมือนรายการธรรมดา

### แนวทางใหม่: "ตลาดมิติ" (Dimensional Bazaar)

- **ฐาน = ชุด UI เดิมของเกม:** เหล็กดำตีขึ้นรูป ขอบบรอนซ์หม่น พิกเซล 16-bit SNES เหมือน `inventory.png`, `close.png`, `corner.png`
- **ตัวเน้นพิเศษ = แสงคริสตัลมิติ ม่วง-ฟ้า:** ใช้เฉพาะจุด เช่น คริสตัลประดับมุม เส้นรอยแยกมิติจาง ๆ บนพื้นผนัง แสงในช่องภาพสินค้า เพื่อบอกว่านี่คือร้านพิเศษ โดยไม่ทำให้ทั้งหน้าต่างกลายเป็นสีม่วง
- **การ์ดเปลี่ยนจากทองสด เป็นแผ่นเหล็กมืดขอบบรอนซ์** มีช่องภาพสินค้าเว้าลึกที่มีแสงคริสตัลจาง ๆ ด้านหลัง แถบราคาเป็นแผ่นบรอนซ์เข้ม ตัวเลขสีขาวครีม
- **การ์ดพิเศษ** (ติดแนะนำ หรือลดราคา) ใช้ขอบคริสตัลม่วง-ฟ้าแทนบรอนซ์
- **ป้ายมุมเป็นริบบิ้นผ้าพาดมุม** เขียว (ใหม่) แดง (ขายดี) ม่วง (ลดราคา) ไม่มีตัวหนังสือในภาพ เกมพิมพ์ข้อความทับเอง
- ตัวหนังสือทุกตัว (ชื่อสินค้า ราคา ชื่อแท็บ) **เกมพิมพ์เอง** ภาพต้องไม่มีตัวหนังสือ

### ผังหน้าต่าง (ขนาดในเกม กว้างประมาณ 760×520 px บนจอคอม)

```
┌──[มุมคริสตัล]═══════════════ [ แผ่นชื่อ "แคชช็อป" ] ═══════════[ 💠 1,000 (+) ][X]─┐
│  [แนะนำ][ของแต่งตัว][ของใช้][หิน]      ← แท็บ (ภาพแท็บปกติ/แท็บที่เลือก)              │
│ ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                                    │
│ │ ปีก    │ │ริบบิ้น│ │      │ │      │ │      │   ← การ์ดสินค้า 118×168            │
│ │ สัตว์ขี่ │ │[ภาพ] │ │[ภาพ] │ │[ภาพ] │ │[ภาพ] │     ช่องภาพเว้าลึก               │
│ │ ...    │ │ ชื่อ  │ │ ชื่อ  │ │ ชื่อ  │ │ ชื่อ  │     แผ่นชื่อ                      │
│ │        │ │ 0/50 │ │      │ │      │ │      │                                    │
│ │เมนูซ้าย │ │💠 400│ │💠 400│ │💠 600│ │💠 400│   ← แผ่นราคาบรอนซ์                 │
│ └────────┘ └──────┘ └──────┘ └──────┘ └──────┘                                    │
└──[มุมคริสตัล]═════════════════════════════════════════════════════════[มุมคริสตัล]──┘
```

- **หน้าต่างซื้อ** (เด้งกลางร้าน 360×280): กรอบเล็กแบบเดียวกัน ช่องภาพสินค้าใหญ่ ปุ่ม "ยืนยันการซื้อ" (ปุ่มเด่น) และ "ยกเลิก" (ปุ่มธรรมดา)
- **หน้าต่างแพ็กเกจ** (ปุ่ม +): การ์ดแพ็กเกจ 4 ขนาด ภาพกองคริสตัลเล็กไปใหญ่ ป้าย "เร็วๆ นี้"
- **แท็บ "แนะนำ"**: มีภาพแบนเนอร์กว้างด้านบน 1 ภาพ (ร้านของพ่อค้าคริสตัล)

### รายการภาพ (11 ไฟล์)

| # | ไฟล์ภาพดิบ (เซฟที่ `art_templates/cashshop/raw/`) | คืออะไร | ไฟล์ในเกมหลังตัด |
|---|---|---|---|
| 1 | `shop_frame.png` | กรอบหน้าต่างร้าน (ตัด 9 ช่องให้ยืดได้) | `public/assets/sprites/ui/cash_frame.png` |
| 2 | `shop_kit.png` | ชุดชิ้นส่วน 4×3: แท็บ แท็บที่เลือก ปุ่มเมนูซ้าย ×2 ปุ่ม + แผ่นยอดเงิน ปุ่มเด่น ปุ่มธรรมดา แผ่นราคา ช่องภาพ | `ui/cash_*.png` (ตัดทีละช่อง) |
| 3 | `shop_cards.png` | การ์ดสินค้าเปล่า 2 แบบ: ธรรมดา (บรอนซ์) และพิเศษ (คริสตัล) | `ui/cash_card.png`, `ui/cash_card_hi.png` |
| 4 | `shop_ribbons.png` | ริบบิ้นมุมการ์ด 3 สี: เขียว แดง ม่วง | `ui/cash_ribbon_{new,hot,sale}.png` |
| 5 | `crystal.png` | ไอคอนคริสตัลมิติ (เงิน) ต้องอ่านออกตอนเล็ก 16 px | `ui/crystal.png` (96×96) |
| 6 | `crystal_packs.png` | กองคริสตัล 4 ขนาดสำหรับแพ็กเกจ | `ui/cash_pack_{1..4}.png` |
| 7 | `dialog_frame.png` | กรอบหน้าต่างซื้อ (เล็ก ตัด 9 ช่อง) | `ui/cash_dialog.png` |
| 8 | `banner_featured.png` | แบนเนอร์แท็บแนะนำ (ภาพวาด 4:1) | `ui/cash_banner.png` |
| 9 | `ico_cashshop.png` | ไอคอนกลมแถวมุมขวาบน/เมนู | `ui/ico_cashshop.png` (96×96) |
| 10 | `crystal_merchant.png` | NPC พ่อค้าคริสตัล ชีต 3×3 | `npc/crystal_merchant.png` |
| 11 | `npc_cash.png` | ไอคอนป้ายบนหัว NPC (แบบเดียวกับ `npc_shop`) | `public/assets/sprites/icons/npc_cash.png` |

ลำดับที่แนะนำ: 1 → 2 → 3 → 4 → 7 (กลุ่มกรอบและชิ้นส่วน เจนในแชทเดียวกันให้สีตรงกัน) แล้วค่อย 5 → 6 → 8 → 9 → 10 → 11

### หลังได้ภาพ (งานของ AI ที่เขียนโค้ด ไม่ใช่ของ Codex)

1. ไล่สีม่วงแดง `#FF00FF` ออกเป็นโปร่งใส ตัดตามตาราง ย่อ แล้วเซฟตามคอลัมน์ "ไฟล์ในเกม"
2. กรอบ 1 และ 7 ใช้ `border-image` ใน CSS (วัดความหนาขอบจากภาพ)
3. เปลี่ยน `CRYSTAL_ICON` ใน `src/client/cashShop.ts` เป็นภาพ `crystal.png` · `CASH_ICON` ใน `src/client/sysmenu.ts` เป็น `badge('cashshop')` · ป้าย NPC ใน `src/shared/data/npcs.ts` เป็น `npc_cash`
4. NPC ขึ้นเองเมื่อมีไฟล์ `npc/crystal_merchant.png`
5. เปิดเกมดูใน dev server (ถามเจ้าของก่อนแคปหน้าจอ) แล้วรัน `npm.cmd run typecheck` และ `npm.cmd run test`

---

## ส่วนที่ 2 · งานของ Codex (Instructions for Codex)

### Rules for every image

- **Do not edit any code or any file outside `art_templates/cashshop/raw/`.** Only generate images and save them there with the exact file names below.
- Style: fine-detail **16-bit SNES-era pixel art**, crisp square pixels, no blur, no anti-aliased painterly gradients, no 3D render look, no vector look. Same detail level as the game's existing UI.
- **Attach these as style references** (they are in the repo):
  - `public/assets/sprites/ui/inventory.png` (main window style and colours: the most important reference)
  - `public/assets/sprites/ui/close.png`, `public/assets/sprites/ui/corner.png` (small UI parts)
  - `public/assets/sprites/ui/ico_bag.png`, `public/assets/sprites/ui/ico_daily.png` (round menu buttons)
  - `public/assets/sprites/npc/stylist.png` (NPC sprite sheet style)
  - `art_templates/cashshop/raw/ref/current_cosmetics_tab.jpg` (the current shop, to see the layout; do NOT copy its flat look)
- Palette:
  - Iron (dominant): `#141210`, `#1f1b17`, `#2c2822`, `#3a332b`
  - Tarnished bronze (trim): `#4a3c28`, `#6f5a32`, `#8a6a38`, `#b08a4e` (highlight only)
  - Dimensional crystal accent (use sparingly): `#4a2a9a`, `#8a5aff`, `#5ad0ff`, `#b8f4ff`
  - Never bright saturated yellow gold, never neon.
- **Background: ONE perfectly flat solid magenta `#FF00FF`** everywhere outside the drawn parts, with no shadow, glow or gradient on it, and **no magenta, pink or hot-purple inside the drawn parts** (the crystal violet must stay a blue-violet like `#8a5aff`, clearly different from `#FF00FF`).
- **No text, letters, numbers or logos** in any image. The game prints all words itself.
- In grid sheets: a strict invisible grid, each part centred in its own cell, wide empty space around it, nothing touching or overlapping.
- If an image comes out with text, a soft gradient background, or a part touching another, generate it again.

### 1. `shop_frame.png`: shop window frame (9-slice)

```text
Using the attached inventory window as the exact style and colour reference, generate a WIDE image (3:2): an empty window frame for a premium item shop in an isometric action RPG, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. Black forged iron dominates, with restrained tarnished aged-bronze trim. The frame border has the SAME thickness on all four sides (about one twelfth of the image height), with straight, plain, evenly repeating iron edges between the corners, so the edges can be stretched. Each of the four corners has a small iron bracket holding one small faceted crystal shard that glows softly blue-violet to cyan, the only bright accent. Top centre: a blank wide tarnished bronze title plate with a completely clear face, sitting on the top edge. The inside of the frame is a flat, very dark weathered stone wall, low contrast, with two or three very faint thin blue-violet cracks like small dimensional rifts near the edges, so that items placed on it stay readable; the middle area must be plain. Everything outside the frame is ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No items, no icons, no buttons, no readable words, no logos. Do not use pink or magenta in the frame.
```

### 2. `shop_kit.png`: shop UI parts sheet (4 × 3)

```text
Using the attached inventory window, close button and corner ornament as the exact style and colour reference, generate a WIDE image (4:3): a UI parts sheet for a premium item shop, black forged iron with tarnished aged-bronze trim, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. Strict invisible grid of 4 columns x 3 rows, one part centred in each cell with wide empty space around it, nothing touching. Row 1: a blank horizontal tab, dark iron with a thin bronze edge, open at the bottom; the same tab selected, a little taller, with a brighter bronze edge and a faint blue-violet glow along its top edge; a blank wide side-menu button, dark iron with a bronze edge; the same side-menu button selected, with a brighter bronze edge and a small cyan crystal stud on its left end. Row 2: a small round iron button with a raised bronze plus sign (add currency); a blank wide rounded iron plate with a small dark recess on its left end (currency counter); a blank wide button made of tarnished bronze, warm and slightly brighter than the iron, clearly the main action button; a blank wide plain iron button (secondary action). Row 3: a blank wide price plate, dark tarnished bronze, flat and thin, with a small round recess on its left end for a coin icon; a blank square recessed item display well, dark iron, with a faint blue-violet glow deep inside; a blank thin horizontal iron divider bar with a tiny crystal in the middle; a small blank square iron checkbox. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No icons inside the parts, no readable words, no numbers, no logos. Do not use pink or magenta in the parts.
```

### 3. `shop_cards.png`: item cards, normal and special

```text
Using the attached inventory window as the exact style and colour reference, generate a WIDE image (3:2): two empty item cards for a premium item shop, side by side, the same size, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. Each card is a tall portrait rectangle (about 7:10), made of dark forged iron with a clean bronze border, laid out from top to bottom as: a large empty square recessed display well taking the top half, with a faint glow deep inside it; a blank narrow nameplate strip; a short empty area; a blank thin price plate across the bottom, in dark tarnished bronze. LEFT card (normal): tarnished bronze border, the display well glows a very faint warm amber. RIGHT card (special): the same card, but its border is set with thin faceted blue-violet crystal bands and two small crystal studs at the top corners, and its display well glows soft blue-violet to cyan. Both cards stay mostly dark so the item picture and the white text placed on them stay readable. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No items, no icons, no readable words, no numbers, no logos. Do not use pink or magenta in the cards.
```

### 4. `shop_ribbons.png`: corner ribbons (3 colours)

```text
In the same 16-bit SNES-era pixel art style as the attached UI, generate a WIDE image (3:1): three identical diagonal corner ribbons, each a folded cloth sash that wraps across the TOP-LEFT corner of a card at 45 degrees, with a small folded tail on each end and a thin dark bronze stitched edge, crisp pixels, clear dark outline, no blur. Strict invisible grid of 3 columns x 1 row, one ribbon centred in each cell with wide empty space around it, nothing touching. Left: muted emerald green. Middle: deep warm red. Right: blue-violet (#6a4ad0 to #8a5aff, not pink). The middle band of each ribbon is a plain flat area with no pattern, where text will be printed. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No readable words, no letters, no numbers. Do not use pink or magenta in the ribbons.
```

### 5. `crystal.png`: the currency icon

```text
16-bit SNES RPG currency icon, polished pixel art with a limited colour palette, crisp dark outline, soft top-left lighting. A single item, centred, filling about 80% of the frame: one faceted hexagonal crystal standing upright, deep blue-violet at the bottom fading to bright cyan at the top, a thin bright highlight along one facet, and a very small swirl inside it like a tiny dimensional rift; two tiny white sparkles beside it. Very simple, bold silhouette that is still clearly a crystal at 16 pixels wide. No text, no border, no frame, no coin, no shadow on the ground. Solid flat pure magenta background (#FF00FF) with no gradient, and no magenta or pink anywhere on the crystal. Square image.
```

### 6. `crystal_packs.png`: package crystal piles (4 sizes)

```text
Using the attached crystal icon as the exact style and colour reference, generate a WIDE image (4:1): four item pictures for top-up packages, in polished 16-bit SNES-era pixel art with crisp pixels, clear dark outlines and soft top-left lighting. Strict invisible grid of 4 columns x 1 row, each picture centred in its cell, the same scale, wide empty space around it, nothing touching. From left to right, clearly growing in value: (1) three small blue-violet crystals lying together; (2) a small heap of about eight crystals; (3) a large heap of crystals spilling out of a small dark leather pouch with a bronze clasp; (4) an open dark iron treasure chest with tarnished bronze bands, overflowing with glowing crystals, a soft cyan glow rising from it. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No text, no numbers. Do not use pink or magenta in the pictures.
```

### 7. `dialog_frame.png`: purchase dialog frame (9-slice)

```text
Using the attached shop window frame as the exact style and colour reference, generate a SQUARE image: a smaller pop-up dialog frame for the same shop, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. Black forged iron with tarnished bronze trim, the border the SAME thickness on all four sides (about one tenth of the image height), straight plain repeating edges between the corners, and one tiny crystal stud in each corner. No title plate. The inside is a flat, very dark, plain surface for text and buttons. Everything outside the frame is ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No items, no icons, no readable words, no logos. Do not use pink or magenta in the frame.
```

### 8. `banner_featured.png`: featured tab banner

```text
A WIDE banner illustration (4:1) for the featured tab of a premium shop in an isometric action RPG, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur, the same style as the attached UI. Scene: a small night market stall in the ruins of a stone city, lit by floating faceted crystals that glow blue-violet to cyan; on the stall, a few displayed wonders: folded feathered wings, a small pet in a basket, a saddle, small glowing orbs; a dark navy hooded merchant with round gold spectacles stands behind the stall, holding a floating crystal above one palm. Dark, rich, moody colours; the crystals are the brightest thing. Leave the LEFT third of the banner calm and dark (sky and wall), with no details, because text will be printed there. Fill the whole image edge to edge, no frame, no border. No readable words, no letters, no logos.
```

### 9. `ico_cashshop.png`: round menu button

```text
Using the attached round HUD buttons as the exact style, size and colour reference, generate ONE matching round HUD menu button for an isometric action RPG, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. Same round badge as the references: a black forged iron rim and a thin tarnished aged-bronze inner ring around a dark recessed face, with one simple, bold, readable icon in the centre. Icon: a small merchant's shopping bag with a bronze clasp, with one faceted blue-violet-to-cyan crystal sticking out of its top and a tiny sparkle beside it (premium crystal shop). Icons use warm muted colours with clear dark outlines, and must stay readable at 40 pixels wide. The badge is centred in a square image with wide empty space around it, nothing touching the edges. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No letters, no numbers, no readable words, no logos. Do not use pink or magenta in the button.
```

### 10. `crystal_merchant.png`: NPC sprite sheet (3 × 3)

Background for this one is **bright green `#00FF00`** (the same as the other NPC sheets), not magenta.

```text
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the attached NPC sheet: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions about 3 heads tall, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 3 rows x 3 columns of ONE town NPC, a calm, mysterious crystal merchant who runs the premium shop: a traveller in a deep navy hooded robe with silver trim, round gold spectacles, a cyan-glowing pouch on the belt with a few tiny crystal shards hanging from it, and one faceted blue-violet-to-cyan crystal floating above an open palm. Rows from top to bottom: (1) front, facing the viewer; (2) side view facing LEFT; (3) back view. Columns: (1) idle; (2) slight bob up, the floating crystal a little higher; (3) idle. Identical design in every cell, same size, same baseline, nothing touching or overlapping. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on the character.
```

### 11. `npc_cash.png`: NPC head badge icon

```text
Using the attached shop icon (the merchant's head badge) as the exact style reference, generate ONE matching small badge icon in 16-bit SNES-era pixel art with crisp pixels and a clear dark outline: one faceted blue-violet-to-cyan crystal over a tiny bronze coin, simple and bold, readable at 20 pixels wide. Centred in a square image with empty space around it. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No text, no numbers. Do not use pink or magenta in the icon.
```

(แนบ `public/assets/sprites/icons/npc_shop.png` เป็นตัวอย่างสำหรับภาพนี้)
