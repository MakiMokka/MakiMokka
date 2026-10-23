# OVYRA — construction, clear space and usage (v1.0 candidate)

Source of art direction: `docs/brand/reference/OVYRA_approved_styleboard.png` (from
`OVYRA_Brand_Assets_v1.zip`). The SVGs in that package describe themselves as an "interpreted
reconstruction" with a substitute typeface for the wordmark, so they were **not** used as the
basis. Everything in `brand/` was rebuilt from geometry in `brand/source/geometry.py`.

> **Status: candidate, pending visual review.** See §9 for every known difference from the
> reference. Nothing here should be called final until those items are approved.

## 1. Symbol — the ribbon V

The V is constructed from **three circles**, in symbol units (su):

| Circle    | Centre     | Radius | Role                                      |
| --------- | ---------- | ------ | ----------------------------------------- |
| Left top  | (190, 170) | 86     | Left arm terminal                         |
| Base      | (405, 488) | 88     | Shared rounded base                       |
| Right top | (650, 118) | 72     | Right arm terminal (taller, slight taper) |

- Each arm is the **external-tangent hull** of two circles (a capsule). The left arm axis runs at
  55.9° and the right arm at 56.5°, so the V is near-symmetric in angle but asymmetric in height.
  The right terminal rises 34 su above the left one.
- Silhouette bounding box: 618 × 530 su (x 104–722, y 46–576).
- **Layer order, back to front:**
  1. left arm (blue → violet)
  2. cross-arm sheen and twist shadow (inside the left arm)
  3. right arm (violet → pink → coral → peach): solid where free, a translucent veil where it
     crosses in front of the left arm, fading to 0 at the base
  4. right-arm sheen
  5. the **fold**: an S-band of cubic Béziers that leaves the left arm's outer edge, dips through
     the junction and climbs the right arm to its tip
  6. hairline specular contours
- **Detail levels:**
  - `full`: everything above. Used for marketing and in-app.
  - `icon`: arms and fold only, because iOS adds its own highlights and depth.
  - `simple`: arms only, for 32 px and smaller.

## 2. Wordmark

Cap height **H = 200** units. Monoline geometric letters, outlined, with no font dependency.

| Element | Construction                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Stem    | S = 0.13 H (26). Diagonals at 0.96–0.98 S, rounds at 28.5 (optical compensation).                                                    |
| O       | Perfect ring. Outer radius 0.5 H plus a 4-unit overshoot above and below.                                                            |
| V       | The symbol, scaled to span from 0.30 H above the cap line to 0.075 H below the baseline (scale 0.519).                               |
| Y       | Two diagonals with horizontal top terminals, meeting at 0.42 H, plus a centred stem. Width 0.95 H.                                   |
| R       | **Stemless**: top bar, semicircular bowl (outer radius 0.317 H), middle bar starting at 0.122 H, diagonal leg ending under the bowl. |
| A       | **No crossbar** (Λ form). Apex overshoots by 4 units and is flattened. Width 1.07 H.                                                 |
| Spacing | O→V 0.195 H · V→Y 0.07 H · Y→R 0.17 H · R→A 0.235 H. Measured optically from the styleboard.                                         |
| Total   | 1202 × 275 units (6.0 H wide).                                                                                                       |

## 3. Clear space and minimum sizes

- **X = 0.35 H**, where H is the wordmark cap height.
- **Wordmark:** keep at least **2X (0.7 H)** clear on all sides of its bounding box, which
  includes the V's terminal above the cap line.
- **Symbol:** keep at least **0.25 × the symbol width** clear on all sides.
- **Minimum sizes:**
  - Wordmark: 100 px wide on screen, 25 mm in print.
  - Detailed symbol: 48 px.
  - Below 48 px use `ovyra-symbol-simplified`; at 16–32 px it stays legible.
- The styleboard's clear-space diagram labels the same margin as "X" on one side and "2X" on the
  other. The uniform 2X above is a proposal pending confirmation (§9).

## 4. Color

| Name     | HEX     | Use                                   |
| -------- | ------- | ------------------------------------- |
| Blue     | #458AFF | Gradient stop 0                       |
| Violet   | #735BFF | Gradient stop 0.36                    |
| Pink     | #F04BBA | Gradient stop 0.70                    |
| Coral    | #FF9673 | Gradient stop 1                       |
| Ink      | #11162B | Wordmark letters on light backgrounds |
| Paper    | #F8F9FF | Wordmark letters on dark backgrounds  |
| Midnight | #0B1025 | Icon background, dark surfaces        |

The **brand gradient** is linear at 135° with stops #458AFF 0 → #735BFF 0.36 → #F04BBA 0.70 →
#FF9673 1. The exact per-layer symbol gradients, including the derived shading tones, are in
`brand/tokens.json`. The derived tones are interpolations used only for depth inside the
symbol, not UI colors.

## 5. Variants

| File                                    | Use                                                                |
| --------------------------------------- | ------------------------------------------------------------------ |
| `ovyra-wordmark-color-on-light.svg`     | Primary. Light backgrounds.                                        |
| `ovyra-wordmark-color-on-dark.svg`      | Dark backgrounds (midnight, black, photography).                   |
| `ovyra-wordmark-mono-black/-white.svg`  | Monochrome (grayscale translucent V).                              |
| `ovyra-wordmark-solid-black/-white.svg` | Single ink (stamps, embroidery, fax). The fold is a knockout line. |
| `ovyra-symbol-color.svg`                | Symbol, primary.                                                   |
| `ovyra-symbol-mono.svg` / `-light.svg`  | Monochrome on light backgrounds / light version on dark.           |
| `ovyra-symbol-simplified.svg`           | 32 px and below, favicons.                                         |
| `ovyra-symbol-solid-black/-white.svg`   | Single ink.                                                        |

## 6. App icon (iOS)

Checked against Apple's
[Human Interface Guidelines — App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons):

- **Canvas:** 1024 × 1024 px, square and unmasked. The system applies the rounded corners, so
  no corner radius is baked in.
- **Layered:** Apple recommends vector layers (SVG or PDF) imported into **Icon Composer**
  (Xcode). The files in `brand/layers/` are:
  - `00-background`: midnight radial gradient. It can also be recreated as a native Icon
    Composer gradient: #232A5C at 0 → #0B1025 at 0.55 → #060914 at 1.
  - `01-left-arm`, `02-right-arm`, `03-fold`: opaque fills, per Apple's advice to set opacity
    inside Icon Composer. Suggested starting points: right arm 90%, fold 50%.
- **Appearances:** default, dark, clear light, clear dark, tinted light and tinted dark.
  - Flattened previews for default, light, dark, mono and tinted are in `brand/png/`.
  - Clear and tinted appearances are rendered by the system from the layers; the
    `tinted`/`mono` PNGs are grayscale references.
- **No text in the icon.** No custom glows, bevels or highlights in the layers, since the system
  adds Liquid Glass effects.
- **App Store PNGs** are flattened to opaque RGB with no alpha.
- **Legibility** was checked at 16, 32, 64, 128, 256, 512 and 1024 px in
  `brand/review/legibility-*.png`. The 16 and 32 px sizes use the simplified artwork.
- **Not produced here:** the Icon Composer `.icon` bundle and the Xcode asset catalog. Both need
  Icon Composer on macOS; the layers are ready to import.
- **PWA** (`brand/png/pwa/`): `apple-touch-icon` 180, 192, 512, and a maskable 512 with the V
  inside the 80% safe zone.

## 7. Incorrect use

Do not:

- recolor the V outside the approved variants
- apply the gradient to the letters
- stretch or skew
- redraw the V
- add outlines, shadows or glows to the wordmark
- place the color wordmark on busy mid-tone backgrounds (use mono or solid)
- use Orbit or earlier OVYRA marks

## 8. Editing

Change `brand/source/geometry.py` (construction) or the palettes in `build.py`, then rebuild (see
`brand/README.md`). SVG groups are named for editing in Figma or Illustrator.

## 9. Known differences from the reference (visual review required)

1. **Ribbon detail.** The reference is a painted 3D render with soft, continuous shading, several
   internal fold edges and a soft drop glow. The reconstruction uses six clean layers:
   - one fold band
   - one twist shadow
   - linear sheens across each arm
   - two hairline highlights

   It reads as the same ribbon but is flatter. The right arm's second internal fold line and the
   under-glow were intentionally left out (the glow because Apple discourages baked-in glows).

2. **V proportions in the wordmark.** The reference V in the logo differs slightly from the
   standalone symbol: its left arm sits lower and the V is a little narrower. A single geometry is
   used for both, so in the wordmark the left terminal sits about 0.1 H higher than in the
   reference.
3. **Letter terminals.** The reference shows very slightly softened corners; the reconstruction
   uses crisp corners.
4. **Styleboard internal inconsistencies:**
   - **Palette swatches** list Violeta #6368F1, Rosa #EC4D99, Coral #FF9316 and Azul #06B6DA.
     The **gradient row** and Design System v1.0 use #458AFF / #735BFF / #F04BBA / #FF9673.
     The gradient values were used. The cyan "Azul" swatch (#06B6DA) does not appear in any
     artwork.
   - **Gradient angle** is 135° on the styleboard but 130° in the Design System v1.0 brief.
   - **Typeface:** the styleboard names **Satoshi**, while the app uses Plus Jakarta Sans per the
     v1.0 brief. Satoshi's license and files were not provided. The wordmark itself is custom
     lettering and does not depend on either.
   - **Clear-space diagram:** labels X and 2X inconsistently (see §3).
5. **Tinted icon.** The styleboard shows a violet tinted mock-up. In iOS the system applies the
   tint, so a grayscale source is delivered instead.

**Review checklist:**

- Compare `brand/review/comparison-symbol.png` and `comparison-wordmark.png` against the
  reference.
- Decide on items 2, 4 and 5.
- Approve, or list the adjustments needed.
