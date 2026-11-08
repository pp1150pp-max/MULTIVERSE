# Mage: prompt ที่ใช้สร้างภาพใน ChatGPT

สไตล์ 16-bit SNES ระดับความละเอียดเดียวกับ Gunslinger ดีไซน์อ้างอิงช่อง "16-bit (SNES Style)" ของภาพ Mage Style Variations
สร้างในแชทเดียวกับ Gunslinger เพื่อให้สไตล์ตรงกัน ถ้าเริ่มแชทใหม่ ให้แนบภาพ Gunslinger และแบบตัวละครนี้ไปเป็นตัวอย่างด้วย

ไฟล์อยู่ที่ `public/assets/sprites/player/mage/` ช่องละ 256×256 เรียงแถวเป็น
`down` `down_side` `side` `up_side` `up` ส่วนฝั่งขวาเกมกลับด้านให้เอง จึงหันได้ 8 ทิศ

| ไฟล์ | เฟรม | ที่มา |
|---|---|---|
| `idle.png` | 4 | ภาพแบบตัวละคร บีบและยืดเล็กน้อยให้ดูเหมือนหายใจ |
| `run.png` | 4 | prompt ข้อ 2 |
| `attack.png` | 3 | prompt ข้อ 3 |
| `run_attack.png` | 4 | prompt ข้อ 4 ใช้แทนท่าวิ่งตอนร่ายเวทระหว่างเดิน |

พื้นหลังใช้สีเขียว #00FF00 แทน #FF00FF เพราะชุดสีม่วงจะถูกตัดออกไปพร้อมพื้นหลังสีม่วงแดง
หลังได้ภาพ ให้ตัดพื้นหลังออก แล้วจัดให้ทุกเฟรมเท้าอยู่สูงจากขอบล่าง 16px หัวอยู่กลางช่อง
ความสูงรวมหมวกประมาณ 230px เพราะหมวกสูงกว่าหัว ตัวละครจึงดูขนาดเท่า Gunslinger

ยังไม่มีท่า `dash` `hit` `death` `revive` `attack_2` `attack_3` และ `skill_q/e/r`
เกมจะใช้ท่าที่มีแทน และตอนตายจะทำตัวละครให้จางลง

## 1. แบบตัวละคร

```
Redraw her so she looks like she comes from the SAME game and the same artist as the gunslinger made earlier in this
chat: the same polished 16-bit SNES-era JRPG sprite rendering with finer detail, each figure as if about 110 pixels
tall, the same chibi head and face construction with big expressive eyes, the same dark outline weight, the same rich
shading with 3 to 4 tones per material, the same small crisp pixels and the same ornate gold metal rendering. Do NOT
use large chunky pixels. Design: young witch mage girl with long mostly straight pale silver hair with a soft lavender
tint falling past the waist, not curly and not puffy. Deep purple pointed witch hat with wide brim, bent tip, gold band
and a few gold stars. Outfit mainly deep purple: robe and short cape with gold trim and buckles, gold chest clasp with
a small blue gem, only a small touch of cream at the collar and hem, brown leather boots. A tall gold staff in her
right hand, topped by a large gold ring holding one big glowing blue orb. Generate an image: one single horizontal row
of the SAME character standing in exactly 5 views, from left to right: (1) front facing the viewer, (2) three-quarter
front turned toward the LEFT, (3) side profile facing LEFT, (4) three-quarter back turned toward the LEFT, (5) back
view. Identical size, colors and height in every view, boots on the same baseline, generous empty space, nothing
overlapping. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no
labels, no grid lines. Do not use bright green on the character.
```

## 2. ท่าวิ่ง

```
Keep this EXACT character, outfit, colors, size and the same fine-detail pixel style matching the gunslinger, no chunky
pixels. Generate an image: a running animation sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures total.
Each row is one facing direction, top to bottom: row 1 front facing the viewer, row 2 three-quarter front turned toward
the LEFT, row 3 side profile running toward the LEFT, row 4 three-quarter back turned toward the LEFT, row 5 back view.
Each column is one frame of a smooth 4-frame run cycle with clearly different leg poses, left to right: frame 1 right
foot forward and left foot back, frame 2 legs passing under the body, frame 3 left foot forward and right foot back,
frame 4 legs passing under the body. The robe hem swings so the legs and boots are visibly running, the long hair and
cape trail behind, she carries the staff in the right hand. Head, hat and body keep the same size and height in every
frame. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping.
Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no text, no labels, no numbers,
no grid lines. Do not use bright green on the character.
```

## 3. ท่าร่ายเวท

```
Keep this EXACT character, outfit, colors, size and fine-detail pixel style. Generate an image: a spell-casting
animation sprite sheet as a strict grid of 5 rows x 3 columns, 15 figures total. Each row is one facing direction and
she thrusts the staff forward in that same direction, top to bottom: row 1 front, thrusting the staff toward the viewer
so the big orb is in front of her chest; row 2 three-quarter front turned toward the LEFT, staff pointing down-left;
row 3 side profile, staff thrust straight LEFT with the arm extended; row 4 three-quarter back turned toward the LEFT,
staff pointing up-left; row 5 back view, staff raised forward and up, the orb visible above and beside the hat. Each
column is one frame, left to right: frame 1 raising the staff to aim, orb normal; frame 2 staff fully thrust forward
with a small bright blue-white glow attached around the orb only; frame 3 slight recoil, the staff tipped a little
back, orb normal. No projectiles, no magic circles, no beams, no sparkles away from the orb. Feet stay planted in the
same place, head and hat keep the same size and height in every frame. Every figure fully inside its own cell with
clear empty space around it, nothing touching or overlapping. Background ONE perfectly flat solid pure bright green
(#00FF00), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use bright green on the
character.
```

## 4. ท่าวิ่งไปร่ายไป

```
Keep this EXACT character, outfit, colors, size and fine-detail pixel style. Generate an image: a RUN-AND-CAST animation
sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures total: she is running at full speed while holding the
staff thrust steadily forward in the running direction. Each row is one facing direction, top to bottom: row 1 front,
running toward the viewer, staff thrust toward the viewer with the big orb in front of her chest; row 2 three-quarter
front turned toward the LEFT, staff pointing down-left; row 3 side profile running toward the LEFT, staff thrust
straight LEFT; row 4 three-quarter back turned toward the LEFT, staff pointing up-left; row 5 back view, running away,
staff raised forward and up with the orb visible above and beside the hat. Each column is one frame of a smooth 4-frame
run cycle with clearly different leg poses, left to right: frame 1 right foot forward and left foot back, frame 2 legs
passing under the body, frame 3 left foot forward and right foot back, frame 4 legs passing under the body. The legs
must really run in every row, robe hem swings, long hair and cape trail behind, the staff arm stays steady in all 4
frames. The orb stays normal with no extra glow; no projectiles, no sparkles, no motion lines. Head and hat keep the
same size and height in every frame. Every figure fully inside its own cell with clear empty space around it, nothing
touching or overlapping. Background ONE perfectly flat solid pure bright green (#00FF00), no shadows, no ground, no
text, no labels, no numbers, no grid lines. Do not use bright green on the character.
```

## 5. ท่าตาย

ท่าตายแบบมีม "นอนคุดคู้หน้าคว่ำ" ใช้ท่าเดียวกันทุกคลาส แถวเดียว 5 เฟรม มุมข้างหันซ้าย (เกมกลับภาพให้ตอนหันขวา)
เกมเล่นครั้งเดียวแล้วค้างเฟรมสุดท้ายไว้จนกดฟื้นคืนชีพ และวาดหลุมใต้ตัวเอง (`death_crater` ใน [ground_fx](../ground_fx/PROMPTS.md))

ทำ 3 ภาพในแชทใหม่แชทเดียวกัน (แบบเดียวกับอัศวิน ข้อ 9 และ 12 ใน [sword](../sword/PROMPTS.md)):
1. prompt ด้านล่าง แนบ `public/assets/sprites/player/mage/idle.png` กับ `run.png` เซฟเป็น `raw/death.png` (เกมใช้เฟรม 1–3)
2. prompt ข้อ 5.1 ฉากนอนในหลุม แนบภาพมีมต้นฉบับ (ใช้แค่ท่า) เซฟเป็น `raw/death_scene.png`
3. prompt ข้อ 5.2 ลบพื้นออกจากฉากนั้น เซฟเป็น `raw/death_end.png` (เฟรมสุดท้าย)

แล้วตัดด้วย `tools/cut_death.cjs` (ดูวิธีใช้ในไฟล์) ให้ขนาดตัวเท่าท่ายืน

```
Use the attached sprite sheets as the EXACT character and style reference: the same young witch girl with long
straight pale silver-lavender hair, a deep purple pointed witch hat with a gold band and gold stars, a deep purple robe
and short cape with gold trim, brown boots, and a tall gold staff topped by a gold ring holding a big blue orb. Same
outfit, same colors, same size and the same fine-detail 16-bit SNES-era chibi pixel style, each figure as if about 110
pixels tall, dark outline, crisp pixels, no blur. Do NOT draw a different character.
Generate an image: a comical knock-out death animation as ONE single horizontal row of exactly 5 frames, seen in side
profile facing LEFT, left to right: frame 1 struck hard, recoiling, knees buckling; frame 2 flung off her feet, falling
forward face-first, the staff slipping out of her hand; frame 3 slamming into the ground on her side, a small bounce;
frame 4 rolling from her belly onto her right side and starting to curl up; frame 5 the final pose, completely knocked
out: she lies on her RIGHT side in a tight fetal curl with her BACK turned toward the viewer, so we see her back, the
back of her head and hat and the soles of her boots, not her face. Her head is at the left end, face hidden, pressed
into the ground and tucked into her arms; both arms are bent with the forearms crossed in front of the face and the
fists near the head; her back is strongly rounded; both knees are bent and pulled up toward the chest, the legs stacked
one on top of the other, the boots at the right end with the soles toward the viewer. She is NOT kneeling, NOT on all
fours and NOT lying flat on her belly: she is curled on her side like a sleeping shrimp, limp and motionless. The hat stays on her head but is knocked crooked; the staff
lies on the ground just in front of her, the blue orb dull and unlit; her long hair spills over the ground. The body
keeps the same size as the standing reference in every frame (if she stood up she would be exactly as tall), and the
lowest point of the body rests on the same baseline in every frame except the airborne one. Every figure fully inside
its own equal-width cell with clear empty space around it, nothing touching or overlapping. Background ONE perfectly
flat solid pure bright green (#00FF00), no ground, no crater, no shadows, no dust, no impact lines, no stars, no text,
no labels, no numbers, no grid lines. Do not use bright green on the character.
```

### 5.1 ฉากนอนในหลุม

```
Generate a SQUARE image in the EXACT same fine-detail 16-bit SNES-era JRPG pixel-art style as the sprites above: crisp
pixels, rich shading with 3 to 4 tones per material, dark outlines, no blur, no painterly rendering. The attached
picture is a POSE REFERENCE ONLY: copy only how the body lies, never the person, clothes or colors.
CHARACTER, exactly as in the sprites above: the same young witch girl with long straight pale silver-lavender hair, a deep purple pointed witch hat with a gold band and gold stars, a deep purple robe and short cape with gold trim, brown boots, and a tall gold staff topped by a gold ring holding a big blue orb. Do not redesign her outfit, colors, proportions or
equipment.
SCENE AND POSE: a comical knockout aftermath. She has been slammed into the ground and lies curled up on her
RIGHT SIDE inside a large shallow impact crater in dry, cracked orange-brown earth. Her head is toward the upper
LEFT and her BACK is turned toward the viewer. Her face is completely hidden, pressed down into her bent
arms, both arms folded close to the head with the fists near the face. Her back is strongly rounded, both knees are
pulled tightly toward the chest, the legs stacked, the boots toward the lower RIGHT with their soles clearly visible.
She looks completely unconscious and limp, like a sleeping shrimp: NOT kneeling, NOT on all fours, NOT lying flat on
her belly, NOT facing the viewer. Her witch hat is knocked crooked but still on her head, her long hair spills over the ground, and the staff has fallen onto the ground nearby, the blue orb dull and unlit.
ENVIRONMENT: a large shallow round impact crater with a jagged rim, cracked earth radiating outward, small stones and
debris, warm light from the upper left.
COMPOSITION: one single character seen from a slightly elevated three-quarter top-down angle, in the centre of the
crater, the whole body visible. Humorous JRPG knockout, no blood, no extra characters, no text, no labels.
```

### 5.2 ลบพื้นออก

แนบ `raw/death_scene.png` ภาพเดียว

```
Edit the attached image. Keep the witch and her staff EXACTLY as they are: the same pose, the same position, the same size, the
same pixels and colors. Do not redraw, move, rotate or restyle them. Remove EVERYTHING else: the crater, the cracked
ground, the stones, the debris and the dark shading on the ground around and under the body. Replace all of it with
ONE perfectly flat solid pure bright green (#00FF00) background, so only the witch and her staff remain, with crisp dark outlines against
the background. No shadow under the body, no ground, no text. Do not use bright green on the character.
```
