export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'method_not_allowed'
  | 'not_implemented'
  | 'internal_error';

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  bad_request: 400,
  method_not_allowed: 405,
  not_implemented: 501,
  internal_error: 500,
};

/** Generic, user-safe messages. Internal details are logged (redacted), never returned. */
const MESSAGE: Record<ApiErrorCode, string> = {
  unauthenticated: 'Authentication required.',
  forbidden: 'You do not have access to this resource.',
  not_found: 'Not found.',
  bad_request: 'The request was invalid.',
  method_not_allowed: 'Method not allowed.',
  not_implemented: 'Not available yet.',
  internal_error: 'Something went wrong.',
};

export class ApiError extends Error {
  override name = 'ApiError';
  readonly status: number;
  readonly publicMessage: string;

  constructor(readonly code: ApiErrorCode) {
    super(code);
    this.status = STATUS[code];
    this.publicMessage = MESSAGE[code];
  }
}
