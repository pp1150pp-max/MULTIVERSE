# UI: prompt ที่ใช้สร้างภาพใน ChatGPT

โทนเหล็กมืดกับบรอนซ์หม่น ดาวเล็กและไม่เด่น สไตล์ 16-bit SNES สร้างในแชทเดียวกับภาพอื่นของเกม ทุกภาพยกเว้นหน้าต่างกระเป๋าให้แนบหน้าต่างกระเป๋าไปเป็นตัวอย่างสี
ไฟล์ที่เกมใช้อยู่ใน `public/assets/sprites/ui/` ตำแหน่งช่องต่าง ๆ วัดจากภาพแล้วตั้งเป็น % ใน `src/style.css` ถ้าวาดใหม่ต้องวัดใหม่ด้วย
ไฟล์ต้นฉบับจาก GPT ไม่ได้เก็บใน repo

## `inventory.png`

ใช้ 2 ขั้น ขั้นแรกสร้างหน้าต่าง ขั้นที่สองแนบภาพจากขั้นแรกแล้วสั่งจัดช่อง ตอนตัดภาพให้ไล่สีม่วงแดงจากขอบเข้ามาให้โปร่งใส แล้วย่อเหลือ 75%

```
Generate a TALL image (3:4): an empty inventory window background for an isometric action RPG, in fine-detail 16-bit
SNES-era pixel art with crisp pixels and no blur. Original dark gothic design made of black forged iron with restrained,
tarnished aged-bronze accents. The dark iron must dominate. Any star ornaments must be small, few, dull and tarnished, in
muted dark bronze with almost no highlights, blending into the iron frame. They must never be bright yellow, shiny, glowing
or large. Upper area: a dim weathered stone wall with faint carved reliefs of cosmic ruins, low contrast so icons stay
readable. No character drawn. Lower area: an empty dark grid of exactly 10 columns x 3 rows of equal square cells. Below the
grid: an empty narrow plate for a coin counter. Top: a blank wide aged-gold title plate with a completely clear face, with
no ornament overlapping or touching it, and a small iron close button with an X in the top right corner. The window has one
solid, unbroken iron outer edge, with only small ornaments outside it. Everything outside the window is ONE perfectly flat
solid magenta (#FF00FF), with no shadows on it. No items, no icons, no readable words, no logos. Do not use pink, magenta or
purple in the window.
```

```
Edit the attached inventory window. Keep exactly the same style, colours, iron frame, title plate, close button, 10 x 3 item
grid, coin plate and flat magenta (#FF00FF) background. Change ONLY the equipment sockets in the upper wall area: rebuild
exactly 10 empty recessed sockets in this layout, with clear gaps and none overlapping.

LEFT COLUMN, near the left side of the wall:
1. A tall rectangular socket, about 1 unit wide and 2 units tall, starting at the top of the wall (main weapon).
2. Directly below it, a square socket of the same width (gloves).

RIGHT COLUMN, near the right side of the wall, mirroring the left column at the same heights and sizes:
3. A tall rectangular socket, about 1 unit wide and 2 units tall (off-hand weapon).
4. Directly below it, a square socket of the same width (boots).

CENTRE COLUMN, on the window's vertical centre line, from top to bottom:
5. A square socket at the top of the wall (helmet).
6. Below it, a tall rectangular socket, about 1 unit wide and 1.5 units tall (body armor).
7. Below it, a wide short socket, about 1 unit wide and 0.5 units tall, level with the bottom of the left and right columns (belt).

SMALL SOCKETS in the gaps between the centre column and the side columns, each about half a unit square:
8. In the right gap, level with the bottom of the helmet socket (necklace).
9. In the left gap, level with the lower half of the body armor socket (ring).
10. In the right gap, level with the lower half of the body armor socket (ring).

All sockets are empty and share the same recessed iron and tarnished bronze frame style. The left and right halves of the
layout are symmetrical, except that the necklace socket appears only on the right. No items, no icons, no character, no
readable words, no logos. Do not use pink, magenta or purple in the window.
```

## `close.png` และ `corner.png`

ตัดจากแผ่นเดียว พื้นหลังสีม่วงแดง

```
Using the attached inventory window as the exact style and colour reference, generate a SQUARE image: a matching UI kit of black forged iron with restrained, tarnished aged-bronze accents, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. The dark iron must dominate. Any star details must be small, dull and tarnished, in muted dark bronze with almost no highlights, never bright yellow, shiny or glowing. Strict invisible grid of 3 columns x 3 rows, one element centred in each cell with empty space around it, nothing touching. Row 1: an empty square item slot; the same slot highlighted with a brighter bronze edge; an empty square skill slot. Row 2: a wide blank button; the same button in a slightly brighter hover state; a small iron close button with an X. Row 3: a blank title plate; a blank tab; a small iron corner ornament with one small tarnished star. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No readable words, no logos. Do not use pink, magenta or purple in the elements.
```

## `orb_*.png`

แถวบนใช้กรอบเปล่า แถวล่างตัดเฉพาะเนื้อของเหลวกับเงาแก้ว ส่วนเงาแก้วคำนวณความโปร่งจากค่าสีเขียวของแต่ละพิกเซล

```
Using the attached inventory window as the exact style and colour reference, generate a WIDE image (3:2): game HUD parts of black forged iron with restrained, tarnished aged-bronze accents, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. Any star details must be small, dull and tarnished, in muted dark bronze with almost no highlights, never bright yellow, shiny or glowing. The glowing liquid must be the brightest thing in each orb, never the frame. Strict invisible grid of 3 columns x 2 rows, one element centred in each cell with empty space around it. Row 1: a large round glass orb full of glowing red liquid inside an ornate dark iron cradle that opens toward the right; the matching orb full of glowing blue liquid in a mirrored cradle that opens toward the left; the same cradle with an empty dark glass orb. Row 2: only the round red liquid fill with no glass or frame; only the round blue liquid fill with no glass or frame; only a round glass highlight overlay with shine at the top. The orbs must be the same size and perfectly aligned. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No numbers, no readable words, no logos.
```

## `bar_*.png`, `skillbar.png`, `expbar.png`

```
Using the attached inventory window as the exact style and colour reference, generate a WIDE image (3:2): game HUD parts of black forged iron with restrained, tarnished aged-bronze accents, in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur. The dark iron must dominate. Any star details must be small, dull and tarnished, in muted dark bronze with almost no highlights, never bright yellow, shiny or glowing. Each element is separate with wide empty space around it, nothing touching. From top to bottom: 1) a long empty horizontal status bar frame with a dark inner channel and small ornate ends; 2) a perfectly straight glowing red bar fill, a plain rectangle with no frame; 3) a perfectly straight glowing blue bar fill, a plain rectangle with no frame; 4) a long centred skill bar base with exactly 7 empty square sockets of equal size, grouped as 4, then 1, then 2, with no ornament overlapping any socket; 5) a thin long dark iron experience bar frame with tarnished bronze edges and an empty channel. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on it. No numbers, no readable words, no logos. Do not use pink, magenta or purple in the elements.
```
