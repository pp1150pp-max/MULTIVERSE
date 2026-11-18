# NPC กระดาษ 7 ตัว: prompt สำหรับเจนใน ChatGPT

เจ้าของเลือกเมื่อ 2026-11-18: NPC ยืนหายใจ **4 เฟรม** มี **3 มุม** คือหน้า ข้าง และหลัง (เกมกลับภาพด้านข้างให้เอง)
ตัวละ 1 ภาพ เป็นตาราง 3 แถว × 4 เฟรม รวม 7 ภาพ

## วิธีเจน

- **เปิดแชทใหม่** ภาพแรกของแชทแนบ 2 ภาพ: `art_templates/papercraft_maps/raw/ref/A7_hub.png` (เมืองกับชาวเมืองแบบกระดาษ) และ `A1_heroes.png` (ตัวละครกระดาษ)
- **ทุกภาพแนบภาพ NPC ตัวเดิมด้วย** อยู่ใน `art_templates/papercraft_chars/raw/ref/old_npc_<ชื่อ>.png` ใช้เป็นแบบชุดและสี จะได้จำได้ว่าเป็นตัวเดิม
- เซฟไฟล์ดิบไว้ที่ `art_templates/papercraft_chars/raw/npc/<ชื่อ>.png`
- prompt = **ข้อความกลาง** + **บรรทัด NPC ตัวนั้น** จากตาราง
- พื้นหลัง: ตัวที่มีสีเขียวใช้ม่วงแดง ตัวที่มีสีม่วงหรือชมพูใช้เขียว ตามช่อง "พื้นหลัง" ในตาราง

ภาพแรกของแชทให้ขึ้นต้นด้วยประโยคนี้ก่อน: `The first attached image shows my game's papercraft town and townsfolk, the second its papercraft heroes. Use EXACTLY this papercraft style for everything in this chat.`

### ข้อความกลาง

```
Same papercraft style as the attached town and heroes: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, characters built from flat paper pieces joined at the joints like paper puppets, slightly chibi proportions about 3.5 heads tall, warm soft light from the upper left. The last attached image is the OLD pixel-art version of this townsperson: keep the same person, outfit, colours and props, redrawn in papercraft.
Generate an image: a sprite sheet as a strict grid of 3 rows x 4 columns, 12 figures, the SAME person in every cell, identical size, colours and height. Rows top to bottom: row 1 front view facing the viewer; row 2 side profile facing LEFT; row 3 back view. Columns left to right: a gentle 4-frame standing idle loop, breathing: frame 1 relaxed, frame 2 the chest rising and the shoulders lifting a tiny bit, frame 3 top of the breath with cloth and hair swaying slightly, frame 4 settling back, so frame 4 leads into frame 1. Very small movements only, the feet never move, both feet on the same baseline in every cell. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no text, no labels, no numbers, no grid lines, no shadows on the background, no ground.
```

ปิดท้ายด้วยบรรทัดจากตาราง (ช่อง "บรรทัดท้าย")

| ไฟล์ | NPC | พื้นหลัง | บรรทัดท้าย |
|---|---|---|---|
| `seeker.png` | The Seeker | ม่วงแดง | `The person: The Seeker, a mysterious guide in a long cream-white hooded robe with gold trim, the face hidden in the hood's shadow with two small glowing eyes, holding a wooden staff with a hanging glowing lantern, a small satchel at the hip. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `merchant.png` | พ่อค้า | ม่วงแดง | `The person: the travelling merchant, a short round cheerful man with a big brown moustache, a green cap with a feather, a green coat and brown trousers, carrying a huge backpack with a rolled bedroll, pots and pouches. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `blacksmith.png` | ช่างตีเหล็ก | ม่วงแดง | `The person: the blacksmith, a burly man with a thick ginger beard and short hair, rolled-up sleeves, a heavy brown leather apron, thick gloves and boots, holding a smith's hammer low at his side. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `keeper.png` | ผู้ดูแลคลัง | ม่วงแดง | `The person: the warehouse keeper, a kind old man with white hair and small round glasses, a long dark navy coat with gold buttons and trim, holding a big iron ring of keys. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `broker.png` | นายหน้าตลาด | ม่วงแดง | `The person: the market broker, a slim sharp man with slicked-back black hair, a thin moustache and goatee, a long black coat with gold trim, holding an open ledger book and a quill. Background ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the person.` |
| `stylist.png` | ช่างแต่งตัว | เขียว | `The person: the stylist, a cheerful person with fluffy pink hair and happy closed eyes, a flowing purple and pink robe with a gold sash, a length of cloth draped over one arm. Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the person.` |
| `crystal_merchant.png` | พ่อค้าคริสตัล | เขียว | `The person: the crystal merchant, a mysterious person with red hair under a deep navy hood with silver stars, round glasses, a dark navy robe, holding up a glowing blue crystal in one hand. Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the person.` |

---

## สำหรับผม: ใส่เข้าเกม

- ตัดเป็นแผ่น 3 แถว × 4 เฟรม สูงเท่า NPC เดิม ใส่ `sprites/paper/npc/`
- NPC ไม่เดิน ตอนนี้จึงค้างเฟรมแรก ต้องให้ `SpriteActor` เล่นท่ายืนวนเองเมื่อเป็นภาพกระดาษ (ผ่านสวิตช์ภาพกระดาษ)
