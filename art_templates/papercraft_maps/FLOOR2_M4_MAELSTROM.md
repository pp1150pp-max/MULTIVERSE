# แมพ 4 ชั้น 2: วังวนกลางทะเล (`kraken_maelstrom`, Lv71–80)

แผนอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 2, 5.4, 6 และ 10 ส่วนหน้าตาแมพยึดภาพ `M4_kraken_maelstrom` ที่เจ้าของยืนยันแล้ว
⚠️ ภาพ M4 เจนก่อนเปลี่ยนรายชื่อมอน ในภาพจึงมีนักบวชคราเคนอยู่ ไม่ต้องทำตัวนั้น ให้ยึดรายชื่อมอนในไฟล์นี้
รูปแบบเหมือน `FLOOR2_M1_BEACH.md` ถึง `FLOOR2_M3_GRAVEYARD.md`

## วิธีเจน

- เจนแยกเป็น 3 แชท: **ก.** ฉากแมพ (ข้อ 1, 3–7 ส่วนน้ำวนข้อ 2 อยู่อีกไฟล์) **ข.** มอนกับบอส (ข้อ 8–9) **ค.** เอฟเฟกต์กับไอคอนกุญแจ (ข้อ 10–11)
- แต่ละแชท**เปิดใหม่** แล้วแนบ `art_templates/papercraft_maps/raw/floor2_maps/M4_kraken_maelstrom.webp` ภาพเดียว
  - **ห้ามแนบภาพพิกเซล** ทุกภาพในเกมใช้กระดาษตัดแปะสไตล์เดียว (กติกาเจ้าของ 2026-11-18) ถ้าแนบภาพอื่นด้วย ต้องเป็นภาพกระดาษเท่านั้น
- ภาพแรกของแต่ละแชท ให้ขึ้นต้นด้วยประโยคเปิดนี้ก่อน prompt ของข้อนั้น:

```
The attached image is the approved concept of a map in my game, the Kraken Maelstrom. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, cool stormy light from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_m4/` ตามชื่อไฟล์ของแต่ละข้อ (ภาพมอนเซฟใน `raw/floor2_m4/monsters/`) โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`
- ลำดับช่องอ่านจากซ้ายไปขวา แถวบนลงล่าง (`/` คือขึ้นแถวใหม่)

หน้าตาแมพ: กลางทะเลเมฆตอนพายุกลางคืน หินผาสีเทาเข้มอมน้ำเงินเปียกฝน น้ำวนยักษ์สีน้ำเงินเข้มกับเทอร์ควอยซ์อยู่กลางแมพ หนวดคราเคนสีม่วงมีปุ่มดูดสีครีมโผล่ขึ้นมาจากน้ำ ซากเรือ ธงแดงลายหมึก ปะการังแดง ตะเกียงเหลืองอุ่น ฟ้าแลบสีขาวอมม่วง ยิ่งใหญ่ น่าตื่นเต้น ไม่สยอง

**สีพื้นหลัง:** หนวดและตัวคราเคนเป็นสีม่วง ส่วนปะการังเป็นสีแดง (อาจออกชมพู) แผ่นที่มีของเหล่านี้จึงใช้**พื้นเขียว** (#00FF00) ราชาโจรสลัดผีเป็นสีเขียวอมฟ้า จึงใช้**พื้นม่วงแดง** ทุกข้อระบุสีพื้นไว้แล้ว

---

# ก. ฉากแมพ

## 1. พื้นปูซ้ำ 3 ภาพ → `ground_storm_rock.png`, `ground_wet_planks.png`, `ground_rough_sea.png`

เจนทีละภาพ ขึ้นต้นด้วยข้อความกลาง แล้วต่อท้ายด้วยข้อความในตาราง
เกมเอาภาพพื้นมาปูต่อกันซ้ำ ๆ ถ้ามีชิ้นใหญ่หรือชิ้นที่สะดุดตา จะเห็นลายซ้ำทั้งแมพ จึงต้องเป็นลายละเอียดที่สีใกล้กันทั้งภาพ

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style: the ground is made of many SMALL overlapping scraps of cut and torn coloured paper with visible paper fibre, all about the same small size, evenly spread. NOT pixel art. Viewed from straight above with no perspective. No focal point, no single large shape, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast: 4 to 5 close shades only, nothing bright, nothing near black, no objects lying on it.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_storm_rock.png` | `The rain-soaked rocky floor like the attached map: small irregular paper flagstone scraps in close shades of dark slate, blue-grey and muted indigo-grey, thin darker cracks, a few tiny glossy wet highlights, calm and even.` |
| `ground_wet_planks.png` | `A storm-soaked wooden pier: narrow dark wet paper planks of deep brown and grey-brown card, all running the same direction, staggered joints, a few iron nail dots and thin glossy wet streaks, calm and even.` |
| `ground_rough_sea.png` | `Rough stormy sea water: small layered paper wave crests in close shades of deep navy, dark teal and blue-grey with a few small white paper foam flecks, calm and even in density.` |

## 2. น้ำวน → แยกไว้ที่ `FLOOR2_M4_WHIRLPOOL.md`

เจ้าของสั่ง (2026-11-19) ให้แยก prompt น้ำวนเป็นไฟล์ของมันเอง: น้ำวนกระดาษ 4 ชั้นที่หมุนคนละความเร็ว และคลื่นรอบขอบ

## 3. ของใหญ่ → `props.png` (4×3 **พื้นเขียว**)

ลำดับช่อง: `storm_rock_0` `storm_rock_1` `storm_rock_2` `wreck_0` / `wreck_1` `broken_mast` `coral_0` `coral_1` / `kraken_flag` `lamp_post` `rope_post` `anchor`

```
Now the map props for this Kraken Maelstrom, in EXACTLY the same papercraft style as the attached map: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. NOT pixel art. SAME camera as the map: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a big jagged dark slate rock with glossy wet edges; a tall sharp rock spire; a low cluster of dark rocks with a little dull seaweed; a smashed wooden ship's bow lying on the rocks.
Row 2: a broken section of a ship's hull with ribs showing; a snapped mast with a torn grey sail and loose ropes; a branching red coral; a cluster of short red tube coral with a small orange starfish.
Row 3: a tattered deep red flag with a cream octopus emblem on a crooked pole, as in the attached map; an old iron lamp post with a warm yellow glowing lantern; a thick wooden post with heavy rope looped around it; a big iron anchor lying against a rock.

Each object has crisp clean outer edges with no glow or halo around it except the lantern light. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no paper texture on the background, no ground patches, no water, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use bright green anywhere on the objects; any seaweed must be a dull dark olive.
```

## 4. ของเล็กบนพื้น → `decor.png` (4×3 **พื้นเขียว**)

เกมสุ่มของชิ้นเล็กเหล่านี้ไปวางทั่วแมพ ลำดับช่องต้องตรงตามนี้ เพราะเกมเลือกชิ้นตามเลขช่อง

```
Same papercraft style, NOT pixel art, the same camera. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one SMALL separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. These are tiny details scattered on the wet rocky floor, each only a little taller than a hero's knee. Row 1: a small pile of dark wet pebbles; one small flat dark stone; a small red coral sprig; an orange starfish lying flat. Row 2: a clump of dull dark olive seaweed; a small puddle seen from above with a glossy blue shine; a broken plank; a short piece of wet rope. Row 3: a few grey sea shells; a small splash of white sea foam; a single wooden barrel stave; a tiny cream octopus-sucker-shaped stone. Crisp clean edges. Background ONE perfectly flat solid pure bright green (#00FF00), no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the objects; any seaweed must be a dull dark olive.
```

ลำดับช่อง: 0 กรวด, 1 หินแบน, 2 ปะการัง, 3 ปลาดาว / 4 สาหร่าย, 5 แอ่งน้ำ, 6 เศษไม้, 7 เชือก / 8 เปลือกหอย, 9 ฟองคลื่น, 10 ไม้ถัง, 11 หินรูปปุ่มดูด

## 5. หน้าผาใต้เกาะและแผ่นดินลอย → `island_cliff.png` (4×2), `island_slabs.png` (4×2) **พื้นเขียว**

แบบเดียวกับชั้น 1 (`MAP1_FOREST.md` ข้อ 5–6) แต่เป็นหินพายุ เจนทีละภาพ

`island_cliff.png`:
```
Same papercraft style, NOT pixel art, same camera, light from the upper left. Generate an image: exactly 8 separate tall broken cliff columns, as if each was cut from under the near edge of this floating storm island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous empty space. Every column has the same structure, built from stacked layers of cut card and paper: at the very top a thin irregular lip of the dark wet rocky floor seen slightly from above, then dark slate and blue-grey rock made of stacked cardboard strata with sharp cracks and ledges and glossy wet edges, tapering down into 2 or 3 jagged points at the bottom. Each column fills most of its cell. All 8 are different in outline. Three of them have a thin white-and-turquoise paper waterfall pouring over the top lip, one has a small red coral growing on a ledge. Crisp clean edges. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no clouds, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the objects.
```

`island_slabs.png`:
```
Same papercraft style and rules, NOT pixel art. Generate an image: exactly 8 separate small floating rock slabs broken off the storm island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a dark wet rocky top seen from above in the same isometric view, layered dark slate rock under it, and a short jagged rock point at the bottom. Row 1: one with a broken mast stump, one with a small smashed hull piece, one with red coral, one with a tattered red octopus flag. Row 2: one with a barrel and rope, one with a tiny puddle and a thin waterfall spilling off its edge, one with a sharp rock spire, one bare and cracked. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no clouds, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the objects.
```

## 6. พื้นห้องบอส → `ground_room.png`

ห้องบอสคราเคนจะมีน้ำวนกลางลานแบบเดียวกับแมพหรือไม่ ยังไม่ตัดสิน (แผนข้อ 12) ถ้ามี ใช้น้ำวน 4 ชั้นจาก `FLOOR2_M4_WHIRLPOOL.md` วางทับได้เลย

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style, made of small cut pieces of card and paper with visible fibre. NOT pixel art. Viewed from straight above with no perspective. No focal point, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black. This is the floor of the kraken's arena: a ring of dark wet slate rock around a great whirlpool, small rough flagstone scraps in deep blue-grey and indigo-grey with thin streaks of white sea foam and glossy wet highlights, calm and even.
```

## 7. ของรอบลานห้องบอส → `room_props.png` (3×3 **พื้นเขียว**)

แท่นเรียกบอส (`lair`) ตั้งในแมพ ส่วนของอีก 8 ชิ้นวางรอบลานในห้องบอส
ลำดับช่อง: `summoner_kraken` `room_kraken_pillar_0` `room_kraken_wall` / `room_kraken_brazier` `room_kraken_boulder` `room_kraken_pillar_1` / `room_kraken_rubble` `room_kraken_coral` `room_kraken_mast`

```
Same papercraft style, NOT pixel art, the same isometric camera, cool stormy light from the upper left. Now the arena of the Kraken: a ring of dark wet slate rock around a great whirlpool in a storm, wrecked ship timber, red coral, rope and tattered red flags with an octopus emblem.

Generate an image: exactly 9 separate objects in a 3 columns x 3 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping.
Row 1: the boss summoning altar, about twice the height of a hero: a jagged dark rock altar on a few rough steps, wrapped by a curling purple kraken tentacle carved from stone with cream suckers, a round eye-shaped socket on its front glowing faintly turquoise; a tall broken dark rock pillar with sea foam splashed on it; a short section of wall made of smashed hull planks and rope.
Row 2: an iron brazier on a tripod with a warm yellow paper flame; a big dark wet boulder with barnacles; a smaller rock pillar wrapped in old rope.
Row 3: a pile of broken rock and ship planks; a tall branching red coral tree; a snapped mast with a tattered red octopus flag.

Crisp clean edges. Background ONE perfectly flat solid pure bright green (#00FF00), no gradient, no ground patches, no water, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the objects.
```

---

# ข. มอนกับบอส (แชทใหม่ แนบ M4)

## 8. มอน 4 ตัว → `raw/floor2_m4/monsters/<ชื่อ>_<ท่า>.png`

ใช้รูปแบบเดียวกับ `art_templates/papercraft_chars/MONSTERS.md`: แต่ละภาพเป็นตาราง 5 แถว (มุม) × 4 เฟรม
ประกอบ prompt จาก 3 ส่วน: **ข้อความกลาง** (ใส่สีพื้นหลังตามตาราง) + **บรรทัดท่า** + **บรรทัดหน้าตา** ของตัวนั้น

### ข้อความกลาง

แทน `<พื้นหลัง>` ด้วยข้อความในช่อง "พื้นหลัง" ของตาราง

```
Now a monster of this Kraken Maelstrom, in EXACTLY the papercraft style of the attached map and its creatures: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, slightly chibi proportions, cool stormy light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, on the same baseline in every cell (floating ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no splashes, no sparks, no projectiles. <พื้นหลัง>, no shadows, no ground, no water, no text, no labels, no numbers, no grid lines.
```

### บรรทัดท่าที่ใช้ซ้ำ

- **เดิน:** `The move: a smooth 4-frame walking loop in the direction it faces: frame 1 one side stepping forward, frame 2 passing, frame 3 the other side stepping forward, frame 4 passing, so frame 4 leads into frame 1. (A creature with no legs floats or hovers in place with a gentle bob instead.)`
- **ตี:** `The move: a 4-frame attack toward the direction it faces: frame 1 wind-up, pulling back; frame 2 striking forward; frame 3 the hit at full reach; frame 4 recovering back to its normal pose. The attack: <ท่าตีจากตาราง>`

### หน้าตาและพื้นหลัง

ลำดับในตาราง = จากต้นแมพ (เลเวลต่ำ) ไปหาแท่นเรียกบอส

| ตัว | พื้นหลัง (แทน `<พื้นหลัง>`) | บรรทัดหน้าตา |
|---|---|---|
| `shark_knight` อัศวินฉลาม | `Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the monster` | `The monster: the shark knight, a muscular grey shark standing on two legs with a fierce toothy grin, a white belly, a big dorsal fin on its back, wearing dark steel armour with gold trim and a torn navy cape, holding a golden trident, as in the attached map.` |
| `seahorse_soldier` ม้าน้ำทหาร | `Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the monster` | `The monster: the seahorse soldier, a proud orange-gold seahorse floating upright with a curled tail, wearing a small teal coral helmet and a little shell breastplate, a long snout like a cannon barrel.` |
| `ghost_pirate_king` ราชาโจรสลัดผี | `Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the monster` | `The monster: the ghost pirate king, a tall regal pirate ghost of semi-translucent glowing teal tissue paper with a crown-topped captain's hat and gold epaulettes, his ghostly body fused with sea creatures: a few teal octopus tentacles for a beard, one arm ending in a crab claw, a fish fin on his back and barnacles on his shoulders, the lower body fading into a wispy tail, a glowing teal cutlass in the other hand, as the ghost captain in the attached map.` |
| `kraken_tentacle` หนวดคราเคน | `Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the monster` | `The monster: a single huge kraken tentacle rising straight up out of the ground, deep purple with lighter violet streaks, a row of big round cream suckers along its inner side, curling at the tip, as in the attached map. The base is cut cleanly at the bottom of the cell, with no water and no splash.` |

### ภาพของแต่ละตัว

| ไฟล์ | บรรทัดท่า |
|---|---|
| `shark_knight_walk.png` | บรรทัดเดิน |
| `shark_knight_attack.png` | บรรทัดตี + `it draws the golden trident back and thrusts it forward with both hands.` |
| `shark_knight_dive.png` | `The move: a 4-frame dive and burst: frame 1 crouching low; frame 2 sinking down into the ground up to the chest; frame 3 fully under, only the tip of the big dorsal fin showing above the ground line; frame 4 bursting up out of the ground with the trident thrust high, jaws wide open.` |
| `seahorse_soldier_walk.png` | บรรทัดเดิน |
| `seahorse_soldier_shoot.png` | บรรทัดตี + `it puffs up its cheeks, leans back, then snaps its long snout forward as if firing a shot from it. No bubble, no effects.` |
| `ghost_pirate_king_walk.png` | บรรทัดเดิน |
| `ghost_pirate_king_slash.png` | `The move: a 4-frame wave slash toward the direction it faces: frame 1 raising the glowing cutlass high behind him; frame 2 sweeping it down in a wide arc; frame 3 the cutlass pointing straight forward at full reach, as if sending a wave of power ahead; frame 4 recovering back to his normal pose.` |
| `kraken_tentacle_idle.png` | `The move: a 4-frame idle loop, the tentacle swaying slowly from side to side and curling its tip, the base never moving, so frame 4 leads into frame 1. Use this instead of a walk.` |
| `kraken_tentacle_slam.png` | `The move: a 4-frame slam toward the direction it faces: frame 1 rearing up tall and curling back; frame 2 whipping forward; frame 3 lying stretched out long and flat along the ground in front of it, the full length of the slam; frame 4 rising back up to its normal pose.` |

## 9. บอสคราเคน → `raw/floor2_m4/monsters/kraken_<ท่า>.png` (**พื้นเขียว**)

คราเคนอยู่ใต้น้ำวน ไม่เดิน (แผนหัวข้อ 5.4) ต้องตัดหนวดให้ขาดก่อน หัวถึงจะโผล่ให้ตี
ใช้ข้อความกลางของข้อ 8 แบบพื้นเขียว แต่บอสตัวใหญ่มาก ภาพละ 1 ท่า รวม 5 ภาพ: ข้อความกลาง + บรรทัดท่าจากตาราง + บรรทัดหน้าตา
หัวคราเคนกับหนวดบอสเป็นคนละชิ้นกัน เกมวางหนวดรอบลานแยกจากหัว
- **ภาพหัว** (3 ภาพแรก) ปิดท้ายด้วยบรรทัดหัว
- **ภาพหนวด** (2 ภาพหลัง) ปิดท้ายด้วยบรรทัดหนวด

บรรทัดหัว:
```
The monster: the Kraken, a colossal boss: only its huge round head and the top of its body rising out of the ground, as if out of a whirlpool, about three times the width of a hero, deep purple with lighter violet streaks and cream spots, two enormous glowing turquoise eyes with fierce brows, a curved beak below, a few short tentacle stubs curling around its base. The base is cut cleanly at the bottom of the cell, with no water and no splash.
```

บรรทัดหนวด:
```
The monster: one of the Kraken's giant arms, a huge tentacle rising out of the ground, about twice the height of a hero, deep purple with lighter violet streaks, a row of big round cream suckers along its inner side, scarred and covered in a few barnacles. The base is cut cleanly at the bottom of the cell, with no water and no splash.
```

| ไฟล์ | บรรทัดท่า |
|---|---|
| `kraken_idle.png` | `The move: a 4-frame idle loop, the head slowly rising and sinking a little, the eyes blinking once, the short tentacle stubs curling, so frame 4 leads into frame 1.` |
| `kraken_ink.png` | `The move: a 4-frame ink spit toward the direction it faces: frame 1 drawing the head back and puffing up; frame 2 leaning forward; frame 3 the beak wide open at full reach as if spitting; frame 4 settling back. No ink, no effects.` |
| `kraken_dive.png` | `The move: a 4-frame sink and rise: frame 1 normal pose; frame 2 sinking down to the eyes; frame 3 almost gone, only the top of the head showing; frame 4 rising back up with the eyes wide open.` |
| `kraken_arm_slam.png` | `The move: a 4-frame slam toward the direction it faces: frame 1 rearing up tall and curling back; frame 2 whipping forward; frame 3 lying stretched out long and flat along the ground in front of it; frame 4 rising back up to its normal pose.` |
| `kraken_arm_cut.png` | `The move: a 4-frame severed arm: frame 1 the tentacle reeling back as if hit hard; frame 2 the upper part breaking off at a clean cut; frame 3 only a short stump left, twitching; frame 4 the stump sinking down into the ground.` |

---

# ค. เอฟเฟกต์และไอคอนกุญแจ (แชทใหม่ แนบ M4)

## 10. เอฟเฟกต์ท่าใหม่ → `fx.png` (4×2 พื้นม่วงแดง)

หมึกเป็นสีน้ำเงินเข้มเกือบดำ ไม่ใช่สีม่วง จึงใช้พื้นม่วงแดงได้
ลำดับช่อง: `fx_shark_fin` `fx_bubble` `fx_bubble_trap` `fx_sword_wave` / `fx_ink_blob` `fx_ink_splat` `fx_suction` `fx_slam_splash`

```
Now combat effects for this Kraken Maelstrom, in EXACTLY the papercraft style of the attached map: built from layered cut coloured paper, translucent tissue paper and foil with visible fibre and small drop shadows between the layers; water and energy shown as bright translucent tissue-paper shapes with paper sparkles, not blurry light. NOT pixel art.
Generate an image: exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a grey shark dorsal fin cutting through the ground with a small V-shaped wake of white paper foam, seen in the isometric view; a single round translucent water bubble with a white highlight, flying; a big translucent water bubble large enough to hold a person, empty inside, with a white highlight and a few small bubbles around it; a long horizontal crescent wave of glowing teal energy and water, like a sword slash flying forward.
Row 2: a blob of very dark navy-black ink flying with a few drops trailing; a big splat of very dark navy-black ink seen from the front, with drips, as if splashed on glass; a ring of curved turquoise and white suction lines spiralling inward toward the centre, seen STRAIGHT FROM ABOVE as a perfect circle; a tall burst of turquoise and white water splash with flying drops, as when a tentacle slams down.
No characters, no text, no labels, no numbers, no grid lines. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no shadows on the background. Do not use pink, magenta or purple on any effect.
```

## 11. ไอคอนกุญแจบอส "ตาคราเคน" → `key_kraken_eye.png`

แบบเดียวกับไอคอนกุญแจของแมพ 1–3 (ของลอย ๆ ไม่มีพื้นหลังหรือกรอบ)

```
Now one item icon for this game, in EXACTLY the papercraft style of the attached map: layered cut coloured paper, card and foil with visible fibre and small drop shadows between the layers. NOT pixel art. Generate a SQUARE image (1:1): one boss key item, the Kraken's eye, a round glowing turquoise eye gem with a dark slit pupil, set in a ring of tarnished gold with three small curling tentacle shapes of deep purple paper wrapped around it, a short loop of rope tied to the top, a few tiny paper sparkles. One bold clear shape centred in the image, filling most of it, that reads at very small size. No frame, no icon background, no ground, no shadow, no text. Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the item.
```

---

## สำหรับคนใส่เข้าเกม

| ไฟล์ดิบ | ชิ้น |
|---|---|
| `ground_storm_rock.png` `ground_wet_planks.png` `ground_rough_sea.png` `ground_room.png` | ภาพพื้นปูซ้ำ 1024×1024 แบบ `ground/*` ของชั้น 1 (`ground_rough_sea` เป็นน้ำ เดินไม่ได้) |
| `props.png` (พื้นเขียว) | `storm_rock_0` `storm_rock_1` `storm_rock_2` `wreck_0` / `wreck_1` `broken_mast` `coral_0` `coral_1` / `kraken_flag` `lamp_post` `rope_post` `anchor` |
| `decor.png` (พื้นเขียว) | atlas `decor_maelstrom` ช่องละ 128 แบบ `decor_forest` |
| `island_cliff.png` `island_slabs.png` (พื้นเขียว) | `island_cliff_maelstrom` `island_slabs_maelstrom` แบบชั้น 1 |
| `room_props.png` (พื้นเขียว) | `summoner_kraken` + `room_kraken_*` 8 ชิ้น |
| `monsters/*` | แผ่น 5 แถว × 4 เฟรม: `shark_knight` 3 ท่า, `seahorse_soldier` 2, `ghost_pirate_king` 2, `kraken_tentacle` 2 (พื้นเขียว), `kraken` 5 (พื้นเขียว) |
| `fx.png` | `fx_shark_fin` `fx_bubble` `fx_bubble_trap` `fx_sword_wave` / `fx_ink_blob` `fx_ink_splat` `fx_suction` `fx_slam_splash` |
| `key_kraken_eye.png` (พื้นเขียว) | ไอคอนกุญแจ 96×96 แบบไอคอนกุญแจชั้น 1 |

- ภาพน้ำวนกับคลื่นขอบ ดูวิธีใส่เข้าเกมใน `FLOOR2_M4_WHIRLPOOL.md`
- ราชาโจรสลัดผีโปร่งแสง ตอนตัดภาพต้องเก็บความโปร่งแสงไว้แบบมอนผีแมพ 3
- `tools/cut_papercraft.cjs` ยังไม่มีชุดของแมพนี้ ต้องเพิ่มตอนทำ PR `feature/floor2-map4` และต้องรองรับแผ่นพื้นเขียว
- ชื่อชิ้นข้างบนเป็นชื่อที่เสนอ เปลี่ยนได้ตอนใส่เข้าเกม
