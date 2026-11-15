# แคชช็อป: prompt สำหรับสร้างภาพใน ChatGPT

มี 3 ภาพ เซฟภาพดิบที่ `art_templates/cashshop/raw/` (โฟลเดอร์นี้ไม่ได้ commit) ตั้งชื่อตามหัวข้อ แล้วบอก AI ให้ตัดเข้าเกม

## 1. ไอคอนคริสตัลมิติ (`crystal.png`)

ใช้แสดงยอดเงินและราคาบนการ์ด ต้องอ่านออกตอนเล็กแค่ 16–20 px ตัดเป็น 96×96 ปลายทาง `public/assets/sprites/ui/crystal.png`

```text
16-bit SNES RPG currency icon, polished pixel art with a limited color palette, crisp dark outline, soft top-left lighting. A single item, centered, filling about 80% of the frame: a faceted hexagonal crystal shard standing upright, violet at the bottom fading to bright cyan at the top, with a thin glowing swirl like a small dimensional rift inside it and two tiny sparkles beside it. Simple, bold silhouette that stays readable at 16 pixels wide. No text, no border, no frame, no coin, no shadow on the ground. Solid flat pure magenta background (#FF00FF) with no gradient, and no magenta or pink anywhere on the crystal. Square image.
```

## 2. ไอคอนเมนู "แคชช็อป" (`ico_cashshop.png`)

ปุ่มกลมแบบเดียวกับไอคอนมุมขวาบนอื่น **แนบ `public/assets/sprites/ui/ico_bag.png` และ `ico_daily.png` เป็นตัวอย่างสไตล์** ตัดเป็น 96×96 (เต็มกรอบเหมือนปุ่มอื่น) ปลายทาง `public/assets/sprites/ui/ico_cashshop.png`

```text
Using the attached round HUD buttons as the exact style, size and colour reference, generate ONE matching round HUD menu button for an isometric action RPG, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. Same round badge as the references: a black forged iron rim and a thin tarnished aged-bronze inner ring around a dark recessed face, with one simple, bold, readable icon in the centre. Icon: a small merchant's shopping bag with a gold clasp, with a faceted violet-to-cyan crystal shard sticking out of its top and a tiny sparkle beside it (premium crystal shop). Icons use warm muted colours with clear dark outlines, and must stay readable at 40 pixels wide. The badge is centred in a square image with wide empty space around it, nothing touching the edges. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No letters, no numbers, no readable words, no logos. Do not use pink or magenta in the button.
```

## 3. NPC พ่อค้าคริสตัล (`crystal_merchant.png`)

รูปแบบเดียวกับ NPC อื่น (3 แถว หน้า ข้าง หลัง × 3 เฟรม) **แนบภาพ NPC เดิม เช่น `public/assets/sprites/npc/stylist.png` เป็นตัวอย่างสไตล์** ปลายทาง `public/assets/sprites/npc/crystal_merchant.png`

```text
For the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the attached NPC: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions, same 2D isometric camera angle (seen from slightly above). Generate an image: a strict grid of 3 rows x 3 columns of ONE town NPC, a mysterious crystal merchant who runs the premium shop: a calm traveller in a deep navy hooded robe with silver trim and a cyan-glowing belt pouch, wearing round gold spectacles, holding a small floating violet-to-cyan crystal shard above one open palm, a few tiny crystal shards hanging from the belt. Rows from top to bottom: (1) front facing the viewer, (2) side view facing LEFT, (3) back view. Columns: (1) idle, (2) slight bob up with the floating crystal a little higher, (3) idle. Identical design in every cell, same baseline, nothing touching or overlapping. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on the character.
```
