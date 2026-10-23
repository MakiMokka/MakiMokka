import { describe, expect, it } from 'vitest';

import { buildPageCsp, generateNonce, API_CSP } from '@/lib/security/csp';
import { buildSecurityHeaders } from '@/lib/security/headers';
import { findPublicSecretLeaks, assertNoPublicSecretLeaks } from '@/lib/security/public-env-guard';

function directive(csp: string, name: string) {
  return csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name);
}

describe('page CSP', () => {
  const prod = buildPageCsp({ nonce: 'abc123', isDev: false });

  it('uses a nonce with strict-dynamic and no unsafe script sources in production', () => {
    expect(directive(prod, 'script-src')).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(prod).not.toContain('unsafe-inline');
    expect(prod).not.toContain('unsafe-eval');
  });

  it('locks down framing, plugins, base URI and form targets', () => {
    expect(directive(prod, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(prod, 'object-src')).toBe("object-src 'none'");
    expect(directive(prod, 'base-uri')).toBe("base-uri 'none'");
    expect(directive(prod, 'form-action')).toBe("form-action 'self'");
    expect(directive(prod, 'connect-src')).toBe("connect-src 'self'");
    expect(prod).toContain('upgrade-insecure-requests');
  });

  it('relaxes only what Next.js dev tooling needs in development', () => {
    const dev = buildPageCsp({ nonce: 'n', isDev: true });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(dev).not.toContain('upgrade-insecure-requests');
  });

  it('API responses forbid everything', () => {
    expect(API_CSP).toContain("default-src 'none'");
  });

  it('generates unique 128-bit nonces', () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce));
    expect(nonces.size).toBe(50);
    expect(Buffer.from([...nonces][0]!, 'base64')).toHaveLength(16);
  });
});

describe('security headers', () => {
  it('sets HSTS only in production', () => {
    const keys = (production: boolean) =>
      buildSecurityHeaders(production).map((header) => header.key);
    expect(keys(true)).toContain('Strict-Transport-Security');
    expect(keys(false)).not.toContain('Strict-Transport-Security');
  });

  it('includes the baseline protections', () => {
    const headers = Object.fromEntries(
      buildSecurityHeaders(true).map((header) => [header.key, header.value]),
    );
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });
});

describe('public env guard', () => {
  const serviceRoleJwt = [
    Buffer.from('{"alg":"HS256"}').toString('base64url'),
    Buffer.from('{"role":"service_role"}').toString('base64url'),
    'signature',
  ].join('.');

  it('allows the publishable key and URL', () => {
    expect(
      findPublicSecretLeaks({
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
        DATABASE_URL: 'postgresql://secret',
      }),
    ).toEqual([]);
  });

  it.each([
    ['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY', 'anything'],
    ['NEXT_PUBLIC_KEY', 'sb_secret_123'],
    ['NEXT_PUBLIC_KEY', serviceRoleJwt],
    ['NEXT_PUBLIC_DB', 'postgres://user:pass@host/db'],
    ['NEXT_PUBLIC_DATABASE_URL', ''],
  ])('flags %s', (name, value) => {
    expect(findPublicSecretLeaks({ [name]: value })).toHaveLength(1);
  });

  it('reports names but never values', () => {
    expect(() => assertNoPublicSecretLeaks({ NEXT_PUBLIC_X: 'sb_secret_topsecret' })).toThrow(
      /NEXT_PUBLIC_X/,
    );
    expect(() => assertNoPublicSecretLeaks({ NEXT_PUBLIC_X: 'sb_secret_topsecret' })).not.toThrow(
      /topsecret/,
    );
  });
});
