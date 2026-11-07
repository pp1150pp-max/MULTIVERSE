# แมพ 4 เกาะภูเขาไฟ: prompt ฉาก พื้น ของตกแต่ง และไอคอน

สร้างในแชทเดียวกับชุดมอนสเตอร์ และแนบภาพ Gunslinger เป็นตัวอย่างในภาพแรก
เซฟไฟล์ดิบตามชื่อในแต่ละหัวข้อไว้ที่ `art_templates/zone4/raw/` แล้วผมจะตัดพื้นหลังและวางเข้าเกมเอง
ชุดมอนสเตอร์ (`monsters_a.png`, `monsters_b.png`, `monster_volcano_heart.png`) ไม่อยู่ในไฟล์นี้ เพราะคุณกำลังเจนอยู่แล้ว

มีทั้งหมด 8 รายการ (พื้น 3 ภาพ รวมเป็น 10 ไฟล์) ถ้าอยากเห็นผลเร็ว ให้เริ่มจากข้อ 1–2 ก่อน

## 1. ฉากประกอบ → `props.png`

```
Now the map props of this game in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the gunslinger: dark outline, 3 to 4 tones per material, small crisp pixels. VERY IMPORTANT CAMERA: 2D isometric 3/4 view from above at about 35 degrees, as in classic isometric RPGs: we see the tops of objects, and each base sits on an imaginary diamond-shaped footprint. NOT a flat front view. Light from the upper left. This is Ashen Isle, a black volcanic island. Palette: warm charcoal, soot grey and dull brown rock, with small accents of orange and ember glow only, nothing bright in large areas, so characters stay the focus. Generate an image: exactly 12 separate objects in a 4 columns x 3 rows grid, generous empty space, each fully inside its own cell, nothing touching or overlapping. Row 1: slim tall burnt basalt pillar with a thin glowing crack, medium burnt basalt pillar with a broken top, very tall broad burnt basalt pillar, dead charred tree with bare branches and a few embers. Row 2: small dry ash-grey shrub, larger dry ash-grey shrub, small fern of dark leaves with orange ember tips, short charred tree stump. Row 3: dark basalt boulder, large dark basalt boulder with a faint glowing crack, cluster of three small orange magma crystals, taller cluster of big magma crystals. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no ground patches, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `burnt_pillar_0` `burnt_pillar_1` `burnt_pillar_2` `charred_tree` / `ash_shrub_0` `ash_shrub_1` `ember_fern` `charred_stump` / `basalt_0` `basalt_1` `magma_crystal_0` `magma_crystal_1`

## 2. ลายพื้น 3 ภาพ → `ground_ash_rock.png`, `ground_ash_path.png`, `ground_lava.png`

สร้างทีละภาพ โดยขึ้นต้นด้วยข้อความนี้ทุกภาพ แล้วต่อท้ายด้วยเนื้อหาในตาราง

```
Generate a SQUARE image (1:1): one seamless repeating ground tile texture that fills the whole image edge to edge. EXACT same fine-detail 16-bit SNES-era pixel-art style as the props above: small crisp pixels, no blur. Viewed from above with no perspective. No focal point, no vignette, no borders, left edge matches right edge and top edge matches bottom edge, no text, no grid lines. Rich surface detail but LOW contrast, 4 to 5 close shades only, nothing bright, nothing near black.
```

| ไฟล์ | ข้อความต่อท้าย |
|---|---|
| `ground_ash_rock.png` | `rough cooled volcanic rock with shallow cracks and a thin dusting of ash, muted warm charcoal grey, lifted well above black, no lava, no glow, no plants` |
| `ground_ash_path.png` | `trampled path of packed grey ash and small crushed cinders, lighter and warmer than the rock around it, soft dull grey-brown, no glow, no plants` |
| `ground_lava.png` | `slowly moving molten lava with darker cooling crust plates and thin bright seams, deep orange and red-orange with a few yellow-orange seams, this one tile may be brighter and higher contrast than the rest` |

## 3. ของตกแต่งบนพื้น → `decor_volcano.png`

```
EXACT same fine-detail 16-bit SNES-era pixel-art style as the props above: 2D isometric view angle, crisp pixels, soft dark outline. Generate a SQUARE image: a strict invisible grid of 4 columns x 3 rows, one small separate ground detail centred in each cell, with wide empty space around each, nothing touching or crossing cell borders. Row 1: small tuft of dry ash-grey grass, larger clump of dry ash-grey grass, low mound of grey ash, tiny pile of cinders. Row 2: small burnt twig, tiny orange ember flower, flat thin glowing crack in rock, flat patch of cooled lava crust. Row 3: flat footprints in ash, small stone with a faint glowing vein, charred dry reeds, tiny black rock mound. Palette muted charcoal and soot grey, with only small touches of orange. Background ONE perfectly flat solid magenta (#FF00FF), no shadows on the ground, no text, no labels, no grid lines. Do not use pink or magenta in the objects.
```

## 4. หน้าผาเกาะ → `island_cliff_volcano.png`

```
Generate game assets in the same fine-detail 16-bit SNES pixel-art style, same 2D isometric view and light from the upper left. Generate an image: a sprite sheet of exactly 8 separate tall broken cliff columns, as if each was cut from under the near edge of a black volcanic floating island, in a 4 columns x 2 rows grid. Each column fully inside its own cell, nothing touching or overlapping, generous empty space between. Every column has the same structure: at the very top an irregular charcoal rock lip seen slightly from above with a crumbled edge, then about one quarter ash and cinder layers, then dark basalt with vertical cracks and ledges, tapering down into 2 or 3 jagged points at the bottom. Each column fills most of its cell height and width. All 8 are different in outline. A few have a thin glowing orange crack running through the rock, and one or two have a thin line of lava trickling down. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 5. แผ่นดินลอย → `island_slabs_volcano.png`

```
Same style, same rules. Generate an image: exactly 8 separate floating land slabs broken off the volcanic island, in a 4 columns x 2 rows grid, each fully inside its own cell, nothing touching, generous space. Each slab has a charcoal rock top seen from above in the same isometric view, ash layers under it, and a short jagged dark basalt underside, wider than tall. Slabs 1 to 4 each carry a small burnt pillar or dead tree on top. Slabs 5 to 8 carry a magma crystal or a boulder or a cracked top with a thin glowing seam. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no stars, no cast shadows, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

## 6. ไอคอนไอเทมชุดหลัก 12 ชิ้น → `item_icons.png`

```
Generate a SQUARE image: inventory item icons for the same game, EXACT same fine-detail 16-bit SNES-era pixel-art style, dark outline, 3 to 4 tones per material, crisp pixels. A strict invisible grid of 4 columns x 3 rows, one item centred in each cell, filling most of it, drawn at a slight angle, nothing touching. A volcanic theme of black iron, charcoal leather, soot-grey cloth and glowing orange magma. Row 1: Cinder Saber (curved black blade with an orange glowing edge), Ember Wand (short charred wand tipped with a burning coal), Magma Repeater (black iron repeating gun with glowing orange vents), Volcanic Greatblade (huge heavy black greatsword with cracks of lava). Row 2: Heartflame Staff (tall staff holding a small glowing heart-shaped ember), Eruption Pistol (ornate black pistol with a molten orange core), Magma Plate (heavy black armour with glowing orange seams), Cinderweave Robe (charcoal and dark red robe with ember-coloured trim). Row 3: Soot-black Coat (long black coat with a dark red lining), Ashweave Hood (soot-grey hood), Cinderstep Boots (black leather boots with hot metal soles), Ember Ring (dark iron ring set with a glowing orange gem). Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no labels, no grid lines. Do not use pink or magenta in the items.
```

ลำดับช่อง: `item_weapon_8_sword` `item_weapon_8_mage` `item_weapon_8_gunslinger` `item_weapon_9_sword` / `item_weapon_9_mage` `item_weapon_9_gunslinger` `item_magma_plate_sword` `item_magma_plate_mage` / `item_magma_plate_gunslinger` `item_ash_hood` `item_cinder_boots` `item_ring_ember`

## 7. ไอคอนช่องอุปกรณ์ใหม่ → `item_icons_extra.png`

ใช้เมื่อระบบช่องอุปกรณ์ใหม่ถูก merge แล้ว

```
Same style, same layout rules. Generate a SQUARE image: a strict invisible grid of 3 columns x 2 rows of inventory icons in the same volcanic theme. Row 1: Magma Amulet (dark iron pendant with a glowing orange stone), Cinderhide Gauntlets (black leather gauntlets with hot metal knuckles), Obsidian Girdle (wide black belt with an obsidian buckle). Row 2: Ember Scabbard (black sword scabbard with orange glowing fittings), Magma Orb (small dark orb with molten cracks), Cinder Ammo Case (black iron ammo case with ember-coloured bands). Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no labels, no grid lines. Do not use pink or magenta in the items.
```

## 8. กระสุนเวท Ash Mage → `ember_bolt.png`

```
Same style. Generate an image: one small fiery ember magic bolt seen from the side, pointing to the RIGHT, a glowing orange core with a short tail of sparks, wider than it is tall, centred and filling most of the image. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no text, no labels. Do not use pink or magenta in the bolt.
```
