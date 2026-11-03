"""Copies the CraftPix "Free Simple Summer Top-Down Vector Tileset" into the game's asset folders.

The pack's soft drop shadows are removed (the game draws its own under every prop) and each prop
is cropped to its visible pixels, so the bottom of the image is where the prop touches the ground.

Usage (from the repo root):
    python tools/import_craftpix.py [path-to-pack]

License: https://craftpix.net/file-licenses/
"""
import os
import sys

from PIL import Image

PACK = sys.argv[1] if len(sys.argv) > 1 else 'craftpix-net-381103-free-simple-summer-top-down-vector-tileset'
SRC = os.path.join(PACK, 'PNG')
OUT = os.path.join('public', 'assets', 'sprites')

# game key -> file name suffix in the pack ("Top-Down Simple Summer_<suffix>.png")
PROPS = {
    'tree_0': 'Prop - Tree Small',
    'tree_1': 'Prop - Tree Medium',
    'tree_2': 'prop - Tree Large',
    'bush_0': 'Prop - Bushes Medium',
    'bush_1': 'Prop - Bushes Large',
    'bush_2': 'Prop - Bushes Small',
    'rock_0': 'Prop - Rock 01',
    'rock_1': 'Prop - Rock 02',
    'rock_2': 'Prop - Rock 03',
    'pebble_0': 'Prop - Rock 04',
    'pebble_1': 'Prop - Rock 05',
    'stump': 'Prop - Tree Stump Short',
    'stump_tall': 'Prop - Tree Stump Tall',
    'tent': 'Prop - Tent',
    'campfire': 'Prop - Campfire',
    'fence': 'Prop - Wooden Fence Horizontal',
    'sign': 'Prop - Blue Banner',
    'banner_red': 'Prop - Red Banner',
    'flag': 'Prop - Flag',
    'runestone': 'Prop - Magic Stone Tower',
    'well': 'Prop - Well',
    'barrel': 'Prop - Wooden Barrel',
    'cart': 'Prop - Wooden Cart',
    'chest': 'Prop - Treasure Chest',
    'watchtower': 'Prop - Watchtower Short',
}

GROUND = {
    'grass': 'Ground 43',
    'sand': 'Ground 14',
}


def strip_shadow(im: Image.Image) -> Image.Image:
    """Drops the faint black shadow pixels and crops to what is left."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 110 and max(r, g, b) < 40:
                px[x, y] = (0, 0, 0, 0)
    box = im.getbbox()
    return im.crop(box) if box else im


def src(name: str) -> str:
    return os.path.join(SRC, f'Top-Down Simple Summer_{name}.png')


def main() -> None:
    os.makedirs(os.path.join(OUT, 'props'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'ground'), exist_ok=True)
    for key, name in PROPS.items():
        strip_shadow(Image.open(src(name))).save(os.path.join(OUT, 'props', f'{key}.png'), optimize=True)
    for key, name in GROUND.items():
        Image.open(src(name)).convert('RGB').save(os.path.join(OUT, 'ground', f'{key}.png'), optimize=True)
    print(f'wrote {len(PROPS)} props and {len(GROUND)} ground tiles to {OUT}')


if __name__ == '__main__':
    main()
