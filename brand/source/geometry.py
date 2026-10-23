"""OVYRA identity — parametric construction (source of truth for all brand SVGs).

Every shape is built from explicit geometry (circles, tangents, straight
strokes and controlled cubic Béziers). Nothing is auto-traced from pixels.
Units: the symbol is drawn in "symbol units" (su), the wordmark in "cap units"
where the cap height H = 200. See docs/brand/CONSTRUCTION.md.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

Point = tuple[float, float]


def f(v: float) -> str:
    """Compact number formatting for SVG output."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def pt(p: Point) -> str:
    return f"{f(p[0])} {f(p[1])}"


# ---------------------------------------------------------------------------
# Symbol: the ribbon V
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Circle:
    c: Point
    r: float


# Three construction circles define the whole silhouette (symbol units).
LEFT_TOP = Circle((190.0, 170.0), 86.0)   # left arm terminal
BASE = Circle((405.0, 488.0), 88.0)       # shared rounded base
RIGHT_TOP = Circle((650.0, 118.0), 72.0)  # right arm terminal (taller, slightly tapered)

# Symbol bounding box (silhouette extents) and canonical viewBox with margin.
BBOX = (
    LEFT_TOP.c[0] - LEFT_TOP.r,
    RIGHT_TOP.c[1] - RIGHT_TOP.r,
    RIGHT_TOP.c[0] + RIGHT_TOP.r,
    BASE.c[1] + BASE.r,
)


def capsule(a: Circle, b: Circle) -> str:
    """Closed path hugging two circles with their external tangents."""
    (x1, y1), (x2, y2) = a.c, b.c
    d = math.hypot(x2 - x1, y2 - y1)
    theta = math.atan2(y2 - y1, x2 - x1)
    alpha = math.acos((a.r - b.r) / d)
    p1p = (x1 + a.r * math.cos(theta + alpha), y1 + a.r * math.sin(theta + alpha))
    p2p = (x2 + b.r * math.cos(theta + alpha), y2 + b.r * math.sin(theta + alpha))
    p2m = (x2 + b.r * math.cos(theta - alpha), y2 + b.r * math.sin(theta - alpha))
    p1m = (x1 + a.r * math.cos(theta - alpha), y1 + a.r * math.sin(theta - alpha))
    large_b = 1 if 2 * alpha > math.pi else 0
    large_a = 1 if (2 * math.pi - 2 * alpha) > math.pi else 0
    return (
        f"M{pt(p1p)} L{pt(p2p)} A{f(b.r)} {f(b.r)} 0 {large_b} 0 {pt(p2m)} "
        f"L{pt(p1m)} A{f(a.r)} {f(a.r)} 0 {large_a} 0 {pt(p1p)} Z"
    )


def across(a: Circle, b: Circle, t: float = 0.5) -> tuple[Point, Point]:
    """Gradient vector perpendicular to the arm axis a→b, spanning its width
    (from the left side of the travel direction to the right side)."""
    (x1, y1), (x2, y2) = a.c, b.c
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy)
    px, py = -dy / n, dx / n
    mx, my = x1 + dx * t, y1 + dy * t
    r = a.r + (b.r - a.r) * t
    return (mx + px * r, my + py * r), (mx - px * r, my - py * r)


LEFT_ARM = capsule(LEFT_TOP, BASE)
RIGHT_ARM = capsule(BASE, RIGHT_TOP)
SILHOUETTE = f"{LEFT_ARM} {RIGHT_ARM}"

# Where the right arm crosses in front of the left arm it becomes a veil whose
# opacity fades from VEIL_OPACITY (at the crotch) to 0 (at the base).
VEIL_TOP = 330.0
VEIL_BOTTOM = 560.0
VEIL_OPACITY = 0.6

# The translucent fold: an S-shaped band that leaves the left arm's outer
# edge, sweeps through the base and climbs the right arm to its tip.
FOLD_UPPER = "M112 214 C196 300 312 352 420 336 C516 322 596 240 664 96"
FOLD = (
    "M112 214 C196 300 312 352 420 336 C516 322 596 240 664 96 "
    "C680 132 652 226 604 290 C548 362 470 398 404 400 C300 404 196 356 128 286 "
    "C116 262 110 236 112 214 Z"
)
# One-colour versions keep the fold as a knockout line kept inside the silhouette.
SOLID_FOLD = "M156 266 C226 318 322 352 420 336 C510 322 582 250 636 146"

# Shadow where the ribbon twists (a diagonal stripe inside the left arm).
FOLD_SHADOW = "M214 92 C270 128 320 214 352 300 C364 334 362 356 346 364 C306 340 270 296 248 244 C226 190 214 140 214 92 Z"
# Second, softer shadow at the inner foot of the left arm.
FOOT_SHADOW = "M300 450 C320 490 336 520 352 556 C330 560 306 540 286 508 C276 486 280 462 300 450 Z"
# Specular contour lines (omitted from app-icon layers: iOS adds its own).
HIGHLIGHTS = [
    FOLD_UPPER,
    # Ribbon edge wrapping the left terminal.
    "M126 236 C122 196 150 176 186 190 C236 210 300 262 356 320",
]


# ---------------------------------------------------------------------------
# Wordmark: geometric monoline letters (cap height H = 200)
# ---------------------------------------------------------------------------
H = 200.0
S = 26.0          # stem weight (0.13 H)
S_ROUND = 28.5    # round strokes slightly heavier (optical)
OVERSHOOT = 4.0   # round/pointed shapes exceed cap height & baseline


def line_x_at(p: Point, q: Point, y: float) -> float:
    return p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1])


def offset_line(p: Point, q: Point, dist: float) -> tuple[Point, Point]:
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy)
    nx, ny = -dy / n * dist, dx / n * dist
    return (p[0] + nx, p[1] + ny), (q[0] + nx, q[1] + ny)


def intersect(a1: Point, a2: Point, b1: Point, b2: Point) -> Point:
    x1, y1 = a1
    x2, y2 = a2
    x3, y3 = b1
    x4, y4 = b2
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den
    return (px, py)


def poly(points: list[Point]) -> str:
    return "M" + " L".join(pt(p) for p in points) + " Z"


def letter_o(x: float) -> tuple[str, float]:
    r_out = H / 2 + OVERSHOOT
    r_in = r_out - S_ROUND
    cx, cy = x + r_out, H / 2
    # Two circles as arcs; evenodd fill-rule makes the counter.
    d = (
        f"M{f(cx - r_out)} {f(cy)} A{f(r_out)} {f(r_out)} 0 1 0 {f(cx + r_out)} {f(cy)} "
        f"A{f(r_out)} {f(r_out)} 0 1 0 {f(cx - r_out)} {f(cy)} Z "
        f"M{f(cx - r_in)} {f(cy)} A{f(r_in)} {f(r_in)} 0 1 1 {f(cx + r_in)} {f(cy)} "
        f"A{f(r_in)} {f(r_in)} 0 1 1 {f(cx - r_in)} {f(cy)} Z"
    )
    return d, 2 * r_out


def letter_y(x: float, width: float = 190.0, junction: float = 0.42 * H) -> tuple[str, float]:
    cx = x + width / 2
    j = (cx, junction)
    # Diagonal stroke weight is slightly lighter than stems (optical).
    t = S * 0.96
    # offset_line(+d) moves to the left of the travel direction (y-down).
    l_out_a, l_out_b = offset_line((x + t * 0.75, 0), j, t / 2)
    l_in_a, l_in_b = offset_line((x + t * 0.75, 0), j, -t / 2)
    r_in_a, r_in_b = offset_line((x + width - t * 0.75, 0), j, t / 2)
    r_out_a, r_out_b = offset_line((x + width - t * 0.75, 0), j, -t / 2)
    tl = (line_x_at(l_out_a, l_out_b, 0), 0.0)
    tr = (line_x_at(l_in_a, l_in_b, 0), 0.0)
    crotch = intersect(l_in_a, l_in_b, r_in_a, r_in_b)
    rtl = (line_x_at(r_in_a, r_in_b, 0), 0.0)
    rtr = (line_x_at(r_out_a, r_out_b, 0), 0.0)
    sl, sr = cx - S / 2, cx + S / 2
    left_join = (sl, l_out_a[1] + (sl - l_out_a[0]) * (l_out_b[1] - l_out_a[1]) / (l_out_b[0] - l_out_a[0]))
    right_join = (sr, r_out_a[1] + (sr - r_out_a[0]) * (r_out_b[1] - r_out_a[1]) / (r_out_b[0] - r_out_a[0]))
    d = poly([tl, tr, crotch, rtl, rtr, right_join, (sr, H), (sl, H), left_join])
    return d, width


def letter_r(x: float) -> tuple[str, float]:
    """Stemless R: top bar, semicircular bowl, middle bar, diagonal leg."""
    width = 0.67 * H
    rb = 0.317 * H                      # bowl outer radius
    xc, yc = x + width - rb, rb         # bowl centre
    ri = rb - S_ROUND
    bowl_bottom = 2 * rb
    mid_left = x + 0.122 * H
    # Bars overlap the bowl by 1 unit to avoid anti-aliasing seams.
    d_bars = poly([(x, 0), (xc + 1, 0), (xc + 1, S), (x, S)])
    d_bowl = (
        f"M{f(xc)} 0 A{f(rb)} {f(rb)} 0 0 1 {f(xc)} {f(bowl_bottom)} "
        f"L{f(xc)} {f(bowl_bottom - S_ROUND)} A{f(ri)} {f(ri)} 0 0 0 {f(xc)} {f(S_ROUND)} Z"
    )
    d_mid = poly([(mid_left, bowl_bottom - S), (xc + 1, bowl_bottom - S), (xc + 1, bowl_bottom), (mid_left, bowl_bottom)])
    # Leg: perpendicular weight = S, base aligned under the bowl's right edge.
    leg_top = bowl_bottom - S
    base_left = x + 0.512 * H
    ang = math.atan2(base_left - mid_left, H - leg_top)
    w = S / math.cos(ang)
    d_leg = poly([(mid_left, leg_top), (mid_left + w, leg_top), (base_left + w, H), (base_left, H)])
    return f"{d_bars} {d_bowl} {d_mid} {d_leg}", max(width, base_left + w - x)


def letter_a(x: float, width: float = 214.0) -> tuple[str, float]:
    """Crossbar-less A (lambda form) with a slightly flattened apex."""
    cx = x + width / 2
    t = S * 0.98
    apex = (cx, -OVERSHOOT - 18)
    bl, br = (x + t * 0.6, H), (x + width - t * 0.6, H)
    lo_a, lo_b = offset_line(apex, bl, t / 2)
    li_a, li_b = offset_line(apex, bl, -t / 2)
    ri_a, ri_b = offset_line(apex, br, t / 2)
    ro_a, ro_b = offset_line(apex, br, -t / 2)
    top = -OVERSHOOT
    p = [
        (line_x_at(lo_a, lo_b, H), H),
        (line_x_at(lo_a, lo_b, top), top),
        (line_x_at(ro_a, ro_b, top), top),
        (line_x_at(ro_a, ro_b, H), H),
        (line_x_at(ri_a, ri_b, H), H),
        intersect(li_a, li_b, ri_a, ri_b),
        (line_x_at(li_a, li_b, H), H),
    ]
    return poly(p), width


# Optical spacing (cap units), measured from the approved styleboard.
GAP_O_V = 0.195 * H
GAP_V_Y = 0.07 * H
GAP_Y_R = 0.17 * H
GAP_R_A = 0.235 * H
# The V spans from 0.30 H above cap height to 0.075 H below the baseline.
V_TOP = -0.30 * H
V_BOTTOM = H + 0.075 * H
