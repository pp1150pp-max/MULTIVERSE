# เอฟเฟกต์สกิล Gunslinger: prompt สำหรับ ChatGPT (เจ้าของอนุมัติแผน 2026-11-15)

มี 3 แผ่น แถวละ 6 เฟรม ท่าที่หน้าตาคล้ายกันใช้แถวร่วมกัน เพื่อให้เจนภาพน้อยที่สุด
- ตั้งค่าการเล่นใน `src/client/effects.ts` (บล็อก `// Gunslinger`)
- ภาพที่ยังไม่มีไฟล์ เกมใช้เอฟเฟกต์เดิมไปก่อน

**ขั้นตอนหลังได้ภาพ**
1. เซฟภาพดิบไว้ที่ `art_templates/skills/raw/<ชื่อแผ่น>.png` ไม่ต้อง commit
2. ตัดพื้นหลัง: `PNGJS=<path ของ pngjs> node tools/cut_fx_sheet.cjs art_templates/skills/raw/gs_skill.png 6 public/assets/sprites/fx/gs_skill.png`
   - แผ่น `gs_gear` ใช้ 6 แถว
   - แผ่น `gs_passive` ใช้ 3 แถว
3. ถ้าเริ่มแชทใหม่ ให้แนบ `public/assets/sprites/fx/gun.png` และ `gun_ult.png` เป็นตัวอย่างสไตล์

## กฎที่ใช้ทุกแผ่น (เปลี่ยน R เป็นจำนวนแถว)

```
EXACT same fine-detail 16-bit SNES-era pixel-art style as the attached effect sheets: crisp pixels, hard-edged color
bands, no blur, no soft gradients, no glow haze. Only the effects, no characters and no hands. Generate an image: an
animation sheet as a strict grid of exactly R rows x 6 columns, every cell the same size, each effect fully inside its
own cell with empty space around it, nothing touching or crossing cell borders. Each row is one effect playing from left
to right over 6 frames: appears, grows, peak, fades, breaks up, almost gone (rows marked LOOPING instead show 6 frames of
one steady repeating motion). Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no
labels, no numbers, no grid lines. Do not use pink, magenta or purple in the effects.
```

## แผ่น 1: `gs_skill.png` (R = 6) — กระสุนสกิล บัฟ ไฟ และควัน

| แถว | ใช้กับ | หน้าตา |
|---|---|---|
| 1 | กระสุนของสายคริ 7 ท่า (เล็งจุดตาย ยิงประณีต สะท้อน สวนกลับ จุดอ่อน ปิดฉาก ล็อกเป้า) | กระสุนแดงเรียวพร้อมเส้นแดงขาว |
| 2 | ยิงปกติตอนมีบัฟสายยิงเร็ว | กระสุนร้อนสีส้ม |
| 3 | ออร่าตอนกดบัฟทุกท่า เกมย้อมสีตามสาย | วงแสงสีขาวบนพื้น |
| 4 | กระสุนเพลิง | กระสุนไฟ |
| 5 | ไฟลุกบนเป้าที่ติดไฟ | เปลวไฟเล็ก |
| 6 | ระเบิดควัน | ควันบนพื้น |

ต่อท้ายกฎด้วย:

```
Row 1, CRIT ROUND, LOOPING, seen from the side and flying to the RIGHT: a slim sharp crimson bullet with a thin bright
red-white streak trailing behind it and two or three tiny red sparks; smaller and thinner than a sniper round.
Row 2, HOT ROUND, LOOPING, seen from the side and flying to the RIGHT: a small brass bullet glowing orange-hot, a short
flickering orange-yellow heat trail and a few tiny embers falling off behind it.
Row 3, POWER-UP AURA, seen from directly above and lying flat on the ground: an almost WHITE, very pale grey-gold ring of
light with small upward-pointing chevrons around it and little sparks; frame 1 a thin small ring, it expands and
brightens, frame 3 widest and brightest, then thins and breaks into sparks. Keep it nearly white so the game can tint it.
Row 4, INCENDIARY ROUND, LOOPING, seen from the side and flying to the RIGHT: a bullet wrapped in licking orange-red
flames with a ragged fire tail and small embers.
Row 5, BURNING, seen from the side: a small cluster of orange-red flames flickering upward from a point, with yellow
cores, a few embers and a thin wisp of dark smoke at the end.
Row 6, SMOKE CLOUD, seen from directly above and lying flat on the ground: a thick round cloud of grey smoke billowing
outward from the centre, darker grey core and lighter grey puffy edges, slowly spreading and thinning.
```

## แผ่น 2: `gs_gear.png` (R = 6) — อาวุธพิเศษ

| แถว | ใช้กับ | หน้าตา |
|---|---|---|
| 1 | จรวดติดตาม | จรวดเล็กพ่นไฟฟ้าเขียว |
| 2 | กับระเบิด (เล่นซ้ำทุกวินาทีจนระเบิด) | กับระเบิดกะพริบบนพื้น |
| 3 | โดรนสนับสนุน (บินตามตัว) | โดรนใบพัดหมุน |
| 4 | ป้อมปืนพกพา | ป้อมปืนยิงไปทางขวา |
| 5 | กระสุนรางแม่เหล็ก | ลูกพลังงานยาวฟ้าขาว |
| 6 | ระเบิดของกระสุนระเบิด จรวด ลูกปราย และฝนจรวด | ระเบิดสีฟ้าเขียวกับไฟ |

ต่อท้ายกฎด้วย:

```
Row 1, ROCKET, LOOPING, seen from the side and flying to the RIGHT: a small slim rocket of dark steel with a teal nose
and fins, a bright teal-white exhaust flame and a short trail of grey smoke puffs behind it.
Row 2, LAND MINE, LOOPING, seen from directly above and lying flat on the ground: a round dark-metal disc mine with a
ring of bolts and a small light in the centre that blinks teal: off, dim, bright, brightest with a tiny teal ring
pulse, dim, off. The mine itself does not move or change.
Row 3, SUPPORT DRONE, LOOPING, seen from the side: a small hovering four-rotor drone of dark metal and brass with one
teal eye light and a tiny gun under it; the rotors blur as they spin and the drone bobs up and down a little.
Row 4, PORTABLE TURRET, LOOPING, seen from the side: a compact gun turret on a short tripod, dark metal with brass and a
teal sensor light, the barrel pointing to the RIGHT; frames 2 and 5 show a short yellow-white muzzle flash at the
barrel tip with a slight recoil, the other frames show it idle and aiming.
Row 5, RAILGUN SLUG, LOOPING, seen from the side and flying to the RIGHT: a long sharp bolt of teal-white energy between
two thin parallel lines of crackling electric sparks, with a straight bright trail behind it.
Row 6, TECH EXPLOSION, seen from the side: a round blast with a white-hot centre, a ring of bright teal energy and an
orange fire core, metal fragments and teal sparks flying out, then breaking up into grey smoke.
```

## แผ่น 3: `gs_passive.png` (R = 3) — ตอนพาสซีฟทำงาน

| แถว | พาสซีฟ | เล่นตอน |
|---|---|---|
| 1 | สายตาเหยี่ยว | บนเป้า ทุกครั้งที่คุณคริ |
| 2 | นิ้วไกไว | ที่ปืน ทุก 4 นัดของการยิงปกติ |
| 3 | กระสุนพิเศษ | วงเสริมบนพื้น ทุกครั้งที่สกิลสายอาวุธพิเศษระเบิด |

ต่อท้ายกฎด้วย:

```
Row 1, HAWK EYE, seen from the side: a sharp red-and-gold hawk's eye sigil that snaps open above a point, with a thin
red crosshair line through the pupil and a quick red-white spark burst, then fades into red specks.
Row 2, QUICK TRIGGER, seen from the side: a small burst of amber-gold chevrons and sparks spinning out from a point like
a fast spinning revolver cylinder flash, then scattering.
Row 3, SPECIAL AMMO, seen from directly above and lying flat on the ground: a teal hexagon outline of light with small
teal sparks at its corners, expanding outward from the centre, then breaking into teal specks.
```
