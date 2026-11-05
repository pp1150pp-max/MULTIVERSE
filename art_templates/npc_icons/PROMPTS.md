# NPC และไอคอน: prompt ที่ใช้สร้างภาพใน ChatGPT

สไตล์ 16-bit SNES ระดับความละเอียดเดียวกับ Gunslinger สร้างในแชทเดียวกัน ถ้าเริ่มแชทใหม่ ให้แนบภาพ Gunslinger ไปเป็นตัวอย่างด้วย

- NPC: `public/assets/sprites/npc/` ชีต 3×3 แถวละมุมมอง ตัดให้ตัวสูงประมาณ 200px เฟรมเกิดจากการบีบและยืดภาพเดียวกัน
- ไอคอน: `public/assets/sprites/icons/` ช่องละ 64×64 เกมวาดเป็นสี่เหลี่ยมจัตุรัส จึงต้องเติมขอบให้เป็นจัตุรัส
- ถุงทั้ง 5 ระดับใช้ภาพถุงสีเทาภาพเดียว แล้วย้อมสีตาม `RARITY_COLOR` ใน `src/shared/types.ts` ระดับ common ไม่ย้อม

## 1. NPC

```
Now three NPC characters for the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the
gunslinger and this mage: same chibi proportions about 3 heads tall, same face construction, dark outline, rich shading
with 3 to 4 tones per material, small crisp pixels, no chunky pixels. Generate an image: a sheet as a strict grid of 3
rows x 3 columns, one character per row, each row the SAME character standing in 3 views from left to right: (1) front
view facing the viewer, (2) side view facing LEFT, (3) back view. Identical size, colors and design across the 3 views,
boots on the same baseline, generous empty space, nothing touching or overlapping. Row 1, The Seeker: a mysterious guide
in a long hooded cream-white robe with gold trim at the hem, the face hidden in the dark shadow of the hood with two
small glowing golden eyes, holding a wooden pole with a small glowing golden-white lantern hanging from it. Row 2, the
Merchant: a plump friendly trader with a round cheerful face, short brown mustache, green coat with a tan belt, a golden
coin pouch on the belt, brown trousers and boots, carrying a very large brown leather backpack piled with rolled goods,
visible from all views, with brown shoulder straps at the front. Row 3, the Blacksmith: a broad muscular smith with a
big orange-red beard, short dark-brown hair, bare strong forearms, grey shirt, thick brown leather apron, dark boots,
holding one large iron forge hammer low in the right hand. Background ONE perfectly flat solid magenta (#FF00FF), no
shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on the characters.
```

→ `seeker` `merchant` `blacksmith`

## 2. ไอคอน

```
Now small item icons for the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG pixel-art style, dark outline,
rich shading, crisp pixels, simple bold readable shapes because they will be shown very small on the ground. Generate an
image: exactly 4 separate objects in a 2 columns x 2 rows grid, each object about the same size, square-ish proportions,
fully inside its own cell with generous empty space, nothing touching or overlapping. Row 1: (1) one shiny round gold
coin seen at a slight angle with a simple star emblem; (2) one round glass potion bottle with a cork, filled with bright
red liquid and a white highlight. Row 2: (3) one identical round glass potion bottle with a cork, filled with bright blue
liquid and a white highlight; (4) one small plump tied loot sack made entirely of plain neutral grey cloth with a darker
grey tie at the neck, the whole sack only in shades of grey with no other color. Background ONE perfectly flat solid
magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on any
object.
```

→ `coin` `potion_hp` `potion_mp` (ถุงเลิกใช้แล้ว ของที่ตกแสดงเป็นรูปไอเทมชิ้นนั้น)

## ไอคอนสกิลและ NPC

ตัดจากแผ่นเดียวเป็น `public/assets/sprites/icons/skill_<skill id>.png` และ `npc_talk` `npc_shop` `npc_forge` ขนาด 128×128 เกมแสดงผ่าน `src/client/icons.ts`

```
A set of 16 RPG skill icons in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the game art above: crisp
pixels, rich shading, no blur. Strict grid of 4 columns x 4 rows. Every icon is a perfect square of the same size, with a
dark painted background in a muted colour that suits it, a thin bronze-gold bevelled border, and one big bold clear symbol
that reads instantly at very small size. Gaps between icons are ONE perfectly flat solid magenta (#FF00FF). No text.
```

เรียงตามแถว: Slash, Whirlwind, Charge, Earthquake / Arcane Bolt, Fireball, Frost Nova, Meteor / Quick Shot, Spread Shot, Piercing Round, Bullet Rain / Dash, คุย, ร้านค้า, ตีบวก

## ไอคอนไอเทม

ไฟล์ `public/assets/sprites/icons/item_<baseId>.png` ขนาด 96×96 พื้นหลังโปร่งใส อาวุธและเกราะมีคลาสต่อท้าย เช่น `item_weapon_1_mage`
เมื่อเพิ่มไอเทมใหม่ใน `BASES` (`src/shared/data/items.ts`) ต้องเพิ่มรูปให้ครบทุกคลาสด้วย

```
A set of RPG inventory item icons in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the game art above:
crisp pixels, rich shading, soft dark outline, no blur. Strict invisible grid, one item centred in each cell, filling most
of the cell but nothing touching cell borders. Big and clear so each reads at very small size. No frame, no icon
background, no ground, no shadow. Background ONE perfectly flat solid magenta (#FF00FF), no text, no labels, no grid
lines. Do not use pink, magenta or purple in the items.
```

- อาวุธ (5×3): แถวดาบ คทา ปืน เรียงคอลัมน์ตาม `weapon_1` ถึง `weapon_5`
- ชุดและอื่น ๆ (6×3): `tunic` `leather` `scale` ของ sword และ mage / ของ gunslinger กับ `cap` `helm` `hood` / `sandals` `boots` `waders` `ring_copper` `ring_jade` `ring_wisp`

## ไอคอนแผนที่

ตัดเป็น `public/assets/sprites/icons/map_<ชื่อ>.png` ขนาด 96×96 รายชื่ออยู่ใน `src/client/mapIconNames.ts` ภาพพื้นของแผนที่สร้างจากพื้นจริงตอนเข้าแมพ ดู `bakeMap` ใน `src/client/world.ts`

```
12 small game MAP MARKER icons in the EXACT same 16-bit SNES-era pixel-art style as the game art above: crisp pixels,
bright saturated colours, a thick solid dark outline, very simple bold silhouettes that read instantly at only 20 pixels
wide. Strict invisible grid of 4 columns x 3 rows, one icon centred in each cell. No frame, no icon background. Background
ONE perfectly flat solid magenta (#FF00FF), no text, no grid lines. Do not use pink or magenta in the icons.
```

เรียงตามแถว: ลูกศรทอง, ลูกศรฟ้า, เต็นท์, ถุงเงิน / ค้อน, ฟองคำพูด, วงวาร์ปม่วง, หัวกะโหลกมงกุฎ / ธงแดง, รอยเท้า (ไม่ได้ใช้), ดาบไขว้, หีบ (ไม่ได้ใช้)
