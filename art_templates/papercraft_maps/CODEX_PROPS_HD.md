# งานสำหรับ Codex: เจนของวางชิ้นใหญ่ใหม่ ทีละรูป

ไฟล์นี้ส่งให้ Codex ทั้งไฟล์ได้เลย (เจ้าของสั่ง 2026-11-24) รายละเอียดเหตุผลอยู่ใน [PROPS_HD.md](PROPS_HD.md)

---

## Instructions for Codex

Work through the list below **one image at a time**, top to bottom. For each row:

1. If `art_templates/papercraft_maps/raw/props_hd/<name>.png` already exists, skip the row.
2. Open the original picture `public/assets/sprites/paper/props/<name>.png` and use it as the reference image.
3. Generate ONE new image with the prompt below, using the row's background line.
4. Save it as `art_templates/papercraft_maps/raw/props_hd/<name>.png` (PNG, square, at least 1024 x 1024).
5. Look at the result: if it does not match the original (different object, extra or missing parts, other camera angle, background not flat, background colour used on the object), generate it again (at most 2 more tries), then move on.
6. Go on to the next row. Do not stop after the first image. Do not change any other file in the repository.

At the end, list which files were saved, which were skipped because they existed, and which still look wrong.

### Prompt (same for every row)

```
The attached picture is a prop from my papercraft game, but it is small and blurry. Redraw this EXACT same object at high resolution: the same design, shape, proportions, colours, details, viewing angle and lighting, in the same soft 3D papercraft style (layered paper cut-outs, gentle folds and soft shading, clean smooth edges). Do not add, remove or move anything, do not change the camera angle, do not make it more realistic. Only make it sharp and detailed.
ONE single object, centred, filling about 90 percent of the image height, the whole object inside the image with a little empty space around it, nothing cut off. No ground, no shadow on the ground, no other objects, no text, no labels, no frame, no grid lines. Square image, at least 1024 x 1024.
<BACKGROUND LINE>
```

Background lines:

- **magenta**: `Background: ONE perfectly flat solid magenta (#FF00FF). Do not use pink, magenta or purple on the object.`
- **green**: `Background: ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green on the object.`

### List (worst first)

| # | name | background |
|---|---|---|
| 1 | town_fountain | magenta |
| 2 | b3_vault | magenta |
| 3 | b3_crystal | green |
| 4 | b3_guild | magenta |
| 5 | b3_forge | magenta |
| 6 | town_wall_a | magenta |
| 7 | town_wall_a_broken | magenta |
| 8 | town_wall_b | magenta |
| 9 | town_wall_b_broken | magenta |
| 10 | town_wall_end | magenta |
| 11 | mk_goods_stall | magenta |
| 12 | mk_veg_stall | magenta |
| 13 | mk_auction_booth | magenta |
| 14 | banner_pole | magenta |
| 15 | lamp_post | magenta |
| 16 | portal | green |
| 17 | tree_0 | magenta |
| 18 | tree_1 | magenta |
| 19 | tree_2 | magenta |
| 20 | swamp_tree_0 | magenta |
| 21 | swamp_tree_1 | magenta |
| 22 | swamp_tree_2 | magenta |
| 23 | willow | magenta |
| 24 | snow_pine_0 | magenta |
| 25 | snow_pine_1 | magenta |
| 26 | snow_pine_2 | magenta |
| 27 | frost_tree | magenta |
| 28 | charred_tree | magenta |
| 29 | burnt_pillar_0 | magenta |
| 30 | burnt_pillar_1 | magenta |
| 31 | burnt_pillar_2 | magenta |
| 32 | watchtower | magenta |
| 33 | ruin_tower | magenta |
| 34 | ruin_house | magenta |
| 35 | ruin_statue | magenta |
| 36 | ruin_fountain | magenta |
| 37 | ruin_pillar | magenta |
| 38 | summoner_forest | green |
| 39 | summoner_marsh | green |
| 40 | summoner_snow | green |
| 41 | summoner_volcano | green |
| 42 | room_forest_tree | magenta |
| 43 | room_marsh_tree | magenta |
| 44 | room_snow_tree | magenta |
| 45 | room_volcano_tree | magenta |
| 46 | room_forest_pillar_0 | magenta |
| 47 | room_marsh_pillar_0 | magenta |
| 48 | room_snow_pillar_0 | magenta |
| 49 | room_volcano_pillar_0 | magenta |
| 50 | magma_crystal_0 | magenta |
| 51 | magma_crystal_1 | magenta |
| 52 | ice_crystal_0 | magenta |
| 53 | ice_crystal_1 | magenta |
| 54 | tent | magenta |
| 55 | mossrock_1 | magenta |

(`town_fountain` เสร็จแล้ว Codex จะข้ามเอง · กล่องปริศนาเสร็จแล้ว อยู่ใน `papercraft_icons/MYSTERY_BOX.md`)
