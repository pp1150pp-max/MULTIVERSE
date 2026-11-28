# ห้องบอสคราเคนแบบใหม่: prompt ภาพ (เจ้าของเจนเองใน GPT)

> **ตัดเข้าเกมแล้ว (2026-11-28):** `paper/monsters/kraken.png` (คราเคนโผล่จากมุม) และ `paper/monsters/kraken_arm.png` (หนวดยักษ์ในห้อง) ด้วย `node tools/cut_floor2_chars.cjs monsters --only kraken,kraken_arm` · ท่าของคราเคนและหนวดรัดเล่นตาม `src/client/paperMoves.ts`

ภาพคราเคนโผล่จากมุมห้อง 5 ภาพ และหนวดยักษ์รอบขอบพื้น 3 ภาพ · ทุก prompt เขียนครบในตัวเอง ก๊อปไปวางทีละอันได้เลย

## วิธีใช้

1. เปิดแชทใหม่ใน GPT แนบภาพ `art_templates/papercraft_maps/raw/floor2_maps/M4_kraken_maelstrom.webp` ภาพเดียว (ห้ามแนบภาพพิกเซล)
2. ส่งข้อ 0 ก่อน แล้วส่งข้อ 1–8 ทีละภาพ
3. ถ้าได้ภาพพิกเซล ให้พิมพ์:
   ```
   Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.
   ```
4. เซฟไฟล์ลง `art_templates/papercraft_maps/raw/floor2_m4/monsters/` ตามชื่อไฟล์ที่หัวข้อแต่ละข้อ (โฟลเดอร์ `raw/` ไม่ commit)

---

## 0. ข้อความเปิดแชท

```
The attached image is the approved concept of a map in my game, the Kraken Maelstrom. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, cool stormy light from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look. I will now ask for monster sprite sheets one at a time.
```

---

## คราเคนโผล่จากมุมห้อง

### 1. `kraken_idle.png`

```
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Rows are facing directions, top to bottom: front facing the viewer; three-quarter front turned LEFT; side profile facing LEFT; three-quarter back turned LEFT; back view. Columns are 4 frames of one move, left to right. Same size and same baseline in every cell, every figure fully inside its own cell with empty space around it, nothing overlapping.
The monster: the Kraken, a colossal papercraft boss rising out of deep water: its huge round head, its great eyes and the top of its body, with two thick tentacles curling up beside it out of the same water, about four times the width of a hero, deep purple with lighter violet streaks and cream spots, two enormous glowing turquoise eyes with fierce brows, a curved beak below, a few barnacles and old scars. It leans forward as if peering over the edge of a floor in front of it. The base is cut cleanly and straight along the waterline at the bottom of the cell.
The move: a 4-frame idle loop, the head slowly rising and sinking a little, the eyes blinking once, the two side tentacles swaying, so frame 4 leads into frame 1.
No water, no splash, no effects, no shadows, no ground, no text, no labels, no grid lines. Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the monster.
```

### 2. `kraken_ink.png`

```
Same Kraken, same sprite sheet layout (5 rows of facing directions x 4 frames), same size, same style, same flat pure bright green (#00FF00) background, no water, no effects.
The move: a 4-frame ink spit toward the direction it faces: frame 1 drawing the head back and puffing up; frame 2 leaning forward; frame 3 the beak wide open at full reach as if spitting; frame 4 settling back to its normal pose. No ink drawn.
```

### 3. `kraken_dive.png`

```
Same Kraken, same sprite sheet layout (5 rows of facing directions x 4 frames), same size, same style, same flat pure bright green (#00FF00) background, no water, no effects.
The move: a 4-frame sink and rise: frame 1 normal pose; frame 2 sunk down to the eyes, the cut line at the bottom staying in place; frame 3 almost gone, only the top of the head showing; frame 4 rising back up with the eyes wide open.
```

### 4. `kraken_arm_slam.png` (ท่ากวาดพัดและคลื่นยักษ์)

```
Same Kraken, same sprite sheet layout (5 rows of facing directions x 4 frames), same size, same style, same flat pure bright green (#00FF00) background, no water, no effects.
The move: a 4-frame tentacle sweep toward the direction it faces: frame 1 one side tentacle rearing up high and curling back; frame 2 whipping forward and sideways in a wide arc; frame 3 the tentacle stretched long and flat across the ground in front of it; frame 4 pulling back to the normal pose.
```

### 5. `kraken_arm_cut.png` (หัวโผล่หลังตัดหนวดครบ)

```
Same Kraken, same sprite sheet layout (5 rows of facing directions x 4 frames), same size, same style, same flat pure bright green (#00FF00) background, no water, no effects.
The move: a 4-frame surfacing in pain: frame 1 the head low, only the eyes above the cut line; frame 2 rearing up tall with the beak open in a roar; frame 3 at full height, eyes blazing; frame 4 settling forward, tired and open to attack.
```

---

## หนวดยักษ์รอบขอบพื้น

### 6. `kraken_arm_idle.png`

```
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Rows are facing directions, top to bottom: front facing the viewer; three-quarter front turned LEFT; side profile facing LEFT; three-quarter back turned LEFT; back view. Columns are 4 frames of one move, left to right. Same size and same baseline in every cell, every figure fully inside its own cell with empty space around it, nothing overlapping.
The monster: one of the Kraken's giant arms, an enormous papercraft tentacle rising straight up out of the water, about three times the height of a hero and thick as a ship's mast, deep purple with lighter violet streaks, a row of big round cream suckers along its inner side, scarred, with barnacles and a few strands of dark green seaweed, the tip curling. The base is cut cleanly and straight along the waterline at the bottom of the cell.
The move: a 4-frame idle loop, the tentacle swaying slowly from side to side and curling its tip, the base never moving, so frame 4 leads into frame 1.
No water, no splash, no effects, no shadows, no ground, no text, no labels, no grid lines. Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the monster.
```

### 7. `kraken_arm_slam_tentacle.png`

```
Same giant tentacle, same sprite sheet layout (5 rows of facing directions x 4 frames), same size, same style, same flat pure bright green (#00FF00) background, no water, no effects.
The move: a 4-frame slam toward the direction it faces: frame 1 rearing up very tall and curling back; frame 2 whipping forward; frame 3 lying stretched out very long and flat along the ground in front of it, the full length of the slam; frame 4 rising back up to its normal pose. The base stays on the same spot in every frame.
```

### 8. `kraken_arm_grab.png`

```
Same giant tentacle, same sprite sheet layout (5 rows of facing directions x 4 frames), same size, same style, same flat pure bright green (#00FF00) background, no water, no effects.
The move: a 4-frame grab toward the direction it faces: frame 1 reaching forward low along the ground; frame 2 the tip coiling into a tight loop as if wrapped around someone; frame 3 pulling back toward its base, the coil held tight; frame 4 holding the tight coil, straining. Nobody inside the coil.
```

---

## หลังได้ภาพ

- ส่งไฟล์ให้ session ตัดภาพ · ตอนนี้หนวดในห้อง (`kraken_arm`) ใช้ชีตหนวดในแมพผ่าน `PAPER_MONSTER_FILE` ใน `src/client/assets.ts` ต้องเปลี่ยนให้ใช้ชีตใหม่ (ข้อ 6–8)
- ได้ภาพจริงแล้ว ปรับ "หนวด: ขนาดภาพ" และ "คราเคน: ขนาดภาพ" ในการ์ด /admin "คราเคน (บอส)" ให้พอดีอีกครั้ง
