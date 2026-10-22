import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastApi {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Retroalimentación inmediata tras cada acción, anunciada a lectores de pantalla. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-2), { id, tone, title, detail }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ success: (t, d) => push('success', t, d), error: (t, d) => push('error', t, d) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            {t.tone === 'success' ? <CircleCheck size={20} aria-hidden /> : <CircleAlert size={20} aria-hidden />}
            <div className="toast__text">
              <p className="toast__title">{t.title}</p>
              {t.detail && <p className="toast__detail">{t.detail}</p>}
            </div>
            <button type="button" className="toast__close" aria-label="Descartar aviso" onClick={() => dismiss(t.id)}>
              <X size={18} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
