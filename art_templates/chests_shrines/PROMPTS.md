# หีบสมบัติ + ศาลเจ้า: prompt สำหรับเจนใน ChatGPT (สไตล์กระดาษตัดแปะ) · รอบ 2

ระบบอยู่ใน [docs/systems/chests-shrines.md](../../docs/systems/chests-shrines.md)

**รอบ 1 (2026-11-27)** ภาพออกมาเป็นการ์ตูน 3D มันวาว เรียบ ๆ ไม่น่าสนใจ (หีบไม้ธรรมดา เสาหินกับลูกบอล) เจ้าของขอ prompt ใหม่
**รอบ 2 เจนแล้วและอยู่ในเกมแล้ว (2026-11-27)** ตัดด้วย `node tools/cut_chests_shrines.cjs` · ถ้าไม่มีไฟล์ภาพ เกมใช้รูปทรงที่วาดด้วยโค้ด

รอบนี้เปลี่ยนอะไร:
- **ย้ำเรื่องกระดาษ** กระดาษด้าน เห็นเส้นใย เห็นชั้นกระดาษซ้อนกันและเงาเล็ก ๆ ระหว่างชั้น ห้ามเป็นภาพ 3D มันวาวหรือพลาสติก
- **ให้แต่ละชิ้นมีเรื่องราว** หีบเป็นหีบโบราณของนักผจญภัยที่มีเวทมนตร์ ศาลแต่ละองค์มีรูปทรงของตัวเองตามพรที่ให้ (ไม่ใช่เสาเดียวกันเปลี่ยนสี)
- **แสงเรืองทำจากกระดาษโปร่งแสงซ้อนชั้น** ไม่ใช่แสงฟุ้งแบบภาพเรนเดอร์ เพื่อให้ตัดพื้นหลังได้สะอาด

## วิธีเจน

- **เปิดแชทใหม่** แล้วแนบภาพต้นแบบสไตล์ 3 ภาพไปกับข้อความแรก จากโฟลเดอร์ `art_templates/papercraft_maps/raw/ref/`:
  - `A4_marsh.png` ดูธรรมชาติและมุมกล้อง
  - `A7_hub.png` ดูหินและไม้
  - `A1_heroes.png` ดูขนาดตัวละคร
- เจนข้อ 1 ถึง 3 ในแชทเดียวกัน ตามลำดับ
- ถ้าภาพยังออกมามันวาวแบบ 3D ให้ตอบกลับในแชทว่า `Too glossy and 3D. Redo it as matte layered cut paper and card, flat paper layers stacked with small gaps and drop shadows, visible paper fibre, scissor-cut edges, like a handmade paper diorama.`
- เซฟไฟล์ดิบไว้ที่ `art_templates/chests_shrines/raw/` โดยใช้ชื่อไฟล์เดิม เขียนทับไฟล์รอบ 1 ได้เลย (โฟลเดอร์นี้ไม่ commit)
- เจนเสร็จแล้วบอก Claude ให้รัน `node tools/cut_chests_shrines.cjs` แล้วอัปเดต PR · ลำดับช่องต้องตรงตามที่เขียนไว้ เครื่องมือตัดจะได้ใช้ได้ทันที

## 0. ภาพแรกของแชท (ข้อความนำ แนบภาพต้นแบบ 3 ภาพไปด้วย)

```
The attached images show the papercraft art style and the camera of my game. Use EXACTLY this style for everything in this chat: a handmade papercraft diorama, built from layered cut coloured paper and thin card, MATTE paper with visible fibre texture, slightly uneven scissor-cut edges, flat paper layers stacked with small gaps and small soft drop shadows between them, warm soft light from the upper left. It must NEVER look like a 3D render, plastic, clay or glossy cartoon: no shiny highlights, no smooth gradients, no bevelled plastic edges. Glows and magic are made of layered translucent vellum paper and cut-paper rays and sparkles, not blurry light. Just reply "OK" to this message.
```

## 1. หีบและศาลบนแมพ → `raw/treasure_props.png` (3×2)

```
Generate an image: a prop sheet for my papercraft game, exactly 6 separate objects in a 3 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. SAME camera as the reference screenshots: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint. Every object is matte layered cut paper and card with visible fibre, scissor-cut edges and small drop shadows between the paper layers INSIDE the object, and has a strong, readable silhouette at small size.

Row 1, left: CLOSED ancient adventurer's treasure chest, knee-high to a hero, deep royal-blue painted paper planks with ornate gold-foil paper corner guards and curling filigree, a big gold lock plate shaped like a sun with a small cut-paper ruby in the middle, a few gold paper coins and one small gem resting against its foot, two tiny cut-paper sparkles above the lid.
Row 1, middle: the SAME chest OPEN, lid thrown back, a burst of layered golden vellum light and cut-paper rays fanning up out of it, heaped gold paper coins, a ruby, a sapphire and a pearl string spilling over the front edge, small paper star sparkles in the air.
Row 1, right: SHRINE OF MIGHT, about the height of a hero: a short weathered stone plinth made of grey cut card, two crossed paper swords standing upright behind it, a hanging red cloth paper banner with a gold sword emblem, and floating above it a sharp-cut faceted red crystal wrapped in a ring of layered red vellum flame shapes.
Row 2, left: SHRINE OF WIND, same height: a slim pale stone arch of cut card with small wings carved on both sides, green paper ribbons streaming sideways as if blown, a few cut-paper feathers and leaves swirling round it, floating in the arch a faceted green crystal circled by curling paper wind swirls.
Row 2, middle: SHRINE OF WISDOM, same height: a round stone lectern of cut card holding an open ancient book whose pages fan up into a spiral, small gold paper stars and constellations floating above, a faceted gold crystal hanging over the book with thin cut-paper rays around it.
Row 2, right: SHRINE OF FORTUNE, same height: a small stone ring of three standing stones of cut card, each with a glowing rune in a different colour (red, green, gold), and floating in the middle a faceted prism crystal split into red, green and gold facets, with a slow spiral of tiny paper sparkles of all three colours.

Each object has crisp clean outer edges with no glow or halo spilling onto the background. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `chest_closed` `chest_open` `shrine_atk` / `shrine_speed` `shrine_exp` `shrine_random`

| ช่อง | ใช้ตอนไหน |
|---|---|
| `chest_closed` | หีบที่ยังไม่ถูกเปิด |
| `chest_open` | ระหว่างที่เรากำลังยืนเปิด (1.5 วิ) แล้วหีบหายไปจนเกิดใหม่ |
| `shrine_atk` | ศาลพลังโจมตี +15% |
| `shrine_speed` | ศาลความเร็ว +20% |
| `shrine_exp` | ศาล EXP +30% |
| `shrine_random` | ศาลที่ตั้งเป็น "สุ่ม 1 ใน 3" |

## 2. ไอคอนบัฟศาลเจ้า → `raw/shrine_buff_icons.png` (3×1)

```
Same papercraft style, matte layered paper, not glossy. Generate an image: exactly 3 small buff icons for the HUD of the same game, in a 3 columns x 1 row grid, generous empty space, nothing touching. Each icon is a round badge of stacked paper discs: a dark navy paper base, a thin gold-foil paper rim, and ONE bold symbol of layered cut coloured paper in the middle that still reads at 24 pixels. Left (might): a red faceted crystal with two small crossed swords behind it. Middle (wind): a green faceted crystal with a curling paper wind swirl and one feather. Right (wisdom): a gold faceted crystal over a tiny open book with two small stars. Every badge the same size, the crystals matching the shrines of the previous image. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no shadows on the background, no text, no letters, no numbers, no labels. Do not use pink, magenta or purple on any icon.
```

ลำดับช่อง: `shrine_buff_atk` `shrine_buff_speed` `shrine_buff_exp`

## 3. (ถ้าอยากเลือก) ภาพตัวอย่างในฉาก ไม่ใช้ในเกม

ใช้ดูว่าหีบกับศาลเข้ากับแมพไหมก่อนตัดใส่เกม ไม่ต้องเซฟ

```
Generate an image: a gameplay screenshot of my 2D isometric papercraft action RPG, the SAME camera and style as the reference screenshots, landscape 16:9. Scene: a sunny clearing in Emerald Forest with leafy paper oaks and bushes; in the clearing stand the closed blue-and-gold treasure chest and the Shrine of Might from the previous image, at their real size next to one small hero (about one eighth of the image height) walking toward the chest. No UI, no health bars, no text, no watermark.
```
