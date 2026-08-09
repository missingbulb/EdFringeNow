#!/usr/bin/env python3
"""Regenerate the raster favicons from favicon.svg.

favicon.svg is the master artwork; favicon.ico (for browsers that ignore SVG
favicons) and apple-touch-icon.png (iOS home-screen) are generated from it and
committed, so the site itself stays build-free. This script is a one-off tool —
it is NOT part of scripts/verify.sh and needs two libraries the project does not
otherwise use:

    pip install cairosvg pillow
    python3 scripts/make-favicons.py

Run it after editing favicon.svg, and commit the regenerated files.
"""

import io
import pathlib
import re

import cairosvg
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SVG = (ROOT / "favicon.svg").read_text(encoding="utf-8")


def render(svg: str, size: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=svg.encode("utf-8"),
                           output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


# Browser tabs / bookmarks. 48px is what Windows site shortcuts pick up. Each
# size is rendered from the vector rather than downsampled from one bitmap, so
# the 16px frame stays crisp; the largest is the base image Pillow writes first.
icons = [render(SVG, s) for s in (48, 32, 16)]
icons[0].save(ROOT / "favicon.ico", format="ICO",
              sizes=[(i.width, i.height) for i in icons], append_images=icons[1:])

# iOS masks the home-screen icon itself and dislikes transparency, so the Apple
# icon is the same artwork full-bleed: square corners, flattened onto the tile.
square = re.sub(r'\srx="\d+"', "", SVG, count=1)
render(square, 180).convert("RGB").save(ROOT / "apple-touch-icon.png")

print("wrote favicon.ico, apple-touch-icon.png")
