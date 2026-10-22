import { emptyData, type AppData } from '../domain/types';

export const STORAGE_KEY = 'poptv-admin/v1';

export class StorageError extends Error {
  constructor(
    message: string,
    readonly raw: string | null = null,
  ) {
    super(message);
  }
}

function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.clients) &&
    Array.isArray(v.accounts) &&
    Array.isArray(v.services) &&
    Array.isArray(v.movements) &&
    typeof v.settings === 'object'
  );
}

export function parseData(raw: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageError('Los datos guardados están dañados y no se pueden leer.', raw);
  }
  if (!isAppData(parsed)) throw new StorageError('Los datos guardados tienen un formato desconocido.', raw);
  return parsed;
}

export function loadData(): AppData {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new StorageError('El navegador no permite leer el almacenamiento local. Revisa la navegación privada o los permisos del sitio.');
  }
  return raw === null ? emptyData() : parseData(raw);
}

export function saveData(data: AppData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new StorageError('No se pudo guardar. El almacenamiento del navegador está lleno o bloqueado.');
  }
}
