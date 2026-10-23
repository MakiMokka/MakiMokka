"""Verification sheets + final PNG hygiene for the OVYRA identity.

Usage: python3 brand/source/sheets.py   (after render.mjs)
- Flattens app-icon PNGs to opaque RGB (App Store icons must not have alpha).
- Writes brand/review/*.png: legibility, variants and icon-appearance sheets.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PNG = ROOT / "png"
OUT = ROOT / "review"
OUT.mkdir(exist_ok=True)
SIZES = [16, 32, 64, 128, 256, 512, 1024]
FONT = ImageFont.load_default(size=22)
SMALL = ImageFont.load_default(size=16)


def flatten_icons() -> None:
    for path in list(PNG.glob("ovyra-app-icon-*.png")) + list((PNG / "pwa").glob("*.png")):
        if "transparent" in path.name or "maskable" in path.name and False:
            continue
        img = Image.open(path)
        if img.mode != "RGB":
            bg = Image.new("RGB", img.size, (11, 16, 37))
            bg.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[3])
            bg.save(path, optimize=True)


def ios_mask(img: Image.Image) -> Image.Image:
    """Preview only: approximate the system corner mask (continuous corners)."""
    w = img.width
    scale = 4
    m = Image.new("L", (w * scale, w * scale), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * scale - 1, w * scale - 1), radius=int(w * scale * 0.2237), fill=255)
    m = m.resize((w, w), Image.LANCZOS)
    out = img.convert("RGBA")
    out.putalpha(m)
    return out


def legibility_sheet() -> None:
    pad = 40
    slot = lambda size: max(size, 110)
    width = sum(slot(s) for s in SIZES) + pad * (len(SIZES) + 1)
    height = 1024 + 260
    sheet = Image.new("RGB", (width, height * 2), (248, 249, 255))
    d = ImageDraw.Draw(sheet)
    d.rectangle((0, height, width, height * 2), fill=(11, 16, 37))
    for row, (bg_label, y0, ink) in enumerate([("Light background", 0, (17, 22, 43)), ("Dark background", height, (248, 249, 255))]):
        d.text((pad, y0 + 20), f"OVYRA app icon - actual pixel sizes - {bg_label}", font=FONT, fill=ink)
        x = pad
        for s in SIZES:
            icon = ios_mask(Image.open(PNG / f"ovyra-app-icon-{s}.png"))
            top = y0 + 80 + (1024 - s)
            sheet.paste(icon, (x, top), icon)
            d.text((x, y0 + 80 + 1024 + 16), f"{s}px", font=SMALL, fill=ink)
            if s <= 32:
                d.text((x, y0 + 80 + 1024 + 38), "simplified", font=SMALL, fill=ink)
            x += slot(s) + pad
    sheet.save(OUT / "legibility-actual-size.png", optimize=True)

    # Magnified small sizes (nearest-neighbour, 8×) to inspect pixels.
    zoom = Image.new("RGB", (16 * 8 + 32 * 8 + 64 * 8 + 4 * pad, 64 * 8 + 2 * pad + 40), (248, 249, 255))
    dz = ImageDraw.Draw(zoom)
    x = pad
    for s in (16, 32, 64):
        icon = ios_mask(Image.open(PNG / f"ovyra-app-icon-{s}.png")).resize((s * 8, s * 8), Image.NEAREST)
        zoom.paste(icon, (x, pad), icon)
        dz.text((x, pad + s * 8 + 8), f"{s}px ×8", font=SMALL, fill=(17, 22, 43))
        x += s * 8 + pad
    zoom.save(OUT / "legibility-small-zoom.png", optimize=True)


def variants_sheet() -> None:
    rows = [
        ("color-on-light", (255, 255, 255)),
        ("color-on-dark", (11, 16, 37)),
        ("mono-black", (240, 242, 250)),
        ("mono-white", (32, 41, 68)),
        ("solid-black", (255, 255, 255)),
        ("solid-white", (115, 91, 255)),
    ]
    w, h = 1000, 260
    sheet = Image.new("RGB", (w * 2, h * 3), "white")
    for i, (name, bg) in enumerate(rows):
        cell = Image.new("RGB", (w, h), bg)
        mark = Image.open(PNG / f"ovyra-wordmark-{name}-2000w.png").convert("RGBA")
        mark.thumbnail((w - 160, h - 90), Image.LANCZOS)
        cell.paste(mark, ((w - mark.width) // 2, (h - mark.height) // 2 - 10), mark)
        ImageDraw.Draw(cell).text((24, h - 34), f"wordmark-{name}", font=SMALL, fill=(128, 128, 140))
        sheet.paste(cell, ((i % 2) * w, (i // 2) * h))
    sheet.save(OUT / "wordmark-variants.png", optimize=True)

    symbols = [
        ("color", (255, 255, 255)),
        ("mono", (255, 255, 255)),
        ("light", (11, 16, 37)),
        ("simplified", (255, 255, 255)),
        ("solid-black", (240, 242, 250)),
        ("solid-white", (115, 91, 255)),
    ]
    c = 330
    sheet = Image.new("RGB", (c * len(symbols), c), "white")
    for i, (name, bg) in enumerate(symbols):
        cell = Image.new("RGB", (c, c), bg)
        sym = Image.open(PNG / f"ovyra-symbol-{name}-1024.png").convert("RGBA")
        sym.thumbnail((c - 80, c - 100), Image.LANCZOS)
        cell.paste(sym, ((c - sym.width) // 2, 30), sym)
        ImageDraw.Draw(cell).text((16, c - 30), f"symbol-{name}", font=SMALL, fill=(128, 128, 140))
        sheet.paste(cell, (i * c, 0))
    sheet.save(OUT / "symbol-variants.png", optimize=True)


def appearances_sheet() -> None:
    names = ["default", "light", "dark", "mono", "tinted"]
    c = 300
    sheet = Image.new("RGB", (c * len(names), c + 50), (240, 242, 250))
    d = ImageDraw.Draw(sheet)
    for i, name in enumerate(names):
        icon = ios_mask(Image.open(PNG / f"ovyra-app-icon-{name}-1024.png").resize((c - 60, c - 60), Image.LANCZOS))
        sheet.paste(icon, (i * c + 30, 30), icon)
        d.text((i * c + 30, c), name, font=SMALL, fill=(17, 22, 43))
    sheet.save(OUT / "icon-appearances.png", optimize=True)


if __name__ == "__main__":
    flatten_icons()
    legibility_sheet()
    variants_sheet()
    appearances_sheet()
    print("Review sheets written to", OUT)
