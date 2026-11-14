# เอฟเฟกต์ร่ายสกิลเมจ: prompt สำหรับ ChatGPT (เจ้าของอนุมัติแผน 2026-11-15)

มี 4 แผ่น: `mg_a` `mg_b` `mg_c` (แผ่นละ 6 แถว) และ `mg_d` (3 แถว เป็นออร่าพาสซีฟ)
- ทุกแผ่นมี 6 เฟรมต่อแถว พื้นหลังสีม่วงแดง แบบเดียวกับ `mage.png` เดิม
- ท่าที่หน้าตาคล้ายกันใช้แถวเดียวกัน (ดูตารางท้ายไฟล์)
- ลูกไฟ วงน้ำแข็ง และอุกกาบาตยังใช้ `mage.png` เดิม

**วิธีเจน**
1. แนบ `public/assets/sprites/fx/mage.png` เป็นตัวอย่างสไตล์ (ถ้าเริ่มแชทใหม่ทุกครั้ง)
2. วางกฎร่วมด้านล่าง โดยใส่จำนวนแถว (R) ของแผ่นนั้น แล้วต่อท้ายด้วยข้อความของแผ่นนั้น
3. เซฟภาพดิบเป็น `art_templates/mage/raw/<ชื่อแผ่น>.png` เช่น `raw/mg_a.png`
4. ผมจะตัดพื้นหลังด้วย `tools/cut_fx_sheet.cjs` แล้วเซฟเป็น `public/assets/sprites/fx/<ชื่อแผ่น>.png`

## กฎร่วม (ทุกแผ่น)

```
EXACT same fine-detail 16-bit SNES-era pixel-art style as the attached effect sheet: crisp pixels, hard-edged color
bands, no blur, no soft gradients, no glow haze. Only the effects, no characters and no weapons. Generate an image: an
animation sheet as a strict grid of exactly R rows x 6 columns, every cell the same size, each effect fully inside its
own cell with empty space around it, nothing touching or crossing cell borders. Each row is one effect playing from left
to right over 6 frames. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no
labels, no numbers, no grid lines. Do not use pink or magenta in the effects.
```

## แผ่น `mg_a`: กระสุนและระเบิด มองจากด้านข้าง (R = 6)

```
Row 1, ARCANE LANCE, looping, seen from the side and flying to the RIGHT: a long thin spear of bright orange-gold arcane
light with a sharp diamond tip and a short crackling trail; frame 1 small, frames 2-5 full length shimmering, frame 6
the same with sparks.
Row 2, VOLATILE ORB, looping, seen from the side and flying to the RIGHT: a large round unstable orange glass orb with
glowing cracks leaking fire and small sparks orbiting it, pulsing slightly bigger and smaller across the frames.
Row 3, ICE CAGE BOLT, looping, seen from the side and flying to the RIGHT: a jagged pale-blue ice crystal chunk with a
short frosty white trail and tiny snow sparkles.
Row 4, VENOM BOLT, looping, seen from the side and flying to the RIGHT: a small glowing toxic-green orb with a dripping
green trail and a faint dark-green rune shape inside.
Row 5, LIGHTNING STRIKE, seen from the side: a bolt of blue-white lightning striking straight down onto one spot; frame 1
a thin flicker from the top, frame 2 a thick jagged bolt from top to bottom, frame 3 the peak with a bright white
flash and forks at the bottom, frame 4 the bolt thinning with blue sparks splashing out at the base, frame 5 crackling
sparks, frame 6 a few fading blue sparks.
Row 6, MANA BURST, seen from the side: a round explosion of orange-gold arcane energy; frame 1 a small bright golden
point, frame 2 a golden sphere with sharp rays, frame 3 the peak, a big round burst with a white core, orbiting rune
sparks and a thin shock ring, frame 4 the ring widening and the core breaking into golden shards, frame 5 scattered
golden sparks, frame 6 almost gone.
```

## แผ่น `mg_b`: ของตกจากฟ้าและพื้น (R = 6)

```
Row 1, CRYSTAL STAR IMPACT, seen from the side: a falling shard of pale amber crystal light with a golden star tip hitting
the ground; frame 1 the shard high in the cell falling, frame 2 just above the ground, frame 3 the impact with a bright
white-gold star flash, frame 4 amber crystal fragments bursting outward, frame 5 small falling fragments and twinkles,
frame 6 almost gone.
Row 2, BURNING GROUND, seen from directly above and lying flat on the ground: a round patch of orange-red flames and
glowing embers on cracked scorched ground, the flames flickering differently in each frame so the row loops smoothly;
the same round size in all 6 frames.
Row 3, FLAME WAVE, seen from directly above and lying flat on the ground: a wide fan-shaped wave of roaring orange-yellow
fire spreading to the RIGHT from the left edge of the cell; frame 1 a small fan of flame near the left, frames 2-3
growing wide, frame 4 the peak filling the cell to the right, frame 5 breaking into flames and embers, frame 6 a few
embers.
Row 4, POISON CLOUD, seen from directly above and lying flat on the ground: a round swirling cloud of toxic green mist
with darker green wisps and small bubbles, slowly swirling so the row loops smoothly; the same round size in all frames.
Row 5, CURSED ASH, seen from directly above and lying flat on the ground: a fan-shaped plume of dark grey ash with
glowing green embers spreading to the RIGHT from the left edge of the cell; frame 1 small, frames 2-4 growing wide,
frame 5 drifting apart, frame 6 a few green embers.
Row 6, DECAY RING, seen from directly above and lying flat on the ground: a ring of sickly yellow-green corrosion with
crumbling dark fragments and rising green motes around an empty center, slowly turning so the row loops smoothly; the
same ring size in all frames.
```

## แผ่น `mg_c`: ควบคุมและบัฟ มองจากด้านบน แบนกับพื้น (R = 6)

```
Every effect in this sheet is seen from directly above and lies flat on the ground.
Row 1, FORCE SHOCKWAVE: a pale-blue shockwave ring bursting outward from an empty center with white streaks and small
debris; frame 1 a small bright ring, frames 2-4 the ring growing wider and thinner, frame 5 a faint wide ring breaking
up, frame 6 almost gone.
Row 2, CURSE SIGIL: a violet magic circle with a cracked shield rune in the middle and small runes around the edge;
frame 1 faint thin lines appearing, frame 2 the circle drawn, frame 3 the peak glowing bright violet, frames 4-6 the
same circle pulsing slowly so it can loop.
Row 3, GRAVITY VORTEX: a swirling dark violet-blue vortex spiralling inward to a black center, small rocks and sparks
being pulled in along the spiral, rotating a little each frame so the row loops smoothly; the same size in all frames.
Row 4, GOLDEN EMPOWER CIRCLE: a glowing golden rune circle with upward-pointing arrow shapes of light rising from its
edge; frame 1 faint, frame 2 drawn, frame 3 the peak with bright golden arrows rising, frames 4-6 the circle shimmering
so it can loop.
Row 5, MANA SHIELD CIRCLE: a round light-blue magic circle with a glowing hexagon pattern and sparkling blue mana motes
rising from it; frame 1 faint, frame 2 drawn, frame 3 the peak, frames 4-6 the hexagons shimmering so it can loop.
Row 6, TIME WARP: a big pale-violet clock face circle with twisted hands and a spiral warping around it; frame 1 faint,
frame 2 drawn, frame 3 the peak with the spiral bright, frames 4-6 the hands and spiral turning so it can loop.
```

## แผ่น `mg_d`: ออร่าพาสซีฟใต้เท้า (R = 3)

```
Every effect in this sheet is seen from directly above and lies flat on the ground: a small round aura under a
character's feet, subtle enough to sit under a character all the time, with an empty center, animated so each row loops
smoothly from frame 6 back to frame 1, and the same size in all 6 frames.
Row 1, ELEMENTAL MASTERY AURA: a thin ring with three small orbiting motes, one fire-orange, one ice-blue and one
poison-green, circling around the ring.
Row 2, MANA SOURCE AURA: a thin light-blue ring with small blue mana droplets slowly rising and sparkling around it.
Row 3, ARCANE POWER AURA: a thin violet-and-gold ring with small sharp violet crystal shards pulsing around it and a few
tiny red sparks.
```

## แถวไหนใช้กับท่าไหน

| แผ่น · แถว | เอฟเฟกต์ | ใช้กับ |
|---|---|---|
| mg_a · 1 | หอกอาร์เคน (พุ่ง) | หอกอาร์เคน |
| mg_a · 2 | ลูกแก้วระเบิด (พุ่ง) | ลูกแก้วระเบิด |
| mg_a · 3 | ก้อนน้ำแข็ง (พุ่ง) | กรงน้ำแข็ง |
| mg_a · 4 | ลูกพิษเขียว (พุ่ง) | ตราเผาผลาญ, หนามผลึก |
| mg_a · 5 | สายฟ้าฟาดลง | สายฟ้าฟาด, พายุสายฟ้า |
| mg_a · 6 | ระเบิดมานา | ระเบิดมานา, เวทชาร์จ, หลุมแรงโน้มถ่วง (ตอนยุบ) |
| mg_b · 1 | ผลึก/ดาวตกกระทบ | ฝนผลึก, ดาวตก |
| mg_b · 2 | พื้นไฟ | พื้นเพลิง, ฝนเพลิง |
| mg_b · 3 | คลื่นไฟกรวย | คลื่นเพลิง |
| mg_b · 4 | หมอกพิษ | หมอกพิษอาคม, เมล็ดเวทระเบิด |
| mg_b · 5 | เถ้าคำสาปกรวย | เถ้าถ่านคำสาป |
| mg_b · 6 | วงกัดกร่อน | วงแหวนสลาย, สนามเสื่อมสลาย |
| mg_c · 1 | คลื่นกระแทก | คลื่นผลัก |
| mg_c · 2 | อักขระคำสาป | คำสาปเปราะบาง, ม่านผนึกเวท, ตราเผาผลาญ (ตอนติดตัว) |
| mg_c · 3 | หลุมดำหมุน | หลุมแรงโน้มถ่วง |
| mg_c · 4 | วงเวททอง | สนามเร่งอาคม |
| mg_c · 5 | วงโล่มานา | โล่มานาหมู่, วงคืนพลัง |
| mg_c · 6 | นาฬิกาบิด | บิดเบือนเวลา |
| mg_d · 1–3 | ออร่าใต้เท้า | ชำนาญธาตุ, แหล่งมานา, พลังอาคม (ทุกคนเห็น) |
