# Gunslinger: prompt ที่ใช้สร้างภาพใน ChatGPT

สไตล์อ้างอิงช่อง "16-bit (SNES Style)" ของภาพ Gunner / Gunslinger Style Variations
ทั้ง 4 ภาพสร้างในแชทเดียวกัน โดยใช้ภาพก่อนหน้าเป็นต้นแบบของตัวละคร

ไฟล์อยู่ที่ `public/assets/sprites/player/gunslinger/` ช่องละ 256×256 เรียงแถวเป็น
`down` `down_side` `side` `up_side` `up` ส่วนฝั่งขวาเกมกลับด้านให้เอง จึงหันได้ 8 ทิศ

| ไฟล์ | เฟรม | ที่มา |
|---|---|---|
| `idle.png` | 4 | ภาพแบบตัวละคร บีบและยืดเล็กน้อยให้ดูเหมือนหายใจ |
| `run.png` | 4 | prompt ข้อ 2 |
| `attack.png` | 3 | prompt ข้อ 3 แล้วแทนแถวหันหน้าและแถวหันหลังด้วย prompt ข้อ 4 |
| `run_attack.png` | 4 | prompt ข้อ 5 ใช้แทนท่าวิ่งตอนยิงระหว่างเดิน ไม่มีแสงปากกระบอกปืน เพราะจังหวะเฟรมไม่ตรงกับจังหวะยิง |

หลังได้ภาพ ให้ตัดพื้นหลังสี #FF00FF ออก แล้วจัดให้ทุกเฟรมเท้าอยู่สูงจากขอบล่าง 16px หัวอยู่กลางช่อง
และตัวสูงประมาณ 200px

ยังไม่มีท่า `dash` `hit` `death` `revive` `attack_2` `attack_3` และ `skill_q/e/r`
เกมจะใช้ท่าที่มีแทน และตอนตายจะทำตัวละครให้จางลง

## 1. แบบตัวละคร

```
Make a new character, in polished 16-bit SNES-era JRPG sprite style with finer detail: each figure as if
about 110 pixels tall, chibi proportions about 3 heads tall, clean crisp pixels, rich shading with 3 to 4
tones per material, dark outline, no blur, no painterly texture. Character: young gunslinger with messy spiky
silver-white hair, big expressive eyes, aviator goggles with round glowing blue lenses and brass frames worn
up on the forehead, long flowing red scarf with tails blowing to one side, long black leather coat with gold
trim and buckles and tattered hem, dark gloves, brown leather boots, holding one large chunky steampunk pistol
of dark metal with brass and a small glowing yellow strip, in the right hand held forward at waist height.
Original character. Generate an image: one single horizontal row of the SAME character standing in exactly 5
views, from left to right: (1) front facing the viewer, (2) three-quarter front turned toward the LEFT,
(3) side profile facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back view. Identical size,
colors and height in every view, boots on the same baseline, generous empty space, nothing overlapping.
Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid
lines. Do not use pink, magenta or purple on the character.
```

## 2. ท่าวิ่ง

```
Perfect character. Keep this EXACT character, outfit, colors, size and pixel style. Generate an image: a
running animation sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures total. Each row is one
facing direction, top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the
LEFT, row 3 side profile running toward the LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back
view. Each column is one frame of a smooth 4-frame run cycle, left to right: frame 1 right foot forward and
left foot back, frame 2 legs passing under the body, frame 3 left foot forward and right foot back, frame 4
legs passing under the body. Arms swing, coat tails and scarf trail behind, pistol stays in the right hand.
Head and body keep the same size and height in every frame; only the legs, arms, coat and scarf change. Every
figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. Background
ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid
lines.
```

## 3. ท่ายิง

```
Excellent. Keep this EXACT character, outfit, colors, size and pixel style. Generate an image: a shooting
animation sprite sheet as a strict grid of 5 rows x 3 columns, 15 figures total. Each row is one facing
direction and the character aims and fires in that same direction, top to bottom: row 1 front, aiming toward
the viewer, row 2 three-quarter front turned toward the LEFT, aiming down-left, row 3 side profile, aiming
straight LEFT with the arm fully extended, row 4 three-quarter back turned toward the LEFT, aiming up-left,
row 5 back view, aiming away from the viewer. Each column is one frame, left to right: frame 1 standing firmly
and raising the pistol to aim with the arm extended, frame 2 firing with a small bright yellow-orange muzzle
flash at the end of the barrel, attached to the barrel, frame 3 slight recoil with the gun tipped up and no
flash. Feet stay planted in the same place, the head keeps the same size and height in every frame. Every
figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. Background
ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid
lines.
```

## 4. แก้ท่ายิงตอนหันหน้าและหันหลัง

```
Fix the front and back rows of that shooting sheet: the gun must NOT point sideways in any frame of these rows.
Keep this EXACT character, outfit, colors, size, stance and pixel style. Generate an image: a strict grid of
2 rows x 3 columns, 6 figures total. Row 1, front view: the character faces the viewer and points the pistol
straight at the viewer with the arm extended forward, heavily foreshortened, the round gun muzzle centered in
front of the chest and pointing out of the picture. Row 2, back view: we see the character's back, the arm
raised and extended straight forward away from the viewer, the pistol pointing straight up the picture and away
from us, with the gun visible above the right shoulder beside the head and the muzzle at the top. Columns, left
to right: frame 1 aiming, no flash; frame 2 firing, with a small bright yellow-orange muzzle flash attached right
at the muzzle, in row 1 a round star burst centered on the muzzle in front of the chest, in row 2 a small burst
at the top end of the barrel; frame 3 slight recoil, the gun tipped a little upward, no flash. Feet stay planted,
the head keeps the same size and height in every frame. Every figure fully inside its own cell with clear empty
space around it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no
shadows, no ground, no text, no labels, no numbers, no grid lines.
```

## 5. ท่าวิ่งไปยิงไป

```
Excellent. Keep this EXACT character, outfit, colors, size and pixel style. Generate an image: a RUN-AND-SHOOT
animation sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures total: the character is running at full
speed while aiming the pistol forward with the arm extended. Each row is one facing direction, and both the running
and the aiming go in that same direction, top to bottom: row 1 front, running toward the viewer, the pistol pointing
straight at the viewer with the arm extended forward, heavily foreshortened, the round muzzle in front of the chest;
row 2 three-quarter front turned toward the LEFT, aiming down-left; row 3 side profile running toward the LEFT, arm
fully extended straight LEFT; row 4 three-quarter back turned toward the LEFT, aiming up-left; row 5 back view,
running away from the viewer, the arm extended forward and the pistol pointing up the picture, visible above the
right shoulder beside the head. Each column is one frame of a smooth 4-frame run cycle with clearly different leg
poses, left to right: frame 1 right foot forward and left foot back, frame 2 legs passing under the body, frame 3
left foot forward and right foot back, frame 4 legs passing under the body. The legs must really run in every row;
the gun arm stays steady and aimed in all 4 frames; coat tails and scarf trail behind. No muzzle flash, no bullets,
no smoke, no motion lines. Head and body keep the same size and height in every frame. Every figure fully inside its
own cell with clear empty space around it, nothing touching or overlapping. Background ONE perfectly flat solid
magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines.
```

## 6. ท่าตาย

ท่าตายแบบมีม "นอนคุดคู้หน้าคว่ำ" ใช้ท่าเดียวกันทุกคลาส แถวเดียว 5 เฟรม มุมข้างหันซ้าย (เกมกลับภาพให้ตอนหันขวา)
เกมเล่นครั้งเดียวแล้วค้างเฟรมสุดท้ายไว้จนกดฟื้นคืนชีพ และวาดหลุมใต้ตัวเอง (`death_crater` ใน [ground_fx](../ground_fx/PROMPTS.md))

เปิดแชทใหม่ (แชทเดิมยาวเกินไปแล้ว) แนบ `public/assets/sprites/player/gunslinger/idle.png` กับ `run.png` ไปเป็นต้นแบบ
เซฟเป็น `art_templates/gunslinger/raw/death.png` แล้วตัดเป็น `player/gunslinger/death.png` ด้วยสเกลเดียวกับท่ายืน

```
Use the attached sprite sheets as the EXACT character and style reference: the same young gunslinger with messy spiky
silver-white hair, aviator goggles with round blue lenses and brass frames on the forehead, a long red scarf, a long
black leather coat with gold trim and a tattered hem, dark gloves, brown boots, and one large chunky steampunk pistol
of dark metal and brass. Same outfit, same colors, same size and the same fine-detail 16-bit SNES-era chibi pixel
style, each figure as if about 110 pixels tall, dark outline, crisp pixels, no blur. Do NOT draw a different character.
Generate an image: a comical knock-out death animation as ONE single horizontal row of exactly 5 frames, seen in side
profile facing LEFT, left to right: frame 1 struck hard, recoiling, knees buckling; frame 2 flung off his feet, falling
forward face-first, the pistol slipping out of his hand; frame 3 slamming into the ground on his side, a small bounce;
frame 4 rolling from his belly onto his right side and starting to curl up; frame 5 the final pose, completely knocked
out: he lies on his RIGHT side in a tight fetal curl with his BACK turned toward the viewer, so we see his back, the
back of his head and the soles of his boots, not his face. His head is at the left end, face hidden, pressed into the
ground and tucked into his arms; both arms are bent with the forearms crossed in front of the face and the fists near
the head; his back is strongly rounded; both knees are bent and pulled up toward the chest, the legs stacked one on top
of the other, the boots at the right end with the soles toward the viewer. He is NOT kneeling, NOT on all fours and NOT
lying flat on his belly: he is curled on his side like a sleeping shrimp, limp and motionless. The pistol lies on the ground just in front of him; the red
scarf and the coat tails lie spread on the ground. The body keeps the same size as the standing reference in every
frame (if he stood up he would be exactly as tall), and the lowest point of the body rests on the same baseline in
every frame except the airborne one. Every figure fully inside its own equal-width cell with clear empty space around
it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no ground, no crater, no
shadows, no dust, no impact lines, no stars, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or
purple on the character.
```
