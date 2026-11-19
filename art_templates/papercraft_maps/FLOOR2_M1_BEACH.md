# แมพ 1 ชั้น 2: หาดเรือแตก (`shipwreck_beach`, Lv41–50)

แผนอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 2, 5.1, 6 และ 10 ส่วนหน้าตาแมพยึดภาพ `M1_shipwreck_beach` ที่เจ้าของยืนยันแล้ว
⚠️ ภาพ M1 เจนก่อนเปลี่ยนรายชื่อมอน ในภาพจึงมีลูกเรือเมาอยู่ ไม่ต้องทำตัวนั้น ให้ยึดรายชื่อมอนในไฟล์นี้

## วิธีเจน

- เจนแยกเป็น 3 แชท: **ก.** ฉากแมพ (ข้อ 1–6) **ข.** มอนกับบอส (ข้อ 7–8) **ค.** เอฟเฟกต์กับไอคอนกุญแจ (ข้อ 9–10)
- แต่ละแชท**เปิดใหม่** แล้วแนบ `art_templates/papercraft_maps/raw/floor2_maps/M1_shipwreck_beach.webp` ภาพเดียว
  - **ห้ามแนบภาพพิกเซล** ทุกภาพในเกมใช้กระดาษตัดแปะสไตล์เดียว (กติกาเจ้าของ 2026-11-18) ถ้าแนบภาพอื่นด้วย ต้องเป็นภาพกระดาษเท่านั้น
- ภาพแรกของแต่ละแชท ให้ขึ้นต้นด้วยประโยคเปิดนี้ก่อน prompt ของข้อนั้น:

```
The attached image is the approved concept of a map in my game, the Shipwreck Beach. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, warm soft lighting from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_m1/` ตามชื่อไฟล์ของแต่ละข้อ (ภาพมอนเซฟใน `raw/floor2_m1/monsters/`) โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`
- ลำดับช่องอ่านจากซ้ายไปขวา แถวบนลงล่าง (`/` คือขึ้นแถวใหม่)

หน้าตาแมพ: หาดทรายสีครีมอุ่นบนเกาะลอยกลางทะเลเมฆ ซากเรือไม้ ต้นมะพร้าว หินทะเลสีเทาอมม่วงอ่อน แอ่งน้ำทะเลสีเทอร์ควอยซ์ ปลาดาว เปลือกหอย ดอกชบาแดง หีบสมบัติกับเหรียญทอง น้ำตกไหลลงจากขอบเกาะ สดใส แดดจ้า

---

# ก. ฉากแมพ

## 1. พื้นปูซ้ำ 3 ภาพ → `ground_sand.png`, `ground_wreck.png`, `ground_shallow.png`

เจนทีละภาพ ขึ้นต้นด้วยข้อความกลาง แล้วต่อท้ายด้วยข้อความในตาราง
เกมเอาภาพพื้นมาปูต่อกันซ้ำ ๆ ถ้ามีชิ้นใหญ่หรือชิ้นที่สะดุดตา จะเห็นลายซ้ำทั้งแมพ จึงต้องเป็นลายละเอียดที่สีใกล้กันทั้งภาพ

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style: the ground is made of many SMALL overlapping scraps of cut and torn coloured paper with visible paper fibre, all about the same small size, evenly spread. NOT pixel art. Viewed from straight above with no perspective. No focal point, no single large shape, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast: 4 to 5 close shades only, nothing bright, nothing near black, no objects lying on it.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_sand.png` | `Warm sunny beach sand like the attached map: tiny torn paper scraps in close shades of cream, pale gold and light warm beige, a few tiny paper grains and faint wind ripples, calm and even.` |
| `ground_wreck.png` | `A walkway of old salvaged shipwreck planks: narrow weathered paper planks of grey-brown and faded honey card, all running the same direction, staggered joints, a few rusty nail dots, a little sand in the seams, calm and even.` |
| `ground_shallow.png` | `Shallow clear tide water over sand: small layered paper ripples in close shades of turquoise and pale aqua with a hint of the cream sand showing through, a few tiny white paper foam flecks, calm and even.` |

## 2. ของใหญ่ → `props.png` (4×3 พื้นม่วงแดง)

ลำดับช่อง: `palm_0` `palm_1` `palm_2` `wreck_hull` / `wreck_mast` `sea_rock_0` `sea_rock_1` `rock_pillar` / `hibiscus` `fern` `giant_clam` `broken_ladder`

```
Now the map props for this Shipwreck Beach, in EXACTLY the same papercraft style as the attached map: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. NOT pixel art. SAME camera as the map: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a small young coconut palm tree; a medium leaning coconut palm with a bunch of coconuts; a tall curved coconut palm; the large broken wooden hull of a wrecked ship lying on its side in the sand, ribs showing through holes, from the attached map.
Row 2: a broken ship's mast with a torn cream-and-red sail and tangled rope; a big grey sea rock with a lilac tint and a little paper seaweed at its base; a smaller cluster of two grey sea rocks; a tall jagged column of layered grey sea rock.
Row 3: a tropical bush with big red hibiscus flowers; a lush green fern bush; a giant half-open clam shell with a pearl inside; a broken wooden ladder leaning on a pile of planks.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no sand patches, no ground, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 3. ของสมบัติและซากเรือ → `camp.png` (4×3 พื้นม่วงแดง)

ลำดับช่อง: `treasure_chest` `crates` `barrel` `lantern` / `plank_pile` `anchor` `rowboat` `old_cannon` / `sign` `pirate_flag` `tide_pool` `coin_pile`

```
Same papercraft style, NOT pixel art, the same isometric camera, light from the upper left, the same scale as the props before. Now the treasure and shipwreck pieces scattered on the beach in the attached map.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: an open wooden treasure chest overflowing with gold coins; a stack of two old wooden crates; a wooden barrel with iron hoops; a brass ship's lantern with a warm glow inside, standing on the sand.
Row 2: a pile of broken shipwreck planks; a big rusty iron anchor stuck at an angle in the sand; a small beached wooden rowing boat lying on its side with one oar; an old bronze ship's cannon on a broken wooden carriage.
Row 3: a crooked wooden signpost; a tattered black pirate flag with a white skull on a leaning pole; a small round rock tide pool with turquoise water, a red starfish and a little seaweed; a small heap of spilled gold coins and a pearl necklace.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no sand patches, no ground, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 4. ของเล็กบนพื้น → `decor.png` (4×3 พื้นม่วงแดง)

เกมสุ่มของชิ้นเล็กเหล่านี้ไปวางทั่วหาด ลำดับช่องต้องตรงตามนี้ เพราะเกมเลือกชิ้นตามเลขช่อง

```
Same papercraft style, NOT pixel art, the same camera. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one SMALL separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. These are tiny details scattered on the beach sand, each only a little taller than a hero's knee. Row 1: one cream spiral sea shell; a small scallop shell and a cone shell together; a red starfish lying flat; an orange starfish lying flat. Row 2: a small pile of three smooth pebbles; a tangle of green-brown seaweed; a short piece of bleached driftwood; a small tuft of beach grass. Row 3: a small clump of red hibiscus flowers; a tiny crab hole with a little ring of sand; two gold coins half buried in the sand; a broken piece of a wooden plank. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: 0 เปลือกหอยเกลียว, 1 เปลือกหอยคู่, 2 ปลาดาวแดง, 3 ปลาดาวส้ม / 4 กรวด, 5 สาหร่าย, 6 ไม้ลอยน้ำ, 7 หญ้าชายหาด / 8 ดอกชบา, 9 รูปู, 10 เหรียญทอง, 11 เศษไม้กระดาน

## 5. หน้าผาใต้เกาะและแผ่นดินลอย → `island_cliff.png` (4×2), `island_slabs.png` (4×2)

แบบเดียวกับชั้น 1 (`MAP1_FOREST.md` ข้อ 5–6) แต่เป็นหาดทรายกับหินทะเล เจนทีละภาพ

`island_cliff.png`:
```
Same papercraft style, NOT pixel art, same camera, light from the upper left. Generate an image: exactly 8 separate tall broken cliff columns, as if each was cut from under the near edge of this floating beach island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous empty space. Every column has the same structure, built from stacked layers of cut card and paper: at the very top a thin irregular lip of cream beach sand seen slightly from above, with a little beach grass, then about one quarter packed tan sand layers with a few pale roots, then grey sea rock with a soft lilac tint made of stacked cardboard strata with cracks, ledges and a few barnacles, tapering down into 2 or 3 jagged points at the bottom. Each column fills most of its cell. All 8 are different in outline. Three of them have a thin turquoise paper waterfall pouring over the top lip and down the rock. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no clouds, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

`island_slabs.png`:
```
Same papercraft style and rules, NOT pixel art. Generate an image: exactly 8 separate small floating land slabs broken off the beach island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a cream sand top seen from above in the same isometric view, layered tan sand and grey sea rock under it, and a short jagged rock point at the bottom. Row 1: four slabs each carrying one or two small coconut palms. Row 2: one with a broken shipwreck plank and a barrel, one with a grey sea rock and a starfish, one with a tiny tide pool and a thin waterfall spilling off its edge, one bare with a few shells. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no clouds, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 6. ห้องบอสปูยักษ์ → `ground_room.png`, `room_props.png` (3×3 พื้นม่วงแดง)

แท่นเรียกบอส (`lair`) ตั้งในแมพ ส่วนของอีก 8 ชิ้นวางรอบลานในห้องบอส
ลำดับช่องของ `room_props.png`: `summoner_crab` `room_beach_pillar_0` `room_beach_wall` / `room_beach_brazier` `room_beach_boulder` `room_beach_pillar_1` / `room_beach_rubble` `room_beach_rune_stone` `room_beach_tree`

`ground_room.png`:
```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style, made of small cut pieces of card and paper with visible fibre. NOT pixel art. Viewed from straight above with no perspective. No focal point, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black. This is the floor of the giant crab's arena: damp packed sand in warm beige and soft grey with faint wave ripple marks, a few tiny broken shells and small wet dark patches, calm and even.
```

`room_props.png`:
```
Same papercraft style, NOT pixel art, the same isometric camera, light from the upper left. Now the giant crab's den on the Shipwreck Beach: grey sea rock with a lilac tint, barnacles, coral, seaweed and broken ship timber, deep claw marks scratched into the rock.

Generate an image: exactly 9 separate objects in a 3 columns x 3 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping.
Row 1: the boss summoning altar, about twice the height of a hero: a squat altar of barnacle-covered sea rock and bright orange coral standing on a few rock steps, topped with a huge empty crab claw shell, with a claw-shaped socket on its front glowing faintly gold; a tall broken sea rock pillar crusted with barnacles; a short section of wall made of stacked shipwreck timbers lashed with rope.
Row 2: a standing brass ship's lantern on a wooden post with a layered paper flame; a large barnacle-covered sea boulder with seaweed; a smaller broken rock pillar with a starfish on it.
Row 3: a pile of broken rock and smashed ship planks; a tall carved driftwood totem with a glowing gold crab-claw symbol; a big leaning coconut palm.

Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no sand patches, no ground, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

---

# ข. มอนกับบอส (แชทใหม่ แนบ M1)

## 7. มอน 4 ตัว → `raw/floor2_m1/monsters/<ชื่อ>_walk.png`, `<ชื่อ>_attack.png`

ใช้รูปแบบเดียวกับ `art_templates/papercraft_chars/MONSTERS.md`: ตัวละ 2 ภาพ (เดิน ตี) แต่ละภาพเป็นตาราง 5 แถว (มุม) × 4 เฟรม เจ้าของเลือก (2026-11-19) ให้มีแค่ท่าเดินกับท่าตีเหมือนชั้น 1
ประกอบ prompt จาก 3 ส่วน: **ข้อความกลาง** + **ท่า** (เดินหรือตี) + **บรรทัดมอนตัวนั้น** จากตาราง

### ข้อความกลาง

```
Now a monster of this Shipwreck Beach, in EXACTLY the papercraft style of the attached map and its creatures: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the monster.
```

### ท่าเดิน → `<ชื่อ>_walk.png`

```
The move: a smooth 4-frame walking loop in the direction it faces: frame 1 one side stepping forward, frame 2 passing, frame 3 the other side stepping forward, frame 4 passing, so frame 4 leads into frame 1. (A creature with no legs bounces, slithers or hovers in place with a gentle bob instead.)
```

### ท่าตี → `<ชื่อ>_attack.png`

```
The move: a 4-frame attack toward the direction it faces: frame 1 wind-up, pulling back; frame 2 striking forward; frame 3 the hit at full reach; frame 4 recovering back to its normal pose. The attack: <ใส่ช่อง "ท่าตี" ของตัวนั้น>
```

ปิดท้ายด้วย: `The monster: <ใส่ช่อง "หน้าตา" ของตัวนั้น>`

ลำดับในตาราง = จากต้นแมพ (เลเวลต่ำ) ไปหาแท่นเรียกบอส

| ไฟล์ | หน้าตา | ท่าตี |
|---|---|---|
| `hermit_crab` | the hermit crab: a red-orange hermit crab with two big claws, stalk eyes and angry brows, living in a cracked cream spiral sea shell decorated with a red starfish and a little seaweed, as in the attached map | it ducks into its shell, then bursts out and snaps forward with its bigger claw |
| `thief_gull` | the thief seagull: a plump white seagull with grey wings, a yellow beak and yellow legs and a sly greedy look, flying just above the ground with its wings spread, as in the attached map | it rises up, then swoops forward and snatches with its beak |
| `shock_eel` | the shock eel: a long dark navy-blue eel with bright yellow glowing spots along its body, small fins and a wide grumpy mouth, its head and front half raised up off the ground with the tail coiled under it | it coils back, then lunges forward with its jaws open, its yellow spots glowing brighter |
| `spike_turtle` | the spike turtle: a big stocky green sea turtle with a grumpy face and a dark brown shell covered in large silver-white spikes, as in the attached map | it pulls its head back, then thrusts forward and bites |

## 8. บอสปูยักษ์กระดองปืนใหญ่ → `raw/floor2_m1/monsters/giant_crab_<ท่า>.png`

ใช้ข้อความกลางของข้อ 7 แต่บอสตัวใหญ่ราว 3 เท่าของฮีโร่ ภาพละ 1 ท่า รวม 4 ภาพ: ข้อความกลาง + บรรทัดท่าจากตาราง + บรรทัดหน้าตาบอส
ท่าของบอสอยู่ในแผนหัวข้อ 5.1

บรรทัดหน้าตาบอส (ปิดท้ายทุกภาพ):
```
The monster: the Giant Cannon Crab, a large imposing boss about three times the height of a hero: a huge red-orange crab with thick armoured legs, one enormous claw and one smaller claw, stalk eyes with fierce brows, its wide barnacle-covered shell carrying an old bronze ship's cannon mounted on top like a turret, a little seaweed and a starfish stuck to the shell.
```

| ไฟล์ | ท่า (บรรทัดกลาง) |
|---|---|
| `giant_crab_walk.png` | `The move: a smooth 4-frame scuttling loop, the legs stepping in turn like a crab, so frame 4 leads into frame 1.` |
| `giant_crab_claw.png` | `The move: a 4-frame grab and fling toward the direction it faces: frame 1 raising the enormous claw wide open; frame 2 snapping it forward and shut; frame 3 lifting the closed claw high; frame 4 swinging it hard to the side as if throwing something away.` |
| `giant_crab_cannon.png` | `The move: a 4-frame cannon shot: frame 1 crouching and tilting the shell so the cannon points up into the air; frame 2 bracing; frame 3 the whole body jolting back from the recoil; frame 4 settling back to its normal pose. No smoke, no flash, no cannonball.` |
| `giant_crab_shell.png` | `The move: a 4-frame hide in the shell: frame 1 normal pose; frame 2 pulling the legs and claws in; frame 3 fully hidden inside the shell, only the shell and cannon showing; frame 4 eyes peeking out from under the shell.` |

---

# ค. เอฟเฟกต์และไอคอนกุญแจ (แชทใหม่ แนบ M1)

## 9. เอฟเฟกต์ท่าใหม่ → `fx.png` (3×2 พื้นเขียว)

ใช้พื้นเขียว เพราะไฟฟ้ากับวงเตือนอาจออกโทนชมพู/ม่วง
ลำดับช่อง: `fx_cannonball` `fx_warn_ring` `fx_chain_bolt` / `fx_shock` `fx_spike_burst` `fx_shell_guard`

```
Now combat effects for this Shipwreck Beach, in EXACTLY the papercraft style of the attached map: built from layered cut coloured paper, tissue paper and foil with visible fibre and small drop shadows between the layers; glow and energy shown as bright translucent tissue-paper shapes with paper sparkles, not blurry light. NOT pixel art.
Generate an image: exactly 6 separate objects in a 3 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a round black iron cannonball with a lit fuse trailing a few orange paper sparks, flying; a warning circle seen STRAIGHT FROM ABOVE, a perfect circle of a thick red-orange dashed ring with a small crosshair in the middle, mostly empty inside; a horizontal zigzag lightning bolt of bright yellow and white tissue paper with a few small sparks, long and thin, to be stretched between targets.
Row 2: a round burst of yellow and white electric sparks and short zigzag bolts, as when someone is shocked; a burst of silver-white paper spikes flying outward in a ring, as when spikes reflect a hit; a translucent glowing pale-gold dome of layered tissue paper, a shield over a hiding crab, seen in the same isometric view.
No characters, no text, no labels, no numbers, no grid lines. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no shadows on the background. Do not use bright green anywhere on the effects.
```

## 10. ไอคอนกุญแจบอส "ก้ามปูทอง" → `key_crab_claw.png`

เจ้าของเลือก (2026-11-19) ใส่ไว้ในไฟล์นี้ ใช้แบบไอคอนไอเทมของ `art_templates/papercraft_icons/PROMPTS.md` (ของลอย ๆ ไม่มีพื้นหลังหรือกรอบ)

```
Now one item icon for this game, in EXACTLY the papercraft style of the attached map: layered cut coloured paper, card and gold foil with visible fibre and small drop shadows between the layers. NOT pixel art. Generate a SQUARE image (1:1): one boss key item, a golden crab claw, the claw half open, made of shiny layered gold foil paper with darker gold edges, a small turquoise gem set at its base and a short loop of red cord tied to it, a few tiny paper sparkles. One bold clear shape centred in the image, filling most of it, that reads at very small size. No frame, no icon background, no ground, no shadow, no text. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the item.
```

---

## สำหรับคนใส่เข้าเกม

| ไฟล์ดิบ | ชิ้น |
|---|---|
| `ground_sand.png` `ground_wreck.png` `ground_shallow.png` `ground_room.png` | ภาพพื้นปูซ้ำ 1024×1024 แบบ `ground/*` ของชั้น 1 (`ground_shallow` เป็นน้ำ เดินไม่ได้) |
| `props.png` | `palm_0` `palm_1` `palm_2` `wreck_hull` / `wreck_mast` `sea_rock_0` `sea_rock_1` `rock_pillar` / `hibiscus` `fern` `giant_clam` `broken_ladder` |
| `camp.png` | `treasure_chest` `crates` `barrel` `lantern` / `plank_pile` `anchor` `rowboat` `old_cannon` / `sign` `pirate_flag` `tide_pool` `coin_pile` |
| `decor.png` | atlas `decor_beach` ช่องละ 128 แบบ `decor_forest` |
| `island_cliff.png` `island_slabs.png` | `island_cliff_beach` `island_slabs_beach` แบบชั้น 1 |
| `room_props.png` | `summoner_crab` + `room_beach_*` 8 ชิ้น |
| `monsters/*` | แผ่น 5 แถว × 4 เฟรม มอน 4 ตัว × 2 ท่า + บอส 4 ท่า |
| `fx.png` (พื้นเขียว) | `fx_cannonball` `fx_warn_ring` `fx_chain_bolt` / `fx_shock` `fx_spike_burst` `fx_shell_guard` |
| `key_crab_claw.png` | ไอคอนกุญแจ 96×96 แบบไอคอนกุญแจชั้น 1 |

- `tools/cut_papercraft.cjs` ยังไม่มีชุดของแมพนี้ ต้องเพิ่มตอนทำ PR `feature/floor2-map1`
- ชื่อชิ้นข้างบนเป็นชื่อที่เสนอ เปลี่ยนได้ตอนใส่เข้าเกม
