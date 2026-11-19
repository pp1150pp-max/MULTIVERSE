# ฉากหลังทะเลเมฆชั้น 2: prompt สำหรับเจนใน ChatGPT

ฉากหลังนอกเกาะของทุกแมพในชั้น 2 ใช้แทนอวกาศของชั้น 1 ที่วาดด้วยโค้ด (`paintSpace`) แผนอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 10 ส่วน "ทั้งชั้น"
เจ้าของเลือก (2026-11-19) ให้**เจนเป็นภาพกระดาษปูซ้ำ** ไม่วาดด้วยโค้ด

มี 2 บรรยากาศตามภาพแมพที่ยืนยันแล้ว:
- **กลางวัน:** ทะเลเมฆสีขาวกับน้ำฟ้า ใช้กับเมืองท่าเรือ แมพ 1 และแมพ 2 (แมพ 2 เป็นตอนเย็น ให้เกมย้อมสีส้มอมชมพูทับด้วยโค้ด)
- **กลางคืนพายุ:** เมฆเทาอมน้ำเงินเข้ม ใช้กับแมพ 3 และแมพ 4

แต่ละบรรยากาศมี 2 อย่าง:
- **ภาพพื้นปูซ้ำ:** ใช้ปูเต็มฉากหลัง
- **ก้อนเมฆแยกชิ้น:** ให้เกมลอยเลื่อนช้า ๆ ทับอีกชั้น จะได้ดูมีความลึก

## วิธีเจน

- **เปิดแชทใหม่** แนบภาพแมพ 2 ภาพ (**ห้ามแนบภาพพิกเซล**):
  - ชุดกลางวัน แนบ `raw/floor2_maps/M0b_harbor_docks.webp` กับ `M1_shipwreck_beach.webp`
  - ชุดกลางคืน แนบ `raw/floor2_maps/M3_ghost_ship_graveyard.webp` กับ `M4_kraken_maelstrom.webp`
- ภาพแรกของแชท ให้ขึ้นต้นด้วยประโยคนี้ก่อน prompt:

```
The attached images are approved maps of my game, floating islands in a sea of clouds. Use EXACTLY the papercraft style of the clouds and water around the islands for everything in this chat: layered cut and torn white and coloured paper with visible paper fibre, slightly uneven torn edges, small soft drop shadows between the paper layers. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, torn edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_sky/` (โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`)

---

## 1. ทะเลเมฆกลางวัน → `sky_day.png`

```
Generate a SQUARE image (1:1): one seamless repeating background texture that fills the whole image edge to edge: a sea of clouds seen from above at the same angle as the attached maps, like the clouds around the floating islands. Soft rolling white and pale lilac-grey paper clouds made of many layered torn paper puffs, with small gaps showing bright sky-blue and turquoise far below. Evenly spread, no single big cloud, no focal point, no island, no birds, no objects, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. Calm and low contrast so the island in front stands out.
```

## 2. ก้อนเมฆลอยกลางวัน → `clouds_day.png` (4×2 พื้นม่วงแดง)

ลำดับช่อง: `cloud_day_0` … `cloud_day_7`

```
Generate an image: exactly 8 separate fluffy clouds in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching. Each cloud is made of layered torn white paper puffs with soft pale lilac-grey shadows underneath, seen from slightly above like the clouds around the attached islands. Different shapes and sizes: two long flat wisps, three medium round puffy clouds, three small puffs. Crisp torn paper edges. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no sky, no cast shadows on the background, no text, no labels, no grid lines. Do not use pink, magenta or purple on the clouds; the shadows must be a cool grey-blue.
```

## 3. ทะเลเมฆกลางคืนพายุ → `sky_storm.png`

ใช้แชทใหม่ แนบภาพแมพ 3 กับแมพ 4

```
Generate a SQUARE image (1:1): one seamless repeating background texture that fills the whole image edge to edge: a dark stormy sea of clouds at night seen from above at the same angle as the attached maps. Heavy rolling paper clouds made of many layered torn paper puffs in deep slate blue, dark blue-grey and muted indigo-grey, with a few small gaps showing dark teal far below and faint cool moonlight on the cloud tops. Evenly spread, no single big cloud, no focal point, no lightning, no moon, no island, no objects, no vignette, no borders, no lighting gradient, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. Calm and low contrast so the island in front stands out.
```

## 4. ก้อนเมฆลอยกลางคืนพายุ → `clouds_storm.png` (4×2 พื้นเขียว)

ใช้พื้นเขียว เพราะเมฆกลางคืนมีโทนเทาอมม่วง
ลำดับช่อง: `cloud_storm_0` … `cloud_storm_7`

```
Generate an image: exactly 8 separate storm clouds in a 4 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching. Each cloud is made of layered torn paper puffs in dark slate blue and blue-grey with lighter cool grey tops lit by moonlight, seen from slightly above like the clouds around the attached islands. Different shapes and sizes: two long flat dark wisps, three medium heavy storm clouds, three small dark puffs. Crisp torn paper edges. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no sky, no lightning, no cast shadows on the background, no text, no labels, no grid lines. Do not use bright green anywhere on the clouds.
```

---

## สำหรับคนใส่เข้าเกม

- `sky_day.png` กับ `sky_storm.png`: ย่อเป็น 1024×1024 ปูซ้ำเป็นฉากหลังแทน `paintSpace` เมื่ออยู่ในแมพชั้น 2
  - ชุดกลางวัน: `harbor_town` `shipwreck_beach` `smugglers_cove`
  - ชุดกลางคืน: `ghost_ship_graveyard` `kraken_maelstrom`
  - `smugglers_cove` ย้อมโทนเย็นด้วยโค้ด
- `clouds_day.png` และ `clouds_storm.png` (พื้นเขียว): ตัดเป็น 8 ชิ้น แล้วสุ่มวาง
  - ลอยเลื่อนช้า ๆ ทับฉากหลัง ให้ดูมีหลายชั้น (parallax)
  - ห้ามบังเกาะ
- แมพ 4 มีฟ้าแลบในภาพแมพ ฟ้าแลบทำด้วยโค้ดหรือเอฟเฟกต์ได้ ไม่อยู่ในไฟล์นี้
- ต่อสายตอน PR #3 (`feature/harbor-town`) ที่เพิ่มแมพชั้น 2 ตัวแรก
