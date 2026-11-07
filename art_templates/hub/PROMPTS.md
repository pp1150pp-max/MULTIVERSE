# เมืองศูนย์กลางมิติ (ซากเมือง): prompt สำหรับสร้างภาพใน ChatGPT

มี 2 ภาพ: ชุดซากเมือง 12 ชิ้น และลายพื้นอิฐ
สร้างในแชทเดิมที่มีภาพ Gunslinger หรือแนบภาพ Gunslinger เป็นตัวอย่าง
เซฟไฟล์ดิบไว้ที่ `D:\Claude\Game\MULTIVERSE\art_templates\hub\raw\` แล้วผมจะตัดพื้นหลังและวางเข้าเกมเอง

ตัดภาพเข้าเกมด้วย `tools/cut_hub.cjs` ส่วนอื่นของแมพกลางใช้ภาพเดิมของแต่ละแมพ

## 1. ชุดซากเมือง → `ruins.png`

```
Now the central town of this game, in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the character above: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, no painterly texture. VERY IMPORTANT CAMERA: every object is drawn in 2D isometric 3/4 view from above, as in classic isometric RPGs, looking down at about 35 degrees: we see roofs, broken wall tops and top faces, and each object's base sits on an imaginary diamond-shaped ground footprint. NOT a flat front view. Light from the upper left. This is the beautiful ruins of an ancient city on a floating island, a fragment of a shattered world, where survivors now live: weathered warm sandstone and pale grey brick, broken and crumbling but still elegant, carved details, moss and small vines in the cracks, a few wildflowers, touches of faded gold and old blue paint. Peaceful and romantic, not gloomy. Generate an image: prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Row 1: large round ruined stone plaza fountain, cracked rim, a broken statue of a robed figure holding a glowing star on top, clear water still flowing, the centerpiece of the town; one straight section of crumbling old city wall with a broken jagged top, running diagonally from lower left to upper right; the SAME wall section running diagonally from upper left to lower right; tall ruined stone archway city gate, open in the middle so a road passes through, one top corner broken off. Row 2: tall broken carved stone column with its top snapped off and a fallen piece at its foot; half-collapsed two-story stone house with a partly fallen tiled roof and an empty window; ruined round stone watch tower with the top half crumbled away; weathered broken statue of a knight on a square pedestal, missing one arm. Row 3: small pile of fallen bricks, stone blocks and dust; merchant stall rebuilt from salvaged wooden planks and a patched cream-and-teal cloth awning, with crates and jars of goods; small blacksmith forge rebuilt inside a broken stone wall corner, with an anvil and a glowing furnace; small stone vault with a heavy iron-bound door set into a ruined wall. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no ground patches, no cast shadows, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `ruin_fountain` `ruin_wall_a` `ruin_wall_b` `ruin_arch` / `ruin_pillar` `ruin_house` `ruin_tower` `ruin_statue` / `ruin_rubble` `town_stall` `town_forge` `town_vault`

ร้านค้า โรงตีเหล็ก และคลังจะวางข้าง NPC ที่ทำหน้าที่นั้น กำแพงจะต่อกันเป็นวงรอบเมือง และซุ้มประตูอยู่ตรงที่ถนนทั้ง 4 เส้นผ่านกำแพง

## 2. ลายพื้นอิฐ → `ground_brick.png`

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge. EXACT same fine-detail 16-bit SNES-era pixel-art style as the props above: small crisp pixels, no blur. Viewed from above with no perspective. No focal point, no vignette, no borders, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. Rich surface detail but LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black. Old worn brick paving of an ancient ruined city: weathered warm sandstone-red and pale grey bricks laid in a herringbone pattern, rounded worn edges, a few cracked or missing bricks, thin lines of moss and tiny weeds between them, muted and dusty colors.
```

## 3. ชุดกำแพงเมืองที่ต่อกันได้ → `walls.png`

ภาพนี้มาแทนกำแพงใน `ruins.png` เพราะชิ้นเดิมต่อกันไม่เนียน เกมใช้กำแพงตรง กำแพงร้าว และเสาปลายกำแพง (ทางออกที่มุมเมืองเป็นช่องเปิดระหว่างเสาหิน 2 ต้น ไม่มีซุ้มประตู)
เมืองเป็นสี่เหลี่ยม (บนจอเห็นเป็นข้าวหลามตัด) มีกำแพงแนวเฉียง 2 ทิศ และทางออกที่มุมทั้ง 4

```
Same exact style and the same 2D isometric 3/4 view from above at about 35 degrees, light from the upper left, same ruined-city palette as the ruins above: weathered warm sandstone and pale grey brick, moss and small vines, a few wildflowers, faded gold and old blue accents. These are MODULAR city wall pieces that will be placed end to end many times to build one continuous wall, so they must line up perfectly. Every wall piece is the SAME height and the SAME thickness, has a flat walkway top with small crenellations, and both of its ends are cut off cleanly and straight (not broken, not rounded), so the next copy continues it with no gap. Each wall runs EXACTLY along one isometric ground diagonal, at the same angle as the floor tiles of a classic isometric game. Generate an image: prop sheet with exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Row 1, all running diagonally from LOWER LEFT to UPPER RIGHT: a straight wall section; the same wall section with a few missing bricks and a small crack, same outline and ends; a gatehouse in that same wall line with an open archway through the middle, the passage going straight through the wall from the upper left side to the lower right side, so we see into the passage and the road under it; a round corner tower that is wider and taller than the wall, where two walls meet at a right angle. Row 2, all running diagonally from UPPER LEFT to LOWER RIGHT: the straight wall section; the damaged variant; the gatehouse in this wall line, the passage going through from the lower left side to the upper right side; a short square stone pillar the same height as the wall, used to end a wall beside a gate. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no ground patches, no cast shadows, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `town_wall_a` `town_wall_a_broken` (ไม่ใช้) (ไม่ใช้) / `town_wall_b` `town_wall_b_broken` (ไม่ใช้) `town_wall_end`

