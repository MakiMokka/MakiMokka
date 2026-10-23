import { API_CSP } from '@/lib/security/csp';
import { logger } from '@/lib/logging/logger';

import { ApiError } from './errors';

const BASE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'Content-Security-Policy': API_CSP,
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  Vary: 'Cookie',
};

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...BASE_HEADERS,
      ...init.headers,
    },
  });
}

export function errorResponse(
  error: ApiError,
  requestId: string,
  extraHeaders?: Record<string, string>,
) {
  return jsonResponse(
    { error: { code: error.code, message: error.publicMessage }, requestId },
    { status: error.status, headers: { 'X-Request-Id': requestId, ...extraHeaders } },
  );
}

type Handler<C> = (request: Request, context: C, requestId: string) => Promise<Response>;

/**
 * Wraps a route handler: assigns a request id, converts ApiError into a safe
 * JSON response and turns anything unexpected into a generic 500 without
 * leaking stack traces or messages.
 */
export function withApiHandler<C>(handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      const response = await handler(request, context, requestId);
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status >= 500) logger.error('api.error', { requestId, code: error.code });
        return errorResponse(error, requestId);
      }
      logger.error('api.unhandled_error', { requestId, error });
      return errorResponse(new ApiError('internal_error'), requestId);
    }
  };
}

export function methodNotAllowed(allowed: string[]) {
  return withApiHandler(async (_request, _context, requestId) =>
    errorResponse(new ApiError('method_not_allowed'), requestId, { Allow: allowed.join(', ') }),
  );
}
