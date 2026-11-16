# ทดลองสไตล์ภาพใหม่: prompt สำหรับ ChatGPT

เจ้าของอยากลองหลายสไตล์ก่อนเลือกสไตล์ใหม่ของทั้งเกม (มอน คลาส และพื้นที่) เมื่อ 2026-11-16
แต่ละสไตล์เจนเป็น **ภาพฉากรวม 1 ภาพ** หน้าตาเหมือนภาพจับหน้าจอเกมจริง จะได้เทียบกันได้ตรงๆ

- ฉากเดียวกันทุกสไตล์: ป่ามรกต มีตัวละครครบ 3 คลาส สู้กับมอนของป่ามรกต 3 ตัว
- **เจนสไตล์ละ 1 แชทใหม่** สไตล์จะได้ไม่ปนกัน
- **แนบภาพ 3 ไฟล์ไปกับทุก prompt** ให้ AI เห็นหน้าตาตัวละคร (ใช้แค่ดีไซน์ ไม่ใช้สไตล์):
  - `public/assets/sprites/player/sword/idle.png`
  - `public/assets/sprites/player/mage/idle.png`
  - `public/assets/sprites/player/gunslinger/idle.png`
- เซฟภาพไว้ที่ `art_templates/style_test/raw/` ตามชื่อไฟล์ในแต่ละหัวข้อ (ภาพใน `raw/` ไม่ commit)
- ถ้าชอบสไตล์ไหนแต่ยังไม่สุด ให้เจนซ้ำในแชทเดิมได้ แล้วเซฟเป็น `_2`, `_3`

ข้อควรรู้เวลาเลือก: ระบบตัวละครแบบกระดูก (ที่พักไว้) หมุนชิ้นส่วนภาพ
สไตล์ภาพวาด (ข้อ 1, 2, 4) หมุนแล้วยังเนียน ส่วนพิกเซล (ข้อ 3) หมุนแล้วขอบจะหยักเป็นขั้นบันได

---

## 1. ภาพวาด HD อนิเมะ → `raw/style_1_anime_hd.png`

```
The three attached sprites show the three player characters of my game. Use them ONLY for the character designs
(hair, outfits, colors, weapons). Do NOT copy their pixel-art style.
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, seen from a fixed isometric camera
looking down at about 45 degrees, landscape 16:9. Art style: high-resolution hand-painted 2D anime game art like a
modern Korean or Japanese online RPG, clean smooth line art, soft cel shading with gentle gradients, bright saturated
colors, glossy highlights on metal and gems, soft rim light, polished and cute. Characters with slightly chibi
proportions about 4 heads tall and big expressive eyes.
Scene: a sunny clearing in an emerald forest. A winding dirt path, lush grass with small flowers, a few big leafy
trees and bushes around the edges, mossy rocks, a little stream with a wooden plank bridge.
Characters, all from the attached designs, in the middle of a fight:
(1) the swordsman knight with ash-blond hair, dark gunmetal armour with gold trim and charcoal cape, swinging his
glowing amber katana; (2) the witch mage girl with long silver-lavender hair, purple pointed hat and robe, raising
her gold staff with a glowing blue orb and casting a small blue magic bolt; (3) the gunslinger with silver-white
hair, goggles, red scarf and long black coat, firing his brass steampunk pistol.
Monsters: a round bouncy green slime, a small orange forest fox, and a brown wild boar with tusks, charging at them.
Every character and monster stands on the ground with a soft round shadow under the feet. The characters are small
on screen, as in a real game (about one eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 2. ภาพวาดสีน้ำ / ลายมือ → `raw/style_2_watercolor.png`

```
The three attached sprites show the three player characters of my game. Use them ONLY for the character designs
(hair, outfits, colors, weapons). Do NOT copy their pixel-art style.
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, seen from a fixed isometric camera
looking down at about 45 degrees, landscape 16:9. Art style: hand-drawn storybook illustration, soft watercolor
washes with visible paper texture, delicate ink outlines of varying weight, warm gentle light, muted pastel colors
with a few bright accents, cozy and whimsical like a painted children's picture book. Characters with slightly
chibi proportions about 4 heads tall and big expressive eyes.
Scene: a sunny clearing in an emerald forest. A winding dirt path, lush grass with small flowers, a few big leafy
trees and bushes around the edges, mossy rocks, a little stream with a wooden plank bridge.
Characters, all from the attached designs, in the middle of a fight:
(1) the swordsman knight with ash-blond hair, dark gunmetal armour with gold trim and charcoal cape, swinging his
glowing amber katana; (2) the witch mage girl with long silver-lavender hair, purple pointed hat and robe, raising
her gold staff with a glowing blue orb and casting a small blue magic bolt; (3) the gunslinger with silver-white
hair, goggles, red scarf and long black coat, firing his brass steampunk pistol.
Monsters: a round bouncy green slime, a small orange forest fox, and a brown wild boar with tusks, charging at them.
Every character and monster stands on the ground with a soft round shadow under the feet. The characters are small
on screen, as in a real game (about one eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 3. พิกเซล HD → `raw/style_3_hd_pixel.png`

```
The three attached sprites show the three player characters of my game. Use them for the character designs (hair,
outfits, colors, weapons), but redraw everything at a much higher pixel resolution than the attachments.
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, seen from a fixed isometric camera
looking down at about 45 degrees, landscape 16:9. Art style: modern high-definition pixel art like today's premium
indie games, small crisp pixels, characters as if about 200 pixels tall, rich color palette with smooth hand-placed
pixel shading, subtle dithering, soft colored lighting and glow effects layered over the pixels, detailed
environment. Clean pixels, no blur. Characters with slightly chibi proportions about 4 heads tall and big expressive
eyes.
Scene: a sunny clearing in an emerald forest. A winding dirt path, lush grass with small flowers, a few big leafy
trees and bushes around the edges, mossy rocks, a little stream with a wooden plank bridge.
Characters, all from the attached designs, in the middle of a fight:
(1) the swordsman knight with ash-blond hair, dark gunmetal armour with gold trim and charcoal cape, swinging his
glowing amber katana; (2) the witch mage girl with long silver-lavender hair, purple pointed hat and robe, raising
her gold staff with a glowing blue orb and casting a small blue magic bolt; (3) the gunslinger with silver-white
hair, goggles, red scarf and long black coat, firing his brass steampunk pistol.
Monsters: a round bouncy green slime, a small orange forest fox, and a brown wild boar with tusks, charging at them.
Every character and monster stands on the ground with a soft round shadow under the feet. The characters are small
on screen, as in a real game (about one eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 4. การ์ตูนตัวเล็ก (chibi) → `raw/style_4_chibi.png`

```
The three attached sprites show the three player characters of my game. Use them ONLY for the character designs
(hair, outfits, colors, weapons). Do NOT copy their pixel-art style.
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, seen from a fixed isometric camera
looking down at about 45 degrees, landscape 16:9. Art style: cute 2D cartoon vector-like game art, super-deformed
chibi characters only about 2.5 heads tall with huge heads and big shiny eyes, thick clean dark outlines, flat bright
colors with simple two-tone cel shading, rounded chunky shapes everywhere, playful and toy-like, like a casual
mobile RPG.
Scene: a sunny clearing in an emerald forest. A winding dirt path, lush grass with small flowers, a few big leafy
trees and bushes around the edges, mossy rocks, a little stream with a wooden plank bridge.
Characters, all from the attached designs, in the middle of a fight:
(1) the swordsman knight with ash-blond hair, dark gunmetal armour with gold trim and charcoal cape, swinging his
glowing amber katana; (2) the witch mage girl with long silver-lavender hair, purple pointed hat and robe, raising
her gold staff with a glowing blue orb and casting a small blue magic bolt; (3) the gunslinger with silver-white
hair, goggles, red scarf and long black coat, firing his brass steampunk pistol.
Monsters: a round bouncy green slime, a small orange forest fox, and a brown wild boar with tusks, charging at them.
Every character and monster stands on the ground with a soft round shadow under the feet. The characters are small
on screen, as in a real game (about one eighth of the image height). No UI, no health bars, no text, no watermark.
```

---

# รอบ 2: สไตล์แปลกใหม่ (เจ้าของสั่ง 2026-11-16: "ลองปรับให้แปลกใหม่ไปเลย ไม่ต้องคงสไตล์เดิม")

รอบนี้**ไม่ต้องแนบภาพตัวละครเดิม** ให้ AI ออกแบบตัวละครใหม่ตามสไตล์ได้เต็มที่ ตัวละครบรรยายด้วยข้อความอย่างเดียว
(ถ้าอยากให้หน้าตาตัวละครเหมือนเดิม ให้แนบ `idle.png` ทั้ง 3 ไฟล์ไปเหมือนรอบแรก)
เจนสไตล์ละ 1 แชทใหม่เหมือนเดิม และเซฟไว้ที่ `art_templates/style_test/raw/`

ฉากและตัวละครที่ใช้ร่วมกันทุกข้อ (มีอยู่ในทุก prompt แล้ว copy ทั้งก้อนไปวางได้เลย):
ป่ามรกต มีอัศวินถือดาบ แม่มดถือคทา และมือปืน สู้กับสไลม์ จิ้งจอก และหมูป่า

## 5. กระดาษตัดแปะ (papercraft diorama) → `raw/style_5_papercraft.png`

ตัวละครเป็นชิ้นกระดาษอยู่แล้ว เลยเข้ากับระบบกระดูกที่สุด

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: everything is a handmade papercraft diorama: layered cut colored paper
and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers,
characters built from flat paper pieces joined at the joints like paper puppets, warm studio lighting, charming and
tactile.
Scene: a sunny clearing in an emerald forest with a winding dirt path, grass with small flowers, big leafy trees and
bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 6. ดินปั้น (claymation) → `raw/style_6_clay.png`

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: stop-motion claymation look: everything sculpted from soft modelling
clay and plasticine, visible thumbprints and tool marks, rounded chunky shapes, slightly glossy surfaces, miniature
set with soft tilt-shift depth of field, warm cozy lighting, cute and handmade.
Scene: a sunny clearing in an emerald forest with a winding dirt path, grass with small flowers, big leafy trees and
bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 7. หมึกจีน/ญี่ปุ่น แต้มสี (ink wash) → `raw/style_7_inkwash.png`

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: East Asian sumi-e ink wash painting on rice paper: expressive black
brush strokes of varying thickness, soft grey ink washes, lots of airy empty paper space, only a few bold accent
colors (jade green, vermilion red, gold and glowing blue for magic), splashes and dry-brush texture on action
effects, elegant and dramatic.
Scene: a sunny clearing in an emerald forest with a winding dirt path, grass with small flowers, big leafy trees and
bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 8. นีออนต่างมิติ (neon multiverse) → `raw/style_8_neon.png`

เข้ากับชื่อเกม MULTIVERSE

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: dreamy neon dimension: a dark twilight world where every shape has
glowing neon edges in cyan, magenta and gold, smooth gradient shading, bioluminescent plants, floating sparkles and
light particles, holographic shimmer on armour and weapons, strong bloom and colored rim light, sleek and modern,
like a fantasy forest seen through a sci-fi portal.
Scene: an emerald forest clearing at dusk with a winding glowing path, grass with small glowing flowers, big leafy
trees and bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 9. กระจกสี (stained glass) → `raw/style_9_stainedglass.png`

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: cathedral stained glass come to life: every shape made of jewel-toned
glass pieces separated by thick dark lead lines, light shining through the colors, subtle glass texture and
glints, ornate art nouveau curves in the trees and water, rich and magical.
Scene: a sunny clearing in an emerald forest with a winding dirt path, grass with small flowers, big leafy trees and
bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 10. การ์ตูนยุโรปเส้นคม (ligne claire) → `raw/style_10_comic.png`

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: classic European adventure comic: clean even-weight black ink
outlines, flat areas of soft color with no gradients, fine pen hatching for shadows, airy pastel skies and
detailed environments, characters with realistic-but-stylised proportions about 6 heads tall, calm and elegant.
Scene: a sunny clearing in an emerald forest with a winding dirt path, grass with small flowers, big leafy trees and
bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 11. ดาร์กแฟนตาซีสีน้ำมัน (gothic painterly) → `raw/style_11_dark.png`

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: dark gothic fantasy oil painting: moody low-key lighting, deep shadows
with warm torch-like highlights, visible thick brush strokes, desaturated earthy greens and browns with vivid magic
glows, realistic proportions about 7 heads tall, gritty worn armour, heavy atmosphere with drifting mist and dust.
Scene: a clearing in an old emerald forest under a cloudy sky, a winding dirt path, grass with a few small flowers,
huge gnarled trees and bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 12. ของเล่นไวนิล (toy diorama) → `raw/style_12_toy.png`

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: a miniature toy world: characters are glossy collectible vinyl figures
about 3 heads tall with smooth plastic shine and simple painted faces, the forest is a tabletop diorama of plastic
and flocked foam trees, strong tilt-shift blur at top and bottom, bright playful colors, soft studio lighting.
Scene: a sunny clearing in an emerald forest with a winding dirt path, grass with small flowers, big leafy trees and
bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```

## 13. ป๊อปอาร์ตจุดฮาล์ฟโทน (pop comic) → `raw/style_13_popart.png`

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: bold pop-art comic book: very thick black outlines, flat punchy primary
colors, halftone dot shading, dynamic speed lines and starburst shapes on the attacks, high contrast, energetic and
loud, like a printed retro comic page.
Scene: a sunny clearing in an emerald forest with a winding dirt path, grass with small flowers, big leafy trees and
bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark. No speech bubbles or sound-effect words.
```

## 14. ผ้าถักและสักหลาด (felt and knit) → `raw/style_14_felt.png`

```
Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed isometric camera looking down at
about 45 degrees, landscape 16:9. Art style: everything handmade from felt, knitted wool and embroidery: fuzzy felt
characters with stitched seams and button details, knitted grass and trees, yarn water, embroidered flowers, soft
cozy lighting that shows the fibre texture, warm and adorable.
Scene: a sunny clearing in an emerald forest with a winding dirt path, grass with small flowers, big leafy trees and
bushes at the edges, mossy rocks, and a little stream with a wooden plank bridge.
Heroes in the middle of a fight: a young knight with spiky ash-blond hair in dark armour with gold trim and a long
cape, swinging a glowing amber sword; a witch girl with long silver-lavender hair in a purple pointed hat and robe,
casting a blue magic bolt from a gold staff with a blue orb; a gunslinger with white hair, goggles, red scarf and a
long black coat, firing a brass steampunk pistol.
Monsters charging at them: a round bouncy green slime, a small orange fox, and a brown wild boar with tusks.
Each figure stands on the ground with a small shadow. Characters are small on screen, as in a real game (about one
eighth of the image height). No UI, no health bars, no text, no watermark.
```
