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

→ `coin` `potion_hp` `potion_mp` `bag_common` `bag_uncommon` `bag_rare` `bag_epic` `bag_legendary`
