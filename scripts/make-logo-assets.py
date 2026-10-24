#!/usr/bin/env python3
"""Derive the OpenPrintCost logo assets from the master PNG in branding/.

The master file (``branding/openprintcost-logo-source.png``) is a flattened RGB
image with a white background. This script produces the derived assets that
the app and the desktop bundles actually use:

  src/assets/logo.png            full logo (mark + wordmark), transparent
  src/assets/logo-mark.png       symbol only, transparent (app header, favicon)
  src-tauri/icons/icon-source.png  1024x1024 square source for ``tauri icon``

Run from the repository root:

    python3 scripts/make-logo-assets.py

Requires Pillow (``pip install Pillow``).
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "branding" / "openprintcost-logo-source.png"
OUT_FULL = ROOT / "src" / "assets" / "logo.png"
OUT_MARK = ROOT / "src" / "assets" / "logo-mark.png"
OUT_FAVICON = ROOT / "public" / "favicon.png"
OUT_ICON_SOURCE = ROOT / "src-tauri" / "icons" / "icon-source.png"

# A pixel counts as "background" when every channel is at least this bright.
NEAR_WHITE = 249
# Pixels darker than this are considered ink and define the content bounding box.
INK = 245


def make_transparent(image: Image.Image) -> Image.Image:
    """Turn the white background transparent, keeping white inside the logo.

    Only near-white pixels that are connected to the image border are cleared,
    so white details inside the artwork (calculator screen, keypad, cube faces)
    stay opaque.
    """
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()

    near_white = [[min(pixels[x, y]) >= NEAR_WHITE for x in range(width)] for y in range(height)]
    background = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if near_white[y][x] and not background[y][x]:
            background[y][x] = True
            queue.append((y, x))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < height and 0 <= nx < width and not background[ny][nx] and near_white[ny][nx]:
                background[ny][nx] = True
                queue.append((ny, nx))

    out = rgb.convert("RGBA")
    alpha = out.load()
    for y in range(height):
        row = background[y]
        for x in range(width):
            if row[x]:
                alpha[x, y] = 0
    return out


def content_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box (left, top, right, bottom) of the non-background artwork."""
    alpha = image.getchannel("A")
    return alpha.getbbox() or (0, 0, image.width, image.height)


def split_mark_and_wordmark(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Split the logo into the symbol (printer + calculator) and the wordmark."""
    alpha = image.getchannel("A")
    width, height = image.size
    data = alpha.load()

    rows = [any(data[x, y] > 0 for x in range(width)) for y in range(height)]
    runs: list[tuple[int, int]] = []
    start: int | None = None
    for y, filled in enumerate(rows):
        if filled and start is None:
            start = y
        elif not filled and start is not None:
            runs.append((start, y - 1))
            start = None
    if start is not None:
        runs.append((start, height - 1))

    if not runs:
        raise SystemExit("No artwork found in the source logo.")

    # The symbol is the first (topmost) block; the wordmark follows below it.
    top, bottom = runs[0]
    mark = image.crop((0, top, width, bottom + 1))
    mark = mark.crop(content_bbox(mark))
    return mark, image


def build_icon_source(mark: Image.Image, size: int = 1024, scale: float = 0.82) -> Image.Image:
    """Square icon source: white canvas (as the logo was designed) + centred mark."""
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    inner = int(size * scale)
    resized = mark.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.alpha_composite(resized, (offset, offset))
    return canvas


def main() -> int:
    if not SOURCE.exists():
        print(f"error: source logo not found: {SOURCE}", file=sys.stderr)
        return 1

    logo = make_transparent(Image.open(SOURCE))
    mark, full = split_mark_and_wordmark(logo)

    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)
    OUT_ICON_SOURCE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FAVICON.parent.mkdir(parents=True, exist_ok=True)

    full.crop(content_bbox(full)).save(OUT_FULL, optimize=True)
    mark.save(OUT_MARK, optimize=True)
    mark.save(OUT_FAVICON, optimize=True)
    build_icon_source(mark).save(OUT_ICON_SOURCE, optimize=True)

    print(f"wrote {OUT_FULL.relative_to(ROOT)}")
    print(f"wrote {OUT_MARK.relative_to(ROOT)}")
    print(f"wrote {OUT_FAVICON.relative_to(ROOT)}")
    print(f"wrote {OUT_ICON_SOURCE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
