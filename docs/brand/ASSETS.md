# OVYRA asset inventory

Last reviewed: 2026-10-23 · Design system v1.0

Status legend: **Approved** (official file in repo) · **Provisional** (placeholder shipped in the
app, must be replaced) · **Pending** (not created; needs design) · **Legacy** (pre-brand, scheduled
for replacement).

The approved concept image was **not available** in this repository when the system was built.
Nothing below is an official OVYRA vector. Orbit logos and earlier OVYRA versions are not used
anywhere.

| ID   | Asset                                   | Status          | Location / notes                                                                                                                                              |
| ---- | --------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Approved brand reference image          | **Missing**     | Add to `docs/brand/reference/`. Source of art direction for everything below.                                                                                 |
| W-01 | Wordmark with custom ribbon "V"         | **Provisional** | `src/components/wordmark.tsx` renders plain "OVYRA" in Plus Jakarta Sans (600, +0.14em). No V treatment, by design. Marked `data-asset-status="provisional"`. |
| W-02 | Wordmark SVG (light / dark / mono)      | Pending         | Needs official lettering + vector V from design. Replace W-01 body with inline SVG (CSP-safe).                                                                |
| V-01 | Standalone "V" mark (for icon, avatars) | Pending         | Must come from the approved artwork; do not redraw.                                                                                                           |
| I-01 | iOS app icon 1024×1024 (standard)       | Pending         | No text. Built from V-01. Export also 180 px (`apple-touch-icon.png`).                                                                                        |
| I-02 | iOS icon — dark variant                 | Pending         | Per iOS 18+ appearance variants.                                                                                                                              |
| I-03 | iOS icon — tinted variant               | Pending         | Grayscale source for system tinting.                                                                                                                          |
| I-04 | iOS icon — clear/transparent variant    | Pending         | Per current Icon Composer guidance.                                                                                                                           |
| I-05 | PWA icons 192/512 + maskable 512        | **Legacy**      | `public/icons/*` — generic envelope from Phase 1. Kept only so the PWA stays installable. Replace from I-01.                                                  |
| I-06 | Favicon SVG                             | **Legacy**      | `public/icon.svg` — generic envelope. Replace from V-01.                                                                                                      |
| C-01 | Color tokens                            | Approved*       | `src/styles/tokens.css`. *Brand palette exactly as briefed; secondary values adjusted for WCAG AA (see ACCESSIBILITY.md).                                     |
| T-01 | Plus Jakarta Sans (UI titles)           | Approved        | `src/app/fonts/` — OFL 1.1, license file alongside. Latin subset, variable 200–800.                                                                           |
| T-02 | Reading text font                       | Approved        | System font (SF Pro on Apple platforms). No file shipped.                                                                                                     |
| G-01 | Brand gradient                          | Approved        | `--brand-gradient` (130°, blue → violet → pink → coral).                                                                                                      |
| G-02 | Identity aura (soft brand light)        | Provisional     | `identity-aura` utility; CSS approximation of "luminous depth", disabled with reduced transparency/increased contrast. Review against R-01.                   |
| X-01 | Splash / launch images                  | Pending         | Not required for the PWA; consider after I-01.                                                                                                                |

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
