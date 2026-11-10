# Cosmetics: prompt ภาพสำหรับเจนใน ChatGPT

ระบบอยู่ใน `src/shared/data/cosmetics.ts` (ข้อมูล) และ `src/client/cosmeticViews.ts` (วาดในเกม) ตอนนี้ใช้ภาพชั่วคราวที่วาดด้วยโค้ด
สไตล์ 16-bit SNES แบบ 2D isometric ระดับความละเอียดเดียวกับ Gunslinger สร้างในแชทเดียวกัน ถ้าเริ่มแชทใหม่ ให้แนบภาพ Gunslinger ไปเป็นตัวอย่างด้วย

## รูปแบบไฟล์ (ปีก สัตว์ขี่ สัตว์เลี้ยง)

- 1 ภาพต่อ 1 ชิ้น เป็นตาราง **5 แถว x 3 คอลัมน์** เหมือนไฟล์มอนสเตอร์
  - แถว (บนลงล่าง): หน้า, ทแยงหน้า, ข้าง, ทแยงหลัง, หลัง โดยหันไปทาง **ซ้าย** ฝั่งขวาเกมกลับด้านให้เอง จึงหันได้ 8 ทิศ
  - คอลัมน์ (ซ้ายไปขวา): เฟรมแอนิเมชัน 3 เฟรม เกมเล่นวนแบบ 1-2-1-3 (ปีก: พัก-ขึ้น-พัก-ลง · สัตว์ขี่: ยืน-ก้าวซ้าย-ยืน-ก้าวขวา · สัตว์เลี้ยง: ยืน-เด้งขึ้น-ยืน-ลง)
- เซฟภาพดิบที่ `art_templates/cosmetics/raw/<id>.png` (ไม่ได้ commit) แล้วตัดด้วย `PNGJS=<path ของ pngjs> node tools/cut_cosmetics.cjs <โฟลเดอร์ที่มี art_templates/*/raw>`
  ได้ไฟล์ `public/assets/sprites/cosmetics/<id>.png` และท่าขี่ `player/<คลาส>/ride.png`, `ride_board.png` (เพิ่มใน sprite.json ให้เอง)
  ขนาดในเกม ความสูงที่นั่ง และท่าขี่ของสัตว์แต่ละตัว ตั้งที่ `MOUNT_LOOK` ใน `src/client/cosmeticViews.ts`
  ไฟล์ไหนวางแล้ว เกมใช้แทนภาพชั่วคราวเองทันที (ไม่ต้องแก้โค้ด)
- ใช้พื้นหลังสีม่วงแดง #FF00FF ยกเว้นชิ้นที่มีสีม่วง/ชมพู ใช้สีเขียว #00FF00 (ระบุไว้ใน prompt แล้ว) ชิ้นที่มีสีเขียว (ราปเตอร์ เต่า สไลม์) ต้องใช้ม่วงแดงเสมอ
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

แนบภาพราปเตอร์ 4 ขาที่เจนไว้ไปด้วย เพื่อให้หน้าตาเหมือนเดิม (ผู้ใช้ 2026-11-10: ขอเป็น 2 ขา)

```
Edit the attached raptor mount sheet, keeping EXACTLY the same design, colors, saddle and 16-bit SNES pixel style, but make it a BIPEDAL raptor: it stands and walks upright on its TWO strong hind legs only, like a velociraptor, with two small clawed arms held tucked at its chest (the arms never touch the ground), the body leaning slightly forward, the long tail held straight out behind for balance and the saddle on its back between the shoulders and the hips. Keep the same layout: a strict grid of 5 rows x 3 columns. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) standing on both legs, (2) walking step with the LEFT leg forward, (3) walking step with the RIGHT leg forward. Identical size and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

### ฮอเวอร์บอร์ดนีออน (`mount_hoverboard`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE riding mount with NO rider. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) standing, (2) walking step with the front-left and back-right legs forward, (3) walking step with the other legs forward. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The mount: a floating sci-fi hoverboard mount, a sleek board with cyan and hot-pink neon underglow, hovering just above the baseline. Drawn slightly larger than a player character, standing on the same baseline. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on it.
```

### เต่ายักษ์ภูเขา (`mount_tortoise`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE riding mount with NO rider. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) standing, (2) walking step with the front-left and back-right legs forward, (3) walking step with the other legs forward. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The mount: a giant mountain tortoise mount with mossy rocks and a tiny tree on its brown shell, a small saddle on top of the shell. Drawn slightly larger than a player character, standing on the same baseline. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
```

## 3. สัตว์เลี้ยง (5 ตัว)

ตัวเล็ก ประมาณครึ่งหนึ่งของตัวละคร เดินหรือลอยตามเจ้าของ

### ลูกสไลม์ (`pet_slime`)

```
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 5 rows x 3 columns showing ONE small companion pet. Each ROW is one view, from top to bottom: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Each COLUMN is one animation frame, from left to right: (1) idle, (2) hop / bob up, (3) hop / bob down. Identical size, colors and design in every cell, every cell centred on the same baseline, generous empty space, nothing touching or overlapping. The pet: a tiny round glossy light-green slime pet with big cute eyes. About half the height of a player character. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple anywhere on it.
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

## 6. ท่านั่งขี่ของ 3 คลาส (`ride.png`)

ผู้ใช้ 2026-11-10: ตอนขี่สัตว์ให้ตัวละครเล่นท่านั่งขี่แทนท่ายืน/วิ่ง ใช้รูปแบบเดียวกับท่าอื่นของคลาส:
5 แถว (`down` `down_side` `side` `up_side` `up` หันซ้าย ฝั่งขวาเกมกลับด้านให้) × 2 เฟรม ช่องละ 256×256
เจนแยกคลาสละภาพ ในแชทเดียวกับที่สร้างคลาสนั้น และแนบ `public/assets/sprites/player/<คลาส>/idle.png` ไปด้วย
prompt ใส่รายละเอียดหน้าตาตัวละครไว้ครบ เพราะรอบแรก GPT วาดอัศวินผิดตัว (ผมน้ำตาล ผ้าคลุมแดง ดาบตรง) ถ้ายังผิด ให้แนบ concept "Techno Knight" เพิ่มด้วย
เซฟภาพดิบที่ `art_templates/<คลาส>/raw/ride.png` (sword, mage, gunslinger) แล้วบอก Claude ให้ตัดและใส่ลง `sprite.json`
ไม่มีสัตว์ในภาพ เกมวาดสัตว์ขี่ไว้ใต้ตัวเอง สัตว์ขี่ 4 ตัวใช้ท่านี้ร่วมกัน (ฮอเวอร์บอร์ดใช้ท่ายืนในข้อ 7)

### Sword (อัศวิน)

```
Use the attached sprite sheet as the EXACT character reference: the result must be the SAME character, do NOT redesign or recolor anything. Polished 16-bit SNES-era JRPG sprite style matching the attached sheet: chibi proportions about 3 heads tall with a big head and big expressive eyes, clean crisp pixels, rich shading with 3 to 4 tones per material, dark outline. The character: young swordsman knight with messy spiky ASH-BLOND hair (not brown), golden amber eyes, no helmet; dark gunmetal plate armour with gold trim, a few WHITE plates on the shoulders and chest, small mechanical joints at elbows and knees, a small diamond-shaped glowing amber gem on the chest; a long CHARCOAL-GREY cape with gold trim and a slightly tattered hem (NOT red); armoured brown-and-gunmetal boots; ONE curved KATANA with a round brass guard and a glowing amber-orange blade (NOT a straight sword). Generate an image: a RIDING pose sprite sheet, the character SEATED astride an invisible saddle as if riding a mount (there is NO animal and NO saddle in the image), knees bent and legs apart hanging down on both sides of where the mount's body would be, back straight, the glowing amber katana held low in the right hand with the blade pointing down and back, the free hand forward as if holding reins. A strict grid of 5 rows x 2 columns, 10 figures total. Each row is one facing direction, top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the LEFT, row 3 side profile facing LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back view. Each column is one frame: frame 1 seated, frame 2 the same pose bobbed slightly down with the cape and hair lifting a little, as when the mount takes a step. Head and body the same size in every frame. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines.
```

### Mage

```
Use the attached sprite sheet as the EXACT character reference: the result must be the SAME character, do NOT redesign or recolor anything. Polished 16-bit SNES-era JRPG sprite style matching the attached sheet: chibi proportions about 3 heads tall with a big head and big expressive eyes, clean crisp pixels, rich shading with 3 to 4 tones per material, dark outline. The character: young witch mage girl with long straight pale silver hair with a soft lavender tint falling past the waist, a deep purple pointed witch hat with wide brim, bent tip, gold band and a few gold stars, a deep purple robe and short cape with gold trim, gold chest clasp with a small blue gem, brown leather boots, a tall gold staff topped by a large gold ring holding one big glowing blue orb. Generate an image: a RIDING pose sprite sheet, the character SEATED astride an invisible saddle as if riding a mount (there is NO animal and NO saddle in the image), knees bent and legs apart hanging down on both sides of where the mount's body would be, the robe draped over the legs, the gold staff held upright in the right hand, the free hand forward as if holding reins. A strict grid of 5 rows x 2 columns, 10 figures total. Each row is one facing direction, top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the LEFT, row 3 side profile facing LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back view. Each column is one frame: frame 1 seated, frame 2 the same pose bobbed slightly down with the robe and hair lifting a little, as when the mount takes a step. Head and body the same size in every frame. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines.
```

### Gunslinger

```
Use the attached sprite sheet as the EXACT character reference: the result must be the SAME character, do NOT redesign or recolor anything. Polished 16-bit SNES-era JRPG sprite style matching the attached sheet: chibi proportions about 3 heads tall with a big head and big expressive eyes, clean crisp pixels, rich shading with 3 to 4 tones per material, dark outline. The character: young gunslinger with messy spiky silver-white hair, aviator goggles with round glowing blue lenses worn up on the forehead, a long flowing red scarf, a long black leather coat with gold trim and a tattered hem, dark gloves, brown leather boots, one large chunky steampunk pistol of dark metal with brass. Generate an image: a RIDING pose sprite sheet, the character SEATED astride an invisible saddle as if riding a mount (there is NO animal and NO saddle in the image), knees bent and legs apart hanging down on both sides of where the mount's body would be, the coat tails falling over the sides, the pistol resting in the right hand at the hip, the left hand forward as if holding reins. A strict grid of 5 rows x 2 columns, 10 figures total. Each row is one facing direction, top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the LEFT, row 3 side profile facing LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back view. Each column is one frame: frame 1 seated, frame 2 the same pose bobbed slightly down with the scarf and coat tails lifting a little, as when the mount takes a step. Head and body the same size in every frame. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
```

## 7. ท่ายืนบนฮอเวอร์บอร์ดของ 3 คลาส (`ride_board.png`)

ผู้ใช้ 2026-11-10: ฮอเวอร์บอร์ดไม่ใช้ท่านั่งคร่อม ให้ยืนแบบเล่นเซิร์ฟแทน รูปแบบเดียวกับข้อ 6
(5 แถว × 2 เฟรม ช่องละ 256×256 หันซ้าย แนบ `idle.png` ของคลาสนั้น) เซฟที่ `art_templates/<คลาส>/raw/ride_board.png`
ไม่มีบอร์ดในภาพ เกมวาดบอร์ดไว้ใต้เท้าเอง

### Sword (อัศวิน)

```
Use the attached sprite sheet as the EXACT character reference: the result must be the SAME character, do NOT redesign or recolor anything. Polished 16-bit SNES-era JRPG sprite style matching the attached sheet: chibi proportions about 3 heads tall with a big head and big expressive eyes, clean crisp pixels, rich shading with 3 to 4 tones per material, dark outline. The character: young swordsman knight with messy spiky ASH-BLOND hair (not brown), golden amber eyes, no helmet; dark gunmetal plate armour with gold trim, a few WHITE plates on the shoulders and chest, small mechanical joints at elbows and knees, a small diamond-shaped glowing amber gem on the chest; a long CHARCOAL-GREY cape with gold trim and a slightly tattered hem (NOT red); armoured brown-and-gunmetal boots; ONE curved KATANA with a round brass guard and a glowing amber-orange blade (NOT a straight sword). Generate an image: a HOVERBOARD riding pose sprite sheet, the character STANDING on an invisible board like a surfer (there is NO board in the image): feet apart one in front of the other along the direction of travel, knees slightly bent, body turned a little sideways and leaning forward, arms out a little for balance, the glowing amber katana held low in the right hand with the blade pointing back. A strict grid of 5 rows x 2 columns, 10 figures total. Each row is one facing direction (the direction of travel), top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the LEFT, row 3 side profile facing LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back view. Each column is one frame: frame 1 standing, frame 2 the same pose crouched a little lower with the cape and hair lifting a little. Both feet on the same baseline in every frame. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines.
```

### Mage

```
Use the attached sprite sheet as the EXACT character reference: the result must be the SAME character, do NOT redesign or recolor anything. Polished 16-bit SNES-era JRPG sprite style matching the attached sheet: chibi proportions about 3 heads tall with a big head and big expressive eyes, clean crisp pixels, rich shading with 3 to 4 tones per material, dark outline. The character: young witch mage girl with long straight pale silver hair with a soft lavender tint falling past the waist, a deep purple pointed witch hat with wide brim, bent tip, gold band and a few gold stars, a deep purple robe and short cape with gold trim, gold chest clasp with a small blue gem, brown leather boots, a tall gold staff topped by a large gold ring holding one big glowing blue orb. Generate an image: a HOVERBOARD riding pose sprite sheet, the character STANDING on an invisible board like a surfer (there is NO board in the image): feet apart one in front of the other along the direction of travel, knees slightly bent, body turned a little sideways and leaning forward, the robe flowing back, the gold staff held in the right hand, the free arm out for balance. A strict grid of 5 rows x 2 columns, 10 figures total. Each row is one facing direction (the direction of travel), top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the LEFT, row 3 side profile facing LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back view. Each column is one frame: frame 1 standing, frame 2 the same pose crouched a little lower with the robe and hair lifting a little. Both feet on the same baseline in every frame. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines.
```

### Gunslinger

```
Use the attached sprite sheet as the EXACT character reference: the result must be the SAME character, do NOT redesign or recolor anything. Polished 16-bit SNES-era JRPG sprite style matching the attached sheet: chibi proportions about 3 heads tall with a big head and big expressive eyes, clean crisp pixels, rich shading with 3 to 4 tones per material, dark outline. The character: young gunslinger with messy spiky silver-white hair, aviator goggles with round glowing blue lenses worn up on the forehead, a long flowing red scarf, a long black leather coat with gold trim and a tattered hem, dark gloves, brown leather boots, one large chunky steampunk pistol of dark metal with brass. Generate an image: a HOVERBOARD riding pose sprite sheet, the character STANDING on an invisible board like a surfer (there is NO board in the image): feet apart one in front of the other along the direction of travel, knees slightly bent, body turned a little sideways and leaning forward, the coat tails and scarf trailing back, the pistol in the right hand, the left arm out for balance. A strict grid of 5 rows x 2 columns, 10 figures total. Each row is one facing direction (the direction of travel), top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the LEFT, row 3 side profile facing LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back view. Each column is one frame: frame 1 standing, frame 2 the same pose crouched a little lower with the scarf and coat tails lifting a little. Both feet on the same baseline in every frame. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
```

## 8. แก้ภาพที่เจนรอบแรก (2026-11-10)

แนบภาพเดิมจาก `art_templates/cosmetics/raw/` ไปด้วยทุกข้อ แล้วเซฟทับชื่อเดิม

### เปลี่ยนพื้นหลังเป็นม่วงแดง: เต่า (`mount_tortoise`), สไลม์ (`pet_slime`), ราปเตอร์ (`mount_raptor`)

```
Redraw the attached sprite sheet EXACTLY: the same creature, design, colors, size, poses, layout of 5 rows x 3 columns and 16-bit SNES pixel style, every cell in the same place. Change ONLY the background: make it ONE perfectly flat solid magenta (#FF00FF) everywhere, with no green left anywhere around or between the figures. Keep every green part of the creature exactly as it is (moss, leaves, scales, slime). No shadows, no ground, no motion lines, no small effect marks, no text, no labels, no grid lines. Do not use pink, magenta or purple on the creature.
```

### มังกรน้อย (`pet_dragon`): แถวที่ 4 ต้องเห็นด้านหลัง

```
Edit the attached sprite sheet of the baby dragon pet. Keep rows 1, 2, 3 and 5 EXACTLY as they are. Redraw ONLY row 4 (all 3 frames) as a three-quarter BACK view turned toward the LEFT: we see mostly its back, the back of its head and horns, its wings from behind and its tail toward the viewer; its face is turned away and NOT visible (at most a sliver of cheek). Same size, colors, flying pose and baseline as the other rows, frames (1) idle, (2) bob up, (3) bob down. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no motion lines, no text, no labels, no grid lines.
```
