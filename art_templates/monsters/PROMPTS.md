# มอนสเตอร์ทั้ง 2 โซน: prompt ที่ใช้สร้างภาพใน ChatGPT

สไตล์ 16-bit SNES ระดับความละเอียดเดียวกับ Gunslinger สร้างในแชทเดียวกัน ถ้าเริ่มแชทใหม่ ให้แนบภาพ Gunslinger ไปเป็นตัวอย่างด้วย
ชุดนี้แทน prompt มอนสเตอร์เดิมใน `art_templates/zone1/PROMPTS.md` และ `art_templates/zone2/PROMPTS.md`
มอนสเตอร์แมพ 2 ออกแบบให้น่ารักขึ้น ไม่น่ากลัว แต่ยังเป็นชนิดเดิม

ไฟล์อยู่ที่ `public/assets/sprites/monsters/` แต่ละไฟล์มี 5 แถว x 3 คอลัมน์
แถวคือ หน้า, ทแยงหน้า, ข้าง, ทแยงหลัง, หลัง โดยหันไปทางซ้าย ฝั่งขวาเกมกลับด้านให้เอง จึงหันได้ 8 ทิศ
คอลัมน์คือ เฟรมปกติ, บีบ, ยืด ซึ่งสร้างจากภาพเดียวกัน ยังไม่ใช่แอนิเมชันเดินจริง

ความสูงตัวหลังตัด (px): slime, rabbit, fox, toad, leech, serpent = 110 / boar, wolf = 120 / ghoul, wisp = 130 / bear, witch = 220
ชุด 3 ใช้พื้นหลังสีเขียว #00FF00 เพราะปลิงสีม่วงจะถูกตัดออกไปพร้อมพื้นหลังสีม่วงแดง

## 1. Slime, Rabbit, Fox

```
Now monsters for the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger, mage
and NPCs: dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly
chibi game proportions with a big head and big eyes. Same camera angle. Generate an image: a strict grid of 3 rows x 5
columns, one creature per row, each row the SAME creature in exactly 5 views, from left to right: (1) front facing the
viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward
the LEFT, (5) back view. Identical size, colors and design across its 5 views, on the same baseline, generous empty
space, nothing touching or overlapping. Row 1: Green Slime, a round glossy translucent green slime blob with simple cute
eyes. Row 2: Wild Rabbit, a small tan and cream rabbit with long ears and a white puff tail. Row 3: Forest Fox, a slim
orange fox with white chest, dark legs and a bushy white-tipped tail. Recognizable ordinary friendly animals, not
mutants. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines.
Do not use pink, magenta or purple on any creature.
```

## 2. Boar, Wolf, Bear

```
Same exact style, same cute proportions and same layout rules: a strict grid of 3 rows x 5 columns, each row the SAME
creature in exactly 5 views, from left to right: (1) front facing the viewer, (2) three-quarter front turned toward the
LEFT, (3) side view facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view, standing on four legs on
the same baseline, nothing touching or overlapping. Row 1: Wild Boar, a stocky dark-brown boar with a bristly mane and
two small white tusks. Row 2: Forest Wolf, a lean grey wolf with darker back, pale chest and bushy tail. Row 3: Forest
Bear, a mini boss, big and heavy brown bear on four legs with a lighter muzzle and small round ears, drawn clearly larger
than the others. Recognizable ordinary animals, not monsters or mutants. Background ONE perfectly flat solid magenta
(#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on any creature.
```

## 3. Toad, Leech, Serpent

```
Now the swamp zone monsters, redesigned to be cute and friendly-looking rather than scary, while staying clearly the same
species. Same exact style, cute chibi proportions, big round shiny eyes, soft rounded shapes, no teeth, no gore, no
menacing expressions. Same layout rules: a strict grid of 3 rows x 5 columns, each row the SAME creature in exactly 5
views, from left to right: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view
facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view, on the same baseline, nothing touching or
overlapping. Row 1: Bog Toad, a chubby round olive-brown toad with a few small warts, a pale cream belly, big golden eyes
and a wide silly smile. Row 2: Marsh Leech, a plump soft dark-purple worm rearing up in a gentle S curve, glossy
highlights, two big cute eyes and a tiny round mouth with no teeth. Row 3: Swamp Serpent, a small cute teal-blue water
snake coiled with its head raised, cream-yellow belly scales, big eyes and small rounded fins on its head. Background ONE
perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use
bright green on any creature.
```

## 4. Ghoul, Wisp, Witch

```
Now the rest of the swamp zone, also redesigned to be cute and not scary while staying clearly the same creatures. Same
exact style, cute chibi proportions, big round eyes, soft rounded shapes, no teeth, no claws, no gore, no menacing
expressions. Same layout rules: a strict grid of 3 rows x 5 columns, each row the SAME creature in exactly 5 views, from
left to right: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side view facing LEFT,
(4) three-quarter back turned toward the LEFT, (5) back view, on the same baseline, nothing touching or overlapping. Row
1: Mire Ghoul, a small round goofy mud golem made of dark-brown mud with some moss and little root sprouts on its head,
stubby arms and legs, big glowing yellow eyes and a small innocent mouth. Row 2: Will-o'-Wisp, a floating round cute
blue-teal flame spirit with a soft curling flame tip, two big happy eyes and a tiny smile, a few small spark bits attached
close to the body. Row 3: Bog Witch, the boss, drawn clearly larger than the others, a cheeky chibi swamp witch girl with
a mischievous smile, big eyes, long messy moss-green hair, a dark-green hooded robe draped with moss and a few small
mushrooms, holding a crooked wooden staff topped with a glowing teal lantern. Background ONE perfectly flat solid magenta
(#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on any creature.
```
