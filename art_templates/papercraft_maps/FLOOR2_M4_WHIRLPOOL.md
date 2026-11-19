# น้ำวนแมพ 4 ชั้น 2: วังวนกลางทะเล (`kraken_maelstrom`)

แยกออกมาจาก `FLOOR2_M4_MAELSTROM.md` ข้อ 2 ตามที่เจ้าของสั่ง (2026-11-19) แผนอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 5.4

## วิธีเจน

- **เปิดแชทใหม่** แล้วแนบ `art_templates/papercraft_maps/raw/floor2_maps/M4_kraken_maelstrom.webp` ภาพเดียว (**ห้ามแนบภาพพิกเซล**)
- เจนทั้ง 5 ภาพต่อกันในแชทนี้ จะได้สีน้ำตรงกันทุกชั้น
- ภาพแรกของแชท ให้ขึ้นต้นด้วยประโยคเปิดนี้ก่อน prompt:

```
The attached image is the approved concept of a map in my game, the Kraken Maelstrom. Use EXACTLY this papercraft style for everything in this chat: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers, cool stormy light from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_m4/` ตามชื่อไฟล์ (โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`)

## ภาพที่ต้องเจน → `whirlpool_ring_1.png` … `whirlpool_ring_3.png`, `whirlpool_core.png`, `whirlpool_rim.png` (4×2 **พื้นเขียว**)

**เจ้าของสั่ง (2026-11-19):**
- น้ำวนอยู่**กลางแมพ** กินพื้นที่ราว**ครึ่งหนึ่งของความกว้างแมพ** คือราว 1/4 ของพื้นที่ทั้งแมพ ผู้เล่นสู้กันรอบ ๆ น้ำวน
- **ผู้เล่นเดินเข้าน้ำวนไม่ได้** มีแค่หนวดคราเคน (`kraken_tentacle`) โผล่อยู่รอบขอบน้ำวน
- น้ำวนต้อง**หมุนเหมือนน้ำวนจริง** จึงแยกเป็นกระดาษ 4 ชั้นซ้อนกัน เกมหมุนแต่ละชั้นด้วยความเร็วต่างกัน วงในหมุนเร็ว วงนอกหมุนช้า ให้ดูเหมือนน้ำถูกดูดลงไปตรงกลาง

ภาพเดี่ยวรอบแรก (`whirlpool.png` วงกลมภาพเดียว) เลิกใช้แล้ว

ทุกชั้นวาดจาก**ด้านบนตรง ๆ** ให้เกมบีบเข้ากับมุมกล้องเอง แต่ละวงเจนเป็นภาพแยกขนาดจัตุรัส ตัววงต้องเต็มภาพพอดีขอบ ช่องกลางวงกับมุมทั้งสี่ใช้พื้นม่วงแดง เกมจะย่อแต่ละวงให้ซ้อนกันเอง
ขอบของทุกวงเป็นรอยฉีกกระดาษไม่เรียบ วงที่อยู่ข้างในจะซ้อนทับขอบวงนอกเล็กน้อย จึงไม่เห็นรอยต่อตอนหมุน

| ชั้น | ไฟล์ | ขนาดในเกม (เทียบความกว้างน้ำวน) | หมุน |
|---|---|---|---|
| นอกสุด | `whirlpool_ring_1.png` | 100% | ช้าสุด |
| กลาง | `whirlpool_ring_2.png` | ราว 75% | ปานกลาง |
| ใน | `whirlpool_ring_3.png` | ราว 50% | เร็ว |
| รูกลาง | `whirlpool_core.png` | ราว 28% | เร็วสุด |

ข้อความกลาง (ใช้ทุกวง) แล้วต่อท้ายด้วยบรรทัดของวงนั้น:
```
Same papercraft style, NOT pixel art. Generate a SQUARE image (1:1): ONE single flat layer of a giant whirlpool, seen STRAIGHT FROM ABOVE, made of layered cut paper with visible fibre and small drop shadows between the paper layers, like the whirlpool in the attached map. The layer is a perfect circle that fills the image edge to edge. Its outer edge is a slightly uneven torn paper edge with a thin soft drop shadow, so it looks like a separate sheet of paper lying on top of another. The spiral bands swirl clockwise and are spread evenly all the way around, so the layer looks right when it is rotated. No tentacles, no objects, no text. The four corners outside the circle are ONE perfectly flat solid magenta (#FF00FF), no shadows on the background. Do not use pink, magenta or purple in the water.
```

| ไฟล์ | บรรทัดต่อท้าย |
|---|---|
| `whirlpool_ring_1.png` | `This is the OUTERMOST ring: a wide ring of bright turquoise water with lots of white curling paper foam and wave crests along its outer edge, the spiral bands only gently curved. The middle of the ring is an EMPTY hole about 70% of the image width, filled with flat solid magenta (#FF00FF), its torn inner edge with turquoise water.` |
| `whirlpool_ring_2.png` | `This is the MIDDLE ring: a ring of turquoise and teal water with tighter spiral bands and a few white foam flecks. The middle of the ring is an EMPTY hole about 65% of the image width, filled with flat solid magenta (#FF00FF), its torn inner edge darker teal.` |
| `whirlpool_ring_3.png` | `This is the INNER ring: a ring of dark teal and deep blue water with tight, strongly curved spiral bands, only a few small foam flecks. The middle of the ring is an EMPTY hole about 55% of the image width, filled with flat solid magenta (#FF00FF), its torn inner edge deep navy.` |
| `whirlpool_core.png` | `This is the CENTRE: a full disc with no hole, deep navy blue water with very tight spiral bands twisting down into a black-blue pit in the middle, as if the water is being sucked down.` |

`whirlpool_rim.png`:
```
Same papercraft style, NOT pixel art, the same isometric camera, light from the upper left. Generate an image: exactly 8 separate pieces of crashing wave foam in a 4 columns x 2 rows grid, generous empty space, each fully inside its own cell, nothing touching. Each piece is a curling turquoise and white paper wave crest with foam and a few flying drops, as along the rim of the whirlpool in the attached map, all about the same size, each a different shape, some curling left and some curling right. Crisp clean edges. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no water surface, no cast shadows, no text, no labels, no grid lines. Do not use bright green anywhere on the waves.
```

---

## สำหรับคนใส่เข้าเกม

- ตัดม่วงแดง (มุมและรูกลาง) ออกจาก `whirlpool_ring_1..3.png` กับ `whirlpool_core.png` แล้วย่อให้ซ้อนกันตามตารางขนาดด้านบน
- เกมหมุนแต่ละชั้นคนละความเร็ว (วงในเร็วกว่า) แล้วบีบตามมุมกล้อง · น้ำวนอยู่กลางแมพ กว้างราวครึ่งแมพ
- พื้นที่น้ำวนเดินเข้าไม่ได้ (`whirlpools` ใน `ZoneDef` ตามแผน) หนวดคราเคนวางรอบขอบ
- `whirlpool_rim.png` (พื้นเขียว) ตัดเป็น `rim_0` … `rim_7` วางรอบขอบน้ำวน
