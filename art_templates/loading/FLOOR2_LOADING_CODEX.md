# งานสำหรับ Codex: ภาพหน้าโหลดชั้น 2 เมืองท่าเรือ (2026-11-28)

ส่งไฟล์นี้ให้ Codex ทั้งไฟล์ได้เลย รายการมี **1 ภาพ** ใช้แทนภาพหน้าโหลดเมืองท่าเรือเดิม (`floor2_1.webp` ซึ่งย่อมาจากภาพคอนเซปต์ `M0b_harbor_docks` ผังและตัวละครจึงไม่ตรงกับในเกม) ภาพหาด `floor2_2.webp` คงเดิม

เจ้าของเลือก (2026-11-28): ท่าเรือกลางวัน · 3 อาชีพ + ชาวเมืองประจำร้าน · เห็นทั้งเมือง ฮีโร่ตัวเล็ก · ผังยึดภาพที่ประกอบจากไฟล์เกมจริง

---

## Instructions for Codex

1. If the output file already exists, stop and say so.
2. Open all 5 reference images and pass them to the image generator as references, in the listed order.
3. Generate ONE image. The full prompt is the **STYLE BLOCK** followed by the prompt text.
4. Save it as a PNG at the exact output path (create the folder if it is missing).
5. Look at the result and go through every line of **Checks**, comparing it with the references. If a check fails (wrong layout, wrong number of portals or ships, a hero who does not look like the reference, pixel-art look, any text or letters, parts of the town cut off), generate it again, at most 3 more tries, then keep the best one.
6. At the end, report the saved file and every check that still fails.

Rules:
- Only create the output file listed here. Do not change, delete or commit any other file. Never run `git add` on anything under a `raw` folder.
- Do not resize or crop. Another step does that.
- Attach ONLY the 5 references below. Do NOT attach the old loading picture or any `M0` / `M0b` concept picture: their town layout and heroes are wrong.

Folders:
- References: `D:\Claude\Game\codex_art_refs\` (called `REF` below)
- Outputs: `D:\Claude\Game\MULTIVERSE\art_templates\` (called `OUT` below)

### STYLE BLOCK (put at the start of the prompt)

```
Style: papercraft. Everything is built from layered cut coloured paper and card, with visible paper fibre texture, slightly uneven scissor-cut edges, small soft drop shadows between the paper layers, and warm soft light from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look. NOT a photo, NOT a glossy 3D render, NOT anime painting. Use the attached reference images for style, but copy only what the instructions ask for. No text, no letters, no numbers, no watermark.
```

---

## 1. `loading_floor2_1.png`

Output: `OUT\loading\raw\loading_floor2_1.png`
Shape: wide **16:9** (the game shows it at 1280×720). If the generator only offers 3:2, use landscape 3:2 and put only extra sky-sea and clouds in the strips that a 16:9 crop will cut from the top and bottom.

References, in this order:

| # | file | what it is |
|--:|---|---|
| 1 | `REF\f2load_town_layout.png` | MAP of the real town, built from the game's own files: **where everything stands** |
| 2 | `REF\f2load_town_pieces.png` | close-ups of the buildings, portals and ships. Row 1: fountain, warehouse, smuggler stall, supply stall, broker house. Row 2: smithy, shipyard, lighthouse, return gate, pier portal. Row 3: green ship, blue ship, cream ship, red ship, globe |
| 3 | `REF\f2load_heroes.png` | the 3 player heroes, full body. Columns: swordsman, mage, gunslinger. Rows: front view, slightly turned view |
| 4 | `REF\f2load_hero_faces.png` | faces of the same 3 heroes, same order |
| 5 | `REF\f2load_npcs.png` | townspeople, left to right: warehouse keeper, smuggler, supply seller, broker, shipwright, navigator |

Prompt:

```
Generate a WIDE 16:9 loading-screen illustration of the harbour town of my papercraft fantasy game, on a bright sunny day, seen from the same fixed high isometric camera as the first attached image, with the WHOLE town in view.

How to use the attached images: image 1 is the true map of the town. Keep its layout exactly: the shape of the wooden decks, and which building, portal, ship and person is in which place. Image 1 is only a plain assembled map, so do not copy its flat look or its blank corners: paint it as a rich, detailed papercraft diorama. Image 2 shows how each building, portal and ship looks: copy their designs and colours. Images 3 and 4 are the three heroes. Image 5 shows the townspeople. Never reproduce the grey backgrounds or the grid arrangement of images 2 to 5.

THE TOWN: wooden plank decks standing on thick wooden posts in a turquoise sea that floats in the sky. One large square main deck, seen as a diamond, with a round plaza of pale boards in its middle and the golden ship's-wheel fountain with two benches in the centre of the plaza. From the four points of the diamond (top, right, bottom, left) one long straight pier runs outward and ends in a small square platform holding ONE golden ship's-wheel portal with a blue swirl. On the middle of each of the four edges of the diamond sits a smaller side platform. Water between the piers and platforms, rope bollards along the deck edges, lamp posts, four blue banner poles around the plaza, bunting flags on posts, potted palm trees, barrels, crates, sacks, rope coils and a few gulls.

WHERE EVERYTHING STANDS (screen directions):
- upper right side platform: the stone lighthouse with its wooden deck, big brass globe and telescope, and next to it, on its right, the stone arch return gate with red banners and a blue swirl
- upper left side platform: only potted palm trees, a bench and bunting flags
- lower right side platform: the shipyard, a half-built wooden hull with a crane
- lower left side platform: a small rowboat tied beside it
- around the plaza on the main deck: the warehouse with a blue roof and big round door above and left of the fountain; the purple smuggler tent further left; the supply stall with the red-and-cream striped awning below and left; the broker house with a teal roof and a notice board of blank papers below and right; the smithy with a blue roof, glowing forge and anvil above and right
- ships moored in the water: the GREEN-sailed ship left of the top pier; the BLUE-sailed ship just below the right pier; the CREAM-sailed ship with a red dragon just below the left pier; the RED-sailed ship with crossed swords left of the bottom pier

TOWNSPEOPLE (small, each standing in front of their own place): the supply seller at the striped stall, the warehouse keeper at the warehouse door, the shipwright at the smithy, the broker at the broker house, the smuggler at the purple tent, and the navigator behind the plaza, above and right of the fountain, beside a small globe on a stand. Each appears exactly once. No other people.

THE THREE HEROES: walking together on the plaza just below the fountain, turned toward the viewer so their faces show, about one seventh of the image height each, clearly larger than the townspeople and easy to recognise. Copy their designs exactly from images 3 and 4, with the same chibi proportions, small dark oval eyes and calm faces. From left to right:
1) the swordsman: spiky ash-blond hair, dark charcoal-brown armour with gold trim and round gold knee plates, a dark charcoal cape with gold trim, and a straight sword with a glowing orange-gold blade;
2) the mage: very long pale silver-lavender hair, a big purple witch hat with a gold flower, a long purple robe with gold trim, and a wooden staff topped by a gold ship's-wheel ring holding a blue orb;
3) the gunslinger: spiky silver-white hair, brass goggles pushed up on the forehead, a flowing red scarf, a long dark brown coat with gold trim, and a big chunky brass hand cannon.

FRAMING: the town is centred and large, spread across most of the width (the left and right piers may be drawn a little longer to fill the wide frame, but nothing changes place). The highest mast or lighthouse top stays at least 8 percent below the top edge. The lowest part of the town (the bottom pier and its portal) ends at about 76 percent of the height. The bottom 24 percent holds only calm, slightly deeper blue sea, small waterfalls and soft paper clouds with very little detail, because a loading bar and a line of white text are drawn there. Around the town: layered paper waves, water pouring off the rim of the sea into fluffy white paper clouds, and blue sky. No monsters, no user interface, no health bars, no text, no signs with writing, no logo, no frame, no watermark.
```

Checks:
- Town layout matches image 1: diamond main deck, 4 straight piers (top, right, bottom, left), 4 side platforms.
- Exactly 4 ship's-wheel portals (one per pier end) and exactly 1 stone return gate beside the lighthouse (upper right).
- Exactly 4 ships, each in its place and colour (green top, blue right, cream-with-dragon left, red bottom), plus 1 rowboat lower left.
- Every building on its correct side: warehouse upper left, smuggler tent left, supply stall lower left, broker house lower right, smithy upper right, shipyard on the lower right platform, lighthouse on the upper right platform.
- Exactly 3 heroes and 6 townspeople, none repeated.
- Swordsman: ash-blond, dark armour, DARK cape (not blue, not white clothes), glowing orange-gold straight sword visible.
- Mage: silver-lavender hair (not bright purple), gold flower on the hat (not a star), staff with a blue orb.
- Gunslinger: silver-white hair, goggles, red scarf, dark brown coat, hand cannon visible.
- Bottom band is calm; nothing is cut off at the top or sides.
- No text or letters, no pixel-art look.

---

## สำหรับ session ที่จะใส่เข้าเกม (Codex ไม่ต้องทำ)

- ครอป 16:9 แล้วย่อเป็น 1280×720 webp (ไฟล์ราว 300 KB) ทับ `public/assets/sprites/paper/ui/loading/floor2_1.webp` ชื่อเดิม ไม่ต้องแก้โค้ด (`src/client/loadingScreen.ts`)
- ภาพอ้างอิง `f2load_*.png` ประกอบจาก `src/shared/data/maps/harbor_town.json`, รูปแพใน `src/shared/data/harbor.ts` และสไปรต์กระดาษใน `public/assets/sprites/paper/` ถ้าผังเมืองเปลี่ยน ต้องประกอบใหม่ก่อนเจนอีกรอบ
