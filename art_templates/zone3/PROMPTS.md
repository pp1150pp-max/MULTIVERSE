# แมพ 3 ดินแดนหิมะ: prompt สำหรับสร้างภาพใน ChatGPT

สร้างทุกภาพในแชทเดียวกัน และแนบภาพ Gunslinger เป็นตัวอย่างในภาพแรก
เซฟไฟล์ดิบตามชื่อในแต่ละหัวข้อไว้ที่ `art_templates/zone3/raw/` แล้วผมจะตัดพื้นหลังและวางเข้าเกมเอง

มีทั้งหมด 12 ภาพ ถ้าอยากเล่นได้เร็ว ให้เริ่มจากข้อ 1–5 ก่อน

## 1. มอนสเตอร์ ชุด A → `monsters_a.png`

```
Monsters for the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi proportions with a big head and big round shiny eyes, soft rounded shapes, friendly rather than scary, no gore. Same camera angle. Generate an image: a strict grid of 3 rows x 5 columns, one creature per row, each row the SAME creature in exactly 5 views, from left to right: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Identical size, colors and design across its 5 views, on the same baseline, generous empty space, nothing touching or overlapping. Row 1: Frost Penguin, a small round penguin with a dark slate-blue back, cream belly, orange beak and a little frost on its head. Row 2: Tusk Seal, a chubby heavy grey seal with two long ivory tusks, mottled spots and small flippers, wider than it is tall. Row 3: Snow Owl, a fluffy white owl with pale blue wing tips, golden eyes and short spread wings, hovering just above the ground. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on any creature.
```

## 2. มอนสเตอร์ ชุด B → `monsters_b.png`

```
Same exact style, same cute proportions and same layout rules: a strict grid of 3 rows x 5 columns, each row the SAME creature in the same 5 views, front, three-quarter front LEFT, side LEFT, three-quarter back LEFT, back. Row 1: Snow Sprite, a small floating spirit made of packed snow and pale cyan ice, with a round face, small icy crystal crown and two tiny floating hands, no legs. Row 2: Polar Bear, a big sturdy polar bear with thick white fur, a few old healed scars across its muzzle and shoulder, and jagged chunks of blue ice stuck to its back and forelegs, clearly white and icy, tougher but still cute. Row 3: Yeti Minion, a stocky young yeti with shaggy BLUE-GREY fur, a darker grey face, short rounded arms, no horns and no ice armour, smaller and plainer than a boss. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on any creature.
```

## 3. บอสเยติ → `monster_yeti.png`

```
Same exact style and same 5 views. Generate an image: 1 row x 5 columns of one large boss creature, Yeti, filling most of each cell, identical size and design in all views, on the same baseline. A huge powerful yeti with thick snow-WHITE shaggy fur, a pale blue face, two short curved dark horns, enormous fists, and big jagged blue ice crystals growing from its shoulders. Imposing boss silhouette but with big round eyes so it stays charming rather than horrifying, no blood, no gore. Must look clearly different from a plain blue-grey minion yeti. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on the creature.
```

## 4. ฉากประกอบ → `props.png`

```
Now the map props of this game in the EXACT same fine-detail 16-bit SNES-era pixel-art style: dark outline, 3 to 4 tones per material, small crisp pixels. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, as in classic isometric RPGs: we see the tops of objects, and each base sits on an imaginary diamond-shaped footprint. NOT a flat front view. Light from the upper left. This is Frost Reach, a frozen land. Palette: dark blue-green pine, muted blue-grey shadows on the snow, pale cyan ice, cold grey stone, nothing pure white in large areas. Generate an image: exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping. Row 1: slim tall pine with snow on its branches, medium pine with heavy snow, very tall broad pine with snow, bare frost-covered tree with icicles. Row 2: small snow-covered shrub, larger snow-covered shrub, frosted fern with pale blue leaves, short cut tree stump capped with snow. Row 3: grey boulder with a snow cap, large grey boulder with a snow cap, cluster of three pale cyan ice crystals, taller cluster of big ice crystals. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `snow_pine_0` `snow_pine_1` `snow_pine_2` `frost_tree` / `snow_shrub_0` `snow_shrub_1` `frost_fern` `snow_stump` / `snow_rock_0` `snow_rock_1` `ice_crystal_0` `ice_crystal_1`

## 5. ลายพื้น 3 ภาพ → `ground_snow.png`, `ground_snow_path.png`, `ground_ice.png`

สร้างทีละภาพ โดยขึ้นต้นด้วยข้อความนี้ทุกภาพ แล้วต่อท้ายด้วยเนื้อหาในตาราง

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge. EXACT same fine-detail 16-bit SNES-era pixel-art style as the props above: small crisp pixels, no blur. Viewed from above with no perspective. No focal point, no vignette, no borders, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. Rich surface detail but LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_snow.png` | `windblown snow with soft shallow drifts and small lumps, muted dusty blue-grey, NOT white, no plants, no stones` |
| `ground_snow_path.png` | `hard-packed trampled snow trail with shallow boot prints and sled marks, tiny embedded grey pebbles, darker slate blue-grey than fresh snow, no mud, no orange` |
| `ground_ice.png` | `thick frozen lake ice with fine pale cracks and trapped tiny air bubbles, muted steel blue with slightly lighter cyan streaks, no snow, no water ripples` |

## 6. ของตกแต่งบนพื้น → `decor_snow.png`

```
EXACT same fine-detail 16-bit SNES-era pixel-art style as the props above: 2D isometric view angle, crisp pixels, soft dark outline. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one small separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. Row 1: small tuft of frosted grass, larger clump of frosted grass, low snow drift, tiny pale ice crystals. Row 2: bare twig with frozen red berries, small pale blue ice flower, flat crack mark in lake ice, flat patch of frozen bubbles. Row 3: flat boot prints in packed snow, small stone with a snow cap, frozen dry reeds, tiny snow mound. Palette muted blue-grey and pale cyan, nothing pure white. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on the ground, no text, no labels, no grid lines. Do not use pink or magenta in the objects.
```

## 7. หน้าผาเกาะ → `island_cliff_snow.png`

```
Generate game assets in the same fine-detail 16-bit SNES pixel-art style, same 2D isometric view and light from the upper left. Generate an image: a sprite sheet of exactly 8 separate tall broken cliff columns, as if each was cut from under the near edge of a frozen floating island, in a 4 columns x 2 rows grid. Each column fully inside its own cell, nothing touching or overlapping, generous empty space between. Every column has the same structure: at the very top an irregular muted blue-grey snow lip seen slightly from above with a crumbled edge, then about one quarter packed snow and blue ice layers with hanging icicles, then dark slate-blue stratified stone with cracks and ledges, tapering down into 2 or 3 jagged stalactite points at the bottom. Each column fills most of its cell height and width. All 8 are different in outline. A few have a thin glowing pale-cyan crack running through the rock. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 8. แผ่นดินลอย → `island_slabs_snow.png`

```
Same style, same rules. Generate an image: exactly 8 separate floating land slabs broken off the frozen island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a muted blue-grey snow top seen from above in the same isometric view, ice layers and icicles under it, and a short jagged dark slate underside, wider than tall. Slabs 1 to 4 each carry 1 or 2 small snowy pines on top. Slabs 5 to 8 carry an ice crystal or a boulder or a cracked bare top. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 9. ไอคอนไอเทม 12 ชิ้น → `item_icons.png`

```
Generate a SQUARE image: inventory item icons for the same game, EXACT same fine-detail 16-bit SNES-era pixel-art style, dark outline, 3 to 4 tones per material, crisp pixels. A strict invisible grid of 4 columns x 3 rows, one item centred in each cell, filling most of it, drawn at a slight angle, nothing touching. A frost theme of pale cyan ice, cold steel, white fur and dark blue leather. Row 1: Frostbite Saber (curved ice-edged sword), Icicle Wand (short wand tipped with an icicle), Glacier Repeater (blue steel repeating gun with frost), Yeti Cleaver (huge heavy cleaver with a white fur grip). Row 2: Aurora Staff (tall staff with a glowing green-cyan crystal), Permafrost Pistol (ornate pistol with ice crystals), Glacier Plate (heavy armour with ice-blue plates), Snowweave Robe (pale blue and white robe). Row 3: Fur-lined Coat (long dark blue coat with a white fur collar), Frostfur Hood (white fur hood), Snowtread Boots (fur-trimmed boots with spiked soles), Frost Ring (silver ring set with a pale ice gem). Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no labels, no grid lines. Do not use pink or magenta in the items.
```

## 10. สะเก็ดน้ำแข็งและก้อนหิมะ → `shots.png`

```
Same exact style. Generate an image: 2 separate objects side by side with wide empty space. Left: a sharp flying ice shard seen from the side, a long pale cyan crystal splinter with a pointed tip aimed exactly to the RIGHT, with a jagged tail on the left. Right: a round packed snowball with lumpy texture and blue-grey shading. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no motion lines, no text, no labels, no grid lines. Do not use pink or magenta in the objects.
```
