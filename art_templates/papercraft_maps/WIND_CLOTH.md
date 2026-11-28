# ภาพผ้าแยกจากเสา สำหรับธงและใบเรือไหวตามลม (shader PR 2b)

ธงและใบเรือตอนนี้เป็นภาพเดียวกับเสา/ตัวเรือ ถ้าโยกทั้งภาพ เสาจะเอียงตาม จึงต้องมีภาพแยก 2 ส่วน: **ส่วนนิ่ง** (เสา ฐาน ตัวเรือ เชือก) กับ **ส่วนผ้า** (แผน [`docs/plans/shaders.md`](../../docs/plans/shaders.md) ข้อ 3.2) · ภาพเดิมยังใช้ตอนระดับ "ปิด" และในภาพแผนที่

## วิธีทำ

- ภาพอ้างอิง (ขยายแล้ว พื้นสีที่ถูกต้อง): `D:\Claude\Game\MULTIVERSE\art_templates\papercraft_maps\raw\wind_cloth\ref\`
- **1 ชิ้น = 1 แชทใหม่** แนบภาพอ้างอิงของชิ้นนั้นภาพเดียว แล้ววาง prompt ของชิ้นนั้น
- ผลที่ได้ 1 ภาพแนวนอน: **ซ้าย = ส่วนนิ่ง · ขวา = ผ้าอย่างเดียว**
- เซฟชื่อเดียวกับหัวข้อ ลงใน `D:\Claude\Game\MULTIVERSE\art_templates\papercraft_maps\raw\wind_cloth\` (ไม่ commit · ห้าม `git add raw/`)
- **ลองชิ้นที่ 1 (`flag`) กับชิ้นที่ 12 (`hb_ship_blue`) ก่อน** แล้วให้ตรวจว่าสองฝั่งซ้อนกันตรงไหม ค่อยเจนที่เหลือ

### ถ้าภาพไม่ตรง พิมพ์ต่อในแชท

สองฝั่งขนาดหรือตำแหน่งไม่ตรงกัน:

```
The two halves do not line up. Redo it: the left and right halves must have exactly the same scale, angle and position, as if they were two layers of the same picture. The cloth on the right must sit exactly where it sits in the attached image.
```

ผ้ายังติดมาในฝั่งซ้าย หรือเสา/เชือกติดมาในฝั่งขวา:

```
Redo it: the LEFT half must contain NO cloth at all, and the RIGHT half must contain ONLY the cloth, with no wood and no rope.
```

ได้ภาพพิกเซล:

```
Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.
```

---

## ชุดหลัก (15 ภาพ ตามแผน)

### 1. `flag.png` — ธงสามเหลี่ยมแดง (ป่ามรกต)

แนบ `ref/flag.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden pole, its golden tip and bindings, the stone and the grass tufts exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the red triangular pennant. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 2. `banner_red.png` — ธงแขวนแดง (ป่ามรกต)

แนบ `ref/banner_red.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden post, the crossbar and its bindings, the stone and the grass tufts exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the hanging red banner with its gold border and gold star. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 3. `banner_pole.png` — เสาธงฟ้า (เมืองกลาง)

แนบ `ref/banner_pole.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden post, the striped crossbar, the golden finials and the stone base exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the hanging blue banner with its gold border and gold star. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 4. `hb_banner_pole.png` — เสาธงท่าเรือ (ท่าเรือ)

แนบ `ref/hb_banner_pole.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden post, the crossbar, the golden ball and knobs and the base exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the hanging blue banner with its gold border and ship's wheel emblem. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 5. `hb_bunting_post.png` — เสาราวธง (ท่าเรือ)

แนบ `ref/hb_bunting_post.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep both wooden posts, all the rope bindings and the long rope the pennants hang from exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the three small hanging pennants (red, yellow, blue). No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 6. `skull_flag.png` — ธงโจรสลัดเสาเอียง (หาดเรือแตก)

แนบ `ref/skull_flag.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the leaning wooden pole, the rope ties and the sand pile exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the torn black flag with the skull and crossbones. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 7. `smuggler_flag.png` — ธงโจรสลัด (อ่าวลักลอบ)

แนบ `ref/smuggler_flag.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden pole and its rope ties exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the black flag with the skull and crossbones. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 8. `torn_flag.png` — ธงขาดสีเทา (สุสานเรือผี)

แนบ `ref/torn_flag.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden pole, the crossbar, the rope ties and the rocks exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the ragged grey flag with the skull and crossbones. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 9. `kraken_flag.png` — ธงคราเคน (วังวน)

แนบ `ref/kraken_flag.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid green (#00FF00): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden pole, the crossbar, the rope ties and the rocks exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the torn crimson flag with the kraken emblem. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure bright green anywhere on the prop.
```

### 10. `torn_sail_mast.png` — เสากระโดงใบขาด (หาดเรือแตก)

แนบ `ref/torn_sail_mast.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden mast and yard, every rope, the sand base, plants and debris exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the torn red and cream sail. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 11. `ghost_mast.png` — เสากระโดงผี (สุสานเรือผี)

แนบ `ref/ghost_mast.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden mast and yards, every rope, the hanging green moss and the rocks exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: all the ragged grey sail cloth. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 12. `hb_ship_blue.png` — เรือใหญ่ ใบน้ำเงิน (ท่าเรือ)

แนบ `ref/hb_ship_blue.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the hull, deck, windows, masts, yards, crow's nest and every rope and ladder exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: every sail (with its emblem and patches) and the small pennants at the mast tops. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 13. `hb_ship_green.png` — เรือใหญ่ ใบเขียว (ท่าเรือ)

แนบ `ref/hb_ship_green.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the hull, deck, windows, masts, yards, crow's nest and every rope and ladder exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: every sail (with its emblem and patches) and the small pennants at the mast tops. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 14. `hb_ship_red.png` — เรือใหญ่ ใบแดง (ท่าเรือ)

แนบ `ref/hb_ship_red.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the hull, deck, windows, masts, yards, crow's nest and every rope and ladder exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: every sail (with its emblem and patches) and the small pennants at the mast tops. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 15. `hb_ship_white.png` — เรือใหญ่ ใบขาว (ท่าเรือ)

แนบ `ref/hb_ship_white.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the hull, deck, windows, masts, yards, crow's nest and every rope and ladder exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: every sail (with its emblem and patches) and the small pennants at the mast tops. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

---

## ชุดเสริม (6 ภาพ · มีผ้าแต่ไม่อยู่ในรายการของแผน ทำหรือไม่ก็ได้)

ชิ้นที่ไม่ได้เจน = นิ่งเหมือนเดิม

### 16. `broken_mast.png` — เสากระโดงหัก (วางในแมพ 4 เยอะมาก) (วังวน)

แนบ `ref/broken_mast.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid green (#00FF00): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden mast and yard, every rope and the rocks exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the torn grey sail cloth. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure bright green anywhere on the prop.
```

### 17. `pirate_boat.png` — เรือโจรสลัดเล็ก (อ่าวลักลอบ)

แนบ `ref/pirate_boat.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the hull, the mast, the yard and every rope exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the red sail with the crossed swords. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 18. `room_cove_mast.png` — เสากระโดงห้องบอส (ห้องบอสอ่าวลักลอบ)

แนบ `ref/room_cove_mast.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid green (#00FF00): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden mast and yard, every rope and the rocks exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the torn dark sail cloth. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure bright green anywhere on the prop.
```

### 19. `room_grave_mast.png` — เสากระโดงห้องบอส (ห้องบอสสุสานเรือผี)

แนบ `ref/room_grave_mast.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden mast and yards, every rope, the moss, the rocks and planks exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: all the ragged grey sail cloth. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

### 20. `room_kraken_mast.png` — เสากระโดงห้องบอส (ห้องบอสคราเคน)

แนบ `ref/room_kraken_mast.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid green (#00FF00): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the wooden mast and yard, every rope and the rocks exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the torn crimson flag with the kraken emblem. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure bright green anywhere on the prop.
```

### 21. `room_cove_gunboat.png` — เรือปืนห้องบอส (ห้องบอสอ่าวลักลอบ)

แนบ `ref/room_cove_gunboat.png`

```
The attached image is one prop from my papercraft game. Generate an image, landscape 3:2 (1536x1024), made of two equal halves side by side. The background of BOTH halves is ONE perfectly flat solid magenta (#FF00FF): no divider line, no frame, no text, no labels, no ground, no shadows on the background.
LEFT half: the SAME prop with the cloth taken away. Keep the hull, the cannon, the cabin, the mast and every rope exactly as in the attached image, and complete whatever was hidden behind the cloth. No cloth at all in this half.
RIGHT half: ONLY the cloth: the red flag at the mast top and the red cloth awning. No wood, no pole, no rope, no base, nothing else.
CRITICAL: both halves use exactly the same scale, angle and position inside their own half, so that laying the right half on top of the left half rebuilds the attached image. Do not redesign, move, resize, rotate, mirror or recolour anything. Leave clear empty background around the prop; nothing touches the edges of its half.
Keep the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers. NOT pixel art. Do not use pure magenta anywhere on the prop.
```

---

เปิดดูแล้วไม่มีผ้า จึงไม่ต้องเจน: `net` `cargo_net` `bell_mast`
