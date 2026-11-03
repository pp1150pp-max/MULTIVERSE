# Zone 1 (Emerald Forest): prompt ที่ใช้สร้างภาพใน ChatGPT

ภาพของโซนนี้วาดใหม่ให้เป็นสไตล์เดียวกับ Zone 2 โดยยังเป็นป่าเขียวและมอนสเตอร์ชนิดเดิม
สร้างในแชทเดียวกับภาพของ Zone 2 เพื่อให้สไตล์ตรงกัน ถ้าเริ่มแชทใหม่ ให้แนบภาพของ Zone 2 ไปเป็นตัวอย่างด้วย

ขั้นตอนหลังได้ภาพเหมือนกับ Zone 2 (ดู `art_templates/zone2/PROMPTS.md`)
ตัดพื้นหลังสี #FF00FF ออก แยกเป็นชิ้น แล้วย่อขนาด

- ฉากประกอบ: ชิ้นละสูงประมาณ 240px
- มอนสเตอร์: ทำเป็นชีต 3×3 ช่องสูงประมาณ 118–128px ยกเว้นหมีสูงประมาณ 228px
- `pebble_0` และ `pebble_1` ย่อเหลือสูงประมาณ 72px โดย `pebble_1` คือ `rock_1` ขนาดย่อ

## 1. ต้นไม้ พุ่มไม้ หิน

```
Now a NEW zone that must look like it belongs to the same game: exact same pixel-art rendering, outlines,
shading and level of detail as the swamp props above, but a lush, healthy, sunlit green forest called
Emerald Forest (not swamp: no dead trees, no hanging moss, no fog colors). Palette: rich emerald and leaf
greens, warm brown bark, neutral grey stone. Generate an image: prop sheet with exactly 12 separate objects
in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing
touching or overlapping. Objects drawn upright, front view. Background ONE perfectly flat solid magenta
(#FF00FF) everywhere, no gradient, no ground, no cast shadows, no text, no labels, no grid lines. Do not use
pink, magenta or purple on any object.
Row 1: small young leafy tree, medium round leafy oak tree, large tall broad leafy tree, tall broken
dead-free tree trunk snag with a few leaves.
Row 2: medium leafy bush, large leafy bush, small leafy bush, short cut tree stump with visible rings.
Row 3: three different grey boulders with only a touch of green moss, and one small flat mossy stone.
```

→ `tree_0` `tree_1` `tree_2` `stump_tall` / `bush_0` `bush_1` `bush_2` `stump` / `rock_0` `rock_1` `rock_2` `pebble_0`

## 2. ของในแคมป์

```
Excellent. Same exact style and the same layout rules (exactly 12 separate objects, 4 columns x 3 rows,
generous space, flat solid magenta #FF00FF background, no ground, no shadows, no text, no grid, no pink or
purple on objects). Generate an image: wooden adventurer camp objects for the same Emerald Forest.
Row 1: canvas A-frame camping tent with a small red pennant, campfire with logs and orange flames on a stone
ring, wooden direction signpost, short section of rustic wooden post-and-rail fence.
Row 2: tall carved grey runestone with a glowing pale-gold rune, round stone well with wooden roof and bucket,
wooden barrel with iron bands, closed wooden treasure chest with iron trim.
Row 3: wooden hand cart with two wheels and sacks, tall red cloth banner on a wooden pole, small red
triangular flag on a thin pole, tall wooden watchtower on four legs with a small roof.
```

→ `tent` `campfire` `sign` `fence` / `runestone` `well` `barrel` `chest` / `cart` `banner_red` `flag` `watchtower`

## 3. มอนสเตอร์ ชุด A

```
Same exact art style as the swamp monsters above, but friendly-looking forest animals for the sunlit Emerald
Forest. Generate an image: monster sheet, 3 rows x 3 columns, one creature per row, each row the SAME creature
in 3 views from left to right: (1) front view facing the viewer, (2) side view facing LEFT, (3) back view.
Identical size, colors and design across its 3 views, on the same baseline, feet touching the bottom of each
cell, generous empty space, nothing overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no
shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on any creature.
Row 1: Green Slime - round glossy translucent green slime blob with simple cute eyes.
Row 2: Wild Rabbit - small tan and cream rabbit with long ears and a white puff tail.
Row 3: Forest Fox - slim orange fox with white chest, dark legs and a bushy white-tipped tail.
```

→ `green_slime` `wild_rabbit` `forest_fox`

## 4. มอนสเตอร์ ชุด B

```
Same exact style and same layout rules (3 rows x 3 columns, each row = one creature in front view / side view
facing LEFT / back view, identical design across views, four legs on the baseline, flat solid magenta #FF00FF
background, no shadows, no text, no grid, no pink or purple). These must be recognizable ordinary real
animals, not monsters or mutants.
Row 1: Wild Boar - stocky dark-brown boar with a bristly mane and two small white tusks.
Row 2: Forest Wolf - lean grey wolf with darker back, pale chest and bushy tail.
Row 3: Forest Bear (mini boss, make it big and heavy) - large brown bear on four legs with a lighter muzzle
and small round ears.
```

→ `wild_boar` `forest_wolf` `forest_bear`
