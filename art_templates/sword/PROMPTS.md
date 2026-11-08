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
| `skill_e.png` | 2 | prompt ข้อ 8 ท่าตั้งการ์ดของสกิล E ปัดป้อง (ย่อตัว จึงปรับขนาดตามความกว้างผมแทนความสูง) |

เกมเล่นท่าฟัน `attack` → `attack_2` → `attack_3` วนไปเองเมื่อตีต่อเนื่องภายใน 1 วินาที
รอยฟันสีทองมาจาก `fx/sword.png` ที่เกมวาดทับ จึงไม่ต้องวาดรอยฟันในตัวละคร

ภาพดิบเซฟไว้ที่ `art_templates/sword/raw/` (ไม่ได้ commit) แล้วตัดด้วย
`PNGJS=<path ของ pngjs> node tools/cut_sword.cjs` สคริปต์จะตัดพื้นหลัง #FF00FF ออก อุดรูเล็ก ๆ บนผ้าคลุม
ปรับขนาดทีละแถวให้ตัวสูง 200px เท่า Gunslinger (ไม่นับดาบที่ยกขึ้น) และวางเท้าสูงจากขอบล่าง 16px

ไอคอนสกิลปัดป้อง (`icons/skill_parry.png` 128×128) มาจาก prompt ข้อ 7 สคริปต์เดียวกันย่อให้

ยังไม่มีท่า `run_attack` `dash` `hit` `death` `revive` `skill_q` และ `skill_r`
เกมจะใช้ท่าที่มีแทน (ตีระหว่างเดินจะเล่นท่าฟันยืนกับที่) และตอนตายจะทำตัวละครให้จางลง

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

## 7. ไอคอนสกิลปัดป้อง

แนบ `icons/skill_charge.png` ไปเป็นตัวอย่างสไตล์ เซฟเป็น `raw/skill_parry_icon.png`

```
One single RPG skill icon in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the attached skill icon:
crisp pixels, rich shading, no blur. A perfect square icon with a dark painted background in a muted deep blue-grey,
a thin bronze-gold bevelled border, and one big bold clear symbol that reads instantly at very small size: a curved
glowing amber katana held horizontally, blocking, with a bright golden spark burst where an incoming blade strikes it,
and a faint translucent golden shield shape behind the katana. The icon fills the whole image. No text, no letters.
```

## 8. ท่าตั้งการ์ด (สกิล E ปัดป้อง)

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
