/**
 * PROVISIONAL wordmark.
 *
 * The approved OVYRA identity uses custom lettering with a translucent,
 * three-dimensional ribbon "V". No approved vector exists in this repository
 * yet, so this component deliberately renders plain typeset text (Plus
 * Jakarta Sans) WITHOUT attempting to recreate the V. Replace the body of
 * this component with the official SVG once design delivers it — see
 * docs/brand/ASSETS.md (asset W-01).
 */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'text-body tracking-[0.14em]',
    md: 'text-headline tracking-[0.14em]',
    lg: 'text-display tracking-[0.16em]',
  } as const;
  return (
    <span
      className={`font-display text-fg font-semibold ${sizes[size]}`}
      data-asset="W-01"
      data-asset-status="provisional"
      translate="no"
    >
      OVYRA
    </span>
  );
}
