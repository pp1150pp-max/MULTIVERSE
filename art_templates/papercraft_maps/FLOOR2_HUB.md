# เมืองท่าเรือมิติ (`harbor_town`) เมืองกลางชั้น 2

แผนอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 3 และ 10 ส่วนหน้าตาเมืองยึดภาพ `M0b_harbor_docks` ที่เจ้าของยืนยันแล้ว (2026-11-19) ภาพ `M0_harbor_town` ผังแรกที่เป็นเกาะหินเลิกใช้แล้ว
**ทั้งเมืองสร้างบนท่าไม้**: แพไม้กระดานหลายแผ่นบนเสาในน้ำ ระหว่างแพเป็นน้ำ เชื่อมด้วยสะพานไม้กับราวเชือก ไม่มีเกาะหิน ไม่มีกำแพงหิน
เมืองนี้**ไม่มีทุ่งมอน** ทั้ง 4 ทิศ (บน ขวา ซ้าย ล่าง) เป็นท่าเรือยาว ปลายท่าแต่ละท่าเป็นจุดวาร์ปไปแมพฟาร์ม ประตูกลับชั้น 1 อยู่ข้างหอประภาคารมุมขวาบน

## วิธีเจน

- **เปิดแชทใหม่** แล้วแนบ `art_templates/papercraft_maps/raw/floor2_maps/M0b_harbor_docks.webp` ภาพเดียว
  - **ห้ามแนบภาพพิกเซล** ทุกภาพในเกมใช้กระดาษตัดแปะสไตล์เดียว (กติกาเจ้าของ 2026-11-18) ถ้าแนบภาพอื่นด้วย ต้องเป็นภาพกระดาษเท่านั้น
- เจนทุกข้อต่อกันในแชทเดียว จะได้สไตล์ตรงกัน ถ้าแชทยาวจนสไตล์เริ่มเพี้ยน ให้เปิดแชทใหม่ แนบ M0b อีกครั้ง แล้วใช้ประโยคเปิดเหมือนเดิม
- ภาพแรกของแชท ให้ขึ้นต้นด้วยประโยคเปิดนี้ก่อน prompt ของข้อนั้น:

```
The attached image is the approved concept of my game's harbour town. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, warm soft lighting from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_hub/` ตามชื่อไฟล์ของแต่ละข้อ (โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`)
- ลำดับช่องอ่านจากซ้ายไปขวา แถวบนลงล่าง (`/` คือขึ้นแถวใหม่)

หน้าตาเมือง: เมืองท่าไม้ลอยบนน้ำทะเลเมฆสีฟ้าเทอร์ควอยซ์ น้ำไหลตกขอบเมืองลงไปในเมฆ ไม้สีน้ำตาลอุ่น หินสีทรายกับเทาอ่อนเฉพาะประภาคารและซุ้มประตู ทองเหลือง ธงสีแดง น้ำเงิน ทอง เถาไม้กับดอกไม้ ต้นมะพร้าว สดใส มีชีวิตชีวา

---

## 1. พื้นปูซ้ำ 3 ภาพ → `ground_plank.png`, `ground_plaza.png`, `ground_water.png`

เจนทีละภาพ ขึ้นต้นด้วยข้อความกลาง แล้วต่อท้ายด้วยข้อความในตาราง
เกมเอาภาพพื้นมาปูต่อกันซ้ำ ๆ ถ้ามีชิ้นใหญ่หรือชิ้นที่สะดุดตา จะเห็นลายซ้ำทั้งเมือง จึงต้องเป็นลายละเอียดที่สีใกล้กันทั้งภาพ

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style: made of many SMALL cut and torn coloured paper pieces with visible paper fibre, all about the same small size, evenly spread. NOT pixel art. Viewed from straight above with no perspective. No focal point, no single large shape, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast: 4 to 5 close shades only, nothing bright, nothing near black, no objects lying on it.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_plank.png` | `Weathered wooden dock planks like the piers in the attached town: narrow parallel paper planks of warm honey and light brown card, all running the same direction, staggered joints, tiny nail dots and faint wood grain, calm and even.` |
| `ground_plaza.png` | `The deck of the round central plaza in the attached image: short wide paper planks of warm pinkish tan and light honey card laid like small bricks in staggered rows, thin dark seams, a few tiny nail dots, calm and even.` |
| `ground_water.png` | `The turquoise sea between the wooden platforms in the attached image: many small layered paper ripples and tiny curled wave crests in close shades of turquoise and soft sky blue with a few small white paper foam flecks, calm and even.` |

## 2. อาคาร A → `buildings_a.png` (2×2 พื้นม่วงแดง)

ลำดับช่อง: `bld_supply` `bld_broker` / `bld_forge` `bld_warehouse`

```
Now the buildings of the harbour town, taken from the attached concept: use it for the DESIGN, colours and details. Same papercraft style, NOT pixel art. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, as in classic isometric RPGs: we see the roof and two walls, the lower-left wall and the lower-right wall, and each building's base sits on an imaginary diamond-shaped ground footprint. NOT a flat front view. Light from the upper left. All four buildings at the SAME scale, as if standing in the same town. Warm timber, sandstone and pale grey stone card, brass fittings, glowing warm windows and lanterns, a little paper ivy and some flowers.

Generate an image: a prop sheet with exactly 4 separate buildings in a 2 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1:
- Ship's supply shop: a timber shop with a red tiled roof and a red-and-cream striped cloth awning, a counter of bread, fruit, cheese, bottles and jars, sacks of flour and baskets in front, a hanging shop sign with a small anchor. Its front and awning are on the LOWER-RIGHT wall.
- Harbour broker's office: a small timber office with a dark wood frame and a teal roof, a large wooden notice board covered in pinned paper notices beside the door, a lantern, a small chest and a little brass scale on a table outside. Its front and notice board face the LOWER-RIGHT.
Row 2:
- Shipyard forge: stone walls, a blue-slate roof, a stone chimney with a small puff of smoke, an open front showing a glowing orange furnace, an anvil, a big iron anchor and racks of tools outside. Its open front is on the LOWER-LEFT wall.
- Harbour warehouse: a big wooden boathouse with a rounded blue-slate roof, a wide arched wooden double door bound with brass, a wall lantern, stacked crates and a barrel by the door. Its door is on the LOWER-RIGHT wall.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 3. อาคาร B → `buildings_b.png` (2×2 **พื้นเขียว**)

ชุดนี้ใช้พื้นเขียว เพราะเต็นท์พ่อค้าของเถื่อนเป็นผ้าสีม่วง ตอนตัดภาพต้องลบพื้นเขียวแทนพื้นม่วงแดง
ลำดับช่อง: `bld_smuggler` `bld_lighthouse` / `bld_shipyard` `rowboat`

```
More buildings of the same harbour town from the attached concept, same papercraft style, NOT pixel art, the same isometric 3/4 camera from above at about 35 degrees (roof and the lower-left and lower-right walls visible, base on an imaginary diamond-shaped ground footprint, NOT a flat front view), light from the upper left, the SAME scale as the buildings before.

Generate an image: a prop sheet with exactly 4 separate objects in a 2 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1:
- Smuggler's stall: a shady market tent with a deep purple and dark plum cloth canopy trimmed with gold tassels and hanging gold beads, a counter of glowing pink and violet crystals, small bottles and a locked chest, crates stacked behind it, a small hanging lantern. Its open front faces the LOWER-RIGHT.
- Lighthouse: a round tower of pale sandstone blocks with a red roof and a glowing lantern room on top, small glowing windows, a wooden navigator's deck with a railing built around it halfway up, reached by wooden stairs, a large brass globe on a stand and a brass telescope on the deck, rolled maps in a barrel.
Row 2:
- Shipyard: a ship under construction, a long bare wooden hull frame with curved ribs resting on wooden supports, a tall wooden crane with a rope and pulley, a ladder, stacked planks and a tool chest. The hull runs diagonally from lower left to upper right.
- Rowing boat: a small wooden rowing boat with two oars resting inside, a coil of rope and a small crate in it, the hull running diagonally from lower left to upper right. The hull ends cleanly at the waterline: no water, no waves.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no paper texture on the background, no ground patches, no grass around the bases, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use bright green anywhere on the objects; any leaves or ivy must be a dull dark olive green.
```

## 4. ของประดับ → `props.png` (4×3 พื้นม่วงแดง)

ลำดับช่อง: `wheel_fountain` `brass_globe` `lamp_post` `banner_pole` / `bench_a` `bench_b` `bunting_post` `barrels` / `crates` `sacks` `rope_coil` `palm_pot`

```
Same harbour town, same papercraft style, NOT pixel art, the same isometric 3/4 camera from above at about 35 degrees, each object's base sitting on an imaginary diamond-shaped ground footprint, light from the upper left, the same scale as the buildings.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: the centrepiece fountain from the concept: a round stone basin with a huge golden ship's wheel standing upright in the middle, clear turquoise paper water pouring down from it in small falls, white flower beds on the rim; a large brass globe of the world on a carved wooden stand; an iron-and-brass street lamp post with a warm glowing lantern; a tall pole with a hanging deep blue banner bearing a gold compass star.
Row 2: a wooden bench running diagonally from lower left to upper right; the same bench running diagonally from upper left to lower right; a wooden post with a string of small red, yellow and blue triangular bunting flags hanging from its top; a group of three wooden barrels with iron hoops.
Row 3: a stack of three wooden cargo crates; a pile of cloth sacks of flour and grain; a big coil of thick ship's rope; a short palm tree in a round wooden tub.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 5. ท่าเรือและขอบแพ → `docks.png` (4×2 พื้นม่วงแดง)

ทั้งเมืองเป็นแพไม้ ชิ้นชุดนี้จึงใช้ทั้งท่าเรือ 4 ทิศและขอบแพทุกแผ่น ส่วนราวเชือกใช้กั้นขอบแพแทนกำแพงเมือง
ท่าเรือในเกมต่อกันเป็นแนวยาว ชิ้นสะพานไม้ 2 ทิศต้องกว้างและหนาเท่ากัน
ลำดับช่อง: `dock_a` `dock_b` `dock_end` `bollard` / `rail_a` `rail_b` `edge_a` `edge_b`

```
Same harbour town, same papercraft style, NOT pixel art, the same isometric 3/4 camera from above at about 35 degrees, light from the upper left. The whole town is built on wooden plank platforms standing on posts in the water. Now the wooden piers that stick out in four directions in the attached concept, and the edges of the platforms.

Generate an image: a prop sheet with exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a straight section of wooden pier, plank deck on thick wooden posts, running diagonally from LOWER LEFT to UPPER RIGHT; the same pier section running diagonally from UPPER LEFT to LOWER RIGHT, identical width, thickness and plank colour; the square end platform of a pier with four thick mooring posts at its corners, two posts topped with small glowing lanterns; a short thick wooden mooring post with a loop of rope tied around it.
Row 2: a low rope railing, thick rope hanging in curves between short wooden posts, running diagonally from LOWER LEFT to UPPER RIGHT; the same rope railing running diagonally from UPPER LEFT to LOWER RIGHT; the side edge of a plank platform, the ends of the deck planks with a row of thick wooden posts underneath, running diagonally from LOWER LEFT to UPPER RIGHT; the same platform edge running diagonally from UPPER LEFT to LOWER RIGHT.

The posts end cleanly at the bottom: no water, no waves, no reflections. Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 6. เรือจอด 4 ลำ → `ships.png` (2×2 พื้นม่วงแดง)

เรือจอดข้างปลายท่าทั้ง 4 ทิศ ทิศละลำ
ลำดับช่อง: `ship_red` `ship_blue` / `ship_green` `ship_white`

```
Same harbour town, same papercraft style, NOT pixel art, the same isometric 3/4 camera from above at about 35 degrees, light from the upper left. Now the four moored sailing ships at the ends of the four piers in the attached concept, all the SAME size: wooden pirate ships with two masts, rope rigging, a small crow's nest, round portholes, a carved bow, patched paper sails.

Generate an image: exactly 4 separate ships in a 2 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Every hull runs diagonally from lower left to upper right.
Row 1: a ship with deep red sails painted with two crossed white cutlasses; a ship with deep navy blue sails painted with a gold compass star.
Row 2: a ship with olive green sails painted with a gold star; a ship with cream-white sails painted with a red winged dragon.

The hulls end cleanly at the waterline: no water, no waves, no reflections, no splashes. Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 7. น้ำรอบแพ → `water.png` (3×2 พื้นม่วงแดง)

เมืองนี้ไม่มีกำแพงหิน (ขอบแพกั้นด้วยราวเชือกในข้อ 5) ข้อนี้จึงเป็นของที่อยู่บนน้ำและขอบเมือง
ลำดับช่อง: `falls_a` `falls_b` `foam_post` / `wave` `float_barrel` `gull_post`

```
Same harbour town, same papercraft style, NOT pixel art, the same isometric 3/4 camera from above at about 35 degrees, light from the upper left. Now small water details around the wooden platforms of the attached concept.

Generate an image: exactly 6 separate objects in a 3 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a short wide waterfall of layered turquoise and white paper pouring down over an edge, the edge running diagonally from LOWER LEFT to UPPER RIGHT, the falling water fading into small white paper clouds at the bottom; the same waterfall with its edge running diagonally from UPPER LEFT to LOWER RIGHT; a flat ring of white paper foam and small ripples, seen from above, as if around a post standing in water.
Row 2: a small curled turquoise wave crest with white paper foam; a single wooden barrel floating, half sunk, with a ring of small ripples around it; a short wooden post sticking out of the water with a white seagull standing on top.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 8. ประตูมิติ 3 แบบ → `portals.png` (3×1 พื้นม่วงแดง)

- `portal_dock` ประตูปลายท่าเรือ ใช้ภาพเดียวกันทั้ง 4 ทิศ พาไปแมพฟาร์ม
- `portal_return` ซุ้มประตูกลับชั้น 1 วางข้างหอประภาคาร (`bld_lighthouse`) มุมขวาบน
- `portal_floor2` ประตูใหม่ใน `nexus_city` พาขึ้นชั้น 2 ต้องเข้ากับเมืองชั้น 1 (หินทราย อิฐเทาอ่อน ตะไคร่ ทองซีดกับน้ำเงินซีด) แต่มีของจากท่าเรือให้รู้ว่าไปทะเลเมฆ
  - ถ้าเปิดแชทใหม่เพื่อเจนชิ้นนี้ ให้แนบภาพเมืองชั้น 1 แบบกระดาษเพิ่มได้ (ภาพกระดาษเท่านั้น ห้ามภาพพิกเซล)

ลำดับช่อง: `portal_dock` `portal_return` `portal_floor2`

```
Same papercraft style, NOT pixel art, the same isometric 3/4 camera from above at about 35 degrees, light from the upper left. Now three magic portals, each about twice the height of a hero, with a swirling glowing blue-turquoise magic vortex inside made of layered spiral paper.

Generate an image: exactly 3 separate objects in ONE row of 3 columns, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
1: the pier portal from the ends of the four piers in the attached concept: a huge golden ship's wheel standing upright on a small wooden plank base, the swirling blue vortex filling the ring inside the wheel, a small glowing lantern on a post at each side.
2: the return gate beside the lighthouse in the top right of the attached concept: an ornate stone archway with a golden frame and a gold star crest on top, the swirling blue vortex inside the arch, a red banner with a gold star hanging on each side.
3: a gate for a DIFFERENT town, an ancient ruined city of weathered warm sandstone and pale grey brick with paper moss and small vines: a tall broken stone archway with faded gold and old blue trim, a golden ship's wheel and an anchor carved into its keystone, the swirling vortex inside showing turquoise sea water and small white paper clouds, a few small paper seagulls flying around the arch.

Each object has crisp clean outer edges with no glow or halo outside the portal frame. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

---

## 9. NPC 6 ตัว → `raw/floor2_hub/npc/<ชื่อ>.png`

ใช้รูปแบบเดียวกับ `art_templates/papercraft_chars/NPC.md`: ยืนหายใจ 4 เฟรม 3 มุม (หน้า ข้างหันซ้าย หลัง) ตัวละ 1 ภาพ ตาราง 3 แถว × 4 เฟรม
NPC ชั้น 2 ทำหน้าที่เดียวกับ NPC ชั้น 1 (ตารางในแผนหัวข้อ 3) ชื่อในตารางยังเป็นร่าง

- เจนในแชทเดิมต่อจากข้อ 1–8 ได้เลย ถ้าเปิดแชทใหม่ ให้แนบ M0b แล้วใช้ประโยคเปิดเหมือนด้านบน
- ไม่ต้องแนบภาพ NPC ชั้น 1 (ภาพเก่าเป็นพิกเซล)
- prompt = **ข้อความกลาง** + **บรรทัดท้าย** ของ NPC ตัวนั้นจากตาราง
- พื้นหลัง: ตัวที่มีสีม่วงใช้พื้นเขียว ที่เหลือใช้ม่วงแดง ตามช่อง "พื้นหลัง" ในตาราง

### ข้อความกลาง

```
Now a townsperson of this harbour town, in EXACTLY the papercraft style of the attached concept and its little townsfolk: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, slightly chibi proportions about 3.5 heads tall, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 3 rows x 4 columns, 12 figures, the SAME person in every cell, identical size, colours and height. Rows top to bottom: row 1 front view facing the viewer; row 2 side profile facing LEFT; row 3 back view. Columns left to right: a gentle 4-frame standing idle loop, breathing: frame 1 relaxed, frame 2 the chest rising and the shoulders lifting a tiny bit, frame 3 top of the breath with cloth and hair swaying slightly, frame 4 settling back, so frame 4 leads into frame 1. Very small movements only, the feet never move, both feet on the same baseline in every cell. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no text, no labels, no numbers, no grid lines, no shadows on the background, no ground.
```

| ไฟล์ | NPC (หน้าที่) | พื้นหลัง | บรรทัดท้าย |
|---|---|---|---|
| `supply_merchant.png` | แม่ค้าเสบียงเรือ (ร้านค้า) | ม่วงแดง | `The person: the ship's supply seller, a cheerful young woman with brown hair tied back under a red headscarf, rosy cheeks and a big smile, a white blouse with rolled sleeves, a red-and-cream striped apron over a brown skirt, holding a small basket of bread and apples. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `dock_keeper.png` | ผู้ดูแลโกดังท่าเรือ (คลัง) | ม่วงแดง | `The person: the dock warehouse keeper, a sturdy kind middle-aged man with a short grey beard, a navy knit sailor's cap, a thick navy pea coat with brass buttons, a big iron ring of keys on his belt, holding a wooden clipboard of cargo lists. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `shipwright.png` | ช่างเหล็กอู่ต่อเรือ (ช่างตีเหล็ก) | ม่วงแดง | `The person: the shipyard blacksmith, a burly man with a thick ginger beard and a red bandana on his head, a striped sailor's shirt with rolled-up sleeves, a heavy brown leather apron, thick gloves and boots, holding a big smith's hammer low at his side, a small iron anchor badge stitched on his apron. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `harbor_broker.png` | นายหน้าท่าเรือ (ตลาดฝากขาย) | ม่วงแดง | `The person: the harbour broker, a slim sharp-eyed man with a thin curled black moustache, a black tricorn hat with a gold trim, a long teal coat with gold buttons over a mustard waistcoat, small brass price tags hanging from his belt, holding an open ledger book and a white quill. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `navigator.png` | นักเดินเรือแห่งมิติ (เควสเรื่องหลัก) | ม่วงแดง | `The person: the navigator of the dimensions, a wise old man with wild white hair and a white beard, brass goggles with blue lenses pushed up on his forehead, a long deep blue captain's coat with gold buttons and gold trim, holding a brass telescope in one hand and a rolled star chart in the other. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `smuggler.png` | พ่อค้าของเถื่อน (คริสตัลมิติ) | เขียว | `The person: the smuggler, a mysterious figure in a deep brown hooded cloak, the face hidden in the hood's shadow with two small glowing gold eyes, a purple sash with gold coins sewn on it, gold rings, holding up a glowing pink-violet crystal in one hand. Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the person.` |

## 10. ภาพหน้า NPC (portrait) 6 ภาพ → `raw/floor2_hub/portrait/<ชื่อ>.png`

ภาพกระดาษ เจนทีละตัว (เจ้าของเลือก 2026-11-19) ใช้ชื่อไฟล์เดียวกับข้อ 9
**เจนหลังได้ภาพ NPC ตัวนั้นในข้อ 9 แล้ว** และแนบแผ่น NPC ตัวนั้นไปด้วย หน้าตาจะได้ตรงกัน
prompt = ข้อความกลาง + บรรทัดท้ายของตัวนั้น

```
Using the attached papercraft sprite sheet as the exact reference for this person's face, hair, outfit and colours, make a SQUARE (1:1) character portrait for a fantasy RPG dialogue frame, in EXACTLY the same papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, warm soft light from the upper left. NOT pixel art. Framing: head and shoulders only, the face large and centred, looking slightly toward the viewer in a 3/4 view, the top of the head close to the top edge, cut off at the upper chest. Keep exactly the same design so players recognise them at once. Background: a simple dark paper gradient in the colour given below with a soft glow behind the head, no scenery, no frame, no border, no text, no logo, no watermark. The face must stay readable when shown very small (44 pixels).
```

| ไฟล์ | บรรทัดท้าย |
|---|---|
| `supply_merchant.png` | `Person: the ship's supply seller, the cheerful young woman with a red headscarf. Background: dark warm red-brown gradient.` |
| `dock_keeper.png` | `Person: the dock warehouse keeper, the kind bearded man in a navy knit cap and pea coat. Background: dark navy blue gradient.` |
| `shipwright.png` | `Person: the shipyard blacksmith, the burly ginger-bearded man in a red bandana. Background: dark bronze-brown gradient with a warm orange forge glow.` |
| `harbor_broker.png` | `Person: the harbour broker, the slim man with a tricorn hat and curled moustache. Background: dark teal gradient.` |
| `navigator.png` | `Person: the navigator of the dimensions, the old man with wild white hair and brass goggles. Background: dark midnight blue gradient with a few tiny gold stars.` |
| `smuggler.png` | `Person: the smuggler, the hooded figure with glowing gold eyes. Background: dark plum gradient with a faint violet crystal glow.` |

## 11. ไอคอน NPC

**ไม่ต้องเจน** เจ้าของเลือก (2026-11-19) ใช้ไอคอนของ NPC ชั้น 1 ที่ทำหน้าที่เดียวกัน (`npc_shop` `npc_stash` `npc_forge` `npc_market` และไอคอนแผนที่ใน `public/assets/sprites/icons/`)

---

## สำหรับคนใส่เข้าเกม

| ไฟล์ดิบ | ชิ้น |
|---|---|
| `ground_plank.png` `ground_plaza.png` `ground_water.png` | ภาพพื้นปูซ้ำ 1024×1024 แบบ `ground/*` ของชั้น 1 (น้ำเป็นพื้นที่เดินไม่ได้) |
| `buildings_a.png` | `bld_supply` `bld_broker` / `bld_forge` `bld_warehouse` |
| `buildings_b.png` (พื้นเขียว) | `bld_smuggler` `bld_lighthouse` / `bld_shipyard` `rowboat` |
| `props.png` | `wheel_fountain` `brass_globe` `lamp_post` `banner_pole` / `bench_a` `bench_b` `bunting_post` `barrels` / `crates` `sacks` `rope_coil` `palm_pot` |
| `docks.png` | `dock_a` `dock_b` `dock_end` `bollard` / `rail_a` `rail_b` `edge_a` `edge_b` |
| `ships.png` | `ship_red` `ship_blue` / `ship_green` `ship_white` |
| `water.png` | `falls_a` `falls_b` `foam_post` / `wave` `float_barrel` `gull_post` |
| `portals.png` | `portal_dock` `portal_return` `portal_floor2` |
| `npc/*.png` (พื้นเขียวเฉพาะ `smuggler`) | แผ่น 3 แถว × 4 เฟรม สูงเท่า NPC กระดาษชั้น 1 |
| `portrait/*.png` | ย่อเป็น 256×256 แบบ portrait ผู้เล่น |

- `tools/cut_papercraft.cjs` ยังไม่มีชุดของเมืองนี้ ต้องเพิ่มตอนทำ PR สร้างเมือง `harbor_town`
- ชื่อชิ้นข้างบนเป็นชื่อที่เสนอ เปลี่ยนได้ตอนใส่เข้าเกม
