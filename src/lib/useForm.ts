import { useCallback, useState } from 'react';
import type { FieldErrors, Validated } from '../domain/validation';

/**
 * Estado de formulario con validación de dominio. Tras el primer intento de envío
 * los errores se recalculan en cada cambio, para que desaparezcan al corregirlos.
 */
export function useForm<D extends object, T, K extends string = Extract<keyof D, string>>(
  initial: D | (() => D),
  validate: (draft: D) => Validated<T, K>,
) {
  const [draft, setDraft] = useState<D>(initial);
  const [submitted, setSubmitted] = useState(false);

  const errors: FieldErrors<K> = submitted ? validate(draft).errors : {};

  const set = useCallback(<F extends keyof D>(field: F, value: D[F]) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  const patch = useCallback((partial: Partial<D>) => setDraft((d) => ({ ...d, ...partial })), []);

  /** Valida todo (o solo algunos campos) y devuelve el valor listo o null. */
  const submit = useCallback((): T | null => {
    setSubmitted(true);
    return validate(draft).value;
  }, [draft, validate]);

  const check = useCallback(
    (fields: K[]): boolean => {
      setSubmitted(true);
      const e = validate(draft).errors;
      return !fields.some((f) => e[f]);
    },
    [draft, validate],
  );

  const errorCount = Object.keys(errors).length;

  return { draft, set, patch, errors, errorCount, submit, check, submitted };
}
