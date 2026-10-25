// Ocultamiento de datos personales para logs, errores y notificaciones técnicas.

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Secuencias de 10+ dígitos (con espacios, guiones o +) se consideran teléfonos; las fechas ISO tienen 8.
const PHONE_RE = /\+?\d[\d\s-]{6,}\d/g;
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/;

let sensitiveValues: string[] = [];

/** Registra valores exactos (nombre, teléfono, correo) que siempre deben ocultarse. */
export function registerSensitive(...values: string[]): void {
  const extra = values.flatMap((v) => {
    const t = v.trim();
    const digits = t.replace(/\D/g, '');
    return digits.length >= 8 ? [t, digits, digits.slice(-10)] : [t];
  });
  sensitiveValues = [...new Set([...sensitiveValues, ...extra])]
    .filter((v) => v.length >= 3)
    .sort((a, b) => b.length - a.length);
}

export function clearSensitive(): void {
  sensitiveValues = [];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redact(text: string): string {
  let out = text;
  for (const v of sensitiveValues) out = out.replace(new RegExp(escapeRe(v), 'gi'), '[REDACTED]');
  return out
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 10 && !ISO_DATE_RE.test(m) ? '[PHONE]' : m));
}

export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as T;
  if (Array.isArray(value)) return value.map(redactDeep) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = /phone|email|telefono|correo|password|token|secret/i.test(k) ? '[REDACTED]' : redactDeep(v);
    }
    return out as T;
  }
  return value;
}

/** Muestra solo el inicio/fin para el dashboard: "us***@dominio.com", "•••• 1234". */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `•••• ${digits.slice(-4)}`;
}
