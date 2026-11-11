# ปุ่มบนจอสัมผัส: prompt ภาพจอย กรอบปุ่ม ไอคอน และไอคอนแอป

ใช้กับแผน `docs/plans/MOBILE_PLAN.md` (หัวข้อ 9) · PR 2 (ปุ่มสัมผัส) รอภาพชุดที่ 1–2 · PR 8 (PWA) รอภาพชุดที่ 3

สร้างในแชทเดียวกับชุดภาพ UI เดิม หรือถ้าเปิดแชทใหม่ ให้แนบภาพ Gunslinger และภาพ UI ของเกม (เช่น `public/assets/sprites/ui/skillbar.png`, `ico_bag.png`, `orb_cradle.png`) ไปเป็นตัวอย่างในภาพแรก
เซฟไฟล์ดิบตามชื่อในแต่ละหัวข้อไว้ที่ `art_templates/touch_ui/raw/` แล้ว Claude จะตัดพื้นหลัง แยกช่อง และใส่เข้าเกมเอง

มีทั้งหมด 3 ไฟล์

## 1. จอยและกรอบปุ่ม → `touch_frames.png`

```
Generate a SQUARE image: on-screen touch controls for a mobile version of the same game, in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the game's UI frames (skill bar, orbs and icons): dark outline, 3 to 4 tones per material, crisp pixels, aged gold and dark bronze metal with dark brown leather, the same palette as the existing UI. Seen straight on, flat, no perspective. A strict invisible grid of 2 columns x 2 rows, one object centred in each cell, filling most of it, nothing touching. Top left: virtual joystick BASE, a large round ring of dark bronze with a thin gold rim, the inside is a dark smoky translucent disc (draw it as dark grey, it will be made see-through in game) with 4 small faint gold arrow notches at up, down, left and right. Top right: joystick KNOB, a smaller round domed gold button with a soft highlight on the upper left and a dark outline, nothing inside. Bottom left: ATTACK button frame, a large round frame with a thick ornate gold rim and small rivets, the centre is an EMPTY flat dark circle (an icon will be placed on top in game). Bottom right: SKILL button frame, the same design as the attack frame but simpler and thinner, the centre is an EMPTY flat dark circle. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no letters, no labels, no grid lines. Do not use pink or magenta in the objects.
```

ลำดับช่อง: `stick_base` `stick_knob` / `btn_attack` `btn_skill`
(ปุ่มรอง เช่น G Z แชท ยา คุย/ใช้ ใช้ `btn_skill` ย่อขนาด)

## 2. ไอคอนปุ่ม 4 แบบ → `touch_icons.png`

```
Now 4 small button icons for the same mobile controls, EXACT same fine-detail 16-bit SNES-era pixel-art style as the game's existing icons (bag, map, help): dark outline, 3 to 4 tones per material, crisp pixels, warm gold and parchment tones. A strict invisible grid of 2 columns x 2 rows, one icon centred in each cell, filling most of it, simple bold silhouette that reads at a tiny size, nothing touching. Top left: TALK / USE, a parchment speech bubble with three dots inside. Top right: CHAT, two overlapping small speech bubbles. Bottom left: MOUNT, a horse head in profile with a small saddle strap. Bottom right: DASH, a boot with three motion streaks behind it. No frames or circles around the icons. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no letters, no labels, no grid lines. Do not use pink or magenta in the icons.
```

ลำดับช่อง: `icon_talk` `icon_chat` / `icon_mount` `icon_dash`
(ถ้าเกมมีไอคอนพาหนะหรือแดชที่ใช้ได้อยู่แล้ว ข้ามช่องนั้นได้)

## 3. ไอคอนแอปหน้าจอหลัก → `app_icon.png`

```
Generate a SQUARE image (1:1), 1024x1024: the home-screen app icon for the game MULTIVERSE, in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the game's logo and characters: dark outline, crisp pixels. A bold ornate golden letter M in the style of the game's logo, standing in front of a swirling violet and blue dimensional portal, a few small stars and sparks around it. The background fills the WHOLE square edge to edge with a dark night-blue to violet gradient made of pixel-art dithering, no transparency, no rounded corners, no border. Keep every important part (the whole M and the portal) inside the central 70% of the image, because the edges may be cut into a circle or rounded square. No text other than the single letter M.
```

Claude จะย่อเป็น `app_512.png` `app_192.png` `app_180.png` (apple-touch-icon) และ `app_maskable_512.png`
