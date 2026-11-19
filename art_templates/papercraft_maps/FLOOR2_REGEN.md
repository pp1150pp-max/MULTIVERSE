# เจนใหม่ 4 ภาพของชั้น 2 (ช่องในภาพดิบไม่ตรง)

ตอนตัดภาพชั้น 2 (2026-11-19) มี 4 แผ่นที่ตัดไม่ได้ เพราะช่องในภาพไม่ตรงกับ prompt

| ไฟล์ | ปัญหา |
|---|---|
| `shock_eel_walk.png` | มีแค่ 4 แถว ขาดแถวหันหลัง |
| `spike_turtle_walk.png` | ได้ตาราง 5×5 แต่ต้องเป็น 5 แถว × 4 ช่อง |
| `giant_crab_claw.png` | ได้ 4 แถว × 5 ช่อง แต่ต้องเป็น 5 แถว × 4 ช่อง |
| `whirlpool_ring_3.png` | วงล้นกรอบจนขอบเป็นเส้นตรง |

prompt ทั้งหมดมาจาก `FLOOR2_M1_BEACH.md` ข้อ 7–8 และ `FLOOR2_M4_WHIRLPOOL.md`
- เซฟไฟล์ใหม่ทับไฟล์เดิมในโฟลเดอร์ `raw/` (ไม่ commit · ห้าม `git add raw/`)
- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`

---

## แชท 1: มอนแมพ 1 (3 ภาพ) → `raw/floor2_m1/monsters/`

เปิดแชทใหม่ แนบ `art_templates/papercraft_maps/raw/floor2_maps/M1_shipwreck_beach.webp` ภาพเดียว
ภาพแรกให้ขึ้นต้นด้วยประโยคเปิดนี้:

```
The attached image is the approved concept of a map in my game, the Shipwreck Beach. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, warm soft light from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

### 1. `shock_eel_walk.png`

```
Now a monster of this Shipwreck Beach, in EXACTLY the papercraft style of the attached map and its creatures: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the monster.
The move: a smooth 4-frame walking loop in the direction it faces: frame 1 one side stepping forward, frame 2 passing, frame 3 the other side stepping forward, frame 4 passing, so frame 4 leads into frame 1. (A creature with no legs bounces, slithers or hovers in place with a gentle bob instead.)
The monster: the shock eel: a long dark navy-blue eel with bright yellow glowing spots along its body, small fins and a wide grumpy mouth, its head and front half raised up off the ground with the tail coiled under it
```

### 2. `spike_turtle_walk.png`

```
Now a monster of this Shipwreck Beach, in EXACTLY the papercraft style of the attached map and its creatures: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the monster.
The move: a smooth 4-frame walking loop in the direction it faces: frame 1 one side stepping forward, frame 2 passing, frame 3 the other side stepping forward, frame 4 passing, so frame 4 leads into frame 1. (A creature with no legs bounces, slithers or hovers in place with a gentle bob instead.)
The monster: the spike turtle: a big stocky green sea turtle with a grumpy face and a dark brown shell covered in large silver-white spikes, as in the attached map
```

### 3. `giant_crab_claw.png`

```
Now a monster of this Shipwreck Beach, in EXACTLY the papercraft style of the attached map and its creatures: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the monster.
The move: a 4-frame grab and fling toward the direction it faces: frame 1 raising the enormous claw wide open; frame 2 snapping it forward and shut; frame 3 lifting the closed claw high; frame 4 swinging it hard to the side as if throwing something away.
The monster: the Giant Cannon Crab, a large imposing boss about three times the height of a hero: a huge red-orange crab with thick armoured legs, one enormous claw and one smaller claw, stalk eyes with fierce brows, its wide barnacle-covered shell carrying an old bronze ship's cannon mounted on top like a turret, a little seaweed and a starfish stuck to the shell.
```

ถ้าตารางยังผิดอีก (ช่องเกินต่อแถว หรือแถวไม่ครบ) ให้พิมพ์ต่อในแชทว่า:

```
Wrong grid. Redo it as EXACTLY 5 rows and EXACTLY 4 columns: 20 figures, no more, no fewer. Row 5 must be the back view.
```

---

## แชท 2: น้ำวนชั้นใน (1 ภาพ) → `raw/floor2_m4/`

เปิดแชทใหม่ แนบ `art_templates/papercraft_maps/raw/floor2_maps/M4_kraken_maelstrom.webp` ภาพเดียว
ขึ้นต้นด้วยประโยคเปิดนี้:

```
The attached image is the approved concept of a map in my game, the Kraken Maelstrom. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, cool stormy light from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

### 4. `whirlpool_ring_3.png`

```
Same papercraft style, NOT pixel art. Generate a SQUARE image (1:1): ONE single flat layer of a giant whirlpool, seen STRAIGHT FROM ABOVE, made of layered cut paper with visible fibre and small drop shadows between the paper layers, like the whirlpool in the attached map. The layer is a perfect circle that fills the image edge to edge. Its outer edge is a slightly uneven torn paper edge with a thin soft drop shadow, so it looks like a separate sheet of paper lying on top of another. The spiral bands swirl clockwise and are spread evenly all the way around, so the layer looks right when it is rotated. No tentacles, no objects, no text. The four corners outside the circle are ONE perfectly flat solid magenta (#FF00FF), no shadows on the background. Do not use pink, magenta or purple in the water.
This is the INNER ring: a ring of dark teal and deep blue water with tight, strongly curved spiral bands, only a few small foam flecks. The middle of the ring is an EMPTY hole about 55% of the image width, filled with flat solid magenta (#FF00FF), its torn inner edge deep navy.
```

ถ้าวงยังล้นกรอบจนขอบเป็นเส้นตรงอีก ให้พิมพ์ต่อว่า:

```
The circle is cut off by the image edges. Redo it so the WHOLE circle fits inside the square with a little magenta showing on all four sides and in all four corners.
```

---

## รอบ 2: ปูยักษ์อีก 2 ท่า → `raw/floor2_m1/monsters/`

ภาพ 4 ภาพของรอบแรกตัดได้แล้ว ยกเว้นปูยักษ์ เพราะพอได้ท่า claw ใหม่ ก็เจอว่าอีก 2 ท่าช่องผิดด้วย (2026-11-20)

| ไฟล์ | ปัญหา |
|---|---|
| `giant_crab_cannon.png` | ได้ตาราง 5×5 |
| `giant_crab_shell.png` | ได้ 4 แถว × 5 ช่อง และสลับแกน (แถวเป็นเฟรม ช่องเป็นมุม) |

ใช้แชท 1 เดิมต่อได้เลย หรือเปิดแชทใหม่แล้วแนบ M1 กับประโยคเปิดเหมือนแชท 1

### 5. `giant_crab_cannon.png`

```
Now a monster of this Shipwreck Beach, in EXACTLY the papercraft style of the attached map and its creatures: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the monster.
The move: a 4-frame cannon shot: frame 1 crouching and tilting the shell so the cannon points up into the air; frame 2 bracing; frame 3 the whole body jolting back from the recoil; frame 4 settling back to its normal pose. No smoke, no flash, no cannonball.
The monster: the Giant Cannon Crab, a large imposing boss about three times the height of a hero: a huge red-orange crab with thick armoured legs, one enormous claw and one smaller claw, stalk eyes with fierce brows, its wide barnacle-covered shell carrying an old bronze ship's cannon mounted on top like a turret, a little seaweed and a starfish stuck to the shell.
```

### 6. `giant_crab_shell.png`

```
Now a monster of this Shipwreck Beach, in EXACTLY the papercraft style of the attached map and its creatures: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the monster.
The move: a 4-frame hide in the shell: frame 1 normal pose; frame 2 pulling the legs and claws in; frame 3 fully hidden inside the shell, only the shell and cannon showing; frame 4 eyes peeking out from under the shell.
The monster: the Giant Cannon Crab, a large imposing boss about three times the height of a hero: a huge red-orange crab with thick armoured legs, one enormous claw and one smaller claw, stalk eyes with fierce brows, its wide barnacle-covered shell carrying an old bronze ship's cannon mounted on top like a turret, a little seaweed and a starfish stuck to the shell.
```

ถ้าตารางยังผิด ให้พิมพ์ต่อว่า:

```
Wrong grid. Redo it as EXACTLY 5 rows and EXACTLY 4 columns: 20 figures, no more, no fewer. Each ROW is one facing direction (row 1 front ... row 5 back view) and each COLUMN is one frame of the move.
```

---

## สำหรับคนใส่เข้าเกม

ได้ภาพใหม่ครบแล้ว ให้ตัดด้วยคำสั่งเหล่านี้ (ใน worktree ที่มี `raw/` ชุดชั้น 2):

```
node tools/cut_floor2_chars.cjs monsters --only shock_eel,spike_turtle,giant_crab
node tools/cut_papercraft.cjs floor2_m4
```
