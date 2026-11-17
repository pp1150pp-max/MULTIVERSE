# แมพสไตล์กระดาษตัดแปะ (papercraft): prompt สำหรับเจนใน ChatGPT

เจ้าของเลือกสไตล์กระดาษตัดแปะให้ทั้งเกมเมื่อ 2026-11-16 และสั่งเปลี่ยนภาพแมพก่อนเมื่อ 2026-11-17
ลำดับงาน: แมพ 1 ป่ามรกต → แมพ 2 หนองน้ำหมอก → แมพ 3 ดินแดนหิมะ → แมพ 4 เกาะภูเขาไฟ → เมืองศูนย์กลางมิติ
หลังแมพและเมืองกลางเสร็จ: ตัวละคร (คลาสผู้เล่น) พร้อม NPC → UI (ยังไม่เริ่ม จะวางแผนเมื่อแมพกับเมืองเสร็จ · นักดาบกระดาษที่พักไว้อยู่ใน worktree `sword-rig`)

**รอบนี้ทดลองแมพ 1 ก่อน** เจนภาพ ตัดภาพ ใส่เข้าเกม แล้วให้เจ้าของดู ถ้าผ่านค่อยเขียน prompt แมพ 2–4 และเมืองกลางต่อในไฟล์นี้
เรื่องที่ต้องดูจากรอบทดลอง: ลายพื้นกระดาษปูซ้ำแล้วเห็นรอยต่อไหม และตัดพื้นหลังออกจากขอบกระดาษได้สะอาดไหม

## วิธีเจน

- **เจนทุกข้อในแชทเดียวกัน** เรียงตามเลขข้อ สไตล์จะได้ตรงกันทั้งชุด
  ถ้าแชทยาวจนสไตล์เริ่มเพี้ยน ให้เปิดแชทใหม่ แนบภาพต้นแบบ (ข้อ 0) กับภาพที่ชอบที่สุด 1–2 ภาพ แล้วเจนต่อ
- **ข้อ 0 แนบภาพต้นแบบสไตล์ 3 ภาพ** อยู่ใน `art_templates/papercraft_maps/raw/ref/`:
  - `A4_marsh.png` เป็นฉากธรรมชาติที่ใกล้ป่าที่สุด ใช้เป็นต้นแบบสไตล์กับมุมกล้อง
  - `A7_hub.png` ใช้ดูหิน ไม้ และงานก่อสร้าง
  - `A1_heroes.png` ใช้ดูขนาดตัวละครเทียบกับฉาก
- ข้ออื่นไม่ต้องแนบอะไรเพิ่ม เพราะอยู่ในแชทเดียวกันแล้ว ถ้าเปิดแชทใหม่ให้แนบตามที่เขียนไว้ในข้อนั้น
- เซฟไฟล์ดิบตามชื่อที่ให้ไว้ใน `art_templates/papercraft_maps/raw/map1_forest/` (โฟลเดอร์ `raw/` ไม่ commit)
- ภาพที่ใช้ตัดชิ้นมีพื้นหลังสีม่วงแดงล้วน #FF00FF ส่วนลายพื้นเป็นภาพสี่เหลี่ยมเต็มภาพ ไม่ต้องตัด
- เจนเสร็จแล้วบอกผม ผมจะตัดภาพ ย่อขนาด แล้วใส่เข้าเกม โดยภาพเดิมยังอยู่ครบ สลับดูได้ใน `/admin`

---

# แมพ 1 ป่ามรกต (`emerald_forest`)

## 0. ภาพต้นแบบแมพป่า → `raw/map1_forest/F0_forest_scene.png`

แนบ `A4_marsh.png`, `A7_hub.png`, `A1_heroes.png`
ภาพนี้ไม่เข้าเกม ใช้ตั้งสีและหน้าตาของป่าก่อนเจนชิ้นจริง ถ้ายังไม่ชอบ ให้เจนข้อนี้ใหม่จนกว่าจะพอใจแล้วค่อยไปข้อ 1

```
The attached images show the papercraft art style and the camera of my game. Use EXACTLY this style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, warm soft lighting from the upper left. The first image (the marsh) is the reference for nature, the second (the city) for stone and wood, the third is the heroes.
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, the SAME fixed isometric camera as the marsh screenshot, landscape 16:9. Scene: Emerald Forest, the first and friendliest area of the game, a lush, healthy, sunlit green forest on a floating island: soft green grass, a winding light-brown dirt road, broad leafy oak trees, round leafy bushes, grey boulders with a little moss, small wildflowers, ferns, a fallen mossy log, a small adventurers' camp with a canvas tent, a campfire and a wooden signpost beside the road. The three heroes are small on screen, as in a real game (about one eighth of the image height), fighting a green slime and a fox. No dead trees, no hanging moss, no fog, no swamp colours. No UI, no health bars, no text, no watermark.
```

## 1. ต้นไม้ พุ่มไม้ หิน → `raw/map1_forest/props.png` (4×3)

```
Now the map props for this Emerald Forest, in EXACTLY the same papercraft style as the forest screenshot: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. SAME camera as the screenshot: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint. Generate an image: prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Row 1: small young leafy tree; medium round leafy oak tree; large tall broad leafy oak tree; tall broken tree trunk snag with a few leaves. Row 2: medium leafy bush; large leafy bush; small leafy bush; short cut tree stump with visible rings. Row 3: three different grey boulders with only a touch of green moss; one small flat mossy stone. Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `tree_0` `tree_1` `tree_2` `stump_tall` / `bush_0` `bush_1` `bush_2` `stump` / `rock_0` `rock_1` `rock_2` `pebble_0`
(`pebble_1` ใช้ `rock_1` ย่อขนาดเหมือนเดิม)

## 2. ชุดแคมป์และประตูมิติ → `raw/map1_forest/camp.png` (4×3)

ชุดนี้วางในแคมป์ของทุกแมพ จึงใช้ร่วมกันทั้ง 4 แมพ

```
Same papercraft style, same camera and the same layout rules (exactly 12 separate objects, 4 columns x 3 rows, generous space, crisp edges, flat solid magenta #FF00FF background, no cast shadows, no text, no grid, no pink, magenta or purple on any object). Generate an image: an adventurers' camp for the same forest, made of paper and card. Row 1: canvas A-frame camping tent with a small red pennant; campfire with paper logs and layered orange-yellow paper flames on a ring of stones; wooden direction signpost; an ancient mossy stone archway portal overgrown with vines, with a swirling glowing teal-green magic vortex inside the arch. Row 2: tall carved grey runestone with a glowing pale-gold rune; round stone well with a small wooden roof and a bucket; wooden barrel with iron bands; closed wooden treasure chest with iron trim. Row 3: wooden hand cart with two wheels and sacks; tall red cloth banner on a wooden pole; small red triangular flag on a thin pole; tall wooden watchtower on four legs with a small roof.
```

ลำดับช่อง: `tent` `campfire` `sign` `portal` / `runestone` `well` `barrel` `chest` / `cart` `banner_red` `flag` `watchtower`

## 3. ของตกแต่งเล็ก ๆ บนพื้น → `raw/map1_forest/decor.png` (4×3)

เกมสุ่มของชิ้นเล็กเหล่านี้ไปวางตามข้างถนนและในทุ่ง ลำดับช่องต้องตรงตามนี้ เพราะเกมเลือกชิ้นตามเลขช่อง

```
Same papercraft style and the same camera. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one SMALL separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. These are tiny details scattered on the forest floor, each only a little taller than a hero's knee. Row 1: small tuft of grass; larger clump of tall grass; tiny sprout of grass; small clump of yellow and white wildflowers. Row 2: small clump of blue wildflowers; low round leafy plant; a fern; small pile of three grey stones. Row 3: one small mossy stone; a fallen mossy log; a few fallen autumn leaves lying flat on the ground; a small cluster of brown mushrooms. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: 0 หญ้ากอเล็ก, 1 หญ้ากอใหญ่, 2 หญ้างอก, 3 ดอกไม้เหลือง / 4 ดอกไม้ฟ้า, 5 ต้นใบกลม, 6 เฟิร์น, 7 กองหิน / 8 หินตะไคร่ (ข้างถนน), 9 ขอนไม้, 10 ใบไม้ร่วง (ข้างถนน), 11 เห็ด

## 4. ลายพื้น 3 ภาพ → `raw/map1_forest/ground_grass.png`, `ground_dirt.png`, `ground_pave.png`

เจนทีละภาพ โดยขึ้นต้นด้วยข้อความนี้ทุกภาพ แล้วต่อท้ายด้วยเนื้อหาในตาราง
เกมเอาภาพพื้นมาปูต่อกันซ้ำ ๆ ถ้าในภาพมีชิ้นใหญ่หรือชิ้นที่สะดุดตา จะเห็นลายซ้ำทั้งแมพ จึงต้องเป็นลายละเอียดที่สีใกล้กันทั้งภาพ

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style: the ground is made of many SMALL overlapping scraps of cut and torn coloured paper with visible paper fibre, all about the same small size, evenly spread. Viewed from straight above with no perspective. No focal point, no single large shape, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast: 4 to 5 close shades only, nothing bright, nothing near black, no objects lying on it.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_grass.png` | `Soft sunlit meadow grass: small torn paper scraps and short paper grass blades in close mid greens and a little yellow-green, calm and even.` |
| `ground_dirt.png` | `A trodden forest dirt road: small torn paper scraps of light warm brown and tan earth with a few tiny paper pebbles, slightly lighter than the grass would be, calm and even.` |
| `ground_pave.png` | `Old worn stone paving of a camp clearing: small irregular flagstones cut from pale warm grey card with thin darker gaps and a few tiny paper moss bits, calm and even.` |

## 5. หน้าผาใต้เกาะ → `raw/map1_forest/island_cliff.png` (4×2)

```
Same papercraft style, same camera, light from the upper left. Generate an image: exactly 8 separate tall broken cliff columns, as if each was cut from under the near edge of this floating forest island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous empty space. Every column has the same structure, built from stacked layers of cut card and paper: at the very top a thin irregular soil lip seen slightly from above, then about one quarter brown layered paper soil with hanging paper tree roots, then grey stone made of stacked cardboard strata with cracks and ledges, tapering down into 2 or 3 jagged points at the bottom. Each column fills most of its cell. All 8 are different in outline. A few have a thin glowing pale-gold crack running through the stone. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 6. แผ่นดินลอย → `raw/map1_forest/island_slabs.png` (4×2)

```
Same papercraft style and rules. Generate an image: exactly 8 separate small floating land slabs broken off the forest island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a paper grass top seen from above in the same isometric view, layered paper soil with hanging roots under it, and a short jagged card-stone point at the bottom. Row 1: four slabs each carrying one or two small leafy paper oak trees. Row 2: one with a few bushes, one with a grey boulder, one split by a glowing pale-gold crack, one cracked and bare. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 7. เศษหินลอยและสะเก็ดดาว → `raw/map1_forest/island_debris.png` (4×3)

ภาพนี้ใช้ร่วมกันทุกแมพ

```
Same papercraft style and rules. Generate an image: exactly 12 separate floating pieces in a 4 columns x 3 rows grid, each fully inside its own cell, nothing touching, generous space. Row 1: four large chunks of grey card-stone, blocky and broken, made of stacked cardboard layers, lit on the upper-left faces. Row 2: two small crumbling clods of brown paper soil with a pale paper root hanging under them, and two small flat shards of grey card-stone. Row 3: four long thin crystal star shards cut from shiny foil paper, two icy blue and two pale gold, each with a bright white core and a few tiny paper sparkles. Background ONE perfectly flat solid magenta (#FF00FF), no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 8. รอยแตกบนพื้นริมเกาะ → `raw/map1_forest/island_cracks.png` (4×2)

ภาพนี้ใช้ร่วมกันทุกแมพ เกมวางรอยแตกแบนราบไปกับพื้น

```
Same papercraft style. Generate an image: exactly 8 separate ground cracks seen from STRAIGHT ABOVE, to be laid flat on the ground, in a 4 columns x 2 rows grid. Each crack is a jagged branching tear cut through the paper ground, showing dark brown layers below and a thin glowing pale-gold line in the centre of some branches. Each crack runs across most of its cell, in different directions. Only the crack itself, no grass, no surrounding ground. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple.
```

## 9. ลานห้องบอส (หมีป่า) → `raw/map1_forest/ground_room.png`

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge, in the same papercraft style, made of small cut pieces of card and paper with visible fibre. Viewed from straight above with no perspective. No focal point, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black. This is the floor of a boss's arena: old mossy grey flagstones cut from card, with small paper grass and clover in the gaps and a few fallen paper leaves, muted greens and warm greys.
```

## 10. ของรอบลานห้องบอส → `raw/map1_forest/room_props.png` (4×2)

```
Same papercraft style, same isometric camera, light from the upper left. Now props for the walls around the boss arena, the bear's den deep in Emerald Forest: mossy grey stone ruins made of card, overgrown with paper vines and ferns, claw marks on the stone. Generate an image: exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping. Row 1: a tall broken stone pillar; a short section of ruined stone wall; a wooden standing torch with a layered paper flame; a large mossy boulder. Row 2: a smaller broken pillar; a pile of stone rubble; a carved standing stone with a glowing pale-gold rune; a big leafy oak tree. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `room_forest_pillar_0` `room_forest_wall` `room_forest_brazier` `room_forest_boulder` / `room_forest_pillar_1` `room_forest_rubble` `room_forest_rune_stone` `room_forest_tree`

---

## ภาพที่ได้หลังตัด (สำหรับผม)

ตัดด้วย `tools/cut_papercraft.cjs` (จะเขียนตอนได้ภาพ โดยใช้วิธีเดียวกับ `tools/cut_zone3.cjs`) แล้วเขียนลง `public/assets/sprites/paper/` ด้วยชื่อไฟล์เดิม

| ภาพดิบ | ไฟล์ในเกม | ขนาดเดิม |
|---|---|---|
| `props.png` | `props/tree_*`, `bush_*`, `rock_*`, `stump`, `stump_tall`, `pebble_0/1` | สูงราว 200–240px |
| `camp.png` | `props/tent`, `campfire`, `sign`, `portal`, `runestone`, `well`, `barrel`, `chest`, `cart`, `banner_red`, `flag`, `watchtower` | สูงราว 200–240px |
| `decor.png` | `props/decor_forest.png` | 512×384 (ช่องละ 128) |
| `ground_*.png` | `ground/grass`, `dirt`, `pave`, `room_forest` | 1024×1024 |
| `island_cliff.png` | `props/island_cliff_forest.png` | 1536×768 (4×2) |
| `island_slabs.png` | `props/island_slabs_forest.png` | 887×443 (4×2) |
| `island_debris.png` | `props/island_debris.png` | 724×543 (4×3) |
| `island_cracks.png` | `props/island_cracks.png` | 887×443 (4×2) |
| `room_props.png` | `props/room_forest_*` | สูง 256px |
