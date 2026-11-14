# ไอคอนสกิล (ระบบสกิลใหม่ 2026-11-14)

เจ้าของเจนเองจาก ChatGPT ส่วน AI มีหน้าที่เขียน prompt ไว้ที่นี่เท่านั้น ห้ามเปิด ChatGPT เอง

ขั้นตอนหลังได้ภาพ:
1. เซฟภาพดิบไว้ที่ `art_templates/skills/raw/<ชื่อไฟล์>.png` (ไม่ต้อง commit)
2. ย่อเป็น 128×128 แล้วเซฟเป็น `public/assets/sprites/icons/skill_<id>.png` โดย `<id>` ต้องตรงกับ id ของสกิลใน `src/shared/data/classes.ts`

สกิลที่ยังไม่มีไฟล์จะแสดงไอคอนว่าง (`ico_blank`) ไปก่อน ส่วนกรอบทองของอัลติเป็น CSS ในหน้าต่างสกิล ภาพไม่ต้องวาดกรอบพิเศษ

## แม่แบบ (ใช้กับทุกสกิล)

แนบไฟล์ไอคอนเดิมของคลาสนั้นไปเป็นตัวอย่างสไตล์:
- นักดาบ: `icons/skill_whirlwind.png`
- เมจ: `icons/skill_fireball.png`
- Gunslinger: `icons/skill_pierce.png`

จากนั้นแทนที่ `<SYMBOL>` ด้วยคำบรรยายของสกิลนั้น session ของแต่ละคลาสจะเติมรายการของแต่ละสกิลไว้ท้ายไฟล์นี้หลังเจ้าของอนุมัติตารางสกิล

```
One single RPG skill icon in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the attached skill icon:
crisp pixels, rich shading, no blur. A perfect square icon with a dark painted background in a muted deep blue-grey,
a thin bronze-gold bevelled border, and one big bold clear symbol that reads instantly at very small size: <SYMBOL>.
The icon fills the whole image. No text, no letters, no numbers.
```

## ไอคอนเมนู "สกิล" (`ico_skills.png`)

ตอนนี้ปุ่มสกิลแถวบนขวาและในเมนูใช้ไอคอนว่างกับ ⚔ ไปก่อน ถ้าจะทำไอคอนจริง:
- แนบ `public/assets/sprites/ui/ico_bag.png` ไปเป็นตัวอย่างสไตล์
- เซฟภาพดิบเป็น `raw/ico_skills.png`
- ภาพที่ใช้ในเกมคือไฟล์ 96×96 ที่ลบพื้นแมเจนตาออกแล้ว เซฟที่ `public/assets/sprites/ui/ico_skills.png`
- จากนั้นเปลี่ยน `SKILLS_ICON` ใน `src/client/sysmenu.ts` เป็น `badge('skills')`

```
Using the attached round menu badge as the exact style and colour reference, generate ONE matching round menu badge
in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur: the same black forged iron ring with tarnished
aged-bronze accents, and inside it a bold clear symbol of an open glowing spellbook with a small crossed sword and
lightning bolt rising from its pages. Centred, with empty space around it. Background ONE perfectly flat solid
magenta (#FF00FF), no shadows on it. No readable words, no logos. Do not use pink, magenta or purple in the badge.
```

## Gunslinger (30 ท่าใหม่ + พาสซีฟ 3, อนุมัติ 2026-11-14)

ยิงรัว (`rapidfire`) กระสุนเจาะเกราะ (`pierce`) และยิงหัว (`headshot`) มีไอคอนอยู่แล้ว
ท่าอื่นใช้แม่แบบด้านบน แนบ `icons/skill_pierce.png` แล้วแทนที่ `<SYMBOL>` ด้วยข้อความในคอลัมน์ขวา
ใส่สีของสายไว้ในคำบรรยาย: สายคริติคอลสีแดง (#ff5a6a) สายยิงเร็วสีเหลืองอำพัน (#ffc85a) สายอาวุธพิเศษสีฟ้าเขียว (#7affe0)

**สายคริติคอล/เล็งแม่น (แดง)**

| ไฟล์ | ชื่อ | `<SYMBOL>` |
|---|---|---|
| `skill_gs_deadeye.png` | เล็งจุดตาย | a glowing red crosshair locked onto a small skull-shaped weak point, with a red target mark |
| `skill_gs_aimedshot.png` | ยิงประณีต | a long revolver barrel seen from the side with a thin red aiming line and a tiny scope glint |
| `skill_gs_ricochet.png` | กระสุนสะท้อน | a single bullet trail zig-zagging and bouncing off three points in sharp red streaks |
| `skill_gs_counter.png` | ยิงสวนกลับ | a gunslinger silhouette leaping backwards while a pistol fires forward, red motion arc |
| `skill_gs_weakspot.png` | เจาะจุดอ่อน | a cracked steel armour plate with a bullet punching through the crack, red sparks |
| `skill_gs_finisher.png` | ยิงปิดฉาก | a smoking pistol muzzle over a nearly empty red health bar shattering |
| `skill_gs_lockon.png` | ล็อกเป้า | a square red lock-on reticle with four arrows closing in, and five small bullets in a row |
| `skill_gs_sniperfocus.png` | โฟกัสสไนเปอร์ (อัลติ) | a sniper scope lens with a glowing red eye reflected in it and a sharp crosshair |

**สายยิงเร็ว (เหลืองอำพัน) — เสริมการยิงปกติ**

| ไฟล์ | ชื่อ | `<SYMBOL>` |
|---|---|---|
| `skill_gs_hotrounds.png` | กระสุนร้อน | three glowing orange-hot bullets with heat shimmer |
| `skill_gs_quickreload.png` | รีโหลดฉับไว | a revolver cylinder spinning with amber speed lines and bullets snapping in |
| `skill_gs_doubletap.png` | ยิงสองนัด | two amber bullets flying side by side from one muzzle flash |
| `skill_gs_shockrounds.png` | กระสุนช็อต | an amber bullet wrapped in crackling blue-white electric arcs |
| `skill_gs_stackfire.png` | ยิงย้ำเป้า | a target with several bullet holes stacked in the bullseye, amber glow growing |
| `skill_gs_splitshot.png` | กระสุนแยก | one amber bullet splitting into three diverging trails |
| `skill_gs_piercerounds.png` | กระสุนทะลวง | a long amber bullet piercing straight through a row of three thin plates |
| `skill_gs_overdrive.png` | โอเวอร์ไดรฟ์ (อัลติ) | a pistol glowing white-hot amber with a roaring flame trail and a speed gauge maxed out |
| `skill_gs_bulletstorm.png` | พายุลูกกระสุน (อัลติ) | a wide fan of many amber bullets bursting out of twin pistols like a storm |

**สายอาวุธพิเศษ (ฟ้าเขียว)**

| ไฟล์ | ชื่อ | `<SYMBOL>` |
|---|---|---|
| `skill_gs_explosive.png` | กระสุนระเบิด | a chunky teal-tipped shell bursting into a round explosion |
| `skill_gs_incendiary.png` | กระสุนเพลิง | a bullet trailing fire, setting a small teal-and-orange flame |
| `skill_gs_mine.png` | กับระเบิด | a round metal land mine with a blinking teal light half-buried in dirt |
| `skill_gs_smoke.png` | ระเบิดควัน | a canister grenade releasing a thick grey smoke cloud with a teal pin |
| `skill_gs_railgun.png` | กระสุนรางแม่เหล็ก | a heavy twin-rail gun barrel firing a straight teal energy beam |
| `skill_gs_drone.png` | โดรนสนับสนุน | a small hovering four-rotor drone with a tiny gun and a teal eye light |
| `skill_gs_seeker.png` | จรวดติดตาม | three small rockets with teal exhaust curving toward a target |
| `skill_gs_cluster.png` | ระเบิดลูกปราย | one bomb breaking apart into several small teal bomblets |
| `skill_gs_rocketrain.png` | ฝนจรวด (อัลติ) | many rockets falling diagonally from the sky onto a glowing teal circle |
| `skill_gs_turret.png` | ป้อมปืนพกพา (อัลติ) | a compact tripod gun turret with a teal sensor light, firing |

**พาสซีฟ**

| ไฟล์ | ชื่อ | `<SYMBOL>` |
|---|---|---|
| `skill_gs_hawkeye.png` | สายตาเหยี่ยว | a hawk's sharp eye merged with a red crosshair |
| `skill_gs_triggerfinger.png` | นิ้วไกไว | a finger on a revolver trigger with amber motion blur |
| `skill_gs_specialammo.png` | กระสุนพิเศษ | an open ammo belt of mixed special shells glowing teal |

## เมจ (`skill_mg_*.png`) — เจ้าของอนุมัติตาราง 2026-11-14

แนบ `icons/skill_fireball.png` เป็นตัวอย่างสไตล์ แล้วใส่ข้อความในคอลัมน์ SYMBOL แทน `<SYMBOL>` ในแม่แบบด้านบน
สีหลักตามสาย: สาย 1 ส้มไฟ · สาย 2 เขียวพิษ · สาย 3 ฟ้าน้ำแข็ง · พาสซีฟ ม่วงอาคมกับทอง
ลูกไฟ วงน้ำแข็ง และอุกกาบาตมีไอคอนเดิมแล้ว

| ไฟล์ | ท่า | SYMBOL |
|---|---|---|
| `skill_mg_arcanelance.png` | หอกอาร์เคน | a long glowing orange-violet arcane spear of light flying diagonally, piercing through three small dark silhouettes in a row |
| `skill_mg_chainlightning.png` | สายฟ้าฟาด | a bright blue-white forked lightning bolt jumping in a zigzag chain between three glowing impact sparks |
| `skill_mg_manaburst.png` | ระเบิดมานา | a round burst of orange-gold mana energy exploding outward from a central point with radiating shards |
| `skill_mg_flamewave.png` | คลื่นเพลิง | a wide fan-shaped wave of roaring orange flames sweeping forward |
| `skill_mg_volatileorb.png` | ลูกแก้วระเบิด | a large unstable glowing orange glass orb with cracks of fire leaking light, about to explode |
| `skill_mg_crystalrain.png` | ฝนผลึก | many sharp pale amber crystal shards falling from above onto a glowing circle on the ground |
| `skill_mg_chargedblast.png` | เวทชาร์จ | a mage's staff tip gathering a swirling sphere of orange-white energy with spiralling sparks |
| `skill_mg_starfall.png` | ดาวตก | several golden magic stars with long trails falling from a dark night sky |
| `skill_mg_flameground.png` | พื้นเพลิง | a circle of burning orange flames rising from cracked ground |
| `skill_mg_poisonmist.png` | หมอกพิษอาคม | a swirling cloud of toxic green mist with small skull-shaped wisps |
| `skill_mg_searingmark.png` | ตราเผาผลาญ | a glowing green-and-orange magic sigil brand burning on a dark surface, sparks around it |
| `skill_mg_decayring.png` | วงแหวนสลาย | a ring of corroding sickly green energy with crumbling fragments drifting off |
| `skill_mg_thunderstorm.png` | พายุสายฟ้า | a dark storm cloud with several green-white lightning bolts striking down |
| `skill_mg_crystalspikes.png` | หนามผลึก | a cluster of sharp green crystals planted in the ground shooting thin spikes outward |
| `skill_mg_cursedash.png` | เถ้าถ่านคำสาป | a cursed plume of grey ash and green embers blowing forward with a faint skull shape |
| `skill_mg_hexseed.png` | เมล็ดเวทระเบิด | a glowing green magic seed with hex runes, cracking open with light bursting out |
| `skill_mg_firerain.png` | ฝนเพลิง | burning fireballs raining down from a red sky onto a fiery circle |
| `skill_mg_decayfield.png` | สนามเสื่อมสลาย | a wide dark-green field of decay with withered cracks and rising toxic motes around a central rune |
| `skill_mg_forcewave.png` | คลื่นผลัก | a pale blue shockwave ring blasting outward from a centre point, pushing debris away |
| `skill_mg_frailcurse.png` | คำสาปเปราะบาง | a cracked shield icon covered by a violet curse rune |
| `skill_mg_icecage.png` | กรงน้ำแข็ง | a small dark figure trapped inside a cage of icy blue crystal bars |
| `skill_mg_gravitywell.png` | หลุมแรงโน้มถ่วง | a swirling dark violet-blue vortex pulling small rocks and sparks into its centre |
| `skill_mg_sealveil.png` | ม่านผนึกเวท | a translucent blue-violet veil with a glowing seal rune over a broken sword |
| `skill_mg_empowerfield.png` | สนามเร่งอาคม | a glowing golden rune circle on the ground with upward arrows of light rising from it |
| `skill_mg_manashield.png` | โล่มานาหมู่ | a large translucent blue mana bubble shield with a glowing hexagon pattern |
| `skill_mg_timewarp.png` | บิดเบือนเวลา | a twisted glowing blue hourglass with swirling clock hands and a spiral around it |
| `skill_mg_manawell.png` | วงคืนพลัง | a glowing blue magic circle on the ground with sparkling mana droplets rising up |
| `skill_mg_elementmastery.png` | ชำนาญธาตุ (พาสซีฟ) | three small orbs of fire, ice and poison orbiting a glowing golden rune |
| `skill_mg_manasource.png` | แหล่งมานา (พาสซีฟ) | an overflowing blue crystal chalice of glowing mana |
| `skill_mg_arcanepower.png` | พลังอาคม (พาสซีฟ) | a cracked violet arcane crystal heart radiating power, with a thin red crack |
