"""Generate the PWA / Apple touch icons from code (no external assets).

Usage: python3 scripts/generate-icons.py
Requires Pillow. Output is committed under public/icons/.
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
TOP = (10, 132, 255)  # iOS systemBlue (dark variant)
BOTTOM = (0, 88, 208)


def render(size: int, glyph_scale: float) -> Image.Image:
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGB", (s, s), TOP)
    draw = ImageDraw.Draw(img)
    for y in range(s):
        t = y / (s - 1)
        color = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        draw.line([(0, y), (s, y)], fill=color)

    # Envelope glyph, centered.
    w = s * glyph_scale
    h = w * 0.7
    x0 = (s - w) / 2
    y0 = (s - h) / 2
    x1, y1 = x0 + w, y0 + h
    stroke = max(2, round(s * 0.035))
    radius = w * 0.12
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, outline="white", width=stroke)
    inset = stroke * 1.2
    draw.line(
        [(x0 + inset, y0 + inset), ((x0 + x1) / 2, y0 + h * 0.55), (x1 - inset, y0 + inset)],
        fill="white",
        width=stroke,
        joint="curve",
    )
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    render(180, 0.56).save(OUT / "apple-touch-icon.png", optimize=True)
    render(192, 0.56).save(OUT / "icon-192.png", optimize=True)
    render(512, 0.56).save(OUT / "icon-512.png", optimize=True)
    # Maskable icons keep the glyph inside the 80% safe zone.
    render(512, 0.44).save(OUT / "icon-maskable-512.png", optimize=True)


if __name__ == "__main__":
    main()
