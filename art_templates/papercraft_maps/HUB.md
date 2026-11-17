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
