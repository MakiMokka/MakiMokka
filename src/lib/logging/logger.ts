/**
 * Structured logger with defensive redaction.
 *
 * Rules (docs/SECURITY.md): never log credentials, tokens, cookies, OTP codes,
 * email addresses or message content. Callers should pass identifiers and
 * machine-readable codes only; this module is the safety net for mistakes.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY =
  /(token|secret|password|passwd|authorization|cookie|session|credential|api[-_]?key|private|otp|code_verifier|^code$|body|content|snippet|subject|email|address|recipient|html|text)/i;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const SUPABASE_KEY = /\bsb_(secret|publishable)_[A-Za-z0-9_-]+/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PG_URL = /postgres(ql)?:\/\/[^\s"']+/gi;
const MAX_DEPTH = 5;
const MAX_STRING = 500;

export const REDACTED = '[REDACTED]';

function redactString(value: string): string {
  const cleaned = value
    .replace(JWT, REDACTED)
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(SUPABASE_KEY, REDACTED)
    .replace(PG_URL, REDACTED)
    .replace(EMAIL, '[EMAIL]');
  return cleaned.length > MAX_STRING ? `${cleaned.slice(0, MAX_STRING)}…` : cleaned;
}

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Error) {
    // Messages from libraries can embed request data; keep name and a redacted message.
    return { name: value.name, message: redactString(value.message) };
  }
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1);
    }
    return output;
  }
  return `[${typeof value}]`;
}

export type LogSink = (level: Level, line: string) => void;

const defaultSink: LogSink = (level, line) => {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

export function createLogger(sink: LogSink = defaultSink, minLevel: Level = 'info') {
  const order: Level[] = ['debug', 'info', 'warn', 'error'];
  const write = (level: Level, event: string, fields?: Record<string, unknown>) => {
    if (order.indexOf(level) < order.indexOf(minLevel)) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      event: redactString(event),
      ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
    };
    sink(level, JSON.stringify(entry));
  };
  return {
    debug: (event: string, fields?: Record<string, unknown>) => write('debug', event, fields),
    info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
    warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
    error: (event: string, fields?: Record<string, unknown>) => write('error', event, fields),
  };
}

export const logger = createLogger(
  defaultSink,
  process.env.NODE_ENV === 'production' ? 'info' : 'debug',
);
