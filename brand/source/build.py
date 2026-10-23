"""Generate every OVYRA brand SVG from geometry.py.

Usage:  python3 brand/source/build.py   (then: node brand/source/render.mjs)
Edit geometry.py or the palettes below, re-run, and commit the outputs.
"""
from __future__ import annotations

from pathlib import Path

import geometry as g
from geometry import f

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "svg"
LAYERS = ROOT / "layers"

# ---------------------------------------------------------------------------
# Palette (brand gradient stops are exact; shading tones are derived tints).
# ---------------------------------------------------------------------------
BLUE, VIOLET, PINK, CORAL = "#458AFF", "#735BFF", "#F04BBA", "#FF9673"
INK, PAPER = "#11162B", "#F8F9FF"
MIDNIGHT, MIDNIGHT_2 = "#0B1025", "#151C36"

COLOR = {
    "left": [(0, BLUE, 1), (0.35, "#3E6BFF", 1), (0.7, "#4A4BF2", 1), (1, VIOLET, 1)],
    "right": [(0, "#6152FF", 1), (0.3, "#A34FE6", 1), (0.5, PINK, 1), (0.72, "#FF6577", 1), (0.9, CORAL, 1), (1, "#FFC291", 1)],
    "fold": [(0, "#9DBBFF", 0.55), (0.45, "#B98CFF", 0.5), (0.75, "#FF9ACB", 0.5), (1, "#FFD3B0", 0.55)],
    "shadow": [(0, "#120F5C", 0.8), (1, "#2A1FA0", 0)],
    "highlight": "#FFFFFF",
    "highlight_opacity": 0.5,
    # Cross-arm shading (optical depth): left/outer edge → right/inner edge.
    "sheen_left": [(0, "#8FD0FF", 0.45), (0.45, "#3B5BFF", 0), (1, "#0C0A4A", 0.5)],
    "sheen_right": [(0, "#FFFFFF", 0.22), (0.5, "#FFFFFF", 0), (1, "#D9244F", 0.35)],
}
MONO = {
    "left": [(0, "#1E1F26", 1), (1, "#4A4B56", 1)],
    "right": [(0, "#4A4B56", 1), (1, "#C3C4CD", 1)],
    "fold": [(0, "#FFFFFF", 0.42), (1, "#E6E6EC", 0.42)],
    "shadow": [(0, "#000000", 0.6), (1, "#000000", 0)],
    "highlight": "#FFFFFF",
    "highlight_opacity": 0.45,
    "sheen_left": [(0, "#FFFFFF", 0.3), (0.45, "#FFFFFF", 0), (1, "#000000", 0.45)],
    "sheen_right": [(0, "#FFFFFF", 0.22), (0.5, "#FFFFFF", 0), (1, "#000000", 0.25)],
}
LIGHT = {
    "left": [(0, "#FFFFFF", 0.96), (1, "#E3E6F7", 0.9)],
    "right": [(0, "#E9EBF8", 0.62), (1, "#FFFFFF", 0.78)],
    "fold": [(0, "#FFFFFF", 0.5), (1, "#FFFFFF", 0.35)],
    "shadow": [(0, "#9097C2", 0.45), (1, "#9097C2", 0)],
    "highlight": "#FFFFFF",
    "highlight_opacity": 0.6,
    "sheen_left": [(0, "#FFFFFF", 0.3), (0.5, "#FFFFFF", 0), (1, "#9097C2", 0.4)],
    "sheen_right": [(0, "#FFFFFF", 0.3), (0.5, "#FFFFFF", 0), (1, "#9097C2", 0.3)],
}

# Gradient vectors in symbol units.
VECTORS = {
    "left": ((150, 90), (420, 570)),
    "right": ((420, 570), (690, 50)),
    "fold": ((112, 0), (680, 0)),
    "shadow": ((300, 140), (300, 350)),
}


VECTORS["sheen_left"] = g.across(g.BASE, g.LEFT_TOP, 0.55)   # outer (left) edge → inner edge
VECTORS["sheen_right"] = g.across(g.RIGHT_TOP, g.BASE, 0.45)  # inner (left) edge → outer edge


def lin(gid: str, layer: str, stops) -> str:
    (x1, y1), (x2, y2) = VECTORS[layer]
    s = "".join(
        f'<stop offset="{f(o)}" stop-color="{c}"' + (f' stop-opacity="{f(a)}"' if a != 1 else "") + "/>"
        for o, c, a in stops
    )
    return (
        f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" '
        f'x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}">{s}</linearGradient>'
    )


def symbol_group(prefix: str, palette: dict, detail: str = "full") -> tuple[str, str]:
    """Return (defs, group) for the V in symbol units.

    detail: "full"     – arms, fold, shadow, highlights (marketing / UI)
            "icon"     – arms + fold, no shadow/highlights (iOS adds its own)
            "simple"   – arms only (≤ 32 px)
    """
    defs = [
        lin(f"{prefix}-left", "left", palette["left"]),
        lin(f"{prefix}-right", "right", palette["right"]),
        f'<clipPath id="{prefix}-clip"><path d="{g.SILHOUETTE}"/></clipPath>',
        f'<clipPath id="{prefix}-clip-left"><path d="{g.LEFT_ARM}"/></clipPath>',
    ]
    parts = [f'<path id="{prefix}-left-arm" d="{g.LEFT_ARM}" fill="url(#{prefix}-left)"/>']
    if detail == "full":
        defs.append(lin(f"{prefix}-sheen-l", "sheen_left", palette["sheen_left"]))
        parts.append(f'<path id="{prefix}-left-sheen" d="{g.LEFT_ARM}" fill="url(#{prefix}-sheen-l)"/>')
    if detail == "full":
        defs.append(lin(f"{prefix}-shadow", "shadow", palette["shadow"]))
        parts.append(
            f'<g id="{prefix}-fold-shadow" fill="url(#{prefix}-shadow)" clip-path="url(#{prefix}-clip-left)">'
            f'<path d="{g.FOLD_SHADOW}"/><path d="{g.FOOT_SHADOW}" opacity="0.6"/></g>'
        )
    # Right arm: solid where it stands free, a translucent veil where it crosses
    # in front of the left arm (fading out toward the shared base).
    defs.append(
        f'<mask id="{prefix}-free" maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="700">'
        f'<rect width="900" height="700" fill="#fff"/><path d="{g.LEFT_ARM}" fill="#000"/></mask>'
        f'<linearGradient id="{prefix}-veil-g" gradientUnits="userSpaceOnUse" x1="0" y1="{f(g.VEIL_TOP)}" x2="0" y2="{f(g.VEIL_BOTTOM)}">'
        f'<stop offset="0" stop-color="#fff" stop-opacity="{f(g.VEIL_OPACITY)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        f'<mask id="{prefix}-veil" maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="700">'
        f'<rect width="900" height="700" fill="url(#{prefix}-veil-g)"/></mask>'
    )
    parts.append(
        f'<g id="{prefix}-right-arm">'
        f'<path d="{g.RIGHT_ARM}" fill="url(#{prefix}-right)" mask="url(#{prefix}-free)"/>'
        f'<g clip-path="url(#{prefix}-clip-left)" mask="url(#{prefix}-veil)"><path d="{g.RIGHT_ARM}" fill="url(#{prefix}-right)"/></g>'
        f"</g>"
    )
    if detail == "full":
        defs.append(lin(f"{prefix}-sheen-r", "sheen_right", palette["sheen_right"]))
        parts.append(
            f'<path id="{prefix}-right-sheen" d="{g.RIGHT_ARM}" fill="url(#{prefix}-sheen-r)" mask="url(#{prefix}-free)"/>'
        )
    if detail in ("full", "icon"):
        defs.append(lin(f"{prefix}-fold", "fold", palette["fold"]))
        parts.append(f'<path id="{prefix}-fold" d="{g.FOLD}" fill="url(#{prefix}-fold)" clip-path="url(#{prefix}-clip)"/>')
    if detail == "full":
        lines = "".join(f'<path d="{d}"/>' for d in g.HIGHLIGHTS)
        parts.append(
            f'<g id="{prefix}-highlights" clip-path="url(#{prefix}-clip)" fill="none" '
            f'stroke="{palette["highlight"]}" stroke-opacity="{f(palette["highlight_opacity"])}" '
            f'stroke-width="3" stroke-linecap="round">{lines}</g>'
        )
    return "".join(defs), f'<g id="{prefix}-symbol">{"".join(parts)}</g>'


def solid_symbol(prefix: str, color: str) -> tuple[str, str]:
    """One-colour silhouette; the fold edge is kept as a knockout line."""
    defs = (
        f'<mask id="{prefix}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="700">'
        f'<path d="{g.SILHOUETTE}" fill="#fff"/>'
        f'<path d="{g.SOLID_FOLD}" fill="none" stroke="#000" stroke-width="12" stroke-linecap="round"/>'
        f"</mask>"
    )
    return defs, f'<g id="{prefix}-symbol"><path d="{g.SILHOUETTE}" fill="{color}" mask="url(#{prefix}-mask)"/></g>'


def svg_doc(viewbox: tuple[float, float, float, float], body: str, title: str, defs: str = "", w=None, h=None) -> str:
    x, y, vw, vh = viewbox
    size = f' width="{f(w)}" height="{f(h)}"' if w else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(x)} {f(y)} {f(vw)} {f(vh)}"{size} '
        f'role="img" aria-label="{title}">\n'
        f"<title>{title}</title>\n"
        f"<!-- OVYRA identity v1.0 · candidate, pending visual review · generated by brand/source/build.py -->\n"
        f"<defs>{defs}</defs>\n{body}\n</svg>\n"
    )


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Symbol files
# ---------------------------------------------------------------------------
M = 24  # margin in symbol units
x0, y0, x1, y1 = g.BBOX
SYMBOL_VB = (x0 - M, y0 - M, (x1 - x0) + 2 * M, (y1 - y0) + 2 * M)


def build_symbols() -> None:
    for name, palette, detail in [
        ("color", COLOR, "full"),
        ("mono", MONO, "full"),
        ("light", LIGHT, "full"),
        ("simplified", COLOR, "simple"),
    ]:
        defs, body = symbol_group(f"ov-sym-{name}", palette, detail)
        write(SVG / f"ovyra-symbol-{name}.svg", svg_doc(SYMBOL_VB, body, f"OVYRA symbol ({name})", defs))
    for name, color in [("black", "#000000"), ("white", "#FFFFFF")]:
        defs, body = solid_symbol(f"ov-sym-solid-{name}", color)
        write(SVG / f"ovyra-symbol-solid-{name}.svg", svg_doc(SYMBOL_VB, body, f"OVYRA symbol (solid {name})", defs))


# ---------------------------------------------------------------------------
# Wordmark files
# ---------------------------------------------------------------------------
def wordmark_layout() -> tuple[str, tuple[float, float, float], float]:
    """Return (letters path, (v_x, v_y, v_scale), total width)."""
    d_o, w_o = g.letter_o(0)
    v_scale = (g.V_BOTTOM - g.V_TOP) / (y1 - y0)
    v_w = (x1 - x0) * v_scale
    v_x = w_o + g.GAP_O_V
    x = v_x + v_w + g.GAP_V_Y
    d_y, w_y = g.letter_y(x)
    x += w_y + g.GAP_Y_R
    d_r, w_r = g.letter_r(x)
    x += w_r + g.GAP_R_A
    d_a, w_a = g.letter_a(x)
    total = x + w_a
    letters = f"{d_o} {d_y} {d_r} {d_a}"
    return letters, (v_x, g.V_TOP, v_scale), total


def build_wordmarks() -> None:
    letters, (vx, vy, vs), total = wordmark_layout()
    pad = 0  # tight bounds; clear space is defined in CONSTRUCTION.md, not baked in
    top = vy - pad
    bottom = g.V_BOTTOM + pad
    vb = (-pad, top, total + 2 * pad, bottom - top)
    transform = f'transform="translate({f(vx)} {f(vy)}) scale({vs:.5f}) translate({f(-x0)} {f(-y0)})"'
    variants = [
        ("color-on-light", INK, ("palette", COLOR)),
        ("color-on-dark", PAPER, ("palette", COLOR)),
        ("mono-black", "#000000", ("palette", MONO)),
        ("mono-white", "#FFFFFF", ("palette", LIGHT)),
        ("solid-black", "#000000", ("solid", "#000000")),
        ("solid-white", "#FFFFFF", ("solid", "#FFFFFF")),
    ]
    for name, ink, (kind, value) in variants:
        prefix = f"ov-wm-{name}"
        defs, sym = symbol_group(prefix, value, "full") if kind == "palette" else solid_symbol(prefix, value)
        body = (
            f'<path id="{prefix}-letters" d="{letters}" fill="{ink}"/>'
            f"<g {transform}>{sym}</g>"
        )
        write(SVG / f"ovyra-wordmark-{name}.svg", svg_doc(vb, body, "OVYRA", defs))


# ---------------------------------------------------------------------------
# App icons (1024 × 1024, square, unmasked — the system applies the mask)
# ---------------------------------------------------------------------------
ICON = 1024
ICON_V_WIDTH = 0.62 * ICON


def icon_transform(width: float = ICON_V_WIDTH, cy: float = 506) -> str:
    s = width / (x1 - x0)
    tx = ICON / 2 - (x1 - x0) * s / 2
    ty = cy - (y1 - y0) * s / 2
    return f'transform="translate({f(tx)} {f(ty)}) scale({s:.5f}) translate({f(-x0)} {f(-y0)})"'


BACKGROUNDS = {
    "default": f'<radialGradient id="BGID" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#232A5C"/>'
    f'<stop offset="0.55" stop-color="{MIDNIGHT}"/><stop offset="1" stop-color="#060914"/></radialGradient>',
    "light": '<radialGradient id="BGID" cx="50%" cy="38%" r="80%"><stop offset="0" stop-color="#FFFFFF"/>'
    '<stop offset="1" stop-color="#EEF0F8"/></radialGradient>',
    "dark": '<radialGradient id="BGID" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#15182A"/>'
    '<stop offset="1" stop-color="#000000"/></radialGradient>',
    "mono": '<radialGradient id="BGID" cx="50%" cy="38%" r="80%"><stop offset="0" stop-color="#FFFFFF"/>'
    '<stop offset="1" stop-color="#ECECF0"/></radialGradient>',
    "tinted": '<radialGradient id="BGID" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#1A1A1A"/>'
    '<stop offset="1" stop-color="#000000"/></radialGradient>',
}


def build_icons() -> None:
    plan = [
        ("default", COLOR, "icon"),
        ("light", COLOR, "icon"),
        ("dark", COLOR, "icon"),
        ("mono", MONO, "icon"),
        ("tinted", LIGHT, "icon"),
    ]
    for name, palette, detail in plan:
        prefix = f"ov-icon-{name}"
        defs, sym = symbol_group(prefix, palette, detail)
        bg = BACKGROUNDS[name].replace("BGID", f"{prefix}-bg")
        body = (
            f'<rect id="{prefix}-background" width="{ICON}" height="{ICON}" fill="url(#{prefix}-bg)"/>'
            f"<g {icon_transform()}>{sym}</g>"
        )
        write(SVG / f"ovyra-app-icon-{name}.svg", svg_doc((0, 0, ICON, ICON), body, "OVYRA app icon", bg + defs, ICON, ICON))
    # Transparent foreground (clear appearance / custom backgrounds).
    defs, sym = symbol_group("ov-icon-clear", COLOR, "icon")
    write(
        SVG / "ovyra-app-icon-foreground-transparent.svg",
        svg_doc((0, 0, ICON, ICON), f"<g {icon_transform()}>{sym}</g>", "OVYRA app icon foreground", defs, ICON, ICON),
    )
    # Simplified icon for 16–32 px renders.
    defs, sym = symbol_group("ov-icon-small", COLOR, "simple")
    bg = BACKGROUNDS["default"].replace("BGID", "ov-icon-small-bg")
    write(
        SVG / "ovyra-app-icon-small.svg",
        svg_doc(
            (0, 0, ICON, ICON),
            f'<rect width="{ICON}" height="{ICON}" fill="url(#ov-icon-small-bg)"/><g {icon_transform(0.70 * ICON, 512)}>{sym}</g>',
            "OVYRA app icon (small sizes)",
            bg + defs,
            ICON,
            ICON,
        ),
    )
    # PWA maskable icon: V inside the 80 % safe circle.
    defs, sym = symbol_group("ov-icon-maskable", COLOR, "icon")
    bg = BACKGROUNDS["default"].replace("BGID", "ov-icon-maskable-bg")
    write(
        SVG / "ovyra-app-icon-maskable.svg",
        svg_doc(
            (0, 0, ICON, ICON),
            f'<rect width="{ICON}" height="{ICON}" fill="url(#ov-icon-maskable-bg)"/><g {icon_transform(0.48 * ICON, 512)}>{sym}</g>',
            "OVYRA app icon (maskable)",
            bg + defs,
            ICON,
            ICON,
        ),
    )


def build_layers() -> None:
    """Separate 1024² layers for Icon Composer (opaque fills; set opacity there)."""
    t = icon_transform()
    pieces = {
        "01-left-arm": (lin("l-left", "left", COLOR["left"]), f'<path d="{g.LEFT_ARM}" fill="url(#l-left)"/>'),
        "02-right-arm": (
            lin("l-right", "right", [(o, c, 1) for o, c, _ in COLOR["right"]]),
            f'<path d="{g.RIGHT_ARM}" fill="url(#l-right)"/>',
        ),
        "03-fold": (
            lin("l-fold", "fold", [(o, c, 1) for o, c, _ in COLOR["fold"]])
            + f'<clipPath id="l-clip"><path d="{g.SILHOUETTE}"/></clipPath>',
            f'<path d="{g.FOLD}" fill="url(#l-fold)" clip-path="url(#l-clip)"/>',
        ),
    }
    for name, (defs, body) in pieces.items():
        write(
            LAYERS / f"ovyra-icon-layer-{name}.svg",
            svg_doc((0, 0, ICON, ICON), f"<g {t}>{body}</g>", f"OVYRA icon layer {name}", defs, ICON, ICON),
        )
    write(
        LAYERS / "ovyra-icon-layer-00-background.svg",
        svg_doc(
            (0, 0, ICON, ICON),
            f'<rect width="{ICON}" height="{ICON}" fill="url(#l-bg)"/>',
            "OVYRA icon background",
            BACKGROUNDS["default"].replace("BGID", "l-bg"),
            ICON,
            ICON,
        ),
    )


if __name__ == "__main__":
    build_symbols()
    build_wordmarks()
    build_icons()
    build_layers()
    print("SVGs written to", SVG, "and", LAYERS)
