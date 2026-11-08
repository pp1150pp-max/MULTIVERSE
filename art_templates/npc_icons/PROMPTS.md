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

### สกิลใหม่ของ Gunslinger (Rapid Fire และ Headshot)

Q เปลี่ยนจาก Spread Shot เป็น Rapid Fire และ R เปลี่ยนจาก Bullet Rain เป็น Headshot ส่วน E ยังใช้ `skill_pierce` เดิม
(ภาพกระสุนเจาะแผ่นเกราะตรงกับ Armor-Piercing Round อยู่แล้ว) ถ้าเริ่มแชทใหม่ ให้แนบ `skill_pierce.png` กับ `skill_shot.png` เป็นตัวอย่าง

```
Two more RPG skill icons for the same set, in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the attached
icons: crisp pixels, rich shading, no blur. One row of 2 icons side by side. Each icon is a perfect square of the same
size, with a dark painted background in a muted colour that suits it, a thin bronze-gold bevelled border, and one big
bold clear symbol that reads instantly at very small size. Icon 1, Rapid Fire: a chunky steampunk pistol of dark metal
with brass, seen from the side and pointing right, with a burst of bright yellow-orange muzzle flash and a straight line
of several golden bullets streaming out of the barrel one after another, small brass shell casings flying out above the
gun, warm dark-brown background. Icon 2, Headshot: a bold red sniper crosshair (circle with four ticks and a center dot)
over the dark silhouette of a monster head seen from the front, a single bright bullet impact spark exactly in the center
of the crosshair, deep dark-red background. Gaps between and around the icons are ONE perfectly flat solid magenta
(#FF00FF). No text.
```

เซฟภาพที่ได้ไว้ที่ `art_templates/npc_icons/skill_gunslinger_v2.png`

→ `skill_rapidfire` `skill_headshot`

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

## ผู้ดูแลคลังและนายหน้าตลาด

สร้างในแชทเดิมที่มีภาพ Gunslinger หรือแนบภาพ Gunslinger และ `npc/merchant.png` ไปเป็นตัวอย่าง เจนทีละภาพ
เซฟไฟล์ดิบไว้ที่ `art_templates/market/raw/` ตามชื่อไฟล์ในแต่ละข้อ แล้วตัดด้วย `tools/cut_npc.cjs`
(ภาพแผงตลาดอยู่ใน `art_templates/market/PROMPTS.md`) ถ้าไม่มีไฟล์ภาพ เกมจะใช้ภาพที่วาดด้วยโค้ด (`drawKeeper` `drawBroker` ใน `src/client/placeholder.ts`)

### 1. ผู้ดูแลคลัง → `raw/keeper.png` → `npc/keeper.png`

```
Now one more NPC for the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger
and the merchant: same chibi proportions about 3 heads tall, same face construction, dark outline, rich shading with
3 to 4 tones per material, small crisp pixels, no chunky pixels. Generate an image: ONE row of 3 views of the SAME
character from left to right: (1) front view facing the viewer, (2) side view facing LEFT, (3) back view. Identical
size, colors and design across the 3 views, boots on the same baseline, generous empty space, nothing touching or
overlapping. The Warehouse Keeper: a calm kind elderly man with short white hair and a short white beard, small round
spectacles, a long dark navy-blue coat with brass buttons, a brown leather belt with a big iron ring of keys hanging
from it, brown boots, standing calmly and holding one large old iron key in one hand at his side. Background ONE
perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink,
magenta or purple on the character.
```

### 2. นายหน้าตลาด → `raw/broker.png` → `npc/broker.png`

```
Now one more NPC for the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger
and the merchant: same chibi proportions about 3 heads tall, same face construction, dark outline, rich shading with
3 to 4 tones per material, small crisp pixels, no chunky pixels. Generate an image: ONE row of 3 views of the SAME
character from left to right: (1) front view facing the viewer, (2) side view facing LEFT, (3) back view. Identical
size, colors and design across the 3 views, boots on the same baseline, generous empty space, nothing touching or
overlapping. The Market Broker who sells other adventurers' goods: a slim sharp-eyed slightly sly middle-aged trader
with neat black hair slicked back and tied at the nape, a thin curled mustache, a small round monocle on one eye, a long
charcoal-black coat with gold trim and gold buttons over a mustard-yellow waistcoat, a cream scarf, dark trousers and
brown boots, holding an open ledger book in one hand and a white quill pen in the other, a bunch of small brass price
tags hanging from the belt. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no
labels, no grid lines. Do not use pink, magenta or purple on the character.
```

### 3. ไอคอน 4 ช่อง → `raw/icons.png` → `icons/npc_stash.png` `icons/npc_market.png` `icons/map_keeper.png` `icons/map_market.png`

```
Now 4 small icons for the same game, in the EXACT same 16-bit SNES-era pixel-art style as the game art above: crisp
pixels, rich shading, no blur. Generate an image: a strict grid of 2 columns x 2 rows, one icon centred in each cell,
generous empty space, nothing touching or overlapping. Top row are two NPC BADGE icons matching the skill icons: each a
perfect square of the same size with a dark painted background in a muted colour, a thin bronze-gold bevelled border,
and one big bold clear symbol: (1) a wooden chest bound with iron bands, locked with a gold padlock; (2) an open ledger
book with a gold coin and a small brass price tag lying on it. Bottom row are two MAP MARKER icons: bright saturated
colours, a thick solid dark outline, very simple bold silhouettes that read at only 20 pixels wide, NO frame and NO
background: (3) a wooden chest bound with iron bands; (4) a gold coin in front of a hanging brass price tag. Background
ONE perfectly flat solid magenta (#FF00FF), no text, no letters, no labels, no grid lines. Do not use pink, magenta or
purple in the icons.
```

ลำดับช่อง: `npc_stash` `npc_market` / `map_keeper` `map_market`
