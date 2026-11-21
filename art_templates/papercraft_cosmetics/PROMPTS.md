# หน้า Login โลโก้ และของในร้านเงินสด แบบกระดาษ: prompt สำหรับเจนใน ChatGPT

เจ้าของเลือกเมื่อ 2026-11-18: ทำกลุ่มนี้ก่อนไอคอน ส่วน **โลโก้เจนเป็นภาพเดียวทั้งคำ** (เดิมเป็นภาพแยกตัวอักษร 9 ตัว)
ภาพของเดิมสำหรับแนบอยู่ใน `art_templates/papercraft_cosmetics/raw/ref/` เซฟภาพที่เจนแล้วไว้ใน `art_templates/papercraft_cosmetics/raw/`
**เปิดแชทใหม่** ภาพแรกแนบ `art_templates/papercraft_maps/raw/ref/A7_hub.png` และ `A1_heroes.png` เป็นต้นแบบสไตล์

ภาพแรกของแชทให้ขึ้นต้นด้วยประโยคนี้ก่อน: `The attached images show the papercraft art style of my game. Use EXACTLY this style for everything in this chat: layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, warm soft light from the upper left.`

---

## 1. พื้นหลังหน้า Login → `login_bg.png`

แนบ `ref/login_bg_old.png`

```
Generate a WIDE image (16:9): redraw the attached old login background as a papercraft diorama: the same composition and mood, floating islands with ancient ruins and waterfalls drifting in deep indigo and violet space, a huge cracked golden moon behind them, small paper stars, and an ornate dark-and-gold paper frame in the two bottom corners. Built from layered cut paper and card with visible fibre and small drop shadows between layers. Keep the lower middle part of the image dark and calm with nothing in it, because the login form sits there. No text, no logo, no UI.
```

## 2. โลโก้ → `logo.png`

แนบ `ref/logo_old.png`

```
Generate a WIDE image (about 7:1): the game logo, the single word "MULTIVERSE" in capital letters, spelled exactly M-U-L-T-I-V-E-R-S-E, in the same bold serif letter shapes as the attached old logo, made in papercraft: each letter cut from thick dark slate card with a raised gold paper border and thin glowing gold cracks, the letters layered with small drop shadows, sitting in one straight line, evenly spaced. Only the word, nothing else. Background ONE perfectly flat solid magenta (#FF00FF), no shadow on the background. Do not use pink, magenta or purple on the letters.
```

---

## 3. ของในร้านเงินสด 15 ชิ้น

ปีก 5 คู่ สัตว์ขี่ 5 ตัว สัตว์เลี้ยง 5 ตัว ชิ้นละ 1 ภาพ
**แนบภาพของเดิมของชิ้นนั้นทุกครั้ง** (`ref/<ชื่อ>.png`) GPT จะวาดใหม่เป็นกระดาษ โดยคงตาราง 5 แถว × 3 เฟรม ขนาด และท่าเดิม เกมจะได้วางตรงตำแหน่งเดิม

### ข้อความกลาง

```
The attached image is the OLD pixel-art sprite sheet of one cosmetic item of my game: a strict grid of 5 rows x 3 columns, the rows are 5 views (front, three-quarter front turned LEFT, side facing LEFT, three-quarter back turned LEFT, back) and the columns are 3 animation frames. Redraw it in the papercraft style: the SAME item, the SAME grid, the same views, poses, proportions and size in every cell, built from layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers. Every cell centred on the same baseline, generous empty space, nothing touching or overlapping. No character, no rider, no text, no labels, no grid lines, no shadows on the background.
```

ปิดท้ายด้วยบรรทัดของชิ้นนั้น

| ไฟล์ (แนบ `ref/` ชื่อเดียวกัน) | บรรทัดท้าย |
|---|---|
| `wings_angel.png` | `The item: a pair of white feathered angel wings cut from layered white and cream paper feathers with a soft gold edge. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `wings_bat.png` | `The item: a pair of dark purple leathery bat wings with crimson membranes and small claws at the joints, cut from layered paper. Background ONE perfectly flat solid pure bright green (#00FF00); do not use bright green on it.` |
| `wings_phoenix.png` | `The item: a pair of phoenix wings made of layered orange and golden paper flame feathers with bright tips. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `wings_butterfly.png` | `The item: a pair of emerald-green butterfly wings of thin layered tissue paper with pale mint patterns. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `wings_mech.png` | `The item: a pair of mechanical wings made of dark steel-grey card plates with glowing cyan paper lines. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `mount_wolf.png` | `The item: a big white snow wolf mount with pale blue shading and a small leather saddle, no rider. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `mount_warhorse.png` | `The item: a dark armoured warhorse mount with a mane and tail of layered orange paper flames and a small saddle, no rider. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `mount_raptor.png` | `The item: a green bipedal raptor mount standing on its two hind legs, small clawed arms tucked at its chest, a saddle on its back, no rider. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `mount_hoverboard.png` | `The item: a floating sci-fi hoverboard with cyan and hot-pink neon underglow made of layered paper, no rider. Background ONE perfectly flat solid pure bright green (#00FF00); do not use bright green on it.` |
| `mount_tortoise.png` | `The item: a giant mountain tortoise mount with mossy paper rocks and a tiny tree on its brown shell and a small saddle on top, no rider. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `pet_slime.png` | `The item: a tiny round glossy light-green slime pet with big cute eyes. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `pet_cat.png` | `The item: a small fluffy orange tabby cat pet with a cream belly and sleepy cute eyes. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `pet_dragon.png` | `The item: a tiny red baby dragon pet with a golden belly and small wings, flying. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `pet_bot.png` | `The item: a small round floating robot pet, pale steel-blue with one glowing cyan eye screen and a tiny antenna. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |
| `pet_wisp.png` | `The item: a small cute fire spirit pet, a round golden-yellow paper flame with orange tips and two big happy eyes, floating. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on it.` |

## 4. ปีกข้างเดียว 5 ชิ้น → `wings_<ชื่อ>_one.png`

เกมใช้ภาพปีกข้างเดียวแล้วกลับด้านสร้างอีกข้างเอง ทำหลังข้อ 3 แนบภาพปีกคู่กระดาษที่เพิ่งเจน (`raw/wings_<ชื่อ>.png`) แล้วสั่งแก้

```
Edit the attached sprite sheet of a pair of character wings (5 rows x 3 columns: the same wings in 5 views and 3 flap frames). In EVERY cell keep ONLY ONE wing and completely erase the other one (fill where it was with the flat background colour): in rows 1 and 5 (front and back views) keep the wing on the RIGHT side of the picture; in rows 2, 3 and 4 (turned toward the left) keep the wing NEARER to the viewer. Keep everything else exactly the same: same wing, same size, same position in its cell, same papercraft style, same background colour.
```

ปีกค้างคาวใช้พื้นเขียว ภาพที่ได้จะเป็นพื้นเขียวตาม

---

## สำหรับผม: ใส่เข้าเกม

- ของในร้านเงินสด: ตัดแบบเดียวกับ `tools/cut_cosmetics.cjs` (ตาราง 5×3) ลง `sprites/paper/cosmetics/` แล้วให้สวิตช์ภาพกระดาษเลือกใช้
- โลโก้: ตัดพื้นหลังออก แล้วตอนเปิดสวิตช์ให้ `.logo` ใน `index.html` ใช้ภาพเดียวแทนตัวอักษร 9 ภาพ
- พื้นหลัง Login: ย่อเป็น 1672×941 เท่าของเดิม

---

## 5. ปีกข้างเดียว เจนใหม่ (2026-11-21) → `wings_<ชื่อ>_one.png`

ภาพชุดเดิมแถว 2–4 (มุมเฉียง/ข้าง) วาดโคนปีกไว้ด้านขวา เกมต้องการโคนปีกที่ **ขอบซ้ายของทุกช่อง** ปีกเลยกลับด้าน/ไขว้ ชุดนี้เจนใหม่ให้โคนอยู่ซ้ายทุกช่อง

**วิธีทำ:** เปิดแชทใหม่ต่อ 1 ปีก แนบภาพปีกคู่กระดาษของปีกนั้น `public/assets/sprites/paper/cosmetics/wings_<ชื่อ>.png` เป็นต้นแบบ แล้ววาง prompt กลาง + บรรทัดของปีกนั้น
เซฟเป็น `art_templates/papercraft_cosmetics/raw/wings_<ชื่อ>_one.png`

### prompt กลาง

```
Using the attached picture only as the reference for the wing's look and colours, make a NEW sprite sheet of ONE single wing in papercraft style (layered cut paper with soft paper shadows, same style as the attached), 5 rows x 3 columns on a 3:5 tall canvas, every cell the same size, the wing centred vertically in its cell.
EVERY cell: only ONE wing. Its ROOT (where it joins the back, a small rounded joint) touches the LEFT edge of the cell at half the cell's height, and the wing spreads out to the RIGHT from there. Never put the root on the right side.
Rows (the same wing seen from 5 angles, the body would be on the left, outside the picture):
1. seen from behind/front, flat and fully open, spreading right and slightly up;
2. turned a little away from the viewer: same wing a bit narrower;
3. seen from the side: the wing swept BACK and slightly UP from the root, feathers trailing to the right;
4. turned a little more away: narrower again, still swept to the right;
5. same as row 1.
Columns = 3 flap frames: 1 rest, 2 raised higher, 3 lowered. Same size and same root point in all three.
No body, no second wing, no text, no shadow on the background.
```

### บรรทัดของแต่ละปีก (ต่อท้าย prompt กลาง)

| ไฟล์ | บรรทัดที่ต่อท้าย |
|---|---|
| `wings_angel_one.png` | `White feathered angel wing of layered white and cream paper feathers with a soft gold edge. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on the wing.` |
| `wings_bat_one.png` | `Dark purple leathery bat wing with crimson membrane and small claws at the joints. Background ONE perfectly flat solid pure bright green (#00FF00); do not use bright green on the wing.` |
| `wings_phoenix_one.png` | `Phoenix wing of layered orange and golden paper flame feathers with bright tips. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on the wing.` |
| `wings_butterfly_one.png` | `Emerald-green butterfly wing of thin layered tissue paper with pale mint patterns. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on the wing.` |
| `wings_mech_one.png` | `Mechanical wing of dark steel-grey card plates with glowing cyan paper lines. Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on the wing.` |

**สำหรับผม:** ตัดด้วย `tools/cut_cosmetics.cjs` (ตาราง 5×3, โคนที่ขอบซ้ายกลางช่อง) ลง `public/assets/sprites/paper/cosmetics/`

---

## 6. ปีกข้างเดียว เจนรอบ 3 ให้หน้าตาเหมือนเดิม (2026-11-21) → `wings_<ชื่อ>_one.png`

รอบที่ 5 โคนปีกถูกแล้ว แต่หน้าตาปีกเปลี่ยนไปจากเดิม รอบนี้แนบ **2 ภาพ** ให้ GPT ลอก "หน้าตา" จากภาพเก่า และ "ท่า/ตำแหน่ง" จากภาพใหม่

**วิธีทำ:** เปิดแชทใหม่ต่อ 1 ปีก แนบ 2 ภาพตามลำดับนี้
1. ภาพเก่า (หน้าตาที่ต้องการ): `art_templates/papercraft_cosmetics/ref/wings_<ชื่อ>_one_OLD.png`
2. ภาพใหม่ (ตำแหน่งโคนปีกที่ถูก): `art_templates/papercraft_cosmetics/raw/wings_<ชื่อ>_one.png` (ไฟล์ที่เพิ่งเจนรอบที่แล้ว)

วาง prompt กลาง + บรรทัดพื้นหลังของปีกนั้น เซฟทับ `art_templates/papercraft_cosmetics/raw/wings_<ชื่อ>_one.png`

### prompt กลาง

```
I attach 2 sprite sheets of the same single character wing, both 5 rows x 3 columns.
IMAGE 1 = the CORRECT LOOK. Copy the wing design from image 1 exactly: the same shape and outline, the same number and shape of feathers / plates / membrane parts, the same colours, the same details and patterns, the same papercraft style (layered cut paper with soft paper shadows), the same size. Do not invent a new design, do not simplify, do not add anything.
IMAGE 2 = the CORRECT LAYOUT. Copy from image 2 only the placement and pose of each cell: canvas 3:5 tall, 5 rows x 3 columns, every cell the same size, ONE wing per cell, its ROOT (where it joins the back) touching the LEFT edge of the cell at half the cell's height, the wing spreading to the RIGHT. In row 3 (side view) the wing is swept back and slightly up, like image 2. Never put the root on the right side.
Rows: 1 front, 2 slightly turned, 3 side, 4 more turned, 5 back (same as row 1). Columns = 3 flap frames: 1 rest, 2 raised, 3 lowered, same root point in all three.
The result must look like the wing from image 1, only placed like image 2. No body, no second wing, no text, no shadow on the background.
```

### บรรทัดพื้นหลัง (ต่อท้าย prompt กลาง)

| ไฟล์ | บรรทัดที่ต่อท้าย |
|---|---|
| `wings_angel_one.png` / `wings_phoenix_one.png` / `wings_butterfly_one.png` / `wings_mech_one.png` | `Background ONE perfectly flat solid magenta (#FF00FF); do not use pink, magenta or purple on the wing.` |
| `wings_bat_one.png` | `Background ONE perfectly flat solid pure bright green (#00FF00); do not use bright green on the wing.` |

**สำหรับผม:** ตัดด้วย `tools/cut_cosmetics.cjs` เหมือนข้อ 5

---

## 7. ปีกข้างเดียว เจนรอบ 4: ทรงตามปีกชุดก่อนเปลี่ยนเป็นกระดาษ (2026-11-21) → `wings_<ชื่อ>_one.png`

รอบ 3 มีแกนยาวจากโคนก่อนถึงขนปีก ในเกมเลยดูลอยห่างจากหลัง และตอนวิ่งปีกยาวเกิน
รอบนี้ลอกรูปทรง ท่า และความยาวจากปีกชุดก่อนเปลี่ยนเป็นกระดาษ (โคนซ้ายทุกช่อง แกนสั้น มุมข้างพับเก็บ) แล้ววาดเป็นกระดาษตัดแปะ

**วิธีทำ:** เปิดแชทใหม่ต่อ 1 ปีก แนบ 1 ภาพ: `art_templates/papercraft_cosmetics/ref/wings_<ชื่อ>_one_PIXEL.png`
วาง prompt กลาง + บรรทัดพื้นหลังของปีกนั้น (ตารางในข้อ 6) เซฟทับ `art_templates/papercraft_cosmetics/raw/wings_<ชื่อ>_one.png`

### prompt กลาง

```
Redraw the attached sprite sheet in papercraft style: layered cut paper with soft paper shadows and slightly visible paper edges, clean and colourful, NOT pixel art. It is ONE single character wing, 5 rows x 3 columns (5 views x 3 flap frames).
Keep EVERYTHING else exactly like the attached picture: the same wing design, shape, outline and colours, the same pose and angle in every cell, the same size and the same length of the wing in each row (rows 2, 3 and 4 stay short and folded like the attached), and the same position in each cell. The layout must match cell by cell, on a 3:5 tall canvas with every cell the same size.
The wing's ROOT is a SMALL joint at the LEFT edge of every cell at half the cell's height, and the feathers (or membrane, or plates) start RIGHT AT that joint, with no long arm or stick before them, exactly like the attached. Never put the root on the right side.
No body, no second wing, no text, no shadow on the background.
```

**สำหรับผม:** ตัดด้วย `tools/cut_cosmetics.cjs` เหมือนข้อ 5
