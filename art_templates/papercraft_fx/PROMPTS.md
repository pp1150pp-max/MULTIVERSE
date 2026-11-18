# เอฟเฟกต์สกิล ออร่า กรอบชื่อ/ฟองแชท และลูกแก้วตีบวก แบบกระดาษ: prompt สำหรับเจนใน ChatGPT

เจ้าของสั่งเมื่อ 2026-11-18: ทำกลุ่มนี้ (NPC เสร็จแล้ว) แล้วค่อยทำการ์ดมอน จากนั้นขึ้น online
**เปิดแชทใหม่** ภาพแรกของแชทแนบ `art_templates/papercraft_maps/raw/ref/A7_hub.png` กับ `A1_heroes.png` แล้วขึ้นต้นด้วยประโยค: `The attached images show the papercraft art style of my game. Use EXACTLY this style for everything in this chat.`
ถ้าแชทยาวจนสไตล์เพี้ยน ให้เปิดแชทใหม่แล้วแนบภาพที่ชอบ 1 ภาพไปด้วย

---

## ส่วน A: แผ่นเอฟเฟกต์สกิล 35 แผ่น → `art_templates/papercraft_fx/raw/<ชื่อ>.png`

ทุกแผ่นแนบภาพเดิม `art_templates/papercraft_fx/raw/ref/<ชื่อ>_old.png` แล้วใช้ prompt ตามแบบ (แผ่นเฟรม หรือภาพเดี่ยว) **ใส่สีพื้นหลังตามตาราง**
(`death_crater` เงาหลุมใต้ตัวตอนตาย ใช้ของเดิม)

### prompt แผ่นเฟรม (ตาราง 6 เฟรม)

```
The first attached image is an OLD pixel-art skill-effect animation sheet of my game: a grid where each row is one effect and its 6 frames run left to right. Redraw EVERY frame in the papercraft style: the effect built from layered cut coloured paper, tissue paper and foil with visible fibre and small drop shadows between the layers; glow and energy shown as bright translucent tissue-paper shapes with paper sparkles, not blurry light. Keep the SAME grid: the same rows in the same order, 6 frames in each row, each frame the same shape, size, direction, colours and position as the old frame, so the animation reads the same. Every frame fully separate with clear empty space around it, nothing touching or crossing into the next frame. No characters, no weapons held by anyone, no text, no labels, no numbers, no grid lines. Background ONE perfectly flat <พื้นหลัง> everywhere, no gradient, no shadows on the background, and never use that background colour in the effects.
```

### prompt ภาพเดี่ยว

```
The first attached image is an OLD pixel-art game sprite (a projectile or a small effect). Redraw it in the papercraft style: the SAME object with the same shape, direction and colours, built from layered cut coloured paper with visible fibre and small drop shadows between the layers, glowing parts as bright paper shapes. Centred, filling most of the image. No text. Background ONE perfectly flat <พื้นหลัง>, no shadows on the background, and never use that background colour on the object.
```

| แผ่น | แบบ | พื้นหลัง (ใส่แทน `<พื้นหลัง>`) |
|---|---|---|
| `ap_gs_a` | แผ่นเฟรม 4 แถว | `solid pure bright green (#00FF00)` |
| `ap_mg_a` | แผ่นเฟรม 4 แถว | `solid pure bright green (#00FF00)` |
| `ap_mg_b` | แผ่นเฟรม 4 แถว | `solid cyan (#00FFFF)` |
| `ap_mg_c` | แผ่นเฟรม 4 แถว | `solid cyan (#00FFFF)` |
| `ap_mg_d` | แผ่นเฟรม 4 แถว | `solid pure bright green (#00FF00)` |
| `ap_mg_e` | แผ่นเฟรม 4 แถว | `solid pure bright green (#00FF00)` |
| `ap_sw_a` | แผ่นเฟรม 4 แถว | `solid cyan (#00FFFF)` |
| `ap_sw_b` | แผ่นเฟรม 4 แถว | `solid pure bright green (#00FF00)` |
| `ap_sw_c` | แผ่นเฟรม 4 แถว | `solid cyan (#00FFFF)` |
| `ember_bolt` | ภาพเดี่ยว | `solid cyan (#00FFFF)` |
| `enhance` | แผ่นเฟรม 3 แถว | `solid cyan (#00FFFF)` |
| `gs_gear` | แผ่นเฟรม 6 แถว | `solid magenta (#FF00FF)` |
| `gs_passive` | แผ่นเฟรม 3 แถว | `solid magenta (#FF00FF)` |
| `gs_skill` | แผ่นเฟรม 6 แถว | `solid cyan (#00FFFF)` |
| `gun` | แผ่นเฟรม 4 แถว | `solid pure bright green (#00FF00)` |
| `gun_ult` | แผ่นเฟรม 3 แถว | `solid cyan (#00FFFF)` |
| `ice_shard` | ภาพเดี่ยว | `solid magenta (#FF00FF)` |
| `mage` | แผ่นเฟรม 5 แถว | `solid pure bright green (#00FF00)` |
| `mg_a` | แผ่นเฟรม 6 แถว | `solid magenta (#FF00FF)` |
| `mg_b` | แผ่นเฟรม 6 แถว | `solid cyan (#00FFFF)` |
| `mg_c` | แผ่นเฟรม 6 แถว | `solid pure bright green (#00FF00)` |
| `mg_d` | แผ่นเฟรม 3 แถว | `solid magenta (#FF00FF)` |
| `mg_e` | แผ่นเฟรม 4 แถว | `solid cyan (#00FFFF)` |
| `mg_f` | แผ่นเฟรม 4 แถว | `solid pure bright green (#00FF00)` |
| `mg_g` | แผ่นเฟรม 5 แถว | `solid magenta (#FF00FF)` |
| `snowball` | ภาพเดี่ยว | `solid magenta (#FF00FF)` |
| `sw_blade` | แผ่นเฟรม 4 แถว | `solid cyan (#00FFFF)` |
| `sw_bulwark` | แผ่นเฟรม 4 แถว | `solid cyan (#00FFFF)` |
| `sw_gale` | แผ่นเฟรม 4 แถว | `solid pure bright green (#00FF00)` |
| `sword` | แผ่นเฟรม 4 แถว | `solid cyan (#00FFFF)` |
| `witch_circle` | ภาพเดี่ยว | `solid pure bright green (#00FF00)` |
| `witch_hand` | ภาพเดี่ยว | `solid cyan (#00FFFF)` |
| `witch_pool` | ภาพเดี่ยว | `solid cyan (#00FFFF)` |
| `witch_sigil` | ภาพเดี่ยว | `solid pure bright green (#00FF00)` |
| `witch_vial` | ภาพเดี่ยว | `solid cyan (#00FFFF)` |

---

## ส่วน B: ออร่าและรอยเท้า 5 ชุด → `art_templates/papercraft_fx/raw/<ชื่อ>.png`

ไม่ต้องแนบภาพเดิม (เกมวาดด้วยโค้ด) ก๊อปวางได้เลย

### `aura_star.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image with exactly TWO separate glowing effects side by side with a wide empty gap between them, nothing else. LEFT: a magic aura circle lying flat on the ground under a character, seen from slightly above so it is a wide ellipse about twice as wide as tall, empty in the middle, made of pale golden-white starlight: a ring of tiny twinkling stars and soft light rays. RIGHT, much smaller: ONE single footprint lying flat on the ground, seen from the same angle, a footprint made of tiny pale gold sparkling stars. Both glowing, bright on their own. Background ONE perfectly flat solid pure BLACK (#000000), no ground, no character, no shadows, no text, no labels.
```

### `aura_frost.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image with exactly TWO separate glowing effects side by side with a wide empty gap between them, nothing else. LEFT: a magic aura circle lying flat on the ground under a character, seen from slightly above so it is a wide ellipse about twice as wide as tall, empty in the middle, made of icy blue frost: a ring of ice crystals, snowflake patterns and cold mist. RIGHT, much smaller: ONE single footprint lying flat on the ground, seen from the same angle, a footprint of frost with a tiny snowflake crystal in it. Both glowing, bright on their own. Background ONE perfectly flat solid pure BLACK (#000000), no ground, no character, no shadows, no text, no labels.
```

### `aura_flame.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image with exactly TWO separate glowing effects side by side with a wide empty gap between them, nothing else. LEFT: a magic aura circle lying flat on the ground under a character, seen from slightly above so it is a wide ellipse about twice as wide as tall, empty in the middle, made of orange and gold fire: a ring of small licking flames and embers. RIGHT, much smaller: ONE single footprint lying flat on the ground, seen from the same angle, a glowing ember-red footprint with a few sparks. Both glowing, bright on their own. Background ONE perfectly flat solid pure BLACK (#000000), no ground, no character, no shadows, no text, no labels.
```

### `aura_void.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image with exactly TWO separate glowing effects side by side with a wide empty gap between them, nothing else. LEFT: a magic aura circle lying flat on the ground under a character, seen from slightly above so it is a wide ellipse about twice as wide as tall, empty in the middle, made of violet dimensional energy: a ring of purple arcane runes and swirling void light. RIGHT, much smaller: ONE single footprint lying flat on the ground, seen from the same angle, a glowing violet rune-shaped footprint. Both glowing, bright on their own. Background ONE perfectly flat solid pure BLACK (#000000), no ground, no character, no shadows, no text, no labels.
```

### `aura_leaf.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image with exactly TWO separate glowing effects side by side with a wide empty gap between them, nothing else. LEFT: a magic aura circle lying flat on the ground under a character, seen from slightly above so it is a wide ellipse about twice as wide as tall, empty in the middle, made of fresh green nature magic: a ring of floating leaves, vines and tiny pink blossoms. RIGHT, much smaller: ONE single footprint lying flat on the ground, seen from the same angle, a footprint made of tiny pink and white flowers with a small green leaf. Both glowing, bright on their own. Background ONE perfectly flat solid pure BLACK (#000000), no ground, no character, no shadows, no text, no labels.
```

---

## ส่วน C: กรอบชื่อและฟองแชท 5 ชุด → `art_templates/papercraft_fx/raw/<ชื่อ>.png`

เกมยืดกรอบตามความยาวชื่อ ลายจึงต้องอยู่ที่มุมเท่านั้น ก๊อปวางได้เลย

### `title_traveler.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image of TWO empty UI frames for a player's name and chat, one above the other with a wide empty gap, theme: sky blue and deep navy, sleek sci-fi trim with tiny glowing portal rings. TOP: a name plate frame, a wide horizontal banner about 5 times as wide as tall, a decorated border with ornaments ONLY on the four corners (and at most one small ornament at the middle of the top edge), the straight edges between them plain and even so they can be stretched, the inside one flat solid dark color with NO pattern and NO text. BOTTOM: a chat speech bubble frame about 2 times as wide as tall, rounded, with the same themed border and corner ornaments, a small tail at the bottom center pointing down, the inside one flat solid light color with NO pattern and NO text. Front view, flat, no perspective. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no letters, no labels. Do not use pink, magenta or purple on the frames.
```

### `title_flame.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image of TWO empty UI frames for a player's name and chat, one above the other with a wide empty gap, theme: fiery orange and dark crimson, with small flame curls. TOP: a name plate frame, a wide horizontal banner about 5 times as wide as tall, a decorated border with ornaments ONLY on the four corners (and at most one small ornament at the middle of the top edge), the straight edges between them plain and even so they can be stretched, the inside one flat solid dark color with NO pattern and NO text. BOTTOM: a chat speech bubble frame about 2 times as wide as tall, rounded, with the same themed border and corner ornaments, a small tail at the bottom center pointing down, the inside one flat solid light color with NO pattern and NO text. Front view, flat, no perspective. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no letters, no labels. Do not use pink, magenta or purple on the frames.
```

### `title_shadow.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image of TWO empty UI frames for a player's name and chat, one above the other with a wide empty gap, theme: violet and near-black, with tiny bat wings and a crescent moon. TOP: a name plate frame, a wide horizontal banner about 5 times as wide as tall, a decorated border with ornaments ONLY on the four corners (and at most one small ornament at the middle of the top edge), the straight edges between them plain and even so they can be stretched, the inside one flat solid dark color with NO pattern and NO text. BOTTOM: a chat speech bubble frame about 2 times as wide as tall, rounded, with the same themed border and corner ornaments, a small tail at the bottom center pointing down, the inside one flat solid light color with NO pattern and NO text. Front view, flat, no perspective. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no text, no letters, no labels. Do not use bright green on the frames.
```

### `title_forest.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image of TWO empty UI frames for a player's name and chat, one above the other with a wide empty gap, theme: leaf green and warm brown wood, with small vines and leaves. TOP: a name plate frame, a wide horizontal banner about 5 times as wide as tall, a decorated border with ornaments ONLY on the four corners (and at most one small ornament at the middle of the top edge), the straight edges between them plain and even so they can be stretched, the inside one flat solid dark color with NO pattern and NO text. BOTTOM: a chat speech bubble frame about 2 times as wide as tall, rounded, with the same themed border and corner ornaments, a small tail at the bottom center pointing down, the inside one flat solid light color with NO pattern and NO text. Front view, flat, no perspective. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no letters, no labels. Do not use pink, magenta or purple on the frames.
```

### `title_gold.png`

```
For the same game, in the same papercraft style as the attached images: layered cut coloured paper and card with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers (glowing parts are bright paper shapes), seen from the same 2D isometric camera angle (slightly from above). Generate an image of TWO empty UI frames for a player's name and chat, one above the other with a wide empty gap, theme: polished gold and deep brown, ornate royal filigree with a tiny crown. TOP: a name plate frame, a wide horizontal banner about 5 times as wide as tall, a decorated border with ornaments ONLY on the four corners (and at most one small ornament at the middle of the top edge), the straight edges between them plain and even so they can be stretched, the inside one flat solid dark color with NO pattern and NO text. BOTTOM: a chat speech bubble frame about 2 times as wide as tall, rounded, with the same themed border and corner ornaments, a small tail at the bottom center pointing down, the inside one flat solid light color with NO pattern and NO text. Front view, flat, no perspective. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no letters, no labels. Do not use pink, magenta or purple on the frames.
```

---

## ส่วน D: ลูกแก้วตีบวก → `art_templates/papercraft_fx/raw/orbs.png`

เกมลงสีลูกแก้วเอง (13 สี) จึงต้องเจนเป็น**สีขาวเทาล้วน** มี 4 แถว (ทรงกลม คริสตัล เปลวไฟ ดาว) × 4 คอลัมน์ (ธรรมดา, มีแถบพลังงาน, มีแกนดาว, แกนดาวมีรัศมี)

```
Generate a SQUARE image: a strict grid of 4 rows x 4 columns of small magic orbs that float around a hero, in the papercraft style, made of layered cut paper with visible fibre and small drop shadows between the layers. IMPORTANT: draw them ONLY in white, light grey and mid grey paper, no other colours at all, because the game tints them. Rows top to bottom are 4 shapes: (1) a round sphere, (2) a pointed crystal, (3) a flame-shaped wisp, (4) a five-pointed star. Columns left to right are 4 levels of detail on the SAME shape: (1) plain, (2) with a bright band of energy across it, (3) with a bright star-shaped core inside, (4) the star core plus short rays around the orb. Each orb centred in its cell, the same size in every cell, generous empty space, nothing touching. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no labels, no grid lines.
```

---

## สำหรับผม

- ส่วน A: `node tools/cut_paper_fx.cjs` ตัดทุกแผ่นให้เท่าขนาดเดิม แต่ละเฟรมลงตำแหน่งเดิม แล้วให้ตัวโหลด `fx/` เลือกภาพกระดาษเมื่อเปิดสวิตช์
- ส่วน B, C, D: เกมยังวาดด้วยโค้ดอยู่ ต้องเขียนโค้ดให้ใช้ภาพเหล่านี้ (ผ่านสวิตช์ภาพกระดาษ)
- วงเวทบนพื้น (บัฟ ดีบัฟ สกิลวงกว้าง) วาดด้วยโค้ด ไม่ต้องเจน
