# ส่งต่องาน: ชั้น 2 PR #4 `feature/floor2-map1` (หาดเรือแตก)

เขียน 2026-11-21 · ย้ายไปทำต่อในบัญชีอื่น · branch `feature/floor2-map1` (push แล้ว) ฐาน `origin/floor2` · **ยังไม่ได้เปิด PR**

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

## ค้าง (ทำต่อตามลำดับ)
1. **เทสต์เดิม 5 ไฟล์ยังล้ม** เพราะนับว่ามีแมพ/บอส/กุญแจ 4 อัน หรือใช้ตัว Lv40 ตีบอส Lv50 (โดน MISS ตามกฎช่องว่างเลเวล):
   - `tests/boss-keys.test.ts` "hub monsters drop all four keys"
   - `tests/quest-marks.test.ts` "one row per boss"
   - `tests/channels.test.ts` "the 4 farm maps have channels"
   - `tests/multi-hub.test.ts` 3 ข้อ (นับแมพชั้น 1/2, ห้องบอสชั้น 1, "Lv45 monster belongs to the floor-2 map")
   - `tests/cosmetics-server.test.ts` "riding: a 3.2 step…" — อาจ flaky ไม่เกี่ยวกับงานนี้ ลองรันซ้ำก่อน
   - ส่วนใหญ่แก้ที่เทสต์ (กรองชั้น 1 หรือใช้ `Object.keys(...).length`) **อย่าแก้กติกาเกมให้เทสต์ผ่าน**
2. `npm run typecheck` (ผ่านแล้วตอน commit) + `npm run test` ให้ผ่านทั้งหมด
3. ลอง `npm run dev` อ่านหน้าเป็นข้อความ: dev ของ worktree นี้ตั้งไว้ใน `D:\Claude\Game\.claude\launch.json` ชื่อ `map1-server` (2694, DB `server/data/dev-map1.db`) + `map1-dev` (5404) · สร้าง Guest `BeachTest` แล้ว ต้องแก้ DB ให้ Lv45 + `unlocks: ['floor2']` ถึงจะเข้าแมพได้ (ปิดแท็บก่อนแก้ DB) · ยังไม่ได้เข้าแมพจริงเลย
4. เปิด PR: `"C:/Program Files/GitHub CLI/gh.exe" pr create --base floor2 --assignee ioilLnwza` (path เต็ม รันนอก sandbox) → รอ CI → ให้เจ้าของยืนยัน merge → squash → การ์ดคันบัง
5. เขียนโน้ตส่งต่อให้ PR #5 แมพ 2 (ด้านล่าง)

## สำหรับ PR #5 (แมพ 2 อ่าวลักลอบ) และ PR ภาพ
- เพิ่มแมพ: ใส่ใน `ZONES` + `bossRoom` list + `BOSS_RADIUS` + `BOSS_ROOM_NAME` (ขาด = เกมโหลดไม่ขึ้น) + ธีมใหม่ในทุก `Record<ZoneTheme,…>` (`THEME_PROPS`, `SUMMONER_PROP`, `TRAIL_WIDTH`, `ISLAND_ART`, `DECOR`, `PALETTES`)
- ท่าใหม่: เพิ่มกลุ่มใน `MOVE_GROUPS` แล้วอ่านค่าด้วย `mv('กลุ่ม.ชื่อ')` การ์ด /admin ขึ้นเอง
- **ภาพบอส:** session ตัดภาพตั้งชื่อ `giant_crab` แต่ id มอนคือ `cannon_crab` และตัวโหลดมอนกระดาษ (`assets.ts` loadAssets) รองรับแค่ walk+attack 8 คอลัมน์ — PR ภาพต้องผูกชื่อและรองรับ 4 ท่า (walk claw cannon shell) · meta.json มอนชั้น 2 มีแค่ `moves` ไม่มี `scale` ตัวโหลดต้องรับได้
- มอนชั้น 2 ยังไม่มีการ์ดมอน (`cards.ts`)
