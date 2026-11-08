# Sword (Techno Knight): prompt ที่ใช้สร้างภาพใน ChatGPT

สไตล์ 16-bit SNES ระดับความละเอียดเดียวกับ Gunslinger และ Mage ให้ดูเป็นสมาชิกคนที่สามของปาร์ตี้เดียวกัน
ดีไซน์มาจากภาพ concept "Techno Knight" ที่เจ้าของเจนไว้ (อัศวินผมบลอนด์เทา เกราะเทาเหล็กขลิบทอง ผ้าคลุมสีเทาถ่าน คาตานาเรืองแสงอำพัน)
ตอนสร้างให้แนบภาพ concept กับ `player/mage/idle.png` และ `player/gunslinger/idle.png` ไปด้วย แล้วสร้างทุกภาพในแชทเดียวกัน

ไฟล์อยู่ที่ `public/assets/sprites/player/sword/` ช่องละ 256×256 เรียงแถวเป็น
`down` `down_side` `side` `up_side` `up` ส่วนฝั่งขวาเกมกลับด้านให้เอง จึงหันได้ 8 ทิศ
(สเปก 4 ทิศใน [README.md](README.md) เป็นของแบบเก่า Cyberblade ตอนนี้ใช้ 5 ทิศแบบเดียวกับ Mage และ Gunslinger)

| ไฟล์ | เฟรม | ที่มา |
|---|---|---|
| `idle.png` | 4 | ภาพแบบตัวละคร (prompt ข้อ 1) บีบและยืดเล็กน้อยให้ดูเหมือนหายใจ |
| `run.png` | 4 | prompt ข้อ 2 แล้วแทนแถว `up_side` ด้วย prompt ข้อ 3 |
| `attack.png` | 4 | prompt ข้อ 4 คอมโบ 1 ฟันแนวนอน |
| `attack_2.png` | 4 | prompt ข้อ 5 คอมโบ 2 ฟันย้อนเฉียงขึ้น |
| `attack_3.png` | 4 | prompt ข้อ 6 คอมโบ 3 กระโดดฟาดลงปิดท้าย |
| `death.png` | 4 | เฟรม 1–3 จาก prompt ข้อ 9 ต่อด้วยท่านอนจาก prompt ข้อ 12 ช่องละ 320×320 แถวเดียว (มุมข้าง) |

เกมเล่นท่าฟัน `attack` → `attack_2` → `attack_3` วนไปเองเมื่อตีต่อเนื่องภายใน 1 วินาที
รอยฟันสีทองมาจาก `fx/sword.png` ที่เกมวาดทับ จึงไม่ต้องวาดรอยฟันในตัวละคร

ภาพดิบเซฟไว้ที่ `art_templates/sword/raw/` (ไม่ได้ commit) แล้วตัดด้วย
`PNGJS=<path ของ pngjs> node tools/cut_sword.cjs` สคริปต์จะตัดพื้นหลัง #FF00FF ออก อุดรูเล็ก ๆ บนผ้าคลุม
ปรับขนาดทีละแถวให้ตัวสูง 200px เท่า Gunslinger (ไม่นับดาบที่ยกขึ้น) และวางเท้าสูงจากขอบล่าง 16px

ท่าตายตัดด้วย `PNGJS=<path ของ pngjs> RAW=art_templates/sword/raw node tools/cut_death.cjs sword magenta 0.56 0.21`

ยังไม่มีท่า `run_attack` `dash` `hit` `revive` และ `skill_q/e/r`
เกมจะใช้ท่าที่มีแทน (ตีระหว่างเดินจะเล่นท่าฟันยืนกับที่)

## 1. แบบตัวละคร

```
Use the first attached image ONLY as a loose costume reference. Use the attached mage and gunslinger sprites as the
EXACT style reference: the new character must look like the third member of the same party, same game, same artist.
Polished 16-bit SNES-era JRPG sprite style with finer detail: each figure as if about 110 pixels tall, chibi
proportions about 3 heads tall with a big head and big expressive eyes, clean crisp pixels, rich shading with 3 to 4
tones per material, dark outline, no blur, no painterly texture, no tall anime proportions.
Character: young swordsman knight with messy spiky ash-blond hair, golden amber eyes, serious confident face, no
helmet, normal human ears. Fantasy knight armour with a light touch of machinery, in the same dark rich palette as the
party: dark gunmetal plate armour with gold trim and buckles, a few white plates on the shoulders and chest, small
mechanical joints at elbows and knees, a small diamond-shaped glowing amber gem on the chest and only a few thin
glowing amber lines. Long charcoal cape with gold trim and a slightly tattered hem, dark gloves, armoured brown-and-
gunmetal boots. Holding ONE curved katana in the right hand, held low at his side, with a round brass guard and a
gently glowing amber-orange blade, the blade about as long as his body is tall. Original character.
Generate an image: one single horizontal row of the SAME character standing in exactly 5 views, from left to right:
(1) front facing the viewer, (2) three-quarter front turned toward the LEFT, (3) side profile facing LEFT,
(4) three-quarter back turned toward the LEFT, (5) back view. Identical size, colors and height in every view, boots
on the same baseline, generous empty space, nothing overlapping. Background ONE perfectly flat solid magenta
(#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on the
character.
```

## 2. ท่าวิ่ง

```
Perfect character. Keep this EXACT character, outfit, colors, size and pixel style. Generate an image: a running
animation sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures total. Each row is one facing direction,
top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the LEFT, row 3 side profile
running toward the LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back view. Each column is one frame
of a smooth 4-frame run cycle with clearly different leg poses, left to right: frame 1 right foot forward and left
foot back, frame 2 legs passing under the body, frame 3 left foot forward and right foot back, frame 4 legs passing
under the body. The free left arm swings, the cape trails behind, the glowing katana stays in the right hand held low
and angled back behind him while running, never pointing up and never crossing in front of the face. Head and body
keep the same size and height in every frame; only the legs, arms and cape change. Every figure fully inside its own
cell with clear empty space around it, nothing touching or overlapping, the katana must not reach into the next cell.
Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid
lines. Do not use pink, magenta or purple on the character.
```

## 3. แก้แถวเฉียงหลังของท่าวิ่ง

แถว 4 ของข้อ 2 ออกมาเห็นหน้าด้านข้างเกือบเหมือนแถว 3 จึงเจนแถวนี้ใหม่แยก (`raw/run_row4.png`)

```
Very good. Fix only row 4 of that running sheet: it looks too much like the side view. Keep this EXACT character,
outfit, colors, size and pixel style. Generate an image: ONE row of 4 figures, a smooth 4-frame run cycle seen in a
THREE-QUARTER BACK view turned toward the LEFT: we mostly see his back, the back of his head and hair, and the cape;
only a small sliver of his left cheek is visible, the eyes are NOT visible. He runs away from the viewer toward the
upper left. Frames left to right: frame 1 right foot forward and left foot back, frame 2 legs passing under the body,
frame 3 left foot forward and right foot back, frame 4 legs passing under the body. The cape trails behind toward the
viewer, the glowing katana stays in the right hand held low. Head and body keep the same size and height as the
other rows. Every figure fully inside its own cell with clear empty space around it, nothing touching. Background ONE
perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not
use pink, magenta or purple on the character or the cape.
```

## 4. ท่าฟัน คอมโบ 1

```
Excellent. Keep this EXACT character, outfit, colors, size and pixel style. Generate an image: a sword attack
animation sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures total: one fast horizontal katana slash.
Each row is one facing direction and he slashes in that same direction, top to bottom: row 1 front, slashing toward
the viewer; row 2 three-quarter front turned toward the LEFT, slashing down-left; row 3 side profile, slashing
straight LEFT; row 4 three-quarter back turned toward the LEFT, slashing up-left, we mostly see his back; row 5 back
view, slashing away from the viewer. Each column is one frame, left to right: frame 1 wind-up, the katana pulled back
over the right shoulder, body twisted; frame 2 mid-swing, the blade sweeping across in front of him; frame 3 follow-
through, the blade fully swung across to the other side, arm extended; frame 4 recovery, returning to the ready
stance with the katana low. The blade keeps its own gentle amber glow but there are NO slash trails, no arcs, no
motion lines, no sparks. Feet stay planted in the same place, head and body keep the same size and height in every
frame. Every figure fully inside its own cell with clear empty space around it, the katana must not reach into the
next cell, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no
ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
```

## 5. ท่าฟัน คอมโบ 2

```
Excellent. Keep this EXACT character, outfit, colors, size and pixel style. Generate an image: a second sword
attack animation sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures total: a fast rising diagonal
backhand katana slash, from low on his left side up to high on his right side, the opposite direction of the
previous slash. Rows are the same facing directions as before, top to bottom: row 1 front, row 2 three-quarter
front turned toward the LEFT, row 3 side profile facing LEFT, row 4 three-quarter back turned toward the LEFT (we
mostly see his back), row 5 back view; he always slashes in the direction he faces. Columns left to right: frame 1
the katana held low across his body near the left hip, knees bent; frame 2 mid-swing, the blade rising diagonally
in front of him; frame 3 follow-through, the blade high above the right shoulder, arm extended up; frame 4 recovery,
lowering back to the ready stance. The blade keeps its own gentle amber glow but there are NO slash trails, no arcs,
no motion lines, no sparks. Feet stay planted, head and body keep the same size and height in every frame. Every
figure fully inside its own cell with clear empty space around it, the katana must not reach into the next cell.
Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no
grid lines. Do not use pink, magenta or purple on the character.
```

## 6. ท่าฟัน คอมโบ 3

```
Excellent. Keep this EXACT character, outfit, colors, size and pixel style. Generate an image: a third, finishing
sword attack animation sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures total: a powerful two-handed
overhead downward katana chop. Rows are the same facing directions as before, top to bottom: row 1 front, row 2
three-quarter front turned toward the LEFT, row 3 side profile facing LEFT, row 4 three-quarter back turned toward
the LEFT (we mostly see his back), row 5 back view; he always chops in the direction he faces. Columns left to right:
frame 1 both hands raise the katana high above the head, body stretched up, a small hop with the feet only slightly
off the ground; frame 2 the blade coming down hard in front of him; frame 3 impact, deep crouch, the blade tip near
the ground in front of his feet, cape flaring; frame 4 rising back to the ready stance with the katana low. The blade
keeps its own gentle amber glow but there are NO slash trails, no arcs, no shockwaves, no cracks, no sparks. Head and
body keep the same size in every frame, the feet return to the same baseline. Every figure fully inside its own cell
with clear empty space around it, the katana must not reach into the next cell. Background ONE perfectly flat solid
magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or
purple on the character.
```

## 7. ไอคอนสกิลปัดป้อง (เลิกใช้แล้ว)

สกิลปัดป้องถูกรวมเข้ากับพายุดาบ (Q หมุนแล้วไม่รับดาเมจ) ไฟล์ภาพจึงถูกเอาออกจากเกม prompt ข้อ 7 และ 8 เก็บไว้เผื่อใช้ทีหลัง

แนบ `icons/skill_charge.png` ไปเป็นตัวอย่างสไตล์ เซฟเป็น `raw/skill_parry_icon.png`

```
One single RPG skill icon in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the attached skill icon:
crisp pixels, rich shading, no blur. A perfect square icon with a dark painted background in a muted deep blue-grey,
a thin bronze-gold bevelled border, and one big bold clear symbol that reads instantly at very small size: a curved
glowing amber katana held horizontally, blocking, with a bright golden spark burst where an incoming blade strikes it,
and a faint translucent golden shield shape behind the katana. The icon fills the whole image. No text, no letters.
```

## 8. ท่าตั้งการ์ด (เลิกใช้แล้ว)

ครั้งแรกเจนในแชทใหม่แล้วได้ตัวละครคนอื่น จึงต้องแนบ `raw/design.png` และ `raw/attack.png` ไปด้วย เซฟเป็น `raw/skill_parry.png`

```
Use the attached sprite sheets as the EXACT character and style reference: the same young knight, same outfit,
same colors, same size and the same fine-detail 16-bit SNES-era chibi pixel style. Do NOT draw a different
character. He has messy spiky ash-blond hair, golden amber eyes, no helmet, no beard, no glasses; dark gunmetal
plate armour with gold trim, white shoulder plates, a small glowing amber diamond gem on the chest, a long charcoal
cape with gold trim, and ONE curved katana with a glowing amber-orange blade and a round brass guard.
Generate an image: a parry / guard pose sprite sheet as a strict grid of 5 rows x 2 columns, 10 figures total. Rows
top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward the LEFT, row 3 side profile
facing LEFT, row 4 three-quarter back turned toward the LEFT (we mostly see his back and cape), row 5 back view. In
every figure he stands firmly in a low defensive stance, knees bent, holding the glowing katana horizontally in front
of his body with both hands, ready to block in the direction he faces. Column 1: raising the katana into the guard.
Column 2: the full guard, braced, cape flaring slightly. No sparks, no shields, no effects, no motion lines. Feet on
the same baseline, same size as the reference. Every figure fully inside its own cell with clear empty space around
it, the katana must not reach into the next cell. Background ONE perfectly flat solid magenta (#FF00FF), no shadows,
no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
```

## 9. ท่าตาย

ท่าตายแบบมีม "นอนคุดคู้หน้าคว่ำ" ใช้ท่าเดียวกันทุกคลาส แถวเดียว 5 เฟรม มุมข้างหันซ้าย (เกมกลับภาพให้ตอนหันขวา)
เกมเล่นครั้งเดียวแล้วค้างเฟรมสุดท้ายไว้จนกดฟื้นคืนชีพ และวาดหลุมใต้ตัวเอง (`death_crater` ใน [ground_fx](../ground_fx/PROMPTS.md))

เปิดแชทใหม่ (แชทเดิมยาวเกินไปแล้ว) แนบ `raw/design.png` กับ `public/assets/sprites/player/sword/idle.png` ไปเป็นต้นแบบ
เซฟเป็น `raw/death.png` แล้วตัดเป็น `player/sword/death.png` ด้วยสเกลเดียวกับท่ายืน

```
Use the attached sprite sheets as the EXACT character and style reference: the same young knight with messy spiky
ash-blond hair, golden amber eyes, no helmet; dark gunmetal plate armour with gold trim, white shoulder plates, a small
amber diamond gem on the chest, a long charcoal cape with gold trim, and ONE curved katana with an amber-orange blade
and a round brass guard. Same outfit, same colors, same size and the same fine-detail 16-bit SNES-era chibi pixel
style, each figure as if about 110 pixels tall, dark outline, crisp pixels, no blur. Do NOT draw a different character.
Generate an image: a comical knock-out death animation as ONE single horizontal row of exactly 5 frames, seen in side
profile facing LEFT, left to right: frame 1 struck hard, recoiling, knees buckling; frame 2 flung off his feet, falling
forward face-first, the katana slipping out of his hand; frame 3 slamming into the ground on his side, a small bounce;
frame 4 rolling from his belly onto his right side and starting to curl up; frame 5 the final pose, completely knocked
out: he lies on his RIGHT side in a tight fetal curl with his BACK turned toward the viewer, so we see his back, the
back of his head and the soles of his boots, not his face. His head is at the left end, face hidden, pressed into the
ground and tucked into his arms; both arms are bent with the forearms crossed in front of the face and the fists near
the head; his back is strongly rounded; both knees are bent and pulled up toward the chest, the legs stacked one on top
of the other, the boots at the right end with the soles toward the viewer. He is NOT kneeling, NOT on all fours and NOT
lying flat on his belly: he is curled on his side like a sleeping shrimp, limp and motionless. The katana lies on the ground just in front of him, its
glow almost gone; the charcoal cape drapes over his back. The body keeps the same size as the standing reference in
every frame (if he stood up he would be exactly as tall), and the lowest point of the body rests on the same baseline
in every frame except the airborne one. Every figure fully inside its own equal-width cell with clear empty space
around it, nothing touching or overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no ground, no
crater, no shadows, no dust, no impact lines, no stars, no text, no labels, no numbers, no grid lines. Do not use pink,
magenta or purple on the character.
```

## 10. แก้ 2 เฟรมท้ายของท่าตาย

ครั้งแรก (ก่อนแก้ข้อ 9 ให้ละเอียดขึ้น) เฟรม 1–3 ดี แต่เฟรม 4–5 ออกมาเป็นคุกเข่าก้มหน้าแทนท่านอนตะแคงขดตัว
จึงเจนเฉพาะ 2 เฟรมท้ายใหม่ในแชทเดียวกัน เซฟเป็น `raw/death_end.png` แล้วใช้เฟรม 1–3 จาก `raw/death.png` ต่อด้วย 2 เฟรมนี้

```
Frames 1 to 3 are great, but frames 4 and 5 are wrong: he must not kneel or lie face-down on his belly. Keep this EXACT
character, outfit, colors, size and pixel style. Generate an image: ONE single horizontal row of just 2 frames, side
view with his head toward the LEFT: frame 1 rolling from his belly onto his right side and starting to curl up;
frame 2 the final knocked-out pose: he lies on his RIGHT side in a tight fetal curl with his BACK turned toward the
viewer, so we see his back, the back of his head and the soles of his boots, not his face. His head is at the left
end, face hidden, pressed into the ground and tucked into his arms; both arms are bent with the forearms crossed in
front of the face and the fists near the head; his back is strongly rounded; both knees are bent and pulled up toward
the chest, the legs stacked one on top of the other, the boots at the right end with the soles toward the viewer. He
is NOT kneeling, NOT on all fours and NOT lying flat on his belly: he is curled on his side like a sleeping shrimp,
limp and motionless. The katana lies on the ground just in front of him, its glow gone; the cape is crumpled over his
legs. Same size as in frame 3, the body resting on the same baseline. Both figures fully inside their own cell with
clear empty space around them. Background ONE perfectly flat solid magenta (#FF00FF), no ground, no crater, no
shadows, no dust, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the character.
```

## 11. ท่านอนสุดท้าย แบบมองจากมุมสูง

ข้อ 10 ยังไม่เหมือนมีม เจ้าของจึงเจนฉากเต็มในหลุมด้วย prompt ของตัวเอง (`raw/death_scene.png`) ท่าออกมาถูก
แต่มีพื้นและหลุมติดมาด้วย จึงเจนใหม่ในแชทเดียวกันให้เหลือแค่ตัวละครบนพื้นหลังสีเดียว
แนบภาพมีมต้นฉบับ (ใช้แค่ท่า) กับ `raw/death_scene.png` และ `raw/death.png` ไปด้วย เซฟเป็น `raw/death_end.png`
เกมใช้เฟรม 1–3 จาก `raw/death.png` ต่อด้วย 2 เฟรมนี้ ส่วนหลุมวาดแยกเป็น `death_crater` ใน ground_fx

```
Use the attached pictures like this: the first picture is a POSE REFERENCE ONLY (copy only how the body lies, never
the person, clothes or colors); the knockout scene in the crater is the exact pose and camera angle I want; the sprite
sheet is the EXACT character and style. Keep MY knight exactly as in the sprite sheet and the crater scene: messy spiky
ash-blond hair, dark gunmetal plate armour with gold trim, white shoulder plates, long charcoal cape with gold trim,
dark gloves and boots, one curved katana with a round brass guard. Same fine-detail 16-bit SNES-era chibi pixel style,
crisp pixels, 3 to 4 tones per material, dark outline, no blur.
Generate an image: ONE single horizontal row of exactly 2 frames of the knight ALONE, seen from the same slightly
elevated three-quarter top-down angle as the crater scene, head toward the upper LEFT and boots toward the lower RIGHT:
frame 1 he has just crashed down and is rolling onto his right side, starting to curl up, cape flapping down onto him;
frame 2 the final knocked-out pose, exactly like the crater scene: lying curled up on his RIGHT side with his BACK
toward the viewer, face completely hidden and pressed into his bent arms, fists near the head, back strongly rounded,
knees pulled up to the chest, legs stacked, the soles of both boots clearly visible, the cape crumpled over his back
and legs, limp like a sleeping shrimp. NOT kneeling, NOT on all fours, NOT flat on his belly, NOT facing the viewer.
In both frames the katana lies on its own on the ground just below and to the left of him, its glow faded.
The knight is the same size as in the sprite sheet. Both figures fully inside their own equal-width cell with wide
empty space around them, nothing touching. Background ONE perfectly flat solid magenta (#FF00FF): NO ground, NO
crater, NO cracks, NO stones, NO dust, NO shadow under the body. No text, no labels, no numbers, no grid lines. Do not
use pink, magenta or purple on the character.
```

## 12. ลบพื้นออกจากฉากในหลุม (ใช้แทนข้อ 11)

ให้ ChatGPT แก้ภาพฉากในหลุมที่ท่าถูกแล้ว (`raw/death_scene.png`) แทนการวาดใหม่ ท่าจะได้ไม่เพี้ยน
แนบ `raw/death_scene.png` ภาพเดียว เซฟเป็น `raw/death_end.png` แล้วเกมใช้เฟรม 1–3 จาก `raw/death.png` ต่อด้วยภาพนี้เป็นเฟรมสุดท้าย

```
Edit the attached image. Keep the knight and his katana EXACTLY as they are: the same pose, the same position, the
same size, the same pixels and colors. Do not redraw, move, rotate or restyle them. Remove EVERYTHING else: the
crater, the cracked ground, the stones, the debris and the dark shading on the ground around and under his body.
Replace all of it with ONE perfectly flat solid magenta (#FF00FF) background, so only the knight and the katana remain,
with crisp dark outlines against the magenta. No shadow under the body, no ground, no text. Do not use pink, magenta or
purple on the knight or the katana.
```
