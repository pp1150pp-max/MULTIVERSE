# แมพ 2 ชั้น 2: อ่าวลักลอบ (`smugglers_cove`, Lv51–60)

แผนอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 2, 5.2, 6 และ 10 ส่วนหน้าตาแมพยึดภาพ `M2_smugglers_cove` ที่เจ้าของยืนยันแล้ว
⚠️ ภาพ M2 เจนก่อนเปลี่ยนรายชื่อมอน ในภาพจึงมีลิงกะลาสีอยู่ ไม่ต้องทำตัวนั้น ให้ยึดรายชื่อมอนในไฟล์นี้
รูปแบบเหมือน `FLOOR2_M1_BEACH.md`

## วิธีเจน

- เจนแยกเป็น 3 แชท: **ก.** ฉากแมพ (ข้อ 1–6) **ข.** มอนกับบอส (ข้อ 7–9) **ค.** เอฟเฟกต์กับไอคอนกุญแจ (ข้อ 10–11)
- แต่ละแชท**เปิดใหม่** แล้วแนบ `art_templates/papercraft_maps/raw/floor2_maps/M2_smugglers_cove.webp` ภาพเดียว
  - **ห้ามแนบภาพพิกเซล** ทุกภาพในเกมใช้กระดาษตัดแปะสไตล์เดียว (กติกาเจ้าของ 2026-11-18) ถ้าแนบภาพอื่นด้วย ต้องเป็นภาพกระดาษเท่านั้น
- ภาพแรกของแต่ละแชท ให้ขึ้นต้นด้วยประโยคเปิดนี้ก่อน prompt ของข้อนั้น:

```
The attached image is the approved concept of a map in my game, the Smugglers' Cove. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, warm soft lighting from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_m2/` ตามชื่อไฟล์ของแต่ละข้อ (ภาพมอนเซฟใน `raw/floor2_m2/monsters/`) โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`
- ลำดับช่องอ่านจากซ้ายไปขวา แถวบนลงล่าง (`/` คือขึ้นแถวใหม่)

หน้าตาแมพ: อ่าวหินลับของพวกลักลอบ บนเกาะลอยตอนพระอาทิตย์ตก หินผาสีเทาอมม่วงกับส้มอุ่น ถ้ำมีตะเกียง ท่าไม้กับสะพานเชือก เต็นท์ผ้าใบซีด ถังดินปืนแดงลายกะโหลก ลังไม้ ใบประกาศจับ น้ำในอ่าวสีเทอร์ควอยซ์ ต้นไม้เขียวอมเหลือง แสงเย็นอุ่น ๆ

**สีพื้นหลัง:** หินของแมพนี้อมม่วงชมพู ทุกแผ่นที่มีหินผาจึงใช้**พื้นเขียว** (#00FF00) แทนม่วงแดง ตามที่ระบุในแต่ละข้อ

---

# ก. ฉากแมพ

## 1. พื้นปูซ้ำ 3 ภาพ → `ground_rock.png`, `ground_boardwalk.png`, `ground_cove_water.png`

เจนทีละภาพ ขึ้นต้นด้วยข้อความกลาง แล้วต่อท้ายด้วยข้อความในตาราง
เกมเอาภาพพื้นมาปูต่อกันซ้ำ ๆ ถ้ามีชิ้นใหญ่หรือชิ้นที่สะดุดตา จะเห็นลายซ้ำทั้งแมพ จึงต้องเป็นลายละเอียดที่สีใกล้กันทั้งภาพ

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style: the ground is made of many SMALL overlapping scraps of cut and torn coloured paper with visible paper fibre, all about the same small size, evenly spread. NOT pixel art. Viewed from straight above with no perspective. No focal point, no single large shape, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast: 4 to 5 close shades only, nothing bright, nothing near black, no objects lying on it.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_rock.png` | `The flat rocky floor of the cove like the attached map: small irregular paper flagstone scraps in close shades of dusty mauve, warm grey and soft sunset orange, thin darker cracks, a few tiny paper pebbles, calm and even.` |
| `ground_boardwalk.png` | `A smugglers' boardwalk of old dark wooden planks: narrow paper planks of dark brown and warm umber card, all running the same direction, staggered joints, a few iron nail dots, calm and even.` |
| `ground_cove_water.png` | `The calm water of the hidden cove at sunset: small layered paper ripples in close shades of deep turquoise and teal with a faint warm orange glint, a few tiny white paper foam flecks, calm and even.` |

## 2. ของใหญ่ → `props.png` (4×3 **พื้นเขียว**)

ลำดับช่อง: `palm_0` `palm_1` `cliff_rock_0` `cliff_rock_1` / `cliff_rock_2` `cave_mouth` `tent_0` `tent_1` / `stilt_hut` `small_falls` `bush_0` `bush_1`

```
Now the map props for this Smugglers' Cove, in EXACTLY the same papercraft style as the attached map: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. NOT pixel art. SAME camera as the map: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a small coconut palm; a tall leaning coconut palm; a big jagged rock outcrop of dusty mauve and warm orange layered card with a few yellow-green plants; a smaller cluster of jagged rocks.
Row 2: a tall rock spire; the dark arched mouth of a sea cave in a rock wall, wooden support beams and a glowing lantern at its entrance; a smugglers' tent of faded cream canvas on wooden poles with a rope net; a wide open-sided tent with a faded red cloth roof over crates.
Row 3: a small wooden lookout hut standing on stilts with a ladder; a short narrow waterfall pouring down a rock ledge into a small pool; a yellow-green tropical bush; a dark green leafy bush.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use bright green anywhere on the objects; all plants must be a dull olive or yellow-green.
```

## 3. ของโจร → `camp.png` (4×3 พื้นม่วงแดง)

ลำดับช่อง: `powder_keg` `crates` `barrel` `lantern` / `wanted_board` `cliff_cannon` `cannonball_pile` `pirate_flag` / `cargo_net` `bottles` `loot_chest` `pirate_boat`

```
Same papercraft style, NOT pixel art, the same isometric camera, light from the upper left, the same scale as the props before. Now the smugglers' goods and camp pieces from the attached map.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a red gunpowder barrel painted with a white skull and crossbones; a stack of three wooden crates bound with rope; a plain wooden barrel with iron hoops; a brass lantern with a warm glow hanging from a short wooden post.
Row 2: a wooden notice board on two posts covered in pinned paper wanted posters showing only simple silhouettes, no writing; a black iron cannon on a wooden carriage pointing out to sea; a small pyramid of black cannonballs; a black pirate flag with a white skull on a wooden pole.
Row 3: a heap of rope cargo net with a few sacks caught in it; a wooden crate full of green and blue glass bottles; a small iron-bound chest of smuggled gold and jewels, lid open; a small wooden pirate sloop with one mast and a red sail with crossed white cutlasses, its hull ending cleanly at the waterline, no water.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 4. ของเล็กบนพื้น → `decor.png` (4×3 **พื้นเขียว**)

เกมสุ่มของชิ้นเล็กเหล่านี้ไปวางทั่วแมพ ลำดับช่องต้องตรงตามนี้ เพราะเกมเลือกชิ้นตามเลขช่อง

```
Same papercraft style, NOT pixel art, the same camera. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one SMALL separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. These are tiny details scattered on the rocky floor of the cove, each only a little taller than a hero's knee. Row 1: a small pile of mauve-grey pebbles; one small flat rock; a tuft of yellow-green grass; a small yellow-green leafy plant. Row 2: a coil of old rope; a broken bottle lying on its side; a single black cannonball; a few spilled gold coins. Row 3: a torn scrap of a paper wanted poster lying flat; a short piece of rusty chain; a small broken plank; a small clump of dull olive seaweed. Crisp clean edges. Background ONE perfectly flat solid pure bright green (#00FF00), no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the objects; all plants must be a dull olive or yellow-green.
```

ลำดับช่อง: 0 กรวด, 1 หินแบน, 2 หญ้า, 3 ต้นไม้เล็ก / 4 ขดเชือก, 5 ขวดแตก, 6 ลูกปืนใหญ่, 7 เหรียญทอง / 8 ใบประกาศขาด, 9 โซ่สนิม, 10 เศษไม้, 11 สาหร่าย

## 5. หน้าผาใต้เกาะและแผ่นดินลอย → `island_cliff.png` (4×2), `island_slabs.png` (4×2) **พื้นเขียว**

แบบเดียวกับชั้น 1 (`MAP1_FOREST.md` ข้อ 5–6) แต่เป็นหินผาของอ่าว เจนทีละภาพ

`island_cliff.png`:
```
Same papercraft style, NOT pixel art, same camera, light from the upper left. Generate an image: exactly 8 separate tall broken cliff columns, as if each was cut from under the near edge of this floating cove island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous empty space. Every column has the same structure, built from stacked layers of cut card and paper: at the very top a thin irregular lip of the mauve-grey rocky floor seen slightly from above, with a little yellow-green grass, then jagged rock of dusty mauve, warm grey and sunset orange made of stacked cardboard strata with cracks and ledges, tapering down into 2 or 3 jagged points at the bottom. Each column fills most of its cell. All 8 are different in outline. Two of them have a thin turquoise paper waterfall pouring over the top lip, and one has a short broken wooden plank sticking out. Crisp clean edges. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no clouds, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the objects; all plants must be a dull olive or yellow-green.
```

`island_slabs.png`:
```
Same papercraft style and rules, NOT pixel art. Generate an image: exactly 8 separate small floating rock slabs broken off the cove island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a mauve-grey rocky top seen from above in the same isometric view, layered mauve and orange rock under it, and a short jagged rock point at the bottom. Row 1: two slabs each with a small coconut palm, one with a red gunpowder barrel, one with a stack of crates. Row 2: one with a broken plank bridge end and rope, one with a small rock spire, one with a tiny pool and a thin waterfall spilling off its edge, one bare and cracked. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no clouds, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the objects; all plants must be a dull olive or yellow-green.
```

## 6. ห้องบอสกัปตันขาไม้ → `ground_room.png`, `room_props.png` (3×3 **พื้นเขียว**)

แท่นเรียกบอส (`lair`) ตั้งในแมพ ส่วนของอีก 8 ชิ้นวางรอบลานในห้องบอส
เรือปืนเล็ก (`room_cove_gunboat`) จอดที่ขอบลาน และเป็นตัวยิงตอนนกแก้วชี้เป้า (แผนหัวข้อ 5.2)
ลำดับช่องของ `room_props.png`: `summoner_captain` `room_cove_gunboat` `room_cove_wall` / `room_cove_brazier` `room_cove_boulder` `room_cove_pillar` / `room_cove_rubble` `room_cove_mast` `room_cove_tree`

`ground_room.png`:
```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style, made of small cut pieces of card and paper with visible fibre. NOT pixel art. Viewed from straight above with no perspective. No focal point, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black. This is the floor of the pirate captain's hideout: the worn deck of a big ship, wide dark honey-brown paper planks with darker seams, a few iron nail dots and faint scuff marks, calm and even.
```

`room_props.png`:
```
Same papercraft style, NOT pixel art, the same isometric camera, light from the upper left. Now the pirate captain's hideout in the Smugglers' Cove: a rocky sea cave around a ship's deck, dusty mauve and orange rock, dark timber, rope, brass and red pirate cloth.

Generate an image: exactly 9 separate objects in a 3 columns x 3 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping.
Row 1: the boss summoning altar, about twice the height of a hero: a pirate captain's treasure throne of dark wood and red velvet-coloured paper standing on a few rock steps, a big brass compass rose carved into its back, with a compass-shaped socket on its front glowing faintly gold; a small wooden gunboat with a single black cannon pointing over its bow and a little red pennant, its hull ending cleanly at the waterline, no water; a short section of wall made of stacked crates and rope.
Row 2: an iron brazier on a tripod with a layered paper flame; a big jagged mauve rock boulder; a tall rock pillar with a hanging lantern.
Row 3: a pile of broken crates and rock rubble; a broken ship's mast standing upright with a torn black sail and rope; a tall leaning coconut palm.

Crisp clean edges. Background ONE perfectly flat solid pure bright green (#00FF00), no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the objects; all plants must be a dull olive or yellow-green.
```

---

# ข. มอนกับบอส (แชทใหม่ แนบ M2)

## 7. มอน 4 ตัว → `raw/floor2_m2/monsters/<ชื่อ>_<ท่า>.png`

ใช้รูปแบบเดียวกับ `art_templates/papercraft_chars/MONSTERS.md`: แต่ละภาพเป็นตาราง 5 แถว (มุม) × 4 เฟรม พื้นม่วงแดง
มอนแมพนี้บางตัวเปลี่ยนท่าตอนเลือดลดหรือตอนตาย (แผนหัวข้อ 5.2) จึงมี 3 ภาพ เจ้าของอนุมัติแล้ว (2026-11-19)
ประกอบ prompt จาก 3 ส่วน: **ข้อความกลาง** + **บรรทัดท่า** จากตาราง + **บรรทัดหน้าตา** ของตัวนั้น

### ข้อความกลาง

```
Now a monster of this Smugglers' Cove, in EXACTLY the papercraft style of the attached map and its characters: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME character in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles, no smoke. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
```

### บรรทัดท่าที่ใช้ซ้ำ

- **เดิน:** `The move: a smooth 4-frame walking loop in the direction it faces: frame 1 one side stepping forward, frame 2 passing, frame 3 the other side stepping forward, frame 4 passing, so frame 4 leads into frame 1.`
- **ตี:** `The move: a 4-frame attack toward the direction it faces: frame 1 wind-up, pulling back; frame 2 striking forward; frame 3 the hit at full reach; frame 4 recovering back to its normal pose. The attack: <ท่าตีจากตาราง>`

### หน้าตา (บรรทัดปิดท้าย)

| ตัว | บรรทัดหน้าตา |
|---|---|
| `prisoner` นักโทษในเรือ (ตัวแรกของแมพ) | `The monster: the ship's prisoner, a scruffy stocky man with stubble and an angry face, ALWAYS wearing a dark-brown-and-cream striped cloth bandana tied at the back of his head with two short loose ends, messy brown hair showing under it at the sides, NO cap and NO hat, a torn dark-brown-and-cream striped prisoner shirt, ragged dark brown trousers with holes, barefoot, a heavy iron shackle on one ankle. Keep EXACTLY the same head, bandana and outfit as the attached prisoner sheet.` |
| `cutlass_pirate` โจรสลัดดาบโค้ง | `The monster: the cutlass pirate, a fierce bearded pirate with a red bandana, an eye patch, a red coat over a white shirt, a wide belt and boots, holding a curved steel cutlass, as in the attached map.` |
| `shotgunner` มือปืนลูกซอง | `The monster: the shotgun pirate, a burly pirate with a black bandana and a thick black beard, a cream shirt and a brown leather vest, a powder pouch on the belt, holding a short wide-barrelled blunderbuss, as in the attached map.` |
| `keg_prisoner` นักโทษถังดินปืน | `The monster: the powder-keg prisoner, a wild-eyed prisoner in a black-and-white striped shirt carrying a big red gunpowder barrel painted with a white skull on his back with a chain, as in the attached map.` |

**นักโทษในเรือ (เจ้าของ 2026-11-19):** รอบแรกได้ 3 แผ่นที่หัวไม่ตรงกัน (ไม่มีหมวก / ผ้าโพกหัว / หมวกไหมพรม) เจ้าของเลือก**ผ้าโพกหัวลายทางแบบแผ่นโยน**
- เก็บ `prisoner_throw.png` ไว้เป็นแบบ แล้วเจน `prisoner_walk.png` กับ `prisoner_run.png` ใหม่
- **ทุกครั้งที่เจนแผ่นของนักโทษ ให้แนบ `prisoner_throw.png` ไปด้วย** (นอกจากภาพ M2) บรรทัดหน้าตาเขียนให้ยึดหน้าตาจากแผ่นที่แนบแล้ว

### ภาพของแต่ละตัว

| ไฟล์ | บรรทัดท่า |
|---|---|
| `prisoner_walk.png` | `The move: a slow heavy 4-frame walking loop in the direction it faces, dragging a big black iron ball on a chain behind him from the ankle shackle, so frame 4 leads into frame 1. The iron ball and chain are part of the character in every frame.` |
| `prisoner_throw.png` | `The move: a 4-frame throw toward the direction it faces: frame 1 lifting the iron ball off the ground with both hands, the chain hanging; frame 2 swinging it back over his shoulder; frame 3 hurling it forward, arms fully stretched; frame 4 recovering, hands empty, the broken chain end dangling from the ankle shackle.` |
| `prisoner_run.png` | `The move: a fast 4-frame running loop in the direction it faces, leaning forward angrily with fists up, the iron ball gone, only a short broken chain end swinging from the ankle shackle, so frame 4 leads into frame 1.` |
| `cutlass_pirate_walk.png` | บรรทัดเดิน |
| `cutlass_pirate_combo.png` | `The move: a 4-frame three-hit sword combo toward the direction it faces: frame 1 a slash from right to left; frame 2 a slash back from left to right; frame 3 a short lunge forward with an overhead chop at full reach; frame 4 recovering back to its normal pose.` |
| `shotgunner_walk.png` | บรรทัดเดิน |
| `shotgunner_attack.png` | บรรทัดตี + `it braces, raises the blunderbuss to the shoulder, fires with a strong recoil kick, then lowers the gun. No smoke, no flash.` |
| `keg_prisoner_walk.png` | บรรทัดเดิน |
| `keg_prisoner_throw.png` | บรรทัดตี + `he pulls a small round black bomb with a short fuse from the barrel and lobs it forward overhand. The bomb leaves his hand by frame 3.` |
| `keg_prisoner_charge.png` | `The move: a fast desperate 4-frame running loop in the direction it faces, hunched forward with arms flailing, the big gunpowder barrel on his back with its fuse lit and burning, a small paper flame on the fuse, so frame 4 leads into frame 1.` |

## 8. บอสกัปตันขาไม้ → `raw/floor2_m2/monsters/peg_captain_<ท่า>.png`

ใช้ข้อความกลางของข้อ 7 แต่บอสตัวใหญ่ราว 2.5 เท่าของฮีโร่ ภาพละ 1 ท่า รวม 3 ภาพ: ข้อความกลาง + บรรทัดท่าจากตาราง + บรรทัดหน้าตาบอส
นกแก้ว**ไม่อยู่**ในภาพบอส (มีแผ่นของตัวเองในข้อ 9) ไหล่ซ้ายของบอสเว้นที่ว่างไว้ให้นกเกาะ

บรรทัดหน้าตาบอส (ปิดท้ายทุกภาพ):
```
The monster: the Peg-Leg Captain, a large imposing pirate captain boss about two and a half times the height of a hero: a broad scarred pirate with a big curly black beard braided with gold beads, a wide black tricorn hat with gold trim and a white feather, a long deep red captain's coat with gold buttons and epaulettes, a wooden peg leg on his right, a heavy iron ship's anchor on a thick chain held in one hand, gold rings on the other hand. No bird on him.
```

| ไฟล์ | บรรทัดท่า |
|---|---|
| `peg_captain_walk.png` | `The move: a heavy limping 4-frame walking loop on the peg leg, the anchor dragging at his side, so frame 4 leads into frame 1.` |
| `peg_captain_anchor.png` | `The move: a 4-frame anchor throw and pull toward the direction it faces: frame 1 swinging the anchor back over his shoulder; frame 2 hurling it forward, the chain stretching out of his hand; frame 3 bracing with both hands on the taut chain; frame 4 yanking the chain hard back toward himself.` |
| `peg_captain_shout.png` | `The move: a 4-frame battle shout: frame 1 drawing a deep breath, chest out; frame 2 raising the anchor high in the air; frame 3 roaring with the mouth wide open, the free arm pointing forward; frame 4 lowering the anchor back to his side.` |

## 9. นกแก้วคู่ใจ → `raw/floor2_m2/monsters/parrot_fly.png`, `parrot_perch.png`

นกไม่ตาย ตีตกได้ชั่วคราวแล้วกลับไปเกาะไหล่บอส (แผนหัวข้อ 5.2) ตัวเล็กราวครึ่งหนึ่งของหัวฮีโร่
ใช้ข้อความกลางของข้อ 7 + บรรทัดท่า + บรรทัดหน้าตานี้

```
The monster: the captain's parrot, a small bright scarlet macaw with blue and yellow wing feathers, a curved pale beak, a tiny black pirate eye patch and a tiny gold earring.
```

| ไฟล์ | บรรทัดท่า |
|---|---|
| `parrot_fly.png` | `The move: a 4-frame flying loop in the direction it faces, the wings flapping up and down, hovering at the same height, so frame 4 leads into frame 1.` |
| `parrot_perch.png` | `The move: a 4-frame squawk while perched, the feet gripping at the bottom of the cell as if standing on a shoulder or a head: frame 1 sitting still; frame 2 flapping the wings up; frame 3 squawking with the beak wide open and one wing pointing forward; frame 4 folding the wings back.` |

---

# ค. เอฟเฟกต์และไอคอนกุญแจ (แชทใหม่ แนบ M2)

## 10. เอฟเฟกต์ท่าใหม่ → `fx.png` (4×2 พื้นเขียว)

ลำดับช่อง: `fx_iron_ball` `fx_bomb` `fx_explosion` `fx_anchor` / `fx_pellets` `fx_shout_ring` `fx_parrot_mark` `fx_ship_shell`

```
Now combat effects for this Smugglers' Cove, in EXACTLY the papercraft style of the attached map: built from layered cut coloured paper, tissue paper and foil with visible fibre and small drop shadows between the layers; fire, glow and energy shown as bright translucent tissue-paper shapes with paper sparkles, not blurry light. NOT pixel art.
Generate an image: exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a heavy black iron ball with a short broken chain trailing behind it, flying; a small round black bomb with a lit sparking fuse, sitting inside a warning circle seen STRAIGHT FROM ABOVE, a perfect circle of a thick red-orange dashed ring; a big round explosion burst of layered orange, yellow and red tissue-paper flames with grey paper smoke puffs and flying sparks; a heavy iron ship's anchor flying point first with a length of thick chain trailing behind it.
Row 2: a fan-shaped spray of small glowing orange shotgun pellets with short paper streaks, spreading out from a point on the left toward the right; a ring of bold red-orange paper shout waves expanding outward, seen in the isometric view, as a war cry that speeds up allies; a target marker seen STRAIGHT FROM ABOVE, a perfect circle of red with a small parrot feather symbol and a crosshair in the middle, mostly empty inside; a round black ship's cannon shell falling straight down with a short trail of grey paper smoke.
No characters, no text, no labels, no numbers, no grid lines. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no shadows on the background. Do not use bright green anywhere on the effects.
```

## 11. ไอคอนกุญแจบอส "เข็มทิศชี้ขุมทรัพย์" → `key_treasure_compass.png`

แบบเดียวกับไอคอนกุญแจก้ามปูทองของแมพ 1 (ของลอย ๆ ไม่มีพื้นหลังหรือกรอบ)

```
Now one item icon for this game, in EXACTLY the papercraft style of the attached map: layered cut coloured paper, card and gold foil with visible fibre and small drop shadows between the layers. NOT pixel art. Generate a SQUARE image (1:1): one boss key item, a treasure compass, a round brass compass with an open hinged lid, its red needle pointing to a tiny gold X mark on the dial, a small turquoise gem on the lid and a short loop of red cord tied to it, a few tiny paper sparkles. One bold clear shape centred in the image, filling most of it, that reads at very small size. No frame, no icon background, no ground, no shadow, no text. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the item.
```

---

## สำหรับคนใส่เข้าเกม

| ไฟล์ดิบ | ชิ้น |
|---|---|
| `ground_rock.png` `ground_boardwalk.png` `ground_cove_water.png` `ground_room.png` | ภาพพื้นปูซ้ำ 1024×1024 แบบ `ground/*` ของชั้น 1 (`ground_cove_water` เป็นน้ำ เดินไม่ได้) |
| `props.png` (พื้นเขียว) | `palm_0` `palm_1` `cliff_rock_0` `cliff_rock_1` / `cliff_rock_2` `cave_mouth` `tent_0` `tent_1` / `stilt_hut` `small_falls` `bush_0` `bush_1` |
| `camp.png` | `powder_keg` `crates` `barrel` `lantern` / `wanted_board` `cliff_cannon` `cannonball_pile` `pirate_flag` / `cargo_net` `bottles` `loot_chest` `pirate_boat` |
| `decor.png` (พื้นเขียว) | atlas `decor_cove` ช่องละ 128 แบบ `decor_forest` |
| `island_cliff.png` `island_slabs.png` (พื้นเขียว) | `island_cliff_cove` `island_slabs_cove` แบบชั้น 1 |
| `room_props.png` (พื้นเขียว) | `summoner_captain` `room_cove_gunboat` + `room_cove_*` อีก 7 ชิ้น |
| `monsters/*` | แผ่น 5 แถว × 4 เฟรม: `prisoner` 3 ท่า, `cutlass_pirate` 2, `shotgunner` 2, `keg_prisoner` 3, `peg_captain` 3, `parrot` 2 |
| `fx.png` (พื้นเขียว) | `fx_iron_ball` `fx_bomb` `fx_explosion` `fx_anchor` / `fx_pellets` `fx_shout_ring` `fx_parrot_mark` `fx_ship_shell` |
| `key_treasure_compass.png` | ไอคอนกุญแจ 96×96 แบบไอคอนกุญแจชั้น 1 |

- `tools/cut_papercraft.cjs` ยังไม่มีชุดของแมพนี้ ต้องเพิ่มตอนทำ PR `feature/floor2-map2` และต้องรองรับแผ่นพื้นเขียว
- ชื่อชิ้นข้างบนเป็นชื่อที่เสนอ เปลี่ยนได้ตอนใส่เข้าเกม
