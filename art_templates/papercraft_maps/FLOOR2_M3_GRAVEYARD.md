# แมพ 3 ชั้น 2: สุสานเรือผี (`ghost_ship_graveyard`, Lv61–70)

แผนอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 2, 5.3, 6 และ 10 ส่วนหน้าตาแมพยึดภาพ `M3_ghost_ship_graveyard` ที่เจ้าของยืนยันแล้ว
⚠️ ภาพ M3 เจนก่อนเปลี่ยนรายชื่อมอน ในภาพจึงมีปลาไหลผีอยู่ ไม่ต้องทำตัวนั้น ให้ยึดรายชื่อมอนในไฟล์นี้
รูปแบบเหมือน `FLOOR2_M1_BEACH.md` และ `FLOOR2_M2_COVE.md`

## วิธีเจน

- เจนแยกเป็น 3 แชท: **ก.** ฉากแมพ (ข้อ 1–6) **ข.** มอนกับบอส (ข้อ 7–8) **ค.** เอฟเฟกต์กับไอคอนกุญแจ (ข้อ 9–10)
- แต่ละแชท**เปิดใหม่** แล้วแนบ `art_templates/papercraft_maps/raw/floor2_maps/M3_ghost_ship_graveyard.webp` ภาพเดียว
  - **ห้ามแนบภาพพิกเซล** ทุกภาพในเกมใช้กระดาษตัดแปะสไตล์เดียว (กติกาเจ้าของ 2026-11-18) ถ้าแนบภาพอื่นด้วย ต้องเป็นภาพกระดาษเท่านั้น
- ภาพแรกของแต่ละแชท ให้ขึ้นต้นด้วยประโยคเปิดนี้ก่อน prompt ของข้อนั้น:

```
The attached image is the approved concept of a map in my game, the Ghost Ship Graveyard. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, cool moonlight from the upper left with soft glowing teal-green ghost light. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_m3/` ตามชื่อไฟล์ของแต่ละข้อ (ภาพมอนเซฟใน `raw/floor2_m3/monsters/`) โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`
- ลำดับช่องอ่านจากซ้ายไปขวา แถวบนลงล่าง (`/` คือขึ้นแถวใหม่)

หน้าตาแมพ: สุสานเรือกลางทะเลเมฆตอนกลางคืนใต้แสงจันทร์ ซากเรือไม้ผุเอียงอยู่ในน้ำหมอก ใบเรือขาดรุ่งริ่ง สาหร่ายสีเหลืองอมเขียวห้อย หินเทาอมฟ้า เทียนกับตะเกียงเรืองแสงเขียวอมฟ้า กะโหลก ระฆังเรือทองเหลือง ปลาดาวส้ม น่ากลัวแบบสนุก ไม่สยอง

**สีพื้นหลัง:** มอนทุกตัวในแมพนี้เป็นผีโปร่งแสงสีเขียวอมฟ้า (แผนหัวข้อ 5.3) จึงใช้**พื้นม่วงแดง** (#FF00FF) ทุกแผ่น ห้ามใช้พื้นเขียว

---

# ก. ฉากแมพ

## 1. พื้นปูซ้ำ 3 ภาพ → `ground_stone.png`, `ground_rotten_deck.png`, `ground_misty_water.png`

เจนทีละภาพ ขึ้นต้นด้วยข้อความกลาง แล้วต่อท้ายด้วยข้อความในตาราง
เกมเอาภาพพื้นมาปูต่อกันซ้ำ ๆ ถ้ามีชิ้นใหญ่หรือชิ้นที่สะดุดตา จะเห็นลายซ้ำทั้งแมพ จึงต้องเป็นลายละเอียดที่สีใกล้กันทั้งภาพ

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style: the ground is made of many SMALL overlapping scraps of cut and torn coloured paper with visible paper fibre, all about the same small size, evenly spread. NOT pixel art. Viewed from straight above with no perspective. No focal point, no single large shape, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast: 4 to 5 close shades only, nothing bright, nothing near black, no objects lying on it.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_stone.png` | `The wet stone floor of the graveyard like the attached map: small irregular paper flagstone scraps in close shades of cool slate grey, grey-teal and muted blue-grey, thin darker seams, a few tiny specks of dull olive moss, calm and even.` |
| `ground_rotten_deck.png` | `The rotten deck of a sunken ghost ship: narrow weathered paper planks of grey-brown and faded dark wood card, all running the same direction, staggered joints, a few cracks and dull olive slime stains, calm and even.` |
| `ground_misty_water.png` | `Dark misty sea water at night: small layered paper ripples in close shades of deep teal and dark blue-green with a few thin pale wisps of paper mist, calm and even.` |

## 2. ของใหญ่ → `props.png` (4×3 พื้นม่วงแดง)

ลำดับช่อง: `wreck_hull_0` `wreck_hull_1` `wreck_mast` `bell_mast` / `mossy_rock_0` `mossy_rock_1` `ghost_lamp_post` `slime_post` / `wreck_small` `rotten_stump` `broken_rail` `figurehead`

```
Now the map props for this Ghost Ship Graveyard, in EXACTLY the same papercraft style as the attached map: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. NOT pixel art. SAME camera as the map: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: the large broken hull of a rotting wooden ship tilted on its side, holes in its planks, dull olive seaweed hanging from it; a different broken hull, only the bow half, sticking up at an angle; a broken mast with a torn grey ragged sail and slack ropes hanging with seaweed; a tall broken mast with a crossbeam holding a big tarnished brass ship's bell, as in the attached map.
Row 2: a big cool slate-grey rock with dull olive moss and a few orange starfish; a smaller cluster of mossy grey rocks; an old iron lamp post with a lantern glowing soft teal-green; a thick rotten wooden post draped in hanging dull olive seaweed and rope.
Row 3: a small sunken rowing boat wreck, half broken; a short rotten mast stump with an iron ring; a section of broken ship railing on two posts; the carved wooden figurehead of a woman broken off a ship's bow, weathered and cracked.

Each object has crisp clean outer edges with no glow or halo around it except the lantern light. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no water, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 3. ของในสุสาน → `camp.png` (4×3 พื้นม่วงแดง)

ลำดับช่อง: `candles` `skull_barrel` `skull_pile` `net` / `rotten_chest` `rusty_anchor` `green_lantern` `grave_marker` / `torn_flag` `rope_coil` `spirit_bottle` `fallen_bell`

```
Same papercraft style, NOT pixel art, the same isometric camera, light from the upper left, the same scale as the props before. Now the smaller pieces of the ghost ship graveyard from the attached map.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a cluster of melted white candles on a flat rock, their flames glowing pale teal-green; an old wooden barrel with a white skull sitting on top; a small heap of three cute cartoon white skulls; a tangled old fishing net with a few shells caught in it.
Row 2: a rotten wooden chest with rusty iron bands, the lid cracked; a big rusty iron anchor lying on its side covered in barnacles; a hanging ship's lantern on a short hook post glowing soft teal-green; a grave marker made of two crossed broken oars tied with rope.
Row 3: a tattered grey flag with a faded skull on a crooked pole; a coil of old rope with seaweed; a corked glass bottle with a small glowing teal-green wisp trapped inside; a tarnished brass ship's bell lying tipped over on the ground.

Each object has crisp clean outer edges with no glow or halo around it except the candle, lantern and bottle light. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 4. ของเล็กบนพื้น → `decor.png` (4×3 พื้นม่วงแดง)

เกมสุ่มของชิ้นเล็กเหล่านี้ไปวางทั่วแมพ ลำดับช่องต้องตรงตามนี้ เพราะเกมเลือกชิ้นตามเลขช่อง

```
Same papercraft style, NOT pixel art, the same camera. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one SMALL separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. These are tiny details scattered on the stone floor of the graveyard, each only a little taller than a hero's knee. Row 1: a small pile of grey pebbles; a clump of dull olive seaweed; one orange starfish lying flat; a few grey sea shells. Row 2: one small cute cartoon skull; a single short white candle with a pale teal flame; a broken plank; a short piece of rusty chain. Row 3: a small tuft of pale dead grass; one small flat mossy stone; a small puddle seen from above with a faint teal shimmer; a single rusty iron nail and a few wood splinters. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: 0 กรวด, 1 สาหร่าย, 2 ปลาดาว, 3 เปลือกหอย / 4 กะโหลก, 5 เทียน, 6 เศษไม้, 7 โซ่สนิม / 8 หญ้าแห้ง, 9 หินตะไคร่, 10 แอ่งน้ำ, 11 ตะปูกับเศษไม้

## 5. หน้าผาใต้เกาะและแผ่นดินลอย → `island_cliff.png` (4×2), `island_slabs.png` (4×2)

แบบเดียวกับชั้น 1 (`MAP1_FOREST.md` ข้อ 5–6) แต่เป็นหินของสุสานเรือ เจนทีละภาพ

`island_cliff.png`:
```
Same papercraft style, NOT pixel art, same camera, light from the upper left. Generate an image: exactly 8 separate tall broken cliff columns, as if each was cut from under the near edge of this floating graveyard island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous empty space. Every column has the same structure, built from stacked layers of cut card and paper: at the very top a thin irregular lip of the grey stone floor seen slightly from above, with a little dull olive moss, then cool slate-grey and blue-grey rock made of stacked cardboard strata with cracks and ledges, dull olive seaweed hanging down, tapering down into 2 or 3 jagged points at the bottom. Each column fills most of its cell. All 8 are different in outline. Two of them have a thin pale teal paper waterfall pouring over the top lip, and one has a broken rotten plank sticking out. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no clouds, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

`island_slabs.png`:
```
Same papercraft style and rules, NOT pixel art. Generate an image: exactly 8 separate small floating rock slabs broken off the graveyard island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a grey stone top seen from above in the same isometric view, layered slate-grey rock under it with hanging seaweed, and a short jagged rock point at the bottom. Row 1: one with a broken mast stump, one with a small piece of a wrecked hull, one with a cluster of glowing teal candles, one with a rotten barrel and a skull. Row 2: one with a mossy rock and a starfish, one with a tiny puddle and a thin waterfall spilling off its edge, one with a broken railing, one bare and cracked. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no clouds, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 6. ห้องบอสกัปตันผี → `ground_room.png`, `room_props.png` (3×3 พื้นม่วงแดง)

แท่นเรียกบอส (`lair`) ตั้งในแมพ ส่วนของอีก 8 ชิ้นวางรอบลานในห้องบอส
ลำดับช่องของ `room_props.png`: `summoner_ghost` `room_grave_pillar_0` `room_grave_wall` / `room_grave_brazier` `room_grave_boulder` `room_grave_pillar_1` / `room_grave_rubble` `room_grave_mast` `room_grave_figurehead`

`ground_room.png`:
```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style, made of small cut pieces of card and paper with visible fibre. NOT pixel art. Viewed from straight above with no perspective. No focal point, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black. This is the floor of the ghost captain's arena: the deck of a dead ghost ship, wide grey-brown rotten paper planks with darker seams, thin wisps of pale teal mist and a few dull olive slime stains, calm and even.
```

`room_props.png`:
```
Same papercraft style, NOT pixel art, the same isometric camera, cool moonlight from the upper left. Now the arena of the ghost captain: the deck of a huge dead ghost ship, rotten grey wood, tattered grey sails, rusty iron, tarnished brass, dull olive seaweed and soft teal-green ghost light.

Generate an image: exactly 9 separate objects in a 3 columns x 3 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping.
Row 1: the boss summoning altar, about twice the height of a hero: a ship's wheel of black rotten wood standing on a few cracked stone steps, wrapped in rusty chains and seaweed, a bell-shaped socket on its front glowing faintly teal; a tall broken ship's mast pillar wrapped in rope; a short section of wall made of rotten broken hull planks.
Row 2: a hanging iron lantern on a post with a soft teal-green flame; a big mossy grey rock with barnacles; a smaller broken mast pillar with a torn grey sail scrap.
Row 3: a pile of broken planks, rope and a skull; a tall leaning mast with tattered grey sails and dangling ropes; the cracked carved figurehead of a crowned mermaid, weathered grey wood.

Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no water, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

---

# ข. มอนกับบอส (แชทใหม่ แนบ M3)

## 7. มอนผี 4 ตัว + ตัวเล็กที่แยกร่าง → `raw/floor2_m3/monsters/<ชื่อ>_<ท่า>.png`

ใช้รูปแบบเดียวกับ `art_templates/papercraft_chars/MONSTERS.md`: แต่ละภาพเป็นตาราง 5 แถว (มุม) × 4 เฟรม พื้นม่วงแดง
**มอนทุกตัวเป็นผี** (เจ้าของสั่ง) ข้อความกลางจึงบังคับให้โปร่งแสงสีเขียวอมฟ้า แบบกะลาสีผีในภาพ M3
ลูกเรือหอยเกาะผีตายแล้วแตกออกเป็นตัวเล็ก 2 ตัว (`barnacle_small`) จึงมีภาพของตัวเล็กด้วย
ประกอบ prompt จาก 3 ส่วน: **ข้อความกลาง** + **บรรทัดท่า** จากตาราง + **บรรทัดหน้าตา** ของตัวนั้น

### ข้อความกลาง

```
Now a ghost monster of this Ghost Ship Graveyard, in EXACTLY the papercraft style of the attached map and its ghosts: layered cut coloured paper and translucent tissue paper, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, slightly chibi proportions, cool moonlight from the upper left. EVERY monster is a GHOST: made of semi-translucent pale teal and sea-green tissue paper with a soft inner glow, glowing pale eyes, wispy torn edges at the bottom and on the clothes, like the ghost pirate in the attached map. Spooky but cute, not gory. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME ghost in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, on the same baseline in every cell (floating ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no sparks, no projectiles, no mist around it. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the ghost.
```

### บรรทัดท่าที่ใช้ซ้ำ

- **เดิน:** `The move: a smooth 4-frame walking loop in the direction it faces: frame 1 one side stepping forward, frame 2 passing, frame 3 the other side stepping forward, frame 4 passing, so frame 4 leads into frame 1. (A ghost with no legs floats in place with a gentle bob and a swaying wispy tail instead.)`
- **ตี:** `The move: a 4-frame attack toward the direction it faces: frame 1 wind-up, pulling back; frame 2 striking forward; frame 3 the hit at full reach; frame 4 recovering back to its normal pose. The attack: <ท่าตีจากตาราง>`

### หน้าตา (บรรทัดปิดท้าย)

ลำดับในตาราง = จากต้นแมพ (เลเวลต่ำ) ไปหาแท่นเรียกบอส

| ตัว | บรรทัดหน้าตา |
|---|---|
| `ghost_monkey` ลิงกะลาสีผี (ตัวแรกของแมพ) | `The monster: the ghost sailor monkey, a small mischievous monkey ghost with a red-faded bandana and a tiny striped sailor shirt, a long curly tail, grinning, all in translucent glowing teal.` |
| `ghost_sailor` กะลาสีผี | `The monster: the ghost sailor, a gaunt pirate ghost in a ragged coat and a torn tricorn hat, a rusty cutlass in one hand, the legs fading into a wispy tail, as in the attached map.` |
| `ghost_siren` ไซเรนผี | `The monster: the ghost siren, a beautiful sad mermaid ghost with long flowing pale sea-green hair, a shell in her hair, a long fish tail of pale teal and silver-aqua scales, floating upright just above the ground, as in the attached map but with NO purple in the tail.` |
| `barnacle_crew` ลูกเรือหอยเกาะผี | `The monster: the barnacle crewman ghost, a hunched bulky drowned sailor ghost in a knit cap and a ragged coat, his body and shoulders crusted with big grey barnacle shells and a few orange starfish, as in the attached map.` |
| `barnacle_small` ตัวเล็กที่แยกร่าง | `The monster: a small barnacle ghost, a little hunched drowned sailor ghost about half the size of a hero, crusted with grey barnacle shells and one orange starfish, a cracked shell on its back.` |

### ภาพของแต่ละตัว

| ไฟล์ | บรรทัดท่า |
|---|---|
| `ghost_monkey_walk.png` | บรรทัดเดิน |
| `ghost_monkey_throw.png` | บรรทัดตี + `it pulls a small glowing ghost skull from behind its back and throws it forward overhand. The skull leaves its hand by frame 3.` |
| `ghost_sailor_walk.png` | บรรทัดเดิน |
| `ghost_sailor_attack.png` | บรรทัดตี + `it raises the rusty cutlass and slashes down diagonally.` |
| `ghost_sailor_fade.png` | `The move: a 4-frame vanish and reappear: frame 1 normal pose; frame 2 the body turning half see-through; frame 3 almost invisible, only a faint outline and the glowing eyes left; frame 4 fully back, lunging forward with the cutlass raised.` |
| `ghost_siren_walk.png` | บรรทัดเดิน |
| `ghost_siren_sing.png` | `The move: a 4-frame song: frame 1 drawing a breath with the hands at her chest; frame 2 opening her arms wide; frame 3 singing with the mouth open and one hand reaching forward as if calling someone to her; frame 4 lowering the arms back. No music notes, no effects.` |
| `barnacle_crew_walk.png` | บรรทัดเดิน |
| `barnacle_crew_attack.png` | บรรทัดตี + `he raises both heavy barnacle-crusted fists and slams them down in front of him.` |
| `barnacle_small_walk.png` | บรรทัดเดิน |
| `barnacle_small_attack.png` | บรรทัดตี + `it hops forward and swipes with one little barnacle-crusted fist.` |

## 8. บอสกัปตันผีเรือคนตาย → `raw/floor2_m3/monsters/ghost_captain_<ท่า>.png`

ใช้ข้อความกลางของข้อ 7 แต่บอสตัวใหญ่ราว 2.5 เท่าของฮีโร่ ภาพละ 1 ท่า รวม 4 ภาพ: ข้อความกลาง + บรรทัดท่าจากตาราง + บรรทัดหน้าตาบอส
ท่าของบอสอยู่ในแผนหัวข้อ 5.3 (หมอกผีทำด้วยโค้ดฝั่งเบราว์เซอร์ ไม่ต้องมีท่าเฉพาะ)

บรรทัดหน้าตาบอส (ปิดท้ายทุกภาพ):
```
The monster: the Ghost Captain of the Dead Ship, a large imposing ghost boss about two and a half times the height of a hero: a tall skeletal pirate captain ghost with a long ragged captain's coat with tarnished gold buttons and epaulettes, a huge torn tricorn hat with a skull emblem, a long wispy beard, fierce glowing pale eyes, the lower body fading into a big swirling wispy tail, a long rusty sabre in one hand and a small tarnished brass ship's bell hanging from his belt.
```

| ไฟล์ | บรรทัดท่า |
|---|---|
| `ghost_captain_walk.png` | `The move: a 4-frame floating loop in the direction it faces, gliding with a gentle bob, the coat and wispy tail swaying, so frame 4 leads into frame 1.` |
| `ghost_captain_slash.png` | `The move: a 4-frame sabre attack toward the direction it faces: frame 1 raising the sabre high over his head; frame 2 swinging it down diagonally; frame 3 the slash at full reach; frame 4 recovering back to his normal pose.` |
| `ghost_captain_bell.png` | `The move: a 4-frame bell call: frame 1 taking the brass bell from his belt; frame 2 raising it high above his head; frame 3 shaking it hard, the head thrown back, mouth open in a shout; frame 4 lowering the bell back to his belt. No sound waves, no effects.` |
| `ghost_captain_vanish.png` | `The move: a 4-frame vanish and reappear: frame 1 normal pose, the coat swirling around him; frame 2 the body turning half see-through and twisting into a wisp; frame 3 almost gone, only the glowing eyes and the hat outline left; frame 4 fully back, rising up with the sabre raised behind him as if appearing behind someone.` |

---

# ค. เอฟเฟกต์และไอคอนกุญแจ (แชทใหม่ แนบ M3)

## 9. เอฟเฟกต์ท่าใหม่ → `fx.png` (4×2 พื้นม่วงแดง)

ลำดับช่อง: `fx_ghost_skull` `fx_curse_ring` `fx_music_notes` `fx_siren_pull` / `fx_mist` `fx_bell_waves` `fx_spirit_puff` `fx_shell_burst`

```
Now combat effects for this Ghost Ship Graveyard, in EXACTLY the papercraft style of the attached map: built from layered cut coloured paper, translucent tissue paper and foil with visible fibre and small drop shadows between the layers; ghost light shown as bright translucent pale teal and sea-green tissue-paper shapes with paper sparkles, not blurry light. NOT pixel art.
Generate an image: exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a small glowing teal ghost skull flying, with a short wispy trail behind it; a curse circle seen STRAIGHT FROM ABOVE, a perfect circle of a thin glowing teal ring with small skull and wave runes around it, mostly empty inside, to be laid flat on the ground; a short curving ribbon of glowing pale teal music notes; a ring of curved pale teal sound waves closing inward toward the centre, seen in the isometric view, as a song pulling people in.
Row 2: a soft drifting cloud of layered pale grey-teal paper mist, wide and low; a set of round pale gold sound rings spreading out from a point, as a ghost bell ringing; a small puff of swirling teal ghost smoke with a few sparkles, as when a ghost vanishes; a burst of broken grey barnacle shell pieces and small splashes flying outward.
No characters, no text, no labels, no numbers, no grid lines. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no shadows on the background. Do not use pink, magenta or purple on any effect.
```

## 10. ไอคอนกุญแจบอส "ระฆังเรือผี" → `key_ghost_bell.png`

แบบเดียวกับไอคอนกุญแจของแมพ 1–2 (ของลอย ๆ ไม่มีพื้นหลังหรือกรอบ)

```
Now one item icon for this game, in EXACTLY the papercraft style of the attached map: layered cut coloured paper, card and foil with visible fibre and small drop shadows between the layers. NOT pixel art. Generate a SQUARE image (1:1): one boss key item, a ghost ship's bell, a small tarnished brass ship's bell with a few barnacles and a strand of dull olive seaweed on it, a faint glowing teal ghost wisp curling out of its mouth, a short loop of old rope tied to its top, a few tiny paper sparkles. One bold clear shape centred in the image, filling most of it, that reads at very small size. No frame, no icon background, no ground, no shadow, no text. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the item.
```

---

## สำหรับคนใส่เข้าเกม

| ไฟล์ดิบ | ชิ้น |
|---|---|
| `ground_stone.png` `ground_rotten_deck.png` `ground_misty_water.png` `ground_room.png` | ภาพพื้นปูซ้ำ 1024×1024 แบบ `ground/*` ของชั้น 1 (`ground_misty_water` เป็นน้ำ เดินไม่ได้) |
| `props.png` | `wreck_hull_0` `wreck_hull_1` `wreck_mast` `bell_mast` / `mossy_rock_0` `mossy_rock_1` `ghost_lamp_post` `slime_post` / `wreck_small` `rotten_stump` `broken_rail` `figurehead` |
| `camp.png` | `candles` `skull_barrel` `skull_pile` `net` / `rotten_chest` `rusty_anchor` `green_lantern` `grave_marker` / `torn_flag` `rope_coil` `spirit_bottle` `fallen_bell` |
| `decor.png` | atlas `decor_graveyard` ช่องละ 128 แบบ `decor_forest` |
| `island_cliff.png` `island_slabs.png` | `island_cliff_graveyard` `island_slabs_graveyard` แบบชั้น 1 |
| `room_props.png` | `summoner_ghost` + `room_grave_*` 8 ชิ้น |
| `monsters/*` | แผ่น 5 แถว × 4 เฟรม: `ghost_monkey` 2 ท่า, `ghost_sailor` 3, `ghost_siren` 2, `barnacle_crew` 2, `barnacle_small` 2, `ghost_captain` 4 |
| `fx.png` | `fx_ghost_skull` `fx_curse_ring` `fx_music_notes` `fx_siren_pull` / `fx_mist` `fx_bell_waves` `fx_spirit_puff` `fx_shell_burst` |
| `key_ghost_bell.png` | ไอคอนกุญแจ 96×96 แบบไอคอนกุญแจชั้น 1 |

- มอนผีโปร่งแสง ตอนตัดภาพต้องเก็บความโปร่งแสงไว้ (ระวังขอบสีม่วงแดงซึมเข้าเนื้อผี)
- `tools/cut_papercraft.cjs` ยังไม่มีชุดของแมพนี้ ต้องเพิ่มตอนทำ PR `feature/floor2-map3`
- ชื่อชิ้นข้างบนเป็นชื่อที่เสนอ เปลี่ยนได้ตอนใส่เข้าเกม
