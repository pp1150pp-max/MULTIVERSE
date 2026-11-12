# ภาพหน้าตัวละคร (portrait): prompt ที่ใช้สร้างภาพใน ChatGPT

ใช้ในกรอบโปรไฟล์มุมจอ (HUD) และช่องเลือกตัวละครหน้าเมนู แทนภาพเต็มตัวที่ย่อจนแตก
การ์ดเลือกคลาสตอนสร้างตัวละครยังใช้ภาพเต็มตัวเหมือนเดิม

- สไตล์: ภาพวาดละเอียดแบบ illustration ไม่ใช่พิกเซล แต่หน้าตา ชุด และสีต้องตรงกับ sprite ในเกม
- กรอบ: สี่เหลี่ยมจัตุรัส หัวถึงไหล่ พื้นสีเข้มไล่เฉดตามคลาส ไม่ต้องตัดพื้น
- แนบภาพแบบ: `public/assets/sprites/player/<คลาส>/idle.png` (แถวบนสุด ท่ายืนหันหน้า) เป็นตัวอย่างหน้าตาและชุด
- เซฟภาพดิบที่ `art_templates/portraits/raw/<คลาส>.png` (`sword.png`, `mage.png`, `gunslinger.png`)
- ย่อเป็น 256x256 ไว้ที่ `public/assets/sprites/ui/portrait_<คลาส>.png`

ทุกภาพใช้กฎนี้ตามด้วยรายละเอียดของคลาส:

```
Using the attached pixel-art character as the exact reference for face, hair, outfit and colours, paint a SQUARE (1:1)
character portrait for a fantasy action RPG profile frame. Style: a detailed, polished digital illustration in a modern
anime fantasy RPG style with clean line art, soft cel shading and rich lighting. NOT pixel art. Framing: head and
shoulders only, the face large and centred, looking slightly toward the viewer in a 3/4 view, the top of the head close
to the top edge, cut off at the upper chest. Keep exactly the same character design as the reference: same hairstyle and
hair colour, same eye colour, same outfit pieces and colours, so players recognise them at once. Background: a simple dark
gradient with a soft glow behind the head, no scenery, no frame, no border, no text, no logo, no watermark. The face must
stay readable when the picture is shown very small (44 pixels).
```

## `sword.png` (นักดาบ Techno Knight)

```
Character: a young male techno knight. Messy, spiky ash-blonde (light beige) hair, sharp amber-gold eyes, calm determined
expression. He wears dark gunmetal and black techno-plate armour with polished silver pauldrons and tarnished gold trims,
a glowing golden diamond crystal set in the middle of the chest plate, and small gold rivets along the armour edges.
Background: dark bronze-brown gradient with a warm golden glow behind his head.
```

## `mage.png` (เมจ)

```
Character: a young female mage. Long straight lavender (light purple) hair with side locks framing her face, large violet
eyes, gentle confident expression. She wears a big deep purple witch hat with a wide gold-trimmed brim, a band of small
gold stars around it and a gold star charm hanging from the tip; a deep purple cloak with gold embroidered edges over a
white ruffled blouse, fastened at the collar with a round blue crystal brooch in a gold setting. If the staff shows, it is
gold with a glowing blue orb. Background: dark indigo-violet gradient with a soft blue arcane glow behind her head.
```

## `gunslinger.png` (Gunslinger)

```
Character: a young male gunslinger. Messy, spiky silver-white hair, brown eyes, thick dark eyebrows and a tough frowning
expression. Brass steampunk goggles with round cyan glass lenses pushed up on his forehead. A long red scarf wrapped around
his neck with loose ends flowing to one side, a dark brown leather long coat with brass buckles and gold trims over a
brown vest. Background: dark brown-umber gradient with a warm orange glow behind his head.
```
