# Zone 2 (Misty Marsh): prompt ที่ใช้สร้างภาพใน ChatGPT

ภาพของโซนนี้สร้างด้วย ChatGPT (สร้างภาพ) ในแชทเดียวกันทั้ง 3 ภาพ เพื่อให้สไตล์ตรงกัน
แต่ละภาพขอพื้นหลังเป็นสีชมพูม่วงล้วน (#FF00FF) แล้วนำมาตัดพื้นหลังออก ตัดแยกเป็นชิ้น และย่อขนาด
จากนั้นวางไว้ใน `public/assets/sprites/`

- ฉากประกอบ: 1 ภาพมี 12 ชิ้น เรียงเป็นตาราง 4×3 ตัดออกมาเป็นภาพละชิ้น ชิ้นละสูงประมาณ 200px
- มอนสเตอร์: 1 แถวคือ 1 ตัว แต่ละแถวมี 3 มุม (หน้า / ข้าง (หันซ้าย) / หลัง)
  นำแต่ละมุมไปทำเป็นชีต 3×3 ตามรูปแบบใน `public/assets/README.md`
  เฟรมเดินคือภาพเดิมที่บีบและยืดเล็กน้อย

ถ้าอยากได้ภาพใหม่ ให้ใช้ prompt ด้านล่างนี้ แล้วตัดภาพให้ได้ขนาดและรูปแบบเดิม

## 1. ฉากประกอบ (props)

```
Generate an image: a pixel-art prop sheet for a fantasy action RPG swamp zone called "Misty Marsh"
(viewed from a 3/4 top-down camera, objects drawn standing upright, front view). Style: chunky 16-bit
pixel art like a cozy farming RPG, crisp dark brown (#2a1c12) 1-2px outlines, muted swamp palette
(olive and moss green, murky teal, grey-brown wood, hints of misty purple), soft light from top-left.
Arrange exactly 12 separate objects in a 4 columns x 3 rows grid with generous empty space between
them; each object fully inside its own cell, nothing touching or overlapping. Background must be ONE
perfectly flat solid magenta color (#FF00FF) everywhere, no gradient, no ground, no cast shadows,
no text, no labels, no grid lines.
Row 1: three different tall dead twisted swamp trees with bare gnarled branches and hanging
grey-green moss, plus one weeping willow tree with drooping dark green leaves.
Row 2: two different clumps of tall reeds/cattails, one dark swamp fern bush, one cluster of softly
glowing purple-blue mushrooms.
Row 3: two different mossy grey boulders, one rotten hollow tree stump with moss, and one ancient
stone archway portal with a swirling glowing teal-green magic center.
```

→ `swamp_tree_0` `swamp_tree_1` `swamp_tree_2` `willow` / `reeds_0` `reeds_1` `fern` `mushrooms` /
`mossrock_0` `mossrock_1` `swamp_stump` `portal`

## 2. มอนสเตอร์ ชุด A

```
Great, same exact art style and palette. Now generate a monster character sheet for the same swamp
zone: 3 rows x 3 columns, one monster per row, and in each row the SAME monster shown in 3 views from
left to right: (1) front view facing the viewer, (2) side view facing LEFT, (3) back view. Keep the
monster identical in size, colors and design across its 3 views, standing on the same baseline,
feet/bottom touching the bottom of each cell. Generous empty space between all figures, nothing
overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text,
no labels, no grid lines.
Row 1: Bog Toad - fat warty olive-brown swamp toad with yellow eyes and a pale belly.
Row 2: Marsh Leech - big slimy dark purple-black leech worm rearing up, round toothy mouth, glossy highlights.
Row 3: Swamp Serpent - green-teal water snake coiled with its head raised, yellow belly scales, small fins on head.
```

→ `bog_toad` `marsh_leech` `swamp_serpent` (ช่องสูงประมาณ 110px)

## 3. มอนสเตอร์ ชุด B

```
Perfect. One more sheet in the exact same style, same layout rules (3 rows x 3 columns, each row = one
monster in front view / side view facing LEFT / back view, identical design across views, bottom on
the cell baseline, flat solid magenta #FF00FF background, no shadows, no text, no grid).
Row 1: Mire Ghoul - hunched humanoid made of dripping black mud and tangled roots, long arms with
claws, glowing pale green eyes.
Row 2: Will-o'-Wisp - floating ghostly blue-green flame spirit with a small cute-creepy face and
wispy tail, hovering slightly above the baseline.
Row 3: Bog Witch (boss, make her large and imposing) - tall hunched swamp hag in a tattered
moss-green cloak with a hood, long grey hair, holding a crooked wooden staff topped with a glowing
teal skull lantern, mushrooms growing on her shoulders.
```

→ `mire_ghoul` `will_o_wisp` (ช่องสูงประมาณ 130px) · `bog_witch` (ช่องสูงประมาณ 220px)
