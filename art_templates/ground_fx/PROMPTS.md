# พื้นและเอฟเฟกต์สกิล: prompt ที่ใช้สร้างภาพใน ChatGPT

สไตล์ 16-bit SNES ความละเอียดเดียวกับตัวละคร สร้างในแชทเดียวกับ Gunslinger

## ลายพื้น

ไฟล์อยู่ที่ `public/assets/sprites/ground/` ขนาด 1024×1024 ปูซ้ำบนพื้น ทุก 10.4 หน่วย (ทางไม้ทุก 5.2 หน่วย)
หลังได้ภาพ ให้ย่อเป็น 1088 แล้วผสมขอบ 64px ด้วย dither ให้ซ้ายต่อขวาและบนต่อล่างได้สนิท
ตำแหน่งถนน บ่อน้ำ และลานเกมวาดเป็นแผนที่ใน `paintMask` (`src/client/world.ts`) แล้วให้ shader เลือกลาย

ทุกภาพใช้กฎเดียวกัน:

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge. EXACT
same fine-detail 16-bit SNES-era pixel-art style and palette as the props above: small crisp pixels, no blur, no
gradients. Viewed straight down with no perspective. Even, uniform brightness and evenly distributed detail, no large
shapes, no focal point, no vignette, no borders. The left edge must match the right edge and the top edge must match the
bottom edge so it tiles with no visible seams. No text, no labels, no grid lines.
```

| ไฟล์ | เนื้อหาที่ใส่ต่อท้าย |
|---|---|
| `grass` | lush green grass made of many small grass blade clusters, a few tiny scattered white and yellow flowers and tiny pebbles |
| `dirt` | packed warm-brown dirt road with small cracks, tiny scattered pebbles and small grey-tan stones, no grass |
| `water` | dark still swamp water, muted deep blue-green teal, small short horizontal ripple highlights and a few tiny pale glints, no plants, no shore |
| `marsh` | damp short muted olive-green moss and grass with small dark soil gaps, a few tiny pale-teal flowers and tiny dark pebbles |
| `mud` | dark wet swamp mud, muted dark brown with small damp highlights, tiny roots and tiny stones, no grass, no water |
| `planks` | old wooden boardwalk: weathered brown planks, each exactly horizontal from left edge to right edge with no end joints, dark gaps, a few nails, knots and a little moss, about 8 planks stacked top to bottom |

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
