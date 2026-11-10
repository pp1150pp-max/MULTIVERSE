# สกิลแม่มดหนอง: prompt ภาพเอฟเฟกต์

สร้างในแชทเดียวกับชุดภาพแมพหนองน้ำเดิม หรือถ้าเปิดแชทใหม่ ให้แนบภาพ Gunslinger กับภาพแม่มดหนองไปเป็นตัวอย่าง
เซฟไฟล์ดิบไว้ที่ `art_templates/boss_witch/raw/witch_fx.png` แล้ว Claude จะตัดพื้นหลังและใส่เข้าเกมเอง
ระหว่างที่ยังไม่มีภาพ เกมใช้ภาพชั่วคราวที่วาดด้วยโค้ดไปก่อน

## ภาพเดียว 6 ชิ้น → `witch_fx.png`

```
Generate a WIDE image (3:2): spell effect sprites for the Bog Witch boss of the same game, in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the gunslinger and the bog witch: dark outline, 3 to 4 tones per material, small crisp pixels. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, light from the upper left; the two ground pieces (the puddle and the magic circle) are the only exception: draw those straight from above as perfect circles, like a floor tile. A strict invisible grid of 3 columns x 2 rows, one object centred in each cell, filling most of it, nothing touching. Top left: a small corked glass potion vial full of bubbling toxic green liquid, tilted as if thrown, a few drops flying off. Top middle: a round puddle of bubbling toxic green poison seen straight from above, a perfect circle with a soft irregular rim, a few bubbles and tiny green skulls of foam on it. Top right: a big grasping hand made of dark wet swamp mud with dripping sludge and a few reeds, reaching straight up out of a small mud splash on the ground. Bottom left: a fat warty swamp toad sitting, olive green with a pale belly and big yellow eyes, looking dazed, about the size of a character. Bottom middle: a floating curse sigil, a glowing violet witch rune shaped like a toad skull inside a thin circle, seen from the front. Bottom right: a magic circle of glowing violet runes seen straight from above, a perfect circle, thin lines, mostly empty inside. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink or magenta on any object; the violet must stay clearly blue-violet.
```

ลำดับช่อง: `witch_vial` `witch_pool` `witch_hand` / `witch_toad` `witch_sigil` `witch_circle`
