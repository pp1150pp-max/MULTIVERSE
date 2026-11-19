# ไอคอนชิ้นเซ็ตชั้น 2 (4 เซ็ต): prompt สำหรับเจนใน ChatGPT

แผนอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 8 เซ็ตละแมพ ดรอปจากมอนกับบอสของแมพนั้น

**เจ้าของตัดสิน (2026-11-19):**
- **เซ็ตนับครบ 9 ช่อง:** อาวุธ, อาวุธรอง, หมวก, สร้อย, เกราะ, ถุงมือ, เข็มขัด, รองเท้า, แหวน
- **หน้าตาแยกตามอาชีพเฉพาะอาวุธ** ชิ้นอื่นใช้ไอคอนเดียวทุกอาชีพ
  - อาวุธรองในเกมเป็นไอเทมคนละชนิดต่ออาชีพอยู่แล้ว (ฝักดาบ / ลูกแก้ว / กล่องกระสุน ใน `items.ts`) จึงต้องมี 3 แบบเหมือนอาวุธ

แต่ละเซ็ตมี 14 ไอคอน คือ อาวุธ 3 + อาวุธรอง 3 + ชิ้นอื่น 7 + ตราเซ็ต 1 (ไว้ใช้กับป้ายโบนัสเซ็ต) รวม 4 เซ็ต 56 ไอคอน

## วิธีเจน

- **เปิดแชทใหม่ต่อเซ็ต** แนบ 2 ภาพ:
  - ภาพแมพของเซ็ตนั้น: `art_templates/papercraft_maps/raw/floor2_maps/M<เลข>_*.webp`
  - ไอคอนกุญแจของแมพนั้นที่เจนแล้ว: `art_templates/papercraft_maps/raw/floor2_m<เลข>/key_*.png` ใช้เป็นแบบสไตล์ไอคอน
  - **ห้ามแนบภาพพิกเซล**
- ภาพแรกของแชท ให้ขึ้นต้นด้วยประโยคนี้ก่อน prompt:

```
The first attached image is a map of my game; the second is an approved item icon from the same game. Use EXACTLY the papercraft style of the icon for everything in this chat: layered cut coloured paper, card and foil with visible paper fibre, slightly uneven scissor-cut edges and small drop shadows between the layers, warm soft light from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
```

- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_icons/raw/floor2/` ตามชื่อไฟล์ของแต่ละเซ็ต (โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`)
- prompt = **ข้อความกลาง** + **บรรทัดของเซ็ตนั้น**

### ข้อความกลาง

```
Generate an image: a sheet of 14 RPG inventory item icons that belong to ONE matching equipment set, in a strict invisible grid of 7 columns x 2 rows, one item centred in each cell, filling most of the cell but nothing touching cell borders, generous empty space between them. All 14 share the same colours, materials and motifs so they clearly read as one set. Big, bold and clear so each reads at very small size. No frame, no icon background, no ground, no shadow. Row 1, left to right: a sword; a magic staff; a pistol; a sword scabbard; a magic orb; an ammunition case; the set's emblem badge. Row 2, left to right: a helmet; a necklace; a body armour; a pair of gloves; a belt; a pair of boots; a ring. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no shadows on the background. Do not use pink, magenta or purple on any item. No text, no letters, no numbers, no labels, no grid lines.
```

ลำดับช่อง (ทุกเซ็ต): `weapon_sword` `weapon_mage` `weapon_gun` `offhand_sword` `offhand_mage` `offhand_gun` `emblem` / `helmet` `necklace` `armor` `gloves` `belt` `boots` `ring`

---

## 1. ชุดชาวหาด (แมพ 1 หาดเรือแตก) → `set_beach.png`

แนบ `M1_shipwreck_beach.webp` กับ `raw/floor2_m1/key_crab_claw.png`

```
The set: the Beachcomber set from the Shipwreck Beach: bleached driftwood, cream and spiral sea shells, red-orange coral, woven rope, sun-faded linen and a little gold, turquoise accents. The items: a cutlass with a driftwood grip and a scallop-shell hand guard; a twisted driftwood staff topped with a spiral conch shell holding a glowing pearl; a flintlock pistol with a coral-red grip and shell inlays; a driftwood scabbard wrapped in rope with small shells; a glowing pearl orb resting in an open clam shell; a woven palm-leaf ammo pouch with a shell button; the set emblem: a round driftwood badge with a golden crab claw on a scallop shell. A wide straw sun hat with a shell band; a necklace of shark teeth and small shells on a cord; a sleeveless linen vest with rope lacing and shell buttons; rope-wrapped fingerless gloves; a rope belt with a big shell buckle; leather sandals decorated with small shells; a ring with a pearl in a coral setting.
```

## 2. ชุดโจรสลัด (แมพ 2 อ่าวลักลอบ) → `set_pirate.png`

แนบ `M2_smugglers_cove.webp` กับ `raw/floor2_m2/key_treasure_compass.png`

```
The set: the Corsair set from the Smugglers' Cove: deep red cloth, black leather, polished steel, brass and gold trim, skull-and-crossed-cutlass motifs. The items: a curved steel cutlass with a gold basket hilt; a dark wooden staff topped with a brass compass rose holding a glowing gold gem; a long flintlock blunderbuss pistol with brass fittings; a black leather scabbard with gold bands; a glowing gold orb set inside a brass compass ring; a brass powder horn on a leather strap; the set emblem: a round gold badge with a white skull over two crossed cutlasses. A black tricorn hat with gold trim and a red feather; a necklace of gold doubloon coins; a long deep red pirate coat with gold buttons; black leather gloves with wide gold-trimmed cuffs; a wide black leather belt with a big gold buckle; tall black leather boots with folded cuffs; a heavy gold ring with a small skull.
```

## 3. ชุดกะลาสีผี (แมพ 3 สุสานเรือผี) → `set_ghost.png`

แนบ `M3_ghost_ship_graveyard.webp` กับ `raw/floor2_m3/key_ghost_bell.png`

```
The set: the Drowned Sailor set from the Ghost Ship Graveyard: tarnished brass, rusty iron, rotten grey wood, tattered grey cloth, barnacles and dull olive seaweed, with a soft glowing pale teal ghost light. The items: a rusty sabre whose blade glows faint teal, barnacles on the hilt; a rotten wooden staff hung with a small brass ship's lantern holding a teal ghost flame; a rusty flintlock pistol trailing a faint teal wisp; a barnacle-crusted scabbard tied with seaweed; a glass bottle orb with a glowing teal wisp trapped inside; a battered brass bell-shaped ammo case; the set emblem: a round tarnished brass badge with a small ship's bell and a teal ghost wisp. A tattered grey captain's hat with a skull pin; a necklace of a tiny brass bell on a rusty chain; a ragged grey sailor's coat with tarnished buttons and seaweed; torn grey gloves with barnacles; a rusty chain belt with an old anchor buckle; rotting dark boots with barnacles; a tarnished ring with a glowing teal gem.
```

## 4. ชุดราชาท้องทะเล (แมพ 4 วังวนกลางทะเล) → `set_sea_king.png`

แนบ `M4_kraken_maelstrom.webp` กับ `raw/floor2_m4/key_kraken_eye.png`

```
The set: the Sea King set from the Kraken Maelstrom: royal gold, deep ocean blue, bright turquoise, white pearls, red coral and nautilus shells, regal and grand. NO purple anywhere. The items: a gold sword with a blade shaped like a wave and a coral hilt; a golden trident staff with a glowing turquoise orb between its prongs; an ornate gold pistol with a nautilus shell grip; a deep blue scabbard with gold wave patterns and pearls; a glowing turquoise orb inside a gold nautilus shell; a gold ammo case shaped like a scallop shell with pearls; the set emblem: a round gold badge with a crown over a trident and a turquoise eye gem. A gold crown helm with coral spikes and pearls; a necklace of large white pearls with a turquoise pendant; gold-and-deep-blue scale armour like fish scales; gold scale gauntlets; a gold belt with a starfish buckle; deep blue boots with gold scale greaves; a gold ring with a big turquoise eye gem.
```

---

## สำหรับคนใส่เข้าเกม

- ตัดแต่ละแผ่นเป็น 14 ชิ้นตามลำดับช่อง ขนาด 96×96 แบบไอคอนไอเทมเดิม (`public/assets/sprites/icons/item_<baseId>.png`)
- ชื่อไฟล์ตาม baseId ที่จะตั้งใน `BASES` ตอนทำ PR `feature/item-sets` อาวุธมีชื่ออาชีพต่อท้าย เช่น `item_<id>_mage` ตามกติกาเดิม
- `emblem` ใช้กับป้ายโบนัสเซ็ตในหน้ารายละเอียดไอเทม เช่น "ชุดโจรสลัด (2/9)"
