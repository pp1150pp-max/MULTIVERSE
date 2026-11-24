# การ์ดมอนสเตอร์ papercraft: prompt เต็ม ก๊อปวางได้ทันที (49 ภาพ)

สร้างจาก [PROMPTS.md](PROMPTS.md) (ฉบับแก้ล่าสุด) · เจ้าของสั่ง 2026-11-24 · **ทุกบล็อกประกอบเสร็จแล้ว ก๊อปทั้งบล็อกไปวางได้เลย**

## ที่วางภาพ
- วางไฟล์ใน `art_templates/papercraft_cards/raw/` ตั้งชื่อตามหัวข้อของแต่ละข้อ (`raw/` ไม่ commit)

## วิธีเจน
- เปิดแชทใหม่ 1 แชทต่อกลุ่ม (กรอบ 3 = 1 แชท · มอนแต่ละแมพ = 1 แชท)
- **ภาพแรกของทุกแชทแนบต้นแบบสไตล์:** `art_templates/papercraft_maps/raw/ref/A1_heroes.png` (ห้ามแนบภาพพิกเซล)
- **ภาพมอน: แนบ sprite กระดาษของมอนตัวนั้นด้วย** จาก `public/assets/sprites/paper/monsters/<id>.png` (กัปตันขาไม้ = `peg_captain.png` · ปูยักษ์ไม่มีไฟล์ ให้แนบภาพแมพ 1 แทน)
- ถ้าได้ภาพพิกเซล: `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- ถ้าได้พื้นเรียบ: `The background must be a full detailed papercraft scene, not a flat colour.`

---

## 1. กรอบการ์ด 3 ระดับ

### 1.1 หายาก → `card_frame_rare.png`

```text
The attached image shows the papercraft art style of my game. Use EXACTLY this style: a handmade papercraft look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between the paper layers, warm soft light from the upper left. NOT pixel art, no pixels, no 16-bit look.
Generate an image: a trading card FRAME only, portrait 2:3, the frame fills the whole image edge to edge, perfectly symmetrical left and right. Layout from top to bottom: a small blank paper plate at the top centre, a large rectangular window taking about 65% of the height for the artwork, a wide blank paper nameplate under the window, and a slimmer strip at the bottom for stats. A small round cut-out hole at the top left corner for a group symbol. The artwork window, the nameplate face, the stats strip and the inside of the round hole are filled with ONE perfectly flat solid magenta (#FF00FF) with no gradient and no shadow. No text, no letters, no numbers, no monster, no character. Do not use pink, magenta or purple on the frame itself except the flat magenta windows (for the epic frame use a deep violet that is clearly darker and bluer than the magenta).
Frame:
a frame of layered dark navy-blue and cream card with a thin pale-blue paper trim, four small round blue paper gems in the corners, and one small paper-cut star on the top plate; only slightly more detailed than a plain frame, still the simplest of the three
```

### 1.2 มหากาพย์ → `card_frame_epic.png`

```text
The attached image shows the papercraft art style of my game. Use EXACTLY this style: a handmade papercraft look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between the paper layers, warm soft light from the upper left. NOT pixel art, no pixels, no 16-bit look.
Generate an image: a trading card FRAME only, portrait 2:3, the frame fills the whole image edge to edge, perfectly symmetrical left and right. Layout from top to bottom: a small blank paper plate at the top centre, a large rectangular window taking about 65% of the height for the artwork, a wide blank paper nameplate under the window, and a slimmer strip at the bottom for stats. A small round cut-out hole at the top left corner for a group symbol. The artwork window, the nameplate face, the stats strip and the inside of the round hole are filled with ONE perfectly flat solid magenta (#FF00FF) with no gradient and no shadow. No text, no letters, no numbers, no monster, no character. Do not use pink, magenta or purple on the frame itself except the flat magenta windows (for the epic frame use a deep violet that is clearly darker and bluer than the magenta).
Frame:
the same frame layout in layered deep violet and cream card with paper-cut vine curls along the sides, small violet paper gems at the corners and the top plate
```

### 1.3 ตำนาน → `card_frame_legendary.png`

```text
The attached image shows the papercraft art style of my game. Use EXACTLY this style: a handmade papercraft look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between the paper layers, warm soft light from the upper left. NOT pixel art, no pixels, no 16-bit look.
Generate an image: a trading card FRAME only, portrait 2:3, the frame fills the whole image edge to edge, perfectly symmetrical left and right. Layout from top to bottom: a small blank paper plate at the top centre, a large rectangular window taking about 65% of the height for the artwork, a wide blank paper nameplate under the window, and a slimmer strip at the bottom for stats. A small round cut-out hole at the top left corner for a group symbol. The artwork window, the nameplate face, the stats strip and the inside of the round hole are filled with ONE perfectly flat solid magenta (#FF00FF) with no gradient and no shadow. No text, no letters, no numbers, no monster, no character. Do not use pink, magenta or purple on the frame itself except the flat magenta windows (for the epic frame use a deep violet that is clearly darker and bluer than the magenta).
Frame:
the same frame layout, the richest of the three: layered deep amber-orange, dark brown and gold-foil paper, thick paper-cut filigree and small spiky ornaments, a few small gold paper stars, amber paper gems at the corners and the top plate
```

---

## 2. ตัวมอนกลางการ์ด

### 2.1 ชั้น 1 · แมพ 1 Floor 1 Map 1 Emerald Forest

#### สไลม์เขียว → `card_art_green_slime.png` (แนบ `paper/monsters/green_slime.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Green Slime, a round glossy translucent green slime blob with simple cute eyes, bouncing high with a splash of slime droplets
Background: a sunny emerald forest on a floating island in space, green trees, grass and soft golden light, filled to every edge of the image.
```

#### กระต่ายป่า → `card_art_wild_rabbit.png` (แนบ `paper/monsters/wild_rabbit.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Wild Rabbit, a small tan and cream rabbit with long ears and a white puff tail, leaping, with a few paper gold coins flying around it
Background: a sunny emerald forest on a floating island in space, green trees, grass and soft golden light, filled to every edge of the image.
```

#### จิ้งจอกป่า → `card_art_forest_fox.png` (แนบ `paper/monsters/forest_fox.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Forest Fox, a slim orange fox with white chest and a bushy white-tipped tail, pouncing forward with a sharp claw-swipe trail
Background: a sunny emerald forest on a floating island in space, green trees, grass and soft golden light, filled to every edge of the image.
```

#### หมูป่า → `card_art_wild_boar.png` (แนบ `paper/monsters/wild_boar.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Wild Boar, a stocky dark-brown boar with a bristly mane and two small white tusks, charging head-first with paper dirt flying
Background: a sunny emerald forest on a floating island in space, green trees, grass and soft golden light, filled to every edge of the image.
```

#### หมาป่า → `card_art_forest_wolf.png` (แนบ `paper/monsters/forest_wolf.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Forest Wolf, a lean grey wolf with pale chest and bushy tail, howling with head raised, faint red claw marks in the air
Background: a sunny emerald forest on a floating island in space, green trees, grass and soft golden light, filled to every edge of the image.
```

#### หมี (Mini Boss) → `card_art_forest_bear.png` (แนบ `paper/monsters/forest_bear.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Forest Bear, a big heavy brown bear with a lighter muzzle, rearing up on its hind legs and roaring, huge and powerful
Background: a sunny emerald forest on a floating island in space, green trees, grass and soft golden light, filled to every edge of the image.
```

### 2.2 ชั้น 1 · แมพ 2 Floor 1 Map 2 Misty Marsh

#### คางคกหนอง → `card_art_bog_toad.png` (แนบ `paper/monsters/bog_toad.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Bog Toad, a chubby round olive-brown toad with a few small warts, cream belly and a wide silly smile, sitting proudly with a few small healing bubbles rising
Background: a misty swamp with reeds, murky water and a soft green glow, filled to every edge of the image.
```

#### ปลิงหนอง → `card_art_marsh_leech.png` (แนบ `paper/monsters/marsh_leech.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Marsh Leech, a plump dark-purple worm rearing up in an S curve, its round sucker mouth wide open with many small pointed teeth, a small red glow of drained life flowing into its mouth
Background: a misty swamp with reeds, murky water and a soft green glow, filled to every edge of the image.
```

#### งูหนองน้ำ → `card_art_swamp_serpent.png` (แนบ `paper/monsters/swamp_serpent.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Swamp Serpent, a small teal-blue water snake with cream-yellow belly, striking forward with a sharp paper splash
Background: a misty swamp with reeds, murky water and a soft green glow, filled to every edge of the image.
```

#### ผีโคลน → `card_art_mire_ghoul.png` (แนบ `paper/monsters/mire_ghoul.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Mire Ghoul, rising up with mud dripping off its arms, standing firm like a wall
Background: a misty swamp with reeds, murky water and a soft green glow, filled to every edge of the image.
```

#### ผีไต้ไฟ → `card_art_will_o_wisp.png` (แนบ `paper/monsters/will_o_wisp.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Will-o'-Wisp, floating with swirling pale-green spirit flames around it
Background: a misty swamp with reeds, murky water and a soft green glow, filled to every edge of the image.
```

#### แม่มดหนอง (Boss) → `card_art_bog_witch.png` (แนบ `paper/monsters/bog_witch.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Bog Witch, casting a big spell with a glowing swamp-green orb, poison vials and a paper magic circle around her, the most dramatic and powerful pose
Background: a misty swamp with reeds, murky water and a soft green glow, filled to every edge of the image.
```

### 2.3 ชั้น 1 · แมพ 3 Floor 1 Map 3 Snowland

#### เพนกวินหิมะ → `card_art_frost_penguin.png` (แนบ `paper/monsters/frost_penguin.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Frost Penguin, a small round penguin with a dark slate-blue back, cream belly and orange beak, sliding belly-first
Background: a snowfield with a frozen lake and aurora lights in the sky, filled to every edge of the image.
```

#### แมวน้ำเขี้ยวยาว → `card_art_tusk_seal.png` (แนบ `paper/monsters/tusk_seal.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Tusk Seal, a chubby heavy grey seal with two long ivory tusks and small flippers, bracing like an unmovable rock
Background: a snowfield with a frozen lake and aurora lights in the sky, filled to every edge of the image.
```

#### นกฮูกหิมะ → `card_art_snow_owl.png` (แนบ `paper/monsters/snow_owl.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Snow Owl, a fluffy white owl with pale blue wing tips and golden eyes, wings spread wide in flight, paper snowflakes trailing behind
Background: a snowfield with a frozen lake and aurora lights in the sky, filled to every edge of the image.
```

#### ภูตหิมะ → `card_art_snow_sprite.png` (แนบ `paper/monsters/snow_sprite.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Snow Sprite, a small floating spirit of packed snow and pale cyan ice with a small icy crown, casting a glowing ice shard
Background: a snowfield with a frozen lake and aurora lights in the sky, filled to every edge of the image.
```

#### ภูตหิมะหมัดน้ำแข็ง → `card_art_snow_brawler.png` (แนบ `paper/monsters/snow_brawler.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Snow Brawler, a floating round snow spirit with a determined frown, a jagged crown of darker blue ice and two BIG fists encased in chunky blue ice, throwing a punch that cracks the air
Background: a snowfield with a frozen lake and aurora lights in the sky, filled to every edge of the image.
```

#### หมีขั้วโลก → `card_art_polar_bear.png` (แนบ `paper/monsters/polar_bear.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Polar Bear, a big sturdy polar bear with thick white fur, old healed scars, jagged blue ice chunks on its back and forelegs, standing tall
Background: a snowfield with a frozen lake and aurora lights in the sky, filled to every edge of the image.
```

#### เยติ (Boss) → `card_art_yeti.png` (แนบ `paper/monsters/yeti.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Yeti, a huge powerful yeti with shaggy white fur, pale blue face, two short dark horns, enormous fists and jagged blue ice crystals on its shoulders, slamming the ground, the most dramatic and powerful pose
Background: a snowfield with a frozen lake and aurora lights in the sky, filled to every edge of the image.
```

### 2.4 ชั้น 1 · แมพ 4 Floor 1 Map 4 Volcano Island

#### ลูกไฟจิ๋ว → `card_art_ember_wisp.png` (แนบ `paper/monsters/ember_wisp.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ember Wisp, a tiny round floating ball of fire with orange body and yellow core and a small flame on top, with sparkling paper embers and a few gold coins
Background: a volcanic island with lava glow and black basalt rocks, filled to every edge of the image.
```

#### ซาลาแมนเดอร์ → `card_art_salamander.png` (แนบ `paper/monsters/salamander.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Salamander, a chubby low lizard with dark red-orange skin, pale yellow belly and glowing ember spots along its back, basking happily
Background: a volcanic island with lava glow and black basalt rocks, filled to every edge of the image.
```

#### ค้างคาวลาวา → `card_art_lava_bat.png` (แนบ `paper/monsters/lava_bat.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Lava Bat, a round little bat with charcoal fur, big ears and wide wings with glowing orange veins, diving down at the viewer
Background: a volcanic island with lava glow and black basalt rocks, filled to every edge of the image.
```

#### โกเลมแมกมา → `card_art_magma_golem.png` (แนบ `paper/monsters/magma_golem.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Magma Golem, a big stocky golem of dark basalt blocks with glowing orange magma in the cracks, thick round arms, small kind glowing eyes, guarding like a fortress
Background: a volcanic island with lava glow and black basalt rocks, filled to every edge of the image.
```

#### จอมเวทเถ้าถ่าน → `card_art_ash_mage.png` (แนบ `paper/monsters/ash_mage.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ash Mage, a small hooded mage in a soot-grey robe with ember-coloured trim, raising a charred staff and casting a swirling ember spell
Background: a volcanic island with lava glow and black basalt rocks, filled to every edge of the image.
```

#### อัศวินเถ้าถ่าน → `card_art_ash_knight.png` (แนบ `paper/monsters/ash_knight.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ash Knight, a small round knight in dark soot-black armour with ember-coloured seams, lunging forward with a short black sword that glows at the edge
Background: a volcanic island with lava glow and black basalt rocks, filled to every edge of the image.
```

#### หัวใจภูเขาไฟ (Boss) → `card_art_volcano_heart.png` (แนบ `paper/monsters/volcano_heart.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Volcano Heart, a huge living heart of molten rock on a small mound of black basalt, bright orange and yellow magma glowing through wide cracks, flames and embers erupting from its top, the most dramatic and powerful pose
Background: a volcanic island with lava glow and black basalt rocks, filled to every edge of the image.
```

### 2.5 ชั้น 2 · แมพ 1 Floor 2 Map 1 Shipwreck Beach

#### ปูเสฉวน → `card_art_hermit_crab.png` (แนบ `paper/monsters/hermit_crab.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Hermit Crab, pulling into its spiral shell with only the claws and eyes showing, the shell looking tough, ready to counter-strike
Background: a sandy beach with shipwreck debris under a sky of cloud sea, filled to every edge of the image.
```

#### นกนางนวลขโมย → `card_art_thief_gull.png` (แนบ `paper/monsters/thief_gull.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Thief Gull, a seagull swooping down with a small bag of paper gold coins in its beak, mischievous eyes, wings wide
Background: a sandy beach with shipwreck debris under a sky of cloud sea, filled to every edge of the image.
```

#### ปลาไหลไฟฟ้า → `card_art_shock_eel.png` (แนบ `paper/monsters/shock_eel.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Shock Eel, a long eel curled in an S with crackling paper lightning bolts arcing from its body in several directions
Background: a sandy beach with shipwreck debris under a sky of cloud sea, filled to every edge of the image.
```

#### เต่าหลังหนาม → `card_art_spike_turtle.png` (แนบ `paper/monsters/spike_turtle.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Spike Turtle, a sturdy turtle with a shell covered in sharp thorns, planted firmly and snapping, with a faint glint on the spikes
Background: a sandy beach with shipwreck debris under a sky of cloud sea, filled to every edge of the image.
```

#### ปูยักษ์กระดองปืนใหญ่ (Boss) → `card_art_cannon_crab.png` (แนบ `paper/monsters/cannon_crab.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Giant Cannon Crab, a huge crab with big claws and a ship's cannon built into its shell, raised claws and the cannon firing a smoky shot, the most dramatic and powerful pose
Background: a sandy beach with shipwreck debris under a sky of cloud sea, filled to every edge of the image.
```

### 2.6 ชั้น 2 · แมพ 2 Floor 2 Map 2 Smugglers' Cove

#### นักโทษในเรือ → `card_art_prisoner.png` (แนบ `paper/monsters/prisoner.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ship Prisoner in a striped bandana with an iron ball chained to his leg, swinging the heavy iron ball overhead to throw it
Background: a smugglers cove with cliffs, a pirate ship and powder kegs, filled to every edge of the image.
```

#### โจรสลัดดาบโค้ง → `card_art_cutlass_pirate.png` (แนบ `paper/monsters/cutlass_pirate.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Cutlass Pirate, slashing a curved cutlass in a wide arc with a paper slash trail, a grin on his face
Background: a smugglers cove with cliffs, a pirate ship and powder kegs, filled to every edge of the image.
```

#### มือปืนลูกซอง → `card_art_shotgunner.png` (แนบ `paper/monsters/shotgunner.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Blunderbuss Pirate, firing a big flared blunderbuss with a fan of paper pellets and smoke spreading out in front
Background: a smugglers cove with cliffs, a pirate ship and powder kegs, filled to every edge of the image.
```

#### นักโทษถังดินปืน → `card_art_keg_prisoner.png` (แนบ `paper/monsters/keg_prisoner.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Powder-Keg Prisoner, hugging a small powder keg with a lit fuse, about to throw it, a faint warning glow around the keg
Background: a smugglers cove with cliffs, a pirate ship and powder kegs, filled to every edge of the image.
```

#### กัปตันขาไม้ (Boss) → `card_art_pegleg_captain.png` (แนบ `paper/monsters/peg_captain.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Peg-Leg Captain, striking a commanding pose with his cutlass raised and a big ship's anchor on a chain in the other hand, the parrot on his shoulder, the most dramatic and powerful pose
Background: a smugglers cove with cliffs, a pirate ship and powder kegs, filled to every edge of the image.
```

### 2.7 ชั้น 2 · แมพ 3 Floor 2 Map 3 Ghost Ship Graveyard

> มอนทุกตัวในแมพนี้เป็นผี โปร่งแสง เขียวอมฟ้า

#### ลิงกะลาสีผี → `card_art_ghost_monkey.png` (แนบ `paper/monsters/ghost_monkey.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ghost Monkey Sailor, a translucent teal-green ghost monkey in a tattered sailor shirt, throwing a glowing ghost skull
Background: a graveyard of ruined ghost ships in teal-green mist, filled to every edge of the image.
```

#### กะลาสีผี → `card_art_ghost_sailor.png` (แนบ `paper/monsters/ghost_sailor.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ghost Sailor, a translucent pale-teal ghost sailor fading in and out, lunging with a rusty hook
Background: a graveyard of ruined ghost ships in teal-green mist, filled to every edge of the image.
```

#### ไซเรนผี → `card_art_ghost_siren.png` (แนบ `paper/monsters/ghost_siren.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ghost Siren, a translucent teal ghost woman with flowing hair singing with her mouth open, paper sound-waves rippling outward
Background: a graveyard of ruined ghost ships in teal-green mist, filled to every edge of the image.
```

#### ลูกเรือหอยเกาะผี → `card_art_barnacle_crew.png` (แนบ `paper/monsters/barnacle_crew.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Barnacle Ghost Crewman, a translucent ghost sailor covered in barnacles and shells, the shells cracking as if about to burst
Background: a graveyard of ruined ghost ships in teal-green mist, filled to every edge of the image.
```

#### กัปตันผีเรือคนตาย (Boss) → `card_art_ghost_captain.png` (แนบ `paper/monsters/ghost_captain.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ghost Captain of the Dead Ship, a tall translucent teal ghost captain in a tattered coat and hat, ghostly fog curling around him, a ship's bell in one hand, the most dramatic and powerful pose
Background: a graveyard of ruined ghost ships in teal-green mist, filled to every edge of the image.
```

### 2.8 ชั้น 2 · แมพ 4 Floor 2 Map 4 Kraken Maelstrom

#### อัศวินฉลาม → `card_art_shark_knight.png` (แนบ `paper/monsters/shark_knight.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Shark Knight, a shark-headed knight in dark armour bursting upward with only his fin and head showing, jaws open, sword raised
Background: a giant whirlpool in the open sea with cold sea mist, filled to every edge of the image.
```

#### ม้าน้ำทหาร → `card_art_seahorse_soldier.png` (แนบ `paper/monsters/seahorse_soldier.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Seahorse Soldier, an armoured seahorse with a small helmet, spitting a large floating bubble
Background: a giant whirlpool in the open sea with cold sea mist, filled to every edge of the image.
```

#### ราชาโจรสลัดผี → `card_art_ghost_pirate_king.png` (แนบ `paper/monsters/ghost_pirate_king.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Ghost Pirate King, a translucent ghost king fused with sea creatures (octopus tentacles, crab claw, fish fins, shells), swinging a sword that sends a straight wave of energy
Background: a giant whirlpool in the open sea with cold sea mist, filled to every edge of the image.
```

#### หนวดคราเคน → `card_art_kraken_tentacle.png` (แนบ `paper/monsters/kraken_tentacle.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Kraken Tentacle, a single huge purple tentacle with suckers rising up out of the water and slamming down in a long sweep
Background: a giant whirlpool in the open sea with cold sea mist, filled to every edge of the image.
```

#### คราเคน (Boss) → `card_art_kraken.png` (แนบ `paper/monsters/kraken.png`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster: Kraken, a gigantic kraken with a huge head and many thick tentacles spread around it, glaring eyes, the most dramatic and powerful pose
Background: a giant whirlpool in the open sea with cold sea mist, filled to every edge of the image.
```
