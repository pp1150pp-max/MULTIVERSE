# เอฟเฟกต์สกิลบอส 4 แผ่น: prompt ที่เจ้าของให้ Codex เจน (2026-11-21)

ไฟล์ดิบเซฟที่ `art_templates/papercraft_fx/raw/boss_<ชื่อ>.png` (ไม่ commit) แล้วตัดด้วย `node tools/cut_boss_fx.cjs` (ลบตะเกียงที่ติดมาในแถวแรกของแม่มดให้เอง)

```
Generate 4 papercraft skill-effect sheets for the bosses of my game, in the repository D:\Claude\Game\MULTIVERSE. Only generate and save images: do not change any code or other files.

STYLE REFERENCE (open these first and match the style exactly):
- Existing papercraft effect sheets: public/assets/sprites/paper/fx/sw_gale.png, mg_a.png, gun_ult.png, witch_hand.png, witch_circle.png
- The bosses (for colours): public/assets/sprites/paper/monsters/forest_bear.png, bog_witch.png, yeti.png, volcano_heart.png
- Style notes: art_templates/papercraft_fx/PROMPTS.md

COMMON RULES FOR EVERY SHEET:
Papercraft style: every effect built from layered cut coloured paper, tissue paper and foil, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between the layers; glow and energy shown as bright translucent tissue-paper shapes with paper sparkles, never blurry light. Warm soft light from the upper left.
A strict grid: each ROW is one effect, 6 frames per row running left to right (frame 1 start -> frame 6 fading out / gone), every cell the same square size. The effect stays centred in its cell; frames grow, burst and fade so the row plays as a short animation. Every frame fully inside its own cell with clear empty space around it, nothing touching or crossing into the next cell. Ground effects (cracks, craters, rings, spikes) are drawn seen from a high 3/4 top-down game camera, lying flat on the ground. No characters, no monsters, no weapons held by anyone, no text, no labels, no numbers, no grid lines. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no shadows on the background. Never use magenta, pink or purple in the effects.

SAVE each sheet as PNG at: art_templates/papercraft_fx/raw/<file name below>
(the raw/ folder is not committed; create it if missing). One image per file, nothing else.

SHEET 1: boss_bear.png - Forest Bear (brown forest bear), 3 rows x 6 frames:
- Row 1 claw swipe: three thick curved claw-slash marks of torn off-white and red paper sweeping from upper left to lower right, appearing, at full size, then tearing apart and fading.
- Row 2 ground slam: the ground cracks open in a star of jagged dark-brown paper cracks from the centre, chunks of dirt, pebbles and torn grass-green paper bits thrown up and outward, then settling down; the cracks stay faintly in the last frame.
- Row 3 enraged roar: a roar shockwave of pale-yellow and orange paper arcs and jagged rings bursting outward from the centre, with a few torn leaves flying out, growing then fading.

SHEET 2: boss_witch.png - Bog Witch (swamp hag with a teal skull lantern), 3 rows x 6 frames:
- Row 1 lantern swipe: a swing of teal-green ghostly flame from her skull lantern, a curved arc of layered teal and pale-green tissue-paper flames sweeping across, then dissolving into small flame scraps.
- Row 2 staff slam: dark swamp mud and twisting brown roots bursting up out of the ground in a ring around the centre, mud drops splashing out, then the roots sink back into a muddy puddle.
- Row 3 frenzy aura: a rising aura of toxic yellow-green paper flames and curling black smoke paper strips around an empty centre (where she stands), flaring up big, then flickering down.

SHEET 3: boss_yeti.png - Yeti (white snow giant with blue ice crystals), 4 rows x 6 frames:
- Row 1 ice fist hit: a burst of jagged pale-blue ice shards and white snow paper flakes from a single impact point, spreading then melting away.
- Row 2 ice spike slam: a ring of sharp light-blue and white paper ice spikes stabbing up out of the ground in a circle around the centre, frost cracks across the ground, then the spikes shatter into ice chips and fade.
- Row 3 jump / landing snow: a big puff of white and pale-grey paper snow clouds and snow chunks billowing out low along the ground from the centre, then thinning out.
- Row 4 blizzard call: a swirling vortex of white snowflakes and pale-blue wind paper strips spinning around an empty centre (where its minions appear), growing then scattering.

SHEET 4: boss_heart.png - Volcano Heart (living heart of molten rock and magma), 5 rows x 6 frames:
- Row 1 falling meteor: a chunk of black basalt rock with glowing orange magma cracks, trailing a flame tail of orange and yellow paper, falling from the top of the cell toward the bottom; the same rock in each frame, moving down; frame 6 just before impact.
- Row 2 meteor impact: a molten crater splash on the ground: orange and yellow lava paper splatter bursting out, black rock chips, a ring of flames, then a dark smoking scorch mark in the last frame.
- Row 3 fire wave: a short curved section of a rolling wave of orange, red and yellow paper flames (it is drawn many times around a ring in the game), rising, cresting, and flickering; the same width in each frame.
- Row 4 fire beam: a straight horizontal beam of layered yellow-white core and orange-red outer paper flames, running from the left edge of the cell to the right edge (it is stretched in the game), flickering and pulsing across the 6 frames.
- Row 5 eruption blast: a huge explosion from the centre: a dome of yellow-white and orange paper fire, black rock chunks and lava drops flying out, a ring of fire racing outward, then a cloud of dark grey ash paper that fades.

When done, list the 4 files you saved.
```
