import type { Cents } from './types';

/**
 * Convierte texto capturado por el usuario a centavos.
 * Acepta "150", "150.5", "1,500.00", "$1,500". Devuelve null si no es válido.
 */
export function parseMoney(input: string): Cents | null {
  const cleaned = input.replace(/[$\s,]/g, '');
  if (cleaned === '') return null;
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Valor editable sin símbolo ni separadores de miles (p. ej. "150.00"). */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

export function multiplyCents(unit: Cents, quantity: number): Cents {
  return Math.round(unit * quantity);
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0);
}
