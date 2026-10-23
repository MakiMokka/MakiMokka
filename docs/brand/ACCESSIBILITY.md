# OVYRA — contrast, accessibility and consistency review

Date: 2026-10-23 · Method: WCAG 2.2 relative-luminance contrast computed from
`src/styles/tokens.css`; enforced by `tests/unit/contrast.test.ts` (fails the build in CI if any
pair regresses). Visual review on iPhone 15 Pro emulation and 1280 px desktop, light and dark.

## Contrast (semantic pairs used by components)

| Foreground         | Background            | Min   | Light | Dark  |
| ------------------ | --------------------- | ----- | ----- | ----- |
| `--text-primary`   | `--background`        | 4.5:1 | 17.03 | 17.92 |
| `--text-primary`   | `--surface-secondary` | 4.5:1 | 16.01 | 13.67 |
| `--text-secondary` | `--background`        | 4.5:1 | 4.98  | 9.37  |
| `--text-secondary` | `--surface-secondary` | 4.5:1 | 4.68  | 7.14  |
| `--accent`         | `--background`        | 4.5:1 | 4.94  | 6.14  |
| `--accent`         | `--surface-secondary` | 4.5:1 | 4.65  | 4.68  |
| `--accent`         | `--accent-soft`       | 4.5:1 | 4.58  | 4.65  |
| `--on-accent`      | `--accent-strong`     | 4.5:1 | 5.19  | 5.19  |
| `--danger`         | `--surface`           | 4.5:1 | 5.16  | 6.07  |
| `--success`        | `--surface`           | 4.5:1 | 5.24  | 8.95  |
| `--text-tertiary`  | `--surface`           | 3:1   | 3.37  | 3.67  |
| `--border-control` | `--surface`           | 3:1   | 3.37  | 3.51  |
| `--focus-ring`     | `--background`        | 3:1   | 4.94  | 6.14  |

## Adjustments made to the initial tokens

| Token                            | Brief   | Shipped    | Reason                                                            |
| -------------------------------- | ------- | ---------- | ----------------------------------------------------------------- |
| `--text-secondary`               | #65708B | #626C87    | 4.43:1 on `--surface-secondary` → 4.68:1                          |
| `--accent` (light)               | #735BFF | #664CFF    | Brand violet is 4.28:1 on `--background`; adjusted violet 4.94:1  |
| `--accent` (dark)                | #735BFF | #9481FF    | Brand violet is 3.73:1 on dark surface; lighter violet 5.47:1     |
| `--accent-soft`                  | (new)   | #F1EFFF    | First value #ECE9FF failed (4.37:1) — caught by the contrast test |
| Status, tertiary, control border | (new)   | see tokens | Derived to meet 4.5:1 (text) / 3:1 (non-text)                     |

The four brand colors and both canvas colors are unchanged.

## Known limitations

- Brand hues as text backgrounds fail AA (white on coral 2.13:1, pink 3.27:1, blue 3.32:1). They
  are therefore restricted to identity elements; the logo is exempt from contrast requirements but
  body text must never sit on the gradient.
- `--border-subtle` (1.2–1.5:1) is decorative only; inputs use `--border-control`.
- Tab-bar labels use Caption 12/500, the smallest size in the scale.
- The `identity-aura` glow sits behind the wordmark only, never behind reading text.

## Preferences honored

`prefers-color-scheme`, `prefers-reduced-transparency`, `prefers-contrast: more`,
`prefers-reduced-motion`; `:focus-visible` ring in `--focus-ring`; inputs ≥ 16 px to avoid iOS zoom;
touch targets ≥ 44 pt.

## Consistency checks

- No hard-coded colors, font sizes or radii remain in app components (verified by search for
  `#hex`, `text-[Npx]`, `rounded-[Npx]`). Exception: `viewport.themeColor` in `src/app/layout.tsx`
  must be literal hex (`#F8F9FF` / `#0B1025`, matching `--background`).
- The design-system preview places identity labels on reading chips, never directly on the gradient.
- E2E run: 18/18 checks, zero CSP violations, light and dark canvas colors asserted.
