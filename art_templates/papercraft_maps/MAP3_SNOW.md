# แมพ 3 ดินแดนหิมะ (`frost_reach`)

เจนต่อในแชทเดิมได้เลย ถ้าเปิดแชทใหม่ ให้แนบ `raw/ref/A5_snow.png` กับภาพแมพ 1 หรือแมพ 2 ที่ชอบที่สุด 1–2 ภาพ แล้วขึ้นต้นข้อแรกด้วยประโยคเปิดของข้อ 0 ใน `MAP1_FOREST.md`
เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/map3_snow/`
ชุดแคมป์ เศษหินลอย และรอยแตกใช้ร่วมกับแมพ 1 จึงไม่ต้องเจนใหม่
เรื่องสี: หิมะต้องเป็นสีขาวอมฟ้าเทา อย่าให้เป็นสีขาวล้วนทั้งผืน ไม่อย่างนั้นในเกมจะสว่างแสบตา

## 1. ต้นไม้ พุ่มไม้ หิน คริสตัล → `raw/map3_snow/props.png` (4×3)

```
Now the map props for the third area, Frost Reach, a frozen land, in EXACTLY the same papercraft style as the forest and marsh props and the attached snow screenshot: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. SAME camera: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint. Palette: dark blue-green pine paper, snow cut from soft blue-grey and off-white paper (never large areas of pure white), pale cyan translucent ice, cold grey stone. Generate an image: prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Row 1: slim tall pine with snow on its branches; medium pine with heavy snow; very tall broad pine with snow; bare frost-covered tree with paper icicles. Row 2: small snow-covered shrub; larger snow-covered shrub; frosted fern with pale blue leaves; short cut tree stump capped with snow. Row 3: grey boulder with a snow cap; large grey boulder with a snow cap; cluster of three pale cyan ice crystals; taller cluster of big ice crystals. Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no snow on the background, no cast shadows on the background, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `snow_pine_0` `snow_pine_1` `snow_pine_2` `frost_tree` / `snow_shrub_0` `snow_shrub_1` `frost_fern` `snow_stump` / `snow_rock_0` `snow_rock_1` `ice_crystal_0` `ice_crystal_1`

## 2. ของตกแต่งเล็ก ๆ บนพื้น → `raw/map3_snow/decor.png` (4×3)

ลำดับช่องต้องตรงตามนี้ ช่อง 6, 7, 8 วางแบนกับพื้น

```
Same papercraft style and the same camera. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one SMALL separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. These are tiny details scattered on the snowy ground, each only a little taller than a hero's knee. Row 1: small tuft of frosted grass; larger clump of frosted grass; low snow drift; tiny pale cyan ice crystals. Row 2: bare twig with frozen red berries; small pale blue ice flower; a thin crack mark in lake ice seen from above, lying flat; a flat patch of frozen bubbles in ice seen from above, lying flat. Row 3: boot prints pressed into snow seen from above, lying flat; small stone with a snow cap; frozen dry reeds; tiny snow mound. Palette muted blue-grey and pale cyan, never large areas of pure white. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no cast shadows, no snow around the objects, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: 0 หญ้าน้ำค้างแข็งกอเล็ก, 1 หญ้ากอใหญ่, 2 กองหิมะ, 3 คริสตัลเล็ก / 4 กิ่งผลไม้แดง, 5 ดอกน้ำแข็ง, 6 รอยร้าวน้ำแข็ง (แบน), 7 ฟองในน้ำแข็ง (แบน) / 8 รอยเท้า (แบน), 9 หินมีหิมะ, 10 กกแห้ง, 11 กองหิมะเล็ก

## 3. ลายพื้น 3 ภาพ → `raw/map3_snow/ground_snow.png`, `ground_snow_path.png`, `ground_ice.png`

เจนทีละภาพ ขึ้นต้นด้วยข้อความเดียวกับลายพื้นใน `MAP1_FOREST.md` (ข้อ 4) แล้วต่อท้ายด้วยเนื้อหาในตาราง

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_snow.png` | `A snow field: small torn scraps of soft off-white and pale blue-grey paper with tiny shading, lifted well below pure white, calm and even.` |
| `ground_snow_path.png` | `A trodden snow path: small torn scraps of packed grey-blue snow paper with a few tiny scraps of brown earth and grit showing through, a little darker than the snow field, calm and even.` |
| `ground_ice.png` | `A frozen pond surface: smooth layered sheets of translucent pale cyan and blue tissue paper with very faint thin white crack lines, calm and even, no reflections, no snow piles.` |

## 4. หน้าผาใต้เกาะ → `raw/map3_snow/island_cliff.png` (4×2)

```
Same papercraft style and the same 8 cliff columns layout as the forest cliffs, but for the Frost Reach island: exactly 8 separate tall broken cliff columns in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each has at the very top a thin irregular lip of packed snow paper seen slightly from above, then layers of frozen grey-brown paper earth with a few hanging paper icicles, then cold blue-grey stone made of stacked cardboard strata with cracks, tapering into 2 or 3 jagged points. A few have a thin glowing pale cyan crack. All 8 different. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 5. แผ่นดินลอย → `raw/map3_snow/island_slabs.png` (4×2)

```
Same papercraft style and rules. Generate an image: exactly 8 separate small floating land slabs broken off the snowy island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a snow paper top seen from above in the same isometric view, frozen earth layers with small icicles under it, and a short jagged blue-grey card-stone point at the bottom. Row 1: four slabs each carrying one or two small snowy pine trees. Row 2: one with snowy shrubs, one with a snow-capped boulder, one with a cluster of ice crystals, one with a small frozen pond. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 6. ลานห้องบอส (เยติ) → `raw/map3_snow/ground_room.png`

ขึ้นต้นด้วยข้อความเดียวกับข้อ 9 ใน `MAP1_FOREST.md` จนถึง `This is the floor of a boss's arena:` แล้วต่อด้วย

```
pale frost-covered stone slabs cut from card with thin snow paper drifted into the gaps and a few hairline ice cracks, cool light greys and soft blues, lifted well below pure white.
```

## 7. ของรอบลานห้องบอส → `raw/map3_snow/room_props.png` (4×2)

```
Same papercraft style, same isometric camera, light from the upper left. Now props for the walls around the boss arena, the yeti's cave in Frost Reach: ice-covered grey card-stone ruins with paper icicles and frozen bones. Generate an image: exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping. Row 1: a tall broken stone pillar with icicles; a short section of ruined icy stone wall; an iron brazier with layered cold blue paper flames; a large snow-capped boulder. Row 2: a smaller broken pillar; a pile of icy stone rubble; a carved standing stone with a glowing pale cyan rune; a snow-laden pine tree. Crisp clean edges. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no snow on the background, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `room_snow_pillar_0` `room_snow_wall` `room_snow_brazier` `room_snow_boulder` / `room_snow_pillar_1` `room_snow_rubble` `room_snow_rune_stone` `room_snow_tree`
