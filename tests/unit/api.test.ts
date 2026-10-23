import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { jsonResponse, methodNotAllowed, withApiHandler } from '@/lib/api/response';

const request = new Request('http://localhost/api/test');

describe('API responses', () => {
  it('are never cacheable and carry a restrictive CSP', () => {
    const response = jsonResponse({ ok: true });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('map ApiError to its status with a generic message', async () => {
    const handler = withApiHandler(async () => {
      throw new ApiError('not_found');
    });
    const response = await handler(request, {});
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toEqual({ code: 'not_found', message: 'Not found.' });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('hide unexpected error details', async () => {
    const handler = withApiHandler(async () => {
      throw new Error('relation "app_private.oauth_credentials" leaked token=abc');
    });
    const response = await handler(request, {});
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('oauth_credentials');
    expect(text).not.toContain('token');
  });

  it('answer unsupported methods with 405 and Allow', async () => {
    const response = await methodNotAllowed(['GET'])(request, {});
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
  });
});
