import { describe, expect, it } from 'vitest';

import { decideAccess, isPublicPath, safeRedirectPath } from '@/lib/auth/access';
import { isUserAllowed, parseAllowlist } from '@/lib/auth/allowlist';

const A = '6f1c2d3e-4a5b-4c6d-8e7f-90a1b2c3d4e5';
const B = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d';

describe('parseAllowlist', () => {
  it('parses comma and whitespace separated ids, case-insensitively', () => {
    const list = parseAllowlist(` ${A.toUpperCase()},\n${B} `);
    expect([...list]).toEqual([A, B]);
  });

  it('rejects invalid entries instead of skipping them', () => {
    expect(() => parseAllowlist(`${A},not-a-uuid`)).toThrow('1 invalid');
  });

  it('treats an empty value as an empty list', () => {
    expect(parseAllowlist(undefined).size).toBe(0);
  });
});

describe('decideAccess', () => {
  const list = parseAllowlist(A);

  it('returns anonymous without a verified user', () => {
    expect(decideAccess(null, list)).toBe('anonymous');
    expect(decideAccess('', list)).toBe('anonymous');
  });

  it('authorizes only allowlisted ids', () => {
    expect(decideAccess(A, list)).toBe('authorized');
    expect(decideAccess(A.toUpperCase(), list)).toBe('authorized');
    expect(decideAccess(B, list)).toBe('unauthorized');
  });

  it('never authorizes malformed ids', () => {
    expect(isUserAllowed(list, `${A} `)).toBe(false);
    expect(isUserAllowed(list, `${A},${B}`)).toBe(false);
  });
});

describe('safeRedirectPath', () => {
  it.each([
    ['/settings', '/settings'],
    ['/search?q=x', '/search?q=x'],
    [null, '/inbox'],
    ['', '/inbox'],
    ['https://evil.example', '/inbox'],
    ['//evil.example', '/inbox'],
    ['/\\evil.example', '/inbox'],
    ['javascript:alert(1)', '/inbox'],
    ['/inbox\nSet-Cookie: x', '/inbox'],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});

describe('isPublicPath', () => {
  it('allows only the sign-in surface without a session', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/unauthorized')).toBe(true);
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/inbox')).toBe(false);
    expect(isPublicPath('/settings/accounts')).toBe(false);
    expect(isPublicPath('/loginx')).toBe(false);
    expect(isPublicPath('/api/accounts')).toBe(false);
  });
});
