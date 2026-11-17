# นักปืนกระดาษ (คลาส Gunslinger): prompt สำหรับเจนใน ChatGPT

ใช้วิธีเดียวกับนักดาบและจอมเวท ([SWORD.md](SWORD.md), [MAGE.md](MAGE.md)): ทุกท่า 8 เฟรม เจนภาพละมุม
ต้นแบบหน้าตาคือนักปืนแถวล่างใน `art_templates/papercraft_maps/raw/ref/A1_heroes.png`
พื้นหลังสีม่วงแดงล้วน #FF00FF (ตัวละครไม่มีสีม่วงหรือชมพู)

## วิธีเจน

- **เปิดแชทใหม่** ข้อ 1 แนบ `A1_heroes.png` แล้วเจนทุกข้อต่อกันในแชทนั้น ถ้าตัวละครเริ่มเพี้ยน ให้เปิดแชทใหม่แล้วแนบ `raw/gunslinger/design.png` กับภาพท่าที่ดีที่สุด 1–2 ภาพ
- เซฟไฟล์ดิบไว้ที่ `art_templates/papercraft_chars/raw/gunslinger/` ชื่อ `<ท่า>_<มุม>.png` เช่น `run_side.png`
- ข้อ 2–8 เจนท่าละ 5 ภาพ ภาพละมุม (ยกเว้นท่าตาย) ปิดท้ายแต่ละภาพด้วยบรรทัด `Direction:` ตามตารางนี้

| มุม | ชื่อไฟล์ลงท้าย | บรรทัด Direction |
|---|---|---|
| หน้าตรง | `_down` | `Direction: front view, facing the viewer.` |
| เฉียงหน้า | `_down_side` | `Direction: three-quarter front view, turned toward the LEFT.` |
| ข้าง | `_side` | `Direction: side profile, facing LEFT.` |
| เฉียงหลัง | `_up_side` | `Direction: three-quarter BACK view, turned toward the LEFT: we mostly see his back, the back of his head and his coat; only a sliver of his cheek, the eyes are NOT visible.` |
| หลัง | `_up` | `Direction: back view, facing away from the viewer.` |

ท่ายิงกับท่าวิ่งไปยิงไป: มุมหน้าตรงปืนต้องชี้มาหาคนดู และมุมหลังปืนต้องชี้ออกห่างคนดู **ห้ามชี้ไปด้านข้าง** (ของเดิมเคยออกมาผิดแบบนี้)

รวม 32 ภาพ: แบบตัวละคร 1 ภาพ + 6 ท่า × 5 มุม + ท่าตาย 1 ภาพ

---

## 1. แบบตัวละคร → `raw/gunslinger/design.png`

แนบ `A1_heroes.png`

```
The attached image shows the papercraft art style of my game and its three heroes. Use EXACTLY this style for everything in this chat: a handmade papercraft look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, warm soft lighting from the upper left.
Redraw ONLY the gunslinger from the bottom row, bigger and cleaner, exactly the same character: spiky white paper hair, brass goggles on the forehead, a long flowing red scarf, a long dark brown-black coat with gold trim and buckles, brown gloves and boots, and one brass steampunk pistol in his right hand, held low at his side. Slightly chibi proportions about 3.5 heads tall.
Generate an image: one single horizontal row of the SAME gunslinger standing in exactly 5 views, from left to right: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side profile facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Identical size, colours and height in every view, boots on the same baseline, generous empty space, nothing overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on the character.
```

---

ข้อ 2–8 ขึ้นต้นด้วยข้อความกลางนี้ทุกภาพ แล้วต่อด้วย prompt ของท่านั้น และปิดท้ายด้วยบรรทัด `Direction:` จากตาราง

```
Keep this EXACT gunslinger from the design sheet: same outfit, colours, proportions, size and papercraft style. Generate an image: ONE single horizontal row of exactly 8 frames of an animation, in 8 equal-width cells, the SAME gunslinger in every frame, all frames facing the SAME direction (given at the end). Head and body keep the same size in every frame, the boots on the same baseline unless the move says otherwise. Every figure fully inside its own cell with clear empty space around it, the long scarf and the pistol must never reach into the next cell, nothing touching or overlapping. No muzzle flash, no bullets, no smoke, no motion lines, no sparks, no dust, no effects. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
```

## 2. ท่ายืน → `raw/gunslinger/idle_<มุม>.png` (5 ภาพ)

```
The move: a calm standing idle loop, breathing. Frame 1 relaxed stance, the pistol held low in his right hand; frames 2 to 4 the chest slowly rises, the scarf and coat tails sway gently one way; frame 5 top of the breath; frames 6 to 8 slowly settling back, the scarf swaying back, so frame 8 leads smoothly into frame 1. Very small movements only, the feet never move.
```

## 3. ท่าวิ่ง → `raw/gunslinger/run_<มุม>.png` (5 ภาพ)

```
The move: a smooth 8-frame running loop. Frame 1 right foot forward touching the ground, left foot back; frame 2 body lowest, weight on the right foot; frame 3 left leg passing under the body; frame 4 body highest, pushing off; frame 5 left foot forward touching the ground, right foot back; frame 6 body lowest, weight on the left foot; frame 7 right leg passing under the body; frame 8 body highest, pushing off, leading back into frame 1. The free left arm swings, the coat tails swing, the long red scarf trails behind, the pistol is carried low in the right hand.
```

## 4. ท่ายิง → `raw/gunslinger/attack_<มุม>.png` (5 ภาพ)

```
The move: one pistol shot in the direction he faces, the gun always pointing that same way (toward the viewer in a front view, away from the viewer in a back view, never sideways in those). Frame 1 ready stance; frame 2 starting to raise the pistol; frame 3 the arm coming up to aim; frame 4 aiming, the arm fully extended, steady; frame 5 the shot: a sharp recoil, the pistol kicking up a little; frame 6 the arm still lifted from the recoil; frame 7 lowering the pistol back to aim; frame 8 returning toward the ready stance. The feet stay planted. No muzzle flash and no bullet: the game draws them.
```

## 5. ท่าวิ่งไปยิงไป → `raw/gunslinger/run_attack_<มุม>.png` (5 ภาพ)

เกมใช้ท่านี้แทนท่าวิ่งตอนยิงระหว่างเดิน ขาต้องวิ่งเหมือนท่าวิ่ง แต่แขนเล็งปืนไปข้างหน้านิ่ง ๆ

```
The move: running while aiming: the legs run exactly like a smooth 8-frame run cycle (frame 1 right foot forward, frame 2 lowest, frame 3 passing, frame 4 highest, frame 5 left foot forward, frame 6 lowest, frame 7 passing, frame 8 highest), but the gun arm stays steady in every frame, the pistol aimed forward in the running direction with the arm extended (toward the viewer in a front view, away from the viewer in a back view, never sideways in those). The coat tails swing, the long red scarf trails behind. No muzzle flash.
```

## 6. ท่าตาย → `raw/gunslinger/death.png` (ภาพเดียว มุมข้างหันซ้าย ไม่ต้องใส่บรรทัด Direction)

```
The move: a comical knock-out, seen in side profile facing LEFT. Frame 1 struck hard, recoiling; frame 2 knees buckling; frame 3 flung off his feet, falling forward face-first, the pistol slipping out of his hand; frame 4 in the air, about to land; frame 5 slamming into the ground on his side; frame 6 a small bounce; frame 7 rolling from his belly onto his right side, starting to curl up; frame 8 the final pose, completely knocked out: he lies on his RIGHT side in a tight fetal curl with his BACK turned toward the viewer, so we see his back, the back of his head and the soles of his boots, not his face; face hidden in his bent arms, back rounded, knees pulled up to the chest, limp like a sleeping shrimp. NOT kneeling, NOT on all fours, NOT flat on his belly. The goggles are knocked crooked, the scarf drapes over him, the pistol lies on the ground just in front of him. The body keeps the same size as standing, and rests on the same baseline in every frame except the airborne ones.
```

## 7. ท่าขี่สัตว์ → `raw/gunslinger/ride_<มุม>.png` (5 ภาพ)

```
The move: sitting astride an invisible riding animal (do NOT draw the animal, only the gunslinger), a gentle 8-frame riding loop. He is in a low seated crouch, knees bent wide apart as if around a saddle, leaning slightly forward, the left hand forward as if holding reins, the pistol held low in the right hand. Frames 1 to 8: the body bobs gently up and down twice with the animal's stride, the scarf and coat tails bounce a little, so frame 8 leads smoothly into frame 1. Nothing under him, no saddle, no animal.
```

## 8. ท่าขี่บอร์ด → `raw/gunslinger/ride_board_<มุม>.png` (5 ภาพ)

```
The move: standing on an invisible hoverboard (do NOT draw the board, only the gunslinger), a gentle 8-frame surfing loop. He stands sideways in a wide surfer stance, knees bent, the left arm out for balance, the pistol held low in the right hand. Frames 1 to 8: he sways and leans gently from side to side and dips slightly, the long red scarf and coat tails blowing back, so frame 8 leads smoothly into frame 1. Nothing under his feet.
```

---

## สำหรับผม: ตัดเข้าเกม

`node tools/cut_paper_char.cjs gunslinger` → `sprites/paper/player/gunslinger/` แล้วเพิ่ม `gunslinger` ใน `PAPER_CHARS` ของ `src/client/assets.ts`
