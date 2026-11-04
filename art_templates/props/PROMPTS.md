# ฉากประกอบทั้ง 2 โซน: prompt ที่ใช้สร้างภาพใน ChatGPT

สไตล์ 16-bit SNES มุม 2D isometric มองจากด้านบนเฉียงประมาณ 35 องศา ความละเอียดเดียวกับ Gunslinger สร้างในแชทเดียวกัน
ชุดนี้แทน prompt ฉากประกอบเดิมใน `art_templates/zone1/PROMPTS.md` และ `art_templates/zone2/PROMPTS.md`

ไฟล์อยู่ที่ `public/assets/sprites/props/` ภาพละ 1 ไฟล์ ความสูงในเกมกำหนดใน `src/shared/sim/terrain.ts`

- โซน 1: ตัดให้สูงไม่เกิน 240px ส่วน `pebble_0` และ `pebble_1` สูง 74px โดย `pebble_1` คือ `rock_1` ขนาดย่อ
- โซน 2: ตัดให้สูงไม่เกิน 202px

ถนน ทางไม้ และบ่อน้ำไม่ใช่ไฟล์ภาพ เกมวาดด้วยโค้ดใน `src/client/world.ts` (`paintBand`, `paintPools`, ชุดสี `PALETTES`)

## 1. ต้นไม้ พุ่มไม้ หิน โซน 1

```
Now redraw the map props of this game. EXACT same fine-detail 16-bit SNES-era pixel-art style as the characters above:
dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, no painterly texture.
VERY IMPORTANT CAMERA: every object is drawn in 2D isometric 3/4 view from above, as in classic isometric RPGs, looking
down at about 35 degrees: we see the tops of objects, leaf canopies seen from above and slightly in front, rounded tops
of boulders, the top face of the stump rings, and each object's base sits on an imaginary diamond-shaped ground
footprint. NOT a flat front view. Light from the upper left. This is Emerald Forest, a lush healthy sunlit green forest,
not a swamp: no dead trees, no hanging moss. Palette: rich emerald and leaf greens, warm brown bark, neutral grey stone.
Generate an image: prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between
them, each fully inside its own cell, nothing touching or overlapping. Row 1: small young leafy tree, medium round leafy
oak tree, large tall broad leafy tree, tall broken tree trunk snag with a few leaves. Row 2: medium leafy bush, large
leafy bush, small leafy bush, short cut tree stump showing its rings on top. Row 3: three different grey boulders with
only a touch of green moss, and one small flat mossy stone. Background ONE perfectly flat solid magenta (#FF00FF)
everywhere, no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta
or purple on any object.
```

→ `tree_0` `tree_1` `tree_2` `stump_tall` / `bush_0` `bush_1` `bush_2` `stump` / `rock_0` `rock_1` `rock_2` `pebble_0`

## 2. ของในแคมป์

```
Same exact style and the same 2D isometric 3/4 view from above at about 35 degrees, light from the upper left, same layout
rules: exactly 12 separate objects, 4 columns x 3 rows, generous space, nothing touching or overlapping. Generate an
image: wooden adventurer camp objects for the same Emerald Forest, seen from above so we see their roofs and top faces.
Row 1: canvas A-frame camping tent with a small red pennant, seen at a diagonal; campfire with logs and orange flames on a
stone ring; wooden direction signpost; one short section of rustic wooden post-and-rail fence running diagonally from
lower left to upper right. Row 2: tall carved grey runestone with a glowing pale-gold rune; round stone well with a wooden
roof and bucket; wooden barrel with iron bands showing its round top; closed wooden treasure chest with iron trim seen at
a diagonal. Row 3: wooden hand cart with two wheels and sacks seen at a diagonal; tall red cloth banner on a wooden pole;
small red triangular flag on a thin pole; tall wooden watchtower on four legs with a small roof seen from above at a
diagonal. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no ground patches, no cast shadows, no text,
no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

→ `tent` `campfire` `sign` `fence` / `runestone` `well` `barrel` `chest` / `cart` `banner_red` `flag` `watchtower`

## 3. ฉากประกอบโซน 2

```
Same exact style and the same 2D isometric 3/4 view from above at about 35 degrees, light from the upper left, same layout
rules: exactly 12 separate objects, 4 columns x 3 rows, generous space, nothing touching or overlapping. Generate an
image: props for the Misty Marsh swamp zone, with a muted olive, moss and dark-brown palette. Row 1: three different
gnarled swamp trees with twisted bare branches, a little hanging moss and small shelf fungus, seen from above; and one
drooping willow tree with hanging olive-green strands. Row 2: two different clumps of tall reeds and cattails; one dark
swamp fern bush; one cluster of softly glowing teal-capped mushrooms. Row 3: two different mossy grey boulders; one rotten
hollow tree stump with moss seen from above; and one ancient stone archway portal covered in vines with a swirling
teal-green energy inside, seen at a diagonal. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no water,
no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

→ `swamp_tree_0` `swamp_tree_1` `swamp_tree_2` `willow` / `reeds_0` `reeds_1` `fern` `mushrooms` / `mossrock_0` `mossrock_1` `swamp_stump` `portal`
