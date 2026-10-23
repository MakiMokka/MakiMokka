# OVYRA asset inventory

Last reviewed: 2026-10-23 · Design system v1.0

Status legend: **Approved** (official file in repo) · **Candidate** (vector reconstruction in
`brand/`, pending visual review) · **Provisional** (placeholder shipped in the app) · **Pending**
(not created) · **Legacy** (pre-brand, scheduled for replacement).

The approved styleboard is in `docs/brand/reference/`. Vector files were reconstructed from it in
`brand/` (see CONSTRUCTION.md); they await visual review and are **not yet wired into the app**.
Orbit logos and earlier OVYRA versions are not used anywhere.

| ID   | Asset                                             | Status                       | Location / notes                                                                                                                                              |
| ---- | ------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Approved brand reference image                    | **Approved**                 | `docs/brand/reference/OVYRA_approved_styleboard.png` (raster concept board).                                                                                  |
| W-01 | In-app wordmark component                         | **Provisional**              | `src/components/wordmark.tsx` renders plain "OVYRA" in Plus Jakarta Sans (600, +0.14em). No V treatment, by design. Marked `data-asset-status="provisional"`. |
| W-02 | Wordmark SVG (color / mono / solid, light & dark) | **Candidate**                | `brand/svg/ovyra-wordmark-*.svg` — custom outlined lettering + ribbon V. Pending review (CONSTRUCTION §9).                                                    |
| V-01 | Standalone "V" symbol                             | **Candidate**                | `brand/svg/ovyra-symbol-*.svg` (color, mono, light, simplified, solid black/white).                                                                           |
| I-01 | iOS app icon 1024×1024 (default)                  | **Candidate**                | `brand/svg/ovyra-app-icon-default.svg`, `brand/png/ovyra-app-icon-{16…1024}.png`, layers in `brand/layers/`.                                                  |
| I-02 | iOS icon — dark variant                           | **Candidate**                | `brand/svg/ovyra-app-icon-dark.svg` (+ light alternative `-light.svg`).                                                                                       |
| I-03 | iOS icon — tinted variant                         | **Candidate**                | `brand/svg/ovyra-app-icon-tinted.svg` / `-mono.svg` (grayscale sources; the system applies the tint).                                                         |
| I-04 | iOS icon — clear/transparent variant              | **Candidate**                | `brand/svg/ovyra-app-icon-foreground-transparent.svg`; the system renders clear from the layers.                                                              |
| I-05 | PWA icons 192/512 + maskable 512                  | **Legacy** → candidate ready | App still serves `public/icons/*` (generic envelope). Replacements in `brand/png/pwa/`, swap after approval.                                                  |
| I-06 | Favicon SVG                                       | **Legacy** → candidate ready | `public/icon.svg`; replace with `brand/svg/ovyra-symbol-simplified.svg` after approval.                                                                       |
| C-01 | Color tokens                                      | Approved*                    | `src/styles/tokens.css`. *Brand palette exactly as briefed; secondary values adjusted for WCAG AA (see ACCESSIBILITY.md).                                     |
| T-01 | Plus Jakarta Sans (UI titles)                     | Approved                     | `src/app/fonts/` — OFL 1.1, license file alongside. Latin subset, variable 200–800.                                                                           |
| T-02 | Reading text font                                 | Approved                     | System font (SF Pro on Apple platforms). No file shipped.                                                                                                     |
| G-01 | Brand gradient                                    | Approved                     | `--brand-gradient` (130°, blue → violet → pink → coral).                                                                                                      |
| G-02 | Identity aura (soft brand light)                  | Provisional                  | `identity-aura` utility; CSS approximation of "luminous depth", disabled with reduced transparency/increased contrast. Review against R-01.                   |
| X-01 | Splash / launch images                            | Pending                      | Not required for the PWA; consider after I-01.                                                                                                                |

## Handover checklist for design

1. Provide R-01 and confirm it is the approved direction.
2. Deliver W-02 (SVG, outlined, with clear-space and minimum-size spec) and V-01.
3. Deliver I-01…I-04 at 1024×1024 (or an Icon Composer `.icon` file) plus a small-size check at
   29/40/60 pt.
4. Confirm or adjust G-02 and the adjusted semantic colors.

## Replacing a provisional asset

- **Wordmark:** replace the body of `Wordmark` with an inline SVG (`aria-label="OVYRA"`,
  `role="img"`), keep the `size` prop, set `data-asset-status="approved"`, and update the unit test.
- **Icons:** overwrite the files in `public/icons/` (same names and sizes) and `public/icon.svg`;
  `scripts/generate-icons.py` then becomes obsolete and should be deleted.
