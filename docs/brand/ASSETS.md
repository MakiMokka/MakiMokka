# OVYRA asset inventory

Last reviewed: 2026-10-23 · Identity v1.0 approved 2026-10-23

Status legend: **Approved** (official, in use) · **Pending** (not yet produced) · **Provisional**
(approximation in use, awaiting review).

Sources: the approved styleboard (`docs/brand/reference/`) and the vector reconstruction in
`brand/` (construction in `CONSTRUCTION.md`). Orbit logos and earlier OVYRA versions are not used
anywhere.

| ID   | Asset                                        | Status       | Location / notes                                                                            |
| ---- | -------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| R-01 | Approved styleboard (art direction)          | **Approved** | `docs/brand/reference/OVYRA_approved_styleboard.png`                                        |
| W-02 | Wordmark SVG (color / mono / solid)          | **Approved** | `brand/svg/ovyra-wordmark-*.svg`; app copies in `public/brand/` (color on light / on dark)  |
| W-01 | In-app wordmark component                    | **Approved** | `src/components/wordmark.tsx` — renders W-02, switches with the active theme                |
| V-01 | Standalone "V" symbol                        | **Approved** | `brand/svg/ovyra-symbol-*.svg` (color, mono, light, simplified, solid black/white)          |
| I-01 | iOS app icon 1024×1024 (default)             | **Approved** | `brand/svg/ovyra-app-icon-default.svg`, `brand/png/ovyra-app-icon-{16…1024}.png`            |
| I-02 | iOS icon — dark / light alternatives         | **Approved** | `brand/svg/ovyra-app-icon-dark.svg`, `-light.svg`                                           |
| I-03 | iOS icon — tinted / mono sources             | **Approved** | `brand/svg/ovyra-app-icon-tinted.svg`, `-mono.svg` (grayscale; the system applies the tint) |
| I-04 | iOS icon — clear / transparent foreground    | **Approved** | `brand/svg/ovyra-app-icon-foreground-transparent.svg`                                       |
| I-07 | Icon Composer layers                         | **Approved** | `brand/layers/` (background, left arm, right arm, fold)                                     |
| I-08 | Icon Composer `.icon` bundle / Xcode catalog | Pending      | Must be assembled in Icon Composer on macOS from I-07 (not possible in this environment)    |
| I-05 | PWA icons 180/192/512 + maskable 512         | **Approved** | `public/icons/*` (from `brand/png/pwa/`)                                                    |
| I-06 | Favicon SVG                                  | **Approved** | `public/icon.svg` (simplified symbol)                                                       |
| C-01 | Color tokens                                 | **Approved** | `src/styles/tokens.css`, `brand/tokens.json`                                                |
| G-01 | Brand gradient                               | **Approved** | 135°, #458AFF 0 → #735BFF 0.36 → #F04BBA 0.70 → #FF9673 1                                   |
| T-01 | Plus Jakarta Sans (UI titles)                | **Approved** | `src/app/fonts/` — OFL 1.1, license alongside                                               |
| T-02 | Reading text font                            | **Approved** | System font (SF Pro on Apple platforms)                                                     |
| G-02 | Identity aura (soft brand light)             | Provisional  | `identity-aura` utility; CSS approximation of the styleboard's luminous depth               |
| X-01 | Splash / launch images                       | Pending      | Not required for the PWA                                                                    |

## Updating assets

1. Edit `brand/source/geometry.py` (shapes) or the palettes in `brand/source/build.py`.
2. Rebuild: `python3 brand/source/build.py && node brand/source/render.mjs && python3 brand/source/sheets.py`.
3. Copy into the app: `brand/svg/ovyra-wordmark-color-on-{light,dark}.svg` and
   `ovyra-symbol-color.svg` → `public/brand/`; `brand/png/pwa/*` → `public/icons/`;
   `brand/svg/ovyra-symbol-simplified.svg` → `public/icon.svg`.
4. Bump `CACHE` in `public/sw.js` so installed PWAs pick up the new icon.
