# นักดาบกระดาษ (คลาส Sword): prompt สำหรับเจนใน ChatGPT

ต่อจากแมพกระดาษ (`art_templates/papercraft_maps/`) ลำดับงานคือ: นักดาบ → จอมเวท → นักปืน → NPC
เจ้าของเลือกเมื่อ 2026-11-17: เจนทีละท่าแบบเดิม (ไม่ใช้นักดาบโครงกระดูก) **ทุกท่า 8 เฟรม** และเจนภาพละมุม
ต้นแบบหน้าตาคืออัศวินแถวบนใน `art_templates/papercraft_maps/raw/ref/A1_heroes.png` (ภาพทดสอบสไตล์ที่เจ้าของผ่านแล้ว)

## วิธีเจน

- **เจนทุกข้อในแชทเดียวกัน** ข้อ 1 แนบ `A1_heroes.png` ถ้าแชทยาวจนตัวละครเริ่มเพี้ยน ให้เปิดแชทใหม่แล้วแนบ `raw/sword/design.png` กับภาพท่าที่ดีที่สุด 1–2 ภาพ
- เซฟไฟล์ดิบไว้ที่ `art_templates/papercraft_chars/raw/sword/` (โฟลเดอร์ `raw/` ไม่ commit)
- ข้อ 2–8 เจนท่าละ 5 ภาพ ภาพละมุม ใช้ prompt เดียวกันแล้วเปลี่ยนแค่บรรทัด `Direction:` ตามตารางนี้ เซฟชื่อ `<ท่า>_<มุม>.png` เช่น `run_side.png`

| มุม | ชื่อไฟล์ลงท้าย | บรรทัด Direction |
|---|---|---|
| หน้าตรง | `_down` | `Direction: front view, facing the viewer.` |
| เฉียงหน้า | `_down_side` | `Direction: three-quarter front view, turned toward the LEFT.` |
| ข้าง | `_side` | `Direction: side profile, facing LEFT.` |
| เฉียงหลัง | `_up_side` | `Direction: three-quarter BACK view, turned toward the LEFT: we mostly see his back, the back of his head and the cape; only a sliver of his cheek, the eyes are NOT visible.` |
| หลัง | `_up` | `Direction: back view, facing away from the viewer.` |

ด้านขวาเกมกลับภาพจากด้านซ้ายเอง จึงหันได้ 8 ทิศ
ทุกภาพพื้นหลังสีม่วงแดงล้วน #FF00FF (นักดาบไม่มีสีม่วงหรือชมพู)

---

## 1. แบบตัวละคร → `raw/sword/design.png`

แนบ `A1_heroes.png`

```
The attached image shows the papercraft art style of my game and its three heroes. Use EXACTLY this style for everything in this chat: a handmade papercraft look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, warm soft lighting from the upper left.
Redraw ONLY the knight from the top row, bigger and cleaner, exactly the same character: spiky ash-blond paper hair, serious face, dark gunmetal paper armour with gold trim and round knee and elbow plates, a long charcoal cape with gold trim and a gold tree emblem on the back, and one glowing amber sword in his right hand, held low at his side. Slightly chibi proportions about 3.5 heads tall.
Generate an image: one single horizontal row of the SAME knight standing in exactly 5 views, from left to right: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side profile facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Identical size, colours and height in every view, boots on the same baseline, generous empty space, nothing overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on the character.
```

---

ข้อ 2–8 ขึ้นต้นด้วยข้อความกลางนี้ทุกภาพ แล้วต่อด้วย prompt ของท่านั้น และปิดท้ายด้วยบรรทัด `Direction:` จากตาราง

```
Keep this EXACT knight from the design sheet: same outfit, colours, proportions, size and papercraft style. Generate an image: ONE single horizontal row of exactly 8 frames of an animation, in 8 equal-width cells, the SAME knight in every frame, all frames facing the SAME direction (given at the end). Head and body keep the same size in every frame, the boots on the same baseline unless the move says otherwise. Every figure fully inside its own cell with clear empty space around it, the sword must never reach into the next cell, nothing touching or overlapping. The blade keeps its own gentle amber glow, but there are NO slash trails, no arcs, no motion lines, no sparks, no dust, no effects. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
```

## 2. ท่ายืน → `raw/sword/idle_<มุม>.png` (5 ภาพ)

```
The move: a calm standing idle loop, breathing. Frame 1 relaxed stance, sword held low at his side; frames 2 to 4 the chest slowly rises and the shoulders lift a tiny bit, the cape sways gently one way; frame 5 top of the breath; frames 6 to 8 slowly settling back, the cape swaying back, so frame 8 leads smoothly into frame 1. Very small movements only, the feet never move.
```

## 3. ท่าวิ่ง → `raw/sword/run_<มุม>.png` (5 ภาพ)

```
The move: a smooth 8-frame running loop. Frame 1 right foot forward touching the ground, left foot back; frame 2 body lowest, weight on the right foot; frame 3 left leg passing under the body; frame 4 body highest, pushing off; frame 5 left foot forward touching the ground, right foot back; frame 6 body lowest, weight on the left foot; frame 7 right leg passing under the body; frame 8 body highest, pushing off, leading back into frame 1. The free left arm swings opposite to the legs, the cape trails behind and flutters, the sword stays in the right hand held low and angled back, never pointing up and never crossing in front of the face.
```

## 4. ท่าฟัน คอมโบ 1 → `raw/sword/attack_<มุม>.png` (5 ภาพ)

```
The move: one fast horizontal sword slash in the direction he faces. Frame 1 ready stance; frame 2 starting the wind-up; frame 3 full wind-up, the sword pulled back over the right shoulder, body twisted; frame 4 the swing begins; frame 5 mid-swing, the blade sweeping across in front of him; frame 6 follow-through, the blade fully swung across to the other side, arm extended; frame 7 holding the follow-through, cape flaring; frame 8 recovering toward the ready stance, sword low. The feet stay planted.
```

## 5. ท่าฟัน คอมโบ 2 → `raw/sword/attack_2_<มุม>.png` (5 ภาพ)

```
The move: a fast rising diagonal backhand slash in the direction he faces, from low on his left side up to high on his right side, the opposite of a forehand slash. Frame 1 ready stance; frame 2 the sword drawn low across his body near the left hip, knees bending; frame 3 crouched, coiled to swing; frame 4 the swing begins upward; frame 5 mid-swing, the blade rising diagonally in front of him; frame 6 follow-through, the blade high above the right shoulder, arm extended up; frame 7 holding it, cape flaring; frame 8 lowering back toward the ready stance. The feet stay planted.
```

## 6. ท่าฟัน คอมโบ 3 → `raw/sword/attack_3_<มุม>.png` (5 ภาพ)

```
The move: a powerful two-handed overhead downward chop in the direction he faces, the finishing blow. Frame 1 ready stance; frame 2 both hands raising the sword; frame 3 the sword high above his head, body stretched up, a small hop with the feet only slightly off the ground; frame 4 top of the hop; frame 5 the blade coming down hard in front of him; frame 6 impact, deep crouch, the blade tip near the ground in front of his feet, cape flaring; frame 7 holding the crouch; frame 8 rising back toward the ready stance, sword low. The feet return to the same baseline.
```

## 7. ท่าตาย → `raw/sword/death.png` (ภาพเดียว มุมข้างหันซ้าย ไม่ต้องใส่บรรทัด Direction)

ท่าตายแบบมีม "นอนขดตัวตะแคงหันหลัง" เหมือนท่าเดิม เกมเล่นครั้งเดียวแล้วค้างเฟรมสุดท้ายจนกดฟื้นคืนชีพ

```
The move: a comical knock-out, seen in side profile facing LEFT. Frame 1 struck hard, recoiling; frame 2 knees buckling; frame 3 flung off his feet, falling forward face-first, the sword slipping out of his hand; frame 4 in the air, about to land; frame 5 slamming into the ground on his side; frame 6 a small bounce; frame 7 rolling from his belly onto his right side, starting to curl up; frame 8 the final pose, completely knocked out: he lies on his RIGHT side in a tight fetal curl with his BACK turned toward the viewer, so we see his back, the back of his head and the soles of his boots, not his face; face hidden and tucked into his bent arms, back strongly rounded, knees pulled up to the chest, legs stacked, limp like a sleeping shrimp. NOT kneeling, NOT on all fours, NOT flat on his belly. The sword lies on the ground just in front of him, its glow almost gone, the cape draped over his back. The body keeps the same size as standing, and rests on the same baseline in every frame except the airborne ones.
```

## 8. ท่าขี่สัตว์ → `raw/sword/ride_<มุม>.png` (5 ภาพ)

ตัวสัตว์ขี่เกมวาดแยกเอง ภาพนี้มีแค่ตัวอัศวินในท่านั่งคร่อม

```
The move: sitting astride an invisible riding animal (do NOT draw the animal, only the knight), a gentle 8-frame riding loop. He is in a low seated crouch, knees bent wide apart as if around a saddle, leaning slightly forward, the left hand forward as if holding reins, the sword held low in the right hand. Frames 1 to 8: the body bobs gently up and down twice with the animal's stride, the cape and hair bounce a little, so frame 8 leads smoothly into frame 1. Nothing under him, no saddle, no animal.
```

## 9. ท่าขี่บอร์ด → `raw/sword/ride_board_<มุม>.png` (5 ภาพ)

ตัวบอร์ดเกมวาดแยกเอง ภาพนี้มีแค่ตัวอัศวินในท่ายืนบนบอร์ด

```
The move: standing on an invisible hoverboard (do NOT draw the board, only the knight), a gentle 8-frame surfing loop. He stands sideways in a wide surfer stance, knees bent, arms out a little for balance, the sword held low in the right hand. Frames 1 to 8: he sways and leans gently from side to side and dips slightly, the cape and hair blowing back, so frame 8 leads smoothly into frame 1. Nothing under his feet.
```

---

## สำหรับผม: ตัดเข้าเกม

- ตัดพื้นหลัง แยก 8 ช่องในแต่ละภาพ ปรับขนาดให้ตัวสูงเท่ากันทุกท่า (ตามท่ายืน) แล้วรวมเป็นแผ่นแบบเดิม: แถวละมุม (`down` `down_side` `side` `up_side` `up`) แถวละ 8 เฟรม ช่องละ 256×256 ส่วนท่าตายเป็นแถวเดียว ช่องละ 320×320
- ใส่ภาพลง `sprites/paper/player/sword/` แล้วให้สวิตช์ภาพกระดาษใน `/admin` เลือกใช้ ภาพเดิมยังอยู่
- `sprite.json` ของชุดกระดาษ: `frames: 8` ทุกท่า fps เพิ่มเป็น 2 เท่าของเดิม ความเร็วท่าในเกมจะเท่าเดิม (idle 10, run 20, attack 24, death 14) ส่วนท่าขี่ใช้ 8 ทำให้โยกช้ากว่าเดิมนิดหน่อย
- ภาพแบบตัวละคร (ข้อ 1) ไม่ได้เข้าเกม ใช้เป็นต้นแบบเท่านั้น
