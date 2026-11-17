# ไอคอนกระดาษ 224 ชิ้น: prompt สำหรับเจนใน ChatGPT

ไอคอนทั้งหมดในเกม: สกิล 103, ไอเทม 81, หินและยา 22 (หินตีบวก กุญแจ คัมภีร์ ยา เหรียญ), ไอคอนแผนที่และ NPC 18
(ตัวเลขดาเมจ `digits` กับ `crit_burst` ใช้ภาพเดิม)

ผมจัดไอคอนเดิมเป็นแผ่นละ 12 ชิ้น (4 คอลัมน์ × 3 แถว) รวม **20 แผ่น** อยู่ใน `art_templates/papercraft_icons/raw/ref/<ชื่อ>_old.png`
GPT วาดใหม่เป็นกระดาษทีละแผ่น โดยคงลำดับ รูปทรง และสัญลักษณ์เดิม ผมจะตัดแต่ละชิ้นกลับเป็นไฟล์เดิม

## วิธีเจน

- **เปิดแชทใหม่** ภาพแรกของแชทแนบ `art_templates/papercraft_maps/raw/ref/A7_hub.png` กับ `A1_heroes.png` เป็นต้นแบบสไตล์ แล้วขึ้นต้นด้วยประโยคนี้ก่อน: `The attached images show the papercraft art style of my game. Use EXACTLY this style for everything in this chat.`
- **ทุกแผ่นแนบภาพเดิมของแผ่นนั้น** (`ref/<ชื่อ>_old.png`) แล้วใช้ prompt ตามชนิด
- เซฟไว้ที่ `art_templates/papercraft_icons/raw/<ชื่อ>.png` เช่น `skill_1.png`
- ถ้าแชทยาวจนสไตล์เพี้ยน ให้เปิดแชทใหม่แล้วแนบภาพไอคอนกระดาษที่ชอบ 1 แผ่นไปด้วย

| แผ่น | ชนิด | prompt |
|---|---|---|
| `skill_1` … `skill_9` | ไอคอนสกิล (สี่เหลี่ยมมีพื้นและกรอบ) | ก |
| `item_1` … `item_7` | ไอเทม (ของลอย ๆ ไม่มีพื้น) | ข |
| `misc_1`, `misc_2` | หิน กุญแจ คัมภีร์ ยา เหรียญ (ของลอย ๆ) | ข |
| `map_1`, `map_2` | ไอคอนแผนที่และ NPC | ข |

### prompt ก: ไอคอนสกิล

```
The first attached image is a sheet of OLD pixel-art skill icons from my game. Redraw EVERY icon in the papercraft style: each icon is a square card tile with a thin brass paper frame, a dark painted paper background, and the SAME symbol as the old icon built from layered cut coloured paper with visible fibre, small drop shadows between layers and paper glow shapes for magic. Keep the SAME layout: the same icons in the same rows and the same order, the same colours and the same main symbol in each, one bold clear symbol that reads at small size. Every tile the same size, fully separate, generous empty space between them, nothing touching. The empty space between the tiles is ONE perfectly flat solid colour exactly like the old sheet's background (no gradient, no shadow). No text, no letters, no numbers, no labels.
```

### prompt ข: ไอเทม หิน ยา และไอคอนแผนที่

```
The first attached image is a sheet of OLD pixel-art item icons from my game. Redraw EVERY icon in the papercraft style: each item built from layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers, warm soft light from the upper left. Keep the SAME layout: the same items in the same rows and the same order, each item the same object with the same shape, colours and angle as the old one, filling about the same part of its space. No square tile and no frame behind an item unless the old icon has one. Every icon fully separate, generous empty space, nothing touching. Background ONE perfectly flat solid colour exactly like the old sheet's background, no gradient, no shadows on the background, and never use that background colour on an item. No text, no letters, no numbers, no labels.
```

---

## สำหรับผม: ใส่เข้าเกม

- `node tools/cut_paper_icons.cjs` ตัดทุกแผ่นตาม `sheets.json` ไอคอนแต่ละชิ้นได้ขนาดไฟล์เดิม และวางภาพในกรอบเดียวกับที่ภาพเดิมใช้ ขอบใสจะเท่าเดิม
- ใส่ลง `sprites/paper/icons/` แล้วให้ `imgUrl` กับตัวโหลดภาพเลือกภาพกระดาษเมื่อเปิดสวิตช์
