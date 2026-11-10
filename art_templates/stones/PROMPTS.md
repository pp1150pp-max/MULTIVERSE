# หินช่างตีเหล็ก: prompt สำหรับสร้างภาพใน ChatGPT

มี 4 ภาพ สร้างทีละภาพ โดยวาง **ส่วนสไตล์** แล้วต่อคำอธิบายของหินแต่ละก้อนท้ายคำว่า `Item:`

- **ที่เซฟ:** `art_templates/stones/raw/` ตั้งชื่อไฟล์ตามตาราง โฟลเดอร์นี้ไม่ได้ commit
- **ตัดเข้าเกม:** รันคำสั่งด้านล่าง จะได้ภาพ 96×96 ใน `public/assets/sprites/icons/`

```bash
RAW_DIR=art_templates/stones/raw node tools/cut_equip_icons.cjs
```

## ส่วนสไตล์

```text
16-bit SNES RPG inventory icon, polished pixel art with a limited color palette, crisp dark outline, soft top-left lighting. A single item, centered, filling about 80% of the frame, in a slight three-quarter view. No text, no border, no frame, no slot, no shadow on the ground, no hands, no character. Solid flat pure magenta background (#FF00FF) with no gradient, and no magenta anywhere on the item. Square image.
Item:
```

| ไฟล์ | หิน | คำอธิบาย |
|---|---|---|
| `stone_enhance.png` | หินตีบวก | `a rough chunk of dark forge stone with glowing orange molten cracks and small embers, like a blacksmith's enhancement ore` |
| `stone_protect.png` | หินกันระดับลด | `a smooth cyan-blue crystal stone wrapped in a thin silver band with a small shield rune glowing on its face` |
| `stone_reroll_values.png` | หินสุ่มค่า | `a polished golden-yellow gemstone with a swirling light inside and tiny twinkling sparkles around it` |
| `stone_reroll_stat.png` | หินสุ่มสเตตัส | `a jagged violet chaos crystal with crackling purple energy and small floating shards around it` |

## ม้วนคัมภีร์กลับเมือง (ของใช้ ขายที่พ่อค้า)

ใช้ส่วนสไตล์เดียวกับด้านบน เซฟที่ `art_templates/stones/raw/` แล้วตัดด้วยคำสั่งเดียวกัน

| ไฟล์ | ของ | คำอธิบาย |
|---|---|---|
| `stone_return_scroll.png` | ม้วนคัมภีร์กลับเมือง | `a rolled parchment scroll tied with a red ribbon and a gold wax seal, one end slightly unrolled to show a glowing teal portal rune, with a soft teal magical glow and a few tiny sparkles around it` |
