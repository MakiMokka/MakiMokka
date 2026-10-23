# OVYRA identity — usage rules (Design System v1.0)

OVYRA is a premium email app for iPhone and the web. The identity is recognized by its custom
ribbon **V**, refined geometric lettering, a violet–blue–pink–coral gradient, and delicate,
translucent depth — never loud neon.

> **Status:** identity v1.0 approved 2026-10-23. Official files live in `/brand`; construction,
> clear space and decisions are in [CONSTRUCTION.md](CONSTRUCTION.md), the inventory in
> [ASSETS.md](ASSETS.md).

## 1. Logo

- The V is part of the word, not a separate symbol beside it.
- Use only approved files (W-02 once delivered). Never recolor, stretch, outline, add effects, or
  rebuild the V from scratch. Never use Orbit or earlier OVYRA marks.
- Clear space and minimum size: to be specified with W-02. Until then: clear space ≥ cap height on
  all sides; minimum 17 px tall on screen.
- On light backgrounds use the dark wordmark; on dark backgrounds the light one. The gradient
  belongs to the V, not to the whole word.

## 2. App icon

- Built only from the approved V, no text, 1024×1024 master, standard / dark / tinted / clear
  variants, verified at small sizes. Not yet produced (I-01…I-04).

## 3. Color

| Token                 | Light                              | Dark    | Use                                    |
| --------------------- | ---------------------------------- | ------- | -------------------------------------- |
| `--brand-violet`      | #735BFF                            | same    | Identity only                          |
| `--brand-blue`        | #458AFF                            | same    | Identity only                          |
| `--brand-pink`        | #F04BBA                            | same    | Identity only                          |
| `--brand-coral`       | #FF9673                            | same    | Identity only                          |
| `--brand-gradient`    | 135°: blue → violet → pink → coral | same    | Logo, icon, identity moments           |
| `--background`        | #F8F9FF                            | #0B1025 | App canvas                             |
| `--surface`           | #FFFFFF                            | #151C36 | Reading surfaces, lists                |
| `--surface-secondary` | #F0F2FA                            | #202944 | Fields, pressed states                 |
| `--text-primary`      | #11162B                            | #F8F9FF | Primary text                           |
| `--text-secondary`    | #626C87 (adj. from #65708B)        | #ABB7D3 | Secondary text                         |
| `--text-tertiary`     | #818CA6                            | #6B7593 | Placeholders, disabled                 |
| `--border-subtle`     | #E4E8F2                            | #303954 | Decorative separators                  |
| `--border-control`    | #7F8BB0                            | #63719F | Input boundaries (≥ 3:1)               |
| `--accent`            | #664CFF                            | #9481FF | Links, icons, selected state (≥ 4.5:1) |
| `--accent-strong`     | #664CFF                            | #664CFF | Filled buttons (white text 5.2:1)      |
| `--accent-soft`       | #F1EFFF                            | #272552 | Icon tiles, selected backgrounds       |
| `--danger`            | #D61E24                            | #FF6B70 | Destructive actions                    |
| `--success`           | #177C46                            | #3DD68C | Confirmations                          |

Rules:

- Brand hues are never used alone for small text: white on coral is 2.1:1, white on pink 3.3:1.
  Interactive color is the adjusted violet `--accent`.
- Gradients are reserved for identity elements; primary buttons are solid `--accent-strong`.
- Dark mode is designed, not inverted: midnight canvas, distinct surface steps, lighter accent,
  softer identity glow.

## 4. Typography

- **Display / UI titles:** Plus Jakarta Sans (OFL 1.1, self-hosted), weights 600–700 for titles.
- **Reading text:** system font (SF Pro on iPhone) for Dynamic Type, legibility and language support.
- **Scale:** 32 Display · 28 Title · 22 Headline · 17 Body · 15 Callout · 14 Subhead · 12 Caption
  (`text-display` … `text-caption`). Caption text is never lighter than 500.
- Large titles use slight negative tracking (−0.02em at 32).

## 5. Geometry

- Spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 (Tailwind steps 1, 2, 3, 4, 5, 6, 8, 10).
- Side margin: 20 pt on iPhone (`px-gutter`, never less than the safe area).
- Radii: 24 main surfaces (`rounded-surface`), 16 inner containers (`rounded-container`), 12
  compact controls (`rounded-control`), 8 nested tiles (`rounded-inner`), capsule `rounded-full`.
- Nested radii are concentric: inner radius = outer radius − inset.
- Avoid card stacking, strong borders and decorative shadows.

## 6. Depth and materials

| Level      | Utility                                                    | Character                                                 | Used for                                      |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| 1 Reading  | `surface-reading`                                          | Opaque, flat, no shadow                                   | Lists, forms, content                         |
| 2 Control  | `surface-control`                                          | 72% surface + blur 20 px, hairline highlight, soft shadow | Tab bar, segmented controls                   |
| 3 Identity | `surface-identity`, `text-brand-gradient`, `identity-aura` | Gradient, translucency, optical depth                     | Brand moments only (sign-in, settings header) |

Effects never sit behind body text at reduced legibility. With **Reduce Transparency** or
**Increase Contrast**, control surfaces become solid and the aura disappears; with **Reduce
Motion**, transitions are removed.

## 7. Components

Shared styles live in `src/components/styles.ts` (`ui.buttonPrimary`, `buttonSecondary`,
`buttonDestructive`, `link`, `input`, `fieldLabel`, `footnote`) and the layout components in
`src/components/`. Touch targets are ≥ 44 pt (rows are 48 pt).

## 8. Preview

Set `DESIGN_PREVIEW=1` on the server and open `/design-system` while signed in. It shows tokens,
type, geometry, materials and components in light and dark with neutral sample content. It is not
linked from navigation and returns 404 when the variable is unset.
