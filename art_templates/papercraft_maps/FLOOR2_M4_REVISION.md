# แมพ 4 วังวนกลางทะเล: ภาพเพิ่มรอบแก้ (เจ้าของ 2026-11-26)

เจ้าของสั่งแก้แมพ 4 (`kraken_maelstrom`): เอาคลื่นฟองรอบขอบน้ำวนออก ให้หนวดอยู่ในน้ำวนเลย เสาเรือเยอะไป (ลดเหลือราว 1 ใน 5 แล้วในโค้ด) และ "เจนส่วนต่าง ๆ เพิ่ม"
เจ้าของเลือกเจนเองใน GPT 2 อย่าง: **ก.** หนวดโผล่จากน้ำวน **ข.** ของประดับแทนเสาเรือ
ห้องบอสคราเคนไม่แก้ (เจ้าของเลือก "แมพ 4 อย่างเดียว")

## วิธีเจน

- เหมือน `FLOOR2_M4_MAELSTROM.md`: เปิดแชทใหม่ แนบ `art_templates/papercraft_maps/raw/floor2_maps/M4_kraken_maelstrom.webp` ภาพเดียว แล้วขึ้นต้นภาพแรกด้วยประโยคเปิดของไฟล์นั้น
- **ห้ามแนบภาพพิกเซล** ถ้าได้ภาพพิกเซล พิมพ์ `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_m4/` (หนวดใน `raw/floor2_m4/monsters/`) · ห้าม `git add raw/`
- ส่งไฟล์มาในแชท แล้ว Claude ตัดและใส่เกมให้

---

## ก. หนวดโผล่จากน้ำวน → `raw/floor2_m4/monsters/kraken_tentacle_sea_idle.png`, `kraken_tentacle_sea_slam.png` (**พื้นเขียว**)

หนวดในแมพ 4 ยืนอยู่ในน้ำวนแล้ว (ห่างขอบเข้าไป 0.8 หน่วย) ภาพเดิมตัดโคนเรียบ ไม่มีน้ำ จึงดูเหมือนปักบนพื้น
ภาพใหม่ให้โคนจมน้ำ มีฟองน้ำล้อมรอบ ตั้งชื่อใหม่ `kraken_tentacle_sea` เพราะหนวดของบอสในห้องบอสใช้ภาพเดิมและยืนบนบก (ห้องบอสไม่แก้)

ใช้ข้อความกลางของข้อ 8 ใน `FLOOR2_M4_MAELSTROM.md` แบบพื้นเขียว (5 แถว 5 ทิศ × 4 ช่อง เหมือนเดิม) + บรรทัดท่า + บรรทัดหน้าตาข้างล่าง

บรรทัดท่า (เหมือนเดิม):

| ไฟล์ | บรรทัดท่า |
|---|---|
| `kraken_tentacle_sea_idle.png` | `The move: a 4-frame idle loop, the tentacle swaying slowly from side to side and curling its tip, the base never moving, so frame 4 leads into frame 1. Use this instead of a walk.` |
| `kraken_tentacle_sea_slam.png` | `The move: a 4-frame slam toward the direction it faces: frame 1 rearing up tall and curling back; frame 2 whipping forward; frame 3 lying stretched out long and flat across the water in front of it, the full length of the slam, with a long white splash along it; frame 4 rising back up to its normal pose.` |

บรรทัดหน้าตา (ต่อท้ายทุกภาพ):
```
The monster: a single huge kraken tentacle rising out of dark swirling whirlpool water, deep purple with lighter violet streaks, a row of big round cream suckers along its inner side, curling at the tip, as in the attached map. Its lower part is under the water: at its base a small flat oval patch of deep navy and dark teal paper water seen in the same isometric view, ringed with white and pale turquoise paper foam and a few small splash droplets where the tentacle comes out. The water patch is the same small size in every frame and never wider than twice the tentacle's thickness. Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the monster or the water.
```

## ข. ของประดับแทนเสาเรือ → `raw/floor2_m4/props_sea.png` (4×3 **พื้นเขียว**)

ใส่ในเกมแทนที่ว่างของเสาเรือหักที่เอาออก (ตอนนี้เป็นหินกับปะการังเดิมไปก่อน) ของสูงพอ ๆ กับเสาเรือเดิม ให้แมพไม่โล่ง

ลำดับช่อง (ชื่อชิ้นในเกม): `sea_stack` `sea_barnacle` `sea_kelp` `sea_arch` / `sea_crates` `sea_cannon` `sea_ribs` `sea_buoy` / `sea_driftwood` `sea_coral` `sea_shells` `sea_chain`

```
Now more map props for this Kraken Maelstrom, in EXACTLY the same papercraft style as the attached map: layered cut paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers INSIDE each object. NOT pixel art. SAME camera as the map: 2D isometric 3/4 view from above, light from the upper left, each object's base sits on an imaginary diamond-shaped ground footprint.

Generate an image: a prop sheet with exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping.
Row 1: a tall narrow sea stack of dark wet slate rock, as tall as a ship's mast; a big rock crusted with pale barnacles and a few dark mussels; a tall rock with long dull dark olive kelp hanging down its sides; a small natural rock arch with a glossy wet edge.
Row 2: a pile of three broken wooden cargo crates with rope; an old rusty ship's cannon half sunk into the rocks; the curved white rib bones of a huge whale standing out of the ground; a tilted red and white iron buoy with a small dark bell on top.
Row 3: a long twisted piece of grey driftwood; a rock covered in red and orange coral; a heap of big pale sea shells and one conch; a rock with a heavy rusted iron chain wrapped around it.

Each object has crisp clean outer edges with no glow or halo around it. Background ONE perfectly flat solid pure bright green (#00FF00) everywhere, no gradient, no paper texture on the background, no ground patches, no water, no cast shadows on the background, no text, no letters, no labels, no grid lines. Do not use bright green anywhere on the objects; any seaweed or kelp must be a dull dark olive.
```

## ใส่เกมแล้ว (2026-11-26)

- เจ้าของเจนครบทั้ง 3 ภาพ (ไฟล์ดิบที่ส่งมาชื่อ `props_sea.png` กับ `kraken_tentacle_sea_slam.png` สลับกัน แก้ชื่อคืนแล้ว)
- `props_sea.png` ตัดด้วย `node tools/cut_papercraft.cjs floor2_m4` → `sprites/paper/props/sea_*.png` 12 ชิ้น (ลบสีเขียวที่ค้างในช่องว่างของชิ้นอีกรอบ) · ชิ้นสูงเข้า `mapTrees` (`sea_stack` `sea_kelp` `sea_ribs` `sea_buoy` `sea_arch`) ชิ้นเตี้ยเข้า `mapExtra` ของธีม `kraken` ใน `terrain.ts` (เฉพาะแมพ ห้องบอสใช้ชุดเดิม) · อบแมพใหม่แล้ว · `propCatalog.json` สร้างใหม่ (`tools/build_prop_catalog.ts`)
- หนวด: `node tools/cut_floor2_chars.cjs monsters --only kraken_tentacle_sea` → แผ่น `kraken_tentacle_sea` (moves `idle`, `slam`) · `kraken_tentacle` ในแมพใช้แผ่นนี้ (`PAPER_MONSTER_FILE`) ส่วน `kraken_arm` ในห้องบอสยังใช้ `kraken_tentacle` เดิม
