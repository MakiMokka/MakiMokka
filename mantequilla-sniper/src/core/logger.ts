import { redactDeep } from './redact.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Logs estructurados en JSON (una línea por evento) con datos personales ocultos. */
export function createLogger(
  bindings: Record<string, unknown> = {},
  minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info',
  sink: (line: string) => void = (l) => process.stdout.write(l + '\n'),
): Logger {
  const write = (level: LogLevel, msg: string, data?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[minLevel]) return;
    const entry = redactDeep({ ts: new Date().toISOString(), level, msg, ...bindings, ...data });
    sink(JSON.stringify(entry));
  };
  return {
    debug: (m, d) => write('debug', m, d),
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
    child: (b) => createLogger({ ...bindings, ...b }, minLevel, sink),
  };
}

export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child: () => silentLogger,
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
