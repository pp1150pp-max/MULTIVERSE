# นักโทษในเรือ (`prisoner`) แมพ 2 ชั้น 2: อ่าวลักลอบ

แยกออกมาจาก `FLOOR2_M2_COVE.md` ข้อ 7 ตามที่เจ้าของสั่ง (2026-11-19) ท่าของมอนตัวนี้อยู่ในแผน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 5.2 (ตัวแรกของแมพ ลากลูกตุ้มเดินช้า เลือดเหลือ 20% โยนลูกตุ้มแล้วหลุดโซ่วิ่งไล่)

## หน้าตาที่ล็อกไว้ (เจ้าของ 2026-11-19)

รอบแรกได้ 3 แผ่นที่หัวไม่ตรงกัน (ไม่มีหมวก / ผ้าโพกหัว / หมวกไหมพรม) เจ้าของเลือก**ผ้าโพกหัวลายทางแบบแผ่นโยน**
- **แบบหลัก:** `prisoner_throw.png` เก็บไว้ ไม่ต้องเจนใหม่
- **ต้องเจนใหม่:** `prisoner_walk.png` กับ `prisoner_run.png`

## วิธีเจน

- **เปิดแชทใหม่** แล้วแนบ 2 ภาพ: `art_templates/papercraft_maps/raw/floor2_maps/M2_smugglers_cove.webp` และ `raw/floor2_m2/monsters/prisoner_throw.png` (**ห้ามแนบภาพพิกเซล**)
- ภาพแรกของแชท ให้ขึ้นต้นด้วยประโยคนี้ก่อน prompt:

```
The first attached image is the approved concept of a map in my game, the Smugglers' Cove; the second is the approved sprite sheet of the ship's prisoner. Use EXACTLY this papercraft style for everything in this chat, and keep the prisoner EXACTLY as he looks in the second image. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- ถ้าหัวยังเพี้ยน (หมวก หรือไม่มีผ้าโพก) ให้พิมพ์ต่อว่า `Redo it: he must wear the same striped bandana as in the second attached image, no cap, no hat.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_m2/monsters/` ทับไฟล์เดิม (โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`)

prompt ด้านล่างประกอบเสร็จแล้ว (ข้อความกลาง + ท่า + หน้าตา) ก๊อปไปวางได้เลย

## 1. ท่าเดิน → `prisoner_walk.png` (เจนใหม่)

```
Now a monster of this Smugglers' Cove, in EXACTLY the papercraft style of the attached map and its characters: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME character in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles, no smoke. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
The move: a slow heavy 4-frame walking loop in the direction it faces, dragging a big black iron ball on a chain behind him from the ankle shackle, so frame 4 leads into frame 1. The iron ball and chain are part of the character in every frame.
The monster: the ship's prisoner, a scruffy stocky man with stubble and an angry face, ALWAYS wearing a dark-brown-and-cream striped cloth bandana tied at the back of his head with two short loose ends, messy brown hair showing under it at the sides, NO cap and NO hat, a torn dark-brown-and-cream striped prisoner shirt, ragged dark brown trousers with holes, barefoot, a heavy iron shackle on one ankle. Keep EXACTLY the same head, bandana and outfit as the attached prisoner sheet.
```

## 2. ท่าวิ่งไล่หลังหลุดโซ่ → `prisoner_run.png` (เจนใหม่)

```
Now a monster of this Smugglers' Cove, in EXACTLY the papercraft style of the attached map and its characters: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME character in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles, no smoke. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
The move: a fast 4-frame running loop in the direction it faces, leaning forward angrily with fists up, the iron ball gone, only a short broken chain end swinging from the ankle shackle, so frame 4 leads into frame 1.
The monster: the ship's prisoner, a scruffy stocky man with stubble and an angry face, ALWAYS wearing a dark-brown-and-cream striped cloth bandana tied at the back of his head with two short loose ends, messy brown hair showing under it at the sides, NO cap and NO hat, a torn dark-brown-and-cream striped prisoner shirt, ragged dark brown trousers with holes, barefoot, a heavy iron shackle on one ankle. Keep EXACTLY the same head, bandana and outfit as the attached prisoner sheet.
```

## 3. ท่าโยนลูกตุ้ม → `prisoner_throw.png` (มีแล้ว เก็บไว้เป็นแบบ)

ใช้เฉพาะถ้าต้องเจนใหม่ทั้งชุด

```
Now a monster of this Smugglers' Cove, in EXACTLY the papercraft style of the attached map and its characters: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME character in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles, no smoke. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
The move: a 4-frame throw toward the direction it faces: frame 1 lifting the iron ball off the ground with both hands, the chain hanging; frame 2 swinging it back over his shoulder; frame 3 hurling it forward, arms fully stretched; frame 4 recovering, hands empty, the broken chain end dangling from the ankle shackle.
The monster: the ship's prisoner, a scruffy stocky man with stubble and an angry face, ALWAYS wearing a dark-brown-and-cream striped cloth bandana tied at the back of his head with two short loose ends, messy brown hair showing under it at the sides, NO cap and NO hat, a torn dark-brown-and-cream striped prisoner shirt, ragged dark brown trousers with holes, barefoot, a heavy iron shackle on one ankle. Keep EXACTLY the same head, bandana and outfit as the attached prisoner sheet.
```

---

## สำหรับคนใส่เข้าเกม

- แผ่น 5 แถว × 4 เฟรม พื้นม่วงแดง 3 ท่า: `prisoner_walk` `prisoner_throw` `prisoner_run`
- เลือดถึง 20% ของ HP: เล่น `throw` ครั้งเดียว แล้วเปลี่ยนไปใช้ `run` แทน `walk` (แผนหัวข้อ 5.2)
