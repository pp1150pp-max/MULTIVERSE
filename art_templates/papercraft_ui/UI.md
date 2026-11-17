# UI กระดาษ: prompt สำหรับเจนใน ChatGPT

เจ้าของเลือกเมื่อ 2026-11-18: HUD ในเกม, ไอคอนเมนู, กรอบกระเป๋า + ร้านเงินสด, หน้าโหลด + ปุ่มมือถือ
(หน้า Login โลโก้ และชุดในร้านเงินสดอยู่อีกกลุ่ม ทำทีหลัง)

## วิธีเจน

- กรอบและปุ่มในเกมต้องต่อกันพอดีกับหน้าจอ จึงต้อง **วาดใหม่จากของเดิม รูปทรงและสัดส่วนต้องเหมือนเดิม**
- ผมเตรียมภาพของเดิมไว้แล้วที่ `art_templates/papercraft_ui/raw/ref/` แต่ละภาพจัดชิ้นเรียงเป็นแผ่นแบบเดียวกับที่ต้องการ พร้อมสีพื้นหลังที่ต้องใช้
- **แต่ละข้อแนบภาพ 2 ภาพ:**
  1. ภาพของเดิมของข้อนั้น (`ref/<ชื่อ>_old.png`)
  2. ภาพต้นแบบสไตล์ `art_templates/papercraft_maps/raw/ref/A7_hub.png`
- เซฟไฟล์ดิบไว้ที่ `art_templates/papercraft_ui/raw/<ชื่อ>.png`
- **เปิดแชทใหม่** แล้วเจนทุกข้อต่อกันในแชทนั้น

### ข้อความกลาง (ใช้กับข้อ 1–7)

```
The second attached image shows the papercraft art style of my game. The first attached image is a sheet of OLD pixel-art user-interface pieces from the same game. Redraw EVERY piece of that sheet in the papercraft style: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the paper layers inside each piece, brass and gold paper trims, dark card panels, warm soft light from the upper left.
VERY IMPORTANT: keep the SAME layout as the old sheet: the same pieces in the same rows and the same order, each piece with the SAME outline, the SAME proportions (width to height), the same border thickness and the same empty inner areas, because the game stretches each piece to the old size and places text and items inside the empty areas. Keep empty inner areas plain and dark, with no decorations inside them. Keep every piece fully separate with generous empty space around it, nothing touching. Background ONE perfectly flat solid colour exactly like the old sheet's background, no gradient, no shadows on the background. No text, no letters, no numbers, no labels.
```

แล้วต่อท้ายด้วยบรรทัดของแต่ละข้อ

| ข้อ | ไฟล์ที่เซฟ | แนบภาพเดิม | บรรทัดต่อท้าย |
|---|---|---|---|
| 1 | `hud.png` | `ref/hud_old.png` | `These are the game screen pieces: a long skill bar with 8 square slots, a thin experience bar frame, a thin health bar frame, a round frame that holds a glass orb, a decorative panel corner and a square close button with an X. Background solid magenta (#FF00FF); do not use pink, magenta or purple on the pieces.` |
| 2 | `bars.png` | `ref/bars_old.png` | `These are the bar fills and orb liquids: a red health bar fill, a blue mana bar fill, a red liquid surface and a red liquid wave strip, a blue liquid surface and a blue liquid wave strip, each made of layered translucent-looking coloured paper with small paper highlights, filling its whole rectangle edge to edge. Background solid magenta (#FF00FF); do not use pink, magenta or purple on the pieces.` |
| 3 | `icons.png` | `ref/icons_old.png` | `These are round menu buttons and shop items: 11 round brass-framed paper buttons with the SAME symbol as the old one inside each (auto play swords, auto settings gear and sword, bag, empty, shop bag with a blue crystal, calendar with a gift, two friends with a heart, book with a question mark, treasure map, three-line menu, gear), one blue crystal, and 4 packs of blue crystals (three crystals, a small pile, a sack spilling crystals, an open treasure chest full of crystals). Crystals are blue, never purple. Background solid magenta (#FF00FF); do not use pink, magenta or purple on the pieces.` |
| 4 | `cash_frames.png` | `ref/cash_frames_old.png` | `These are the crystal shop window pieces: a large window frame, a dialog frame, an item card and the same card highlighted with a soft purple glow, an item well with a purple border, a check box, a round plus button, a button and a golden main button, a balance box with a round slot, a price tag, a tab and the selected tab with a purple glow, a side tab and the selected side tab, and a thin divider with a blue gem. Background solid pure bright green (#00FF00); do not use bright green on the pieces.` |
| 5 | `ribbons.png` | `ref/ribbons_old.png` | `These are 3 corner ribbons folded over a card corner: a red one, a green one and a purple one, each made of folded coloured paper with a thin gold edge. Background solid cyan (#00FFFF); do not use cyan on the pieces.` |
| 6 | `touch.png` | `ref/touch_old.png` | `These are the mobile touch controls: a big round attack button frame, a joystick base with four small arrow marks, a smaller round skill button frame, a round joystick knob, and 4 small icons (two speech bubbles, a winged boot dashing, a horse head, one speech bubble). Background solid magenta (#FF00FF); do not use pink, magenta or purple on the pieces.` |
| 7 | `inventory.png` | `ref/inventory_old.png` | `This is the bag window: a tall frame with the character's equipment slots at the top and a grid of 30 bag slots at the bottom. Keep every slot in exactly the same place and size. Background solid magenta (#FF00FF); do not use pink, magenta or purple on the piece.` |

## 8. รูปหน้าคลาส 3 ภาพ → `portrait_sword.png`, `portrait_mage.png`, `portrait_gunslinger.png`

แนบภาพเดิม (`ref/portrait_<คลาส>.png`) กับภาพตัวละครกระดาษของคลาสนั้น (`art_templates/papercraft_chars/raw/<คลาส>/design.png`) เจนทีละภาพ

```
Generate a SQUARE image (1:1): a close-up bust portrait of this exact papercraft character (the second attached image), framed like the old portrait (the first attached image): head and shoulders, looking slightly to the side, filling the square, a soft dark background in the character's colours. Same papercraft style: layered cut paper, visible paper fibre, small drop shadows between layers, warm soft light. No text, no frame, no border.
```

## 9. ภาพหน้าโหลด 5 ภาพ → `loading_sword.png`, `loading_mage.png`, `loading_gunslinger.png`, `loading_portal_1.png`, `loading_portal_2.png`

แนบภาพเดิม (`ref/loading_<ชื่อ>_old.png`) กับ `A7_hub.png` ภาพคลาสแนบ `design.png` ของคลาสนั้นด้วย เจนทีละภาพ

```
Generate a WIDE image (16:9): redraw the attached old loading screen as a papercraft diorama scene in the style of the attached papercraft city: the same scene, the same composition and the same character pose, built from layered cut coloured paper and card with visible paper fibre and small drop shadows between the layers, warm soft light. If a hero is in the scene, it is the attached papercraft character. No text, no logo, no UI.
```

## 10. ป้ายร้านเงินสด → `cash_banner.png`

แนบ `ref/cash_banner_old.png` กับ `A7_hub.png`

```
Generate a WIDE image (3:1): redraw the attached old crystal-shop banner as a papercraft diorama scene: the same shop scene and composition, a cosy merchant stall full of glowing blue crystals, built from layered cut paper and card with visible paper fibre, warm soft light. No text, no logo.
```

---

## สำหรับผม: ใส่เข้าเกม

- `node tools/cut_paper_ui.cjs` ตัดทุกชิ้นให้ได้ขนาดเท่าของเดิมพอดี แล้วลง `sprites/paper/ui/`
- UI ใช้ภาพผ่าน CSS และ `index.html` จึงต้องให้สวิตช์ภาพกระดาษเปลี่ยน path ภาพ UI ด้วย ตอนนี้ยังไม่ได้ทำ
