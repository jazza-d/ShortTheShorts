"""Builds public/icons/icon-{16,32,48,128}.png from assets/icon-source.(png|jpg).

Rounds the corners to transparent so the icon sits cleanly on light and dark toolbars.
Usage: python3 scripts/make-icons.py [path/to/source-image]
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SIZES = (16, 32, 48, 128)
CORNER_RADIUS = 0.17  # fraction of the image width
INSET = 6  # px trimmed from each edge of the source, removing any light fringe

source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'assets' / 'icon-source.png'
image = Image.open(source).convert('RGBA')
w, h = image.size

# Draw the mask at 4x and downsample for anti-aliased corners.
scale = 4
mask = Image.new('L', (w * scale, h * scale), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    (INSET * scale, INSET * scale, (w - INSET) * scale, (h - INSET) * scale),
    radius=int(w * CORNER_RADIUS) * scale,
    fill=255,
)
image.putalpha(mask.resize((w, h), Image.LANCZOS))

(ROOT / 'assets').mkdir(exist_ok=True)
image.save(ROOT / 'assets' / 'icon-source.png')

out = ROOT / 'public' / 'icons'
out.mkdir(parents=True, exist_ok=True)
for size in SIZES:
    image.resize((size, size), Image.LANCZOS).save(out / f'icon-{size}.png')
    print(f'wrote public/icons/icon-{size}.png')
