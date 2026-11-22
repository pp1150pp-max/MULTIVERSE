# ท่าตายกระดาษ: prompt เจนใหม่จากท่าตายเดิม (ก๊อปวางได้เลย)

เจ้าของสั่งเมื่อ 2026-11-22: เจนท่าตายตามเรฟหยำฉ่าแล้วยังไม่เหมือน ให้ใช้**เฟรมสุดท้ายของท่าตายภาพเก่า (pixel art)** เป็นตัวอย่าง แล้ววาดใหม่เป็นสไตล์กระดาษ ครบ 3 อาชีพ
ตัวอย่างนี้ใช้กับ**เฟรม 8** ซึ่งเกมค้างไว้จนกดฟื้นคืนชีพ ส่วนเฟรม 1–7 เป็นท่าล้มลงไปจนถึงท่านั้น

## วิธีเจน

- เปิด**แชทใหม่ทีละอาชีพ** แล้วแนบ 3 ภาพทุกครั้ง **ตามลำดับนี้**:
  1. แบบตัวละครกระดาษ `art_templates/papercraft_chars/raw/<อาชีพ>/design.png`
  2. ตัวอย่างสไตล์กระดาษ (ท่ายืนหันข้างจากในเกม) `art_templates/papercraft_chars/raw/ref/paper_style_<อาชีพ>.png`
  3. ท่าตายเฟรมสุดท้ายของภาพเก่า `art_templates/papercraft_chars/raw/ref/death_old_<อาชีพ>.png` (ใช้แค่ท่า)
- รอบก่อน GPT ลอกสไตล์ pixel จากภาพเก่าไปด้วย (เจ้าของ 2026-11-22) รอบนี้เลยเพิ่มภาพที่ 2 เป็นตัวอย่างสไตล์ และสั่งชัด ๆ ว่าภาพที่ 3 ใช้แค่ท่า

  | อาชีพ | ภาพที่ 1 | ภาพที่ 2 | ภาพที่ 3 |
  |---|---|---|---|
  | นักดาบ | `raw/sword/design.png` | `raw/ref/paper_style_sword.png` | `raw/ref/death_old_sword.png` |
  | จอมเวท | `raw/mage/design.png` | `raw/ref/paper_style_mage.png` | `raw/ref/death_old_mage.png` |
  | นักปืน | `raw/gunslinger/design.png` | `raw/ref/paper_style_gunslinger.png` | `raw/ref/death_old_gunslinger.png` |

- ก๊อปกล่อง prompt ของอาชีพนั้นไปวางทั้งกล่อง
- เซฟทับไฟล์เดิม `art_templates/papercraft_chars/raw/<อาชีพ>/death.png`
- ไม่ต้องวาดหลุม เกมวาดหลุมใต้ศพให้เอง (`death_crater`)
- ถ้าเฟรม 8 ยังไม่เหมือน พิมพ์ต่อในแชทเดิมว่า `Redo only frame 8: the pose of the third attached picture, but drawn exactly like the first two pictures (soft papercraft, smooth paper layers and folds, NOT pixel art). Keep frames 1 to 7 as they are.`
- ถ้าทั้งภาพยังออกมาเป็น pixel พิมพ์ต่อว่า `This looks like pixel art. Redraw all 8 frames in the papercraft style of the first two pictures: smooth layered paper cut-outs with soft folds and shading, clean smooth edges, no pixels at all.`
- เจนครบแล้วบอกผม ผมจะตัดเข้าเกมให้

ภาพที่ 3 เป็น pixel art ของตัวละครเดิมในท่านอนหมอบขดตัว หันหลังให้คนดู หน้าซุกแขน เห็นพื้นรองเท้า และอาวุธตกอยู่ด้านหน้า (มุมซ้ายล่าง)

---

## 1. นักดาบ → `raw/sword/death.png`

```
Three attached pictures. 1: the papercraft design sheet of this knight. 2: this knight in the game, showing the EXACT papercraft look to draw in. 3: an OLD pixel-art picture of the knight's final knocked-out pose: use it ONLY for the body pose, NEVER for the style.
STYLE, the most important rule: draw everything exactly like pictures 1 and 2: soft 3D papercraft, smooth layered paper cut-outs with gentle folds and soft shading, clean smooth edges. NOT pixel art: no pixels, no blocky edges, no dark pixel outlines, no dithering. Do not copy any colour, outline or shading from picture 3.
Keep this EXACT knight from pictures 1 and 2: same outfit, colours, proportions, size and papercraft style. Generate an image: ONE single horizontal row of exactly 8 frames of an animation, in 8 equal-width cells, the SAME knight in every frame, all frames facing the SAME direction (side view facing LEFT). Head and body keep the same size in every frame. Every figure fully inside its own cell with clear empty space around it, the sword must never reach into the next cell, nothing touching or overlapping. The blade keeps its own gentle amber glow, but there are NO slash trails, no arcs, no motion lines, no sparks, no dust, no effects. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no crater, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
Frame 8, the final pose, MUST be the SAME pose as picture 3, redrawn in the papercraft style of pictures 1 and 2 (NOT pixel art): the same body position and angle, the head, arms and legs in the same places, the same parts showing (his back, the cape spread over it, the back of his head, his fists, the soles of both boots toward the viewer), and the sword lying on the ground in the same spot at the lower left. Only the style changes, not the pose.
Frames 1 to 7 lead into it: frame 1 struck hard, recoiling; frame 2 knees buckling; frame 3 flung off his feet, the sword slipping out of his hand; frame 4 in the air; frame 5 slamming into the ground; frame 6 a small bounce; frame 7 settling, almost in the final pose. The body keeps the same size as standing, and rests on the same baseline in every frame except the airborne ones.
```

## 2. จอมเวท → `raw/mage/death.png`

```
Three attached pictures. 1: the papercraft design sheet of this witch. 2: this witch in the game, showing the EXACT papercraft look to draw in. 3: an OLD pixel-art picture of the witch's final knocked-out pose: use it ONLY for the body pose, NEVER for the style.
STYLE, the most important rule: draw everything exactly like pictures 1 and 2: soft 3D papercraft, smooth layered paper cut-outs with gentle folds and soft shading, clean smooth edges. NOT pixel art: no pixels, no blocky edges, no dark pixel outlines, no dithering. Do not copy any colour, outline or shading from picture 3.
Keep this EXACT witch from pictures 1 and 2: same outfit, colours, proportions, size and papercraft style. Generate an image: ONE single horizontal row of exactly 8 frames of an animation, in 8 equal-width cells, the SAME witch in every frame, all frames facing the SAME direction (side view facing LEFT). Head, hat and body keep the same size in every frame. Every figure fully inside its own cell with clear empty space around it, the staff must never reach into the next cell, nothing touching or overlapping. The orb keeps its own gentle blue glow, but there are NO spell effects, no magic bolts, no sparkles, no motion lines, no dust. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no crater, no text, no labels, no numbers, no grid lines. Do not use bright green anywhere on the character.
Frame 8, the final pose, MUST be the SAME pose as picture 3, redrawn in the papercraft style of pictures 1 and 2 (NOT pixel art): the same body position and angle, the head, arms and legs in the same places, the same parts showing (curled up face-down, the face hidden in her arms, the big hat tipped over her head, the long hair spread over her back, the soles of both boots toward the viewer), and the staff lying on the ground in the same spot at the lower left, the orb dull. Only the style changes, not the pose.
Frames 1 to 7 lead into it: frame 1 struck hard, recoiling; frame 2 knees buckling; frame 3 flung off her feet, the staff slipping out of her hand; frame 4 in the air; frame 5 slamming into the ground; frame 6 a small bounce; frame 7 settling, almost in the final pose. The body keeps the same size as standing, and rests on the same baseline in every frame except the airborne ones.
```

## 3. นักปืน → `raw/gunslinger/death.png`

```
Three attached pictures. 1: the papercraft design sheet of this gunslinger. 2: this gunslinger in the game, showing the EXACT papercraft look to draw in. 3: an OLD pixel-art picture of the gunslinger's final knocked-out pose: use it ONLY for the body pose, NEVER for the style.
STYLE, the most important rule: draw everything exactly like pictures 1 and 2: soft 3D papercraft, smooth layered paper cut-outs with gentle folds and soft shading, clean smooth edges. NOT pixel art: no pixels, no blocky edges, no dark pixel outlines, no dithering. Do not copy any colour, outline or shading from picture 3.
Keep this EXACT gunslinger from pictures 1 and 2: same outfit, colours, proportions, size and papercraft style. He has exactly two arms and exactly ONE pistol. Generate an image: ONE single horizontal row of exactly 8 frames of an animation, in 8 equal-width cells, the SAME gunslinger in every frame, all frames facing the SAME direction (side view facing LEFT). Head and body keep the same size in every frame. Every figure fully inside its own cell with clear empty space around it, the long scarf and the pistol must never reach into the next cell, nothing touching or overlapping. No muzzle flash, no bullets, no smoke, no motion lines, no sparks, no dust, no effects. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no crater, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
Frame 8, the final pose, MUST be the SAME pose as picture 3, redrawn in the papercraft style of pictures 1 and 2 (NOT pixel art): the same body position and angle, the head, arms and legs in the same places, the same parts showing (curled up face-down, the face buried in his folded arms, the goggles knocked crooked, the red scarf blown over his back, the coat tails spread, the soles of both boots toward the viewer), and the pistol lying on the ground in the same spot at the lower left. The pistol is the SAME complete pistol as in picture 1: barrel, cylinder AND its full grip, never only a barrel. Only the style changes, not the pose.
Frames 1 to 7 lead into it: frame 1 struck hard, recoiling; frame 2 knees buckling; frame 3 flung off his feet, the pistol slipping out of his hand; frame 4 in the air; frame 5 slamming into the ground; frame 6 a small bounce; frame 7 settling, almost in the final pose. The body keeps the same size as standing, and rests on the same baseline in every frame except the airborne ones.
```

---

## สำหรับผม: ตัดเข้าเกม

ตัดแบบเดียวกับท่าตายเดิม (ดู "สำหรับผม" ใน `SWORD.md`): ตัดพื้นหลัง แยก 8 ช่อง ปรับให้ตัวสูงเท่าท่ายืน แถวเดียว ช่องละ 320×320
