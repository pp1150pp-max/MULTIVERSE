# ห้องบอส: prompt ภาพกุญแจ ที่เรียกบอส และห้องบอส 4 ห้อง

สร้างในแชทเดียวกับชุดภาพแมพเดิม หรือถ้าเปิดแชทใหม่ ให้แนบภาพ Gunslinger และภาพ props ของแมพนั้นไปเป็นตัวอย่างในภาพแรก
เซฟไฟล์ดิบตามชื่อในแต่ละหัวข้อไว้ที่ `art_templates/boss_rooms/raw/` แล้ว Claude จะตัดพื้นหลังและใส่เข้าเกมเอง
ระหว่างที่ยังไม่มีภาพ เกมใช้ภาพชั่วคราวไปก่อน

มีทั้งหมด 10 ไฟล์ ได้แก่ ไอคอนกุญแจ 1 ภาพ ที่เรียกบอส 1 ภาพ และห้องละ 2 ภาพ (ลายพื้นลาน 1 ภาพ กับของตกแต่งรอบลาน 1 ภาพ)

## 1. ไอคอนกุญแจ 4 แบบ → `key_icons.png`

```
Generate a SQUARE image: inventory item icons for the same game, EXACT same fine-detail 16-bit SNES-era pixel-art style as the gunslinger: dark outline, 3 to 4 tones per material, crisp pixels. A strict invisible grid of 2 columns x 2 rows, one item centred in each cell, filling most of it, drawn at a slight angle, nothing touching. Each one is an ancient magical artifact that works as a key to a boss's lair. Top left: Bear Paw, a severed great bear paw with dark claws, bound with a leather cord and a small bronze key-shaped charm, mossy green glow. Top right: Bog Witch Orb, a murky swamp-green glass orb in a twisted black-root cradle, a faint eye shape swirling inside. Bottom left: Yeti Fang, a huge curved ice-white fang with frost crystals along it and a pale blue rune carved in the root. Bottom right: Lava Heart Core, a fist-sized cracked black stone heart with glowing orange magma seams, set in an iron ring. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no labels, no grid lines. Do not use pink or magenta in the items.
```

ลำดับช่อง: `stone_key_bear` `stone_key_witch` / `stone_key_yeti` `stone_key_heart`

## 2. ที่เรียกบอส 4 แบบ → `summoners.png`

```
Now 4 boss summoning altars for the map props of this game, in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the gunslinger and the map props: dark outline, 3 to 4 tones per material, small crisp pixels. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, each base sits on an imaginary diamond-shaped footprint, light from the upper left. Each altar is about twice the height of a character, with a keyhole-shaped socket glowing faintly on its front. Generate an image: exactly 4 separate objects in a 2 columns x 2 rows grid, generous empty space, each fully inside its own cell, nothing touching. Top left (Emerald Forest): a mossy grey standing stone carved with a bear head, roots wrapped around its base, small green leaves, warm green glow in the socket. Top right (Misty Marsh): a crooked black dead-wood totem hung with bones, a cracked cauldron at its base, sickly teal glow and wisps of mist. Bottom left (Frost Reach): an ice-covered stone obelisk with a yeti skull on top, icicles hanging down, pale blue glow. Bottom right (Ashen Isle): a black basalt altar with a cracked heart-shaped stone on top, thin lava seams running down, orange glow. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `summoner_forest` `summoner_marsh` / `summoner_snow` `summoner_volcano`

## 3. ลายพื้นลานบอส 4 ภาพ → `ground_room_forest.png`, `ground_room_marsh.png`, `ground_room_snow.png`, `ground_room_volcano.png`

สร้างทีละภาพ โดยขึ้นต้นด้วยข้อความนี้ทุกภาพ แล้วต่อท้ายด้วยเนื้อหาในตาราง

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge. EXACT same fine-detail 16-bit SNES-era pixel-art style as the map ground tiles of this game: small crisp pixels, no blur. Viewed from above with no perspective. No focal point, no vignette, no borders, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. Rich surface detail but LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black. This is the floor of a boss's arena, so it is old worn stone paving rather than open ground.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_room_forest.png` | `old mossy grey flagstones with grass and small clover growing in the gaps, a few fallen leaves, muted greens and warm greys` |
| `ground_room_marsh.png` | `sunken dark slate flagstones half covered by shallow murky water and green-grey sludge, a few tiny reeds in the gaps, dull teal, olive and slate grey` |
| `ground_room_snow.png` | `pale frost-covered stone slabs with thin snow drifted into the gaps and a few hairline ice cracks, cool light greys and soft blues, lifted well above white` |
| `ground_room_volcano.png` | `cracked black basalt paving with fine ash in the gaps and only a few very thin dim orange seams, warm charcoal and soot grey` |

## 4. ของตกแต่งรอบลาน 4 ภาพ → `room_props_forest.png`, `room_props_marsh.png`, `room_props_snow.png`, `room_props_volcano.png`

สร้างทีละภาพ โดยขึ้นต้นด้วยข้อความนี้ทุกภาพ แล้วต่อท้ายด้วยเนื้อหาในตาราง

```
Now props for the walls around a boss's arena, in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the map props: dark outline, 3 to 4 tones per material, small crisp pixels. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, each base sits on an imaginary diamond-shaped footprint, light from the upper left. Generate an image: exactly 8 separate objects in a 4 columns x 2 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping. Row 1: a tall broken pillar, a short section of ruined wall, a standing brazier or torch, a large boulder. Row 2: a smaller pillar, a pile of rubble, a carved stone with a glowing rune, a dead or living tree that fits the place. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `room_props_forest.png` | `This is the bear's den deep in Emerald Forest: mossy grey stone ruins overgrown with vines and ferns, claw marks on the stone, a wooden torch with a warm flame, a big leafy oak.` |
| `room_props_marsh.png` | `This is the bog witch's lair in Misty Marsh: rotten dark-wood ruins, hanging moss and bones, a green-flamed brazier, a twisted dead tree, sickly teal glow.` |
| `room_props_snow.png` | `This is the yeti's cave in Frost Reach: ice-covered grey stone ruins with icicles, frozen bones, a cold blue-flamed brazier, a snow-laden pine.` |
| `room_props_volcano.png` | `This is the heart of Ashen Isle: burnt black basalt ruins with thin glowing cracks, an iron brazier of embers, magma crystal clusters, a charred dead tree.` |

ลำดับช่องของทุกภาพ: `pillar_0` `wall` `brazier` `boulder` / `pillar_1` `rubble` `rune_stone` `tree`

## 5. ไอคอนขนนกฟีนิกซ์ → `phoenix_icon.png`

ไอเทมชุบชีวิตในห้องบอส ขายที่ร้านพ่อค้า

```
Generate a SQUARE image: one inventory item icon for the same game, EXACT same fine-detail 16-bit SNES-era pixel-art style as the key icons above: dark outline, 3 to 4 tones per material, crisp pixels. A single Phoenix Feather: a long elegant feather of flame colours, deep red at the quill shading to orange and a bright golden tip, a few tiny glowing embers drifting off it, drawn diagonally and filling most of the image. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no labels. Do not use pink or magenta in the feather.
```
