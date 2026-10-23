/**
 * Base component styles (OVYRA design system). Shared class strings keep
 * buttons, fields and links identical across screens. See docs/brand/IDENTITY.md.
 */
export const ui = {
  /** Filled primary action: solid accent (white text ≥ 4.5:1). Gradients are reserved for identity. */
  buttonPrimary:
    'bg-accent-strong text-on-accent text-body rounded-control min-h-12 w-full font-semibold transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50',
  /** Secondary action on a reading surface. */
  buttonSecondary:
    'surface-reading text-accent text-body rounded-control min-h-12 w-full font-medium active:bg-surface-2',
  /** Destructive action on a reading surface. */
  buttonDestructive:
    'surface-reading text-danger text-body rounded-control min-h-12 w-full font-medium active:bg-surface-2',
  /** Text-only action (links, tertiary buttons). */
  link: 'text-accent text-body inline-flex min-h-11 items-center font-medium',
  /** Standalone text field. */
  input:
    'surface-reading border-line-control text-fg text-body placeholder:text-fg-subtle rounded-control w-full border px-4 py-3 outline-none focus-visible:border-accent',
  /** Small label above a field. */
  fieldLabel: 'text-fg-muted text-subhead mb-2 block px-1 font-medium',
  /** Footnote under a group. */
  footnote: 'text-fg-muted text-subhead px-4 pt-2',
} as const;
