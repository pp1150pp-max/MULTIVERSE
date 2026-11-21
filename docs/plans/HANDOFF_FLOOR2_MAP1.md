# ส่งต่องาน: ชั้น 2 PR #4 `feature/floor2-map1` (หาดเรือแตก)

เขียน 2026-11-21 · branch `feature/floor2-map1` ฐาน `origin/floor2` · **PR #411** (https://github.com/pp1150pp-max/MULTIVERSE/pull/411) รอเจ้าของสั่ง merge

## กติกาที่ต้องทำตาม
- PR เปิดเข้า `floor2` (`--base floor2`) **ห้ามเข้า main** ห้ามขึ้น server · เจ้าของต้องยืนยัน merge เอง แล้ว squash merge · `gh project item-add 1 --owner pp1150pp-max --url <PR>`
- ห้าม `git add .` / `git add raw/` · ห้ามแตะระบบเซ็ต (PR #8) · ไม่ตัดภาพเอง (session `art/floor2-cut` ตัด)
- ตอบไทย · ไม่แน่ใจถามด้วยการ์ดตัวเลือก · จะแคปจอต้องถามก่อน · ห้ามเดาตัวเลขเกม

## คำตอบเจ้าของ (2026-11-20, บันทึกในแผนข้อ 12.6, 12.8, 12.13 แล้ว)
- นกนางนวลขโมยทอง: **หักจริง** 1% (สูงสุด 500 G) บินหนี 8 วิ ตีตกทัน = คืนคนที่โดน ไม่ทัน = หาย
- เควสอุปกรณ์ชั้น 2: **เลื่อนไปก่อน** (`gearMaps` นับเฉพาะชั้น 1)
- ตัวเลขมอน/บอส/ท่า: **ใช้ตารางที่เสนอ** ปรับใน /admin ทีหลัง (ตารางอยู่ใน `docs/systems/world-and-ui.md` หัวข้อหาดเรือแตก และ `boss-rooms.md` หัวข้อปูยักษ์)

## ทำแล้ว (commit 394a5b7)
- แมพ `shipwreck_beach` (`ZONE_BEACH`, floor 2, ธีม `beach`) + ห้องบอส "รังปูยักษ์" ลานรัศมี 14 (เลือกเอง ใหญ่กว่าปกติ 11 — บอกเจ้าของใน PR)
- มอน `hermit_crab` `thief_gull` `shock_eel` `spike_turtle` + บอส `cannon_crab` (`monsters.ts`, ฟิลด์ `move` / `brain`)
- ท่าใหม่: `src/shared/sim/beachMoves.ts` (หดกระดอง ขโมยทอง ไฟฟ้าโซ่ สะท้อนดาเมจ) · บอส `src/shared/sim/cannonCrab.ts` (ปืนใหญ่ ก้ามหนีบเหวี่ยง เดินข้าง เลือด<30% หดกระดอง+ระดมยิง) · hook ใน `Monster.ts` และ `Sim.ts` (`guard`, `hurtPlayer`, `banner`, `HitOpts.reflected`)
- `Terrain.resolve` ไม่ให้อะไรถูกดันออกนอกห้องบอส (กันเหวี่ยงหลุดลาน)
- กุญแจ `key_crab` ก้ามปูทอง + `qkey_crab` (คำอธิบายบอกนักเดินเรือ) — เควสขึ้นที่นักเดินเรือเอง
- /admin: การ์ด "ท่ามอนชั้น 2" (`src/shared/moveTuning.ts` ตารางกลาง, `BalanceTuning.moves`) แมพ 2–4 เพิ่มกลุ่มในตารางเดียวกัน
- ฝั่งเบราว์เซอร์: ตารางธีม beach ใน `world.ts`, ภาพ `BEACH_PROPS`/`BEACH_FX`/พื้น `sand wreck shallow room_beach` ใน `assets.ts` (paper only), fx ใหม่ `sprite` และ `bolt` ใน `effects.ts`, ลูกปืนใหญ่ `shell` ใน `hazards.ts`
- เทสต์ใหม่ `tests/floor2-map1.test.ts` (ผ่านหมด) + แก้ `harbor`, `volcano-zone`, `boss-hp`
- อัปเดต docs: `world-and-ui.md`, `boss-rooms.md`, `balance.md`, `CLAUDE.md`, แผนข้อ 11/12

## อัปเดต 2026-11-21: เปิด PR #411 แล้ว (เข้า `floor2`)
- รวม `origin/floor2` (#385) เข้ามาแล้ว ชนแค่ `CLAUDE.md` 1 บรรทัด
- แก้เทสต์เดิม 4 ไฟล์ที่นับตายตัวว่ามี 4 อัน: `boss-keys` (เมืองชั้น 1 ดรอปเฉพาะกุญแจชั้น 1), `channels` (แมพฟาร์มทุกแมพมี CH), `quest-marks` (5 แถว), `multi-hub` (ชั้น 2 = ท่าเรือ+หาด, ห้องปูยักษ์กลับท่าเรือ, มอน Lv45 อยู่หาด) แก้ที่เทสต์อย่างเดียว ไม่แตะกติกาเกม
- `typecheck` ผ่าน · `test` ผ่านทั้งหมด ยกเว้น `cosmetics-server` "riding: a 3.2 step…" ที่ล้มเป็นบางครั้งเพราะขึ้นกับเวลา (branch นี้ล้ม 1/9, `floor2` เดิม 0/10 และ PR นี้ไม่แตะเมืองชั้น 1)
- ยังไม่ได้เข้าแมพจริงบนจอ เจ้าของจะลองเองบน `floor2`

## ค้าง (หลัง #411 merge)
1. **PR ภาพแมพ 1:** ภาพตัดแล้วอยู่บน `art/floor2-cut` (worktree `.claude/worktrees/floor2-art-cut`, **ยังไม่ push**, แตกจาก main และมีภาพแมพ 1–4 + ไอคอนเซ็ต ทั้งชุด) ต้องถามเจ้าของก่อนว่าจะให้ภาพเข้า `floor2` หรือ main
2. **ภาพบอสปูยักษ์ยังไม่ได้ตัด:** ภาพดิบ 4 ท่าใน `floor2-art-cut/art_templates/papercraft_maps/raw/floor2_m1/monsters/giant_crab_{walk,claw,cannon,shell}.png` ครบและเป็นตาราง 5×4 ถูกแล้ว (เช็ก 2026-11-21) ตัดด้วย `node tools/cut_floor2_chars.cjs monsters --only giant_crab` แล้วผูกชื่อ `giant_crab` → `cannon_crab` และให้ตัวโหลดรองรับ 4 ท่า (ดูข้อภาพบอสด้านล่าง)
3. แมพ 1 เป็น JSON ของตัวแก้แมพ: รอ PR 9 หลัง `floor2` เข้า main (`docs/plans/map-editor.md`)
4. dev ลองเล่นของ worktree นี้: `D:\Claude\Game\.claude\launch.json` ชื่อ `map1-server` (2694, DB `server/data/dev-map1.db`) + `map1-dev` (5404) · Guest `BeachTest` ต้องแก้ DB ให้ Lv45 + `unlocks: ['floor2']` (ปิดแท็บก่อนแก้ DB)

## สำหรับ PR #5 (แมพ 2 อ่าวลักลอบ) และ PR ภาพ
- เพิ่มแมพ: ใส่ใน `ZONES` + `bossRoom` list + `BOSS_RADIUS` + `BOSS_ROOM_NAME` (ขาด = เกมโหลดไม่ขึ้น) + ธีมใหม่ในทุก `Record<ZoneTheme,…>` (`THEME_PROPS`, `SUMMONER_PROP`, `TRAIL_WIDTH`, `ISLAND_ART`, `DECOR`, `PALETTES`)
- ท่าใหม่: เพิ่มกลุ่มใน `MOVE_GROUPS` แล้วอ่านค่าด้วย `mv('กลุ่ม.ชื่อ')` การ์ด /admin ขึ้นเอง
- **ภาพบอส:** session ตัดภาพตั้งชื่อ `giant_crab` แต่ id มอนคือ `cannon_crab` และตัวโหลดมอนกระดาษ (`assets.ts` loadAssets) รองรับแค่ walk+attack 8 คอลัมน์ — PR ภาพต้องผูกชื่อและรองรับ 4 ท่า (walk claw cannon shell) · meta.json มอนชั้น 2 มีแค่ `moves` ไม่มี `scale` ตัวโหลดต้องรับได้
- มอนชั้น 2 ยังไม่มีการ์ดมอน (`cards.ts`)
