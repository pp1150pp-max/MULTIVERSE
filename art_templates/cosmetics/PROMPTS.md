# Cosmetics: prompt ภาพสำหรับเจนใน ChatGPT

ระบบอยู่ใน `src/shared/data/cosmetics.ts` (ข้อมูล) และ `src/client/cosmeticViews.ts` (วาดในเกม) ตอนนี้ใช้ภาพชั่วคราวที่วาดด้วยโค้ด
สไตล์ 16-bit SNES แบบ 2D isometric ระดับความละเอียดเดียวกับ Gunslinger สร้างในแชทเดียวกัน ถ้าเริ่มแชทใหม่ ให้แนบภาพ Gunslinger ไปเป็นตัวอย่างด้วย

## รูปแบบไฟล์ (ปีก สัตว์ขี่ สัตว์เลี้ยง)

- 1 ภาพต่อ 1 ชิ้น เป็นตาราง **5 แถว x 3 คอลัมน์** เหมือนไฟล์มอนสเตอร์
  - แถว (บนลงล่าง): หน้า, ทแยงหน้า, ข้าง, ทแยงหลัง, หลัง โดยหันไปทาง **ซ้าย** ฝั่งขวาเกมกลับด้านให้เอง จึงหันได้ 8 ทิศ
  - คอลัมน์ (ซ้ายไปขวา): เฟรมแอนิเมชัน 3 เฟรม เกมเล่นวนแบบ 1-2-1-3 (ปีก: พัก-ขึ้น-พัก-ลง · สัตว์ขี่: ยืน-ก้าวซ้าย-ยืน-ก้าวขวา · สัตว์เลี้ยง: ยืน-เด้งขึ้น-ยืน-ลง)
- เซฟภาพดิบที่ `art_templates/cosmetics/raw/<id>.png` แล้วบอก Claude ให้ตัดพื้นหลังและวางที่ `public/assets/sprites/cosmetics/<id>.png`
  ไฟล์ไหนวางแล้ว เกมใช้แทนภาพชั่วคราวเองทันที (ไม่ต้องแก้โค้ด)
- ใช้พื้นหลังสีม่วงแดง #FF00FF ยกเว้นชิ้นที่มีสีม่วง/ชมพู ใช้สีเขียว #00FF00 (ระบุไว้ใน prompt แล้ว)
- ออร่า/รอยเท้า และชุดฉายา/กรอบชื่อ/ฟองแชท วาดด้วยโค้ด ไม่ต้องเจนภาพ

## 1. ปีก (5 ชิ้น)

ปีกอย่างเดียว ไม่มีตัวละคร เกมวางไว้กลางหลังตัวละคร ด้านหน้าเห็นปลายปีกโผล่สองข้าง ด้านหลังเห็นปีกเต็ม

### ปีกเทวดา (`wings_angel`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE pair of character wings (wings ONLY, no character, no body, as if worn on the back of an invisible character, the wing roots meeting at the centre). Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) wings at rest half open, (2) wings flapped UP, (3) wings flapped DOWN. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The wings: a pair of white feathered angel wings with a soft warm golden glow at the edges. In the front views only the wing tips show on both sides of where the body would be; in the back views the wings are fully visible and spread. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### ปีกค้างคาวรัตติกาล (`wings_bat`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE pair of character wings (wings ONLY, no character, no body, as if worn on the back of an invisible character, the wing roots meeting at the centre). Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) wings at rest half open, (2) wings flapped UP, (3) wings flapped DOWN. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The wings: a pair of dark purple leathery bat wings with crimson membranes and small claws at the joints. In the front views only the wing tips show on both sides of where the body would be; in the back views the wings are fully visible and spread. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on it.
```

### ปีกเพลิงฟีนิกซ์ (`wings_phoenix`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE pair of character wings (wings ONLY, no character, no body, as if worn on the back of an invisible character, the wing roots meeting at the centre). Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) wings at rest half open, (2) wings flapped UP, (3) wings flapped DOWN. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The wings: a pair of phoenix wings made of orange and golden flame feathers with bright flickering tips. In the front views only the wing tips show on both sides of where the body would be; in the back views the wings are fully visible and spread. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### ปีกผีเสื้อมรกต (`wings_butterfly`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE pair of character wings (wings ONLY, no character, no body, as if worn on the back of an invisible character, the wing roots meeting at the centre). Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) wings at rest half open, (2) wings flapped UP, (3) wings flapped DOWN. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The wings: a pair of translucent emerald-green butterfly wings with pale mint patterns. In the front views only the wing tips show on both sides of where the body would be; in the back views the wings are fully visible and spread. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### ปีกกลไกนีออน (`wings_mech`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE pair of character wings (wings ONLY, no character, no body, as if worn on the back of an invisible character, the wing roots meeting at the centre). Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) wings at rest half open, (2) wings flapped UP, (3) wings flapped DOWN. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The wings: a pair of mechanical dark-steel wings made of plates with glowing cyan neon lines. In the front views only the wing tips show on both sides of where the body would be; in the back views the wings are fully visible and spread. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

## 2. สัตว์ขี่ (5 ตัว)

สัตว์ขี่อย่างเดียว ไม่มีคนขี่ เกมวางตัวละครนั่งบนหลังเอง ขนาดใหญ่กว่าตัวละครเล็กน้อย

### หมาป่าหิมะ (`mount_wolf`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE riding mount with NO rider. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) standing, (2) walking step with the front-left and back-right legs forward, (3) walking step with the other legs forward. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The mount: a big white snow wolf mount with pale blue shading, a small leather saddle on its back. Drawn slightly larger than a player character, standing on the same baseline. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### ม้าศึกเพลิง (`mount_warhorse`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE riding mount with NO rider. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) standing, (2) walking step with the front-left and back-right legs forward, (3) walking step with the other legs forward. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The mount: a dark armoured warhorse mount with a mane and tail of orange flame, a small saddle on its back. Drawn slightly larger than a player character, standing on the same baseline. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### ราปเตอร์ป่ามรกต (`mount_raptor`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE riding mount with NO rider. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) standing, (2) walking step with the front-left and back-right legs forward, (3) walking step with the other legs forward. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The mount: a green spotted raptor dinosaur mount with sandy belly, a small saddle on its back. Drawn slightly larger than a player character, standing on the same baseline. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on it.
```

### ฮอเวอร์บอร์ดนีออน (`mount_hoverboard`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE riding mount with NO rider. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) standing, (2) walking step with the front-left and back-right legs forward, (3) walking step with the other legs forward. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The mount: a floating sci-fi hoverboard mount, a sleek board with cyan and hot-pink neon underglow, hovering just above the baseline. Drawn slightly larger than a player character, standing on the same baseline. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on it.
```

### เต่ายักษ์ภูเขา (`mount_tortoise`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE riding mount with NO rider. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) standing, (2) walking step with the front-left and back-right legs forward, (3) walking step with the other legs forward. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The mount: a giant mountain tortoise mount with mossy rocks and a tiny tree on its brown shell, a small saddle on top of the shell. Drawn slightly larger than a player character, standing on the same baseline. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on it.
```

## 3. สัตว์เลี้ยง (5 ตัว)

ตัวเล็ก ประมาณครึ่งหนึ่งของตัวละคร เดินหรือลอยตามเจ้าของ

### ลูกสไลม์ (`pet_slime`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE small companion pet. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) idle, (2) hop / bob up, (3) hop / bob down. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The pet: a tiny round glossy light-green slime pet with big cute eyes. About half the height of a player character. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on it.
```

### แมวส้ม (`pet_cat`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE small companion pet. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) idle, (2) hop / bob up, (3) hop / bob down. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The pet: a small fluffy orange tabby cat pet with a cream belly and sleepy cute eyes. About half the height of a player character. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### มังกรน้อย (`pet_dragon`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE small companion pet. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) idle, (2) hop / bob up, (3) hop / bob down. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The pet: a tiny red baby dragon pet with golden belly and small wings, flying. About half the height of a player character. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### บอทลอยฟ้า (`pet_bot`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE small companion pet. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) idle, (2) hop / bob up, (3) hop / bob down. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The pet: a small round floating robot pet, pale steel-blue body with one glowing cyan eye screen and tiny antenna, flying. About half the height of a player character. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### ภูติไฟ (`pet_wisp`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE small companion pet. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) idle, (2) hop / bob up, (3) hop / bob down. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The pet: a small cute fire spirit pet, a round golden-yellow flame with orange tips, two big happy eyes, floating. About half the height of a player character. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

## 4. NPC ช่างแต่งตัว (`stylist`)

ไฟล์ `public/assets/sprites/npc/stylist.png` รูปแบบเดียวกับ NPC อื่น (3 แถว หน้า ข้าง หลัง x 3 เฟรม)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 3 rows x 3 columns of ONE town NPC, a cheerful fashion stylist who runs the cosmetics shop: a slim young person in an elegant violet long coat with a golden sash, short pink hair, holding a folded shimmering cape. Rows from top to bottom: (1) front facing the viewer, (2) side view facing LEFT, (3) back view. Columns: (1) idle, (2) slight bob up, (3) idle. Identical design in every cell, same baseline, nothing touching or overlapping. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on the character.
```

## 5. ไอคอนเมนู "แต่งตัว" (`ico_cosmetics`)

เซฟภาพดิบที่ `art_templates/ui/raw/ico_cosmetics.png` เหมือนไอคอนเมนูอื่น (ตัดพื้นหลังและย่อเป็น 96x96)

```
A single square game menu icon in the same 16-bit SNES pixel style and the same bronze-framed round badge as the other menu icons (bag, map, friends): inside the badge a small golden crown resting on a folded violet cape with a tiny sparkle. Centred, nothing outside the badge. Background ONE perfectly flat solid magenta (#FF00FF), no text, no shadows.
```
