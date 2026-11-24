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

### List

Only the props the owner captured on screen (owner 2026-11-24: just these).

| # | name | background |
|---|---|---|
| 1 | town_fountain | magenta |
| 2 | magma_crystal_0 | magenta |
| 3 | ruin_tower | magenta |

(`town_fountain` เสร็จแล้ว Codex จะข้ามเอง · กล่องปริศนาเสร็จแล้ว อยู่ใน `papercraft_icons/MYSTERY_BOX.md` · รายการเต็มเผื่อทำทีหลังอยู่ใน [PROPS_HD.md](PROPS_HD.md))
