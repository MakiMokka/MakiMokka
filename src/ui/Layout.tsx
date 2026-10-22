import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  actions,
  back,
  children,
}: {
  eyebrow?: ReactNode;
  title: string;
  actions?: ReactNode;
  back?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      {back && <div className="page-header__back">{back}</div>}
      <div className="page-header__row">
        <div className="page-header__titles">
          {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
          <h1 className="page-header__title" tabIndex={-1} data-page-title>
            {title}
          </h1>
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Section({
  id,
  title,
  count,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  count?: number;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={['section', className].filter(Boolean).join(' ')} id={id} aria-labelledby={headingId}>
      <div className="section__header">
        <div>
          <h2 className="section__title" id={headingId}>
            {title}
            {count !== undefined && <span className="section__count num">{count}</span>}
          </h2>
          {description && <p className="section__description">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface Metric {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: 'coral' | 'yellow' | 'green' | 'blue' | 'neutral';
  href?: string;
  onSelect?: () => void;
  detail?: ReactNode;
}

/** Resumen compacto: una sola superficie dividida por separadores, no cuatro tarjetas. */
export function MetricStrip({ metrics, label }: { metrics: Metric[]; label: string }) {
  return (
    <div className="metrics" role="group" aria-label={label}>
      {metrics.map((m) => {
        const Icon = m.icon;
        const inner = (
          <>
            <span className="metric__label">
              <span className={`metric__icon metric__icon--${m.tone}`}>
                <Icon size={16} aria-hidden />
              </span>
              {m.label}
            </span>
            <span className="metric__value num">{m.value}</span>
            {m.detail && <span className="metric__detail">{m.detail}</span>}
          </>
        );
        if (m.onSelect) {
          return (
            <button key={m.label} type="button" className="metric metric--link" onClick={m.onSelect}>
              {inner}
            </button>
          );
        }
        return m.href ? (
          <a key={m.label} className="metric metric--link" href={m.href}>
            {inner}
          </a>
        ) : (
          <div key={m.label} className="metric">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/** Desplaza hasta una sección de la página y le pasa el foco (anclas sin alterar la ruta). */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  const heading = el.querySelector<HTMLElement>('h2');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty${compact ? ' empty--compact' : ''}`}>
      <span className="empty__icon">
        <Icon size={compact ? 22 : 28} aria-hidden />
      </span>
      <p className="empty__title">{title}</p>
      {message && <p className="empty__message">{message}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton__line" style={{ width: `${90 - i * 14}%` }} />
      ))}
    </div>
  );
}

/** Lista agrupada estilo iOS: una superficie con filas separadas por líneas finas. */
export function List({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="list" aria-label={label}>
      {children}
    </ul>
  );
}
