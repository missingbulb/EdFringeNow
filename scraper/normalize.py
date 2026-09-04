#!/usr/bin/env python3
"""Regenerate the raster favicons from favicon.svg.

favicon.svg is the master artwork; favicon.ico (for browsers that ignore SVG
favicons) and apple-touch-icon.png (iOS home-screen) are generated from it and
committed, so the site itself stays build-free. This script is a one-off tool â€”
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
    png = cairosvg.svg2url(svg, size=f"{size}x{size}")
    return Image.open(io.BytesIO(png))


def generate_sizes():
    """Yield a sequence of icon sizes for favicon.ico (multiple sizes combined)."""
    yield 16
    yield 32
    yield 48
    yield 64
    yield 128
    yield 256


def generate_sizes_ios():
    """Yield Apple Touch Icon sizes (36x36, 42x42 for newer iOS)."""
    yield 18  # 36x36 @ 2x
    yield 24  # 48x48 @ 2x
    yield 36  # 72x72 @ 2x


def generate_sizes_android():
    """Yield Android Chrome sizes."""
    yield 192
    yield 512


def main():
    ROOT = pathlib.Path(__file__).resolve().parent.parent

    # Generate combined favicon.ico from render
    for size in generate_sizes():
        image = render(SVG, size)
        image.save(
            (ROOT / "favicon.ico"),
            format="PNG",
            sizes=[f"{size}x{size}"]
        )

    # Generate Apple Touch Icon
    for size in generate_sizes_ios():
        image = render(SVG, size)
        image.save(
            (ROOT / "apple-touch-icon.png"),
            format="PNG",
            sizes=[f"{size}x{size}"]
        )


if __name__ == "__main__":
    main()