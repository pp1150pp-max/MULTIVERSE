# แมพ 4 เกาะภูเขาไฟ (`ashen_isle`)

เจนต่อในแชทเดิมได้เลย ถ้าเปิดแชทใหม่ ให้แนบ `raw/ref/A6_volcano.png` กับภาพจากแมพก่อน ๆ ที่ชอบที่สุด 1–2 ภาพ แล้วขึ้นต้นข้อแรกด้วยประโยคเปิดของข้อ 0 ใน `MAP1_FOREST.md`
เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/map4_volcano/`
ชุดแคมป์ เศษหินลอย และรอยแตกใช้ร่วมกับแมพ 1 จึงไม่ต้องเจนใหม่
เรื่องสี: แมพนี้เป็นสีถ่าน เทาเขม่า และน้ำตาลหม่น ให้มีสีส้มเรืองแค่จุดเล็ก ๆ ตัวละครจะได้ยังเด่น ยกเว้นลายลาวาซึ่งสว่างได้

## 1. เสาไหม้ พุ่มไม้ หิน คริสตัล → `raw/map4_volcano/props.png` (4×3)

```
Now the map props for the fourth area, Ashen Isle, a black volcanic island, in EXACTLY the same papercraft style as the props of the earlier areas and the attached volcano screenshot: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. SAME camera: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint. Palette: warm charcoal, soot grey and dull brown paper and card, with only small accents of glowing orange paper, nothing bright in large areas. Generate an image: prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Row 1: slim tall burnt basalt pillar with a thin glowing crack; medium burnt basalt pillar with a broken top; very tall broad burnt basalt pillar; dead charred tree with bare branches and a few paper embers. Row 2: small dry ash-grey shrub; larger dry ash-grey shrub; small fern of dark leaves with orange ember tips; short charred tree stump. Row 3: dark basalt boulder; large dark basalt boulder with a faint glowing crack; cluster of three small orange magma crystals; taller cluster of big magma crystals. Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no lava, no smoke, no cast shadows on the background, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `burnt_pillar_0` `burnt_pillar_1` `burnt_pillar_2` `charred_tree` / `ash_shrub_0` `ash_shrub_1` `ember_fern` `charred_stump` / `basalt_0` `basalt_1` `magma_crystal_0` `magma_crystal_1`

## 2. ของตกแต่งเล็ก ๆ บนพื้น → `raw/map4_volcano/decor.png` (4×3)

ลำดับช่องต้องตรงตามนี้ ช่อง 6, 7, 8 วางแบนกับพื้น

```
Same papercraft style and the same camera. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one SMALL separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. These are tiny details scattered on the volcanic ground, each only a little taller than a hero's knee. Row 1: small tuft of dry ash-grey grass; larger clump of dry ash-grey grass; low mound of grey ash; tiny pile of cinders with a faint glow. Row 2: small burnt twig; tiny orange ember flower; a thin glowing crack in the rock seen from above, lying flat; a flat patch of cooled lava crust plates with thin glowing seams seen from above, lying flat. Row 3: footprints pressed into ash seen from above, lying flat; small stone with a faint glowing vein; charred dry reeds; tiny black rock mound. Palette muted charcoal and soot grey with only small touches of orange. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no cast shadows, no ash around the objects, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: 0 หญ้าแห้งกอเล็ก, 1 หญ้าแห้งกอใหญ่, 2 กองเถ้า, 3 กองถ่านเรือง / 4 กิ่งไหม้, 5 ดอกไม้ถ่านแดง, 6 รอยแตกเรือง (แบน), 7 แผ่นลาวาเย็น (แบน) / 8 รอยเท้า (แบน), 9 หินมีเส้นเรือง, 10 กกไหม้, 11 กองหินดำเล็ก

## 3. ลายพื้น 3 ภาพ → `raw/map4_volcano/ground_ash_rock.png`, `ground_ash_path.png`, `ground_lava.png`

เจนทีละภาพ ขึ้นต้นด้วยข้อความเดียวกับลายพื้นใน `MAP1_FOREST.md` (ข้อ 4) แล้วต่อท้ายด้วยเนื้อหาในตาราง
ลายลาวาไม่ต้องคอนทราสต์ต่ำ ให้ตัดประโยค `LOW contrast: 4 to 5 close shades only, nothing bright, nothing near black` ออกจากข้อความขึ้นต้น เฉพาะภาพลาวาภาพเดียว

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_ash_rock.png` | `Rough cooled volcanic rock: small torn scraps of muted warm charcoal-grey card with shallow cut cracks and a thin dusting of grey ash paper, lifted well above black, no lava, no glow, no plants, calm and even.` |
| `ground_ash_path.png` | `A trampled path of packed grey ash: small torn scraps of soft dull grey-brown paper with tiny crushed cinder bits, lighter and warmer than the rock around it, no glow, no plants, calm and even.` |
| `ground_lava.png` | `Slowly moving molten lava made of layered paper: darker cooling crust plates cut from charcoal card floating on glowing deep orange and red-orange paper, with thin bright yellow-orange seams, even all over, no single big shape.` |

## 4. หน้าผาใต้เกาะ → `raw/map4_volcano/island_cliff.png` (4×2)

```
Same papercraft style and the same 8 cliff columns layout as the earlier cliffs, but for the Ashen Isle: exactly 8 separate tall broken cliff columns in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Make each column WIDE and chunky, filling most of its cell's width as well as its height. Each has at the very top an irregular charcoal rock lip seen slightly from above, then about one quarter layers of grey ash and cinder paper, then dark basalt made of stacked charcoal cardboard strata with vertical cracks and ledges, tapering into 2 or 3 jagged points. A few have a thin glowing orange crack, and one or two have a thin line of paper lava trickling down. All 8 different. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no smoke, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 5. แผ่นดินลอย → `raw/map4_volcano/island_slabs.png` (4×2)

```
Same papercraft style and rules. Generate an image: exactly 8 separate small floating land slabs broken off the volcanic island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a charcoal rock top seen from above in the same isometric view, grey ash layers under it, and a short jagged dark basalt point at the bottom, wider than tall. Row 1: four slabs each carrying a small burnt pillar or a dead charred tree. Row 2: one with a magma crystal cluster, one with a basalt boulder, one split by a thin glowing orange seam, one with a tiny lava pool. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no smoke, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 6. ลานห้องบอส (หัวใจภูเขาไฟ) → `raw/map4_volcano/ground_room.png`

ขึ้นต้นด้วยข้อความเดียวกับข้อ 9 ใน `MAP1_FOREST.md` จนถึง `This is the floor of a boss's arena:` แล้วต่อด้วย

```
cracked black basalt paving cut from charcoal card with fine grey ash paper in the gaps and only a few very thin dim orange seams, warm charcoal and soot grey.
```

## 7. ของรอบลานห้องบอส → `raw/map4_volcano/room_props.png` (4×2)

```
Same papercraft style, same isometric camera, light from the upper left. Now props for the walls around the boss arena, the heart of Ashen Isle: burnt black basalt ruins made of charcoal card with thin glowing orange cracks. Generate an image: exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping. Row 1: a tall broken basalt pillar; a short section of ruined basalt wall; an iron brazier of glowing paper embers; a large basalt boulder. Row 2: a smaller broken pillar; a pile of basalt rubble; a carved standing stone with a glowing orange rune; a charred dead tree. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no lava, no smoke, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `room_volcano_pillar_0` `room_volcano_wall` `room_volcano_brazier` `room_volcano_boulder` / `room_volcano_pillar_1` `room_volcano_rubble` `room_volcano_rune_stone` `room_volcano_tree`
