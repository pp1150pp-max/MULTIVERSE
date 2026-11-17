# มอนสเตอร์กระดาษ 27 ตัว: prompt สำหรับเจนใน ChatGPT

เจ้าของสั่งเมื่อ 2026-11-17: มอนทุกตัวมี **ท่าเดิน 4 เฟรม** และ **ท่าตี 4 เฟรม** (ตอนนี้ในเกมมอนมีท่าเดียว เกมบีบกับยืดภาพให้ดูเหมือนขยับ)
ต้นแบบหน้าตาคือภาพทดสอบสไตล์ที่เจ้าของผ่านแล้ว อยู่ใน `art_templates/papercraft_maps/raw/ref/`
- `A2_monsters_forest_marsh.png` มอนป่ามรกตกับหนองน้ำหมอก
- `A3_monsters_snow_volcano.png` มอนดินแดนหิมะกับเกาะภูเขาไฟ
ภาพทดสอบนี้ไม่มี 2 ตัว คือหมีขั้วโลกกับภูตหิมะหมัดน้ำแข็ง สองตัวนี้ใช้คำบรรยายในตาราง

## วิธีเจน

- **เปิดแชทละแมพ** ภาพแรกของแชทแนบ A2 (แมพ 1–2) หรือ A3 (แมพ 3–4) แล้วเจนทุกตัวของแมพนั้นต่อกันในแชทเดียว
- มอนหนึ่งตัวมี 2 ภาพ: ท่าเดิน `<ชื่อ>_walk.png` กับท่าตี `<ชื่อ>_attack.png` แต่ละภาพเป็นตาราง 5 แถว (มุม) × 4 เฟรม
- เซฟไฟล์ดิบไว้ที่ `art_templates/papercraft_chars/raw/monsters/` (โฟลเดอร์ `raw/` ไม่ commit)
- ประกอบ prompt จาก 3 ส่วน: **ข้อความกลาง** + **ท่า** (เดินหรือตี) + **บรรทัดมอนตัวนั้น** จากตาราง (ช่อง "หน้าตา" กับ "ท่าตี")
- พื้นหลังม่วงแดง #FF00FF ทุกภาพ

### ข้อความกลาง (ขึ้นต้นทุกภาพ)

ภาพแรกของแชทให้ขึ้นต้นด้วยประโยคนี้ก่อน: `The attached image shows the papercraft monsters of my game. Use EXACTLY this style for everything in this chat.`

```
Same papercraft style as the attached monster sheet: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, warm soft light from the upper left. Keep the monster EXACTLY as it looks in the attached sheet (same design, colours and proportions) when it is there.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell (flying ones hover at the same height). Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no projectiles. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the monster.
```

### ท่าเดิน → `<ชื่อ>_walk.png`

```
The move: a smooth 4-frame walking loop in the direction it faces: frame 1 one side stepping forward, frame 2 passing, frame 3 the other side stepping forward, frame 4 passing, so frame 4 leads into frame 1. (A creature with no legs bounces, slithers or hovers in place with a gentle bob instead.)
```

### ท่าตี → `<ชื่อ>_attack.png`

```
The move: a 4-frame attack toward the direction it faces: frame 1 wind-up, pulling back; frame 2 striking forward; frame 3 the hit at full reach; frame 4 recovering back to its normal pose. The attack: <ใส่ช่อง "ท่าตี" ของตัวนั้น>
```

ปิดท้ายด้วย: `The monster: <ใส่ช่อง "หน้าตา" ของตัวนั้น>`

---

## แมพ 1 ป่ามรกต (แนบ A2)

| ไฟล์ | หน้าตา | ท่าตี |
|---|---|---|
| `green_slime` | the green slime: a round glossy translucent green slime blob with simple cute angry eyes | it squashes down, then leaps forward and slams its body into the target |
| `wild_rabbit` | the wild rabbit: a small tan and cream rabbit with long ears and a white puff tail | it crouches, then hops forward and kicks with its back feet |
| `forest_fox` | the forest fox: a slim orange fox with a white chest, dark legs and a bushy white-tipped tail | it crouches, then lunges forward and snaps with its jaws |
| `wild_boar` | the wild boar: a stocky dark-brown boar with a bristly mane and two small white tusks | it lowers its head, then charges forward and tosses its tusks upward |
| `forest_wolf` | the forest wolf: a lean grey wolf with a darker back, pale chest and bushy tail | it crouches low, then lunges and bites |
| `forest_bear` | the forest bear, a big heavy mini boss: a large brown bear on four legs with a lighter muzzle and small round ears | it rears up on its hind legs, then slams both front paws down with its claws out |

## แมพ 2 หนองน้ำหมอก (แนบ A2)

| ไฟล์ | หน้าตา | ท่าตี |
|---|---|---|
| `bog_toad` | the bog toad: a fat warty olive-brown swamp toad with yellow eyes and a pale belly | it puffs up, then lunges and snaps with a wide open mouth |
| `marsh_leech` | the marsh leech: a big slimy dark olive-brown leech worm rearing up, a round toothy mouth with a dark red inside, glossy highlights | it coils back, then strikes forward with its round toothy mouth |
| `swamp_serpent` | the swamp serpent: a green-teal water snake coiled with its head raised, yellow belly scales, small fins on its head | it draws its head back, then strikes forward with fangs bared |
| `mire_ghoul` | the mire ghoul: a hunched humanoid of dripping black mud and tangled roots, long arms with claws, glowing pale green eyes | it raises one clawed arm, then swipes down across in front of it |
| `will_o_wisp` | the will-o'-wisp: a floating ghostly blue-green flame spirit with a small cute-creepy face and a wispy tail, hovering slightly above the ground | it shrinks, then flares up bigger and darts forward |
| `bog_witch` | the bog witch, a large imposing boss: a tall hunched swamp hag in a tattered moss-green hooded cloak, long grey hair, a crooked wooden staff topped with a glowing teal skull lantern, mushrooms on her shoulders | she raises her staff high, then thrusts the glowing lantern forward |

## แมพ 3 ดินแดนหิมะ (แนบ A3)

| ไฟล์ | หน้าตา | ท่าตี |
|---|---|---|
| `frost_penguin` | the frost penguin: a small round penguin with a dark slate-blue back, cream belly, orange beak and a little frost on its head | it leans back, then pecks forward with its beak |
| `tusk_seal` | the tusk seal: a chubby heavy grey seal with two long ivory tusks, mottled spots and small flippers, wider than it is tall | it rears up, then slams down tusks first |
| `snow_owl` | the snow owl: a fluffy white owl with pale blue wing tips, golden eyes and short spread wings, hovering just above the ground | it spreads its wings wide, then swoops forward with its talons out |
| `snow_sprite` | the snow sprite: a small floating spirit of packed snow and pale cyan ice with a round face, a small icy crystal crown and two tiny floating hands, no legs | it pulls its tiny hands back, then pushes them forward |
| `snow_brawler` | the snow brawler, a sturdier melee cousin of the snow sprite: a floating round snow spirit with big round eyes, a determined frown, a short jagged crown of darker blue ice, no legs, and two BIG floating fists of chunky blue ice | it pulls one big ice fist back, then punches forward |
| `polar_bear` | the polar bear: a big sturdy polar bear with thick white fur, a few old healed scars on its muzzle and shoulder, and jagged chunks of blue ice stuck to its back and forelegs, tough but cute | it rears up, then swipes a front paw down |
| `yeti_minion` | the yeti minion: a stocky young yeti with shaggy blue-grey fur, a darker grey face, short rounded arms, no horns, smaller and plainer than the boss | it raises both arms, then pounds both fists down |
| `yeti` | the yeti, a huge boss: thick snow-white shaggy fur, a pale blue face, two short curved dark horns, enormous fists and big jagged blue ice crystals on its shoulders, big round eyes so it stays charming | it raises both enormous fists high, then smashes them down into the ground |

## แมพ 4 เกาะภูเขาไฟ (แนบ A3)

| ไฟล์ | หน้าตา | ท่าตี |
|---|---|---|
| `ember_wisp` | the ember wisp: a tiny round floating ball of fire with a warm orange body, a yellow glowing core, a small flame on top and a cute face, hovering just above the ground | it shrinks, then flares up bigger and darts forward |
| `salamander` | the salamander: a chubby low lizard with dark red-orange skin, a pale yellow belly, glowing ember spots along its back and a short thick tail, longer than it is tall | it rears its head back, then lunges and bites |
| `lava_bat` | the lava bat: a round little bat with charcoal fur, big ears, wide leathery wings with glowing orange veins and two tiny fangs, hovering just above the ground | it pulls its wings up, then dives forward fangs first |
| `magma_golem` | the magma golem: a big stocky golem of dark basalt blocks with glowing orange magma in the cracks, thick round arms, short legs and small kind glowing eyes | it pulls one huge stone fist back, then punches forward |
| `ash_mage` | the ash mage: a small hooded mage in a long soot-grey robe with ember-coloured trim, a shadowed face with two bright eyes, a short charred staff tipped with a burning coal | it raises its staff, then points the burning coal forward |
| `ash_knight` | the ash knight: a small round knight in dark soot-black armour with ember-coloured seams, a rounded helmet with two bright eyes in the visor, a short black sword and a small round shield | it raises its sword, then slashes down across in front of it |
| `volcano_heart` | the volcano heart, a huge boss that never walks: a living heart of molten rock standing still on a mound of black basalt, glowing orange and yellow magma in wide cracks, stone veins, small flames rising from its top, two big round glowing eyes and a small mouth | it swells up, then pulses outward hard, flames flaring |

ภูเขาไฟหัวใจ (`volcano_heart`) ไม่เดิน ท่าเดินของตัวนี้ให้เปลี่ยนเป็น: `The move: a 4-frame idle loop: it slowly swells and shrinks like a beating heart, standing still, so frame 4 leads into frame 1.`

---

## สำหรับผม: ใส่เข้าเกม

- ตอนนี้มอนในเกมใช้ `SpriteActor` (ภาพเดียวต่อมุม บีบกับยืดเอา) และ server ไม่ได้ส่งสัญญาณตอนมอนตี ต้องเพิ่ม:
  - ใน `Monster` ตอนตีจริง (ทั้งตีใกล้และยิง) ให้ส่ง `sim.anim(monster.id, 'attack', …)`
  - ฝั่งเกม: `Game.ts` `case 'anim'` ส่งต่อให้ `MonsterView` ด้วย และให้ `MonsterView` ใช้ตัวเล่นท่าที่มีท่าเดินกับท่าตี
  - ทั้งหมดผ่านสวิตช์ภาพกระดาษ ภาพเดิมยังใช้ได้
- ตัดภาพ: แผ่นละ 5 แถว × 4 เฟรม ปรับความสูงตามภาพมอนเดิมของตัวนั้น
