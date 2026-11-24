# ของวางชิ้นใหญ่: เจนใหม่ให้คม (ก๊อปวางได้เลย)

เจ้าของสั่งเมื่อ 2026-11-24: ของวางชิ้นใหญ่ขยายบนจอแล้วภาพแตก เพราะไฟล์เดิมเล็ก (สูง 200–256 px) แต่ในเกมวาดสูง 4–9 หน่วย
**ตอนนี้ทำแค่ 3 ชิ้นที่เจ้าของแคปมา: `town_fountain` `magma_crystal_0` `ruin_tower`** (เจ้าของ 2026-11-24) รายการเต็มด้านล่างเก็บไว้เผื่อทำทีหลัง
ให้เจนใหม่**เฉพาะชิ้นใหญ่** หน้าตาเหมือนเดิมทุกอย่าง แค่ละเอียดขึ้น ผมจะตัดเก็บไว้สูง ~512 px (ชิ้นเล็กใช้ไฟล์เดิม)

## วิธีเจน

- **แชทละชิ้น** (หรือแชทเดียวต่อกันก็ได้ ถ้าภาพยังไม่เพี้ยน) แนบภาพเดิมของชิ้นนั้น `public/assets/sprites/paper/props/<ชื่อ>.png`
- ก๊อป prompt ด้านล่างไปวาง แล้วแก้แค่บรรทัดสุดท้าย `Background:` ตามคอลัมน์ "พื้นหลัง" ในตาราง
- ภาพที่ได้ควรเป็นสี่เหลี่ยมจัตุรัส 1024×1024 ขึ้นไป
- เซฟเป็น `art_templates/papercraft_maps/raw/props_hd/<ชื่อ>.png` (ชื่อเดียวกับไฟล์เดิม)
- ทยอยเจนได้ ครบกลุ่มไหนบอกผม ผมจะตัดเข้าเกมทีละกลุ่ม

## Prompt (ใช้ได้ทุกชิ้น)

```
The attached picture is a prop from my papercraft game, but it is small and blurry. Redraw this EXACT same object at high resolution: the same design, shape, proportions, colours, details, viewing angle and lighting, in the same soft 3D papercraft style (layered paper cut-outs, gentle folds and soft shading, clean smooth edges). Do not add, remove or move anything, do not change the camera angle, do not make it more realistic. Only make it sharp and detailed.
ONE single object, centred, filling about 90 percent of the image height, the whole object inside the image with a little empty space around it, nothing cut off. No ground, no shadow on the ground, no other objects, no text, no labels, no frame, no grid lines. Square image, at least 1024 x 1024.
Background: ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the object.
```

ชิ้นที่มีสีม่วง/ชมพู ให้เปลี่ยนบรรทัดสุดท้ายเป็น:

```
Background: ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green on the object.
```

## รายการ (เรียงจากแตกมากไปน้อย)

ตัวเลข "px/หน่วย" = ความสูงไฟล์เดิม ÷ ความสูงที่วางในแมพ ยิ่งน้อยยิ่งแตก (ชิ้นเล็กที่ใช้ไฟล์เดิมได้อยู่ราว 120 ขึ้นไป)

### กลุ่ม 1: เมืองกลาง (เห็นบ่อยสุด)

| ชื่อไฟล์ | คืออะไร | px/หน่วย | พื้นหลัง |
|---|---|---|---|
| `town_fountain` | น้ำพุรูปปั้นกลางเมือง | 28 | magenta |
| `b3_vault` `b3_crystal` `b3_guild` `b3_forge` | อาคารรอบเมือง 4 หลัง | 52 | `b3_crystal` = green, ที่เหลือ magenta |
| `town_wall_a` `town_wall_a_broken` `town_wall_b` `town_wall_b_broken` `town_wall_end` | กำแพงเมือง | 55–69 | magenta |
| `mk_goods_stall` `mk_veg_stall` `mk_auction_booth` | แผงตลาด | 58 | magenta |
| `banner_pole` `lamp_post` | เสาธง เสาไฟ | 64–67 | magenta |
| `portal` | ประตูมิติ | 60 | green |

### กลุ่ม 2: ต้นไม้ (ทุกแมพ)

| ชื่อไฟล์ | คืออะไร | px/หน่วย | พื้นหลัง |
|---|---|---|---|
| `tree_0` `tree_1` `tree_2` | ต้นไม้ป่า | 35–38 | magenta |
| `swamp_tree_0` `swamp_tree_1` `swamp_tree_2` `willow` | ต้นไม้หนองน้ำ | 32 | magenta |
| `snow_pine_0` `snow_pine_1` `snow_pine_2` `frost_tree` | ต้นสนหิมะ | 32 | magenta |
| `charred_tree` `burnt_pillar_0` `burnt_pillar_1` `burnt_pillar_2` | ต้นไม้ไหม้ เสาไหม้ (ภูเขาไฟ) | 32 | magenta |

### กลุ่ม 3: ของใหญ่ในแมพฟาร์ม/ห้องบอส

| ชื่อไฟล์ | คืออะไร | px/หน่วย | พื้นหลัง |
|---|---|---|---|
| `watchtower` | หอสังเกตการณ์ | 58 | magenta |
| `ruin_tower` `ruin_house` `ruin_statue` `ruin_fountain` `ruin_pillar` | ซากปรักหักพัง | (ไฟล์ 256 px) | magenta |
| `summoner_forest` `summoner_marsh` `summoner_snow` `summoner_volcano` | แท่นเรียกบอส | 71 | green |
| `room_forest_tree` `room_marsh_tree` `room_snow_tree` `room_volcano_tree` | ต้นไม้ห้องบอส | 64 | magenta |
| `room_forest_pillar_0` `room_marsh_pillar_0` `room_snow_pillar_0` `room_volcano_pillar_0` | เสาห้องบอส | 80 | magenta |
| `magma_crystal_0` `magma_crystal_1` `ice_crystal_0` `ice_crystal_1` | คริสตัลลาวา/น้ำแข็ง (วางใหญ่ใน /admin) | ไฟล์ 149–202 px | magenta |
| `tent` `mossrock_1` | เต็นท์ หินมอส | 75–81 | magenta |

ถ้าเห็นชิ้นอื่นที่แตกตอนเล่น บอกชื่อหรือส่งภาพมา ผมเพิ่มลงตารางให้

---

## สำหรับผม: ตัดเข้าเกม

- ตัดพื้นหลัง (magenta / green ตามตาราง) ตัดขอบว่าง ย่อให้สูง 512 px (ภาพที่เล็กกว่านั้นไม่ขยาย) เซฟทับ `public/assets/sprites/paper/props/<ชื่อ>.png`
- จุดยืนของภาพ (เท้า) อยู่ที่ขอบล่างเหมือนเดิม: ตัดขอบว่างด้านล่างให้ชิดเหมือนไฟล์เดิม เทียบความกว้าง/สูงกับไฟล์เดิมให้สัดส่วนเท่ากัน ในเกมใช้ความสูงจากแมพ (`h`) ไฟล์ใหญ่ขึ้นไม่ทำให้ของใหญ่ขึ้น
- กำแพงเมืองและอาคาร `b3_*` เทียบตำแหน่งกับภาพเดิมให้ต่อกันพอดี
