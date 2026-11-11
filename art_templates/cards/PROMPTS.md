# การ์ดมอนสเตอร์: prompt สำหรับสร้างภาพใน ChatGPT

แผนระบบอยู่ที่ [docs/plans/card-system.md](../../docs/plans/card-system.md) · สไตล์ 16-bit SNES แบบเดียวกับภาพอื่นในเกม
ภาพการ์ดใบใหญ่ไม่ได้วาดเป็นภาพเดียว แต่แยกเป็น **กรอบ** (3 ระดับ) กับ **ภาพมอน** (26 ใบ) แล้วเกมนำมาซ้อนกัน
ชื่อการ์ด ผล และป้ายระดับเป็น**ข้อความที่เกมเขียนเอง** ภาพจึงต้องไม่มีตัวหนังสือ

- **ที่เซฟ:** `art_templates/cards/raw/` ตั้งชื่อไฟล์ตามตาราง โฟลเดอร์นี้ไม่ได้ commit
- **หลังเซฟ:** Claude จะลบพื้นหลัง ตัด และย่อเข้าเกม (ใน PR ใส่ภาพ)
- **ระหว่างรอภาพ:** เกมใช้กรอบและไอคอนแบบ CSS ไปก่อน
- **ให้ภาพมอนตรงกับในเกม:** แนบ sprite ของมอนตัวนั้นจาก `public/assets/sprites/monsters/<id>.png` ไปกับ prompt ด้วยทุกครั้ง

---

## 1. กรอบการ์ด 3 ระดับ (3 ภาพ, แนวตั้ง 2:3)

สร้างทีละภาพในแชทเดียวกัน **แนบ `public/assets/sprites/ui/inventory.png` (หน้าต่างกระเป๋า) ไปเป็นตัวอย่างสีและวัสดุทุกครั้ง**
ทั้ง 3 ระดับเป็นเหล็กดำที่ตีขึ้นรูปกับบรอนซ์เก่าหม่นแบบเดียวกับ UI ของเกม และ**ต่างกันแค่ของประดับเล็ก ๆ** คือสีอัญมณีที่หม่นกับปริมาณลวดลายบรอนซ์ ห้ามเงาวับ ห้ามสีสด
ช่องกลาง ช่องชื่อ และช่องผลต้องเป็นสีม่วงแดงล้วน เพื่อให้เกมตัดออกแล้ววางภาพมอนกับข้อความลงไป

> รอบแรก (2026-11-11) กรอบออกมาเงาวับและสีสดแบบเกมการ์ดทั่วไป จึงไม่เข้ากับ UI ของเกม prompt ด้านล่างแก้ไขแล้ว

### ส่วนสไตล์

```text
A card FRAME in the EXACT same art style, materials and colours as the attached inventory window: fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur, original dark gothic design made of black forged iron with restrained, tarnished aged-bronze accents, dim and weathered, low contrast. The dark iron must dominate. Nothing shiny, glossy, bright, clean or saturated; no bright silver, no bright gold, no bright blue or purple, no white, no sparkles, no lens flare. Any gem or star must be small, few, dull and tarnished. Portrait 2:3 image, the frame fills the whole image edge to edge, perfectly symmetrical left and right, with one solid unbroken iron outer edge. Layout from top to bottom: a small blank aged-bronze plate at the top center (clear face, nothing overlapping it), a large recessed window taking about 65% of the height for the artwork, a wide blank aged-bronze nameplate under the window, and a slimmer recessed strip at the bottom for stats. A small round recessed iron socket at the top left corner for a group symbol. The artwork window, the nameplate face, the stats strip and the inside of the round socket are filled with ONE perfectly flat solid magenta (#FF00FF) with no gradient. No text, no letters, no numbers, no monster, no character. Do not use pink, magenta or purple on the frame itself.
Frame:
```

| ไฟล์ | ระดับ | คำอธิบาย (ต่อท้าย `Frame:`) |
|---|---|---|
| `card_frame_rare.png` | หายาก | `the plainest of the three: plain riveted black iron with thin dull bronze edging, and four tiny dull dark-blue stones set in the corners` |
| `card_frame_epic.png` | มหากาพย์ | `the same iron frame with a few more engraved bronze vines along the sides, and small dull dark-violet stones at the corners and the top plate` |
| `card_frame_legendary.png` | ตำนาน | `the richest of the three but still dark and tarnished: thicker aged-bronze filigree and small spiky gothic ornaments on the iron, a few small dull bronze stars like the inventory window's, and small dim ember-orange stones at the corners and the top plate` |

## 2. ภาพมอนในการ์ด (26 ภาพ, แนวตั้ง 2:3)

สร้างทีละภาพ โดยวาง **ส่วนสไตล์** แล้วต่อคำอธิบายของมอนแต่ละตัวท้าย `Card art:`
และแนบ sprite ของมอนตัวนั้นทุกครั้ง

### ส่วนสไตล์

```text
Full card illustration for a 16-bit SNES-era fantasy RPG trading card, in the EXACT same fine-detail pixel-art style and the EXACT same creature design as the attached sprite: dark outline, 3 to 4 tones per material, small crisp pixels, no chunky pixels, cute slightly chibi game proportions. Portrait 2:3 image. The creature is large and dynamic in an attack or signature pose, filling about 70% of the image, slightly from below to look heroic, with a full detailed background scene of its home area that fills the whole image edge to edge. The creature MUST stand out clearly from the background: it is the brightest, sharpest and most saturated thing in the image, with a strong light rim and a clean dark outline separating it from the scene. The background is darker, softer, less detailed and lower in contrast, and uses a contrasting colour (cool colours behind a warm creature, warm colours behind a cool creature), never the same colour as the creature. A soft glow behind the creature only to frame it. No text, no letters, no numbers, no frame, no border, no card edges, no UI.
Card art:
```

**แมพ 1 ป่ามรกต** (ฉากหลัง: ป่าเขียวสดบนเกาะลอยกลางอวกาศ)

| ไฟล์ | มอน | คำอธิบาย (ต่อท้าย `Card art:`) |
|---|---|---|
| `card_art_green_slime.png` | สไลม์เขียว | `Green Slime, a round glossy translucent green slime blob with simple cute eyes, bouncing high with a splash of slime droplets, in a sunny forest clearing` |
| `card_art_wild_rabbit.png` | กระต่ายป่า | `Wild Rabbit, a small tan and cream rabbit with long ears and a white puff tail, leaping through tall grass and flowers, with a few gold coins flying around it` |
| `card_art_forest_fox.png` | จิ้งจอกป่า | `Forest Fox, a slim orange fox with white chest, dark legs and a bushy white-tipped tail, pouncing forward with a sharp claw swipe trail, in a shaded forest path` |
| `card_art_wild_boar.png` | หมูป่า | `Wild Boar, a stocky dark-brown boar with a bristly mane and two small white tusks, charging head-first and kicking up dirt, among thick tree roots` |
| `card_art_forest_wolf.png` | หมาป่า | `Forest Wolf, a lean grey wolf with darker back, pale chest and bushy tail, howling on a rock under a big moon, with faint red claw marks in the air` |
| `card_art_forest_bear.png` | หมี (Mini Boss) | `Forest Bear, a big heavy brown bear with a lighter muzzle and small round ears, rearing up on its hind legs and roaring, huge and powerful, in a deep old forest with golden light rays` |

**แมพ 2 หนองน้ำหมอก** (ฉากหลัง: หนองน้ำมีหมอก ต้นกก และแสงเรืองสีเขียว)

| ไฟล์ | มอน | คำอธิบาย |
|---|---|---|
| `card_art_bog_toad.png` | คางคกหนอง | `Bog Toad, a chubby round olive-brown toad with a few small warts, a pale cream belly, big golden eyes and a wide silly smile, sitting proudly on a lily pad with small healing bubbles rising` |
| `card_art_marsh_leech.png` | ปลิงหนอง | `Marsh Leech, a plump soft dark-purple worm rearing up in a gentle S curve, glossy highlights, two big cute eyes, its round sucker mouth wide open showing a ring of many small sharp pointed teeth (this card only, unlike the toothless in-game sprite), a small red glow of drained life flowing into its mouth, in murky water` |
| `card_art_swamp_serpent.png` | งูหนองน้ำ | `Swamp Serpent, a small cute teal-blue water snake with cream-yellow belly scales, big eyes and small rounded fins on its head, striking forward out of the water with a sharp splash` |
| `card_art_mire_ghoul.png` | ผีโคลน | `Mire Ghoul, the same design as the attached sprite, rising out of thick mud with mud dripping off its arms, standing firm like a wall, in a foggy swamp` |
| `card_art_will_o_wisp.png` | ผีไต้ไฟ | `Will-o'-Wisp, the same design as the attached sprite, floating with swirling pale-green spirit flames around it, lighting up a dark misty swamp at night` |
| `card_art_bog_witch.png` | แม่มดหนอง (Boss) | `Bog Witch, the same design as the attached sprite, casting a big spell with a glowing swamp-green orb, poison vials and a magic circle around her, a giant moon behind her, the most dramatic and powerful pose` |

**แมพ 3 ดินแดนหิมะ** (ฉากหลัง: ทุ่งหิมะ ทะเลสาบน้ำแข็ง และแสงออโรรา)

| ไฟล์ | มอน | คำอธิบาย |
|---|---|---|
| `card_art_frost_penguin.png` | เพนกวินหิมะ | `Frost Penguin, a small round penguin with a dark slate-blue back, cream belly, orange beak and a little frost on its head, sliding belly-first across the ice` |
| `card_art_tusk_seal.png` | แมวน้ำเขี้ยวยาว | `Tusk Seal, a chubby heavy grey seal with two long ivory tusks, mottled spots and small flippers, bracing on a big ice floe like an unmovable rock` |
| `card_art_snow_owl.png` | นกฮูกหิมะ | `Snow Owl, a fluffy white owl with pale blue wing tips and golden eyes, wings spread wide in flight with glittering snowflakes trailing behind, under an aurora sky` |
| `card_art_snow_sprite.png` | ภูตหิมะ | `Snow Sprite, a small floating spirit made of packed snow and pale cyan ice, with a round face, small icy crystal crown and two tiny floating hands, casting a glowing ice shard` |
| `card_art_snow_brawler.png` | ภูตหิมะหมัดน้ำแข็ง | `Snow Brawler, a floating round snow spirit with a stocky body, a small determined frown, a jagged crown of darker blue ice and two BIG fists encased in chunky blue ice, throwing a punch that cracks the air` |
| `card_art_polar_bear.png` | หมีขั้วโลก | `Polar Bear, a big sturdy polar bear with thick white fur, a few old healed scars across its muzzle and shoulder, jagged chunks of blue ice on its back and forelegs, standing tall in a snowstorm` |
| `card_art_yeti.png` | เยติ (Boss) | `Yeti, a huge powerful yeti with thick snow-white shaggy fur, a pale blue face, two short curved dark horns, enormous fists and big jagged blue ice crystals growing from its shoulders, slamming the ground and shattering the ice, the most dramatic and powerful pose` |

**แมพ 4 เกาะภูเขาไฟ** (ฉากหลัง: ภูเขาไฟ ลาวา และหินบะซอลต์สีดำ)

| ไฟล์ | มอน | คำอธิบาย |
|---|---|---|
| `card_art_ember_wisp.png` | ลูกไฟจิ๋ว | `Ember Wisp, a tiny round floating ball of fire with a warm orange body, a yellow glowing core, a small flame on top and a cute face, surrounded by sparkling embers and a few gold coins` |
| `card_art_salamander.png` | ซาลาแมนเดอร์ | `Salamander, a chubby low lizard with dark red-orange skin, a pale yellow belly, glowing ember spots along its back and a short thick tail, basking happily in a warm glowing lava pool` |
| `card_art_lava_bat.png` | ค้างคาวลาวา | `Lava Bat, a round little bat with charcoal fur, big ears, wide leathery wings with glowing orange veins and two tiny fangs, diving down at the viewer out of a smoky cave` |
| `card_art_magma_golem.png` | โกเลมแมกมา | `Magma Golem, a big stocky golem built from dark basalt blocks with glowing orange magma in the cracks, thick round arms and small kind glowing eyes, guarding a lava river like a fortress` |
| `card_art_ash_mage.png` | จอมเวทเถ้าถ่าน | `Ash Mage, a small hooded mage in a long soot-grey robe with ember-coloured trim, a round shadowed face with two bright eyes, raising a charred staff and casting a swirling ember spell` |
| `card_art_ash_knight.png` | อัศวินเถ้าถ่าน | `Ash Knight, a small round knight in dark soot-black armour with ember-coloured seams, a rounded helmet with two bright eyes, lunging forward with a short black sword that glows at the edge` |
| `card_art_volcano_heart.png` | หัวใจภูเขาไฟ (Boss) | `Volcano Heart, a huge living heart of molten rock on a mound of black basalt, a big rounded dark rock heart with bright orange and yellow magma glowing through wide cracks, thick stone veins, flames and embers erupting from its top, the most dramatic and powerful pose. It is the ONLY bright orange thing in the image: the background is a dark cool night scene of cold blue-grey ash clouds, deep indigo sky and black basalt cliffs, with only a tiny faint distant volcano glow, no lava rivers and no flames in the background, so the heart clearly pops out` |

## 3. ไอคอน (ใช้ส่วนสไตล์ของไอคอนกระเป๋าเดิม)

ใช้ **ส่วนสไตล์** จาก [art_templates/stones/PROMPTS.md](../stones/PROMPTS.md) แล้วต่อคำอธิบายท้าย `Item:`
ของที่เป็นกรอบหรือ UI (การ์ดเล็ก การ์ดคว่ำ สัญลักษณ์กลุ่ม รู) ให้ใช้โทนเหล็กดำกับบรอนซ์หม่นแบบหน้าต่างกระเป๋าเหมือนกรอบการ์ด และแนบ `inventory.png` ไปด้วย
ไอคอนการ์ดในกระเป๋าเกมจะย่อจากภาพมอนในหัวข้อ 2 ลงบนกรอบเล็กตามระดับ จึงไม่ต้องเจนไอคอนแยกทีละใบ

| ไฟล์ | ภาพ | คำอธิบาย (ต่อท้าย `Item:`) |
|---|---|---|
| `stone_drill.png` | หินเจาะรู | `a hard dark grey stone shaped like a short drill bit with a spiral groove, a bright steel tip and a small glowing white spark at the point` |
| `card_icon_rare.png` | การ์ดเล็กหายาก (กรอบไอคอน) | `a small blank trading card standing upright, plain black iron border with thin dull bronze edging and tiny dull dark-blue corner stones, the card face filled with flat solid magenta (#FF00FF)` |
| `card_icon_epic.png` | การ์ดเล็กมหากาพย์ | `a small blank trading card standing upright, black iron border with a few dull bronze vines and tiny dull dark-violet corner stones, the card face filled with flat solid magenta (#FF00FF)` |
| `card_icon_legendary.png` | การ์ดเล็กตำนาน | `a small blank trading card standing upright, black iron border with thicker tarnished bronze filigree and tiny dim ember-orange corner stones, the card face filled with flat solid magenta (#FF00FF)` |
| `card_back.png` | การ์ดคว่ำบนพื้น | `a single trading card lying face down at a slight angle, a black iron card back with a small tarnished bronze star-and-portal emblem in the center, only a faint dim glow around its edge` |
| `card_group_weapon.png` | สัญลักษณ์กลุ่มอาวุธ | `a small round emblem badge with a crossed sword and gun in tarnished bronze on dark iron, with a dull dark-red tint` |
| `card_group_armor.png` | สัญลักษณ์กลุ่มเกราะ | `a small round emblem badge with a heater shield in tarnished bronze on dark iron, with a dull dark-blue tint` |
| `card_group_accessory.png` | สัญลักษณ์กลุ่มเครื่องประดับ | `a small round emblem badge with a ring and a pendant in tarnished bronze on dark iron, with a dull dark-green tint` |
| `socket_empty.png` | รูว่าง | `a small round empty socket hole drilled into dark metal, a dark hollow center with a thin tarnished bronze rim` |
| `socket_filled.png` | รูมีการ์ด | `a small round socket in dark metal holding a tiny glowing card-shaped crystal, with only a faint dim glow` |
| `forge_drill.png` | เมนูเจาะรู | `a blacksmith hand drill with a wooden handle and a steel spiral bit, with a few metal shavings` |
| `forge_socket.png` | เมนูเสียบการ์ด | `a small trading card being slid into a glowing round socket on a piece of armour` |
| `forge_fuse.png` | เมนูรวมการ์ด | `three small trading cards fanned out and merging into one card in the middle with a faint dim glow` |
| `market_cards.png` | หมวดการ์ดในตลาด | `a neat stack of three trading cards with a small gold coin on top` |

## 4. เอฟเฟกต์ (ทำทีหลังได้)

ใช้ **ส่วนสไตล์** ของไอคอนเหมือนหัวข้อ 3 แต่ขอเป็นแถบภาพเรียงซ้ายไปขวา

| ไฟล์ | ภาพ | คำอธิบาย (ต่อท้าย `Item:`) |
|---|---|---|
| `fx_card_break.png` | การ์ดแตก | `a horizontal strip of 6 equal frames, left to right: a small glowing trading card, the card cracking, the card splitting into pieces, pieces flying apart, small fading shards, a last few sparkles. Same size and center in every frame, generous empty space between frames` |
| `fx_drill.png` | เจาะรู | `a horizontal strip of 6 equal frames, left to right: a steel drill bit touching metal, sparks starting, a burst of bright sparks, a small round hole glowing, the glow fading, a clean finished round hole. Same size and center in every frame, generous empty space between frames` |

แสงพุ่งหลังการ์ดในหน้าต่างดูการ์ด และการเอียงการ์ดตามเมาส์ ทำด้วย CSS ไม่ต้องเจนภาพ
