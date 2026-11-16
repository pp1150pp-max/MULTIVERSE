# กระดาษตัดแปะ (papercraft): prompt ทดสอบทั้งเกม และภาพแยกชิ้นนักดาบ

เจ้าของเลือกลองสไตล์ 5 กระดาษตัดแปะ เมื่อ 2026-11-16 (ดูภาพเทียบ 14 แบบใน `art_templates/style_test/`)
ไฟล์นี้มี 2 ส่วน:
- **ส่วน A:** ทดสอบว่าสไตล์นี้ไปต่อได้ทั้งเกมไหม ทั้งตัวละคร มอน และแมพ
- **ส่วน B:** ภาพแยกชิ้นนักดาบ สำหรับระบบกระดูกที่พักไว้ (2 มุม 14 ชิ้น อาวุธ 3 แบบ เกราะ 2 แบบ)

## วิธีเจน

- **เจนทุก prompt ในแชทเดียวกัน** ตามลำดับเลข สไตล์จะได้ตรงกัน ถ้าแชทยาวจนสไตล์เริ่มเพี้ยน ให้เริ่มแชทใหม่แล้วแนบภาพที่ชอบที่สุด 2–3 ภาพไปเป็นตัวอย่าง
- **ข้อแรกแนบ `art_templates/style_test/raw/style_5_papercraft.png`** เป็นต้นแบบสไตล์
- เซฟทุกภาพไว้ที่ `art_templates/papercraft/raw/` ตามชื่อไฟล์ในแต่ละข้อ (ภาพใน `raw/` ไม่ commit)
- พื้นหลังสำหรับตัด: ม่วงแดง #FF00FF ยกเว้นภาพที่มีเมจ (ชุดม่วง) ใช้เขียว #00FF00

---

# ส่วน A: ทดสอบทั้งเกม

## A1. ตัวละคร 3 คลาส 5 มุม → `raw/A1_heroes.png`

แนบ `style_5_papercraft.png`

```
The attached image shows the papercraft art style of my game. Use EXACTLY this style for everything in this chat:
a handmade papercraft diorama look, layered cut colored paper and card, visible paper fibre texture, slightly
uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined
at the joints like paper puppets, warm soft lighting.
Generate an image: a character turnaround sheet of the three heroes of the game, as 3 rows, one hero per row,
each row showing the SAME hero standing in exactly 5 views from left to right: (1) front facing the viewer,
(2) three-quarter front turned toward the LEFT, (3) side profile facing LEFT, (4) three-quarter back turned toward
the LEFT, (5) back view. Row 1: a young knight with spiky ash-blond hair, dark gunmetal armour with gold trim, a
long charcoal cape, holding a glowing amber sword low at his side. Row 2: a witch girl with long silver-lavender
hair, purple pointed hat and robe with gold trim, holding a gold staff topped with a glowing blue orb. Row 3: a
gunslinger with spiky white hair, brass goggles on the forehead, a long red scarf, a long black coat, holding a
brass steampunk pistol. Slightly chibi proportions about 3.5 heads tall. Identical size and height in every view,
feet on the same baseline in each row, generous empty space, nothing overlapping. Background ONE perfectly flat
solid pure bright green (#00FF00), no shadows on the background, no ground, no text, no labels, no grid lines.
Do not use bright green on the characters.
```

## A2. มอนป่ามรกตและหนองน้ำหมอก → `raw/A2_monsters_forest_marsh.png`

```
Same papercraft style. Generate an image: a monster sheet, 2 rows of 6 monsters, every monster standing in a
three-quarter front view turned toward the LEFT, each with generous empty space around it, nothing overlapping.
Row 1 (emerald forest): a round bouncy green slime, a small wild rabbit, an orange forest fox, a brown wild boar
with tusks, a grey forest wolf, and a big brown forest bear (mini boss, drawn bigger).
Row 2 (misty marsh): a fat bog toad, a slimy marsh leech, a coiled swamp serpent, a mire ghoul made of mud, a
floating will-o'-wisp flame, and the Bog Witch boss (an old swamp witch with a crooked staff, drawn bigger).
Background ONE perfectly flat solid magenta (#FF00FF), no ground, no text, no labels, no grid lines. Do not use
pink, magenta or purple on the monsters.
```

## A3. มอนดินแดนหิมะและเกาะภูเขาไฟ → `raw/A3_monsters_snow_volcano.png`

```
Same papercraft style. Generate an image: a monster sheet, 2 rows, every monster standing in a three-quarter front
view turned toward the LEFT, each with generous empty space around it, nothing overlapping.
Row 1 (frost reach): a round frost penguin, a tusk seal with long walrus tusks, a white snow owl, a small floating
snow sprite made of ice crystals, a yeti minion, and the Yeti boss (huge white furry yeti, drawn bigger).
Row 2 (ashen isle): a tiny floating ember wisp, a red salamander, a lava bat with glowing wings, a magma golem of
dark rock with glowing cracks, an ash mage in a grey hooded robe, an ash knight in burnt black armour, and the
Volcano Heart boss (a giant glowing molten heart of rock and fire, drawn bigger).
Background ONE perfectly flat solid magenta (#FF00FF), no ground, no text, no labels, no grid lines. Do not use
pink, magenta or purple on the monsters.
```

## A4–A7. ฉากแมพ (ภาพจับหน้าจอ)

ใช้ prompt เดียวกัน เปลี่ยนแค่บรรทัด `Scene:` ตามตารางข้างล่าง

```
Same papercraft style. Generate an image: a gameplay screenshot of a 2D isometric online action RPG, fixed
isometric camera looking down at about 45 degrees, landscape 16:9. The three heroes from the turnaround sheet are
small on screen, as in a real game (about one eighth of the image height), each standing on the ground with a
small shadow. No UI, no health bars, no text, no watermark.
Scene: <วางบรรทัด Scene จากตารางข้างล่าง>
```

| ไฟล์ | Scene |
|---|---|
| `raw/A4_marsh.png` | `a misty marsh: dark green water pools, reeds, twisted dead trees, lily pads, wooden boardwalks, drifting fog made of thin tissue paper, the heroes fighting bog toads and a swamp serpent.` |
| `raw/A5_snow.png` | `a snowy frost reach: white snow fields, icy blue rocks, pine trees with snow, a frozen pond, falling paper snowflakes, the heroes fighting frost penguins and a tusk seal.` |
| `raw/A6_volcano.png` | `an ashen volcanic island: dark ash ground, black rocks, rivers of glowing orange lava made of layered paper, smoke made of grey tissue paper, the heroes fighting a magma golem and lava bats.` |
| `raw/A7_hub.png` | `a fantasy central hub city called the Nexus: a stone plaza with a glowing dimensional portal in the middle, market stalls, lanterns, a fountain, townsfolk NPCs, and the three heroes standing in the plaza.` |

---

# ส่วน B: ภาพแยกชิ้นนักดาบ (ระบบกระดูก)

ชิ้นส่วน 14 ชิ้น: หัว ลำตัว สะโพก แขนบน×2 แขนล่าง×2 มือ×2 ขาบน×2 ขาล่างรวมเท้า×2 และอาวุธ
มี 2 มุม: หน้าเฉียงไปทางซ้าย และหลังเฉียงไปทางซ้าย (เกมกลับภาพให้เองเป็นด้านขวา)
ทุกชิ้นวาดเต็ม รวมส่วนที่ปกติโดนบัง และปลายข้อต่อทำเป็นวงมนเลยเข้าไปใต้ชิ้นที่ต่อกัน เพื่อให้หมุนแล้วไม่เห็นรู

## B1. ชิ้นส่วนนักดาบ มุมหน้าเฉียง → `raw/B1_sword_parts_front.png`

```
Same papercraft style. I am building a 2D skeletal (cutout) animation of the knight hero, so I need his body as
separate flat paper pieces, like a paper puppet kit laid out on a table, seen from the SAME three-quarter front
view turned toward the LEFT as in view (2) of the turnaround sheet.
Generate an image: a parts sheet with these 14 separate pieces, each piece complete and NOT overlapping any other
piece, with generous empty space between them, laid out in a neat grid:
1 head with hair (complete, including the parts the collar would hide), 2 torso with chest armour and shoulder
plates (cape removed), 3 hips with belt and armour skirt, 4 left upper arm, 5 right upper arm, 6 left forearm,
7 right forearm, 8 left gauntlet hand (open, gripping pose), 9 right gauntlet hand (gripping pose), 10 left thigh,
11 right thigh, 12 left shin with boot, 13 right shin with boot, 14 the glowing amber sword on its own, pointing
straight up.
Every limb piece is drawn straight (not bent), with a rounded end at each joint that extends a little past the
joint so it can tuck under the neighbouring piece when it rotates. Draw every piece fully, even the parts that are
normally hidden behind other parts. Same colors, outline and paper texture as the hero. In the bottom right corner,
add one small complete assembled figure of the knight in the same view as a reference.
Background ONE perfectly flat solid magenta (#FF00FF), no shadows on the background, no text, no numbers, no
labels, no grid lines. Do not use pink, magenta or purple on the pieces.
```

## B2. ชิ้นส่วนนักดาบ มุมหลังเฉียง → `raw/B2_sword_parts_back.png`

```
Perfect. Now the SAME 14 pieces, same sizes and layout, but seen from the three-quarter BACK view turned toward the
LEFT, as in view (4) of the turnaround sheet: the back of the head and hair, the back plate of the torso, the back
of the hips, the arms, hands and legs from behind, and the same sword pointing straight up. Every limb straight
with rounded joint ends, every piece complete and not overlapping, plus one small assembled reference figure in the
bottom right corner. Background ONE perfectly flat solid magenta (#FF00FF), no text, no numbers, no labels.
```

## B3. ผ้าคลุม (แยกจากลำตัว) → `raw/B3_sword_cape.png`

```
Same papercraft style. Generate an image: the knight's long charcoal cape with gold trim and a slightly tattered
hem as separate flat paper pieces: (1) the cape seen from the three-quarter front view turned LEFT (only the part
visible behind the body), (2) the cape seen from the three-quarter back view turned LEFT (the full cape), each cut
into 3 stacked strips from shoulder to hem so it can sway. Every strip complete, not overlapping, generous space.
Background ONE perfectly flat solid magenta (#FF00FF), no text, no labels.
```

## B4. อาวุธ 3 แบบ → `raw/B4_swords.png`

```
Same papercraft style. Generate an image: 3 swords for the knight laid side by side, each pointing straight up,
same scale, the grip of each the same size so the same paper hand can hold any of them: (1) the original glowing
amber katana with a round brass guard, (2) a huge heavy two-handed greatsword of dark steel with gold trim, (3) a
fire sword with a red-orange blade and paper flames along the edge. Generous empty space, nothing overlapping.
Background ONE perfectly flat solid magenta (#FF00FF), no text, no labels.
```

## B5. ชุดเกราะแบบที่ 2 (ชิ้นที่เปลี่ยน) → `raw/B5_armor2_front.png` และ `raw/B5_armor2_back.png`

เจน 2 ครั้ง ครั้งแรกมุมหน้าเฉียง (B1) ครั้งที่สองมุมหลังเฉียง (B2)

```
Same papercraft style. Make a second armour set for the knight: light silver-and-blue plate armour with white
cloth and small blue gem accents, a more elegant paladin look. Generate an image: ONLY the armour pieces that
change, in exactly the same shapes, sizes, view and layout as the parts sheet just made: torso, hips, left and
right upper arm, left and right forearm, left and right gauntlet hand, left and right thigh, left and right shin
with boot (12 pieces). The head and sword are NOT included. Every limb straight with rounded joint ends, every
piece complete and not overlapping. Background ONE perfectly flat solid magenta (#FF00FF), no text, no labels.
```
(ครั้งที่สอง พิมพ์ต่อว่า: `Now the same 12 pieces from the three-quarter BACK view, matching the back parts sheet.`)
