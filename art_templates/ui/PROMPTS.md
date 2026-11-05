# UI: prompt ที่ใช้สร้างภาพใน ChatGPT

โทนเหล็กมืดกับทองเก่า ลวดลายดาวแตก สไตล์ 16-bit SNES สร้างในแชทเดียวกับภาพอื่นของเกม
ไฟล์ที่เกมใช้อยู่ใน `public/assets/sprites/ui/` ตำแหน่งช่องต่าง ๆ วัดจากภาพแล้วตั้งเป็น % ใน `src/style.css` ถ้าวาดใหม่ต้องวัดใหม่ด้วย
ไฟล์ต้นฉบับจาก GPT ไม่ได้เก็บใน repo

## `inventory.png`

```
Generate a TALL image (3:4): an empty inventory window background for an isometric action RPG, in fine-detail 16-bit
SNES-era pixel art with crisp pixels and no blur. Original dark gothic design made of black forged iron and aged gold,
with a motif of shattered stars and cracked gold fragments. Upper area: a dim weathered stone wall with faint original
carved reliefs of cosmic ruins and broken stars, low contrast so icons stay readable. No character in the middle. Build
recessed square equipment sockets into it, arranged like a body but with no body drawn: helmet at top centre, armor large
in the middle, weapon large on the left, ring on the right, boots at lower right. Lower area: an empty dark grid of
exactly 10 columns x 3 rows of equal square cells. Below the grid: an empty narrow plate for a coin counter. Top: a blank
gold title plate and a small iron close button with an X. All sockets and cells empty. No items, no readable words, no logos.
```

## `close.png` และ `corner.png`

ตัดจากแผ่นเดียว พื้นหลังสีม่วงแดง

```
Generate a SQUARE image: a matching UI kit in the same style, dark forged iron and aged gold with shattered star details,
fine-detail 16-bit SNES-era pixel art, crisp pixels, no blur. Strict invisible grid of 3 columns x 3 rows, one element
centred in each cell with empty space around it, nothing touching. Row 1: an empty square item slot; the same slot
highlighted with a gold edge; an empty square skill slot. Row 2: a wide blank button; the same button in a brighter hover
state; a small iron close button with an X. Row 3: a blank title plate; a blank tab; a small round iron corner ornament
with a broken star. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no readable words, no logos. Do not
use pink, magenta or purple in the elements.
```

## `orb_*.png`

แถวบนใช้กรอบเปล่า แถวล่างตัดเฉพาะเนื้อของเหลวกับเงาแก้ว ส่วนเงาแก้วคำนวณความโปร่งจากค่าสีเขียวของแต่ละพิกเซล

```
Generate a WIDE image (3:2): game HUD parts in the same dark iron and aged gold style with shattered star details,
fine-detail 16-bit SNES-era pixel art, crisp pixels, no blur. Strict invisible grid of 3 columns x 2 rows, one element
centred in each cell with empty space around it. Row 1: a large round glass orb full of glowing red liquid inside an
ornate iron and gold cradle that opens toward the right; the matching orb full of glowing blue liquid in a mirrored cradle
that opens toward the left; the same cradle with an empty dark glass orb. Row 2: only the round red liquid fill with no
glass or frame; only the round blue liquid fill with no glass or frame; only a round glass highlight overlay with shine at
the top. The orbs must be the same size and perfectly aligned. Background ONE perfectly flat solid magenta (#FF00FF), no
shadows, no numbers, no readable words, no logos.
```

## `bar_*.png`, `skillbar.png`, `expbar.png`

```
Generate a WIDE image (3:2): game HUD parts in the same dark iron and aged gold style with shattered star details,
fine-detail 16-bit SNES-era pixel art, crisp pixels, no blur. Each element is separate with wide empty space around it,
nothing touching. From top to bottom: 1) a long empty horizontal status bar frame with a dark inner channel and ornate
ends; 2) a perfectly straight glowing red bar fill, a rectangle with no frame; 3) a perfectly straight glowing blue bar
fill, a rectangle with no frame; 4) a long centred skill bar base with 7 empty square sockets, grouped as 4, then 1, then
2; 5) a thin long gold experience bar frame with an empty channel. Background ONE perfectly flat solid magenta (#FF00FF),
no shadows, no numbers, no readable words, no logos. Do not use pink, magenta or purple in the elements.
```
