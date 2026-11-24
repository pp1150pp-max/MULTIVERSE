# กล่องปริศนา: prompt เจนภาพกระดาษ (ก๊อปวางได้เลย)

เจ้าของสั่งเมื่อ 2026-11-24 พร้อมงานเจนของวางชิ้นใหญ่ ([PROPS_HD.md](../papercraft_maps/PROPS_HD.md))
ตอนนี้**กล่องปริศนายังไม่มีไฟล์ภาพเลย** เกมวาดอัญมณีชั่วคราวแทน (`icons/stone_mystery_box.png` ไม่มี) ใช้ทั้งในกระเป๋า แคชช็อป ตลาด และตอนตกบนพื้น
รอบนี้เจนให้ใหญ่พอ ผมจะเก็บไว้ 256×256 (ไอคอนหินอื่นเป็น 96×96) ขยายแล้วจะไม่แตก

## วิธีเจน

- เปิดแชทใหม่ แนบ 3 ภาพเป็นตัวอย่างสไตล์:
  1. `art_templates/papercraft_maps/raw/ref/A1_heroes.png`
  2. `public/assets/sprites/paper/icons/stone_key_bear.png`
  3. `public/assets/sprites/paper/icons/stone_megaphone.png`
- ก๊อป prompt ด้านล่างไปวาง
- เซฟเป็น `art_templates/papercraft_icons/raw/stone_mystery_box.png`
- เจนเสร็จบอกผม ผมจะตัดเข้าเกม

## Prompt

```
The attached images show the papercraft art style of my game (characters and two inventory icons). Use EXACTLY this style.
Draw ONE inventory icon in this papercraft style: a small ornate treasure box (a "mystery box") made of dark purple wood with gold corner trims and a gold clasp, a large glowing golden question mark emblem on the front, the lid slightly lifted with soft rainbow-coloured light and tiny paper sparkles spilling out from the gap. Built from layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the layers, warm soft light from the upper left, in a slight three-quarter view like the other icons.
ONE single object, centred, filling about 80 percent of the image, nothing cut off. No text, no letters, no numbers, no frame, no tile, no slot, no shadow on the ground, no hands, no character. Background ONE perfectly flat solid pure bright green (#00FF00), no gradient, and no bright green anywhere on the box. Square image, at least 1024 x 1024.
```

(พื้นหลังเขียว ไม่ใช่ magenta เพราะกล่องเป็นสีม่วง)

---

## สำหรับผม: ตัดเข้าเกม

- ตัดพื้นเขียวออก ตัดขอบว่าง วางกลางช่องสี่เหลี่ยม ให้สัดส่วนช่องว่างรอบ ๆ ใกล้กับ `paper/icons/stone_*.png` เซฟ 256×256 เป็น `public/assets/sprites/paper/icons/stone_mystery_box.png` และสำเนาย่อที่ `public/assets/sprites/icons/stone_mystery_box.png` (ทางเดิมที่ `icons.ts` กับ `assets.ts` โหลด)
- เช็กว่า `icons.ts` กับ `assets.ts` (`icon_stone_mystery_box`) โหลดภาพนี้แทนอัญมณีชั่วคราว ทั้งในกระเป๋าและตอนตกบนพื้น (`views.ts` loot)
