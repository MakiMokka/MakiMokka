import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { GroupedList, IconBadge, ListRow } from '@/components/grouped-list';
import { EnvelopeIcon, InboxIcon, LockIcon, PersonIcon } from '@/components/icons';
import { PageBody, PageHeader } from '@/components/page-header';
import { ui } from '@/components/styles';
import { Wordmark } from '@/components/wordmark';
import { requireAuthorizedUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Design system', robots: { index: false } };

/**
 * OVYRA design-system preview with neutral sample content only. It is not
 * linked from navigation, requires an authorized session like every app
 * route, and does not exist unless DESIGN_PREVIEW=1 is set on the server.
 * Internal tool: copy is intentionally English-only.
 */
export default async function DesignSystemPage() {
  if (process.env.DESIGN_PREVIEW !== '1') notFound();
  await requireAuthorizedUser();

  return (
    <>
      <PageHeader title="Design system" />
      <PageBody>
        <p className="text-fg-muted text-callout" data-testid="design-system">
          OVYRA Brand Design System v1.0 — preview with neutral content. Identity assets are the
          approved v1.0 files from /brand (docs/brand/ASSETS.md).
        </p>

        <Section title="Identity">
          <div className="grid gap-4 md:grid-cols-2">
            {(['light', 'dark'] as const).map((theme) => (
              <div
                key={theme}
                data-theme={theme}
                className="bg-canvas text-fg rounded-surface identity-aura flex min-h-40 flex-col items-center justify-center gap-2 overflow-hidden p-6"
              >
                <Wordmark size="lg" />
                <span className="text-fg-muted text-caption">Wordmark W-02 ({theme})</span>
              </div>
            ))}
          </div>
          <div
            className="surface-identity rounded-container h-16"
            aria-label="Brand gradient"
            role="img"
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="surface-reading rounded-container flex items-center justify-center p-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin SVG */}
              <img src="/brand/ovyra-symbol-color.svg" alt="OVYRA symbol" width={96} height={83} />
            </div>
            {[180, 64, 32].map((size) => (
              <div
                key={size}
                className="surface-reading rounded-container flex flex-col items-center justify-center gap-2 p-6"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin PNG */}
                <img
                  src="/icons/apple-touch-icon.png"
                  alt={`App icon at ${size} px`}
                  width={size > 96 ? 96 : size}
                  height={size > 96 ? 96 : size}
                  className="rounded-[22%]"
                />
                <span className="text-fg-muted text-caption">
                  {size > 96 ? 'App icon' : `${size} px`}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Color">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Swatch className="bg-[var(--brand-violet)]" name="brand-violet" value="#735BFF" />
            <Swatch className="bg-[var(--brand-blue)]" name="brand-blue" value="#458AFF" />
            <Swatch className="bg-[var(--brand-pink)]" name="brand-pink" value="#F04BBA" />
            <Swatch className="bg-[var(--brand-coral)]" name="brand-coral" value="#FF9673" />
          </div>
          <ThemePair>
            <div className="grid grid-cols-2 gap-2">
              <Swatch className="bg-canvas" name="background" />
              <Swatch className="bg-surface" name="surface" />
              <Swatch className="bg-surface-2" name="surface-secondary" />
              <Swatch className="bg-accent" name="accent" />
              <Swatch className="bg-fg" name="text-primary" />
              <Swatch className="bg-fg-muted" name="text-secondary" />
            </div>
          </ThemePair>
        </Section>

        <Section title="Typography">
          <div className="surface-reading rounded-container space-y-3 p-5">
            <p className="font-display text-display text-fg font-bold">Display 32</p>
            <p className="font-display text-title text-fg font-bold">Title 28</p>
            <p className="font-display text-headline text-fg font-semibold">Headline 22</p>
            <p className="text-body text-fg">Body 17 — system text for reading and Dynamic Type.</p>
            <p className="text-callout text-fg-muted">Callout 15 — secondary information.</p>
            <p className="text-subhead text-fg-muted">Subhead 14 — footnotes and hints.</p>
            <p className="text-caption text-fg-muted font-medium">
              Caption 12 — labels, never below medium weight.
            </p>
          </div>
        </Section>

        <Section title="Spacing and radii">
          <div className="surface-reading rounded-container flex flex-wrap items-end gap-3 p-5">
            {[1, 2, 3, 4, 5, 6, 8, 10].map((step) => (
              <div key={step} className="flex flex-col items-center gap-1">
                <div className={`bg-accent ${SPACING[step]}`} />
                <span className="text-caption text-fg-muted">{step * 4}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="surface-reading rounded-surface text-caption text-fg-muted p-5">
              Surface 24
            </div>
            <div className="surface-reading rounded-container text-caption text-fg-muted p-5">
              Container 16
            </div>
            <div className="surface-reading rounded-control text-caption text-fg-muted p-5">
              Control 12
            </div>
            <div className="surface-reading text-caption text-fg-muted rounded-full p-5 text-center">
              Capsule
            </div>
          </div>
          <div className="surface-reading rounded-surface p-2">
            <div className="bg-surface-2 rounded-container p-2">
              <div className="surface-reading rounded-inner text-caption text-fg-muted p-3">
                Concentric: 24 → 16 → 8 with 8px insets
              </div>
            </div>
          </div>
        </Section>

        <Section title="Materials">
          <div className="surface-identity rounded-surface grid gap-3 p-5 md:grid-cols-3">
            <div className="surface-reading rounded-container text-callout text-fg p-4">
              1 · Reading surface
            </div>
            <div className="surface-control rounded-container text-callout text-fg p-4">
              2 · Control surface
            </div>
            <div className="rounded-container p-4 ring-1 ring-white/40">
              <span className="surface-reading text-fg text-caption rounded-full px-3 py-1 font-medium">
                3 · Identity
              </span>
            </div>
          </div>
          <p className="text-fg-muted text-subhead">
            Control translucency becomes solid with Reduce Transparency or Increase Contrast.
          </p>
        </Section>

        <Section title="Components">
          <ThemePair>
            <div className="space-y-3">
              <button type="button" className={ui.buttonPrimary}>
                Primary action
              </button>
              <button type="button" className={ui.buttonSecondary}>
                Secondary action
              </button>
              <button type="button" className={ui.buttonDestructive}>
                Destructive action
              </button>
              <label className="block">
                <span className={ui.fieldLabel}>Text field</span>
                <input className={ui.input} placeholder="Placeholder" readOnly />
              </label>
              <GroupedList header="Grouped list" footer="Footnote text.">
                <ListRow
                  label="Navigation row"
                  href="#"
                  leading={
                    <IconBadge>
                      <PersonIcon />
                    </IconBadge>
                  }
                />
                <ListRow
                  label="Row with detail"
                  detail="Detail"
                  leading={
                    <IconBadge>
                      <LockIcon />
                    </IconBadge>
                  }
                />
                <ListRow label="Disabled row" subtitle="Not available" disabled />
              </GroupedList>
            </div>
          </ThemePair>
          <div className="surface-reading rounded-surface">
            <EmptyState
              testId="design-empty-state"
              icon={<InboxIcon />}
              title="Empty state"
              body="Explains what will appear here and why nothing is shown yet."
              action={
                <span className={ui.link}>
                  <EnvelopeIcon className="mr-2 size-5" /> Optional action
                </span>
              }
            />
          </div>
        </Section>
      </PageBody>
    </>
  );
}

const SPACING: Record<number, string> = {
  1: 'size-1',
  2: 'size-2',
  3: 'size-3',
  4: 'size-4',
  5: 'size-5',
  6: 'size-6',
  8: 'size-8',
  10: 'size-10',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-headline text-fg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ThemePair({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(['light', 'dark'] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          className="bg-canvas text-fg rounded-surface space-y-3 p-4"
        >
          <p className="text-caption text-fg-muted font-semibold tracking-[0.06em] uppercase">
            {theme}
          </p>
          {children}
        </div>
      ))}
    </div>
  );
}

function Swatch({ className, name, value }: { className: string; name: string; value?: string }) {
  return (
    <div className="space-y-1">
      <div className={`rounded-control border-line h-12 border ${className}`} />
      <p className="text-caption text-fg font-medium">{name}</p>
      {value ? <p className="text-caption text-fg-muted">{value}</p> : null}
    </div>
  );
}
