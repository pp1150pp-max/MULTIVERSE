# หีบโบนัสล็อกอิน 7 / 15 / 30 วัน: prompt เจนภาพกระดาษ (ก๊อปวางได้เลย)

เจ้าของสั่งเมื่อ 2026-11-29 ตอนนี้แถบโบนัสในหน้าต่างปฏิทินใช้ภาพหีบสมบัติเดิมเป็นภาพชั่วคราวทั้ง 3 ขั้น

## วิธีเจน

- เปิดแชทใหม่ แนบ 3 ภาพเป็นตัวอย่างสไตล์:
  1. `art_templates/papercraft_maps/raw/ref/A1_heroes.png`
  2. `public/assets/sprites/paper/treasure/chest_closed.png`
  3. `public/assets/sprites/paper/icons/stone_mystery_box.png`
- เจนทีละภาพตามลำดับ **ในแชทเดียวกัน** จะได้เป็นชุดเดียวกัน
- เซฟไว้ที่ `art_templates/daily_bonus/raw/` ตามชื่อไฟล์ของแต่ละข้อ
- เจนเสร็จบอกผม ผมจะตัดเข้าเกม

## ข้อ 1: 7 วัน → `chest_7.png`

```
The attached images show the papercraft art style of my game (characters, a treasure chest and an inventory icon). Use EXACTLY this style for everything in this chat.
Draw ONE reward chest icon for a 7-day login bonus: a small closed treasure chest of warm brown wooden card with simple BRONZE paper trims and a round bronze clasp, one small paper star on the lid. Built from layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the layers, warm soft light from the upper left, in a slight three-quarter view like the inventory icons.
ONE single object, centred, filling about 80 percent of the image, nothing cut off. Bold simple shapes that read at very small size. No text, no letters, no numbers, no frame, no tile, no shadow on the ground, no hands, no character. Background ONE perfectly flat solid pure bright green (#00FF00), no gradient, and no bright green anywhere on the chest. Square image, at least 1024 x 1024.
```

## ข้อ 2: 15 วัน → `chest_15.png`

```
Now the 15-day bonus chest, same style, same size, same three-quarter view and same framing as the previous one, but clearly richer: a bigger-looking chest of deep blue card with SILVER paper trims, a blue paper gem on the clasp, two small paper stars on the lid, the lid just slightly lifted with a soft glow from the gap. No text, no numbers. Background solid pure bright green (#00FF00), no bright green on the chest.
```

## ข้อ 3: 30 วัน → `chest_30.png`

```
Now the 30-day grand bonus chest, same style, same view and same framing, clearly the best of the three: dark purple card with ornate GOLD paper trims and gold corner pieces, a large golden paper crown emblem on the lid, three paper stars, the lid half open with warm golden paper rays and tiny paper sparkles spilling out. Keep it compact so it still reads at very small size. No text, no numbers. Background solid pure bright green (#00FF00), no bright green on the chest.
```

---

## สำหรับผม: ตัดเข้าเกม

- ตัดพื้นเขียว ตัดขอบว่าง วางกลางช่องสี่เหลี่ยม 128×128 เซฟเป็น `public/assets/sprites/paper/ui/daily_chest_7.png` / `_15` / `_30`
- แก้ `BONUS_ART` ใน `src/client/daily.ts` ให้ชี้ 3 ไฟล์นี้
