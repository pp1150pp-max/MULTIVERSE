# เกาะลอยที่กำลังแตกสลาย: prompt ที่ใช้สร้างภาพใน ChatGPT

สร้างในแชทเดียวกันทุกภาพเพื่อให้สไตล์ตรงกัน ภาพแนวคิดที่ตกลงกับเจ้าของอยู่ที่ `concept.jpg`
ไฟล์อยู่ที่ `public/assets/sprites/props/island_*.png` และถูกวางในเกมโดย `src/client/world.ts` กับ `src/client/island.ts`

หลังสร้างภาพ ตัดพื้นหลังสีชมพูออก แล้วปรับสีให้เข้ากับเกม:

- สีเขียวของหญ้าถูกคูณลงให้ใกล้พื้นในเกม ป่าใช้ R×0.55 G×0.62 B×0.9 หนองน้ำใช้ R×0.58 G×0.7 B×1.3
- หินสีม่วงของฝั่งป่าลดความอิ่มสีลง 60% ให้ใกล้หินสีเทาในเกม
- ใน `island_cliff_*` สีเขียวทั้งหมดถูกเปลี่ยนเป็นสีดิน และในเกมส่วนบนของเสาหินซ่อนอยู่ใต้พื้น ให้พื้นจริงวิ่งถึงขอบเกาะ

ฉากดาวและเนบิวลาไม่ใช่ไฟล์ภาพ เกมวาดด้วยโค้ดใน `paintSpace` เพื่อให้ปูต่อกันได้ไม่มีรอย

## 1. ภาพแนวคิด

```
Generate an image: concept art for a fantasy action RPG map. Fine-detail 16-bit SNES-era pixel art, dark outlines, rich
shading with 3 to 4 tones per material, small crisp pixels, no painterly texture. 2D isometric view looking down at about
35 degrees, so the island reads as a diamond with its two near edges at the bottom of the picture. Light from the upper
left. Subject: one huge forest island adrift in deep outer space, and it is BREAKING APART. Top surface: green grass, a
dirt road, a dense forest wall that thins out in places near the rim. The rim is jagged and irregular with no straight
lines, roughly following the diamond shape. Long dark cracks run through the ground near the rim, and big slabs of land
are splitting off, tilted and drifting a little away from the island with their own grass and small trees still on top.
Below the two near edges: a tall broken rock cliff in layers of soil and dark stone, with hanging tree roots, tapering
down into jagged stalactite rock, and crumbs of dirt and boulders falling away into the void. All around the island:
hundreds of drifting rock chunks from large to tiny, plus glowing cyan and pale gold star shards among them, like a
shattered star. Background: dark indigo and violet space with small crisp stars and a soft nebula. No planets, no text,
no labels, no UI, no characters.
```

## 2. หน้าผา โซน 1 → `island_cliff_forest` (4×2)

```
Love it. Now generate game assets in that exact same fine-detail 16-bit SNES pixel-art style, same 2D isometric view and
light from the upper left. Generate an image: a sprite sheet of exactly 8 separate tall broken cliff columns, as if each
was cut from under the near edge of the forest island, in a 4 columns x 2 rows grid. Each column fully inside its own
cell, nothing touching or overlapping, generous empty space between. Every column has the same structure: at the very top
an irregular green grass lip seen slightly from above with a crumbled edge, then about one quarter brown layered soil with
thick hanging tree roots, then dark grey-violet stratified stone with cracks and ledges, tapering down into 2 or 3 jagged
stalactite points at the bottom. Each column fills most of its cell height and most of its cell width. All 8 are different
in outline. A few have a thin glowing pale-gold crack running through the rock. Background ONE perfectly flat solid
magenta (#FF00FF) everywhere, no gradient, no stars, no space, no cast shadows, no text, no labels, no grid lines. Do not
use pink, magenta or purple on any object.
```

## 3. แผ่นดินลอย โซน 1 → `island_slabs_forest` (4×2)

```
Perfect style. Same rules, same structure. Generate an image: exactly 8 separate floating land slabs broken off the
forest island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab
has a grass top seen from above in the same isometric view, soil and hanging roots under it, and a short jagged rock
underside, wider than tall. Slabs 1 to 4 each carry 1 or 2 small leafy green trees on top. Slabs 5 to 8 carry bushes or a
boulder or a cracked bare top. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no
cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 4. หน้าผา โซน 2 → `island_cliff_marsh` (4×2)

```
Same style and layout as the 8 cliff columns earlier, but for a second island, Misty Marsh, a dark swamp. Generate an
image: exactly 8 separate tall broken cliff columns in a 4 columns x 2 rows grid, each fully inside its own cell, nothing
touching, generous space. Same structure: at the top an irregular murky olive and moss green marsh lip with a crumbled
edge and a tiny puddle of dark teal water on some, then dark wet peat soil with hanging pale roots and dripping grey-green
moss, then dark blue-grey stratified stone with cracks, tapering into 2 or 3 jagged stalactite points. A few have a thin
glowing teal crack. All 8 different. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no
stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 5. แผ่นดินลอย โซน 2 → `island_slabs_marsh` (4×2)

```
Same Misty Marsh style. Generate an image: exactly 8 separate floating land slabs broken off the swamp island, in a 4
columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a murky moss-green
top seen from above in the same isometric view, peat soil with pale hanging roots under it, and a short jagged blue-grey
rock underside, wider than tall. Slabs 1 to 4 each carry a small dead twisted swamp tree with hanging grey moss. Slabs 5
to 8 carry reeds, or a tiny dark pool, or a mossy boulder, or glowing teal mushrooms. Background ONE perfectly flat solid
magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink,
magenta or purple on any object.
```

## 6. เศษหินและสะเก็ดดาว ใช้ทั้ง 2 โซน → `island_debris` (4×3)

```
Same style, for both islands. Generate an image: exactly 12 separate objects in a 4 columns x 3 rows grid, each fully
inside its own cell, nothing touching, generous space. Row 1: four different jagged dark grey-violet space rock chunks,
large, with lit facets on the upper left. Row 2: two small crumbling brown dirt clods with a tuft of pale root, and two
small sharp stone shards. Row 3: four different glowing broken star shards, long sharp crystal splinters: two icy cyan and
two pale gold, each with a bright white core and small sparkles attached. Background ONE perfectly flat solid magenta
(#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta
or purple on any object.
```

## 7. รอยแตกบนพื้น ใช้ทั้ง 2 โซน → `island_cracks` (4×2)

```
Same style. Generate an image: exactly 8 separate ground cracks seen from straight above, to be laid flat on the ground
like decals, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each is a
long jagged branching fissure, black in the deepest part, with dark brown broken soil along its lips and a thin glowing
molten pale-gold line in the centre of some branches. Each crack runs across most of its cell, in different directions.
Only the crack itself, no grass, no surrounding ground. Background ONE perfectly flat solid magenta (#FF00FF) everywhere,
no gradient, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```
