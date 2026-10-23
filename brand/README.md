# OVYRA identity files (v1.0 candidate)

> **Status: candidate — pending visual review.** Reconstructed with controlled vector geometry
> from the approved styleboard (`docs/brand/reference/OVYRA_approved_styleboard.png`). Read the
> known differences in [docs/brand/CONSTRUCTION.md](../docs/brand/CONSTRUCTION.md) §9 before
> approving. Not yet wired into the app.

| Folder        | Contents                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `svg/`        | Wordmark (6 variants), symbol (6 variants), app icons (5 appearances + transparent, small, maskable)                                    |
| `layers/`     | 1024² layers for Icon Composer: background, left arm, right arm, fold                                                                   |
| `png/`        | Icon at 16–1024 px, 1024 px per appearance, symbol and wordmark renders, `pwa/` web icons                                               |
| `review/`     | Comparison with the reference, legibility sheets, variant sheets                                                                        |
| `source/`     | **Editable source**: `geometry.py` (construction), `build.py` (variants/colors), `render.mjs` (PNG export), `sheets.py` (review sheets) |
| `tokens.json` | Palette and exact gradient definitions                                                                                                  |

## Rebuild

```bash
python3 brand/source/build.py     # SVGs from geometry
node brand/source/render.mjs      # PNGs (headless Chromium, true vector rendering per size)
python3 brand/source/sheets.py    # flatten icon alpha + review sheets
```

The SVGs open directly in Figma, Illustrator, Sketch or Affinity with named groups
(`*-left-arm`, `*-right-arm`, `*-fold`, `*-letters`). Every shape is a clean path built from
circles, tangents, straight strokes and cubic Béziers — nothing is auto-traced.
