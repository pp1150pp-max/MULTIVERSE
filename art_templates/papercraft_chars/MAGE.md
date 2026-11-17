# จอมเวทกระดาษ (คลาส Mage): prompt สำหรับเจนใน ChatGPT

ใช้วิธีเดียวกับนักดาบ ([SWORD.md](SWORD.md)): ทุกท่า 8 เฟรม เจนภาพละมุม
ต้นแบบหน้าตาคือแม่มดแถวกลางใน `art_templates/papercraft_maps/raw/ref/A1_heroes.png`
**พื้นหลังเป็นสีเขียวล้วน #00FF00** (ไม่ใช่สีม่วงแดง) เพราะชุดของเธอเป็นสีม่วง

## วิธีเจน

- **เปิดแชทใหม่** ข้อ 1 แนบ `A1_heroes.png` แล้วเจนทุกข้อต่อกันในแชทนั้น ถ้าตัวละครเริ่มเพี้ยน ให้เปิดแชทใหม่แล้วแนบ `raw/mage/design.png` กับภาพท่าที่ดีที่สุด 1–2 ภาพ
- เซฟไฟล์ดิบไว้ที่ `art_templates/papercraft_chars/raw/mage/` ชื่อ `<ท่า>_<มุม>.png` เช่น `run_side.png`
- ข้อ 2–8 เจนท่าละ 5 ภาพ ภาพละมุม (ยกเว้นท่าตาย) ปิดท้ายแต่ละภาพด้วยบรรทัด `Direction:` ตามตารางนี้

| มุม | ชื่อไฟล์ลงท้าย | บรรทัด Direction |
|---|---|---|
| หน้าตรง | `_down` | `Direction: front view, facing the viewer.` |
| เฉียงหน้า | `_down_side` | `Direction: three-quarter front view, turned toward the LEFT.` |
| ข้าง | `_side` | `Direction: side profile, facing LEFT.` |
| เฉียงหลัง | `_up_side` | `Direction: three-quarter BACK view, turned toward the LEFT: we mostly see her back, the back of her hat and her long hair; only a sliver of her cheek, the eyes are NOT visible.` |
| หลัง | `_up` | `Direction: back view, facing away from the viewer.` |

รวม 32 ภาพ: แบบตัวละคร 1 ภาพ + 6 ท่า × 5 มุม + ท่าตาย 1 ภาพ

---

## 1. แบบตัวละคร → `raw/mage/design.png`

แนบ `A1_heroes.png`

```
The attached image shows the papercraft art style of my game and its three heroes. Use EXACTLY this style for everything in this chat: a handmade papercraft look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, warm soft lighting from the upper left.
Redraw ONLY the witch from the middle row, bigger and cleaner, exactly the same character: long straight pale silver-lavender paper hair, a big deep purple pointed witch hat with a gold band and a gold flower, a deep purple robe and short cape with gold trim and gold patterns, a brown belt, brown boots, and a tall gold staff topped by a gold ring holding a big glowing blue orb, held in her right hand. Slightly chibi proportions about 3.5 heads tall.
Generate an image: one single horizontal row of the SAME witch standing in exactly 5 views, from left to right: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side profile facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Identical size, colours and height in every view, boots on the same baseline, generous empty space, nothing overlapping. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no grid lines. Do not use bright green anywhere on the character.
```

---

ข้อ 2–8 ขึ้นต้นด้วยข้อความกลางนี้ทุกภาพ แล้วต่อด้วย prompt ของท่านั้น และปิดท้ายด้วยบรรทัด `Direction:` จากตาราง

```
Keep this EXACT witch from the design sheet: same outfit, colours, proportions, size and papercraft style. Generate an image: ONE single horizontal row of exactly 8 frames of an animation, in 8 equal-width cells, the SAME witch in every frame, all frames facing the SAME direction (given at the end). Head, hat and body keep the same size in every frame, the boots on the same baseline unless the move says otherwise. Every figure fully inside its own cell with clear empty space around it, the staff must never reach into the next cell, nothing touching or overlapping. The orb keeps its own gentle blue glow, but there are NO spell effects, no magic bolts, no sparkles, no motion lines, no dust. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use bright green anywhere on the character.
```

## 2. ท่ายืน → `raw/mage/idle_<มุม>.png` (5 ภาพ)

```
The move: a calm standing idle loop, breathing. Frame 1 relaxed stance, the staff upright in her right hand; frames 2 to 4 the chest slowly rises, the hat brim and the long hair sway gently one way; frame 5 top of the breath; frames 6 to 8 slowly settling back, the hair and robe swaying back, so frame 8 leads smoothly into frame 1. Very small movements only, the feet never move.
```

## 3. ท่าวิ่ง → `raw/mage/run_<มุม>.png` (5 ภาพ)

```
The move: a smooth 8-frame running loop. Frame 1 right foot forward touching the ground, left foot back; frame 2 body lowest, weight on the right foot; frame 3 left leg passing under the body; frame 4 body highest, pushing off; frame 5 left foot forward touching the ground, right foot back; frame 6 body lowest, weight on the left foot; frame 7 right leg passing under the body; frame 8 body highest, pushing off, leading back into frame 1. The free left arm swings, the robe hem swings, the long hair and cape trail behind, the staff is carried in the right hand, angled back.
```

## 4. ท่าร่ายเวท → `raw/mage/attack_<มุม>.png` (5 ภาพ)

```
The move: one spell cast toward the direction she faces. Frame 1 ready stance; frame 2 starting to raise the staff; frame 3 the staff raised, drawing back; frame 4 starting to thrust; frame 5 the staff thrust fully forward toward the target, arm extended, the orb in front; frame 6 holding the thrust, robe and hair blown back a little; frame 7 a slight recoil, the staff tipping back; frame 8 returning toward the ready stance. The feet stay planted. No magic effects, only the orb's own glow.
```

## 5. ท่าวิ่งไปร่ายไป → `raw/mage/run_attack_<มุม>.png` (5 ภาพ)

เกมใช้ท่านี้แทนท่าวิ่งตอนร่ายเวทระหว่างเดิน ขาต้องวิ่งเหมือนท่าวิ่ง แต่แขนถือไม้เท้าชี้ไปข้างหน้านิ่ง ๆ

```
The move: running while casting: the legs run exactly like a smooth 8-frame run cycle (frame 1 right foot forward, frame 2 lowest, frame 3 passing, frame 4 highest, frame 5 left foot forward, frame 6 lowest, frame 7 passing, frame 8 highest), but the staff arm stays steady in every frame, thrusting the staff forward in the running direction with the orb in front. The robe hem swings, the long hair and cape trail behind.
```

## 6. ท่าตาย → `raw/mage/death.png` (ภาพเดียว มุมข้างหันซ้าย ไม่ต้องใส่บรรทัด Direction)

```
The move: a comical knock-out, seen in side profile facing LEFT. Frame 1 struck hard, recoiling; frame 2 knees buckling; frame 3 flung off her feet, falling forward face-first, the staff slipping out of her hand; frame 4 in the air, about to land; frame 5 slamming into the ground on her side; frame 6 a small bounce; frame 7 rolling from her belly onto her right side, starting to curl up; frame 8 the final pose, completely knocked out: she lies on her RIGHT side in a tight fetal curl with her BACK turned toward the viewer, so we see her back, her long hair and the soles of her boots, not her face; face hidden in her bent arms, back rounded, knees pulled up to the chest, limp like a sleeping shrimp. NOT kneeling, NOT on all fours, NOT flat on her belly. The hat is knocked crooked but stays on her head, the staff lies on the ground just in front of her, the orb dull. The body keeps the same size as standing, and rests on the same baseline in every frame except the airborne ones.
```

## 7. ท่าขี่สัตว์ → `raw/mage/ride_<มุม>.png` (5 ภาพ)

```
The move: sitting astride an invisible riding animal (do NOT draw the animal, only the witch), a gentle 8-frame riding loop. She is in a low seated crouch, knees bent wide apart as if around a saddle, leaning slightly forward, the left hand forward as if holding reins, the staff held upright in the right hand. Frames 1 to 8: the body bobs gently up and down twice with the animal's stride, the hat, hair and robe bounce a little, so frame 8 leads smoothly into frame 1. Nothing under her, no saddle, no animal.
```

## 8. ท่าขี่บอร์ด → `raw/mage/ride_board_<มุม>.png` (5 ภาพ)

```
The move: standing on an invisible hoverboard (do NOT draw the board, only the witch), a gentle 8-frame surfing loop. She stands sideways in a wide surfer stance, knees bent, the left arm out for balance, the staff held in the right hand. Frames 1 to 8: she sways and leans gently from side to side and dips slightly, her hat brim, long hair and robe blowing back, so frame 8 leads smoothly into frame 1. Nothing under her feet.
```

---

## สำหรับผม: ตัดเข้าเกม

`node tools/cut_paper_char.cjs mage` (พื้นหลังเขียว) → `sprites/paper/player/mage/` แล้วเพิ่ม `mage` ใน `PAPER_CHARS` ของ `src/client/assets.ts`
