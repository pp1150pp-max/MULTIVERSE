# พื้นและเอฟเฟกต์สกิล: prompt ที่ใช้สร้างภาพใน ChatGPT

สไตล์ 16-bit SNES ความละเอียดเดียวกับตัวละคร สร้างในแชทเดียวกับ Gunslinger

## ลายพื้น

ไฟล์อยู่ที่ `public/assets/sprites/ground/` ขนาด 1024×1024 ปูซ้ำบนพื้นทุก 10.4 หน่วย
หลังได้ภาพ ให้ย่อเป็น 1088 แล้วผสมขอบ 64px ด้วย dither ให้ซ้ายต่อขวาและบนต่อล่างได้สนิท
`paintMask` (`src/client/world.ts`) เก็บตำแหน่งน้ำแบบขอบชัด ส่วน `paintCover` เก็บถนน ลาน และตลิ่งแบบขอบนุ่ม
shader จะผสมลายตาม noise และความสว่างของลาย หญ้าจึงค่อย ๆ แตกเป็นหย่อมเข้าไปในดิน

ทุกภาพใช้กฎเดียวกัน:

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge. EXACT
same fine-detail 16-bit SNES-era pixel-art style as the props above: small crisp pixels, no blur. Viewed from above with
no perspective. No focal point, no vignette, no borders, left edge matches right edge and top edge matches bottom edge,
no text, no grid lines.
```

พื้นต้องมีรายละเอียดแต่ไม่แย่งความเด่นจากตัวละคร ลายต้องบอกเสมอว่า `rich surface detail but LOW contrast`, ใช้ `4 to 5 close shades only` และ `nothing bright, nothing near black`

| ไฟล์ | เนื้อหาที่ใส่ต่อท้าย |
|---|---|
| `grass` | lush grass with many small overlapping clumps and tufts, each softly shaded, small mossy mottled patches, medium olive-green, no flowers, no stones |
| `dirt` | worn earth trail with small shallow cracks, faint footprint dents, tiny embedded pebbles the same colour as the earth, a few dry grass fibres, olive-tinted tan and warm grey-brown, no orange |
| `pave` | old irregular cobblestone: rounded uneven flagstones of varied sizes, about 12 stones across, soft earth-coloured gaps with tiny bits of moss, muted warm grey-beige, no regular brick grid |
| `marsh` | damp swamp turf with clumps of coarse wet grass and moss cushions, small darker damp hollows, muted dark grey-olive green, no flowers, no stones, no water |
| `mud` | trampled swamp mud trail with shallow boot prints, small cracks, tiny pebbles the same colour as the mud, flecks of moss, olive-tinted grey-brown, no orange, no standing water |
| `water` | dark still swamp water, muted deep blue-green teal, small short horizontal ripple highlights and a few tiny pale glints, no plants, no shore |

## ของตกแต่งบนพื้น

ไฟล์ `public/assets/sprites/props/decor_forest.png` และ `decor_marsh.png` ของชิ้นเล็กไม่มีการชน ช่องละ 128×128 ตารางละ 4×3 วางบนพื้นหลังโปร่งใสโดยชิดด้านล่างกลางช่อง
ตั้งที่เกิดของแต่ละช่องใน `DECOR` (`src/client/world.ts`) เกมรวมทุกชิ้นเป็น mesh เดียว จึงใช้ draw call เดียวต่อแมพ

```
EXACT same fine-detail 16-bit SNES-era pixel-art style as the tree, rock and prop sprites above: 2D isometric view angle,
crisp pixels, soft dark outline. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one small
separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell
borders. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on the ground, no text, no labels, no grid
lines. Do not use pink or magenta in the objects.
```

**`decor_forest`**
1. กอหญ้าเล็ก, กอหญ้าสูง, กลุ่มใบโคลเวอร์, ดอกไม้ป่าสีครีมเหลือง
2. ดอกไม้ป่าสีม่วงอ่อนฟ้าอ่อน, พุ่มใบเตี้ย, เฟิร์นเล็ก, กองหินเทา
3. หินแบนจมดินมีมอส, ขอนไม้ล้มมีมอส, ใบไม้แห้งกับกิ่งไม้, เห็ดเล็กสีน้ำตาล

**`decor_marsh`**
1. กอหญ้าแห้งสีเหลือง, กอกกสูง, เฟิร์นหนองน้ำ, รากไม้บิดโผล่จากดิน
2. กิ่งไม้หักมีมอส, เห็ดสีเทาเขียว, ใบบัว, ใบบัวมีดอกสีครีม
3. แอ่งโคลนตื้น, หินมีมอสจมดิน, กอกกเตี้ย, กิ่งไม้แห้ง

## แผ่นไม้ผุบนทางแมพ 2

ไฟล์ `public/assets/sprites/props/marsh_planks.png` เรียง 3 ชิ้น ช่องละ 256×384 เกมวางราบกับพื้นเป็นช่วง ๆ และหมุนตามทิศทางเดิน (`PLANK_SHEET` และ `addPlanks` ใน `src/client/world.ts`)

```
Same fine-detail 16-bit SNES-era pixel-art style, but viewed STRAIGHT DOWN from above with no perspective. Generate a
SQUARE image: exactly 3 separate pieces side by side in 3 equal columns, each piece standing tall and filling most of its
column's height. Each piece is a short rotted swamp footpath: about 6 to 8 old weathered dark-brown wooden boards, each
board running exactly left-to-right, stacked from top to bottom with small muddy gaps. Very natural and uneven: different
lengths, jagged broken ends, a few crooked, one or two missing or snapped, patches of moss and mud. Muted low-contrast
colours. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no grid lines.
```

## เอฟเฟกต์สกิล

ไฟล์อยู่ที่ `public/assets/sprites/fx/` แผ่นละคลาส แถวละเอฟเฟกต์ แถวละ 6 เฟรม ตั้งค่าการเล่นใน `EFFECTS` และ `SHOT_ART` (`src/client/effects.ts`)
ตัดพื้นหลังสีม่วงแดงออกโดยไม่เปลี่ยนตำแหน่งในแผ่น เกมตัดเฟรมตามช่องเท่า ๆ กัน

ทุกแผ่นขึ้นต้นด้วยกฎเดียวกัน:

```
EXACT same fine-detail 16-bit SNES-era pixel-art style as the game above: crisp pixels, hard-edged color bands, no blur,
no soft gradients, no glow haze. Only the effects, no characters and no weapons. Generate an image: an animation sheet as
a strict grid of exactly R rows x 6 columns, every cell the same size, each effect fully inside its own cell with empty
space around it, nothing touching or crossing cell borders. Each row is one effect playing from left to right over 6
frames: appears, grows, peak, fades, breaks up, almost gone. Background ONE perfectly flat solid magenta (#FF00FF), no
shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple in the effects.
```

**`sword.png` (4 แถว)**
1. SLASH มองจากด้านบน แบนกับพื้น: รอยฟันเสี้ยวจันทร์สีทองขาว ส่วนโค้งชี้ไปทางขวา
2. WHIRLWIND มองจากด้านบน: วงพายุคมดาบสีทองขาวหมุนรอบจุดกลางที่ว่าง
3. CHARGE มองจากด้านข้าง: ลมพุ่งสีทองอ่อนพร้อมเส้นความเร็ว พุ่งไปทางขวา
4. EARTHQUAKE มองจากด้านบน: รอยแตกสีน้ำตาลกับแสงส้มแผ่จากกลาง พร้อมเศษหินกระเด็น

**`mage.png` (5 แถว)**
1. ARCANE BOLT วนซ้ำ มองจากด้านข้าง พุ่งไปทางขวา: ลูกแก้วสีฟ้าขาวมีหางระยิบระยับ
2. FIREBALL วนซ้ำ มองจากด้านข้าง พุ่งไปทางขวา: เปลวไฟส้มเหลืองมีหางไฟ
3. EXPLOSION มองจากด้านข้าง: ระเบิดไฟส้มเหลืองแล้วกลายเป็นควัน
4. FROST NOVA มองจากด้านบน แบนกับพื้น: วงผลึกน้ำแข็งฟ้าอ่อนแตกออกจากจุดกลางที่ว่าง
5. METEOR IMPACT มองจากด้านบน แบนกับพื้น: หลุมระเบิดไฟส้มพร้อมก้อนหินไหม้

**`gun.png` (4 แถว)**
1. MUZZLE FLASH มองจากด้านข้าง ยิงไปทางขวา: แสงรูปดาวสีเหลืองขาวแตกเป็นประกาย
2. BULLET วนซ้ำ มองจากด้านข้าง พุ่งไปทางขวา: กระสุนทองเล็กมีเส้นความร้อนเหลือง
3. PIERCING ROUND วนซ้ำ มองจากด้านข้าง พุ่งไปทางขวา: พลังงานแหลมยาวสีฟ้าขาวมีหาง
4. BULLET IMPACT มองจากด้านข้าง: ฝุ่นสีแทน ประกายไฟเหลือง และเศษกระเด็นจากพื้น

**`gun_ult.png` (3 แถว) — อัลติ Headshot ของ Gunslinger**

ใช้กฎด้านบนกับ R = 3 แล้วต่อท้ายด้วยข้อความนี้ ถ้าเริ่มแชทใหม่ ให้แนบ `gun.png` เป็นตัวอย่าง:

```
Row 1, SNIPER RETICLE, seen from directly above and lying flat on the ground: a bold red crosshair (a ring with four
inward ticks and a center dot) locking on; frame 1 a large faint thin ring, then each frame the ring shrinks and gets
brighter and thicker, frame 5 small and bright red-white with the four ticks touching the ring, frame 6 the same locked
reticle with a short white flash at the center. Row 2, HEADSHOT ROUND, looping, seen from the side and flying to the
RIGHT: a large heavy crimson-and-gold bullet, about twice the size of a normal pistol bullet, with a long sharp red-white
streak trailing behind it and a few hot sparks. Row 3, HEADSHOT IMPACT, seen from the side: a big sharp crimson-and-white
starburst with long pointed spikes, a thin white shock ring around it, and red-gold sparks and small fragments flying
out, then breaking up into embers.
```

เซฟภาพที่ได้ไว้ที่ `art_templates/ground_fx/raw/gun_ult.png` จะตัดเป็น `public/assets/sprites/fx/gun_ult.png`

**`enhance.png` (3 แถว): ตีบวกที่ช่างตีเหล็ก**

แถว 1 เล่นในหน้าต่างช่างตอนกดตี ส่วนแถว 2 และ 3 เล่นเหนือหัวตัวละครให้คนรอบ ๆ เห็น
ประโยคแรกของกฎด้านบนห้ามมีอาวุธ แต่แผ่นนี้ต้องมีค้อน จึงใช้กฎชุดเดียวกันที่แก้ข้อนี้แล้วด้านล่าง ถ้าเริ่มแชทใหม่ ให้แนบ `sword.png` เป็นตัวอย่าง

```
EXACT same fine-detail 16-bit SNES-era pixel-art style as the game above: crisp pixels, hard-edged color bands, no blur,
no soft gradients, no glow haze. No characters. Generate an image: an animation sheet as a strict grid of exactly 3 rows
x 6 columns, every cell the same size, each effect fully inside its own cell with empty space around it, nothing touching
or crossing cell borders. Each row plays from left to right over 6 frames. Background ONE perfectly flat solid magenta
(#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple in
the effects.
Row 1, BLACKSMITH HAMMER STRIKE, seen from the side: a heavy dark-iron blacksmith hammer with a worn brown wooden handle
and tarnished bronze bands; frame 1 the hammer raised high and tilted back, frame 2 swinging down with short motion
lines, frame 3 the moment of impact at the bottom of the cell with a bright white-yellow star flash and orange sparks
bursting out sideways, frame 4 the hammer bouncing up slightly with sparks flying, frame 5 small embers falling, frame 6
the hammer back at rest with two or three fading embers. The hammer stays the same size and design in every frame.
Row 2, ENHANCE SUCCESS, seen from the front, grand and triumphant: frame 1 a small bright golden spark at the center,
frame 2 a golden starburst with long sharp rays and a thin white shock ring, frame 3 the peak: a big radiant golden
burst with a short vertical pillar of golden light, small four-point stars and gold sparks shooting upward and outward,
frame 4 the ring widening and the rays thinning while golden sparks rise, frame 5 scattered rising gold sparkles and
small stars, frame 6 a few tiny fading gold twinkles.
Row 3, ENHANCE FAIL, seen from the front: frame 1 a dull orange spark at the center, frame 2 a short grey-orange puff
cracking apart, frame 3 a dark grey smoke cloud with a few broken dull-red sparks and small dark metal shards falling,
frame 4 the smoke spreading and drifting down, frame 5 thin grey wisps and two falling shards, frame 6 almost gone.
```

เซฟภาพที่ได้ไว้ที่ `art_templates/ground_fx/raw/enhance.png` จะตัดเป็น `public/assets/sprites/fx/enhance.png`

## เลขดาเมจ

ไฟล์ `public/assets/sprites/icons/digits.png` เรียง 4 แถว (ปกติ คริติคอล โดนตี ฟื้นเลือด) แถวละ 13 ตัว ช่องละ 58×64 และ `crit_burst.png` เป็นแสงหลังเลขคริติคอล
ตั้งค่าใน `GLYPH_ROW`, `GLYPH_WIDTH` (`src/client/floating.ts`) ถ้าวาดใหม่ต้องอัปเดตความกว้างของแต่ละตัวด้วย

```
A damage number font sheet in the EXACT same 16-bit SNES-era pixel-art style as the game art above: chunky bold rounded
arcade digits, crisp pixels, a thick solid dark outline, hard-edged colour bands with a bright top and a darker bottom, no
blur. Exactly 4 rows, each with these 13 characters in order: 0 1 2 3 4 5 6 7 8 9 + - ! with clear empty space between
them. Row 1 cream white, row 2 bright gold fading to orange, row 3 bright red, row 4 bright fresh green. Identical shapes
in all rows. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no labels, no grid lines.
```

## หลุมใต้ศพ

ไฟล์ `public/assets/sprites/fx/death_crater.png` เกมวางราบกับพื้นใต้ตัวละครที่ตาย และค้างไว้จนเกิดใหม่ ใช้ร่วมกันทุกคลาส
เจนในแชทเดียวกับท่าตายของอัศวิน ต่อจากภาพฉากในหลุม (`art_templates/sword/raw/death_scene.png`) เซฟภาพดิบเป็น `art_templates/ground_fx/raw/death_crater.png`
มองตรงลงมาจากด้านบน เพราะเกมวางภาพราบกับพื้นแล้วกล้องเอียงให้เอง

```
Now draw ONLY the crater from that knockout scene, empty, in the EXACT same fine-detail 16-bit SNES-era pixel-art
style and the same colors: crisp pixels, hard-edged colour bands, dark brown shading, no blur. Viewed STRAIGHT DOWN from
directly above with no perspective, so it is a round shape, not an oval. Generate a SQUARE image: one single shallow
round impact crater, centred, filling about 85 percent of the image: a slightly sunken bowl of dry cracked
orange-brown earth with cracks radiating outward from the centre, a jagged broken rim with small fractured rock layers
lit on the upper-left and shaded on the lower-right, a few small stones and chunks of debris around it. The outer edge
breaks up into small ragged cracks and chunks, not a hard circle. NOTHING inside the crater: no character, no sword.
Background ONE perfectly flat solid magenta (#FF00FF) outside the crater, no shadows, no text, no labels, no grid lines.
Do not use pink or magenta in the crater.
```
