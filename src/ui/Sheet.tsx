import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Atrapa el foco dentro del contenedor, cierra con Esc y devuelve el foco al cerrar. */
export function useModalBehavior(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusFirst = () => {
      const auto = node?.querySelector<HTMLElement>('[data-autofocus]');
      (auto ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node)?.focus();
    };
    const raf = requestAnimationFrame(focusFirst);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node?.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      node?.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, ref]);
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Envuelve el contenido en un formulario para que Enter envíe. */
  onSubmit?: () => void;
}

/**
 * Hoja inferior en celular y panel lateral en pantallas amplias.
 * El pie con acciones queda fijo dentro de la hoja; el contenido se desplaza por encima.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, onSubmit }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [visible, setVisible] = useState(false);
  useModalBehavior(open, ref, onClose);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(raf);
      setVisible(false);
    };
  }, [open]);

  if (!open) return null;

  const body = (
    <>
      <header className="sheet__header">
        <div className="sheet__grabber" aria-hidden />
        <div className="sheet__titles">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
        </div>
        <IconButton icon={X} label="Cerrar" variant="filled" onClick={onClose} />
      </header>
      <div className="sheet__body">{children}</div>
      {footer && <footer className="sheet__footer">{footer}</footer>}
    </>
  );

  return createPortal(
    <div className={`sheet-layer${visible ? ' is-visible' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        {onSubmit ? (
          <form
            className="sheet__form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>,
    document.body,
  );
}
