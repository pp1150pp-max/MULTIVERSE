# ไอคอนอุปกรณ์ช่องใหม่: prompt สำหรับสร้างภาพใน ChatGPT

มีทั้งหมด 18 ภาพ สร้างทีละภาพ โดยนำ **ส่วนสไตล์** ไปต่อหน้าคำอธิบายของแต่ละไอเทม

- **ที่เซฟ:** `art_templates/equip_icons/raw/` ใช้ชื่อไฟล์ตามตาราง
- **หลังเซฟ:** Claude จะลบพื้นหลัง ย่อเป็น 96×96 แล้วใส่ลง `public/assets/sprites/icons/`
- **ระหว่างรอภาพ:** เกมใช้ไอคอนกระเป๋าชั่วคราว

## ส่วนสไตล์

```text
16-bit SNES RPG inventory icon, polished pixel art with a limited color palette, crisp dark outline, soft top-left lighting. A single item, centered, filling about 80% of the frame, in a slight three-quarter view. No text, no border, no frame, no slot, no shadow on the ground, no hands, no character. Solid flat pure magenta background (#FF00FF) with no gradient, and no magenta anywhere on the item. Square image.
Item:
```

## สร้อย ถุงมือ เข็มขัด (ใช้ได้ทุกคลาส)

| ไฟล์ | ไอเทม | คำอธิบาย |
|---|---|---|
| `item_necklace_1.png` | Bead Necklace | `a simple forest necklace of round wooden and green stone beads on a brown cord` |
| `item_necklace_2.png` | Wisp Pendant | `a swamp pendant on a dark tarnished chain, a small glowing pale-green wisp flame trapped in a teardrop glass charm` |
| `item_necklace_3.png` | Frost Amulet | `an ornate silver amulet on a fine chain, a large faceted ice-blue crystal set in frosted silver claws` |
| `item_gloves_1.png` | Leather Gloves | `a pair of plain brown leather gloves with stitched cuffs` |
| `item_gloves_2.png` | Mossweave Gloves | `a pair of woven dark-green gloves made of moss fibre, with muddy leather palms and reed bindings at the wrists` |
| `item_gloves_3.png` | Frostfur Gauntlets | `a pair of steel gauntlets with white fur cuffs and icy blue plates on the knuckles` |
| `item_belt_1.png` | Rope Belt | `a coiled belt of thick tan rope tied in a simple knot, with a small wooden toggle` |
| `item_belt_2.png` | Serpent Belt | `a coiled belt of dark green snake-scale leather, with a bronze buckle shaped like a serpent head` |
| `item_belt_3.png` | Glacier Girdle | `a coiled wide belt of pale blue-grey leather and white fur trim, with a silver buckle set with an ice crystal` |

## อาวุธรอง Sword: ฝักดาบ

| ไฟล์ | ไอเทม | คำอธิบาย |
|---|---|---|
| `item_scabbard_1_sword.png` | Worn Scabbard | `an empty sword scabbard, worn brown leather with a dented iron tip and throat, drawn diagonally` |
| `item_scabbard_2_sword.png` | Bogsteel Scabbard | `an empty sword scabbard of dark greenish steel with moss-green wrapping and bronze fittings, drawn diagonally` |
| `item_scabbard_3_sword.png` | Frostbound Scabbard | `an empty sword scabbard of pale silver steel, covered in ice crystals with blue glowing runes, drawn diagonally` |

## อาวุธรอง Mage: ลูกแก้วและคัมภีร์

| ไฟล์ | ไอเทม | คำอธิบาย |
|---|---|---|
| `item_orb_1_mage.png` | Glass Orb | `a small clear glass magic orb with a faint green swirl inside, resting on a simple wooden stand` |
| `item_tome_2_mage.png` | Swamp Grimoire | `a closed old spellbook bound in dark green swamp-hide, with bronze corners and a glowing pale-green rune on the cover` |
| `item_orb_3_mage.png` | Aurora Orb | `a large crystal magic orb swirling with aurora colors of teal and violet, held in a silver frost-covered claw stand` |

## อาวุธรอง Gunslinger: ซองกระสุน

| ไฟล์ | ไอเทม | คำอธิบาย |
|---|---|---|
| `item_pouch_1_gunslinger.png` | Bullet Pouch | `a small brown leather ammunition pouch with a flap and buckle, a few brass bullets visible at the top` |
| `item_pouch_2_gunslinger.png` | Oilskin Ammo Pouch | `a dark olive waxed oilskin ammunition pouch with a brass clasp and a row of brass cartridges in loops on the front` |
| `item_pouch_3_gunslinger.png` | Glacier Ammo Case | `a small hard steel ammunition case with white fur trim and frost on its lid, open to show ice-blue glowing bullets` |
