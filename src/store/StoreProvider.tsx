import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DomainError, defaultContext, type OpContext } from '../domain/operations';
import { emptyData, type AppData } from '../domain/types';
import { STORAGE_KEY, StorageError, loadData, parseData, saveData } from './storage';

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string; raw: string | null };

interface StoreValue {
  data: AppData;
  load: LoadState;
  /** Aplica una operación de dominio y la guarda. Devuelve un mensaje de error o null. */
  commit: (fn: (data: AppData, ctx: OpContext) => AppData) => string | null;
  retry: () => void;
  replaceAll: (data: AppData) => string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, initialData }: { children: ReactNode; initialData?: AppData }) {
  const [data, setData] = useState<AppData>(initialData ?? emptyData());
  const [load, setLoad] = useState<LoadState>(initialData ? { status: 'ready' } : { status: 'loading' });
  const ref = useRef(data);

  const read = useCallback(() => {
    try {
      const loaded = loadData();
      ref.current = loaded;
      setData(loaded);
      setLoad({ status: 'ready' });
    } catch (e) {
      const err = e instanceof StorageError ? e : new StorageError('No se pudieron cargar los datos.');
      setLoad({ status: 'error', message: err.message, raw: err.raw });
    }
  }, []);

  useEffect(() => {
    if (initialData) return;
    // Lectura fuera del render inicial para mostrar el estado de carga sin bloquear.
    const id = window.setTimeout(read, 0);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      try {
        const next = parseData(e.newValue);
        ref.current = next;
        setData(next);
      } catch {
        /* Otra pestaña guardó algo ilegible; se conserva el estado actual. */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('storage', onStorage);
    };
  }, [initialData, read]);

  const persist = useCallback((next: AppData): string | null => {
    try {
      saveData(next);
    } catch (e) {
      return e instanceof Error ? e.message : 'No se pudo guardar.';
    }
    ref.current = next;
    setData(next);
    return null;
  }, []);

  const commit = useCallback(
    (fn: (data: AppData, ctx: OpContext) => AppData) => {
      let next: AppData;
      try {
        next = fn(ref.current, defaultContext());
      } catch (e) {
        if (e instanceof DomainError) return e.message;
        console.error(e);
        return 'Ocurrió un error inesperado. No se guardó ningún cambio.';
      }
      return persist(next);
    },
    [persist],
  );

  const replaceAll = useCallback(
    (next: AppData) => {
      const error = persist(next);
      if (!error) setLoad({ status: 'ready' });
      return error;
    },
    [persist],
  );

  const value = useMemo<StoreValue>(() => ({ data, load, commit, retry: read, replaceAll }), [data, load, commit, read, replaceAll]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
}
