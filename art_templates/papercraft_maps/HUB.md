# เมืองศูนย์กลางมิติ (`nexus_city`)

ทุ่งรอบเมืองใช้ต้นไม้และพื้นของแมพ 1–4 อยู่แล้ว (มุมละธีม) ไฟล์นี้จึงมีแค่ของในตัวเมือง พื้นอิฐ และแท่นเรียกบอส
เจนต่อในแชทเดิมได้เลย ถ้าเปิดแชทใหม่ ให้แนบ `raw/ref/A7_hub.png` กับภาพจากแมพก่อน ๆ ที่ชอบที่สุด 1–2 ภาพ แล้วขึ้นต้นข้อแรกด้วยประโยคเปิดของข้อ 0 ใน `MAP1_FOREST.md`
เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/hub/`
หน้าตาเมือง: ซากเมืองโบราณบนเกาะลอย หินทรายอุ่น อิฐเทาอ่อน มีตะไคร่ ดอกไม้ป่า และสีทองกับสีน้ำเงินซีด ๆ ดูสงบ สวย ไม่หม่น

## 1. ของในเมือง 10 ชิ้น → `raw/hub/town.png` (5×2)

แนบ `raw/ref/A7_hub.png` ด้วย ใช้ดูหินกับไม้ของเมือง

```
Now the central town of the game, the Nexus, in EXACTLY the same papercraft style as the earlier props and the attached city screenshot: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. SAME camera: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint. This is the beautiful ruins of an ancient city on a floating island where survivors now live: weathered warm sandstone and pale grey brick card, broken and crumbling but still elegant, carved details, paper moss and small vines in the cracks, a few wildflowers, touches of faded gold and old blue paper. Peaceful and romantic, not gloomy. Generate an image: prop sheet with exactly 10 separate objects in a 5 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Row 1: large round ruined stone plaza fountain with a cracked rim and a statue of a robed woman holding up a glowing gold star in the middle, clear paper water flowing, the centrepiece of the town; weathered statue of a knight with a sword on a square pedestal; tall broken carved stone column with its top snapped off and a fallen piece at its foot; half-collapsed two-storey stone house with a partly fallen red tiled roof and empty windows; ruined round stone watch tower with the top half crumbled away and a small blue banner. Row 2: low pile of fallen bricks and stone blocks with a carved tablet; merchant stall rebuilt from salvaged wooden planks with a patched cream-and-teal cloth awning, crates of fruit and jars; small blacksmith forge rebuilt inside a broken stone wall corner, with an anvil and a glowing furnace; small stone vault with a heavy iron-bound wooden door set into a ruined wall; market broker's booth of dark wood with a teal awning, notice papers pinned on a board, a lantern and a small chest. Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `ruin_fountain` `ruin_statue` `ruin_pillar` `ruin_house` `ruin_tower` / `ruin_rubble` `town_stall` `town_forge` `town_vault` `town_market`

## 2. กำแพงเมือง → `raw/hub/walls.png` (3×2)

กำแพงในเกมวางต่อกันเป็นแถวยาว รูปทรงจึงต้องเหมือนภาพเดิมมาก ๆ: กำแพงตรงวิ่งเฉียงตามแนวพื้น มีเสาสี่เหลี่ยมที่ปลายทั้งสองข้าง
**แนบภาพเดิม 3 ภาพ** จาก `raw/ref/`: `old_town_wall_a.png`, `old_town_wall_b.png`, `old_town_wall_end.png`

```
The three small attached pictures are the old pixel-art town wall pieces of my game. Redraw them in our papercraft style with EXACTLY the same shapes, angles and proportions, because the game places copies end to end and they must line up: same diagonal direction, same length-to-height ratio, a square pillar at both ends of every wall, the same flat crenellated top. Same sandstone and pale grey brick card, paper moss and small vines, a faded blue banner with a gold star on the pillars. Generate an image: exactly 6 separate objects in a 3 columns x 2 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping. Row 1: the straight wall section running diagonally from LOWER LEFT to UPPER RIGHT exactly like the first attached picture; the same wall with a few missing bricks and a small crack, identical outline and end pillars; the square end pillar exactly like the third attached picture. Row 2: the straight wall section running diagonally from UPPER LEFT to LOWER RIGHT exactly like the second attached picture; the same wall with a few missing bricks and a small crack, identical outline and end pillars; a second copy of the end pillar. Every wall the same height and thickness. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `town_wall_a` `town_wall_a_broken` `town_wall_end` / `town_wall_b` `town_wall_b_broken` (ช่องสุดท้ายเป็นเสาสำรอง ไม่ได้ใช้)
ผมจะยืดภาพกำแพงแต่ละชิ้นให้ได้ขนาดเท่าภาพเดิมพอดี ปลายกำแพงจะได้ต่อกันตรง

## 3. แท่นเรียกบอส 4 แมพ → `raw/hub/summoners.png` (2×2)

แท่นนี้ตั้งในแมพ 1–4 ข้างประตูกลับเมือง

```
Same papercraft style, same isometric camera, light from the upper left. Now 4 boss summoning altars, each about twice the height of a hero, with a keyhole-shaped socket glowing faintly on its front, standing on a few stone steps. Generate an image: exactly 4 separate objects in a 2 columns x 2 rows grid, generous empty space, each fully inside its own cell, nothing touching. Top left (Emerald Forest): a mossy grey standing stone carved with a roaring bear head, paper roots and vines wrapped around it, warm green glow in the socket. Top right (Misty Marsh): a crooked dead-wood totem hung with bones and a horned skull, a cracked cauldron of bubbling teal brew at its base, reeds around it, sickly teal glow. Bottom left (Frost Reach): an ice-covered stone shrine with a horned yeti skull on top, paper icicles and ice crystals around it, pale blue glow. Bottom right (Ashen Isle): a black basalt altar with a cracked heart-shaped stone on top, thin glowing lava seams running down, orange glow. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `summoner_forest` `summoner_marsh` / `summoner_snow` `summoner_volcano`

## 4. พื้นอิฐในเมือง → `raw/hub/ground_brick.png`

ขึ้นต้นด้วยข้อความเดียวกับลายพื้นใน `MAP1_FOREST.md` (ข้อ 4) แล้วต่อท้ายด้วย

```
Old worn brick paving of an ancient ruined city: small bricks cut from weathered warm sandstone-red and pale grey card laid in a herringbone pattern, rounded worn edges, a few cracked or missing bricks, thin lines of paper moss and tiny weeds between them, muted dusty colours, calm and even.
```

## 5. เมืองผังใหม่ (เจ้าของ 2026-11-18): อาคาร 8 หลังและของประดับ 12 ชิ้น

แนบ 2 ภาพ: ภาพแนวคิดเมืองที่เจ้าของอนุมัติ (`hub_concept_v2.webp` เก็บไว้นอก repo ใน `D:/Claude/Game/hub_redesign/`) และ `raw/ref/A7_hub.png`
เซฟไว้ใน `raw/hub/` แล้วตัดด้วย `node tools/cut_papercraft.cjs hub` ภาพชุดนี้ไม่มีภาพเก่าให้เทียบ จึงตัดที่ความสูงคงที่ (อาคาร 384 px ของประดับ 256 px)

### 5.1 อาคาร A → `art_templates/papercraft_maps/raw/hub/town2_buildings_a.png` (2×2 พื้นม่วงแดง)
ลำดับช่อง: `bld_store` `bld_market` / `bld_forge` `bld_guild`
```
The first attached image is the approved concept of my game's central town: use it for the DESIGN, layout, colours and details of these buildings only, not for its pixel-art style. Draw everything in EXACTLY the papercraft style of the second attached image: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, as in classic isometric RPGs: we see the roof and two walls, the lower-left wall and the lower-right wall, and each building's base sits on an imaginary diamond-shaped ground footprint. NOT a flat front view. Light from the upper left. All four buildings at the SAME scale, as if standing in the same town. Complete, intact, believable buildings of warm sandstone, pale grey brick and dark timber card, with roofs, doors, glowing warm windows, hanging signs, a little paper moss and some flower boxes.

Generate an image: a prop sheet with exactly 4 separate buildings in a 2 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1:
- General store: red tiled roof, a red-and-cream striped cloth awning over the shop front, crates of apples and vegetables under it, a hanging shop sign. Its front door and awning are on the LOWER-RIGHT wall.
- Market hall: a timber building with a teal roof and a large wooden notice board covered in pinned papers in front of it, a lantern and a small chest. Its front and notice board face the LOWER-RIGHT.
Row 2:
- Blacksmith's forge: stone walls, a blue-slate roof, a tall stone chimney with a puff of smoke, an open front showing a glowing orange furnace, an anvil and racks of tools outside, a hanging sign with crossed hammers. Its open front is on the LOWER-LEFT wall.
- Adventurers' guild hall: a larger timber-and-stone hall with a blue-slate roof, gold trim, and a blue banner with a gold star over the arched double door. Its front door is on the LOWER-LEFT wall.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no grass around the bases, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

### 5.2 อาคาร B → `art_templates/papercraft_maps/raw/hub/town2_buildings_b.png` (2×2 **พื้นเขียว**)
ชุดนี้ใช้พื้นเขียวเพราะร้านตัดเสื้อมีผ้าสีชมพูกับสีม่วง ตอนตัดภาพจึงต้องลบพื้นเขียวแทนพื้นม่วงแดง
ลำดับช่อง: `bld_tailor` `bld_vault` / `bld_house_a` `bld_house_b`
```
The first attached image is the approved concept of my game's central town: use it for the DESIGN, layout, colours and details of these buildings only, not for its pixel-art style. Draw everything in EXACTLY the papercraft style of the second attached image: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, as in classic isometric RPGs: we see the roof and two walls, the lower-left wall and the lower-right wall, and each building's base sits on an imaginary diamond-shaped ground footprint. NOT a flat front view. Light from the upper left. All four buildings at the SAME scale, as if standing in the same town. Complete, intact, believable buildings of warm sandstone, pale grey brick and dark timber card, with roofs, doors, glowing warm windows, hanging signs, a little paper moss and some flower boxes.

Generate an image: a prop sheet with exactly 4 separate buildings in a 2 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1:
- Tailor's shop: a small timber shop with a red tiled roof, a big shop window showing bolts of colourful cloth in pink, purple and gold, a dress dummy beside the door, and a hanging sign with a needle and scissors. Its front is on the LOWER-RIGHT wall.
- Bank / storage vault: a sturdy pale stone building with a teal dome-like roof and gold trim, a heavy round iron-bound vault door with a gold wheel, barred glowing windows. Its vault door is on the LOWER-RIGHT wall.
Row 2:
- A two-storey townhouse: timber frame, a red tiled roof, a stone chimney, flower boxes under the windows.
- A different two-storey townhouse: stone ground floor, a timber upper floor, a blue-slate roof, a small balcony with flowers.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no paper texture on the background, no ground patches, no grass around the bases, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use bright green anywhere on the objects; any moss or leaves must be a dull dark olive green.
```

### 5.3 ของประดับ → `art_templates/papercraft_maps/raw/hub/town2_props.png` (4×3 พื้นม่วงแดง)
ลำดับช่อง: `town_fountain` `quest_board` `crystal_stall` `lamp_post` / `bench_a` `bench_b` `planter` `banner_pole` / `crates` `barrels` `flower_box` `potted_tree`
```
The first attached image is the approved concept of my game's central town: use it for the DESIGN and colours of these objects only, not for its pixel-art style. Draw everything in EXACTLY the papercraft style of the second attached image: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, as in classic isometric RPGs, each object's base sitting on an imaginary diamond-shaped ground footprint. NOT a flat front view. Light from the upper left. All objects at the same scale as the town in the concept.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: the large round plaza fountain from the concept, a stone basin with a statue of a robed woman holding up a glowing gold star, clear blue paper water flowing, flower beds on its rim; a large wooden quest board on two posts, covered in pinned parchment notices, with a small roof and a lantern; a small market stall with a cream-and-blue striped awning, its counter glittering with glowing blue crystals in wooden crates; an ornate iron-and-gold street lamp post with a warm glowing lantern.
Row 2: a wooden park bench running diagonally from lower left to upper right; the same bench running diagonally from upper left to lower right; a square stone planter full of white, yellow and red flowers; a tall pole with a hanging blue banner bearing a gold star.
Row 3: a stack of three wooden crates; a group of three wooden barrels; a long wooden flower box full of white and yellow flowers; a small round-topped tree in a stone pot.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```


## 6. ของเตี้ยริมกำแพงด้านล่าง → `raw/hub/town2_low.png` (4×2 พื้นม่วงแดง)

กำแพง 2 ด้านล่างของจออยู่ใกล้กล้อง ถ้าวางของสูงจะบังผู้เล่นกับ NPC จึงต้องเป็นของเตี้ยทั้งหมด แนบ 2 ภาพเหมือนข้อ 5 คือภาพแนวคิดเมือง และ `raw/ref/A7_hub.png` ถ้าเจนในแชทเดิมที่ทำข้อ 5 ไว้ ก็ไม่ต้องแนบซ้ำ
ลำดับช่อง: `low_stall_a` `low_stall_b` `garden_bed` `hedge_a` / `hedge_b` `house_back_a` `house_back_b` `woodpile`

```
Same town as before, in EXACTLY the same papercraft style as the buildings and props you made for it: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, as in classic isometric RPGs, each object's base sitting on an imaginary diamond-shaped ground footprint. NOT a flat front view. Light from the upper left. These objects stand along the bottom edge of the town, close to the camera, so EVERY object must be LOW and WIDE: no taller than a person, except the two house backs, which are low single-storey. Same sandstone, pale grey brick, dark timber, red and blue roofs, gold trim and blue-and-gold star banners as the town.

Generate an image: a prop sheet with exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a low open market stall with a cream-and-teal striped cloth canopy on four short posts, a counter of bread loaves, cheese wheels and jars; a low open flower stall with a red-and-cream canopy, buckets of white, yellow and red flowers; a small vegetable garden bed with a low wooden border, rows of cabbages and carrots, a little scarecrow-free wooden sign; a low trimmed green hedge with small white flowers, running diagonally from lower left to upper right.
Row 2: the same hedge running diagonally from upper left to lower right; the BACK of a small single-storey cottage seen from behind: a plain back wall with one small glowing window, a red tiled roof sloping toward the camera, a stone chimney, NO door; the BACK of a small stone storehouse seen from behind: a plain stone wall, a blue-slate roof sloping toward the camera, a small barred vent, NO door; a neat stack of firewood logs with a wooden wheelbarrow beside it.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no grass around the bases, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 7. เมืองผังรอบ 6 (เจ้าของ 2026-11-19): ตึกแถวด้านบน ตลาดด้านล่าง

แนบภาพแนวคิดรอบ 6 (`hub_concept_v6.png` เก็บไว้นอก repo ใน `D:/Claude/Game/hub_redesign/`) และ `raw/ref/A7_hub.png` ตัดด้วย `node tools/cut_papercraft.cjs hub`
บ้านทุกหลังวางเฉียงขนานกำแพง ติดกันเป็นตึกแถว ของในตลาดก็ขนานกำแพง

### 7.1 ตึกแถวกำแพงบนซ้าย → `row_left.png` (3×2 พื้นม่วงแดง)

หน้าร้านหันไป**ขวาล่าง** (ทางน้ำพุ) ผนังข้างของทุกหลังตัดตรง เพื่อให้วางต่อกันได้ไม่มีช่อง

ลำดับช่อง: `row_l_vault` `row_l_crystal` `row_l_house_a` / `row_l_house_b` `row_l_house_c` `row_l_shop`

```
Use the first attached image (my game's town) for the design, colours and details, and draw in EXACTLY the papercraft style of the second attached image: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, as in classic isometric RPGs: we see the roof and two walls, the lower-left wall and the lower-right wall, and each building's base sits on an imaginary diamond-shaped ground footprint. NOT a flat front view. Light from the upper left.

These are MODULAR TOWNHOUSES for one continuous row of attached buildings, like an old-town street front: in the game they are placed side by side, touching, along a wall that runs diagonally from the upper left to the lower right of the screen. The front of every building runs EXACTLY PARALLEL to that diagonal wall, so its base edges follow the same isometric diagonal lines as the wall, never square to the screen and never at another angle. When the buildings are lined up they must read as ONE ATTACHED ROW with no gaps, like terraced houses. So EVERY building: has its FRONT (door, shop window, sign, awning) on the LOWER-RIGHT wall; has the SAME depth and the SAME width of ground footprint; and has its two side walls cut off straight and flat (plain shared party walls, no windows, nothing sticking out sideways) so the next building can stand right against it with no gap. Two to three storeys, varied roof heights and colours (red, teal and blue tiles), timber frames, warm sandstone and pale grey brick, flower boxes, glowing windows, chimneys.

Generate an image: a sheet with exactly 6 separate buildings in a 3 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a sturdy pale stone bank / vault with a teal roof, gold trim and a round iron vault door with a gold wheel on its front; a small crystal shop with a navy-and-silver star awning and a big window glittering with glowing blue crystals; a narrow three-storey townhouse with a red roof and a balcony.
Row 2: a two-storey townhouse with a teal roof and flower boxes; a three-storey townhouse with a blue roof and a small dormer; a shop with a red-and-cream striped awning and shelves of colourful books and bolts of cloth in its window.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no grass around the bases, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

---

### 7.2 ตึกแถวกำแพงบนขวา → `row_right.png` (3×2 พื้นม่วงแดง)

หน้าร้านหันไป**ซ้ายล่าง** (ทางน้ำพุ) ผนังข้างตัดตรงเหมือนชุดที่ 1

ลำดับช่อง: `row_r_guild` `row_r_forge` `row_r_house_a` / `row_r_house_b` `row_r_house_c` `row_r_shop`

```
Same town, same papercraft style and same camera as before (2D isometric 3/4 view from above at about 35 degrees, light from the upper left, we see the roof and the lower-left and lower-right walls).

These are MODULAR TOWNHOUSES for one continuous row of attached buildings along a wall that runs diagonally from the upper RIGHT to the lower LEFT of the screen. The front of every building runs EXACTLY PARALLEL to that diagonal wall, so its base edges follow the same isometric diagonal lines as the wall, never square to the screen and never at another angle. When the buildings are lined up they must read as ONE ATTACHED ROW with no gaps, like terraced houses. So EVERY building: has its FRONT (door, shop window, sign, awning) on the LOWER-LEFT wall; has the SAME depth and the SAME width of ground footprint; and has its two side walls cut off straight and flat (plain shared party walls, no windows, nothing sticking out sideways) so the next building can stand right against it with no gap. Two to three storeys, varied roof heights and colours (red, teal and blue tiles), timber frames, warm sandstone and pale grey brick, flower boxes, glowing windows, chimneys.

Generate an image: a sheet with exactly 6 separate buildings in a 3 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: an adventurers' guild hall with a blue-slate roof, gold trim and a blue banner with a gold star over its arched double door; a stone blacksmith's forge with a tall smoking chimney, an open front showing a glowing orange furnace, and a hanging sign with crossed hammers; a narrow three-storey townhouse with a blue roof and a balcony.
Row 2: a two-storey townhouse with a red roof and flower boxes; a three-storey townhouse with a teal roof and a small dormer; a shop with a green-and-cream striped awning and baskets of goods in its window.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no grass around the bases, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

---

### 7.3 ของในตลาดล่าง → `market.png` (4×2 พื้นม่วงแดง)

ของชุดนี้เตี้ยทุกชิ้น และไม่ทำทั่งตีเหล็กแยก เพราะทั่งอยู่ในภาพโรงตีเหล็กแล้ว

ลำดับช่อง: `mk_goods_stall` `mk_auction_booth` `mk_veg_stall` `mk_wagon` / `mk_handcart` `mk_sacks` `mk_potion_table` `mk_tag_table`

```
Same town, same papercraft style and same camera as before (2D isometric 3/4 view from above at about 35 degrees, light from the upper left, each object's base on an imaginary diamond-shaped ground footprint). These stand in the open-air market near the camera, so every object is LOW and WIDE, no taller than a person, and each one's long side runs diagonally along an isometric ground axis, PARALLEL to the town walls (which run diagonally on screen), never square to the screen and never at a random angle. Draw each stall, booth, table and cart with its counter or long side running from the lower left to the upper right of the screen, like the bottom-right town wall.

Generate an image: a prop sheet with exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: the travelling merchant's general goods stall, a wooden counter under a red-and-cream striped canopy, crowded with potion bottles, rope coils, lanterns, pots and bags; the market broker's dark-wood auction booth with a large notice board of pinned listings, a weighing scale and a small strongbox on its counter; a vegetable and fruit stall with a green-and-cream canopy, crates of apples, cabbages, carrots and pumpkins; a covered market wagon with a cream canvas roof, loaded with crates.
Row 2: a small wooden hand cart with sacks; a pile of grain sacks and baskets; a low wooden table with rows of coloured potion bottles and a lantern; a low wooden table of wrapped goods and boxes with small price tags.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

### 7.4 แผงตลาด 3 แผงแบบหันเข้าน้ำพุ (เห็นด้านหลังแผง) → `market_backs.png` (3×1)

ลำดับช่อง: `mk_goods_stall` `mk_auction_booth` `mk_veg_stall` (มาแทน 3 ช่องแรกของ `market.png`)

```
Redraw the first three stalls of the attached market sheet (the merchant's goods stall with the red-and-cream canopy, the broker's auction booth with the notice board, and the vegetable stall with the green-and-cream canopy) in EXACTLY the same papercraft style, colours, size and camera (2D isometric 3/4 view from above at about 35 degrees, light from the upper left), but TURNED AROUND so that each stall faces AWAY from the camera, toward the UPPER-LEFT.

That means: the counter, the goods on display, the notice board's pinned papers and the open side of each stall are on the far UPPER-LEFT side, facing away from us; what we see is the stall's plain BACK on the LOWER-RIGHT wall (wooden back boards, a few crates, sacks and a barrel stacked behind it, the back of the notice board, the back of the canopy sloping down toward the far side) and its narrow side on the LOWER-LEFT. We can still glimpse some of the goods over the top of the back boards and under the canopy, so each stall is recognisable. Each stall's long side runs diagonally from the lower left to the upper right of the screen, parallel to the isometric ground axis, never square to the screen. Keep them LOW, no taller than a person.

Generate an image: exactly 3 separate stalls in a 3 columns x 1 row grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Left: the merchant's goods stall seen from behind. Middle: the broker's auction booth seen from behind. Right: the vegetable stall seen from behind.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

