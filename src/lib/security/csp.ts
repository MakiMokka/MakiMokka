/**
 * Content Security Policy builders.
 *
 * Pages get a strict, nonce-based policy generated per request in proxy.ts.
 * API responses get a policy that forbids everything, since they are never
 * meant to be rendered as documents.
 */

export interface CspOptions {
  nonce: string;
  isDev: boolean;
}

export function buildPageCsp({ nonce, isDev }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'strict-dynamic' lets nonce-trusted Next.js runtime chunks load their
    // dependencies; 'self' is ignored by browsers that support it.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", ...(isDev ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`])],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    // The browser never talks to Supabase or mail providers directly.
    'connect-src': ["'self'", ...(isDev ? ['ws:'] : [])],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!isDev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export const API_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/** 128 bits of randomness, base64-encoded. Works in Node and edge runtimes. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
