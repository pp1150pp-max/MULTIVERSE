# การ์ดมอนสเตอร์ papercraft: prompt เจนภาพใน ChatGPT (ชั้น 1 และชั้น 2)

เจ้าของสั่งเมื่อ 2026-11-24 · แผนระบบ [docs/plans/card-system.md](../../docs/plans/card-system.md) หัวข้อ 12 · **แทน** [art_templates/cards/PROMPTS.md](../cards/PROMPTS.md) (16-bit เลิกใช้แล้ว เก็บไว้เฉยๆ)

เกมนำภาพมาซ้อนกันเอง ภาพทุกภาพจึง**ไม่มีตัวหนังสือ**:
- **กรอบ** 3 ระดับ ใช้ร่วมกันทุกใบ (หายาก / มหากาพย์ / ตำนาน) ช่องภาพ ช่องชื่อ ช่องผลเป็นสีม่วงแดงล้วน ผมตัดเป็นช่องโปร่งใส
- **ตัวมอน** ใบละ 1 ภาพ **มีฉากหลังเต็มภาพของแมพบ้านมอนเหมือนภาพการ์ดเดิม** (เจ้าของสั่ง 2026-11-24) เกมวางเต็มช่องกลางของกรอบ ไม่ต้องตัดพื้น
- ชื่อ ผล ป้ายระดับ สัญลักษณ์กลุ่ม เกมเขียน/วางเอง

## ที่วางภาพหลังเจน

- วางทุกไฟล์ใน **`art_templates/papercraft_cards/raw/`** (โฟลเดอร์ `raw/` ไม่ commit · ห้าม `git add raw/`) ตั้งชื่อตามตารางด้านล่างเป๊ะ ๆ เป็น `.png`
- ตัดเข้าเกมด้วย `node tools/cut_paper_cards.cjs <โฟลเดอร์ raw>` → WebP 512×768 ใน `public/assets/sprites/paper/cards/` (กรอบตัดช่องม่วงแดงเป็นโปร่งใส ตำแหน่งช่องอยู่ใน `CARD_FRAME_WINDOWS` ของ `src/shared/data/cards.ts`)
- ภาพการ์ดเดิม (16-bit) ใน `public/assets/sprites/cards/card_art_*.webp` เก็บไว้ ไม่ลบ

## วิธีเจน (ทุกภาพ)

- **เปิดแชทใหม่ 1 แชทต่อกลุ่ม** (กรอบทั้ง 3 = 1 แชท · มอนแต่ละแมพ = 1 แชท) เพื่อให้สไตล์คงที่
- **ภาพแรกของทุกแชท แนบต้นแบบสไตล์:** `art_templates/papercraft_maps/raw/ref/A1_heroes.png` (ถ้าไม่มีให้ใช้ภาพแมพชั้น 2 ที่ยืนยันแล้วใน `art_templates/papercraft_maps/raw/floor2_maps/`) · **ห้ามแนบภาพพิกเซล**
- **ภาพมอน: แนบ sprite กระดาษของมอนตัวนั้นด้วยทุกครั้ง** จาก `public/assets/sprites/paper/monsters/<id>.png` (เป็นแผ่นหลายท่า ให้ใช้หน้าตา/สี/ชุดตามภาพ แต่วาดท่าใหม่ตามที่เขียน) · ที่ไม่มีไฟล์ดูหมายเหตุในตาราง
- ถ้าได้ภาพพิกเซล ให้พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- ภาพมอนต้องเป็นแนวตั้ง 2:3 อย่างน้อย 1024×1536

---

## 1. กรอบการ์ด 3 ระดับ (3 ภาพ, แนวตั้ง 2:3)

สี: หายาก = น้ำเงิน · มหากาพย์ = ม่วง · ตำนาน = ส้มอำพัน (ตามสีความหายากของไอเทม) ทั้ง 3 ใบดีไซน์เดียวกัน ต่างกันที่สีกระดาษหลักและปริมาณลวดลายประดับ

### ส่วนสไตล์ (วางก่อนทุกกรอบ)

```text
The attached image shows the papercraft art style of my game. Use EXACTLY this style: a handmade papercraft look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between the paper layers, warm soft light from the upper left. NOT pixel art, no pixels, no 16-bit look.
Generate an image: a trading card FRAME only, portrait 2:3, the frame fills the whole image edge to edge, perfectly symmetrical left and right. Layout from top to bottom: a small blank paper plate at the top centre, a large rectangular window taking about 65% of the height for the artwork, a wide blank paper nameplate under the window, and a slimmer strip at the bottom for stats. A small round cut-out hole at the top left corner for a group symbol. The artwork window, the nameplate face, the stats strip and the inside of the round hole are filled with ONE perfectly flat solid magenta (#FF00FF) with no gradient and no shadow. No text, no letters, no numbers, no monster, no character. Do not use pink, magenta or purple on the frame itself except the flat magenta windows (for the epic frame use a deep violet that is clearly darker and bluer than the magenta).
Frame:
```

| ไฟล์ | ระดับ | คำอธิบาย (ต่อท้าย `Frame:`) |
|---|---|---|
| `card_frame_rare.png` | หายาก | `a frame of layered dark navy-blue and cream card with a thin pale-blue paper trim, four small round blue paper gems in the corners, and one small paper-cut star on the top plate; only slightly more detailed than a plain frame, still the simplest of the three. Absolutely no vines, no leaves, no curls, no scrollwork, no filigree, straight clean edges; start a fresh design, do not copy the other frames` |
| `card_frame_epic.png` | มหากาพย์ | `the same frame layout in layered deep violet and cream card with paper-cut vine curls along the sides, small violet paper gems at the corners and the top plate` |
| `card_frame_legendary.png` | ตำนาน | `the same frame layout, the richest of the three: layered deep amber-orange, dark brown and gold-foil paper, thick paper-cut filigree and small spiky ornaments, a few small gold paper stars, amber paper gems at the corners and the top plate` |

---

## 2. ตัวมอนกลางการ์ด (46 ภาพ, แนวตั้ง 2:3)

### ส่วนสไตล์ (วางก่อนทุกตัว ต่อท้ายด้วย `Card monster:` แล้วคำอธิบาย แล้วปิดท้ายด้วย `Background: <คอลัมน์ฉากหลังของมอนตัวนั้น>, filled to every edge of the image.`)

```text
The first attached image shows the papercraft art style of my game; the second attached image is the approved sprite sheet of this monster. Use EXACTLY this papercraft style and keep the monster's design, colours and outfit EXACTLY as in the second image: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, built from flat paper pieces, slightly chibi proportions, warm soft light from the upper left. NOT pixel art.
Generate ONE image, portrait 2:3: a full card illustration. The monster is large and dynamic in an attack or signature pose, filling about 70% of the height, centred, slightly seen from below to look heroic, in front of a full papercraft background scene of its home area (given below) that fills the whole image edge to edge. The monster MUST stand out clearly: it is the brightest, sharpest and most saturated thing in the image, with a clean cut-paper edge and a strong light rim separating it from the scene; the background is darker, softer, less detailed and lower in contrast, in contrasting colours (cool behind a warm monster, warm behind a cool one). A soft glow behind the monster only to frame it. No frame, no border, no card edges, no text, no letters, no numbers, no UI.
Card monster:
```


### ชั้น 1 · แมพ 1 ป่ามรกต (แชทที่ 1) · ฉากหลัง: ป่าเขียวสดบนเกาะลอยกลางอวกาศ

| ไฟล์ | มอน | คำอธิบาย (ต่อท้าย `Card monster:`) | ฉากหลัง (ต่อท้าย `Background:`) |
|---|---|---|---|
| `card_art_green_slime.png` | สไลม์เขียว | `Green Slime, a round glossy translucent green slime blob with simple cute eyes, bouncing high with a splash of slime droplets` | `a sunny forest clearing with round bushes, small white flowers and dewdrops, soft blue shadows under the trees` |
| `card_art_wild_rabbit.png` | กระต่ายป่า | `Wild Rabbit, a small tan and cream rabbit with long ears and a white puff tail, leaping, with a few paper gold coins flying around it` | `a flower meadow with tall grass and daisies at the edge of the forest, blue sky with paper clouds and floating islands far away` |
| `card_art_forest_fox.png` | จิ้งจอกป่า | `Forest Fox, a slim orange fox with white chest and a bushy white-tipped tail, pouncing forward with a sharp claw-swipe trail` | `a shaded forest path between mossy trunks, cool blue-green shadows and a few falling leaves` |
| `card_art_wild_boar.png` | หมูป่า | `Wild Boar, a stocky dark-brown boar with a bristly mane and two small white tusks, charging head-first with paper dirt flying` | `a dense grove of huge twisted tree roots, a churned dirt trail and mushrooms, dim cool light` |
| `card_art_forest_wolf.png` | หมาป่า | `Forest Wolf, a lean grey wolf with pale chest and bushy tail, howling with head raised, faint red claw marks in the air` | `a rocky cliff at night on a floating island, a big pale moon, dark blue pine silhouettes and stars` |
| `card_art_forest_bear.png` | หมี (Mini Boss) | `Forest Bear, a big heavy brown bear with a lighter muzzle, rearing up on its hind legs and roaring, huge and powerful` | `a deep ancient forest with giant old trees and golden light rays falling through the leaves` |

### ชั้น 1 · แมพ 2 หนองน้ำหมอก (แชทที่ 2) · ฉากหลัง: หนองน้ำมีหมอก ต้นกก แสงเรืองสีเขียว

| ไฟล์ | มอน | คำอธิบาย | ฉากหลัง (ต่อท้าย `Background:`) |
|---|---|---|---|
| `card_art_bog_toad.png` | คางคกหนอง | `Bog Toad, a chubby round olive-brown toad with a few small warts, cream belly and a wide silly smile, sitting proudly with a few small healing bubbles rising` | `a calm pond full of big lily pads and pink water lilies, cattails and drifting mist` |
| `card_art_marsh_leech.png` | ปลิงหนอง | `Marsh Leech, a plump dark-purple worm rearing up in an S curve, its round sucker mouth wide open with many small pointed teeth, a small red glow of drained life flowing into its mouth` | `murky dark teal water with floating roots, rotting logs and rising bubbles` |
| `card_art_swamp_serpent.png` | งูหนองน้ำ | `Swamp Serpent, a small teal-blue water snake with cream-yellow belly, striking forward with a sharp paper splash` | `a reed-filled channel with a splashing stream, tall cattails and a hazy warm yellow evening sky` |
| `card_art_mire_ghoul.png` | ผีโคลน | `Mire Ghoul, rising up with mud dripping off its arms, standing firm like a wall` | `a foggy mud flat with dead crooked trees, broken fence posts and thick grey-green mist` |
| `card_art_will_o_wisp.png` | ผีไต้ไฟ | `Will-o'-Wisp, floating with swirling pale-green spirit flames around it` | `a dark misty swamp at night with silhouettes of dead trees and faint reflections on black water` |
| `card_art_bog_witch.png` | แม่มดหนอง (Boss) | `Bog Witch, casting a big spell with a glowing swamp-green orb, poison vials and a paper magic circle around her, the most dramatic and powerful pose` | `a crooked witch hut on stilts over the swamp under a giant moon, hanging lanterns and a bubbling cauldron` |

### ชั้น 1 · แมพ 3 ดินแดนหิมะ (แชทที่ 3) · ฉากหลัง: ทุ่งหิมะ ทะเลสาบน้ำแข็ง แสงออโรรา

| ไฟล์ | มอน | คำอธิบาย | ฉากหลัง (ต่อท้าย `Background:`) |
|---|---|---|---|
| `card_art_frost_penguin.png` | เพนกวินหิมะ | `Frost Penguin, a small round penguin with a dark slate-blue back, cream belly and orange beak, sliding belly-first` | `a wide frozen lake with smooth blue ice, small icebergs and a pale morning sky` |
| `card_art_tusk_seal.png` | แมวน้ำเขี้ยวยาว | `Tusk Seal, a chubby heavy grey seal with two long ivory tusks and small flippers, bracing like an unmovable rock` | `a rocky icy shore with large ice floes on dark blue sea and distant snow cliffs` |
| `card_art_snow_owl.png` | นกฮูกหิมะ | `Snow Owl, a fluffy white owl with pale blue wing tips and golden eyes, wings spread wide in flight, paper snowflakes trailing behind` | `a starry night sky with green and violet aurora above snow-covered pine tops` |
| `card_art_snow_sprite.png` | ภูตหิมะ | `Snow Sprite, a small floating spirit of packed snow and pale cyan ice with a small icy crown, casting a glowing ice shard` | `a quiet snowy pine grove at twilight with falling snowflakes and soft violet shadows` |
| `card_art_snow_brawler.png` | ภูตหิมะหมัดน้ำแข็ง | `Snow Brawler, a floating round snow spirit with a determined frown, a jagged crown of darker blue ice and two BIG fists encased in chunky blue ice, throwing a punch that cracks the air` | `an arena of broken ice pillars and jagged frost rocks, deep indigo sky and swirling snow` |
| `card_art_polar_bear.png` | หมีขั้วโลก | `Polar Bear, a big sturdy polar bear with thick white fur, old healed scars, jagged blue ice chunks on its back and forelegs, standing tall` | `a blizzard on a tundra with wind-blown snow streaks and dark blue mountains behind` |
| `card_art_yeti.png` | เยติ (Boss) | `Yeti, a huge powerful yeti with shaggy white fur, pale blue face, two short dark horns, enormous fists and jagged blue ice crystals on its shoulders, slamming the ground, the most dramatic and powerful pose` | `a high mountain peak with a huge ice cave entrance, hanging icicles and a dark stormy sky` |

### ชั้น 1 · แมพ 4 เกาะภูเขาไฟ (แชทที่ 4) · ฉากหลัง: ภูเขาไฟ ลาวา หินบะซอลต์ดำ (หัวใจภูเขาไฟ: ฉากหลังเย็น น้ำเงินเทาอมเถ้า ให้ตัวมันเป็นสีส้มสว่างอย่างเดียว)

| ไฟล์ | มอน | คำอธิบาย | ฉากหลัง (ต่อท้าย `Background:`) |
|---|---|---|---|
| `card_art_ember_wisp.png` | ลูกไฟจิ๋ว | `Ember Wisp, a tiny round floating ball of fire with orange body and yellow core and a small flame on top, with sparkling paper embers and a few gold coins` | `a night-time basalt valley with cool blue-violet smoke and tiny distant lava cracks` |
| `card_art_salamander.png` | ซาลาแมนเดอร์ | `Salamander, a chubby low lizard with dark red-orange skin, pale yellow belly and glowing ember spots along its back, basking happily` | `a steaming lava pool ringed by black basalt columns, under a dusky purple sky` |
| `card_art_lava_bat.png` | ค้างคาวลาวา | `Lava Bat, a round little bat with charcoal fur, big ears and wide wings with glowing orange veins, diving down at the viewer` | `the mouth of a smoky dark cave with hanging stalactites and cool blue-grey smoke` |
| `card_art_magma_golem.png` | โกเลมแมกมา | `Magma Golem, a big stocky golem of dark basalt blocks with glowing orange magma in the cracks, thick round arms, small kind glowing eyes, guarding like a fortress` | `a rocky gorge with a lava river below and towering black stone pillars against a dim blue-grey sky` |
| `card_art_ash_mage.png` | จอมเวทเถ้าถ่าน | `Ash Mage, a small hooded mage in a soot-grey robe with ember-coloured trim, raising a charred staff and casting a swirling ember spell` | `ruins of a burnt temple with broken columns, drifting ash and a cold indigo sky` |
| `card_art_ash_knight.png` | อัศวินเถ้าถ่าน | `Ash Knight, a small round knight in dark soot-black armour with ember-coloured seams, lunging forward with a short black sword that glows at the edge` | `a scorched fortress bridge with torn banners, falling ash and a dark slate-blue sky` |
| `card_art_volcano_heart.png` | หัวใจภูเขาไฟ (Boss) | `Volcano Heart, a huge living heart of molten rock on a small mound of black basalt, bright orange and yellow magma glowing through wide cracks, flames and embers erupting from its top, the most dramatic and powerful pose` | `a dark cool night scene of cold blue-grey ash clouds, deep indigo sky and black basalt cliffs with only a tiny faint distant volcano glow, no lava rivers and no flames in the background` |

### ชั้น 2 · แมพ 1 หาดเรือแตก (แชทที่ 5) · ต้นแบบสไตล์เพิ่ม: `raw/floor2_maps/M1_shipwreck_beach` · ฉากหลัง: หาดทรายเรือแตกใต้ท้องฟ้าทะเลเมฆ

| ไฟล์ | มอน | คำอธิบาย | ฉากหลัง (ต่อท้าย `Background:`) |
|---|---|---|---|
| `card_art_hermit_crab.png` | ปูเสฉวน | `Hermit Crab, pulling into its spiral shell with only the claws and eyes showing, the shell looking tough, ready to counter-strike` | `a wet tide pool with starfish, shells and a broken wooden mast on the sand, turquoise sea behind` |
| `card_art_thief_gull.png` | นกนางนวลขโมย | `Thief Gull, a seagull swooping down with a small bag of paper gold coins in its beak, mischievous eyes, wings wide` | `a high sky of cloud sea above a wrecked ship mast with torn sails and ropes` |
| `card_art_shock_eel.png` | ปลาไหลไฟฟ้า | `Shock Eel, a long eel curled in an S with crackling paper lightning bolts arcing from its body in several directions` | `a dark rocky shallow lagoon with seaweed and sunken planks under a deep blue evening sky` |
| `card_art_spike_turtle.png` | เต่าหลังหนาม | `Spike Turtle, a sturdy turtle with a shell covered in sharp thorns, planted firmly and snapping, with a faint glint on the spikes` | `a pebble beach with driftwood, coral rocks and rolling paper waves under a warm peach sunset` |
| `card_art_cannon_crab.png` | ปูยักษ์กระดองปืนใหญ่ (Boss) | `Giant Cannon Crab, a huge crab with big claws and a ship's cannon built into its shell, raised claws and the cannon firing a smoky shot, the most dramatic and powerful pose` (ไม่มีไฟล์ sprite กระดาษ ให้แนบภาพแมพ 1 แทน) | `a great shipwreck broken on the beach, scattered cannons and barrels, a stormy cloud-sea sky` |

### ชั้น 2 · แมพ 2 อ่าวลักลอบ (แชทที่ 6) · ต้นแบบสไตล์เพิ่ม: `raw/floor2_maps/M2_smugglers_cove` · ฉากหลัง: อ่าวลักลอบ หน้าผา เรือโจรสลัด ถังดินปืน

| ไฟล์ | มอน | คำอธิบาย | ฉากหลัง (ต่อท้าย `Background:`) |
|---|---|---|---|
| `card_art_prisoner.png` | นักโทษในเรือ | `Ship Prisoner in a striped bandana with an iron ball chained to his leg, swinging the heavy iron ball overhead to throw it` | `the dim hold of a prison ship with iron bars, hanging chains and a single warm lantern` |
| `card_art_cutlass_pirate.png` | โจรสลัดดาบโค้ง | `Cutlass Pirate, slashing a curved cutlass in a wide arc with a paper slash trail, a grin on his face` | `the wooden deck of a pirate ship docked in a hidden cove, ropes, sails and high cliffs behind` |
| `card_art_shotgunner.png` | มือปืนลูกซอง | `Blunderbuss Pirate, firing a big flared blunderbuss with a fan of paper pellets and smoke spreading out in front` | `a smugglers dock at dusk stacked with crates and barrels, lanterns and a moored boat` |
| `card_art_keg_prisoner.png` | นักโทษถังดินปืน | `Powder-Keg Prisoner, hugging a small powder keg with a lit fuse, about to throw it, a faint warning glow around the keg` | `a dark cave storeroom full of powder barrels and rope coils, cool blue shadows` |
| `card_art_parrot.png` | นกแก้วคู่ใจ (การ์ดมหากาพย์ · เจ้าของสั่ง 2026-11-25) | `Captain's Parrot, a bright red, blue and yellow pirate parrot diving at the viewer with wings spread wide and claws out, squawking, a glowing paper target ring marked on the ground below it, the most dramatic pose` (sprite `parrot.png`) | `the stormy sky above the captain's ship with taut sails, rigging ropes and distant gunboats firing, warm orange-violet light` |
| `card_art_pegleg_captain.png` | กัปตันขาไม้ (Boss) | `Peg-Leg Captain, striking a commanding pose with his cutlass raised and a big ship's anchor on a chain in the other hand, the parrot on his shoulder, the most dramatic and powerful pose` (sprite ชื่อ `peg_captain.png`) | `the captain's ship at the mouth of the cove with a black skull flag, cannons and a dramatic orange-violet storm sky` |

### ชั้น 2 · แมพ 3 สุสานเรือผี (แชทที่ 7) · ต้นแบบสไตล์เพิ่ม: `raw/floor2_maps/M3_ghost_ship_graveyard` · ฉากหลัง: ซากเรือผี หมอกเขียวอมฟ้า · ทุกตัวโปร่งแสง เขียวอมฟ้า

| ไฟล์ | มอน | คำอธิบาย | ฉากหลัง (ต่อท้าย `Background:`) |
|---|---|---|---|
| `card_art_ghost_monkey.png` | ลิงกะลาสีผี | `Ghost Monkey Sailor, a translucent teal-green ghost monkey in a tattered sailor shirt, throwing a glowing ghost skull` | `a tangle of rotting ship rigging and broken masts in teal-green mist under a dim moon` |
| `card_art_ghost_sailor.png` | กะลาสีผี | `Ghost Sailor, a translucent pale-teal ghost sailor fading in and out, lunging with a rusty hook` | `the slanted deck of a sunken ghost ship with torn sails and pale floating lanterns in fog` |
| `card_art_ghost_siren.png` | ไซเรนผี | `Ghost Siren, a translucent teal ghost woman with flowing hair singing with her mouth open, paper sound-waves rippling outward` | `a jagged rock in a misty black sea beside a half-sunk ship, soft violet moonlight and ripples` |
| `card_art_barnacle_crew.png` | ลูกเรือหอยเกาะผี | `Barnacle Ghost Crewman, a translucent ghost sailor covered in barnacles and shells, the shells cracking as if about to burst` | `a barnacle-covered ship hull with anchor chains, coral and seaweed in murky teal fog` |
| `card_art_ghost_captain.png` | กัปตันผีเรือคนตาย (Boss) | `Ghost Captain of the Dead Ship, a tall translucent teal ghost captain in a tattered coat and hat, ghostly fog curling around him, a ship's bell in one hand, the most dramatic and powerful pose` | `a huge ghost galleon with glowing portholes and a ruined ship bell, rows of wrecks and a stormy dark sky` |

### ชั้น 2 · แมพ 4 วังวนกลางทะเล (แชทที่ 8) · ต้นแบบสไตล์เพิ่ม: `raw/floor2_maps/M4_kraken_maelstrom` · ฉากหลัง: น้ำวนยักษ์กลางทะเล หมอกน้ำเย็น

| ไฟล์ | มอน | คำอธิบาย | ฉากหลัง (ต่อท้าย `Background:`) |
|---|---|---|---|
| `card_art_shark_knight.png` | อัศวินฉลาม | `Shark Knight, a shark-headed knight in dark armour bursting upward with only his fin and head showing, jaws open, sword raised` | `choppy deep-blue sea with spray, broken planks and the edge of a whirlpool behind` |
| `card_art_seahorse_soldier.png` | ม้าน้ำทหาร | `Seahorse Soldier, an armoured seahorse with a small helmet, spitting a large floating bubble` | `a coral reef shallows with floating bubbles and shell fragments, soft aqua light` |
| `card_art_ghost_pirate_king.png` | ราชาโจรสลัดผี | `Ghost Pirate King, a translucent ghost king fused with sea creatures (octopus tentacles, crab claw, fish fins, shells), swinging a sword that sends a straight wave of energy` | `a throne of wrecked ships and treasure at the rim of a whirlpool under a dark violet sky` |
| `card_art_kraken_tentacle.png` | หนวดคราเคน | `Kraken Tentacle, a single huge purple tentacle with suckers rising up out of the water and slamming down in a long sweep` | `a foaming whirlpool surface with floating debris and a grey-blue storm horizon` |
| `card_art_kraken.png` | คราเคน (Boss) | `Kraken, a gigantic kraken with a huge head and many thick tentacles spread around it, glaring eyes, the most dramatic and powerful pose` | `a gigantic maelstrom swallowing ships in a thunderstorm with paper lightning and towering waves, cold dark blue colours` |

**หมายเหตุ id ชั้น 2 แมพ 3–4:** ชื่อไฟล์ใช้ id ตามแผน (`FLOOR2_PLAN.md`) ถ้าแมพ 3–4 ตั้ง id ต่างไป ผมจะเปลี่ยนชื่อไฟล์ให้ ไม่ต้องเจนใหม่

---

## สรุปจำนวนภาพที่ต้องเจน

| กลุ่ม | ภาพ |
|---|---|
| กรอบ 3 ระดับ | 3 |
| มอนชั้น 1 (แมพ 1–4) | 26 |
| มอนชั้น 2 แมพ 1–4 | 20 |
| นกแก้วคู่ใจ (การ์ดมหากาพย์ชั้น 2, เพิ่ม 2026-11-25) | 1 |
| **รวม** | **50** |

ภาพที่ควรเจนก่อน: กรอบ 3 + ชั้น 1 ทั้งหมด (29) เพราะชั้น 1 มีการ์ดในเกมแล้ว
